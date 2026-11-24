// 05-Nov-2026: GST Invoice (iCAFFE Operation > GST Invoice) inside Accounts.
// Nine kinds, as on iCAFFE: Service, Reimbursable, Other, Debit Note, Courier, Credit Note, Consultancy, CAN, OverSeas Agent.
// Every saved invoice is a voucher in the books at once (Sales; Credit Note for credit notes), numbered with the
// invoice no, so the Sales Register, List of Invoices, Outstanding, Ageing and the ledgers show it straight away.
//   Dr party (debtor ledger - made from the Party master on first use)   Cr one income ledger per charge   Cr Output IGST / CGST / SGST   +/- Round Off
//   Reimbursable: no GST; the charges go back to the cost ledger (expense ledger of the charge, else "Reimbursement of Expenses")
//   Credit Note: the same lines reversed, against the earlier invoice
// Mounted by routes/accountsHub.js at /api/accounts-hub/gst-invoice
const express = require('express');
const router = express.Router();
// /:id is a number only - anything else goes on to the named routes (Express 5 has no '(\\d+)' in paths)
router.param('id', (req, res, next, id) => (/^\d+$/.test(String(id)) ? next() : next('route')));
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');
const bs = require('../utils/branchScope'); // 09-Nov-2026: top-bar branch for the invoice search
// 09-Nov-2026: bills loaded from iCAFFE carry the loader's note as remarks - shown blank (iCAFFE's own remark, when read, replaces it)
const realRemark = (t) => (/^Loaded from iCAFFE/i.test(String(t || '').trim()) ? '' : t || '');

const q = (sql, p = [], t) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, transaction: t });
const x = (sql, p = [], t) => sequelize.query(sql, { replacements: p, transaction: t });
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const r2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const bad = (m) => Object.assign(new Error(m), { status: 400 });
// 08-Nov-2026: bills loaded from iCAFFE's Sales Register (createdBy 'iCAFFE') are view only - their voucher came from iCAFFE
const fromIcaffe = (r) => !!r && r.createdBy === 'iCAFFE';
const userOf = (req) => (req.user && (req.user.fullName || req.user.name || req.user.username)) || req.headers['x-user-name'] || '';

const KINDS = {
  service: { label: 'Service', prefix: 'SI', base: 'Sales', gst: true },
  reimbursable: { label: 'Reimbursable', prefix: 'RI', base: 'Sales', gst: false },
  other: { label: 'Other', prefix: 'OI', base: 'Sales', gst: true },
  debitnote: { label: 'Debit Note', prefix: 'DN', base: 'Sales', gst: true, againstBill: true },
  courier: { label: 'Courier', prefix: 'CR', base: 'Sales', gst: true },
  creditnote: { label: 'Credit Note', prefix: 'CN', base: 'Credit Note', gst: true, againstBill: true },
  consultancy: { label: 'Consultancy', prefix: 'CO', base: 'Sales', gst: true },
  can: { label: 'CAN', prefix: 'CA', base: 'Sales', gst: true },
  overseas: { label: 'OverSeas Agent', prefix: 'OA', base: 'Sales', gst: true, overseas: true },
};
const REASONS = ['Sales Return', 'Post Sale Discount', 'Deficiency in Service', 'Correction In Invoice', 'Change In POS', 'Finalization of Provisional assessment', 'Others'];

const COLS = `kind TEXT, invoiceNo TEXT UNIQUE, date TEXT, branchCode TEXT, voucherId INTEGER, status TEXT, partyType TEXT, partyName TEXT, partyId INTEGER,
  partyBranchId INTEGER, ledgerId INTEGER, address TEXT, gstin TEXT, stateName TEXT, stateCode TEXT, pos TEXT, posName TEXT, sez TEXT, paymentOption TEXT,
  countryCode TEXT, currency TEXT, exRate REAL, costCentre TEXT, roundOff INTEGER, gstExempt INTEGER, hideExRate INTEGER, rcm INTEGER, withOut INTEGER,
  prevInvoiceId INTEGER, prevInvoiceNo TEXT, prevInvoiceDate TEXT, reason TEXT, docketBy TEXT, jobNo TEXT, hawbNo TEXT, mawbNo TEXT, quotationNo TEXT,
  email TEXT, advance REAL, remarks TEXT, linesJson TEXT, chargeTotal REAL, grossInr REAL, igst REAL, cgst REAL, sgst REAL, roundOffAmt REAL, total REAL,
  totalFcy REAL, voidReason TEXT, createdBy TEXT, modifiedBy TEXT, bulk INTEGER, dockets TEXT, irn TEXT, ackNo TEXT, ackDate TEXT, signedQr TEXT, irnStatus TEXT,
  irnCancelReason TEXT, mailLog TEXT, division TEXT`;
// columns added after the first release are added to an existing table on first use
const colList = (sql) => sql.split(',').map(c => c.trim().split(/\s+/)).filter(a => a[0]).map(a => [a[0], a.slice(1).join(' ').replace(/UNIQUE/i, '').trim()]);
let ready = null;
const PROV_COLS = 'jobNo TEXT UNIQUE, partyName TEXT, linesJson TEXT, remarks TEXT, createdBy TEXT, modifiedBy TEXT';
const ensure = () => (ready = ready || (async () => {
  await x(`CREATE TABLE IF NOT EXISTS AccSalesInvoices (id INTEGER PRIMARY KEY AUTOINCREMENT, ${COLS}, createdAt DATETIME, updatedAt DATETIME)`);
  const have = new Set((await q('PRAGMA table_info(AccSalesInvoices)')).map(c => c.name));
  for (const [c, ty] of colList(COLS)) if (!have.has(c)) await x(`ALTER TABLE AccSalesInvoices ADD COLUMN ${c} ${ty}`);
  await x('CREATE INDEX IF NOT EXISTS idx_accsalesinv_voucher ON AccSalesInvoices (voucherId)');
  await x(`CREATE TABLE IF NOT EXISTS AccProvisionalSheets (id INTEGER PRIMARY KEY AUTOINCREMENT, ${PROV_COLS}, createdAt DATETIME, updatedAt DATETIME)`);
  await x('CREATE TABLE IF NOT EXISTS AccSalesInvoiceDeleted (id INTEGER PRIMARY KEY AUTOINCREMENT, invoiceId INTEGER, invoiceNo TEXT, dataJson TEXT, voucherJson TEXT, deletedBy TEXT, createdAt DATETIME, updatedAt DATETIME)');
  await x('CREATE INDEX IF NOT EXISTS idx_accsalesinv_job ON AccSalesInvoices (jobNo)');
  await x('CREATE INDEX IF NOT EXISTS idx_accsalesinv_kind_date ON AccSalesInvoices (kind, date)');
  await x('CREATE INDEX IF NOT EXISTS idx_accsalesinv_prev ON AccSalesInvoices (prevInvoiceId)');
  // iCAFFE: a party is billed only through its account (ledger) - the party master id is kept on the ledger it belongs to
  const lc = new Set((await q('PRAGMA table_info(AccountLedgers)')).map(c => c.name));
  if (!lc.has('partyId')) await x('ALTER TABLE AccountLedgers ADD COLUMN partyId INTEGER');
  if (!lc.has('isActive')) await x('ALTER TABLE AccountLedgers ADD COLUMN isActive TINYINT(1)'); // same column the Ledger Account screen adds
})().catch(e => { ready = null; throw e; }));

// ------------------------------------------------------------------ our GSTIN / state (decides CGST + SGST or IGST)
async function ourGst() {
  const c = (await q('SELECT companyName, legalName, gstin, state FROM CompanyProfile ORDER BY id LIMIT 1').catch(() => []))[0] || {};
  let gstin = c.gstin || '';
  if (!gstin) {
    const name = c.legalName || c.companyName || 'COMMITTED CARGO CARE LIMITED';
    const b = (await q(`SELECT b.gstin FROM PartyBranches b JOIN Parties p ON p.id = b.partyId WHERE upper(trim(p.name)) = upper(trim(?)) AND coalesce(b.gstin, '') <> '' ORDER BY b.isDefault DESC, b.id LIMIT 1`, [name]).catch(() => []))[0];
    gstin = (b && b.gstin) || '';
  }
  const ab = gstin ? (await q('SELECT address1, address2, city, pinCode, phone, email1 FROM PartyBranches WHERE upper(gstin) = upper(?) ORDER BY isDefault DESC, id LIMIT 1', [gstin]).catch(() => []))[0] : null;
  const cp = (await q('SELECT companyName, legalName, address1, address2, city, pincode, phone, email FROM CompanyProfile ORDER BY id LIMIT 1').catch(() => []))[0] || {};
  // our own office address: Company Profile, else the default company branch (Settings), else the party master row with our GSTIN
  const cb = cp.address1 ? null : (await q("SELECT address FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, id LIMIT 1").catch(() => []))[0];
  if (cb && cb.address) { const pinM = String(cb.address).match(/\b(\d{6})\b/); cp.address1 = String(cb.address).slice(0, 100); cp.address2 = ''; cp.pincode = pinM ? pinM[1] : ''; cp.city = cp.city || (/delhi/i.test(cb.address) ? 'NEW DELHI' : ''); }
  const code = /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '07';
  const st = (await q(`SELECT stateName FROM States WHERE countryId = 1 AND taxCode = ? LIMIT 1`, [code]).catch(() => []))[0];
  return { gstin, code, name: st ? st.stateName : code === '07' ? 'DELHI' : '', legalName: cp.legalName || cp.companyName || c.legalName || c.companyName || 'COMMITTED CARGO CARE LIMITED',
    addr1: cp.address1 || (ab && ab.address1) || '', addr2: cp.address1 ? cp.address2 || '' : (ab && ab.address2) || '', city: cp.city || (ab && ab.city) || '', pin: cp.pincode || (ab && ab.pinCode) || '',
    phone: cp.phone || (ab && ab.phone) || '', email: cp.email || (ab && ab.email1) || '' };
}
async function indianStates() {
  return (await q(`SELECT stateName name, taxCode code FROM States WHERE countryId = 1 AND coalesce(taxCode, '') <> '' ORDER BY stateName`).catch(() => []))
    .filter((s, i, a) => a.findIndex(o => o.code === s.code) === i);
}

// ------------------------------------------------------------------ numbering: SI/DEL/2627/0001 - one series per kind, branch and year
// (16 characters at most - the e-invoice portal does not take a longer document no)
const fyCode = (d) => { const y = Number(String(d).slice(0, 4)), m = Number(String(d).slice(5, 7)); const s = m < 4 ? y - 1 : y; return String(s).slice(2) + String(s + 1).slice(2); };
// 05-Nov-2026: iCAFFE numbering - the invoice no comes from Settings > Number Series (iCAFFE), per branch + division + year,
// e.g. Service DL/26/EX/0000027, Other DL/26/ET/0003148. The old SI/DEL/2627/0001 numbering stays only for a branch with no series.
const ns = require('../utils/numberSeries');
const divOfInvoice = (b) => ns.divOf(b.division) || ns.divOf(b.jobNo) || ns.divOf((Array.isArray(b.dockets) ? b.dockets : (() => { try { return JSON.parse(b.dockets || '[]'); } catch (e) { return []; } })())[0]) || ns.divOf((b.lines || []).map(l => l.jobNo).find(Boolean));
async function invoiceNoFor(kind, branch, date, t, division, takeIt) {
  await ns.ensure();
  const br = String(branch || await ns.defaultBranch(t)).toUpperCase(); const doc = 'INV_' + kind;
  const any = await q('SELECT division FROM NumberSeries WHERE docType = ? AND branchCode = ? AND coalesce(isActive, 1) = 1', [doc, br], t);
  if (any.length) {
    if (!division) throw bad('Choose the Division (AE / AI / SE / SI) - the invoice no comes from that division\'s series, as in iCAFFE');
    if (!any.some(r => r.division === division || r.division === '')) throw bad('Number series not set for ' + doc.replace('INV_', '') + ' invoice, branch ' + br + ', division ' + division + ' - set it in Settings > Number Series (iCAFFE)');
    return takeIt ? ns.take(doc, { branchCode: br, division, date }, t) : ns.peek(doc, { branchCode: br, division, date }, t);
  }
  return nextInvoiceNo(kind, br, date, t);
}
async function nextInvoiceNo(kind, branch, date, t) {
  const head = `${KINDS[kind].prefix}/${String(branch || 'HO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3)}/${fyCode(date)}/`;
  const rows = await q('SELECT invoiceNo FROM AccSalesInvoices WHERE invoiceNo LIKE ?', [head + '%'], t);
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.invoiceNo).slice(head.length)) || 0), 0);
  return head + String(max + 1).padStart(4, '0');
}

