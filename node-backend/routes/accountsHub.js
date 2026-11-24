// 04-Nov-2026: Accounts module laid out like iCAFFE (Masters / Vouchers / Purchase / Banking / Closing / Reports).
// This route serves the parts the older accounts screens did not have:
//   /masters/:kind   small accounting masters (SAC, GST charges, charge rules, item master, TDS party, depreciation,
//                    division mapping, cheque books, job closing) - one table each, created on first use
//   /lookups/...     ledgers / groups / TDS natures / cost centres for the forms
//   /summary         figures for the Accounts home page
//   /reports/:name   the iCAFFE account reports, built from Vouchers / VoucherDetails / AccountLedgers / AccountGroups
//   /months          month closing (FinancialPeriods), /merge-ledgers (Merge Account)
const express = require('express');
const router = express.Router();
// 05-Nov-2026: GST Invoice (iCAFFE Operation > GST Invoice) - its own file
const gstInvoice = require('./accountsGstInvoice');
router.use('/gst-invoice', gstInvoice);
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');
const bs = require('../utils/branchScope'); // 06-Nov-2026: top-bar branch / year scope
const lg = require('../utils/ledgerGuard'); // 06-Nov-2026: no entry on, or set off against, another party's ledger
// 14-Nov-2026: the heavy report reads (whole voucher history) run on a second, read-only connection so that other
// users' screens do not wait behind them (utils/readDb)
const rq = require('../utils/readDb').q;

