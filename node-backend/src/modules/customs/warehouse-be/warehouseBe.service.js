import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { ImportInvoice, ImportItem, ImportJob } from '../../../models/index.js';
import { unpackExtra } from '../../../utils/db/extraFields.js';
import { NotFoundError } from '../../../core/http/index.js';

const WAREHOUSE_BOE_TYPES = ['WAREHOUSING', 'WAREHOUSE', 'W'];
const EX_BOND_BOE_TYPES = ['EX_BOND', 'X'];
const FILED_STATUSES = ['Filed', 'Accepted', 'Amended'];
const WAREHOUSE_LIST_LIMIT = 500;
const PORT_CODE_RX = /^[A-Z]{2}[A-Z0-9]{3,4}$/;

const unpackJobFields = (row) => unpackExtra(row, 'extendedData');
const upper = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();
const quantityOf = (item) => parseFloat(item.quantity || item.qty) || 0;
const roundedBalance = (value) => Math.max(0, +value.toFixed(6));

// An ex-bond counts against the warehouse balance once it reached customs (filed / accepted through the API, or with a
// BE No / OOC date typed in); drafts and rejected ones are only reported (draft) so the screen can warn.
const exBondIsFiled = (exBondJob) =>
  FILED_STATUSES.includes(String(exBondJob.icegateStatus || '')) ||
  !!String(exBondJob.beNo || '').trim() ||
  !!String(exBondJob.oocDate || '').trim();

const exBondsOfWarehouseJob = (warehouseJobId, options = {}) =>
  ImportJob.findAll({
    where: {
      inBondJobId: { [Op.in]: [String(warehouseJobId), warehouseJobId] },
      boeType: { [Op.in]: EX_BOND_BOE_TYPES },
    },
    ...options,
  });

/** Quantities of a WH BE already cleared by its ex-bond jobs, by "inv sr/item sr" (full read of every ex-bond job). */
async function balancesFor(warehouseJob, excludeJobId) {
  const exBondJobs = await exBondsOfWarehouseJob(warehouseJob.id, {
    include: [{ model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] }],
  });
  const byKey = {};
  let filedCount = 0;
  let draftCount = 0;
  for (const exBondJob of exBondJobs) {
    if (excludeJobId && String(exBondJob.id) === String(excludeJobId)) continue;
    const isFiled = exBondIsFiled(exBondJob);
    if (isFiled) filedCount++;
    else draftCount++;
    (exBondJob.invoices || []).forEach((invoice, invoiceIndex) =>
      (invoice.items || []).forEach((itemRow) => {
        const item = unpackJobFields(itemRow);
        const key = `${item.invSrNo || invoiceIndex + 1}/${item.itemSrNo || item.itemNo}`;
        const balance = byKey[key] || (byKey[key] = { cleared: 0, draft: 0 });
        if (isFiled) balance.cleared += quantityOf(item);
        else balance.draft += quantityOf(item);
      }),
    );
  }
  return { byKey, filedCount, draftCount };
}

const itemColumnOrJson = (itemColumns, name) => {
  const fromJson = `CASE WHEN json_valid(it.extendedData) THEN json_extract(it.extendedData, '$.${name}') END`;
  return `${itemColumns.has(name) ? `COALESCE(it.${name}, ${fromJson})` : fromJson} AS ${name}`;
};

async function importItemColumns() {
  const columns = await sequelize.query('PRAGMA table_info(ImportItems)', { type: QueryTypes.SELECT });
  return new Set(columns.map((column) => column.name));
}

const readBalanceItemRows = async (jobIds) => {
  const itemColumns = await importItemColumns();
  const fields = ['invSrNo', 'itemSrNo', 'itemNo', 'quantity', 'qty'].map((name) =>
    itemColumnOrJson(itemColumns, name),
  );
  return sequelize.query(
    `SELECT inv.importJobId AS jid, inv.id AS iid, ${fields.join(', ')}
       FROM ImportItems it JOIN ImportInvoices inv ON inv.id = it.importInvoiceId
      WHERE inv.importJobId IN (${jobIds.map(() => '?').join(',')}) ORDER BY inv.importJobId, inv.id, it.id`,
    { replacements: jobIds, type: QueryTypes.SELECT },
  );
};

