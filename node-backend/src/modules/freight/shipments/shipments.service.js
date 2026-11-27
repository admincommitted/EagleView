import { sequelize } from '../../../config/database.js';
import { clearPartyCache } from '../../master/party/party.service.js';
import {
  DIVISIONS,
  DOCUMENT_LIST,
  DUE_DATE_TYPES,
  EVENT_KINDS,
  isImportDivision,
  STAGES,
  STATUS_LEVELS,
} from './shipments.constants.js';
import { dateToYmd } from './shipments.customs.js';
import { badRequest, docketNotFound } from './shipments.errors.js';
import {
  branchCodesOf,
  branchCondition,
  defaultBranch,
  financialYearKey,
  nextDocket,
  seriesRow,
  today,
} from './shipments.series.js';
import { DOCKET_COLUMNS, ensureShipmentTables, execute, NUMBER_COLUMNS, selectRows } from './shipments.tables.js';
import { assertDivision, assertValidDocket } from './shipments.validation.js';

export { STATUS_LEVELS };

/**
 * Shipment Registration dockets. Tabs as on iCAFFE: Shipment, Search, Receiving Documents, Shipment Status,
 * Complete/Cancel, Activity Details, Provisional Cost Sheet (the one GST Invoice uses), Due Dates, Document List.
 */
const MAX_SERIES_NUMBER = 9999999;
const MAX_SEARCH_ROWS = 500;
const MAX_DUE_ROWS = 300;
const UPPER_CASE_COLUMNS = [
  'mawbNo',
  'hawbNo',
  'igmNo',
  'originPort',
  'destinationPort',
  'dischargePort',
  'clearanceAt',
  'ediJobNo',
];
const COLUMNS_SET_BY_THE_SERVER = ['docketNo', 'division', 'stage'];
const PARTY_FIELDS = [
  ['mainParty', 'main party'],
  ['otherParty', 'other party'],
  ['billingParty', 'billing party'],
  ['overseasAgent', 'overseas agent'],
  ['subAgent', 'sub agent'],
];
const NAMED_PARTY_FIELDS = [
  'mainParty',
  'otherParty',
  'billingParty',
  'overseasAgent',
  'subAgent',
  'consignee',
  'shipper',
  'notifyParty',
  'buyer',
];
/** Data of one shipment that a duplicate starts blank: flight / vessel and its dates, DO / LR / GRN, IGM rotation, BE / SB, values. */
const ONE_SHIPMENT_DATA = [
  'doNo',
  'doDate',
  'doCollected',
  'lrNo',
  'lrDate',
  'grnNo',
  'inwardDate',
  'atd',
  'ata',
  'sobDate',
  'rotationNo',
  'cutOff',
  'beNo',
  'beDate',
  'beType',
  'sbNo',
  'sbDate',
  'ediJobDate',
  'assValue',
  'totalDuty',
  'value',
  'icaffeShipmentId',
  'icaffe',
];

const toNumber = (value) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};
const placeholders = (values) => values.map(() => '?').join(',');
const docketById = async (id) => (await selectRows('SELECT * FROM Shipments WHERE id = ?', [id]))[0];

/** A docket row with its JSON columns opened. */
const docketOut = (row) =>
  row && {
    ...row,
    data: row.dataJson ? JSON.parse(row.dataJson) : {},
    containers: row.containersJson ? JSON.parse(row.containersJson) : [],
    dimensions: row.dimensionsJson ? JSON.parse(row.dimensionsJson) : [],
    docs: row.docsJson ? JSON.parse(row.docsJson) : {},
    dataJson: undefined,
    containersJson: undefined,
    dimensionsJson: undefined,
    docsJson: undefined,
  };

/** The searchable columns of the form, as saved (numbers as numbers, text trimmed, document numbers in capitals). */
function columnsOf(body) {
  const columns = {};
  for (const column of DOCKET_COLUMNS) {
    if (COLUMNS_SET_BY_THE_SERVER.includes(column)) continue;
    let value = body[column];
    if (value === undefined) continue;
    if (typeof value === 'boolean') value = value ? 1 : 0;
    if (NUMBER_COLUMNS.has(column)) value = value === '' || value == null ? null : toNumber(value);
    else value = value == null ? null : String(value).trim() || null;
    if (value && UPPER_CASE_COLUMNS.includes(column)) value = value.toUpperCase();
    columns[column] = value;
  }
  return columns;
}

