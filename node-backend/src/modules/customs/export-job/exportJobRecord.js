import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import {
  ExportContainer,
  ExportDocument,
  ExportDrawback,
  ExportInvoice,
  ExportItem,
  ExportLicense,
} from '../../../models/index.js';

const SQL_IN_CHUNK = 900;

// PackingDetails / Containers ... are text columns holding JSON; the header screen expects lists / objects
const JSON_TEXT_COLUMNS = [
  'PackingDetails',
  'Containers',
  'eSanchitList',
  '_statements',
  '_infoTypes',
  '_exchangeRates',
  'etpDetails',
];
// lists of an item kept in their own columns: the Items screen treats them as lists (JSON text crashed it)
const ITEM_LISTS = [
  'swInfos',
  'swStatements',
  'reExports',
  'eSanchitList',
  'supportDocs',
  'cessRows',
  'constRows',
  'prodRows',
  'ctrlRows',
];
// yes / no ticks stored as '0' / '1' are read back as true / false
const BOOLEAN_KEYS = { item: ['addInTemplate'], drawback: ['valManual', 'dbkQtyAuto'] };
const TRUE_TEXT_RX = /^(1|true|y|yes)$/i;

export const exportJobWithChildren = () => [
  { model: ExportInvoice, as: 'invoices', include: [{ model: ExportItem, as: 'items' }] },
  { model: ExportContainer, as: 'containers' },
  { model: ExportDocument, as: 'docs' },
  { model: ExportDrawback, as: 'dbkItems' },
  { model: ExportLicense, as: 'licenseItems' },
];

/** Older jobs kept extra UI fields as JSON in additionalData. */
export function parseExtra(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function reviveJsonColumns(record) {
  for (const key of JSON_TEXT_COLUMNS) {
    if (record && typeof record[key] === 'string' && /^\s*[[{]/.test(record[key])) {
      try {
        record[key] = JSON.parse(record[key]);
      } catch {
        /* keep the text */
      }
    }
  }
  return record;
}

export function reviveItemLists(item) {
  for (const key of ITEM_LISTS) {
    const value = item && item[key];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (!text || text === 'null') {
      item[key] = [];
    } else if (text.startsWith('[')) {
      try {
        const list = JSON.parse(text);
        item[key] = Array.isArray(list) ? list : [];
      } catch {
        item[key] = [];
      }
    }
  }
  return item;
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
// only an object, or a list of objects - what the save itself writes - so typed text stays text
const isStoredObject = (value) =>
  Array.isArray(value) ? value.length > 0 && value.every(isPlainObject) : isPlainObject(value);

function reviveObjects(record) {
  for (const [key, value] of Object.entries(record || {})) {
    if (typeof value !== 'string' || key === 'additionalData') continue;
    const text = value.trim();
    const looksLikeJson = (text[0] === '{' && text.endsWith('}')) || (text.startsWith('[{') && text.endsWith('}]'));
    if (!looksLikeJson) continue;
    try {
      const parsed = JSON.parse(text);
      if (isStoredObject(parsed)) record[key] = parsed;
    } catch {
      // plain text
    }
  }
  return record;
}

function reviveBooleans(record, keys) {
  for (const key of keys) {
    const value = record && record[key];
    if (value === undefined || value === null || value === '' || typeof value === 'boolean') continue;
    record[key] = value === 1 || TRUE_TEXT_RX.test(String(value).trim());
  }
  return record;
}

/**
 * ExportInvoices.invoiceDate is a DATETIME column holding 'YYYY-MM-DD' text, which Sequelize turns into an Invalid
 * Date: the stored text is read with plain SQL, by invoice id.
 */
export async function rawInvoiceDates(jobIds) {
  const ids = [
    ...new Set(
      (jobIds || [])
        .filter((id) => id !== null && id !== undefined)
        .map(Number)
        .filter((id) => Number.isFinite(id)),
    ),
  ];
  const dates = new Map();
  if (!ids.length) return dates;
  try {
    for (let start = 0; start < ids.length; start += SQL_IN_CHUNK) {
      const part = ids.slice(start, start + SQL_IN_CHUNK);
      const rows = await sequelize.query(
        `SELECT id, invoiceDate FROM ExportInvoices WHERE exportJobId IN (${part.map(() => '?').join(',')})`,
        { replacements: part, type: QueryTypes.SELECT },
      );
      for (const row of rows)
        dates.set(
          String(row.id),
          row.invoiceDate === null || row.invoiceDate === undefined ? null : String(row.invoiceDate),
        );
    }
  } catch {
    // no invoiceDate column: nothing to put back
  }
  return dates;
}

export function fixInvoiceDate(invoice, dates) {
  if (!invoice) return invoice;
  if (dates && dates.has(String(invoice.id))) invoice.invoiceDate = dates.get(String(invoice.id));
  else if (invoice.invoiceDate instanceof Date && Number.isNaN(invoice.invoiceDate.getTime()))
    invoice.invoiceDate = invoice.date || null;
  return invoice;
}

// the job as the screen reads it: invoice dates as stored, objects / ticks as saved
async function reviveStoredValues(jobData) {
  const dates = await rawInvoiceDates([jobData.id]);
  (jobData.invoices || []).forEach((invoice) => {
    fixInvoiceDate(invoice, dates);
    reviveObjects(invoice);
    (invoice.items || []).forEach((item) => {
      reviveObjects(item);
      reviveBooleans(item, BOOLEAN_KEYS.item);
    });
  });
  (jobData.dbkItems || []).forEach((drawback) => reviveBooleans(drawback, BOOLEAN_KEYS.drawback));
  return jobData;
}

// the short names the Items tab reads
function restoreItemAliases(item) {
  if (!item.desc && item.productDescription) item.desc = item.productDescription;
  if (!item.ritc && item.hsCode) item.ritc = item.hsCode;
  if (!item.qty && item.quantity) item.qty = String(item.quantity);
  if (!item.rate && item.unitPrice) item.rate = String(item.unitPrice);
  if (!item.unit && item.uqc) item.unit = item.uqc;
  if (!item.itemFob && item.fobValue) item.itemFob = String(item.fobValue);
  return item;
}

const withAdditionalData = (record) =>
  record.additionalData ? { ...record, ...parseExtra(record.additionalData) } : record;

function screenInvoice(invoiceRecord) {
  const invoice = withAdditionalData(invoiceRecord);
  if (invoice.items) {
    invoice.items = invoice.items.map((itemRecord) =>
      reviveItemLists(restoreItemAliases(withAdditionalData(itemRecord))),
    );
  }
  return invoice;
}

/** A saved export job (Sequelize row with its children) as the screen loads it: additionalData fields merged in. */
export async function toScreenExportJob(jobRow) {
  let jobData = jobRow.toJSON();
  reviveJsonColumns(jobData);
  if (jobData.additionalData) {
    jobData = { ...jobData, ...parseExtra(jobData.additionalData) };
    reviveJsonColumns(jobData);
  }
  if (jobData.invoices) jobData.invoices = jobData.invoices.map(screenInvoice);
  await reviveStoredValues(jobData);
  return jobData;
}
