import { Op, Sequelize } from 'sequelize';
import { Airline, Airwaybill, AwbRateLine, HouseAWB, JobTimeline, Party } from '../../../models/index.js';
import { houseTrack, stageOf, trackKey, trackingMap } from '../../../utils/awb/awbStage.js';

const MIN_SEARCH_LENGTH = 2;
const GLOBAL_RESULTS_PER_KIND = 5;
const MAX_REMARK_RESULTS = 10;
const REMARK_PREVIEW_LENGTH = 30;
const MAX_AWB_ROWS = 3000;
const LIVE_STATUS = { [Op.or]: [{ [Op.ne]: 'VOID' }, null] };

async function remarkResults(likeText) {
  let timelines;
  try {
    timelines = await JobTimeline.findAll({ where: { message: { [Op.like]: likeText } } });
  } catch {
    timelines = [];
  }
  return timelines.map((log) => ({
    type: 'REMARK',
    id: log.jobId,
    title: 'Remark in Job #' + log.jobId + ': ' + (log.message ? log.message.substring(0, REMARK_PREVIEW_LENGTH) : ''),
    link: '/job/' + log.jobId,
  }));
}

/** GET /global-search?q: parties, AWBs and job remarks for the top search bar. */
export async function globalSearch(text) {
  if (text.length < MIN_SEARCH_LENGTH) return { parties: [], awbs: [] };
  const likeText = `%${text}%`;
  const parties = await Party.findAll({
    where: { name: { [Op.like]: likeText } },
    limit: GLOBAL_RESULTS_PER_KIND,
    attributes: ['id', 'name', 'partyType'],
  });
  const mawbs = await Airwaybill.findAll({
    where: { awbNumber: { [Op.like]: likeText }, type: 'MAWB' },
    limit: GLOBAL_RESULTS_PER_KIND,
    attributes: ['id', 'awbNumber'],
  });
  const hawbs = await HouseAWB.findAll({
    where: { awbNumber: { [Op.like]: likeText } },
    limit: GLOBAL_RESULTS_PER_KIND,
    attributes: ['id', 'awbNumber'],
  });
  const awbs = [
    ...mawbs.map((awb) => ({ id: awb.id, no: awb.awbNumber, type: 'MAWB' })),
    ...hawbs.map((house) => ({ id: house.id, no: house.awbNumber, type: 'HAWB' })),
  ];
  const results = await remarkResults(likeText);
  // many remark hits: the remarks alone, as a list
  if (results.length >= MAX_REMARK_RESULTS) return results.slice(0, MAX_REMARK_RESULTS);
  return {
    parties: parties.map((party) => ({ id: party.id, name: party.name, type: party.partyType })),
    awbs,
    results,
  };
}