/**
 * The warehouse balance figures read with one light query: only inv sr, item sr / no and quantity of each item, a column
 * first and extendedData when the column is empty (as unpackExtra does). Used on every ex-bond save, so it must stay
 * light. Returns null when the WH job is not in our system.
 */
export async function lightBalances(inBondJobId, jobId) {
  const warehouseJob = await ImportJob.findByPk(inBondJobId, { attributes: ['id', 'jobNo'] });
  if (!warehouseJob) return null;
  const hasColumn = (column) => !!(ImportJob.rawAttributes && ImportJob.rawAttributes[column]);
  const exBondJobs = await exBondsOfWarehouseJob(warehouseJob.id, {
    attributes: ['id', ...['icegateStatus', 'beNo', 'oocDate'].filter(hasColumn)],
  });
  const rows = await readBalanceItemRows([warehouseJob.id, ...exBondJobs.map((exBondJob) => exBondJob.id)]);

  const invoicePositions = {};
  const invoicePosition = (jid, iid) => {
    const positions = invoicePositions[jid] || (invoicePositions[jid] = new Map());
    if (!positions.has(iid)) positions.set(iid, positions.size + 1);
    return positions.get(iid);
  };
  const keyOf = (row) => `${row.invSrNo || invoicePosition(row.jid, row.iid)}/${row.itemSrNo || row.itemNo}`;

  const whQty = {};
  const byKey = {};
  let filedCount = 0;
  let draftCount = 0;
  const exBondState = {};
  for (const exBondJob of exBondJobs) {
    if (jobId && String(exBondJob.id) === String(jobId)) continue;
    const isFiled = exBondIsFiled(exBondJob);
    exBondState[exBondJob.id] = isFiled ? 'filed' : 'draft';
    if (isFiled) filedCount++;
    else draftCount++;
  }
  for (const row of rows) {
    if (String(row.jid) === String(warehouseJob.id)) {
      whQty[keyOf(row)] = quantityOf(row);
      continue;
    }
    const state = exBondState[row.jid];
    if (!state) continue;
    const balance = byKey[keyOf(row)] || (byKey[keyOf(row)] = { cleared: 0, draft: 0 });
    if (state === 'filed') balance.cleared += quantityOf(row);
    else balance.draft += quantityOf(row);
  }
  return { id: warehouseJob.id, jobNo: warehouseJob.jobNo, whQty, byKey, filedCount, draftCount };
}

const jsonRows = (value) => {
  let rows = value;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      rows = [];
    }
  }
  return Array.isArray(rows) ? rows : [];
};

const portOf = (job) =>
  upper(job.portCode || job.autoField_2 || (PORT_CODE_RX.test(upper(job.autoField_1)) ? job.autoField_1 : ''));

async function exBondCountsByWarehouseJob(warehouseJobIds, excludeJobId) {
  const exBonds = warehouseJobIds.length
    ? await ImportJob.findAll({
        where: {
          inBondJobId: { [Op.in]: warehouseJobIds.map(String).concat(warehouseJobIds) },
          boeType: { [Op.in]: EX_BOND_BOE_TYPES },
        },
        attributes: ['id', 'inBondJobId'],
      })
    : [];
  const counts = {};
  for (const exBond of exBonds) {
    if (String(exBond.id) !== String(excludeJobId || '')) {
      counts[String(exBond.inBondJobId)] = (counts[String(exBond.inBondJobId)] || 0) + 1;
    }
  }
  return counts;
}

