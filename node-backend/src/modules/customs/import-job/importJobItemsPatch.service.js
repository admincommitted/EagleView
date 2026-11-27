import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ConflictError } from '../../../core/http/index.js';
import { ImportInvoice, ImportItem, ImportJob } from '../../../models/index.js';
import { packExtra, unpackExtra } from '../../../utils/db/extraFields.js';
import { validateImportSave } from '../../../utils/customs/importJobValidate.js';
import { lightBalances } from '../warehouse-be/warehouseBe.service.js';
import {
  applyItemColumnAliases,
  exBondOverageMessage,
  exBondOverages,
  isFiledStatus,
  parseExtendedData,
  savedSinceLoaded,
  staleSaveMessage,
  whoSaved,
} from './importJobRecord.js';
import { problemsSummary } from './importJobSave.service.js';

const MAX_PATCHED_ITEMS = 40;
const EX_BOND_TYPES = ['EX_BOND', 'X'];
const NOT_WRITTEN_COLUMNS = new Set(['id', 'createdAt', 'updatedAt', 'importInvoiceId']);
// an item may be worth a little more than its invoice (rounding): at least 1, or 0.5 % of the invoice value
const INVOICE_VALUE_TOLERANCE_RATE = 0.005;

/**
 * The full save is used instead whenever this route is not sure: the answer `fallback: true` tells the screen so.
 */
const fallback = (reason) => ({ success: false, fallback: true, error: reason });