const q = (sql, replacements = [], t) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction: t });
const x = (sql, replacements = [], t) => sequelize.query(sql, { replacements, transaction: t });
const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(num(v) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ masters
const MASTERS = {
  sac: { title: 'SAC Master', table: 'AccSacCodes', fields: [
    ['code', 'SAC Code', 'text', true], ['description', 'Description', 'text', true], ['gstRate', 'GST %', 'number'], ['remarks', 'Remarks', 'text']] },
  gstcharges: { title: 'GST Charges', table: 'AccGstCharges', fields: [
    ['chargeName', 'Charge Name', 'text', true], ['sacCode', 'SAC Code', 'sac'], ['gstRate', 'GST %', 'number'], ['ledgerId', 'Income Ledger', 'ledger'],
    ['expenseLedgerId', 'Expense Ledger', 'ledger'], ['rcm', 'Reverse Charge (RCM)', 'bool'], ['exempt', 'Exempt / Nil', 'bool']] },
  chargerules: { title: 'Charge Rules', table: 'AccChargeRules', fields: [
    ['ruleName', 'Rule Name', 'text', true], ['chargeName', 'Charge', 'text', true],
    ['basis', 'Basis', 'select:PER SHIPMENT,PER KG,PER CBM,PER CONTAINER,PER DOCUMENT,PERCENT OF VALUE'], ['rate', 'Rate', 'number'], ['minAmount', 'Minimum', 'number'],
    ['currency', 'Currency', 'text'], ['mode', 'Mode', 'select:ALL,AIR EXPORT,AIR IMPORT,SEA EXPORT,SEA IMPORT,CUSTOMS'], ['ledgerId', 'Ledger', 'ledger']] },
  items: { title: 'Item Master', table: 'AccItems', fields: [
    ['itemCode', 'Item Code', 'text', true], ['itemName', 'Item Name', 'text', true], ['unit', 'Unit', 'text'], ['sacCode', 'SAC / HSN', 'sac'],
    ['gstRate', 'GST %', 'number'], ['rate', 'Rate', 'number'], ['ledgerId', 'Ledger', 'ledger']] },
  tdsparty: { title: 'TDS Party', table: 'AccTdsParties', fields: [
    ['ledgerId', 'Party Ledger', 'ledger', true], ['tdsNatureId', 'TDS Nature', 'tdsnature', true], ['rate', 'Rate %', 'number'], ['pan', 'PAN', 'text'],
    ['lowerCertNo', 'Lower Deduction Cert. No', 'text'], ['validFrom', 'Valid From', 'date'], ['validTo', 'Valid To', 'date'], ['thresholdLimit', 'Threshold', 'number']] },
  depreciation: { title: 'Depreciation Rates', table: 'AccDepreciationRates', fields: [
    ['assetCategory', 'Asset Category', 'text', true], ['slmRate', 'SLM % (Co. Act)', 'number'], ['wdvRate', 'WDV % (Co. Act)', 'number'],
    ['itActRate', 'IT Act %', 'number'], ['usefulLife', 'Useful Life (years)', 'number'], ['ledgerId', 'Asset Ledger', 'ledger']] },
  divisionmap: { title: 'Division Mapping', table: 'AccDivisionMaps', fields: [
    ['division', 'Division', 'select:AIR EXPORT,AIR IMPORT,SEA EXPORT,SEA IMPORT,CUSTOMS,TRANSPORT,WAREHOUSE,COURIER', true], ['branchCode', 'Branch', 'text'],
    ['costCentreId', 'Cost Centre', 'costcentre'], ['incomeLedgerId', 'Income Ledger', 'ledger'], ['expenseLedgerId', 'Expense Ledger', 'ledger']] },
  chequebooks: { title: 'Cheque Book Management', table: 'AccChequeBooks', fields: [
    ['bankLedgerId', 'Bank', 'ledger', true], ['bookNo', 'Book No', 'text'], ['fromNo', 'From Cheque No', 'text', true], ['toNo', 'To Cheque No', 'text', true],
    ['issuedOn', 'Received On', 'date'], ['nextNo', 'Next Cheque No', 'text'], ['status', 'Status', 'select:IN USE,FINISHED,CANCELLED']] },
  jobclosing: { title: 'Job Closing', table: 'AccJobClosings', fields: [
    ['jobNo', 'Job No', 'text', true], ['jobType', 'Job Type', 'select:AIR EXPORT,AIR IMPORT,SEA EXPORT,SEA IMPORT,CUSTOMS,OTHER'], ['closedOn', 'Closed On', 'date', true],
    ['closedBy', 'Closed By', 'text'], ['remarks', 'Remarks', 'text']] },
  approvals: { title: 'Approval System', table: 'AccApprovalRules', fields: [
    ['voucherType', 'Voucher Type', 'select:PAYMENT,RECEIPT,JOURNAL,PURCHASE,SALES,CONTRA,DEBIT NOTE,CREDIT NOTE', true], ['fromAmount', 'Amount From', 'number'],
    ['toAmount', 'Amount To', 'number'], ['approverName', 'Approver', 'text', true], ['level', 'Level', 'number']] },
};
const colType = (t) => (t === 'number' || t === 'ledger' || t === 'tdsnature' || t === 'costcentre' ? 'REAL' : t === 'bool' ? 'TINYINT(1)' : 'TEXT');
const ready = new Set();
async function ensureTable(kind) {
  const m = MASTERS[kind];
  if (ready.has(kind)) return m;
  await x(`CREATE TABLE IF NOT EXISTS ${m.table} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${m.fields.map(([k, , t]) => k + ' ' + colType(t)).join(', ')},
    isActive TINYINT(1) DEFAULT 1, createdAt DATETIME, updatedAt DATETIME)`);
  const have = new Set((await q(`PRAGMA table_info(${m.table})`)).map(c => c.name));
  for (const [k, , t] of m.fields) if (!have.has(k)) await x(`ALTER TABLE ${m.table} ADD COLUMN ${k} ${colType(t)}`);
  ready.add(kind);
  return m;
}
const clean = (m, body) => {
  const out = {};
  for (const [k, label, t, req] of m.fields) {
    let v = body[k];
    if (t === 'bool') v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
    else if (t === 'number' || t === 'ledger' || t === 'tdsnature' || t === 'costcentre') v = v === '' || v == null ? null : Number(v);
    else v = v == null ? null : String(v).trim() || null;
    if (req && (v == null || v === '')) { const e = new Error(label + ' is required'); e.status = 400; throw e; }
    out[k] = v;
  }
  if (body.isActive !== undefined) out.isActive = body.isActive === false || body.isActive === 0 || body.isActive === '0' ? 0 : 1;
  return out;
};
const kindOf = (req, res) => { const k = String(req.params.kind || '').toLowerCase(); if (!MASTERS[k]) { res.status(404).json({ error: 'Unknown master' }); return null; } return k; };

router.get('/masters', (req, res) => res.json(Object.entries(MASTERS).map(([kind, m]) => ({ kind, title: m.title }))));
router.get('/masters/:kind/meta', (req, res) => {
  const k = kindOf(req, res); if (!k) return;
  const m = MASTERS[k];
  res.json({ kind: k, title: m.title, fields: m.fields.map(([key, label, type, required]) => ({ key, label, type: type.split(':')[0], options: type.includes(':') ? type.split(':')[1].split(',') : null, required: !!required })) });
});
router.get('/masters/:kind', async (req, res) => {
  try { const k = kindOf(req, res); if (!k) return; const m = await ensureTable(k); res.json(await q(`SELECT * FROM ${m.table} ORDER BY id DESC`)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/masters/:kind', async (req, res) => {
  try {
    const k = kindOf(req, res); if (!k) return; const m = await ensureTable(k);
    const v = clean(m, req.body || {}); const t = new Date().toISOString();
    const keys = Object.keys(v);
    await x(`INSERT INTO ${m.table} (${keys.join(', ')}, createdAt, updatedAt) VALUES (${keys.map(() => '?').join(', ')}, ?, ?)`, [...keys.map(kk => v[kk]), t, t]);
    res.status(201).json({ ok: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.put('/masters/:kind/:id', async (req, res) => {
  try {
    const k = kindOf(req, res); if (!k) return; const m = await ensureTable(k);
    const v = clean(m, req.body || {}); const keys = Object.keys(v);
    await x(`UPDATE ${m.table} SET ${keys.map(kk => kk + ' = ?').join(', ')}, updatedAt = ? WHERE id = ?`, [...keys.map(kk => v[kk]), new Date().toISOString(), req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.delete('/masters/:kind/:id', async (req, res) => {
  try { const k = kindOf(req, res); if (!k) return; const m = await ensureTable(k); await x(`DELETE FROM ${m.table} WHERE id = ?`, [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ lookups
router.get('/lookups/ledgers', async (req, res) => {
  try {
    await ensureLedgerCols();
    res.json(await q(`SELECT l.id, l.name, l.groupId, (CASE WHEN coalesce(l.isBlacklisted, 0) = 1 THEN 'BLACKLISTED - ' WHEN coalesce(l.isActive, 1) = 0 THEN 'INACTIVE - ' ELSE '' END) || coalesce(g.name, '') groupName,
      coalesce(l.isBlacklisted, 0) isBlacklisted, coalesce(l.isActive, 1) isActive FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId ORDER BY l.name`));
  }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/lookups/groups', async (req, res) => {
  try { res.json(await q('SELECT id, name, parentId, nature FROM AccountGroups ORDER BY name')); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/lookups/tdsnatures', async (req, res) => {
  try { res.json(await q('SELECT id, name, section, rate FROM TdsNatures ORDER BY section, name')); } catch (e) { res.json([]); }
});
router.get('/lookups/costcentres', async (req, res) => {
  try { res.json(await q('SELECT id, name FROM CostCentres ORDER BY name')); } catch (e) { res.json([]); }
});
router.get('/lookups/sac', async (req, res) => {
  try { await ensureTable('sac'); res.json(await q('SELECT code, description, gstRate FROM AccSacCodes WHERE isActive = 1 ORDER BY code')); } catch (e) { res.json([]); }
});
router.get('/lookups/years', async (req, res) => {
  try { res.json(await q('SELECT id, code, name, startDate, endDate, isDefault FROM FinancialYears WHERE coalesce(isDeleted, 0) = 0 ORDER BY startDate DESC')); } catch (e) { res.json([]); }
});

// ------------------------------------------------------------------ shared helpers for reports
async function groupTree() {
  const groups = await q('SELECT id, name, parentId, nature FROM AccountGroups');
  const byId = new Map(groups.map(g => [g.id, g]));
  const path = (id) => { const out = []; let g = byId.get(id); let n = 0; while (g && n++ < 20) { out.unshift(g.name); g = byId.get(g.parentId); } return out; };
  const descendants = (rootIds) => { const set = new Set(rootIds); let grow = true; while (grow) { grow = false; for (const g of groups) if (g.parentId && set.has(g.parentId) && !set.has(g.id)) { set.add(g.id); grow = true; } } return set; };
  return { groups, byId, path, descendants };
}
const VALID = "coalesce(v.status, '') <> 'Rejected'";
// movement per ledger between dates (inclusive); from = null -> everything before `to`
// cached per (from, to) until vouchers change - with the iCAFFE history (3 lakh+ vouchers) one pass takes seconds
const MV_CACHE = new Map(); let mvVer = '';
async function dataVersion() {
  const a = (await q('SELECT count(*) n, max(id) mx, max(updatedAt) up FROM Vouchers'))[0] || {};
  const b = (await q('SELECT max(id) mx FROM VoucherDetails'))[0] || {};
  return [a.n, a.mx, a.up, b.mx].join('|');
}
async function movements(from, to) {
  const ver = await dataVersion();
  if (ver !== mvVer) { MV_CACHE.clear(); mvVer = ver; }
  const key = bs.scopeKey() + '~' + (from || '') + '~' + (to || ''); // per branch scope too
  if (!MV_CACHE.has(key)) {
    if (MV_CACHE.size > 40) MV_CACHE.clear();
    // 14-Nov-2026: "everything up to a date" = the years before that date's financial year (kept, see oldMovements)
    // + that year; before, a voucher saved today made the whole history (42 lakh lines) be added up again
    const cut = !from && to ? fyStartOf(String(to).slice(0, 10)) : null;
    const job = cut && cut <= String(to).slice(0, 10)
      ? Promise.all([oldMovements(cut), movements(cut, to)]).then(([a, b]) => addMoves(a, b))
      : movements0(from, to);
    MV_CACHE.set(key, job.catch(e => { MV_CACHE.delete(key); throw e; }));
  }
  return MV_CACHE.get(key);
}
const fyStartOf = (d) => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return y > 1999 && m >= 1 ? (m >= 4 ? y : y - 1) + '-04-01' : null; };
const addMoves = (a, b) => { const out = new Map(); for (const m of [a, b]) for (const [id, v] of m) { const o = out.get(id) || { dr: 0, cr: 0 }; out.set(id, { dr: o.dr + v.dr, cr: o.cr + v.cr }); } return out; };
// movement of every ledger before `cut` (the earlier financial years). Kept until one of those vouchers changes:
//   - count / last change / total of the vouchers dated before `cut` differ, or
//   - a voucher line added since (edits write new lines) belongs to a voucher dated before `cut`, or
//   - ledgers were merged (clearOldMoves), or 30 minutes passed
const OLD_MV = new Map();
const clearOldMoves = () => OLD_MV.clear();
async function oldMovements(cut) {
  const key = bs.scopeKey() + '~' + cut;
  const sig = JSON.stringify((await rq('SELECT count(*) n, max(updatedAt) up, round(sum(totalAmount), 2) t FROM Vouchers v WHERE v.date < ?', [cut]))[0] || {});
  const mx = Number(((await rq('SELECT max(id) mx FROM VoucherDetails'))[0] || {}).mx) || 0;
  let c = OLD_MV.get(key);
  if (c && (c.sig !== sig || Date.now() - c.at > 30 * 60000)) c = null;
  if (c && mx > c.mx) {
    const n = Number(((await rq('SELECT count(*) n FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE d.id > ? AND v.date < ?', [c.mx, cut]))[0] || {}).n) || 0;
    if (n) c = null; else c.mx = mx;
  }
  if (!c) {
    if (OLD_MV.size > 20) OLD_MV.clear();
    c = { sig, mx, at: Date.now(), p: movements0(null, null, cut) };
    OLD_MV.set(key, c);
    c.p.catch(() => { if (OLD_MV.get(key) === c) OLD_MV.delete(key); });
  }
  return c.p;
}
async function movements0(from, to, before) {
  const where = [VALID]; const p = [];
  if (from) { where.push('v.date >= ?'); p.push(from); }
  if (to) { where.push('v.date <= ?'); p.push(to); }
  if (before) { where.push('v.date < ?'); p.push(before); }
  const rows = await rq(`SELECT d.ledgerId, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr
    FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${where.join(' AND ')} GROUP BY d.ledgerId`, p);
  return new Map(rows.map(r => [r.ledgerId, { dr: num(r.dr), cr: num(r.cr) }]));
}
// the ledger's opening (iCAFFE's, before Apr-2022) is company-wide: it counts under the default branch only (branchScope)
const signedOpening = (l) => (bs.openingOn() ? 1 : 0) * (l.balanceType === 'Cr' ? -1 : 1) * num(l.openingBalance);
const drCr = (v) => ({ dr: v > 0 ? r2(v) : 0, cr: v < 0 ? r2(-v) : 0 });
const fyOf = async (fyId) => {
  const ys = await q('SELECT * FROM FinancialYears WHERE coalesce(isDeleted, 0) = 0 ORDER BY isDefault DESC, startDate DESC');
  // no year named: the one picked in the top bar (X-FY), else the active one
  return ys.find(y => String(y.id) === String(fyId || bs.fyId())) || ys.find(y => y.isActive) || ys[0] || { startDate: today().slice(0, 4) + '-04-01', endDate: (Number(today().slice(0, 4)) + 1) + '-03-31' };
};
const dayBefore = (d) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };

// voucher register for one or more base types; party = ledger under Sundry Debtors / Creditors
async function register(baseTypes, from, to, opts = {}) {
  const { descendants, groups } = await groupTree();
  const sid = (n) => groups.filter(g => g.name.toLowerCase().replace(/\s+/g, ' ').trim() === n).map(g => g.id);
  const partyGroups = descendants([...sid('sundry debtors'), ...sid('sundry creditors')]);
  const taxGroups = descendants(sid('duties & taxes'));
  const vs = await q(`SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, v.narration, v.totalAmount, v.status, t.name typeName, t.baseType
      FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE ${VALID} AND t.baseType IN (${baseTypes.map(() => '?').join(',')}) AND v.date >= ? AND v.date <= ? ORDER BY v.date, v.id`, [...baseTypes, from, to]);
  if (!vs.length) return [];
  const ids = vs.map(v => v.id);
  const det = await q(`SELECT d.voucherId, d.dc, d.amount, d.currency, d.amountFcy, d.roe, l.id ledgerId, l.name ledgerName, l.groupId, l.gstin
      FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId IN (${ids.join(',')})`);
  const by = new Map(); for (const d of det) { if (!by.has(d.voucherId)) by.set(d.voucherId, []); by.get(d.voucherId).push(d); }
  return vs.map(v => {
    const ds = by.get(v.id) || [];
    const party = ds.find(d => partyGroups.has(d.groupId)) || null;
    const tax = ds.filter(d => taxGroups.has(d.groupId));
    const taxAmt = (re) => r2(tax.filter(d => re.test(d.ledgerName)).reduce((s, d) => s + num(d.amount), 0));
    const igst = taxAmt(/igst|integrated/i), cgst = taxAmt(/cgst|central/i), sgst = taxAmt(/sgst|utgst|state/i);
    const tds = taxAmt(/tds/i);
    const gross = party ? num(party.amount) : num(v.totalAmount);
    const fcy = ds.find(d => d.currency && d.currency !== 'INR' && d.amountFcy);
    const taxable = r2(ds.filter(d => d !== party && !taxGroups.has(d.groupId)).reduce((s, d) => s + num(d.amount), 0));
    return { ...v, partyId: party && party.ledgerId, partyName: party ? party.ledgerName : '', gstin: party ? party.gstin : '', taxable, igst, cgst, sgst, tds,
      total: r2(gross), currency: fcy ? fcy.currency : 'INR', amountFcy: fcy ? r2(fcy.amountFcy) : null, roe: fcy ? num(fcy.roe) : null, lines: opts.lines ? ds : undefined };
  });
}

// ------------------------------------------------------------------ summary
router.get('/summary', async (req, res) => {
  try {
    const fy = await fyOf(req.query.fyId);
    const one = async (sql, p = []) => { try { return (await q(sql, p))[0] || {}; } catch (e) { return {}; } };
    const g = await one('SELECT count(*) n FROM AccountGroups');
    const l = await one('SELECT count(*) n FROM AccountLedgers');
    const v = await one(`SELECT count(*) n, sum(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) pending FROM Vouchers WHERE date >= ? AND date <= ?`, [fy.startDate, fy.endDate]);
    const byType = await q(`SELECT t.baseType, count(*) n, sum(v.totalAmount) amt FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE ${VALID} AND v.date >= ? AND v.date <= ? GROUP BY t.baseType`, [fy.startDate, fy.endDate]).catch(() => []);
    const months = await q(`SELECT substr(v.date, 1, 7) m, t.baseType, sum(v.totalAmount) amt FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE ${VALID} AND v.date >= ? AND v.date <= ? AND t.baseType IN ('Sales', 'Purchase', 'Receipt', 'Payment') GROUP BY 1, 2 ORDER BY 1`, [fy.startDate, fy.endDate]).catch(() => []);
    res.json({ fy: { id: fy.id, name: fy.name || fy.code, startDate: fy.startDate, endDate: fy.endDate }, groups: g.n || 0, ledgers: l.n || 0, vouchers: v.n || 0,
      pending: v.pending || 0, byType, months });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ reports
// ------------------------------------------------------------------ 05-Nov-2026: reports laid out like iCAFFE's
// job details for registers: MAWB / HAWB / SB-BE no, branch and division from the export / import jobs (jobNo match)
const DIVISIONS = { AE: 'Export Air', AI: 'Import Air', SE: 'Export Sea', SI: 'Import Sea', CE: 'Customs Export', CI: 'Customs Import', CC: 'Custom Clearance', TR: 'Transport', CO: 'Courier' };
const divOf = (jobNo) => { const m = String(jobNo || '').toUpperCase().match(/(?:^|[\/\-])(AE|AI|SE|SI|CE|CI|CC|TR|CO)(?=[\/\-]|$)/); return m ? DIVISIONS[m[1]] : ''; };
const jobKey = (j) => String(j || '').toUpperCase().trim();
async function jobInfo(jobNos) {
  const list = [...new Set((jobNos || []).map(jobKey).filter(Boolean))]; const out = new Map(); if (!list.length) return out;
  const marks = list.map(() => '?').join(',');
  const ex = await q(`SELECT jobNo, jobDate, mawbNo, hawbNo, coalesce(sbNo, sbNumber) sbBe, sbDate beDate, branchCode, shipmentMode mode, shipperName party FROM ExportJobs WHERE upper(trim(jobNo)) IN (${marks})`, list).catch(() => []);
  const im = await q(`SELECT jobNo, jobDate, coalesce(mawbNo, mawbblNo) mawbNo, coalesce(hawbNo, hawbhblNo) hawbNo, coalesce(beNo, beNumber) sbBe, beDate, branchCode, coalesce(modeOfTransport, shipmentMode) mode, nameOfImporter party FROM ImportJobs WHERE upper(trim(jobNo)) IN (${marks})`, list).catch(() => []);
  // 05-Nov-2026: freight dockets of Shipment Registration
  const sh = await q(`SELECT docketNo jobNo, docketDate jobDate, mawbNo, hawbNo, ediJobNo sbBe, NULL beDate, branchCode, CASE WHEN division LIKE 'A%' THEN 'AIR' ELSE 'SEA' END mode, mainParty party, marketingPerson FROM Shipments WHERE upper(trim(docketNo)) IN (${marks})`, list).catch(() => []);
  for (const j of [...ex, ...im, ...sh]) out.set(jobKey(j.jobNo), { jobDate: j.jobDate ? String(j.jobDate).slice(0, 10) : '', mawb: j.mawbNo || '', hawb: j.hawbNo || '', sbBe: j.sbBe || '', sbBeDate: j.beDate ? String(j.beDate).slice(0, 10) : '', branch: j.branchCode || '', mode: j.mode || '', party: j.party || '' , marketingPerson: j.marketingPerson || '' });
  return out;
}
// 11-Nov-2026: sales person of a bill - the docket's marketing person (as its sales person when the name is matched),
// else the KAM of the customer billed (Sales module: SalesCustomers / SalesCustomerLedgers)
async function salesPersonLookup() {
  try {
    const persons = await q('SELECT id, name, aliases FROM SalesPersons');
    const key = (n) => String(n || '').toUpperCase().replace(/\b(MR|MRS|MS|DR)\.?\s+/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
    const byName = new Map(); for (const p of persons) { byName.set(key(p.name), p.name); String(p.aliases || '').split(',').forEach(a => { if (a.trim()) byName.set(key(a), p.name); }); }
    const kam = new Map();
    for (const r of await q(`SELECT c.ledgerId lid, p.name FROM SalesCustomers c JOIN SalesPersons p ON p.id = c.kamId WHERE c.ledgerId IS NOT NULL
        UNION ALL SELECT cl.ledgerId, p.name FROM SalesCustomerLedgers cl JOIN SalesCustomers c ON c.id = cl.customerId JOIN SalesPersons p ON p.id = c.kamId`)) kam.set(r.lid, r.name);
    return (job, ledgerId) => { const mp = job && job.marketingPerson; if (mp) return byName.get(key(mp)) || mp; return kam.get(ledgerId) || ''; };
  } catch (e) { return (job) => (job && job.marketingPerson) || ''; } // no Sales tables yet
}
const jobCols = (j, jobNo) => ({ mawb: (j && j.mawb) || '', hawb: (j && j.hawb) || '', sbBe: (j && j.sbBe) || '', jobType: (j && j.mode) || '', division: divOf(jobNo), jobDate: (j && j.jobDate) || '' });
// company block printed on top of every report, as iCAFFE does
router.get('/company-head', async (req, res) => {
  try {
    const c = (await q('SELECT companyName, legalName, address1, address2, city, state, pincode, country, phone, email, website, gstin FROM CompanyProfile ORDER BY id LIMIT 1').catch(() => []))[0] || {};
    const addr = [c.address1, c.address2, c.city, c.state, c.country].filter(Boolean).join(', ') + (c.pincode ? ', PIN-' + c.pincode : '') + (c.phone ? ', PHONE-' + c.phone : '');
    res.json({ name: c.legalName || c.companyName || 'COMMITTED CARGO CARE LIMITED', address: addr, contact: [c.email, c.website].filter(Boolean).join(', '), gstin: c.gstin || '' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// one row per voucher with every line split into party / tax / other ledgers - the base of the iCAFFE registers
async function voucherLines(baseTypes, from, to, opts = {}) {
  const { descendants, groups, path } = await groupTree();
  const sid = (n) => groups.filter(g => g.name.toLowerCase().replace(/\s+/g, ' ').trim() === n).map(g => g.id);
  const partyGroups = descendants([...sid('sundry debtors'), ...sid('sundry creditors')]);
  const taxGroups = descendants(sid('duties & taxes'));
  const where = [VALID, `t.baseType IN (${baseTypes.map(() => '?').join(',')})`, 'v.date >= ?', 'v.date <= ?']; const p = [...baseTypes, from, to];
  if (opts.jobNo) { where.push('v.jobNo LIKE ?'); p.push('%' + opts.jobNo + '%'); }
  // 09-Nov-2026: search in SQL (party name, any text) and "latest N only" - so a register need not load the whole year
  if (opts.party) { where.push('EXISTS (SELECT 1 FROM VoucherDetails dp JOIN AccountLedgers lp ON lp.id = dp.ledgerId WHERE dp.voucherId = v.id AND lower(lp.name) LIKE ?)'); p.push('%' + String(opts.party).toLowerCase() + '%'); }
  if (opts.q) {
    const t = '%' + String(opts.q).trim().toLowerCase() + '%'; const n = Number(String(opts.q).replace(/,/g, ''));
    const or = ['lower(v.voucherNumber) LIKE ?', "lower(coalesce(v.refNo, '')) LIKE ?", "lower(coalesce(v.jobNo, '')) LIKE ?", "lower(coalesce(v.narration, '')) LIKE ?",
      'EXISTS (SELECT 1 FROM VoucherDetails dq JOIN AccountLedgers lq ON lq.id = dq.ledgerId WHERE dq.voucherId = v.id AND lower(lq.name) LIKE ?)'];
    const pq = [t, t, t, t, t];
    if (opts.purchaseInfo) { await ensurePinfo(); or.push("EXISTS (SELECT 1 FROM AccPurchaseInfo pq WHERE pq.voucherId = v.id AND (lower(coalesce(pq.billNo, '')) LIKE ? OR lower(coalesce(pq.hblNo, '')) LIKE ? OR lower(coalesce(pq.mblNo, '')) LIKE ?))"); pq.push(t, t, t); }
    if (isFinite(n) && n > 0) { or.push('abs(v.totalAmount - ?) < 0.01'); pq.push(n); }
    where.push('(' + or.join(' OR ') + ')'); p.push(...pq);
  }
  let total = null;
  if (opts.limit) total = (await q(`SELECT count(*) n FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${where.join(' AND ')}`, p))[0].n;
  let vs = await q(`SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, v.narration, v.totalAmount, v.status, v.branchCode, t.name typeName, t.baseType
      FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${where.join(' AND ')} ORDER BY ${opts.limit ? 'v.date DESC, v.id DESC LIMIT ' + Math.max(1, Math.min(5000, Number(opts.limit) || 100)) : 'v.date, v.id'}`, p);
  if (opts.limit) vs = vs.reverse();
  if (!vs.length) return { vs: [], partyGroups, taxGroups, path, total };
  const ids = vs.map(v => v.id);
  const det = [];
  for (let i = 0; i < ids.length; i += 800) det.push(...await q(`SELECT d.voucherId, d.dc, d.amount, d.currency, d.amountFcy, d.roe, d.remarks, l.id ledgerId, l.name ledgerName, l.groupId, l.gstin
      FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId IN (${ids.slice(i, i + 800).join(',')}) ORDER BY d.id`));
  const by = new Map(); for (const d of det) { if (!by.has(d.voucherId)) by.set(d.voucherId, []); by.get(d.voucherId).push({ ...d, amount: num(d.amount) }); }
  const jobs = await jobInfo(vs.map(v => v.jobNo));
  let pinfo = new Map();
  if (opts.purchaseInfo) { await ensurePinfo(); const pi = []; for (let i = 0; i < ids.length; i += 800) pi.push(...await q(`SELECT * FROM AccPurchaseInfo WHERE voucherId IN (${ids.slice(i, i + 800).join(',')})`)); pinfo = new Map(pi.map(r => [r.voucherId, r])); }
  let docs = new Map();
  if (opts.docs) { const dc = []; for (let i = 0; i < ids.length; i += 800) dc.push(...await q(`SELECT voucherId, count(*) n FROM VoucherDocuments WHERE voucherId IN (${ids.slice(i, i + 800).join(',')}) GROUP BY voucherId`).catch(() => [])); docs = new Map(dc.map(r => [r.voucherId, r.n])); }
  const out = vs.map(v => {
    const ds = by.get(v.id) || [];
    const party = ds.find(d => partyGroups.has(d.groupId) && (!opts.partySide || d.dc === opts.partySide(v))) || ds.find(d => partyGroups.has(d.groupId)) || null;
    const tax = ds.filter(d => d !== party && taxGroups.has(d.groupId));
    const other = ds.filter(d => d !== party && !taxGroups.has(d.groupId));
    const fcy = ds.find(d => d.currency && d.currency !== 'INR' && d.amountFcy);
    return { v, ds, party, tax, other, fcy, job: jobs.get(jobKey(v.jobNo)), info: pinfo.get(v.id), docs: docs.get(v.id) || 0 };
  });
  return { vs: out, partyGroups, taxGroups, path, total };
}
const gstOf = (tax, re, sideOk) => r2(tax.filter(d => re.test(d.ledgerName) && !/tds/i.test(d.ledgerName) && (!sideOk || sideOk(d))).reduce((s, d) => s + d.amount, 0));
const RE_IGST = /igst|integrated/i, RE_CGST = /cgst|central/i, RE_SGST = /sgst|utgst|state/i;
const nearSlab = (pct) => [0, 5, 12, 18, 28].reduce((a, x) => (Math.abs(x - pct) < Math.abs(a - pct) ? x : a), 0);
const ledgerCol = (l) => 'L' + l.ledgerId;

const REPORTS = {
  // List Of Account: every ledger with its group path and closing balance
  'list-of-accounts': async (p) => {
    const { path } = await groupTree();
    const ls = await q('SELECT * FROM AccountLedgers ORDER BY name');
    const mv = await movements(null, p.asOn || today());
    const rows = ls.map(l => { const m = mv.get(l.id) || { dr: 0, cr: 0 }; const bal = signedOpening(l) + m.dr - m.cr; const b = drCr(bal);
      return { _l: l.id, group: path(l.groupId).join(' > '), ledger: l.name, gstin: l.gstin || '', pan: l.pan || '', opening: bs.openingOn() ? r2(l.openingBalance) : 0, openingType: l.balanceType, closingDr: b.dr, closingCr: b.cr }; })
      .sort((a, b) => a.group.localeCompare(b.group) || a.ledger.localeCompare(b.ledger));
    return { columns: [['group', 'Group'], ['ledger', 'Account'], ['gstin', 'GSTIN'], ['pan', 'PAN'], ['opening', 'Opening', 'money'], ['openingType', 'Dr/Cr'], ['closingDr', 'Closing Dr', 'money'], ['closingCr', 'Closing Cr', 'money']], rows, totals: ['closingDr', 'closingCr'] };
  },
  // Monthly Ledger Summary
  'monthly-ledger': async (p) => {
    if (!p.ledgerId) return { columns: [['month', 'Month']], rows: [], note: 'Select a ledger' };
    const fy = await fyOf(p.fyId);
    const l = (await q('SELECT * FROM AccountLedgers WHERE id = ?', [p.ledgerId]))[0];
    if (!l) return { columns: [['month', 'Month']], rows: [], note: 'Ledger not found' };
    const before = (await movements(null, dayBefore(fy.startDate))).get(l.id) || { dr: 0, cr: 0 };
    const mv = await q(`SELECT substr(v.date, 1, 7) m, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID} AND d.ledgerId = ? AND v.date >= ? AND v.date <= ? GROUP BY 1`, [l.id, fy.startDate, fy.endDate]);
    const by = new Map(mv.map(r => [r.m, r]));
    let bal = signedOpening(l) + before.dr - before.cr; const rows = [];
    const d = new Date(fy.startDate + 'T00:00:00Z');
    for (let i = 0; i < 12; i++) {
      const key = d.toISOString().slice(0, 7); const r = by.get(key) || { dr: 0, cr: 0 };
      const op = drCr(bal); bal += num(r.dr) - num(r.cr); const cl = drCr(bal);
      rows.push({ month: d.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }), openingDr: op.dr, openingCr: op.cr, debit: r2(r.dr), credit: r2(r.cr), closingDr: cl.dr, closingCr: cl.cr });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return { title: l.name, columns: [['month', 'Month'], ['openingDr', 'Opening Dr', 'money'], ['openingCr', 'Opening Cr', 'money'], ['debit', 'Debit', 'money'], ['credit', 'Credit', 'money'], ['closingDr', 'Closing Dr', 'money'], ['closingCr', 'Closing Cr', 'money']], rows, totals: ['debit', 'credit'] };
  },
  // Expense Sheet: expense ledgers debited, job-wise
  'expense-sheet': async (p) => {
    const { groups, descendants } = await groupTree();
    const exp = descendants(groups.filter(g => g.nature === 'Expenses' && !g.parentId).map(g => g.id));
    const where = [VALID, 'v.date >= ?', 'v.date <= ?']; const pr = [p.from, p.to];
    if (p.jobNo) { where.push('v.jobNo = ?'); pr.push(p.jobNo); }
    const rows = (await q(`SELECT v.id vid, t.baseType, l.id lid, v.date, v.voucherNumber, v.jobNo, v.narration, l.name ledger, l.groupId, d.dc, d.amount FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${where.join(' AND ')} ORDER BY v.jobNo, v.date`, pr)).filter(r => exp.has(r.groupId))
      .map(r => ({ _v: r.vid, _b: r.baseType, _l: r.lid, date: r.date, voucherNumber: r.voucherNumber, jobNo: r.jobNo || '', ledger: r.ledger, narration: r.narration || '', amount: r2((r.dc === 'Dr' ? 1 : -1) * num(r.amount)) }));
    return { columns: [['jobNo', 'Job No'], ['date', 'Date', 'date'], ['voucherNumber', 'Voucher No'], ['ledger', 'Expense Head'], ['narration', 'Narration'], ['amount', 'Amount', 'money']], rows, totals: ['amount'] };
  },
  // BRO: export shipping bills against the money received for the job
  bro: async (p) => {
    const jobs = await q(`SELECT jobNo, jobDate, sbNo, sbDate, shipperName, consigneeName, currency, invoiceValue, fobRs FROM ExportJobs WHERE coalesce(sbDate, jobDate) >= ? AND coalesce(sbDate, jobDate) <= ? ORDER BY coalesce(sbDate, jobDate)`, [p.from, p.to]).catch(() => []);
    const rec = await q(`SELECT v.jobNo, sum(v.totalAmount) amt FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${VALID} AND t.baseType = 'Receipt' AND v.jobNo IS NOT NULL GROUP BY v.jobNo`).catch(() => []);
    const got = new Map(rec.map(r => [r.jobNo, num(r.amt)]));
    const rows = jobs.map(j => ({ ...j, fobRs: r2(j.fobRs), invoiceValue: r2(j.invoiceValue), realised: r2(got.get(j.jobNo) || 0) })).map(j => ({ ...j, balance: r2(j.fobRs - j.realised) }));
    return { columns: [['jobNo', 'Job No'], ['sbNo', 'SB No'], ['sbDate', 'SB Date', 'date'], ['shipperName', 'Exporter'], ['consigneeName', 'Consignee'], ['currency', 'Cur'], ['invoiceValue', 'Invoice Value', 'money'], ['fobRs', 'FOB (INR)', 'money'], ['realised', 'Realised (INR)', 'money'], ['balance', 'Balance', 'money']],
      rows, totals: ['fobRs', 'realised', 'balance'] };
  },
  // TDS payable: credits to TDS ledgers, month-wise / party-wise
  'tds-payable': async (p) => {
    const rows = await q(`SELECT v.date, v.voucherNumber, v.jobNo, l.name tdsLedger, d.amount, d.dc, v.id vid FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${VALID} AND lower(l.name) LIKE '%tds%' AND v.date >= ? AND v.date <= ? ORDER BY v.date`, [p.from, p.to]);
    if (!rows.length) return { columns: tdsCols(), rows: [], totals: ['deducted', 'paid'] };
    const party = await q(`SELECT d.voucherId, l.name FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId IN (${[...new Set(rows.map(r => r.vid))].join(',')}) AND lower(l.name) NOT LIKE '%tds%' AND d.dc = 'Cr'`);
    const pm = new Map(); for (const r of party) if (!pm.has(r.voucherId)) pm.set(r.voucherId, r.name);
    return { columns: tdsCols(), rows: rows.map(r => ({ _v: r.vid, date: r.date, voucherNumber: r.voucherNumber, party: pm.get(r.vid) || '', tdsLedger: r.tdsLedger, jobNo: r.jobNo || '', deducted: r.dc === 'Cr' ? r2(r.amount) : 0, paid: r.dc === 'Dr' ? r2(r.amount) : 0 })), totals: ['deducted', 'paid'] };
  },
  // Party Ledger Balance (iCAFFE "Party Ledger Balance - Group Wise"): Account Id, Account Name, Closing Balance Dr / Cr, by group
  'party-balance': async (p) => {
    const { groups, descendants, path } = await groupTree();
    const pick = (n) => groups.filter(g => g.name.toLowerCase().trim() === n).map(g => g.id);
    const roots = p.type === 'creditors' ? pick('sundry creditors') : p.type === 'debtors' ? pick('sundry debtors') : [...pick('sundry debtors'), ...pick('sundry creditors')];
    const set = descendants(roots);
    const ls = (await q('SELECT * FROM AccountLedgers')).filter(l => set.has(l.groupId));
    const mv = await movements(null, p.asOn || today());
    const rows = ls.map(l => { const m = mv.get(l.id) || { dr: 0, cr: 0 }; const b = drCr(signedOpening(l) + m.dr - m.cr);
      return { _l: l.id, group: path(l.groupId).slice(-1)[0] || '', accountId: l.accountCode || 'ACC/' + l.id, party: l.name, gstin: l.gstin || '', debit: b.dr, credit: b.cr }; })
      .filter(r => p.all === '1' || r.debit || r.credit).sort((a, b) => a.group.localeCompare(b.group) || a.party.localeCompare(b.party));
    return { subtitle: 'Party Ledger Balance - Group Wise', groupBy: 'group', columns: [['group', 'Group'], ['accountId', 'Account Id'], ['party', 'Account Name'], ['gstin', 'GSTIN'], ['debit', 'Debit', 'money', 'Closing Balance'], ['credit', 'Credit', 'money', 'Closing Balance']], rows, totals: ['debit', 'credit'] };
  },
  // Ledger Group-wise (iCAFFE "Consolidated Trial Balance")
  'group-wise': async (p) => {
    const { path, descendants } = await groupTree();
    const from = p.from, to = p.to;
    const set = p.groupId ? descendants([Number(p.groupId)]) : null;
    const ls = (await q('SELECT * FROM AccountLedgers')).filter(l => !set || set.has(l.groupId));
    const before = await movements(null, dayBefore(from)); const during = await movements(from, to);
    const rows = ls.map(l => { const b = before.get(l.id) || { dr: 0, cr: 0 }; const d = during.get(l.id) || { dr: 0, cr: 0 };
      const op = signedOpening(l) + b.dr - b.cr; const cl = op + d.dr - d.cr; const o = drCr(op), c = drCr(cl);
      return { _l: l.id, group: path(l.groupId).slice(-1)[0] || '', ledger: l.name, openingDr: o.dr, openingCr: o.cr, debit: r2(d.dr), credit: r2(d.cr), closingDr: c.dr, closingCr: c.cr }; })
      .filter(r => p.all === '1' || r.openingDr || r.openingCr || r.debit || r.credit)
      .sort((a, b) => a.group.localeCompare(b.group) || a.ledger.localeCompare(b.ledger));
    return { subtitle: 'Consolidated Trial Balance', groupBy: 'group', columns: [['group', 'Group'], ['ledger', 'Account Name'], ['openingDr', 'Debit', 'money', 'Opening Balance'], ['openingCr', 'Credit', 'money', 'Opening Balance'],
      ['debit', 'Debit', 'money', 'Transactions'], ['credit', 'Credit', 'money', 'Transactions'], ['closingDr', 'Debit', 'money', 'Closing Balance'], ['closingCr', 'Credit', 'money', 'Closing Balance']],
      rows, totals: ['openingDr', 'openingCr', 'debit', 'credit', 'closingDr', 'closingCr'] };
  },
  // Sales Register (iCAFFE, GST print): bill + job details, one column per charge, CGST / SGST / IGST, charge total
  'sales-register': async (p) => {
    const types = p.billType === 'invoice' ? ['Sales'] : p.billType === 'creditnote' ? ['Credit Note'] : ['Sales', 'Credit Note'];
    const { vs } = await voucherLines(types, p.from, p.to, { jobNo: p.jobNo });
    const salesPersonOf = await salesPersonLookup();
    const charges = new Map(); const rows = [];
    for (const { v, party, tax, other, fcy, job } of vs) {
      if (p.party && !(party && party.ledgerName.toLowerCase().includes(String(p.party).toLowerCase()))) continue;
      const sign = v.baseType === 'Credit Note' ? -1 : 1; const incSide = v.baseType === 'Credit Note' ? 'Dr' : 'Cr';
      const r = { _v: v.id, _b: v.baseType, billNo: v.voucherNumber, date: v.date, jobNo: v.jobNo || '', ...jobCols(job, v.jobNo), branch: v.branchCode || (job && job.branch) || '', party: party ? party.ledgerName : '', gstin: party ? party.gstin || '' : '',
        currency: fcy ? fcy.currency : 'INR', typeName: v.typeName, salesPerson: salesPersonOf(job, party && party.ledgerId) };
      let ct = 0;
      for (const d of other) { const k = ledgerCol(d); const a = r2(sign * (d.dc === incSide ? d.amount : -d.amount)); r[k] = r2((r[k] || 0) + a); ct += a; if (!charges.has(k)) charges.set(k, d.ledgerName); }
      r.cgst = r2(sign * gstOf(tax, RE_CGST)); r.sgst = r2(sign * gstOf(tax, RE_SGST)); r.igst = r2(sign * gstOf(tax, RE_IGST));
      r.totalGst = r2(r.cgst + r.sgst + r.igst); r.chargeTotal = r2(ct); r.total = r2(sign * (party ? party.amount : num(v.totalAmount)));
      rows.push(r);
    }
    const cc = [...charges.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => [k, n, 'money', 'Charges']);
    return { subtitle: 'Sales Register', note: 'Sales person: the docket\'s marketing person, else the customer\'s KAM (Sales > Customers). IRN is not kept in EagleView yet', columns: [['billNo', 'Bill No'], ['date', 'Date', 'date'], ['jobNo', 'Docket No'], ['jobType', 'Job Type'], ['branch', 'Branch Name'], ['division', 'Division Name'],
      ['mawb', 'MAWB/BL No'], ['hawb', 'HAWB/HBL No'], ['party', 'Party Name'], ['gstin', 'Party GSTN No.'], ['salesPerson', 'Sales Person'], ['currency', 'Currency'], ['total', 'Total', 'money'], ['totalGst', 'Total GST', 'money'],
      ...cc, ['cgst', 'CGST', 'money'], ['sgst', 'SGST', 'money'], ['igst', 'IGST', 'money'], ['chargeTotal', 'Charge Total', 'money']],
      rows, totals: ['total', 'totalGst', ...cc.map(c => c[0]), 'cgst', 'sgst', 'igst', 'chargeTotal'] };
  },
  // Purchase Register (iCAFFE): bill + job + MSME details, Total / TDS / Payable, then one column per ledger posted
  'purchase-register': async (p) => {
    const cn = p.cn === '1'; await ensureLedgerCols().catch(() => null);
    // 09-Nov-2026: without a search only the latest 100 bills of the period are loaded ("all=1" loads every bill)
    const searching = !!(String(p.q || '').trim() || String(p.party || '').trim() || String(p.jobNo || '').trim());
    const limit = !searching && p.all !== '1' ? 100 : 0;
    const { vs, total } = await voucherLines(cn ? ['Debit Note'] : ['Purchase'], p.from, p.to, { jobNo: p.jobNo, party: String(p.party || '').trim(), q: String(p.q || '').trim(), limit, purchaseInfo: true, docs: true });
    const pIds = [...new Set(vs.map(x => x.party && x.party.ledgerId).filter(Boolean))];
    const msme = new Map(pIds.length ? (await q(`SELECT id, msmeNo, msmeType, msmeActivity, msmeAgreementDays FROM AccountLedgers WHERE id IN (${pIds.join(',')})`).catch(() => [])).map(l => [l.id, l]) : []);
    const cols = new Map(); const rows = [];
    for (const { v, party, tax, other, fcy, job, info, docs } of vs) {
      if (p.party && !(party && party.ledgerName.toLowerCase().includes(String(p.party).toLowerCase()))) continue;
      const eSide = cn ? 'Cr' : 'Dr'; const sign = cn ? -1 : 1; const m = party ? msme.get(party.ledgerId) || {} : {};
      const tds = r2(tax.filter(d => /tds/i.test(d.ledgerName)).reduce((s, d) => s + (d.dc === eSide ? -d.amount : d.amount), 0));
      const payable = r2(party ? party.amount : num(v.totalAmount));
      const r = { _v: v.id, _b: v.baseType, voucherNumber: v.voucherNumber, date: v.date, docStatus: docs ? 'Uploaded (' + docs + ')' : '', billNo: (info && info.billNo) || v.refNo || '', billDate: (info && info.billDate) || '',
        jobNo: v.jobNo || '', ...jobCols(job, v.jobNo), hawb: (info && info.hblNo) || (job && job.hawb) || '', mawb: (info && info.mblNo) || (job && job.mawb) || '', branch: v.branchCode || (job && job.branch) || '',
        party: party ? party.ledgerName : '', msmeNo: m.msmeNo || '', msmeType: m.msmeType || '', msmeAgreement: m.msmeAgreementDays ? m.msmeAgreementDays + ' days' : '', msmeActivity: m.msmeActivity || '',
        currency: fcy ? fcy.currency : 'INR', total: r2(sign * (payable + tds)), tds: r2(sign * tds), payable: r2(sign * payable) };
      let ct = 0;
      for (const d of [...other, ...tax.filter(x => !/tds/i.test(x.ledgerName))]) { const k = ledgerCol(d); const a = r2(sign * (d.dc === eSide ? d.amount : -d.amount)); r[k] = r2((r[k] || 0) + a); if (!tax.includes(d)) ct += a; if (!cols.has(k)) cols.set(k, d.ledgerName); }
      r.chargeTotal = r2(ct); rows.push(r);
    }
    const lc = [...cols.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => [k, n, 'money', 'Ledgers']);
    rows.reverse(); // latest bill first
    const limited = limit && total > rows.length ? { shown: rows.length, total } : null;
    return { subtitle: cn ? 'Purchase Register - Credit Note' : 'Purchase Register', limited, searched: searching, columns: [['voucherNumber', 'Voucher No'], ['date', 'Date', 'date'], ['docStatus', 'Document Upload Status'], ['billNo', 'Invoice No'], ['billDate', 'Invoice Date', 'date'],
      ['jobNo', 'Docket No'], ['mawb', 'Mawb No'], ['hawb', 'Hawb No'], ['sbBe', 'SB/BE No'], ['branch', 'Branch Name'], ['division', 'Division Name'], ['party', 'Party Name'], ['msmeNo', 'MSME No'], ['msmeType', 'MSME Type'],
      ['msmeAgreement', 'Agreement'], ['msmeActivity', 'MSME Type 2'], ['currency', 'Currency'], ['total', 'Total Amt', 'money'], ['tds', 'TDS Amt', 'money'], ['payable', 'Payable Amt', 'money'], ['chargeTotal', 'Charge Total', 'money'], ...lc],
      rows, totals: ['total', 'tds', 'payable', 'chargeTotal', ...lc.map(c => c[0])] };
  },
  // Purchase Bill Summary (iCAFFE): bill by bill under its docket - bill amount, GST, voucher, foreign currency
  'purchase-bill-summary': async (p) => {
    const cn = p.cn === '1';
    const { vs } = await voucherLines(cn ? ['Debit Note'] : ['Purchase'], p.from, p.to, { jobNo: p.jobNo, purchaseInfo: true });
    const rows = [];
    for (const { v, party, tax, other, fcy, job, info } of vs) {
      if (p.party && !(party && party.ledgerName.toLowerCase().includes(String(p.party).toLowerCase()))) continue;
      const eSide = cn ? 'Cr' : 'Dr'; const sign = cn ? -1 : 1;
      const billAmt = r2(sign * other.reduce((s, d) => s + (d.dc === eSide ? d.amount : -d.amount), 0));
      const cgst = r2(sign * gstOf(tax, RE_CGST)), sgst = r2(sign * gstOf(tax, RE_SGST)), igst = r2(sign * gstOf(tax, RE_IGST));
      rows.push({ _v: v.id, _b: v.baseType, docket: v.jobNo || '(no docket)', docketDate: (job && job.jobDate) || '', particulars: party ? party.ledgerName : (v.narration || ''), narration: v.narration || '',
        billNo: (info && info.billNo) || v.refNo || '', billDate: (info && info.billDate) || v.date, billAmount: billAmt, sgst, cgst, igst, totalBill: r2(billAmt + cgst + sgst + igst),
        voucherNumber: v.voucherNumber, date: v.date, currency: fcy ? fcy.currency : 'INR', roe: fcy ? num(fcy.roe) : '', fcAmt: fcy ? r2(sign * fcy.amountFcy) : '' });
    }
    rows.sort((a, b) => a.docket.localeCompare(b.docket) || String(a.date).localeCompare(String(b.date)));
    return { subtitle: cn ? 'Purchase Bill Summary - Credit Note' : 'Purchase Bill Summary', groupBy: 'docket', columns: [['docket', 'Docket No'], ['docketDate', 'Docket Date', 'date'], ['particulars', 'Particulars'], ['billNo', 'Invoice No'], ['billDate', 'Invoice Date', 'date'],
      ['billAmount', 'Bill Amount', 'money'], ['sgst', 'SGST Amt.', 'money'], ['cgst', 'CGST Amt.', 'money'], ['igst', 'IGST Amt.', 'money'], ['totalBill', 'Total Bill Amt', 'money'],
      ['voucherNumber', 'Voucher No'], ['date', 'Voucher Date', 'date'], ['currency', 'Currency'], ['roe', 'Ex Rate'], ['fcAmt', 'FC Amt.', 'money']],
      rows, totals: ['billAmount', 'sgst', 'cgst', 'igst', 'totalBill'] };
  },
  // Non Trade (iCAFFE "Non Trade Invoice", item wise): every expense line of an office / overhead bill under its item
  'non-trade': async (p) => {
    const { vs } = await voucherLines(['Purchase', 'Debit Note'], p.from, p.to, { purchaseInfo: true });
    const rows = [];
    for (const { v, party, tax, other, info } of vs) {
      const desk = info && info.desk; const nonTrade = desk ? /^nontrade/.test(desk) : !v.jobNo;
      if (!nonTrade) continue;
      const cn = v.baseType === 'Debit Note'; const eSide = cn ? 'Cr' : 'Dr'; const sign = cn ? -1 : 1;
      const lines = other.map(d => ({ d, amt: r2(sign * (d.dc === eSide ? d.amount : -d.amount)) }));
      const base = lines.reduce((s, x) => s + x.amt, 0) || 1;
      const g = { c: r2(sign * gstOf(tax, RE_CGST)), s: r2(sign * gstOf(tax, RE_SGST)), i: r2(sign * gstOf(tax, RE_IGST)) };
      for (const { d, amt } of lines) rows.push({ _v: v.id, _b: v.baseType, item: d.ledgerName, voucherNumber: v.voucherNumber, date: v.date, party: party ? party.ledgerName : '', billNo: (info && info.billNo) || v.refNo || '',
        billDate: (info && info.billDate) || v.date, billAmt: r2(sign * (party ? party.amount : num(v.totalAmount))), narration: d.remarks || v.narration || '', qty: 1, rate: amt, amount: amt,
        sgst: r2(g.s * amt / base), cgst: r2(g.c * amt / base), igst: r2(g.i * amt / base) });
    }
    rows.sort((a, b) => a.item.localeCompare(b.item) || String(a.date).localeCompare(String(b.date)));
    return { subtitle: 'Non Trade Invoice', groupBy: 'item', columns: [['item', 'Item Name'], ['voucherNumber', 'Voucher No.'], ['date', 'Voucher Date', 'date'], ['party', 'Party Name'], ['billNo', 'Bill No.'], ['billDate', 'Date', 'date'],
      ['billAmt', 'Bill Amt.', 'money'], ['narration', 'Narration'], ['qty', 'Qty', 'int'], ['rate', 'Rate', 'money'], ['amount', 'Amount', 'money'], ['sgst', 'SGST Amt', 'money'], ['cgst', 'CGST Amt', 'money'], ['igst', 'IGST Amt', 'money']],
      rows, totals: ['amount', 'sgst', 'cgst', 'igst'] };
  },
  'overseas-purchase': async (p) => {
    const rows = (await register(['Purchase', 'Debit Note', 'Payment'], p.from, p.to)).filter(r => r.currency && r.currency !== 'INR');
    return { columns: [['date', 'Date', 'date'], ['voucherNumber', 'Voucher No'], ['typeName', 'Type'], ['partyName', 'Party'], ['jobNo', 'Job No'], ['currency', 'Cur'], ['amountFcy', 'Amount (FC)', 'money'], ['roe', 'ROE'], ['total', 'Amount (INR)', 'money']],
      rows, totals: ['total'] };
  },
  // List Of Invoices GST (iCAFFE): invoice amount non-taxable / taxable, GST rate-wise, AWB / HAWB / SB-BE, branch, division
  'list-of-invoices': async (p) => {
    const types = p.billType === 'invoice' ? ['Sales'] : p.billType === 'creditnote' ? ['Credit Note'] : ['Sales', 'Credit Note'];
    const { vs } = await voucherLines(types, p.from, p.to, { jobNo: p.jobNo });
    const vids = vs.map(x => x.v.id);
    const items = vids.length ? await q(`SELECT i.autoVoucherId vid, sum(CASE WHEN coalesce(it.taxRate, 0) = 0 THEN it.amount ELSE 0 END) nonTax, sum(CASE WHEN coalesce(it.taxRate, 0) > 0 THEN it.amount ELSE 0 END) tax
      FROM Invoices i JOIN InvoiceItems it ON it.invoiceId = i.id WHERE i.autoVoucherId IN (${vids.join(',')}) GROUP BY i.autoVoucherId`).catch(() => []) : [];
    const im = new Map(items.map(x => [x.vid, x]));
    const rows = [];
    for (const { v, party, tax, other, fcy, job } of vs) {
      if (p.party && !(party && party.ledgerName.toLowerCase().includes(String(p.party).toLowerCase()))) continue;
      const sign = v.baseType === 'Credit Note' ? -1 : 1; const incSide = v.baseType === 'Credit Note' ? 'Dr' : 'Cr';
      const income = r2(sign * other.reduce((s, d) => s + (d.dc === incSide ? d.amount : -d.amount), 0));
      const cgst = r2(sign * gstOf(tax, RE_CGST)), sgst = r2(sign * gstOf(tax, RE_SGST)), igst = r2(sign * gstOf(tax, RE_IGST)); const gst = r2(cgst + sgst + igst);
      let taxable, nonTaxable; const it = im.get(v.id);
      if (it) { taxable = r2(sign * num(it.tax)); nonTaxable = r2(sign * num(it.nonTax)); }
      else if (!gst) { taxable = 0; nonTaxable = income; }
      else { const slab = nearSlab(Math.abs(gst / (income || 1)) * 100) || 18; taxable = Math.abs(r2(gst * 100 / slab)) <= Math.abs(income) + 1 ? r2(gst * 100 / slab) : income; nonTaxable = r2(income - taxable); if (Math.abs(nonTaxable) < 1) { taxable = income; nonTaxable = 0; } }
      const pct = (a) => { if (!a || !taxable) return ''; const x = Math.abs(a / taxable) * 100; return [0.25, 1.5, 2.5, 3, 5, 6, 9, 12, 14, 18, 28].reduce((b, y) => (Math.abs(y - x) < Math.abs(b - x) ? y : b), 0); };
      rows.push({ _v: v.id, _b: v.baseType, billNo: v.voucherNumber, date: v.date, jobNo: v.jobNo || '', ...jobCols(job, v.jobNo), party: party ? party.ledgerName : '', gstin: party ? party.gstin || '' : '',
        pos: party && /^\d{2}/.test(party.gstin || '') ? party.gstin.slice(0, 2) : '', currency: fcy ? fcy.currency : 'INR', roe: fcy ? num(fcy.roe) : 1, nonTaxable, taxable, invTotal: r2(nonTaxable + taxable),
        sgstPct: pct(sgst), sgst, cgstPct: pct(cgst), cgst, igstPct: pct(igst), igst, totalTax: gst, refNo: v.refNo || '', branch: v.branchCode || (job && job.branch) || '' });
    }
    return { subtitle: 'List Of Invoice Gst (' + (p.billType === 'invoice' ? 'INVOICE' : p.billType === 'creditnote' ? 'CREDIT NOTE' : 'ALL') + ')', note: 'E-invoice IRN, client invoice and UTR references are not kept in EagleView yet',
      columns: [['billNo', 'Bill No'], ['date', 'Date', 'date'], ['jobNo', 'Docket No'], ['jobType', 'Job Type'], ['party', 'Party Name'], ['gstin', 'GSTIN No.'], ['pos', 'Place of Supply Code'], ['currency', 'Currency'], ['roe', 'Exchange rate'],
        ['nonTaxable', 'Non Taxable', 'money', 'Invoice Amount'], ['taxable', 'Taxable', 'money', 'Invoice Amount'], ['invTotal', 'Total', 'money', 'Invoice Amount'],
        ['sgstPct', '%', 'text', 'Goods And Service Tax'], ['sgst', 'SGST', 'money', 'Goods And Service Tax'], ['cgstPct', '%', 'text', 'Goods And Service Tax'], ['cgst', 'CGST', 'money', 'Goods And Service Tax'], ['igstPct', '%', 'text', 'Goods And Service Tax'], ['igst', 'IGST', 'money', 'Goods And Service Tax'], ['totalTax', 'Total Tax', 'money', 'Goods And Service Tax'],
        ['mawb', 'AWB No'], ['hawb', 'HAWB No'], ['sbBe', 'BE No./SB No.'], ['refNo', 'Referance No'], ['branch', 'Branch'], ['division', 'Division']],
      rows, totals: ['nonTaxable', 'taxable', 'invTotal', 'sgst', 'cgst', 'igst', 'totalTax'] };
  },
  // Remittance Register: foreign currency receipts with the job's master / house no
  'remittance-register': async (p) => {
    const { vs } = await voucherLines(['Receipt'], p.from, p.to);
    const rows = []; let sr = 0;
    for (const { v, party, fcy, job } of vs) {
      if (!(p.all === '1' || fcy)) continue;
      rows.push({ _v: v.id, _b: v.baseType, sr: ++sr, typeName: v.typeName, branch: v.branchCode || (job && job.branch) || '', party: party ? party.ledgerName : '', mawb: (job && job.mawb) || '', hawb: (job && job.hawb) || '',
        date: v.date, voucherNumber: v.voucherNumber, refNo: v.refNo || '', jobNo: v.jobNo || '', currency: fcy ? fcy.currency : 'INR', roe: fcy ? num(fcy.roe) : 1, amountFcy: fcy ? r2(fcy.amountFcy) : '', amount: r2(party ? party.amount : num(v.totalAmount)) });
    }
    return { subtitle: 'Remittance Register', note: 'CAN, agent invoice and profit share are not kept in EagleView accounts yet', columns: [['sr', 'Sr No.', 'int'], ['typeName', 'Type'], ['branch', 'Branch'], ['party', 'Remitter / Party'], ['mawb', 'Master No.'], ['hawb', 'House No.'],
      ['voucherNumber', 'Receipt No'], ['date', 'Date', 'date'], ['refNo', 'Ref / Advice No'], ['jobNo', 'Docket No'], ['currency', 'Curr'], ['roe', 'Ex. Rate'], ['amountFcy', 'Amount (FC)', 'money'], ['amount', 'Amount (INR)', 'money']],
      rows, totals: ['amount'] };
  },
  // Pending Remittance: bills raised in foreign currency not yet fully received - master / house no, bill, remittance amount, paid, balance
  'pending-remittance': async (p) => {
    const { vs } = await voucherLines(['Sales'], p.from || '2000-01-01', p.to || today());
    const ids = vs.map(x => x.v.id);
    if (!ids.length) return { subtitle: 'Pending Remittance', columns: [['party', 'Party']], rows: [] };
    const al = await q(`SELECT againstVoucherId id, sum(amount) amt, sum(coalesce(amountFcy, 0)) fc FROM VoucherAllocations WHERE againstVoucherId IN (${ids.join(',')}) GROUP BY againstVoucherId`).catch(() => []);
    const got = new Map(al.map(a => [a.id, a]));
    const rows = [];
    for (const { v, party, fcy, job } of vs) {
      if (p.fcyOnly !== '0' && !fcy) continue;
      const amt = fcy ? r2(fcy.amountFcy) : r2(party ? party.amount : num(v.totalAmount)); const g = got.get(v.id) || { amt: 0, fc: 0 };
      const paid = fcy ? r2(num(g.fc) || num(g.amt) / (num(fcy.roe) || 1)) : r2(num(g.amt));
      const bal = r2(amt - paid); if (bal <= 0.009) continue;
      rows.push({ _v: v.id, _b: v.baseType, party: party ? party.ledgerName : '', docNo: v.jobNo || v.voucherNumber, mawb: (job && job.mawb) || '', hawb: (job && job.hawb) || '', billNo: v.voucherNumber, billDate: v.date, refNo: v.refNo || '',
        currency: fcy ? fcy.currency : 'INR', amount: amt, paid, balance: bal });
    }
    return { subtitle: 'Pending Remittance', groupBy: 'party', columns: [['party', 'Party'], ['docNo', 'Doc. No.'], ['mawb', 'Master No.'], ['hawb', 'House No.'], ['billNo', 'Bill No.'], ['billDate', 'Bill Dt.', 'date'], ['refNo', 'Ref. No'], ['currency', 'Curr'],
      ['amount', 'Rem. Amt', 'money'], ['paid', 'Paid', 'money'], ['balance', 'Balance', 'money']], rows, totals: ['amount', 'paid', 'balance'] };
  },
  // Unbilled Charge (iCAFFE): charge by charge - UNBILLED (cost booked, nothing billed on the job) or Billed / Short (billed less than cost)
  unbilled: async (p) => {
    const { groups, descendants } = await groupTree();
    const natureSet = (n) => descendants(groups.filter(g => g.nature === n && !g.parentId).map(g => g.id));
    const inc = natureSet('Income'), exp = natureSet('Expenses');
    const lines = await q(`SELECT upper(trim(v.jobNo)) jobNo, v.date, v.branchCode, d.dc, d.amount, d.remarks, l.groupId, l.name ledger, l.id lid FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${VALID} AND coalesce(v.jobNo, '') <> '' AND v.date >= ? AND v.date <= ?`, [p.from || '2000-01-01', p.to]);
    const jobs = new Map();
    for (const d of lines) {
      const j = jobs.get(d.jobNo) || { jobNo: d.jobNo, first: d.date, branch: d.branchCode || '', income: 0, cost: 0, heads: new Map() };
      const s = d.dc === 'Dr' ? num(d.amount) : -num(d.amount);
      if (exp.has(d.groupId)) { j.cost += s; j.heads.set(d.ledger, r2((j.heads.get(d.ledger) || 0) + s)); }
      if (inc.has(d.groupId)) j.income -= s;
      if (d.date < j.first) j.first = d.date; jobs.set(d.jobNo, j);
    }
    // bulk GST invoices carry no docket on the voucher - their lines say which docket each charge is for
    for (const b of await q("SELECT date, linesJson, kind FROM AccSalesInvoices WHERE bulk = 1 AND coalesce(status, '') <> 'Void' AND date <= ?", [p.to]).catch(() => []))
      for (const l of JSON.parse(b.linesJson || '[]')) { const k = String(l.jobNo || '').toUpperCase().trim(); const j = jobs.get(k); if (j) j.income += (b.kind === 'creditnote' ? -1 : 1) * num(l.inrAmount); }
    const info = await jobInfo([...jobs.keys()]);
    const short = p.rtype === 'short'; const rows = [];
    for (const j of jobs.values()) {
      const ji = info.get(j.jobNo) || {};
      if (!short && j.cost > 0.5 && j.income < 0.5) for (const [h, a] of j.heads) { if (a > 0.5) rows.push({ jobNo: j.jobNo, date: j.first, party: ji.party || '', charge: h, expense: r2(a), income: 0, short: r2(a), branch: j.branch || ji.branch || '', division: divOf(j.jobNo) }); }
      if (short && j.income > 0.5 && j.cost - j.income > 0.5) rows.push({ jobNo: j.jobNo, date: j.first, party: ji.party || '', charge: [...j.heads.keys()].join(', '), expense: r2(j.cost), income: r2(j.income), short: r2(j.cost - j.income), branch: j.branch || ji.branch || '', division: divOf(j.jobNo) });
    }
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.jobNo.localeCompare(b.jobNo));
    return { subtitle: (short ? 'BILLED / SHORT' : 'UNBILLED') + ' - Docket Date Wise', columns: [['jobNo', 'Docket No'], ['date', 'Date', 'date'], ['party', 'Party'], ['charge', 'Charge Name'], ['expense', 'Expense', 'money'], ['income', 'Income', 'money'], ['short', 'Short', 'money'], ['branch', 'Branch'], ['division', 'Division']],
      rows, totals: ['expense', 'income', 'short'] };
  },
  // Ageing Analysis (iCAFFE, receivable / payable): bills by age in five intervals the user sets, outstanding vs the ledger
  ageing: async (p) => {
    const { openItems } = require('../utils/openItems');
    const asOn = p.asOn || today(); const type = p.type === 'payable' ? 'payable' : 'receivable';
    const R = [1, 2, 3, 4, 5].map(i => Math.max(1, Math.round(num(p['r' + i]) || 30)));
    const edges = R.reduce((a, x) => [...a, (a[a.length - 1] || 0) + x], []);
    const labels = edges.map((e, i) => (i === 0 ? 0 : edges[i - 1] + 1) + '-' + e).concat(['> ' + edges[4]]);
    const { items, ledgers } = await openItems({ type, asOn });
    const bucket = (days) => { const k = edges.findIndex(e => days <= e); return k < 0 ? 5 : k; };
    const mv = await movements(null, asOn);
    const detail = p.detail === '1'; const rows = []; const byP = new Map();
    for (const it of items) {
      const age = it.date ? Math.max(0, daysBetween(it.date, asOn)) : 9999; const b = bucket(age);
      if (detail) { const r = { _v: it.voucherId, party: it.party, billNo: it.refNo, billDate: it.date, age, outstanding: r2(it.pending) }; labels.forEach((l, i) => { r['b' + i] = i === b ? r2(it.pending) : 0; }); rows.push(r); continue; }
      const r = byP.get(it.ledgerId) || { _l: it.ledgerId, party: it.party, outstanding: 0 }; labels.forEach((l, i) => { if (r['b' + i] == null) r['b' + i] = 0; });
      r['b' + b] = r2(r['b' + b] + it.pending); r.outstanding = r2(r.outstanding + it.pending); byP.set(it.ledgerId, r);
    }
    if (!detail) {
      for (const l of ledgers) {
        const r = byP.get(l.id); const m = mv.get(l.id) || { dr: 0, cr: 0 }; const bal = signedOpening(l) + m.dr - m.cr;
        if (!r && Math.abs(bal) < 0.5) continue;
        const x = r || { _l: l.id, party: l.name, outstanding: 0 }; labels.forEach((lb, i) => { if (x['b' + i] == null) x['b' + i] = 0; });
        const dc = drCr(bal); x.ledgerDr = dc.dr; x.ledgerCr = dc.cr; const net = type === 'payable' ? -bal : bal;
        x.onAccount = r2(Math.max(0, x.outstanding - net)); x.diff = r2(net - (x.outstanding - x.onAccount)); byP.set(l.id, x);
      }
      rows.push(...[...byP.values()].filter(r => r.outstanding || r.ledgerDr || r.ledgerCr).sort((a, b) => a.party.localeCompare(b.party)));
    }
    const bc = labels.map((l, i) => ['b' + i, l, 'money', 'Interval In Days']);
    return { subtitle: 'Ageing Analysis ' + (type === 'payable' ? 'Payable' : 'Receivable') + ' - as on ' + asOn.split('-').reverse().join('/') + ' - interval (' + R.join(' - ') + ') days', groupBy: detail ? 'party' : '',
      columns: detail ? [['party', 'Party Name'], ['billNo', 'Bill No'], ['billDate', 'Bill Date', 'date'], ['age', 'Days', 'int'], ...bc, ['outstanding', 'Outstanding', 'money']]
        : [['party', 'Party Name'], ...bc, ['outstanding', 'Outstanding', 'money', 'Balance'], ['ledgerDr', 'As per Ledger Dr.', 'money', 'Balance'], ['ledgerCr', 'As per Ledger Cr.', 'money', 'Balance'], ['onAccount', 'On Account', 'money', 'Balance'], ['diff', 'Diff.', 'money', 'Balance']],
      rows, totals: [...bc.map(c => c[0]), 'outstanding', ...(detail ? [] : ['ledgerDr', 'ledgerCr', 'onAccount', 'diff'])] };
  },
  // Day Book (iCAFFE): every voucher line of the period - bank, cash, journal or all
  'day-book': async (p) => {
    const { groups, descendants } = await groupTree();
    const g = (re) => descendants(groups.filter(x => re.test(x.name)).map(x => x.id));
    const bank = g(/^bank (accounts|od)/i), cash = g(/^cash-in-hand$/i);
    const vt = p.vtype || 'all';
    const rows = (await q(`SELECT v.id vid, t.baseType, t.name typeName, v.voucherNumber, v.date, v.narration, v.jobNo, v.refNo, v.branchCode, d.dc, d.amount, l.name ledger, l.groupId
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId
        WHERE ${VALID} AND v.date >= ? AND v.date <= ? ORDER BY v.date, v.id, d.id`, [p.from, p.to]));
    const touches = new Map(); for (const r of rows) { const s = touches.get(r.vid) || { bank: false, cash: false }; if (bank.has(r.groupId)) s.bank = true; if (cash.has(r.groupId)) s.cash = true; touches.set(r.vid, s); }
    const keep = (r) => { const s = touches.get(r.vid); return vt === 'all' || (vt === 'bank' && s.bank) || (vt === 'cash' && s.cash) || (vt === 'journal' && !s.bank && !s.cash); };
    let last = null;
    const out = rows.filter(keep).map(r => { const first = r.vid !== last; last = r.vid; return { _v: r.vid, _b: r.baseType, voucherNumber: first ? r.voucherNumber : '', date: first ? r.date : '', particulars: r.ledger, narration: first ? r.narration || '' : '',
      jobNo: first ? r.jobNo || '' : '', typeName: first ? r.typeName : '', chqNo: first && (touches.get(r.vid) || {}).bank ? r.refNo || '' : '', debit: r.dc === 'Dr' ? r2(r.amount) : 0, credit: r.dc === 'Cr' ? r2(r.amount) : 0, branch: first ? r.branchCode || '' : '' }; });
    return { subtitle: 'Day Book', columns: [['voucherNumber', 'Voucher No'], ['date', 'Date', 'date'], ['particulars', 'Particulars'], ['narration', 'Narration'], ['jobNo', 'Docket No'], ['typeName', 'Voucher Type'], ['chqNo', 'Chq./DD. No'],
      ['debit', 'Dr.', 'money'], ['credit', 'Cr.', 'money'], ['branch', 'Dealing Branch']], rows: out, totals: ['debit', 'credit'] };
  },
};
const regCols = () => [['date', 'Date', 'date'], ['voucherNumber', 'Voucher No'], ['typeName', 'Type'], ['refNo', 'Bill / Ref No'], ['partyName', 'Party'], ['gstin', 'GSTIN'], ['jobNo', 'Job No'],
  ['taxable', 'Taxable', 'money'], ['igst', 'IGST', 'money'], ['cgst', 'CGST', 'money'], ['sgst', 'SGST', 'money'], ['tds', 'TDS', 'money'], ['total', 'Total', 'money']];
const regRow = (r) => ({ ...r, lines: undefined });
const pendCols = () => [['date', 'Bill Date', 'date'], ['voucherNumber', 'Bill No'], ['partyName', 'Party'], ['jobNo', 'Job No'], ['currency', 'Cur'], ['total', 'Bill Amount', 'money'], ['received', 'Received', 'money'], ['pending', 'Pending', 'money'], ['days', 'Days', 'int']];
// 06-Nov-2026: look-alike ledgers (same name but for spaces / dots, same GSTIN, one party on two accounts) - to clean up / merge
REPORTS['ledger-lookalikes'] = async () => {
  const groups = await lg.lookAlikes(); const rows = [];
  for (const g of groups) for (const a of g.accounts) rows.push({ _l: a.id, check: g.check, value: g.value, ledger: a.name, gstin: a.gstin || '', group: a.groupName || '', icaffeId: a.icaffeId || '' });
  return { columns: [['check', 'Check'], ['value', 'Same value'], ['ledger', 'Account'], ['gstin', 'GSTIN'], ['group', 'Group'], ['icaffeId', 'iCAFFE A/c']], rows,
    note: 'Accounts that can be mixed up. Merge the real duplicates (Masters > Merge Account) and correct wrong GSTINs; a voucher never picks one of these by itself - the account has to be chosen.' };
};
const tdsCols = () => [['date', 'Date', 'date'], ['voucherNumber', 'Voucher No'], ['party', 'Party'], ['tdsLedger', 'TDS Ledger'], ['jobNo', 'Job No'], ['deducted', 'Deducted', 'money'], ['paid', 'Paid / Adjusted', 'money']];

router.get('/reports/:name', async (req, res) => {
  try {
    const fn = REPORTS[req.params.name];
    if (!fn) return res.status(404).json({ error: 'Unknown report' });
    const fy = await fyOf(req.query.fyId);
    const p = { ...req.query, from: req.query.from || fy.startDate, to: req.query.to || today() };
    const out = await fn(p);
    out.columns = out.columns.map(([key, label, type, group]) => ({ key, label, type: type || 'text', ...(group ? { group } : {}) }));
    // drill-down: _v voucher id (+ _b base type), _l ledger id
    out.rows = (out.rows || []).map(r => ({ ...r, _v: r._v || (r.baseType && r.id) || null, _b: r._b || r.baseType || null, _l: r._l || r.partyId || null, lines: undefined }));
    // 08-Nov-2026: a row whose voucher is a GST invoice opens the invoice itself (_k = invoice kind); bill-wise reports
    // (with a Bill No column) also show which GST invoice it is and whether it has an IRN
    try {
      const links = await require('../utils/invoiceLinks').invoiceLinks(out.rows.map(r => r._v));
      if (links.size) {
        const billCol = out.columns.findIndex(c => c.key === 'billNo');
        for (const r of out.rows) { const g = links.get(Number(r._v)); if (!g) continue; r._k = g.kind; if (billCol >= 0) r.gstInv = g.invoiceNo + (g.irn ? '  (IRN)' : ''); }
        if (billCol >= 0 && !out.columns.some(c => c.key === 'gstInv')) out.columns.splice(billCol + 1, 0, { key: 'gstInv', label: 'GST Invoice', type: 'text' });
      }
    } catch (e) { /* links are extra - the report stands without them */ }
    res.json({ from: p.from, to: p.to, ...out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ month closing
// (FinancialPeriods allows one row per year - its periodNo / financialYearId are UNIQUE - so the closing register is
//  kept in its own table: one row per month 'YYYY-MM')
async function ensureMonths() {
  await x('CREATE TABLE IF NOT EXISTS AccMonthClosings (id INTEGER PRIMARY KEY AUTOINCREMENT, month VARCHAR(7) NOT NULL UNIQUE, isClosed TINYINT(1) DEFAULT 0, closedBy VARCHAR(100), closedOn DATETIME, createdAt DATETIME, updatedAt DATETIME)');
}
router.get('/months', async (req, res) => {
  try {
    await ensureMonths();
    const fy = await fyOf(req.query.fyId);
    const st = new Map((await q('SELECT * FROM AccMonthClosings')).map(r => [r.month, r]));
    const cnt = new Map((await q(`SELECT substr(date, 1, 7) m, count(*) n FROM Vouchers WHERE date >= ? AND date <= ? GROUP BY 1`, [fy.startDate, fy.endDate]).catch(() => [])).map(r => [r.m, r.n]));
    const months = []; const d = new Date(fy.startDate + 'T00:00:00Z');
    for (let i = 0; i < 12; i++) {
      const ym = d.toISOString().slice(0, 7); const r = st.get(ym) || {};
      months.push({ id: ym, month: ym, periodName: d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' }) + '-' + d.getUTCFullYear(), startDate: ym + '-01',
        endDate: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10), isClosed: !!r.isClosed, closedBy: r.closedBy || '', closedOn: r.closedOn || '', vouchers: cnt.get(ym) || 0 });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    res.json({ fy, months });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/months/:ym/:action', async (req, res) => {
  try {
    await ensureMonths();
    if (!/^\d{4}-\d{2}$/.test(req.params.ym)) return res.status(400).json({ error: 'Month must be YYYY-MM' });
    const close = req.params.action === 'close' ? 1 : req.params.action === 'open' ? 0 : null;
    if (close === null) return res.status(400).json({ error: 'close or open' });
    const t = new Date().toISOString(); const who = (req.user && (req.user.name || req.user.username || req.user.email)) || '';
    await x(`INSERT INTO AccMonthClosings (month, isClosed, closedBy, closedOn, createdAt, updatedAt) VALUES (?,?,?,?,?,?)
      ON CONFLICT(month) DO UPDATE SET isClosed = excluded.isClosed, closedBy = excluded.closedBy, closedOn = excluded.closedOn, updatedAt = excluded.updatedAt`, [req.params.ym, close, who, t, t, t]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// used by the voucher routes: is the month of this date closed?
router.isMonthClosed = async (date) => { try { await ensureMonths(); const r = await q('SELECT isClosed FROM AccMonthClosings WHERE month = ?', [String(date || '').slice(0, 7)]); return !!(r[0] && r[0].isClosed); } catch (e) { return false; } };


// ------------------------------------------------------------------ voucher desks (Receipt / Payment / Journal / Contra / Purchase ...)
router.get('/voucher-types', async (req, res) => {
  try { res.json(await q('SELECT id, name, baseType, prefix, numberingMethod FROM VoucherTypes ORDER BY id')); } catch (e) { res.status(500).json({ error: e.message }); }
});
// list of one base type (register on the left of a voucher desk)
router.get('/vouchers', async (req, res) => {
  try {
    const base = String(req.query.base || '').split(',').filter(Boolean);
    const fy = await fyOf(req.query.fyId);
    // a filter sent twice arrives as a list - the last one counts
    Object.keys(req.query).forEach(k => { if (Array.isArray(req.query[k])) req.query[k] = req.query[k][req.query[k].length - 1]; });
    const from = req.query.from || fy.startDate, to = req.query.to || today();
    const where = ['v.date >= ?', 'v.date <= ?']; const p = [from, to];
    if (base.length) { where.push(`t.baseType IN (${base.map(() => '?').join(',')})`); p.push(...base); }
    const jobCond = req.query.job === 'yes' ? "coalesce(v.jobNo, '') <> ''" : req.query.job === 'no' ? "coalesce(v.jobNo, '') = ''" : '';
    if (jobCond && !req.query.desk) where.push(jobCond);
    if (req.query.fcy === '1') where.push("EXISTS (SELECT 1 FROM VoucherDetails d3 WHERE d3.voucherId = v.id AND coalesce(d3.currency, 'INR') <> 'INR')");
    const text = String(req.query.q || '').trim();
    if (text) { where.push('(v.voucherNumber LIKE ? OR v.refNo LIKE ? OR v.jobNo LIKE ? OR v.narration LIKE ? OR EXISTS (SELECT 1 FROM VoucherDetails d2 JOIN AccountLedgers l2 ON l2.id = d2.ledgerId WHERE d2.voucherId = v.id AND l2.name LIKE ?))'); const like = '%' + text + '%'; p.push(like, like, like, like, like); }
    // Search tab filters (iCAFFE): account, voucher no, ref / cheque no, job, branch, amount, status, narration
    const Q = req.query;
    if (Q.ledgerId) { where.push('EXISTS (SELECT 1 FROM VoucherDetails d4 WHERE d4.voucherId = v.id AND d4.ledgerId = ?)'); p.push(Number(Q.ledgerId)); }
    if (Q.vno) { where.push('v.voucherNumber LIKE ?'); p.push('%' + Q.vno + '%'); }
    if (Q.refNo) { where.push('v.refNo LIKE ?'); p.push('%' + Q.refNo + '%'); }
    if (Q.jobNo) { where.push('v.jobNo LIKE ?'); p.push('%' + Q.jobNo + '%'); }
    // a voucher saved with the branch left blank belongs to the default branch
    if (Q.branch) {
      const def = (await q("SELECT branchCode FROM CompanyBranches WHERE isDefault = 1 LIMIT 1").catch(() => []))[0];
      const isDef = def && String(def.branchCode).toLowerCase().includes(String(Q.branch).trim().toLowerCase());
      where.push(isDef ? "(v.branchCode LIKE ? OR coalesce(v.branchCode, '') = '')" : 'v.branchCode LIKE ?'); p.push('%' + Q.branch + '%');
    }
    // 05-Nov-2026: Trade / Non Trade / RCM desks share the Purchase type - the desk saved with the bill tells them apart
    if (Q.desk) {
      await ensurePinfo();
      const want = String(Q.desk); const rcm = /rcm$/.test(want);
      where.push(`(EXISTS (SELECT 1 FROM AccPurchaseInfo pi WHERE pi.voucherId = v.id AND pi.desk = ?) OR (NOT EXISTS (SELECT 1 FROM AccPurchaseInfo pi2 WHERE pi2.voucherId = v.id AND coalesce(pi2.desk, '') <> '')
        AND ${rcm ? '' : 'NOT '}EXISTS (SELECT 1 FROM VoucherDetails d5 JOIN AccountLedgers l5 ON l5.id = d5.ledgerId WHERE d5.voucherId = v.id AND lower(l5.name) LIKE '%rcm%')${jobCond ? ' AND ' + jobCond : ''}))`); p.push(want);
    }
    if (Q.narration) { where.push('v.narration LIKE ?'); p.push('%' + Q.narration + '%'); }
    if (Q.amount && isFinite(Number(Q.amount))) { where.push('abs(v.totalAmount - ?) < 0.01'); p.push(Number(Q.amount)); }
    if (Q.status === 'Pending') where.push("coalesce(v.status, 'Pending') NOT IN ('Approved', 'Rejected', 'Returned')");
    else if (Q.status) { where.push('v.status = ?'); p.push(Q.status); }
    const rows = await q(`SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, v.narration, v.totalAmount, v.status, v.branchCode, v.createdByName, v.updatedAt, t.name typeName, t.baseType,
        (SELECT l.name FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = v.id AND d.dc = (CASE WHEN t.baseType IN ('Receipt', 'Purchase', 'Credit Note') THEN 'Cr' ELSE 'Dr' END) ORDER BY d.amount DESC LIMIT 1) party,
        (SELECT group_concat(l.name || '~' || d.dc || '~' || d.amount, '|') FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = v.id) accounts
        FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${where.join(' AND ')} ORDER BY v.date DESC, v.id DESC LIMIT 501`, p);
    if (rows.length > 500) { rows.length = 500; res.set('X-More', '1'); }
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/vouchers/:id', async (req, res) => {
  try {
    const v = (await q(`SELECT v.*, t.name typeName, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE v.id = ?`, [req.params.id]))[0];
    if (!v) return res.status(404).json({ error: 'Voucher not found' });
    v.lines = await q(`SELECT d.*, l.name ledgerName, g.name groupName FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE d.voucherId = ? ORDER BY d.id`, [v.id]);
    v.allocations = await q(`SELECT a.*, b.voucherNumber againstNo, b.date againstDate FROM VoucherAllocations a LEFT JOIN Vouchers b ON b.id = a.againstVoucherId WHERE a.voucherId = ?`, [v.id]).catch(() => []);
    try { await ensurePinfo(); v.purchase = (await q(`SELECT p.*, b.voucherNumber againstNo, b.date againstDate FROM AccPurchaseInfo p LEFT JOIN Vouchers b ON b.id = p.againstVoucherId WHERE p.voucherId = ?`, [v.id]))[0] || null;
      v.creditNotes = await q(`SELECT v2.id, v2.voucherNumber, v2.date, v2.totalAmount, p.billNo FROM AccPurchaseInfo p JOIN Vouchers v2 ON v2.id = p.voucherId WHERE p.kind = 'cn' AND p.againstVoucherId = ?`, [v.id]); } catch (e) { v.purchase = null; v.creditNotes = []; }
    // 09-Nov-2026: the GST invoice behind this voucher, if any (for the Voucher Details side panel)
    try { v.gst = (await require('../utils/invoiceLinks').invoiceLinks([v.id])).get(Number(v.id)) || null; } catch (e) { v.gst = null; }
    res.json(v);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// standard GST / TDS / RCM ledgers under Duties & Taxes (created when missing) - used by the purchase bill desk
const TAX_LEDGERS = { inputIgst: ['Input IGST', 'Dr'], inputCgst: ['Input CGST', 'Dr'], inputSgst: ['Input SGST', 'Dr'], outputIgst: ['Output IGST', 'Cr'],
  outputCgst: ['Output CGST', 'Cr'], outputSgst: ['Output SGST', 'Cr'], rcmInput: ['RCM Input Tax A/c', 'Dr'], rcmPayable: ['RCM Tax Payable A/c', 'Cr'], tdsPayable: ['TDS Payable', 'Cr'], roundOff: ['Round Off', 'Dr'] };
router.post('/tax-ledgers', async (req, res) => {
  try {
    const { groups } = await groupTree();
    const duty = groups.find(g => g.name.toLowerCase().trim() === 'duties & taxes') || groups.find(g => g.nature === 'Liabilities');
    const ind = groups.find(g => g.name.toLowerCase().trim() === 'indirect expenses') || duty;
    if (!duty) return res.status(400).json({ error: "Account group 'Duties & Taxes' not found" });
    const out = {}; const t = new Date().toISOString();
    for (const [k, [name, bt]] of Object.entries(TAX_LEDGERS)) {
      let r = (await q('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?)', [name]))[0];
      if (!r) { try { await x('INSERT INTO AccountLedgers (name, groupId, openingBalance, balanceType, createdAt, updatedAt) VALUES (?,?,0,?,?,?)', [name, k === 'roundOff' ? ind.id : duty.id, bt, t, t]); } catch (e) { /* made by a request running alongside */ } r = (await q('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?)', [name]))[0]; }
      out[k] = r.id;
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ledgers of some groups (bank / cash, debtors, creditors, expenses ...)
router.get('/ledgers-in', async (req, res) => {
  try {
    const { groups, descendants } = await groupTree();
    const names = String(req.query.groups || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const natures = String(req.query.nature || '').split(',').filter(Boolean);
    const roots = groups.filter(g => names.includes(g.name.toLowerCase().trim()) || (natures.includes(g.nature) && !g.parentId)).map(g => g.id);
    const set = descendants(roots);
    const ls = await q('SELECT l.id, l.name, l.groupId, l.gstin, l.state, l.creditDays, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId ORDER BY l.name');
    res.json(roots.length ? ls.filter(l => set.has(l.groupId)) : ls);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ Groups and Ledger Account (iCAFFE-style master screens)
// groups with parent, nature, number of sub-groups / ledgers and closing balance of the whole branch
router.get('/groups-tree', async (req, res) => {
  try {
    const { groups, descendants } = await groupTree();
    const ls = await q('SELECT id, groupId, openingBalance, balanceType FROM AccountLedgers');
    const mv = await movements(null, today());
    const own = new Map(); const cnt = new Map();
    for (const l of ls) { const m = mv.get(l.id) || { dr: 0, cr: 0 }; own.set(l.groupId, r2((own.get(l.groupId) || 0) + signedOpening(l) + m.dr - m.cr)); cnt.set(l.groupId, (cnt.get(l.groupId) || 0) + 1); }
    const extra = await q('SELECT id, isBuiltIn FROM AccountGroups').catch(() => []);
    const builtIn = new Map(extra.map(g => [g.id, g.isBuiltIn]));
    res.json(groups.map(g => {
      const all = descendants([g.id]);
      let bal = 0, ledgers = 0; all.forEach(id => { bal += own.get(id) || 0; ledgers += cnt.get(id) || 0; });
      return { ...g, isBuiltIn: !!builtIn.get(g.id), subGroups: groups.filter(x => x.parentId === g.id).length, ownLedgers: cnt.get(g.id) || 0, ledgers, balance: r2(bal) };
    }).sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const NATURES = ['Assets', 'Liabilities', 'Income', 'Expenses'];
router.post('/groups', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim(); const parentId = req.body.parentId ? Number(req.body.parentId) : null;
    if (!name) return res.status(400).json({ error: 'Enter the group name' });
    if ((await q('SELECT id FROM AccountGroups WHERE lower(trim(name)) = lower(?)', [name])).length) return res.status(400).json({ error: 'A group with this name already exists' });
    let nature = req.body.nature;
    if (parentId) { const p = (await q('SELECT nature FROM AccountGroups WHERE id = ?', [parentId]))[0]; if (!p) return res.status(400).json({ error: 'Under group not found' }); nature = p.nature; }
    if (!NATURES.includes(nature)) return res.status(400).json({ error: 'Choose the nature (Assets, Liabilities, Income or Expenses)' });
    const t = new Date().toISOString();
    await x('INSERT INTO AccountGroups (name, parentId, nature, isBuiltIn, createdAt, updatedAt) VALUES (?,?,?,0,?,?)', [name, parentId, nature, t, t]);
    res.json((await q('SELECT * FROM AccountGroups WHERE name = ?', [name]))[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/groups/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); const g = (await q('SELECT * FROM AccountGroups WHERE id = ?', [id]))[0];
    if (!g) return res.status(404).json({ error: 'Group not found' });
    const name = String(req.body.name || g.name).trim(); const parentId = req.body.parentId ? Number(req.body.parentId) : null;
    if ((await q('SELECT id FROM AccountGroups WHERE lower(trim(name)) = lower(?) AND id <> ?', [name, id])).length) return res.status(400).json({ error: 'A group with this name already exists' });
    const { descendants } = await groupTree();
    if (parentId && descendants([id]).has(parentId)) return res.status(400).json({ error: 'A group cannot be placed under itself or its own sub-group' });
    let nature = req.body.nature || g.nature;
    if (parentId) nature = ((await q('SELECT nature FROM AccountGroups WHERE id = ?', [parentId]))[0] || {}).nature || nature;
    if (g.isBuiltIn && (parentId || null) !== (g.parentId || null)) return res.status(400).json({ error: 'A built-in group cannot be moved' });
    await x('UPDATE AccountGroups SET name = ?, parentId = ?, nature = ?, updatedAt = ? WHERE id = ?', [name, parentId, nature, new Date().toISOString(), id]);
    // sub-groups follow the nature of their parent
    const kids = [...descendants([id])].filter(k => k !== id);
    if (kids.length) await x(`UPDATE AccountGroups SET nature = ? WHERE id IN (${kids.join(',')})`, [nature]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/groups/:id', async (req, res) => {
  try {
    const id = Number(req.params.id); const g = (await q('SELECT * FROM AccountGroups WHERE id = ?', [id]))[0];
    if (!g) return res.status(404).json({ error: 'Group not found' });
    if (g.isBuiltIn) return res.status(400).json({ error: 'Built-in groups cannot be deleted' });
    if ((await q('SELECT count(*) n FROM AccountGroups WHERE parentId = ?', [id]))[0].n) return res.status(400).json({ error: 'Move or delete its sub-groups first' });
    if ((await q('SELECT count(*) n FROM AccountLedgers WHERE groupId = ?', [id]))[0].n) return res.status(400).json({ error: 'Move its ledgers to another group first' });
    await x('DELETE FROM AccountGroups WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Ledger Account fields as on iCAFFE's Ledger Account screen. The extra columns are added to AccountLedgers the first
// time they are needed, after a copy of the database is saved in backups\ (VACUUM INTO). Extra addresses, bank
// accounts and the bill-wise opening balance live in their own tables.
const EXTRA_COLS = { accountCode: 'TEXT', accountType: 'TEXT', dealingBranch: 'TEXT', monthlyBudget: 'REAL', creditMode: 'TEXT', businessType: 'TEXT',
  isUnregistered: 'TINYINT(1) DEFAULT 0', isBlacklisted: 'TINYINT(1) DEFAULT 0', blacklistReason: 'TEXT', isComposite: 'TINYINT(1) DEFAULT 0', isFixedDeposit: 'TINYINT(1) DEFAULT 0',
  isTdsExempt: 'TINYINT(1) DEFAULT 0', partyTdsLedgerId: 'INTEGER', msmeNo: 'TEXT', msmeType: 'TEXT', msmeActivity: 'TEXT', msmeAgreementDays: 'INTEGER',
  isActive: 'TINYINT(1) DEFAULT 1', createdByName: 'TEXT', modifiedByName: 'TEXT' };
let ledgerReady = false;
let ledgerPromise = null;
function ensureLedgerCols() {
  if (ledgerReady) return Promise.resolve();
  if (!ledgerPromise) ledgerPromise = ensureLedgerColsOnce().catch(e => { ledgerPromise = null; throw e; });
  return ledgerPromise;
}
async function ensureLedgerColsOnce() {
  if (ledgerReady) return;
  const have = new Set((await q('PRAGMA table_info(AccountLedgers)')).map(c => c.name));
  const missing = Object.keys(EXTRA_COLS).filter(k => !have.has(k));
  if (missing.length) {
    const path = require('path'); const fs = require('fs');
    const dir = path.join(__dirname, '..', '..', 'backups'); try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    const file = path.join(dir, 'database_before_ledger_fields_' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + '.sqlite');
    await x(`VACUUM INTO '${file.replace(/\\/g, '/').replace(/'/g, "''")}'`);
    for (const k of missing) await x(`ALTER TABLE AccountLedgers ADD COLUMN ${k} ${EXTRA_COLS[k]}`);
  }
  await ensureSimple('AccLedgerAddresses', 'ledgerId INTEGER, label TEXT, address TEXT, city TEXT, state TEXT, pinCode TEXT, country TEXT, gstin TEXT, contactPerson TEXT, phone TEXT, email TEXT, isDefault TINYINT(1) DEFAULT 0');
  await ensureSimple('AccLedgerBanks', 'ledgerId INTEGER, bankName TEXT, accountName TEXT, accountNo TEXT, ifsc TEXT, branch TEXT, swift TEXT, isDefault TINYINT(1) DEFAULT 0');
  await ensureSimple('AccLedgerOpenings', 'ledgerId INTEGER, docNo TEXT, docDate TEXT, dueDate TEXT, dc TEXT, amount REAL, jobNo TEXT, remarks TEXT');
  ledgerCols = null; ledgerReady = true;
}
const LEDGER_FIELDS = ['name', 'groupId', 'openingBalance', 'balanceType', 'address', 'state', 'pinCode', 'country', 'gstin', 'pan', 'bankAccount', 'bankIfsc', 'bankName',
  'creditLimit', 'creditDays', 'isTdsApplicable', 'tdsNatureId', 'isTdsDeductible', 'deducteeType', 'isGstApplicable', 'hsnSac', 'taxability', 'gstRate', 'maintainBillByBill',
  'costCentresApplicable', 'contactPerson', 'email', 'phone', ...Object.keys(EXTRA_COLS).filter(k => !['createdByName', 'modifiedByName'].includes(k))];
const L_NUM = ['openingBalance', 'creditLimit', 'gstRate', 'monthlyBudget'];
const L_INT = ['creditDays', 'groupId', 'tdsNatureId', 'partyTdsLedgerId', 'msmeAgreementDays'];
const L_BOOL = ['isTdsApplicable', 'isTdsDeductible', 'isGstApplicable', 'maintainBillByBill', 'costCentresApplicable', 'isUnregistered', 'isBlacklisted', 'isComposite', 'isFixedDeposit', 'isTdsExempt', 'isActive'];
let ledgerCols = null;
const ledgerColumns = async () => (ledgerCols = ledgerCols || new Set((await q('PRAGMA table_info(AccountLedgers)')).map(c => c.name)));
router.get('/ledgers', async (req, res) => {
  try {
    await ensureLedgerCols();
    const { descendants } = await groupTree();
    const where = []; const p = [];
    const text = String(req.query.q || '').trim();
    if (text) { where.push('(l.name LIKE ? OR l.gstin LIKE ? OR l.pan LIKE ? OR l.accountCode LIKE ?)'); const like = '%' + text + '%'; p.push(like, like, like, like); }
    if (req.query.groupId) { const set = [...descendants([Number(req.query.groupId)])]; where.push(`l.groupId IN (${set.join(',') || 0})`); }
    if (req.query.flag === 'blacklisted') where.push('coalesce(l.isBlacklisted, 0) = 1');
    if (req.query.flag === 'msme') where.push("coalesce(l.msmeNo, '') <> ''");
    if (req.query.flag === 'inactive') where.push('coalesce(l.isActive, 1) = 0');
    if (req.query.flag === 'nogstin') where.push("coalesce(l.gstin, '') = '' AND coalesce(l.isUnregistered, 0) = 0");
    const rows = await q(`SELECT l.id, l.name, l.groupId, l.gstin, l.pan, l.state, l.openingBalance, l.balanceType, l.creditDays, l.creditLimit, l.accountCode, l.isBlacklisted, l.msmeNo, l.msmeType, l.isActive, l.isUnregistered, g.name groupName
      FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.name LIMIT ?`, [...p, Math.min(Number(req.query.limit) || 500, 3000)]);
    const mv = await movements(null, today());
    // total of the same search, so "20 of 7,800" only shows when the list is really cut short
    const total = (await q(`SELECT count(*) n FROM AccountLedgers l ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`, p))[0].n;
    res.json({ total, rows: rows.map(l => { const m = mv.get(l.id) || { dr: 0, cr: 0 }; const b = r2(signedOpening(l) + m.dr - m.cr); return { ...l, balance: Math.abs(b), side: b < 0 ? 'Cr' : 'Dr', used: !!(m.dr || m.cr) }; }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/ledgers/:id', async (req, res) => {
  try {
    await ensureLedgerCols();
    const l = (await q('SELECT l.*, g.name groupName, g.nature, pt.name partyTdsLedgerName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId LEFT JOIN AccountLedgers pt ON pt.id = l.partyTdsLedgerId WHERE l.id = ?', [req.params.id]))[0];
    if (!l) return res.status(404).json({ error: 'Ledger not found' });
    const m = (await q(`SELECT count(*) n, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr, max(v.date) last
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID} AND d.ledgerId = ?`, [l.id]))[0] || {};
    const b = r2(signedOpening(l) + num(m.dr) - num(m.cr));
    const addresses = await q('SELECT * FROM AccLedgerAddresses WHERE ledgerId = ? ORDER BY isDefault DESC, id', [l.id]);
    const banks = await q('SELECT * FROM AccLedgerBanks WHERE ledgerId = ? ORDER BY isDefault DESC, id', [l.id]);
    const openings = await q('SELECT * FROM AccLedgerOpenings WHERE ledgerId = ? ORDER BY docDate, id', [l.id]);
    res.json({ ...l, balance: Math.abs(b), side: b < 0 ? 'Cr' : 'Dr', entries: m.n || 0, totalDr: r2(m.dr), totalCr: r2(m.cr), lastEntry: m.last || null, addresses, banks, openings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const bad = (m) => Object.assign(new Error(m), { status: 400 });
const cleanLedger = async (body) => {
  await ensureLedgerCols();
  const cols = await ledgerColumns(); const out = {};
  for (const k of LEDGER_FIELDS) if (cols.has(k) && body[k] !== undefined) {
    let v = body[k];
    if (L_NUM.includes(k)) v = v === '' || v == null ? 0 : Number(v);
    else if (L_INT.includes(k)) v = v === '' || v == null ? null : Number(v);
    else if (L_BOOL.includes(k)) v = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
    else v = v == null ? null : String(v).trim() || null;
    out[k] = v;
  }
  if (out.name) out.name = out.name.replace(/\s+/g, ' ');
  for (const k of ['gstin', 'pan', 'bankIfsc', 'msmeNo', 'accountCode']) if (out[k]) out[k] = out[k].toUpperCase();
  if (out.balanceType && !['Dr', 'Cr'].includes(out.balanceType)) out.balanceType = 'Dr';
  if (out.gstin && !/^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/.test(out.gstin)) throw bad('GSTIN should be 15 characters, like 07AAACC1234D1Z5');
  if (out.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(out.pan)) throw bad('PAN should be like AAACC1234D');
  if (out.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(out.bankIfsc)) throw bad('IFSC should be 11 characters, like HDFC0001234');
  if (out.msmeNo && !/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(out.msmeNo)) throw bad('Udyam no should be like UDYAM-DL-07-0012345');
  if (out.msmeAgreementDays != null && (out.msmeAgreementDays < 0 || out.msmeAgreementDays > 45)) throw bad('MSME payment terms cannot be more than 45 days (MSMED Act)');
  if (out.isBlacklisted && !out.blacklistReason && body.blacklistReason !== undefined) throw bad('Enter why the party is blacklisted');
  if (out.accountCode) { const dup = await q('SELECT id FROM AccountLedgers WHERE accountCode = ? AND id <> ?', [out.accountCode, Number(body.id) || 0]); if (dup.length) throw bad('A/c code ' + out.accountCode + ' is already used'); }
  return out;
};
router.post('/ledgers', async (req, res) => {
  try {
    const d = await cleanLedger(req.body);
    if (!d.name) return res.status(400).json({ error: 'Enter the account name' });
    if (!d.groupId) return res.status(400).json({ error: 'Choose the under group' });
    if ((await q('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?)', [d.name])).length) return res.status(400).json({ error: 'An account with this name already exists' });
    await lg.checkLedgerMaster({ name: d.name, gstin: d.gstin, partyId: d.partyId });
    const t = new Date().toISOString(); d.createdAt = t; d.updatedAt = t; if (!d.balanceType) d.balanceType = 'Dr'; if (d.openingBalance == null) d.openingBalance = 0;
    d.createdByName = userOf(req) || null; if (d.isActive == null) d.isActive = 1;
    const keys = Object.keys(d);
    await x(`INSERT INTO AccountLedgers (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map(k => d[k]));
    const made = (await q('SELECT id, name FROM AccountLedgers WHERE name = ?', [d.name]))[0];
    await lg.auditLedger(null, made && made.id, 'CREATED', userOf(req), null, d).catch(() => {});
    res.json(made);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.put('/ledgers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await q('SELECT id FROM AccountLedgers WHERE id = ?', [id])).length) return res.status(404).json({ error: 'Ledger not found' });
    const d = await cleanLedger({ ...req.body, id });
    if (d.name === null || d.name === '') return res.status(400).json({ error: 'Enter the account name' });
    if (d.name && (await q('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?) AND id <> ?', [d.name, id])).length) return res.status(400).json({ error: 'An account with this name already exists' });
    if ('groupId' in d && !d.groupId) return res.status(400).json({ error: 'Choose the under group' });
    await lg.checkLedgerMaster({ id, name: d.name, gstin: d.gstin, partyId: d.partyId });
    const before = (await q('SELECT * FROM AccountLedgers WHERE id = ?', [id]))[0];
    d.updatedAt = new Date().toISOString(); d.modifiedByName = userOf(req) || null;
    const keys = Object.keys(d);
    await x(`UPDATE AccountLedgers SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`, [...keys.map(k => d[k]), id]);
    const changed = {}; for (const k of keys) if (!['updatedAt', 'modifiedByName'].includes(k) && String(before[k] ?? '') !== String(d[k] ?? '')) changed[k] = [before[k], d[k]];
    if (Object.keys(changed).length) await lg.auditLedger(null, id, 'CHANGED', userOf(req), { name: before.name }, { name: d.name || before.name, changed }).catch(() => {});
    res.json({ success: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.delete('/ledgers/:id', async (req, res) => {
  try {
    await ensureLedgerCols();
    const id = Number(req.params.id);
    const n = (await q('SELECT count(*) n FROM VoucherDetails WHERE ledgerId = ?', [id]))[0].n;
    if (n) return res.status(400).json({ error: `This account has ${n} voucher entries - use Merge Account to move them first, or untick Active` });
    const gone = (await q('SELECT * FROM AccountLedgers WHERE id = ?', [id]))[0];
    await x('DELETE FROM AccLedgerAddresses WHERE ledgerId = ?', [id]); await x('DELETE FROM AccLedgerBanks WHERE ledgerId = ?', [id]); await x('DELETE FROM AccLedgerOpenings WHERE ledgerId = ?', [id]);
    await x('DELETE FROM AccountLedgers WHERE id = ?', [id]);
    await lg.auditLedger(null, id, 'DELETED', userOf(req), gone || null, null).catch(() => {});
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// child lists of a ledger: addresses, bank accounts, opening bills
const CHILD = {
  addresses: { table: 'AccLedgerAddresses', fields: ['label', 'address', 'city', 'state', 'pinCode', 'country', 'gstin', 'contactPerson', 'phone', 'email', 'isDefault'],
    check: (r) => { if (!r.address) throw bad('Enter the address'); if (r.gstin && !/^[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/.test(r.gstin)) throw bad('GSTIN should be 15 characters'); } },
  banks: { table: 'AccLedgerBanks', fields: ['bankName', 'accountName', 'accountNo', 'ifsc', 'branch', 'swift', 'isDefault'],
    check: (r) => { if (!r.accountNo) throw bad('Enter the account no'); if (r.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(r.ifsc)) throw bad('IFSC should be 11 characters, like HDFC0001234'); } },
  openings: { table: 'AccLedgerOpenings', fields: ['docNo', 'docDate', 'dueDate', 'dc', 'amount', 'jobNo', 'remarks'],
    check: (r) => { if (!r.docNo) throw bad('Enter the bill / document no'); if (!r.docDate) throw bad('Enter the bill date'); if (!(Number(r.amount) > 0)) throw bad('Enter the amount'); if (!['Dr', 'Cr'].includes(r.dc)) r.dc = 'Dr'; } },
};
const childRow = (c, b) => { const r = {}; for (const f of c.fields) { let v = b[f]; if (f === 'isDefault') v = v ? 1 : 0; else if (f === 'amount') v = Number(v) || 0; else v = v == null ? null : String(v).trim() || null; if (['gstin', 'ifsc', 'swift'].includes(f) && v) v = String(v).toUpperCase(); r[f] = v; } c.check(r); return r; };
router.post('/ledgers/:id/:kind', async (req, res) => {
  try {
    await ensureLedgerCols(); const c = CHILD[req.params.kind]; if (!c) return res.status(404).json({ error: 'Unknown list' });
    const id = Number(req.params.id); const list = Array.isArray(req.body) ? req.body : [req.body];
    const rows = list.map(b => childRow(c, b)); const t = new Date().toISOString();
    for (const r of rows) {
      if (r.isDefault) await x(`UPDATE ${c.table} SET isDefault = 0 WHERE ledgerId = ?`, [id]);
      const keys = Object.keys(r);
      await x(`INSERT INTO ${c.table} (ledgerId, ${keys.join(',')}, createdAt, updatedAt) VALUES (?, ${keys.map(() => '?').join(',')}, ?, ?)`, [id, ...keys.map(k => r[k]), t, t]);
    }
    res.json({ success: true, added: rows.length });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.put('/ledgers/:id/:kind/:cid', async (req, res) => {
  try {
    await ensureLedgerCols(); const c = CHILD[req.params.kind]; if (!c) return res.status(404).json({ error: 'Unknown list' });
    const r = childRow(c, req.body); if (r.isDefault) await x(`UPDATE ${c.table} SET isDefault = 0 WHERE ledgerId = ?`, [req.params.id]);
    const keys = Object.keys(r);
    await x(`UPDATE ${c.table} SET ${keys.map(k => k + ' = ?').join(', ')}, updatedAt = ? WHERE id = ? AND ledgerId = ?`, [...keys.map(k => r[k]), new Date().toISOString(), req.params.cid, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.delete('/ledgers/:id/:kind/:cid', async (req, res) => {
  try { await ensureLedgerCols(); const c = CHILD[req.params.kind]; if (!c) return res.status(404).json({ error: 'Unknown list' }); await x(`DELETE FROM ${c.table} WHERE id = ? AND ledgerId = ?`, [req.params.cid, req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// TDS schedule (TdsNatures) with how many ledgers use each section
router.get('/tds-schedule', async (req, res) => {
  try { res.json(await q('SELECT t.*, (SELECT count(*) FROM AccountLedgers l WHERE l.tdsNatureId = t.id) ledgers FROM TdsNatures t ORDER BY t.section, t.name')); } catch (e) { res.status(500).json({ error: e.message }); }
});
const cleanTds = (b) => {
  const name = String(b.name || '').trim(), section = String(b.section || '').trim().toUpperCase();
  if (!section) { const e = new Error('Enter the section, like 194C'); e.status = 400; throw e; }
  if (!name) { const e = new Error('Enter the nature of payment'); e.status = 400; throw e; }
  const rate = Number(b.rate); if (!isFinite(rate) || rate < 0 || rate > 100) { const e = new Error('Enter the rate in %'); e.status = 400; throw e; }
  return [name, section, rate, b.rateWithoutPan === '' || b.rateWithoutPan == null ? 20 : Number(b.rateWithoutPan), b.exemptionLimit === '' || b.exemptionLimit == null ? 0 : Number(b.exemptionLimit)];
};
router.post('/tds-schedule', async (req, res) => {
  try { const v = cleanTds(req.body); const t = new Date().toISOString(); await x('INSERT INTO TdsNatures (name, section, rate, rateWithoutPan, exemptionLimit, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', [...v, t, t]); res.json({ success: true }); }
  catch (e) { res.status(e.status || (/UNIQUE/.test(e.message) ? 400 : 500)).json({ error: /UNIQUE/.test(e.message) ? 'This nature of payment already exists' : e.message }); }
});
router.put('/tds-schedule/:id', async (req, res) => {
  try { const v = cleanTds(req.body); await x('UPDATE TdsNatures SET name = ?, section = ?, rate = ?, rateWithoutPan = ?, exemptionLimit = ?, updatedAt = ? WHERE id = ?', [...v, new Date().toISOString(), req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(e.status || (/UNIQUE/.test(e.message) ? 400 : 500)).json({ error: /UNIQUE/.test(e.message) ? 'This nature of payment already exists' : e.message }); }
});
router.delete('/tds-schedule/:id', async (req, res) => {
  try {
    const n = (await q('SELECT count(*) n FROM AccountLedgers WHERE tdsNatureId = ?', [req.params.id]))[0].n;
    if (n) return res.status(400).json({ error: n + ' ledgers use this TDS section - change them first' });
    await x('DELETE FROM TdsNatures WHERE id = ?', [req.params.id]); res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// standard TDS sections (added only when missing)
router.post('/tds-schedule/standard', async (req, res) => {
  try {
    const STD = [['194C', 'Payment to contractors - individual / HUF', 1], ['194C', 'Payment to contractors - others', 2], ['194J', 'Fees for professional services', 10], ['194J', 'Fees for technical services', 2],
      ['194H', 'Commission or brokerage', 2], ['194I', 'Rent - land, building, furniture', 10], ['194I', 'Rent - plant and machinery', 2], ['194A', 'Interest other than on securities', 10], ['194Q', 'Purchase of goods', 0.1], ['195', 'Payment to non-residents', 20]];
    let added = 0; const t = new Date().toISOString();
    for (const [section, name, rate] of STD) { if (!(await q('SELECT id FROM TdsNatures WHERE lower(name) = lower(?)', [name])).length) { await x('INSERT INTO TdsNatures (name, section, rate, rateWithoutPan, exemptionLimit, createdAt, updatedAt) VALUES (?,?,?,20,0,?,?)', [name, section, rate, t, t]); added++; } }
    res.json({ added });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ Other Transactions (iCAFFE): cheque books, job closing, TDS payable, approvals
const createdOk = new Set();
async function ensureSimple(table, cols) {
  if (createdOk.has(table)) return;
  await x(`CREATE TABLE IF NOT EXISTS ${table} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${cols}, createdAt DATETIME, updatedAt DATETIME)`);
  createdOk.add(table);
}
const userOf = (req) => (req.user && (req.user.fullName || req.user.name || req.user.username)) || req.headers['x-user-name'] || '';

// ---- cheque books: issued leaves come from Payment / Contra vouchers whose bank line is this bank and whose ref no is the cheque no
const leafNo = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');
async function chequeUse(bankId) {
  const rows = await q(`SELECT v.id, v.voucherNumber, v.date, v.refNo, v.status, d.amount,
      (SELECT l.name FROM VoucherDetails d2 JOIN AccountLedgers l ON l.id = d2.ledgerId WHERE d2.voucherId = v.id AND d2.ledgerId <> d.ledgerId ORDER BY d2.amount DESC LIMIT 1) party
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE d.ledgerId = ? AND d.dc = 'Cr' AND coalesce(v.refNo, '') <> ''`, [bankId]);
  const m = new Map(); for (const r of rows) { const k = leafNo(r.refNo); if (k && !m.has(k)) m.set(k, r); }
  return m;
}
router.get('/cheque-books', async (req, res) => {
  try {
    await ensureTable('chequebooks');
    await ensureSimple('AccChequeLeaves', 'bookId INTEGER, chequeNo TEXT, status TEXT, reason TEXT, byUser TEXT');
    const books = await q(`SELECT b.*, l.name bankName FROM AccChequeBooks b LEFT JOIN AccountLedgers l ON l.id = b.bankLedgerId ORDER BY b.id DESC`);
    const out = [];
    for (const b of books) {
      const from = Number(leafNo(b.fromNo)), to = Number(leafNo(b.toNo));
      const total = from && to && to >= from ? to - from + 1 : 0;
      const used = await chequeUse(b.bankLedgerId);
      const cancelled = new Set((await q("SELECT chequeNo FROM AccChequeLeaves WHERE bookId = ? AND status = 'CANCELLED'", [b.id])).map(r => leafNo(r.chequeNo)));
      let issued = 0, next = null, last = null;
      for (let n = from; total && n <= to; n++) { const k = String(n); if (used.has(k)) { issued++; const u = used.get(k); if (!last || u.date > last) last = u.date; } else if (!cancelled.has(k) && next === null) next = n; }
      const width = String(b.fromNo || '').replace(/\D/g, '').length;
      out.push({ ...b, total, issued, cancelled: cancelled.size, unused: Math.max(0, total - issued - cancelled.size), nextNo: next === null ? '' : String(next).padStart(width, '0'), lastUsed: last });
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/cheque-books/:id/leaves', async (req, res) => {
  try {
    await ensureTable('chequebooks');
    await ensureSimple('AccChequeLeaves', 'bookId INTEGER, chequeNo TEXT, status TEXT, reason TEXT, byUser TEXT');
    const b = (await q('SELECT * FROM AccChequeBooks WHERE id = ?', [req.params.id]))[0];
    if (!b) return res.status(404).json({ error: 'Cheque book not found' });
    const from = Number(leafNo(b.fromNo)), to = Number(leafNo(b.toNo)); const width = String(b.fromNo || '').replace(/\D/g, '').length;
    if (!from || !to || to < from) return res.json([]);
    const used = await chequeUse(b.bankLedgerId);
    const marks = new Map((await q('SELECT * FROM AccChequeLeaves WHERE bookId = ?', [b.id])).map(r => [leafNo(r.chequeNo), r]));
    const out = [];
    for (let n = from; n <= Math.min(to, from + 999); n++) {
      const k = String(n); const u = used.get(k); const m = marks.get(k);
      out.push({ chequeNo: k.padStart(width, '0'), status: u ? 'ISSUED' : m && m.status === 'CANCELLED' ? 'CANCELLED' : 'UNUSED', voucherId: u ? u.id : null, voucherNumber: u ? u.voucherNumber : '', date: u ? u.date : (m ? String(m.updatedAt || '').slice(0, 10) : ''),
        party: u ? u.party : '', amount: u ? r2(u.amount) : null, reason: m ? m.reason : '' });
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/cheque-books/:id/leaves/:no', async (req, res) => {
  try {
    await ensureSimple('AccChequeLeaves', 'bookId INTEGER, chequeNo TEXT, status TEXT, reason TEXT, byUser TEXT');
    const t = new Date().toISOString(); const no = String(req.params.no);
    await x('DELETE FROM AccChequeLeaves WHERE bookId = ? AND chequeNo = ?', [req.params.id, no]);
    if (req.body.action === 'cancel') {
      if (!String(req.body.reason || '').trim()) return res.status(400).json({ error: 'Enter why the cheque is cancelled' });
      await x("INSERT INTO AccChequeLeaves (bookId, chequeNo, status, reason, byUser, createdAt, updatedAt) VALUES (?,?,'CANCELLED',?,?,?,?)", [req.params.id, no, String(req.body.reason).trim(), userOf(req), t, t]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- job closing: income / expense / profit of every job no found on vouchers; closing locks the job for new vouchers
router.isJobClosed = async (jobNo) => {
  try { if (!jobNo) return false; await ensureTable('jobclosing'); const r = await q('SELECT id FROM AccJobClosings WHERE upper(trim(jobNo)) = upper(trim(?)) AND coalesce(isActive, 1) = 1', [jobNo]); return r.length > 0; } catch (e) { return false; }
};
router.get('/jobs', async (req, res) => {
  try {
    await ensureTable('jobclosing');
    const { groups, descendants } = await groupTree();
    const natureSet = (n) => descendants(groups.filter(g => g.nature === n && !g.parentId).map(g => g.id));
    const inc = natureSet('Income'), exp = natureSet('Expenses');
    const lines = await q(`SELECT upper(trim(v.jobNo)) jobNo, v.date, v.id vid, t.baseType, d.dc, d.amount, l.groupId FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${VALID} AND coalesce(v.jobNo, '') <> ''`);
    const jobs = new Map();
    const J = (k) => { if (!jobs.has(k)) jobs.set(k, { jobNo: k, income: 0, expense: 0, vouchers: new Set(), first: null, last: null, sales: 0, purchase: 0 }); return jobs.get(k); };
    for (const d of lines) {
      const j = J(d.jobNo); const s = d.dc === 'Dr' ? num(d.amount) : -num(d.amount);
      if (inc.has(d.groupId)) j.income -= s; if (exp.has(d.groupId)) j.expense += s;
      j.vouchers.add(d.vid); if (!j.first || d.date < j.first) j.first = d.date; if (!j.last || d.date > j.last) j.last = d.date;
      if (d.baseType === 'Sales') j.sales = 1; if (d.baseType === 'Purchase') j.purchase = 1;
    }
    const closed = new Map((await q('SELECT * FROM AccJobClosings WHERE coalesce(isActive, 1) = 1')).map(r => [String(r.jobNo).toUpperCase().trim(), r]));
    for (const k of closed.keys()) J(k);
    let rows = [...jobs.values()].map(j => {
      const c = closed.get(j.jobNo); const income = r2(j.income), expense = r2(j.expense), profit = r2(income - expense);
      return { jobNo: j.jobNo, income, expense, profit, margin: income ? Math.round(profit / income * 1000) / 10 : null, vouchers: j.vouchers.size, first: j.first, last: j.last,
        billed: !!j.sales, hasCost: !!j.purchase, status: c ? 'CLOSED' : 'OPEN', closedOn: c ? c.closedOn : null, closedBy: c ? c.closedBy : '', remarks: c ? c.remarks : '', jobType: c ? c.jobType : '' };
    });
    const text = String(req.query.q || '').trim().toUpperCase();
    if (text) rows = rows.filter(r => r.jobNo.includes(text));
    rows.sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')) || a.jobNo.localeCompare(b.jobNo));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/jobs/close', async (req, res) => {
  try {
    await ensureTable('jobclosing');
    const jobNo = String(req.body.jobNo || '').trim().toUpperCase(); if (!jobNo) return res.status(400).json({ error: 'Job no missing' });
    const t = new Date().toISOString();
    await x('UPDATE AccJobClosings SET isActive = 0, updatedAt = ? WHERE upper(trim(jobNo)) = ?', [t, jobNo]);
    if (req.body.action !== 'reopen') await x('INSERT INTO AccJobClosings (jobNo, jobType, closedOn, closedBy, remarks, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,1,?,?)',
      [jobNo, req.body.jobType || null, today(), userOf(req) || req.body.closedBy || null, req.body.remarks || null, t, t]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- TDS payable: deducted per month and section (Cr on TDS ledgers under Duties & Taxes) against challans paid
const tdsDue = (ym) => { const [y, m] = ym.split('-').map(Number); if (m === 3) return y + '-04-30'; const n = new Date(Date.UTC(y, m, 7)); return n.toISOString().slice(0, 10); };
async function tdsLines(from, to) {
  const { groups, descendants } = await groupTree();
  const tax = descendants(groups.filter(g => /duties\s*&\s*taxes|current liabilities/i.test(g.name)).map(g => g.id));
  const rows = await q(`SELECT d.voucherId, d.dc, d.amount, d.remarks, l.id ledgerId, l.name ledgerName, l.groupId, v.date, v.voucherNumber, v.jobNo, t.name typeName,
      (SELECT l2.name FROM VoucherDetails d2 JOIN AccountLedgers l2 ON l2.id = d2.ledgerId WHERE d2.voucherId = v.id AND lower(l2.name) NOT LIKE '%tds%' AND d2.dc = 'Cr' ORDER BY d2.amount DESC LIMIT 1) party,
      (SELECT n.section FROM VoucherDetails d3 JOIN AccountLedgers l3 ON l3.id = d3.ledgerId JOIN TdsNatures n ON n.id = l3.tdsNatureId WHERE d3.voucherId = v.id LIMIT 1) partySection
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId
      WHERE ${VALID} AND lower(l.name) LIKE '%tds%' AND lower(l.name) NOT LIKE '%receivable%' AND v.date >= ? AND v.date <= ? ORDER BY v.date`, [from, to]).catch(async () =>
    q(`SELECT d.voucherId, d.dc, d.amount, d.remarks, l.id ledgerId, l.name ledgerName, l.groupId, v.date, v.voucherNumber, v.jobNo, t.name typeName, NULL party, NULL partySection
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId
      WHERE ${VALID} AND lower(l.name) LIKE '%tds%' AND v.date >= ? AND v.date <= ?`, [from, to]));
  return rows.filter(r => tax.has(r.groupId)).map(r => {
    const sec = (String(r.remarks || '').match(/\b19[0-9][A-Z]*\b/i) || String(r.ledgerName).match(/\b19[0-9][A-Z]*\b/i) || [])[0] || r.partySection || 'OTHER';
    return { ...r, month: String(r.date).slice(0, 7), section: String(sec).toUpperCase(), amount: r2(r.amount) };
  });
}
router.get('/tds-payable', async (req, res) => {
  try {
    await ensureSimple('AccTdsChallans', 'month TEXT, section TEXT, challanNo TEXT, bsrCode TEXT, paidOn TEXT, amount REAL, interest REAL, remarks TEXT, byUser TEXT');
    const fy = await fyOf(req.query.fyId);
    const lines = await tdsLines(fy.startDate, fy.endDate);
    const ch = await q('SELECT * FROM AccTdsChallans WHERE month >= ? AND month <= ? ORDER BY paidOn', [fy.startDate.slice(0, 7), fy.endDate.slice(0, 7)]);
    const key = (m, s) => m + '|' + s; const map = new Map();
    const R = (m, s) => { const k = key(m, s); if (!map.has(k)) map.set(k, { month: m, section: s, deducted: 0, adjusted: 0, entries: 0, parties: new Set(), challans: [], paid: 0, interest: 0 }); return map.get(k); };
    for (const l of lines) { const r = R(l.month, l.section); if (l.dc === 'Cr') { r.deducted = r2(r.deducted + l.amount); r.entries++; if (l.party) r.parties.add(l.party); } else r.adjusted = r2(r.adjusted + l.amount); }
    for (const c of ch) { const r = R(c.month, String(c.section || 'OTHER').toUpperCase()); r.challans.push(c); r.paid = r2(r.paid + num(c.amount)); r.interest = r2(r.interest + num(c.interest)); }
    const now = today();
    const rows = [...map.values()].map(r => {
      const net = r2(r.deducted - r.adjusted); const balance = r2(net - r.paid); const due = tdsDue(r.month);
      const status = balance <= 0.5 ? 'PAID' : now > due ? 'OVERDUE' : 'DUE';
      return { ...r, parties: r.parties.size, net, balance, dueDate: due, status, daysLate: status === 'OVERDUE' ? daysBetween(due, now) : 0 };
    }).sort((a, b) => b.month.localeCompare(a.month) || a.section.localeCompare(b.section));
    res.json({ fy: { name: fy.name || fy.code, startDate: fy.startDate, endDate: fy.endDate }, rows,
      totals: { deducted: r2(rows.reduce((t, r) => t + r.net, 0)), paid: r2(rows.reduce((t, r) => t + r.paid, 0)), balance: r2(rows.reduce((t, r) => t + Math.max(0, r.balance), 0)), overdue: rows.filter(r => r.status === 'OVERDUE').length } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/tds-payable/detail', async (req, res) => {
  try {
    const m = String(req.query.month || ''); if (!/^\d{4}-\d{2}$/.test(m)) return res.status(400).json({ error: 'month missing' });
    const lines = (await tdsLines(m + '-01', m + '-31')).filter(l => !req.query.section || l.section === String(req.query.section).toUpperCase());
    res.json(lines);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/tds-challans', async (req, res) => {
  try {
    await ensureSimple('AccTdsChallans', 'month TEXT, section TEXT, challanNo TEXT, bsrCode TEXT, paidOn TEXT, amount REAL, interest REAL, remarks TEXT, byUser TEXT');
    const b = req.body; const t = new Date().toISOString();
    if (!/^\d{4}-\d{2}$/.test(String(b.month || ''))) return res.status(400).json({ error: 'Choose the month' });
    if (!String(b.challanNo || '').trim()) return res.status(400).json({ error: 'Enter the challan no (CIN serial)' });
    if (!b.paidOn) return res.status(400).json({ error: 'Enter the date paid' });
    if (!(Number(b.amount) > 0)) return res.status(400).json({ error: 'Enter the amount paid' });
    await x('INSERT INTO AccTdsChallans (month, section, challanNo, bsrCode, paidOn, amount, interest, remarks, byUser, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [b.month, String(b.section || 'OTHER').toUpperCase(), String(b.challanNo).trim(), b.bsrCode || null, b.paidOn, Number(b.amount), Number(b.interest) || 0, b.remarks || null, userOf(req), t, t]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/tds-challans/:id', async (req, res) => {
  try { await ensureSimple('AccTdsChallans', 'month TEXT, section TEXT, challanNo TEXT, bsrCode TEXT, paidOn TEXT, amount REAL, interest REAL, remarks TEXT, byUser TEXT'); await x('DELETE FROM AccTdsChallans WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- approvals: vouchers waiting (with the rule that applies), and recent decisions
router.get('/approvals', async (req, res) => {
  try {
    await ensureTable('approvals');
    const rules = await q('SELECT * FROM AccApprovalRules WHERE coalesce(isActive, 1) = 1 ORDER BY level');
    const state = String(req.query.state || 'pending');
    const where = state === 'pending' ? "coalesce(v.status, 'Pending') NOT IN ('Approved', 'Rejected', 'Returned')" : "v.status IN ('Approved', 'Rejected', 'Returned')";
    const vs = await q(`SELECT v.id, v.voucherNumber, v.date, v.totalAmount, v.status, v.narration, v.refNo, v.jobNo, v.branchCode, v.createdByName, v.rejectionReason, v.updatedAt, t.name typeName, t.baseType,
        (SELECT group_concat(l.name || '~' || d.dc || '~' || d.amount, '|') FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = v.id) accounts
        FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE ${where} ORDER BY ${state === 'pending' ? 'v.date, v.id' : 'v.updatedAt DESC'} LIMIT 300`);
    const now = today();
    res.json({ rules, rows: vs.map(v => {
      const amt = num(v.totalAmount);
      const rs = rules.filter(r => String(r.voucherType || '').toUpperCase() === String(v.baseType || '').toUpperCase() && (r.fromAmount == null || amt >= num(r.fromAmount)) && (r.toAmount == null || !num(r.toAmount) || amt <= num(r.toAmount)));
      return { ...v, approvers: rs.map(r => r.approverName).join(', '), age: daysBetween(v.date, now) };
    }) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ Ledger report (Accounts > Reports > Ledger): opening, every entry with the other side and a running balance
router.get('/ledger-report', async (req, res) => {
  try {
    const id = Number(req.query.ledgerId); if (!id) return res.status(400).json({ error: 'Choose the account' });
    const fy = await fyOf(req.query.fyId);
    const from = req.query.from || fy.startDate, to = req.query.to || today();
    const l = (await q('SELECT l.*, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.id = ?', [id]))[0];
    if (!l) return res.status(404).json({ error: 'Account not found' });
    const b0 = (await q(`SELECT sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID} AND d.ledgerId = ? AND v.date <= ?`, [id, dayBefore(from)]))[0] || {};
    const before = { dr: num(b0.dr), cr: num(b0.cr) };
    const opening = r2(signedOpening(l) + before.dr - before.cr);
    const lines = await q(`SELECT v.id, v.date, v.voucherNumber, v.refNo, v.jobNo, v.narration, v.status, t.name typeName, t.baseType, d.dc, d.amount, d.remarks, d.currency, d.amountFcy,
        (SELECT group_concat(l2.name, char(31)) FROM VoucherDetails d2 JOIN AccountLedgers l2 ON l2.id = d2.ledgerId WHERE d2.voucherId = v.id AND d2.ledgerId <> d.ledgerId AND d2.dc <> d.dc) contra
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE ${VALID} AND d.ledgerId = ? AND v.date >= ? AND v.date <= ? ORDER BY v.date, v.id, d.id`, [id, from, to]);
    // 09-Nov-2026: as iCAFFE shows it - each account once in Particulars (a bill with two charges has CGST / SGST twice),
    // and the line's narration only when it says something the voucher's narration does not (iCAFFE bills carry the same
    // text on both, so it printed twice)
    const normN = (t) => String(t || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const invTag = (t) => (/INV#\s*([A-Z0-9/-]+)/.exec(normN(t)) || [])[1] || '';
    for (const x of lines) {
      x.contra = [...new Set(String(x.contra || '').split(String.fromCharCode(31)).map(z => z.trim()).filter(Boolean))].join(', ');
      if (x.remarks && x.narration) {
        const a = normN(x.narration), b = normN(x.remarks);
        if (a.includes(b) || b.includes(a) || (invTag(a) && invTag(a) === invTag(b))) { if (b.length > a.length) x.narration = x.remarks; x.remarks = null; }
      }
    }
    let bal = opening, dr = 0, cr = 0;
    const rows = lines.map(x => { const a = r2(x.amount); if (x.dc === 'Dr') { dr += a; bal += a; } else { cr += a; bal -= a; } return { ...x, amount: a, debit: x.dc === 'Dr' ? a : 0, credit: x.dc === 'Cr' ? a : 0, balance: r2(bal) }; });
    res.json({ ledger: { id: l.id, name: l.name, groupName: l.groupName, gstin: l.gstin, pan: l.pan, address: l.address, state: l.state, creditDays: l.creditDays }, from, to,
      opening, debit: r2(dr), credit: r2(cr), closing: r2(bal), rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ voucher Modify / Delete / Audit trail (iCAFFE buttons on every voucher screen)
const AUDIT_COLS = 'voucherId INTEGER, voucherNumber TEXT, action TEXT, byUser TEXT, beforeJson TEXT, afterJson TEXT';
async function voucherSnap(id, t) {
  const v = (await q('SELECT v.*, t.name typeName, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE v.id = ?', [id], t))[0];
  if (!v) return null;
  v.lines = await q('SELECT d.ledgerId, l.name ledgerName, d.dc, d.amount, d.currency, d.roe, d.amountFcy, d.remarks, d.costCentreId FROM VoucherDetails d LEFT JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = ? ORDER BY d.id', [id], t);
  v.allocations = await q('SELECT ledgerId, againstVoucherId, refNo, refType, amount FROM VoucherAllocations WHERE voucherId = ?', [id], t).catch(() => []);
  return v;
}
const audit = async (t, id, no, action, by, before, after) => {
  await ensureSimple('AccVoucherAudit', AUDIT_COLS);
  const s = new Date().toISOString();
  await x('INSERT INTO AccVoucherAudit (voucherId, voucherNumber, action, byUser, beforeJson, afterJson, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)', [id, no, action, by || null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, s, s], t);
};
router.put('/vouchers/:id', async (req, res) => {
  try {
    if ((await router.ibVoucherIds()).has(Number(req.params.id))) return res.status(400).json({ error: 'This voucher belongs to an inter branch transfer - use Inter Branch (accept / return) instead' });
    if ((await gstInvoice.invoiceVoucherIds()).has(Number(req.params.id))) return res.status(400).json({ error: 'This voucher is a GST invoice - open it in GST Invoice to modify or void it' });
    await ensureSimple('AccVoucherAudit', AUDIT_COLS);
    const id = Number(req.params.id);
    const before = await voucherSnap(id); if (!before) return res.status(404).json({ error: 'Voucher not found' });
    const b = req.body; const date = b.date || before.date;
    if (await router.isMonthClosed(before.date)) return res.status(400).json({ error: 'Month ' + String(before.date).slice(0, 7) + ' is closed - re-open it in Month Closing to change this voucher' });
    if (await router.isMonthClosed(date)) return res.status(400).json({ error: 'Month ' + String(date).slice(0, 7) + ' is closed - choose another date' });
    const jobNo = b.jobNo === undefined ? before.jobNo : (String(b.jobNo || '').trim() || null);
    if (jobNo && await router.isJobClosed(jobNo)) return res.status(400).json({ error: 'Job ' + jobNo + ' is closed (Job Closing) - re-open it to change this voucher' });
    const details = Array.isArray(b.details) ? b.details : [];
    let dr = 0, cr = 0;
    for (const d of details) { if (!d.ledgerId) return res.status(400).json({ error: 'Every line needs an account' }); if (!['Dr', 'Cr'].includes(d.dc)) return res.status(400).json({ error: 'Dr / Cr missing on a line' }); const a = num(d.amount); if (a <= 0) return res.status(400).json({ error: 'Every line needs an amount' }); if (d.dc === 'Dr') dr += a; else cr += a; }
    if (!details.length || Math.abs(dr - cr) > 0.01) return res.status(400).json({ error: 'Debit and credit must be equal' });
    try { await lg.checkLines(details.map(d => d.ledgerId)); } catch (e) { return res.status(400).json({ error: e.message }); }
    const vno = String(b.voucherNumber || before.voucherNumber).trim();
    // 06-Nov-2026: iCAFFE's voucher numbers start again every 1st April (BA/NDL/AE/1523 exists in several years), so a number
    // only has to be unique within its financial year; keeping the voucher's own number is always allowed
    if (vno !== String(before.voucherNumber || '').trim()) {
      const d0 = String(b.date || before.date).slice(0, 10); const y0 = Number(d0.slice(5, 7)) < 4 ? Number(d0.slice(0, 4)) - 1 : Number(d0.slice(0, 4));
      if ((await q('SELECT id FROM Vouchers WHERE voucherTypeId = ? AND voucherNumber = ? AND id <> ? AND date >= ? AND date <= ?', [before.voucherTypeId, vno, id, y0 + '-04-01', (y0 + 1) + '-03-31'])).length) return res.status(400).json({ error: 'Voucher no ' + vno + ' is already used in this financial year' });
    }
    // 05-Nov-2026: Modify on Receipt / Payment / credit note can also change the bills set off (allocations replaced as sent)
    const newAl = Array.isArray(b.allocations) ? b.allocations.map(a => ({ ledgerId: Number(a.ledgerId), againstVoucherId: a.againstVoucherId ? Number(a.againstVoucherId) : null, refNo: a.refNo ? String(a.refNo).slice(0, 80) : null,
      refType: String(a.refType || 'AGAINST').toUpperCase(), amount: r2(num(a.amount)), amountFcy: a.amountFcy != null && a.amountFcy !== '' ? Number(a.amountFcy) : null })).filter(a => a.amount > 0) : null;
    if (newAl) {
      if (newAl.some(a => !a.ledgerId)) return res.status(400).json({ error: 'Every bill set off needs the party' });
      if (newAl.some(a => a.againstVoucherId === id)) return res.status(400).json({ error: 'A voucher cannot be set off against itself' });
      try { await lg.checkAllocations(newAl, details.map(d => d.ledgerId), id); } catch (e) { return res.status(400).json({ error: e.message }); }
      if (before.baseType === 'Payment') { const held = await router.heldBills(newAl.map(a => a.againstVoucherId)); if (held.length) return res.status(400).json({ error: 'Payment is on hold for bill ' + held.map(h => (h.billNo || h.voucherNumber) + (h.holdReason ? ' (' + h.holdReason + ')' : '')).join(', ') + ' - release it in the bill first' }); }
    }
    const by = userOf(req);
    await sequelize.transaction(async (t) => {
      const s = new Date().toISOString();
      await x(`UPDATE Vouchers SET voucherNumber = ?, date = ?, narration = ?, refNo = ?, jobNo = ?, branchCode = ?, totalAmount = ?, status = 'Pending', rejectionReason = NULL, approvedBy = NULL, updatedAt = ? WHERE id = ?`,
        [vno, date, b.narration === undefined ? before.narration : (b.narration || null), b.refNo === undefined ? before.refNo : (b.refNo || null), jobNo, b.branchCode === undefined ? before.branchCode : (b.branchCode || null), r2(dr), s, id], t);
      await x('DELETE FROM VoucherDetails WHERE voucherId = ?', [id], t);
      for (const d of details) await x('INSERT INTO VoucherDetails (voucherId, ledgerId, dc, amount, costCentreId, currency, roe, amountFcy, remarks, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [id, d.ledgerId, d.dc, r2(d.amount), d.costCentreId || null, d.currency ? String(d.currency).toUpperCase().slice(0, 3) : null, d.roe != null && d.roe !== '' ? Number(d.roe) : null, d.amountFcy != null && d.amountFcy !== '' ? Number(d.amountFcy) : null, d.remarks ? String(d.remarks).slice(0, 300) : null, s, s], t);
      // bill-wise set-offs stay only for accounts still on the voucher, and never above the new amount
      if (newAl) {
        await x('DELETE FROM VoucherAllocations WHERE voucherId = ?', [id], t);
        for (const a of newAl) await x('INSERT INTO VoucherAllocations (voucherId, ledgerId, againstVoucherId, refNo, refType, amount, amountFcy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
          [id, a.ledgerId, a.refType === 'AGAINST' ? a.againstVoucherId : null, a.refNo, a.refType, a.amount, a.amountFcy, s, s], t);
      }
      const keep = new Set(details.map(d => Number(d.ledgerId)));
      const al = await q('SELECT id, ledgerId FROM VoucherAllocations WHERE voucherId = ?', [id], t).catch(() => []);
      const drop = al.filter(a => !keep.has(Number(a.ledgerId))).map(a => a.id);
      if (drop.length) await x(`DELETE FROM VoucherAllocations WHERE id IN (${drop.join(',')})`, [], t);
      const after = await voucherSnap(id, t);
      const alTot = (after.allocations || []).reduce((s2, a) => s2 + num(a.amount), 0);
      if (alTot - dr > 0.01) throw Object.assign(new Error('Bills set off (' + r2(alTot) + ') are more than the new amount - reduce them first'), { status: 400 });
      await audit(t, id, vno, 'MODIFIED', by, before, after);
    });
    res.json({ success: true, status: 'Pending' });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.delete('/vouchers/:id', async (req, res) => {
  try {
    if ((await router.ibVoucherIds()).has(Number(req.params.id))) return res.status(400).json({ error: 'This voucher belongs to an inter branch transfer - use Inter Branch (accept / return) instead' });
    if ((await gstInvoice.invoiceVoucherIds()).has(Number(req.params.id))) return res.status(400).json({ error: 'This voucher is a GST invoice - open it in GST Invoice to modify or void it' });
    await ensureSimple('AccVoucherAudit', AUDIT_COLS);
    await ensurePinfo();
    const id = Number(req.params.id);
    const before = await voucherSnap(id); if (!before) return res.status(404).json({ error: 'Voucher not found' });
    if (await router.isMonthClosed(before.date)) return res.status(400).json({ error: 'Month ' + String(before.date).slice(0, 7) + ' is closed - re-open it in Month Closing to delete this voucher' });
    const against = await q(`SELECT v.voucherNumber FROM VoucherAllocations a JOIN Vouchers v ON v.id = a.voucherId WHERE a.againstVoucherId = ?`, [id]).catch(() => []);
    if (against.length) return res.status(400).json({ error: 'This bill is set off by ' + against.map(a => a.voucherNumber).join(', ') + ' - change those first' });
    await sequelize.transaction(async (t) => {
      await x('DELETE FROM VoucherAllocations WHERE voucherId = ?', [id], t).catch(() => {});
      await x('DELETE FROM VoucherDetails WHERE voucherId = ?', [id], t);
      await x('DELETE FROM Vouchers WHERE id = ?', [id], t);
      await x('DELETE FROM AccPurchaseInfo WHERE voucherId = ?', [id], t).catch(() => {});
      await audit(t, id, before.voucherNumber, 'DELETED', userOf(req), before, null);
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/vouchers/:id/audit', async (req, res) => {
  try {
    await ensureSimple('AccVoucherAudit', AUDIT_COLS);
    const v = (await q('SELECT id, voucherNumber, createdAt, createdByName, status, updatedAt, approvedBy, rejectionReason FROM Vouchers WHERE id = ?', [req.params.id]))[0];
    const rows = await q('SELECT id, action, byUser, createdAt, beforeJson, afterJson FROM AccVoucherAudit WHERE voucherId = ? ORDER BY id', [req.params.id]);
    const sum = (j) => { try { const o = JSON.parse(j); return o ? { date: o.date, voucherNumber: o.voucherNumber, amount: o.totalAmount, narration: o.narration, lines: (o.lines || []).map(l => (l.ledgerName || l.ledgerId) + ' ' + l.dc + ' ' + l.amount) } : null; } catch (e) { return null; } };
    res.json({ voucher: v || null, trail: rows.map(r => ({ id: r.id, action: r.action, byUser: r.byUser, at: r.createdAt, before: sum(r.beforeJson), after: sum(r.afterJson), note: (() => { try { const o = JSON.parse(r.afterJson || 'null'); return o && !o.lines ? o.note || null : null; } catch (e) { return null; } })() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ Trade Invoice extras (iCAFFE): bill details, HBL / Master,
// SEZ, 2nd TDS, Hold Payment, and the vendor's Credit Note set against a bill. Kept in its own table, one row per voucher,
// so the Vouchers table is not changed.
const PINFO_COLS = `voucherId INTEGER UNIQUE, kind TEXT, desk TEXT, billNo TEXT, billDate TEXT, dueDate TEXT, hblNo TEXT, mblNo TEXT,
  isSez TINYINT(1) DEFAULT 0, sezType TEXT, tds1Section TEXT, tds1Amount REAL, tds2Section TEXT, tds2Amount REAL,
  againstVoucherId INTEGER, cnReason TEXT, holdPayment TINYINT(1) DEFAULT 0, holdReason TEXT, holdBy TEXT, holdAt TEXT, createdByName TEXT`;
const ensurePinfo = () => ensureSimple('AccPurchaseInfo', PINFO_COLS);
const PINFO_KEYS = ['kind', 'desk', 'billNo', 'billDate', 'dueDate', 'hblNo', 'mblNo', 'isSez', 'sezType', 'tds1Section', 'tds1Amount', 'tds2Section', 'tds2Amount', 'againstVoucherId', 'cnReason', 'holdPayment', 'holdReason'];
router.get('/purchase-info/:id', async (req, res) => {
  try { await ensurePinfo(); res.json((await q('SELECT * FROM AccPurchaseInfo WHERE voucherId = ?', [req.params.id]))[0] || null); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/purchase-info/:id', async (req, res) => {
  try {
    await ensurePinfo();
    const id = Number(req.params.id); const b = req.body || {};
    if (!(await q('SELECT id FROM Vouchers WHERE id = ?', [id])).length) return res.status(404).json({ error: 'Voucher not found' });
    if (Number(b.holdPayment) && !String(b.holdReason || '').trim()) return res.status(400).json({ error: 'Give the reason for holding the payment' });
    if (b.kind === 'cn' && !b.againstVoucherId) return res.status(400).json({ error: 'A credit note needs the bill it is against' });
    const t = new Date().toISOString(); const who = userOf(req) || null;
    const vals = PINFO_KEYS.map(k => (b[k] === '' || b[k] === undefined ? null : b[k]));
    const have = (await q('SELECT id, holdPayment FROM AccPurchaseInfo WHERE voucherId = ?', [id]))[0];
    const holdBy = Number(b.holdPayment) ? who : null; const holdAt = Number(b.holdPayment) ? t : null;
    if (have) await x(`UPDATE AccPurchaseInfo SET ${PINFO_KEYS.map(k => k + ' = ?').join(', ')}, holdBy = ?, holdAt = ?, updatedAt = ? WHERE voucherId = ?`, [...vals, holdBy, holdAt, t, id]);
    else await x(`INSERT INTO AccPurchaseInfo (voucherId, ${PINFO_KEYS.join(', ')}, holdBy, holdAt, createdByName, createdAt, updatedAt) VALUES (?, ${PINFO_KEYS.map(() => '?').join(', ')}, ?, ?, ?, ?, ?)`, [id, ...vals, holdBy, holdAt, who, t, t]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// hold / release the payment of a bill
router.post('/purchase-info/:id/hold', async (req, res) => {
  try {
    await ensurePinfo();
    const id = Number(req.params.id); const hold = req.body && Number(req.body.hold) ? 1 : 0; const reason = String((req.body && req.body.reason) || '').trim();
    if (hold && !reason) return res.status(400).json({ error: 'Give the reason for holding the payment' });
    if (!(await q('SELECT id FROM Vouchers WHERE id = ?', [id])).length) return res.status(404).json({ error: 'Voucher not found' });
    const t = new Date().toISOString(); const who = userOf(req) || null;
    if (!(await q('SELECT id FROM AccPurchaseInfo WHERE voucherId = ?', [id])).length) await x('INSERT INTO AccPurchaseInfo (voucherId, kind, createdByName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)', [id, 'bill', who, t, t]);
    await x('UPDATE AccPurchaseInfo SET holdPayment = ?, holdReason = ?, holdBy = ?, holdAt = ?, updatedAt = ? WHERE voucherId = ?', [hold, hold ? reason : null, who, t, t, id]);
    await audit(null, id, (await q('SELECT voucherNumber FROM Vouchers WHERE id = ?', [id]))[0].voucherNumber, hold ? 'PAYMENT HELD' : 'PAYMENT RELEASED', who, null, { note: reason || null }).catch(() => {});
    res.json({ success: true, holdPayment: hold });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/held-bills', async (req, res) => {
  try {
    await ensurePinfo();
    const lid = Number(req.query.ledgerId);
    const rows = await q(`SELECT p.voucherId, p.holdReason, p.holdBy, p.holdAt, v.voucherNumber, p.billNo FROM AccPurchaseInfo p JOIN Vouchers v ON v.id = p.voucherId
      WHERE p.holdPayment = 1 ${lid ? 'AND EXISTS (SELECT 1 FROM VoucherDetails d WHERE d.voucherId = p.voucherId AND d.ledgerId = ?)' : ''}`, lid ? [lid] : []);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.heldBills = async (ids) => {
  try { await ensurePinfo(); const list = (ids || []).map(Number).filter(Boolean); if (!list.length) return [];
    return await q(`SELECT p.voucherId, v.voucherNumber, p.billNo, p.holdReason FROM AccPurchaseInfo p JOIN Vouchers v ON v.id = p.voucherId WHERE p.holdPayment = 1 AND p.voucherId IN (${list.map(() => '?').join(',')})`, list);
  } catch (e) { return []; }
};
// bills of a vendor, for a credit note: what was billed, what is already credited, and the charge lines
router.get('/vendor-bills', async (req, res) => {
  try {
    await ensurePinfo();
    const lid = Number(req.query.ledgerId); if (!lid) return res.status(400).json({ error: 'ledgerId is required' });
    const bills = await q(`SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, d.amount, p.billNo, p.billDate, p.hblNo, p.mblNo, p.holdPayment
      FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN VoucherDetails d ON d.voucherId = v.id AND d.ledgerId = ? AND d.dc = 'Cr'
      LEFT JOIN AccPurchaseInfo p ON p.voucherId = v.id WHERE t.baseType = 'Purchase' ORDER BY v.date DESC, v.id DESC LIMIT 300`, [lid]);
    const cn = await q(`SELECT p.againstVoucherId id, sum(d.amount) amt FROM AccPurchaseInfo p JOIN VoucherDetails d ON d.voucherId = p.voucherId AND d.ledgerId = ? AND d.dc = 'Dr'
      WHERE p.kind = 'cn' GROUP BY p.againstVoucherId`, [lid]);
    const cm = new Map(cn.map(r => [r.id, Number(r.amt) || 0]));
    res.json(bills.map(b => ({ ...b, billNo: b.billNo || b.refNo, credited: Math.round((cm.get(b.id) || 0) * 100) / 100, left: Math.round((Number(b.amount) - (cm.get(b.id) || 0)) * 100) / 100 })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ Inter Branch (iCAFFE): Bank Transfer, Journal, Cash Transfer.
// The sending branch raises it (its voucher posts at once against "BRANCH A/C - <to>"); the receiving branch accepts it
// (its voucher posts against "BRANCH A/C - <from>") or returns it (the sending voucher is reversed, nothing is deleted).
// Bank / cash transfer: from-bank Cr | Branch A/c-TO Dr ; on accept: to-bank Dr | Branch A/c-FROM Cr   (Contra)
// Journal: from-account Cr (or Dr) | Branch A/c-TO ; on accept: the lines asked for | Branch A/c-FROM   (Journal)
const IB_COLS = `ibNo TEXT, type TEXT, fromBranch TEXT, toBranch TEXT, date TEXT, amount REAL, fromLedgerId INTEGER, toLedgerId INTEGER,
  toLines TEXT, refNo TEXT, narration TEXT, status TEXT, raiseVoucherId INTEGER, acceptVoucherId INTEGER, reverseVoucherId INTEGER,
  raisedBy TEXT, decidedBy TEXT, decidedAt TEXT, returnReason TEXT`;
const ensureIb = () => ensureSimple('AccInterBranch', IB_COLS);
const IB_TYPES = { bank: 'Bank Transfer', journal: 'Journal', cash: 'Cash Transfer' };
async function branchLedger(code, t) {
  const name = 'BRANCH A/C - ' + String(code).toUpperCase();
  let r = (await q('SELECT id FROM AccountLedgers WHERE lower(name) = lower(?)', [name], t))[0];
  if (r) return r.id;
  // 05-Nov-2026 (iCAFFE rule): entries go only to ledgers that exist in the accounts - nothing is created from a voucher
  throw Object.assign(new Error('Ledger "' + name + '" is not in the accounts - create it under Branch / Divisions in Accounts > Masters > Ledger Account'), { status: 400 });
}
async function nextVno(typeId, t) {
  const ty = (await q('SELECT * FROM VoucherTypes WHERE id = ?', [typeId], t))[0] || {};
  const n = (await q('SELECT count(*) n FROM Vouchers WHERE voucherTypeId = ?', [typeId], t))[0].n;
  let seq = (Number(ty.startingNumber) || 1) + Number(n);
  // skip numbers already typed by hand
  for (let i = 0; i < 1000; i++) { const v = (ty.prefix || '') + seq + (ty.suffix || ''); if (!(await q('SELECT id FROM Vouchers WHERE voucherTypeId = ? AND voucherNumber = ?', [typeId, v], t)).length) return v; seq++; }
  return (ty.prefix || '') + seq + (ty.suffix || '');
}
async function postVoucher(t, { base, date, narration, refNo, branchCode, lines, by, division }) {
  const ty = (await q('SELECT id FROM VoucherTypes WHERE baseType = ? ORDER BY id LIMIT 1', [base], t))[0];
  if (!ty) throw Object.assign(new Error('Voucher type "' + base + '" is missing'), { status: 400 });
  const dr = r2(lines.filter(l => l.dc === 'Dr').reduce((a, l) => a + num(l.amount), 0)); const cr = r2(lines.filter(l => l.dc === 'Cr').reduce((a, l) => a + num(l.amount), 0));
  if (!dr || Math.abs(dr - cr) > 0.01) throw Object.assign(new Error('Debit and credit must be equal'), { status: 400 });
  // 05-Nov-2026: iCAFFE numbering (BA / CA / JN per branch + division) when the branch has the series
  let vno; const ns = require('../utils/numberSeries'); await ns.ensure();
  const own = String(branchCode || '').toUpperCase() || await ns.defaultBranch(t); const dv = ns.divOf(division);
  const doc = await ns.voucherDoc(base, lines.map(l => l.ledgerId), t);
  const any = await q('SELECT division FROM NumberSeries WHERE docType = ? AND branchCode = ? AND coalesce(isActive, 1) = 1', [doc, own], t);
  if (any.length) {
    if (!dv) throw Object.assign(new Error('Choose the Division (AE / AI / SE / SI) - the voucher no comes from that division\'s series, as in iCAFFE'), { status: 400 });
    if (!any.some(r => r.division === dv || r.division === '')) throw Object.assign(new Error('Number series not set for ' + doc + ', branch ' + own + ', division ' + dv + ' - set it in Settings > Number Series (iCAFFE)'), { status: 400 });
    vno = await ns.take(doc, { branchCode: own, division: dv, date }, t);
  } else vno = await nextVno(ty.id, t);
  const s = new Date().toISOString();
  await x(`INSERT INTO Vouchers (voucherTypeId, voucherNumber, date, narration, totalAmount, status, branchCode, refNo, createdByName, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [ty.id, vno, date, narration || null, dr, 'Approved', branchCode || null, refNo || null, by || null, s, s], t);
  const id = (await q('SELECT id FROM Vouchers WHERE voucherTypeId = ? AND voucherNumber = ? ORDER BY id DESC LIMIT 1', [ty.id, vno], t))[0].id;
  for (const l of lines) await x('INSERT INTO VoucherDetails (voucherId, ledgerId, dc, amount, remarks, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', [id, l.ledgerId, l.dc, r2(num(l.amount)), l.remarks ? String(l.remarks).slice(0, 300) : null, s, s], t);
  if (dv) await x('UPDATE Vouchers SET division = ? WHERE id = ?', [dv, id], t).catch(() => null);
  return { id, vno };
}
const cleanLines = (arr) => (Array.isArray(arr) ? arr : []).map(l => ({ ledgerId: Number(l.ledgerId), dc: l.dc, amount: r2(num(l.amount)), remarks: l.remarks || null })).filter(l => l.ledgerId && ['Dr', 'Cr'].includes(l.dc) && l.amount > 0);
const netDr = (lines) => r2(lines.reduce((a, l) => a + (l.dc === 'Dr' ? l.amount : -l.amount), 0));
router.ibVoucherIds = async () => { try { await ensureIb(); const r = await q('SELECT raiseVoucherId a, acceptVoucherId b, reverseVoucherId c FROM AccInterBranch'); return new Set(r.flatMap(o => [o.a, o.b, o.c]).filter(Boolean).map(Number)); } catch (e) { return new Set(); } };

router.get('/ib/branches', async (req, res) => {
  try { res.json(await q("SELECT branchCode code, branchName name, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, branchCode")); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/ib', async (req, res) => {
  try {
    await ensureIb();
    const w = []; const p = [];
    if (req.query.from) { w.push('i.date >= ?'); p.push(req.query.from); }
    if (req.query.to) { w.push('i.date <= ?'); p.push(req.query.to); }
    if (req.query.type) { w.push('i.type = ?'); p.push(req.query.type); }
    if (req.query.status) { w.push('i.status = ?'); p.push(req.query.status); }
    if (req.query.branch) { w.push('(i.fromBranch = ? OR i.toBranch = ?)'); p.push(req.query.branch, req.query.branch); }
    const rows = await q(`SELECT i.*, fl.name fromLedger, tl.name toLedger, rv.voucherNumber raiseNo, av.voucherNumber acceptNo, xv.voucherNumber reverseNo
      FROM AccInterBranch i LEFT JOIN AccountLedgers fl ON fl.id = i.fromLedgerId LEFT JOIN AccountLedgers tl ON tl.id = i.toLedgerId
      LEFT JOIN Vouchers rv ON rv.id = i.raiseVoucherId LEFT JOIN Vouchers av ON av.id = i.acceptVoucherId LEFT JOIN Vouchers xv ON xv.id = i.reverseVoucherId
      ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY i.date DESC, i.id DESC`, p);
    const names = new Map((await q('SELECT id, name FROM AccountLedgers')).map(l => [l.id, l.name]));
    res.json(rows.map(r => { let tl = []; try { tl = JSON.parse(r.toLines || '[]'); } catch (e) {} return { ...r, typeName: IB_TYPES[r.type] || r.type, toLines: tl.map(l => ({ ...l, ledgerName: names.get(Number(l.ledgerId)) || '' })) }; }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// raise: { type, fromBranch, toBranch, date, amount, fromLedgerId, toLines (journal), refNo, narration }
router.post('/ib', async (req, res) => {
  try {
    await ensureIb();
    const b = req.body || {}; const type = String(b.type || ''); const by = userOf(req) || null;
    if (!IB_TYPES[type]) return res.status(400).json({ error: 'Choose Bank Transfer, Journal or Cash Transfer' });
    const from = String(b.fromBranch || '').trim().toUpperCase(); const to = String(b.toBranch || '').trim().toUpperCase();
    if (!from || !to) return res.status(400).json({ error: 'Choose both branches' });
    if (from === to) return res.status(400).json({ error: 'From and to branch cannot be the same' });
    const date = String(b.date || '').slice(0, 10); if (!date) return res.status(400).json({ error: 'Enter the date' });
    if (await router.isMonthClosed(date)) return res.status(400).json({ error: 'Month ' + date.slice(0, 7) + ' is closed (Month Closing)' });
    const fromLedgerId = Number(b.fromLedgerId); if (!fromLedgerId) return res.status(400).json({ error: type === 'journal' ? 'Choose the account of your branch' : 'Choose the ' + (type === 'cash' ? 'cash' : 'bank') + ' account it goes from' });
    let toLines = []; let amount = r2(num(b.amount)); let side = 'Dr'; // side of Branch A/c-TO on the raising voucher
    if (type === 'journal') {
      toLines = cleanLines(b.toLines);
      if (!toLines.length) return res.status(400).json({ error: 'Add the entries the other branch should book' });
      if (toLines.some(l => l.ledgerId === fromLedgerId)) return res.status(400).json({ error: 'Your own account cannot be in the other branch\'s entries' });
      const n = netDr(toLines); if (!n) return res.status(400).json({ error: 'The other branch\'s entries add up to nil' });
      amount = Math.abs(n); side = n > 0 ? 'Dr' : 'Cr';
    }
    if (amount <= 0) return res.status(400).json({ error: 'Enter the amount' });
    const out = await sequelize.transaction(async (t) => {
      const brTo = await branchLedger(to, t);
      const nar = b.narration || `${IB_TYPES[type]} to ${to}${b.refNo ? ' - ref ' + b.refNo : ''}`;
      const v = await postVoucher(t, { division: (req.body || {}).division, base: type === 'journal' ? 'Journal' : 'Contra', date, narration: nar, refNo: b.refNo, branchCode: from, by,
        lines: [{ ledgerId: brTo, dc: side, amount, remarks: 'Inter branch to ' + to }, { ledgerId: fromLedgerId, dc: side === 'Dr' ? 'Cr' : 'Dr', amount, remarks: IB_TYPES[type] }] });
      const cnt = (await q('SELECT count(*) n FROM AccInterBranch', [], t))[0].n;
      const ibNo = 'IB/' + from + '/' + (Number(cnt) + 1); const s = new Date().toISOString();
      await x(`INSERT INTO AccInterBranch (ibNo, type, fromBranch, toBranch, date, amount, fromLedgerId, toLines, refNo, narration, status, raiseVoucherId, raisedBy, createdAt, updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [ibNo, type, from, to, date, amount, fromLedgerId, JSON.stringify(toLines), b.refNo || null, nar, 'Waiting', v.id, by, s, s], t);
      return { ibNo, voucherId: v.id, voucherNumber: v.vno };
    });
    res.json({ success: true, ...out });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// accept: { date, toLedgerId (bank / cash), toLines (journal, may be changed) }
router.post('/ib/:id/accept', async (req, res) => {
  try {
    await ensureIb();
    const ib = (await q('SELECT * FROM AccInterBranch WHERE id = ?', [req.params.id]))[0]; if (!ib) return res.status(404).json({ error: 'Transfer not found' });
    if (ib.status !== 'Waiting') return res.status(400).json({ error: 'This transfer is already ' + String(ib.status).toLowerCase() });
    const b = req.body || {}; const by = userOf(req) || null;
    const date = String(b.date || ib.date).slice(0, 10);
    if (date < ib.date) return res.status(400).json({ error: 'Accept date cannot be before the transfer date' });
    if (await router.isMonthClosed(date)) return res.status(400).json({ error: 'Month ' + date.slice(0, 7) + ' is closed (Month Closing)' });
    let lines; let toLedgerId = null;
    if (ib.type === 'journal') {
      const tl = cleanLines(b.toLines && b.toLines.length ? b.toLines : JSON.parse(ib.toLines || '[]'));
      const n = netDr(tl); if (Math.abs(Math.abs(n) - ib.amount) > 0.01) return res.status(400).json({ error: 'The entries must add up to ' + ib.amount + ' as raised' });
      lines = tl;
    } else {
      toLedgerId = Number(b.toLedgerId); if (!toLedgerId) return res.status(400).json({ error: 'Choose the ' + (ib.type === 'cash' ? 'cash' : 'bank') + ' account it is received in' });
      lines = [{ ledgerId: toLedgerId, dc: 'Dr', amount: ib.amount, remarks: IB_TYPES[ib.type] }];
    }
    const out = await sequelize.transaction(async (t) => {
      const brFrom = await branchLedger(ib.fromBranch, t);
      const n = netDr(lines);
      const v = await postVoucher(t, { division: (req.body || {}).division, base: ib.type === 'journal' ? 'Journal' : 'Contra', date, narration: `${IB_TYPES[ib.type]} from ${ib.fromBranch} (${ib.ibNo})${ib.refNo ? ' - ref ' + ib.refNo : ''}`, refNo: ib.refNo, branchCode: ib.toBranch, by,
        lines: [...lines, { ledgerId: brFrom, dc: n > 0 ? 'Cr' : 'Dr', amount: Math.abs(n), remarks: 'Inter branch from ' + ib.fromBranch }] });
      const s = new Date().toISOString();
      await x('UPDATE AccInterBranch SET status = ?, acceptVoucherId = ?, toLedgerId = ?, toLines = ?, decidedBy = ?, decidedAt = ?, updatedAt = ? WHERE id = ?',
        ['Accepted', v.id, toLedgerId, ib.type === 'journal' ? JSON.stringify(lines) : ib.toLines, by, s, s, ib.id], t);
      return { voucherId: v.id, voucherNumber: v.vno };
    });
    res.json({ success: true, ...out });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// return: { reason } - the sending voucher is reversed on the return date
router.post('/ib/:id/return', async (req, res) => {
  try {
    await ensureIb();
    const ib = (await q('SELECT * FROM AccInterBranch WHERE id = ?', [req.params.id]))[0]; if (!ib) return res.status(404).json({ error: 'Transfer not found' });
    if (ib.status !== 'Waiting') return res.status(400).json({ error: 'This transfer is already ' + String(ib.status).toLowerCase() });
    const reason = String((req.body && req.body.reason) || '').trim(); if (!reason) return res.status(400).json({ error: 'Enter why it is returned' });
    const by = userOf(req) || null; const date = String((req.body && req.body.date) || new Date().toISOString()).slice(0, 10) < ib.date ? ib.date : String((req.body && req.body.date) || new Date().toISOString()).slice(0, 10);
    if (await router.isMonthClosed(date)) return res.status(400).json({ error: 'Month ' + date.slice(0, 7) + ' is closed (Month Closing)' });
    const raise = await q('SELECT ledgerId, dc, amount, remarks FROM VoucherDetails WHERE voucherId = ?', [ib.raiseVoucherId]);
    const out = await sequelize.transaction(async (t) => {
      const v = await postVoucher(t, { division: (req.body || {}).division, base: ib.type === 'journal' ? 'Journal' : 'Contra', date, narration: `Reversal of ${ib.ibNo} - returned by ${ib.toBranch}: ${reason}`, refNo: ib.refNo, branchCode: ib.fromBranch, by,
        lines: raise.map(l => ({ ledgerId: l.ledgerId, dc: l.dc === 'Dr' ? 'Cr' : 'Dr', amount: l.amount, remarks: 'Reversal' })) });
      const s = new Date().toISOString();
      await x('UPDATE AccInterBranch SET status = ?, reverseVoucherId = ?, returnReason = ?, decidedBy = ?, decidedAt = ?, updatedAt = ? WHERE id = ?', ['Returned', v.id, reason, by, s, s, ib.id], t);
      return { voucherId: v.id, voucherNumber: v.vno };
    });
    res.json({ success: true, ...out });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
// balance between branches: each branch's Branch A/c ledgers
router.get('/ib/balances', async (req, res) => {
  try {
    const rows = await q(`SELECT l.id, l.name, coalesce(sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END), 0) net
      FROM AccountLedgers l LEFT JOIN VoucherDetails d ON d.ledgerId = l.id WHERE l.name LIKE 'BRANCH A/C - %' GROUP BY l.id ORDER BY l.name`);
    res.json(rows.map(r => ({ ...r, branch: r.name.replace('BRANCH A/C - ', ''), net: r2(r.net) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ OCR of a vendor bill (iCAFFE "OCR" on Trade Invoice)
// The bill (PDF or image) is read by Gemini, the same way the AWB and invoice screens already read documents; a PDF that
// carries text is read locally first (pdf-parse) and only that text is sent. If Gemini is not reachable the text is
// scanned with patterns (GSTIN, invoice no, date, GST amounts) so the form still gets what can be found.
// Nothing is saved here - the screen fills the Trade Invoice and the user checks it before Save.
const ocrUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
async function pdfText(buf) {
  try {
    const mod = require('pdf-parse');
    if (typeof mod === 'function') return (await mod(buf)).text || '';
    if (mod && typeof mod.default === 'function') return (await mod.default(buf)).text || '';
    if (mod && mod.PDFParse) { const p = new mod.PDFParse({ data: buf }); const r = await p.getText(); try { await p.destroy(); } catch (e) {} return (r && r.text) || ''; }
  } catch (e) { /* scanned PDF or unreadable - Gemini reads the file itself */ }
  return '';
}
const amtOf = (s) => { const n = parseFloat(String(s || '').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
const isoDate = (s) => {
  const t = String(s || '').trim(); if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const M = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  let m = t.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = t.match(/^(\d{1,2})[\/\-. ]([A-Za-z]{3})[A-Za-z]*[\/\-. ,]*(\d{2,4})$/); if (m && M[m[2].toUpperCase()]) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${String(M[m[2].toUpperCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
};
function billByPatterns(text) {
  const T = String(text || ''); const out = { lines: [] };
  const g = [...new Set((T.toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/g) || []))]; out.gstins = g; out.vendorGstin = g[0] || '';
  const inv = T.match(/(?:invoice|bill|inv)\s*(?:no|number|#)\.?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\/\-]{2,30})/i); if (inv) out.invoiceNo = inv[1];
  const dt = T.match(/(?:invoice|bill|inv)?\s*date\s*[:\-]?\s*(\d{1,2}[\/\-. ](?:\d{1,2}|[A-Za-z]{3,9})[\/\-. ,]*\d{2,4})/i); if (dt) out.invoiceDate = isoDate(dt[1]);
  const pick = (re) => { const m = T.match(re); return m ? amtOf(m[1]) : 0; };
  const pct = '(?:\\s*@?\\s*\\d+(?:\\.\\d+)?\\s*%)?';
  out.cgst = pick(new RegExp('CGST' + pct + '[^\\d\\n]{0,25}([\\d,]+\\.\\d{2})', 'i')); out.sgst = pick(new RegExp('(?:SGST|UTGST)' + pct + '[^\\d\\n]{0,25}([\\d,]+\\.\\d{2})', 'i')); out.igst = pick(new RegExp('IGST' + pct + '[^\\d\\n]{0,25}([\\d,]+\\.\\d{2})', 'i'));
  out.taxable = pick(/(?:taxable\s*(?:value|amount)|sub\s*total)[^\d\n]{0,20}([\d,]+\.\d{2})/i);
  out.total = pick(/(?:grand\s*total|total\s*(?:invoice\s*)?amount|net\s*payable|amount\s*payable)[^\d\n]{0,20}([\d,]+\.\d{2})/i);
  const hawb = T.match(/\b(?:HAWB|HBL|H\.?A\.?W\.?B)\s*(?:no)?\.?\s*[:\-]?\s*([A-Z0-9\-\/]{4,25})/i); if (hawb) out.hblNo = hawb[1];
  const mawb = T.match(/\b(?:MAWB|MBL|M\.?A\.?W\.?B)\s*(?:no)?\.?\s*[:\-]?\s*([0-9]{3}[\s\-]?[0-9]{4}\s?[0-9]{4}|[A-Z0-9\-\/]{6,25})/i); if (mawb) out.mblNo = mawb[1];
  if (out.taxable) { const gst = out.igst || (out.cgst + out.sgst); const rate = gst ? Math.round(gst / out.taxable * 100) : 0; out.lines = [{ description: 'As per bill', amount: out.taxable, gstRate: [0, 5, 12, 18, 28].reduce((a, r) => (Math.abs(r - rate) < Math.abs(a - rate) ? r : a), 18) }]; }
  return out;
}
const OCR_PROMPT = `You read Indian vendor bills (GST tax invoices) for a freight forwarder / customs broker that is the BUYER.
Return ONLY a JSON object, no markdown:
{"vendorName":"seller name","vendorGstin":"seller 15-char GSTIN","buyerGstin":"buyer GSTIN","invoiceNo":"","invoiceDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD or empty",
"placeOfSupply":"state name or code","currency":"INR or other","hblNo":"HAWB/HBL no if any","mblNo":"MAWB/MBL no if any","jobNo":"job / docket / reference no of the buyer if any",
"lines":[{"description":"charge name","sac":"SAC/HSN","qty":1,"rate":0,"amount":0,"gstRate":18}],
"taxable":0,"cgst":0,"sgst":0,"igst":0,"total":0}
Rules: amounts are numbers without commas; "amount" on a line is the taxable value before GST; gstRate is the total GST % (CGST+SGST or IGST) of that line; leave a field empty or 0 when it is not on the bill. Do not invent values.`;
router.post('/ocr-bill', ocrUpload.single('file'), async (req, res) => {
  try {
    const f = req.file; if (!f) return res.status(400).json({ error: 'Choose the bill - PDF or image, up to 10 MB' });
    if (!/^(application\/pdf|image\/(png|jpe?g|webp))$/i.test(f.mimetype)) return res.status(400).json({ error: 'Only PDF, PNG, JPG or WEBP bills can be read' });
    const warnings = []; let data = null; let source = '';
    const text = /pdf/i.test(f.mimetype) ? await pdfText(f.buffer) : '';
    try {
      require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
      if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const contents = text.replace(/\s+/g, '').length > 200
        ? OCR_PROMPT + '\n\nBill text:\n' + text.slice(0, 15000)
        : [{ role: 'user', parts: [{ text: OCR_PROMPT }, { inlineData: { data: f.buffer.toString('base64'), mimeType: f.mimetype } }] }];
      const r = await Promise.race([ai.models.generateContent({ model: 'gemini-2.5-flash', contents, config: { temperature: 0.1, responseMimeType: 'application/json' } }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('took more than 60 seconds')), 60000))]);
      data = JSON.parse(String(r.text || '').replace(/```json|```/g, '').trim()); source = 'gemini';
    } catch (e) {
      warnings.push('AI reading not available (' + e.message + ') - filled from the bill text only, check every field');
      if (!text.trim()) return res.status(422).json({ error: 'Could not read this bill: it has no text (scanned) and AI reading failed - ' + e.message, warnings });
      data = billByPatterns(text); source = 'text';
    }
    data = data || {}; data.lines = Array.isArray(data.lines) ? data.lines : [];
    data.invoiceDate = isoDate(data.invoiceDate) || data.invoiceDate || ''; data.dueDate = isoDate(data.dueDate) || '';
    data.vendorGstin = String(data.vendorGstin || '').toUpperCase().replace(/\s/g, '');
    ['taxable', 'cgst', 'sgst', 'igst', 'total'].forEach(k => { data[k] = amtOf(data[k]); });
    data.lines = data.lines.map(l => ({ description: String(l.description || '').trim(), sac: String(l.sac || '').replace(/\D/g, ''), qty: amtOf(l.qty) || 1, rate: amtOf(l.rate), amount: amtOf(l.amount) || amtOf(l.rate) * (amtOf(l.qty) || 1), gstRate: amtOf(l.gstRate) })).filter(l => l.amount);
    // vendor: GSTIN on the ledger or one of its addresses, then the name
    await ensureLedgerCols();
    let vendor = null;
    // 06-Nov-2026: only an account that fits on its own (GSTIN + name, or the exact name) - look-alikes are never guessed
    try {
      const vid = await lg.findOne({ gstin: data.vendorGstin, name: data.vendorName });
      if (vid) vendor = (await q('SELECT id, name FROM AccountLedgers WHERE id = ?', [vid]))[0] || null;
      if (!vendor && data.vendorGstin) { const viaAddr = await q(`SELECT DISTINCT l.id, l.name FROM AccLedgerAddresses a JOIN AccountLedgers l ON l.id = a.ledgerId WHERE upper(replace(a.gstin, ' ', '')) = ?`, [data.vendorGstin]); if (viaAddr.length === 1) vendor = viaAddr[0]; else if (viaAddr.length > 1) warnings.push('GSTIN ' + data.vendorGstin + ' is on more than one account (' + viaAddr.map(v => v.name).join(' / ') + ') - choose the party by hand'); }
    } catch (e) { warnings.push(e.message); }
    if (!vendor) warnings.push('Vendor ' + (data.vendorName || '') + (data.vendorGstin ? ' (' + data.vendorGstin + ')' : '') + ' is not in the ledgers - choose the party by hand or create the ledger');
    // charges: match each line to GST Charges by name for the SAC / expense ledger
    await ensureTable('gstcharges').catch(() => {});
    const charges = await q('SELECT chargeName, sacCode, gstRate, expenseLedgerId FROM AccGstCharges').catch(() => []);
    const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    data.lines = data.lines.map(l => { const c = charges.find(c => norm(c.chargeName) && (norm(l.description).includes(norm(c.chargeName)) || norm(c.chargeName).includes(norm(l.description)))); return c ? { ...l, charge: c.chargeName, sac: l.sac || c.sacCode || '', expenseLedgerId: c.expenseLedgerId || null } : { ...l, charge: l.description }; });
    // a line without its own GST % takes the bill's rate (GST total / taxable), rounded to a slab
    const gstTot = data.igst || (data.cgst + data.sgst); const base = data.taxable || data.lines.reduce((a, l) => a + l.amount, 0);
    if (gstTot && base) { const rt = gstTot / base * 100; const slab = [0, 5, 12, 18, 28].reduce((a, x) => (Math.abs(x - rt) < Math.abs(a - rt) ? x : a), 18); data.lines = data.lines.map(l => (l.gstRate ? l : { ...l, gstRate: slab })); }
    const sum = data.lines.reduce((a, l) => a + l.amount, 0);
    if (data.taxable && Math.abs(sum - data.taxable) > 1) warnings.push('Lines add up to ' + r2(sum) + ' but the bill says taxable ' + data.taxable + ' - check the charges');
    res.json({ source, data, vendor, warnings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ Bank Reconciliation (rebuilt screen)
// One bank / cash ledger: the lines of the period plus every older line not yet cleared by the bank on the "to" date,
// with the cheque / ref no and the other side of the voucher. Book balance, cheques issued but not presented and
// deposits not yet credited give the balance the bank statement should show. Clearing is saved per line
// (VoucherDetails.clearanceDate) through POST /api/vouchers/brs/reconcile, as before.
router.get('/brs', async (req, res) => {
  try {
    const id = Number(req.query.ledgerId); if (!id) return res.status(400).json({ error: 'Choose the bank account' });
    const led = (await q('SELECT id, name, openingBalance, balanceType FROM AccountLedgers WHERE id = ?', [id]))[0]; if (!led) return res.status(404).json({ error: 'Ledger not found' });
    const to = String(req.query.to || today()).slice(0, 10); const from = String(req.query.from || to.slice(0, 8) + '01').slice(0, 10);
    const sumTo = async (cond, p) => num((await q(`SELECT coalesce(sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END), 0) n FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID} AND d.ledgerId = ? AND ${cond}`, [id, ...p]))[0].n);
    const opening = r2(signedOpening(led) + await sumTo('v.date < ?', [from]));
    const closing = r2(signedOpening(led) + await sumTo('v.date <= ?', [to]));
    const rows = await q(`SELECT d.id, d.voucherId, d.dc, d.amount, d.clearanceDate, d.remarks, v.date, v.voucherNumber, v.refNo, v.narration, t.name typeName,
        (SELECT l2.name FROM VoucherDetails d2 JOIN AccountLedgers l2 ON l2.id = d2.ledgerId WHERE d2.voucherId = v.id AND d2.ledgerId <> d.ledgerId ORDER BY d2.amount DESC LIMIT 1) party
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE ${VALID} AND d.ledgerId = ? AND v.date <= ? AND (v.date >= ? OR d.clearanceDate IS NULL OR d.clearanceDate = '' OR d.clearanceDate > ?)
      ORDER BY v.date, v.id`, [id, to, from, to]);
    const open = (r) => !r.clearanceDate || String(r.clearanceDate).slice(0, 10) > to;
    const notPresented = r2(rows.filter(r => r.dc === 'Cr' && open(r)).reduce((a, r) => a + num(r.amount), 0));
    const notCredited = r2(rows.filter(r => r.dc === 'Dr' && open(r)).reduce((a, r) => a + num(r.amount), 0));
    res.json({ ledger: { id: led.id, name: led.name }, from, to, opening, closing, notPresented, notCredited,
      asPerBank: r2(closing + notPresented - notCredited),
      rows: rows.map(r => ({ ...r, amount: r2(r.amount), clearanceDate: r.clearanceDate ? String(r.clearanceDate).slice(0, 10) : null, older: r.date < from })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ dashboard (Accounts > Home)
// one call with everything the accounts dashboard shows for a financial year
const AGE_BUCKETS = [['0-30', 0, 30], ['31-60', 31, 60], ['61-90', 61, 90], ['91-180', 91, 180], ['180+', 181, 1e9]];
const daysBetween = (a, b) => Math.floor((new Date(b + 'T00:00:00Z') - new Date(String(a).slice(0, 10) + 'T00:00:00Z')) / 86400000);
const DASH_CACHE = new Map(); // dashboard per year + day, until vouchers / ledgers change
const DASH_RUN = new Map(); // 14-Nov-2026: a dashboard being worked out - a second user asking for the same one waits for it
router.get('/dashboard', async (req, res) => {
  let done = null; let ckey = '';
  try {
    ckey = [await dataVersion(), (await q('SELECT count(*) n, max(updatedAt) up FROM AccountLedgers'))[0].up, req.query.fyId || bs.fyId() || '', today(), bs.scopeKey(), (req.user && req.user.id) || ''].join('#');
    if (DASH_CACHE.has(ckey) && !req.query.refresh) return res.json(DASH_CACHE.get(ckey));
    if (DASH_RUN.has(ckey)) return res.json(await DASH_RUN.get(ckey));
    { let ok, bad; const pr = new Promise((a, b) => { ok = a; bad = b; }); pr.catch(() => {}); DASH_RUN.set(ckey, pr); done = { ok, bad }; }
    const fy = await fyOf(req.query.fyId);
    const asOn = today() < fy.endDate ? today() : fy.endDate;
    const { groups, descendants, byId, path } = await groupTree();
    const ids = (...names) => descendants(groups.filter(g => names.includes(g.name.toLowerCase().replace(/\s+/g, ' ').trim())).map(g => g.id));
    const natureSet = (n) => descendants(groups.filter(g => g.nature === n && !g.parentId).map(g => g.id));
    const debtorG = ids('sundry debtors'), creditorG = ids('sundry creditors'), bankG = ids('bank accounts', 'cash-in-hand', 'bank od a/c'), taxG = ids('duties & taxes');
    const incomeG = natureSet('Income'), expenseG = natureSet('Expenses');
    const ledgers = await q('SELECT l.id, l.name, l.groupId, l.openingBalance, l.balanceType, l.creditDays, l.creditLimit, l.gstin, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId');
    const closing = await movements(null, asOn);
    const inYear = await movements(fy.startDate, asOn);
    const bal = (l) => { const m = closing.get(l.id) || { dr: 0, cr: 0 }; return r2(signedOpening(l) + m.dr - m.cr); };
    const yr = (l) => inYear.get(l.id) || { dr: 0, cr: 0 };

    // voucher lines of the year (for months, GST, expenses) and all Dr/Cr lines of parties (for ageing)
    const lines = await rq(`SELECT d.ledgerId, d.dc, sum(d.amount) amount, substr(v.date, 1, 7) date FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        WHERE ${VALID} AND v.date >= ? AND v.date <= ? GROUP BY d.ledgerId, d.dc, substr(v.date, 1, 7)`, [fy.startDate, asOn]);
    const lg = new Map(ledgers.map(l => [l.id, l]));

    // months of the year
    const months = []; { const d = new Date(fy.startDate + 'T00:00:00Z'); for (let i = 0; i < 12; i++) { months.push({ m: d.toISOString().slice(0, 7), sales: 0, purchase: 0, receipt: 0, payment: 0, income: 0, expense: 0, gstOut: 0, gstIn: 0, tds: 0 }); d.setUTCMonth(d.getUTCMonth() + 1); } }
    const mm = new Map(months.map(x => [x.m, x]));
    const vts = await q(`SELECT substr(v.date, 1, 7) m, t.baseType, count(*) n, sum(v.totalAmount) amt FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE ${VALID} AND v.date >= ? AND v.date <= ? GROUP BY 1, 2`, [fy.startDate, asOn]);
    const byType = {};
    for (const r of vts) {
      byType[r.baseType] = byType[r.baseType] || { n: 0, amt: 0 }; byType[r.baseType].n += r.n; byType[r.baseType].amt = r2(byType[r.baseType].amt + num(r.amt));
      const x = mm.get(r.m); if (!x) continue;
      if (r.baseType === 'Sales') x.sales = r2(x.sales + num(r.amt)); if (r.baseType === 'Credit Note') x.sales = r2(x.sales - num(r.amt));
      if (r.baseType === 'Purchase') x.purchase = r2(x.purchase + num(r.amt)); if (r.baseType === 'Debit Note') x.purchase = r2(x.purchase - num(r.amt));
      if (r.baseType === 'Receipt') x.receipt = r2(x.receipt + num(r.amt)); if (r.baseType === 'Payment') x.payment = r2(x.payment + num(r.amt));
    }
    let gstOut = 0, gstIn = 0, tdsDed = 0; const expBy = new Map(), incBy = new Map();
    for (const d of lines) {
      const l = lg.get(d.ledgerId); if (!l) continue; const x = mm.get(String(d.date).slice(0, 7)); const a = num(d.amount); const s = d.dc === 'Dr' ? a : -a;
      if (incomeG.has(l.groupId)) { if (x) x.income = r2(x.income - s); incBy.set(l.id, r2((incBy.get(l.id) || 0) - s)); }
      if (expenseG.has(l.groupId)) { if (x) x.expense = r2(x.expense + s); expBy.set(l.id, r2((expBy.get(l.id) || 0) + s)); }
      if (taxG.has(l.groupId)) {
        const g0 = gstOut, i0 = gstIn, t0 = tdsDed; // 08-Nov-2026: also per month (GST / TDS due dates on the dashboard)
        // 07-Nov-2026: iCAFFE's heads are "CGST PAYABLE-9%" (output, by rate) and "CGST RECEIVABLE 9%" / "IGST RECEVIABLE 18%"
        // (input). The plain "IGST PAYABLE" / "CGST PAYABLE" heads without a rate carry the monthly set-off and payment, so
        // they are not counted as output tax. EagleView's own "Output ... GST" / "Input ... GST" names still count.
        const nm = String(l.name || '');
        const isGst = /\b(c|s|i|u)?gst\b|\bgst/i.test(nm);
        if (isGst && (/output|rcm tax payable/i.test(nm) || (/payable/i.test(nm) && /\d+(\.\d+)?\s*%/.test(nm)))) gstOut -= s;
        else if (isGst && /input|rcm input|rece?i?v(e|i)?able|receviable/i.test(nm)) gstIn += s;
        else if (/output|input/i.test(nm) && /tax/i.test(nm) && !/tds/i.test(nm)) { if (/output/i.test(nm)) gstOut -= s; else gstIn += s; }
        else if (/tds/i.test(nm) && d.dc === 'Cr') tdsDed += a; // TDS deducted in the year (Cr side); deposits are the Dr side
        if (x) { x.gstOut = r2(x.gstOut + gstOut - g0); x.gstIn = r2(x.gstIn + gstIn - i0); x.tds = r2(x.tds + tdsDed - t0); }
      }
    }
    const income = r2(months.reduce((t, x) => t + x.income, 0)), expense = r2(months.reduce((t, x) => t + x.expense, 0));

    // cash and bank
    const banks = ledgers.filter(l => bankG.has(l.groupId)).map(l => ({ id: l.id, name: l.name, group: l.groupName, balance: bal(l), inflow: r2(yr(l).dr), outflow: r2(yr(l).cr) })).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    // receivables / payables with ageing (closing balance set against the latest bills first)
    const inList = (set) => [...set].map(Number).filter(Number.isFinite).join(',') || '0';
    // 14-Nov-2026: the bills of the last 400 days first; only for the parties whose balance is older than that are the
    // earlier bills read (before, every bill of every party since 2022 - 1.7 lakh lines - was read each time)
    const partySql = (extra) => `SELECT d.ledgerId, d.dc, d.amount, v.date FROM AccountLedgers l CROSS JOIN VoucherDetails d ON d.ledgerId = l.id JOIN Vouchers v ON v.id = d.voucherId
        WHERE ${VALID} AND v.date <= ? ${extra} AND ((l.groupId IN (${inList(debtorG)}) AND d.dc = 'Dr') OR (l.groupId IN (${inList(creditorG)}) AND d.dc = 'Cr')) ORDER BY v.date DESC, v.id DESC`;
    const ageFrom = (() => { const t = new Date(asOn + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - 400); return t.toISOString().slice(0, 10); })();
    const pl = new Map(); const addPl = (rows) => { for (const d of rows) { if (!pl.has(d.ledgerId)) pl.set(d.ledgerId, []); pl.get(d.ledgerId).push(d); } };
    addPl(await rq(partySql('AND v.date >= ?'), [asOn, ageFrom]));
    {
      const short = [];
      for (const l of ledgers) {
        const side = debtorG.has(l.groupId) ? 'Dr' : creditorG.has(l.groupId) ? 'Cr' : null; if (!side) continue;
        const b = bal(l) * (side === 'Dr' ? 1 : -1); if (b < 0.005) continue;
        const got = (pl.get(l.id) || []).reduce((t, d) => t + num(d.amount), 0);
        if (got < b - 0.005) short.push(Number(l.id));
      }
      for (let i = 0; i < short.length; i += 500) {
        const ids = short.slice(i, i + 500).filter(Number.isFinite).join(',');
        if (ids) addPl(await rq(partySql(`AND v.date < ? AND d.ledgerId IN (${ids})`), [asOn, ageFrom]));
      }
    }
    const ageSide = (set, side) => {
      const buckets = AGE_BUCKETS.map(([k]) => ({ bucket: k, amount: 0, parties: 0 }));
      const parties = []; let advances = 0, advParties = 0, total = 0, ageWeighted = 0;
      for (const l of ledgers.filter(z => set.has(z.groupId))) {
        const b = bal(l) * (side === 'Dr' ? 1 : -1);
        if (b < -0.005) { advances = r2(advances - b); advParties++; continue; }
        if (b < 0.005) continue;
        total = r2(total + b);
        const cd = num(l.creditDays) || 30;
        let left = b; const row = { id: l.id, name: l.name, balance: r2(b), overdue: 0, notDue: 0, oldestDays: 0, avgDays: 0, bills: 0, creditDays: cd, creditLimit: num(l.creditLimit), gstin: l.gstin || '', buckets: AGE_BUCKETS.map(() => 0), due30: 0 };
        let w = 0;
        const put = (amt, age) => {
          const i = AGE_BUCKETS.findIndex(([, a, z]) => age >= a && age <= z);
          row.buckets[i] = r2(row.buckets[i] + amt); buckets[i].amount = r2(buckets[i].amount + amt);
          if (age > cd) row.overdue = r2(row.overdue + amt); else row.notDue = r2(row.notDue + amt);
          if (age <= cd && cd - age <= 30) row.due30 = r2(row.due30 + amt); // 08-Nov-2026: falls due in the next 30 days
          row.oldestDays = Math.max(row.oldestDays, age); w += amt * age; row.bills++;
        };
        for (const d of (pl.get(l.id) || []).filter(z => z.dc === side)) {
          if (left <= 0.005) break; const take = Math.min(left, num(d.amount)); left -= take;
          put(take, daysBetween(d.date, asOn));
        }
        if (left > 0.005) put(left, Math.max(181, daysBetween(fy.startDate, asOn) + 1)); // opening balance: older than the year
        row.avgDays = Math.round(w / b);
        ageWeighted += w;
        row.buckets.forEach((v, i) => { if (v) buckets[i].parties++; });
        parties.push(row);
      }
      parties.sort((a, b) => b.balance - a.balance);
      const overdue = r2(parties.reduce((t, p) => t + p.overdue, 0));
      return { total, advances, advParties, overdue, notDue: r2(total - overdue), due30: r2(parties.reduce((t, p) => t + p.due30, 0)), overduePct: total ? Math.round(overdue / total * 1000) / 10 : 0,
        avgDays: total ? Math.round(ageWeighted / total) : 0, count: parties.length, overdueParties: parties.filter(p => p.overdue > 0.005).length,
        buckets, parties: parties.slice(0, 300), top: parties.slice(0, 8), overLimit: parties.filter(p => p.creditLimit && p.balance > p.creditLimit).length };
    };
    const receivable = ageSide(debtorG, 'Dr'), payable = ageSide(creditorG, 'Cr');

    // top expense / income heads
    const top = (m) => [...m.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, v]) => ({ id, name: (lg.get(id) || {}).name || '#' + id, amount: v }));

    // tax position (closing balances of Duties & Taxes)
    const taxes = ledgers.filter(l => taxG.has(l.groupId)).map(l => ({ id: l.id, name: l.name, balance: bal(l) })).filter(t => Math.abs(t.balance) > 0.005);

    // control
    const one = async (sql, p = []) => { try { return (await q(sql, p))[0] || {}; } catch (e) { return {}; } };
    const one1 = async (sql, p = []) => { try { return (await rq(sql, p))[0] || {}; } catch (e) { return {}; } };
    const pend = await q(`SELECT v.id, v.voucherNumber, v.date, v.totalAmount, t.name typeName, t.baseType, v.createdByName FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE coalesce(v.status, 'Pending') NOT IN ('Approved', 'Rejected') ORDER BY v.date DESC LIMIT 6`).catch(() => []);
    const pendN = await one(`SELECT count(*) n, sum(totalAmount) amt FROM Vouchers WHERE coalesce(status, 'Pending') NOT IN ('Approved', 'Rejected')`);
    const recent = await q(`SELECT v.id, v.voucherNumber, v.date, v.totalAmount, v.status, t.name typeName, t.baseType,
        (SELECT l.name FROM VoucherDetails d JOIN AccountLedgers l ON l.id = d.ledgerId WHERE d.voucherId = v.id ORDER BY d.amount DESC LIMIT 1) party
        FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId ORDER BY v.id DESC LIMIT 8`).catch(() => []);
    const unbalanced = await one1(`SELECT count(*) n FROM (SELECT d.voucherId, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) diff FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        WHERE v.date >= ? AND v.date <= ? GROUP BY d.voucherId HAVING abs(diff) > 0.01)`, [fy.startDate, fy.endDate]);
    let closedMonths = 0; try { await ensureMonths(); closedMonths = (await one('SELECT count(*) n FROM AccMonthClosings WHERE isClosed = 1 AND month >= ? AND month <= ?', [fy.startDate.slice(0, 7), fy.endDate.slice(0, 7)])).n || 0; } catch (e) {}
    const noGstin = ledgers.filter(l => (debtorG.has(l.groupId) || creditorG.has(l.groupId)) && !l.gstin).length;
    const rejected = await one(`SELECT count(*) n FROM Vouchers WHERE status = 'Rejected' AND date >= ? AND date <= ?`, [fy.startDate, asOn]);

    const cash = r2(banks.reduce((t, b) => t + b.balance, 0));
    // 08-Nov-2026: management view - profit before tax & transfers, gross margin, reimbursable, divisions, branches,
    // customers, unbilled jobs, billing vs collection, next 30 days, last year, budget, due dates, bank reconciliation
    let mgmt = null;
    try {
      mgmt = await require('./accountsDashMgmt')({ q: rq, VALID, fy, asOn, ledgers, groups, byId, path, debtorG, creditorG, bankG, incomeG, expenseG, receivable, payable, months, cash, req });
    } catch (e) { console.error('dashboard mgmt', e); mgmt = { error: e.message }; }
    const out = ({
      fy: { id: fy.id, name: fy.name || fy.code, startDate: fy.startDate, endDate: fy.endDate }, asOn,
      counts: { groups: groups.length, ledgers: ledgers.length, vouchers: Object.values(byType).reduce((t, v) => t + v.n, 0), parties: ledgers.filter(l => debtorG.has(l.groupId) || creditorG.has(l.groupId)).length },
      kpi: {
        sales: r2((byType.Sales || {}).amt || 0) - r2((byType['Credit Note'] || {}).amt || 0), purchase: r2((byType.Purchase || {}).amt || 0) - r2((byType['Debit Note'] || {}).amt || 0),
        receipts: r2((byType.Receipt || {}).amt || 0), payments: r2((byType.Payment || {}).amt || 0), income, expense, profit: r2(income - expense),
        margin: income ? Math.round((income - expense) / income * 1000) / 10 : null, cash, receivable: receivable.total, payable: payable.total,
        netWorking: r2(cash + receivable.total - payable.total), gstOut: r2(gstOut), gstIn: r2(gstIn), gstNet: r2(gstOut - gstIn), tds: r2(tdsDed),
        dso: receivable.total && income ? Math.round(receivable.total / (income / Math.max(1, daysBetween(fy.startDate, asOn) + 1))) : null,
      },
      months, byType, banks, receivable, payable, topExpenses: top(expBy), topIncome: top(incBy), taxes,
      control: { pending: pendN.n || 0, pendingAmt: r2(pendN.amt || 0), pendingList: pend, rejected: rejected.n || 0, unbalanced: unbalanced.n || 0, closedMonths, noGstin, overLimit: receivable.overLimit },
      recent, mgmt,
    });
    if (DASH_CACHE.size > 10) DASH_CACHE.clear(); DASH_CACHE.set(ckey, out);
    if (done) { done.ok(out); DASH_RUN.delete(ckey); }
    res.json(out);
  } catch (e) {
    if (done) { done.bad(e); DASH_RUN.delete(ckey); }
    res.status(500).json({ error: e.message });
  }
});

// one ledger with its current balance (shown next to the bank / party on the voucher screens)
router.get('/ledger-balance/:id', async (req, res) => {
  try {
    await ensureLedgerCols();
    const l = (await q('SELECT l.id, l.name, l.openingBalance, l.balanceType, l.gstin, l.state, l.pan, l.creditDays, l.isBlacklisted, l.blacklistReason, l.msmeNo, l.msmeAgreementDays, l.isActive, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.id = ?', [req.params.id]))[0];
    if (!l) return res.status(404).json({ error: 'Ledger not found' });
    const m = (await q(`SELECT sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID} AND d.ledgerId = ?`, [l.id]))[0] || {};
    const bal = r2(signedOpening(l) + num(m.dr) - num(m.cr));
    res.json({ ...l, balance: Math.abs(bal), side: bal < 0 ? 'Cr' : 'Dr' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ search (ledgers, vouchers)
router.get('/search', async (req, res) => {
  try {
    const text = String(req.query.q || '').trim();
    if (text.length < 2) return res.json({ ledgers: [], vouchers: [] });
    const like = '%' + text + '%';
    const ledgers = await q(`SELECT l.id, l.name, l.gstin, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId
        WHERE l.name LIKE ? OR l.gstin LIKE ? OR l.pan LIKE ? ORDER BY CASE WHEN l.name LIKE ? THEN 0 ELSE 1 END, l.name LIMIT 8`, [like, like, like, text + '%']);
    const amt = Number(text.replace(/,/g, ''));
    const vouchers = await q(`SELECT v.id, v.voucherNumber, v.date, v.refNo, v.jobNo, v.totalAmount, t.name typeName, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
        WHERE v.voucherNumber LIKE ? OR v.refNo LIKE ? OR v.jobNo LIKE ? OR v.narration LIKE ? ${isFinite(amt) && amt > 0 ? 'OR abs(v.totalAmount - ?) < 0.01' : ''}
        ORDER BY v.date DESC LIMIT 8`, isFinite(amt) && amt > 0 ? [like, like, like, like, amt] : [like, like, like, like]);
    res.json({ ledgers, vouchers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ------------------------------------------------------------------ merge account
router.post('/merge-ledgers', async (req, res) => {
  // 06-Nov-2026: moving one party's entries onto another account is for an admin only, and is written to AccLedgerAudit
  if (String((req.user && req.user.role) || '').toLowerCase() !== 'admin') return res.status(403).json({ error: 'Only an admin can merge accounts' });
  const fromId = Number(req.body && req.body.fromId), toId = Number(req.body && req.body.toId);
  if (!fromId || !toId || fromId === toId) return res.status(400).json({ error: 'Choose two different ledgers' });
  const t = await sequelize.transaction();
  try {
    const [a] = await q('SELECT * FROM AccountLedgers WHERE id = ?', [fromId], t); const [b] = await q('SELECT * FROM AccountLedgers WHERE id = ?', [toId], t);
    if (!a || !b) throw new Error('Ledger not found');
    const moved = await x('UPDATE VoucherDetails SET ledgerId = ? WHERE ledgerId = ?', [toId, fromId], t);
    await x('UPDATE VoucherAllocations SET ledgerId = ? WHERE ledgerId = ?', [toId, fromId], t).catch(() => {});
    await x('UPDATE InvoiceItems SET chargeLedgerId = ? WHERE chargeLedgerId = ?', [toId, fromId], t).catch(() => {});
    const op = signedOpening(a) + signedOpening(b);
    await x('UPDATE AccountLedgers SET openingBalance = ?, balanceType = ?, updatedAt = ? WHERE id = ?', [Math.abs(r2(op)), op < 0 ? 'Cr' : 'Dr', new Date().toISOString(), toId], t);
    await x('DELETE FROM AccountLedgers WHERE id = ?', [fromId], t);
    await lg.auditLedger(t, toId, 'MERGED', userOf(req), { mergedFrom: a }, { name: b.name, lines: (moved && moved[1] && moved[1].changes) || 0 });
    await t.commit();
    clearOldMoves(); // the earlier years' totals per ledger changed
    res.json({ ok: true, merged: a.name, into: b.name, lines: (moved && moved[1] && moved[1].changes) || 0 });
  } catch (e) { await t.rollback(); res.status(500).json({ error: e.message }); }
});

// 05-Nov-2026: every accounts table is made when the backend starts (before, each was made the first time its screen
// was used). CREATE TABLE IF NOT EXISTS / ADD COLUMN only - nothing is dropped or changed.
setTimeout(async () => {
  const done = []; const failed = [];
  const step = async (name, f) => { try { await f(); done.push(name); } catch (e) { failed.push(name + ': ' + e.message); } };
  for (const k of Object.keys(MASTERS)) await step(MASTERS[k].table, () => ensureTable(k));
  await step('AccMonthClosings', ensureMonths);
  await step('AccLedgerAddresses / AccLedgerBanks / AccLedgerOpenings', ensureLedgerCols);
  await step('AccChequeLeaves', () => ensureSimple('AccChequeLeaves', 'bookId INTEGER, chequeNo TEXT, status TEXT, reason TEXT, byUser TEXT'));
  await step('AccTdsChallans', () => ensureSimple('AccTdsChallans', 'month TEXT, section TEXT, challanNo TEXT, bsrCode TEXT, paidOn TEXT, amount REAL, interest REAL, remarks TEXT, byUser TEXT'));
  await step('AccVoucherAudit', () => ensureSimple('AccVoucherAudit', AUDIT_COLS));
  await step('AccPurchaseInfo', ensurePinfo);
  await step('AccInterBranch', ensureIb);
  await step('indexes', async () => {
    await x('CREATE INDEX IF NOT EXISTS idx_accaudit_voucher ON AccVoucherAudit (voucherId)');
    await x('CREATE INDEX IF NOT EXISTS idx_accpinfo_voucher ON AccPurchaseInfo (voucherId)');
    await x('CREATE INDEX IF NOT EXISTS idx_accib_status ON AccInterBranch (status, date)');
    // 06-Nov-2026: set-offs, ledger addresses / banks and the outstanding snapshot are read per ledger / voucher
    await x('CREATE INDEX IF NOT EXISTS idx_valloc_ledger ON VoucherAllocations (ledgerId)').catch(() => {});
    await x('CREATE INDEX IF NOT EXISTS idx_valloc_voucher ON VoucherAllocations (voucherId)').catch(() => {});
    await x('CREATE INDEX IF NOT EXISTS idx_valloc_against ON VoucherAllocations (againstVoucherId)').catch(() => {});
    await x('CREATE INDEX IF NOT EXISTS idx_accledaddr_ledger ON AccLedgerAddresses (ledgerId)').catch(() => {});
    await x('CREATE INDEX IF NOT EXISTS idx_accledbank_ledger ON AccLedgerBanks (ledgerId)').catch(() => {});
    await x('CREATE INDEX IF NOT EXISTS idx_vdocs_voucher ON VoucherDocuments (voucherId)').catch(() => {});
    await x('CREATE INDEX IF NOT EXISTS idx_vouchers_branch_date ON Vouchers (branchCode, date)').catch(() => {});
  });
  console.log('[accounts-hub] tables ready: ' + done.length + (failed.length ? ' - NOT made: ' + failed.join('; ') : ''));
}, 4000);
// 07-Nov-2026: Balance Sheet / Profit & Loss / Trial Balance screens. One group tree with every ledger's opening (as at From),
// Dr / Cr of the period and closing (as at To), in the branch scope of the top bar. The screen totals it per group, so the
// same data can be shown, printed and exported at any level (main groups, all groups, groups + ledgers).
router.get('/fin-statement', async (req, res) => {
  try {
    const fy = await fyOf(req.query.fyId);
    const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
    const to = iso(req.query.to) || (today() < fy.endDate ? today() : fy.endDate);
    const from = iso(req.query.from) || fy.startDate;
    const { groups, byId } = await groupTree();
    const ledgers = await q('SELECT id, name, groupId, openingBalance, balanceType FROM AccountLedgers');
    const before = await movements(null, dayBefore(from));
    const inP = await movements(from, to);
    // 09-Nov-2026: income and expense accounts start every financial year at 0 (as in iCAFFE / Tally): their opening is
    // only what was booked from 1 April of the year of "from" up to the day before. Before, the opening of e.g. Direct
    // Incomes was every year since Apr-2022 (693 crore), so the Trial Balance's opening / closing of the P&L heads did
    // not look like iCAFFE's. The earlier years' net (the books' carried-forward profit sits in PROFIT AND LOSS A/C)
    // is shown on one line, "Difference in opening balances", so the statement still tallies.
    const natureOf = new Map();
    const nat = (gid) => { if (natureOf.has(gid)) return natureOf.get(gid); let g = byId.get(gid), n = 0, v = null; while (g && n++ < 20) { if (g.nature) v = g.nature; if (!g.parentId) break; g = byId.get(g.parentId); } natureOf.set(gid, v); return v; };
    const fyStart = (from.slice(5) >= '04-01' ? from.slice(0, 4) : String(Number(from.slice(0, 4)) - 1)) + '-04-01';
    const beforeYear = fyStart < from ? await movements(null, dayBefore(fyStart)) : before;
    const out = []; let carried = 0;
    for (const l of ledgers) {
      const b = before.get(l.id) || { dr: 0, cr: 0 }; const m = inP.get(l.id) || { dr: 0, cr: 0 };
      let op = r2(signedOpening(l) + b.dr - b.cr); const dr = r2(m.dr), cr = r2(m.cr);
      if (/^(Income|Expenses)$/.test(nat(l.groupId) || '')) {
        const y = beforeYear.get(l.id) || { dr: 0, cr: 0 };
        const prev = r2(signedOpening(l) + y.dr - y.cr); // earlier years
        if (prev) { carried += prev; op = r2(op - prev); }
      }
      if (!op && !dr && !cr) continue;
      out.push({ id: l.id, name: l.name, g: l.groupId, op, dr, cr, cl: r2(op + dr - cr) });
    }
    carried = r2(carried);
    if (carried) {
      const pl = ledgers.find(l => /^profit\s*(and|&)\s*loss\s*a\/?c/i.test(String(l.name || '').trim()));
      const g = (pl && pl.groupId) || (groups.find(x => !x.parentId && x.nature === 'Liabilities') || {}).id;
      out.push({ id: -1, name: 'Difference in opening balances (income / expense of earlier years)', g, op: carried, dr: 0, cr: 0, cl: carried });
    }
    res.json({ from, to, fy: { id: fy.id, name: fy.name || fy.code, startDate: fy.startDate, endDate: fy.endDate },
      groups: groups.map(g => ({ id: g.id, name: g.name, p: g.parentId || null, n: g.nature })), ledgers: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
