import { volWtFromDims } from '../../weightCalc';

export const COUNTRY_CURRENCY_MAP = {
  'IN': 'INR', 'US': 'USD', 'AE': 'AED', 'GB': 'GBP', 'EU': 'EUR',
  'SG': 'SGD', 'AU': 'AUD', 'CA': 'CAD', 'JP': 'JPY', 'CN': 'CNY',
  'HK': 'HKD', 'CH': 'CHF', 'SE': 'SEK', 'NO': 'NOK', 'DK': 'DKK',
  'NZ': 'NZD', 'MX': 'MXN', 'BR': 'BRL', 'ZA': 'ZAR', 'RU': 'RUB',
  'KR': 'KRW', 'TH': 'THB', 'MY': 'MYR', 'ID': 'IDR', 'PH': 'PHP',
  'VN': 'VND', 'BD': 'BDT', 'PK': 'PKR', 'LK': 'LKR', 'NP': 'NPR',
  'QA': 'QAR', 'SA': 'SAR', 'KW': 'KWD', 'BH': 'BHD', 'OM': 'OMR',
  'EG': 'EGP', 'NG': 'NGN', 'KE': 'KES', 'GH': 'GHS', 'TZ': 'TZS',
  'ET': 'ETB', 'MU': 'MUR', 'MV': 'MVR', 'NL': 'EUR', 'DE': 'EUR',
  'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'BE': 'EUR', 'AT': 'EUR',
  'PT': 'EUR', 'GR': 'EUR', 'FI': 'EUR', 'IE': 'EUR', 'TR': 'TRY',
  'IL': 'ILS', 'JO': 'JOD', 'LB': 'LBP', 'PL': 'PLN', 'CZ': 'CZK',
  'HU': 'HUF', 'RO': 'RON', 'HR': 'HRK', 'UA': 'UAH', 'AR': 'ARS',
  'CL': 'CLP', 'CO': 'COP', 'PE': 'PEN', 'UY': 'UYU',
};

// ICS2: a party in Europe / the UK files its EORI ('E'), anywhere else its tax id ('T')
export const EORI_COUNTRIES = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO'];

export const customsIdForParty = (party, countryCode = '') => {
  if (!party) return 'T';
  const ctxType = party.ctxType || party.addresses?.[0]?.ctxType || '';
  if (ctxType.toLowerCase() === 'passport') return 'P';
  if (countryCode && EORI_COUNTRIES.includes(countryCode)) return 'E';
  return 'T';
};

// SSR / OSI lines that come and go with their special handling code
export const SPH_TEXT_RULES = [
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

const removeLine = (text, line) => text.split('\n').filter((existing) => existing !== line).join('\n');
const addLine = (text, line) => (text.includes(line) ? text : (text ? `${text}\n` : '') + line);
const trimBlankLines = (text) => text.replace(/^\n+|\n+$/g, '');

// the SSR / OSI text after the special handling codes changed: lines of removed codes go, lines of present codes are added
export const textsForSphCodes = (sphCodes, ssrText, osiText) => {
  let ssr = ssrText || '';
  let osi = osiText || '';
  SPH_TEXT_RULES.forEach((rule) => {
    if (sphCodes.includes(rule.code)) return;
    if (rule.ssr) ssr = removeLine(ssr, rule.ssr);
    if (rule.osi) osi = removeLine(osi, rule.osi);
  });
  SPH_TEXT_RULES.forEach((rule) => {
    if (!sphCodes.includes(rule.code)) return;
    if (rule.ssr) ssr = addLine(ssr, rule.ssr);
    if (rule.osi) osi = addLine(osi, rule.osi);
  });
  return { ssr: trimBlankLines(ssr), osi: trimBlankLines(osi) };
};

export const SPH_SLOTS = 9;
export const emptySphCodes = () => Array(SPH_SLOTS).fill('');
const sphSlots = (codes) => [...codes, ...Array(SPH_SLOTS - codes.length).fill('')];

export const CARGO_TEMPLATES = {
  'GENERAL CARGO': { natureOfGoods: 'GENERAL CONSOLIDATION CARGO', sphCodes: sphSlots(['GEN']), ssrText: '' },
  'PERISHABLE GOODS': { natureOfGoods: 'FRESH VEGETABLES AND FRUITS', sphCodes: sphSlots(['PER']), ssrText: 'KEEP COOL AT 2-8 DEG C' },
  'DANGEROUS GOODS': { natureOfGoods: 'DANGEROUS GOODS AS PER ATTACHED DGD', sphCodes: sphSlots(['DGD', 'CAO']), ssrText: 'DANGEROUS GOODS SHIPPERS DECLARATION ATTACHED' },
  'PHARMACEUTICALS': { natureOfGoods: 'LIFE SAVING DRUGS / MEDICINES', sphCodes: sphSlots(['PIL', 'COL']), ssrText: 'MAINTAIN TEMPERATURE 15-25 DEG C' },
  'LIVE ANIMALS': { natureOfGoods: 'LIVE ANIMALS', sphCodes: sphSlots(['AVI']), ssrText: 'LIVE ANIMALS - DO NOT X-RAY' },
  'VALUABLE CARGO': { natureOfGoods: 'VALUABLE CARGO', sphCodes: sphSlots(['VAL', 'SEC']), ssrText: 'HIGH VALUE SECURITY REQUIRED' },
};

export const todayIsoDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export const newTempAwbId = () => Math.random().toString(36).substring(7);

export const loggedInUser = () => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email ? payload.email.split('@')[0].toUpperCase() : 'ADMIN';
    }
  } catch {
    return 'ADMIN';
  }
  return 'ADMIN';
};

