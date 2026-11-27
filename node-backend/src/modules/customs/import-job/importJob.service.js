import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../core/http/index.js';
import { ImportContainer, ImportInvoice, ImportItem, ImportJob, JobTimeline, Party } from '../../../models/index.js';
import { ensureFieldColumns } from '../../../utils/db/dynamicColumns.js';
import * as formFieldColumns from '../../../utils/db/formFieldColumns.js';
import { ymd as validDateOrNull } from '../../../utils/customs/importJobValidate.js';
import { parseFlatFileToBE, parseJsonToBE } from '../../../utils/customs/ErpFileParser.js';
import { suggest as suggestImporterPins } from '../../../utils/customs/pinSuggest.js';
import {
  childOrder,
  isFiledStatus,
  jobWithChildren,
  unpackImportJob,
  withInvoicesAndItems,
  whoSaved,
} from './importJobRecord.js';

const SEARCH_PARTY_LIMIT = 200;
const SEARCH_RESULT_LIMIT = 20;
const MAX_PIN_SUGGESTIONS = 6;
const MAX_BE_NO_LENGTH = 10;
const BE_LOOKUP_BY_COLUMN_LIMIT = 5;
const BE_LOOKUP_BY_JSON_LIMIT = 20;
const MAX_ITEM_DESCRIPTION = 120;
const AMENDED_JOB_NO_RX = /^AMD\//;
const ICEGATE_DATE_RX = /^(\d{4})(\d{2})(\d{2})$/;
const FILE_DATE_FIELDS = ['jobDate', 'beDate', 'warehouseBEDate', 'igmDate', 'mawbDate', 'hawbDate', 'inwardDate'];
const NOT_EDITABLE_DSR_FIELDS = ['id', 'jobNo', 'createdAt', 'updatedAt', 'extendedData'];
const ITEM_DUTY_AMOUNTS = [
  'bcdAmount',
  'swsAmount',
  'igstAmount',
  'healthCessAmount',
  'cvdAmount',
  'adlCvdAmount',
  'saptaAmount',
];
const FILED_JSON_ATTRIBUTES = [
  'id',
  'jobNo',
  'icegateStatus',
  'icegateUniqueId',
  'filedJson',
  'filedAt',
  'filedFileName',
  'filedSigner',
];
const LOG_ATTRIBUTES = [
  'id',
  'jobNo',
  'createdAt',
  'updatedAt',
  'icegateStatus',
  'icegateUniqueId',
  'createdBy',
  'updatedBy',
];

const messageBody = (message) => ({ body: { success: false, message } });

export const isEditableDsrFieldName = (field) =>
  /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(String(field || '')) && !NOT_EDITABLE_DSR_FIELDS.includes(field);

export const digitsOf = (value) => String(value || '').replace(/\D/g, '');
export const isValidBeNoText = (beNo) => !!beNo && beNo.length <= MAX_BE_NO_LENGTH;

/** The CACHI01 JSON exactly as it was sent to ICEGATE - for the amendment diff and the records. */
export async function getFiledJson(jobId) {
  const job = await ImportJob.findByPk(jobId, { attributes: FILED_JSON_ATTRIBUTES });
  if (!job) throw new NotFoundError('Job not found');
  let json = null;
  try {
    json = job.filedJson ? JSON.parse(job.filedJson) : null;
  } catch {
    json = job.filedJson;
  }
  return {
    jobNo: job.jobNo,
    icegateStatus: job.icegateStatus,
    icegateUniqueId: job.icegateUniqueId,
    filedAt: job.filedAt,
    fileName: job.filedFileName,
    signer: job.filedSigner,
    json,
  };
}

function parseBeFile(text, format) {
  if (format === 'flat') return parseFlatFileToBE(text);
  let parsedJson;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    parsedJson = null;
  }
  return parsedJson ? parseJsonToBE(parsedJson) : parseFlatFileToBE(text);
}

