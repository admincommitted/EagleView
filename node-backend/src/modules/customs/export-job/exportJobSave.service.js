import { sequelize } from '../../../config/database.js';
import { ApiError, BadRequestError, ConflictError } from '../../../core/http/index.js';
import {
  ExportContainer,
  ExportDocument,
  ExportDrawback,
  ExportInvoice,
  ExportItem,
  ExportJob,
  ExportLicense,
} from '../../../models/index.js';
import { packExtra } from '../../../utils/db/extraFields.js';
import { ensureFieldColumns } from '../../../utils/db/dynamicColumns.js';
import { validateExportSave } from '../../../utils/customs/exportJobValidate.js';
import * as jobDuplicates from '../../../utils/customs/jobDuplicates.js';
import * as esanchitArchive from '../../../utils/customs/esanchitArchive.js';
import * as jobSequence from '../../../utils/common/jobSequence.js';
import { rank as stageRank } from '../../../utils/customs/exportStage.js';
import { exportJobWithChildren, reviveItemLists, toScreenExportJob } from './exportJobRecord.js';

const SHOWN_PROBLEMS = 3;
const ESANCHIT_LIST = 'eSanchitList';
const INDIA_TIME_ZONE = 'Asia/Kolkata';
// filing details written by ICEGATE / SB Track are never cleared by a save from an older screen
const FILING_DETAIL_KEYS = ['icegateStatus', 'icegateUniqueId', 'sbNo', 'sbDate'];

const esanchitLists = () => ({ jobLists: ['eSanchitList'], itemLists: ['eSanchitList'] });
const isTrue = (value) => value === true || value === 'true';
const listOf = (value) => (Array.isArray(value) ? value : []);

function problemsSummary(errors) {
  const more = errors.length > SHOWN_PROBLEMS ? ` | +${errors.length - SHOWN_PROBLEMS} more` : '';
  return `Not saved - ${errors.length} problem(s): ${errors.slice(0, SHOWN_PROBLEMS).join(' | ')}${more}`;
}

// Impossible values are refused before anything is written, and a NEW job that repeats the invoice (same IEC) / HAWB
// of another job is saved only after the operator says so (_dupOk). _dupOk is removed first: every key of the body
// becomes a column.
async function checkBeforeSave(payload) {
  const body = payload || {};
  const duplicateConfirmed = isTrue(body._dupOk);
  delete body._dupOk;
  const check = validateExportSave(body);
  if (check.errors.length) {
    const error = problemsSummary(check.errors);
    throw new BadRequestError(error, { body: { success: false, error, problems: check.errors } });
  }
  if (body.id || duplicateConfirmed) return;
  let matches;
  try {
    matches = await jobDuplicates.check('EXPORT', body);
  } catch (error) {
    console.warn('[export-jobs] duplicate check:', error.message);
    return;
  }
  if (matches.length) {
    const error = jobDuplicates.message(matches);
    throw new ConflictError(error, { body: { success: false, duplicate: true, matches, error } });
  }
}

// every form field gets its own column, created before the transaction (SQLite cannot alter a table inside one)
async function ensureAllFieldColumns(payload) {
  try {
    const body = payload || {};
    const invoices = listOf(body.invoices);
    await ensureFieldColumns(ExportJob, body);
    await ensureFieldColumns(ExportInvoice, invoices);
    await ensureFieldColumns(
      ExportItem,
      invoices.flatMap((invoice) => listOf(invoice.items)),
    );
    await ensureFieldColumns(ExportContainer, listOf(body.containers));
    await ensureFieldColumns(ExportDocument, listOf(body.docs));
    await ensureFieldColumns(ExportDrawback, listOf(body.dbkItems));
    await ensureFieldColumns(ExportLicense, listOf(body.licenseItems));
  } catch (error) {
    console.warn('[export-jobs] column check:', error.message);
  }
}

async function giveJobNumber(payload, transaction) {
  if (payload.jobNo && payload.jobNo !== 'DRAFT') return;
  payload.jobNo = await jobSequence.take(
    {
      branchCode: payload.branchCode,
      branchId: payload.branchId,
      shipmentMode: payload.shipmentMode,
      side: 'EXPORT',
      financialYearId: payload.financialYearId,
    },
    transaction,
  );
}

// e-Sanchit PDFs attached / signed before the job had a number go to the job's folder (plus Signer documents)
function relinkEsanchitDocs(payload) {
  try {
    esanchitArchive.relinkJob(payload, payload.jobNo, esanchitLists());
  } catch (error) {
    console.warn('[export-jobs] e-Sanchit PDFs:', error.message);
  }
  try {
    esanchitArchive.mergeAdded(payload, ESANCHIT_LIST, 'save');
  } catch {
    /* archive not readable */
  }
  try {
    esanchitArchive.applySigned(payload, esanchitLists());
  } catch {
    /* archive not readable */
  }
}