function warehouseListRow(jobRow, exBondCounts, wanted) {
  const job = unpackJobFields(jobRow);
  const igm = jsonRows(job._igmRows)[0] || {};
  const iec = upper(job.autoField_5 || job.iecCode);
  const importerName = String(job.autoField_4 || job.nameOfImporter || '').trim();
  const port = portOf(job);
  return {
    id: job.id,
    jobNo: job.jobNo,
    jobDate: job.jobDate || job.createdAt,
    status: job.status || 'DRAFT',
    beNo: job.beNo || '',
    beDate: job.beDate || '',
    importerName,
    iecCode: iec,
    branchSrNo: job.autoField_48 || job.branchSrNo || '',
    customsPort: port,
    warehouseCode: job.warehouseCode || '',
    igmNo: job.igmNumber || igm.igmNumber || igm.igmNo || '',
    mawbNo: job.mawbNo || igm.mawbNo || '',
    hawbNo: job.hawbNo || igm.hawbNo || '',
    shipmentMode: job.shipmentMode,
    invoiceNo: (job.invoices || [])
      .map((invoice) => invoice.invNo || invoice.invoiceNo)
      .filter(Boolean)
      .join(', '),
    exBondCount: exBondCounts[String(job.id)] || 0,
    matchImporter: !!((wanted.iec && iec === wanted.iec) || (wanted.name && upper(importerName) === wanted.name)),
    matchPort: !!(wanted.port && port === wanted.port),
  };
}

/**
 * All warehousing (W) BEs, newest first. Each row says whether it matches this job's importer / port so the screen can
 * show the matching ones first. Job fields are read through extendedData too.
 */
export async function listWarehouseJobs({ iecCode, importerName, customsPort, excludeJobId }) {
  const jobs = await ImportJob.findAll({
    where: { boeType: { [Op.in]: WAREHOUSE_BOE_TYPES } },
    include: [{ model: ImportInvoice, as: 'invoices', required: false }],
    order: [['createdAt', 'DESC']],
    limit: WAREHOUSE_LIST_LIMIT,
  });
  const exBondCounts = await exBondCountsByWarehouseJob(
    jobs.map((job) => job.id),
    excludeJobId,
  );
  const wanted = { iec: upper(iecCode), name: upper(importerName), port: upper(customsPort) };
  return jobs.map((job) => warehouseListRow(job, exBondCounts, wanted));
}

export async function getWarehouseBalances(warehouseJobId, excludeJobId) {
  const balances = await lightBalances(warehouseJobId, excludeJobId);
  if (!balances) throw new NotFoundError('Warehouse job not found');
  return balances;
}

/**
 * WH job with its items. Each item carries the quantity already cleared by other Ex-Bond BEs of this WH BE
 * (_whClearedQty), what is being cleared by unfiled ex-bonds (_whDraftQty) and what is left (_whBalanceQty).
 */
export async function getWarehouseJobWithBalances(jobId, excludeJobId) {
  const job = await ImportJob.findByPk(jobId, {
    include: [{ model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] }],
  });
  if (!job) throw new NotFoundError('Job not found');
  const data = unpackJobFields(job);
  data.invoices = (data.invoices || []).map((invoiceRow) => {
    const invoice = unpackJobFields(invoiceRow);
    invoice.items = (invoice.items || []).map(unpackJobFields);
    return invoice;
  });
  const balances = await balancesFor(job, excludeJobId);
  data.invoices.forEach((invoice, invoiceIndex) =>
    invoice.items.forEach((item) => {
      const balance = balances.byKey[`${item.invSrNo || invoiceIndex + 1}/${item.itemSrNo || item.itemNo}`] || {
        cleared: 0,
        draft: 0,
      };
      item._whClearedQty = balance.cleared;
      item._whDraftQty = balance.draft;
      item._whBalanceQty = roundedBalance(quantityOf(item) - balance.cleared);
    }),
  );
  data.exBondCount = balances.filedCount;
  data.exBondDraftCount = balances.draftCount;
  return data;
}

export const listExBondJobs = (warehouseJobId) =>
  ImportJob.findAll({
    where: { inBondJobId: warehouseJobId, boeType: { [Op.in]: EX_BOND_BOE_TYPES } },
    attributes: ['id', 'jobNo', 'jobDate', 'status', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });
