import { volWtFromDims } from '../../weightCalc';

export const DRAFT_STORAGE_KEY = 'CreateHouseWaybill_DRAFT';
export const SPH_SLOTS = 9;
export const DEFAULT_EXECUTED_PLACE = 'NEW DELHI';

export const COUNTRY_CURRENCY_MAP = {
  IN: 'INR', US: 'USD', AE: 'AED', GB: 'GBP', EU: 'EUR',
  SG: 'SGD', AU: 'AUD', CA: 'CAD', JP: 'JPY', CN: 'CNY',
  HK: 'HKD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
  NZ: 'NZD', MX: 'MXN', BR: 'BRL', ZA: 'ZAR', RU: 'RUB',
  KR: 'KRW', TH: 'THB', MY: 'MYR', ID: 'IDR', PH: 'PHP',
  VN: 'VND', BD: 'BDT', PK: 'PKR', LK: 'LKR', NP: 'NPR',
  QA: 'QAR', SA: 'SAR', KW: 'KWD', BH: 'BHD', OM: 'OMR',
  EG: 'EGP', NG: 'NGN', KE: 'KES', GH: 'GHS', TZ: 'TZS',
  ET: 'ETB', MU: 'MUR', MV: 'MVR', NL: 'EUR', DE: 'EUR',
  FR: 'EUR', IT: 'EUR', ES: 'EUR', BE: 'EUR', AT: 'EUR',
  PT: 'EUR', GR: 'EUR', FI: 'EUR', IE: 'EUR', TR: 'TRY',
  IL: 'ILS', JO: 'JOD', LB: 'LBP', PL: 'PLN', CZ: 'CZK',
  HU: 'HUF', RO: 'RON', HR: 'HRK', UA: 'UAH', AR: 'ARS',
  CL: 'CLP', CO: 'COP', PE: 'PEN', UY: 'UYU',
};

// OCI customs id 'E' (EORI) for these countries, 'T' (tax id) elsewhere
export const EU_CUSTOMS_COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO'];

const CONSIGNEE_COUNTRY_FIXES = { LF: 'GB', EG: 'GB', ED: 'DE' };

const padSphCodes = (codes) => [...codes, ...Array(SPH_SLOTS - codes.length).fill('')];

export const CARGO_TEMPLATES = {
  'GENERAL CARGO': { natureOfGoods: 'GENERAL CONSOLIDATION CARGO', sphCodes: padSphCodes(['GEN']), ssrText: '' },
  'PERISHABLE GOODS': { natureOfGoods: 'FRESH VEGETABLES AND FRUITS', sphCodes: padSphCodes(['PER']), ssrText: 'KEEP COOL AT 2-8 DEG C' },
  'DANGEROUS GOODS': { natureOfGoods: 'DANGEROUS GOODS AS PER ATTACHED DGD', sphCodes: padSphCodes(['DGD', 'CAO']), ssrText: 'DANGEROUS GOODS SHIPPERS DECLARATION ATTACHED' },
  PHARMACEUTICALS: { natureOfGoods: 'LIFE SAVING DRUGS / MEDICINES', sphCodes: padSphCodes(['PIL', 'COL']), ssrText: 'MAINTAIN TEMPERATURE 15-25 DEG C' },
  'LIVE ANIMALS': { natureOfGoods: 'LIVE ANIMALS', sphCodes: padSphCodes(['AVI']), ssrText: 'LIVE ANIMALS - DO NOT X-RAY' },
  'VALUABLE CARGO': { natureOfGoods: 'VALUABLE CARGO', sphCodes: padSphCodes(['VAL', 'SEC']), ssrText: 'HIGH VALUE SECURITY REQUIRED' },
};

