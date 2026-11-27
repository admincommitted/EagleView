import { sequelize } from '../../../config/database.js';
import { ApiError, BadRequestError } from '../../../core/http/index.js';
import {
  IataDgrMaster,
  IataExchangeRate,
  IataShcConflict,
  TactCarrierRule,
  TactCountryRule,
  TactEquipmentRule,
  TactProportionalRate,
  TactRateDetail,
  TactRateSector,
  TactSurcharge,
} from '../../../models/index.js';

/** The flat TACT / IATA tables, by the screen's list path. */
const LIST_MODELS = {
  'country-rules': TactCountryRule,
  'carrier-rules': TactCarrierRule,
  equipment: TactEquipmentRule,
  dgr: IataDgrMaster,
  surcharges: TactSurcharge,
  'exchange-rates': IataExchangeRate,
  'shc-conflicts': IataShcConflict,
  'proportional-rates': TactProportionalRate,
};

// the screen's tab ids for CSV upload; GCR rates have sector + detail rows, not one CSV row
const UPLOAD_MODELS = {
  country: TactCountryRule,
  carrier: TactCarrierRule,
  dgr: IataDgrMaster,
  equipment: TactEquipmentRule,
  surcharges: TactSurcharge,
  rates: TactSurcharge,
  icer: IataExchangeRate,
  'exchange-rates': IataExchangeRate,
  shc: IataShcConflict,
  'shc-conflicts': IataShcConflict,
  addons: TactProportionalRate,
  'proportional-rates': TactProportionalRate,
};
const STAMP_COLUMNS = ['id', 'createdAt', 'updatedAt'];
const TRUE_TEXTS = ['1', 'true', 'yes', 'y'];
const ALL_CARRIERS = ['ALL', ''];
const BYTE_ORDER_MARK = /^﻿/;

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { error: message } });
const notQuoted = (status, message) => new ApiError(status, message, { body: { success: false, error: message } });

export const listTable = (tableName) => LIST_MODELS[tableName].findAll();

export const listRateSectors = () =>
  TactRateSector.findAll({ include: [{ model: TactRateDetail, as: 'rateDetails' }] });

/** One CSV line split on commas outside quotes; "" inside quotes is one quote. */
function splitCsvLine(line) {
  const values = [];
  let inQuotes = false;
  let current = '';
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && inQuotes && line[index + 1] === '"') {
      current += '"';
      index++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

/** CSV with a header row -> one object per line (header -> value, '' when missing). */
function parseCsv(buffer) {
  const lines = buffer
    .toString('utf-8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((header) => header.trim().replace(/"/g, ''));
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    return record;
  });
}

/** Only columns of the table are kept; '' is null and yes / true / 1 / y are booleans. */
function rowsForTable(Model, records, columns) {
  return records.map((record) => {
    const row = {};
    for (const name of columns) {
      if (record[name] === undefined) continue;
      let value = record[name];
      const type = Model.rawAttributes[name].type && Model.rawAttributes[name].type.key;
      if (value === '') value = null;
      else if (type === 'BOOLEAN') value = TRUE_TEXTS.includes(String(value).toLowerCase());
      row[name] = value;
    }
    return row;
  });
}

function rowErrorOf(error, lineNo) {
  const rowError = new Error(
    `Line ${lineNo}: ${error.errors ? error.errors.map((item) => item.message).join(', ') : error.message}`,
  );
  rowError.rowError = true;
  return rowError;
}

/** All rows in one transaction (replace: the table is emptied first); a bad row stops the import with its line no. */
async function importRows(Model, rows, replace) {
  try {
    await sequelize.transaction(async (transaction) => {
      if (replace) await Model.destroy({ where: {}, transaction });
      for (let index = 0; index < rows.length; index++) {
        try {
          await Model.create(rows[index], { transaction });
        } catch (error) {
          throw rowErrorOf(error, index + 2);
        }
      }
    });
  } catch (error) {
    if (error.rowError) throw failed(BadRequestError, `${error.message} - nothing was imported`);
    throw error;
  }
}

/**
 * POST /upload/:type?mode=replace|append - a CSV (header row) into one TACT table. id / createdAt / updatedAt from a
 * downloaded file are dropped, so a download can be uploaded again.
 */
export async function uploadCsv(file, typeText, modeText) {
  if (!file) throw failed(BadRequestError, 'No file uploaded');
  const type = String(typeText || '').toLowerCase();
  if (type === 'gcr') throw failed(BadRequestError, 'GCR rates cannot be bulk uploaded from CSV (sector + rate rows)');
  const Model = UPLOAD_MODELS[type];
  if (!Model) throw failed(BadRequestError, 'Invalid master type');
  const records = parseCsv(Buffer.from(file.buffer.toString('utf-8').replace(BYTE_ORDER_MARK, ''), 'utf-8'));
  if (records.length === 0) throw failed(BadRequestError, 'Empty or invalid CSV file');

  const columns = Object.keys(Model.rawAttributes).filter((name) => !STAMP_COLUMNS.includes(name));
  const headers = Object.keys(records[0]);
  const ignoredColumns = headers.filter(
    (header) => header && !columns.includes(header) && !STAMP_COLUMNS.includes(header),
  );
  if (!headers.some((header) => columns.includes(header))) {
    throw failed(BadRequestError, `No known column in the header. Expected: ${columns.join(', ')}`);
  }
  const rows = rowsForTable(Model, records, columns);
  const replace = String(modeText || '').toLowerCase() === 'replace';
  await importRows(Model, rows, replace);
  const message =
    `Successfully imported ${rows.length} records` +
    (replace ? ' (old rows replaced)' : '') +
    (ignoredColumns.length ? `. Ignored columns: ${ignoredColumns.join(', ')}` : '') +
    '.';
  return { message, count: rows.length };
}

