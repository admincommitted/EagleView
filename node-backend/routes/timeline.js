// Job timeline / remarks (components/TimelineDrawer.jsx). Added 28-Oct-2026.
//
// 28-Oct-2026 (second pass):
// - rows carry "timestamp" (the drawer read log.timestamp, which the table does not have, so times were blank and
//   the TAT banner was wrong);
// - the job's own events are listed with the remarks: job created, last saved, sent to ICEGATE, BE / SB No,
//   OOC / gate pass received (system rows, not stored, cannot be deleted);
// - a remark that is a status (eventType STATUS, picked from the status list) also sets the job status, so the
//   dashboard and job list follow it (QUERY RAISED -> QUERY_RAISED, OOC ISSUED -> OOC ...);
// - DELETE /api/timeline/:id removes a remark (its author or an admin).
const express = require('express');
const JobTimeline = require('../models/JobTimeline');
const { unpackExtra } = require('../utils/extraFields');
const router = express.Router();

const jobModel = (module) => (String(module).toUpperCase() === 'EXPORT' ? require('../models/ExportJob') : require('../models/ImportJob'));
const who = (req) => (req.user && (req.user.username || req.user.name)) || '';

// status text -> job status (import jobs)
function statusFor(text) {
  const t = String(text || '').toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); // status master codes use OOC_ISSUED
  if (/CANCEL/.test(t)) return 'CANCELLED';
  if (/DELIVER/.test(t)) return 'DELIVERED';
  if (/OOC ISSUED|OUT OF CHARGE|GATE ?PASS/.test(t)) return 'OOC';
  if (/QUERY/.test(t) && /REPL/.test(t)) return 'QUERY_REPLIED';
  if (/REPLY FILED/.test(t)) return 'QUERY_REPLIED';
  if (/QUERY/.test(t)) return 'QUERY_RAISED';
  if (/DUTY PAID|OOC PENDING/.test(t)) return 'DUTY_PAID';
  if (/ASSESS|DUTY PENDING/.test(t)) return 'ASSESSED';
  if (/SUBMIT|FILED|SENT TO ICEGATE/.test(t)) return 'SUBMITTED';
  if (/^DRAFT$|JOB CREATED/.test(t)) return 'DRAFT';
  return null;
}

async function systemEvents(module, jobId) {
  const out = [];
  const M = jobModel(module);
  const row = await M.findByPk(jobId).catch(() => null);
  if (!row) return out;
  const j = unpackExtra(row, String(module).toUpperCase() === 'EXPORT' ? 'additionalData' : 'extendedData'); // export jobs keep extra fields in additionalData
  // 14-Nov-2026: jobs loaded from iCAFFE kept createdAt / updatedAt as '2026-11-07T10:55:18.200Z', which Sequelize (SQLite)
  // reads as null - the 'created' line had no time and the TAT banner counted from 1970. Read the stored text instead.
  try {
    const [[t]] = await M.sequelize.query(`SELECT createdAt, updatedAt FROM "${M.getTableName()}" WHERE id = ?`, { replacements: [jobId] });
    const iso = (v) => { if (!v) return null; const x = String(v).trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(:\d{2}(\.\d+)?)?) ?\+00:?00$/, '$1T$2Z'); const d = new Date(x); return isNaN(d) ? null : d.toISOString(); };
    // Sequelize gives an Invalid Date (not null) for such a value, so test the date itself (14-Nov-2026, 09:15)
    const ok = (v) => !!v && !isNaN(new Date(v).getTime());
    if (t) { if (!ok(j.createdAt)) j.createdAt = iso(t.createdAt); if (!ok(j.updatedAt)) j.updatedAt = iso(t.updatedAt); }
  } catch (e) { /* keep what the model gave */ }
  const ev = (at, message, key) => at && out.push({ id: `sys-${key}`, system: true, eventType: 'SYSTEM', author: 'SYSTEM', message, timestamp: at, createdAt: at });
  ev(j.createdAt, `Job ${j.jobNo || ''} created`.trim(), 'created');
  if (j.updatedAt && Math.abs(new Date(j.updatedAt) - new Date(j.createdAt)) > 60000) ev(j.updatedAt, 'Job last saved', 'saved');
  if (j.icegateStatus) ev(j.updatedAt, `${String(module).toUpperCase() === 'EXPORT' ? 'SB' : 'BE'} ${String(j.icegateStatus).toLowerCase()} on ICEGATE${j.icegateUniqueId ? ' - Unique ID ' + j.icegateUniqueId : ''}`, 'icegate');
  const no = j.beNo || j.sbNo, dt = j.beDate || j.sbDate;
  if (no) ev(dt && /^\d{4}-?\d{2}-?\d{2}/.test(String(dt)) ? String(dt).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3') : j.updatedAt, `${j.sbNo ? 'SB' : 'BE'} No ${no} received`, 'no');
  if (j.beNo) {
    try {
      const FD = require('../models/ImportFinalDoc');
      for (const d of await FD.findAll({ where: { beNo: String(j.beNo) } }))
        ev(d.createdAt, ({ OOC_COPY: 'OOC copy received', GATEPASS: 'Gate pass received', FIRST_COPY: 'BE first copy received', BE_COPY: 'BE copy received' })[d.docType] || `${d.docType} received`, 'doc-' + d.id);
    } catch (e) { /* no final docs table */ }
  }
  return out;
}

