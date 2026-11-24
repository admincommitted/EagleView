// Remaining masters (04-Nov-2026). Source: _tariff_load/remaining_masters_load.json
//   Rosctls       : RoSCTL schedules 1-4 (Notification 14/26/2023-DGFT as amended; State + Central rates, Rs cap per UQC).
//                   973 serial rows (610101, 6114-AA ...). The old 8-digit rows with rate 0 are made INACTIVE.
//   ShippingLines : new table - 124 shipping line codes (SPL/xxx) read from iCAFFE Export Sea.
//   Ports         : 17 Indian sea ports that were missing (UN/LOCODE INENR1, INHAL1 ...), category SEA.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'remaining_masters_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_remaining_masters_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'remaining_masters_result_' + stamp + '.txt');

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
    const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    await run('BEGIN IMMEDIATE');
    const t = now();

    // ---- RoSCTL
    const have = new Map((await all('SELECT id, upper(tariffItem) c FROM Rosctls')).map(r => [r.c, r.id]));
    const official = new Set();
    let rAdd = 0, rUpd = 0;
    for (const [code, desc, uqc, rate, cap] of d.rosctl) {
      const c = String(code).trim().toUpperCase();
      official.add(c);
      const id = have.get(c);
      if (id) { await run('UPDATE Rosctls SET description = ?, uqc = ?, rate = ?, cap = ?, isActive = 1, updatedAt = ? WHERE id = ?', [desc, uqc, rate, cap, t, id]); rUpd++; }
      else { await run('INSERT INTO Rosctls (tariffItem, description, uqc, rate, cap, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,1,?,?)', [c, desc, uqc, rate, cap, t, t]); rAdd++; }
    }
    let rOff = 0;
    for (const [c, id] of have) {
      if (!official.has(c)) { const x = await run('UPDATE Rosctls SET isActive = 0, updatedAt = ? WHERE id = ? AND isActive <> 0', [t, id]); rOff += x.changes; }
    }
    say('Rosctls: added ' + rAdd + ', updated ' + rUpd + ', old rows made inactive ' + rOff);

    // ---- Shipping lines (new table)
    await run('CREATE TABLE IF NOT EXISTS ShippingLines (id INTEGER PRIMARY KEY AUTOINCREMENT, code VARCHAR(20) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, isActive TINYINT(1) DEFAULT 1, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)');
    let sl = 0;
    for (const [code, name] of d.shiplines) {
      await run('INSERT INTO ShippingLines (code, name, isActive, createdAt, updatedAt) VALUES (?,?,1,?,?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, updatedAt = excluded.updatedAt', [code, name, t, t]);
      sl++;
    }
    say('ShippingLines: ' + sl + ' codes loaded');

    // ---- Indian sea ports
    let pAdd = 0;
    for (const [code, name] of d.ports) {
      const ex = await all('SELECT id FROM Ports WHERE upper(portCode) = ?', [code]);
      if (ex.length) { say('  port already there, left as is: ' + code); continue; }
      await run("INSERT INTO Ports (portCode, portName, country, category, isSez, division, isActive, createdAt, updatedAt) VALUES (?, ?, 'INDIA (IN)', 'SEA', 0, 'BOTH (IMP/EXP)', 1, ?, ?)", [code, name, t, t]);
      pAdd++;
    }
    say('Ports: Indian sea ports added ' + pAdd);

    await run('COMMIT');
    const s = (await all('SELECT count(*) n, sum(isActive) a FROM Rosctls'))[0];
    say('Check: Rosctls ' + s.n + ' rows, ' + s.a + ' active');
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
