import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { LOGS_DIR } from '../../../config/env.js';
import { httpsAgent } from '../../../utils/integrations/tls.js';
import { cleanCode } from './igmEnquiry.validation.js';

// ICEGATE's public enquiries (no login, no captcha): the same calls the ICEGATE 2.0 site makes on its public Air IGM /
// Air Console / Sea IGM pages. One set of calls per button click; nothing is sent to ICEGATE, only read.
const ENQUIRY_URL = (process.env.ICEGATE_ENQ_URL || 'https://foservices.icegate.gov.in/enquiry/').replace(/\/?$/, '/');
const ICEGATE_SITE = 'https://foservices.icegate.gov.in';
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ENQUIRY_TIMEOUT_MS = 30000;
const LAST_ANSWERS_FILE = path.join(LOGS_DIR, 'icegate_igm_last.json');
const MESSAGE_LENGTH = 200;
const MAX_IGMS = 3;
const MAX_CONSOLE_FILES = 3;
const MAX_SAM_BL_DATES = 3;
const MAX_SAM_ROTATIONS = 5;
const INDIA_OFFSET_MS = 330 * 60000;
const MONTH_NUMBERS = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};
const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MESSAGE_KEYS = ['errors', 'errorMessage', 'message', 'error', 'errorDesc', 'msg', 'text', 'status'];
const LIST_KEYS = ['response', 'data', 'result', 'results', 'list', 'content'];

const upper = (value) =>
  String(value == null ? '' : value)
    .trim()
    .toUpperCase();

/** ICEGATE's own message ("No record found" ...) from an answer, so the user sees why. */
function messageOf(answer) {
  if (answer === undefined || answer === null) return '';
  if (typeof answer === 'string') {
    const text = answer
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > MESSAGE_LENGTH ? text.slice(0, MESSAGE_LENGTH) + '...' : text;
  }
  if (typeof answer !== 'object' || Array.isArray(answer)) return '';
  for (const key of MESSAGE_KEYS) {
    const value = answer[key];
    if (typeof value === 'string' && value.trim() && !/^(ok|success|200)$/i.test(value.trim()))
      return value.trim().slice(0, MESSAGE_LENGTH);
    if (Array.isArray(value) && value.length) {
      return value
        .map((entry) =>
          typeof entry === 'string' ? entry : (entry && (entry.message || entry.errorMessage || entry.error)) || '',
        )
        .filter(Boolean)
        .join('; ')
        .slice(0, MESSAGE_LENGTH);
    }
  }
  return '';
}

async function callEnquiry(pathPart, body) {
  const response = await axios.post(ENQUIRY_URL + pathPart, body, {
    httpsAgent,
    timeout: ENQUIRY_TIMEOUT_MS,
    validateStatus: () => true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': BROWSER_USER_AGENT,
      Origin: ICEGATE_SITE,
      Referer: ICEGATE_SITE + '/',
    },
  });
  if (response.status >= 400) {
    const message = messageOf(response.data);
    const error = new Error(message ? 'ICEGATE says: ' + message : 'ICEGATE answered HTTP ' + response.status);
    error.body = response.data;
    throw error;
  }
  return response.data;
}

