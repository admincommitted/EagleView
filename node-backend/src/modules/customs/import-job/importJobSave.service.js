import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { ApiError, BadRequestError, ConflictError } from '../../../core/http/index.js';
import { ImportContainer, ImportInvoice, ImportItem, ImportJob, JobTimeline } from '../../../models/index.js';
import { packExtra } from '../../../utils/db/extraFields.js';
import { ensureFieldColumns } from '../../../utils/db/dynamicColumns.js';
import * as formFieldColumns from '../../../utils/db/formFieldColumns.js';
import { validateImportSave } from '../../../utils/customs/importJobValidate.js';
import * as jobDuplicates from '../../../utils/customs/jobDuplicates.js';
import * as esanchitArchive from '../../../utils/customs/esanchitArchive.js';
import * as jobSequence from '../../../utils/common/jobSequence.js';
import { lightBalances } from '../warehouse-be/warehouseBe.service.js';
import {
  ESANCHIT_JOB_LIST,
  applyItemColumnAliases,
  childOrder,
  esanchitLists,
  exBondOverageMessage,
  exBondOverages,
  isFiledStatus,
  jobWithChildren,
  parseExtendedData,
  savedSinceLoaded,
  staleSaveMessage,
  unpackImportJob,
  whoSaved,
} from './importJobRecord.js';

const SHOWN_PROBLEMS = 3;
const ITEM_INSERT_BATCH = 50;
const LOCKED_AMENDMENT_STATUSES = ['Submitted', 'Accepted', 'Void'];
// the filed copy and its stamps are written by the filing route only
const FILING_STAMP_KEYS = ['filedJson', 'filedAt', 'filedFileName', 'filedSigner', 'icegateJobNo'];

const isTrue = (value) => value === true || value === 'true';

export function problemsSummary(errors, { withMoreCount }) {
  const more = withMoreCount && errors.length > SHOWN_PROBLEMS ? ` | +${errors.length - SHOWN_PROBLEMS} more` : '';
  return `Not saved - ${errors.length} problem(s): ${errors.slice(0, SHOWN_PROBLEMS).join(' | ')}${more}`;
}

// Impossible values (dates that are not dates, negative quantities, items under a missing invoice, CIF with freight
// ...) are refused before anything is written; harmless ones are normalised in place. A draft may still be incomplete.
function refuseImpossibleValues(payload) {
  const check = validateImportSave(payload || {});
  if (!check.errors.length) return;
  const error = problemsSummary(check.errors, { withMoreCount: true });
  throw new BadRequestError(error, {
    body: { success: false, error, problems: check.errors, warnings: check.warnings },
  });
}

// A NEW job that repeats the invoice (same IEC) / HAWB of another job - most often a duplicated job, or the same file
// read twice - is saved only after the operator says so (_dupOk).
async function refuseUnconfirmedDuplicate(payload) {
  const body = payload || {};
  const duplicateConfirmed = isTrue(body._dupOk);
  delete body._dupOk;
  if (body.id || duplicateConfirmed) return;
  let matches;
  try {
    matches = await jobDuplicates.check('IMPORT', body);
  } catch (error) {
    console.warn('[import-jobs] duplicate check:', error.message);
    return;
  }
  if (matches.length) {
    const error = jobDuplicates.message(matches);
    throw new ConflictError(error, { body: { success: false, duplicate: true, matches, error } });
  }
}

const onlyKnownFields = (modelName, fields) => {
  const known = new Set(formFieldColumns[modelName] || []);
  return Object.fromEntries(Object.entries(fields || {}).filter(([key]) => known.has(key)));
};