// the screen may hold an old status / LEO date (set from the Timeline or ICEGATE while the job was open): a save never
// moves the job back to an earlier stage
function keepLaterStage(existingJob, payload) {
  if (!existingJob) return;
  if (existingJob.status && stageRank(existingJob.status) > stageRank(payload.status))
    payload.status = existingJob.status;
  if (existingJob.leoDate && !payload.leoDate) payload.leoDate = existingJob.leoDate;
  for (const key of FILING_DETAIL_KEYS) if (existingJob[key] && !payload[key]) payload[key] = existingJob[key];
}

const usableDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? null : value;
};
const indiaDay = (value) => new Date(value).toLocaleDateString('en-CA', { timeZone: INDIA_TIME_ZONE });

// a blank job date went into the DATE column as "Invalid date": blank / unreadable becomes the saved date of the job,
// else the day it was made, else today (IST)
function fillJobDate(existingJob, payload) {
  if (usableDate(payload.jobDate)) return;
  if (existingJob && usableDate(existingJob.jobDate)) {
    payload.jobDate = indiaDay(existingJob.jobDate);
    return;
  }
  payload.jobDate = indiaDay(existingJob && usableDate(existingJob.createdAt) ? existingJob.createdAt : Date.now());
}

async function writeJobRow(existingJob, payload, transaction) {
  // non-column fields go into additionalData (JSON)
  const jobRow = packExtra(ExportJob, payload, 'additionalData', existingJob && existingJob.additionalData);
  if (existingJob) {
    await existingJob.update(jobRow, { transaction });
    return existingJob;
  }
  delete jobRow.id;
  return ExportJob.create(jobRow, { transaction });
}

// the screen's short invoice names always win over the column copies (a copy filled once stayed old)
function normaliseInvoice(invoice) {
  if (invoice.no) invoice.invoiceNo = invoice.no;
  if (invoice.date) invoice.invoiceDate = invoice.date;
  if (invoice.value) invoice.invoiceValue = invoice.value;
  if (invoice.exchRate) invoice.exchangeRate = invoice.exchRate;
  if (invoice.buyer) invoice.buyerName = invoice.buyer;
  if (invoice.contractType) invoice.natureOfContract = invoice.contractType;
  // a file's names for other deductions / third-party subdivision follow the Invoices tab boxes
  if (invoice.otherDeductionsRate != null || invoice.otherDeductionsAmount != null) {
    invoice.otherDeductionsRate = invoice.otherRate ?? '';
    invoice.otherDeductionsCurr = invoice.otherCurr ?? '';
    invoice.otherDeductionsAmount = invoice.otherAmount ?? '';
  }
  if (invoice.tpState != null) invoice.tpState = invoice.tpCntryDiv ?? '';
}

// the Items tab value always wins: the SB builder reads productDescription / quantity first, so a stale copy went on
// the SB. The checklist-only description (chkDesc) is never used for it.
function normaliseItem(item) {
  item.productDescription = item.desc || item.description || item.productDescription || '';
  item.hsCode = item.ritc || item.hsnCode || item.hsn_code || item.hsCode || '';
  item.quantity = item.qty || item.quantity || 0;
  item.unitPrice = item.rate || item.price || item.unitPrice || 0;
  // rows mix FC / INR values here
  if (!item.fobValue) item.fobValue = item.itemFob || item.totalFc || item.total || item.fobValueInr || 0;
  item.uqc = item.unit || item.uqc || '';
  item.itemNo = item.itemSr || item.itemNo || 1;
  // names a file left on the item (sbFileReader) follow the screen too
  if (item.description != null && item.desc) item.description = item.desc;
  if (item.hsnCode != null && item.ritc) item.hsnCode = item.ritc;
  if (item.schemeCode != null && item.scheme) item.schemeCode = String(item.scheme).trim().split(/[\s-]/)[0];
  if (item.rewardItem != null && (item.rodtep || item.reward)) {
    item.rewardItem = /^Y/i.test(String(item.rodtep || '')) || /^Y/i.test(String(item.reward || '')) ? 'Y' : 'N';
  }
  reviveItemLists(item);
  // e-Sanchit documents of the item keep every field (issuing party, dates, IRN ...) except the file itself
  if (Array.isArray(item.eSanchitList)) {
    item.eSanchitList = item.eSanchitList
      .filter((doc) => doc && typeof doc === 'object')
      .map((doc) => {
        const { file, fileData: _fileData, base64: _base64, ...rest } = doc;
        return { ...rest, fileName: doc.fileName || doc.signedName || (file && file.name) || '' };
      });
  }
}

