import { ExportJob, ImportFinalDoc, ImportJob, JobTimeline } from '../../../models/index.js';
import { unpackExtra } from '../../../utils/db/extraFields.js';
import { exportStatusFor } from '../../../utils/customs/exportStage.js';
import { ForbiddenError, NotFoundError } from '../../../core/http/index.js';

const MAX_MESSAGE_LENGTH = 4000;
const SAVED_AFTER_CREATE_MS = 60000;
const STORED_UTC_RX = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(:\d{2}(\.\d+)?)?) ?\+00:?00$/;
const FINAL_DOC_EVENTS = {
  OOC_COPY: 'OOC copy received',
  GATEPASS: 'Gate pass received',
  FIRST_COPY: 'BE first copy received',
  BE_COPY: 'BE copy received',
};

const isExport = (module) => String(module).toUpperCase() === 'EXPORT';
const jobModelOf = (module) => (isExport(module) ? ExportJob : ImportJob);
const failure = (ErrorClass, message) => new ErrorClass(message, { body: { success: false, message } });

/** Status text of a remark -> import job status (status master codes use OOC_ISSUED). */
function statusFor(text) {
  const status = String(text || '')
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/CANCEL/.test(status)) return 'CANCELLED';
  if (/DELIVER/.test(status)) return 'DELIVERED';
  if (/OOC ISSUED|OUT OF CHARGE|GATE ?PASS/.test(status)) return 'OOC';
  if (/QUERY/.test(status) && /REPL/.test(status)) return 'QUERY_REPLIED';
  if (/REPLY FILED/.test(status)) return 'QUERY_REPLIED';
  if (/QUERY/.test(status)) return 'QUERY_RAISED';
  if (/DUTY PAID|OOC PENDING/.test(status)) return 'DUTY_PAID';
  if (/ASSESS|DUTY PENDING/.test(status)) return 'ASSESSED';
  if (/SUBMIT|FILED|SENT TO ICEGATE/.test(status)) return 'SUBMITTED';
  if (/^DRAFT$|JOB CREATED/.test(status)) return 'DRAFT';
  return null;
}