// the SSR / OSI line each special handling code puts in the boxes while it is picked
const SPH_TEXT_RULES = [
  { code: 'ACT', ssr: 'ACT - ACTIVE TEMPERATURE CONTROLLED SYSTEM', osi: 'MAINTAIN ACTIVE TEMPERATURE CONTROL' },
  { code: 'AOG', ssr: 'AOG - AIRCRAFT ON GROUND URGENT', osi: 'URGENT AIRCRAFT SPARES' },
  { code: 'ATT', ssr: 'ATT - GOODS ATTACHED TO AIR WAYBILL', osi: '' },
  { code: 'AVI', ssr: 'AVI - LIVE ANIMAL /SPECIES/ /QUANTITY/', osi: 'SHIPPERS CERTIFICATION FOR LIVE ANIMALS ATTACHED' },
  { code: 'BIG', ssr: 'BIG - OUTSIZED CARGO', osi: 'OUTSIZED CARGO - SPECIAL HANDLING REQUIRED' },
  { code: 'BUP', ssr: 'BUP - BULK UNITIZATION PROGRAMME', osi: 'SHIPPER LOADED UNIT' },
  { code: 'CAO', ssr: 'CAO - CARGO AIRCRAFT ONLY', osi: '' },
  { code: 'CAT', ssr: 'CAT - CARGO ATTENDANT ACCOMPANYING', osi: '' },
  { code: 'COL', ssr: 'COL - COOL GOODS', osi: 'MAINTAIN COOL TEMPERATURE' },
  { code: 'COM', ssr: 'COM - COMPANY MAIL', osi: '' },
  { code: 'CRT', ssr: 'CRT - CONTROL ROOM TEMPERATURE', osi: 'MAINTAIN +15C TO +25C' },
  { code: 'DGD', ssr: 'DGD - DANGEROUS GOODS AS PER ATTACHED DGD', osi: '' },
  { code: 'DIP', ssr: 'DIP - DIPLOMATIC MAIL', osi: 'DIPLOMATIC CARGO - DO NOT OPEN' },
  { code: 'EAP', ssr: 'EAP - E-FREIGHT WITH PAPER DOCUMENTS', osi: '' },
  { code: 'EAT', ssr: 'EAT - FOODSTUFFS', osi: 'FOODSTUFFS - DO NOT STOW WITH POISONS' },
  { code: 'EAW', ssr: 'EAW - E-FREIGHT NO PAPER DOCUMENTS', osi: '' },
  { code: 'ELI', ssr: 'LITHIUM ION BATTERIES AS PER SECTION II OF PI', osi: '' },
  { code: 'ELM', ssr: 'LITHIUM METAL BATTERIES AS PER SECTION II OF PI', osi: '' },
  { code: 'FIL', ssr: 'FIL - UNDEVELOPED FILM / DO NOT X-RAY', osi: '' },
  { code: 'FRI', ssr: 'FRI - FROZEN GOODS', osi: 'MAINTAIN FREEZING TEMPERATURE' },
  { code: 'HEG', ssr: 'HEG - HATCHING EGGS', osi: 'HANDLE WITH EXTREME CARE' },
  { code: 'HUM', ssr: 'HUM - HUMAN REMAINS', osi: 'DEATH CERTIFICATE AND EMBALMING CERTIFICATE ATTACHED' },
  { code: 'ICE', ssr: 'ICE - DRY ICE / UN1845 / CLASS 9', osi: '' },
  { code: 'LHO', ssr: 'LHO - LIVING HUMAN ORGANS', osi: 'URGENT MEDICAL TRANSPORT' },
  { code: 'MAG', ssr: 'MAG - MAGNETIZED MATERIAL', osi: '' },
  { code: 'MUW', ssr: 'MUW - MUNITIONS OF WAR', osi: 'MILITARY CARGO' },
  { code: 'OBX', ssr: 'OBX - OBNOXIOUS CARGO', osi: 'STOW AWAY FROM FOODSTUFFS' },
  { code: 'PAC', ssr: 'PAC - PASSENGER AND CARGO', osi: '' },
  { code: 'PEA', ssr: 'PEA - HUNTING TROPHIES', osi: '' },
  { code: 'PER', ssr: 'PER - PERISHABLE CARGO', osi: 'NOTIFY CONSIGNEE IMMEDIATELY UPON ARRIVAL' },
  { code: 'PIL', ssr: 'PIL - PHARMACEUTICALS', osi: 'MAINTAIN STRICT TEMPERATURE CONTROLS' },
  { code: 'QTA', ssr: 'QTA - QUICK TRANSIT', osi: 'QUICK TRANSIT REQUIRED' },
  { code: 'RAC', ssr: 'RAC - RESERVED AIR CARGO', osi: '' },
  { code: 'RDS', ssr: 'RDS - RADIOACTIVE MATERIAL', osi: '' },
  { code: 'SAL', ssr: 'SAL - SURFACE MAIL', osi: '' },
  { code: 'SHL', ssr: 'SHL - SAVE HUMAN LIFE', osi: 'ABSOLUTE PRIORITY HANDLING REQUIRED' },
  { code: 'SOC', ssr: 'SOC - SHIPPER OWNED CONTAINER', osi: '' },
  { code: 'SPX', ssr: 'SPX - SECURE FOR PASSENGER AND CARGO AIRCRAFT', osi: '' },
  { code: 'VAL', ssr: 'VAL - VALUABLE CARGO', osi: 'VALUABLE CARGO UNDER ESCORT' },
  { code: 'VOL', ssr: 'VOL - VOLUME CARGO', osi: '' },
  { code: 'VUN', ssr: 'VUN - VULNERABLE CARGO', osi: 'VULNERABLE CARGO - SPECIAL SECURITY REQUIRED' },
  { code: 'WET', ssr: 'WET - WET CARGO', osi: 'STOW IN WATERTIGHT CONTAINERS' },
];

