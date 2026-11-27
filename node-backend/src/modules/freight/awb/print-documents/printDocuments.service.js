import { chromium } from 'playwright';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../../config/database.js';
import { ApiError } from '../../../../core/http/index.js';
import { Airline, Airwaybill, HouseAWB } from '../../../../models/index.js';
import { houseKg, liveHousesOf } from '../../../../utils/awb/XmlPayloadGenerator.js';
import { badRequest, notFound } from '../shared/awbErrors.js';
import { AWB_DIGITS, dashedAwbNo, liveStatus } from '../shared/awbNumbers.js';
import { ourCompany } from '../shared/companyHeader.js';
import { findLiveMaster } from '../shared/masterAwb.js';

const WEIGHT_TOLERANCE_KG = 0.5;
const MAX_PDF_HTML_BYTES = 3 * 1024 * 1024;
const MAX_PDF_FILE_NAME = 80;
const PAGE_LOAD_TIMEOUT_MS = 30000;
const DEFAULT_PDF_NAME = 'Airway_Bill.pdf';

const text = (value) => (value == null ? '' : String(value).trim());
const numberOf = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value, decimals) => +value.toFixed(decimals);
const sumOf = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

const rateLinesOf = (record) => (record && (record.AwbRateLines || record.awbRateLines)) || [];
const chargeableWeightOf = (record) =>
  round(
    sumOf(rateLinesOf(record), (line) => numberOf(line.chargeableWeight)),
    2,
  );
const goodsOf = (record) =>
  text(record.natureOfGoods) ||
  text((rateLinesOf(record).find((line) => text(line.natureOfGoods)) || {}).natureOfGoods);

const airlineOfPrefix = (prefix) => Airline.findOne({ where: { prefix } }).catch(() => null);

/** "2026-11-11T10:30" -> { flight, date } for every flight leg that has a number. */
const manifestFlightsOf = (record) =>
  [
    [record.flightNumber1, record.flightDate1],
    [record.flightNumber2, record.flightDate2],
  ]
    .filter(([flight]) => text(flight))
    .map(([flight, date]) => ({ flight: text(flight).toUpperCase(), date: text(date).slice(0, 10) }));

const manifestPartyOf = (record, prefix) => ({
  name: text(record[prefix + 'Name']),
  address: text(record[prefix + 'Address']),
  place: [record[prefix + 'City'], record[prefix + 'State'], record[prefix + 'Zip'], record[prefix + 'Country']]
    .map(text)
    .filter(Boolean)
    .join(', '),
  phone: text(record[prefix + 'Phone']),
});

function manifestHouseRow(house) {
  const gross = houseKg(house);
  return {
    id: house.id,
    hawb: text(house.awbNumber),
    origin: text(house.depAirport || house.origin),
    destination: text(house.destAirport || house.destination),
    shipper: manifestPartyOf(house, 'shipper'),
    consignee: manifestPartyOf(house, 'consignee'),
    pieces: parseInt(house.totalPieces, 10) || 0,
    gross,
    chargeable: chargeableWeightOf(house) || gross,
    goods: goodsOf(house),
    chargeCode: text(house.chargeCode),
    handling: text(house.handlingInformation),
    volume: numberOf(house.totalVolume),
  };
}

const manifestTotalsOf = (rows) => ({
  houses: rows.length,
  pieces: sumOf(rows, (row) => row.pieces),
  gross: round(
    sumOf(rows, (row) => row.gross),
    2,
  ),
  chargeable: round(
    sumOf(rows, (row) => row.chargeable),
    2,
  ),
  volume: round(
    sumOf(rows, (row) => row.volume),
    3,
  ),
});

const routingTextOf = (master) =>
  [
    [master.to1, master.by1],
    [master.to2, master.by2],
    [master.to3, master.by3],
  ]
    .filter(([to]) => text(to))
    .map(([to, by]) => `${text(to)}${text(by) ? ' / ' + text(by) : ''}`);