const jsonColumnsOf = (body) => ({
  containersJson: JSON.stringify(body.containers || []),
  dimensionsJson: JSON.stringify(body.dimensions || []),
  docsJson: JSON.stringify(body.docs || {}),
  dataJson: JSON.stringify(body.data || {}),
});

export async function meta() {
  await ensureShipmentTables();
  const branches = await selectRows(
    "SELECT branchCode code, branchName name, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, branchCode",
  ).catch(() => []);
  return {
    divisions: DIVISIONS,
    statusLevels: STATUS_LEVELS,
    docList: DOCUMENT_LIST,
    dueTypes: DUE_DATE_TYPES,
    stages: STAGES,
    branches,
  };
}

/** GET /next-no?division=&branch=&date= - the number the next docket will get (nothing used up). */
export async function nextNumber(query) {
  await ensureShipmentTables();
  const division = String(query.division || '').toUpperCase();
  assertDivision(division);
  const date = query.date || today();
  const no = await nextDocket(String(query.branch || (await defaultBranch())).toUpperCase(), division, date);
  const series = await seriesRow(String(query.branch || (await defaultBranch())).toUpperCase(), division, date);
  return { no, series };
}

/** PUT /series { division, branch, date, nextNo } - change the next serial of a series (like Sequence Config). */
export async function updateSeries(body) {
  await ensureShipmentTables();
  const division = String(body.division || '').toUpperCase();
  assertDivision(division);
  const nextNo = Math.floor(toNumber(body.nextNo));
  if (nextNo < 1 || nextNo > MAX_SERIES_NUMBER) throw badRequest('Next number should be 1 or more');
  const series = await seriesRow(
    String(body.branch || (await defaultBranch())).toUpperCase(),
    division,
    body.date || today(),
  );
  await execute('UPDATE ShipmentSeries SET nextNo = ?, updatedAt = ? WHERE id = ?', [
    nextNo,
    new Date().toISOString(),
    series.id,
  ]);
  return { ok: true };
}

/** Search fields -> column (null = any of docket no, main party, MAWB, HAWB, remarks). */
const SEARCH_COLUMNS = {
  docketNo: 'docketNo',
  ediJobNo: 'ediJobNo',
  mainParty: 'mainParty',
  otherParty: 'otherParty',
  subAgent: 'subAgent',
  overseasAgent: 'overseasAgent',
  originPort: 'originPort',
  destinationPort: 'destinationPort',
  referenceNo: 'referenceNo',
  mawbNo: 'mawbNo',
  hawbNo: 'hawbNo',
  docketOwner: 'docketOwner',
  createdBy: 'createdBy',
  poNo: 'poNo',
  any: null,
};

function addSearchCondition(conditions, params, column, value) {
  // MAWB / HAWB with or without the dash or spaces (iCAFFE keeps 17612345675, the screen 176-12345675)
  if (column === 'mawbNo' || column === 'hawbNo') {
    conditions.push(`replace(replace(coalesce(${column}, ''), '-', ''), ' ', '') LIKE ?`);
    params.push('%' + String(value).replace(/[-\s]/g, '') + '%');
  } else if (column) {
    conditions.push(`${column} LIKE ?`);
    params.push('%' + value + '%');
  } else {
    conditions.push('(docketNo LIKE ? OR mainParty LIKE ? OR mawbNo LIKE ? OR hawbNo LIKE ? OR remarks LIKE ?)');
    params.push(...Array(5).fill('%' + value + '%'));
  }
}

