// Import job number series from 20001 (18-Nov-2026, asked by the user).
// Why: the BE goes to ICEGATE with the running number of the job no (DEL-AI-1011 -> 1011) and one number may be filed
// only once in a financial year at a custom house. iCAFFE's import jobs of this year use 1 .. about 8,600 and go on,
// so EagleView import series (DEL-AI-, DEL-SI-, DEL-LI- ...) start at 20001, a range iCAFFE does not reach in a year.
// What it does: every IMPORT counter (Settings > Sequence Config, table JobSequences) whose next number is below 20001
// is set to 20001. Export counters and counters already at 20001 or more are not touched. Running it again changes nothing.
// Before: the JobSequences table is copied to backups\job_sequences_before_<time>.json. One transaction.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const START = 20001;
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(__dirname, '..', 'backups', 'job_sequences_before_' + stamp + '.json');
const LOGDIR = fs.existsSync(path.join(__dirname, '_tariff_load')) ? path.join(__dirname, '_tariff_load') : __dirname;
const LOG = path.join(LOGDIR, 'import_series_20001_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const out = []; const say = (x) => { console.log(x); out.push(x); };
const ts = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');

(async () => {
  try {
    await run('PRAGMA busy_timeout = 15000');
    const rows = await all('SELECT * FROM JobSequences ORDER BY id');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    fs.writeFileSync(BACKUP, JSON.stringify(rows, null, 2));
    say('Database: ' + DB);
    say('Backup of JobSequences: ' + BACKUP + ' (' + rows.length + ' rows)');
    say('');
    say('Counters now:');
    for (const r of rows) say(`  ${r.branchCode}  ${String(r.jobMode).padEnd(12)}  prefix ${String(r.prefix).padEnd(14)}  next ${r.startNumber}${r.financialYearId ? '  (FY id ' + r.financialYearId + ')' : ''}`);
    const todo = rows.filter(r => /IMPORT$/i.test(String(r.jobMode || '')) && Number(r.startNumber) < START);
    say('');
    if (!todo.length) { say('Nothing to change - every import counter is at ' + START + ' or more.'); }
    else {
      await run('BEGIN IMMEDIATE');
      try {
        for (const r of todo) await run('UPDATE JobSequences SET startNumber = ?, updatedAt = ? WHERE id = ?', [START, ts(), r.id]);
        await run('COMMIT');
      } catch (e) { await run('ROLLBACK').catch(() => {}); throw e; }
      say('Changed:');
      for (const r of todo) say(`  ${r.branchCode}  ${r.jobMode}: next ${r.startNumber} -> ${START}   (next job no ${r.prefix}${START})`);
    }
    say('');
    say('Export counters are not changed.');
    say('Done. No restart needed - the next new import job takes the new number.');
  } catch (e) {
    say('FAILED, nothing changed: ' + e.message);
    process.exitCode = 1;
  } finally {
    try { fs.writeFileSync(LOG, out.join('\r\n') + '\r\n'); console.log('\nResult file: ' + LOG); } catch (e) { /* no log */ }
    db.close();
  }
})();