function manifestMasterOf(master, dashed, airline) {
  return {
    id: master.id,
    mawb: dashed,
    date: text(master.executedDate).slice(0, 10),
    origin: text(master.depAirport || master.origin),
    destination: text(master.destAirport || master.destination),
    airline: airline ? text(airline.name) : '',
    airlineCode: airline ? text(airline.code2) : '',
    flights: manifestFlightsOf(master),
    routing: routingTextOf(master),
    pieces: parseInt(master.totalPieces, 10) || 0,
    gross: numberOf(master.grossWeight),
    chargeable: chargeableWeightOf(master),
    shipper: manifestPartyOf(master, 'shipper'),
    consignee: manifestPartyOf(master, 'consignee'),
    goods: goodsOf(master),
    type: text(master.type),
  };
}

function manifestWarnings(manifestMaster, rows, totals, dashed) {
  const warnings = [];
  if (manifestMaster) {
    if (manifestMaster.type && manifestMaster.type !== 'MAWB') {
      warnings.push(`${dashed} is a direct AWB (not a consol MAWB) - it has no house manifest.`);
    }
    if (rows.length && manifestMaster.pieces !== totals.pieces) {
      warnings.push(`Pieces: houses ${totals.pieces}, MAWB ${manifestMaster.pieces}.`);
    }
    if (rows.length && Math.abs(manifestMaster.gross - totals.gross) > WEIGHT_TOLERANCE_KG) {
      warnings.push(`Gross weight: houses ${totals.gross} kg, MAWB ${manifestMaster.gross} kg.`);
    }
  } else {
    warnings.push(`MAWB ${dashed} is not saved in EagleView - only its houses are shown.`);
  }
  if (!rows.length) warnings.push('No live HAWB is linked to this MAWB.');
  return warnings;
}

/**
 * The consol (air cargo) manifest of a MAWB: the master's own details (airline, flight, consignee = the overseas
 * agent, pieces / weight) and every live HAWB with its shipper, consignee, pieces, gross and chargeable weight, goods;
 * totals against the master; our name / address from the company profile and the master's branch.
 */
export async function buildConsolManifest(masterAwbNumber, preparedBy) {
  const digits = String(masterAwbNumber || '')
    .replace(/\D/g, '')
    .slice(0, AWB_DIGITS);
  const dashed = dashedAwbNo(digits);
  const master = await Airwaybill.findOne({
    where: { awbNumber: { [Op.in]: [digits, dashed] }, status: liveStatus() },
    include: [{ all: true }],
    order: [['id', 'DESC']],
  });
  const houses = await liveHousesOf({ awbNumber: master ? master.awbNumber : dashed }, true);
  const airline = await airlineOfPrefix(digits.slice(0, 3));

  const rows = houses.map(manifestHouseRow);
  const totals = manifestTotalsOf(rows);
  const manifestMaster = master ? manifestMasterOf(master, dashed, airline) : null;
  const warnings = manifestWarnings(manifestMaster, rows, totals, dashed);
  const company = {
    ...(await ourCompany(master && master.branchId)),
    iata: text((master && master.agentCode) || (houses[0] && houses[0].agentCode)),
  };
  return { success: true, master: manifestMaster, houses: rows, totals, company, warnings, preparedBy };
}

const documentPartyOf = (record, prefix) => ({
  name: text(record[prefix + 'Name']),
  address: text(record[prefix + 'Address']),
  city: text(record[prefix + 'City']),
  state: text(record[prefix + 'State']),
  zip: text(record[prefix + 'Zip']),
  country: text(record[prefix + 'Country']),
  phone: text(record[prefix + 'Phone']),
  email: text(record[prefix + 'Email']),
});

/** Name, address, city line, country, phone, e-mail - one per line, as printed on the documents. */
const partyBlockOf = (party) =>
  [
    party.name,
    party.address,
    [party.city, party.state, party.zip].filter(Boolean).join(' '),
    party.country,
    party.phone ? 'Ph: ' + party.phone : '',
    party.email,
  ]
    .filter(Boolean)
    .join('\n');

const formDataPartyOf = (value) =>
  value && typeof value === 'object'
    ? {
        name: text(value.name),
        address: text(value.address),
        city: text(value.city),
        state: text(value.state),
        zip: text(value.zip || value.pinCode),
        country: text(value.country),
        phone: text(value.phone),
        email: text(value.email),
      }
    : null;

function formDataOf(record) {
  let formData = record.formData;
  if (typeof formData === 'string') {
    try {
      formData = JSON.parse(formData);
    } catch {
      formData = {};
    }
  }
  return formData || {};
}