async function searchConditions(filters) {
  const conditions = ['1 = 1'];
  const params = [];
  if (filters.division) {
    conditions.push('division = ?');
    params.push(String(filters.division).toUpperCase());
  }
  if (filters.branch) {
    const codes = await branchCodesOf(filters.branch);
    conditions.push(branchCondition('branchCode', codes));
    params.push(...codes);
  }
  if (filters.from) {
    conditions.push('docketDate >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('docketDate <= ?');
    params.push(filters.to);
  }
  if (filters.stage) {
    conditions.push("coalesce(stage, 'Register') = ?");
    params.push(filters.stage);
  }
  for (const [field, column] of Object.entries(SEARCH_COLUMNS)) {
    if (filters[field]) addSearchCondition(conditions, params, column, filters[field]);
  }
  return { conditions, params };
}

const EDI_JOB_BE_SQL =
  "SELECT upper(trim(jobNo)) j, coalesce(nullif(trim(beNo), ''), beNumber) no, beDate d FROM ImportJobs WHERE upper(trim(jobNo)) IN ";
const EDI_JOB_SB_SQL =
  "SELECT upper(trim(jobNo)) j, coalesce(nullif(trim(sbNo), ''), sbNumber) no, sbDate d FROM ExportJobs WHERE upper(trim(jobNo)) IN ";

/**
 * Only the iCAFFE dockets carry the BE / SB no; for the others it comes from the EDI job (BE / SB no and date), else
 * from the last BOE of Receiving Documents.
 */
async function fillBillOfEntryOrShippingBill(rows) {
  const missing = rows.filter((row) => !row.beNo && !row.sbNo);
  if (!missing.length) return;
  const sideOf = (row) => (isImportDivision(row.division) ? 'I' : 'E');
  const jobKey = (value) =>
    String(value || '')
      .trim()
      .toUpperCase();

  const jobs = new Map();
  for (const [side, sql] of [
    ['I', EDI_JOB_BE_SQL],
    ['E', EDI_JOB_SB_SQL],
  ]) {
    const jobNumbers = [
      ...new Set(missing.filter((row) => sideOf(row) === side && row.ediJobNo).map((row) => jobKey(row.ediJobNo))),
    ];
    if (!jobNumbers.length) continue;
    for (const job of await selectRows(sql + '(' + placeholders(jobNumbers) + ')', jobNumbers).catch(() => [])) {
      if (job.no) jobs.set(side + job.j, job);
    }
  }
  const received = new Map();
  const receivedRows = await selectRows(
    `SELECT shipmentId, title, dataJson FROM ShipmentEvents WHERE kind = 'recv_boe' AND shipmentId IN (${placeholders(missing)}) ORDER BY id`,
    missing.map((row) => row.id),
  ).catch(() => []);
  for (const event of receivedRows) received.set(event.shipmentId, event);

  for (const row of missing) {
    const job = row.ediJobNo && jobs.get(sideOf(row) + jobKey(row.ediJobNo));
    const receivedBoe = received.get(row.id);
    let number = '';
    let date = '';
    if (job) {
      number = String(job.no);
      date = job.d;
    } else if (receivedBoe) {
      number = receivedBoe.title || '';
      try {
        date = JSON.parse(receivedBoe.dataJson || '{}').docDate || '';
      } catch {
        date = '';
      }
    }
    if (!number) continue;
    const shownDate = dateToYmd(date) || String(date || '');
    if (sideOf(row) === 'I') {
      row.beNo = number;
      row.beDate = shownDate;
    } else {
      row.sbNo = number;
      row.sbDate = shownDate;
    }
  }
}

/** GET / - the Search grid: up to 500 dockets (hasMore when there are more), with the BE / SB no and date. */
export async function searchDockets(query) {
  await ensureShipmentTables();
  const lastValue = (value) => (Array.isArray(value) ? value[value.length - 1] : value);
  const filters = Object.fromEntries(Object.entries(query).map(([key, value]) => [key, lastValue(value)]));
  const { conditions, params } = await searchConditions(filters);
  const rows = await selectRows(
    `SELECT * FROM Shipments WHERE ${conditions.join(' AND ')} ORDER BY docketDate DESC, id DESC LIMIT 501`,
    params,
  );
  const dockets = rows.slice(0, MAX_SEARCH_ROWS).map((row) => {
    const docket = docketOut(row);
    const data = docket.data || {};
    return {
      ...docket,
      beNo: data.beNo || '',
      beDate: data.beDate || '',
      sbNo: data.sbNo || '',
      sbDate: data.sbDate || '',
      data: undefined,
      docs: undefined,
    };
  });
  await fillBillOfEntryOrShippingBill(dockets);
  return { dockets, hasMore: rows.length > MAX_SEARCH_ROWS };
}

export async function docketByNumber(number) {
  await ensureShipmentTables();
  const rows = await selectRows('SELECT * FROM Shipments WHERE upper(docketNo) = upper(?)', [
    String(number || '').trim(),
  ]);
  return docketOut(rows[0]) || null;
}

/** One docket with the GST invoices made on it. */
export async function docketWithInvoices(shipmentId) {
  await ensureShipmentTables();
  const docket = docketOut(await docketById(shipmentId));
  if (!docket) throw docketNotFound();
  const invoices = await selectRows(
    "SELECT invoiceNo, kind, total, status FROM AccSalesInvoices WHERE (upper(jobNo) = upper(?) OR dockets LIKE ?) AND coalesce(status, '') <> 'Void'",
    [docket.docketNo, '%"' + docket.docketNo + '"%'],
  ).catch(() => []);
  return { ...docket, invoices };
}

/** An iCAFFE consignee kept search-only in the Party Master joins the full party list once used in a shipment. */
async function releaseSearchOnlyParties(body) {
  try {
    const names = NAMED_PARTY_FIELDS.map((key) =>
      String(body[key] || '')
        .trim()
        .toUpperCase(),
    ).filter(Boolean);
    const ids = names.length
      ? (
          await selectRows(
            `SELECT id FROM Parties WHERE searchOnly = 1 AND upper(name) IN (${placeholders(names)})`,
            names,
          )
        ).map((row) => row.id)
      : [];
    if (ids.length) {
      await execute(`UPDATE Parties SET searchOnly = 0 WHERE id IN (${placeholders(ids)})`, ids);
      clearPartyCache();
    }
  } catch {
    /* the searchOnly column is there only after the bulk party load */
  }
}

/** Ties the docket to the party master: the main party's id, and the typed names not in the master (shown as a warning). */
async function linkPartyMaster(body) {
  const notInMaster = [];
  if (body.mainParty && !Number(body.mainPartyId)) {
    const party = (
      await selectRows('SELECT id FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [
        String(body.mainParty).trim(),
      ]).catch(() => [])
    )[0];
    if (party) body.mainPartyId = party.id;
  }
  for (const [key, label] of PARTY_FIELDS) {
    const name = String(body[key] || '').trim();
    if (!name) continue;
    const found = await selectRows('SELECT 1 FROM Parties WHERE upper(name) = upper(?) LIMIT 1', [name]).catch(() => [
      1,
    ]);
    if (!found.length) notInMaster.push(label + ' "' + name + '"');
  }
  await releaseSearchOnlyParties(body);
  return notInMaster;
}