// Known form fields get their own column, created before the transaction (SQLite cannot alter a table inside one).
// Only the fields of formFieldColumns: any other key stays in extendedData, so a stray key never adds a column.
// Items / containers have no column list: their extra fields live in extendedData.
async function ensureKnownFieldColumns(payload) {
  try {
    const body = payload || {};
    const invoices = Array.isArray(body.invoices) ? body.invoices : [];
    await ensureFieldColumns(ImportJob, onlyKnownFields('ImportJob', body));
    await ensureFieldColumns(
      ImportInvoice,
      invoices.map((invoice) => onlyKnownFields('ImportInvoice', invoice)),
    );
  } catch (error) {
    console.warn('[import-jobs] column check:', error.message);
  }
}

// An Ex-Bond needs its warehouse BE: a linked WH job of ours, or the WH BE No + Date typed in (WH BE filed elsewhere,
// or read from another software's BE file).
function checkExBondHasWarehouseBe(payload, allowNoInBond) {
  const typedWarehouseBe = String(payload.warehouseBENo || '').trim() && String(payload.warehouseBEDate || '').trim();
  if (payload.boeType === 'EX_BOND' && !payload.inBondJobId && !allowNoInBond && !typedWarehouseBe) {
    throw new Error('Ex-Bond job: link the Warehouse BE (Select WH BE) or enter the WH BE No and Date.');
  }
}

const payloadItemEntries = (payload) =>
  (Array.isArray(payload.invoices) ? payload.invoices : []).flatMap((invoice, invoiceIndex) =>
    (Array.isArray(invoice.items) ? invoice.items : []).map((item) => ({
      key: `${item.invSrNo || invoiceIndex + 1}/${item.itemSrNo || item.itemNo}`,
      item,
    })),
  );

// Checked on every save path (screen, Excel import, copy from job): an ex-bond item may not clear more than the WH BE
// still holds after the ex-bonds already filed against it.
async function checkExBondWithinWarehouseBalance(payload) {
  if (payload.boeType !== 'EX_BOND' || !payload.inBondJobId) return;
  const balances = await lightBalances(payload.inBondJobId, payload.id);
  if (!balances) return;
  const overages = exBondOverages(balances, payloadItemEntries(payload));
  if (overages.length) throw new BadRequestError(exBondOverageMessage(overages, balances));
}

async function giveJobNumber(payload, transaction) {
  if (payload.jobNo && payload.jobNo !== 'DRAFT') return;
  payload.jobNo = await jobSequence.take(
    {
      branchCode: payload.branchCode,
      branchId: payload.branchId,
      shipmentMode: payload.shipmentMode,
      side: 'IMPORT',
      financialYearId: payload.financialYearId,
    },
    transaction,
  );
}

// e-Sanchit PDFs attached before the job had a number go to the job's folder, and a screen opened before a PDF was
// signed in EagleView Signer saves the signed copy (plus the documents added from the Signer)
function relinkEsanchitDocs(payload) {
  try {
    esanchitArchive.relinkJob(payload, payload.jobNo, esanchitLists());
  } catch (error) {
    console.warn('[import-jobs] e-Sanchit PDFs:', error.message);
  }
  try {
    esanchitArchive.mergeAdded(payload, ESANCHIT_JOB_LIST, 'save');
  } catch {
    /* archive not readable */
  }
  try {
    esanchitArchive.applySigned(payload, esanchitLists());
  } catch {
    /* archive not readable */
  }
}

function stringifyRowLists(payload) {
  for (const key of ['_bondRows', '_hssRows']) {
    if (payload[key]) payload[key] = typeof payload[key] === 'string' ? payload[key] : JSON.stringify(payload[key]);
  }
}

const amendmentLockReason = (amendment) => {
  if (amendment.status === 'Void') return `amendment ${amendment.amendNo} is void`;
  if (amendment.status === 'Accepted') {
    return `amendment ${amendment.amendNo} was accepted by ICEGATE - make a new amendment for more changes`;
  }
  const sentOn = amendment.submittedAt ? ` on ${new Date(amendment.submittedAt).toLocaleDateString('en-GB')}` : '';
  return (
    `amendment ${amendment.amendNo} was sent to ICEGATE${sentOn} - if ICEGATE rejects it, mark it Rejected in the` +
    ' amendment window to change it again'
  );
};

