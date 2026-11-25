import { volWtFromDims, dimCm3, divisorOf } from './weightCalc';

// Turning a saved AWB / MAWB / HAWB (GET /awb/search/:no) back into screen state. Shared by the three forms.
const text = (value) => (value === null || value === undefined ? '' : String(value));

const SPH_BOXES = 9;
const CM3_PER_IN3 = 16.387064;

// full party: the copy kept in formData (full address, GSTIN, IEC, ids...) with the columns as fallback
export function partyFromSaved(awb, key, prefix) {
  const formData = (awb && awb.formData) || {};
  const kept = formData[key] && typeof formData[key] === 'object' ? formData[key] : {};
  if (!prefix) return Object.keys(kept).length ? { ...kept, email: text(kept.email) } : null;
  const column = (name) => text(awb[prefix + name]);
  const party = {
    ...kept,
    name: text(kept.name) || column('Name'),
    street: text(kept.street) || column('Address'),
    city: text(kept.city) || column('City'),
    state: text(kept.state) || column('State'),
    country: text(kept.country) || column('Country'),
    zip: text(kept.zip) || column('Zip'),
    phone: text(kept.phone) || column('Phone'),
    email: text(kept.email) || text(formData[key + 'Email']) || column('Email'),
  };
  return party.name || party.street ? party : null;
}

const PARTY_SOURCES = {
  Shipper: ['shipper', 'shipper'],
  Consignee: ['consignee', 'consignee'],
  Buyer: ['buyer', 'buyer'],
  'Sub Agent': ['subAgent'],
  'Overseas Agent': ['overseasAgent'],
  'Notify 1': ['notify1'],
  'Notify 2': ['notify2'],
};

// every party block of the form, ready for setParties
export function partiesFromSaved(awb) {
  const parties = {};
  for (const [title, [key, prefix]] of Object.entries(PARTY_SOURCES)) {
    const party = partyFromSaved(awb, key, prefix);
    if (party) parties[title] = party;
  }
  return parties;
}

export const datePart = (value) => {
  const stamp = text(value);
  return stamp.includes('T') ? stamp.split('T')[0] : stamp;
};
export const timePart = (value) => {
  const stamp = text(value);
  if (!stamp.includes('T')) return '';
  const hoursMinutes = stamp.split('T')[1].substring(0, 5);
  return hoursMinutes === '00:00' ? '' : hoursMinutes;
};

// dimension rows as the Dimension window keeps them (length / width / height / pkgs / unit / volWt)
export function dimsFromSaved(rows) {
  return (rows || []).map((dimension) => {
    const unit = text(dimension.cmIn).toUpperCase().startsWith('IN') ? 'INH' : 'CMT';
    const pieces = parseInt(dimension.pieces, 10) || 0;
    const length = parseFloat(dimension.length) || 0;
    const width = parseFloat(dimension.width) || 0;
    const height = parseFloat(dimension.height) || 0;
    const volWt = parseFloat(dimension.volumetricWeight) || +volWtFromDims([{ length, width, height, pieces: pieces || 1, unit }]).toFixed(2);
    return {
      ...dimension, id: dimension.id || Math.random(), length, width, height, pkgs: pieces, pcs: pieces, pieces, unit,
      cmIn: unit === 'INH' ? 'IN' : 'CM', volWt, volume: parseFloat(dimension.volume) || 0,
    };
  });
}

// total CBM of dimension rows (from the saved volume, else from L x W x H x pieces)
export function dimsCbm(dimensions) {
  return (dimensions || []).reduce((sum, dimension) => {
    const savedVolume = parseFloat(dimension.volume ?? dimension.vol);
    if (savedVolume) return sum + savedVolume;
    const length = parseFloat(dimension.length ?? dimension.len) || 0;
    const width = parseFloat(dimension.width ?? dimension.wid) || 0;
    const height = parseFloat(dimension.height ?? dimension.ht) || 0;
    const pieces = parseInt(dimension.pkgs ?? dimension.pcs ?? dimension.pieces, 10) || 1;
    const inch = text(dimension.unit || dimension.cmIn).toUpperCase().startsWith('IN');
    return sum + (length * width * height * pieces * (inch ? CM3_PER_IN3 : 1)) / 1e6;
  }, 0);
}

