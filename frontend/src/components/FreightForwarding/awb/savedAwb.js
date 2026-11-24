import { volWtFromDims, dimCm3, divisorOf } from './weightCalc';
// Turning a saved AWB / MAWB / HAWB (GET /api/awb/search/:no) back into screen state. Shared by the three forms
// (29-Oct-2026). Before, each form rebuilt the parties with only 8 fields and preferred the shortened address
// columns, read declared values / accounting info under names that do not exist, mixed CBM volume with volumetric
// weight on rate lines and did not map the Dimension window fields, so data was lost on the next save.
const s = (v) => (v === null || v === undefined ? '' : String(v));

// full party: the copy kept in formData (full address, GSTIN, IEC, ids...) with the columns as fallback
export function partyFromSaved(awb, key, prefix) {
  const fd = (awb && awb.formData) || {};
  const p = fd[key] && typeof fd[key] === 'object' ? fd[key] : {};
  if (!prefix) return Object.keys(p).length ? { ...p, email: s(p.email) } : null;
  const col = (c) => s(awb[prefix + c]);
  const out = {
    ...p,
    name: s(p.name) || col('Name'), street: s(p.street) || col('Address'), city: s(p.city) || col('City'), state: s(p.state) || col('State'),
    country: s(p.country) || col('Country'), zip: s(p.zip) || col('Zip'), phone: s(p.phone) || col('Phone'), email: s(p.email) || s(fd[key + 'Email']) || col('Email'),
  };
  return out.name || out.street ? out : null;
}

// every party block of the form, ready for setParties
export function partiesFromSaved(awb) {
  const map = { Shipper: ['shipper', 'shipper'], Consignee: ['consignee', 'consignee'], Buyer: ['buyer', 'buyer'], 'Sub Agent': ['subAgent'], 'Overseas Agent': ['overseasAgent'], 'Notify 1': ['notify1'], 'Notify 2': ['notify2'] };
  const out = {};
  for (const [title, [key, prefix]] of Object.entries(map)) { const p = partyFromSaved(awb, key, prefix); if (p) out[title] = p; }
  return out;
}

export const datePart = (v) => { const t = s(v); return t.includes('T') ? t.split('T')[0] : t; };
export const timePart = (v) => { const t = s(v); if (!t.includes('T')) return ''; const hm = t.split('T')[1].substring(0, 5); return hm === '00:00' ? '' : hm; };

// dimension rows as the Dimension window keeps them (length / width / height / pkgs / unit / volWt)
export function dimsFromSaved(rows) {
  return (rows || []).map(d => {
    const unit = s(d.cmIn).toUpperCase().startsWith('IN') ? 'INH' : 'CMT';
    const pcs = parseInt(d.pieces, 10) || 0;
    const L = parseFloat(d.length) || 0, W = parseFloat(d.width) || 0, H = parseFloat(d.height) || 0;
    const volWt = parseFloat(d.volumetricWeight) || +volWtFromDims([{ length: L, width: W, height: H, pieces: pcs || 1, unit }]).toFixed(2); // IATA 6000 cm3/kg (weightCalc)
    return { ...d, id: d.id || Math.random(), length: L, width: W, height: H, pkgs: pcs, pcs, pieces: pcs, unit, cmIn: unit === 'INH' ? 'IN' : 'CM', volWt, volume: parseFloat(d.volume) || 0 };
  });
}
// total CBM of dimension rows (from the saved volume, else from L x W x H x pieces)
export function dimsCbm(dims) {
  return (dims || []).reduce((sum, d) => {
    const v = parseFloat(d.volume ?? d.vol);
    if (v) return sum + v;
    const L = parseFloat(d.length ?? d.len) || 0, W = parseFloat(d.width ?? d.wid) || 0, H = parseFloat(d.height ?? d.ht) || 0;
    const p = parseInt(d.pkgs ?? d.pcs ?? d.pieces, 10) || 1;
    const inch = s(d.unit || d.cmIn).toUpperCase().startsWith('IN');
    return sum + (L * W * H * p * (inch ? 16.387064 : 1)) / 1e6;
  }, 0);
}