// An amended job (BE amendment copy) is locked once its amendment was sent to ICEGATE / accepted / voided: a later
// amendment of the same BE is copied from it, so changes made after sending would never be reported.
async function checkAmendedJobIsOpen(existingJob, transaction) {
  const extendedData = parseExtendedData(existingJob.extendedData);
  const amendmentId = extendedData && extendedData._amendmentId;
  if (!amendmentId) return;
  const [amendment] = await sequelize
    .query('SELECT amendNo, status, submittedAt FROM BeAmendments WHERE id = ?', {
      replacements: [amendmentId],
      type: QueryTypes.SELECT,
      transaction,
    })
    .catch(() => []);
  if (amendment && LOCKED_AMENDMENT_STATUSES.includes(amendment.status)) {
    throw new ConflictError(`Amended job ${existingJob.jobNo} is locked: ${amendmentLockReason(amendment)}.`);
  }
}

// A BE that went to ICEGATE is locked. The screen sends _amendMode after "Unlock for amendment" (recorded on the job
// and in the timeline); the filed copy stays.
function checkFiledJobIsUnlocked(existingJob, payload) {
  if (!isFiledStatus(existingJob.icegateStatus) || existingJob.amendUnlockedAt || payload._amendMode) return;
  throw new ConflictError(
    `This BE was ${existingJob.icegateStatus} on ICEGATE (${existingJob.icegateUniqueId || ''}) and is locked.` +
      ' Use "Unlock for amendment" on the Job Header to change it.',
  );
}

async function recordAmendmentUnlock(existingJob, payload, user, transaction) {
  if (!payload._amendMode || existingJob.amendUnlockedAt) return;
  payload.amendUnlockedAt = new Date();
  payload.amendUnlockedBy = (user && user.username) || '';
  const reason = payload._amendReason ? `: ${payload._amendReason}` : '';
  try {
    await JobTimeline.create(
      {
        module: 'IMPORT',
        jobId: String(existingJob.id),
        eventType: 'UNLOCK',
        message: `Unlocked for amendment after ${existingJob.icegateStatus} (${existingJob.icegateUniqueId || ''})${reason}`,
        author: payload.amendUnlockedBy,
      },
      { transaction },
    );
  } catch {
    // the timeline is optional
  }
}

function checkNotSavedByOthers(existingJob, payload) {
  if (!existingJob || !payload._loadedAt) return;
  if (savedSinceLoaded(payload._loadedAt, existingJob.updatedAt)) {
    throw Object.assign(new ConflictError(staleSaveMessage(existingJob)), { stale: true });
  }
}

async function checkJobMayBeChanged(existingJob, payload, user, transaction) {
  if (existingJob) {
    await checkAmendedJobIsOpen(existingJob, transaction);
    checkFiledJobIsUnlocked(existingJob, payload);
    await recordAmendmentUnlock(existingJob, payload, user, transaction);
  }
  delete payload._amendMode;
  delete payload._amendReason;
  for (const key of FILING_STAMP_KEYS) delete payload[key];
  checkNotSavedByOthers(existingJob, payload);
  delete payload._loadedAt;
}

async function writeJobRow(existingJob, payload, user, transaction) {
  const savedBy = whoSaved(user);
  payload.updatedBy = savedBy;
  if (!existingJob) payload.createdBy = savedBy;
  else delete payload.createdBy;
  // every form field is kept: non-column fields go into extendedData (JSON)
  const jobRow = packExtra(ImportJob, payload, 'extendedData', existingJob && existingJob.extendedData);
  if (existingJob) {
    await existingJob.update(jobRow, { transaction });
    return existingJob;
  }
  delete jobRow.id;
  return ImportJob.create(jobRow, { transaction });
}