async function airportOf(code) {
  const airportCode = text(code).toUpperCase();
  if (!airportCode) return { code: '', name: '', country: '' };
  const rows = await sequelize
    .query('SELECT code, name, countryCode FROM Airports WHERE upper(code) = ? LIMIT 1', {
      replacements: [airportCode],
      type: QueryTypes.SELECT,
    })
    .catch(() => []);
  const airport = rows[0];
  return {
    code: airportCode,
    name: airport ? text(airport.name) : '',
    country: airport ? text(airport.countryCode) : '',
  };
}

const dashedOrAsTyped = (number) => {
  const digits = String(number || '').replace(/\D/g, '');
  return digits.length === AWB_DIGITS ? dashedAwbNo(digits) : text(number);
};

const documentRateLinesOf = (record) =>
  (record.AwbRateLines || []).map((line) => ({
    pieces: parseInt(line.pieces, 10) || 0,
    gross: numberOf(line.grossWeight),
    unit: text(line.gwUnit) || 'K',
    rateClass: text(line.rateClass),
    chargeable: numberOf(line.chargeableWeight),
    rate: numberOf(line.rateCharge),
    total: numberOf(line.total),
    goods: text(line.natureOfGoods),
    hs: text(line.harmonisedCode),
    volume: numberOf(line.volume),
  }));

const documentDimensionsOf = (record) =>
  (record.AwbDimensions || [])
    .filter((dimension) => numberOf(dimension.length) && numberOf(dimension.width) && numberOf(dimension.height))
    .map((dimension) => ({
      pieces: parseInt(dimension.pieces, 10) || 0,
      l: numberOf(dimension.length),
      w: numberOf(dimension.width),
      h: numberOf(dimension.height),
      unit: /in/i.test(text(dimension.cmIn)) ? 'IN' : 'CM',
    }));

const documentOtherChargesOf = (record) =>
  (record.AwbOtherCharges || [])
    .filter((charge) => text(charge.chargeCode))
    .map((charge) => ({
      code: text(charge.chargeCode),
      amount: numberOf(charge.amount),
      due: /^c/i.test(text(charge.entitlement)) ? 'C' : 'A',
      ppcc: text(charge.ppcc) || 'P',
      description: text(charge.description),
    }));

/** Other charges due agent (A) / carrier (C), prepaid (P) / collect (C). */
const otherChargesTotal = (otherCharges, due, prepaidOrCollect) =>
  round(
    sumOf(
      otherCharges.filter(
        (charge) => charge.due === due && String(charge.ppcc).toUpperCase().startsWith(prepaidOrCollect),
      ),
      (charge) => charge.amount,
    ),
    2,
  );

const documentFlightsOf = (record) =>
  [
    [record.flightNumber1, record.flightDate1],
    [record.flightNumber2, record.flightDate2],
    [record.flightNumber3, record.flightDate3],
  ]
    .filter(([flight]) => text(flight))
    .map(([flight, date]) => ({
      flight: text(flight).toUpperCase(),
      date: text(date).slice(0, 10),
      time: text(date).slice(11, 16),
    }));

const documentRoutingOf = (record) =>
  [
    [record.to1, record.by1],
    [record.to2, record.by2],
    [record.to3, record.by3],
  ]
    .filter(([to]) => text(to))
    .map(([to, by]) => ({ to: text(to).toUpperCase(), by: text(by).toUpperCase() }));

const documentHouseRow = (house) => ({
  hawb: text(house.awbNumber),
  pieces: parseInt(house.totalPieces, 10) || 0,
  gross: houseKg(house),
  shipper: text(house.shipperName),
  consignee: text(house.consigneeName),
  origin: text(house.depAirport || house.origin),
  destination: text(house.destAirport || house.destination),
  goods:
    text(house.natureOfGoods) ||
    text(((house.AwbRateLines || []).find((line) => text(line.natureOfGoods)) || {}).natureOfGoods),
});

