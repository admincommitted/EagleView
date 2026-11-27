import { Op } from 'sequelize';
import { ExportFinalDoc, ExportJob, JobTimeline } from '../../../models/index.js';
import { unpackExtra } from '../../../utils/db/extraFields.js';
import { exportStatusFor, stageOf } from '../../../utils/customs/exportStage.js';

const DAY_MS = 24 * 3600 * 1000;
const HOUR_MS = 3600000;
const SAVED_AFTER_CREATE_MS = 60000;
const TRACKED_JOBS = 300;
const RECENT_JOBS_SHOWN = 60;
const RISK_JOBS_SHOWN = 10;
const ACTIVITY_SHOWN = 12;
const ACTIVITY_SOURCE_ROWS = 30;
const ACTIVITY_TEXT_LENGTH = 120;
// gate pass / departed / delivered come after LEO and are counted in the LEO card
const LEO_OR_LATER = ['LEO', 'GATE_PASS', 'DEPARTED', 'DELIVERED'];
const AFTER_FILING = ['SUBMITTED', 'TD_DONE', 'XRAY_DONE'];
const EXAMINATION = ['TD_DONE', 'XRAY_DONE'];

const dateOf = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  const date = match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};
const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// the selected branch / financial year; jobs saved without one are shown everywhere
function branchAndYearWhere({ branchId, financialYearId }) {
  const conditions = [];
  if (branchId) conditions.push({ [Op.or]: [{ branchId }, { branchId: null }] });
  if (financialYearId) conditions.push({ [Op.or]: [{ financialYearId }, { financialYearId: null }] });
  return { where: conditions.length ? { [Op.and]: conditions } : {}, filtered: conditions.length > 0 };
}

// LEO copy / gate pass received for the SB
async function finalDocsOf(jobs) {
  const sbNumbers = jobs
    .map((job) => job.sbNo || job.sbNumber)
    .filter(Boolean)
    .map(String);
  if (!sbNumbers.length) return [];
  try {
    return await ExportFinalDoc.findAll({ where: { sbNo: { [Op.in]: sbNumbers } } });
  } catch {
    return [];
  }
}

// status remarks of the timeline, newest first (the latest time each job reached a stage)
async function timelineOf(jobs) {
  try {
    return await JobTimeline.findAll({
      where: { module: 'EXPORT', jobId: { [Op.in]: jobs.map((job) => String(job.id)) } },
      order: [['createdAt', 'DESC']],
    });
  } catch {
    return [];
  }
}

