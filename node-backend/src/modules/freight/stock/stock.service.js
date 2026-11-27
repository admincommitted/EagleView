import { Op } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import { Airwaybill, AwbStock, HawbStock, Party } from '../../../models/index.js';
import { checkDigitOf, pureAwbNumber, stockIdsOf } from './stock.validation.js';

/**
 * AWB / HAWB stock (Stock Master). /next RESERVES the number (status ALLOCATED) in one conditional update, so two
 * users never get the same AWB; a reservation not saved on an AWB within 4 hours is given out again. Unallocate only
 * moves ALLOCATED back to AVAILABLE; void never gives a number out again; only AVAILABLE rows can be deleted.
 */
const RESERVE_MS = 4 * 60 * 60 * 1000;
const MS_PER_HOUR = 3600000;
const BULK_INSERT_CHUNK = 500;
const MAX_RESERVE_ATTEMPTS = 5;
const DEFAULT_LIST_LIMIT = 500;
const MAX_LIST_LIMIT = 5000;
const UNUSED_LOOKAHEAD_FACTOR = 4;

const failure = (ErrorClass) => (message) => new ErrorClass(message, { body: { success: false, error: message } });
const badRequest = failure(BadRequestError);
const notFound = failure(NotFoundError);
const conflict = failure(ConflictError);

const isDay = (date) => date && /^\d{4}-\d{2}-\d{2}$/.test(date);
const dayStart = (date) => (isDay(date) ? new Date(date + 'T00:00:00') : null);
const dayEnd = (date) => (isDay(date) ? new Date(date + 'T23:59:59.999') : null);

function dateWhere(field, fromDate, toDate) {
  const from = dayStart(fromDate);
  const to = dayEnd(toDate);
  if (from && to) return { [field]: { [Op.between]: [from, to] } };
  if (from) return { [field]: { [Op.gte]: from } };
  if (to) return { [field]: { [Op.lte]: to } };
  return {};
}

const stockModelOf = (type) => (String(type || 'AWB').toUpperCase() === 'HAWB' ? HawbStock : AwbStock);
const listLimitOf = (limit) => Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);

/** Numbers that already exist are skipped and reported; one transaction per batch. */
async function insertNewStockRows(Model, numberField, rows) {
  const existingRows = await Model.findAll({
    attributes: [numberField],
    where: { [numberField]: rows.map((row) => row[numberField]) },
  });
  const existing = new Set(existingRows.map((row) => row[numberField]));
  const toAdd = rows.filter((row) => !existing.has(row[numberField]));
  await sequelize.transaction(async (transaction) => {
    for (let index = 0; index < toAdd.length; index += BULK_INSERT_CHUNK) {
      await Model.bulkCreate(toAdd.slice(index, index + BULK_INSERT_CHUNK), { transaction });
    }
  });
  return { added: toAdd.length, skipped: existing.size };
}

export async function generateAwbStock(body) {
  const prefix = String(body.airlinePrefix || '').trim();
  const start = String(body.startSerialNumber || '').replace(/\s/g, '');
  const count = parseInt(body.count, 10);
  const firstSerial = parseInt(start.slice(0, 7), 10);
  const stockDate = dayStart(body.stockDate) || new Date();
  const rows = [];
  for (let index = 0; index < count; index++) {
    const serial = String(firstSerial + index).padStart(7, '0');
    rows.push({
      airlinePrefix: prefix,
      sequenceNumber: serial,
      checkDigit: checkDigitOf(serial),
      fullAwbNumber: `${prefix}${serial}${checkDigitOf(serial)}`,
      status: 'AVAILABLE',
      stockDate,
    });
  }
  const { added, skipped } = await insertNewStockRows(AwbStock, 'fullAwbNumber', rows);
  return {
    success: true,
    generated: added,
    skipped,
    startAwb: rows[0].fullAwbNumber,
    endAwb: rows[rows.length - 1].fullAwbNumber,
  };
}