function chargesOf(record, otherCharges) {
  return {
    weightPP: numberOf(record.weightChargePP),
    weightCC: numberOf(record.weightChargeCC),
    valPP: numberOf(record.valChargePP),
    valCC: numberOf(record.valChargeCC),
    taxPP: numberOf(record.taxPP),
    taxCC: numberOf(record.taxCC),
    agentPP: otherChargesTotal(otherCharges, 'A', 'P'),
    agentCC: otherChargesTotal(otherCharges, 'A', 'C'),
    carrierPP: otherChargesTotal(otherCharges, 'C', 'P'),
    carrierCC: otherChargesTotal(otherCharges, 'C', 'C'),
    totalPP: numberOf(record.totalChargePP),
    totalCC: numberOf(record.totalChargeCC),
    other: otherCharges,
  };
}

/**
 * One saved AWB / MAWB / HAWB in the shape the document windows need (SLI, DGD, labels, booking, CCA, DO, COO,
 * lithium, live animals, temperature, security declaration). A HAWB brings its MAWB's airline / flights / routing.
 */
export async function buildDocumentData(typeParam, recordId, userName) {
  const type = String(typeParam || '').toUpperCase();
  const Model = type === 'HAWB' ? HouseAWB : Airwaybill;
  const saved = await Model.findByPk(recordId, { include: [{ all: true }] });
  if (!saved) throw notFound({ error: 'AWB not found - save it first' });

  const record = saved.get({ plain: true });
  const formData = formDataOf(record);
  const masterRecord = type === 'HAWB' ? await findLiveMaster(record.masterAwbNumber) : null;
  const master = masterRecord ? masterRecord.get({ plain: true }) : null;
  const flightSource = master || record;
  const mawbNo = type === 'HAWB' ? dashedOrAsTyped(record.masterAwbNumber) : dashedOrAsTyped(record.awbNumber);
  const airline = await airlineOfPrefix(mawbNo.slice(0, 3));

  const lines = documentRateLinesOf(record);
  const dims = documentDimensionsOf(record);
  const otherCharges = documentOtherChargesOf(record);
  const pieces = parseInt(record.totalPieces, 10) || sumOf(lines, (line) => line.pieces);
  const gross = numberOf(record.grossWeight) || sumOf(lines, (line) => line.gross);
  const chargeable =
    round(
      sumOf(lines, (line) => line.chargeable),
      2,
    ) || gross;
  const goods = text(record.natureOfGoods) || text((lines.find((line) => line.goods) || {}).goods);
  const flights = documentFlightsOf(flightSource);
  const houses =
    type !== 'HAWB' ? (await liveHousesOf({ awbNumber: record.awbNumber }, true)).map(documentHouseRow) : [];
  const shipper = documentPartyOf(record, 'shipper');
  const consignee = documentPartyOf(record, 'consignee');
  const notify = formDataPartyOf(formData.notify1) || null;
  const company = await ourCompany(record.branchId || (master && master.branchId));

  return {
    success: true,
    type,
    id: record.id,
    status: text(record.status),
    awbNo: mawbNo,
    mawbNo,
    hawbNo: type === 'HAWB' ? text(record.awbNumber) : '',
    date: text(record.executedDate).slice(0, 10),
    airline: {
      name: airline ? text(airline.name) : '',
      code: airline ? text(airline.code2) : '',
      prefix: mawbNo.slice(0, 3),
    },
    flights,
    routing: documentRoutingOf(flightSource),
    origin: await airportOf(record.depAirport || record.origin),
    destination: await airportOf(record.destAirport || record.destination),
    shipper,
    consignee,
    notify,
    shipperBlock: partyBlockOf(shipper),
    consigneeBlock: partyBlockOf(consignee),
    notifyBlock: notify ? partyBlockOf(notify) : '',
    agent: {
      name: text(record.agentName || (master && master.agentName)),
      iata: text(record.agentCode || (master && master.agentCode)),
      account: text(record.agentAccountNo),
      place: text(record.agentPlace || record.agentCity),
    },
    pieces,
    gross,
    chargeable,
    volume:
      numberOf(record.totalVolume) ||
      round(
        sumOf(lines, (line) => line.volume),
        3,
      ),
    lines,
    dims,
    dimsText: dims
      .map((dimension) => `${dimension.pieces} x ${dimension.l} x ${dimension.w} x ${dimension.h} ${dimension.unit}`)
      .join('\n'),
    goods,
    hsCodes: [...new Set(lines.map((line) => line.hs).filter(Boolean))],
    shc: [...new Set((record.SpecialHandlingCodes || []).map((code) => text(code.code).toUpperCase()).filter(Boolean))],
    handling: text(record.handlingInformation),
    ssr: text(record.ssr),
    osi: text(record.osi),
    sci: text(record.sci),
    currency: text(record.currencyCode) || 'INR',
    chargeCode: text(record.chargeCode),
    wtVal: text(record.wtVal),
    other: text(record.other),
    declared: {
      carriage: text(record.declaredValueCarriage) || 'NVD',
      customs: text(record.declaredValueCustoms) || 'NCV',
      insurance: text(record.amountOfInsurance) || 'XXX',
    },
    charges: chargesOf(record, otherCharges),
    executed: { date: text(record.executedDate).slice(0, 10), place: text(record.executedPlace) },
    signatureShipper: text(record.signatureShipper),
    signatureCarrier: text(record.signatureCarrier),
    houses,
    company,
    user: userName,
    today: new Date().toISOString().slice(0, 10),
  };
}