const storedTimeToIso = (value) => {
  if (!value) return null;
  const date = new Date(String(value).trim().replace(STORED_UTC_RX, '$1T$2Z'));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const isValidTime = (value) => !!value && !Number.isNaN(new Date(value).getTime());

// jobs loaded from iCAFFE keep createdAt / updatedAt as ISO text, which Sequelize (SQLite) reads as an Invalid Date:
// the stored text is read instead
async function fixStoredTimes(Model, jobId, job) {
  try {
    const [[stored]] = await Model.sequelize.query(
      `SELECT createdAt, updatedAt FROM "${Model.getTableName()}" WHERE id = ?`,
      { replacements: [jobId] },
    );
    if (!stored) return;
    if (!isValidTime(job.createdAt)) job.createdAt = storedTimeToIso(stored.createdAt);
    if (!isValidTime(job.updatedAt)) job.updatedAt = storedTimeToIso(stored.updatedAt);
  } catch {
    // keep what the model gave
  }
}

const DATE_START_RX = /^\d{4}-?\d{2}-?\d{2}/;

async function finalDocEvents(beNo, addEvent) {
  try {
    for (const doc of await ImportFinalDoc.findAll({ where: { beNo: String(beNo) } })) {
      addEvent(doc.createdAt, FINAL_DOC_EVENTS[doc.docType] || `${doc.docType} received`, `doc-${doc.id}`);
    }
  } catch {
    // no final docs table
  }
}

/**
 * The job's own events, listed with the remarks: job created, last saved, sent to ICEGATE, BE / SB No, OOC / gate pass
 * received. System rows, not stored, cannot be deleted.
 */
async function systemEvents(module, jobId) {
  const events = [];
  const Model = jobModelOf(module);
  const row = await Model.findByPk(jobId).catch(() => null);
  if (!row) return events;
  // export jobs keep extra fields in additionalData
  const job = unpackExtra(row, isExport(module) ? 'additionalData' : 'extendedData');
  await fixStoredTimes(Model, jobId, job);
  const addEvent = (at, message, key) =>
    at &&
    events.push({
      id: `sys-${key}`,
      system: true,
      eventType: 'SYSTEM',
      author: 'SYSTEM',
      message,
      timestamp: at,
      createdAt: at,
    });
  addEvent(job.createdAt, `Job ${job.jobNo || ''} created`.trim(), 'created');
  if (job.updatedAt && Math.abs(new Date(job.updatedAt) - new Date(job.createdAt)) > SAVED_AFTER_CREATE_MS) {
    addEvent(job.updatedAt, 'Job last saved', 'saved');
  }
  if (job.icegateStatus) {
    const unique = job.icegateUniqueId ? ` - Unique ID ${job.icegateUniqueId}` : '';
    addEvent(
      job.updatedAt,
      `${isExport(module) ? 'SB' : 'BE'} ${String(job.icegateStatus).toLowerCase()} on ICEGATE${unique}`,
      'icegate',
    );
  }
  const number = job.beNo || job.sbNo;
  const numberDate = job.beDate || job.sbDate;
  if (number) {
    const at =
      numberDate && DATE_START_RX.test(String(numberDate))
        ? String(numberDate).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
        : job.updatedAt;
    addEvent(at, `${job.sbNo ? 'SB' : 'BE'} No ${number} received`, 'no');
  }
  if (job.beNo) await finalDocEvents(job.beNo, addEvent);
  return events;
}

/** Remarks of a job with its system events, oldest first; every row carries `timestamp`. */
export async function jobTimeline(moduleParam, jobId) {
  const module = String(moduleParam).toUpperCase();
  const remarks = (
    await JobTimeline.findAll({ where: { module, jobId: String(jobId) }, order: [['createdAt', 'ASC']] })
  ).map((remark) => ({ ...remark.toJSON(), timestamp: remark.createdAt }));
  const system = await systemEvents(module, jobId).catch(() => []);
  return [...system, ...remarks].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// a status remark also sets the job status, so the dashboards and job lists follow it
async function applyStatusRemark(module, jobId, message) {
  if (module === 'IMPORT') {
    const status = statusFor(message);
    if (!status) return null;
    await jobModelOf(module).update({ status }, { where: { id: jobId } });
    return status;
  }
  if (module === 'EXPORT') {
    const status = exportStatusFor(message);
    if (!status) return null;
    const changes = { status };
    if (status === 'LEO') {
      const job = await jobModelOf(module).findByPk(jobId);
      // leoDate is a text column
      if (job && !job.leoDate) changes.leoDate = new Date().toISOString();
    }
    await jobModelOf(module).update(changes, { where: { id: jobId } });
    return status;
  }
  return null;
}

/** A remark (REMARK) or a status (STATUS, picked from the status list) on a job. */
export async function addTimelineEntry({ jobId, module, eventType, message, author }) {
  const jobModule = String(module || 'IMPORT').toUpperCase();
  const row = await JobTimeline.create({
    jobId: String(jobId),
    module: jobModule,
    eventType: eventType === 'STATUS' ? 'STATUS' : 'REMARK',
    message: String(message).trim().slice(0, MAX_MESSAGE_LENGTH),
    author,
  });
  const statusUpdated = eventType === 'STATUS' ? await applyStatusRemark(jobModule, jobId, message) : null;
  return { success: true, data: { ...row.toJSON(), timestamp: row.createdAt }, statusUpdated };
}

/** A remark can be removed by the user who wrote it or by an admin. */
export async function deleteTimelineEntry(id, user, userName) {
  const row = await JobTimeline.findByPk(id);
  if (!row) throw failure(NotFoundError, 'Remark not found');
  const isAdmin = String((user && user.role) || '').toLowerCase() === 'admin';
  if (!isAdmin && String(row.author || '').toUpperCase() !== String(userName).toUpperCase()) {
    throw failure(ForbiddenError, 'Only the user who wrote this remark (or an admin) can delete it');
  }
  await row.destroy();
}
