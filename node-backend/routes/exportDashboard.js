// Export dashboard (Export Shipping Bill > 0. Dashboard). Rewritten 29-Oct-2026:
// - exporter, SB No and the other screen fields are read from the job (before: an empty object was read, so every
//   card said "Exporter: N/A" and SB numbers never showed);
// - the stage of a job follows what really happened: sent to ICEGATE / SB No, status remarks in the Timeline
//   (TD done, X-ray, LEO, gate pass ...), LEO date / LEO copy (before: export jobs never left DRAFT);
// - only the selected branch and financial year (jobs saved without one are shown everywhere);
// - pipeline in order of last change, "today" LEO turnaround from real LEO times, recent activity from the timeline.
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const ExportJob = require('../models/ExportJob');
const { unpackExtra } = require('../utils/extraFields');
const { stageOf, exportStatusFor } = require('../utils/exportStage');

const DAY = 24 * 3600 * 1000;
const dateOf = (v) => { if (!v) return null; const s = String(v).trim(); const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s); const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s); return isNaN(d) ? null : d; };
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// GET /api/export-dashboard/live-tracking?branchId=&financialYearId=
router.get('/live-tracking', async (req, res) => {
    try {
        const where = {};
        const and = [];
        if (req.query.branchId) and.push({ [Op.or]: [{ branchId: req.query.branchId }, { branchId: null }] });
        if (req.query.financialYearId) and.push({ [Op.or]: [{ financialYearId: req.query.financialYearId }, { financialYearId: null }] });
        if (and.length) where[Op.and] = and;
        const rows = await ExportJob.findAll({ where, order: [['updatedAt', 'DESC'], ['id', 'DESC']], limit: 300 });
        const jobsRaw = rows.map((r) => unpackExtra(r, 'additionalData'));

        // LEO copy / gate pass received for the SB
        const sbNos = jobsRaw.map((j) => j.sbNo || j.sbNumber).filter(Boolean).map(String);
        let finalDocs = [];
        if (sbNos.length) { try { finalDocs = await require('../models/ExportFinalDoc').findAll({ where: { sbNo: { [Op.in]: sbNos } } }); } catch (e) { finalDocs = []; } }
        // status remarks of the timeline (latest time each job reached a stage)
        let timeline = [];
        try {
            const JobTimeline = require('../models/JobTimeline');
            timeline = await JobTimeline.findAll({ where: { module: 'EXPORT', jobId: { [Op.in]: jobsRaw.map((j) => String(j.id)) } }, order: [['createdAt', 'DESC']] });
        } catch (e) { timeline = []; }

        const now = new Date();
        const jobs = jobsRaw.map((j) => {
            const sb = String(j.sbNo || j.sbNumber || '');
            const docs = sb ? finalDocs.filter((d) => String(d.sbNo) === sb) : [];
            const leoCopy = docs.find((d) => d.docType === 'LEO_COPY');
            const stage = stageOf(j, { hasLeoCopy: !!leoCopy, hasGatepass: docs.some((d) => d.docType === 'GATEPASS') });
            const leoRemark = timeline.find((t) => String(t.jobId) === String(j.id) && t.eventType === 'STATUS' && exportStatusFor(t.message) === 'LEO');
            const leoAt = dateOf(j.leoDate) || (leoRemark && leoRemark.createdAt) || (leoCopy && leoCopy.createdAt) || null;
            const fob = parseFloat(j.fobRs || j.fobValue || 0) || 0;
            return {
                id: j.id, jobNo: j.jobNo || null, status: stage, macroStatus: stage, rawStatus: j.status || 'DRAFT',
                jobDate: j.jobDate || null, shipmentMode: String(j.shipmentMode || 'AIR').toUpperCase(),
                exporterName: j.shipperName || j.exporterName || j.exporter || null,
                consigneeName: j.consigneeName || null, destination: j.destPortName || j.destPortCode || j.destCountryName || j.destCountryCode || null,
                sbNo: sb || null, sbDate: j.sbDate || j.autoField_26 || null, leoDate: leoAt, icegateStatus: j.icegateStatus || null,
                mawbNo: j.mawbNo || j.autoField_22 || null, hawbNo: j.hawbNo || j.autoField_24 || null,
                gateInDate: j.gateInDate || j.cartingDate || j.createdAt,
                sailingDate: j.sailingDate || j.flightDate || j.mawbDate || null,
                fobValue: fob, createdAt: j.createdAt, updatedAt: j.updatedAt,
            };
        });

        const count = (st) => jobs.filter((j) => j.macroStatus === st).length;
        const summary = {
            total: jobs.length, draft: count('DRAFT'), submitted: count('SUBMITTED'), td_done: count('TD_DONE'), xray_done: count('XRAY_DONE'),
            // LEO card: LEO given (gate pass / departed / delivered come after LEO and are counted in it)
            leo: jobs.filter((j) => ['LEO', 'GATE_PASS', 'DEPARTED', 'DELIVERED'].includes(j.macroStatus)).length,
            cancelled: count('CANCELLED'),
        };

        // LEO turnaround of jobs that got LEO today: from SB date (else job creation) to LEO
        const leoToday = jobs.filter((j) => j.leoDate && sameDay(new Date(j.leoDate), now));
        const hrs = leoToday.map((j) => (new Date(j.leoDate) - (dateOf(j.sbDate) || new Date(j.createdAt))) / 3600000).filter((h) => isFinite(h) && h >= 0);
        const tatToday = { count: leoToday.length, hours: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0 };

        // Financial risk radar: late SB / LEO (late filing and demurrage charges)
        const riskJobs = [];
        for (const j of jobs) {
            if (j.macroStatus === 'CANCELLED') continue;
            const label = `${j.jobNo || 'NO-JOB-NO'} (${j.shipmentMode === 'SEA' ? 'SEA' : 'AIR'})`;
            const age = Math.floor((now - new Date(j.createdAt)) / DAY);
            const sbAge = j.sbDate && dateOf(j.sbDate) ? Math.floor((now - dateOf(j.sbDate)) / DAY) : null;
            if (j.macroStatus === 'SUBMITTED' && !j.sbNo && age >= 2) riskJobs.push({ id: j.id, jobNo: label, warning: `Sent to ICEGATE, SB No pending for ${age} days`, severity: age >= 5 ? 'HIGH' : 'MED', mode: j.shipmentMode, job: j });
            else if (['SUBMITTED', 'TD_DONE', 'XRAY_DONE'].includes(j.macroStatus) && j.sbNo && sbAge !== null && sbAge >= 3) riskJobs.push({ id: j.id, jobNo: label, warning: `LEO pending ${sbAge} days after SB`, severity: sbAge >= 7 ? 'HIGH' : 'MED', mode: j.shipmentMode, job: j });
            else if (['TD_DONE', 'XRAY_DONE'].includes(j.macroStatus) && age >= 3) riskJobs.push({ id: j.id, jobNo: label, warning: `Stuck in ${j.macroStatus.replace('_', ' ')} for ${age} days`, severity: 'MED', mode: j.shipmentMode, job: j });
        }
        riskJobs.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'HIGH' ? -1 : 1));

        // Recent activity: timeline status / remarks first, then job created / saved / filed
        const byId = new Map(jobs.map((j) => [String(j.id), j]));
        const activity = [];
        for (const t of timeline.slice(0, 30)) {
            const j = byId.get(String(t.jobId)); if (!j) continue;
            activity.push({ at: t.createdAt, jobId: j.id, jobNo: j.jobNo, kind: t.eventType === 'STATUS' ? 'STATUS' : 'REMARK', text: String(t.message || '').slice(0, 120), by: t.author || '' });
        }
        for (const j of jobs.slice(0, 30)) {
            const created = new Date(j.createdAt), updated = new Date(j.updatedAt);
            activity.push({ at: j.createdAt, jobId: j.id, jobNo: j.jobNo, kind: 'CREATED', text: 'Job created' });
            if (updated - created > 60000) activity.push({ at: j.updatedAt, jobId: j.id, jobNo: j.jobNo, kind: j.icegateStatus ? 'FILED' : 'SAVED', text: j.icegateStatus ? `SB ${String(j.icegateStatus).toLowerCase()} on ICEGATE` : 'Job saved' });
        }
        activity.sort((a, b) => new Date(b.at) - new Date(a.at));

        let otherJobs = 0;
        if (and.length) { try { otherJobs = Math.max(0, (await ExportJob.count()) - (await ExportJob.count({ where }))); } catch (e) { otherJobs = 0; } }
        res.json({ success: true, summary, tatToday, otherJobs, recentJobs: jobs.slice(0, 60), riskJobs: riskJobs.slice(0, 10), recentActivity: activity.slice(0, 12) });
    } catch (err) {
        console.error('Export Dashboard error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
