// Air cargo weights (IATA), one place for the AWB / MAWB / HAWB screens and the rate line / dimension windows. 29-Oct-2026
// - Volumetric (dimensional) weight = volume in cm3 / divisor; IATA standard divisor 6000 cm3 per kg (1 cbm = 166.67 kg);
//   inches are converted to cm3 (1 in3 = 16.387064 cm3). The screens used 167 kg per cbm and, worse, picked the divisor
//   from the cargo's own density (1:8 = 125 kg per cbm for light cargo), so light cargo was charged on too low a weight.
// - Chargeable weight = higher of gross and volumetric weight, rounded UP to the next 0.5 kg (or the next whole lb when
//   the weight is in pounds); the rounding was off unless a box was ticked, and a lb gross weight was compared with a kg
//   volumetric weight.
export const DIVISORS = { '1:6': 6000, '1:5': 5000, '1:7': 7000, '1:8': 8000 }; // cm3 per kg
export const divisorOf = (group) => DIVISORS[String(group || '').trim()] || 6000;
export const KG_PER_LB = 0.45359237;
const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(x) ? 0 : x; };

// 'K' / 'L' as the AWB uses them ('KG', 'LB', 'LBS' from the windows / old saves)
export const unitKL = (u) => (/^L/i.test(String(u || '').trim()) ? 'L' : 'K');

// volume of the screen's Volume box in cbm (MC cubic metres, CC cubic centimetres, CF cubic feet)
export const cbmOf = (vol, mcUnit) => {
  const v = num(vol); const u = String(mcUnit || 'MC').toUpperCase();
  return u === 'CC' ? v / 1e6 : u === 'CF' ? v * 0.028316846592 : v;
};
// cm3 of one dimension line (L x W x H x pieces), CM or INCH
export const dimCm3 = (d) => {
  const L = num(d.length ?? d.len), W = num(d.width ?? d.wid), H = num(d.height ?? d.ht);
  const p = parseInt(d.pkgs ?? d.pcs ?? d.pieces ?? d.noOfUnits, 10) || 1;
  if (!(L > 0 && W > 0 && H > 0)) return 0;
  const inch = /^IN/i.test(String(d.unit || d.cmIn || ''));
  return L * W * H * p * (inch ? 16.387064 : 1);
};
export const volWtFromCm3 = (cm3, group) => cm3 / divisorOf(group);
export const volWtFromCbm = (cbm, group) => (num(cbm) * 1e6) / divisorOf(group);
export const volWtFromDims = (dims, group) => volWtFromCm3((dims || []).reduce((a, d) => a + dimCm3(d), 0), group);
export const cbmFromDims = (dims) => (dims || []).reduce((a, d) => a + dimCm3(d), 0) / 1e6;

export const roundUpHalf = (x) => Math.ceil(num(x) * 2 - 1e-9) / 2;
// chargeable weight in the unit of the gross weight; volumetric weight is always kg
export function chargeableOf(gross, volKg, unit = 'K', round = true) {
  const g = num(gross); const lb = unitKL(unit) === 'L';
  const v = lb ? num(volKg) / KG_PER_LB : num(volKg);
  let c = Math.max(g, v);
  if (!(c > 0)) return 0;
  if (round) c = lb ? Math.ceil(c - 1e-9) : roundUpHalf(c);
  return c;
}
export const fix = (v, d = 2) => (num(v) ? num(v).toFixed(d) : '');

// One rate line after a change of `field`: chargeable weight follows gross / volumetric weight / unit / rounding
// unless the user typed it; total = chargeable x rate. isRounded defaults to on (IATA).
export function recalcRow(row, field) {
  const r = { ...row };
  // 11-Nov-2026: the grid's rate class select changes rateClassCode; rateClass kept the old letter and was what got saved
  if (field === 'rateClassCode') r.rateClass = String(r.rateClassCode || '').trim().toUpperCase().charAt(0);
  r.gwUnit = unitKL(r.gwUnit);
  const rounded = r.isRounded !== false;
  if (field === 'chargeableWeight') {
    r.cwManual = true;
  } else if (['grossWeight', 'volumetricWeight', 'isRounded', 'gwUnit', 'dims'].includes(field) || (!r.cwManual && field !== 'rateCharge' && field !== 'totalAmount' && !num(r.chargeableWeight))) {
    const c = chargeableOf(r.grossWeight, r.volumetricWeight, r.gwUnit, rounded);
    r.chargeableWeight = c ? c.toFixed(2) : '';
    r.cwManual = false;
  }
  if (['rateCharge', 'rateClassCode', 'chargeableWeight', 'grossWeight', 'volumetricWeight', 'isRounded', 'gwUnit', 'dims'].includes(field)) {
    const cw = num(r.chargeableWeight), rate = num(r.rateCharge);
    // M (minimum) / B (basic) charge: the amount is the charge itself, not weight x rate
    if (rate > 0 && /^(M|B)$/i.test(String(r.rateClassCode || r.rateClass || '').charAt(0))) r.totalAmount = rate.toFixed(2);
    else if (cw > 0 && rate > 0) r.totalAmount = (cw * rate).toFixed(2);
  }
  return r;
}
// the volumetric weight (kg) and chargeable weight of the first rate line from a new volumetric weight
export function withVolWt(lines, volKg) {
  const list = Array.isArray(lines) ? [...lines] : [];
  const v = num(volKg) ? +num(volKg).toFixed(2) : '';
  if (!list.length) list.push({ id: 1, noOfPcs: '', grossWeight: '', isRounded: true });
  list[0] = recalcRow({ ...list[0], volumetricWeight: v }, 'volumetricWeight');
  return list;
}
// dimension lines in the goods description: earlier "n PCS-LxWxH" / "VOL WT.:" lines are replaced, not added again
export function goodsWithDims(text, dims, volKg) {
  const keep = String(text || '').split('\n').filter((l) => !/^\s*\d+\s*PCS-[\d.]+X[\d.]+X[\d.]+/i.test(l) && !/^\s*VOL WT\.?:/i.test(l)).join('\n').replace(/\n+$/, '');
  const lines = (dims || []).filter((d) => dimCm3(d) > 0).map((d) => `${d.pkgs ?? d.pcs ?? d.pieces ?? d.noOfUnits} PCS-${num(d.length ?? d.len)}X${num(d.width ?? d.wid)}X${num(d.height ?? d.ht)} ${/^IN/i.test(String(d.unit || d.cmIn || '')) ? 'INCH' : 'CMS'}`);
  if (!lines.length) return keep;
  return [keep, ...lines, `VOL WT.: ${num(volKg).toFixed(2)} KGS`].filter(Boolean).join('\n');
}