const ACTIVITY_SQL =
  'INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, status, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)';

/** POST / - a new docket: the next number of its branch / division / year, and a "Docket registered" activity. */
export async function createDocket(body, user) {
  let transaction;
  try {
    await ensureShipmentTables();
    const division = String(body.division || '').toUpperCase();
    assertValidDocket(division, body);
    const branch = String(body.branchCode || (await defaultBranch())).toUpperCase();
    const notInMaster = await linkPartyMaster(body);
    transaction = await sequelize.transaction();
    const docketNo = await nextDocket(branch, division, body.docketDate, transaction, true);
    const now = new Date().toISOString();
    const row = {
      ...columnsOf(body),
      branchCode: branch,
      docketNo,
      division,
      stage: 'Register',
      currentStatus: null,
      ...jsonColumnsOf(body),
      createdBy: user,
      createdAt: now,
      updatedAt: now,
    };
    const keys = Object.keys(row);
    await execute(
      `INSERT INTO Shipments (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(',')})`,
      keys.map((key) => row[key]),
      transaction,
    );
    const id = (await selectRows('SELECT id FROM Shipments WHERE docketNo = ?', [docketNo], transaction))[0].id;
    await execute(
      ACTIVITY_SQL,
      [id, 'activity', 'Docket registered', body.docketDate, 'Done', user, now, now],
      transaction,
    );
    await transaction.commit();
    return { id, docketNo, notInMaster };
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    throw error;
  }
}

/** PUT /:id - a cancelled docket cannot be changed; the branch never changes. */
export async function updateDocket(shipmentId, body, user) {
  await ensureShipmentTables();
  const saved = await docketById(shipmentId);
  if (!saved) throw docketNotFound();
  if (saved.stage === 'Cancelled') throw badRequest('A cancelled docket cannot be modified');
  assertValidDocket(saved.division, body);
  const notInMaster = await linkPartyMaster(body);
  const row = { ...columnsOf(body), ...jsonColumnsOf(body), modifiedBy: user, updatedAt: new Date().toISOString() };
  delete row.branchCode;
  const keys = Object.keys(row);
  await execute(`UPDATE Shipments SET ${keys.map((key) => key + ' = ?').join(', ')} WHERE id = ?`, [
    ...keys.map((key) => row[key]),
    saved.id,
  ]);
  return { id: saved.id, docketNo: saved.docketNo, notInMaster };
}