// field is 'ssr' or 'osi': lines of codes no longer picked go, lines of picked codes are added once, typed lines stay
export function textForSphCodes(text, sphCodes, field) {
  const rulesWithText = SPH_TEXT_RULES.filter((rule) => rule[field]);
  let updated = rulesWithText
    .filter((rule) => !sphCodes.includes(rule.code))
    .reduce((current, rule) => current.split('\n').filter((line) => line !== rule[field]).join('\n'), text || '');
  rulesWithText
    .filter((rule) => sphCodes.includes(rule.code))
    .forEach((rule) => {
      if (!updated.includes(rule[field])) updated = (updated ? `${updated}\n` : '') + rule[field];
    });
  return updated.replace(/^\n+|\n+$/g, '');
}

const SURCHARGE_RATES_BY_PREFIX = {
  '098': { fuelPerKg: 15, securityPerKg: 5, awbFee: 700 }, // Air India
  '176': { fuelPerKg: 20, securityPerKg: 8, awbFee: 650 }, // Emirates
  '125': { fuelPerKg: 18, securityPerKg: 7, awbFee: 600 }, // British Airways
};
const DEFAULT_SURCHARGE_RATES = { fuelPerKg: 10, securityPerKg: 5, awbFee: 500 };

// AW (air waybill fee), MY (fuel) and SC (security) due carrier for the airline of the AWB prefix
export function carrierSurcharges(awbPrefix, chargeableWeight) {
  const rates = SURCHARGE_RATES_BY_PREFIX[awbPrefix] || DEFAULT_SURCHARGE_RATES;
  return [
    { code: 'AW', entitlement: 'carrier', amount: rates.awbFee.toFixed(2) },
    { code: 'MY', entitlement: 'carrier', amount: (rates.fuelPerKg * chargeableWeight).toFixed(2) },
    { code: 'SC', entitlement: 'carrier', amount: (rates.securityPerKg * chargeableWeight).toFixed(2) },
  ];
}

// a surcharge already on the list gets the new amount, else it takes the first blank row or a new one
export function withSurcharges(charges, surcharges) {
  const merged = [...charges];
  let changed = false;
  surcharges.forEach((surcharge) => {
    const existingIndex = merged.findIndex((charge) => charge.code === surcharge.code);
    if (existingIndex >= 0) {
      if (merged[existingIndex].amount !== surcharge.amount) {
        merged[existingIndex] = { ...merged[existingIndex], amount: surcharge.amount };
        changed = true;
      }
      return;
    }
    const blankIndex = merged.findIndex((charge) => !charge.code && !charge.amount);
    if (blankIndex >= 0) merged[blankIndex] = { ...merged[blankIndex], ...surcharge, id: merged[blankIndex].id };
    else merged.push({ id: Date.now() + Math.random(), ...surcharge });
    changed = true;
  });
  return { charges: merged, changed };
}

export const sumOf = (rows, field) => rows.reduce((sum, row) => sum + (parseFloat(row[field]) || 0), 0);

export const rateLineTotal = (rateLines) =>
  rateLines.reduce((sum, line) => sum + (parseFloat(line.total) || parseFloat(line.totalAmount) || 0), 0).toFixed(2);

export const chargeSum = (charges) => charges.reduce((sum, charge) => sum + (parseFloat(charge.amount) || 0), 0);

export function todayIso() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export const newDocPouchId = () => Math.random().toString(36).substring(7);

export function loggedInUser() {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const claims = JSON.parse(atob(token.split('.')[1]));
      return claims.email ? claims.email.split('@')[0].toUpperCase() : 'ADMIN';
    }
  } catch {
    // unreadable token
  }
  return 'ADMIN';
}