// ------------------------------------------------------------------ ledgers
async function groupId(names, nature, t) {
  for (const n of names) { const g = (await q('SELECT id FROM AccountGroups WHERE lower(trim(name)) = ? ORDER BY id LIMIT 1', [n], t))[0]; if (g) return g.id; }
  const g = nature && (await q('SELECT id FROM AccountGroups WHERE nature = ? ORDER BY parentId IS NOT NULL, id LIMIT 1', [nature], t))[0];
  if (!g) throw bad('Account group "' + names[0] + '" not found');
  return g.id;
}
async function makeLedger(t, name, gid, extra = {}) {
  const s = new Date().toISOString();
  await x('INSERT INTO AccountLedgers (name, groupId, openingBalance, balanceType, gstin, state, address, createdAt, updatedAt) VALUES (?,?,0,?,?,?,?,?,?)',
    [name, gid, extra.balanceType || 'Dr', extra.gstin || null, extra.state || null, extra.address || null, s, s], t);
  return (await q('SELECT id FROM AccountLedgers WHERE name = ? ORDER BY id DESC LIMIT 1', [name], t))[0].id;
}
async function ledgerNamed(t, name, groups, nature) {
  const r = (await q('SELECT id FROM AccountLedgers WHERE lower(trim(name)) = lower(trim(?)) ORDER BY id LIMIT 1', [name], t))[0];
  return r ? r.id : makeLedger(t, name, await groupId(groups, nature, t));
}
// 05-Nov-2026 (iCAFFE rule): the invoice is made only on the party's account (ledger) - nothing is created here.
// Found by: the ledger picked, the ledger tied to the party master id, the GSTIN, or the exact name; else "Party Account not created !"
// 06-Nov-2026: the party's account only when exactly one fits (picked ledger, then the party link, then GSTIN + name,
// then the name ignoring spaces / dots). Look-alike accounts are never guessed - utils/ledgerGuard says which ones to choose from.
const lg = require('../utils/ledgerGuard');
async function findPartyLedger(t, b) {
  const pid = Number(b.partyId) || null;
  const id = await lg.findOne({ ledgerId: b.ledgerId, partyId: pid, gstin: b.gstin, name: String(b.partyName || '').trim() }, t);
  if (id && pid && !b.ledgerId) await x('UPDATE AccountLedgers SET partyId = ? WHERE id = ? AND partyId IS NULL', [pid, id], t).catch(() => null);
  return id;
}
async function partyLedger(t, b) {
  if (!String(b.partyName || '').trim() && !b.ledgerId) throw bad('Please Select Party');
  const id = await findPartyLedger(t, b);
  if (!id) throw bad('Party Account not created ! Make the ledger of "' + String(b.partyName || '').trim() + '" in Accounts > Masters > Ledger Account (under Sundry Debtors / Creditors), then pick the party again.');
  return id;
}
async function chargeRow(t, name) {
  return (await q('SELECT * FROM AccGstCharges WHERE lower(trim(chargeName)) = lower(trim(?)) ORDER BY id LIMIT 1', [name], t).catch(() => []))[0] || null;
}
// income ledger of a charge: from GST Charges, else a ledger with the charge name under Sales Accounts (made once and kept on the charge)
async function incomeLedger(t, line) {
  const c = await chargeRow(t, line.charge);
  if (c && c.ledgerId) return c.ledgerId;
  // iCAFFE rule: the charge posts only to the ledger mapped to it - no ledger is made here
  throw bad('Income ledger is not mapped for charge "' + String(line.charge).toUpperCase() + '" - map it in Accounts > Masters > MAP CSR Posting (or GST Charges), then save again.');
}
async function reimbLedger(t, line) {
  const c = await chargeRow(t, line.charge);
  if (c && c.expenseLedgerId) return c.expenseLedgerId;
  const r = (await q("SELECT id FROM AccountLedgers WHERE lower(trim(name)) = 'reimbursement of expenses' AND coalesce(isActive, 1) = 1 LIMIT 1", [], t))[0];
  if (r) return r.id;
  throw bad('Expense ledger is not mapped for reimbursable charge "' + String(line.charge).toUpperCase() + '" - map it in Accounts > Masters > MAP CSR Posting, then save again.');
}
// tax and round-off ledgers must exist too (Accounts > Masters > Ledger Account) - an invoice never makes a ledger
async function mustLedger(t, n) { const r = (await q('SELECT id FROM AccountLedgers WHERE lower(trim(name)) = lower(trim(?)) AND coalesce(isActive, 1) = 1 ORDER BY id LIMIT 1', [n], t))[0]; if (!r) throw bad('Ledger "' + n + '" is not in the accounts - create it in Accounts > Masters > Ledger Account'); return r.id; }
const taxLedger = (t, n) => mustLedger(t, n);

// ------------------------------------------------------------------ the arithmetic (done here, whatever the screen sent)
function compute(b, our) {
  const k = KINDS[b.kind];
  const exRate = num(b.exRate) || 1;
  const foreign = b.pos === '97' || /foreign/i.test(b.posName || '');
  const zeroRated = (b.sez || foreign) && /without/i.test(b.paymentOption || '');
  const gstOn = k.gst && !num(b.gstExempt) && !zeroRated && !num(b.rcm);
  const intra = !foreign && !b.sez && String(b.pos || '') === our.code;
  const lines = (Array.isArray(b.lines) ? b.lines : []).filter(l => String(l.charge || '').trim()).map((l, i) => {
    const qty = num(l.qty) || 1; const rate = num(l.rate); const disc = num(l.discount);
    const amount = r2(rate * qty - disc); const lex = num(l.exRate) || 1; const inrAmt = r2(amount * lex);
    const g = gstOn ? num(l.gstRate) : 0;
    const igstPct = gstOn && !intra ? g : 0; const cgstPct = gstOn && intra ? g / 2 : 0;
    return { sr: i + 1, jobNo: String(l.jobNo || b.jobNo || '').trim(), containerNo: l.containerNo || '', charge: String(l.charge).trim().toUpperCase(), sac: l.sac || '', unit: l.unit || '',
      qty, rate, amount, discount: disc, gstRate: g, igstPct, cgstPct, sgstPct: cgstPct,
      igst: r2(inrAmt * igstPct / 100), cgst: r2(inrAmt * cgstPct / 100), sgst: r2(inrAmt * cgstPct / 100),
      currency: l.currency || 'INR', exRate: lex, inrAmount: inrAmt, receiptNo: l.receiptNo || '', receiptDate: l.receiptDate || '', costCentre: l.costCentre || '', narration: l.narration || '' };
  });
  const grossInr = r2(lines.reduce((s, l) => s + l.inrAmount, 0));
  const igst = r2(lines.reduce((s, l) => s + l.igst, 0)), cgst = r2(lines.reduce((s, l) => s + l.cgst, 0)), sgst = r2(lines.reduce((s, l) => s + l.sgst, 0));
  const raw = r2(grossInr + igst + cgst + sgst);
  const total = num(b.roundOff) === 0 ? raw : Math.round(raw);
  return { lines, grossInr, igst, cgst, sgst, roundOffAmt: r2(total - raw), total: r2(total), chargeTotal: r2(lines.reduce((s, l) => s + l.amount, 0)), exRate, totalFcy: exRate !== 1 ? r2(total / exRate) : null, intra, gstOn, foreign };
}

// voucher lines for an invoice (Sales) or a credit note (reversed)
async function postingLines(t, b, c, partyId) {
  const out = []; const cn = b.kind === 'creditnote';
  const inc = cn ? 'Dr' : 'Cr', pty = cn ? 'Cr' : 'Dr';
  const fcy = b.currency && b.currency !== 'INR' ? { currency: b.currency, amountFcy: c.totalFcy, roe: c.exRate } : {};
  out.push({ ledgerId: partyId, dc: pty, amount: c.total, remarks: KINDS[b.kind].label + ' ' + (b.invoiceNo || ''), ...fcy });
  for (const l of c.lines) {
    const lid = b.kind === 'reimbursable' ? await reimbLedger(t, l) : await incomeLedger(t, l);
    out.push({ ledgerId: lid, dc: inc, amount: l.inrAmount, remarks: [l.charge, l.sac ? 'SAC ' + l.sac : '', l.jobNo ? 'Job ' + l.jobNo : '', l.narration].filter(Boolean).join(' - ') });
  }
  // iCAFFE posts GST charge-wise to the heads set on the GST charge (IGST / CGST / SGST account head, e.g. "IGST PAYABLE-18%");
  // a charge without its head is refused (ValidateGSTChargesMapping). Same head on several charges = one line.
  const tax = new Map();
  for (const l of c.lines) {
    if (!(l.igst || l.cgst || l.sgst)) continue;
    const ch = await chargeRow(t, l.charge) || {};
    for (const [k, col, lbl] of [['igst', 'igstLedgerId', 'IGST'], ['cgst', 'cgstLedgerId', 'CGST'], ['sgst', 'sgstLedgerId', 'SGST']]) {
      if (!l[k]) continue;
      const hid = ch[col] ? Number(ch[col]) : null;
      if (!hid) throw bad(lbl + ' account head is not set for charge "' + String(l.charge).toUpperCase() + '" - set it in Accounts > Masters > GST Charges, then save again.');
      const key = hid + '|' + lbl; tax.set(key, { ledgerId: hid, lbl, amount: r2((tax.get(key) ? tax.get(key).amount : 0) + l[k]) });
    }
  }
  for (const v of tax.values()) out.push({ ledgerId: v.ledgerId, dc: inc, amount: v.amount, remarks: v.lbl });
  if (c.roundOffAmt) out.push({ ledgerId: await mustLedger(t, 'Round Off'), dc: (c.roundOffAmt > 0) === cn ? 'Dr' : 'Cr', amount: Math.abs(c.roundOffAmt), remarks: 'Round off' });
  // a negative line (discount bigger than the charge) flips side
  const fixed = out.filter(l => l.amount).map(l => (l.amount < 0 ? { ...l, dc: l.dc === 'Dr' ? 'Cr' : 'Dr', amount: -l.amount } : l));
  const dr = r2(fixed.filter(l => l.dc === 'Dr').reduce((s, l) => s + l.amount, 0)), cr = r2(fixed.filter(l => l.dc === 'Cr').reduce((s, l) => s + l.amount, 0));
  if (Math.abs(dr - cr) > 0.01) throw bad('Posting does not balance (' + dr + ' / ' + cr + ')');
  return { lines: fixed, amount: dr };
}
async function writeDetails(t, vid, lines) {
  const s = new Date().toISOString();
  for (const l of lines) await x('INSERT INTO VoucherDetails (voucherId, ledgerId, dc, amount, currency, amountFcy, roe, remarks, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [vid, l.ledgerId, l.dc, r2(l.amount), l.currency || null, l.amountFcy || null, l.roe || null, l.remarks ? String(l.remarks).slice(0, 300) : null, s, s], t);
}
const monthClosed = async (d) => { try { const r = await q('SELECT isClosed FROM AccMonthClosings WHERE month = ?', [String(d).slice(0, 7)]); return !!(r[0] && r[0].isClosed); } catch (e) { return false; } };

function validate(b) {
  const k = KINDS[b.kind]; if (!k) throw bad('Unknown invoice type');
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) throw bad('Date is required');
  if (!String(b.partyName || '').trim() && !b.ledgerId) throw bad('Party is required');
  if (!b.partyType) throw bad('Party Type is required');
  if (k.gst && !b.pos) throw bad('Place of Supply is required');
  if (k.againstBill && !b.withOut && !String(b.prevInvoiceNo || '').trim()) throw bad('Previous Invoice No is required (or tick WithOut)');
  if (k.againstBill && !b.reason) throw bad('Reason To Issue is required');
  if (b.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(String(b.gstin).trim())) throw bad('GST No should be 15 characters, starting with the state code');
  if (!(Array.isArray(b.lines) && b.lines.some(l => String(l.charge || '').trim()))) throw bad('Add at least one charge');
  if (num(b.bulk)) {
    const ds = (Array.isArray(b.dockets) ? b.dockets : []).map(d => String(d).toUpperCase().trim()).filter(Boolean);
    if (ds.length < 1) throw bad('Bulk invoice: choose the dockets');
    for (const l of b.lines) if (String(l.charge || '').trim() && !ds.includes(String(l.jobNo || '').toUpperCase().trim())) throw bad('Bulk invoice: every charge needs one of the chosen dockets (' + l.charge + ')');
  }
  for (const l of b.lines) if (String(l.charge || '').trim() && !(num(l.rate) * (num(l.qty) || 1))) throw bad('Rate is missing for ' + l.charge);
}
const HEAD_KEYS = ['kind', 'date', 'branchCode', 'partyType', 'partyName', 'partyId', 'partyBranchId', 'address', 'gstin', 'stateName', 'stateCode', 'pos', 'posName', 'sez', 'paymentOption',
  'countryCode', 'currency', 'exRate', 'costCentre', 'roundOff', 'gstExempt', 'hideExRate', 'rcm', 'withOut', 'prevInvoiceId', 'prevInvoiceNo', 'prevInvoiceDate', 'reason', 'docketBy', 'jobNo',
  'hawbNo', 'mawbNo', 'quotationNo', 'email', 'advance', 'remarks', 'bulk', 'dockets', 'division'];
const headOf = (b) => { const o = {}; for (const k of HEAD_KEYS) { let v = b[k]; if (typeof v === 'boolean') v = v ? 1 : 0; o[k] = v === undefined || v === '' ? null : v; } if (o.gstin) o.gstin = String(o.gstin).toUpperCase().trim();
  o.bulk = num(b.bulk) ? 1 : 0; o.dockets = o.bulk && Array.isArray(b.dockets) ? JSON.stringify(b.dockets.map(d => String(d).toUpperCase().trim()).filter(Boolean)) : null;
  if (o.bulk) o.jobNo = null; return o; };

