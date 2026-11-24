// Job no. on iCAFFE sales vouchers (09-Nov-2026).
// The voucher loader took the job no. from the first account line of each voucher in iCAFFE's ledger report. On about
// 5,500 sales bills that line carries another docket, so the voucher shows a job no. that is not the bill's
// (e.g. DL/26/ET/0000159: job NDL/AE/458/26, bill and narration NDL/AE/854/26). Job-wise reports, job profit and
// search by docket then put the bill under the wrong docket.
// This sets the voucher's job no. to the bill's own docket (GST invoice, Sales Register) where the voucher's narration
// names that same docket (or names none). Nothing else is changed.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_fix_voucher_jobno_' + stamp + '.sqlite');
const LOG = path.join(__dirname, '_tariff_load', 'fix_voucher_jobno_result_' + stamp + '.txt');
const CSV = path.join(__dirname, '_tariff_load', 'fix_voucher_jobno_changes_' + stamp + '.csv');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };
const U = (s) => String(s || '').toUpperCase().trim();

(async () => {
  try {
    say('Database: ' + DB);
    const rows = await all(`SELECT v.id, v.voucherNumber, v.date, v.jobNo vj, v.narration, i.jobNo ij, i.invoiceNo
      FROM Vouchers v JOIN AccSalesInvoices i ON i.voucherId = v.id
      WHERE i.createdBy = 'iCAFFE' AND coalesce(trim(i.jobNo), '') <> '' AND upper(coalesce(trim(v.jobNo), '')) <> upper(trim(i.jobNo))`);
    const change = [], skip = [];
    for (const r of rows) {
      const narr = U(r.narration);
      const named = [...narr.matchAll(/DOCKET#\s*([A-Z]{2,4}\/[A-Z]{2}\/\d+\/\d{2})/g)].map(m => m[1]);
      if (!named.length || named.includes(U(r.ij)) || narr.includes(U(r.ij))) change.push(r); else skip.push(r);
    }
    say('Sales bills from iCAFFE whose voucher job no. is not the bill\'s docket: ' + rows.length);
    say('  set to the bill\'s docket: ' + change.length);
    say('  left as they are (the narration names yet another docket - check by hand): ' + skip.length);
    const csv = ['Voucher No,Date,Job no. before,Job no. now (bill docket),Changed'];
    for (const r of change) csv.push([r.voucherNumber, r.date, r.vj || '', r.ij, 'yes'].join(','));
    for (const r of skip) csv.push([r.voucherNumber, r.date, r.vj || '', r.ij, 'no - check'].join(','));
    fs.mkdirSync(path.dirname(CSV), { recursive: true }); fs.writeFileSync(CSV, csv.join('\r\n'));
    say('List: ' + CSV);
    say('Examples: ' + change.slice(0, 5).map(r => `${r.voucherNumber} ${r.vj || '(none)'} -> ${r.ij}`).join('; '));

    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    let n = 0;
    for (const r of change) { const x = await run('UPDATE Vouchers SET jobNo = ? WHERE id = ?', [r.ij, r.id]); n += x.changes; }
    say('Vouchers updated: ' + n);
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done.'); }
  } catch (e) {
    say('ERROR: ' + e.message); try { await run('ROLLBACK'); } catch (x) { /* none open */ }
    process.exitCode = 1;
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