const containing = (value) => `%${String(value).trim()}%`;
const bareNumber = (value) =>
  String(value || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const filled = (value) => value && String(value).trim();

/** An AWB number matched with or without its dash. */
const numberWithoutDash = (column, value) =>
  Sequelize.where(Sequelize.fn('REPLACE', Sequelize.col(column), '-', ''), {
    [Op.like]: containing(String(value).replace(/[^A-Za-z0-9]/g, '')),
  });

/** The AWB prefixes of an airline given as name / 2-letter code / 3-digit prefix; null when no airline is asked. */
async function airlinePrefixes(airlineText) {
  if (!filled(airlineText)) return null;
  const wanted = String(airlineText).trim().toLowerCase();
  const airlines = await Airline.findAll({ attributes: ['name', 'code2', 'prefix'] });
  const prefixes = airlines
    .filter(
      (airline) =>
        (airline.prefix && airline.prefix === wanted) ||
        (airline.code2 && airline.code2.toLowerCase() === wanted) ||
        (airline.name && airline.name.toLowerCase().includes(wanted)),
    )
    .map((airline) => String(airline.prefix || ''))
    .filter(Boolean);
  if (/^\d{3}$/.test(wanted)) prefixes.push(wanted);
  return prefixes;
}

/** The filters every AWB / HAWB row must pass (branch, year, dates, ports, nature, parties). */
async function commonFilters(query, scope, byFlightDate) {
  const filters = [{ status: LIVE_STATUS }];
  filters.push(await scope.branchWhere());
  // the year of the top bar, unless dates or an AWB / HAWB number are given (those find any year)
  if (!query.fromDate && !query.toDate && !String(query.awbNo || '').trim() && !String(query.hawbNo || '').trim()) {
    filters.push(await scope.yearWhere());
  }
  if (!byFlightDate && query.fromDate)
    filters.push({ createdAt: { [Op.gte]: new Date(query.fromDate + 'T00:00:00') } });
  if (!byFlightDate && query.toDate) filters.push({ createdAt: { [Op.lte]: new Date(query.toDate + 'T23:59:59') } });
  if (filled(query.origin)) filters.push({ origin: { [Op.like]: String(query.origin).trim().toUpperCase() + '%' } });
  if (filled(query.destination))
    filters.push({ destination: { [Op.like]: String(query.destination).trim().toUpperCase() + '%' } });
  if (query.awbNature && query.awbNature !== 'BOTH')
    filters.push({ chargeCode: { [Op.like]: (query.awbNature === 'PREPAID' ? 'P' : 'C') + '%' } });
  if (filled(query.shipper)) filters.push({ shipperName: { [Op.like]: containing(query.shipper) } });
  if (filled(query.consignee)) filters.push({ consigneeName: { [Op.like]: containing(query.consignee) } });
  return filters;
}

async function findMasters(query, filters, awbType, prefixes, flightNo) {
  const conditions = [...filters];
  if (awbType === 'NORMAL') conditions.push({ type: 'AWB' });
  if (awbType === 'MASTER') conditions.push({ [Op.or]: [{ type: 'MAWB' }, { type: null }, { type: '' }] });
  if (filled(query.awbNo)) conditions.push(numberWithoutDash('awbNumber', query.awbNo));
  if (prefixes) conditions.push({ [Op.or]: prefixes.map((prefix) => ({ awbNumber: { [Op.like]: `${prefix}%` } })) });
  // flight: on the AWB / MAWB itself; a house is matched on its own flight or its master's, after the rows are built
  if (flightNo) conditions.push({ flightNumber1: { [Op.like]: containing(flightNo) } });
  return Airwaybill.findAll({ where: { [Op.and]: conditions }, order: [['createdAt', 'DESC']], limit: MAX_AWB_ROWS });
}

async function findHouses(query, filters, prefixes) {
  const conditions = [...filters];
  if (filled(query.hawbNo)) conditions.push(numberWithoutDash('awbNumber', query.hawbNo));
  if (filled(query.awbNo)) conditions.push(numberWithoutDash('masterAwbNumber', query.awbNo));
  if (prefixes)
    conditions.push({ [Op.or]: prefixes.map((prefix) => ({ masterAwbNumber: { [Op.like]: `${prefix}%` } })) });
  return HouseAWB.findAll({ where: { [Op.and]: conditions }, order: [['createdAt', 'DESC']], limit: MAX_AWB_ROWS });
}

/** Chargeable weight of each AWB / HAWB, added up from its rate lines (key: A<id> / H<id>). */
async function chargeableWeights(masters, houses) {
  const weights = {};
  const addWeights = async (ids, awbTypes, tag) => {
    if (!ids.length) return;
    for (const line of await AwbRateLine.findAll({
      where: { awbId: ids, awbType: awbTypes },
      attributes: ['awbId', 'chargeableWeight'],
    })) {
      const key = tag + line.awbId;
      weights[key] = (weights[key] || 0) + (parseFloat(line.chargeableWeight) || 0);
    }
  };
  await addWeights(
    masters.map((awb) => awb.id),
    ['AWB', 'MAWB'],
    'A',
  );
  await addWeights(
    houses.map((house) => house.id),
    ['HAWB'],
    'H',
  );
  return weights;
}

/** The flight of the master, for houses saved without one. */
async function masterFlights(masterNumbers) {
  const flights = {};
  if (!masterNumbers.length) return flights;
  const masters = await Airwaybill.findAll({
    where: { [Op.or]: masterNumbers.map((number) => numberWithoutDash('awbNumber', number)) },
    attributes: ['id', 'awbNumber', 'flightNumber1', 'flightDate1'],
  });
  masters.forEach((awb) => {
    flights[bareNumber(awb.awbNumber)] = awb;
  });
  return flights;
}

function formDataOf(row) {
  let formData = row.formData;
  if (typeof formData === 'string') {
    try {
      formData = JSON.parse(formData);
    } catch {
      formData = {};
    }
  }
  return formData || {};
}

const totalFreight = (row) => (parseFloat(row.totalChargePP) || 0) + (parseFloat(row.totalChargeCC) || 0);

function searchRow(row, isHouse, context) {
  const formData = formDataOf(row);
  const masterFlight = isHouse ? context.masterFlights[bareNumber(row.masterAwbNumber)] : null;
  const flight = row.flightNumber1 || (masterFlight && masterFlight.flightNumber1) || '';
  const flightDate = row.flightDate1 || (masterFlight && masterFlight.flightDate1) || '';
  const chargeable = context.weights[(isHouse ? 'H' : 'A') + row.id];
  const tracking = isHouse
    ? houseTrack(
        context.tracks[trackKey(row.masterAwbNumber, row.awbNumber)],
        context.tracks[trackKey(row.masterAwbNumber, '')],
      )
    : context.tracks[trackKey(row.awbNumber, '')];
  return {
    id: row.id,
    masterId: isHouse && masterFlight ? masterFlight.id : null,
    stage: stageOf(row, tracking),
    type: isHouse ? 'HAWB' : row.type || 'MAWB',
    docketNo: flight,
    flight,
    flightDate,
    awbDate: row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN') : '',
    createdAt: row.createdAt,
    awbNo: isHouse ? row.masterAwbNumber || '' : row.awbNumber || '',
    hawbNo: isHouse ? row.awbNumber || '' : '',
    shipper: row.shipperName || '',
    consignee: row.consigneeName || '',
    origin: row.origin || '',
    dstn: row.destination || '',
    pc: row.chargeCode || '',
    pkgs: row.totalPieces || 0,
    grWt: (parseFloat(row.grossWeight) || 0).toFixed(2),
    chgWt: chargeable ? chargeable.toFixed(2) : '',
    totalFreight: totalFreight(row).toFixed(2),
    currency: row.currencyCode || '',
    subagt: (formData.subAgent && formData.subAgent.name) || '',
    tieup: (formData.overseasAgent && formData.overseasAgent.name) || '',
    // routing FINISHED = flight number and date filled in, PENDING = not yet
    routingStatus: flight && flightDate ? 'FINISHED' : 'PENDING',
    status: row.status || 'ACTIVE',
    cargoType: row.natureOfGoods || '',
    remarks: row.handlingInformation || '',
  };
}

function flightDateInRange(row, fromDate, toDate) {
  const day = String(row.flightDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return (!fromDate || day >= fromDate) && (!toDate || day <= toDate);
}

function filterBuiltRows(rows, query, flightNo, byFlightDate) {
  let data = rows;
  const routing = String(query.routing || 'ALL').toUpperCase();
  if (routing === 'FINISHED' || routing === 'PENDING') data = data.filter((row) => row.routingStatus === routing);
  if (flightNo)
    data = data.filter((row) =>
      String(row.flight || '')
        .toUpperCase()
        .replace(/\s+/g, '')
        .includes(flightNo),
    );
  const stage = String(query.stage || query.status || 'ALL').toUpperCase();
  if (stage !== 'ALL') data = data.filter((row) => row.stage === stage);
  // the flight date is checked after a house gets its master's flight
  if (byFlightDate && (query.fromDate || query.toDate))
    data = data.filter((row) => flightDateInRange(row, query.fromDate, query.toDate));
  return data;
}

/**
 * GET /awb-query (Search Air Waybill screen): AWBs / MAWBs and HAWBs of the branch picked in the top bar.
 * scope.branchWhere / scope.yearWhere give the branch and financial-year filters of the request.
 */
export async function awbQuery(query, scope) {
  const awbType = String(query.awbType || 'ALL').toUpperCase();
  const prefixes = await airlinePrefixes(query.airline);
  if (prefixes && !prefixes.length)
    return { success: true, data: [], total: 0, message: `No airline matches "${query.airline}"` };

  // dates: AWB date (created) by default, or the flight date (dateBasis=FLIGHT)
  const byFlightDate = String(query.dateBasis || '').toUpperCase() === 'FLIGHT';
  const filters = await commonFilters(query, scope, byFlightDate);
  const flightNo = String(query.flightNo || query.docketNo || '')
    .replace(/\s+/g, '')
    .toUpperCase();

  const wantMasters = !query.hawbNo && ['ALL', 'NORMAL', 'MASTER'].includes(awbType);
  const wantHouses = !!query.hawbNo || ['ALL', 'HOUSE'].includes(awbType);
  const masters = wantMasters ? await findMasters(query, filters, awbType, prefixes, flightNo) : [];
  const houses = wantHouses ? await findHouses(query, filters, prefixes) : [];

  const weights = await chargeableWeights(masters, houses);
  const masterNumbers = [...new Set(houses.map((house) => house.masterAwbNumber).filter(Boolean))];
  const flightsOfMasters = await masterFlights(masterNumbers);
  const tracks = await trackingMap([...masters.map((awb) => awb.awbNumber), ...masterNumbers]);
  const context = { weights, masterFlights: flightsOfMasters, tracks };

  const rows = [
    ...masters.map((awb) => searchRow(awb, false, context)),
    ...houses.map((house) => searchRow(house, true, context)),
  ];
  const data = filterBuiltRows(rows, query, flightNo, byFlightDate);
  data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);
  return { success: true, data, total: data.length };
}