// GET /api/timeline/:module/:jobId
router.get('/:module/:jobId', async (req, res) => {
  try {
    const module = String(req.params.module).toUpperCase();
    const rows = (await JobTimeline.findAll({ where: { module, jobId: String(req.params.jobId) }, order: [['createdAt', 'ASC']] }))
      .map(r => ({ ...r.toJSON(), timestamp: r.createdAt }));
    const sys = await systemEvents(module, req.params.jobId).catch(() => []);
    const data = [...sys, ...rows].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/timeline { jobId, module, eventType (REMARK | STATUS), message }
router.post('/', async (req, res) => {
  try {
    const { jobId, module, eventType, message } = req.body || {};
    if (!jobId || !message || !String(message).trim()) return res.status(400).json({ success: false, message: 'jobId and message are required' });
    const mod = String(module || 'IMPORT').toUpperCase();
    const author = who(req) || req.body.author || 'User';
    const row = await JobTimeline.create({ jobId: String(jobId), module: mod, eventType: eventType === 'STATUS' ? 'STATUS' : 'REMARK', message: String(message).trim().slice(0, 4000), author });
    let statusUpdated = null;
    if (eventType === 'STATUS' && mod === 'IMPORT') {
      const st = statusFor(message);
      if (st) { await jobModel(mod).update({ status: st }, { where: { id: jobId } }); statusUpdated = st; }
    }
    // export jobs follow their status remarks too (TD done, X-ray, LEO, gate pass ...): the Export dashboard counts them. 29-Oct-2026
    if (eventType === 'STATUS' && mod === 'EXPORT') {
      const st = require('../utils/exportStage').exportStatusFor(message);
      if (st) {
        const upd = { status: st };
        if (st === 'LEO') { const job = await jobModel(mod).findByPk(jobId); if (job && !job.leoDate) upd.leoDate = new Date().toISOString(); } // leoDate is a text column
        await jobModel(mod).update(upd, { where: { id: jobId } }); statusUpdated = st;
      }
    }
    res.status(201).json({ success: true, data: { ...row.toJSON(), timestamp: row.createdAt }, statusUpdated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/timeline/:id - a remark can be removed by the user who wrote it or by an admin
router.delete('/:id', async (req, res) => {
  try {
    const row = await JobTimeline.findByPk(req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Remark not found' });
    const admin = String((req.user && req.user.role) || '').toLowerCase() === 'admin';
    if (!admin && String(row.author || '').toUpperCase() !== String(who(req)).toUpperCase()) return res.status(403).json({ success: false, message: 'Only the user who wrote this remark (or an admin) can delete it' });
    await row.destroy();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
module.exports.statusFor = statusFor;
