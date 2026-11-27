import { ImportContainer, ImportInvoice, ImportItem } from '../../../models/index.js';
import { unpackExtra } from '../../../utils/db/extraFields.js';
import * as esanchitArchive from '../../../utils/customs/esanchitArchive.js';

/** A BE that reached ICEGATE with one of these statuses is a customs record: locked for saves, never deleted. */
export const FILED_STATUSES = new Set(['Filed', 'Accepted', 'Amended']);

export const ESANCHIT_JOB_LIST = 'esanchitDocs';
export const esanchitLists = () => ({ jobLists: ['esanchitDocs'], itemLists: ['docsData'] });

export const withInvoicesAndItems = () => ({
  model: ImportInvoice,
  as: 'invoices',
  include: [{ model: ImportItem, as: 'items' }],
});
const withContainers = () => ({ model: ImportContainer, as: 'containers' });
export const jobWithChildren = () => [withInvoicesAndItems(), withContainers()];

// child rows in the order they were saved (SQLite returns the rows of a joined read in any order)
export const childOrder = () => [
  [{ model: ImportInvoice, as: 'invoices' }, 'id', 'ASC'],
  [{ model: ImportInvoice, as: 'invoices' }, { model: ImportItem, as: 'items' }, 'id', 'ASC'],
  [{ model: ImportContainer, as: 'containers' }, 'id', 'ASC'],
];

export const isFiledStatus = (icegateStatus) => FILED_STATUSES.has(String(icegateStatus || ''));

export function parseExtendedData(extendedData) {
  if (typeof extendedData !== 'string') return extendedData;
  try {
    return JSON.parse(extendedData);
  } catch {
    return {};
  }
}

export const whoSaved = (user) => (user && (user.username || user.email)) || '';

const parseJsonTextField = (data, key) => {
  if (!data[key] || typeof data[key] !== 'string') return;
  try {
    data[key] = JSON.parse(data[key]);
  } catch {
    /* keep the text */
  }
};

const unpackInvoice = (invoiceRow) => {
  const invoice = unpackExtra(invoiceRow, 'extendedData');
  if (Array.isArray(invoice.items)) invoice.items = invoice.items.map((item) => unpackExtra(item, 'extendedData'));
  return invoice;
};

function markSignedEsanchitDocs(data) {
  try {
    esanchitArchive.mergeAdded(data, ESANCHIT_JOB_LIST, 'read');
  } catch {
    /* archive not readable */
  }
  try {
    esanchitArchive.applySigned(data, esanchitLists());
  } catch {
    /* archive not readable */
  }
}

/**
 * A saved import job as the screen reads it: the extendedData fields of the job, its invoices, items and containers
 * merged back in (columns win), the bond / HSS rows as lists, and the e-Sanchit PDFs signed in EagleView Signer shown
 * as signed (plus the documents added from the Signer).
 */
export function unpackImportJob(row) {
  if (!row) return row;
  let data = typeof row.toJSON === 'function' ? row.toJSON() : row;
  if (data.extendedData) data = unpackExtra(data, 'extendedData');
  parseJsonTextField(data, '_bondRows');
  parseJsonTextField(data, '_hssRows');
  if (Array.isArray(data.invoices)) data.invoices = data.invoices.map(unpackInvoice);
  if (Array.isArray(data.containers))
    data.containers = data.containers.map((container) => unpackExtra(container, 'extendedData'));
  markSignedEsanchitDocs(data);
  return data;
}

/** The screen's short item names are copied into the item columns (the same on every save path). */
export function applyItemColumnAliases(item) {
  item.itemNo = item.itemNo || item.itemSrNo;
  item.productDescription = item.productDescription || item.desc;
  item.hsCode = item.hsCode || item.ritc;
  item.quantity = item.quantity || item.qty;
  item.uqc = item.uqc || item.unit;
  item.unitPrice = item.unitPrice || item.price;
  item.assessableValue = item.assessableValue || item.value;
  return item;
}

const STALE_TOLERANCE_MS = 1500;

/** Two operators on one job: true when the row was saved after the screen loaded it (_loadedAt). */
export function savedSinceLoaded(loadedAt, updatedAt) {
  const loadedMs = new Date(loadedAt).getTime();
  const savedMs = new Date(updatedAt).getTime();
  return (
    Number.isFinite(loadedMs) &&
    Number.isFinite(savedMs) &&
    Math.abs(savedMs - loadedMs) > STALE_TOLERANCE_MS &&
    savedMs > loadedMs
  );
}

export const staleSaveMessage = (job) =>
  `Job ${job.jobNo} was saved by ${job.updatedBy || 'another user'} at ` +
  `${new Date(job.updatedAt).toLocaleString('en-GB')} after you opened it. Re-open the job (1. Job Query) and make your changes again.`;

const QUANTITY_TOLERANCE = 1e-6;

/**
 * Ex-bond items that clear more than the warehouse BE still holds after the ex-bonds already filed against it.
 * `entries` are { key: 'inv sr/item sr', item }; items whose key is not on the WH BE are not checked.
 */
export function exBondOverages(balances, entries) {
  const overages = [];
  for (const { key, item } of entries) {
    if (!(key in balances.whQty)) continue;
    const balance = Math.max(0, +(balances.whQty[key] - ((balances.byKey[key] || {}).cleared || 0)).toFixed(6));
    const quantity = parseFloat(item.quantity || item.qty) || 0;
    if (quantity > balance + QUANTITY_TOLERANCE) overages.push(`item ${key}: ${quantity} > balance ${balance}`);
  }
  return overages;
}

export const exBondOverageMessage = (overages, balances) =>
  `Ex-Bond quantity is more than the warehouse balance (${overages.join('; ')}).` +
  ` Reduce the quantity or check the ex-bonds already filed against WH BE ${balances.jobNo || balances.id}.`;