async function assertDocketCanBeDeleted(docket) {
  const invoices = await selectRows(
    "SELECT invoiceNo FROM AccSalesInvoices WHERE (upper(jobNo) = upper(?) OR dockets LIKE ? OR linesJson LIKE ?) AND coalesce(status, '') <> 'Void'",
    [docket.docketNo, '%"' + docket.docketNo + '"%', '%"jobNo":"' + docket.docketNo + '"%'],
  ).catch(() => []);
  if (invoices.length) {
    throw badRequest(
      'GST invoice(s) made on this docket: ' +
        invoices.map((invoice) => invoice.invoiceNo).join(', ') +
        ' - void / delete them first, or Cancel the docket instead',
    );
  }
  const vouchers = await selectRows(
    "SELECT voucherNumber FROM Vouchers WHERE upper(trim(jobNo)) = upper(?) AND coalesce(status, '') <> 'Rejected' LIMIT 5",
    [docket.docketNo],
  ).catch(() => []);
  if (vouchers.length) {
    throw badRequest(
      'Vouchers are booked on this docket: ' +
        vouchers.map((voucher) => voucher.voucherNumber).join(', ') +
        ' - use Cancel (Complete/Cancel tab) instead',
    );
  }
}

/** The last docket of a series gives its number back. */
async function giveBackSeriesNumber(docket, now, transaction) {
  const series = (
    await selectRows(
      'SELECT * FROM ShipmentSeries WHERE branchCode = ? AND division = ? AND fy = ?',
      [docket.branchCode, docket.division, financialYearKey(docket.docketDate)],
      transaction,
    )
  )[0];
  const usedSerial = Number(String(docket.docketNo).split('/')[2]);
  if (series && usedSerial && Number(series.nextNo) === usedSerial + 1) {
    await execute(
      'UPDATE ShipmentSeries SET nextNo = ?, updatedAt = ? WHERE id = ?',
      [usedSerial, now, series.id],
      transaction,
    );
  }
}

/**
 * DELETE /:id - only a docket with no GST invoice and no voucher (cost / bill). The docket, its status / activity /
 * papers, its provisional sheet and its uploaded files' rows are copied to ShipmentsDeleted first; the uploaded files
 * stay in uploads/shipments.
 */
export async function deleteDocket(shipmentId, body, user) {
  let transaction;
  try {
    await ensureShipmentTables();
    const docket = await docketById(shipmentId);
    if (!docket) throw docketNotFound();
    await assertDocketCanBeDeleted(docket);
    const provisionalSheet = (
      await selectRows('SELECT * FROM AccProvisionalSheets WHERE upper(jobNo) = upper(?)', [docket.docketNo]).catch(
        () => [],
      )
    )[0];
    const files = await selectRows('SELECT * FROM ShipmentFiles WHERE shipmentId = ?', [docket.id]).catch(() => []);
    transaction = await sequelize.transaction();
    const now = new Date().toISOString();
    const events = await selectRows('SELECT * FROM ShipmentEvents WHERE shipmentId = ?', [docket.id], transaction);
    await execute(
      'INSERT INTO ShipmentsDeleted (shipmentId, docketNo, dataJson, eventsJson, provisionalJson, filesJson, reason, deletedBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        docket.id,
        docket.docketNo,
        JSON.stringify(docket),
        JSON.stringify(events),
        provisionalSheet ? JSON.stringify(provisionalSheet) : null,
        files.length ? JSON.stringify(files) : null,
        String((body || {}).reason || '') || null,
        user,
        now,
        now,
      ],
      transaction,
    );
    await execute('DELETE FROM ShipmentEvents WHERE shipmentId = ?', [docket.id], transaction);
    if (provisionalSheet)
      await execute('DELETE FROM AccProvisionalSheets WHERE id = ?', [provisionalSheet.id], transaction);
    await execute('DELETE FROM Shipments WHERE id = ?', [docket.id], transaction);
    await giveBackSeriesNumber(docket, now, transaction);
    await transaction.commit();
    return { ok: true, docketNo: docket.docketNo, sheet: !!provisionalSheet, files: files.length };
  } catch (error) {
    if (transaction) await transaction.rollback().catch(() => {});
    throw error;
  }
}

