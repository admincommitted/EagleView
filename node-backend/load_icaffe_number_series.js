// iCAFFE number series into Settings > Number Series (iCAFFE) (05-Nov-2026).
// Source: _tariff_load\icaffe_number_series_20261105.json - read from iCAFFE (voucher lists per division, docket lookups):
//   for each branch + division: the format of bank (BA), cash (CA) and journal (JN) vouchers, of each GST invoice kind
//   (e.g. DL/26/EX/0000027) and of dockets (NDL/AE/14138/26), with the last number iCAFFE has given this financial year.
//   Next number here = iCAFFE's last + 1, so EagleView carries on from where iCAFFE is.
// Branches: iCAFFE NDL = EagleView DEL (code kept; iCAFFE code and state code stored on the branch). MUM, JPR, LDH are added
// to Company Branches when missing (they are iCAFFE branches with their own series).
// Nothing is deleted; a series that is already there is updated only if its next number is lower than iCAFFE's.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const SRC = process.env.EDI_SRC || path.join(__dirname, '_tariff_load', 'icaffe_number_series_20261105.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_number_series_' + stamp + '.sqlite');
const LOG = path.join(path.dirname(SRC), 'icaffe_number_series_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };

(async () => {
  try {
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    say('Source: ' + SRC + ' - ' + src.series.length + ' series, read ' + src.at);
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    const S = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize (SQLite) reads; 'T...Z' came back as null (job created time, timeline)
    await run(`CREATE TABLE IF NOT EXISTS NumberSeries (id INTEGER PRIMARY KEY AUTOINCREMENT, docType TEXT NOT NULL, branchCode TEXT NOT NULL, division TEXT NOT NULL DEFAULT '',
      fyCode TEXT NOT NULL, format TEXT NOT NULL, pad INTEGER DEFAULT 0, nextNo INTEGER NOT NULL DEFAULT 1, lastNo TEXT, lastDate TEXT, source TEXT, isActive TINYINT(1) DEFAULT 1,
      modifiedBy TEXT, createdAt DATETIME, updatedAt DATETIME, UNIQUE (docType, branchCode, division, fyCode))`);
    const vc = new Set((await all('PRAGMA table_info(Vouchers)')).map(c => c.name));
    if (!vc.has('division')) { await run('ALTER TABLE Vouchers ADD COLUMN division TEXT'); say('Vouchers: column added division'); }
    const bc = new Set((await all('PRAGMA table_info(CompanyBranches)')).map(c => c.name));
    for (const c of ['icaffeCode', 'stateCode']) if (!bc.has(c)) { await run(`ALTER TABLE CompanyBranches ADD COLUMN ${c} TEXT`); say('CompanyBranches: column added ' + c); }

    // branches
    const have = new Map((await all('SELECT branchCode FROM CompanyBranches')).map(b => [String(b.branchCode).toUpperCase(), 1]));
    for (const b of src.branches) {
      if (have.has(b.code)) { await run('UPDATE CompanyBranches SET icaffeCode = ?, stateCode = ?, updatedAt = ? WHERE upper(branchCode) = ?', [b.icaffe, b.state, S, b.code]); say('Branch ' + b.code + ': iCAFFE code ' + b.icaffe + ', state ' + b.state); }
      else { await run("INSERT INTO CompanyBranches (branchCode, branchName, address, status, isDefault, icaffeCode, stateCode, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)", [b.code, b.name, b.address || null, 'Active', 0, b.icaffe, b.state, S, S]); say('Branch ' + b.code + ' added (' + b.name + ')'); }
    }

    let add = 0, upd = 0, same = 0;
    for (const r of src.series) {
      const ex = (await all('SELECT id, nextNo FROM NumberSeries WHERE docType = ? AND branchCode = ? AND division = ? AND fyCode = ?', [r.docType, r.branchCode, r.division, r.fyCode]))[0];
      if (!ex) { await run('INSERT INTO NumberSeries (docType, branchCode, division, fyCode, format, pad, nextNo, lastNo, lastDate, source, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [r.docType, r.branchCode, r.division, r.fyCode, r.format, r.pad, r.nextNo, r.lastNo || null, r.lastDate || null, 'iCAFFE ' + src.at.slice(0, 10), 1, S, S]); add++; }
      else if (Number(ex.nextNo) < r.nextNo) { await run('UPDATE NumberSeries SET format = ?, pad = ?, nextNo = ?, lastNo = ?, lastDate = ?, source = ?, updatedAt = ? WHERE id = ?', [r.format, r.pad, r.nextNo, r.lastNo || null, r.lastDate || null, 'iCAFFE ' + src.at.slice(0, 10), S, ex.id]); upd++; }
      else same++;
      say('  ' + r.branchCode + ' ' + (r.division || '--') + ' ' + r.docType.padEnd(16) + ' ' + r.format.padEnd(20) + ' next ' + r.nextNo + (r.lastNo ? '  (iCAFFE last ' + r.lastNo + ')' : ''));
    }
    say('Series: ' + add + ' added, ' + upd + ' moved up to iCAFFE, ' + same + ' already at or past iCAFFE');
    await run('COMMIT');
    say('Done.');
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* not in a transaction */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