// IATA MOD-7: the 8th digit of the serial is the first seven digits modulo 7
export function awbCheckDigitError(awbSuffix) {
  if (!awbSuffix || awbSuffix.length < 8) return null;
  const serial = parseInt(awbSuffix.substring(0, 7), 10);
  const checkDigit = parseInt(awbSuffix.substring(7, 8), 10);
  if (serial % 7 === checkDigit) return null;
  return `Invalid check digit (expected ${serial % 7}, got ${checkDigit}). MOD-7 validation failed.`;
}

export function splitMasterNumber(masterAwbNumber) {
  const parts = String(masterAwbNumber || '').split('-');
  if (parts.length === 2) return parts;
  const digits = String(masterAwbNumber || '').replace(/\D/g, '');
  return [digits.slice(0, 3), digits.slice(3)];
}

export function customsIdForParty(party, countryCode = '') {
  if (!party) return 'T';
  const idType = party.ctxType || party.addresses?.[0]?.ctxType || '';
  if (idType.toLowerCase() === 'passport') return 'P';
  return countryCode && EU_CUSTOMS_COUNTRIES.includes(countryCode) ? 'E' : 'T';
}

export const consigneeCountryFix = (countryCode) => CONSIGNEE_COUNTRY_FIXES[countryCode] || countryCode;

const TAX_ID_FIELDS = ['regNo', 'gstin', 'taxId', 'vat', 'iec', 'panNumber'];
const GSTIN_PATTERN = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/;
const IEC_PATTERN = /\b\d{10}\b/;
const VAT_PATTERN = /\b[A-Z]{2}[0-9]{2}[0-9A-Z]{6,10}\b/;

// a tax id field of the party, else a GSTIN / IEC / VAT number found in its name and address
export function taxIdFromParty(party) {
  if (!party) return '';
  const field = TAX_ID_FIELDS.find((name) => party[name]);
  if (field) return party[field].toUpperCase();
  const text = [party.name, party.address1, party.address2, party.city, party.state, party.zipCode, party.email].map((part) => part || '').join(' ').toUpperCase();
  const match = text.match(GSTIN_PATTERN) || text.match(IEC_PATTERN) || text.match(VAT_PATTERN);
  return match ? match[0] : '';
}

export function partyTaxNumber(party) {
  const firstAddress = party.addresses?.[0];
  return party.regNo || party.gstin || party.taxId || (firstAddress && (firstAddress.regNo || firstAddress.gstin)) || party.panNumber || party.iec || '';
}

export const partyCountryCode = (party, fallback) =>
  (party.countryCode || party.country || party.addresses?.[0]?.country || fallback || '').substring(0, 2).toUpperCase();

const GOODS_TEXT_LIMIT = 380;

// nature-of-goods text from a scanned invoice / packing list
export function goodsTextFromScan(data, densityGroup) {
  let text = 'SAID TO CONTAIN\n';
  if (data.commodityDescription) text += `${data.commodityDescription.toUpperCase()}\n`;
  if (data.hsCode) text += `HS CODE: ${data.hsCode}\n`;
  if (data.invoiceNumber) text += `INV NO.: ${data.invoiceNumber}\n`;
  if (data.invoiceDate) text += `INV DT.: ${data.invoiceDate}\n`;

  const measured = (Array.isArray(data.dimensions) ? data.dimensions : [])
    .filter((dimension) => parseFloat(dimension.length) && parseFloat(dimension.width) && parseFloat(dimension.height));
  const volumetricWeight = measured.reduce((sum, dimension) => sum + volWtFromDims([dimension], densityGroup), 0);
  if (volumetricWeight > 0) text += `VOL WT.: ${volumetricWeight.toFixed(2)} KG\n`;

  if (measured.length) {
    const dimensionText = measured
      .map((dimension) => `${parseInt(dimension.pieces, 10) || 1} PCS-${parseFloat(dimension.length)}X${parseFloat(dimension.width)}X${parseFloat(dimension.height)} ${dimension.unit || 'CM'}`)
      .join(', ');
    const dimensionLine = `DIMS: ${dimensionText}`;
    if (text.length + dimensionLine.length < GOODS_TEXT_LIMIT) text += dimensionLine;
  }
  return text.trim();
}

export const firstBranch = (agent) => {
  try {
    return JSON.parse(agent.branches)?.[0] || null;
  } catch {
    return null;
  }
};
