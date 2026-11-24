// Second set of reference masters read from iCAFFE (04-Nov-2026). Source: _tariff_load/masters2_load.json
//   ForeignPorts     : new table - 45,425 UN/LOCODE port codes (AEJEA, CNSHA, ...) for the foreign port boxes (sea + air).
//   Ports            : the foreign 3-letter IATA rows (LHR, DXB, ...) are made INACTIVE - ICEGATE wants the 5-letter code.
//   Bonds            : the 30 ICEGATE bond codes are added / updated; EDI codes that are not in that list are made INACTIVE.
//   DutyNotifHeaders : a notification number is unique per TYPE now (IGST 001/2017 and ADD 001/2017 are different
//                      notifications); the 375 anti-dumping notification numbers are added as type ADD.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'masters2_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_masters2_load_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'masters2_load_result_' + stamp + '.txt');

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
    await run('PRAGMA foreign_keys = OFF');
    await run('BEGIN IMMEDIATE');

    // ---- ForeignPorts (new table)
    await run('CREATE TABLE IF NOT EXISTS ForeignPorts (id INTEGER PRIMARY KEY AUTOINCREMENT, code VARCHAR(10) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, countryCode VARCHAR(5), isActive TINYINT(1) DEFAULT 1, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)');
    await run('CREATE INDEX IF NOT EXISTS foreign_ports_country ON ForeignPorts (countryCode)');
    let fp = 0;
    const t = now();
    for (const [code, name, cc] of d.sea) {
      await run('INSERT INTO ForeignPorts (code, name, countryCode, isActive, createdAt, updatedAt) VALUES (?,?,?,1,?,?) ON CONFLICT(code) DO UPDATE SET name = excluded.name, countryCode = excluded.countryCode, updatedAt = excluded.updatedAt', [code, name, cc, t, t]);
      fp++;
    }
    say('ForeignPorts: ' + fp + ' codes loaded');

    // ---- Ports: foreign 3-letter IATA rows off
    const off = await run("UPDATE Ports SET isActive = 0, updatedAt = ? WHERE isActive <> 0 AND length(trim(portCode)) <= 3 AND upper(portCode) NOT LIKE 'IN%'", [now()]);
    say('Ports: foreign 3-letter rows made inactive: ' + off.changes);

    // ---- Bonds
    const official = new Set(d.bonds.map(b => b[0]));
    const have = new Map((await all('SELECT id, upper(bondCode) c, isActive FROM Bonds')).map(r => [r.c, r]));
    let bAdd = 0, bUpd = 0, bOff = 0;
    for (const [code, desc] of d.bonds) {
      const h = have.get(code);
      if (h) { await run('UPDATE Bonds SET description = ?, isActive = 1, updatedAt = ? WHERE id = ?', [desc, now(), h.id]); bUpd++; }
      else { await run('INSERT INTO Bonds (bondCode, description, isActive, createdAt, updatedAt) VALUES (?,?,1,?,?)', [code, desc, now(), now()]); bAdd++; }
    }
    for (const [code, h] of have) {
      if (!official.has(code) && h.isActive) { await run('UPDATE Bonds SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), h.id]); bOff++; say('  bond made inactive (not an ICEGATE code): ' + code); }
    }
    say('Bonds: added ' + bAdd + ', updated ' + bUpd + ', made inactive ' + bOff);

    // ---- DutyNotifHeaders: unique (notifNo, type) instead of notifNo alone
    const ddl = (await all("SELECT sql FROM sqlite_master WHERE name = 'DutyNotifHeaders'"))[0].sql;
    if (/`notifNo`[^,]*UNIQUE/i.test(ddl)) {
      await run('CREATE TABLE DutyNotifHeaders_new (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `notifNo` VARCHAR(255) NOT NULL, `type` VARCHAR(255) NOT NULL, `effectiveDate` DATE, `isActive` TINYINT(1) DEFAULT 1, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL)');
      await run('INSERT INTO DutyNotifHeaders_new (id, notifNo, type, effectiveDate, isActive, createdAt, updatedAt) SELECT id, notifNo, type, effectiveDate, isActive, createdAt, updatedAt FROM DutyNotifHeaders');
      await run('DROP TABLE DutyNotifHeaders');
      await run('ALTER TABLE DutyNotifHeaders_new RENAME TO DutyNotifHeaders');
      await run('CREATE UNIQUE INDEX duty_notif_headers_notif_no_type ON DutyNotifHeaders (notifNo, type)');
      say('DutyNotifHeaders: notification no. is now unique per type');
    }
    let adAdd = 0;
    for (const [no, dt] of d.ad) {
      const ex = await all("SELECT id FROM DutyNotifHeaders WHERE notifNo = ? AND upper(type) = 'ADD'", [no]);
      if (ex.length) { if (dt) await run('UPDATE DutyNotifHeaders SET effectiveDate = coalesce(effectiveDate, ?), updatedAt = ? WHERE id = ?', [dt, now(), ex[0].id]); continue; }
      await run("INSERT INTO DutyNotifHeaders (notifNo, type, effectiveDate, isActive, createdAt, updatedAt) VALUES (?, 'ADD', ?, 1, ?, ?)", [no, dt, now(), now()]);
      adAdd++;
    }
    say('Anti-dumping notifications added: ' + adAdd);

    await run('COMMIT');
    const orphans = (await all('SELECT count(*) n FROM DutyNotifDetails WHERE headerId NOT IN (SELECT id FROM DutyNotifHeaders)'))[0].n;
    say('Check: notification serial rows without a header: ' + orphans);
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { await run('PRAGMA foreign_keys = ON'); } catch (e) { /* ignore */ }
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
