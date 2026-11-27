import fs from 'node:fs';
import path from 'node:path';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { TARIFF_LOOKUP_DIR } from '../../../config/env.js';
import { NotFoundError } from '../../../core/http/index.js';
import { TariffComponent, TariffDutyComponent, TariffHeader } from '../../../models/index.js';

const MAX_EXEMPTIONS = 6;
const MAX_OTHER_NOTIFICATIONS = 8;
const MAX_DESCRIPTION_LENGTH = 160;
const HEADING_DIGITS = 6;
const MS_PER_YEAR = 365.25 * 864e5;
// anti-dumping duty normally runs 5 years unless extended - an older notification may have lapsed
const ANTI_DUMPING_YEARS = 5;
const ITEM_HISTORY_COLUMNS = ['ritc', 'bcdNotificationNo', 'bcdSrNo', 'bcdRate'];
const NOTIFICATION_NO = /^0*(\d+)\s*\/\s*(\d{4})$/;

/*
 * Lookup files read from iCAFFE into _tariff_load/, each read on first use:
 *   igst_options.json   IGST notification / serial per CTH (notn 009/2025 + 014/2025), most specific serial first;
 *                       several serials (often with different rates) apply when GST depends on description or value
 *   agency_cth.json     other government agencies (FSSAI, PQIS, AQCS, CDSCO, WCCB, ...) that clear goods of a CTH
 *   notif_country.json  which customs notification belongs to which country (FTA / preferential)
 */
const lookupFiles = { igstOptions: null, agencyCth: null, notifCountry: null };

function readLookupFile(fileName) {
  try {
    return JSON.parse(fs.readFileSync(path.join(TARIFF_LOOKUP_DIR, fileName), 'utf8'));
  } catch {
    return {};
  }
}

function lookupFile(name, fileName) {
  if (lookupFiles[name] === null) lookupFiles[name] = readLookupFile(fileName);
  return lookupFiles[name];
}

const igstOptionsOf = (cth) =>
  (lookupFile('igstOptions', 'igst_options.json')[cth] || []).map(([notnNo, srNo, rate]) => ({ notnNo, srNo, rate }));

const agenciesOf = (cth) => lookupFile('agencyCth', 'agency_cth.json')[cth] || [];

const notificationCountries = () => lookupFile('notifCountry', 'notif_country.json');

/*
 * Rate basis of a duty line: 'A' ad-valorem only | 'S' specific only | 'H' higher of the two | 'L' lower of the two |
 * 'B' both added - so "20% or Rs 115 per kg, whichever is higher" reaches the duty estimate in full.
 */
const BASIS = {
  A: 'A',
  ADVALOREM: 'A',
  'AD-VALOREM': 'A',
  PERCENT: 'A',
  P: 'A',
  S: 'S',
  SPECIFIC: 'S',
  Q: 'S',
  H: 'H',
  HIGHER: 'H',
  MAX: 'H',
  'WHICHEVER IS HIGHER': 'H',
  L: 'L',
  LOWER: 'L',
  MIN: 'L',
  B: 'B',
  BOTH: 'B',
  SUM: 'B',
};

const DUTY_CATEGORIES = {
  bcd: /BCD|BASIC/i,
  igst: /IGST/i,
  sws: /SWS|SOCIAL/i,
  aidc: /AIDC|INFRA/i,
  healthCess: /HEALTH/i,
};

const isBlank = (value) => value === null || value === undefined || value === '';

const componentOf = (components, categoryPattern) =>
  (components || []).find((component) => categoryPattern.test(String(component.dutyCategory || '')));

function rateOf(components, categoryPattern) {
  const component = componentOf(components, categoryPattern);
  return component && component.rate != null && component.rate !== '' ? Number(component.rate) : null;
}

const numberOrNull = (value) => (value != null && value !== '' && !Number.isNaN(Number(value)) ? Number(value) : null);

/** The full picture of one duty: percentage, specific amount + UQC and the rate basis. */
function dutyOf(components, categoryPattern) {
  const component = componentOf(components, categoryPattern);
  if (!component) return null;
  const rate = numberOrNull(component.rate);
  const amount = numberOrNull(component.amount);
  const flag = String(component.calculationFlag || '')
    .trim()
    .toUpperCase();
  // no flag in the row: a specific amount alone is specific, both present reads as "whichever is higher"
  let fallbackBasis = 'A';
  if (amount != null && rate != null) fallbackBasis = 'H';
  else if (amount != null) fallbackBasis = 'S';
  return { rate, amount, uqc: component.uqc || null, flag: flag || null, basis: BASIS[flag] || fallbackBasis };
}

/** 024/2005 style: leading zeros of the number padded to 3 digits. */
function normalisedNotificationNo(value) {
  const text = String(value === null || value === undefined ? '' : value)
    .trim()
    .toUpperCase();
  const match = NOTIFICATION_NO.exec(text);
  return match ? `${match[1].padStart(3, '0')}/${match[2]}` : text;
}

