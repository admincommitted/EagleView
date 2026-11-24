// Anti-dumping duty rows read from iCAFFE's Antidumping Master (04-Nov-2026). Source: _tariff_load/antidumping_load.json
//   [[notifNo, serialNo, cthSlNo, cth, specSeries, originCountry, exportCountry, flag, rate, amount, uqc, currency,
//     factor, endDate, notifDate, memorandum], ...]
//   AddDutyRates     : new table, emptied and filled again on every run (the master is iCAFFE's).
//   DutyNotifHeaders : the ADD notifications get their notification date.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DATA = path.join(__dirname, '_tariff_load', 'antidumping_load.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'database_before_antidumping_load_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'antidumping_load_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const txt = (v) => (v == null ? null : String(v).replace(/\s+/g, ' ').trim() || null);
const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    const rows = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    await run('BEGIN IMMEDIATE');
    await run(`CREATE TABLE IF NOT EXISTS AddDutyRates (id INTEGER PRIMARY KEY AUTOINCREMENT, notifNo VARCHAR(20) NOT NULL, notifDate DATE,
      endDate DATE, serialNo VARCHAR(20), cthSlNo VARCHAR(20), cth VARCHAR(10) NOT NULL, specSeries VARCHAR(50), originCountry VARCHAR(5),
      exportCountry VARCHAR(5), flag VARCHAR(5), rate DECIMAL(12,4), amount DECIMAL(14,4), uqc VARCHAR(10), currency VARCHAR(5),
      factor DECIMAL(12,4), memorandum VARCHAR(255), isActive TINYINT(1) DEFAULT 1, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)`);
    await run('CREATE INDEX IF NOT EXISTS add_duty_rates_cth ON AddDutyRates (cth)');
    await run('CREATE INDEX IF NOT EXISTS add_duty_rates_notif ON AddDutyRates (notifNo)');
    await run('DELETE FROM AddDutyRates');
    const t = now();
    const dates = new Map();
    let n = 0;
    for (const r of rows) {
      const [notifNo, serialNo, cthSlNo, cth, spec, cogn, ccon, flag, rate, amount, uqc, curr, factor, endDate, notifDate, memo] = r;
      const code = String(cth || '').replace(/\D/g, '');
      if (!notifNo || code.length < 4) continue;
      await run(`INSERT INTO AddDutyRates (notifNo, notifDate, endDate, serialNo, cthSlNo, cth, specSeries, originCountry, exportCountry, flag, rate, amount,
                 uqc, currency, factor, memorandum, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
        [txt(notifNo), notifDate || null, endDate || null, txt(serialNo), txt(cthSlNo), code, txt(spec), txt(cogn) && txt(cogn).toUpperCase(),
          txt(ccon) && txt(ccon).toUpperCase(), txt(flag) && txt(flag).toUpperCase(), num(rate), num(amount), txt(uqc), txt(curr), num(factor), txt(memo), t, t]);
      if (notifDate) dates.set(txt(notifNo), notifDate);
      n++;
    }
    let d = 0;
    for (const [no, dt] of dates) {
      const r = await run("UPDATE DutyNotifHeaders SET effectiveDate = ?, updatedAt = ? WHERE notifNo = ? AND upper(type) = 'ADD' AND (effectiveDate IS NULL OR effectiveDate <> ?)", [dt, now(), no, dt]);
      d += r.changes;
    }
    await run('COMMIT');
    const s = (await all('SELECT count(*) n, count(DISTINCT notifNo) k, count(DISTINCT cth) c FROM AddDutyRates'))[0];
    say('AddDutyRates: ' + n + ' rows | ' + s.k + ' notifications | ' + s.c + ' CTH codes');
    say('ADD notification dates set: ' + d);
    say('DONE');
  } catch (e) {
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    say('FAILED - nothing was changed: ' + (e && e.message));
  } finally {
    try { fs.writeFileSync(LOG, log.join('\r\n')); } catch (e) { /* ignore */ }
    db.close();
  }
})();
