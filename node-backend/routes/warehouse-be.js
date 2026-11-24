/**
 * warehouse-be.js
 * GET /api/warehouse-be/list  — Fetch all WAREHOUSING BEs for a given importer or IEC
 * GET /api/warehouse-be/by-id/:id — Get WH job full details for Ex-Bond linking
 */

const express = require('express');
const router  = express.Router();
const { Op }  = require('sequelize');
const ImportJob     = require('../models/ImportJob');
const ImportInvoice = require('../models/ImportInvoice');

// GET /api/warehouse-be/list?iecCode=..&importerName=..&customsPort=..&excludeJobId=..
// All warehousing (W) BEs, newest first. Each row says whether it matches this job's importer / port; the screen shows
// the matching ones first. 28-Oct-2026: the old filters looked at columns that are empty for screen-made jobs (the
// importer name only matched through the party master, the port compared a port NAME with a code), so the list was
// always empty. Job fields are read through extendedData too.
const { unpackExtra } = require('../utils/extraFields');
const up = (j) => unpackExtra(j, 'extendedData');

// Quantities of a WH BE already cleared by its ex-bond jobs, by "inv sr/item sr" (30-Oct-2026).
// Only ex-bonds that reached customs count (filed / accepted through the API, or with a BE No / OOC date typed in);
// drafts and rejected ones are reported separately (draft) so the screen can warn, but they do not reduce the balance.
// Shared with the import save route, which refuses an ex-bond quantity above the balance.
async function balancesFor(whJob, excludeJobId) {
  const ImportItem = require('../models/ImportItem');
  const exJobs = await ImportJob.findAll({ where: { inBondJobId: { [Op.in]: [String(whJob.id), whJob.id] }, boeType: { [Op.in]: ['EX_BOND', 'X'] } },
    include: [{ model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] }] });
  const filed = (ej) => ['Filed', 'Accepted', 'Amended'].includes(String(ej.icegateStatus || '')) || !!String(ej.beNo || '').trim() || !!String(ej.oocDate || '').trim();
  const byKey = {}; let filedCount = 0, draftCount = 0;
  for (const ej of exJobs) {
    if (excludeJobId && String(ej.id) === String(excludeJobId)) continue;
    const isFiled = filed(ej); if (isFiled) filedCount++; else draftCount++;
    (ej.invoices || []).forEach((inv, k) => (inv.items || []).forEach(it0 => { const it = up(it0);
      const key = `${it.invSrNo || k + 1}/${it.itemSrNo || it.itemNo}`; const q = parseFloat(it.quantity || it.qty) || 0;
      const b = byKey[key] || (byKey[key] = { cleared: 0, draft: 0 }); if (isFiled) b.cleared += q; else b.draft += q; }));
  }
  return { byKey, filedCount, draftCount };
}
router.balancesFor = balancesFor;
// 22-Nov-2026: the same figures for the import SAVE route, read with one light query. balancesFor() loads the WH job and
// every ex-bond job of it with all their items and the items' extendedData (about 1.5 MB per 200-item job) - on each save
// of an ex-bond, i.e. on every item Modify: 1.5 s of a 2.3 s save here, more on the live disk. This reads only the four
// values needed per item (inv sr, item sr / no, quantity), a column first and extendedData when the column is empty,
// exactly as unpackExtra does. Returns null when the WH job is not in our system.
async function lightBalances(whJobId, excludeJobId) {
  const { sequelize } = require('../db'); const { QueryTypes } = require('sequelize');
  const wh = await ImportJob.findByPk(whJobId, { attributes: ['id', 'jobNo'] });
  if (!wh) return null;
  const has = (m, c) => !!(m.rawAttributes && m.rawAttributes[c]);
  const ex = await ImportJob.findAll({ where: { inBondJobId: { [Op.in]: [String(wh.id), wh.id] }, boeType: { [Op.in]: ['EX_BOND', 'X'] } },
    attributes: ['id', ...['icegateStatus', 'beNo', 'oocDate'].filter(c => has(ImportJob, c))] });
  const filed = (ej) => ['Filed', 'Accepted', 'Amended'].includes(String(ej.icegateStatus || '')) || !!String(ej.beNo || '').trim() || !!String(ej.oocDate || '').trim();
  const ids = [wh.id, ...ex.map(e => e.id)];
  const cols = new Set((await sequelize.query('PRAGMA table_info(ImportItems)', { type: QueryTypes.SELECT })).map(c => c.name));
  const pick = (name) => { const j = `CASE WHEN json_valid(it.extendedData) THEN json_extract(it.extendedData, '$.${name}') END`; return (cols.has(name) ? `COALESCE(it.${name}, ${j})` : j) + ` AS ${name}`; };
  const rows = await sequelize.query(
    `SELECT inv.importJobId AS jid, inv.id AS iid, ${['invSrNo', 'itemSrNo', 'itemNo', 'quantity', 'qty'].map(pick).join(', ')}
       FROM ImportItems it JOIN ImportInvoices inv ON inv.id = it.importInvoiceId
      WHERE inv.importJobId IN (${ids.map(() => '?').join(',')}) ORDER BY inv.importJobId, inv.id, it.id`, { replacements: ids, type: QueryTypes.SELECT });
  const invIdx = {}; const nth = (jid, iid) => { const m = invIdx[jid] || (invIdx[jid] = new Map()); if (!m.has(iid)) m.set(iid, m.size + 1); return m.get(iid); };
  const keyOf = (r) => `${r.invSrNo || nth(r.jid, r.iid)}/${r.itemSrNo || r.itemNo}`; const qOf = (r) => parseFloat(r.quantity || r.qty) || 0;
  const whQty = {}; const byKey = {}; let filedCount = 0, draftCount = 0; const state = {};
  for (const ej of ex) { if (excludeJobId && String(ej.id) === String(excludeJobId)) continue; const f = filed(ej); state[ej.id] = f ? 'f' : 'd'; if (f) filedCount++; else draftCount++; }
  for (const r of rows) {
    if (String(r.jid) === String(wh.id)) { whQty[keyOf(r)] = qOf(r); continue; }
    const st = state[r.jid]; if (!st) continue;
    const b = byKey[keyOf(r)] || (byKey[keyOf(r)] = { cleared: 0, draft: 0 }); if (st === 'f') b.cleared += qOf(r); else b.draft += qOf(r);
  }
  return { id: wh.id, jobNo: wh.jobNo, whQty, byKey, filedCount, draftCount };
}
router.lightBalances = lightBalances;
const rowsOf = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
const U = (v) => String(v || '').trim().toUpperCase();
const portOf = (j) => U(j.portCode || j.autoField_2 || (/^[A-Z]{2}[A-Z0-9]{3,4}$/.test(U(j.autoField_1)) ? j.autoField_1 : ''));

