// e-Sanchit document codes from the ICEGATE e-Sanchit portal itself (Search Document > Document Types, read 14-Nov-2026,
// login CCCPL1998). Source: _tariff_load/esanchit_portal_20261114.json  [[code, description], ...]  (217 codes)
//   - code not in EagleView      -> added (documentType OPTIONAL, agency ICEGATE, active)
//   - code in EagleView, inactive -> made active
//   - description different       -> portal description written (documentType / agency kept)
//   - EagleView codes NOT in this list are left as they are (the portal may show a list filtered by the user's role)
// One transaction. Before it the whole ESanchits table is copied to backups\esanchit_master_before_portal_<time>.json
// (small file - no full database copy). Running it again changes nothing.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'esanchit_portal_20261114.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'esanchit_master_before_portal_' + stamp + '.json');
const LOG = path.join(__dirname, '_tariff_load', 'esanchit_portal_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const log = [];
const say = (s) => { console.log(s); log.push(s); };

(async () => {
  let open = false;
  try {
    await run('PRAGMA busy_timeout = 30000');
    const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    const before = await all('SELECT * FROM ESanchits ORDER BY id');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    fs.writeFileSync(BACKUP, JSON.stringify(before, null, 1));
    say('Backup of the e-Sanchit master (' + before.length + ' rows): ' + BACKUP);
    const have = new Map(before.map(r => [norm(r.documentCode).toUpperCase(), r]));
    say('Codes in the portal list: ' + data.length + ' | rows in EagleView before: ' + before.length + ', active ' + before.filter(r => r.isActive).length);

    let added = 0, activated = 0, renamed = 0;
    await run('BEGIN IMMEDIATE'); open = true;
    for (const [c, d] of data) {
      const code = norm(c).toUpperCase(); const desc = norm(d).slice(0, 255);
      if (!/^[0-9A-Z]{1,6}$/.test(code) || !desc) { say('  skipped (bad row): ' + c); continue; }
      const ex = have.get(code);
      if (!ex) {
        await run("INSERT INTO ESanchits (documentCode, description, documentType, agency, isActive, createdAt, updatedAt) VALUES (?,?,'OPTIONAL','ICEGATE',1,?,?)", [code, desc, now(), now()]);
        say('  added: ' + code + ' - ' + desc); added++;
        continue;
      }
      const sets = []; const p = [];
      if (!ex.isActive) { sets.push('isActive = 1'); activated++; say('  made active: ' + code); }
      if (norm(ex.description).toLowerCase() !== desc.toLowerCase()) { sets.push('description = ?'); p.push(desc); renamed++; say('  description: ' + code + ' "' + norm(ex.description) + '" -> "' + desc + '"'); }
      if (sets.length) await run('UPDATE ESanchits SET ' + sets.join(', ') + ', updatedAt = ? WHERE id = ?', [...p, now(), ex.id]);
    }
    await run('COMMIT'); open = false;
    const c = (await all('SELECT count(*) n, sum(isActive) a FROM ESanchits'))[0];
    say('Added: ' + added + ' | made active: ' + activated + ' | description changed: ' + renamed);
    say('e-Sanchit master now: ' + c.n + ' rows, ' + c.a + ' active');
    say('DONE');
  } catch (e) {
    if (open) { try { await run('ROLLBACK'); } catch (x) { /* ignore */ } }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