const exemptionKey = (notificationNo, serialNo) =>
  `${normalisedNotificationNo(notificationNo)}|${String(serialNo === null || serialNo === undefined ? '' : serialNo)
    .trim()
    .toUpperCase()}`;

async function importItemColumns() {
  const columns = await sequelize.query('PRAGMA table_info(ImportItems)', { type: QueryTypes.SELECT });
  return new Set(columns.map((column) => column.name));
}

const filedExemptionRows = (ritc) =>
  sequelize.query(
    `SELECT TRIM(COALESCE(it.bcdNotificationNo, '')) AS n, TRIM(COALESCE(it.bcdSrNo, '')) AS s, TRIM(COALESCE(it.bcdRate, '')) AS r,
                            COUNT(*) AS c, COUNT(DISTINCT inv.importJobId) AS jobs, COUNT(DISTINCT j.iecCode) AS importers, MAX(j.jobDate) AS last
                       FROM ImportItems it JOIN ImportInvoices inv ON inv.id = it.importInvoiceId JOIN ImportJobs j ON j.id = inv.importJobId
                      WHERE it.ritc = ? GROUP BY 1, 2, 3`,
    { replacements: [ritc], type: QueryTypes.SELECT },
  );

/**
 * What the saved import items of this RITC carry in the BCD notification boxes (how often, how many importers, last
 * job date): what the office actually files. Adds one entry per notification + serial to `exemptions`; returns the
 * number of items filed with the RITC.
 */
async function addFiledExemptions(ritc, exemptions) {
  let itemsFiled = 0;
  const mostFiledRateCount = new Map();
  try {
    const columns = await importItemColumns();
    if (!ITEM_HISTORY_COLUMNS.every((column) => columns.has(column))) return itemsFiled;
    for (const row of await filedExemptionRows(ritc)) {
      itemsFiled += row.c;
      if (!row.n) continue;
      const key = exemptionKey(row.n, row.s);
      let exemption = exemptions.get(key);
      if (!exemption) {
        exemption = {
          notifNo: normalisedNotificationNo(row.n),
          serialNo: String(row.s || '').trim(),
          rate: null,
          used: 0,
          jobs: 0,
          importers: 0,
          lastUsed: null,
          inMaster: false,
        };
        exemptions.set(key, exemption);
      }
      exemption.used += row.c;
      exemption.jobs += row.jobs;
      exemption.importers = Math.max(exemption.importers, row.importers);
      if (!exemption.lastUsed || String(row.last || '') > exemption.lastUsed)
        exemption.lastUsed = row.last || exemption.lastUsed;
      // the rate most often filed with it
      if (row.r !== '' && !Number.isNaN(Number(row.r)) && (mostFiledRateCount.get(key) || 0) < row.c) {
        exemption.rate = Number(row.r);
        mostFiledRateCount.set(key, row.c);
      }
    }
  } catch {
    // no item history: the master rows still answer
  }
  return itemsFiled;
}

/** The CUSTOM notification rows of the Notification master whose tariff head covers the RITC. */
async function masterExemptionRows(ritc) {
  try {
    return await sequelize.query(
      `SELECT h.notifNo, h.effectiveDate, d.serialNo, d.tariffHead, d.dutyRate, d.itemDescription, d.conditionNo
               FROM DutyNotifDetails d JOIN DutyNotifHeaders h ON h.id = d.headerId
              WHERE upper(h.type) = 'CUSTOM' AND h.isActive = 1 AND length(replace(d.tariffHead, ' ', '')) >= 4 AND ? LIKE replace(d.tariffHead, ' ', '') || '%'`,
      { replacements: [ritc], type: QueryTypes.SELECT },
    );
  } catch {
    return [];
  }
}

function groupByNotification(rows) {
  const rowsByNotification = new Map();
  for (const row of rows) {
    const notificationNo = normalisedNotificationNo(row.notifNo);
    if (!rowsByNotification.has(notificationNo)) rowsByNotification.set(notificationNo, []);
    rowsByNotification.get(notificationNo).push(row);
  }
  return rowsByNotification;
}

/** Rows the office already files: they are in the master too; the master's condition (and rate when none) is taken. */
function markFiledRowsInMaster(rows, exemptions) {
  for (const row of rows) {
    const exemption = exemptions.get(exemptionKey(row.notifNo, row.serialNo));
    if (!exemption) continue;
    exemption.inMaster = true;
    exemption.conditionNo = row.conditionNo || '';
    exemption.masterRate = isBlank(row.dutyRate) ? null : Number(row.dutyRate);
    if (exemption.rate === null && exemption.masterRate !== null) exemption.rate = exemption.masterRate;
  }
}

