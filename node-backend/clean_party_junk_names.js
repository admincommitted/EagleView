// Junk party names out of the Party Master (08-Nov-2026).
// Only the consignees bulk-loaded from iCAFFE that have never been used (Parties.searchOnly = 1) are touched - a party that has been
// opened in the Party Master or used in a shipment is never removed or renamed.
//   Removed (party + its addresses + AD codes; the iCAFFE directory row stays as the archive and is marked isActive = 0 so it is not
//   loaded again):
//   - no letters at all ("000034-002", "61389")
//   - fewer than 3 letters ("6177 C", "NA", "TO,", "M/S.") - but "B & F", "S&W" style names are kept
//   - one letter repeated ("CCC", "XXXX"), "ZZZZ" fillers, "DO NOT USE", "TEST CONSIGNEE", a code followed by XXX
//     ("000079-002 XXX ..."), SWIFT codes ("BSCHESMMXXX")
//   Cleaned (name kept, stray marks taken off): leading dots / commas / spaces (".ALBERTO REAL BENITEZ" -> "ALBERTO REAL BENITEZ"),
//   trailing commas, an unmatched double quote ('"WALLARD DESIGN LLC' -> 'WALLARD DESIGN LLC') and quotes round the whole name
//   ('"CAMPUS RODO"' -> 'CAMPUS RODO'). "#01 ATWOODS" and '"TUNA" LLC'
//   stay as they are. When another party already has the cleaned name ("ABC LTD," and "ABC LTD") the two are the same party:
//   the search-only one is joined to the other - its addresses not already there are added to it, it gets the consignee tick,
//   the iCAFFE directory row points to it, and the duplicate is removed.
//   Older parties (not search-only) with such names are only listed in party_junk_names_review_<stamp>.csv - nothing changed.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_party_junk_names_' + stamp + '.sqlite');
const OUT = fs.existsSync(TL) ? TL : __dirname;
const LOG = path.join(OUT, 'party_junk_names_result_' + stamp + '.txt');
const CSV_DONE = path.join(OUT, 'party_junk_names_done_' + stamp + '.csv');
const CSV_REVIEW = path.join(OUT, 'party_junk_names_review_' + stamp + '.csv');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (x) => { console.log(x); log.push(x); };
const cq = (v) => (/[",\n]/.test(String(v == null ? '' : v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v == null ? '' : v));

function junkReason(name) {
  const u = String(name || '').toUpperCase().trim();
  const letters = (u.match(/[A-Z]/g) || []).length;
  if (!letters) return 'no letters';
  if (letters < 3 && !/^[A-Z]&[A-Z]$/.test(u.replace(/[^A-Z&]/g, ''))) return 'fewer than 3 letters';
  if (/^[^A-Z]*([A-Z])\1+[^A-Z]*$/.test(u)) return 'one letter repeated';
  if (/\bZZZ+\b/.test(u)) return 'ZZZ filler';
  if (/\b(DO NOT USE|DONT USE|DON'T USE|NOT IN USE|NOT TO BE USED|TEST CONSIGNEE)\b/.test(u)) return 'marked not to use / test';
  if (/^\d[\d-]*\s+XXX\b/.test(u)) return 'code + XXX';
  if (/^[A-Z]{6}[A-Z0-9]{2}XXX$/.test(u)) return 'SWIFT code';
  return null;
}
function cleaned(name) {
  let n = String(name || '').replace(/\s+/g, ' ').trim();
  n = n.replace(/^[\s.,;:`]+/, '').replace(/[\s,;:`]+$/, '');
  if (((n.match(/"/g) || []).length) % 2 === 1) n = n.replace(/^"\s*/, '').replace(/\s*"$/, '');
  for (const q of ['"', "'", '\u201c\u201d']) { // a name wrapped in quotes: "CAMPUS RODO" -> CAMPUS RODO
    const a = q[0], b = q[1] || q[0];
    if (n.startsWith(a) && n.endsWith(b) && n.length > 2 && !n.slice(1, -1).includes(a) && !n.slice(1, -1).includes(b)) n = n.slice(1, -1).trim();
  }
  n = n.trim();
  return (n.match(/[A-Za-z]/g) || []).length >= 3 ? n : null;
}

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    const cols = new Set((await all('PRAGMA table_info(Parties)')).map(c => c.name));
    if (!cols.has('searchOnly')) throw new Error('Parties.searchOnly not found - run load_icaffe_parties_to_master_all.bat first');
    const parties = await all('SELECT id, code, name, coalesce(searchOnly, 0) so FROM Parties');
    const names = new Map(); for (const p of parties) { const k = String(p.name || '').trim().toUpperCase(); names.set(k, (names.get(k) || 0) + 1); }
    const T = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
    const done = [], review = []; let removed = 0, renamed = 0, keptClash = 0, merged = 0, mergedAddr = 0;
    const akey = (b) => [b.address1, b.city, b.pinCode].map(x => String(x || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()).join('|');
    const why = {};
    for (const p of parties) {
      const r = junkReason(p.name);
      if (r) {
        if (!p.so) { review.push([p.id, p.code, p.name, r]); continue; }
        await run('DELETE FROM PartyBranches WHERE partyId = ?', [p.id]);
        await run('DELETE FROM PartyADCodes WHERE partyId = ?', [p.id]);
        await run('DELETE FROM Parties WHERE id = ?', [p.id]);
        await run('UPDATE IcaffeParties SET importedPartyId = NULL, isActive = 0, updatedAt = ? WHERE importedPartyId = ?', [T, p.id]);
        removed++; why[r] = (why[r] || 0) + 1; done.push(['removed', p.id, p.code, p.name, '', r]);
        continue;
      }
      if (!p.so) { if (/^[\s.,;:`]/.test(p.name || '') || ((String(p.name).match(/"/g) || []).length % 2 === 1)) review.push([p.id, p.code, p.name, 'stray mark at the start / unmatched quote']); continue; }
      const c = cleaned(p.name);
      if (!c || c === p.name) continue;
      if (names.get(c.toUpperCase())) {
        const tgt = (await all('SELECT id FROM Parties WHERE upper(trim(name)) = ? AND id <> ? ORDER BY coalesce(searchOnly, 0), id LIMIT 1', [c.toUpperCase(), p.id]))[0];
        if (!tgt) { keptClash++; continue; }
        const have = new Set((await all('SELECT address1, city, pinCode FROM PartyBranches WHERE partyId = ?', [tgt.id])).map(akey));
        let sr = (await all('SELECT count(*) n FROM PartyBranches WHERE partyId = ?', [tgt.id]))[0].n, moved = 0;
        for (const b of await all('SELECT id, address1, city, pinCode FROM PartyBranches WHERE partyId = ?', [p.id])) {
          const k = akey(b);
          if (!k.replace(/\|/g, '') || have.has(k)) { await run('DELETE FROM PartyBranches WHERE id = ?', [b.id]); continue; }
          have.add(k); sr++; moved++;
          await run('UPDATE PartyBranches SET partyId = ?, branchSrNo = ?, isDefault = ?, updatedAt = ? WHERE id = ?', [tgt.id, String(sr), sr === 1 ? 1 : 0, T, b.id]);
        }
        await run('UPDATE PartyADCodes SET partyId = ? WHERE partyId = ?', [tgt.id, p.id]);
        await run('UPDATE Parties SET isConsignee = 1, updatedAt = ? WHERE id = ? AND coalesce(isConsignee, 0) = 0', [T, tgt.id]);
        await run('UPDATE IcaffeParties SET importedPartyId = ?, updatedAt = ? WHERE importedPartyId = ?', [tgt.id, T, p.id]);
        await run('DELETE FROM Parties WHERE id = ?', [p.id]);
        merged++; mergedAddr += moved; done.push(['joined to party ' + tgt.id + ' (same name)', p.id, p.code, p.name, c, moved + ' address(es) moved']);
        continue;
      }
      await run('UPDATE Parties SET name = ?, updatedAt = ? WHERE id = ?', [c, T, p.id]);
      names.set(c.toUpperCase(), 1);
      renamed++; done.push(['cleaned', p.id, p.code, p.name, c, '']);
    }
    say('Search-only iCAFFE consignees removed from the Party Master: ' + removed + ' (' + Object.entries(why).map(([k, v]) => k + ' ' + v).join(', ') + ')');
    say('Names cleaned (stray dots / commas / unmatched quote taken off): ' + renamed);
    say('Same party twice ("ABC LTD," and "ABC LTD") - joined into one: ' + merged + ' (' + mergedAddr + ' addresses moved to the party kept)' + (keptClash ? '; left as they were: ' + keptClash : ''));
    say('Older parties with such names - not changed, listed for review: ' + review.length);
    say('Party Master now: ' + (await all('SELECT count(*) n FROM Parties'))[0].n + ' parties');
    fs.writeFileSync(CSV_DONE, ['Action,Party id,iCAFFE code,Name,New name,Reason', ...done.map(r => r.map(cq).join(','))].join('\n'));
    fs.writeFileSync(CSV_REVIEW, ['Party id,Code,Name,Why listed', ...review.map(r => r.map(cq).join(','))].join('\n'));
    say('List of what was done: ' + CSV_DONE);
    say('Older parties to look at: ' + CSV_REVIEW);
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done. Restart the backend.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* ignore */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
