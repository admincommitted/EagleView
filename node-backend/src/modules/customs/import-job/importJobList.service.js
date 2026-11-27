import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { ImportFinalDoc } from '../../../models/index.js';
import { unpackExtra } from '../../../utils/db/extraFields.js';
import { attachShipmentDockets } from '../shared/shipmentDockets.js';

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 5000;
const TABLE_COLUMNS_CACHE_MS = 10 * 60 * 1000;
const SQL_IN_CHUNK = 900;
const SHIPMENT_MODES = ['AIR', 'SEA', 'LAND'];
const BE_TYPES = ['H', 'W', 'X'];
const ICEGATE_JOB_NO_RX = /^\d{1,7}$/;
const INVOICE_SEARCH_COLUMNS = ['invNo', 'invoiceNo', 'actualInvoiceNumber', 'supplierName'];

// only the fields the job list and the DSR grid show
const LIST_KEYS = [
  'id',
  'jobNo',
  'jobDate',
  'docketNo',
  'nameOfImporter',
  'autoField_4',
  'autoField_2',
  'autoField_5',
  'autoField_20',
  'autoField_22',
  'iecCode',
  'subagentName',
  'portCode',
  'portOfOrigin',
  'countryOfOrigin',
  'beNo',
  'beDate',
  'boeType',
  'beType',
  'shipmentMode',
  'status',
  'icegateStatus',
  'icegateUniqueId',
  'isLocked',
  'lockedBy',
  'isVoid',
  'mawbNo',
  'hawbNo',
  'igmNumber',
  'igmNo',
  'invNo',
  'invDt',
  'supplierName',
  'assessableValue',
  'dutyValue',
  'totalAssessableValue',
  'totalDuty',
  'doDate',
  'clearanceDate',
  'latestRemark',
  'assignedTo',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'branchCode',
  'icegateJobNo',
];

let tableColumnsCache = null;

const quoted = (column) => `"${column}"`;
const select = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

const tableColumns = async (table) =>
  new Set((await select(`PRAGMA table_info(${table})`)).map((column) => column.name));

async function listTableColumns() {
  if (!tableColumnsCache || Date.now() - tableColumnsCache.at > TABLE_COLUMNS_CACHE_MS) {
    tableColumnsCache = {
      at: Date.now(),
      job: await tableColumns('ImportJobs'),
      inv: await tableColumns('ImportInvoices'),
      cont: await tableColumns('ImportContainers'),
    };
  }
  return tableColumnsCache;
}

const chunksOf = (list, size = SQL_IN_CHUNK) => {
  const chunks = [];
  for (let start = 0; start < list.length; start += size) chunks.push(list.slice(start, start + size));
  return chunks;
};

const yyyymmdd = (value) => {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(value || ''));
  return match ? match[1] + match[2] + match[3] : null;
};

const numberOf = (value) => {
  const number = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isNaN(number) ? 0 : number;
};

/** WHERE parts and their replacements, built from the list filters. */
class ListFilter {
  constructor(columns) {
    this.columns = columns;
    this.where = [];
    this.replacements = [];
  }

  hasJobColumn(column) {
    return this.columns.job.has(column);
  }

  add(condition, ...replacements) {
    this.where.push(condition);
    this.replacements.push(...replacements);
  }

  get sql() {
    return this.where.length ? `WHERE ${this.where.join(' AND ')}` : '';
  }
}

// amended jobs (copies made by the BE amendment register, job no AMD/...) are opened from the BE job's amendment list
function filterAmended(filter, query) {
  if (query.amended !== '1') filter.add("coalesce(j.jobNo, '') NOT LIKE 'AMD/%'");
}

// job date (yyyy-mm-dd or yyyymmdd in the table), else the day it was made
function filterJobDate(filter, query) {
  const day = `replace(substr(coalesce(nullif(trim(j.jobDate), ''), j.createdAt), 1, 10), '-', '')`;
  if (yyyymmdd(query.from)) filter.add(`${day} >= ?`, yyyymmdd(query.from));
  if (yyyymmdd(query.to)) filter.add(`${day} <= ?`, yyyymmdd(query.to));
}

function filterShipmentMode(filter, query) {
  const mode = String(query.mode || '').toUpperCase();
  if (!SHIPMENT_MODES.includes(mode) || !filter.hasJobColumn('shipmentMode')) return;
  if (mode === 'SEA') {
    filter.add(
      `upper(coalesce(j.shipmentMode, '')) NOT LIKE 'A%' AND upper(coalesce(j.shipmentMode, '')) NOT LIKE 'L%'` +
        ` AND coalesce(j.shipmentMode, '') <> ''`,
    );
  } else {
    filter.add(`upper(j.shipmentMode) LIKE '${mode[0]}%'`);
  }
}