router.get('/list', async (req, res) => {
  try {
    const { iecCode, importerName, customsPort, excludeJobId } = req.query;
    const jobs = await ImportJob.findAll({
      where: { boeType: { [Op.in]: ['WAREHOUSING', 'WAREHOUSE', 'W'] } },
      include: [{ model: ImportInvoice, as: 'invoices', required: false }],
      order: [['createdAt', 'DESC']], limit: 500,
    });
    const ids = jobs.map(j => j.id);
    const exb = ids.length ? await ImportJob.findAll({ where: { inBondJobId: { [Op.in]: ids.map(String).concat(ids) }, boeType: { [Op.in]: ['EX_BOND', 'X'] } }, attributes: ['id', 'inBondJobId'] }) : [];
    const exCount = {}; for (const e of exb) if (String(e.id) !== String(excludeJobId || '')) exCount[String(e.inBondJobId)] = (exCount[String(e.inBondJobId)] || 0) + 1;
    const wantIec = U(iecCode), wantName = U(importerName), wantPort = U(customsPort);
    const data = jobs.map(j0 => {
      const j = up(j0);
      const igm = rowsOf(j._igmRows)[0] || {};
      const iec = U(j.autoField_5 || j.iecCode);
      const name = String(j.autoField_4 || j.nameOfImporter || '').trim();
      const port = portOf(j);
      return {
        id: j.id, jobNo: j.jobNo, jobDate: j.jobDate || j.createdAt, status: j.status || 'DRAFT',
        beNo: j.beNo || '', beDate: j.beDate || '',
        importerName: name, iecCode: iec, branchSrNo: j.autoField_48 || j.branchSrNo || '',
        customsPort: port, warehouseCode: j.warehouseCode || '',
        igmNo: j.igmNumber || igm.igmNumber || igm.igmNo || '', mawbNo: j.mawbNo || igm.mawbNo || '', hawbNo: j.hawbNo || igm.hawbNo || '',
        shipmentMode: j.shipmentMode, invoiceNo: (j.invoices || []).map(i => i.invNo || i.invoiceNo).filter(Boolean).join(', '),
        exBondCount: exCount[String(j.id)] || 0,
        matchImporter: !!((wantIec && iec === wantIec) || (wantName && U(name) === wantName)),
        matchPort: !!(wantPort && port === wantPort),
      };
    });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[WH-BE] list error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/warehouse-be/by-id/:id?excludeJobId=.. — WH job with its items. Each item carries the quantity already
// cleared by other Ex-Bond BEs of this WH BE (_whClearedQty) and what is left (_whBalanceQty). 28-Oct-2026
// 22-Nov-2026: the balance figures alone (no items, no invoices) - an ex-bond job asks for them every time it is opened,
// so the "WH Bal / Left" columns follow ex-bonds filed after this one was linked. Keys are "inv sr/item sr".
router.get('/balances/:whJobId', async (req, res) => {
  try {
    const lb = await lightBalances(req.params.whJobId, req.query.excludeJobId);
    if (!lb) return res.status(404).json({ success: false, error: 'Warehouse job not found' });
    res.json({ success: true, data: lb });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

router.get('/by-id/:id', async (req, res) => {
  try {
    const ImportItem = require('../models/ImportItem');
    const job = await ImportJob.findByPk(req.params.id, { include: [{ model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] }] });
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    const data = up(job);
    data.invoices = (data.invoices || []).map(inv => { const i2 = up(inv); i2.items = (i2.items || []).map(up); return i2; });
    const bal = await balancesFor(job, req.query.excludeJobId);
    data.invoices.forEach((inv, k) => inv.items.forEach(it => {
      const b = bal.byKey[`${it.invSrNo || k + 1}/${it.itemSrNo || it.itemNo}`] || { cleared: 0, draft: 0 };
      const q = parseFloat(it.quantity || it.qty) || 0;
      it._whClearedQty = b.cleared;
      it._whDraftQty = b.draft; // being cleared by ex-bond jobs that are not filed yet (information only)
      it._whBalanceQty = Math.max(0, +(q - b.cleared).toFixed(6));
    }));
    data.exBondCount = bal.filedCount; data.exBondDraftCount = bal.draftCount;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/warehouse-be/ex-bonds/:whJobId — Ex-Bond jobs linked to this WH job
router.get('/ex-bonds/:whJobId', async (req, res) => {
  try {
    const jobs = await ImportJob.findAll({
      where: {
        inBondJobId: req.params.whJobId,
        boeType: { [Op.in]: ['EX_BOND', 'X'] }
      },
      attributes: ['id', 'jobNo', 'jobDate', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