const upper = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();
const weightBreakOf = (detail) => parseFloat(detail.weightBreak) || 0;
const roundToCents = (amount) => Math.round(amount * 100) / 100;

const validOn = (date) => (sector) =>
  (!sector.effectiveFrom || String(sector.effectiveFrom) <= date) &&
  (!sector.effectiveTo || String(sector.effectiveTo) >= date);

/** A sector for this carrier wins over the ALL one. */
function sectorsForCarrier(liveSectors, carrier) {
  const carrierSectors = carrier ? liveSectors.filter((sector) => upper(sector.carrierCode) === carrier) : [];
  return {
    carrierSpecific: carrierSectors.length > 0,
    sectors: carrierSectors.length
      ? carrierSectors
      : liveSectors.filter((sector) => ALL_CARRIERS.includes(upper(sector.carrierCode))),
  };
}

function quoteNote(carrierSpecific, sector, carrier) {
  const source = carrierSpecific
    ? ` for carrier ${upper(sector.carrierCode)}`
    : ` (the "ALL carriers" sector - no ${carrier || 'carrier'}-specific rate is loaded)`;
  return `From the TACT rates loaded in this system${source}. Surcharges and any carrier deal are not in this figure.`;
}

/**
 * GET /quote?origin=BOM&destination=DXB&carrier=EK&weight=250&rateClass=Q - the AWB screen's "Auto Rate": the rate of
 * the TACT data loaded here for the sector and carrier, at the highest weight break at or below the chargeable weight
 * (how an IATA break works). When there is no sector or break it says so: it never invents a rate.
 */
export async function quoteRate(query) {
  const origin = upper(query.origin);
  const destination = upper(query.destination);
  const carrier = upper(query.carrier);
  const weight = parseFloat(query.weight);
  const wantedClass = upper(query.rateClass);
  const onDate = String(query.date || new Date().toISOString().slice(0, 10)).slice(0, 10);

  if (!origin || !destination) throw notQuoted(400, 'origin and destination are both needed (3-letter airport codes)');
  if (!(weight > 0)) throw notQuoted(400, 'A chargeable weight is needed - a rate break cannot be chosen without it');

  const sectors = await TactRateSector.findAll({
    where: { originCode: origin, destinationCode: destination },
    include: [{ model: TactRateDetail, as: 'rateDetails' }],
  });
  if (!sectors.length) {
    throw notQuoted(
      404,
      `No TACT sector loaded for ${origin} to ${destination}` +
        '. Load the TACT rates for this sector in Masters > TACT, or type the rate by hand.',
    );
  }
  const liveSectors = sectors.filter(validOn(onDate));
  if (!liveSectors.length) {
    const periods = sectors
      .map((sector) => `${sector.effectiveFrom || '?'} to ${sector.effectiveTo || '?'}`)
      .join(', ');
    throw notQuoted(
      404,
      `The TACT rates loaded for ${origin}-${destination} are not valid on ${onDate} (they cover ${periods}).`,
    );
  }
  const { carrierSpecific, sectors: chosenSectors } = sectorsForCarrier(liveSectors, carrier);
  if (!chosenSectors.length) {
    throw notQuoted(
      404,
      `No TACT rate for carrier ${carrier} on ${origin}-${destination} and no "ALL" carrier rate either.`,
    );
  }
  const [sector] = chosenSectors;
  let details = (sector.rateDetails || []).slice();
  if (wantedClass) details = details.filter((detail) => upper(detail.rateClassCode) === wantedClass);
  if (!details.length) {
    throw notQuoted(
      404,
      `The sector ${origin}-${destination} has no${wantedClass ? ` "${wantedClass}" class` : ''} rate line loaded.`,
    );
  }
  // the highest break at or below the weight; the minimum (M) line has no break
  const eligible = details.filter((detail) => weightBreakOf(detail) <= weight);
  if (!eligible.length) {
    const lowest = Math.min(...details.map(weightBreakOf));
    throw notQuoted(
      404,
      `The lowest weight break loaded for this sector is ${lowest} kg, which is above the chargeable weight of ` +
        `${weight} kg. Load the lower break, or use the minimum charge.`,
    );
  }
  eligible.sort((first, second) => weightBreakOf(second) - weightBreakOf(first));
  const [detail] = eligible;
  const rate = parseFloat(detail.rateAmount) || 0;
  const percentage = parseFloat(detail.percentageMultiplier);
  const effectiveRate = Number.isFinite(percentage) && percentage > 0 ? roundToCents(rate * (percentage / 100)) : rate;
  return {
    success: true,
    origin,
    destination,
    carrier: upper(sector.carrierCode),
    currency: sector.currencyCode,
    rateClass: upper(detail.rateClassCode),
    weightBreak: weightBreakOf(detail),
    rate: effectiveRate,
    baseRate: rate,
    percentageMultiplier: Number.isFinite(percentage) ? percentage : null,
    chargeableWeight: weight,
    amount: roundToCents(effectiveRate * weight),
    commodityItemNo: detail.commodityItemNo || null,
    effectiveFrom: sector.effectiveFrom,
    effectiveTo: sector.effectiveTo,
    carrierSpecific,
    breaksAvailable: details
      .map((line) => ({
        rateClass: upper(line.rateClassCode),
        weightBreak: weightBreakOf(line),
        rate: parseFloat(line.rateAmount) || 0,
      }))
      .sort((first, second) => first.weightBreak - second.weightBreak),
    note: quoteNote(carrierSpecific, sector, carrier),
  };
}
