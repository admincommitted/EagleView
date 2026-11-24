// Number series as iCAFFE gives them (05-Nov-2026). Settings > Number Series (iCAFFE).
//
// One row per document + branch + division + financial year: the format and the NEXT number. The number is taken
// inside the caller's transaction and the row moves on by one, so two users never get the same number; a number that
// is already in the books is skipped.
//   format tokens: {N} the number (padded to "pad" digits), {YY} the year the FY starts (26), {FY} 2627, {DIV} AE/AI/SE/SI
//   iCAFFE formats (read from iCAFFE, Export Air, New Delhi):
//     Bank voucher   BA/NDL/AE/{N}        Cash voucher  CA/NDL/AE/{N}        Journal  JN/NDL/AE/{N}
//     Service inv.   DL/{YY}/EX/{N} (7)   Other inv.    DL/{YY}/ET/{N} (7)   Docket   NDL/AE/{N}/{YY}
//   Every series starts again at 1 on 1st April (iCAFFE does the same); the new year's row is made from last year's.
// A document whose series is not set is refused, with the place to set it - numbers are never made up.
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');

const q = (sql, p = [], t) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, transaction: t });
const x = (sql, p = [], t) => sequelize.query(sql, { replacements: p, transaction: t });

// what each document is (label shown on the settings screen, and which table its numbers live in)
const DOCS = {
  VCH_BANK: { label: 'Bank voucher (receipt / payment / bank transfer)', table: 'Vouchers', col: 'voucherNumber' },
  VCH_CASH: { label: 'Cash voucher (receipt / payment / cash transfer)', table: 'Vouchers', col: 'voucherNumber' },
  VCH_JOURNAL: { label: 'Journal (journal, trade / non-trade invoice, debit / credit note)', table: 'Vouchers', col: 'voucherNumber' },
  INV_service: { label: 'GST Invoice - Service', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_reimbursable: { label: 'GST Invoice - Reimbursable', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_other: { label: 'GST Invoice - Other', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_debitnote: { label: 'GST Invoice - Debit Note', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_courier: { label: 'GST Invoice - Courier', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_creditnote: { label: 'GST Invoice - Credit Note', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_consultancy: { label: 'GST Invoice - Consultancy', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_can: { label: 'GST Invoice - CAN', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_overseas: { label: 'GST Invoice - OverSeas Agent', table: 'AccSalesInvoices', col: 'invoiceNo' },
  INV_freight: { label: 'GST Invoice - Freight (AE/T...)', table: 'AccSalesInvoices', col: 'invoiceNo' },
  DOCKET: { label: 'Docket (Shipment Registration)', table: 'Shipments', col: 'docketNo' },
  BE_AMEND: { label: 'BE Amendment (Import) - amended job no, goes on from iCAFFE', table: 'BeAmendments', col: 'amendNo' }, // 10-Nov-2026
};
const DIVS = ['AE', 'AI', 'SE', 'SI'];

let ready = null;
const ensure = () => (ready = ready || (async () => {
  await x(`CREATE TABLE IF NOT EXISTS NumberSeries (id INTEGER PRIMARY KEY AUTOINCREMENT, docType TEXT NOT NULL, branchCode TEXT NOT NULL, division TEXT NOT NULL DEFAULT '',
    fyCode TEXT NOT NULL, format TEXT NOT NULL, pad INTEGER DEFAULT 0, nextNo INTEGER NOT NULL DEFAULT 1, lastNo TEXT, lastDate TEXT, source TEXT, isActive TINYINT(1) DEFAULT 1,
    modifiedBy TEXT, createdAt DATETIME, updatedAt DATETIME, UNIQUE (docType, branchCode, division, fyCode))`);
  const vc = new Set((await q('PRAGMA table_info(Vouchers)')).map(c => c.name));
  if (!vc.has('division')) await x('ALTER TABLE Vouchers ADD COLUMN division TEXT');
  const bc = new Set((await q('PRAGMA table_info(CompanyBranches)').catch(() => [])).map(c => c.name));
  if (bc.size && !bc.has('icaffeCode')) await x('ALTER TABLE CompanyBranches ADD COLUMN icaffeCode TEXT');
  if (bc.size && !bc.has('stateCode')) await x('ALTER TABLE CompanyBranches ADD COLUMN stateCode TEXT');
})().catch(e => { ready = null; throw e; }));

const fyStart = (d) => { const s = String(d || new Date().toISOString()).slice(0, 10); const y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)); return m < 4 ? y - 1 : y; };
const fyCodeOf = (d) => { const s = fyStart(d); return String(s).slice(2) + String(s + 1).slice(2); };
// {DIV} = the document's division (a branch-wide series - division '' - serves every division, as iCAFFE's BA / CA / JN do)
const render = (row, n, date, div) => String(row.format)
  .replace(/\{YY\}/g, String(fyStart(date)).slice(2)).replace(/\{FY\}/g, fyCodeOf(date)).replace(/\{DIV\}/g, row.division || div || '')
  .replace(/\{N\}/g, String(n).padStart(Number(row.pad) || 0, '0'));
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const divOf = (v) => { const s = String(v || '').toUpperCase(); if (DIVS.includes(s)) return s; const m = /(?:^|\/|-)(AE|AI|SE|SI)(?:\/|-|$)/.exec(s); return m ? m[1] : ''; };

// the row for this year; a new financial year starts from 1 with last year's format
async function rowFor(docType, branchCode, division, date, t) {
  const dv0 = String(division || '').toUpperCase();
  const r0 = await rowFor1(docType, branchCode, dv0, date, t);
  if (r0 || !dv0) return r0;
  return rowFor1(docType, branchCode, '', date, t); // branch-wide series (all divisions)
}
async function rowFor1(docType, branchCode, division, date, t) {
  await ensure();
  const fy = fyCodeOf(date); const br = String(branchCode || '').toUpperCase(); const dv = String(division || '').toUpperCase();
  let r = (await q('SELECT * FROM NumberSeries WHERE docType = ? AND branchCode = ? AND division = ? AND fyCode = ? AND coalesce(isActive, 1) = 1', [docType, br, dv, fy], t))[0];
  if (r) return r;
  const prev = (await q('SELECT * FROM NumberSeries WHERE docType = ? AND branchCode = ? AND division = ? AND coalesce(isActive, 1) = 1 ORDER BY fyCode DESC LIMIT 1', [docType, br, dv], t))[0];
  if (!prev) return null;
  const s = new Date().toISOString();
  await x('INSERT OR IGNORE INTO NumberSeries (docType, branchCode, division, fyCode, format, pad, nextNo, source, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [docType, br, dv, fy, prev.format, prev.pad, 1, 'new year from ' + prev.fyCode, 1, s, s], t);
  return (await q('SELECT * FROM NumberSeries WHERE docType = ? AND branchCode = ? AND division = ? AND fyCode = ?', [docType, br, dv, fy], t))[0];
}
const where = (docType, br, dv) => DOCS[docType] ? `${DOCS[docType].label} - branch ${br || '?'}${dv ? ', division ' + dv : ''}` : docType;

async function used(docType, no, t) {
  const d = DOCS[docType]; if (!d) return false;
  return !!(await q(`SELECT 1 FROM ${d.table} WHERE ${d.col} = ? LIMIT 1`, [no], t).catch(() => [])).length;
}
// the number the next document will get (nothing is taken)
async function peek(docType, { branchCode, division, date } = {}, t) {
  const r = await rowFor(docType, branchCode, division, date, t); if (!r) return null;
  let n = Number(r.nextNo) || 1; let no = render(r, n, date, division);
  for (let i = 0; i < 2000 && await used(docType, no, t); i++) no = render(r, ++n, date, division);
  return no;
}
// take the number: moves the series on by one (call inside the caller's transaction)
async function take(docType, { branchCode, division, date } = {}, t) {
  const r = await rowFor(docType, branchCode, division, date, t);
  if (!r) throw bad('Number series not set for ' + where(docType, String(branchCode || '').toUpperCase(), String(division || '').toUpperCase()) + ' - set it in Settings > Number Series (iCAFFE)');
  let n = Number(r.nextNo) || 1; let no = render(r, n, date, division);
  for (let i = 0; i < 2000 && await used(docType, no, t); i++) no = render(r, ++n, date, division);
  await x('UPDATE NumberSeries SET nextNo = ?, lastNo = ?, lastDate = ?, updatedAt = ? WHERE id = ?', [n + 1, no, String(date || '').slice(0, 10) || null, new Date().toISOString(), r.id], t);
  return no;
}
// does a series exist for this document (any year)? - lets old code keep working until the series is set
async function has(docType, branchCode, division, t) {
  await ensure();
  return !!(await q("SELECT 1 FROM NumberSeries WHERE docType = ? AND branchCode = ? AND (division = ? OR division = '') AND coalesce(isActive, 1) = 1 LIMIT 1", [docType, String(branchCode || '').toUpperCase(), String(division || '').toUpperCase()], t)).length;
}
// which voucher series a voucher goes to (iCAFFE: bank book BA, cash book CA, everything else JN)
async function voucherDoc(base, ledgerIds, t) {
  if (!['Receipt', 'Payment', 'Contra'].includes(base)) return 'VCH_JOURNAL';
  const ids = (ledgerIds || []).map(Number).filter(Boolean); if (!ids.length) return 'VCH_BANK';
  const rows = await q(`WITH RECURSIVE up(id, parentId, name) AS (SELECT g.id, g.parentId, g.name FROM AccountGroups g JOIN AccountLedgers l ON l.groupId = g.id WHERE l.id IN (${ids.join(',')})
      UNION SELECT g.id, g.parentId, g.name FROM AccountGroups g JOIN up ON g.id = up.parentId) SELECT lower(name) name FROM up`, [], t).catch(() => []);
  const names = rows.map(r => r.name);
  if (names.some(n => /bank/.test(n))) return 'VCH_BANK';
  if (names.some(n => /cash/.test(n))) return 'VCH_CASH';
  return 'VCH_BANK';
}
async function defaultBranch(t) {
  const b = (await q("SELECT branchCode FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, id LIMIT 1", [], t).catch(() => []))[0];
  return b ? b.branchCode : '';
}

module.exports = { DOCS, DIVS, ensure, peek, take, has, render, fyCodeOf, divOf, voucherDoc, defaultBranch };
