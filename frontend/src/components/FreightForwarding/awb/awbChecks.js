// Save checks shared by the AWB / MAWB / HAWB screens (29-Oct-2026). The server checks the same rules again.
const num = (v) => { if (v === null || v === undefined || String(v).trim() === '') return null; const x = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(x) ? x : NaN; };

export function routeError(origin, destination) {
  const o = String(origin || '').trim().toUpperCase(), d = String(destination || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(o) || !/^[A-Z]{3}$/.test(d)) return 'Origin and Destination must be 3-letter airport codes (letters only).';
  if (o === d) return 'Origin and Destination cannot be the same airport.';
  return null;
}

export function rateLineErrors(rateLines) {
  const errs = [];
  (rateLines || []).filter((r) => r && (r.noOfPcs || r.pieces || r.grossWeight || r.chargeableWeight)).forEach((r, i) => {
    const L = `Rate line ${i + 1}`;
    const pcs = num(r.noOfPcs ?? r.pieces), gw = num(r.grossWeight), cw = num(r.chargeableWeight);
    if (gw > 0 && pcs === null) errs.push(`${L}: No. of pieces is required.`);
    else if (pcs !== null && (Number.isNaN(pcs) || pcs < 1 || !Number.isInteger(pcs))) errs.push(`${L}: No. of pieces must be a whole number (1 or more).`);
    if (Number.isNaN(gw) || gw < 0) errs.push(`${L}: Gross weight must be 0 or more.`);
    if (Number.isNaN(cw) || cw < 0) errs.push(`${L}: Chargeable weight must be 0 or more.`);
    else if (cw > 0 && gw > 0 && cw + 0.001 < gw) errs.push(`${L}: Chargeable weight (${cw}) cannot be less than gross weight (${gw}).`);
  });
  return errs;
}

export function chargeErrors(otherCharges) {
  const errs = [];
  (otherCharges || []).forEach((c, i) => { if (c && c.code) { const a = num(c.amount); if (Number.isNaN(a) || a < 0) errs.push(`Other charge ${c.code} (row ${i + 1}): amount must be 0 or more.`); } });
  return errs;
}
