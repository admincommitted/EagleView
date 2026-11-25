// VALIDATE EDI for the AWB, MAWB and HAWB screens - one set of rules for all three.
// ERRORS (the airline would reject the message) and WARNINGS (check, but it can go). SEND XFWB / XFZB runs the
// same check and does not send with errors. Countries come from the party or the airport master, never from the
// letters of the airport code (DEN Denver is not "DE" Germany).
import { createRoot } from 'react-dom/client';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';

const text = (value) => (value === null || value === undefined ? '' : String(value)).trim();
const upper = (value) => text(value).toUpperCase();
const numberOrBlank = (value) => {
  const cleaned = text(value).replace(/,/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
};
const isPositive = (value) => {
  const parsed = numberOrBlank(value);
  return parsed !== null && !Number.isNaN(parsed) && parsed > 0;
};

const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const ICS2 = [...EU, 'NO', 'CH']; // EU safety & security pre-loading (ICS2) area
const DG_SPH = ['RCL', 'RCM', 'RCX', 'RDS', 'RFG', 'RFL', 'RFS', 'RFW', 'RGX', 'RIS', 'RMD', 'RNG', 'ROP', 'ROX', 'RPB', 'RPG', 'RRE', 'RRW', 'RRY', 'RSB', 'RSC', 'RXB', 'RXC', 'RXD', 'RXE', 'RXG', 'RXS'];
const LITHIUM_SPH = ['ELI', 'ELM', 'EBI', 'EBM', 'RBI', 'RBM'];
const RATE_CLASSES = ['M', 'N', 'Q', 'B', 'K', 'C', 'R', 'S', 'U', 'E', 'X', 'Y', 'W', 'P'];
// characters the Cargo-IMP / Cargo-XML address fields carry safely
const EDI_SAFE = /^[A-Za-z0-9 .,\-/()&'#:+]*$/;
const GENERAL_GOODS = /^(GENERAL CARGO|CONSOLIDATION|CONSOL|GOODS|SAID TO CONTAIN|STC|MISC|PARTS|SAMPLES?|GIFTS?)$/i;

export function awbNoProblem(awbNumber, label) {
  const digits = text(awbNumber).replace(/\D/g, '');
  if (!digits) return `${label}: missing.`;
  if (digits.length !== 11) return `${label}: must be 11 digits (3-digit airline prefix + 8 digits), now ${digits.length}.`;
  const checkDigit = Number(digits.slice(3, 10)) % 7;
  if (checkDigit !== Number(digits[10])) return `${label}: check digit is wrong - ${digits.slice(0, 3)}-${digits.slice(3, 10)}${digits[10]} must end in ${checkDigit}.`;
  return null;
}

// country of an airport from the airport master (null when not known - never guessed from the code letters)
function airportCountry(ctx, code) {
  const airportCode = upper(code);
  const airport = (ctx.masterAirports || []).find((candidate) => upper(candidate.code || candidate.iataCode) === airportCode);
  const country = airport && upper(airport.countryCode || airport.country);
  return country && /^[A-Z]{2}$/.test(country) ? country : null;
}
export const airportCountryOf = (code, airports) => airportCountry({ masterAirports: airports }, code) || '';
const partyCountry = (party) => {
  const country = upper(party && (party.countryCode || party.country));
  return /^[A-Z]{2}$/.test(country) ? country : null;
};

function checkNumbers(ctx, isHouse, errors) {
  const awbNumber = `${text(ctx.awbPrefix)}${text(ctx.awbSuffix)}`;
  if (isHouse) {
    const hawbNumber = text(ctx.hawbNumber);
    if (!hawbNumber) errors.push('HAWB number: missing.');
    else if (!/^[A-Za-z0-9]{1,12}$/.test(hawbNumber)) errors.push(`HAWB number "${hawbNumber}": EDI allows only letters and digits, up to 12 (no spaces, - or /).`);
  }
  const problem = awbNoProblem(awbNumber, isHouse ? 'MAWB number' : 'AWB number');
  if (problem) errors.push(problem);
}

function checkRouting(ctx, isHouse, legs, errors, warnings) {
  const origin = upper(ctx.depAirport);
  const destination = upper(ctx.destAirport);
  if (!/^[A-Z]{3}$/.test(origin)) errors.push('Airport of departure: 3-letter IATA code needed.');
  if (!/^[A-Z]{3}$/.test(destination)) errors.push('Airport of destination: 3-letter IATA code needed.');
  if (origin && origin === destination) errors.push('Departure and destination airport are the same.');
  const airports = ctx.masterAirports || [];
  if (airports.length) {
    for (const [label, code] of [['Departure', origin], ['Destination', destination]]) {
      if (/^[A-Z]{3}$/.test(code) && !airports.some((airport) => upper(airport.code || airport.iataCode) === code)) warnings.push(`${label} airport ${code} is not in the airport master.`);
    }
  }
  legs.forEach(([to, by], index) => {
    if (to && !/^[A-Z]{3}$/.test(to)) errors.push(`Routing "To" ${index + 1}: 3-letter airport code needed (now "${to}").`);
    if (by && !/^[A-Z0-9]{2}$/.test(by)) errors.push(`Routing "By" ${index + 1}: 2-character airline code needed (now "${by}").`);
    if (to && !by) errors.push(`Routing ${index + 1}: carrier ("By") missing for ${to}.`);
    if (by && !to) errors.push(`Routing ${index + 1}: airport ("To") missing for carrier ${by}.`);
  });
  const [firstTo, firstBy] = legs[0];
  if (!isHouse && !firstTo && !firstBy) warnings.push('Routing: first carrier / airport (To / By 1) is empty.');

  // chargeable / volumetric weight far above the gross weight - usually a slip in the dimensions or volume
  (ctx.rateLines || []).forEach((line, index) => {
    const gross = parseFloat(line && line.grossWeight) || 0;
    const heaviest = Math.max(parseFloat(line && line.chargeableWeight) || 0, parseFloat(line && line.volumetricWeight) || 0);
    if (gross > 0 && heaviest > gross * 30) warnings.push(`Rate line ${index + 1}: chargeable / volumetric weight ${heaviest} kg is ${Math.round(heaviest / gross)} times the gross weight ${gross} kg - check the dimensions and the Volume box (CBM).`);
  });

  // the first carrier / first flight should be the airline of the AWB prefix (157 = Qatar Airways = QR)
  const airline = (ctx.masterAirlines || []).find((candidate) => text(candidate.prefix) === text(ctx.awbPrefix));
  const airlineCode = upper(airline && airline.code2);
  if (airlineCode) {
    const numberName = isHouse ? 'MAWB' : 'AWB';
    if (firstBy && firstBy !== airlineCode) warnings.push(`First carrier ${firstBy} is not the airline of the ${numberName} number - ${text(ctx.awbPrefix)} is ${airline.name} (${airlineCode}). Check the prefix or the carrier.`);
    const firstFlight = upper(ctx.flightNumber1).replace(/\s+/g, '');
    const flightCarrier = /^[A-Z0-9]{2}\d/.test(firstFlight) ? firstFlight.slice(0, 2) : '';
    if (flightCarrier && flightCarrier !== airlineCode && flightCarrier !== firstBy) warnings.push(`First flight ${firstFlight} is not a flight of ${firstBy || airlineCode} - check the flight number.`);
  }

  const lastLeg = [...legs].reverse().find(([to]) => to);
  if (!isHouse && firstTo && origin && firstTo === origin) errors.push(`Routing: first "To" ${firstTo} is the airport of departure - give the next airport (the destination for a direct flight).`);
  if (lastLeg && destination && lastLeg[0] !== destination) (isHouse ? warnings : errors).push(`Routing ends at ${lastLeg[0]} but the destination is ${destination}.`);
  if (legs[1][0] && !firstTo) errors.push('Routing: To 2 is filled but To 1 is empty.');
  if (legs[2][0] && !legs[1][0]) errors.push('Routing: To 3 is filled but To 2 is empty.');
}

function checkFlights(ctx, isHouse, firstBy, errors, warnings) {
  const flights = [[ctx.flightNumber1, ctx.flightDate1], [ctx.flightNumber2, ctx.flightDate2]];
  flights.forEach(([flightNumber, flightDate], index) => {
    const flight = upper(flightNumber).replace(/\s+/g, '');
    if (flight && !/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(flight)) errors.push(`Flight ${index + 1} "${flightNumber}": airline code + 1-4 digit number (e.g. AI101).`);
    if (flight && !text(flightDate)) errors.push(`Flight ${index + 1} ${flight}: flight date missing.`);
    if (text(flightDate) && isNaN(Date.parse(String(flightDate).slice(0, 10)))) errors.push(`Flight ${index + 1}: date "${flightDate}" is not a valid date.`);
  });
  if (!isHouse && !text(ctx.flightNumber1)) warnings.push('No flight booked (Flight 1 is empty).');
  if (text(ctx.flightDate1) && text(ctx.flightDate2) && String(ctx.flightDate2).slice(0, 10) < String(ctx.flightDate1).slice(0, 10)) errors.push('Flight 2 date is before Flight 1 date.');
  if (text(ctx.flightNumber1) && /^[A-Z0-9]{2}$/.test(firstBy)) {
    const flightCarrier = upper(ctx.flightNumber1).replace(/\s+/g, '').slice(0, 2);
    if (/^[A-Z0-9]{2}$/.test(flightCarrier) && flightCarrier !== firstBy) warnings.push(`Flight 1 ${upper(ctx.flightNumber1)} is not on the first carrier ${firstBy}.`);
  }
}

function checkParties(parties, errors, warnings) {
  for (const title of ['Shipper', 'Consignee']) {
    const party = parties[title] || {};
    const street = text(party.street || party.address);
    if (!text(party.name)) { errors.push(`${title}: name missing.`); continue; }
    if (text(party.name).length > 35) warnings.push(`${title} name is ${text(party.name).length} characters - EDI keeps the first 35.`);
    if (!street) errors.push(`${title}: street address missing.`);
    else if (street.length > 35) warnings.push(`${title} address is longer than 35 characters - EDI keeps the first 35 (put the rest in the next line).`);
    if (!text(party.city)) errors.push(`${title}: city missing.`);
    else if (text(party.city).length > 17) warnings.push(`${title} city "${text(party.city)}" is longer than 17 characters - EDI cuts it.`);
    if (!text(party.country)) errors.push(`${title}: country missing.`);
    else if (!partyCountry(party)) errors.push(`${title}: country must be the 2-letter ISO code (e.g. IN, AE), now "${text(party.country)}".`);
    const unsafeField = ['name', 'street', 'city', 'state', 'zip'].find((field) => text(party[field]) && !EDI_SAFE.test(text(party[field])));
    if (unsafeField) warnings.push(`${title} ${unsafeField} has characters EDI cannot carry (accents / symbols) - they may be dropped.`);
    if (text(party.zip) && text(party.zip).length > 9) warnings.push(`${title} postal code is longer than 9 characters - EDI cuts it.`);
    if (!text(party.phone) && !text(party.email)) warnings.push(`${title}: no phone or e-mail (many airlines / customs ask for a contact).`);
  }
}

function checkAgent(ctx, errors, warnings) {
  const agent = ctx.agentDetails || {};
  if (!text(agent.name)) errors.push('Issuing carrier\'s agent: name missing.');
  const code = text(agent.code).replace(/[\s/-]/g, '');
  if (!code) warnings.push('Agent IATA code missing.');
  else if (!/^\d{7}(\d{4})?$/.test(code)) warnings.push(`Agent IATA code "${text(agent.code)}": normally 7 digits (+ 4-digit CASS branch).`);
}

function checkChargeCodes(ctx, errors, warnings) {
  const currency = upper(ctx.currencyCode);
  if (!/^[A-Z]{3}$/.test(currency)) errors.push('Currency: 3-letter ISO code needed (e.g. INR, USD).');
  if (text(ctx.destinationCurrency) && !/^[A-Z]{3}$/.test(upper(ctx.destinationCurrency))) errors.push('Destination currency: 3-letter ISO code needed.');
  const chargeCode = upper(ctx.chargeCode);
  if (chargeCode && !['PP', 'CC', 'PC', 'CP', 'PX', 'CX'].includes(chargeCode)) warnings.push(`Charge code "${chargeCode}" is unusual (PP or CC expected).`);
  const weightValuation = upper(ctx.wtValPC);
  const other = upper(ctx.otherPC);
  if (weightValuation && !['P', 'C'].includes(weightValuation)) errors.push('WT/VAL: must be P (prepaid) or C (collect).');
  if (other && !['P', 'C'].includes(other)) errors.push('Other charges: must be P (prepaid) or C (collect).');
  if (chargeCode === 'PP' && (weightValuation === 'C' || other === 'C')) warnings.push('Charge code PP but WT/VAL or Other is marked Collect.');
  if (chargeCode === 'CC' && (weightValuation === 'P' || other === 'P')) warnings.push('Charge code CC but WT/VAL or Other is marked Prepaid.');
  const carriage = upper(ctx.carriageValue);
  const customs = upper(ctx.customsValue);
  const insurance = upper(ctx.insuranceValue);
  if (carriage && carriage !== 'NVD' && Number.isNaN(numberOrBlank(carriage))) errors.push(`Declared value for carriage "${ctx.carriageValue}": NVD or an amount.`);
  if (customs && customs !== 'NCV' && Number.isNaN(numberOrBlank(customs))) errors.push(`Declared value for customs "${ctx.customsValue}": NCV or an amount.`);
  if (insurance && insurance !== 'XXX' && insurance !== 'NIL' && Number.isNaN(numberOrBlank(insurance))) errors.push(`Amount of insurance "${ctx.insuranceValue}": XXX or an amount.`);
  if (numberOrBlank(carriage) > 0 && !(numberOrBlank(ctx.valChargePP) > 0 || numberOrBlank(ctx.valChargeCC) > 0)) warnings.push('Declared value for carriage is given but there is no valuation charge - check with the airline if it is above their liability limit.');
  if (currency && ctx.destinationCurrency && upper(ctx.destinationCurrency) !== currency && chargeCode.startsWith('C') && !(numberOrBlank(ctx.ccChargesDest) > 0)) warnings.push('Collect AWB in another destination currency: CC charges in destination currency are empty.');
}

const hasLineData = (line) => line && (text(line.noOfPcs ?? line.pieces) || text(line.grossWeight) || text(line.chargeableWeight) || text(line.rateCharge) || text(line.goodsDescription));

function checkRateLines(ctx, lines, isHouse, errors, warnings) {
  if (!lines.length) errors.push('Rate lines: no line with pieces and weight.');
  const sums = { pieces: 0, gross: 0, total: 0 };
  lines.forEach((line, index) => {
    const label = `Rate line ${index + 1}`;
    const pieces = numberOrBlank(line.noOfPcs ?? line.pieces);
    const gross = numberOrBlank(line.grossWeight);
    const chargeable = numberOrBlank(line.chargeableWeight);
    const rate = numberOrBlank(line.rateCharge);
    const total = numberOrBlank(line.totalAmount ?? line.total);
    const rateClass = upper(line.rateClassCode || line.rateClass).charAt(0);
    if (pieces === null || Number.isNaN(pieces) || pieces < 1 || !Number.isInteger(pieces)) errors.push(`${label}: pieces must be a whole number, 1 or more.`);
    if (gross === null || Number.isNaN(gross) || gross <= 0) errors.push(`${label}: gross weight must be more than 0.`);
    if (chargeable !== null && !Number.isNaN(chargeable) && gross > 0 && chargeable + 0.001 < gross) errors.push(`${label}: chargeable weight ${chargeable} is less than gross weight ${gross}.`);
    if (chargeable === null || !(chargeable > 0)) warnings.push(`${label}: chargeable weight is empty.`);
    // IATA chargeable weight is in 0.5 kg steps (whole lb); otherwise weight x rate in the XFWB does not match the amount
    else if (!Number.isNaN(chargeable)) {
      const inPounds = /^L/i.test(text(line.gwUnit));
      const step = inPounds ? 1 : 0.5;
      if (Math.abs(chargeable / step - Math.round(chargeable / step)) > 1e-6) errors.push(`${label}: chargeable weight ${chargeable} is not in ${inPounds ? 'whole lb' : '0.5 kg steps'} - tick ROUND 0.5 (or type ${(Math.ceil(chargeable / step - 1e-9) * step).toFixed(1)}).`);
    }
    if (!isHouse) {
      if (!rateClass) errors.push(`${label}: rate class missing (M, N, Q, C, R, S ...).`);
      else if (!RATE_CLASSES.includes(rateClass)) errors.push(`${label}: rate class "${line.rateClassCode}" is not an IATA rate class.`);
      if (rateClass === 'C' && !/^\d{4}$/.test(text(line.commodityItemNumber || line.commodityItemNo))) errors.push(`${label}: class C needs the 4-digit commodity item number.`);
      if ((rateClass === 'R' || rateClass === 'S') && !(numberOrBlank(line.rateClassPercentage || line.rcp) > 0)) warnings.push(`${label}: class ${rateClass} normally has a % of the normal rate.`);
      if (rate === null && !line.rateAsAgreed) warnings.push(`${label}: rate / charge is empty (or tick "As Agreed").`);
      if (Number.isNaN(rate) || rate < 0) errors.push(`${label}: rate must be 0 or more.`);
      if (rate > 0 && total !== null && !Number.isNaN(total)) {
        const isFlatCharge = rateClass === 'M' || rateClass === 'B';
        const expected = isFlatCharge ? rate : (chargeable > 0 ? chargeable * rate : null);
        if (expected !== null && Math.abs(expected - total) > 1) warnings.push(`${label}: total ${total.toFixed(2)} does not match ${isFlatCharge ? 'the minimum charge' : `${chargeable} x ${rate}`} = ${expected.toFixed(2)}.`);
      }
    }
    if (!text(line.goodsDescription) && !text(ctx.natureOfGoods)) errors.push(`${label}: nature and quantity of goods missing.`);
    const hsCode = text(line.harmonisedCode || line.hsCode);
    const hsDigits = hsCode.replace(/\D/g, '');
    if (hsCode && (hsDigits.length < 6 || hsDigits.length > 10)) warnings.push(`${label}: HS code "${hsCode}" should be 6 to 10 digits.`);
    if (pieces > 0) sums.pieces += pieces;
    if (gross > 0) sums.gross += gross;
    if (total > 0) sums.total += total;
  });
  return sums;
}

function checkGoodsAndWeightCharge(ctx, screenType, lines, totalOfLines, isHouse, warnings) {
  const goods = text(ctx.natureOfGoods);
  if (goods.length > 0 && goods.split('\n').some((line) => line.length > 70)) warnings.push('Nature of goods: a line is longer than 70 characters - EDI may cut it.');
  const isMasterConsol = screenType === 'MAWB' && /^CONSOL/i.test(goods);
  if (!isMasterConsol && GENERAL_GOODS.test(text(ctx.natureOfGoods || (lines[0] || {}).goodsDescription).split('\n')[0])) warnings.push('Nature of goods is too general for customs / ICS2 - give a real description of the goods.');

  // the NO DIMENSIONS tick is set by itself on MAWB / HAWB and is not sent, so it is not a reason
  if (!isHouse && lines.length) {
    const hasVolume = isPositive(ctx.volume)
      || lines.some((line) => isPositive(line.volume) || isPositive(line.volumetricWeight) || (Array.isArray(line.dimensions) && line.dimensions.some((dimension) => isPositive(dimension.length))))
      || (ctx.dimRows || []).some((dimension) => isPositive(dimension.length) || isPositive(dimension.volume));
    if (!hasVolume) warnings.push('No volume or dimensions - the FWB goes without a volume, and many airlines ask for it (CBM). Fill the Volume box or the dimensions.');
  }
  if (!isHouse && totalOfLines > 0) {
    const weightCharge = (numberOrBlank(ctx.weightChargePP) || 0) + (numberOrBlank(ctx.weightChargeCC) || 0);
    if (weightCharge > 0 && Math.abs(weightCharge - totalOfLines) > 1) warnings.push(`Weight charge ${weightCharge.toFixed(2)} is not the total of the rate lines (${totalOfLines.toFixed(2)}).`);
    if (!(weightCharge > 0)) warnings.push('Weight charge (PP / CC) is empty - use auto calculate.');
  }
}

function checkOtherCharges(otherCharges, errors, warnings) {
  otherCharges.forEach((charge, index) => {
    if (!charge || (!text(charge.code) && !text(charge.amount))) return;
    const label = `Other charge row ${index + 1}`;
    const code = upper(charge.code);
    if (!code) errors.push(`${label}: charge code missing.`);
    else if (!/^[A-Z]{2}[AC]?$/.test(code)) errors.push(`${label}: code "${charge.code}" must be 2 letters (e.g. MY, SC, AW).`);
    const amount = numberOrBlank(charge.amount);
    if (amount === null || Number.isNaN(amount) || amount < 0) errors.push(`${label} ${code}: amount must be 0 or more.`);
    else if (amount === 0) warnings.push(`${label} ${code}: amount is 0.`);
    if (!/^(agent|carrier|A|C)$/i.test(text(charge.entitlement))) errors.push(`${label} ${code}: due Agent or due Carrier not chosen.`);
  });
  const seen = new Set();
  otherCharges.forEach((charge) => {
    if (!charge || !charge.code) return;
    const key = upper(charge.code) + '/' + text(charge.entitlement).toLowerCase();
    if (seen.has(key)) warnings.push(`Other charge ${upper(charge.code)} is entered twice.`);
    seen.add(key);
  });
}

function checkSpecialHandling(ctx, errors, warnings) {
  const codes = (ctx.sphCodes || []).map(upper).filter(Boolean);
  codes.forEach((code) => { if (!/^[A-Z0-9]{3}$/.test(code)) errors.push(`SPH code "${code}" must be 3 characters.`); });
  if (new Set(codes).size !== codes.length) warnings.push('A special handling code is entered twice.');
  if ((ctx.masterSph || []).length) {
    const known = new Set((ctx.masterSph || []).map((entry) => upper(entry.code || entry.shc || entry)));
    codes.filter((code) => /^[A-Z0-9]{3}$/.test(code) && !known.has(code)).forEach((code) => warnings.push(`SPH code ${code} is not in the special handling master.`));
  }
  const documents = ctx.extraDocs || {};
  if (codes.some((code) => DG_SPH.includes(code)) && !documents.DGD) warnings.push('Dangerous goods SPH code but no DG declaration (DOCUMENTS > DGD FORM).');
  if (codes.includes('AVI') && !documents.AVI) warnings.push('AVI (live animals) but no live animal certificate (DOCUMENTS > AVI CERT).');
  if (codes.some((code) => LITHIUM_SPH.includes(code)) && !documents.LITHIUM) warnings.push('Lithium battery SPH code but no lithium battery declaration (DOCUMENTS > LITHIUM BATT.).');
  const ssrLines = text(ctx.ssrText).split('\n');
  if (ssrLines.some((line) => line.length > 65)) warnings.push('SSR: a line is longer than 65 characters - EDI cuts it.');
  if (ssrLines.filter((line) => text(line)).length > 3) warnings.push('SSR: more than 3 lines - EDI sends 3.');
  if (text(ctx.osiText).split('\n').some((line) => line.length > 65)) warnings.push('OSI: a line is longer than 65 characters - EDI cuts it.');
  if (text(ctx.sci) && !/^[A-Z0-9]{1,2}$/.test(upper(ctx.sci))) errors.push(`SCI "${ctx.sci}": 1-2 characters (e.g. X, T1).`);
}

function checkOciRows(ociRows, errors, warnings) {
  ociRows.forEach((row, index) => {
    if (!row || (!text(row.infoId) && !text(row.suppInfo))) return; // empty / country-only row: not sent
    const label = `OCI row ${index + 1}`;
    if (!text(row.suppInfo)) { warnings.push(`${label} (${upper(row.infoId)}): no information typed - the row is left out of the EDI.`); return; }
    if (text(row.countryCode) && !/^[A-Z]{2}$/.test(upper(row.countryCode))) errors.push(`${label}: country must be 2 letters.`);
    if (!/^[A-Z]{3}$/.test(upper(row.infoId))) errors.push(`${label}: information ID must be 3 letters (SHP, CNE, AGT, ISS ...).`);
    if (text(row.customsId) && !/^[A-Z0-9]{1,2}$/.test(upper(row.customsId))) errors.push(`${label}: customs ID must be 1-2 characters (T, E, M ...).`);
    if (text(row.suppInfo).length > 35) errors.push(`${label}: information is longer than 35 characters.`);
  });
}

// country rules (country from the party, else the airport master - never from the airport letters)
function checkCountryRules(ctx, parties, lines, warnings) {
  const consigneeCountry = partyCountry(parties.Consignee) || airportCountry(ctx, upper(ctx.destAirport));
  const shipperCountry = partyCountry(parties.Shipper) || airportCountry(ctx, upper(ctx.depAirport));
  const ociRows = ctx.ociRows || [];
  const hasOci = (infoId, customsId) => ociRows.some((row) => upper(row.infoId) === infoId && upper(row.customsId) === customsId && text(row.suppInfo));
  if (consigneeCountry && (ICS2.includes(consigneeCountry) || consigneeCountry === 'GB')) {
    if (!hasOci('CNE', 'E')) warnings.push(`Destination ${consigneeCountry}: consignee EORI number is not in the OCI rows (CNE / E) - often asked for by EU / UK customs.`);
    if (ICS2.includes(consigneeCountry) && !lines.some((line) => text(line.harmonisedCode || line.hsCode).replace(/\D/g, '').length >= 6)) warnings.push(`Destination ${consigneeCountry} (EU ICS2): give the 6-digit HS code of the goods on the rate line.`);
  }
  if (shipperCountry === 'IN' && !hasOci('SHP', 'T')) warnings.push('Origin India: shipper GSTIN / IEC is not in the OCI rows (SHP / T).');
  if (consigneeCountry === 'US' && !text((parties.Consignee || {}).zip)) warnings.push('Destination US: consignee ZIP code is empty.');
}

function checkExecution(ctx, errors, warnings) {
  if (!text(ctx.executedDate)) errors.push('Executed on (date) missing.');
  else if (isNaN(Date.parse(String(ctx.executedDate).slice(0, 10)))) errors.push(`Executed on "${ctx.executedDate}" is not a valid date.`);
  else {
    const executedDay = String(ctx.executedDate).slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (executedDay > today) warnings.push(`Executed on ${executedDay} is in the future.`);
    if (text(ctx.flightDate1) && String(ctx.flightDate1).slice(0, 10) < executedDay) warnings.push('Flight 1 date is before the executed date.');
  }
  if (!text(ctx.executedPlace)) errors.push('Executed at (place) missing.');
  if (!text(ctx.signatureShipper)) warnings.push('Signature of shipper / agent is empty.');
  if (!text(ctx.signatureCarrier)) warnings.push('Signature of issuing carrier / agent is empty.');
}

function checkLinkedHouses(ctx, sums, errors, warnings) {
  const houses = Array.isArray(ctx.linkedHawbs) ? ctx.linkedHawbs : [];
  if (houses.length) {
    const housePieces = houses.reduce((sum, house) => sum + (Number(house.pcs) || 0), 0);
    const houseWeight = houses.reduce((sum, house) => sum + (Number(house.wt) || 0), 0);
    if (sums.pieces && housePieces > sums.pieces) errors.push(`Linked HAWBs have ${housePieces} pieces, more than the master's ${sums.pieces}.`);
    if (sums.gross && houseWeight > sums.gross + 0.5) errors.push(`Linked HAWBs weigh ${houseWeight.toFixed(1)} kg, more than the master's ${sums.gross.toFixed(1)} kg.`);
    if (sums.pieces && housePieces && housePieces < sums.pieces) warnings.push(`Linked HAWBs have ${housePieces} of the master's ${sums.pieces} pieces.`);
  }
  if (/^CONSOL/i.test(text(ctx.natureOfGoods)) && !(ctx.linkedHawbs || []).length) warnings.push('Nature of goods says consolidation but no HAWB is linked.');
}

export function validateAwbForm(ctx, type) {
  const screenType = upper(type);
  const isHouse = screenType === 'HAWB';
  const errors = [];
  const warnings = [];
  const parties = ctx.parties || {};
  const legs = [[ctx.to1, ctx.by1], [ctx.to2, ctx.by2], [ctx.to3, ctx.by3]].map(([to, by]) => [upper(to), upper(by)]);
  const lines = (ctx.rateLines || []).filter(hasLineData);

  checkNumbers(ctx, isHouse, errors);
  checkRouting(ctx, isHouse, legs, errors, warnings);
  checkFlights(ctx, isHouse, legs[0][1], errors, warnings);
  checkParties(parties, errors, warnings);
  if (!isHouse) checkAgent(ctx, errors, warnings);
  checkChargeCodes(ctx, errors, warnings);
  const sums = checkRateLines(ctx, lines, isHouse, errors, warnings);
  checkGoodsAndWeightCharge(ctx, screenType, lines, sums.total, isHouse, warnings);
  checkOtherCharges(ctx.otherCharges || [], errors, warnings);
  checkSpecialHandling(ctx, errors, warnings);
  checkOciRows(ctx.ociRows || [], errors, warnings);
  checkCountryRules(ctx, parties, lines, warnings);
  if (!isHouse) checkExecution(ctx, errors, warnings);
  if (screenType === 'MAWB') checkLinkedHouses(ctx, sums, errors, warnings);

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

function MessageList({ title, messages, className }) {
  if (!messages.length) return null;
  return (
    <>
      <div className={cn('tw:mb-1 tw:text-entry tw:font-bold', className)}>{title}</div>
      <ul className="tw:mb-2.5 tw:pl-[18px] tw:text-entry tw:leading-normal">
        {messages.map((message) => <li key={message}>{message}</li>)}
      </ul>
    </>
  );
}

// result window (scrolls; errors and warnings apart). Drawn in its own root on <body> so it works on all three screens.
function EdiCheckWindow({ container, result, title, onClose, onGo, goLabel }) {
  const passed = !result.errors.length;
  const tone = passed ? (result.warnings.length ? 'warning' : 'success') : 'destructive';
  const headerClass = { warning: 'tw:bg-warning/10 tw:text-warning', success: 'tw:bg-success/10 tw:text-success', destructive: 'tw:bg-destructive/10 tw:text-destructive' }[tone];
  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogPortal container={container}>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="tw:fixed tw:top-1/2 tw:left-1/2 tw:z-[3000] tw:flex tw:max-h-[86vh] tw:w-[620px] tw:max-w-[calc(100%-32px)] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:flex-col tw:rounded-md tw:bg-background tw:text-foreground tw:normal-case tw:shadow-2xl tw:outline-none"
        >
          <div className={cn('tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:border-b tw:border-border tw:px-3.5 tw:py-2.5', headerClass)}>
            <DialogTitle className="tw:text-[13px] tw:font-bold tw:text-current">{title}</DialogTitle>
            <DialogDescription className="tw:ml-auto tw:text-entry">{result.errors.length} error(s), {result.warnings.length} warning(s)</DialogDescription>
          </div>
          <div className="tw:overflow-y-auto tw:px-3.5 tw:py-3">
            {passed && !result.warnings.length && <p className="tw:m-0 tw:text-entry">No problems found - ready for FWB / FHL.</p>}
            <MessageList title="Errors - fix these, the airline would reject the message" messages={result.errors} className="tw:text-destructive" />
            <MessageList title="Warnings - please check" messages={result.warnings} className="tw:text-warning" />
          </div>
          <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2 tw:border-t tw:border-border tw:px-3.5 tw:py-2.5">
            {onGo && <Button variant="warning" size="lg" className="tw:font-bold" onClick={onGo}>{goLabel}</Button>}
            <Button variant="default" size="lg" className="tw:font-bold" onClick={onClose}>{onGo ? 'CANCEL' : 'OK'}</Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// show the result; with goLabel the window asks "send anyway?" and resolves true / false
export function showEdiCheck(result, { title = 'EDI CHECK', goLabel } = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-edi-check', '');
    host.className = 'tw:relative tw:z-[2147483000]';
    document.body.appendChild(host);
    const root = createRoot(host);
    let answered = false;
    const finish = (answer) => {
      if (answered) return;
      answered = true;
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
      resolve(answer);
    };
    root.render(
      <EdiCheckWindow container={host} result={result} title={title} onClose={() => finish(false)} onGo={goLabel ? () => finish(true) : null} goLabel={goLabel} />,
    );
  });
}

// VALIDATE EDI button
export function runEdiValidation(ctx, type) {
  const result = validateAwbForm(ctx, type);
  showEdiCheck(result, { title: `VALIDATE EDI - ${type}` });
  return result;
}

// before SEND: false = do not send (errors, or warnings and the user cancelled)
export async function ediOkToSend(ctx, type, kind) {
  const result = validateAwbForm(ctx, type);
  if (result.errors.length) { await showEdiCheck(result, { title: `${kind} NOT SENT - fix the errors` }); return false; }
  if (result.warnings.length) return showEdiCheck(result, { title: `SEND ${kind}?`, goLabel: `SEND ${kind} ANYWAY` });
  return true;
}
