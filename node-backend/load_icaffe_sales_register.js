// iCAFFE Sales Register (GST invoices, debit notes, credit notes) into EagleView's GST invoice register (08-Nov-2026).
// Source: _tariff_load\icaffe_sales_register_YYYYMMDD.json - iCAFFE's "Sales Register" (GST print: charge lines + IRN), read
//   half-month by half-month from 01-Apr-2022: {"parts":{"I|SHP|2024-09-01":{"H":[...],"rows":[[...]]}}}  I = invoice,
//   D = debit note, C = credit note. One row per charge line; the bill's totals repeat on every line.
// What it does: each iCAFFE bill becomes one row of AccSalesInvoices (the GST Invoice desk's register), tied to the sales /
//   credit note voucher already loaded from iCAFFE (Vouchers.icaffeRef = bill no | dd/mm/yyyy) - NO voucher is made or changed.
//   Kept from iCAFFE: kind (from iCAFFE's voucher type), bill no / date, branch, division, party and its ledger, GSTIN, job,
//   MAWB / MBL and HAWB / HBL, currency, charge lines (charge, amount), IGST / CGST / SGST totals, bill total, IRN.
//   iCAFFE's GST print leaves out some lines of some bills (about 5% - mostly charges without GST). Where the charge lines +
//   GST fall short of the bill total, one line "OTHER CHARGES (AS PER ICAFFE VOUCHER)" carries the difference, so every bill
//   adds up to its voucher; these bills are counted in the log.
//   A bill already in AccSalesInvoices (same invoice no) is left as it is - bills made in EagleView are never touched.
//   Bills with no matching voucher (e.g. made after the last voucher read) are listed in the log.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const SRC = process.env.EDI_SRC || (fs.existsSync(TL) ? fs.readdirSync(TL).filter(f => /^icaffe_sales_register_\d+.*\.json$/.test(f)).sort().map(f => path.join(TL, f)).pop() : null);
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_sales_register_' + stamp + '.sqlite');
const LOG = path.join(SRC ? path.dirname(SRC) : TL, 'icaffe_sales_register_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round(n * 100) / 100;
const t = (v, n = 300) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s ? s.slice(0, n) : null; };
const ymd = (d) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(d || '').trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
const KIND = { SERVICE: 'service', OTHER: 'other', REIMBURSABLE: 'reimbursable', COURIER: 'courier', CONSULTANCY: 'consultancy', TIEUP: 'overseas', CAN: 'can', 'CREDIT NOTE': 'creditnote', 'CREDIT NOTE (TDS)': 'creditnote', 'DEBIT NOTE': 'debitnote' };
const DIV = { 'EXPORT AIR': 'AE', 'IMPORT AIR': 'AI', 'EXPORT SEA': 'SE', 'IMPORT SEA': 'SI' };
const COLS = ['kind', 'invoiceNo', 'date', 'branchCode', 'voucherId', 'status', 'partyType', 'partyName', 'ledgerId', 'gstin', 'stateCode', 'currency', 'exRate',
  'jobNo', 'hawbNo', 'mawbNo', 'remarks', 'linesJson', 'chargeTotal', 'grossInr', 'igst', 'cgst', 'sgst', 'roundOffAmt', 'total', 'totalFcy', 'createdBy',
  'irn', 'irnStatus', 'division', 'createdAt', 'updatedAt'];