function masterOnlyExemption(notificationNo, row) {
  const description = String(row.itemDescription || '').trim();
  return {
    notifNo: notificationNo,
    serialNo: String(row.serialNo || '').trim(),
    rate: Number(row.dutyRate),
    used: 0,
    jobs: 0,
    importers: 0,
    lastUsed: null,
    inMaster: true,
    masterRate: Number(row.dutyRate),
    conditionNo: row.conditionNo || '',
    ...(description && description.toUpperCase() !== 'BCD'
      ? { description: description.slice(0, MAX_DESCRIPTION_LENGTH) }
      : {}),
  };
}

const countriesOf = (notification) => (notification ? notification.countries || [] : []);
const schemeOf = (notification) => (notification ? notification.subtype || null : null);

/**
 * A notification with ONE serial for this RITC is offered as it is; one with many serials (025/1999 has 29 for
 * 8542 39 00, each for a different end use) is only named, the operator picks the serial from the notification.
 * A notification tied to countries needs a certificate of origin and is offered only for that country of origin.
 */
function addMasterExemptions(rowsByNotification, exemptions, notificationMap, origin) {
  const otherNotifications = [];
  for (const [notificationNo, rows] of rowsByNotification) {
    const notification = notificationMap[notificationNo];
    const countries = countriesOf(notification);
    markFiledRowsInMaster(rows, exemptions);
    const freshRows = rows.filter((row) => !exemptions.has(exemptionKey(row.notifNo, row.serialNo)));
    if (!freshRows.length) continue;
    const ratedRows = freshRows.filter((row) => !isBlank(row.dutyRate));
    const countryFits = !countries.length || (origin && countries.includes(origin));
    if (freshRows.length === 1 && ratedRows.length === 1 && countryFits) {
      const [row] = ratedRows;
      exemptions.set(exemptionKey(row.notifNo, row.serialNo), masterOnlyExemption(notificationNo, row));
    } else {
      otherNotifications.push({
        notifNo: notificationNo,
        serials: freshRows.length,
        minRate: ratedRows.length ? Math.min(...ratedRows.map((row) => Number(row.dutyRate))) : null,
        countries,
        scheme: schemeOf(notification),
      });
    }
  }
  return otherNotifications;
}

const byUseThenRate = (a, b) =>
  b.used - a.used || (a.rate === null ? 1 : 0) - (b.rate === null ? 1 : 0) || (a.rate || 0) - (b.rate || 0);

const generalFirstThenNumber = (a, b) =>
  (a.countries.length ? 1 : 0) - (b.countries.length ? 1 : 0) || a.notifNo.localeCompare(b.notifNo);

/**
 * GET /exemptions/:ritc - BCD exemption / concession notifications for a RITC, for the item screen. The tariff rate
 * alone over-states the duty where a general exemption applies (8542 39 00: tariff 7.5 %, filed at 0 % under 024/2005
 * Sl 24). Two sources merged by notification + serial: what the office files, and the Notification master.
 */
export async function bcdExemptions(ritc, originText) {
  const notificationMap = notificationCountries();
  const exemptions = new Map();
  const itemsFiled = await addFiledExemptions(ritc, exemptions);
  const masterRows = await masterExemptionRows(ritc);
  const origin = String(originText || '')
    .trim()
    .toUpperCase();
  const otherNotifications = addMasterExemptions(groupByNotification(masterRows), exemptions, notificationMap, origin);

  const data = [...exemptions.values()]
    .map((exemption) => {
      const notification = notificationMap[exemption.notifNo];
      return { ...exemption, countries: countriesOf(notification), scheme: schemeOf(notification) };
    })
    .sort(byUseThenRate)
    .slice(0, MAX_EXEMPTIONS);
  otherNotifications.sort(generalFirstThenNumber);
  const also = otherNotifications
    .filter((other) => !other.countries.length || (origin && other.countries.includes(origin)))
    .slice(0, MAX_OTHER_NOTIFICATIONS);
  return { success: true, ritc, itemsFiled, data, also };
}

/** GET /fta/:cth?origin=JP - customs concession / FTA rows of the notifications that belong to the country of origin. */
export async function ftaConcessions(cth, originText) {
  const origin = String(originText || '')
    .trim()
    .toUpperCase();
  const notificationMap = notificationCountries();
  const notificationNos = Object.keys(notificationMap).filter(
    (notificationNo) => !origin || (notificationMap[notificationNo].countries || []).includes(origin),
  );
  if (!notificationNos.length) return { success: true, data: [] };
  const rows = await sequelize.query(
    `SELECT h.notifNo, h.effectiveDate, d.serialNo, d.tariffHead, d.dutyRate, d.itemDescription, d.conditionNo
             FROM DutyNotifDetails d JOIN DutyNotifHeaders h ON h.id = d.headerId
             WHERE upper(h.type) = 'CUSTOM' AND h.isActive = 1 AND h.notifNo IN (${notificationNos.map(() => '?').join(',')})
               AND ? LIKE replace(d.tariffHead, ' ', '') || '%'
             ORDER BY h.effectiveDate DESC, h.notifNo`,
    { replacements: [...notificationNos, cth], type: QueryTypes.SELECT },
  );
  return {
    success: true,
    data: rows.map((row) => ({
      ...row,
      scheme: (notificationMap[row.notifNo] || {}).subtype || null,
      countries: (notificationMap[row.notifNo] || {}).countries || [],
    })),
  };
}