function filterBeType(filter, query) {
  const beType = String(query.beType || '').toUpperCase();
  if (!BE_TYPES.includes(beType) || !filter.hasJobColumn('boeType')) return;
  const isWarehouse = `(upper(coalesce(j.boeType, '')) LIKE 'W%' OR upper(coalesce(j.boeType, '')) = 'IN_BOND')`;
  const isExBond = `(upper(coalesce(j.boeType, '')) LIKE 'EX%' OR upper(coalesce(j.boeType, '')) = 'X')`;
  if (beType === 'W') filter.add(isWarehouse);
  else if (beType === 'X') filter.add(isExBond);
  else filter.add(`NOT ${isWarehouse} AND NOT ${isExBond} AND coalesce(j.boeType, '') <> ''`);
}

function filterStatus(filter, query) {
  if (query.status && query.status !== 'All' && filter.hasJobColumn('status'))
    filter.add('j.status = ?', String(query.status));
}

/**
 * Text search: field=JOB_NO|BE_NO|IMPORTER|SUB_AGENT|INVOICE|MAWB_MBL|HAWB_HBL|ALL. Fields kept in extendedData
 * (importer, docket no ...) are searched in the JSON text. The job no ICEGATE mails / replies name (stored at the first
 * filing) finds the job too.
 */
function filterSearchText(filter, query) {
  const term = String(query.q || '').trim();
  if (!term) return;
  const like = `%${term.replace(/[%_\\]/g, (match) => `\\${match}`)}%`;
  const columnLikes = (columns) =>
    columns.filter((column) => filter.hasJobColumn(column)).map((column) => `j.${quoted(column)} LIKE ? ESCAPE '\\'`);
  const extendedDataLike = filter.hasJobColumn('extendedData') ? [`j.extendedData LIKE ? ESCAPE '\\'`] : [];
  const invoiceColumns = INVOICE_SEARCH_COLUMNS.filter((column) => filter.columns.inv.has(column));
  const invoiceLike = `j.id IN (SELECT importJobId FROM ImportInvoices WHERE ${invoiceColumns.map((column) => `${quoted(column)} LIKE ? ESCAPE '\\'`).join(' OR ') || '0'})`;
  const byField = {
    JOB_NO: columnLikes(['jobNo']),
    BE_NO: columnLikes(['beNo']),
    IMPORTER: columnLikes(['nameOfImporter', 'autoField_4']).concat(extendedDataLike),
    SUB_AGENT: columnLikes(['subagentName']).concat(extendedDataLike),
    MAWB_MBL: columnLikes(['mawbNo', 'mawbblNo']),
    HAWB_HBL: columnLikes(['hawbNo', 'hawbhblNo']),
  };

  const field = String(query.field || 'ALL').toUpperCase();
  let parts;
  let likeCount;
  if (field === 'INVOICE') {
    parts = [invoiceLike];
    likeCount = invoiceColumns.length;
  } else if (byField[field]) {
    parts = byField[field];
    likeCount = parts.length;
  } else {
    parts = columnLikes([
      'jobNo',
      'beNo',
      'nameOfImporter',
      'autoField_4',
      'mawbNo',
      'hawbNo',
      'igmNumber',
      'iecCode',
      'autoField_5',
      'subagentName',
    ]).concat(extendedDataLike, [invoiceLike]);
    likeCount = parts.length - 1 + invoiceColumns.length;
  }
  const searchesIcegateJobNo =
    ICEGATE_JOB_NO_RX.test(term) &&
    filter.hasJobColumn('icegateJobNo') &&
    (field === 'JOB_NO' || (!byField[field] && field !== 'INVOICE'));
  if (searchesIcegateJobNo) parts = parts.concat(['j."icegateJobNo" = ?']);
  if (!parts.length) return;
  filter.add(
    `(${parts.join(' OR ')})`,
    ...Array(likeCount).fill(like),
    ...(searchesIcegateJobNo ? [parseInt(term, 10)] : []),
  );
}

function buildListFilter(columns, query) {
  const filter = new ListFilter(columns);
  filterAmended(filter, query);
  filterJobDate(filter, query);
  filterShipmentMode(filter, query);
  filterBeType(filter, query);
  filterStatus(filter, query);
  filterSearchText(filter, query);
  return filter;
}

const groupByJob = (rows) => {
  const byJob = new Map();
  for (const row of rows) {
    const key = String(row.importJobId);
    if (!byJob.has(key)) byJob.set(key, []);
    byJob.get(key).push(row);
  }
  return byJob;
};

async function readInvoicesAndContainers(columns, jobIds) {
  const invoiceColumns = [
    'importJobId',
    'invNo',
    'invoiceNo',
    'invDate',
    'invoiceDate',
    'currency',
    'invoiceCurrency',
    'value',
    'invValue',
    'invoiceValue',
    'supplierName',
    'extendedData',
  ].filter((column) => columns.inv.has(column));
  const containerColumns = ['importJobId', 'containerNo', 'extendedData'].filter((column) => columns.cont.has(column));
  let invoiceRows = [];
  let containerRows = [];
  for (const part of chunksOf(jobIds)) {
    const placeholders = part.map(() => '?').join(',');
    invoiceRows = invoiceRows.concat(
      await select(
        `SELECT ${invoiceColumns.map(quoted).join(', ')} FROM ImportInvoices WHERE importJobId IN (${placeholders}) ORDER BY id`,
        part,
      ),
    );
    if (columns.cont.size) {
      containerRows = containerRows.concat(
        await select(
          `SELECT ${containerColumns.map(quoted).join(', ')} FROM ImportContainers WHERE importJobId IN (${placeholders}) ORDER BY id`,
          part,
        ),
      );
    }
  }
  return {
    invoicesByJob: groupByJob(invoiceRows.map((row) => unpackExtra(row, 'extendedData'))),
    containersByJob: groupByJob(containerRows.map((row) => unpackExtra(row, 'extendedData'))),
  };
}

