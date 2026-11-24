// Company Branch master has JAIPUR twice: JPR (the code iCAFFE's vouchers and the accounts use) and JAI (a duplicate).
// This makes JAI Inactive (not deleted), so it is no longer offered in branch lists. 22-Nov-2026.
// It first shows where each code is used (every table with a branch column). It does nothing when:
//   - JPR is not there or not Active, or JAI is not there or already Inactive;
//   - JAI is the default branch.
// Rows that use JAI are only listed; they are not changed (move them to JPR on the screens if needed).
// The result file has the undo statement.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const LOG = path.join(__dirname, '_tariff_load', 'deactivate_jaipur_branch_result_' + stamp + '.txt');
const CHECK = process.argv.includes('--check');
const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };
(async () => {
  try {
    await run('PRAGMA busy_timeout = 60000');
    const rows = await all("SELECT id, branchCode, branchName, status, isDefault FROM CompanyBranches WHERE upper(trim(branchName)) = 'JAIPUR' OR upper(branchCode) IN ('JAI', 'JPR')");
    say((CHECK ? 'CHECK ONLY - nothing is written.' : 'RUN') + ' Jaipur rows in the Branch master:');
    rows.forEach(r => say('  id ' + r.id + '  ' + r.branchCode + '  ' + r.branchName + '  ' + r.status + (r.isDefault ? '  (default)' : '')));
    const jai = rows.find(r => String(r.branchCode).toUpperCase() === 'JAI');
    const jpr = rows.find(r => String(r.branchCode).toUpperCase() === 'JPR');
    // where each code is used
    const tables = (await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'CompanyBranches'")).map(t => t.name);
    say('Rows that use the code (table.column: JAI / JPR):');
    let jaiUse = 0;
    for (const t of tables) {
      const cols = (await all('PRAGMA table_info("' + t + '")')).map(c => c.name).filter(c => /branch/i.test(c));
      for (const c of cols) {
        const q = (code) => all('SELECT count(*) n FROM "' + t + '" WHERE upper(trim("' + c + '")) = ? OR (\',\' || upper(replace("' + c + '", \' \', \'\')) || \',\') LIKE ?', [code, '%,' + code + ',%']);
        const a = (await q('JAI'))[0].n, b = (await q('JPR'))[0].n;
        if (a || b) { say('  ' + t + '.' + c + ': ' + a + ' / ' + b); jaiUse += a; }
      }
    }
    say('Total rows that use JAI: ' + jaiUse + (jaiUse ? '  (they are NOT changed; JAI stays readable for them)' : ''));
    let stop = '';
    if (!jai) stop = 'No branch with code JAI.';
    else if (String(jai.status).toLowerCase() === 'inactive') stop = 'JAI is already Inactive.';
    else if (!jpr || String(jpr.status).toLowerCase() !== 'active') stop = 'JPR is not there or not Active - JAI is left as it is.';
    else if (jai.isDefault) stop = 'JAI is the default branch - left as it is.';
    if (stop) { say('NOTHING TO DO: ' + stop); }
    else if (CHECK) { say('WOULD DO: branch JAI (id ' + jai.id + ') -> Inactive. JPR stays Active.'); }
    else {
      await run("UPDATE CompanyBranches SET status = 'Inactive', updatedAt = ? WHERE id = ? AND upper(branchCode) = 'JAI'", [new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'), jai.id]);
      say('DONE: branch JAI (id ' + jai.id + ') is now Inactive.');
      say("UNDO: UPDATE CompanyBranches SET status = '" + jai.status + "' WHERE id = " + jai.id + ';');
    }
    if (!CHECK) { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.writeFileSync(LOG, log.join('\r\n') + '\r\n'); console.log('Result file: ' + LOG); }
  } catch (e) { console.log('ERROR: ' + e.message + ' - nothing more was done.'); process.exitCode = 1; }
  finally { db.close(); }
})();