(async () => {
  try {
    if (!SRC) throw new Error('No _tariff_load\\icaffe_sales_register_*.json file');
    say('Reading ' + SRC + ' ...');
    const parts = JSON.parse(fs.readFileSync(SRC, 'utf8')).parts || {};
    // bills from the file (first time a bill no is seen wins; a bill sits in one half-month)
    const bills = new Map();
    for (const key of Object.keys(parts).sort()) {
      const doc = key[0]; const { H, rows } = parts[key] || {}; if (!H || !H.length || !rows || !rows.length) continue;
      const ix = (n) => H.indexOf(n);
      const I = { no: ix('BILLNO'), date: ix('textbox2'), job: ix('textbox3'), br: ix('MAOBRANCH'), dv: ix('DIVISIONNAME'), mawb: ix('Textbox19'), hawb: ix('Textbox20'),
        party: ix('textbox4'), gstin: ix('PARTY_GSTIN'), cur: ix('INVCURRENCY'), total: ix('textbox5'), charge: ix('CHARGEID'), amt: ix('INCAMOUNT'),
        cgst: ix('INVTOTALCGST'), sgst: ix('INVTOTALSGST'), igst: ix('INVTOTALIGST'), irn: ix('IRN_NO') };
      const g = (r, k) => (I[k] >= 0 ? r[I[k]] : '');
      for (const r of rows) {
        const no = t(g(r, 'no'), 60); if (!no) continue;
        let b = bills.get(no);
        if (!b) {
          b = { doc, no, date: g(r, 'date'), job: t(g(r, 'job'), 60), br: t(g(r, 'br')), dv: t(g(r, 'dv')), mawb: t(g(r, 'mawb'), 60), hawb: t(g(r, 'hawb'), 60), party: t(g(r, 'party')),
            gstin: t(g(r, 'gstin'), 20), cur: t(g(r, 'cur'), 5) || 'INR', total: num(g(r, 'total')), cgst: num(g(r, 'cgst')), sgst: num(g(r, 'sgst')), igst: num(g(r, 'igst')),
            irn: t(g(r, 'irn'), 70), lines: [] };
          bills.set(no, b);
        } else if (b.date !== g(r, 'date')) continue; // same number on another date - keep the first
        const ch = t(g(r, 'charge'), 120); if (ch) b.lines.push({ charge: ch.toUpperCase(), amount: num(g(r, 'amt')) });
      }
    }
    say('Bills in the file: ' + bills.size + ' (' + ['I', 'D', 'C'].map(d => d + ' ' + [...bills.values()].filter(b => b.doc === d).length).join(', ') + ')');
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    const tbl = (await all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'AccSalesInvoices'")).length;
    if (!tbl) throw new Error('AccSalesInvoices table not found - open the GST Invoice desk once (the backend makes the table), then run this again');
    const have = new Set((await all('PRAGMA table_info(AccSalesInvoices)')).map(c => c.name));
    const miss = COLS.filter(c => !have.has(c)); if (miss.length) throw new Error('AccSalesInvoices is missing columns ' + miss.join(', ') + ' - start the backend once so it adds them');
    const exist = new Set((await all('SELECT invoiceNo FROM AccSalesInvoices')).map(r => String(r.invoiceNo || '').toUpperCase()));
    // iCAFFE sales / credit / debit note vouchers by icaffeRef, with the party line
    const vouchers = new Map();
    for (const v of await all(`SELECT v.id, v.icaffeRef, v.icaffeType, v.branchCode, v.division, v.totalAmount, v.jobNo FROM Vouchers v JOIN VoucherTypes y ON y.id = v.voucherTypeId
        WHERE v.icaffeRef IS NOT NULL AND y.baseType IN ('Sales', 'Credit Note', 'Debit Note')`)) vouchers.set(v.icaffeRef, v);
    say('iCAFFE sales / credit / debit note vouchers in EagleView: ' + vouchers.size);
    const S = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize (SQLite) reads; 'T...Z' came back as null (job created time, timeline)
    const ins = db.prepare('INSERT INTO AccSalesInvoices (' + COLS.join(', ') + ') VALUES (' + COLS.map(() => '?').join(', ') + ')');
    let pErr = null; const put = (a) => ins.run(a, (e) => { if (e && !pErr) pErr = e; });
    let added = 0, already = 0, noVoucher = 0, topped = 0, withIrn = 0; const noVList = []; const byKind = {};
    for (const b of bills.values()) {
      if (exist.has(b.no.toUpperCase())) { already++; continue; }
      const date = ymd(b.date); const v = vouchers.get(b.no + '|' + b.date);
      if (!date || !v) { noVoucher++; if (noVList.length < 60) noVList.push(b.no + ' ' + b.date + ' ' + (b.party || '')); continue; }
      const kind = KIND[String(v.icaffeType || '').toUpperCase().trim()] || (b.doc === 'C' ? 'creditnote' : b.doc === 'D' ? 'debitnote' : 'other');
      // party ledger = the largest Dr line of an invoice / Cr line of a credit note
      const pl = (await all("SELECT ledgerId FROM VoucherDetails WHERE voucherId = ? AND dc = ? ORDER BY amount DESC LIMIT 1", [v.id, kind === 'creditnote' ? 'Cr' : 'Dr']))[0];
      const inrTotal = r2(num(v.totalAmount));
      const fc = b.cur && b.cur !== 'INR';
      const exRate = fc && b.total ? r2(inrTotal / b.total * 10000) / 10000 : 1;
      const gst = r2(b.igst + b.cgst + b.sgst);
      const lines = b.lines.filter(l => l.amount).map((l, i) => {
        const inr = r2(l.amount * (fc ? exRate : 1));
        return { sr: i + 1, jobNo: b.job || '', charge: l.charge, sac: '', unit: '', qty: 1, rate: l.amount, amount: l.amount, discount: 0, gstRate: 0, igstPct: 0, cgstPct: 0, sgstPct: 0,
          igst: 0, cgst: 0, sgst: 0, currency: b.cur, exRate: fc ? exRate : 1, inrAmount: inr, receiptNo: '', receiptDate: '', costCentre: '', narration: '' };
      });
      let gross = r2(lines.reduce((s, l) => s + l.inrAmount, 0));
      const short = r2(inrTotal - gst - gross);
      if (kind !== 'creditnote' && short > 1) { // iCAFFE's GST print left out some lines of this bill
        lines.push({ sr: lines.length + 1, jobNo: b.job || '', charge: 'OTHER CHARGES (AS PER ICAFFE VOUCHER)', sac: '', unit: '', qty: 1, rate: short, amount: short, discount: 0, gstRate: 0, igstPct: 0, cgstPct: 0, sgstPct: 0,
          igst: 0, cgst: 0, sgst: 0, currency: 'INR', exRate: 1, inrAmount: short, receiptNo: '', receiptDate: '', costCentre: '', narration: 'not in iCAFFE GST print' });
        gross = r2(gross + short); topped++;
      }
      const round = r2(inrTotal - gross - gst);
      const irn = b.irn && /^[0-9a-f]{64}$/i.test(b.irn) ? b.irn.toLowerCase() : null; if (irn) withIrn++;
      put([kind, b.no, date, v.branchCode || null, v.id, 'Approved', 'Shipper', b.party, pl ? pl.ledgerId : null, b.gstin, b.gstin && /^\d{2}/.test(b.gstin) ? b.gstin.slice(0, 2) : null,
        b.cur, fc ? exRate : 1, b.job || v.jobNo || null, b.hawb, b.mawb, 'Loaded from iCAFFE Sales Register', JSON.stringify(lines), r2(lines.reduce((s, l) => s + l.amount, 0)), gross,
        r2(b.igst), r2(b.cgst), r2(b.sgst), Math.abs(round) < 1 ? round : 0, inrTotal, fc ? r2(b.total) : null, 'iCAFFE', irn, irn ? 'Generated' : null,
        v.division || DIV[String(b.dv || '').toUpperCase()] || null, S, S]);
      exist.add(b.no.toUpperCase()); added++; byKind[kind] = (byKind[kind] || 0) + 1;
    }
    await all('SELECT 1'); if (pErr) throw pErr; await new Promise(ok => ins.finalize(ok));
    say('Bills added to the GST invoice register: ' + added + ' (' + Object.entries(byKind).map(([k, n]) => k + ' ' + n).join(', ') + '); with IRN: ' + withIrn);
    say('Already in EagleView (left as they are): ' + already);
    say('Bills where iCAFFE\'s GST print had fewer lines than the bill - one line "OTHER CHARGES (AS PER ICAFFE VOUCHER)" added: ' + topped);
    say('No matching iCAFFE voucher in EagleView (load the newer vouchers first): ' + noVoucher + (noVList.length ? '\n  ' + noVList.join('\n  ') : ''));
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* ignore */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
