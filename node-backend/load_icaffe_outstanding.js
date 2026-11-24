// iCAFFE bill-wise outstanding into EagleView (06-Nov-2026).
// Source: _tariff_load\icaffe_outstanding_YYYYMMDD.json - iCAFFE's "Outstanding Bills" report (with on account), read party
//   by party for every debtor / creditor with a balance: {"asOn":"2026-11-06","parties":{"R|ACC/7414":[rows],"P|ACC/8270":[rows]}}
//   R = receivable (Sundry Debtors), P = payable (Sundry Creditors). Rows are the report's CSV rows from the bill header on.
// What it does: for each party it keeps iCAFFE's open bills (bill no, date, bill amount, paid, balance) and its on-account
//   entries in AccOutstandingSnapshot. The Outstanding, Ageing, Credit Control screens and the due bills on Receipt /
//   Payment then show exactly iCAFFE's open bills as at that date; what happens after it is worked out on top.
//   A party read again replaces its earlier rows. Nothing else is changed.
//   07-Nov-2026: only parties whose iCAFFE open bills + on-account add up to the EagleView ledger balance on that date (to
//   Re 1) are loaded. iCAFFE's report does not add up for about half the parties (receipts not knocked off against bills,
//   on-account shown again, old opening bills still open) - those are NOT loaded (their earlier snapshot rows are removed)
//   and stay on FIFO; they are written to icaffe_outstanding_not_loaded_<stamp>.csv for the accounts team.
// One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const SRC = process.env.EDI_SRC || (fs.readdirSync(TL).filter(f => /^icaffe_outstanding_\d+.*\.json$/.test(f)).sort().map(f => path.join(TL, f)).pop());
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_outstanding_' + stamp + '.sqlite');
const LOG = path.join(path.dirname(SRC || TL + '/x'), 'icaffe_outstanding_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };
const num = (v) => { const m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };
const ymd = (d) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(d || '').trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
const r2 = (n) => Math.round(n * 100) / 100;

// the report's rows -> bills and on-account entries (column names from its own header rows)
// 09-Nov-2026: the on-account amount of a receipt is RECEIPTONACCOUNT1 (what is left of it after the bills it was set
//   against), not the receipt's full amount (AMOUNTDR / AMOUNTCR) - reading the full amount made the report look as if it
//   did not add up for ~200 debtors, which then stayed on FIFO. Creditors in iCAFFE's payable layout (bills with
//   textbox10..textbox20 and a "RECEIPTID2" list of every payment) carry the payments not set against any bill as one
//   party total (textbox31); that total is the on-account amount, the payment list itself is not used.
function parse(rows) {
  const bills = [], onacc = []; let H = null, mode = null; let payTotal = null;
  for (const r of rows) {
    if (r.includes('BILLNUMBER')) { H = r; mode = 'BILL'; continue; }
    if (r[0] === 'RECEIPTID' || r[0] === 'RECEIPTID2') { H = r; mode = r[0] === 'RECEIPTID2' ? 'PAYLIST' : 'ONACC'; continue; }
    if (!H || !r[0] && mode === 'BILL') continue;
    const c = (name) => { const i = H.indexOf(name); return i >= 0 ? r[i] : ''; };
    if (mode === 'BILL') {
      const d = ymd(c('BILLDATE')); if (!d) continue;
      bills.push({ billDate: d, billNo: String(c('BILLNUMBER') || '').trim(), voucherNo: String(c('RECEIPTID') || '').trim(), docket: String(c('textbox27') || '').trim(),
        amount: num(c('DUEAMOUNT')), paid: num(c('PAIDAMOUNT')), balance: num(c('BALANCE')) });
      // payable layout: the party's payments not set against a bill, e.g. "(Dr) 194762.00"
      if (H.includes('textbox31') && H.includes('textbox62')) { const t = String(c('textbox31') || ''); if (/\((Dr|Cr)\)/.test(t)) payTotal = { dr: /\(Dr\)/.test(t) ? num(t) : 0, cr: /\(Cr\)/.test(t) ? num(t) : 0 }; }
    } else if (mode === 'ONACC') {
      if (r.length < H.length - 2) continue; // blank / summary lines
      const vno = String(r[0] || '').trim(); const d = ymd(r[1]);
      let amt;
      if (H.includes('RECEIPTONACCOUNT1')) {
        const t = String(c('RECEIPTONACCOUNT1') || ''); const v = num(t); if (!v) continue;
        amt = /\(Dr\)/.test(t) ? { dr: v, cr: 0 } : { dr: 0, cr: v };
      } else if (H.includes('AMOUNTDR')) amt = { dr: num(c('AMOUNTDR')), cr: num(c('AMOUNTCR')) };
      else amt = { net: num(c('AMOUNTNET')) };
      if (!vno && !d && amt.net !== undefined && !amt.net) continue;
      if ((amt.dr !== undefined && !amt.dr && !amt.cr) || (amt.net !== undefined && !amt.net)) continue;
      onacc.push({ voucherNo: vno || null, billDate: d || null, ...amt });
    }
    // PAYLIST: every payment to the creditor, set off or not - the party total above is used instead
  }
  if (payTotal && (payTotal.dr || payTotal.cr)) onacc.push({ voucherNo: null, billDate: null, ...payTotal, payTotal: true });
  return { bills, onacc };
}

(async () => {
  try {
    if (!SRC) throw new Error('No _tariff_load\\icaffe_outstanding_*.json file');
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    const asOn = String(src.asOn || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(asOn)) throw new Error('asOn missing');
    const keys = Object.keys(src.parties || {});
    say('Source: ' + SRC + ' - ' + keys.length + ' parties, as on ' + asOn);
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    await run(`CREATE TABLE IF NOT EXISTS AccOutstandingSnapshot (id INTEGER PRIMARY KEY AUTOINCREMENT, ledgerId INTEGER NOT NULL, side TEXT NOT NULL, asOn TEXT NOT NULL,
      kind TEXT NOT NULL, billNo TEXT, billDate TEXT, voucherNo TEXT, voucherId INTEGER, docket TEXT, amount REAL, paid REAL, balance REAL, narration TEXT, source TEXT, createdAt DATETIME)`);
    await run('CREATE INDEX IF NOT EXISTS idx_AccOutstandingSnapshot_ledger ON AccOutstandingSnapshot (ledgerId, side)');
    const S = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize (SQLite) reads; 'T...Z' came back as null (job created time, timeline)
    let parties = 0, billsN = 0, onaccN = 0, notFound = 0, mism = 0; const mismList = [], nf = [], notLoaded = [];
    let totR = 0, totP = 0;
    for (const k of keys) {
      const [side, accId] = k.split('|');
      const led = (await all('SELECT id, name, openingBalance, balanceType FROM AccountLedgers WHERE icaffeId = ?', [accId]))[0];
      if (!led) { notFound++; nf.push(k); continue; }
      const { bills, onacc } = parse(src.parties[k] || []);
      // this party's lines (for voucher ids and the sign of on-account entries)
      const lines = await all('SELECT v.id, v.voucherNumber, v.date, d.dc, d.amount FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE d.ledgerId = ?', [led.id]);
      const byNo = new Map(); for (const l of lines) { const n = String(l.voucherNumber || '').toUpperCase(); if (!byNo.has(n)) byNo.set(n, []); byNo.get(n).push(l); }
      const owe = (dc) => (side === 'R' ? (dc === 'Dr' ? 1 : -1) : (dc === 'Cr' ? 1 : -1)); // + = the party owes / we owe it
      const rowsOut = [];
      for (const b of bills) {
        const hit = (byNo.get(String(b.voucherNo || b.billNo).toUpperCase()) || byNo.get(String(b.billNo).toUpperCase()) || [])[0];
        rowsOut.push(['BILL', b.billNo, b.billDate, b.voucherNo || (hit ? hit.voucherNumber : null), hit ? hit.id : null, b.docket || null, b.amount, b.paid, b.balance]);
      }
      for (const o of onacc) {
        const hits = o.voucherNo ? (byNo.get(o.voucherNo.toUpperCase()) || []) : [];
        let bal;
        if (o.dr !== undefined) bal = side === 'R' ? o.dr - o.cr : o.cr - o.dr;
        else { const sgn = hits.length ? owe(hits[0].dc) : -1; bal = sgn * Math.abs(o.net); }
        if (Math.abs(bal) < 0.005) continue;
        rowsOut.push(['ONACC', null, o.billDate || (hits.length ? hits[0].date : asOn), o.voucherNo, hits.length ? hits[0].id : null, null, Math.abs(bal), 0, r2(bal)]);
      }
      // check against the ledger balance in EagleView on the same date
      const mv = (await all("SELECT sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) m FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE d.ledgerId = ? AND v.date <= ?", [led.id, asOn]))[0].m || 0;
      const drBal = (led.balanceType === 'Cr' ? -1 : 1) * (parseFloat(led.openingBalance) || 0) + mv;
      const ledOwe = side === 'R' ? drBal : -drBal;
      const snapOwe = rowsOut.reduce((a, r) => a + (r[0] === 'ONACC' ? r[8] : r[8]), 0);
      await run('DELETE FROM AccOutstandingSnapshot WHERE ledgerId = ? AND side = ?', [led.id, side]);
      if (Math.abs(ledOwe - snapOwe) > 1) {
        mism++; if (mismList.length < 30) mismList.push(led.name + ' (' + accId + ', ' + side + '): ledger ' + r2(ledOwe) + ', iCAFFE bills ' + r2(snapOwe));
        notLoaded.push([accId, side === 'R' ? 'Receivable' : 'Payable', led.name, r2(ledOwe), r2(snapOwe), r2(ledOwe - snapOwe), bills.length, rowsOut.filter(x => x[0] === 'ONACC').length]);
        continue; // stays on FIFO
      }
      for (const r of rowsOut) await run('INSERT INTO AccOutstandingSnapshot (ledgerId, side, asOn, kind, billNo, billDate, voucherNo, voucherId, docket, amount, paid, balance, source, createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [led.id, side, asOn, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], 'iCAFFE ' + asOn, S]);
      parties++; billsN += rowsOut.filter(r => r[0] === 'BILL').length; onaccN += rowsOut.filter(r => r[0] === 'ONACC').length;
      if (side === 'R') totR += snapOwe; else totP += snapOwe;
    }
    say('Parties loaded: ' + parties + ' (open bills ' + billsN + ', on-account entries ' + onaccN + '); not found in EagleView: ' + notFound + (nf.length ? ' (' + nf.slice(0, 20).join(', ') + ')' : ''));
    say('Receivable as per iCAFFE: ' + r2(totR).toFixed(2) + '   Payable: ' + r2(totP).toFixed(2));
    say('Parties NOT loaded (iCAFFE bills do not add up to the ledger balance - they stay on FIFO): ' + mism + (mismList.length ? '\n  first ones:\n  ' + mismList.join('\n  ') : ''));
    const CSV = path.join(path.dirname(LOG), 'icaffe_outstanding_not_loaded_' + stamp + '.csv');
    const cq = (v) => (/[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
    fs.writeFileSync(CSV, ['iCAFFE A/c,Side,Party,Ledger balance (EagleView = iCAFFE TB),iCAFFE open bills + on account,Difference,Open bills,On-account entries', ...notLoaded.map(r => r.map(cq).join(','))].join('\n'));
    say('List of the parties not loaded: ' + CSV);
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* ignore */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