function dashboardJob(job, finalDocs, timeline) {
  const sbNo = String(job.sbNo || job.sbNumber || '');
  const docs = sbNo ? finalDocs.filter((doc) => String(doc.sbNo) === sbNo) : [];
  const leoCopy = docs.find((doc) => doc.docType === 'LEO_COPY');
  const stage = stageOf(job, { hasLeoCopy: !!leoCopy, hasGatepass: docs.some((doc) => doc.docType === 'GATEPASS') });
  const leoRemark = timeline.find(
    (remark) =>
      String(remark.jobId) === String(job.id) &&
      remark.eventType === 'STATUS' &&
      exportStatusFor(remark.message) === 'LEO',
  );
  const leoAt = dateOf(job.leoDate) || (leoRemark && leoRemark.createdAt) || (leoCopy && leoCopy.createdAt) || null;
  return {
    id: job.id,
    jobNo: job.jobNo || null,
    status: stage,
    macroStatus: stage,
    rawStatus: job.status || 'DRAFT',
    jobDate: job.jobDate || null,
    shipmentMode: String(job.shipmentMode || 'AIR').toUpperCase(),
    exporterName: job.shipperName || job.exporterName || job.exporter || null,
    consigneeName: job.consigneeName || null,
    destination: job.destPortName || job.destPortCode || job.destCountryName || job.destCountryCode || null,
    sbNo: sbNo || null,
    sbDate: job.sbDate || job.autoField_26 || null,
    leoDate: leoAt,
    icegateStatus: job.icegateStatus || null,
    mawbNo: job.mawbNo || job.autoField_22 || null,
    hawbNo: job.hawbNo || job.autoField_24 || null,
    gateInDate: job.gateInDate || job.cartingDate || job.createdAt,
    sailingDate: job.sailingDate || job.flightDate || job.mawbDate || null,
    fobValue: parseFloat(job.fobRs || job.fobValue || 0) || 0,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function stageSummary(jobs) {
  const count = (stage) => jobs.filter((job) => job.macroStatus === stage).length;
  return {
    total: jobs.length,
    draft: count('DRAFT'),
    submitted: count('SUBMITTED'),
    td_done: count('TD_DONE'),
    xray_done: count('XRAY_DONE'),
    leo: jobs.filter((job) => LEO_OR_LATER.includes(job.macroStatus)).length,
    cancelled: count('CANCELLED'),
  };
}

// LEO turnaround of jobs that got LEO today: from the SB date (else job creation) to LEO
function leoTurnaroundToday(jobs, now) {
  const leoToday = jobs.filter((job) => job.leoDate && sameDay(new Date(job.leoDate), now));
  const hours = leoToday
    .map((job) => (new Date(job.leoDate) - (dateOf(job.sbDate) || new Date(job.createdAt))) / HOUR_MS)
    .filter((tat) => Number.isFinite(tat) && tat >= 0);
  return {
    count: leoToday.length,
    hours: hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : 0,
  };
}

function riskOf(job, now) {
  const age = Math.floor((now - new Date(job.createdAt)) / DAY_MS);
  const sbAge = job.sbDate && dateOf(job.sbDate) ? Math.floor((now - dateOf(job.sbDate)) / DAY_MS) : null;
  if (job.macroStatus === 'SUBMITTED' && !job.sbNo && age >= 2) {
    return { warning: `Sent to ICEGATE, SB No pending for ${age} days`, severity: age >= 5 ? 'HIGH' : 'MED' };
  }
  if (AFTER_FILING.includes(job.macroStatus) && job.sbNo && sbAge !== null && sbAge >= 3) {
    return { warning: `LEO pending ${sbAge} days after SB`, severity: sbAge >= 7 ? 'HIGH' : 'MED' };
  }
  if (EXAMINATION.includes(job.macroStatus) && age >= 3) {
    return { warning: `Stuck in ${job.macroStatus.replace('_', ' ')} for ${age} days`, severity: 'MED' };
  }
  return null;
}

// financial risk radar: late SB / LEO (late filing and demurrage charges)
function riskJobsOf(jobs, now) {
  const riskJobs = [];
  for (const job of jobs) {
    if (job.macroStatus === 'CANCELLED') continue;
    const risk = riskOf(job, now);
    if (!risk) continue;
    const label = `${job.jobNo || 'NO-JOB-NO'} (${job.shipmentMode === 'SEA' ? 'SEA' : 'AIR'})`;
    riskJobs.push({
      id: job.id,
      jobNo: label,
      warning: risk.warning,
      severity: risk.severity,
      mode: job.shipmentMode,
      job,
    });
  }
  return riskJobs.sort((a, b) => {
    if (a.severity === b.severity) return 0;
    return a.severity === 'HIGH' ? -1 : 1;
  });
}

// timeline status / remarks first, then job created / saved / filed
function recentActivity(jobs, timeline) {
  const jobsById = new Map(jobs.map((job) => [String(job.id), job]));
  const activity = [];
  for (const remark of timeline.slice(0, ACTIVITY_SOURCE_ROWS)) {
    const job = jobsById.get(String(remark.jobId));
    if (!job) continue;
    activity.push({
      at: remark.createdAt,
      jobId: job.id,
      jobNo: job.jobNo,
      kind: remark.eventType === 'STATUS' ? 'STATUS' : 'REMARK',
      text: String(remark.message || '').slice(0, ACTIVITY_TEXT_LENGTH),
      by: remark.author || '',
    });
  }
  for (const job of jobs.slice(0, ACTIVITY_SOURCE_ROWS)) {
    const created = new Date(job.createdAt);
    const updated = new Date(job.updatedAt);
    activity.push({ at: job.createdAt, jobId: job.id, jobNo: job.jobNo, kind: 'CREATED', text: 'Job created' });
    if (updated - created > SAVED_AFTER_CREATE_MS) {
      activity.push({
        at: job.updatedAt,
        jobId: job.id,
        jobNo: job.jobNo,
        kind: job.icegateStatus ? 'FILED' : 'SAVED',
        text: job.icegateStatus ? `SB ${String(job.icegateStatus).toLowerCase()} on ICEGATE` : 'Job saved',
      });
    }
  }
  return activity.sort((a, b) => new Date(b.at) - new Date(a.at));
}

async function jobsOfOtherBranches(where, filtered) {
  if (!filtered) return 0;
  try {
    return Math.max(0, (await ExportJob.count()) - (await ExportJob.count({ where })));
  } catch {
    return 0;
  }
}

/**
 * Export dashboard (Export Shipping Bill > 0. Dashboard) of the selected branch and financial year: stage counts
 * (ICEGATE / SB No, timeline status remarks, LEO date / copy), LEO turnaround, risk radar and recent activity.
 */
export async function exportLiveTracking(query) {
  const { where, filtered } = branchAndYearWhere(query);
  const rows = await ExportJob.findAll({
    where,
    order: [
      ['updatedAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: TRACKED_JOBS,
  });
  const savedJobs = rows.map((row) => unpackExtra(row, 'additionalData'));
  const finalDocs = await finalDocsOf(savedJobs);
  const timeline = await timelineOf(savedJobs);
  const now = new Date();
  const jobs = savedJobs.map((job) => dashboardJob(job, finalDocs, timeline));
  const activity = recentActivity(jobs, timeline);
  const otherJobs = await jobsOfOtherBranches(where, filtered);
  return {
    success: true,
    summary: stageSummary(jobs),
    tatToday: leoTurnaroundToday(jobs, now),
    otherJobs,
    recentJobs: jobs.slice(0, RECENT_JOBS_SHOWN),
    riskJobs: riskJobsOf(jobs, now).slice(0, RISK_JOBS_SHOWN),
    recentActivity: activity.slice(0, ACTIVITY_SHOWN),
  };
}
