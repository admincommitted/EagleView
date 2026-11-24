// Loads reference masters read from iCAFFE (04-Nov-2026). Source: _tariff_load/masters_load.json
//   Warehouses : the 258 made-up codes (W-NSA-01, WH_INxxx6_001 ...) are removed and the 3,265 real
//                ICEGATE warehouse codes are loaded (linked port = IN + first 4 letters of the code).
//                A made-up code still used by a job is kept.
//   Ports      : real Indian customs codes missing in EDI are added; codes that do not exist at ICEGATE are made INACTIVE.
//   Countries  : CW, XK, BV added.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'masters_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_masters_load_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'masters_load_result_' + stamp + '.txt');

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

    // codes used by jobs - never removed
    const used = new Set();
    for (const t of ['ImportJobs', 'ExportJobs']) {
      try { (await all(`SELECT DISTINCT upper(warehouseCode) c FROM ${t} WHERE warehouseCode IS NOT NULL AND warehouseCode <> ''`)).forEach(r => used.add(r.c)); } catch (e) { /* table/column missing */ }
    }
    await run('BEGIN IMMEDIATE');

    // ---- Warehouses
    const real = new Set(d.warehouses.map(w => w[0]));
    const have = await all('SELECT id, warehouseCode FROM Warehouses');
    let whDel = 0, whKept = 0, whAdd = 0, whUpd = 0;
    const haveMap = new Map();
    for (const h of have) {
      const c = String(h.warehouseCode).toUpperCase();
      if (real.has(c)) { haveMap.set(c, h.id); continue; }
      if (used.has(c)) { whKept++; say('  warehouse kept (used by a job): ' + h.warehouseCode); continue; }
      await run('DELETE FROM Warehouses WHERE id = ?', [h.id]); whDel++;
    }
    for (const [code, name, port, addr] of d.warehouses) {
      if (haveMap.has(code)) {
        await run('UPDATE Warehouses SET warehouseName = ?, linkedPortCode = ?, address = ?, country = ?, updatedAt = ? WHERE id = ?', [name, port, addr || null, 'IN', now(), haveMap.get(code)]); whUpd++;
      } else {
        await run('INSERT INTO Warehouses (warehouseCode, warehouseName, linkedPortCode, address, country, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', [code, name, port, addr || null, 'IN', now(), now()]); whAdd++;
      }
    }
    say('Warehouses: removed made-up ' + whDel + ', kept (in use) ' + whKept + ', added ' + whAdd + ', updated ' + whUpd);

    // ---- Ports
    const ports = new Set((await all('SELECT portCode FROM Ports')).map(r => String(r.portCode).toUpperCase()));
    let pAdd = 0, pOff = 0;
    for (const [code, name, cat, sez] of d.ports) {
      if (ports.has(code)) continue;
      await run("INSERT INTO Ports (portCode, portName, country, category, isSez, division, isActive, createdAt, updatedAt) VALUES (?,?,'INDIA (IN)',?,?,'BOTH (IMP/EXP)',1,?,?)", [code, name, cat, sez, now(), now()]);
      pAdd++;
    }
    for (const code of d.deactivatePorts) {
      const r = await run('UPDATE Ports SET isActive = 0, updatedAt = ? WHERE upper(portCode) = ? AND isActive <> 0', [now(), code]);
      if (r.changes) { pOff++; say('  port made inactive (not an ICEGATE code): ' + code); }
    }
    for (const [code, [name, cat, sez]] of Object.entries(d.renamePorts)) {
      await run('UPDATE Ports SET portName = ?, category = ?, isSez = ?, updatedAt = ? WHERE upper(portCode) = ?', [name, cat, sez, now(), code]);
    }
    say('Ports: added ' + pAdd + ', made inactive ' + pOff);

    // ---- Countries
    let cAdd = 0;
    for (const [code, name] of d.countries) {
      const r = await all('SELECT id FROM Countries WHERE upper(code) = ?', [code]);
      if (!r.length) { await run('INSERT INTO Countries (code, name, createdAt, updatedAt) VALUES (?,?,?,?)', [code, name, now(), now()]); cAdd++; }
    }
    say('Countries: added ' + cAdd);

    await run('COMMIT');
    const n = async (sql) => (await all(sql))[0].n;
    say('Now: warehouses ' + await n('SELECT count(*) n FROM Warehouses') + ' | ports active ' + await n('SELECT count(*) n FROM Ports WHERE isActive = 1') + ' | countries ' + await n('SELECT count(*) n FROM Countries'));
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