// child rows are re-created on every save: the DB gives each a new id
async function writeInvoices(job, invoices, transaction) {
  const existingInvoices = await ExportInvoice.findAll({ where: { exportJobId: job.id }, transaction });
  const existingInvoiceIds = existingInvoices.map((invoice) => invoice.id);
  // items first: SQLite foreign keys
  if (existingInvoiceIds.length > 0)
    await ExportItem.destroy({ where: { exportInvoiceId: existingInvoiceIds }, transaction });
  await ExportInvoice.destroy({ where: { exportJobId: job.id }, transaction });
  for (const invoice of invoices) {
    invoice.exportJobId = job.id;
    delete invoice.id;
    normaliseInvoice(invoice);
    const invoiceRow = await ExportInvoice.create(packExtra(ExportInvoice, invoice, 'additionalData'), { transaction });
    if (!invoice.items || !Array.isArray(invoice.items)) continue;
    for (const item of invoice.items) {
      item.exportInvoiceId = invoiceRow.id;
      delete item.id;
      normaliseItem(item);
      await ExportItem.create(packExtra(ExportItem, item, 'additionalData'), { transaction });
    }
  }
}

async function writeContainers(job, containers, transaction) {
  await ExportContainer.destroy({ where: { exportJobId: job.id }, transaction });
  for (const container of containers) {
    container.exportJobId = job.id;
    delete container.id;
    await ExportContainer.create(packExtra(ExportContainer, container, 'additionalData'), { transaction });
  }
}

const joinedAddress = (...parts) => parts.filter(Boolean).join(', ');

function normaliseDocument(doc) {
  if (!doc.issuingPartyName) doc.issuingPartyName = doc.issuerName || doc.issuerCode || '';
  if (!doc.issuingPartyAddress)
    doc.issuingPartyAddress = joinedAddress(doc.issuerAddr1, doc.issuerAddr2, doc.issuerCity, doc.issuerPin);
  if (!doc.beneficiaryPartyName) doc.beneficiaryPartyName = doc.beneName || doc.beneCode || '';
  if (!doc.beneficiaryPartyAddress)
    doc.beneficiaryPartyAddress = joinedAddress(doc.beneAddr1, doc.beneAddr2, doc.beneCity, doc.benePin);
  if (!doc.icegateStatus) doc.icegateStatus = doc.irn ? 'UPLOADED' : 'PENDING';
}

async function replaceJobRows(Model, job, rows, transaction, normalise) {
  await Model.destroy({ where: { exportJobId: job.id }, transaction });
  for (const row of rows) {
    row.exportJobId = job.id;
    delete row.id;
    if (normalise) normalise(row);
    await Model.create(row, { transaction });
  }
}

async function writeJob(payload, user, transaction) {
  // who made the job (job list "Entered By"), kept in additionalData
  if (!payload.id && !payload.enteredBy && user) payload.enteredBy = user.username || user.name || '';
  await giveJobNumber(payload, transaction);
  relinkEsanchitDocs(payload);

  const existingJob = payload.id ? await ExportJob.findByPk(payload.id, { transaction }) : null;
  keepLaterStage(existingJob, payload);
  fillJobDate(existingJob, payload);
  const job = await writeJobRow(existingJob, payload, transaction);

  if (payload.invoices && Array.isArray(payload.invoices)) await writeInvoices(job, payload.invoices, transaction);
  if (payload.containers && Array.isArray(payload.containers))
    await writeContainers(job, payload.containers, transaction);
  if (payload.docs && Array.isArray(payload.docs))
    await replaceJobRows(ExportDocument, job, payload.docs, transaction, normaliseDocument);
  if (payload.dbkItems && Array.isArray(payload.dbkItems))
    await replaceJobRows(ExportDrawback, job, payload.dbkItems, transaction);
  if (payload.licenseItems && Array.isArray(payload.licenseItems)) {
    await replaceJobRows(ExportLicense, job, payload.licenseItems, transaction);
  }
  return job;
}

/**
 * Saves a Shipping Bill job (header, invoices with items, containers, documents, drawback and licence rows) in one
 * transaction and answers the job as the screen reads it.
 */
export async function saveExportJob(payload, user) {
  await checkBeforeSave(payload);
  await ensureAllFieldColumns(payload);
  const transaction = await sequelize.transaction();
  try {
    const job = await writeJob(payload, user, transaction);
    await transaction.commit();
    const savedJob = await ExportJob.findByPk(job.id, { include: exportJobWithChildren() });
    return { success: true, data: await toScreenExportJob(savedJob) };
  } catch (error) {
    await transaction.rollback();
    // a failed save always answered 500 { error }
    throw new ApiError(500, error.message, { body: { error: error.message } });
  }
}