// Old saved lines kept the volumetric weight in the volume column and had no volumetric weight; such a line gets its
// volumetric weight and CBM again from its dimensions.
function oldLineWeights(line, dimensions, group) {
  if ((parseFloat(line.volumetricWeight) || 0) > 0) return null;
  const unit = text(line.cmIn).toUpperCase().startsWith('IN') ? 'INCH' : 'CM';
  const source = Array.isArray(dimensions) && dimensions.length
    ? dimensions
    : [{ length: line.length, width: line.width, height: line.height, noOfUnits: line.noOfUnits }];
  const cm3 = source.map((dimension) => ({ ...dimension, unit: dimension.unit || unit })).reduce((sum, dimension) => sum + dimCm3(dimension), 0);
  if (!(cm3 > 0)) return null;
  const volumetricWeight = cm3 / divisorOf(group);
  const cbm = cm3 / 1e6;
  const savedVolume = parseFloat(line.volume) || 0;
  // the volume column is kept when it is a real CBM figure; the old weight-in-volume (or nothing) becomes the CBM
  const volumeIsCbm = savedVolume > 0 && Math.abs(savedVolume - volumetricWeight) > 0.05 && savedVolume < cbm * 10;
  return { volumetricWeight: volumetricWeight.toFixed(2), volume: volumeIsCbm ? text(line.volume) : cbm.toFixed(3) };
}

const parseDimensions = (raw) => {
  if (!raw) return [];
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
};

// the letter only: old lines hold "N - NORMAL RATE"; "SELECT ..." means no class
const rateClassLetter = (rateClass) => {
  const value = text(rateClass).trim();
  return /^SELECT/i.test(value) ? '' : value.toUpperCase().charAt(0);
};

// rate lines in the shape the Rate Line window / grid use
export function rateLinesFromSaved(rows, densityGroup) {
  return (rows || []).map((line) => {
    const dimensions = parseDimensions(line.dimensions);
    const fixedOld = oldLineWeights(line, dimensions, densityGroup);
    const classLetter = rateClassLetter(line.rateClass);
    return {
      ...line,
      noOfPcs: text(line.pieces || line.noOfPcs), pieces: text(line.pieces || line.noOfPcs),
      totalAmount: text(line.total || line.totalAmount), total: text(line.total || line.totalAmount),
      rateClass: classLetter, rateClassCode: classLetter,
      commodityItemNumber: text(line.commodityItemNo || line.commodityItemNumber), commodityItemNo: text(line.commodityItemNo || line.commodityItemNumber),
      goodsDescription: text(line.natureOfGoods || line.goodsDescription), natureOfGoods: text(line.natureOfGoods || line.goodsDescription),
      volume: fixedOld ? fixedOld.volume : text(line.volume),
      volumetricWeight: fixedOld ? fixedOld.volumetricWeight : text(line.volumetricWeight),
      cwUnit: text(line.cwUnit),
      dimensions: Array.isArray(dimensions) ? dimensions : [],
    };
  });
}

export const sphFromSaved = (rows) => {
  const codes = Array(SPH_BOXES).fill('');
  (rows || []).forEach((row, index) => { if (index < SPH_BOXES) codes[index] = row.code; });
  return codes;
};
export const chargesFromSaved = (rows) => (rows || []).map((charge) => ({
  ...charge, code: charge.chargeCode || charge.code || '', entitlement: charge.entitlement || 'carrier', ppcc: charge.ppcc || 'PP', description: charge.description || '',
}));

export const emptyParties = () => ({ Shipper: {}, Consignee: {}, Buyer: {}, 'Sub Agent': {}, 'Overseas Agent': {}, 'Notify 1': {}, 'Notify 2': {} });
export const emptyCharges = () => [1, 2, 3, 4, 5].map((id) => ({ id, code: '', entitlement: id === 2 ? 'agent' : 'carrier', ppcc: 'PP', description: '', amount: '' }));
export const emptyOci = () => [{ id: 1, countryCode: '', infoId: '', customsId: '', suppInfo: '' }];

// child rows and parties of the opened AWB; a list the AWB does not have is cleared, so rows of an AWB opened earlier
// are not saved into this one
export function applySavedRows(awb, setters) {
  const formData = awb.formData || {};
  setters.setRateLines(rateLinesFromSaved(awb.AwbRateLines, awb.densityGroup || formData.densityGroup));
  setters.setOtherCharges(awb.AwbOtherCharges && awb.AwbOtherCharges.length ? chargesFromSaved(awb.AwbOtherCharges) : emptyCharges());
  setters.setOciRows(awb.AwbOcis && awb.AwbOcis.length ? awb.AwbOcis : emptyOci());
  setters.setSphCodes(sphFromSaved(awb.SpecialHandlingCodes));
  const dimensions = dimsFromSaved(awb.AwbDimensions);
  setters.setDimRows(dimensions);
  const cbm = dimsCbm(dimensions);
  if (setters.setVolume) setters.setVolume(cbm > 0 ? cbm.toFixed(3) : (formData.volume || ''));
  setters.setParties({ ...emptyParties(), ...partiesFromSaved(awb) });
}
