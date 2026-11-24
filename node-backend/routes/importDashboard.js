const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ImportJob = require('../models/ImportJob');
const { unpackExtra } = require('../utils/extraFields');

/**
 * GET /api/dashboard/live-tracking - Import dashboard (0. Dashboard tab).
 *
 * 28-Oct-2026 rewrite:
 * - Each job gets a stage from what really happened to it (the old code only looked at "status", which stays DRAFT
 *   after filing, so every job was counted as a draft):
 *     OOC    - OOC copy / gate pass received, or status OOC
 *     QUERY  - status QUERY_RAISED / QUERY_REPLIED (or ICEGATE status says query)
 *     FILED  - sent to ICEGATE or BE No received, OOC not yet
 *     DRAFT  - not sent yet
 * - Importer, BE No / date, IGM inward date come from the job (they were always empty: extendedData was not read).
 * - KPI counts are over all jobs (not only the last 100).
 * - Average TAT: job created -> OOC copy received, for OOC copies received today.
 * - Risk radar: no BE after the arrival (inward) date (late presentation charges), BE filed but no OOC after 3 days,
 *   query open 2+ days, draft untouched 5+ days.
 */
const DAY = 86400000;
const U = (v) => String(v || '').trim().toUpperCase();
const ymd = (v) => { const t = String(v || '').trim(); let m; if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`; if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return ''; };
const dayMs = (v) => { const d = ymd(v); return d ? new Date(d + 'T00:00:00').getTime() : NaN; };
const rowsOf = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };

function stageOf(j, docs) {
  const st = U(j.status), ig = U(j.icegateStatus);
  if (st === 'CANCELLED' || st === 'VOID') return 'CANCELLED';
  if (st === 'OOC' || st === 'DELIVERED' || docs.some(d => ['OOC_COPY', 'GATEPASS'].includes(U(d.docType)))) return 'OOC';
  if (['QUERY_RAISED', 'QUERY_REPLIED', 'QUERY'].includes(st) || ig.includes('QUERY')) return 'QUERY';
  if (j.beNo || ['FILED', 'AMENDED', 'SUBMITTED', 'SENT'].includes(ig) || ['PENDING', 'SUBMITTED', 'FILED', 'ASSESSMENT', 'ASSESSED', 'DUTY_PAID'].includes(st)) return 'FILED';
  return 'DRAFT';
}

const { sequelize } = require('../db');
const NEED = ['id', 'jobNo', 'status', 'icegateStatus', 'icegateUniqueId', 'jobDate', 'createdAt', 'updatedAt', 'shipmentMode', 'boeType', 'autoField_4', 'nameOfImporter',
  'autoField_5', 'iecCode', 'importerPartyId', 'beNo', 'beDate', 'mawbNo', 'hawbNo', 'inwardDate', 'autoField_17', '_igmRows'];
let jobCols = null;
async function slimJobs(limit) {
  if (!jobCols || Date.now() - jobCols.at > 600000) jobCols = { at: Date.now(), set: new Set((await sequelize.query('PRAGMA table_info(ImportJobs)', { type: sequelize.QueryTypes.SELECT })).map(c => c.name)) };
  const C = jobCols.set, ext = C.has('extendedData');
  // same rule as utils/extraFields.unpackExtra: the column, else the value kept in extendedData
  const fromExt = (k) => `CASE WHEN json_valid(extendedData) THEN json_extract(extendedData, '$.${k}') END`;
  const sel = NEED.map(k => (C.has(k) ? (ext && k !== 'id' && k !== 'createdAt' && k !== 'updatedAt' ? `coalesce("${k}", ${fromExt(k)})` : `"${k}"`) : ext ? fromExt(k) : 'NULL') + ` AS "${k}"`);
  const iso = (v) => { if (!v) return v; const d = new Date(String(v).replace(' ', 'T').replace(' +00:00', 'Z')); return isNaN(d) ? v : d.toISOString(); };
  const rows = await sequelize.query(`SELECT ${sel.join(', ')} FROM ImportJobs WHERE coalesce(jobNo, '') NOT LIKE 'AMD/%' ORDER BY id DESC LIMIT ?`, { replacements: [limit], type: sequelize.QueryTypes.SELECT });
  for (const r of rows) { r.createdAt = iso(r.createdAt); r.updatedAt = iso(r.updatedAt); }
  return rows;
}

router.get('/live-tracking', async (req, res) => {
  try {
    // 09-Nov-2026: plain SQL with only the fields used here. findAll() built 3,000 full jobs (250 columns + the whole
    // extendedData each) - 2.5 s of work during which every other request of the page waited (header, branch, FY,
    // job list...), once the iCAFFE BE jobs were loaded.
    // 10-Nov-2026: amended-job copies (AMD/...) of the BE amendment register are left out
    const jobs = await slimJobs(3000);
    let finalDocs = [];
    try {
      const ImportFinalDoc = require('../models/ImportFinalDoc');
      const beNos = [...new Set(jobs.map(j => j.beNo).filter(Boolean).map(String))];
      if (beNos.length) finalDocs = await ImportFinalDoc.findAll({ where: { beNo: { [Op.in]: beNos } } });
    } catch (e) { /* final docs table not there yet */ }
    // importer phone for the WhatsApp button
    const phones = {};
    try {
      const Party = require('../models/Party');
      const ids = [...new Set(jobs.map(j => j.importerPartyId).filter(Boolean))];
      if (ids.length) for (const p of await Party.findAll({ where: { id: ids }, attributes: ['id', 'phoneNumber'] })) phones[String(p.id)] = p.phoneNumber || '';
    } catch (e) { /* no party table */ }

    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const parsed = jobs.map(j => {
      const docs = finalDocs.filter(d => String(d.beNo) === String(j.beNo || ''));
      const igm = rowsOf(j._igmRows)[0] || {};
      const ooc = docs.find(d => U(d.docType) === 'OOC_COPY');
      return {
        id: j.id, jobNo: j.jobNo || null, status: j.status || 'DRAFT', icegateStatus: j.icegateStatus || '', icegateUniqueId: j.icegateUniqueId || '',
        macroStatus: stageOf(j, docs),
        jobDate: ymd(j.jobDate) || ymd(j.createdAt && new Date(j.createdAt).toISOString()),
        mode: j.shipmentMode || 'AIR', boeType: j.boeType || '',
        importerName: j.autoField_4 || j.nameOfImporter || '', iec: j.autoField_5 || j.iecCode || '',
        importerPhone: phones[String(j.importerPartyId)] || '',
        beNo: j.beNo || null, beDate: ymd(j.beDate) || null,
        mawbNo: j.mawbNo || igm.mawbNo || '', hawbNo: j.hawbNo || igm.hawbNo || '',
        inwardDate: ymd(j.inwardDate || j.autoField_17 || igm.inwardDate) || null,
        oocAt: ooc ? ooc.createdAt : null,
        createdAt: j.createdAt, updatedAt: j.updatedAt,
      };
    });

    // 17-Nov-2026: total = every import job (the stages above are counted on the newest 3,000); the main Dashboard card
    // showed NaN (it added up assessed / duty_paid counts that are not sent) and then the 3,000 cap
    let allJobs = parsed.length;
    try { const r = await sequelize.query("SELECT count(*) AS n FROM ImportJobs WHERE coalesce(jobNo, '') NOT LIKE 'AMD/%'", { type: sequelize.QueryTypes.SELECT }); allJobs = Number(r[0] && r[0].n) || allJobs; } catch (e) { /* keep the shown count */ }
    const summary = { draft: 0, submitted: 0, query_raised: 0, ooc: 0, total: allJobs };
    for (const j of parsed) {
      if (j.macroStatus === 'DRAFT') summary.draft++;
      else if (j.macroStatus === 'FILED') summary.submitted++;
      else if (j.macroStatus === 'QUERY') summary.query_raised++;
      else if (j.macroStatus === 'OOC') summary.ooc++;
    }

    // average TAT (hours) of the OOCs received today: job created -> OOC copy
    const tats = parsed.filter(j => j.oocAt && new Date(j.oocAt).toISOString().slice(0, 10) === today)
      .map(j => (new Date(j.oocAt).getTime() - new Date(j.createdAt).getTime()) / 3600000).filter(h => h >= 0);
    const averageTat = tats.length ? Math.round((tats.reduce((s, h) => s + h, 0) / tats.length) * 10) / 10 : 0;

    const riskJobs = [];
    for (const j of parsed) {
      const age = Math.floor((now - new Date(j.createdAt).getTime()) / DAY);
      const quiet = Math.floor((now - new Date(j.updatedAt || j.createdAt).getTime()) / DAY);
      const inward = dayMs(j.inwardDate);
      const afterArrival = isNaN(inward) ? null : Math.floor((now - inward) / DAY);
      if (j.macroStatus === 'CANCELLED') continue;
      const base = { id: j.id, jobNo: j.jobNo || 'NO-JOB-NO', mode: U(j.mode) === 'SEA' ? 'SEA' : U(j.mode) === 'LAND' ? 'LAND' : 'AIR', job: j };
      if (!j.beNo && afterArrival !== null && afterArrival >= 1 && j.macroStatus !== 'OOC' && U(j.boeType) !== 'EX_BOND')
        riskJobs.push({ ...base, rank: 3, color: '#ef4444', riskType: `No BE ${afterArrival} day(s) after arrival - late presentation charges` });
      else if (j.macroStatus === 'QUERY' && quiet >= 2)
        riskJobs.push({ ...base, rank: 2, color: '#ef4444', riskType: `Query open for ${quiet} day(s)` });
      else if (j.macroStatus === 'FILED' && j.beNo && j.beDate && Math.floor((now - dayMs(j.beDate)) / DAY) >= 3)
        riskJobs.push({ ...base, rank: 1, color: '#f59e0b', riskType: `BE ${j.beNo} filed ${Math.floor((now - dayMs(j.beDate)) / DAY)} days ago - no OOC yet (demurrage)` });
      else if (j.macroStatus === 'DRAFT' && age >= 5 && quiet >= 5)
        riskJobs.push({ ...base, rank: 0, color: '#f59e0b', riskType: `Draft untouched for ${quiet} days` });
    }
    riskJobs.sort((a, b) => b.rank - a.rank);

    // recent activity: newest change first
    const activity = parsed.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8).map(j => ({
      id: j.id, jobNo: j.jobNo, at: j.oocAt || j.updatedAt,
      text: j.macroStatus === 'CANCELLED' ? 'Job cancelled' : j.macroStatus === 'OOC' ? 'Out of charge (OOC copy received)' : j.macroStatus === 'QUERY' ? 'Customs query raised'
        : j.beNo ? `BE ${j.beNo} received` : j.icegateUniqueId ? `Sent to ICEGATE (${j.icegateUniqueId})`
        : (String(j.updatedAt) !== String(j.createdAt) ? 'Draft updated' : 'Job created'),
    }));

    res.json({ success: true, summary, recentJobs: parsed.slice(0, 60), riskJobs: riskJobs.slice(0, 10), averageTat, tatCount: tats.length, activity });
  } catch (err) {
    console.error('Import Dashboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
