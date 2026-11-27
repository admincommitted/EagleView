// Stage of an AWB / HAWB from its tracking row - shared by the dashboard, Track Shipments and Search.
import { Op } from '../../config/database.js';
import { AwbTracking } from '../../models/index.js';

// FNA = the airline / host rejected the message; it counts until an FMA (accepted) or a later milestone comes after it.
function stageOf(record, tracking) {
  const track = tracking || {};
  if (record.status === 'VOID') return 'VOID';
  if (track.dlv) return 'DELIVERED';
  if (track.dep || track.arr || track.rcf || track.nfd || track.tfd) return 'DEPARTED';
  if (track.rcs || track.foh) return 'READY_FOR_CARRIAGE';
  if (track.fna && !(track.fma && String(track.fma) > String(track.fna))) return 'REJECTED';
  if (track.submittedToAirline || record.status === 'TRANSMITTED' || track.fma) return 'SUBMITTED';
  return 'SAVED';
}

const bare = (number) =>
  String(number || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
const trackKey = (awb, hawb) => bare(awb) + '|' + bare(hawb);

const AWB_DIGITS = 11;

// the spellings an AWB number may be stored under: as typed, bare digits, and 176-12345678
function awbNumberVariants(number) {
  const digits = bare(number);
  return [number, digits, digits.length === AWB_DIGITS ? `${digits.slice(0, 3)}-${digits.slice(3)}` : number];
}

// all tracking rows of these master numbers, as a map trackKey -> row
async function trackingMap(masterNumbers) {
  const numbers = [...new Set(masterNumbers.filter(Boolean))];
  const variants = [...new Set(numbers.flatMap(awbNumberVariants))];
  const rows = variants.length ? await AwbTracking.findAll({ where: { awbNumber: { [Op.in]: variants } } }) : [];
  const map = {};
  rows.forEach((row) => {
    map[trackKey(row.awbNumber, row.hawbNumber)] = row;
  });
  return map;
}

// a house flies with its master: movement milestones the house row does not have come from the master's row
// (FNA / FMA / submitted stay the house's own - they are about its FHL message)
const MOVEMENT_MILESTONES = ['foh', 'rcs', 'dep', 'arr', 'tfd', 'rcf', 'nfd', 'dlv'];
function houseTrack(own, master) {
  if (!master) return own;
  const merged = own ? (own.toJSON ? own.toJSON() : { ...own }) : {};
  MOVEMENT_MILESTONES.forEach((key) => {
    if (!merged[key] && master[key]) merged[key] = master[key];
  });
  return merged;
}

export { stageOf, trackKey, trackingMap, bare, houseTrack };