async function antiDumpingRowsOf(cth) {
  try {
    return await sequelize.query(
      `SELECT notifNo, notifDate, endDate, serialNo, cthSlNo, cth, specSeries, originCountry, exportCountry, flag, rate, amount, uqc, currency, factor
                 FROM AddDutyRates WHERE isActive = 1 AND ? LIKE cth || '%' ORDER BY notifDate DESC, notifNo DESC, CAST(serialNo AS INTEGER), CAST(cthSlNo AS INTEGER)`,
      { replacements: [cth], type: QueryTypes.SELECT },
    );
  } catch {
    // table not loaded yet
    return [];
  }
}

const yearsSince = (date) => (date ? (Date.now() - new Date(date).getTime()) / MS_PER_YEAR : null);

/**
 * GET /add/:cth?origin=CN - anti-dumping duty rows (from iCAFFE's Antidumping Master) whose CTH (8, 6 or 4 digits)
 * covers the code, newest notification first; matchOrigin marks rows of the given country of origin / export.
 */
export async function antiDumpingDuties(cth, originText) {
  const origin = String(originText || '')
    .trim()
    .toUpperCase();
  const rows = await antiDumpingRowsOf(cth);
  return {
    success: true,
    data: rows.map((row) => ({
      ...row,
      matchOrigin: !!origin && (row.originCountry === origin || row.exportCountry === origin),
      maybeExpired: row.endDate
        ? new Date(row.endDate) < new Date()
        : (yearsSince(row.notifDate) || 0) > ANTI_DUMPING_YEARS,
    })),
  };
}

const withComponents = [{ model: TariffComponent, as: 'components' }];

/**
 * The exact 8-digit tariff line, else the nearest line of the same 6-digit heading (answered as exact: false, so the
 * screens show "nearest line, check" and never fill rates from it as if it were the item's own).
 */
async function tariffLineFor(ritc) {
  const exactHeader = await TariffHeader.findOne({ where: { hsnCode: ritc }, include: withComponents });
  if (exactHeader) return exactHeader;
  return TariffHeader.findOne({
    where: { hsnCode: { [Op.like]: `${ritc.slice(0, HEADING_DIGITS)}%` } },
    order: [['hsnCode', 'ASC']],
    include: withComponents,
  });
}

/** GET /:ritc - description and duty rates of a RITC from the Tariff masters. */
export async function tariffLookup(ritc) {
  const header = await tariffLineFor(ritc);
  let components = header ? header.components : [];
  if (!components || !components.length) {
    components = await TariffDutyComponent.findAll({ where: { hsnCode: header ? header.hsnCode : ritc } });
  }
  if (!header && !components.length) {
    throw new NotFoundError('RITC not found in Tariff master', {
      body: { success: false, message: 'RITC not found in Tariff master' },
    });
  }
  const matchedCode = header ? header.hsnCode : ritc;
  const exact = String(matchedCode) === ritc;
  const igstOptions = exact ? igstOptionsOf(matchedCode) : [];
  return {
    success: true,
    data: {
      ritc: matchedCode,
      requested: ritc,
      matchedCode,
      exact,
      description: header ? header.description : null,
      bcdRate: rateOf(components, DUTY_CATEGORIES.bcd),
      igstRate: rateOf(components, DUTY_CATEGORIES.igst),
      bcd: dutyOf(components, DUTY_CATEGORIES.bcd),
      igst: dutyOf(components, DUTY_CATEGORIES.igst),
      sws: dutyOf(components, DUTY_CATEGORIES.sws),
      aidc: dutyOf(components, DUTY_CATEGORIES.aidc),
      healthCess: dutyOf(components, DUTY_CATEGORIES.healthCess),
      // IGST notification + serial of the loaded rate, and every serial that applies to this CTH
      igstNotnNo: igstOptions[0] ? igstOptions[0].notnNo : null,
      igstSrNo: igstOptions[0] ? igstOptions[0].srNo : null,
      igstOptions,
      igstRateVaries: new Set(igstOptions.map((option) => option.rate)).size > 1,
      pgaAgencies: exact ? agenciesOf(matchedCode) : [],
      uqc: header ? header.uqc : null,
      components,
    },
  };
}
