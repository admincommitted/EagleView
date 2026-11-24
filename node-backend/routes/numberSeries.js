// /api/number-series - Settings > Number Series (iCAFFE). 05-Nov-2026.
// Every document number (vouchers, GST invoices, dockets) comes from here, in iCAFFE's format, branch + division + year.
const express = require('express');
const router = express.Router();
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');
const ns = require('../utils/numberSeries');
const { requireAdmin } = require('../middleware/auth');

const q = (sql, p = []) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT });
const x = (sql, p = []) => sequelize.query(sql, { replacements: p });
const bad = (res, m, c = 400) => res.status(c).json({ error: m });
const userOf = (req) => (req.user && (req.user.fullName || req.user.username)) || '';
const FORMAT_OK = (f) => /\{N\}/.test(f) && f.length <= 40 && !/[\\?#%"'<>|*\s]/.test(f.replace(/\{(N|YY|FY|DIV)\}/g, '')) && !(f.match(/\{[^}]*\}/g) || []).some(t => !/^\{(N|YY|FY|DIV)\}$/.test(t));

router.get('/', async (req, res) => {
  try {
    await ns.ensure();
    const fy = ns.fyCodeOf(req.query.date);
    const rows = await q('SELECT * FROM NumberSeries ORDER BY branchCode, division, docType, fyCode DESC');
    const today = new Date().toISOString().slice(0, 10);
    const out = [];
    for (const r of rows) out.push({ ...r, label: (ns.DOCS[r.docType] || {}).label || r.docType, sample: ns.render(r, r.nextNo, today, r.division || 'AE'), next: r.fyCode !== fy ? null : r.division ? await ns.peek(r.docType, { branchCode: r.branchCode, division: r.division, date: today }) : ns.render(r, r.nextNo, today, 'AE') + '  (AE / AI / SE / SI share it)' });
    const branches = await q("SELECT branchCode, branchName, icaffeCode, stateCode FROM CompanyBranches ORDER BY isDefault DESC, branchCode").catch(() => []);
    res.json({ fy, rows: out, docs: Object.entries(ns.DOCS).map(([k, v]) => ({ id: k, label: v.label })), divisions: ns.DIVS, branches });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// the number the next document will get
router.get('/peek', async (req, res) => {
  try { res.json({ no: await ns.peek(String(req.query.doc || ''), { branchCode: req.query.branch || await ns.defaultBranch(), division: ns.divOf(req.query.division || req.query.jobNo), date: req.query.date }) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
const clean = (b) => ({ docType: String(b.docType || '').trim(), branchCode: String(b.branchCode || '').trim().toUpperCase(), division: String(b.division || '').trim().toUpperCase(),
  fyCode: String(b.fyCode || '').trim(), format: String(b.format || '').trim(), pad: parseInt(b.pad, 10) || 0, nextNo: parseInt(b.nextNo, 10), isActive: b.isActive === false || b.isActive === 0 ? 0 : 1 });
function check(v) {
  if (!ns.DOCS[v.docType]) return 'Choose the document';
  if (!v.branchCode) return 'Branch is required';
  if (v.division && !ns.DIVS.includes(v.division)) return 'Division must be AE, AI, SE, SI or blank (all divisions)';
  if (!/^\d{4}$/.test(v.fyCode)) return 'Financial year like 2627';
  if (!FORMAT_OK(v.format)) return 'Format must have {N}; tags {N} {YY} {FY} {DIV}; letters, digits, / - _ . only (max 40)';
  if (v.pad < 0 || v.pad > 10) return 'Digits 0 - 10';
  if (!Number.isInteger(v.nextNo) || v.nextNo < 1 || v.nextNo > 99999999) return 'Next number must be 1 or more';
  return null;
}
router.post('/', requireAdmin, async (req, res) => {
  try {
    await ns.ensure(); const v = clean(req.body || {}); const e = check(v); if (e) return bad(res, e);
    const s = new Date().toISOString();
    await x('INSERT INTO NumberSeries (docType, branchCode, division, fyCode, format, pad, nextNo, source, isActive, modifiedBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [v.docType, v.branchCode, v.division, v.fyCode, v.format, v.pad, v.nextNo, 'added by hand', v.isActive, userOf(req) || null, s, s]);
    res.json({ ok: true });
  } catch (e) { res.status(/UNIQUE/.test(e.message) ? 409 : 500).json({ error: /UNIQUE/.test(e.message) ? 'This document, branch, division and year already has a series' : e.message }); }
});
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    await ns.ensure(); const old = (await q('SELECT * FROM NumberSeries WHERE id = ?', [Number(req.params.id)]))[0]; if (!old) return bad(res, 'Not found', 404);
    const v = clean({ ...old, ...req.body }); const e = check(v); if (e) return bad(res, e);
    // a next number that is already in the books would give a duplicate
    const no = ns.render(v, v.nextNo, '20' + v.fyCode.slice(0, 2) + '-06-01', v.division || 'AE');
    const d = ns.DOCS[v.docType];
    if (d && (await q(`SELECT 1 FROM ${d.table} WHERE ${d.col} = ? LIMIT 1`, [no]).catch(() => [])).length) return bad(res, no + ' is already used - give a higher next number');
    await x('UPDATE NumberSeries SET format = ?, pad = ?, nextNo = ?, isActive = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?', [v.format, v.pad, v.nextNo, v.isActive, userOf(req) || null, new Date().toISOString(), old.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/branch', requireAdmin, async (req, res) => {
  try {
    await ns.ensure(); const b = req.body || {};
    await x('UPDATE CompanyBranches SET icaffeCode = ?, stateCode = ?, updatedAt = ? WHERE branchCode = ?', [String(b.icaffeCode || '').toUpperCase() || null, String(b.stateCode || '').toUpperCase() || null, new Date().toISOString(), String(b.branchCode || '').toUpperCase()]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
