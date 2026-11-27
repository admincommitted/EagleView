import { Op } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import {
  ExportContainer,
  ExportDocument,
  ExportDrawback,
  ExportFinalDoc,
  ExportInvoice,
  ExportItem,
  ExportJob,
  ExportLicense,
  JobTimeline,
} from '../../../models/index.js';
import * as esanchitArchive from '../../../utils/customs/esanchitArchive.js';
import * as jobSequence from '../../../utils/common/jobSequence.js';
import { rank as stageRank, stageOf } from '../../../utils/customs/exportStage.js';
import { attachShipmentDockets } from '../shared/shipmentDockets.js';
import {
  exportJobWithChildren,
  fixInvoiceDate,
  parseExtra,
  rawInvoiceDates,
  toScreenExportJob,
} from './exportJobRecord.js';

export { saveExportJob } from './exportJobSave.service.js';

const DEFAULT_LIST_LIMIT = 500;
const MAX_LIST_LIMIT = 2000;
const SB_NO_RX = /^\d{5,10}$/;
const ESANCHIT_LIST = 'eSanchitList';

/** The next job no of the AIR / SEA EXPORT prefix (Settings > Sequence Config), without taking it. */
export async function peekNextExportJobNo({ branchId, shipmentMode, financialYearId }) {
  const next = await jobSequence.peek({
    branchId,
    shipmentMode: shipmentMode || 'AIR',
    side: 'EXPORT',
    financialYearId: financialYearId || null,
  });
  return next.nextJobNo;
}

function markSignedEsanchitDocs(jobData) {
  try {
    esanchitArchive.mergeAdded(jobData, ESANCHIT_LIST, 'read');
  } catch {
    /* archive not readable */
  }
  try {
    esanchitArchive.applySigned(jobData, { jobLists: ['eSanchitList'], itemLists: ['eSanchitList'] });
  } catch {
    /* archive not readable */
  }
}

/**
 * A saved job as the screen loads it (form fields of additionalData merged in), e-Sanchit PDFs signed in EagleView
 * Signer shown as signed. Also used by the ICEGATE SB amendment. Null when the job does not exist.
 */
export async function loadExportJob(jobId) {
  const job = await ExportJob.findByPk(jobId, { include: exportJobWithChildren() });
  if (!job) return null;
  const jobData = await toScreenExportJob(job);
  markSignedEsanchitDocs(jobData);
  return jobData;
}

export async function getExportJob(jobId) {
  const jobData = await loadExportJob(jobId);
  if (!jobData) throw new NotFoundError('Job not found', { body: { error: 'Job not found' } });
  return jobData;
}

// the selected branch / financial year; jobs saved without one are listed everywhere
function branchAndYearFilter({ branchId, financialYearId }) {
  const conditions = [];
  if (branchId) conditions.push({ [Op.or]: [{ branchId }, { branchId: null }] });
  if (financialYearId) conditions.push({ [Op.or]: [{ financialYearId }, { financialYearId: null }] });
  return { where: conditions.length ? { [Op.and]: conditions } : {}, filtered: conditions.length > 0 };
}

async function findListedJobs(where, limit) {
  try {
    return await ExportJob.findAll({
      where,
      order: [['id', 'DESC']],
      limit,
      include: [
        { model: ExportInvoice, as: 'invoices' },
        { model: ExportContainer, as: 'containers' },
      ],
    });
  } catch (error) {
    console.warn('[export-jobs] list with invoices failed, listing jobs only:', error.message);
    return ExportJob.findAll({ where, order: [['id', 'DESC']], limit });
  }
}

async function finalDocsOf(jobs) {
  const sbNumbers = jobs
    .map((job) => {
      const extra = parseExtra(job.additionalData);
      return job.sbNo || job.sbNumber || extra.sbNo || extra.sbNumber;
    })
    .filter(Boolean);
  if (!sbNumbers.length) return [];
  try {
    return await ExportFinalDoc.findAll({ where: { sbNo: { [Op.in]: sbNumbers } } });
  } catch (error) {
    console.warn('[export-jobs] final docs:', error.message);
    return [];
  }
}

const invoiceWithExtra = (invoice) =>
  invoice.additionalData ? { ...parseExtra(invoice.additionalData), ...invoice } : invoice;

function addInvoiceSummary(data) {
  if (!data.invoices || data.invoices.length === 0) return;
  const firstInvoice = invoiceWithExtra(data.invoices[0]);
  data.invNo = firstInvoice.invoiceNo || firstInvoice.no;
  data.invDt = firstInvoice.invoiceDate || firstInvoice.date;
  data.invValue = data.invoices
    .reduce((sum, invoice) => {
      const invoiceData = invoiceWithExtra(invoice);
      return sum + (parseFloat(invoiceData.invoiceValue || invoiceData.value) || 0);
    }, 0)
    .toFixed(2);
}

function addFinalDocFlags(data, finalDocs) {
  const currentSb = data.sbNo || data.sbNumber;
  if (!currentSb) return;
  const docsOfSb = finalDocs.filter((doc) => doc.sbNo === currentSb);
  data.hasFirstCopy = docsOfSb.some((doc) => doc.docType === 'FIRST_COPY');
  data.hasLeoCopy = docsOfSb.some((doc) => doc.docType === 'LEO_COPY');
  data.hasGatepass = docsOfSb.some((doc) => doc.docType === 'GATEPASS');
  data.finalDocs = docsOfSb.map((doc) => ({ docType: doc.docType, fileUrl: doc.fileUrl }));
}

function listRow(job, finalDocs, invoiceDates) {
  const data = job.toJSON();
  // fields kept in additionalData (exporter, consignee, SB No, entered by ...) - columns win
  for (const [key, value] of Object.entries(parseExtra(data.additionalData))) {
    if (data[key] === null || data[key] === undefined || data[key] === '') data[key] = value;
  }
  delete data.additionalData;
  (data.invoices || []).forEach((invoice) => fixInvoiceDate(invoice, invoiceDates));
  addInvoiceSummary(data);
  if (data.containers && data.containers.length > 0)
    data.containerNo = data.containers.map((container) => container.containerNo).join(', ');
  // MAWB / HAWB are typed in the SB Header boxes autoField_22 / autoField_24
  if (!data.mawbNo) data.mawbNo = data.autoField_22 || data.AirWayBillNo || null;
  if (!data.hawbNo) data.hawbNo = data.autoField_24 || null;
  data.origin = data.customsPortName || data.customsPort;
  data.destination = data.destPortName || data.consigneeCountry || data.consigneeCountryCode;
  data.fobValue = data.fobRs || 0;
  data.invDt = data.invDt || data.invDate;
  data.dbkValue = data.dbkRs || 0;
  addFinalDocFlags(data, finalDocs);
  // job stage, same rule as the Export dashboard: DRAFT / SUBMITTED / TD_DONE / XRAY_DONE / LEO / ... / CANCELLED
  data.stage = stageOf(data, { hasLeoCopy: !!data.hasLeoCopy, hasGatepass: !!data.hasGatepass });
  return data;
}

/** Export job list of the selected branch / year; totalAll tells an empty list where the other jobs are. */
export async function listExportJobs(query) {
  const { where, filtered } = branchAndYearFilter(query);
  const limit = Math.min(parseInt(query.limit, 10) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const jobs = await findListedJobs(where, limit);
  const finalDocs = await finalDocsOf(jobs);
  const invoiceDates = await rawInvoiceDates(jobs.map((job) => job.id));
  const data = jobs.map((job) => listRow(job, finalDocs, invoiceDates));
  // the docket of each job from Shipment Registration (export divisions AE / SE)
  await attachShipmentDockets(data, 'E');
  let totalAll = data.length;
  if (filtered) {
    try {
      totalAll = await ExportJob.count();
    } catch {
      /* the count is only a hint */
    }
  }
  return { success: true, data, totalAll, filtered };
}

async function timelineLogs(jobId) {
  try {
    const remarks = await JobTimeline.findAll({
      where: { module: 'EXPORT', jobId: String(jobId) },
      order: [['createdAt', 'ASC']],
    });
    return remarks.map((remark) => ({
      time: remark.createdAt,
      action: remark.eventType || 'REMARK',
      user: remark.author || '',
      details: remark.message || '',
    }));
  } catch {
    return []; // timeline table not available
  }
}

/** Job history for the job list's Log column, newest first. */
export async function getExportJobLogs(jobId) {
  const job = await ExportJob.findByPk(jobId);
  if (!job) throw new NotFoundError('Job not found');
  const data = job.toJSON();
  const extra = parseExtra(data.additionalData);
  const field = (key) => data[key] || extra[key] || '';
  const logs = [
    {
      time: data.createdAt,
      action: 'JOB_CREATED',
      user: field('createdBy') || field('enteredBy'),
      details: `Job ${data.jobNo || data.id} created`,
    },
  ];
  if (data.updatedAt && String(data.updatedAt) !== String(data.createdAt)) {
    logs.push({ time: data.updatedAt, action: 'JOB_UPDATED', user: field('updatedBy'), details: 'Last saved' });
  }
  if (field('icegateStatus')) {
    logs.push({
      time: data.updatedAt,
      action: `ICEGATE_${field('icegateStatus')}`,
      user: '',
      details: field('icegateUniqueId') ? `Unique ID ${field('icegateUniqueId')}` : '',
    });
  }
  const sbNo = field('sbNo') || field('sbNumber');
  if (sbNo) {
    logs.push({
      time: data.updatedAt,
      action: 'SB_NO',
      user: '',
      details: `SB No ${sbNo}${field('sbDate') ? ` dated ${field('sbDate')}` : ''}`,
    });
  }
  logs.push(...(await timelineLogs(data.id)));
  logs.sort((a, b) => new Date(b.time) - new Date(a.time));
  return logs;
}

/** SB No read from the ICEGATE acknowledgement (job list "SB Track"); the job moves to SUBMITTED at least. */
export async function saveSbNo(jobId, body) {
  const job = await ExportJob.findByPk(jobId);
  if (!job) throw new NotFoundError('Job not found');
  const sbNo = String((body || {}).sbNo || '').trim();
  if (!SB_NO_RX.test(sbNo)) throw new BadRequestError('SB No must be 5-10 digits');
  const changes = { sbNo, sbDate: String((body || {}).sbDate || '').trim() || job.sbDate };
  if (stageRank(job.status) < stageRank('SUBMITTED')) changes.status = 'SUBMITTED';
  await job.update(changes);
  return { id: job.id, sbNo: job.sbNo, sbDate: job.sbDate, status: job.status };
}

function filedJobRefusal(job, extra, isAdmin) {
  const sbNo = job.sbNo || extra.sbNumber;
  const filedAs =
    [sbNo ? `SB ${sbNo}` : '', job.status && job.status !== 'DRAFT' ? job.status : '', job.leoDate ? 'LEO' : '']
      .filter(Boolean)
      .join(', ') || 'sent to ICEGATE';
  const error = `Job ${job.jobNo} is already filed (${filedAs}) - it cannot be deleted.${isAdmin ? '' : ' Ask an admin.'}`;
  return new ConflictError(error, { body: { success: false, filed: true, canForce: isAdmin, error } });
}

/**
 * A job already sent to ICEGATE (SB No, ICEGATE id, LEO, or status past DRAFT) is deleted only by an admin with
 * ?force=1 (the screen asks for the job no first). Children first, all in one transaction.
 */
export async function deleteExportJob(jobId, { force, user }) {
  const job = await ExportJob.findByPk(jobId);
  if (!job) throw new NotFoundError('Job not found', { body: { error: 'Job not found' } });
  const extra = parseExtra(job.additionalData);
  const filed = !!(job.sbNo || extra.sbNumber || job.icegateUniqueId || job.leoDate) || stageRank(job.status) >= 1;
  const isAdmin = String((user && user.role) || '').toLowerCase() === 'admin';
  if (filed && !(force === '1' && isAdmin)) throw filedJobRefusal(job, extra, isAdmin);
  await sequelize.transaction(async (transaction) => {
    const existingInvoices = await ExportInvoice.findAll({ where: { exportJobId: job.id }, transaction });
    const existingInvoiceIds = existingInvoices.map((invoice) => invoice.id);
    if (existingInvoiceIds.length > 0)
      await ExportItem.destroy({ where: { exportInvoiceId: existingInvoiceIds }, transaction });
    await ExportInvoice.destroy({ where: { exportJobId: job.id }, transaction });
    await ExportContainer.destroy({ where: { exportJobId: job.id }, transaction });
    await ExportDocument.destroy({ where: { exportJobId: job.id }, transaction });
    await ExportDrawback.destroy({ where: { exportJobId: job.id }, transaction });
    await ExportLicense.destroy({ where: { exportJobId: job.id }, transaction });
    await job.destroy({ transaction });
  });
}
