import { Op } from 'sequelize';
import { Airwaybill, AwbTracking, HouseAWB } from '../../../../models/index.js';
import { houseTrack, stageOf } from '../../../../utils/awb/awbStage.js';
import { AWB_DIGITS, bareAwbNo, dashedAwbNo } from './awbNumbers.js';

const ROW_ATTRIBUTES = [
  'id',
  'awbNumber',
  'type',
  'shipperName',
  'consigneeName',
  'origin',
  'destination',
  'status',
  'totalPieces',
  'grossWeight',
  'flightNumber1',
  'flightDate1',
  'createdAt',
];

/** Tracking is matched on (master number, house number) without dashes, so a house never takes the master's row. */
const trackingKey = (awbNumber, hawbNumber) => bareAwbNo(awbNumber) + '|' + bareAwbNo(hawbNumber);

function numberVariantsOf(numbers) {
  return [
    ...new Set(
      numbers.flatMap((number) => {
        const bare = bareAwbNo(number);
        return [number, bare, bare.length === AWB_DIGITS ? dashedAwbNo(bare) : number];
      }),
    ),
  ];
}

async function loadTrackingMap(masters, houses) {
  const masterNumbers = [
    ...new Set([...masters.map((m) => m.awbNumber), ...houses.map((h) => h.masterAwbNumber)].filter(Boolean)),
  ];
  const variants = numberVariantsOf(masterNumbers);
  const trackingRows = variants.length
    ? await AwbTracking.findAll({ where: { awbNumber: { [Op.in]: variants } } })
    : [];
  const trackingMap = {};
  trackingRows.forEach((row) => {
    trackingMap[trackingKey(row.awbNumber, row.hawbNumber)] = row;
  });
  return trackingMap;
}

function trackingOf(record, isHouse, trackingMap) {
  if (!isHouse) return trackingMap[trackingKey(record.awbNumber, '')] || {};
  const ownRow = trackingMap[trackingKey(record.masterAwbNumber, record.awbNumber)];
  const masterRow = trackingMap[trackingKey(record.masterAwbNumber, '')];
  return houseTrack(ownRow, masterRow) || {};
}

function formatRow(record, isHouse, trackingMap) {
  const tracking = trackingOf(record, isHouse, trackingMap);
  const stage = stageOf(record, tracking);
  return {
    id: record.id,
    type: isHouse ? 'HAWB' : record.type || 'MAWB',
    awbNumber: isHouse ? record.masterAwbNumber || '' : record.awbNumber || '',
    hawbNumber: isHouse ? record.awbNumber || '' : '',
    shipperName: record.shipperName || '',
    consigneeName: record.consigneeName || '',
    origin: record.origin || '',
    destination: record.destination || '',
    status: record.status || 'ACTIVE',
    totalPieces: record.totalPieces || 0,
    grossWeight: record.grossWeight || 0,
    flight: record.flightNumber1 || '',
    flightDate: record.flightDate1 || '',
    createdAt: record.createdAt,
    saved: true,
    submittedToAirline: stage !== 'SAVED' && stage !== 'VOID',
    fna: tracking.fna || null,
    fma: tracking.fma || null,
    foh: tracking.foh || null,
    rcs: tracking.rcs || null,
    dep: tracking.dep || null,
    arr: tracking.arr || null,
    tfd: tracking.tfd || null,
    rcf: tracking.rcf || null,
    nfd: tracking.nfd || null,
    dlv: tracking.dlv || null,
    trackingStatus: tracking.status || 'PENDING',
    stage,
  };
}

const newestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id;

/** Every AWB / MAWB / HAWB record matching `where`, with its tracking row and stage (dashboard and Track Shipments). */
export async function loadAwbRows(where) {
  const mawbs = await Airwaybill.findAll({ where, attributes: ROW_ATTRIBUTES });
  const hawbs = await HouseAWB.findAll({
    where,
    attributes: [...ROW_ATTRIBUTES.slice(0, 2), 'masterAwbNumber', ...ROW_ATTRIBUTES.slice(2)],
  });
  const trackingMap = await loadTrackingMap(mawbs, hawbs);

  const masterByNumber = {};
  mawbs.forEach((master) => {
    masterByNumber[bareAwbNo(master.awbNumber)] = master;
  });

  const houseRow = (house) => {
    const row = formatRow(house, true, trackingMap);
    // a house without its own flight shows the master's flight
    const master = masterByNumber[bareAwbNo(house.masterAwbNumber)];
    if (!row.flight && master) {
      row.flight = master.flightNumber1 || '';
      row.flightDate = master.flightDate1 || '';
    }
    return row;
  };

  const rows = [...mawbs.map((master) => formatRow(master, false, trackingMap)), ...hawbs.map(houseRow)].sort(
    newestFirst,
  );
  return { rows, mawbs, hawbs };
}
