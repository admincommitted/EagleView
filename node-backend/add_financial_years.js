// Financial years for the iCAFFE history (06-Nov-2026): the books now hold vouchers from 01-04-2022, but Settings had only
// 2026-27. Adds 2022-23, 2023-24, 2024-25 and 2025-26 (same layout as 2026-27: code 25-26, name 2025-26, 1 Apr - 31 Mar),
// not closed, not default. A year that is already there is left as it is. A full copy of the database is written first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_fin_years_' + stamp + '.sqlite');
const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    const first = (await all('SELECT min(date) d FROM Vouchers'))[0].d || '2026-04-01';
    const y0 = Number(first.slice(0, 4)) - (Number(first.slice(5, 7)) < 4 ? 1 : 0);
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    console.log('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    const cols = new Set((await all('PRAGMA table_info(FinancialYears)')).map(c => c.name));
    const S = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize (SQLite) reads; 'T...Z' came back as null (job created time, timeline)
    for (let y = y0; y <= 2025; y++) {
      const code = String(y).slice(2) + '-' + String(y + 1).slice(2), name = y + '-' + String(y + 1).slice(2);
      const have = (await all('SELECT id FROM FinancialYears WHERE code = ? OR startDate = ?', [code, y + '-04-01']))[0];
      if (have) { console.log(name + ': already there'); continue; }
      const c = ['code', 'name', 'startDate', 'endDate', 'isActive', 'isClosed', 'createdAt', 'updatedAt'];
      const v = [code, name, y + '-04-01', (y + 1) + '-03-31', 1, 0, S, S];
      if (cols.has('yearType')) { c.push('yearType'); v.push('FINANCIAL'); }
      if (cols.has('isDefault')) { c.push('isDefault'); v.push(0); }
      if (cols.has('isDeleted')) { c.push('isDeleted'); v.push(0); }
      await run('INSERT INTO FinancialYears (' + c.join(', ') + ') VALUES (' + c.map(() => '?').join(', ') + ')', v);
      console.log(name + ': added (' + y + '-04-01 to ' + (y + 1) + '-03-31)');
    }
    await run('COMMIT');
    for (const r of await all('SELECT code, name, startDate, endDate, isActive, isClosed, isDefault FROM FinancialYears ORDER BY startDate')) console.log('  ' + JSON.stringify(r));
    console.log('Done.');
  } catch (e) { console.log('FAILED - nothing was changed: ' + (e && e.stack || e)); try { await run('ROLLBACK'); } catch (e2) {} }
  finally { db.close(); }
})();
