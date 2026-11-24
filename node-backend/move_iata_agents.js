// IATA agents belong in the IATA Agent Master, not in the Unified Party Master (04-Nov-2026).
//   Parties   : the IATA-agent-only parties added today from iCAFFE (code IAT/..) are removed with their addresses;
//               a party that is also an exporter / sub agent / ... only loses the IATA Agent type.
//   IataAgents: every iCAFFE IATA agent is there (added if missing); the duplicate rows added today for an agent that
//               was already there (e.g. COMMITTED CARGO CARE LTD = COMMITTED CARGO CARE LIMITED) are removed.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_move_iata_agents_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'move_iata_agents_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const nk = (v) => String(v || '').toUpperCase().replace(/\bLIMITED\b/g, 'LTD').replace(/\bPRIVATE\b/g, 'PVT').replace(/[^A-Z0-9]/g, '');
const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };
const t0 = (v) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return t || null; };

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    const t = now();

    // ---- Party master
    const ps = await all('SELECT * FROM Parties WHERE isIataAgent = 1');
    let removed = 0, unflagged = 0;
    for (const p of ps) {
      const other = p.isShipper || p.isConsignee || p.isNotifyParty || p.isBuyer || p.isSubAgent || p.isOverseasAgent || p.isShipline || p.isBank;
      if (!other && /^IAT\//i.test(p.code || '') && String(p.createdAt).startsWith('2026-11-04')) {
        await run('DELETE FROM PartyBranches WHERE partyId = ?', [p.id]);
        await run('DELETE FROM PartyADCodes WHERE partyId = ?', [p.id]);
        await run('DELETE FROM PartyDrawbackAccounts WHERE partyId = ?', [p.id]);
        await run('DELETE FROM Parties WHERE id = ?', [p.id]);
        removed++; say('  removed from Party master: ' + p.code + ' ' + p.name);
      } else {
        await run('UPDATE Parties SET isIataAgent = 0, updatedAt = ? WHERE id = ?', [t, p.id]);
        unflagged++; say('  IATA Agent type taken off (party stays): ' + (p.code || '') + ' ' + p.name);
      }
    }
    await run("UPDATE IcaffeParties SET importedPartyId = NULL, updatedAt = ? WHERE partyType = 'IATA_AGENT'", [t]);
    say('Party master: removed ' + removed + ', type taken off ' + unflagged);

    // ---- IATA Agent master: one row per agent
    const ia = await all('SELECT id, name, createdAt FROM IataAgents ORDER BY id');
    const keep = new Map();
    let dup = 0;
    for (const r of ia) {
      const k = nk(r.name);
      if (!keep.has(k)) { keep.set(k, r.id); continue; }
      if (String(r.createdAt).startsWith('2026-11-04')) { await run('DELETE FROM IataAgents WHERE id = ?', [r.id]); dup++; say('  duplicate removed from IATA Agent master: ' + r.name); }
    }
    let add = 0;
    for (const r of await all("SELECT * FROM IcaffeParties WHERE partyType = 'IATA_AGENT'")) {
      if (keep.has(nk(r.name))) continue;
      const a = parse(r.addresses, [])[0] || {};
      const extra = parse(r.extra, {});
      const res = await run(`INSERT INTO IataAgents (name, iataCode, panNumber, isDefault, contactPerson, branchName, address1, address2, city, state, country, pinCode,
          gstNo, phone, mobile, email1, commissionType, createdAt, updatedAt) VALUES (?,?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,'PERCENT',?,?)`,
        [t0(r.name), t0(extra.iataCode), t0(r.pan), t0(a.contactPerson), t0(a.branchName), t0(a.address1), t0(a.address2), t0(a.city), t0(a.state), t0(a.country),
          t0(a.pinCode), t0(a.gstin), t0(a.phone), t0(a.mobile), t0(a.email1), t, t]);
      keep.set(nk(r.name), res.lastID); add++;
    }
    say('IATA Agent master: duplicates removed ' + dup + ', added ' + add);
    await run('COMMIT');
    const c = (await all('SELECT count(*) n FROM IataAgents'))[0].n;
    const p = (await all('SELECT count(*) n FROM Parties WHERE isIataAgent = 1'))[0].n;
    say('Check: IATA Agent master ' + c + ' agents; Party master IATA agents ' + p);
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