// ================================================================== routes
router.get('/meta', async (req, res) => {
  try {
    await ensure();
    const [our, states, currencies, branches] = await Promise.all([ourGst(), indianStates(),
      q('SELECT currencyCode code, currencyName name, importRate, exportRate FROM Currencies ORDER BY standard DESC, currencyCode').catch(() => []),
      q("SELECT branchCode code, branchName name, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, branchCode").catch(() => [])]);
    res.json({ kinds: Object.entries(KINDS).map(([id, k]) => ({ id, ...k })), reasons: REASONS, our, states, currencies, branches });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// party search: the Party master (with its GST branches) and the debtor ledgers already in accounts
router.get('/parties', async (req, res) => {
  try {
    await ensure();
    const s = String(req.query.q || '').trim(); if (s.length < 2) return res.json([]);
    const flag = { importer: '(p.isConsignee = 1 OR p.isShipper = 1)', shipper: 'p.isShipper = 1', subagent: 'p.isSubAgent = 1', overseas: 'p.isOverseasAgent = 1' }[req.query.type] || '1 = 1';
    const ps = await q(`SELECT p.id, p.name, p.partyType, p.email FROM Parties p WHERE ${flag} AND coalesce(p.blackList, 0) = 0 AND p.name LIKE ? ORDER BY (p.name LIKE ?) DESC, p.name LIMIT 25`, ['%' + s + '%', s + '%']).catch(() => []);
    const ids = ps.map(p => p.id);
    const br = ids.length ? await q(`SELECT id, partyId, branchName, address1, address2, city, state, country, pinCode, gstin, email1, sez, gstExempted, isDefault FROM PartyBranches
        WHERE partyId IN (${ids.join(',')}) AND coalesce(disabled, 0) = 0 ORDER BY isDefault DESC, id`).catch(() => []) : [];
    const leds = await q(`SELECT l.id, l.name, l.gstin, l.state, l.address, l.email FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.name LIKE ? AND coalesce(l.isActive, 1) = 1
      AND coalesce(g.nature, 'Assets') IN ('Assets', 'Liabilities') AND lower(coalesce(g.name, '')) NOT LIKE '%duties%' AND lower(coalesce(g.name, '')) NOT LIKE '%bank%' AND lower(coalesce(g.name, '')) NOT LIKE '%cash%' ORDER BY l.name LIMIT 10`, ['%' + s + '%']).catch(() => []);
    const accOf = new Map(); // party -> its account
    if (ps.length) for (const l of await q(`SELECT id, name, partyId FROM AccountLedgers WHERE coalesce(isActive, 1) = 1 AND (partyId IN (${ids.length ? ids.join(',') : 0}) OR upper(trim(name)) IN (${ps.map(() => '?').join(',')}))`, ps.map(p => String(p.name).trim().toUpperCase())).catch(() => []))
      for (const p of ps) if (l.partyId === p.id || String(l.name).trim().toUpperCase() === String(p.name).trim().toUpperCase()) { if (accOf.has(p.id) && accOf.get(p.id) !== l.id) accOf.set(p.id, -1); else accOf.set(p.id, l.id); }
    for (const [k, v] of accOf) if (v === -1) accOf.set(k, null); // two accounts for one party: the user picks the account (never a guess)
    res.json([
      ...leds.map(l => ({ source: 'ledger', ledgerId: l.id, name: l.name, branches: [{ id: null, label: 'Ledger', address: l.address || '', gstin: l.gstin || '', state: l.state || '', email: l.email || '' }] })),
      ...ps.map(p => ({ source: 'party', partyId: p.id, ledgerId: accOf.get(p.id) || null, hasAccount: accOf.has(p.id), twoAccounts: accOf.has(p.id) && !accOf.get(p.id), name: p.name, partyType: p.partyType, branches: br.filter(b => b.partyId === p.id).map(b => ({ id: b.id, label: b.branchName || 'Branch',
        address: [b.address1, b.address2, b.city, b.pinCode].filter(Boolean).join(', '), gstin: b.gstin || '', state: b.state || '', country: b.country || '', email: b.email1 || p.email || '', sez: !!b.sez, exempt: !!b.gstExempted })) })),
    ]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// iCAFFE GetPartyAccountByID: the party's account, or nothing ("Party Account not created !")
router.get('/party-account', async (req, res) => {
  try { await ensure(); const id = await findPartyLedger(null, { ledgerId: Number(req.query.ledgerId) || null, partyId: Number(req.query.partyId) || null, partyName: req.query.name || '', gstin: req.query.gstin || '' });
    res.json(id ? (await q('SELECT l.id ledgerId, l.name, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.id = ?', [id]))[0] : null); }
  catch (e) { res.status(e.status || 500).json({ error: e.message, candidates: e.candidates || undefined }); }
});
// docket / house no -> job details and the party on it
router.get('/job', async (req, res) => {
  try {
    const no = String(req.query.no || '').trim().toUpperCase(); if (!no) return res.json(null);
    const byHawb = req.query.by === 'hawb';
    // 05-Nov-2026: freight dockets (Shipment Registration) first
    const sh = (await q(`SELECT docketNo jobNo, docketDate jobDate, mawbNo, hawbNo, ediJobNo sbBe, branchCode, division, mainParty party, billingParty, billingAddress FROM Shipments
        WHERE upper(trim(${byHawb ? 'hawbNo' : 'docketNo'})) = ? AND coalesce(stage, '') <> 'Cancelled' LIMIT 1`, [no]).catch(() => []))[0];
    if (sh) return res.json({ ...sh, dir: /^A?I|SI/.test(sh.division) ? 'Import' : 'Export', mode: /^A/.test(sh.division) ? 'AIR' : 'SEA', party: sh.billingParty || sh.party, jobDate: String(sh.jobDate || '').slice(0, 10) });
    const ex = await q(`SELECT jobNo, jobDate, mawbNo, hawbNo, coalesce(sbNo, sbNumber) sbBe, branchCode, shipmentMode mode, shipperName party, 'Export' dir FROM ExportJobs WHERE upper(trim(${byHawb ? 'hawbNo' : 'jobNo'})) = ? LIMIT 1`, [no]).catch(() => []);
    const im = ex.length ? [] : await q(`SELECT jobNo, jobDate, coalesce(mawbNo, mawbblNo) mawbNo, coalesce(hawbNo, hawbhblNo) hawbNo, coalesce(beNo, beNumber) sbBe, branchCode, shipmentMode mode, nameOfImporter party, 'Import' dir FROM ImportJobs
        WHERE upper(trim(${byHawb ? 'coalesce(hawbNo, hawbhblNo)' : 'jobNo'})) = ? LIMIT 1`, [no]).catch(() => []);
    const j = ex[0] || im[0]; if (!j) return res.json(null);
    res.json({ ...j, jobDate: j.jobDate ? String(j.jobDate).slice(0, 10) : '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/charges', async (req, res) => {
  try {
    const s = '%' + String(req.query.q || '').trim() + '%';
    const a = await q('SELECT chargeName name, sacCode sac, gstRate, ledgerId, expenseLedgerId, coalesce(exempt, 0) exempt FROM AccGstCharges WHERE chargeName LIKE ? ORDER BY chargeName LIMIT 30', [s]).catch(() => []);
    const b = await q(`SELECT DISTINCT coalesce(chargeName, awbChargeName) name, sacCode sac, gstRate FROM Charges WHERE coalesce(chargeName, awbChargeName) LIKE ? AND coalesce(isActive, 1) = 1 LIMIT 30`, [s]).catch(() => []);
    const seen = new Set(a.map(c => String(c.name).toUpperCase()));
    res.json([...a.map(c => ({ ...c, master: true })), ...b.filter(c => c.name && !seen.has(String(c.name).toUpperCase())).map(c => ({ ...c, master: false }))]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Show Expense: the costs booked on the docket (purchase / payment / journal lines to expense ledgers), to bill them on
router.get('/expenses', async (req, res) => {
  try {
    const no = String(req.query.jobNo || '').trim(); if (!no) return res.json([]);
    const rows = await q(`SELECT v.id vid, v.voucherNumber, v.date, t.baseType, v.refNo, d.amount, d.dc, d.remarks, l.name ledger, l.id ledgerId, g.nature
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId LEFT JOIN AccountGroups g ON g.id = l.groupId
        WHERE upper(trim(v.jobNo)) = upper(?) AND coalesce(v.status, '') <> 'Rejected' AND t.baseType IN ('Purchase', 'Payment', 'Journal', 'Debit Note') ORDER BY v.date`, [no]);
    const exp = rows.filter(r => r.nature === 'Expenses' || /expense|freight|charges/i.test(r.ledger));
    const billed = await q(`SELECT linesJson FROM AccSalesInvoices WHERE upper(trim(jobNo)) = upper(?) AND coalesce(status, '') <> 'Void'`, [no]).catch(() => []);
    const done = new Map(); for (const b of billed) for (const l of JSON.parse(b.linesJson || '[]')) done.set(l.charge, (done.get(l.charge) || 0) + num(l.inrAmount));
    res.json(exp.map(r => { const c = String(r.remarks || '').match(/^Rec\s+(.+?)\s+SAC/i); const charge = (c ? c[1] : r.ledger).toUpperCase();
      return { voucherId: r.vid, voucherNumber: r.voucherNumber, date: r.date, baseType: r.baseType, billNo: r.refNo || '', ledger: r.ledger, charge, amount: r2((r.dc === 'Dr' ? 1 : -1) * num(r.amount)), billed: r2(done.get(charge) || 0) }; }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/next-no', async (req, res) => {
  try { await ensure(); if (!KINDS[req.query.kind]) return res.json({ no: '' }); res.json({ no: await invoiceNoFor(req.query.kind, req.query.branch, req.query.date || today(), null, ns.divOf(req.query.division || req.query.jobNo), false) }); }
  catch (e) { if (e.status === 400) return res.json({ no: '', note: e.message }); res.status(500).json({ error: e.message }); }
});
// search (iCAFFE Search tab)
router.get('/', async (req, res) => {
  try {
    await ensure();
    const w = ['1 = 1']; const p = [];
    const one = (v) => (Array.isArray(v) ? v[v.length - 1] : v);
    const f = Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, one(v)]));
    if (f.kind) { w.push('i.kind = ?'); p.push(f.kind); }
    if (f.from) { w.push('i.date >= ?'); p.push(f.from); }
    if (f.to) { w.push('i.date <= ?'); p.push(f.to); }
    if (f.partyType) { w.push('i.partyType = ?'); p.push(f.partyType); }
    if (f.party) { w.push('i.partyName LIKE ?'); p.push('%' + f.party + '%'); }
    if (f.no) { if (f.by === 'docket') { w.push('(i.jobNo LIKE ? OR i.dockets LIKE ?)'); p.push('%' + f.no + '%', '%' + f.no + '%'); } else { w.push((f.by === 'hawb' ? 'i.hawbNo' : 'i.invoiceNo') + ' LIKE ?'); p.push('%' + f.no + '%'); } }
    if (f.status === 'Void') w.push("i.status = 'Void'"); else if (f.status === 'Approved') w.push("coalesce(i.status, '') <> 'Void'");
    if (f.remarks) { w.push("i.remarks LIKE ? AND i.remarks NOT LIKE 'Loaded from iCAFFE%'"); p.push('%' + f.remarks + '%'); }
    if (f.branch) { w.push("(i.branchCode = ? OR coalesce(i.branchCode, '') = '')"); p.push(f.branch); }
    // 09-Nov-2026: the search keeps to the branch picked in the top bar (ALL = the user's branches); a bill saved with no
    // branch counts as the default branch, as in the vouchers (utils/branchScope.js)
    const sc = bs.current(); if (sc && sc.list) { w.push(`coalesce(nullif(upper(trim(i.branchCode)), ''), ?) IN (${sc.list.map(() => '?').join(', ')})`); p.push(sc.def, ...sc.list); }
    const rows = await q(`SELECT i.id, i.kind, i.invoiceNo, i.date, i.prevInvoiceNo, i.status, i.partyName, i.gstin, i.jobNo, i.hawbNo, i.total, i.currency, i.totalFcy, i.createdBy, i.createdAt,
        i.modifiedBy, i.updatedAt, i.costCentre, i.remarks, i.voucherId, i.sez, i.pos, i.paymentOption, i.bulk, i.dockets, i.irn, i.irnStatus, i.ackNo, (SELECT k.kind FROM AccSalesInvoices k WHERE k.id = i.prevInvoiceId) prevKind
        FROM AccSalesInvoices i WHERE ${w.join(' AND ')} ORDER BY i.date DESC, i.id DESC LIMIT 501`, p);
    if (rows.length > 500) res.set('X-More', '1');
    res.json(rows.slice(0, 500).map(r => ({ ...r, remarks: realRemark(r.remarks), kindLabel: (KINDS[r.kind] || {}).label || r.kind, prevKind: r.prevKind ? KINDS[r.prevKind].label : '',
      supplyType: r.sez ? (/without/i.test(r.paymentOption || '') ? 'SEZWOP' : 'SEZWP') : r.pos === '97' ? (/without/i.test(r.paymentOption || '') ? 'EXPWOP' : 'EXPWP') : r.gstin ? 'B2B' : 'B2C' })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// 09-Nov-2026: a bill loaded from iCAFFE carries no place of supply / state / address, and its GST is at bill level
// only (every line shows 0 %). For viewing, these are filled in from what is known - nothing is saved:
//   state / place of supply from the party's GSTIN, address from the party branch or the ledger (as on the print),
//   each line's GST % from the GST Charges master, and the bill's own IGST / CGST / SGST shared over the lines so they
//   add up to the bill exactly.
async function icaffeView(o) {
  const gst = String(o.gstin || '').trim().toUpperCase();
  const sc = String(o.stateCode || (/^\d\d/.test(gst) ? gst.slice(0, 2) : '')).padStart(2, '0');
  if (!o.stateCode && /^\d\d$/.test(sc) && sc !== '00') o.stateCode = sc;
  if (!o.stateName && GST_STATES[o.stateCode]) o.stateName = GST_STATES[o.stateCode];
  if (!o.pos && (o.kind === 'overseas' || o.stateCode)) { o.pos = o.kind === 'overseas' ? '97' : o.stateCode; }
  if (!o.posName && o.pos) o.posName = o.pos === '97' ? 'Foreign Country' : (GST_STATES[o.pos] || '');
  if (!o.address) {
    const pb = o.partyBranchId ? (await q('SELECT address1, address2, city, state, pinCode, country FROM PartyBranches WHERE id = ?', [o.partyBranchId]).catch(() => []))[0] : null;
    const pg = !pb && gst ? (await q('SELECT address1, address2, city, state, pinCode, country FROM PartyBranches WHERE upper(trim(gstin)) = ? OR upper(trim(regNo)) = ? ORDER BY id LIMIT 1', [gst, gst]).catch(() => []))[0] : null;
    const led = o.ledgerId ? (await q('SELECT address, state, pinCode, country, gstin FROM AccountLedgers WHERE id = ?', [o.ledgerId]).catch(() => []))[0] : null;
    const ledOk = led && (!gst || !led.gstin || String(led.gstin).trim().toUpperCase() === gst);
    o.address = [pb, pg].map(b => (b ? [b.address1, b.address2, b.city, b.pinCode, b.state, b.country].filter(Boolean).join(', ') : '')).find(Boolean)
      || (ledOk ? [led.address, led.pinCode, led.state, led.country === 'IN' ? 'INDIA' : led.country].filter(Boolean).join(', ') : '') || '';
  }
  const lines = o.lines || [];
  const tax = { igst: num(o.igst), cgst: num(o.cgst), sgst: num(o.sgst) };
  const totalTax = tax.igst + tax.cgst + tax.sgst;
  const noLineTax = lines.every(l => !num(l.igst) && !num(l.cgst) && !num(l.sgst));
  if (lines.length && noLineTax && totalTax > 0) {
    const names = [...new Set(lines.map(l => String(l.charge || '').trim().toUpperCase()).filter(Boolean))];
    const rate = {};
    if (names.length) {
      const ph = names.map(() => '?').join(',');
      for (const t of ['AccGstCharges', 'Charges']) for (const r of await q(`SELECT upper(trim(chargeName)) n, sacCode, gstRate FROM ${t} WHERE upper(trim(chargeName)) IN (${ph})`, names).catch(() => [])) if (!rate[r.n]) rate[r.n] = { r: num(r.gstRate), sac: r.sacCode || '' };
    }
    const amt = (l) => num(l.inrAmount != null ? l.inrAmount : l.amount);
    const base = lines.map(l => { const m = rate[String(l.charge || '').trim().toUpperCase()]; return { a: amt(l), r: m ? m.r : null, sac: m ? m.sac : '' }; });
    const byMaster = base.reduce((s, x) => s + x.a * (x.r || 0) / 100, 0);
    const taxable = base.reduce((s, x) => s + x.a, 0);
    // the master's rates give the bill's tax: use them; otherwise one effective rate for the bill
    const useMaster = base.every(x => x.r != null) && Math.abs(byMaster - totalTax) <= 1;
    const eff = taxable ? r2(totalTax / taxable * 100) : 0;
    const w = base.map(x => x.a * (useMaster ? x.r : eff));
    const W = w.reduce((s, x) => s + x, 0) || 1;
    for (const k of ['igst', 'cgst', 'sgst']) {
      let left = r2(tax[k]);
      lines.forEach((l, i) => { const v = i === lines.length - 1 ? left : r2(tax[k] * w[i] / W); l[k] = v; left = r2(left - v); });
    }
    lines.forEach((l, i) => {
      const rr = useMaster ? base[i].r : (base[i].a ? r2((num(l.igst) + num(l.cgst) + num(l.sgst)) / base[i].a * 100) : 0);
      l.gstRate = rr;
      if (tax.igst) { l.igstPct = rr; l.cgstPct = 0; l.sgstPct = 0; } else { l.igstPct = 0; l.cgstPct = r2(rr / 2); l.sgstPct = r2(rr / 2); }
      if (!l.sac && base[i].sac) l.sac = base[i].sac;
    });
    o.viewNote = useMaster ? 'GST % per line from the GST Charges master' : 'GST shown at the bill\'s effective rate ' + eff + '%';
  }
  o.viewOnly = true;
  return o;
}

const load = async (where, p) => {
  await ensure();
  const r = (await q(`SELECT * FROM AccSalesInvoices WHERE ${where} LIMIT 1`, p))[0]; if (!r) return null;
  const al = r.voucherId ? (await q('SELECT coalesce(sum(amount), 0) a FROM VoucherAllocations WHERE againstVoucherId = ?', [r.voucherId]).catch(() => [{ a: 0 }]))[0].a : 0;
  const cns = await q("SELECT id, kind, invoiceNo, date, total FROM AccSalesInvoices WHERE prevInvoiceId = ? AND coalesce(status, '') <> 'Void'", [r.id]);
  const out = { ...r, remarks: realRemark(r.remarks), lines: JSON.parse(r.linesJson || '[]'), linesJson: undefined, dockets: r.dockets ? JSON.parse(r.dockets) : [], mailLog: r.mailLog ? JSON.parse(r.mailLog) : [], received: r2(al), notes: cns, kindLabel: (KINDS[r.kind] || {}).label };
  return r.createdBy === 'iCAFFE' ? icaffeView(out) : out;
};
router.get('/by-voucher/:vid', async (req, res) => { try { res.json(await load('voucherId = ?', [req.params.vid])); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/by-no', async (req, res) => { try { res.json(await load('upper(invoiceNo) = upper(?)', [String(req.query.no || '').trim()])); } catch (e) { res.status(500).json({ error: e.message }); } });
router.get('/:id', async (req, res) => {
  try { const r = await load('id = ?', [req.params.id]); if (!r) return res.status(404).json({ error: 'Invoice not found' }); res.json(r); } catch (e) { res.status(500).json({ error: e.message }); }
});

// preview: the same arithmetic and posting the save will do, without saving
router.post('/preview', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    await ensure(); const b = req.body || {}; const our = await ourGst(); const c = compute(b, our);
    let posting = [];
    if (c.lines.length && (b.partyName || b.ledgerId)) { const pid = await partyLedger(t, b); posting = (await postingLines(t, b, c, pid)).lines; }
    const names = posting.length ? new Map((await q(`SELECT id, name FROM AccountLedgers WHERE id IN (${posting.map(l => l.ledgerId).join(',')})`, [], t)).map(l => [l.id, l.name])) : new Map();
    await t.rollback();
    res.json({ ...c, our, posting: posting.map(l => ({ ...l, ledger: names.get(l.ledgerId) || 'New ledger' })) });
  } catch (e) { await t.rollback().catch(() => {}); res.status(e.status || 500).json({ error: e.message }); }
});

async function prevInvoice(b, t) {
  if (!b.prevInvoiceNo || b.withOut) return null;
  const p = (await q("SELECT * FROM AccSalesInvoices WHERE upper(invoiceNo) = upper(?) AND coalesce(status, '') <> 'Void' LIMIT 1", [String(b.prevInvoiceNo).trim()], t))[0];
  if (!p) throw bad('Previous invoice ' + b.prevInvoiceNo + ' not found');
  return p;
}
router.post('/', async (req, res) => {
  const b = { ...(req.body || {}) }; let t;
  try {
    await ensure(); validate(b);
    if (await monthClosed(b.date)) throw bad('The month of ' + b.date + ' is closed for posting');
    const our = await ourGst(); const c = compute(b, our);
    t = await sequelize.transaction();
    const prev = await prevInvoice(b, t);
    if (prev && b.kind === 'creditnote') {
      const used = (await q("SELECT coalesce(sum(total), 0) s FROM AccSalesInvoices WHERE prevInvoiceId = ? AND kind = 'creditnote' AND coalesce(status, '') <> 'Void'", [prev.id], t))[0].s;
      if (r2(num(used) + c.total) > r2(prev.total) + 0.01) throw bad('Credit notes would be more than invoice ' + prev.invoiceNo + ' (' + prev.total + ', already credited ' + r2(used) + ')');
    }
    const head = headOf(b); head.prevInvoiceId = prev ? prev.id : null; if (prev) head.prevInvoiceDate = prev.date;
    b.division = divOfInvoice(b) || null; head.division = b.division;
    const invoiceNo = await invoiceNoFor(b.kind, b.branchCode, b.date, t, b.division, true); b.invoiceNo = invoiceNo;
    const pid = await partyLedger(t, b); const post = await postingLines(t, b, c, pid);
    const ty = (await q('SELECT id FROM VoucherTypes WHERE baseType = ? ORDER BY id LIMIT 1', [KINDS[b.kind].base], t))[0];
    if (!ty) throw bad('Voucher type "' + KINDS[b.kind].base + '" is missing');
    const s = new Date().toISOString(); const by = userOf(req);
    const narr = KINDS[b.kind].label + ' invoice ' + invoiceNo + (num(b.bulk) ? ' - Bulk, ' + (b.dockets || []).length + ' dockets' : b.jobNo ? ' - Job ' + b.jobNo : '') + (prev ? ' against ' + prev.invoiceNo : '') + (b.remarks ? ' - ' + b.remarks : '');
    await x(`INSERT INTO Vouchers (voucherTypeId, voucherNumber, date, narration, totalAmount, status, branchCode, refNo, jobNo, createdByName, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ty.id, invoiceNo, b.date, narr.slice(0, 500), post.amount, 'Approved', b.branchCode || null, prev ? prev.invoiceNo : (b.quotationNo || null), num(b.bulk) ? null : b.jobNo || null, by || null, s, s], t);
    const vid = (await q('SELECT id FROM Vouchers WHERE voucherTypeId = ? AND voucherNumber = ? ORDER BY id DESC LIMIT 1', [ty.id, invoiceNo], t))[0].id;
    await writeDetails(t, vid, post.lines);
    // a credit note sets itself off against the invoice it is for
    if (prev && b.kind === 'creditnote' && prev.voucherId) await x('INSERT INTO VoucherAllocations (voucherId, ledgerId, againstVoucherId, amount, createdAt, updatedAt) VALUES (?,?,?,?,?,?)', [vid, pid, prev.voucherId, c.total, s, s], t).catch(() => null);
    const row = { ...head, invoiceNo, voucherId: vid, ledgerId: pid, status: 'Approved', linesJson: JSON.stringify(c.lines), chargeTotal: c.chargeTotal, grossInr: c.grossInr, igst: c.igst, cgst: c.cgst, sgst: c.sgst,
      roundOffAmt: c.roundOffAmt, total: c.total, totalFcy: c.totalFcy, exRate: c.exRate, createdBy: by || null, createdAt: s, updatedAt: s };
    const keys = Object.keys(row);
    await x(`INSERT INTO AccSalesInvoices (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map(k => row[k]), t);
    const id = (await q('SELECT id FROM AccSalesInvoices WHERE invoiceNo = ?', [invoiceNo], t))[0].id;
    await t.commit();
    res.json({ id, invoiceNo, voucherId: vid, total: c.total });
  } catch (e) { if (t) await t.rollback().catch(() => {}); res.status(e.status || 500).json({ error: e.message }); }
});
// Modify: same number, voucher lines rewritten; refused if receipts already set off are more than the new total
router.put('/:id', async (req, res) => {
  const b = { ...(req.body || {}) }; let t;
  try {
    await ensure();
    const old = (await q('SELECT * FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0];
    if (!old) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    if (old.status === 'Void') throw bad('A void invoice cannot be modified');
    if (fromIcaffe(old)) throw bad('This bill was loaded from iCAFFE (its voucher is iCAFFE\'s) - it is view only here; for a change issue a credit / debit note');
    if (old.irn && old.irnStatus !== 'Cancelled') throw bad('This invoice has an IRN - it cannot be modified; issue a credit / debit note instead');
    b.kind = old.kind; validate(b);
    if (await monthClosed(old.date) || await monthClosed(b.date)) throw bad('The month is closed for posting');
    const our = await ourGst(); const c = compute(b, our);
    t = await sequelize.transaction();
    const prev = await prevInvoice(b, t);
    const got = old.voucherId ? num((await q('SELECT coalesce(sum(amount), 0) a FROM VoucherAllocations WHERE againstVoucherId = ?', [old.voucherId], t))[0].a) : 0;
    if (got > c.total + 0.01) throw bad('Receipts / credit notes of ' + r2(got) + ' are already set off against this invoice - the total cannot go below that');
    b.invoiceNo = old.invoiceNo;
    const pid = await partyLedger(t, b); const post = await postingLines(t, b, c, pid);
    const s = new Date().toISOString(); const by = userOf(req);
    if (old.voucherId) {
      await x('DELETE FROM VoucherDetails WHERE voucherId = ?', [old.voucherId], t);
      const narr = KINDS[old.kind].label + ' invoice ' + old.invoiceNo + (num(b.bulk) ? ' - Bulk, ' + (b.dockets || []).length + ' dockets' : b.jobNo ? ' - Job ' + b.jobNo : '') + (prev ? ' against ' + prev.invoiceNo : '') + (b.remarks ? ' - ' + b.remarks : '');
      await x('UPDATE Vouchers SET date = ?, narration = ?, totalAmount = ?, jobNo = ?, refNo = ?, branchCode = ?, updatedAt = ? WHERE id = ?',
        [b.date, narr.slice(0, 500), post.amount, num(b.bulk) ? null : b.jobNo || null, prev ? prev.invoiceNo : (b.quotationNo || null), b.branchCode || null, s, old.voucherId], t);
      await writeDetails(t, old.voucherId, post.lines);
      if (old.kind === 'creditnote') await x('UPDATE VoucherAllocations SET amount = ?, ledgerId = ?, updatedAt = ? WHERE voucherId = ?', [c.total, pid, s, old.voucherId], t).catch(() => null);
    }
    const head = headOf(b); head.prevInvoiceId = prev ? prev.id : null; if (prev) head.prevInvoiceDate = prev.date;
    const row = { ...head, ledgerId: pid, linesJson: JSON.stringify(c.lines), chargeTotal: c.chargeTotal, grossInr: c.grossInr, igst: c.igst, cgst: c.cgst, sgst: c.sgst, roundOffAmt: c.roundOffAmt,
      total: c.total, totalFcy: c.totalFcy, exRate: c.exRate, modifiedBy: by || null, updatedAt: s };
    delete row.kind;
    const keys = Object.keys(row);
    await x(`UPDATE AccSalesInvoices SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`, [...keys.map(k => row[k]), old.id], t);
    await t.commit();
    res.json({ id: old.id, invoiceNo: old.invoiceNo, voucherId: old.voucherId, total: c.total });
  } catch (e) { if (t) await t.rollback().catch(() => {}); res.status(e.status || 500).json({ error: e.message }); }
});
// Delete (only while nothing depends on it): no IRN, nothing set off against it, no credit / debit note on it, month open.
// A full copy is kept in AccSalesInvoiceDeleted.
router.delete('/:id', async (req, res) => {
  let t;
  try {
    await ensure();
    const r = (await q('SELECT * FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0]; if (!r) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    if (fromIcaffe(r)) throw bad('This bill was loaded from iCAFFE (its voucher is iCAFFE\'s) - it is view only here; for a change issue a credit / debit note');
    if (r.irn && r.irnStatus !== 'Cancelled') throw bad('This invoice has an IRN - cancel the IRN first');
    if (await monthClosed(r.date)) throw bad('The month of the invoice is closed for posting');
    const notes = await q("SELECT invoiceNo FROM AccSalesInvoices WHERE prevInvoiceId = ? AND coalesce(status, '') <> 'Void'", [r.id]);
    if (notes.length) throw bad('Credit / debit notes are made on it (' + notes.map(x2 => x2.invoiceNo).join(', ') + ') - delete or void them first');
    const got = r.voucherId ? num((await q("SELECT coalesce(sum(a.amount), 0) a FROM VoucherAllocations a JOIN Vouchers v ON v.id = a.voucherId WHERE a.againstVoucherId = ? AND coalesce(v.status, '') <> 'Rejected'", [r.voucherId]))[0].a) : 0;
    if (got > 0.009) throw bad('Receipts are set off against this invoice - remove them first');
    t = await sequelize.transaction(); const s = new Date().toISOString();
    await x('CREATE TABLE IF NOT EXISTS AccSalesInvoiceDeleted (id INTEGER PRIMARY KEY AUTOINCREMENT, invoiceId INTEGER, invoiceNo TEXT, dataJson TEXT, voucherJson TEXT, deletedBy TEXT, createdAt DATETIME, updatedAt DATETIME)', [], t);
    const vj = r.voucherId ? { voucher: (await q('SELECT * FROM Vouchers WHERE id = ?', [r.voucherId], t))[0] || null, details: await q('SELECT * FROM VoucherDetails WHERE voucherId = ?', [r.voucherId], t) } : null;
    await x('INSERT INTO AccSalesInvoiceDeleted (invoiceId, invoiceNo, dataJson, voucherJson, deletedBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', [r.id, r.invoiceNo, JSON.stringify(r), JSON.stringify(vj), userOf(req) || null, s, s], t);
    if (r.voucherId) {
      await x('DELETE FROM VoucherAllocations WHERE voucherId = ?', [r.voucherId], t).catch(() => null);
      await x('DELETE FROM VoucherDetails WHERE voucherId = ?', [r.voucherId], t);
      await x('DELETE FROM Vouchers WHERE id = ?', [r.voucherId], t);
    }
    await x('DELETE FROM AccSalesInvoices WHERE id = ?', [r.id], t);
    await t.commit(); res.json({ ok: true, invoiceNo: r.invoiceNo });
  } catch (e) { if (t) await t.rollback().catch(() => {}); res.status(e.status || 500).json({ error: e.message }); }
});
// Void (iCAFFE): the number stays, the invoice and its voucher drop out of the books
router.post('/:id/void', async (req, res) => {
  let t;
  try {
    await ensure();
    const reason = String((req.body || {}).reason || '').trim(); if (!reason) throw bad('Give the reason for void');
    const old = (await q('SELECT * FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0]; if (!old) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    if (old.status === 'Void') throw bad('Already void');
    if (fromIcaffe(old)) throw bad('This bill was loaded from iCAFFE (its voucher is iCAFFE\'s) - it is view only here; for a change issue a credit / debit note');
    if (old.irn && old.irnStatus !== 'Cancelled') throw bad('This invoice has an IRN - cancel the IRN first (Cancel IRN)');
    if (await monthClosed(old.date)) throw bad('The month of the invoice is closed for posting');
    const got = old.voucherId ? num((await q('SELECT coalesce(sum(a.amount), 0) a FROM VoucherAllocations a JOIN Vouchers v ON v.id = a.voucherId WHERE a.againstVoucherId = ? AND coalesce(v.status, \'\') <> \'Rejected\'', [old.voucherId]))[0].a) : 0;
    if (got > 0.009) throw bad('Receipts / credit notes are set off against this invoice - remove them first');
    t = await sequelize.transaction(); const s = new Date().toISOString(); const by = userOf(req);
    if (old.voucherId) {
      await x("UPDATE Vouchers SET status = 'Rejected', narration = coalesce(narration, '') || ?, updatedAt = ? WHERE id = ?", [' [VOID: ' + reason + ']', s, old.voucherId], t);
      await x('DELETE FROM VoucherAllocations WHERE voucherId = ?', [old.voucherId], t).catch(() => null);
    }
    await x("UPDATE AccSalesInvoices SET status = 'Void', voidReason = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?", [reason, by || null, s, old.id], t);
    await t.commit(); res.json({ ok: true });
  } catch (e) { if (t) await t.rollback().catch(() => {}); res.status(e.status || 500).json({ error: e.message }); }
});

// ================================================================== Bulk Invoice: dockets to put on one invoice
router.get('/jobs', async (req, res) => {
  try {
    await ensure();
    const s = String(req.query.q || '').trim(), party = String(req.query.party || '').trim();
    const from = req.query.from || '2000-01-01', to = req.query.to || today();
    const w = (col, pcol) => { const a = [`date(${col}) >= date(?)`, `date(${col}) <= date(?)`]; const p = [from, to]; if (s) { a.push('upper(jobNo) LIKE ?'); p.push('%' + s.toUpperCase() + '%'); } if (party) { a.push(`upper(${pcol}) LIKE ?`); p.push('%' + party.toUpperCase() + '%'); } return [a.join(' AND '), p]; };
    const [we, pe] = w('jobDate', 'shipperName'); const [wi, pi] = w('jobDate', 'nameOfImporter');
    const ex = await q(`SELECT jobNo, jobDate, mawbNo, hawbNo, shipperName party, 'Export' dir, shipmentMode mode FROM ExportJobs WHERE ${we} ORDER BY jobDate DESC LIMIT 200`, pe).catch(() => []);
    const im = await q(`SELECT jobNo, jobDate, coalesce(mawbNo, mawbblNo) mawbNo, coalesce(hawbNo, hawbhblNo) hawbNo, nameOfImporter party, 'Import' dir, shipmentMode mode FROM ImportJobs WHERE ${wi} ORDER BY jobDate DESC LIMIT 200`, pi).catch(() => []);
    const [wsS, psS] = w('docketDate', 'mainParty');
    const shp = await q(`SELECT docketNo jobNo, docketDate jobDate, mawbNo, hawbNo, mainParty party, division FROM Shipments WHERE coalesce(stage, '') <> 'Cancelled' AND ${wsS.replace(/upper\(jobNo\)/, 'upper(docketNo)')} ORDER BY docketDate DESC LIMIT 300`, psS).catch(() => []);
    ex.unshift(...shp.map(j => ({ ...j, dir: /I$/.test(j.division) ? 'Import' : 'Export', mode: /^A/.test(j.division) ? 'AIR' : 'SEA' })));
    const billed = new Map();
    for (const r of await q("SELECT invoiceNo, jobNo, dockets, linesJson FROM AccSalesInvoices WHERE coalesce(status, '') <> 'Void' AND kind <> 'creditnote'")) {
      const js = new Set([r.jobNo, ...(r.dockets ? JSON.parse(r.dockets) : []), ...JSON.parse(r.linesJson || '[]').map(l => l.jobNo)].filter(Boolean).map(j => String(j).toUpperCase()));
      for (const j of js) billed.set(j, [...(billed.get(j) || []), r.invoiceNo]);
    }
    res.json([...ex, ...im].filter(j => j.jobNo).map(j => ({ ...j, jobDate: j.jobDate ? String(j.jobDate).slice(0, 10) : '', billedOn: billed.get(String(j.jobNo).toUpperCase()) || [] }))
      .sort((a, b) => String(b.jobDate).localeCompare(String(a.jobDate))));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================================================================== Bulk Invoice as iCAFFE does it (05-Nov-2026)
// iCAFFE: tick Bulk Invoice -> party must be chosen -> popup "Bulk invoice" (From / To date, Search) lists the dockets whose
// shipper / importer is this party (SearchDocketList) -> tick dockets (select all) -> Ok pulls each docket's cost sheet into
// the charge grid, docket-wise (FetchCostSheetNew); a charge already in the grid for that docket is not added twice.
const dmy = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : String(v || '').slice(0, 10); };
router.get('/bulk-dockets', async (req, res) => {
  try {
    await ensure();
    const party = String(req.query.party || '').trim(); const pid = Number(req.query.partyId) || null; const from = dmy(req.query.from), to = dmy(req.query.to);
    if (!party || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw bad('Please fill in all required fields: Party, From Date, and To Date.');
    const P = party.toUpperCase();
    const shp = await q(`SELECT id shipmentId, docketNo, docketDate, division, mainParty party, mawbNo, hawbNo FROM Shipments WHERE coalesce(stage, '') <> 'Cancelled' AND date(docketDate) BETWEEN date(?) AND date(?)
      AND (upper(trim(mainParty)) = ?${pid ? ' OR mainPartyId = ?' : ''}) ORDER BY docketDate, docketNo`, [from, to, P, ...(pid ? [pid] : [])]).catch(() => []);
    const ex = await q(`SELECT id shipmentId, jobNo docketNo, jobDate docketDate, shipmentMode mode, shipperName party, mawbNo, hawbNo FROM ExportJobs WHERE date(jobDate) BETWEEN date(?) AND date(?) AND upper(trim(shipperName)) = ? ORDER BY jobDate, jobNo`, [from, to, P]).catch(() => []);
    const im = await q(`SELECT id shipmentId, jobNo docketNo, jobDate docketDate, shipmentMode mode, nameOfImporter party, coalesce(mawbNo, mawbblNo) mawbNo, coalesce(hawbNo, hawbhblNo) hawbNo FROM ImportJobs WHERE date(jobDate) BETWEEN date(?) AND date(?) AND upper(trim(nameOfImporter)) = ? ORDER BY jobDate, jobNo`, [from, to, P]).catch(() => []);
    // a customs job that has its own freight docket is listed once, as the docket
    const linked = new Set((await q("SELECT upper(ediJobNo) j FROM Shipments WHERE coalesce(ediJobNo, '') <> ''").catch(() => [])).map(r => r.j));
    const rows = [...shp.map(r => ({ ...r, dir: /I$/.test(r.division) ? 'Import' : 'Export', mode: /^A/.test(r.division) ? 'Air' : 'Sea', src: 'Docket' })),
      ...ex.filter(r => !linked.has(String(r.docketNo).toUpperCase())).map(r => ({ ...r, dir: 'Export', src: 'Customs job' })),
      ...im.filter(r => !linked.has(String(r.docketNo).toUpperCase())).map(r => ({ ...r, dir: 'Import', src: 'Customs job' }))].filter(r => r.docketNo);
    const sheets = new Set((await q('SELECT upper(jobNo) j FROM AccProvisionalSheets').catch(() => [])).map(r => r.j));
    const billed = new Map();
    for (const r of await q("SELECT invoiceNo, jobNo, dockets, linesJson FROM AccSalesInvoices WHERE coalesce(status, '') <> 'Void' AND kind <> 'creditnote'")) {
      const js = new Set([r.jobNo, ...(r.dockets ? JSON.parse(r.dockets) : []), ...JSON.parse(r.linesJson || '[]').map(l => l.jobNo)].filter(Boolean).map(j => String(j).toUpperCase()));
      for (const j of js) billed.set(j, [...(billed.get(j) || []), r.invoiceNo]); }
    res.json(rows.map(r => ({ ...r, docketDate: String(r.docketDate || '').slice(0, 10), costSheet: sheets.has(String(r.docketNo).toUpperCase()), billedOn: billed.get(String(r.docketNo).toUpperCase()) || [] })));
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// the cost sheet of each ticked docket (the saved Provisional Cost Sheet - sell side), in the order ticked
router.post('/bulk-cost', async (req, res) => {
  try {
    await ensure();
    const ds = (Array.isArray((req.body || {}).dockets) ? req.body.dockets : []).map(d => String(d || '').trim().toUpperCase()).filter(Boolean);
    if (!ds.length) throw bad('No docket records selected.');
    const cm = new Map((await q('SELECT chargeName, sacCode, gstRate FROM AccGstCharges').catch(() => [])).map(c => [String(c.chargeName).toUpperCase(), c]));
    const out = [];
    for (const d of ds) {
      const sh = (await q('SELECT linesJson FROM AccProvisionalSheets WHERE upper(jobNo) = ?', [d]))[0];
      const lines = (sh ? JSON.parse(sh.linesJson || '[]') : []).filter(l => num(l.sellRate) !== 0).map(l => { const c = cm.get(String(l.charge).toUpperCase()) || {};
        return { jobNo: d, charge: String(l.charge).toUpperCase(), sac: l.sac || c.sacCode || '', gstRate: l.gstRate != null && l.gstRate !== '' ? num(l.gstRate) : c.gstRate != null ? num(c.gstRate) : 18,
          currency: l.currency || 'INR', exRate: num(l.exRate) || 1, qty: num(l.qty) || 1, rate: num(l.sellRate), unit: l.basis || '' }; });
      out.push({ docketNo: d, hasSheet: !!sh, lines });
    }
    res.json(out);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// iCAFFE warns "<kind> Invoice already generated for this party and docket no." when the docket is entered
router.get('/exists', async (req, res) => {
  try {
    await ensure();
    const kind = String(req.query.kind || ''); const party = String(req.query.party || '').trim().toUpperCase(); const jobNo = String(req.query.jobNo || '').trim().toUpperCase(); const not = Number(req.query.not) || 0;
    if (!kind || !party || !jobNo) return res.json([]);
    const rows = await q(`SELECT id, invoiceNo, date, jobNo, dockets FROM AccSalesInvoices WHERE kind = ? AND coalesce(status, '') <> 'Void' AND upper(trim(partyName)) = ? AND id <> ?
      AND (upper(jobNo) = ? OR dockets LIKE ? OR linesJson LIKE ?)`, [kind, party, not, jobNo, '%"' + jobNo + '"%', '%"jobNo":"' + jobNo + '"%']);
    res.json(rows.map(r => ({ id: r.id, invoiceNo: r.invoiceNo, date: r.date })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================================================================== Provisional Sheet (iCAFFE "Provisional Sheet" / cost sheet of a docket)
// What the docket should be billed: the saved sheet if there is one, else a proposal from the quotation of the job, the
// charge rules for its mode, and the costs already booked on it - each with what has been billed so far.
async function jobOf(no) {
  const sh = (await q(`SELECT docketNo jobNo, docketDate jobDate, grossWeight, pkgs totalPackages, division, mainParty party FROM Shipments WHERE upper(trim(docketNo)) = upper(?) LIMIT 1`, [no]).catch(() => []))[0];
  if (sh) return { ...sh, mode: /^A/.test(sh.division) ? 'AIR' : 'SEA', dir: /I$/.test(sh.division) ? 'Import' : 'Export' };
  const ex = (await q(`SELECT jobNo, jobDate, grossWeight, totalPackages, shipmentMode mode, shipperName party, 'Export' dir FROM ExportJobs WHERE upper(trim(jobNo)) = upper(?) LIMIT 1`, [no]).catch(() => []))[0];
  if (ex) return ex;
  return (await q(`SELECT jobNo, jobDate, shipmentMode mode, nameOfImporter party, 'Import' dir FROM ImportJobs WHERE upper(trim(jobNo)) = upper(?) LIMIT 1`, [no]).catch(() => []))[0] || null;
}
async function billedOn(jobNo) {
  const m = new Map();
  for (const r of await q("SELECT kind, jobNo, linesJson FROM AccSalesInvoices WHERE coalesce(status, '') <> 'Void' AND (upper(jobNo) = upper(?) OR linesJson LIKE ?)", [jobNo, '%' + jobNo + '%'])) {
    for (const l of JSON.parse(r.linesJson || '[]')) { if (String(l.jobNo || r.jobNo || '').toUpperCase() !== String(jobNo).toUpperCase()) continue; const k = String(l.charge).toUpperCase(); m.set(k, r2((m.get(k) || 0) + (r.kind === 'creditnote' ? -1 : 1) * num(l.inrAmount))); }
  }
  return m;
}
router.get('/provisional', async (req, res) => {
  try {
    await ensure();
    const jobNo = String(req.query.jobNo || '').trim().toUpperCase(); if (!jobNo) throw bad('Docket no is required');
    const job = await jobOf(jobNo);
    const saved = (await q('SELECT * FROM AccProvisionalSheets WHERE upper(jobNo) = ?', [jobNo]))[0] || null;
    const billed = await billedOn(jobNo);
    // costs booked on the docket, by charge. 08-Nov-2026: by the Accounts GST charge - the receipted charge named on the
    // purchase line ("Rec <charge> SAC ..."), else the GST charge whose expense ledger it is; receipted ones are marked
    const costs = new Map(); const receipted = new Set();
    const byExpLedger = new Map(); for (const c of await q('SELECT chargeName, expenseLedgerId FROM AccGstCharges WHERE expenseLedgerId IS NOT NULL AND coalesce(isActive, 1) = 1 ORDER BY id').catch(() => [])) if (!byExpLedger.has(c.expenseLedgerId)) byExpLedger.set(c.expenseLedgerId, String(c.chargeName).toUpperCase());
    for (const r of await q(`SELECT d.amount, d.dc, d.remarks, l.id ledgerId, l.name ledger, g.nature FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
        JOIN AccountLedgers l ON l.id = d.ledgerId LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE upper(trim(v.jobNo)) = ? AND coalesce(v.status, '') <> 'Rejected' AND t.baseType IN ('Purchase', 'Payment', 'Journal', 'Debit Note')`, [jobNo])) {
      if (r.nature !== 'Expenses') continue; const c = String(r.remarks || '').match(/^Rec\s+(.+?)\s+SAC/i); const k = (c ? c[1] : (byExpLedger.get(r.ledgerId) || r.ledger)).toUpperCase().trim();
      if (c) receipted.add(k);
      costs.set(k, r2((costs.get(k) || 0) + (r.dc === 'Dr' ? 1 : -1) * num(r.amount)));
    }
    let lines; let source; let contract = null; let notes = [];
    // 08-Nov-2026: the customer's contract (Customer Contract & Quotation Master) - shown even on a saved sheet
    let cb = null; try { cb = await require('./contractBilling')(q, jobNo, costs); } catch (e) { notes.push('Contract rates could not be read: ' + e.message); }
    if (cb) { contract = cb.contract; notes = notes.concat(cb.notes || []); }
    if (saved) { lines = JSON.parse(saved.linesJson || '[]'); source = 'saved'; }
    else {
      lines = []; source = 'proposed';
      if (cb && cb.lines) lines.push(...cb.lines);
      // the Sales CRM quotation of the job (by the docket's Quotation no. or the job no.)
      const qn = ((await q('SELECT quotationNo FROM Shipments WHERE upper(trim(docketNo)) = ? LIMIT 1', [jobNo]).catch(() => []))[0] || {}).quotationNo || '';
      const qt = (await q('SELECT id, quoteNo FROM Quotations WHERE upper(trim(jobNo)) = ? OR (? <> \'\' AND upper(trim(quoteNo)) = ?) ORDER BY id DESC LIMIT 1', [jobNo, String(qn).trim().toUpperCase(), String(qn).trim().toUpperCase()]).catch(() => []))[0];
      if (qt) for (const c of await q('SELECT * FROM QuotationCharges WHERE quotationId = ? ORDER BY sortOrder, id', [qt.id]).catch(() => [])) {
        if (lines.some(l => l.charge === String(c.head).toUpperCase())) continue;
        // 14-Nov-2026 (Sales quotations): a line can carry a minimum or a % basis - the quoted amount is what is billed, so
        // the rate is that amount over the quantity
        const qy = num(c.qty) || 1; const eff = (amt, rate) => (num(amt) > 0 ? Math.round(num(amt) / qy * 10000) / 10000 : num(rate));
        lines.push({ charge: String(c.head).toUpperCase(), currency: c.currency || 'INR', exRate: num(c.roe) || 1, qty: qy, buyRate: eff(c.buyAmount, c.buyRate), sellRate: eff(c.sellAmount, c.sellRate), basis: c.basis || '', from: 'Quotation ' + qt.quoteNo });
      }
      const mode = job ? (/sea/i.test(job.mode || '') ? 'SEA ' : 'AIR ') + String(job.dir).toUpperCase() : '';
      // the general charge rules only when the customer has no contract
      for (const r of contract ? [] : await q("SELECT chargeName, basis, rate, minAmount, currency, mode FROM AccChargeRules WHERE coalesce(isActive, 1) = 1").catch(() => [])) {
        const rm = String(r.mode || 'ALL').toUpperCase(); if (rm !== 'ALL' && rm !== mode && !(rm === 'CUSTOMS' && /customs|clearance/i.test(r.chargeName))) continue;
        if (lines.some(l => l.charge === String(r.chargeName).toUpperCase())) continue;
        const qty = /KG/i.test(r.basis || '') ? num(job && job.grossWeight) || 1 : 1;
        const sell = Math.max(num(r.rate) * qty, num(r.minAmount)) / qty;
        lines.push({ charge: String(r.chargeName).toUpperCase(), currency: r.currency || 'INR', exRate: 1, qty, buyRate: 0, sellRate: r2(sell), basis: r.basis || '', from: 'Charge rule' });
      }
      // receipted charges at the cost booked; other costs too, but unticked when a contract sets the rates
      for (const [k, v] of costs) if (!lines.some(l => l.charge === k)) lines.push({ charge: k, currency: 'INR', exRate: 1, qty: 1, buyRate: v, sellRate: v, basis: receipted.has(k) ? 'At actual cost' : '',
        from: receipted.has(k) ? 'Receipted - at cost' : 'Cost booked', receipted: receipted.has(k), optional: !!contract && !receipted.has(k), note: contract && !receipted.has(k) ? 'cost booked - not in the contract' : '' });
    }
    // SAC / GST from the charge master
    const cm = new Map((await q('SELECT chargeName, sacCode, gstRate FROM AccGstCharges').catch(() => [])).map(c => [String(c.chargeName).toUpperCase(), c]));
    lines = lines.map(l => { const c = cm.get(l.charge) || {}; const sell = r2(num(l.sellRate) * (num(l.qty) || 1) * (num(l.exRate) || 1));
      return { sac: c.sacCode || '', gstRate: c.gstRate != null ? num(c.gstRate) : 18, ...l, sellInr: sell, buyInr: r2(num(l.buyRate) * (num(l.qty) || 1) * (num(l.exRate) || 1)), actualCost: costs.get(l.charge) || 0, billed: billed.get(l.charge) || 0, toBill: r2(sell - (billed.get(l.charge) || 0)), notGst: !cm.has(String(l.charge || '').toUpperCase()) }; });
    for (const [k, v] of billed) if (!lines.some(l => l.charge === k)) lines.push({ charge: k, currency: 'INR', exRate: 1, qty: 1, buyRate: 0, sellRate: 0, sellInr: 0, buyInr: 0, actualCost: costs.get(k) || 0, billed: v, toBill: r2(-v), from: 'Billed, not on the sheet' });
    res.json({ jobNo, job, source, contract, notes, savedBy: saved ? saved.modifiedBy || saved.createdBy : '', savedAt: saved ? saved.updatedAt : '', remarks: saved ? saved.remarks : '', lines,
      totals: { buy: r2(lines.reduce((s, l) => s + l.buyInr, 0)), sell: r2(lines.reduce((s, l) => s + l.sellInr, 0)), cost: r2([...costs.values()].reduce((s, v) => s + v, 0)), billed: r2([...billed.values()].reduce((s, v) => s + v, 0)) } });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.put('/provisional', async (req, res) => {
  try {
    await ensure();
    const b = req.body || {}; const jobNo = String(b.jobNo || '').trim().toUpperCase(); if (!jobNo) throw bad('Docket no is required');
    const lines = (Array.isArray(b.lines) ? b.lines : []).filter(l => String(l.charge || '').trim()).map(l => ({ charge: String(l.charge).trim().toUpperCase(), sac: l.sac || '', gstRate: num(l.gstRate),
      currency: l.currency || 'INR', exRate: num(l.exRate) || 1, qty: num(l.qty) || 1, buyRate: num(l.buyRate), sellRate: num(l.sellRate), basis: l.basis || '', from: l.from || '' }));
    const s = new Date().toISOString(); const by = userOf(req);
    const ex = (await q('SELECT id FROM AccProvisionalSheets WHERE upper(jobNo) = ?', [jobNo]))[0];
    if (ex) await x('UPDATE AccProvisionalSheets SET linesJson = ?, remarks = ?, partyName = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?', [JSON.stringify(lines), b.remarks || null, b.partyName || null, by || null, s, ex.id]);
    else await x('INSERT INTO AccProvisionalSheets (jobNo, partyName, linesJson, remarks, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', [jobNo, b.partyName || null, JSON.stringify(lines), b.remarks || null, by || null, s, s]);
    res.json({ ok: true, lines: lines.length });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ================================================================== Send Mail / WhatsApp
const addLog = async (id, entry) => {
  const r = (await q('SELECT mailLog FROM AccSalesInvoices WHERE id = ?', [id]))[0]; const log = r && r.mailLog ? JSON.parse(r.mailLog) : [];
  log.push({ ...entry, at: new Date().toISOString() });
  await x('UPDATE AccSalesInvoices SET mailLog = ? WHERE id = ?', [JSON.stringify(log.slice(-30)), id]);
};
let pdfBrowser = null;
// 09-Nov-2026: Playwright's own Chromium is often not downloaded on this PC ("Executable doesn't exist ... npx playwright
// install"). Then the browser already on Windows is used: Microsoft Edge, else Google Chrome. The first one that starts is kept.
async function launchPdfBrowser() {
  const { chromium } = require('playwright');
  const tries = [{ headless: true }, { headless: true, channel: 'msedge' }, { headless: true, channel: 'chrome' }];
  const errs = [];
  for (const o of tries) {
    try { return await chromium.launch(o); } catch (e) { errs.push((o.channel || 'playwright chromium') + ': ' + String(e.message || e).split('\n')[0].slice(0, 160)); }
  }
  throw new Error('No browser could be started to make the PDF (' + errs.join(' | ') + '). Install Microsoft Edge or Google Chrome, or run "npx playwright install chromium" in node-backend.');
}
async function htmlToPdf(html) {
  if (!pdfBrowser) { pdfBrowser = await launchPdfBrowser(); pdfBrowser.on('disconnected', () => { pdfBrowser = null; }); }
  const page = await pdfBrowser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' }); await page.emulateMedia({ media: 'print' });
    const opt = { format: 'A4', printBackground: true, preferCSSPageSize: true };
    // 08-Nov-2026: a bulk invoice asks for "Bill No / Bill Date / Page x / y" at the foot of every page
    const m = /<meta name="pdf-footer" content="([^"]*)">/.exec(html);
    if (m) {
      await page.addStyleTag({ content: '.pf { display: none !important }' });
      Object.assign(opt, { displayHeaderFooter: true, headerTemplate: '<div></div>',
        footerTemplate: '<div style="font-size:8px;font-family:Verdana,Arial;width:100%;padding:0 8mm;display:flex;justify-content:space-between;font-weight:700"><span>' + m[1] + '</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
    }
    return await page.pdf(opt);
  }
  finally { await page.close().catch(() => {}); }
}
// 08-Nov-2026: the invoice as a PDF (same HTML as Print) - the Outstanding screen opens a bill as a PDF
router.post('/:id/pdf', async (req, res) => {
  try {
    await ensure();
    const inv = (await q('SELECT id, invoiceNo FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0]; if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    const b = req.body || {}; if (!b.html) throw bad('Invoice print is missing');
    const pdf = await htmlToPdf(b.html);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="' + String(inv.invoiceNo).replace(/[\/\\"]+/g, '-') + '.pdf"');
    res.send(pdf);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// the party's e-mail / mobile for Mail and WhatsApp (invoice, then its ledger, then the party master)
router.get('/:id/contact', async (req, res) => {
  try {
    await ensure();
    const r = (await q('SELECT i.email ie, l.email le, l.phone lp, l.partyId FROM AccSalesInvoices i LEFT JOIN AccountLedgers l ON l.id = i.ledgerId WHERE i.id = ?', [req.params.id]))[0] || {};
    let pe = '', pp = '';
    if (r.partyId) { const b = (await q('SELECT email1, phone, mobile FROM PartyBranches WHERE partyId = ? ORDER BY isDefault DESC, id LIMIT 1', [r.partyId]).catch(() => []))[0] || {}; pe = b.email1 || ''; pp = b.mobile || b.phone || ''; }
    res.json({ email: r.ie || r.le || pe || '', phone: r.lp || pp || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// the screen sends the printed invoice (same HTML as Print); it goes as a PDF attachment
router.post('/:id/mail', async (req, res) => {
  try {
    await ensure();
    const inv = (await q('SELECT id, invoiceNo, partyName, total, status FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0]; if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    const b = req.body || {}; const to = String(b.to || '').split(/[;,\s]+/).filter(Boolean);
    if (!to.length || to.some(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) throw bad('Give a valid e-mail address (To)');
    if (!b.html) throw bad('Invoice print is missing');
    const pdf = await htmlToPdf(b.html);
    const { sendMail } = require('../utils/mailer');
    await sendMail({ to: to.join(', '), cc: b.cc || undefined, subject: b.subject || ('Invoice ' + inv.invoiceNo), text: b.body || '', html: b.body ? String(b.body).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>') : undefined,
      attachments: [{ filename: String(inv.invoiceNo).replace(/[\/\\]+/g, '-') + '.pdf', content: pdf, contentType: 'application/pdf' }] });
    await addLog(inv.id, { type: 'mail', to: to.join(', '), by: userOf(req) });
    res.json({ ok: true, to: to.join(', ') });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.post('/:id/whatsapp', async (req, res) => {
  try {
    await ensure();
    const inv = (await q('SELECT id, invoiceNo FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0]; if (!inv) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    const b = req.body || {}; if (!String(b.to || '').trim()) throw bad('Give the mobile number'); if (!String(b.message || '').trim()) throw bad('Message is empty');
    let via, out, pdfSent = false;
    const web = require('../utils/WhatsappWebService');
    const st = (web.getState && web.getState()) || {};
    const webOn = /connected/i.test(st.status || st.state || '') && !/dis/i.test(st.status || st.state || '');
    // 08-Nov-2026: with the invoice print (html) the PDF goes as a document, the message as its caption
    if (b.html) {
      const pdf = await htmlToPdf(b.html); const fname = String(inv.invoiceNo).replace(/[\/\\]+/g, '-') + '.pdf';
      if (webOn) { out = await web.sendDocument(b.to, pdf, fname, b.message); via = 'WhatsApp Web'; }
      else { out = await require('../utils/WhatsappService').sendDocument(b.to, pdf, fname, b.message); via = 'WhatsApp API'; }
      pdfSent = true;
    } else if (webOn) { out = await web.sendMessage(b.to, b.message); via = 'WhatsApp Web'; }
    else { out = await require('../utils/WhatsappService').sendWhatsapp(b.to, b.message); via = 'WhatsApp API'; }
    await addLog(inv.id, { type: 'whatsapp', to: b.to, via, pdf: pdfSent, by: userOf(req) });
    res.json({ ok: true, via, pdf: pdfSent, out });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// ================================================================== e-Invoice (IRP schema 1.1)
// JSON for the IRP (one invoice, or many for the bulk upload tool); after upload the IRN, Ack No / Date and the
// signed QR are recorded here and printed on the invoice. Reimbursable and B2C bills are not e-invoices.
const ddmmyyyy = (d) => { const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };
const clip = (v, n) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
const supTyp = (r) => (r.sez ? (/without/i.test(r.paymentOption || '') ? 'SEZWOP' : 'SEZWP') : r.pos === '97' ? (/without/i.test(r.paymentOption || '') ? 'EXPWOP' : 'EXPWP') : 'B2B');
async function eInvoiceJson(r, our) {
  if (r.kind === 'reimbursable') throw bad(r.invoiceNo + ': a reimbursement bill is not an e-invoice');
  if (r.status === 'Void') throw bad(r.invoiceNo + ' is void');
  const st = supTyp(r);
  if (st === 'B2B' && !r.gstin) throw bad(r.invoiceNo + ': party has no GSTIN - B2C bills are not e-invoices');
  if (!our.gstin) throw bad('Our GSTIN is not set (Company Profile)');
  const lines = JSON.parse(r.linesJson || '[]');
  const pin = (s) => { const m = String(s || '').match(/\b(\d{6})\b/); return m ? Number(m[1]) : 999999; };
  const buyerSt = st.startsWith('EXP') ? '96' : String(r.gstin || '').slice(0, 2) || r.stateCode || r.pos;
  const j = {
    Version: '1.1',
    TranDtls: { TaxSch: 'GST', SupTyp: st, RegRev: num(r.rcm) ? 'Y' : 'N', IgstOnIntra: 'N' },
    DocDtls: { Typ: r.kind === 'creditnote' ? 'CRN' : r.kind === 'debitnote' ? 'DBN' : 'INV', No: clip(r.invoiceNo, 16), Dt: ddmmyyyy(r.date) },
    SellerDtls: { Gstin: our.gstin, LglNm: clip(our.legalName, 100), Addr1: clip(our.addr1 || our.legalName, 100), ...(our.addr2 ? { Addr2: clip(our.addr2, 100) } : {}), Loc: clip(our.city || our.name, 50), Pin: Number(our.pin) || pin(our.addr1 + ' ' + our.addr2), Stcd: our.code,
      ...(our.phone ? { Ph: clip(String(our.phone).replace(/\D/g, ''), 12) } : {}), ...(our.email ? { Em: clip(our.email, 100) } : {}) },
    BuyerDtls: { Gstin: st.startsWith('EXP') ? 'URP' : r.gstin, LglNm: clip(r.partyName, 100), Pos: st.startsWith('EXP') ? '96' : String(r.pos), Addr1: clip(r.address || r.partyName, 100), Loc: clip(r.stateName || r.countryCode || 'NA', 50),
      ...(st.startsWith('EXP') ? {} : { Pin: pin(r.address) }), Stcd: buyerSt },
    ItemList: lines.map((l, i) => { const ass = r2(l.inrAmount); return { SlNo: String(i + 1), PrdDesc: clip(l.charge + (l.narration ? ' - ' + l.narration : ''), 300), IsServc: 'Y', HsnCd: String(l.sac || '9967').replace(/\D/g, '') || '9967',
      Qty: num(l.qty) || 1, Unit: 'OTH', UnitPrice: r2(num(l.rate) * (num(l.exRate) || 1)), TotAmt: r2(ass + num(l.discount) * (num(l.exRate) || 1)), Discount: r2(num(l.discount) * (num(l.exRate) || 1)), AssAmt: ass,
      GstRt: num(l.gstRate) && (num(l.igstPct) || num(l.cgstPct)) ? num(l.gstRate) : (st.endsWith('WOP') ? num(l.gstRate) : 0), IgstAmt: r2(l.igst), CgstAmt: r2(l.cgst), SgstAmt: r2(l.sgst), TotItemVal: r2(ass + num(l.igst) + num(l.cgst) + num(l.sgst)) }; }),
    ValDtls: { AssVal: r2(r.grossInr), CgstVal: r2(r.cgst), SgstVal: r2(r.sgst), IgstVal: r2(r.igst), RndOffAmt: r2(r.roundOffAmt), TotInvVal: r2(r.total), ...(r.currency && r.currency !== 'INR' && r.totalFcy ? { TotInvValFc: r2(r.totalFcy) } : {}) },
  };
  if (st.startsWith('EXP')) j.ExpDtls = { CntCode: clip(r.countryCode || 'US', 2).toUpperCase(), ForCur: r.currency && r.currency !== 'INR' ? r.currency : 'INR' };
  if (r.prevInvoiceNo) j.RefDtls = { PrecDocDtls: [{ InvNo: clip(r.prevInvoiceNo, 16), InvDt: ddmmyyyy(r.prevInvoiceDate || r.date) }] };
  return j;
}
router.get('/einvoice', async (req, res) => {
  try {
    await ensure(); const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean); if (!ids.length) throw bad('Choose the invoices');
    const our = await ourGst(); const out = []; const skipped = [];
    for (const r of await q(`SELECT * FROM AccSalesInvoices WHERE id IN (${ids.join(',')}) ORDER BY date, id`)) {
      if (r.irn && r.irnStatus !== 'Cancelled') { skipped.push(r.invoiceNo + ': IRN already generated'); continue; }
      try { out.push(await eInvoiceJson(r, our)); } catch (e) { skipped.push(e.message); }
    }
    res.json({ json: out, skipped });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.post('/:id/irn', async (req, res) => {
  try {
    await ensure(); const b = req.body || {};
    const r = (await q('SELECT id, status, createdBy FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0]; if (!r) throw Object.assign(new Error('Invoice not found'), { status: 404 });
    if (r.status === 'Void') throw bad('The invoice is void');
    if (fromIcaffe(r)) throw bad('This bill was loaded from iCAFFE - its e-invoice (IRN) is with iCAFFE');
    const irn = String(b.irn || '').trim().toLowerCase(); if (!/^[0-9a-f]{64}$/.test(irn)) throw bad('IRN should be the 64-character code from the IRP');
    const ack = String(b.ackNo || '').trim(); if (!/^\d{10,20}$/.test(ack)) throw bad('Ack No should be the number from the IRP');
    await x("UPDATE AccSalesInvoices SET irn = ?, ackNo = ?, ackDate = ?, signedQr = ?, irnStatus = 'Generated', irnCancelReason = NULL, modifiedBy = ?, updatedAt = ? WHERE id = ?",
      [irn, ack, b.ackDate || today(), String(b.signedQr || '').trim() || null, userOf(req) || null, new Date().toISOString(), r.id]);
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.post('/:id/irn-cancel', async (req, res) => {
  try {
    await ensure(); const reason = String((req.body || {}).reason || '').trim(); if (!reason) throw bad('Give the reason');
    const r = (await q('SELECT id, irn, ackDate, irnStatus, createdBy FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0]; if (!r || !r.irn) throw bad('No IRN on this invoice');
    if (fromIcaffe(r)) throw bad('This bill was loaded from iCAFFE - cancel its IRN in iCAFFE / on the IRP portal');
    if (r.irnStatus === 'Cancelled') throw bad('The IRN is already cancelled');
    const code = ['1', '2', '3', '4'].includes(String((req.body || {}).code)) ? String(req.body.code) : '2';
    let note = 'Marked cancelled here - cancel it on the IRP too (allowed within 24 hours of generation)';
    if ((req.body || {}).viaApi) {
      const out = await irpCall('/eicore/v1.03/Invoice/Cancel', { body: { Irn: r.irn, CnlRsn: code, CnlRem: reason.slice(0, 100) } });
      if (!out.ok) throw bad('IRP did not cancel it: ' + out.error);
      note = 'IRN cancelled on the IRP' + (out.data && out.data.CancelDate ? ' at ' + out.data.CancelDate : '');
    }
    await x("UPDATE AccSalesInvoices SET irnStatus = 'Cancelled', irnCancelReason = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?", [['', 'Duplicate', 'Data entry mistake', 'Order cancelled', 'Others'][Number(code)] + ' - ' + reason, userOf(req) || null, new Date().toISOString(), r.id]);
    res.json({ ok: true, note });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// QR for the print: the signed QR from the IRP when there is one
// 08-Nov-2026: what the invoice print needs besides the invoice itself, laid out as on iCAFFE's tax invoice:
// company head (name, address, CIN, GSTIN, PAN, logo, bank, registered office, notes), the billing branch, the party's
// address / state / PAN, the SAC and GST rate of each charge (for bills loaded from iCAFFE, whose lines carry neither) and the
// shipment details of every docket on the bill (Shipment Registration, else the docket details read from iCAFFE).
const GST_STATES = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam',
  '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat', '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory' };
// the head as on the iCAFFE invoice - used where Company Profile (Settings) is still empty
const HEAD_DEFAULT = {
  name: 'COMMITTED CARGO CARE LIMITED', address1: 'A-406, Road No. 4, Street No. 8, Mahipalpur Extn.', address2: 'New Delhi - 110037, India',
  phone: '011-46151111', fax: '011-46040343', email: 'accts6@committedcargo.com', cin: 'U63090DL1998PLC096746', gstin: '07AAACC6689E1ZJ', pan: 'AAACC6689E',
  bank: { name: 'Committed Cargo Care Limited', bankName: 'Kotak Mahindra Bank', accountNo: '2647171181', ifsc: 'KKBK0004591', branch: 'M-3, Hauz Khas Enclave, Aurobindo Marg, New Delhi - 110016' },
  regOffice: 'A-406, Road No. 4,Street No.8, Mahipalpur Extn. New Delhi - 110037, India Tel : +91 (11) 46151111 Email : contact@committedcargo.com',
  notes: ['This Invoice System Generated Signature No Require.', 'E & O. E.,', 'We reserve the right to charge interest @ 18% p.a. on amount outstanding after the due date.',
    "All Cheques & Demand Drafts should be in favour of 'COMMITTED CARGO CARE LIMITED'", 'Cheques / Drafts are subject to realisation.',
    'Any dispute, discrepany or any supporting documents required must be notified within 7 days, failing which the Invoice will be treated as true and correct.',
    'All disputes are subject to NEW DELHI jurisdiction.']
};
let logoCache = null;
const logoDefault = () => {
  if (logoCache !== null) return logoCache;
  try { const f = require('path').join(__dirname, '..', 'assets', 'company_logo.jpg'); logoCache = 'data:image/jpeg;base64,' + require('fs').readFileSync(f).toString('base64'); } catch (e) { logoCache = ''; }
  return logoCache;
};
const pick = (o, keys) => { for (const k of keys) { const v = o && o[k]; if (v != null && String(v).trim() !== '' && String(v).trim() !== '0') return String(v).trim(); } return ''; };
const pdmy = (v) => { const s = String(v || '').trim(); if (!s) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? m[3] + '/' + m[2] + '/' + m[1] : s; };
// one docket's shipment details in the same shape whatever the source
function docketView(src, kind) {
  if (!src) return null;
  if (kind === 'shipment') {
    const imp = /^(AI|SI)$/.test(String(src.division || '')); let d = {}; try { d = src.dataJson ? JSON.parse(src.dataJson) : {}; } catch (e) { d = {}; }
    const cs = (() => { try { return JSON.parse(src.containersJson || '[]'); } catch (e) { return []; } })();
    return {
      docketNo: src.docketNo, mawbNo: src.mawbNo, mawbDate: pdmy(src.mawbDate), hawbNo: src.hawbNo, hawbDate: pdmy(src.hawbDate), carrier: src.carrier || src.flightVessel, origin: src.originPort,
      destination: src.destinationPort, pkgs: [src.pkgs, src.pkgUnit].filter(Boolean).join(' '), grossWt: src.grossWeight, chargeableWt: src.chargeableWeight, cbm: src.volume,
      // import: the overseas supplier ships to the importer (main party); export: the exporter (main party) ships to the buyer
      consignee: imp ? src.mainParty : src.otherParty, shipper: imp ? src.otherParty : src.mainParty,
      freightTerms: src.freightTerm, shipmentTerms: src.shipmentTerm, goods: src.goodsDesc, partyInvoice: imp ? '' : src.referenceNo,
      sbNo: imp ? (d.beNo || '') : (d.sbNo || ''), sbDate: imp ? pdmy(d.beDate) : pdmy(d.sbDate), isImport: imp, igmNo: src.igmNo, containers: cs.map(c => c.no).filter(Boolean).join(', '), division: src.division };
  }
  return { // docket details read from iCAFFE (InfoAgent.FetchImportDocketByShipmentIdNew and the export / sea equivalents)
    docketNo: pick(src, ['DOCKETNO', 'DocketNo']), mawbNo: pick(src, ['MAWBNO', 'MBLNO', 'MBL_NO']).replace(/^NOMAWB$/i, ''), mawbDate: pick(src, ['IMPMAWBNODATE', 'MAWBDATE', 'MAWB_DATE', 'MBLDATE']),
    hawbNo: pick(src, ['HAWBNO', 'HBLNO', 'HBL_NO']), hawbDate: pick(src, ['IMPHAWBNODATE', 'HAWBDATE', 'HAWB_DATE', 'HBLDATE']), carrier: pick(src, ['AIRLINE_NAME', 'AIRLINENAME', 'AIRLINE', 'CARRIERNAME', 'SHIPPINGLINE', 'VESSELNAME']),
    origin: pick(src, ['ORIGINPORT', 'ORIGIN', 'ORIGINPORTNAME', 'PORTOFLOADING']), destination: pick(src, ['DESTINATION', 'DESTINATIONPORT', 'DESTINATIONPORTNAME', 'PORTOFDISCHARGE']),
    pkgs: pick(src, ['NOOFPKGS', 'NO_OF_PKGS', 'PKGS']), grossWt: pick(src, ['GROSS_WEIGHT', 'GROSSWEIGHT']), chargeableWt: pick(src, ['CHARGEABLE_WEIGHT', 'CHARGEABLEWEIGHT']), cbm: pick(src, ['CBM', 'VOLUME']),
    consignee: pick(src, ['ConsigneeName', 'CONSIGNEENAME', 'CONSIGNEE_NAME']), shipper: pick(src, ['ShipperName', 'SHIPPERNAME', 'SHIPPER_NAME']),
    freightTerms: ({ P: 'PREPAID', C: 'COLLECT' })[pick(src, ['NATURE', 'FREIGHT_NATURE'])] || pick(src, ['FREIGHTTERMS', 'FREIGHT_TERMS']), shipmentTerms: pick(src, ['SHIPMENT_TERMS', 'SHIPMENTTERMS']),
    goods: pick(src, ['GOODSDESCRIPTION', 'GOODS_DESC', 'DESCRIPTION']), partyInvoice: pick(src, ['INVOICENO', 'INVOICE_NO', 'PARTYINVOICENO']), sbNo: pick(src, ['SBNO', 'SB_NO', 'BILLOFENTRY']),
    sbDate: pick(src, ['SBDATE', 'SB_DATE', 'BILLOFENTRYDATE']), division: '' };
}
router.get('/:id/print-data', async (req, res) => {
  try {
    const inv = (await q('SELECT id, branchCode, ledgerId, partyBranchId, gstin, stateCode, address, jobNo, dockets, linesJson, kind FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0];
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    // company head (never the e-invoice user / password columns)
    const cp = (await q('SELECT companyName, legalName, address1, address2, city, state, pincode, country, gstin, pan, cin, phone, email, website, logoDataUrl, lutNo, tagline, fax, registeredOffice, invoiceNotes FROM CompanyProfile ORDER BY id LIMIT 1').catch(() => []))[0] || {};
    const D = HEAD_DEFAULT;
    const head = {
      name: cp.legalName || cp.companyName || D.name,
      address1: cp.address1 || D.address1, address2: [cp.address2, cp.city, cp.country, cp.pincode ? 'PIN-' + cp.pincode : ''].filter(Boolean).join(' ,') || D.address2,
      phone: cp.phone || D.phone, fax: cp.fax || (cp.address1 ? '' : D.fax), email: cp.email || D.email, website: cp.website || '', cin: cp.cin || D.cin, gstin: cp.gstin || D.gstin, pan: cp.pan || D.pan, lutNo: cp.lutNo || '',
      logo: cp.logoDataUrl || logoDefault(), tagline: cp.tagline || '',
      // 08-Nov-2026: the bank block on the invoice is fixed (user's choice) - not taken from Company Settings
      bank: D.bank,
      regOffice: cp.registeredOffice || D.regOffice,
      notes: cp.invoiceNotes ? String(cp.invoiceNotes).split(/\r?\n/).map(t => t.trim()).filter(Boolean) : D.notes
    };
    // billing branch: its GSTIN / address print on the bill when it has them
    const br = (await q('SELECT branchCode, branchName, address, gstin, stateCode, phone, email FROM CompanyBranches WHERE branchCode = ? OR icaffeCode = ? LIMIT 1', [inv.branchCode || '', inv.branchCode || '']).catch(() => []))[0] || null;
    // 08-Nov-2026: the bill's branch (Branch Master) gives the address, GSTIN, e-mail and phone in the head where it has them;
    // the rest comes from Company Settings. The registered office line at the foot stays the company's.
    if (br) {
      const ba = String(br.address || '').replace(/\s+/g, ' ').trim();
      if (ba) { head.address1 = ba; head.address2 = ''; }
      if (br.gstin && String(br.gstin).trim()) head.gstin = String(br.gstin).trim().toUpperCase();
      if (br.email && String(br.email).trim()) head.email = String(br.email).trim();
      if (br.phone && String(br.phone).trim()) { head.phone = String(br.phone).trim(); head.fax = ''; }
    }
    head.stateCode = String(head.gstin || '').slice(0, 2); head.stateName = GST_STATES[head.stateCode] || '';
    head.branchName = br ? br.branchName : '';
    // the party: invoice address, else the party branch, else the ledger (addresses loaded from iCAFFE)
    const led = inv.ledgerId ? (await q('SELECT address, state, pinCode, country, gstin, pan FROM AccountLedgers WHERE id = ?', [inv.ledgerId]).catch(() => []))[0] : null;
    const pb = inv.partyBranchId ? (await q('SELECT address1, address2, city, state, pinCode, country, gstin FROM PartyBranches WHERE id = ?', [inv.partyBranchId]).catch(() => []))[0] : null;
    const gstin = inv.gstin || (pb && pb.gstin) || (led && led.gstin) || '';
    // a party with several GSTINs: the address of the branch with this bill's GSTIN; the ledger's only when it is the same GSTIN
    const pg = !pb && gstin ? (await q('SELECT address1, address2, city, state, pinCode, country FROM PartyBranches WHERE upper(trim(gstin)) = ? OR upper(trim(regNo)) = ? ORDER BY id LIMIT 1', [gstin.toUpperCase(), gstin.toUpperCase()]).catch(() => []))[0] : null;
    const ledOk = led && (!gstin || !led.gstin || String(led.gstin).trim().toUpperCase() === gstin.toUpperCase());
    const sc = String(inv.stateCode || gstin.slice(0, 2) || '').padStart(2, '0');
    const party = {
      address: inv.address || [pb, pg].map(b => (b ? [b.address1, b.address2, b.city, b.pinCode, b.state, b.country].filter(Boolean).join(', ') : '')).find(Boolean)
        || (ledOk ? [led.address, led.pinCode, led.state, led.country === 'IN' ? 'INDIA' : led.country].filter(Boolean).join(', ') : ''),
      gstin, stateCode: /^\d\d$/.test(sc) && sc !== '00' ? sc : '', stateName: GST_STATES[sc] || (pb && pb.state) || (ledOk && led.state) || '',
      pan: (ledOk && led.pan) || (/^\d\d[A-Z]{5}\d{4}[A-Z]/.test(gstin) ? gstin.slice(2, 12) : '')
    };
    // SAC / GST rate of each charge name (iCAFFE bills carry neither on their lines)
    const lines = JSON.parse(inv.linesJson || '[]');
    const names = [...new Set(lines.map(l => String(l.charge || '').trim().toUpperCase()).filter(Boolean))];
    const sac = {};
    if (names.length) {
      const ph = names.map(() => '?').join(',');
      for (const r of await q(`SELECT upper(trim(chargeName)) n, sacCode, gstRate FROM AccGstCharges WHERE upper(trim(chargeName)) IN (${ph}) AND coalesce(sacCode, '') <> ''`, names).catch(() => [])) if (!sac[r.n]) sac[r.n] = { sac: r.sacCode, rate: num(r.gstRate) };
      for (const r of await q(`SELECT upper(trim(chargeName)) n, sacCode, gstRate FROM Charges WHERE upper(trim(chargeName)) IN (${ph}) AND coalesce(sacCode, '') <> ''`, names).catch(() => [])) if (!sac[r.n]) sac[r.n] = { sac: r.sacCode, rate: num(r.gstRate) };
    }
    // shipment details of each docket
    const dks = [...new Set([inv.jobNo, ...(inv.dockets ? JSON.parse(inv.dockets) : []), ...lines.map(l => l.jobNo)].map(d => String(d || '').trim().toUpperCase()).filter(Boolean))];
    const dockets = {};
    if (dks.length) {
      const ph = dks.map(() => '?').join(',');
      for (const s of await q(`SELECT * FROM Shipments WHERE upper(trim(docketNo)) IN (${ph})`, dks).catch(() => [])) dockets[String(s.docketNo).trim().toUpperCase()] = docketView(s, 'shipment');
      const left = dks.filter(d => !dockets[d]);
      if (left.length && (await q("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'IcaffeDockets'")).length) {
        for (const s of await q(`SELECT docketNo, data FROM IcaffeDockets WHERE upper(trim(docketNo)) IN (${left.map(() => '?').join(',')})`, left).catch(() => [])) {
          try { dockets[String(s.docketNo).trim().toUpperCase()] = docketView(JSON.parse(s.data), 'icaffe'); } catch (e) { /* bad row */ }
        }
      }
    }
    res.json({ head, party, sac, dockets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/qr', async (req, res) => {
  try {
    const r = (await q('SELECT signedQr, irn FROM AccSalesInvoices WHERE id = ?', [req.params.id]))[0];
    if (!r || !(r.signedQr || r.irn)) return res.json({ dataUrl: '' });
    res.json({ dataUrl: await require('qrcode').toDataURL(r.signedQr || r.irn, { margin: 1, width: 220 }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ================================================================== Post To GSTN: e-invoice IRP API (NIC e-invoice API 1.03 / 1.04)
// Credentials are entered by the user on E-Invoice Settings and kept in the settings store (AppSetting); the password
// and client secret never come back to the browser. Base URL: the NIC sandbox / production API or a GSP giving the same API.
const EINV_KEYS = ['einv_base_url', 'einv_client_id', 'einv_client_secret', 'einv_username', 'einv_password', 'einv_gstin', 'einv_public_key'];
const EINV_SECRET = new Set(['einv_client_secret', 'einv_password']);
const einvCfg = async () => require('../utils/settingsStore').getMany(EINV_KEYS);
router.get('/einv-settings', async (req, res) => {
  try {
    const c = await einvCfg();
    res.json({ baseUrl: c.einv_base_url || 'https://einv-apisandbox.nic.in', clientId: c.einv_client_id || '', username: c.einv_username || '', gstin: c.einv_gstin || '',
      clientSecretSet: !!c.einv_client_secret, passwordSet: !!c.einv_password, publicKeySet: /BEGIN PUBLIC KEY/.test(c.einv_public_key || ''), ready: !!(c.einv_client_id && c.einv_client_secret && c.einv_username && c.einv_password && c.einv_public_key) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/einv-settings', async (req, res) => {
  try {
    const b = req.body || {}; const map = { baseUrl: 'einv_base_url', clientId: 'einv_client_id', clientSecret: 'einv_client_secret', username: 'einv_username', password: 'einv_password', gstin: 'einv_gstin', publicKey: 'einv_public_key' };
    const out = {};
    for (const [k, key] of Object.entries(map)) {
      if (b[k] === undefined) continue; const v = String(b[k] || '').trim();
      if (EINV_SECRET.has(key) && (!v || v.startsWith('***'))) continue;            // keep the saved secret
      if (key === 'einv_public_key' && !v) continue;
      if (key === 'einv_public_key' && !/-----BEGIN PUBLIC KEY-----/.test(v)) throw bad('Public key: paste the PEM text from NIC (-----BEGIN PUBLIC KEY----- ...)');
      if (key === 'einv_base_url' && v && !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(v)) throw bad('Base URL should start with https://');
      if (key === 'einv_gstin' && v && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(v)) throw bad('GSTIN should be 15 characters');
      out[key] = v;
    }
    await require('../utils/settingsStore').setMany(out); irpSession = null;
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const crypto = require('crypto');
const aes = (key, buf, dec) => { const c = (dec ? crypto.createDecipheriv : crypto.createCipheriv)('aes-256-ecb', key, null); return Buffer.concat([c.update(buf), c.final()]); };
let irpSession = null; // { token, sek, until, cfg }
async function irpCall(path, { method = 'POST', body, auth = true } = {}) {
  const c = await einvCfg();
  if (!(c.einv_client_id && c.einv_client_secret && c.einv_username && c.einv_password && c.einv_public_key)) throw bad('E-Invoice API is not set up - open E-Invoice Settings (client id, secret, user, password, NIC public key)');
  const base = String(c.einv_base_url || 'https://einv-apisandbox.nic.in').replace(/\/+$/, '');
  const gstin = c.einv_gstin || (await ourGst()).gstin;
  const head = { 'Content-Type': 'application/json', client_id: c.einv_client_id, client_secret: c.einv_client_secret, Gstin: gstin };
  const call = async (url, opts) => { const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 45000);
    try { const r = await fetch(url, { ...opts, signal: ctl.signal }); const txt = await r.text(); let j; try { j = JSON.parse(txt); } catch (e) { throw bad('IRP replied ' + r.status + ': ' + txt.slice(0, 200)); } return j; }
    catch (e) { if (e.name === 'AbortError') throw bad('IRP did not reply in 45 seconds'); throw e.status ? e : bad('Could not reach the IRP (' + base + '): ' + e.message); } finally { clearTimeout(tm); } };
  if (!irpSession || irpSession.until < Date.now() + 60000 || irpSession.base !== base) {
    const appKey = crypto.randomBytes(32);
    const pay = Buffer.from(Buffer.from(JSON.stringify({ UserName: c.einv_username, Password: c.einv_password, AppKey: appKey.toString('base64'), ForceRefreshAccessToken: false })).toString('base64'));
    const data = crypto.publicEncrypt({ key: c.einv_public_key, padding: crypto.constants.RSA_PKCS1_PADDING }, pay).toString('base64');
    const j = await call(base + '/eivital/v1.04/auth', { method: 'POST', headers: head, body: JSON.stringify({ Data: data }) });
    if (String(j.Status) !== '1' || !j.Data) throw bad('IRP login failed: ' + irpErr(j));
    irpSession = { base, token: j.Data.AuthToken, sek: aes(appKey, Buffer.from(j.Data.Sek, 'base64'), true), until: j.Data.TokenExpiry ? new Date(String(j.Data.TokenExpiry).replace(' ', 'T') + '+05:30').getTime() : Date.now() + 5 * 3600 * 1000 };
  }
  const h2 = { ...head, user_name: c.einv_username, AuthToken: irpSession.token };
  const opts = { method, headers: h2 }; if (body) opts.body = JSON.stringify({ Data: aes(irpSession.sek, Buffer.from(JSON.stringify(body))).toString('base64') });
  const j = await call(base + path, opts);
  if (String(j.Status) !== '1') return { ok: false, error: irpErr(j), codes: (j.ErrorDetails || []).map(e => String(e.ErrorCode)), info: j.InfoDtls };
  const plain = typeof j.Data === 'string' ? JSON.parse(aes(irpSession.sek, Buffer.from(j.Data, 'base64'), true).toString('utf8')) : j.Data;
  return { ok: true, data: plain };
}
const irpErr = (j) => ((j && j.ErrorDetails) || []).map(e => e.ErrorCode + ': ' + e.ErrorMessage).join('; ') || (j && (j.error || j.message)) || 'no reason given';
async function postOne(r, by) {
  if (fromIcaffe(r)) return { invoiceNo: r.invoiceNo, ok: false, error: 'loaded from iCAFFE - its e-invoice is with iCAFFE' };
  if (r.irn && r.irnStatus !== 'Cancelled') return { invoiceNo: r.invoiceNo, ok: true, irn: r.irn, note: 'already has an IRN' };
  if (r.irn && r.irnStatus === 'Cancelled') return { invoiceNo: r.invoiceNo, ok: false, error: 'its IRN was cancelled - the IRP gives no new IRN to the same number; void it and make a new invoice' };
  const our = await ourGst(); const payload = await eInvoiceJson(r, our);
  let out = await irpCall('/eicore/v1.03/Invoice', { body: payload });
  // 2150 = duplicate IRN: it was generated before (e.g. from the portal) - fetch it
  if (!out.ok && out.codes.includes('2150')) {
    const g = await irpCall(`/eicore/v1.03/Invoice/irnbydocdetails?doctype=${payload.DocDtls.Typ}&docnum=${encodeURIComponent(payload.DocDtls.No)}&docdate=${payload.DocDtls.Dt}`, { method: 'GET' });
    if (g.ok) out = g;
  }
  if (!out.ok) return { invoiceNo: r.invoiceNo, ok: false, error: out.error };
  const d = out.data;
  await x("UPDATE AccSalesInvoices SET irn = ?, ackNo = ?, ackDate = ?, signedQr = ?, irnStatus = 'Generated', irnCancelReason = NULL, modifiedBy = ?, updatedAt = ? WHERE id = ?",
    [d.Irn, String(d.AckNo || ''), String(d.AckDt || today()).slice(0, 10), d.SignedQRCode || null, by || null, new Date().toISOString(), r.id]);
  return { invoiceNo: r.invoiceNo, ok: true, irn: d.Irn, ackNo: d.AckNo };
}
router.post('/post-gstn', async (req, res) => {
  try {
    await ensure(); const ids = (Array.isArray((req.body || {}).ids) ? req.body.ids : []).map(Number).filter(Boolean); if (!ids.length) throw bad('Choose the invoices');
    const results = [];
    for (const r of await q(`SELECT * FROM AccSalesInvoices WHERE id IN (${ids.join(',')}) ORDER BY date, id`)) {
      try { results.push(await postOne(r, userOf(req))); } catch (e) { results.push({ invoiceNo: r.invoiceNo, ok: false, error: e.message }); if (/not set up|login failed|reach the IRP/i.test(e.message)) break; }
    }
    res.json({ results });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// voucher ids that belong to an invoice - the voucher screens send these here instead of editing them directly
router.invoiceVoucherIds = async () => { try { await ensure(); return new Set((await q('SELECT voucherId FROM AccSalesInvoices WHERE voucherId IS NOT NULL')).map(r => Number(r.voucherId))); } catch (e) { return new Set(); } };
router.KINDS = KINDS;
// 05-Nov-2026: tables are made when the backend starts (not only when the screen is first used)
router.htmlToPdf = htmlToPdf; // 14-Nov-2026: Sales quotations make their PDF with the same browser
setTimeout(() => ensure().then(() => console.log('[gst-invoice] tables ready: AccSalesInvoices, AccProvisionalSheets, AccSalesInvoiceDeleted')).catch(e => console.error('[gst-invoice] tables not made:', e.message)), 4000);
module.exports = router;