const numberOf = (value) => {
  const number = parseFloat(String(value === null || value === undefined ? '' : value).replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
};

const itemKey = (invoicePosition, srNo) =>
  `${invoicePosition}/${String(srNo === null || srNo === undefined ? '' : srNo).trim()}`;

function fallbackReasonForJob(job) {
  if (!job) return 'job not found';
  const extendedData = parseExtendedData(job.extendedData);
  if (extendedData && extendedData._amendmentId) return 'amended job';
  if (isFiledStatus(job.icegateStatus) && !job.amendUnlockedAt) return 'filed job';
  return null;
}

function checkNotSavedByOthers(job, loadedAt) {
  if (loadedAt && savedSinceLoaded(loadedAt, job.updatedAt)) {
    const error = staleSaveMessage(job);
    throw new ConflictError(error, { body: { success: false, stale: true, error } });
  }
}

const columnOrJson = (itemColumns, name) => {
  const fromJson = `CASE WHEN json_valid(it.extendedData) THEN json_extract(it.extendedData, '$.${name}') END`;
  return `${itemColumns.has(name) ? `COALESCE(it.${name}, ${fromJson})` : fromJson} AS ${name}`;
};

async function readSavedItemKeys(invoiceRows) {
  const columns = await sequelize.query('PRAGMA table_info(ImportItems)', { type: QueryTypes.SELECT });
  const itemColumns = new Set(columns.map((column) => column.name));
  const fields = ['invSrNo', 'itemSrNo', 'itemNo', 'value'].map((name) => columnOrJson(itemColumns, name));
  return sequelize.query(
    `SELECT it.id, it.importInvoiceId AS iid, ${fields.join(', ')} FROM ImportItems it` +
      ` WHERE it.importInvoiceId IN (${invoiceRows.map(() => '?').join(',')}) ORDER BY it.id`,
    { replacements: invoiceRows.map((row) => row.id), type: QueryTypes.SELECT },
  );
}

function indexSavedItems(invoiceRows, savedItems) {
  const invoicePositions = new Map(invoiceRows.map((row, index) => [row.id, index + 1]));
  const byKey = new Map();
  const duplicateKeys = new Set();
  for (const row of savedItems) {
    const key = itemKey(invoicePositions.get(row.iid), row.itemSrNo || row.itemNo);
    if (byKey.has(key)) duplicateKeys.add(key);
    byKey.set(key, row);
  }
  return { byKey, duplicateKeys };
}

// each patched item must be exactly one saved row, under the invoice its Inv Sr No says, with the same Item Sr No
function matchPatchesToSavedItems(patches, invoiceCount, { byKey, duplicateKeys }) {
  const work = [];
  const seen = new Set();
  for (const item of patches) {
    if (!item || typeof item !== 'object') return { reason: 'bad item' };
    const invoicePosition = parseInt(item.invSrNo || '1', 10);
    const key = itemKey(invoicePosition, item.itemSrNo || item.itemNo);
    const invoiceExists = invoicePosition >= 1 && invoicePosition <= invoiceCount;
    if (!invoiceExists || duplicateKeys.has(key) || seen.has(key) || !byKey.has(key))
      return { reason: `item ${key} not found once` };
    seen.add(key);
    work.push({ it: item, invPos: invoicePosition, row: byKey.get(key), key });
  }
  return { work };
}

const itemsOfInvoice = (work, invoiceIndex) => work.filter((entry) => entry.invPos === invoiceIndex + 1);

// the item checks of the full save (values are normalised in place the same way); each invoice carries only the
// patched items
function checkPatchedItems(job, invoices, work) {
  const jobWithPatchedItems = {
    boeType: job.boeType,
    icaffeRowId: job.icaffeRowId,
    invoices: invoices.map((invoice, index) => ({
      invNo: invoice.invNo || invoice.invoiceNo,
      invoiceNo: invoice.invoiceNo,
      currency: invoice.currency || invoice.invoiceCurrency,
      items: itemsOfInvoice(work, index).map((entry) => entry.it),
    })),
  };
  const check = validateImportSave(jobWithPatchedItems);
  if (!check.errors.length) return;
  const error = problemsSummary(check.errors, { withMoreCount: false });
  throw new BadRequestError(error, { body: { success: false, error, problems: check.errors } });
}

const invoiceValueOf = (invoice) =>
  numberOf(
    invoice.value !== undefined && invoice.value !== null && invoice.value !== ''
      ? invoice.value
      : invoice.invoiceValue,
  );

// items worth more than their invoice (the full save's rule), with the other items as they are saved
function checkItemsWithinInvoiceValues(invoices, invoiceRows, savedItems, work) {
  const problems = [];
  invoices.forEach((invoice, index) => {
    const patched = itemsOfInvoice(work, index);
    if (!patched.length) return;
    const patchedIds = new Set(patched.map((entry) => entry.row.id));
    let itemsTotal = patched.reduce((sum, entry) => sum + Math.max(0, numberOf(entry.it.value)), 0);
    for (const row of savedItems) {
      if (row.iid === invoiceRows[index].id && !patchedIds.has(row.id)) itemsTotal += Math.max(0, numberOf(row.value));
    }
    const invoiceValue = invoiceValueOf(invoice);
    const tolerance = Math.max(1, invoiceValue * INVOICE_VALUE_TOLERANCE_RATE);
    if (invoiceValue > 0 && itemsTotal > invoiceValue && Math.abs(invoiceValue - itemsTotal) > tolerance) {
      problems.push(
        `Invoice ${index + 1}: Items ${itemsTotal.toFixed(2)} are worth more than the invoice value ${invoiceValue}` +
          ' - correct the invoice value or the item values',
      );
    }
  });
  if (problems.length) {
    const error = `Not saved - ${problems.join(' | ')}`;
    throw new BadRequestError(error, { body: { success: false, error, problems } });
  }
}

async function checkExBondWithinWarehouseBalance(job, work) {
  if (!EX_BOND_TYPES.includes(String(job.boeType || '')) || !job.inBondJobId) return;
  const balances = await lightBalances(job.inBondJobId, job.id);
  if (!balances) return;
  const overages = exBondOverages(
    balances,
    work.map((entry) => ({ key: entry.key, item: entry.it })),
  );
  if (overages.length) throw new BadRequestError(exBondOverageMessage(overages, balances));
}

const columnDefaultOrNull = (definition) =>
  definition.defaultValue !== undefined &&
  typeof definition.defaultValue !== 'function' &&
  typeof definition.defaultValue !== 'object'
    ? definition.defaultValue
    : null;

function patchedItemRow(entry) {
  const item = { ...entry.it };
  delete item.id;
  item.importInvoiceId = entry.row.iid;
  applyItemColumnAliases(item);
  const packed = packExtra(ImportItem, item, 'extendedData');
  // a column the item does not carry is emptied, as on a row the full save would have created afresh
  for (const [column, definition] of Object.entries(ImportItem.rawAttributes)) {
    if (!NOT_WRITTEN_COLUMNS.has(column) && !(column in packed)) packed[column] = columnDefaultOrNull(definition);
  }
  delete packed.id;
  return packed;
}

async function writePatchedItems(job, work, itemTotal, user) {
  const transaction = await sequelize.transaction();
  try {
    for (const entry of work) {
      const [written] = await ImportItem.update(patchedItemRow(entry), { where: { id: entry.row.id }, transaction });
      if (written !== 1) throw new Error(`item row ${entry.key} was not written`);
    }
    const jobPatch = packExtra(
      ImportJob,
      {
        ...(itemTotal !== undefined ? { itemTotal } : {}),
        updatedBy: whoSaved(user),
      },
      'extendedData',
      job.extendedData,
    );
    job.changed('updatedBy', true);
    await job.update(jobPatch, { transaction });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Item Modify on a saved job: writes ONLY the items that changed, in place, with the same rules as the full save
 * (item checks, items not worth more than their invoice, ex-bond balance, filed-BE lock, "saved by someone else").
 * Anything this route is not sure about answers `fallback: true` and the screen does the full save.
 */
export async function patchImportItems(jobId, body, user) {
  const request = body || {};
  const patches = Array.isArray(request.items) ? request.items : [];
  if (!patches.length || patches.length > MAX_PATCHED_ITEMS) return fallback('nothing to patch / too many items');

  const job = await ImportJob.findByPk(jobId);
  const jobFallbackReason = fallbackReasonForJob(job);
  if (jobFallbackReason) return fallback(jobFallbackReason);
  checkNotSavedByOthers(job, request._loadedAt);

  const invoiceRows = await ImportInvoice.findAll({ where: { importJobId: job.id }, order: [['id', 'ASC']] });
  if (!invoiceRows.length) return fallback('no invoices');
  const invoices = invoiceRows.map((row) => unpackExtra(row, 'extendedData'));
  const savedItems = await readSavedItemKeys(invoiceRows);
  const { work, reason } = matchPatchesToSavedItems(
    patches,
    invoiceRows.length,
    indexSavedItems(invoiceRows, savedItems),
  );
  if (reason) return fallback(reason);

  checkPatchedItems(job, invoices, work);
  checkItemsWithinInvoiceValues(invoices, invoiceRows, savedItems, work);
  await checkExBondWithinWarehouseBalance(job, work);
  await writePatchedItems(job, work, request.itemTotal, user);
  return {
    success: true,
    patched: work.length,
    data: { id: job.id, jobNo: job.jobNo, updatedAt: job.updatedAt, updatedBy: job.updatedBy },
  };
}