/**
 * POST /:id/duplicate (iCAFFE): same parties / ports / goods, new number, today's date, no MAWB / HAWB, no flight,
 * containers or Document List ticks (the papers of the new shipment are not received yet). Nothing is saved here.
 */
export async function duplicateDocket(shipmentId) {
  await ensureShipmentTables();
  const docket = docketOut(await docketById(shipmentId));
  if (!docket) throw docketNotFound();
  const data = { ...docket.data };
  for (const key of ONE_SHIPMENT_DATA) delete data[key];
  return {
    ...docket,
    id: null,
    docketNo: '',
    docketDate: today(),
    mawbNo: '',
    mawbDate: '',
    hawbNo: '',
    hawbDate: '',
    stage: 'Register',
    currentStatus: '',
    ediJobNo: '',
    igmNo: '',
    igmDate: '',
    clearanceDate: '',
    flightVessel: '',
    voyage: '',
    etd: '',
    eta: '',
    containers: [],
    docs: {},
    data,
    cancelReason: null,
    completedOn: null,
  };
}

/** A billed or costed docket is not cancelled: the reason it was skipped, or ''. */
async function billedOrCostedNote(docket) {
  const invoices = await selectRows(
    "SELECT invoiceNo FROM AccSalesInvoices WHERE (upper(jobNo) = upper(?) OR dockets LIKE ?) AND coalesce(status, '') <> 'Void'",
    [docket.docketNo, '%"' + docket.docketNo + '"%'],
  ).catch(() => []);
  const vouchers = await selectRows(
    "SELECT voucherNumber FROM Vouchers WHERE upper(jobNo) = upper(?) AND coalesce(status, '') <> 'Rejected' LIMIT 3",
    [docket.docketNo],
  ).catch(() => []);
  if (!invoices.length && !vouchers.length) return '';
  return (
    docket.docketNo +
    ' (billed / costed: ' +
    [...invoices.map((invoice) => invoice.invoiceNo), ...vouchers.map((voucher) => voucher.voucherNumber)].join(', ') +
    ')'
  );
}

/** POST /stage { ids, stage, reason, date } - Complete / Cancel, also many at once from the tab. */
export async function changeStage(body, user) {
  await ensureShipmentTables();
  const ids = (Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Boolean);
  if (!ids.length) throw badRequest('Tick the dockets');
  if (!STAGES.includes(body.stage)) throw badRequest('Operation Type?');
  if (body.stage === 'Cancelled' && !String(body.reason || '').trim())
    throw badRequest('Give the reason for cancelling');
  const now = new Date().toISOString();
  const done = [];
  const skipped = [];
  for (const docket of await selectRows(
    `SELECT id, docketNo, docketDate FROM Shipments WHERE id IN (${ids.join(',')})`,
  )) {
    if (body.stage === 'Cancelled') {
      const note = await billedOrCostedNote(docket);
      if (note) {
        skipped.push(note);
        continue;
      }
    }
    await execute(
      'UPDATE Shipments SET stage = ?, cancelReason = ?, completedOn = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?',
      [
        body.stage,
        body.stage === 'Cancelled' ? body.reason : null,
        body.stage === 'Complete' ? body.date || today() : null,
        user,
        now,
        docket.id,
      ],
    );
    await execute(
      'INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, status, remarks, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        docket.id,
        'activity',
        'Stage: ' + body.stage,
        body.date || today(),
        'Done',
        body.reason || null,
        user,
        now,
        now,
      ],
    );
    done.push(docket.docketNo);
  }
  return { done, skipped };
}

export async function listEvents(shipmentId) {
  await ensureShipmentTables();
  const rows = await selectRows(
    'SELECT * FROM ShipmentEvents WHERE shipmentId = ? ORDER BY coalesce(eventDate, createdAt), id',
    [shipmentId],
  );
  return rows.map((row) => ({ ...row, data: row.dataJson ? JSON.parse(row.dataJson) : {}, dataJson: undefined }));
}