async function deleteInvoicesAndItems(jobId, transaction) {
  const existingInvoices = await ImportInvoice.findAll({ where: { importJobId: jobId }, transaction });
  const existingInvoiceIds = existingInvoices.map((invoice) => invoice.id);
  if (existingInvoiceIds.length > 0) {
    await ImportItem.destroy({ where: { importInvoiceId: existingInvoiceIds }, transaction });
  }
  await ImportInvoice.destroy({ where: { importJobId: jobId }, transaction });
}

// child rows are re-created on every save: the DB gives each a new id (old / duplicated ids clashed)
async function writeInvoices(job, invoices, transaction) {
  await deleteInvoicesAndItems(job.id, transaction);
  for (const invoice of invoices) {
    invoice.importJobId = job.id;
    delete invoice.id;
    const invoiceRow = await ImportInvoice.create(packExtra(ImportInvoice, invoice, 'extendedData'), { transaction });
    if (!invoice.items || !Array.isArray(invoice.items)) continue;
    const itemRows = invoice.items.map((item) => {
      item.importInvoiceId = invoiceRow.id;
      delete item.id;
      applyItemColumnAliases(item);
      return packExtra(ImportItem, item, 'extendedData');
    });
    // one INSERT per batch of items: one statement per item made a 200-item job slow to save
    for (let start = 0; start < itemRows.length; start += ITEM_INSERT_BATCH) {
      await ImportItem.bulkCreate(itemRows.slice(start, start + ITEM_INSERT_BATCH), { transaction });
    }
  }
}

async function writeContainers(job, containers, transaction) {
  await ImportContainer.destroy({ where: { importJobId: job.id }, transaction });
  for (const container of containers) {
    container.importJobId = job.id;
    delete container.id;
    await ImportContainer.create(packExtra(ImportContainer, container, 'extendedData'), { transaction });
  }
}

async function writeJob(payload, { user, allowNoInBond }, transaction) {
  checkExBondHasWarehouseBe(payload, allowNoInBond);
  await checkExBondWithinWarehouseBalance(payload);
  await giveJobNumber(payload, transaction);
  relinkEsanchitDocs(payload);
  stringifyRowLists(payload);

  const existingJob = payload.id ? await ImportJob.findByPk(payload.id, { transaction }) : null;
  await checkJobMayBeChanged(existingJob, payload, user, transaction);
  const job = await writeJobRow(existingJob, payload, user, transaction);

  if (payload.invoices && Array.isArray(payload.invoices)) await writeInvoices(job, payload.invoices, transaction);
  if (payload.containers && Array.isArray(payload.containers))
    await writeContainers(job, payload.containers, transaction);
  return job;
}

// the answer of a failed save: `locked` for a lock (409), `stale` when someone else saved the job meanwhile
function saveFailure(error) {
  const status = error.isOperational ? error.statusCode : error.status || 500;
  return new ApiError(status, error.message, {
    body: {
      success: false,
      error: error.message,
      locked: (status === 409 && !error.stale) || undefined,
      stale: error.stale || undefined,
    },
  });
}

const loadSavedImportJob = async (jobId) =>
  unpackImportJob(
    await ImportJob.findByPk(jobId, {
      include: jobWithChildren(),
      order: childOrder(),
    }),
  );

/**
 * Saves a Bill of Entry job (header, invoices with items, containers) in one transaction and answers the job as the
 * screen reads it. `allowNoInBond` lets a job read from a file be an Ex-Bond without a linked warehouse job.
 */
export async function saveImportJob(payload, { user, allowNoInBond = false, importMessage } = {}) {
  refuseImpossibleValues(payload);
  await refuseUnconfirmedDuplicate(payload);
  await ensureKnownFieldColumns(payload);

  const transaction = await sequelize.transaction();
  let job;
  try {
    job = await writeJob(payload, { user, allowNoInBond }, transaction);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw saveFailure(error);
  }
  return { success: true, data: await loadSavedImportJob(job.id), message: importMessage || undefined };
}