/** Reserves the next AVAILABLE AWB of the airline (status ALLOCATED); saving the AWB makes it USED. */
export async function reserveNextAwb(prefixParam) {
  const prefix = String(prefixParam || '').trim();
  await AwbStock.update(
    { status: 'AVAILABLE' },
    {
      where: { airlinePrefix: prefix, status: 'ALLOCATED', updatedAt: { [Op.lt]: new Date(Date.now() - RESERVE_MS) } },
    },
  );
  for (let attempt = 0; attempt < MAX_RESERVE_ATTEMPTS; attempt++) {
    const stock = await AwbStock.findOne({
      where: { airlinePrefix: prefix, status: 'AVAILABLE' },
      order: [
        ['sequenceNumber', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    if (!stock) throw notFound('No available AWB stock for this prefix.');
    // only one request can move this row from AVAILABLE to ALLOCATED
    const [reserved] = await AwbStock.update({ status: 'ALLOCATED' }, { where: { id: stock.id, status: 'AVAILABLE' } });
    if (reserved === 1) {
      return {
        success: true,
        awbNumber: stock.fullAwbNumber,
        serial: stock.fullAwbNumber.substring(3),
        reservedForHours: RESERVE_MS / MS_PER_HOUR,
      };
    }
  }
  throw conflict('AWB stock is busy, please try again');
}

/** Stock still marked AVAILABLE but already on a live AWB is not offered. */
async function withoutNumbersOnLiveAwbs(stocks, limit) {
  const numbers = stocks.map((stock) => stock.fullAwbNumber);
  const dashed = numbers.map((number) => `${number.slice(0, 3)}-${number.slice(3)}`);
  const used = await Airwaybill.findAll({
    attributes: ['awbNumber'],
    where: { awbNumber: { [Op.in]: [...numbers, ...dashed] }, status: { [Op.or]: [{ [Op.ne]: 'VOID' }, null] } },
  });
  const usedNumbers = new Set(used.map((awb) => String(awb.awbNumber).replace(/\D/g, '')));
  return stocks.filter((stock) => !usedNumbers.has(stock.fullAwbNumber)).slice(0, limit);
}

/** GET /list?prefix=&status=&fromDate=&toDate=&suffix=&order=seq&unused=1&limit= */
export async function listAwbStock(query) {
  const { prefix, status, fromDate, toDate } = query;
  const where = { ...dateWhere('stockDate', fromDate, toDate) };
  if (prefix) where.airlinePrefix = String(prefix);
  if (status && status !== 'ALL') where.status = String(status);
  const limit = listLimitOf(query.limit);
  // AWB screen suggestions: ?prefix=176&suffix=1234 -> only this airline, serial starting with what was typed
  if (query.suffix)
    where.fullAwbNumber = { [Op.like]: String(prefix || '') + String(query.suffix).replace(/\D/g, '') + '%' };
  const order =
    query.order === 'seq'
      ? [
          ['sequenceNumber', 'ASC'],
          ['id', 'ASC'],
        ]
      : [
          ['stockDate', 'DESC'],
          ['airlinePrefix', 'ASC'],
          ['sequenceNumber', 'ASC'],
        ];
  const stocks = await AwbStock.findAll({
    where,
    order,
    limit: query.unused ? Math.min(limit * UNUSED_LOOKAHEAD_FACTOR, MAX_LIST_LIMIT) : limit,
  });
  if (query.unused && stocks.length) return withoutNumbersOnLiveAwbs(stocks, limit);
  return stocks;
}

/** GET /hawb/list?status=&fromDate=&toDate= - with the HAWB party's name. */
export async function listHawbStock(query) {
  const { status, fromDate, toDate } = query;
  const where = { ...dateWhere('stockDate', fromDate, toDate) };
  if (status && status !== 'ALL') where.status = String(status);
  const stocks = await HawbStock.findAll({
    where,
    order: [
      ['stockDate', 'DESC'],
      ['prefix', 'ASC'],
      ['sequenceNumber', 'ASC'],
    ],
    limit: listLimitOf(query.limit),
  });
  const partyIds = [...new Set(stocks.map((stock) => stock.partyId).filter(Boolean))];
  const parties = partyIds.length ? await Party.findAll({ attributes: ['id', 'name'], where: { id: partyIds } }) : [];
  const nameById = new Map(parties.map((party) => [party.id, party.name]));
  return stocks.map((stock) => ({
    ...stock.toJSON(),
    partyName: nameById.get(stock.partyId) || '',
    party: stock.partyId ? { id: stock.partyId, name: nameById.get(stock.partyId) || '' } : null,
  }));
}

export async function generateHawbStock(body) {
  const prefix = String(body.prefix || '')
    .trim()
    .toUpperCase();
  const start = String(body.startSerialNumber || '').trim();
  const count = parseInt(body.count, 10);
  const partyId = body.partyId ? parseInt(body.partyId, 10) : null;
  if (partyId && !(await Party.findByPk(partyId, { attributes: ['id'] }))) throw badRequest('Selected party not found');

  const firstNumber = parseInt(start, 10);
  const width = start.length;
  const stockDate = dayStart(body.stockDate) || new Date();
  const rows = [];
  for (let index = 0; index < count; index++) {
    const serial = String(firstNumber + index).padStart(width, '0');
    rows.push({
      prefix,
      sequenceNumber: serial,
      fullHawbNumber: prefix + serial,
      status: 'AVAILABLE',
      partyType: body.partyType || null,
      partyId,
      stockDate,
    });
  }
  const { added, skipped } = await insertNewStockRows(HawbStock, 'fullHawbNumber', rows);
  return {
    success: true,
    generated: added,
    skipped,
    startHawb: rows[0].fullHawbNumber,
    endHawb: rows[rows.length - 1].fullHawbNumber,
  };
}

/** ALLOCATED -> AVAILABLE only. */
export async function unallocateStock({ ids, type }) {
  const stockIds = stockIdsOf(ids);
  const [updated] = await stockModelOf(type).update(
    { status: 'AVAILABLE' },
    { where: { id: stockIds, status: 'ALLOCATED' } },
  );
  const skipped = stockIds.length - updated;
  return {
    success: true,
    updated,
    skipped,
    message:
      `${updated} unallocated` + (skipped ? `, ${skipped} skipped (only ALLOCATED stock can be unallocated)` : ''),
  };
}

/** AVAILABLE / ALLOCATED -> VOID (never given out again). */
export async function voidStock({ ids, type }) {
  const stockIds = stockIdsOf(ids);
  const [updated] = await stockModelOf(type).update(
    { status: 'VOID' },
    { where: { id: stockIds, status: ['AVAILABLE', 'ALLOCATED'] } },
  );
  const skipped = stockIds.length - updated;
  return {
    success: true,
    updated,
    skipped,
    message: `${updated} voided` + (skipped ? `, ${skipped} skipped (USED / already VOID)` : ''),
  };
}

/** Removes stock entered by mistake; only AVAILABLE rows. */
export async function deleteStock({ ids, type }) {
  const stockIds = stockIdsOf(ids);
  const deleted = await stockModelOf(type).destroy({ where: { id: stockIds, status: 'AVAILABLE' } });
  const skipped = stockIds.length - deleted;
  return {
    success: true,
    deleted,
    skipped,
    message:
      `${deleted} deleted` +
      (skipped ? `, ${skipped} skipped (only AVAILABLE stock can be deleted; use Void for the others)` : ''),
  };
}

async function findStockRow(number) {
  const row = await AwbStock.findOne({ where: { fullAwbNumber: number } });
  if (!row) throw notFound('This AWB is not in the stock');
  return row;
}

/** Is this AWB in our stock, and its status. */
export async function verifyAwb(awbParam) {
  return { success: true, data: await findStockRow(pureAwbNumber(awbParam)) };
}

/** Return Stock tab - UNUSED: ALLOCATED -> AVAILABLE (number can be used again); VOID: AVAILABLE / ALLOCATED -> VOID. */
export async function returnAwb(body) {
  const number = pureAwbNumber(body.awbNumber);
  const action = String(body.action || '').toUpperCase();
  const row = await findStockRow(number);
  if (row.status === 'USED') throw badRequest('This AWB is already used on a saved AirWayBill - cancel that AWB first');
  if (row.status === 'VOID') throw badRequest('This AWB is already VOID');
  if (action === 'UNUSED' && row.status === 'AVAILABLE') throw badRequest('This AWB is already AVAILABLE');
  await row.update({ status: action === 'VOID' ? 'VOID' : 'AVAILABLE' });
  return { success: true, data: row, message: `AWB ${number} is now ${row.status}` };
}