async function readFinalDocs(jobs) {
  const beNumbers = jobs.map((job) => job.beNo).filter(Boolean);
  let finalDocs = [];
  if (!beNumbers.length) return finalDocs;
  for (const part of chunksOf(beNumbers)) {
    finalDocs = finalDocs.concat(
      await ImportFinalDoc.findAll({
        where: { beNo: { [Op.in]: part } },
        attributes: ['beNo', 'docType', 'fileUrl'],
        raw: true,
      }),
    );
  }
  return finalDocs;
}

const invoiceValueText = (invoices) => {
  const totals = {};
  for (const invoice of invoices) {
    const currency = invoice.currency || invoice.invoiceCurrency || '';
    totals[currency] = (totals[currency] || 0) + numberOf(invoice.value || invoice.invValue || invoice.invoiceValue);
  }
  return Object.entries(totals)
    .filter(([, total]) => total)
    .map(([currency, total]) => total.toFixed(2) + (currency ? ` ${currency}` : ''))
    .join(' + ');
};

function listRow(jobRow, { invoicesByJob, containersByJob, finalDocs }) {
  const full = unpackExtra(jobRow, 'extendedData');
  const row = {};
  for (const key of LIST_KEYS) if (full[key] !== undefined && full[key] !== null) row[key] = full[key];
  const invoices = invoicesByJob.get(String(jobRow.id)) || [];
  const firstInvoice = invoices[0] || {};
  row.supplier = row.supplierName || firstInvoice.supplierName || '';
  row.invNo =
    invoices
      .map((invoice) => invoice.invNo || invoice.invoiceNo)
      .filter(Boolean)
      .join(', ') ||
    row.invNo ||
    '';
  row.invDt = firstInvoice.invDate || firstInvoice.invoiceDate || row.invDt || '';
  row.invValue = invoiceValueText(invoices);
  row.containerNo = (containersByJob.get(String(jobRow.id)) || [])
    .map((container) => container.contNo || container.containerNo)
    .filter(Boolean)
    .join(', ');
  row.importer = row.autoField_4 || row.nameOfImporter || '';
  row.importerName = row.importer;
  row.igmNo = row.igmNo || row.igmNumber || '';
  row.origin = row.portOfOrigin || row.autoField_22 || row.countryOfOrigin || row.autoField_20 || '';
  row.destination = row.portCode || row.autoField_2 || '';
  if (row.assessableValue == null && row.totalAssessableValue != null) row.assessableValue = row.totalAssessableValue;
  if (row.dutyValue == null && row.totalDuty != null) row.dutyValue = row.totalDuty;
  row.invoiceCount = invoices.length;
  if (row.beNo) {
    const docs = finalDocs.filter((doc) => doc.beNo === row.beNo);
    row.hasFirstCopy = docs.some((doc) => doc.docType === 'FIRST_COPY');
    row.hasOocCopy = docs.some((doc) => doc.docType === 'OOC_COPY');
    row.hasGatepass = docs.some((doc) => doc.docType === 'GATEPASS');
    row.finalDocs = docs.map((doc) => ({ docType: doc.docType, fileUrl: doc.fileUrl }));
  }
  return row;
}

/**
 * The job list (1. Job Query): only the fields the list and the DSR grid show, read with plain SQL, filters run on all
 * jobs. ?from&to (job date), mode, beType, q + field, status, amended, limit (default 100, max 5000). Newest first.
 */
export async function listImportJobs(query) {
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIST_LIMIT));
  const columns = await listTableColumns();
  const filter = buildListFilter(columns, query);
  const pickedColumns = LIST_KEYS.filter((column) => columns.job.has(column));
  const extendedDataColumn = columns.job.has('extendedData') ? ', j.extendedData' : '';
  const jobs = await select(
    `SELECT ${pickedColumns.map((column) => `j.${quoted(column)}`).join(', ')}${extendedDataColumn} FROM ImportJobs j ${filter.sql} ORDER BY j.id DESC LIMIT ?`,
    [...filter.replacements, limit],
  );
  const { invoicesByJob, containersByJob } = await readInvoicesAndContainers(
    columns,
    jobs.map((job) => job.id),
  );
  const finalDocs = await readFinalDocs(jobs);
  const data = jobs.map((job) => listRow(job, { invoicesByJob, containersByJob, finalDocs }));
  // the docket of each job from Shipment Registration (the job itself has a docket no only when it came from iCAFFE)
  await attachShipmentDockets(data, 'I');
  const [{ n: total }] = await select(`SELECT count(*) n FROM ImportJobs j ${filter.sql}`, filter.replacements);
  return { success: true, data, total, limit };
}