// 13-Nov-2026: lines saved before 29-Oct-2026 kept the volumetric weight in the volume column and no volumetric weight
// (AWB of 14-Sep: 222 x 333 x 444 cm -> volume "5470.52", volumetric weight empty). The grid then showed the saved
// chargeable weight 5470.52 but any change (the ROUND box) worked it out again from gross weight alone - 300 - and the
// Volume box got 5470.52 CBM. Such a line gets its volumetric weight and CBM again from its dimensions.
function oldLineWeights(r, dims, group) {
  if ((parseFloat(r.volumetricWeight) || 0) > 0) return null;
  const unit = s(r.cmIn).toUpperCase().startsWith('IN') ? 'INCH' : 'CM';
  const list = (Array.isArray(dims) && dims.length ? dims : [{ length: r.length, width: r.width, height: r.height, noOfUnits: r.noOfUnits }])
    .map(d => ({ ...d, unit: d.unit || unit }));
  const cm3 = list.reduce((a, d) => a + dimCm3(d), 0);
  if (!(cm3 > 0)) return null;
  const vw = cm3 / divisorOf(group), cbm = cm3 / 1e6, vol = parseFloat(r.volume) || 0;
  // the volume column is kept when it is a real CBM figure; the old weight-in-volume (or nothing) becomes the CBM
  const volOk = vol > 0 && Math.abs(vol - vw) > 0.05 && vol < cbm * 10;
  return { volumetricWeight: vw.toFixed(2), volume: volOk ? s(r.volume) : cbm.toFixed(3) };
}

// rate lines in the shape the Rate Line window / grid use
export function rateLinesFromSaved(rows, densityGroup) {
  return (rows || []).map(r => {
    let dims = [];
    try { dims = r.dimensions ? (typeof r.dimensions === 'string' ? JSON.parse(r.dimensions) : r.dimensions) : []; } catch (e) { dims = []; }
    const fixOld = oldLineWeights(r, dims, densityGroup);
    return {
      ...r,
      noOfPcs: s(r.pieces || r.noOfPcs), pieces: s(r.pieces || r.noOfPcs),
      totalAmount: s(r.total || r.totalAmount), total: s(r.total || r.totalAmount),
      // the letter only: old lines hold "N - NORMAL RATE", which matched no option and showed as Q (11-Nov-2026)
      rateClass: /^SELECT/i.test(s(r.rateClass).trim()) ? '' : s(r.rateClass).trim().toUpperCase().charAt(0), rateClassCode: /^SELECT/i.test(s(r.rateClass).trim()) ? '' : s(r.rateClass).trim().toUpperCase().charAt(0), // an empty class shows as "-", not as Q (11-Nov-2026)
      commodityItemNumber: s(r.commodityItemNo || r.commodityItemNumber), commodityItemNo: s(r.commodityItemNo || r.commodityItemNumber),
      goodsDescription: s(r.natureOfGoods || r.goodsDescription), natureOfGoods: s(r.natureOfGoods || r.goodsDescription),
      volume: fixOld ? fixOld.volume : s(r.volume), volumetricWeight: fixOld ? fixOld.volumetricWeight : s(r.volumetricWeight), cwUnit: s(r.cwUnit),
      dimensions: Array.isArray(dims) ? dims : [],
    };
  });
}

export const sphFromSaved = (rows) => { const out = ['', '', '', '', '', '', '', '', '']; (rows || []).forEach((x, i) => { if (i < 9) out[i] = x.code; }); return out; };
export const chargesFromSaved = (rows) => (rows || []).map(c => ({ ...c, code: c.chargeCode || c.code || '', entitlement: c.entitlement || 'carrier', ppcc: c.ppcc || 'PP', description: c.description || '' }));

export const emptyParties = () => ({ 'Shipper': {}, 'Consignee': {}, 'Buyer': {}, 'Sub Agent': {}, 'Overseas Agent': {}, 'Notify 1': {}, 'Notify 2': {} });
export const emptyCharges = () => [1, 2, 3, 4, 5].map(id => ({ id, code: '', entitlement: id === 2 ? 'agent' : 'carrier', ppcc: 'PP', description: '', amount: '' }));
export const emptyOci = () => [{ id: 1, countryCode: '', infoId: '', customsId: '', suppInfo: '' }];

// child rows and parties of the opened AWB; a list the AWB does not have is cleared (before, the rows of the AWB
// opened earlier stayed on screen and were saved into this one)
export function applySavedRows(awb, set) {
  set.setRateLines(rateLinesFromSaved(awb.AwbRateLines, awb.densityGroup || (awb.formData || {}).densityGroup));
  set.setOtherCharges(awb.AwbOtherCharges && awb.AwbOtherCharges.length ? chargesFromSaved(awb.AwbOtherCharges) : emptyCharges());
  set.setOciRows(awb.AwbOcis && awb.AwbOcis.length ? awb.AwbOcis : emptyOci());
  set.setSphCodes(sphFromSaved(awb.SpecialHandlingCodes));
  const dims = dimsFromSaved(awb.AwbDimensions);
  set.setDimRows(dims);
  const fd = awb.formData || {};
  const cbm = dimsCbm(dims);
  if (set.setVolume) set.setVolume(cbm > 0 ? cbm.toFixed(3) : (fd.volume || ''));
  set.setParties({ ...emptyParties(), ...partiesFromSaved(awb) });
}
