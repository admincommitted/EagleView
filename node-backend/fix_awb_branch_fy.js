// Fill the branch and financial year of AWBs saved before 10-Nov-2026 (AWB / MAWB in Airwaybills, HAWB in HouseAWBs).
// Until then the AWB screens never sent a branch or year, so both were empty on every AWB.
//   - branch: a HAWB takes its MAWB's branch when the MAWB has one; everything else gets the default branch
//     (CompanyBranches isDefault - head office). branchId = CompanyBranches.id.
//   - financial year: the FinancialYears row whose dates hold the AWB's executed date (else the date it was created).
// Only empty values are filled; nothing else is changed. --check only counts.
// One transaction; a full copy of the database is written to backups\ first. Stop the EagleView backend before running.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_awb_branch_fy_' + stamp + '.sqlite');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const ymd = (v) => {
  const t = String(v || '').trim(); let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    const br = await all("SELECT id, branchCode FROM CompanyBranches WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, id");
    if (!br.length) throw new Error('No branch in CompanyBranches');
    const def = br[0];
    const years = (await all('SELECT id, code, startDate, endDate FROM FinancialYears WHERE coalesce(isDeleted, 0) = 0'))
      .map(y => ({ id: y.id, code: y.code, s: String(y.startDate || '').slice(0, 10), e: String(y.endDate || '').slice(0, 10) }));
    const fyOf = (d) => { const y = years.find(x => d && d >= x.s && d <= x.e); return y ? y.id : null; };
    console.log(`Default branch: ${def.branchCode} (id ${def.id}). Years: ${years.map(y => y.code + ' ' + y.s + '..' + y.e).join(', ')}`);

    const plan = [];
    const mawbBranch = new Map();
    for (const t of ['Airwaybills', 'HouseAWBs']) {
      const rows = await all(`SELECT id, awbNumber, ${t === 'HouseAWBs' ? 'masterAwbNumber' : "'' masterAwbNumber"}, branchId, financialYearId, executedDate, createdAt FROM ${t}`);
      let nb = 0, nf = 0, noYear = 0;
      for (const r of rows) {
        if (t === 'Airwaybills' && r.branchId) mawbBranch.set(String(r.awbNumber || '').replace(/\D/g, ''), r.branchId);
        let b = null, f = null;
        if (!r.branchId) { b = (t === 'HouseAWBs' && mawbBranch.get(String(r.masterAwbNumber || '').replace(/\D/g, ''))) || def.id; nb++; }
        if (!r.financialYearId) { f = fyOf(ymd(r.executedDate) || String(r.createdAt || '').slice(0, 10)); if (f) nf++; else noYear++; }
        if (b || f) plan.push({ t, id: r.id, b, f });
      }
      console.log(`${t}: ${rows.length} records - branch to fill ${nb}, year to fill ${nf}${noYear ? ', no matching year for ' + noYear : ''}`);
    }
    if (DRY) { console.log('Check only - nothing changed.'); return db.close(); }
    if (!plan.length) { console.log('Nothing to fill.'); return db.close(); }
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    console.log('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    for (const x of plan) {
      if (x.b) await run(`UPDATE ${x.t} SET branchId = ? WHERE id = ? AND branchId IS NULL`, [x.b, x.id]);
      if (x.f) await run(`UPDATE ${x.t} SET financialYearId = ? WHERE id = ? AND financialYearId IS NULL`, [x.f, x.id]);
    }
    await run('COMMIT');
    console.log(`Done - ${plan.length} records filled.`);
    db.close();
  } catch (e) {
    console.error('ERROR: ' + e.message);
    try { await run('ROLLBACK'); } catch (x) { /* none open */ }
    process.exitCode = 1; db.close();
  }
})();