// IATA MOD-7: the 8th digit of the serial is the first seven digits modulo 7
export const awbCheckDigitError = (awbSuffix) => {
  if (!awbSuffix || awbSuffix.length < 8) return null;
  const serial = parseInt(awbSuffix.substring(0, 7), 10);
  const checkDigit = parseInt(awbSuffix.substring(7, 8), 10);
  if (serial % 7 !== checkDigit) return `Invalid check digit (expected ${serial % 7}, got ${checkDigit}). MOD-7 validation failed.`;
  return null;
};

export const houseRow = (hawb) => ({
  id: hawb.id,
  type: 'H',
  awb: hawb.awbNumber || '',
  depDate: hawb.flightDate1 || '',
  org: hawb.origin || '',
  dest: hawb.destination || '',
  awbDate: hawb.createdAt ? hawb.createdAt.split('T')[0] : '',
  shc: 'GEN',
  pcs: hawb.totalPieces || 0,
  wt: parseFloat(hawb.grossWeight) || 0,
  vol: parseFloat(hawb.totalVolume) || 0,
  shipperName: hawb.shipperName || '',
  consigneeName: hawb.consigneeName || '',
});

export const CONSOLIDATION_GOODS = /^CONSOLIDATION AS PER MANIFEST\n\d+ PCS \/ [\d.]+ KGS$/;

export const houseTotals = (houses) => ({
  pieces: houses.reduce((sum, house) => sum + (parseInt(house.pcs, 10) || 0), 0),
  weight: +houses.reduce((sum, house) => sum + (parseFloat(house.wt) || 0), 0).toFixed(2),
  volume: +houses.reduce((sum, house) => sum + (parseFloat(house.vol) || 0), 0).toFixed(3),
});

const DEFAULT_SURCHARGE_RATES = { fuelPerKg: 10, securityPerKg: 5, awbFee: 500 };
const CARRIER_SURCHARGE_RATES = {
  '098': { fuelPerKg: 15, securityPerKg: 5, awbFee: 700 },
  '176': { fuelPerKg: 20, securityPerKg: 8, awbFee: 650 },
  '125': { fuelPerKg: 18, securityPerKg: 7, awbFee: 600 },
};

// AW (AWB fee), MY (fuel) and SC (security) due carrier for the airline of the AWB prefix
export const carrierSurcharges = (awbPrefix, chargeableWeight) => {
  const rates = CARRIER_SURCHARGE_RATES[awbPrefix] || DEFAULT_SURCHARGE_RATES;
  return [
    { code: 'AW', entitlement: 'carrier', amount: rates.awbFee.toFixed(2) },
    { code: 'MY', entitlement: 'carrier', amount: (rates.fuelPerKg * chargeableWeight).toFixed(2) },
    { code: 'SC', entitlement: 'carrier', amount: (rates.securityPerKg * chargeableWeight).toFixed(2) },
  ];
};