/** The rows of an answer, wherever ICEGATE put the list. */
function rowsOf(answer) {
  if (Array.isArray(answer)) return answer;
  if (!answer || typeof answer !== 'object') return [];
  for (const key of LIST_KEYS) {
    if (Array.isArray(answer[key])) return answer[key];
    if (answer[key] && typeof answer[key] === 'object') {
      const nested = rowsOf(answer[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

// an answer that is not a list but carries a message (HTTP 200 with an error inside) is reported, not read as "nothing found"
function noteMessageOfEmptyAnswer(answer, label, errors) {
  if (rowsOf(answer).length) return;
  const message = messageOf(answer);
  if (message) errors.push(label + ': ICEGATE says: ' + message);
}

const pick = (row, ...keys) => {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return '';
};

const indiaDay = (date) => new Date(date.getTime() + INDIA_OFFSET_MS).toISOString().slice(0, 10);

/** ICEGATE dates come as epoch ms, ISO, dd-mm-yyyy, dd/mm/yyyy or dd-MMM-yyyy -> yyyy-mm-dd ('' when unknown). */
export function isoDate(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' || /^\d{12,13}$/.test(String(value))) {
    const date = new Date(Number(value));
    return isNaN(date) ? '' : indiaDay(date);
  }
  const text = String(value).trim();
  // a time with Z / +0000 is UTC; the India date is 5:30 later ("2026-11-09T18:30:00Z" is 10-Nov in India)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const date = new Date(text.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    if (!isNaN(date)) return indiaDay(date);
  }
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = /^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]*(\d{2,4})/.exec(text);
  if (match && MONTH_NUMBERS[match[2].toUpperCase()]) {
    const year = match[3].length === 2 ? '20' + match[3] : match[3];
    return `${year}-${String(MONTH_NUMBERS[match[2].toUpperCase()]).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return '';
}

/** DD-MMM-YY, the BL date format of the SAM enquiry. */
const ddMmmYy = (value) => {
  const iso = isoDate(value);
  if (!iso) return String(value || '').toUpperCase();
  const [year, month, day] = iso.split('-');
  return `${day}-${MONTH_NAMES[+month - 1]}-${year.slice(2)}`;
};

/** Every call with its answer (or error) is kept, the last enquiry in logs/icegate_igm_last.json. */
function createCallLog(header) {
  const raw = { ...header, calls: [] };
  const note = (name, body, data, error) =>
    raw.calls.push({
      name,
      body,
      data: data === undefined ? null : data,
      error: error ? error.message || String(error) : undefined,
      errorBody: error && error.body,
    });
  return { raw, note };
}

function saveLastAnswers(raw) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.writeFileSync(LAST_ANSWERS_FILE, JSON.stringify(raw, null, 1));
  } catch {
    // only a debug copy
  }
}

/**
 * One enquiry call: the answer is logged; a failure is logged and reported as `${failureLabel}: message`.
 * Returns the answer, or undefined after a failure.
 */
async function enquire(log, errors, name, pathPart, body, failureLabel) {
  try {
    const answer = await callEnquiry(pathPart, body);
    log.note(name, body, answer);
    return { answer, failed: false };
  } catch (error) {
    log.note(name, body, undefined, error);
    errors.push(failureLabel + ': ' + error.message);
    return { answer: undefined, failed: true };
  }
}

const igmNumberOfAirRow = (row) => upper(pick(row, 'igmRotation', 'igmNo', 'igmNumber', 'igmRtn'));

function distinctAirIgms(igmRows, location) {
  const igms = [];
  for (const row of igmRows) {
    const number = igmNumberOfAirRow(row);
    const date = pick(row, 'igmDate');
    const igmLocation = upper(pick(row, 'customer_Site', 'custSite', 'locationCode', 'location')) || location;
    if (number && !igms.find((igm) => igm.no === number)) igms.push({ no: number, dt: date, loc: igmLocation });
  }
  return igms;
}

const firstRowOrObject = (answer, emptyValue) =>
  rowsOf(answer)[0] || (answer && !Array.isArray(answer) ? answer : emptyValue);

async function readAirFlights(log, errors, igms) {
  const flights = {};
  for (const igm of igms.slice(0, MAX_IGMS)) {
    const body = { igmNo: igm.no, igmDate: igm.dt, location: igm.loc, isLoggedIn: false };
    const { answer, failed } = await enquire(
      log,
      errors,
      'airIgmFlightDetailsPublic',
      'publicEnquiries/airIgmFlightDetailsPublic',
      body,
      'Flight details of IGM ' + igm.no,
    );
    if (!failed) flights[igm.no] = firstRowOrObject(answer, null);
  }
  return flights;
}

async function readAirHouses(log, errors, location, mawb) {
  const masterBody = { locationCode: location, masterBlNumber: mawb };
  const master = await enquire(
    log,
    errors,
    'public-air-consol-master',
    'publicEnquiries/public-air-consol-master',
    masterBody,
    'Console enquiry',
  );
  let consoleRows = [];
  if (!master.failed) {
    consoleRows = rowsOf(master.answer);
    noteMessageOfEmptyAnswer(master.answer, 'Console enquiry', errors);
  }
  const files = [...new Set(consoleRows.map((row) => pick(row, 'fileName')).filter(Boolean))].slice(
    0,
    MAX_CONSOLE_FILES,
  );
  let houses = [];
  for (const file of files) {
    const body = { locationCode: location, masterBlNumber: mawb, fileName: file, internalFlag: true };
    const { answer, failed } = await enquire(
      log,
      errors,
      'public-air-consol-house',
      'publicEnquiries/public-air-consol-house',
      body,
      'Houses of file ' + file,
    );
    if (!failed) houses = houses.concat(rowsOf(answer).map((house) => ({ ...house, _file: file })));
  }
  return houses;
}

function airMasterRow(row, flights, mawb) {
  const igmNo = igmNumberOfAirRow(row);
  const flight = flights[igmNo] || {};
  return {
    kind: 'MAWB',
    igmNo,
    igmDate: isoDate(pick(row, 'igmDate')),
    lineNo: String(pick(row, 'lineNo', 'lineNumber')),
    subLineNo: '',
    mawbNo: upper(pick(row, 'mawbNo', 'mawbNumber')) || mawb,
    hawbNo: '',
    portOrg: upper(pick(row, 'portOrg', 'portOfOrigin')),
    portDest: upper(pick(row, 'portDest')),
    totalPkg: String(pick(row, 'totalPackage', 'totalPackages', 'noOfPackages')),
    grossWt: String(pick(row, 'grossWeight', 'grossWt')),
    flightNo: upper(pick(flight, 'flightNo', 'flightNumber')),
    flightDate: isoDate(pick(flight, 'flightDate')),
    inwardDate: isoDate(pick(flight, 'inwardDate', 'inwardDateTime')),
    segregation: String(pick(row, 'segregationTime')),
  };
}

function airHouseRow(house, flights, igmRows, mawb) {
  const igmNo = upper(pick(house, 'igmRtn', 'igmRotation', 'igmNo'));
  const flight = flights[igmNo] || {};
  const masterLine = igmRows.find((row) => upper(pick(row, 'igmRotation', 'igmNo', 'igmNumber')) === igmNo);
  return {
    kind: 'HAWB',
    igmNo,
    igmDate: isoDate(pick(house, 'igmDate')),
    lineNo: masterLine ? String(pick(masterLine, 'lineNo', 'lineNumber')) : '',
    subLineNo: String(pick(house, 'subLineNumber', 'subLineNo')),
    mawbNo: upper(pick(house, 'mawbNumber', 'mawbNo')) || mawb,
    hawbNo: upper(pick(house, 'hawbNumber', 'hawbNo')),
    portOrg: '',
    portDest: '',
    totalPkg: String(pick(house, 'totalPackage', 'totalPackages')),
    grossWt: String(pick(house, 'grossWeight', 'grossWt')),
    status: String(pick(house, 'status')),
    remarks: String(pick(house, 'remarks')),
    flightNo: upper(pick(house, 'flightNumber', 'flightNo')) || upper(pick(flight, 'flightNo', 'flightNumber')),
    flightDate: isoDate(pick(house, 'flightDate')) || isoDate(pick(flight, 'flightDate')),
    inwardDate: isoDate(pick(flight, 'inwardDate', 'inwardDateTime')),
  };
}

/**
 * POST /air-igm { location, mawb, hawb? }: the IGM lines of the MAWB (AirIgmEnq), the flight / inward date of each IGM
 * (at most 3), the console files of the MAWB and their houses (at most 3 files).
 */
export async function readAirIgm({ location, mawb, hawb }) {
  const log = createCallLog({ at: new Date().toISOString(), location, mawb, hawb });
  const errors = [];

  const igmBody = { location, mawbNumber: mawb };
  const igmEnquiry = await enquire(log, errors, 'AirIgmEnq', 'enquiryatices/AirIgmEnq', igmBody, 'IGM enquiry');
  let igmRows = [];
  if (!igmEnquiry.failed) {
    igmRows = rowsOf(igmEnquiry.answer);
    noteMessageOfEmptyAnswer(igmEnquiry.answer, 'IGM enquiry', errors);
  }
  const flights = await readAirFlights(log, errors, distinctAirIgms(igmRows, location));
  const houses = await readAirHouses(log, errors, location, mawb);
  saveLastAnswers(log.raw);

  const masters = igmRows.map((row) => airMasterRow(row, flights, mawb));
  const houseRows = houses.map((house) => airHouseRow(house, flights, igmRows, mawb));
  const matched = hawb ? houseRows.filter((house) => cleanCode(house.hawbNo) === hawb) : [];
  const rows = [...(hawb ? matched : []), ...masters, ...houseRows.filter((house) => !matched.includes(house))];
  if (!rows.length) {
    return {
      success: false,
      error: errors.length
        ? 'ICEGATE could not be read: ' + errors.join('; ')
        : `ICEGATE has no IGM for MAWB ${mawb} at ${location} yet.`,
      errors,
    };
  }
  return { success: true, location, mawb, hawb, hawbFound: hawb ? matched.length > 0 : null, rows, errors };
}

const seaLineRow = (bl, values) => ({
  kind: values.hblNo ? 'HBL' : 'BL',
  igmNo: '',
  igmDate: '',
  inwardDate: '',
  lineNo: '',
  subLineNo: '',
  blNo: bl,
  blDate: '',
  hblNo: '',
  hblDate: '',
  totalPkg: '',
  pkgCode: '',
  grossWt: '',
  wtUnit: '',
  vessel: '',
  source: '',
  ...values,
});

const igmNumberOfSeaRow = (row) => upper(pick(row, 'igmNo', 'igmNumber', 'rotationNumber'));

function distinctSeaIgms(rows) {
  const igms = [];
  for (const row of rows) {
    const number = igmNumberOfSeaRow(row);
    const date = pick(row, 'igmDate');
    if (number && !igms.find((igm) => igm.no === number)) igms.push({ no: number, dt: date });
  }
  return igms;
}

function oldEnquiryRow(row, moreDetails, bl) {
  const igmNo = igmNumberOfSeaRow(row);
  const more = moreDetails[igmNo] || {};
  return seaLineRow(bl, {
    source: 'IGM',
    igmNo,
    igmDate: isoDate(pick(row, 'igmDate')),
    inwardDate: isoDate(
      pick(row, 'inwardDate', 'inwDate', 'inwardDt') ||
        pick(more, 'inwardDate', 'inwDate', 'inwardDt', 'inwardDateTime'),
    ),
    lineNo: String(pick(row, 'lineNo', 'lineNumber')),
    subLineNo: String(pick(row, 'subLineNo', 'slineNo', 'subLineNumber')),
    blNo: upper(pick(row, 'blNo', 'mblNo')) || bl,
    blDate: isoDate(pick(row, 'blDate', 'mblDt')),
    hblNo: upper(pick(row, 'houseBlNo', 'hblNo')),
    hblDate: isoDate(pick(row, 'houseBlDate', 'hblDt')),
    totalPkg: String(pick(row, 'totalPackage', 'totPckt')),
    pkgCode: upper(pick(row, 'packageCode', 'pcktType')),
    grossWt: String(pick(row, 'grossWeight', 'grossWt')),
    wtUnit: upper(pick(row, 'unitOfWeight', 'uqc')),
    vessel: upper(pick(more, 'vesselName', 'vesselCode')),
  });
}

/** Old enquiry: SeaIgmEnq gives the BL / HBL lines, SeaIgmMorePublicDetails the inward date / vessel (3 IGMs). */
async function readOldSeaEnquiry(log, errors, location, bl) {
  const body = { location, masterBlNo: bl };
  const enquiry = await enquire(log, errors, 'SeaIgmEnq', 'enquiryatices/SeaIgmEnq', body, 'Sea IGM enquiry');
  let lines = [];
  if (!enquiry.failed) {
    lines = rowsOf(enquiry.answer);
    noteMessageOfEmptyAnswer(enquiry.answer, 'Sea IGM enquiry', errors);
  }
  const moreDetails = {};
  for (const igm of distinctSeaIgms(lines).slice(0, MAX_IGMS)) {
    const moreBody = { masterBlNo: bl, location, igmNo: igm.no, igmDate: igm.dt };
    const more = await enquire(
      log,
      errors,
      'SeaIgmMorePublicDetails',
      'publicEnquiries/SeaIgmMorePublicDetails',
      moreBody,
      'More details of IGM ' + igm.no,
    );
    if (!more.failed) moreDetails[igm.no] = firstRowOrObject(more.answer, {});
  }
  return lines.map((row) => oldEnquiryRow(row, moreDetails, bl));
}

async function readSamBlDates(log, errors, location, bl) {
  const body = { siteId: location, blNo: bl, repEvent: 'SAM' };
  const { answer, failed } = await enquire(
    log,
    errors,
    'getSamIgmBLDate',
    'publicEnquiries/getSamIgmBLDate',
    body,
    'SAM BL dates',
  );
  if (failed) return [];
  const blDates = (answer && Array.isArray(answer.blDate) ? answer.blDate : rowsOf(answer)).map(String);
  if (!blDates.length) {
    const message = messageOf(answer);
    if (message) errors.push('SAM BL dates: ICEGATE says: ' + message);
  }
  return blDates;
}

async function readSamRotationLines(log, errors, rotation) {
  const uniqueId = pick(rotation, 'uniqueId');
  if (uniqueId === '') return [];
  const body = { uniqueId, lineNo: pick(rotation, 'lineNo') };
  const { answer, failed } = await enquire(
    log,
    errors,
    'SeaIgmMorePublicDetailsNew',
    'publicEnquiries/SeaIgmMorePublicDetailsNew',
    body,
    'SAM lines',
  );
  return failed ? [] : rowsOf(answer);
}

function samRows(bl, rotation, blDate, lines) {
  const lineNo = pick(rotation, 'lineNo');
  const base = {
    source: 'SAM',
    igmNo: upper(pick(rotation, 'rotationNumber', 'igmNo')),
    igmDate: isoDate(pick(rotation, 'rotationDate', 'igmDate')),
    inwardDate: isoDate(pick(rotation, 'inwDate', 'inwardDate')),
    vessel: [upper(pick(rotation, 'vesselCode', 'vesselName')), upper(pick(rotation, 'voyageNumber'))]
      .filter(Boolean)
      .join(' / '),
    blDate: isoDate(blDate),
  };
  if (!lines.length) return [seaLineRow(bl, { ...base, lineNo: String(lineNo) })];
  return lines.map((line) =>
    seaLineRow(bl, {
      ...base,
      lineNo: String(pick(line, 'lineNo') || lineNo),
      subLineNo: String(pick(line, 'slineNo', 'subLineNo')),
      blNo: upper(pick(line, 'mblNo', 'blNo')) || bl,
      blDate: isoDate(pick(line, 'mblDt', 'blDate')) || base.blDate,
      hblNo: upper(pick(line, 'hblNo', 'houseBlNo')),
      hblDate: isoDate(pick(line, 'hblDt', 'houseBlDate')),
      totalPkg: String(pick(line, 'totPckt', 'totalPackage')),
      pkgCode: upper(pick(line, 'pcktType', 'packageCode')),
      grossWt: String(pick(line, 'grossWt', 'grossWeight')),
      wtUnit: upper(pick(line, 'uqc', 'unitOfWeight')),
    }),
  );
}

/** SAM enquiry: the BL dates, the rotations of each date (3 dates, 5 rotations each) and their lines. */
async function readSamSeaEnquiry(log, errors, location, bl) {
  const rows = [];
  for (const blDate of (await readSamBlDates(log, errors, location, bl)).slice(0, MAX_SAM_BL_DATES)) {
    const body = { siteId: location, repEvent: 'SAM', blNo: bl, blDate: ddMmmYy(blDate) };
    const failureLabel = 'SAM IGM of BL date ' + blDate;
    const enquiry = await enquire(
      log,
      errors,
      'SeaIgmEnq-public',
      'publicEnquiries/SeaIgmEnq-public',
      body,
      failureLabel,
    );
    let rotations = [];
    if (!enquiry.failed) {
      rotations = rowsOf(enquiry.answer);
      noteMessageOfEmptyAnswer(enquiry.answer, failureLabel, errors);
    }
    for (const rotation of rotations.slice(0, MAX_SAM_ROTATIONS)) {
      const lines = await readSamRotationLines(log, errors, rotation);
      rows.push(...samRows(bl, rotation, blDate, lines));
    }
  }
  return rows;
}

/** POST /sea-igm { location, bl, hbl? }: both public sea IGM enquiries (old and SAM), merged. */
export async function readSeaIgm({ location, bl, hbl }) {
  const log = createCallLog({ at: new Date().toISOString(), mode: 'SEA', location, bl, hbl });
  const errors = [];
  const rows = [
    ...(await readOldSeaEnquiry(log, errors, location, bl)),
    ...(await readSamSeaEnquiry(log, errors, location, bl)),
  ];
  saveLastAnswers(log.raw);

  const matched = hbl ? rows.filter((row) => cleanCode(row.hblNo) === hbl) : [];
  const ordered = [...matched, ...rows.filter((row) => !matched.includes(row))];
  if (!ordered.length) {
    return {
      success: false,
      error: errors.length
        ? 'ICEGATE could not be read: ' + errors.join('; ')
        : `ICEGATE has no IGM for BL ${bl} at ${location} yet.`,
      errors,
    };
  }
  return { success: true, location, bl, hbl, hblFound: hbl ? matched.length > 0 : null, rows: ordered, errors };
}