// items without an invoice in the file are refused by the save validator with a clear message
function invoicesWithItems(result) {
  const items = result.items || [];
  const invoices = (result.invoices || []).map((invoice, index) => ({
    ...invoice,
    items: items.filter((item) => (Number(item.invoiceSrNo) || 1) === index + 1),
  }));
  if (!invoices.length && items.length) invoices.push({ invoiceNo: '', invNo: '', items });
  return { invoices, items };
}

// dates of ICEGATE files are YYYYMMDD: kept as YYYY-MM-DD like the screen does
function normaliseFileDates(jobData) {
  for (const field of FILE_DATE_FIELDS) {
    const match = ICEGATE_DATE_RX.exec(String(jobData[field] || '').trim());
    if (match) jobData[field] = `${match[1]}-${match[2]}-${match[3]}`;
  }
}

const shipmentModeOf = (modeCode) => {
  if (/^A/i.test(modeCode)) return 'AIR';
  if (/^L/i.test(modeCode)) return 'LAND';
  return 'SEA';
};

const BOE_TYPE_BY_CODE = { W: 'WAREHOUSE', X: 'EX_BOND' };

function payloadFromFile(result, invoices, duplicateConfirmed) {
  const jobData = result.jobData || {};
  const payload = { ...jobData, jobNo: 'DRAFT', invoices, _dupOk: duplicateConfirmed === true };
  if (result.duties && result.duties.length) payload._duties = result.duties;
  if (result.exchangeRates && result.exchangeRates.length) payload._exchangeRates = result.exchangeRates;
  if (result.infoTypes && result.infoTypes.length) payload._infoTypes = result.infoTypes;
  if (result.statements && result.statements.length) payload._statements = result.statements;
  if (!payload.shipmentMode) payload.shipmentMode = shipmentModeOf(String(jobData.autoField_52 || ''));
  if (!payload.boeType)
    payload.boeType = BOE_TYPE_BY_CODE[String(jobData.autoField_51 || '').toUpperCase()] || 'HOME_CONSUMPTION';
  return payload;
}

// an Ex-Bond read from a file links its warehouse job when the WH BE No is ours; else it is saved without the link
async function linkWarehouseJob(payload, jobData) {
  if (payload.boeType !== 'EX_BOND' || payload.inBondJobId) return false;
  const warehouseBeNo = String(jobData.warehouseBENo || '').trim();
  const inBondJob = warehouseBeNo
    ? await ImportJob.findOne({ where: { beNo: warehouseBeNo } }).catch(() => null)
    : null;
  if (inBondJob) {
    payload.inBondJobId = inBondJob.id;
    return false;
  }
  return true;
}

/**
 * "Read Flat File / Read JSON / Read XML" of the job list: the file (jsonText) read into a new draft job, ready for
 * saveImportJob (with `allowNoInBond` and the `importMessage` the save answers).
 */
export async function readJobFromFile(body) {
  const result = parseBeFile(String(body.jsonText), body.format);
  const jobData = result.jobData || {};
  if (!Object.keys(jobData).length && !(result.invoices || []).length) {
    throw new BadRequestError(`No BE data found in this file (format: ${result.detectedFormat || 'unknown'})`);
  }
  const { invoices, items } = invoicesWithItems(result);
  normaliseFileDates(jobData);
  const payload = payloadFromFile(result, invoices, body._dupOk);
  const allowNoInBond = await linkWarehouseJob(payload, jobData);
  const importMessage = `Imported (${result.detectedFormat || 'file'}): ${invoices.length} invoice(s), ${items.length} item(s)`;
  return { payload, allowNoInBond, importMessage };
}

const filedJobCannotBeDeleted = (job) =>
  new ForbiddenError(
    `Job ${job.jobNo} was ${job.icegateStatus} on ICEGATE (${job.icegateUniqueId || ''}) and cannot be deleted.`,
  );