/** The latest milestone is the docket's current status; handed over / sailed / departed moves a registered docket on. */
async function refreshCurrentStatus(docketId, title, now) {
  const latest = (
    await selectRows(
      "SELECT title, eventDate FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' ORDER BY eventDate DESC, coalesce(eventTime, '') DESC, id DESC LIMIT 1",
      [docketId],
    )
  )[0];
  await execute('UPDATE Shipments SET currentStatus = ?, updatedAt = ? WHERE id = ?', [
    latest ? latest.title : null,
    now,
    docketId,
  ]);
  if (/handed over|sailed|departed/i.test(title)) {
    await execute(
      "UPDATE Shipments SET stage = 'Hand Over To Carrier' WHERE id = ? AND coalesce(stage, 'Register') = 'Register'",
      [docketId],
    );
  }
}

/** POST /:id/events - adds (or, with id, changes) a status, activity, received paper, due date or mail row. */
export async function saveEvent(shipmentId, body, user) {
  await ensureShipmentTables();
  if (!EVENT_KINDS.includes(body.kind)) throw badRequest('Kind?');
  if (!String(body.title || '').trim()) throw badRequest('Name / title is required');
  const docket = (await selectRows('SELECT id, docketNo FROM Shipments WHERE id = ?', [shipmentId]))[0];
  if (!docket) throw docketNotFound();
  if ((body.kind === 'status' || body.kind === 'duedate') && !body.eventDate) throw badRequest('Date is required');
  const now = new Date().toISOString();
  const values = [
    body.title,
    body.eventDate || null,
    body.eventTime || null,
    body.doneDate || null,
    body.doneTime || null,
    body.status || null,
    body.remarks || null,
    JSON.stringify(body.data || {}),
  ];
  if (body.id) {
    await execute(
      'UPDATE ShipmentEvents SET title = ?, eventDate = ?, eventTime = ?, doneDate = ?, doneTime = ?, status = ?, remarks = ?, dataJson = ?, modifiedBy = ?, updatedAt = ? WHERE id = ? AND shipmentId = ?',
      [...values, user, now, body.id, docket.id],
    );
  } else {
    await execute(
      'INSERT INTO ShipmentEvents (shipmentId, kind, title, eventDate, eventTime, doneDate, doneTime, status, remarks, dataJson, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [docket.id, body.kind, ...values, user, now, now],
    );
  }
  if (body.kind === 'status') await refreshCurrentStatus(docket.id, body.title, now);
  return { ok: true };
}

export async function deleteEvent(shipmentId, eventId) {
  await ensureShipmentTables();
  await execute('DELETE FROM ShipmentEvents WHERE id = ? AND shipmentId = ?', [eventId, shipmentId]);
  const latest = (
    await selectRows(
      "SELECT title FROM ShipmentEvents WHERE shipmentId = ? AND kind = 'status' ORDER BY eventDate DESC, id DESC LIMIT 1",
      [shipmentId],
    )
  )[0];
  await execute('UPDATE Shipments SET currentStatus = ? WHERE id = ?', [latest ? latest.title : null, shipmentId]);
  return { ok: true };
}

/** PUT /:id/doclist { docs } - the Document List: received / pending tick per document. */
export async function saveDocumentList(shipmentId, body, user) {
  await ensureShipmentTables();
  const docket = (await selectRows('SELECT id FROM Shipments WHERE id = ?', [shipmentId]))[0];
  if (!docket) throw docketNotFound();
  const docs = (body || {}).docs || {};
  await execute('UPDATE Shipments SET docsJson = ?, modifiedBy = ?, updatedAt = ? WHERE id = ?', [
    JSON.stringify(docs),
    user,
    new Date().toISOString(),
    docket.id,
  ]);
  return { ok: true };
}

/** GET /due?to=&division=&branch= - the Due Dates tab: open due dates across dockets up to a date. */
export async function dueDates(query) {
  await ensureShipmentTables();
  const params = [query.to || '2999-12-31'];
  let conditions = "e.kind = 'duedate' AND coalesce(e.status, '') <> 'Done' AND e.eventDate <= ?";
  if (query.division) {
    conditions += ' AND s.division = ?';
    params.push(String(query.division).toUpperCase());
  }
  if (query.branch) {
    const codes = await branchCodesOf(query.branch);
    conditions += ' AND ' + branchCondition('s.branchCode', codes);
    params.push(...codes);
  }
  return selectRows(
    `SELECT e.*, s.docketNo, s.mainParty FROM ShipmentEvents e JOIN Shipments s ON s.id = e.shipmentId WHERE ${conditions} ORDER BY e.eventDate LIMIT ${MAX_DUE_ROWS}`,
    params,
  );
}