// a surcharge row already there gets the new amount; a new one takes the first empty row, else is added
export const withSurcharges = (charges, surcharges) => {
  const updated = [...charges];
  let changed = false;
  surcharges.forEach((surcharge) => {
    const existingIndex = updated.findIndex((charge) => charge.code === surcharge.code);
    if (existingIndex >= 0) {
      if (updated[existingIndex].amount !== surcharge.amount) {
        updated[existingIndex] = { ...updated[existingIndex], amount: surcharge.amount };
        changed = true;
      }
      return;
    }
    const emptyIndex = updated.findIndex((charge) => !charge.code && !charge.amount);
    const newRow = { ...surcharge, id: Date.now() + Math.random() };
    if (emptyIndex >= 0) updated[emptyIndex] = { ...updated[emptyIndex], ...newRow };
    else updated.push(newRow);
    changed = true;
  });
  return { charges: updated, changed };
};

export const rateLinesAmount = (rateLines) => rateLines.reduce((sum, row) => sum + (parseFloat(row.total) || parseFloat(row.totalAmount) || 0), 0).toFixed(2);

const amountOf = (value) => parseFloat(value) || 0;
export const sumOf = (rows, field) => rows.reduce((sum, row) => sum + amountOf(row[field]), 0);

const branchesOf = (agent) => {
  try {
    return JSON.parse(agent.branches) || [];
  } catch {
    return [];
  }
};

export const firstBranchCity = (agent) => {
  const branches = branchesOf(agent);
  return branches.length > 0 ? branches[0]?.city || '' : '';
};

// the AWB prints the agent's full first-branch address as its place
export const agentPrintPlace = (iataAgents, agentDetails) => {
  const agent = iataAgents.find((candidate) => candidate.name === agentDetails?.name);
  const branches = agent ? branchesOf(agent) : [];
  const branch = branches.length > 0 ? branches[0] : null;
  if (!branch) return agentDetails?.place || '';
  return [branch.address1, branch.address2, branch.city, branch.state, branch.country, branch.pinCode].filter(Boolean).join(', ');
};

const PARTY_TAX_FIELDS = ['regNo', 'gstin', 'taxId', 'vat', 'iec', 'panNumber'];
const GSTIN_PATTERN = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/;
const IEC_PATTERN = /\b\d{10}\b/;
const VAT_PATTERN = /\b[A-Z]{2}[0-9]{2}[0-9A-Z]{6,10}\b/;

// the party's tax id field, else a GSTIN / IEC / VAT number found in its name or address
export const partyTaxIdForOci = (party) => {
  if (!party) return '';
  const taxField = PARTY_TAX_FIELDS.find((field) => party[field]);
  if (taxField) return party[taxField].toUpperCase();
  const text = `${party.name || ''} ${party.address1 || ''} ${party.address2 || ''} ${party.city || ''} ${party.state || ''} ${party.zipCode || ''} ${party.email || ''}`.toUpperCase();
  const found = text.match(GSTIN_PATTERN) || text.match(IEC_PATTERN) || text.match(VAT_PATTERN);
  return found ? found[0] : '';
};

const GOODS_TEXT_LIMIT = 380;

// nature of goods from an OCR-read document: description, HS code, invoice and the dimension lines
export const goodsTextFromDocument = (data, densityGroup) => {
  let goodsText = 'SAID TO CONTAIN\n';
  if (data.commodityDescription) goodsText += `${data.commodityDescription.toUpperCase()}\n`;
  if (data.hsCode) goodsText += `HS CODE: ${data.hsCode}\n`;
  if (data.invoiceNumber) goodsText += `INV NO.: ${data.invoiceNumber}\n`;
  if (data.invoiceDate) goodsText += `INV DT.: ${data.invoiceDate}\n`;

  let volumetricWeight = 0;
  const dimensionTexts = [];
  (Array.isArray(data.dimensions) ? data.dimensions : []).forEach((dimension) => {
    const pieces = parseInt(dimension.pieces) || 1;
    const length = parseFloat(dimension.length) || 0;
    const width = parseFloat(dimension.width) || 0;
    const height = parseFloat(dimension.height) || 0;
    if (!(length && width && height)) return;
    volumetricWeight += volWtFromDims([dimension], densityGroup);
    dimensionTexts.push(`${pieces} PCS-${length}X${width}X${height} ${dimension.unit || 'CM'}`);
  });

  if (volumetricWeight > 0) goodsText += `VOL WT.: ${volumetricWeight.toFixed(2)} KG\n`;
  if (dimensionTexts.length > 0) {
    const dimensionLine = `DIMS: ${dimensionTexts.join(', ')}`;
    if (goodsText.length + dimensionLine.length < GOODS_TEXT_LIMIT) goodsText += dimensionLine;
  }
  return goodsText.trim();
};