async function destroyJobWithChildren(job, transaction) {
  await ImportContainer.destroy({ where: { importJobId: job.id }, transaction });
  const existingInvoices = await ImportInvoice.findAll({ where: { importJobId: job.id }, transaction });
  const existingInvoiceIds = existingInvoices.map((invoice) => invoice.id);
  if (existingInvoiceIds.length > 0) {
    await ImportItem.destroy({ where: { importInvoiceId: existingInvoiceIds }, transaction });
    await ImportInvoice.destroy({ where: { importJobId: job.id }, transaction });
  }
  await job.destroy({ transaction });
}

/** A BE that reached ICEGATE is a customs record: it cannot be deleted from here. */
export async function deleteImportJob(jobId) {
  const transaction = await sequelize.transaction();
  try {
    const job = await ImportJob.findByPk(jobId, { transaction });
    if (!job) throw new NotFoundError('Job not found');
    if (isFiledStatus(job.icegateStatus)) throw filedJobCannotBeDeleted(job);
    await destroyJobWithChildren(job, transaction);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function timelineLogs(jobId) {
  try {
    const remarks = await JobTimeline.findAll({
      where: { module: 'IMPORT', jobId: String(jobId) },
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

/** Log column of the job list: job created / updated, ICEGATE status and the timeline remarks, newest first. */
export async function getImportJobLogs(jobId) {
  const job = await ImportJob.findByPk(jobId, { attributes: LOG_ATTRIBUTES });
  if (!job) throw new NotFoundError('Job not found');
  const logs = [
    {
      time: job.createdAt,
      action: 'JOB_CREATED',
      user: job.createdBy || '',
      details: `Job ${job.jobNo || job.id} created`,
    },
  ];
  if (job.updatedAt && String(job.updatedAt) !== String(job.createdAt)) {
    logs.push({ time: job.updatedAt, action: 'JOB_UPDATED', user: job.updatedBy || '', details: 'Last saved' });
  }
  if (job.icegateStatus) {
    logs.push({
      time: job.updatedAt,
      action: `ICEGATE_${job.icegateStatus}`,
      user: '',
      details: job.icegateUniqueId ? `Unique ID ${job.icegateUniqueId}` : '',
    });
  }
  logs.push(...(await timelineLogs(job.id)));
  logs.sort((a, b) => new Date(b.time) - new Date(a.time));
  return logs;
}

/** Inline edit in the DSR grid: only a known form field or an existing column, a date field only with a date. */
export async function updateDsrField(jobId, { field, value }, user) {
  const job = await ImportJob.findByPk(jobId);
  if (!job) throw new NotFoundError('Job not found', messageBody('Job not found'));
  if (!ImportJob.rawAttributes[field] && !(formFieldColumns.ImportJob || []).includes(field)) {
    throw new BadRequestError(`"${field}" is not a job field`, messageBody(`"${field}" is not a job field`));
  }
  if (/Date$/.test(field) && String(value || '').trim() && validDateOrNull(value) === null) {
    throw new BadRequestError(`"${value}" is not a date`, messageBody(`"${value}" is not a date`));
  }
  await ensureFieldColumns(ImportJob, { [field]: value });
  await job.update({ [field]: value === undefined ? null : value, updatedBy: whoSaved(user) || job.updatedBy });
}

/** Quick search: job / MAWB / HAWB / IGM / IEC, or the importer through the Party master. Not the amended copies. */
export async function searchImportJobs(text) {
  const term = text || '';
  const like = { [Op.like]: `%${term}%` };
  const parties = term
    ? await Party.findAll({ where: { name: like }, attributes: ['id'], limit: SEARCH_PARTY_LIMIT })
    : [];
  const anyField = [{ jobNo: like }, { mawbNo: like }, { hawbNo: like }, { igmNumber: like }, { iecCode: like }];
  if (parties.length) anyField.push({ importerPartyId: { [Op.in]: parties.map((party) => String(party.id)) } });
  const jobs = await ImportJob.findAll({
    where: { [Op.or]: anyField, jobNo: { [Op.notLike]: 'AMD/%' } },
    include: jobWithChildren(),
    limit: SEARCH_RESULT_LIMIT,
    order: [['id', 'DESC'], ...childOrder()],
  });
  return jobs.map((job) => unpackImportJob(job));
}

/** Importer PINs known for this IEC + branch (Party master branches, other BE jobs), shown under an empty PIN box. */
export async function suggestPins({ iec, branchSrNo, address1, jobId, state }) {
  const select = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  const pins = await suggestImporterPins(select, { iec, branchSrNo, address1, jobId, state });
  return pins.slice(0, MAX_PIN_SUGGESTIONS);
}

const isoDate = (value) => {
  const text = String(value || '').trim();
  let match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
};

const numberOf = (value) => {
  const number = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
};

// the BE No is a column on some installs and kept in extendedData on others, so both are searched
async function jobsWithBeNo(beNo) {
  const include = [withInvoicesAndItems()];
  let rows = [];
  try {
    rows = await ImportJob.findAll({ where: { beNo }, include, limit: BE_LOOKUP_BY_COLUMN_LIMIT });
  } catch {
    rows = [];
  }
  if (rows.length) return rows;
  return ImportJob.findAll({
    where: { extendedData: { [Op.like]: `%${beNo}%` } },
    include,
    limit: BE_LOOKUP_BY_JSON_LIMIT,
    order: [['id', 'DESC']],
  }).catch(() => []);
}

const reExportItem = (item, invoiceIndex, itemIndex) => ({
  invSr: numberOf(item.invSrNo) || invoiceIndex + 1,
  itemSr: numberOf(item.itemSrNo || item.srNo) || itemIndex + 1,
  desc: String(item.desc || item.description || '').slice(0, MAX_ITEM_DESCRIPTION),
  qty: numberOf(item.qty),
  uqc: String(item.uqc || item.unit || '')
    .toUpperCase()
    .slice(0, 3),
  // assessableValueInr is the INR assessable value; "assessableValue" on a screen item is the invoice-currency total
  assessableValue: numberOf(item.assessableValueInr || item.assessValue || item.assValue),
  dutyPaid:
    numberOf(item.totalDuty || item.dutyAmount) ||
    ITEM_DUTY_AMOUNTS.reduce((sum, field) => sum + numberOf(item[field]), 0),
});

const reExportJob = (job, beNo) => ({
  jobId: job.id,
  jobNo: job.jobNo,
  beNo,
  beDate: isoDate(job.beDate),
  beSite: String(job.portCode || job.customHouseCode || '')
    .toUpperCase()
    .slice(0, 6),
  dutyPaidDate: isoDate(job.dutyPaidDate || job.challanDate || job.dutyPaymentDate),
  items: (job.invoices || []).flatMap((invoice, invoiceIndex) =>
    (invoice.items || []).map((item, itemIndex) => reExportItem(item, invoiceIndex, itemIndex)),
  ),
});

/** Re-export window ("Get data"): the items of our own import job with this BE No (and BE date when given). */
export async function findJobsByBeNo(beNo, beDate) {
  const wantedDate = isoDate(beDate);
  const rows = await jobsWithBeNo(beNo);
  return rows
    .map(unpackImportJob)
    .filter((job) => !AMENDED_JOB_NO_RX.test(String(job.jobNo || '')))
    .filter((job) => digitsOf(job.beNo || job.beNumber) === beNo)
    .filter((job) => !wantedDate || !isoDate(job.beDate) || isoDate(job.beDate) === wantedDate)
    .map((job) => reExportJob(job, beNo));
}

/** One job with its invoices, items and containers; the filed copy has its own route (/:id/filed-json). */
export async function getImportJob(jobId) {
  const job = await ImportJob.findByPk(jobId, { include: jobWithChildren(), order: childOrder() });
  if (!job) throw new NotFoundError('Job not found');
  const data = unpackImportJob(job);
  data.hasFiledJson = !!data.filedJson;
  delete data.filedJson;
  return data;
}

export async function getImportJobByJobNo(jobNo) {
  const job = await ImportJob.findOne({
    where: { jobNo },
    include: [withInvoicesAndItems()],
    order: childOrder().slice(0, 2),
  });
  if (!job) throw new NotFoundError('Job not found');
  return unpackImportJob(job);
}
