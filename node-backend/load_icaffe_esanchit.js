// Loads the official e-Sanchit document codes read from iCAFFE (04-Nov-2026) into the EDI e-Sanchit master.
// Source: _tariff_load/esanchit_load.json  [[code, description], ...]
//   - code already in EDI  -> description updated, made active (documentType / agency kept)
//   - code not in EDI      -> added (documentType OPTIONAL, agency ICEGATE)
//   - EDI code NOT in the iCAFFE list -> made INACTIVE (not deleted)
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'esanchit_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_esanchit_load_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'esanchit_load_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");

    const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    const official = new Set(data.map(r => r[0]));
    const have = new Map((await all('SELECT id, documentCode, isActive FROM ESanchits')).map(r => [String(r.documentCode).trim().toUpperCase(), r]));
    say('Codes in iCAFFE list: ' + data.length + ' | rows in EDI before: ' + have.size);

    let added = 0, updated = 0, deactivated = 0;
    await run('BEGIN IMMEDIATE');
    for (const [code, d] of data) {
      const desc = String(d).replace(/\s+/g, ' ').trim().slice(0, 255);
      const ex = have.get(code);
      if (ex) {
        await run('UPDATE ESanchits SET description = ?, isActive = 1, updatedAt = ? WHERE id = ?', [desc, now(), ex.id]);
        updated++;
      } else {
        await run("INSERT INTO ESanchits (documentCode, description, documentType, agency, isActive, createdAt, updatedAt) VALUES (?,?,'OPTIONAL','ICEGATE',1,?,?)",
          [code, desc, now(), now()]);
        added++;
      }
    }
    for (const [code, r] of have) {
      if (!official.has(code) && r.isActive) {
        await run('UPDATE ESanchits SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), r.id]);
        say('  made inactive (not in iCAFFE list): ' + code);
        deactivated++;
      }
    }
    await run('COMMIT');
    const c = (await all('SELECT count(*) n, sum(isActive) a FROM ESanchits'))[0];
    say('Added: ' + added + ' | updated: ' + updated + ' | made inactive: ' + deactivated);
    say('ESanchits now: ' + c.n + ' rows, ' + c.a + ' active');
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
