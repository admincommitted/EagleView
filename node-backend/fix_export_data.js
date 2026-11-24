// Export jobs - data fixes of 12-Nov-2026 (run once; nothing is deleted). --check only lists what would change.
// 1. Job date "Invalid date": a job saved with a blank job date (new job / job read from a file) got the text
//    "Invalid date" in ExportJobs.jobDate (NDL/SE/26/1001). It is set to the day the job was made (IST).
//    The software now fills the date itself when it saves.
// 2. Scheme Code master: code 60 said "REMISSION OF DUTIES AND TAXES ON EXPORTED PRODUCTS (RoDTEP)". In ICEGATE,
//    60 is Drawback + RoSCTL (Chennai Customs Facility Circular 05/2025); RoDTEP is claimed through the reward
//    flag, not a scheme code. Changed only while it still says RoDTEP.
// A full copy of the database is written to backups\ first. Stop the EagleView backend before running.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_export_fix_' + stamp + '.sqlite');
const NEW_60 = 'DRAWBACK AND REBATE OF STATE AND CENTRAL TAXES AND LEVIES (RoSCTL)';

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const bad = (v) => v === null || v === undefined || String(v).trim() === '' || isNaN(new Date(String(v).replace(' +00:00', 'Z').replace(' ', 'T')).getTime());
const istDay = (v) => new Date(new Date(String(v).replace(' +00:00', 'Z').replace(' ', 'T')).getTime() + 330 * 60000).toISOString().slice(0, 10);

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    const jobs = (await all('SELECT id, jobNo, jobDate, createdAt FROM ExportJobs')).filter(j => bad(j.jobDate));
    const fixJobs = jobs.map(j => ({ ...j, to: (bad(j.createdAt) ? new Date().toISOString().slice(0, 10) : istDay(j.createdAt)) + ' 00:00:00.000 +00:00' }));
    console.log(`Export jobs with a bad job date: ${fixJobs.length}`);
    fixJobs.forEach(j => console.log(`  ${j.jobNo}  "${j.jobDate}"  ->  ${j.to.slice(0, 10)}`));
    let sc = [];
    try { sc = await all('SELECT code, "desc" AS d FROM SchemeCodes WHERE code = ?', ['60']); } catch (e) { console.log('Scheme Code master not found - skipped'); }
    const fix60 = sc.filter(r => /RoDTEP/i.test(String(r.d || '')));
    console.log(`Scheme code 60: ${fix60.length ? '"' + fix60[0].d + '"  ->  "' + NEW_60 + '"' : 'nothing to change'}`);
    if (DRY) { console.log('Check only - nothing changed.'); return db.close(); }
    if (!fixJobs.length && !fix60.length) { console.log('Nothing to change.'); return db.close(); }
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    console.log('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    for (const j of fixJobs) await run('UPDATE ExportJobs SET jobDate = ? WHERE id = ?', [j.to, j.id]);
    if (fix60.length) await run('UPDATE SchemeCodes SET "desc" = ?, requiresDbk = 1, requiresRodtep = 0, updatedAt = datetime(\'now\') WHERE code = ?', [NEW_60, '60']);
    await run('COMMIT');
    console.log(`Done - ${fixJobs.length} job date(s)${fix60.length ? ', scheme code 60' : ''} fixed.`);
    db.close();
  } catch (e) {
    console.error('FAILED: ' + e.message);
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    db.close(); process.exitCode = 1;
  }
})();
