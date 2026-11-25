import { readTokenUser } from '@/components/common/tokenUser';

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

const EU_MEMBERS = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
// SCI T1 (EU transit) for these destinations
export const SCI_T1_COUNTRIES = [...EU_MEMBERS, 'CH', 'NO'];
// a consignee / shipper here gets customs id E (EORI) in the OCI rows
export const EORI_COUNTRIES = [...EU_MEMBERS, 'GB', 'CH', 'NO'];

// destination airports whose country is used for the SCI when the consignee has no country
export const AIRPORT_COUNTRY_FALLBACK = [
  [['FRA', 'MUC', 'HAM', 'CGN', 'LEJ'], 'DE'],
  [['CDG', 'ORY', 'LYS'], 'FR'],
  [['MXP', 'FCO', 'VCE'], 'IT'],
  [['AMS', 'EIN', 'RTM', 'MST'], 'NL'],
  [['MAD', 'BCN', 'VLC'], 'ES'],
  [['LHR', 'LGW', 'MAN'], 'GB'],
  [['BRU', 'LGG'], 'BE'],
];

// SSR / OSI lines written for each special handling code
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

export const SPH_BOXES = 9;
export const emptySphCodes = () => Array(SPH_BOXES).fill('');
const sphCodesWith = (...codes) => [...codes, ...Array(SPH_BOXES - codes.length).fill('')];

// the screen's own template presets (LOAD in the template box of this screen)
export const TEMPLATE_PRESETS = {
  'GENERAL CARGO': { natureOfGoods: 'GENERAL CONSOLIDATION CARGO', sphCodes: sphCodesWith('GEN'), ssrText: '' },
  'PERISHABLE GOODS': { natureOfGoods: 'FRESH VEGETABLES AND FRUITS', sphCodes: sphCodesWith('PER'), ssrText: 'KEEP COOL AT 2-8 DEG C' },
  'DANGEROUS GOODS': { natureOfGoods: 'DANGEROUS GOODS AS PER ATTACHED DGD', sphCodes: sphCodesWith('DGD', 'CAO'), ssrText: 'DANGEROUS GOODS SHIPPERS DECLARATION ATTACHED' },
  'PHARMACEUTICALS': { natureOfGoods: 'LIFE SAVING DRUGS / MEDICINES', sphCodes: sphCodesWith('PIL', 'COL'), ssrText: 'MAINTAIN TEMPERATURE 15-25 DEG C' },
  'LIVE ANIMALS': { natureOfGoods: 'LIVE ANIMALS', sphCodes: sphCodesWith('AVI'), ssrText: 'LIVE ANIMALS - DO NOT X-RAY' },
  'VALUABLE CARGO': { natureOfGoods: 'VALUABLE CARGO', sphCodes: sphCodesWith('VAL', 'SEC'), ssrText: 'HIGH VALUE SECURITY REQUIRED' },
};

// carrier surcharges per kg (fuel MY, security SC) and the flat AWB fee (AW) by airline prefix
const DEFAULT_SURCHARGES = { fuelPerKg: 10, securityPerKg: 5, awbFee: 500 };
const CARRIER_SURCHARGES = {
  '098': { fuelPerKg: 15, securityPerKg: 5, awbFee: 700 }, // Air India
  '176': { fuelPerKg: 20, securityPerKg: 8, awbFee: 650 }, // Emirates
  '125': { fuelPerKg: 18, securityPerKg: 7, awbFee: 600 }, // British Airways
};

export function carrierBaseCharges(awbPrefix, chargeableWeight) {
  const rates = CARRIER_SURCHARGES[awbPrefix] || DEFAULT_SURCHARGES;
  return [
    { code: 'AW', entitlement: 'carrier', amount: rates.awbFee.toFixed(2) },
    { code: 'MY', entitlement: 'carrier', amount: (rates.fuelPerKg * chargeableWeight).toFixed(2) },
    { code: 'SC', entitlement: 'carrier', amount: (rates.securityPerKg * chargeableWeight).toFixed(2) },
  ];
}

export const newChargeRowId = () => Date.now() + Math.random();

// base charge into the other-charge rows: its own row, else the first empty row, else a new row
export function placeBaseCharge(charges, baseCharge, overwrite) {
  const existingIndex = charges.findIndex((charge) => charge.code === baseCharge.code);
  if (existingIndex >= 0) {
    if (!overwrite(charges[existingIndex])) return false;
    charges[existingIndex] = { ...charges[existingIndex], amount: baseCharge.amount };
    return true;
  }
  const emptyIndex = charges.findIndex((charge) => !charge.code && !charge.amount);
  if (emptyIndex >= 0) charges[emptyIndex] = { ...charges[emptyIndex], ...baseCharge, id: charges[emptyIndex].id };
  else charges.push({ id: newChargeRowId(), ...baseCharge });
  return true;
}

export const sumOf = (rows, valueOf) => rows.reduce((sum, row) => sum + (valueOf(row) || 0), 0);

export const initialOtherCharges = () => [
  { id: 1, code: '', entitlement: 'carrier', ppcc: 'PP', description: '', amount: '' },
  { id: 2, code: '', entitlement: 'agent', ppcc: 'PP', description: '', amount: '' },
];

export const DEFAULT_AGENT = { name: '', code: '', place: '', account: '', docs: 'SHIPMENT WITH DOCUMENTS', eori: '', accountingInfo: 'FREIGHT PREPAID' };

export const DRAFT_STORAGE_KEY = 'CreateAirWaybill_DRAFT';

export const newTempAwbId = () => Math.random().toString(36).substring(7);

export const todayIso = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export const loggedInUser = () => {
  const { email } = readTokenUser();
  return email ? email.split('@')[0].toUpperCase() : 'ADMIN';
};

// first branch of an IATA agent ({ city, address1 ... }), or null
export function firstBranchOf(agent) {
  try {
    const branches = JSON.parse(agent.branches);
    return branches && branches.length > 0 ? branches[0] : null;
  } catch {
    return null;
  }
}

export const listOrEmpty = (answer) => (Array.isArray(answer) ? answer : []);

export const countryCodeOf = (value) => String(value || '').toUpperCase().substring(0, 2);
