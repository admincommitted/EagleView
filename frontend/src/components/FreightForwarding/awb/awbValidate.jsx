// VALIDATE EDI for the AWB, MAWB and HAWB screens - one set of rules for all three (29-Oct-2026).
// Before, each screen had its own copy of the same short check and:
// - took the country from the first two letters of the AIRPORT code (DEN Denver = "DE" Germany, ATL = "AT" Austria,
//   SEA = "SE" Sweden, IND Indianapolis = "IN" India), so it asked for an EU EORI / Indian GST on the wrong shipments;
// - stopped a declared value for carriage without a valuation charge (that charge only applies above the airline limit);
// - never looked at the shipper / consignee address, city and country (the XFWB went out with an empty consignee
//   CountryID and the origin airport as the shipper city), agent, routing, flights, rate lines, totals, charges, SPH,
//   OCI rows or the HAWB / master numbers, and said "Validation Passed" for an empty form.
// Now: ERRORS (the airline would reject the message) and WARNINGS (check, but it can go). SEND XFWB / XFZB runs the
// same check and does not send with errors.
import React from 'react';
import { createRoot } from 'react-dom/client';

const s = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const up = (v) => s(v).toUpperCase();
const num = (v) => { const t = s(v).replace(/,/g, ''); if (!t) return null; const x = Number(t); return Number.isFinite(x) ? x : NaN; };
const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const ICS2 = [...EU, 'NO', 'CH']; // EU safety & security pre-loading (ICS2) area
const DG_SPH = ['RCL', 'RCM', 'RCX', 'RDS', 'RFG', 'RFL', 'RFS', 'RFW', 'RGX', 'RIS', 'RMD', 'RNG', 'ROP', 'ROX', 'RPB', 'RPG', 'RRE', 'RRW', 'RRY', 'RSB', 'RSC', 'RXB', 'RXC', 'RXD', 'RXE', 'RXG', 'RXS'];
const LITHIUM_SPH = ['ELI', 'ELM', 'EBI', 'EBM', 'RBI', 'RBM'];
const RATE_CLASSES = ['M', 'N', 'Q', 'B', 'K', 'C', 'R', 'S', 'U', 'E', 'X', 'Y', 'W', 'P'];
// characters the Cargo-IMP / Cargo-XML address fields carry safely
const SAFE = /^[A-Za-z0-9 .,\-/()&'#:+]*$/;

export function awbNoProblem(no, label) {
  const b = s(no).replace(/\D/g, '');
  if (!b) return `${label}: missing.`;
  if (b.length !== 11) return `${label}: must be 11 digits (3-digit airline prefix + 8 digits), now ${b.length}.`;
  const want = Number(b.slice(3, 10)) % 7;
  if (want !== Number(b[10])) return `${label}: check digit is wrong - ${b.slice(0, 3)}-${b.slice(3, 10)}${b[10]} must end in ${want}.`;
  return null;
}

// country of an airport from the airport master (null when not known - never guessed from the code letters)
function airportCountry(ctx, code) {
  const c = up(code);
  const a = (ctx.masterAirports || []).find((x) => up(x.code || x.iataCode) === c);
  const cc = a && up(a.countryCode || a.country);
  return cc && /^[A-Z]{2}$/.test(cc) ? cc : null;
}
export const airportCountryOf = (code, airports) => airportCountry({ masterAirports: airports }, code) || '';
const partyCountry = (p) => { const c = up(p && (p.countryCode || p.country)); return /^[A-Z]{2}$/.test(c) ? c : null; };

export function validateAwbForm(ctx, type) {
  const T = up(type);
  const E = [], W = [];
  const parties = ctx.parties || {};
  const isHouse = T === 'HAWB';

  // ---- numbers ----
  if (isHouse) {
    const h = s(ctx.hawbNumber);
    if (!h) E.push('HAWB number: missing.');
    else if (!/^[A-Za-z0-9]{1,12}$/.test(h)) E.push(`HAWB number "${h}": EDI allows only letters and digits, up to 12 (no spaces, - or /).`);
    const m = awbNoProblem(`${s(ctx.awbPrefix)}${s(ctx.awbSuffix)}`, 'MAWB number');
    if (m) E.push(m);
  } else {
    const m = awbNoProblem(`${s(ctx.awbPrefix)}${s(ctx.awbSuffix)}`, 'AWB number');
    if (m) E.push(m);
  }

  // ---- airports and routing ----
  const org = up(ctx.depAirport), dst = up(ctx.destAirport);
  if (!/^[A-Z]{3}$/.test(org)) E.push('Airport of departure: 3-letter IATA code needed.');
  if (!/^[A-Z]{3}$/.test(dst)) E.push('Airport of destination: 3-letter IATA code needed.');
  if (org && org === dst) E.push('Departure and destination airport are the same.');
  if ((ctx.masterAirports || []).length) {
    for (const [lbl, c] of [['Departure', org], ['Destination', dst]]) if (/^[A-Z]{3}$/.test(c) && !(ctx.masterAirports || []).some((a) => up(a.code || a.iataCode) === c)) W.push(`${lbl} airport ${c} is not in the airport master.`);
  }
  const legs = [[ctx.to1, ctx.by1], [ctx.to2, ctx.by2], [ctx.to3, ctx.by3]].map(([t, b]) => [up(t), up(b)]);
  legs.forEach(([t, b], i) => {
    if (t && !/^[A-Z]{3}$/.test(t)) E.push(`Routing "To" ${i + 1}: 3-letter airport code needed (now "${t}").`);
    if (b && !/^[A-Z0-9]{2}$/.test(b)) E.push(`Routing "By" ${i + 1}: 2-character airline code needed (now "${b}").`);
    if (t && !b) E.push(`Routing ${i + 1}: carrier ("By") missing for ${t}.`);
    if (b && !t) E.push(`Routing ${i + 1}: airport ("To") missing for carrier ${b}.`);
  });
  if (!isHouse && !legs[0][0] && !legs[0][1]) W.push('Routing: first carrier / airport (To / By 1) is empty.');
  // 11-Nov-2026: chargeable / volumetric weight far above the gross weight - usually a slip in the dimensions or volume
  (ctx.rateLines || []).forEach((r, i) => {
    const g = parseFloat(r && r.grossWeight) || 0, cw = parseFloat(r && r.chargeableWeight) || 0, vw = parseFloat(r && r.volumetricWeight) || 0;
    if (g > 0 && Math.max(cw, vw) > g * 30) W.push(`Rate line ${i + 1}: chargeable / volumetric weight ${Math.max(cw, vw)} kg is ${Math.round(Math.max(cw, vw) / g)} times the gross weight ${g} kg - check the dimensions and the Volume box (CBM).`);
  });
  // 11-Nov-2026: the first carrier / first flight should be the airline of the AWB prefix (157 = Qatar Airways = QR)
  {
    const al = (ctx.masterAirlines || []).find((a) => s(a.prefix) === s(ctx.awbPrefix));
    const code = up(al && al.code2);
    if (code) {
      const what = isHouse ? 'MAWB' : 'AWB';
      if (legs[0][1] && legs[0][1] !== code) W.push(`First carrier ${legs[0][1]} is not the airline of the ${what} number - ${s(ctx.awbPrefix)} is ${al.name} (${code}). Check the prefix or the carrier.`);
      const f1 = up(ctx.flightNumber1).replace(/\s+/g, '');
      const fc = /^[A-Z0-9]{2}\d/.test(f1) ? f1.slice(0, 2) : '';
      if (fc && fc !== code && fc !== legs[0][1]) W.push(`First flight ${f1} is not a flight of ${legs[0][1] || code} - check the flight number.`);
    }
  }
  const lastTo = [...legs].reverse().find(([t]) => t);
  // 11-Nov-2026: these were warnings and the AWB could be sent with a wrong routing
  if (!isHouse && legs[0][0] && org && legs[0][0] === org) E.push(`Routing: first "To" ${legs[0][0]} is the airport of departure - give the next airport (the destination for a direct flight).`);
  if (lastTo && dst && lastTo[0] !== dst) (isHouse ? W : E).push(`Routing ends at ${lastTo[0]} but the destination is ${dst}.`);
  if (legs[1][0] && !legs[0][0]) E.push('Routing: To 2 is filled but To 1 is empty.');
  if (legs[2][0] && !legs[1][0]) E.push('Routing: To 3 is filled but To 2 is empty.');

  // ---- flights ----
  const flights = [[ctx.flightNumber1, ctx.flightDate1], [ctx.flightNumber2, ctx.flightDate2]];
  flights.forEach(([f, d], i) => {
    const F = up(f).replace(/\s+/g, '');
    if (F && !/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(F)) E.push(`Flight ${i + 1} "${f}": airline code + 1-4 digit number (e.g. AI101).`);
    if (F && !s(d)) E.push(`Flight ${i + 1} ${F}: flight date missing.`);
    if (s(d) && isNaN(Date.parse(String(d).slice(0, 10)))) E.push(`Flight ${i + 1}: date "${d}" is not a valid date.`);
  });
  if (!isHouse && !s(ctx.flightNumber1)) W.push('No flight booked (Flight 1 is empty).');
  if (s(ctx.flightDate1) && s(ctx.flightDate2) && String(ctx.flightDate2).slice(0, 10) < String(ctx.flightDate1).slice(0, 10)) E.push('Flight 2 date is before Flight 1 date.');
  if (s(ctx.flightNumber1) && /^[A-Z0-9]{2}$/.test(legs[0][1])) {
    const fc = up(ctx.flightNumber1).replace(/\s+/g, '').slice(0, 2);
    if (/^[A-Z0-9]{2}$/.test(fc) && fc !== legs[0][1]) W.push(`Flight 1 ${up(ctx.flightNumber1)} is not on the first carrier ${legs[0][1]}.`);
  }

  // ---- parties ----
  for (const [title, need] of [['Shipper', true], ['Consignee', true]]) {
    const p = parties[title] || {};
    const L = title;
    if (!s(p.name)) { if (need) E.push(`${L}: name missing.`); continue; }
    if (s(p.name).length > 35) W.push(`${L} name is ${s(p.name).length} characters - EDI keeps the first 35.`);
    if (!s(p.street || p.address)) E.push(`${L}: street address missing.`);
    else if (s(p.street || p.address).length > 35) W.push(`${L} address is longer than 35 characters - EDI keeps the first 35 (put the rest in the next line).`);
    if (!s(p.city)) E.push(`${L}: city missing.`);
    else if (s(p.city).length > 17) W.push(`${L} city "${s(p.city)}" is longer than 17 characters - EDI cuts it.`);
    if (!s(p.country)) E.push(`${L}: country missing.`);
    else if (!partyCountry(p)) E.push(`${L}: country must be the 2-letter ISO code (e.g. IN, AE), now "${s(p.country)}".`);
    for (const k of ['name', 'street', 'city', 'state', 'zip']) if (s(p[k]) && !SAFE.test(s(p[k]))) { W.push(`${L} ${k} has characters EDI cannot carry (accents / symbols) - they may be dropped.`); break; }
    if (s(p.zip) && s(p.zip).length > 9) W.push(`${L} postal code is longer than 9 characters - EDI cuts it.`);
    if (!s(p.phone) && !s(p.email)) W.push(`${L}: no phone or e-mail (many airlines / customs ask for a contact).`);
  }

  // ---- agent (AWB / MAWB) ----
  if (!isHouse) {
    const a = ctx.agentDetails || {};
    if (!s(a.name)) E.push('Issuing carrier\'s agent: name missing.');
    const code = s(a.code).replace(/[\s/-]/g, '');
    if (!code) W.push('Agent IATA code missing.');
    else if (!/^\d{7}(\d{4})?$/.test(code)) W.push(`Agent IATA code "${s(a.code)}": normally 7 digits (+ 4-digit CASS branch).`);
  }

  // ---- currency, charge codes, declared values ----
  const cur = up(ctx.currencyCode);
  if (!/^[A-Z]{3}$/.test(cur)) E.push('Currency: 3-letter ISO code needed (e.g. INR, USD).');
  if (s(ctx.destinationCurrency) && !/^[A-Z]{3}$/.test(up(ctx.destinationCurrency))) E.push('Destination currency: 3-letter ISO code needed.');
  const cc = up(ctx.chargeCode);
  if (cc && !['PP', 'CC', 'PC', 'CP', 'PX', 'CX'].includes(cc)) W.push(`Charge code "${cc}" is unusual (PP or CC expected).`);
  const wv = up(ctx.wtValPC), ot = up(ctx.otherPC);
  if (wv && !['P', 'C'].includes(wv)) E.push('WT/VAL: must be P (prepaid) or C (collect).');
  if (ot && !['P', 'C'].includes(ot)) E.push('Other charges: must be P (prepaid) or C (collect).');
  if (cc === 'PP' && (wv === 'C' || ot === 'C')) W.push('Charge code PP but WT/VAL or Other is marked Collect.');
  if (cc === 'CC' && (wv === 'P' || ot === 'P')) W.push('Charge code CC but WT/VAL or Other is marked Prepaid.');
  const dvc = up(ctx.carriageValue), dvcu = up(ctx.customsValue), ins = up(ctx.insuranceValue);
  if (dvc && dvc !== 'NVD' && Number.isNaN(num(dvc))) E.push(`Declared value for carriage "${ctx.carriageValue}": NVD or an amount.`);
  if (dvcu && dvcu !== 'NCV' && Number.isNaN(num(dvcu))) E.push(`Declared value for customs "${ctx.customsValue}": NCV or an amount.`);
  if (ins && ins !== 'XXX' && ins !== 'NIL' && Number.isNaN(num(ins))) E.push(`Amount of insurance "${ctx.insuranceValue}": XXX or an amount.`);
  if (num(dvc) > 0 && !(num(ctx.valChargePP) > 0 || num(ctx.valChargeCC) > 0)) W.push('Declared value for carriage is given but there is no valuation charge - check with the airline if it is above their liability limit.');
  if (cur && ctx.destinationCurrency && up(ctx.destinationCurrency) !== cur && cc.startsWith('C') && !(num(ctx.ccChargesDest) > 0)) W.push('Collect AWB in another destination currency: CC charges in destination currency are empty.');

  // ---- rate lines ----
  const lines = (ctx.rateLines || []).filter((r) => r && (s(r.noOfPcs ?? r.pieces) || s(r.grossWeight) || s(r.chargeableWeight) || s(r.rateCharge) || s(r.goodsDescription)));
  if (!lines.length) E.push('Rate lines: no line with pieces and weight.');
  let pcsSum = 0, gwSum = 0, totSum = 0;
  lines.forEach((r, i) => {
    const L = `Rate line ${i + 1}`;
    const pcs = num(r.noOfPcs ?? r.pieces), gw = num(r.grossWeight), cw = num(r.chargeableWeight), rate = num(r.rateCharge), tot = num(r.totalAmount ?? r.total);
    const rc = up(r.rateClassCode || r.rateClass).charAt(0);
    if (pcs === null || Number.isNaN(pcs) || pcs < 1 || !Number.isInteger(pcs)) E.push(`${L}: pieces must be a whole number, 1 or more.`);
    if (gw === null || Number.isNaN(gw) || gw <= 0) E.push(`${L}: gross weight must be more than 0.`);
    if (cw !== null && !Number.isNaN(cw) && gw > 0 && cw + 0.001 < gw) E.push(`${L}: chargeable weight ${cw} is less than gross weight ${gw}.`);
    if (cw === null || !(cw > 0)) W.push(`${L}: chargeable weight is empty.`);
    // 11-Nov-2026: IATA chargeable weight is in 0.5 kg steps (whole lb). 5470.52 went in the XFWB as 5470.5 while the
    // amount stayed 5470.52 x rate, so weight x rate did not match the amount.
    else if (!Number.isNaN(cw)) {
      const lb = /^L/i.test(s(r.gwUnit));
      const step = lb ? 1 : 0.5;
      if (Math.abs(cw / step - Math.round(cw / step)) > 1e-6) E.push(`${L}: chargeable weight ${cw} is not in ${lb ? 'whole lb' : '0.5 kg steps'} - tick ROUND 0.5 (or type ${(Math.ceil(cw / step - 1e-9) * step).toFixed(1)}).`);
    }
    if (!isHouse) {
      if (!rc) E.push(`${L}: rate class missing (M, N, Q, C, R, S ...).`);
      else if (!RATE_CLASSES.includes(rc)) E.push(`${L}: rate class "${r.rateClassCode}" is not an IATA rate class.`);
      if (rc === 'C' && !/^\d{4}$/.test(s(r.commodityItemNumber || r.commodityItemNo))) E.push(`${L}: class C needs the 4-digit commodity item number.`);
      if ((rc === 'R' || rc === 'S') && !(num(r.rateClassPercentage || r.rcp) > 0)) W.push(`${L}: class ${rc} normally has a % of the normal rate.`);
      if (rate === null && !r.rateAsAgreed) W.push(`${L}: rate / charge is empty (or tick "As Agreed").`);
      if (Number.isNaN(rate) || rate < 0) E.push(`${L}: rate must be 0 or more.`);
      if (rate > 0 && tot !== null && !Number.isNaN(tot)) {
        const want = (rc === 'M' || rc === 'B') ? rate : (cw > 0 ? cw * rate : null);
        if (want !== null && Math.abs(want - tot) > 1) W.push(`${L}: total ${tot.toFixed(2)} does not match ${rc === 'M' || rc === 'B' ? 'the minimum charge' : `${cw} x ${rate}`} = ${want.toFixed(2)}.`);
      }
    }
    if (!s(r.goodsDescription) && !s(ctx.natureOfGoods)) E.push(`${L}: nature and quantity of goods missing.`);
    const hs = s(r.harmonisedCode || r.hsCode).replace(/\D/g, '');
    if (s(r.harmonisedCode || r.hsCode) && (hs.length < 6 || hs.length > 10)) W.push(`${L}: HS code "${s(r.harmonisedCode || r.hsCode)}" should be 6 to 10 digits.`);
    if (pcs > 0) pcsSum += pcs; if (gw > 0) gwSum += gw; if (tot > 0) totSum += tot;
  });
  if (s(ctx.natureOfGoods).length > 0 && s(ctx.natureOfGoods).split('\n').some((l) => l.length > 70)) W.push('Nature of goods: a line is longer than 70 characters - EDI may cut it.');
  if (!(T === 'MAWB' && /^CONSOL/i.test(s(ctx.natureOfGoods))) && /^(GENERAL CARGO|CONSOLIDATION|CONSOL|GOODS|SAID TO CONTAIN|STC|MISC|PARTS|SAMPLES?|GIFTS?)$/i.test(s(ctx.natureOfGoods || (lines[0] || {}).goodsDescription).split('\n')[0])) W.push('Nature of goods is too general for customs / ICS2 - give a real description of the goods.');

  // weight charge = sum of rate lines
  // 11-Nov-2026: no volume and no dimensions - the FWB went without a volume, and many airlines ask for it
  if (!isHouse && lines.length) { // (the NO DIMENSIONS tick is set by itself on MAWB / HAWB and is not sent, so it is not a reason)
    const n0 = (v) => { const x = num(v); return x !== null && !Number.isNaN(x) && x > 0; };
    const hasVol = n0(ctx.volume) || lines.some((r) => n0(r.volume) || n0(r.volumetricWeight) || (Array.isArray(r.dimensions) && r.dimensions.some((d) => n0(d.length)))) || (ctx.dimRows || []).some((d) => n0(d.length) || n0(d.volume));
    if (!hasVol) W.push('No volume or dimensions - the FWB goes without a volume, and many airlines ask for it (CBM). Fill the Volume box or the dimensions.');
  }
  if (!isHouse && totSum > 0) {
    const wc = (num(ctx.weightChargePP) || 0) + (num(ctx.weightChargeCC) || 0);
    if (wc > 0 && Math.abs(wc - totSum) > 1) W.push(`Weight charge ${wc.toFixed(2)} is not the total of the rate lines (${totSum.toFixed(2)}).`);
    if (!(wc > 0)) W.push('Weight charge (PP / CC) is empty - use auto calculate.');
  }

  // ---- other charges ----
  (ctx.otherCharges || []).forEach((c, i) => {
    if (!c || (!s(c.code) && !s(c.amount))) return;
    const L = `Other charge row ${i + 1}`;
    const code = up(c.code);
    if (!code) E.push(`${L}: charge code missing.`);
    else if (!/^[A-Z]{2}[AC]?$/.test(code)) E.push(`${L}: code "${c.code}" must be 2 letters (e.g. MY, SC, AW).`);
    const a = num(c.amount);
    if (a === null || Number.isNaN(a) || a < 0) E.push(`${L} ${code}: amount must be 0 or more.`);
    else if (a === 0) W.push(`${L} ${code}: amount is 0.`);
    if (!/^(agent|carrier|A|C)$/i.test(s(c.entitlement))) E.push(`${L} ${code}: due Agent or due Carrier not chosen.`);
  });
  { const seen = {}; (ctx.otherCharges || []).forEach((c) => { const k = up(c && c.code) + '/' + s(c && c.entitlement).toLowerCase(); if (c && c.code) { if (seen[k]) W.push(`Other charge ${up(c.code)} is entered twice.`); seen[k] = 1; } }); }

  // ---- special handling ----
  const sph = (ctx.sphCodes || []).map(up).filter(Boolean);
  sph.forEach((c) => { if (!/^[A-Z0-9]{3}$/.test(c)) E.push(`SPH code "${c}" must be 3 characters.`); });
  if (new Set(sph).size !== sph.length) W.push('A special handling code is entered twice.');
  if ((ctx.masterSph || []).length) {
    const known = new Set((ctx.masterSph || []).map((x) => up(x.code || x.shc || x)));
    sph.filter((c) => /^[A-Z0-9]{3}$/.test(c) && !known.has(c)).forEach((c) => W.push(`SPH code ${c} is not in the special handling master.`));
  }
  const docs = ctx.extraDocs || {};
  if (sph.some((c) => DG_SPH.includes(c)) && !docs.DGD) W.push('Dangerous goods SPH code but no DG declaration (DOCUMENTS > DGD FORM).');
  if (sph.includes('AVI') && !docs.AVI) W.push('AVI (live animals) but no live animal certificate (DOCUMENTS > AVI CERT).');
  if (sph.some((c) => LITHIUM_SPH.includes(c)) && !docs.LITHIUM) W.push('Lithium battery SPH code but no lithium battery declaration (DOCUMENTS > LITHIUM BATT.).');
  if (s(ctx.ssrText).split('\n').some((l) => l.length > 65)) W.push('SSR: a line is longer than 65 characters - EDI cuts it.');
  if (s(ctx.ssrText).split('\n').filter((l) => s(l)).length > 3) W.push('SSR: more than 3 lines - EDI sends 3.');
  if (s(ctx.osiText).split('\n').some((l) => l.length > 65)) W.push('OSI: a line is longer than 65 characters - EDI cuts it.');
  if (s(ctx.sci) && !/^[A-Z0-9]{1,2}$/.test(up(ctx.sci))) E.push(`SCI "${ctx.sci}": 1-2 characters (e.g. X, T1).`);

  // ---- OCI rows ----
  (ctx.ociRows || []).forEach((r, i) => {
    if (!r || (!s(r.infoId) && !s(r.suppInfo))) return; // empty / country-only row: not sent
    const L = `OCI row ${i + 1}`;
    if (!s(r.suppInfo)) { W.push(`${L} (${up(r.infoId)}): no information typed - the row is left out of the EDI.`); return; }
    if (s(r.countryCode) && !/^[A-Z]{2}$/.test(up(r.countryCode))) E.push(`${L}: country must be 2 letters.`);
    if (!/^[A-Z]{3}$/.test(up(r.infoId))) E.push(`${L}: information ID must be 3 letters (SHP, CNE, AGT, ISS ...).`);
    if (s(r.customsId) && !/^[A-Z0-9]{1,2}$/.test(up(r.customsId))) E.push(`${L}: customs ID must be 1-2 characters (T, E, M ...).`);
    if (s(r.suppInfo).length > 35) E.push(`${L}: information is longer than 35 characters.`);
  });

  // ---- country rules (country from the party, else the airport master - never from the airport letters) ----
  const cneC = partyCountry(parties.Consignee) || airportCountry(ctx, dst);
  const shpC = partyCountry(parties.Shipper) || airportCountry(ctx, org);
  const oci = ctx.ociRows || [];
  if (cneC && (ICS2.includes(cneC) || cneC === 'GB')) {
    if (!oci.some((r) => up(r.infoId) === 'CNE' && up(r.customsId) === 'E' && s(r.suppInfo))) W.push(`Destination ${cneC}: consignee EORI number is not in the OCI rows (CNE / E) - often asked for by EU / UK customs.`);
    if (ICS2.includes(cneC) && !lines.some((r) => s(r.harmonisedCode || r.hsCode).replace(/\D/g, '').length >= 6)) W.push(`Destination ${cneC} (EU ICS2): give the 6-digit HS code of the goods on the rate line.`);
  }
  if (shpC === 'IN' && !oci.some((r) => up(r.infoId) === 'SHP' && up(r.customsId) === 'T' && s(r.suppInfo))) W.push('Origin India: shipper GSTIN / IEC is not in the OCI rows (SHP / T).');
  if (cneC === 'US' && !s((parties.Consignee || {}).zip)) W.push('Destination US: consignee ZIP code is empty.');

  // ---- execution ----
  if (!isHouse) {
    if (!s(ctx.executedDate)) E.push('Executed on (date) missing.');
    else if (isNaN(Date.parse(String(ctx.executedDate).slice(0, 10)))) E.push(`Executed on "${ctx.executedDate}" is not a valid date.`);
    else {
      const ex = String(ctx.executedDate).slice(0, 10), today = new Date().toISOString().slice(0, 10);
      if (ex > today) W.push(`Executed on ${ex} is in the future.`);
      if (s(ctx.flightDate1) && String(ctx.flightDate1).slice(0, 10) < ex) W.push('Flight 1 date is before the executed date.');
    }
    if (!s(ctx.executedPlace)) E.push('Executed at (place) missing.');
    if (!s(ctx.signatureShipper)) W.push('Signature of shipper / agent is empty.');
    if (!s(ctx.signatureCarrier)) W.push('Signature of issuing carrier / agent is empty.');
  }

  // ---- master: linked houses ----
  if (T === 'MAWB' && Array.isArray(ctx.linkedHawbs) && ctx.linkedHawbs.length) {
    const hp = ctx.linkedHawbs.reduce((a, h) => a + (Number(h.pcs) || 0), 0), hw = ctx.linkedHawbs.reduce((a, h) => a + (Number(h.wt) || 0), 0);
    if (pcsSum && hp > pcsSum) E.push(`Linked HAWBs have ${hp} pieces, more than the master's ${pcsSum}.`);
    if (gwSum && hw > gwSum + 0.5) E.push(`Linked HAWBs weigh ${hw.toFixed(1)} kg, more than the master's ${gwSum.toFixed(1)} kg.`);
    if (pcsSum && hp && hp < pcsSum) W.push(`Linked HAWBs have ${hp} of the master's ${pcsSum} pieces.`);
  }
  if (T === 'MAWB' && /^CONSOL/i.test(s(ctx.natureOfGoods)) && !(ctx.linkedHawbs || []).length) W.push('Nature of goods says consolidation but no HAWB is linked.');

  return { errors: [...new Set(E)], warnings: [...new Set(W)] };
}

// result window (scrolls; errors and warnings apart). Rendered on <body> so it works on all three screens.
function EdiCheckWindow({ res, title, onClose, onGo, goLabel }) {
  const box = { margin: '0 0 10px', paddingLeft: '18px', fontSize: '12px', lineHeight: 1.5 };
  const ok = !res.errors.length;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2147483000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-label={title} style={{ background: '#fff', borderRadius: '6px', width: '620px', maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', gap: '8px', background: ok ? (res.warnings.length ? '#fffbeb' : '#f0fdf4') : '#fff1f2' }}>
          <strong style={{ fontSize: '13px', color: ok ? (res.warnings.length ? '#92400e' : '#166534') : '#9f1239' }}>{title}</strong>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#475569' }}>{res.errors.length} error(s), {res.warnings.length} warning(s)</span>
        </div>
        <div style={{ padding: '12px 14px', overflowY: 'auto', color: '#1e293b' }}>
          {ok && !res.warnings.length && <p style={{ margin: 0, fontSize: '12px' }}>No problems found - ready for FWB / FHL.</p>}
          {res.errors.length > 0 && (<><div style={{ fontWeight: 'bold', fontSize: '12px', color: '#b91c1c', marginBottom: '4px' }}>Errors - fix these, the airline would reject the message</div>
            <ul style={box}>{res.errors.map((m, i) => <li key={i}>{m}</li>)}</ul></>)}
          {res.warnings.length > 0 && (<><div style={{ fontWeight: 'bold', fontSize: '12px', color: '#b45309', marginBottom: '4px' }}>Warnings - please check</div>
            <ul style={box}>{res.warnings.map((m, i) => <li key={i}>{m}</li>)}</ul></>)}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {onGo && <button type="button" onClick={onGo} style={{ padding: '6px 14px', background: '#b45309', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>{goLabel}</button>}
          <button type="button" onClick={onClose} style={{ padding: '6px 18px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}>{onGo ? 'CANCEL' : 'OK'}</button>
        </div>
      </div>
    </div>
  );
}

// show the result; with goLabel the window asks "send anyway?" and resolves true / false
export function showEdiCheck(res, { title = 'EDI CHECK', goLabel } = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-edi-check', '');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v) => { root.unmount(); host.remove(); resolve(v); };
    root.render(<EdiCheckWindow res={res} title={title} onClose={() => done(false)} onGo={goLabel ? () => done(true) : null} goLabel={goLabel} />);
  });
}

// VALIDATE EDI button
export function runEdiValidation(ctx, type) {
  const res = validateAwbForm(ctx, type);
  showEdiCheck(res, { title: `VALIDATE EDI - ${type}` });
  return res;
}

// before SEND: false = do not send (errors, or warnings and the user cancelled)
export async function ediOkToSend(ctx, type, kind) {
  const res = validateAwbForm(ctx, type);
  if (res.errors.length) { await showEdiCheck(res, { title: `${kind} NOT SENT - fix the errors` }); return false; }
  if (res.warnings.length) return showEdiCheck(res, { title: `SEND ${kind}?`, goLabel: `SEND ${kind} ANYWAY` });
  return true;
}
