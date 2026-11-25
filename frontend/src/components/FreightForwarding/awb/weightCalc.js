// Air cargo weights (IATA), shared by the AWB / MAWB / HAWB screens and the rate line / dimension windows.
// - Volumetric weight = volume in cm3 / divisor; IATA standard divisor 6000 cm3 per kg (1 cbm = 166.67 kg);
//   inches are converted to cm3 (1 in3 = 16.387064 cm3).
// - Chargeable weight = higher of gross and volumetric weight, rounded UP to the next 0.5 kg (or the next whole lb when
//   the weight is in pounds).
export const DIVISORS = { '1:6': 6000, '1:5': 5000, '1:7': 7000, '1:8': 8000 }; // cm3 per kg
export const divisorOf = (group) => DIVISORS[String(group || '').trim()] || 6000;
export const KG_PER_LB = 0.45359237;
const CM3_PER_IN3 = 16.387064;
const CBM_PER_CF = 0.028316846592;

const toNumber = (value) => {
  const parsed = parseFloat(String(value ?? '').replace(/,/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

// 'K' / 'L' as the AWB uses them ('KG', 'LB', 'LBS' from the windows / old saves)
export const unitKL = (unit) => (/^L/i.test(String(unit || '').trim()) ? 'L' : 'K');

// volume of the screen's Volume box in cbm (MC cubic metres, CC cubic centimetres, CF cubic feet)
export const cbmOf = (volume, mcUnit) => {
  const amount = toNumber(volume);
  const unit = String(mcUnit || 'MC').toUpperCase();
  if (unit === 'CC') return amount / 1e6;
  if (unit === 'CF') return amount * CBM_PER_CF;
  return amount;
};

const isInch = (dimension) => /^IN/i.test(String(dimension.unit || dimension.cmIn || ''));
const piecesOf = (dimension) => dimension.pkgs ?? dimension.pcs ?? dimension.pieces ?? dimension.noOfUnits;

// cm3 of one dimension line (L x W x H x pieces), CM or INCH
export const dimCm3 = (dimension) => {
  const length = toNumber(dimension.length ?? dimension.len);
  const width = toNumber(dimension.width ?? dimension.wid);
  const height = toNumber(dimension.height ?? dimension.ht);
  const pieces = parseInt(piecesOf(dimension), 10) || 1;
  if (!(length > 0 && width > 0 && height > 0)) return 0;
  return length * width * height * pieces * (isInch(dimension) ? CM3_PER_IN3 : 1);
};

const totalCm3 = (dimensions) => (dimensions || []).reduce((sum, dimension) => sum + dimCm3(dimension), 0);

export const volWtFromCm3 = (cm3, group) => cm3 / divisorOf(group);
export const volWtFromCbm = (cbm, group) => (toNumber(cbm) * 1e6) / divisorOf(group);
export const volWtFromDims = (dimensions, group) => volWtFromCm3(totalCm3(dimensions), group);
export const cbmFromDims = (dimensions) => totalCm3(dimensions) / 1e6;

export const roundUpHalf = (weight) => Math.ceil(toNumber(weight) * 2 - 1e-9) / 2;

// chargeable weight in the unit of the gross weight; volumetric weight is always kg
export function chargeableOf(gross, volumetricKg, unit = 'K', round = true) {
  const grossWeight = toNumber(gross);
  const inPounds = unitKL(unit) === 'L';
  const volumetric = inPounds ? toNumber(volumetricKg) / KG_PER_LB : toNumber(volumetricKg);
  const chargeable = Math.max(grossWeight, volumetric);
  if (!(chargeable > 0)) return 0;
  if (!round) return chargeable;
  return inPounds ? Math.ceil(chargeable - 1e-9) : roundUpHalf(chargeable);
}

export const fix = (value, decimals = 2) => (toNumber(value) ? toNumber(value).toFixed(decimals) : '');

const CHARGEABLE_SOURCES = ['grossWeight', 'volumetricWeight', 'isRounded', 'gwUnit', 'dims'];
const TOTAL_SOURCES = ['rateCharge', 'rateClassCode', 'chargeableWeight', ...CHARGEABLE_SOURCES];

// One rate line after a change of `field`: chargeable weight follows gross / volumetric weight / unit / rounding
// unless the user typed it; total = chargeable x rate. isRounded defaults to on (IATA).
export function recalcRow(row, field) {
  const line = { ...row };
  if (field === 'rateClassCode') line.rateClass = String(line.rateClassCode || '').trim().toUpperCase().charAt(0);
  line.gwUnit = unitKL(line.gwUnit);
  const rounded = line.isRounded !== false;
  const chargeableUntouched = !line.cwManual && field !== 'rateCharge' && field !== 'totalAmount' && !toNumber(line.chargeableWeight);
  if (field === 'chargeableWeight') {
    line.cwManual = true;
  } else if (CHARGEABLE_SOURCES.includes(field) || chargeableUntouched) {
    const chargeable = chargeableOf(line.grossWeight, line.volumetricWeight, line.gwUnit, rounded);
    line.chargeableWeight = chargeable ? chargeable.toFixed(2) : '';
    line.cwManual = false;
  }
  if (TOTAL_SOURCES.includes(field)) {
    const chargeable = toNumber(line.chargeableWeight);
    const rate = toNumber(line.rateCharge);
    // M (minimum) / B (basic) charge: the amount is the charge itself, not weight x rate
    if (rate > 0 && /^(M|B)$/i.test(String(line.rateClassCode || line.rateClass || '').charAt(0))) line.totalAmount = rate.toFixed(2);
    else if (chargeable > 0 && rate > 0) line.totalAmount = (chargeable * rate).toFixed(2);
  }
  return line;
}

// the volumetric weight (kg) and chargeable weight of the first rate line from a new volumetric weight
export function withVolWt(lines, volumetricKg) {
  const list = Array.isArray(lines) ? [...lines] : [];
  const volumetric = toNumber(volumetricKg) ? +toNumber(volumetricKg).toFixed(2) : '';
  if (!list.length) list.push({ id: 1, noOfPcs: '', grossWeight: '', isRounded: true });
  list[0] = recalcRow({ ...list[0], volumetricWeight: volumetric }, 'volumetricWeight');
  return list;
}

const DIMENSION_LINE = /^\s*\d+\s*PCS-[\d.]+X[\d.]+X[\d.]+/i;
const VOLUME_WEIGHT_LINE = /^\s*VOL WT\.?:/i;

// dimension lines in the goods description: earlier "n PCS-LxWxH" / "VOL WT.:" lines are replaced, not added again
export function goodsWithDims(text, dimensions, volumetricKg) {
  const kept = String(text || '').split('\n')
    .filter((line) => !DIMENSION_LINE.test(line) && !VOLUME_WEIGHT_LINE.test(line))
    .join('\n')
    .replace(/\n+$/, '');
  const dimensionLines = (dimensions || [])
    .filter((dimension) => dimCm3(dimension) > 0)
    .map((dimension) => `${piecesOf(dimension)} PCS-${toNumber(dimension.length ?? dimension.len)}X${toNumber(dimension.width ?? dimension.wid)}X${toNumber(dimension.height ?? dimension.ht)} ${isInch(dimension) ? 'INCH' : 'CMS'}`);
  if (!dimensionLines.length) return kept;
  return [kept, ...dimensionLines, `VOL WT.: ${toNumber(volumetricKg).toFixed(2)} KGS`].filter(Boolean).join('\n');
}