let sharedBrowser = null;

/**
 * Playwright's own Chromium is there only after "npx playwright install" for this Playwright version, so the PDF
 * browser is Playwright's Chromium, else Microsoft Edge (always on Windows), else Google Chrome.
 */
const BROWSER_LAUNCH_OPTIONS = [
  { headless: true },
  { headless: true, channel: 'msedge' },
  { headless: true, channel: 'chrome' },
];

async function getBrowser() {
  if (sharedBrowser && sharedBrowser.isConnected()) return sharedBrowser;
  sharedBrowser = null;
  let lastError = null;
  for (const options of BROWSER_LAUNCH_OPTIONS) {
    try {
      sharedBrowser = await chromium.launch(options);
      return sharedBrowser;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Only the AWB print page made by the AWB screens is turned into a PDF: an AWB page only (size limit, its own
 * markers), no scripts, and nothing loaded from anywhere except the Google fonts the page uses - so the server's
 * browser can never read other pages on the office network or local files into a PDF.
 */
function checkPrintPage(html) {
  if (!html || typeof html !== 'string') throw badRequest({ error: 'No HTML provided' });
  if (html.length > MAX_PDF_HTML_BYTES) {
    throw new ApiError(413, 'The AWB page is too big for a PDF', {
      body: { error: 'The AWB page is too big for a PDF' },
    });
  }
  if (!/AIR WAYBILL/i.test(html) || !/class="awb-outer"/.test(html)) {
    throw badRequest({ error: 'Only an Air Waybill print page can be made into a PDF here' });
  }
}

const safePdfName = (fileName) =>
  String(fileName || DEFAULT_PDF_NAME)
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .slice(0, MAX_PDF_FILE_NAME) || DEFAULT_PDF_NAME;

const withoutActiveContent = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|frame|frameset|base|meta\s+http-equiv)\b[^>]*>/gi, '');

const allowedPdfResource = (url) =>
  /^(data:|about:)/i.test(url) || /^https:\/\/fonts\.(googleapis|gstatic)\.com\//i.test(url);

const NO_BROWSER_PATTERN = /Executable doesn't exist|playwright install|Chromium distribution|is not found at/i;

async function printToPdf(context, html) {
  await context.route('**/*', (route) =>
    allowedPdfResource(route.request().url()) ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  await page.emulateMedia({ media: 'print' });
  // fonts that do not load: the page is still printed
  await page.setContent(html, { waitUntil: 'load', timeout: PAGE_LOAD_TIMEOUT_MS }).catch(() => {});
  return page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
}

/** { fileName, pdf } of the AWB print page. */
export async function renderAwbPdf({ html, filename } = {}) {
  let context = null;
  try {
    checkPrintPage(html);
    const fileName = safePdfName(filename);
    const browser = await getBrowser();
    context = await browser.newContext({ javaScriptEnabled: false });
    const pdf = await printToPdf(context, withoutActiveContent(html));
    return { fileName, pdf };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('PDF Gen Error:', error);
    const noBrowser = NO_BROWSER_PATTERN.test(String(error && error.message));
    sharedBrowser = null;
    const message = noBrowser
      ? 'No browser on the server to make the PDF (Playwright Chromium / Edge / Chrome)'
      : 'PDF generation failed';
    throw new ApiError(500, message, { body: { noBrowser, error: message } });
  } finally {
    if (context) await context.close().catch(() => {});
  }
}
