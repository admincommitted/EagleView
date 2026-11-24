/**
 * ICEGATE JSON Builder
 * Builds CACHI01 (BE) and CACHE01 (SB) JSON payloads
 * as per ICEGATE API Contract v1.4 and Schema v1.2
 */

const IcegateProfile = require('../models/IcegateProfile');

// 20-Nov-2026: is this customs location an Inland Container Depot? The Port master's category (ICD) decides; a code
// not in the master is taken as an ICD when it ends in 6 (INTKD6 Tughlakabad, INPPG6 Patparganj ...).
async function isIcdLocation(code) {
  const c = String(code || '').trim().toUpperCase(); if (!c) return false;
  try {
    const p = await require('../models/Port').findOne({ where: { portCode: c }, attributes: ['category'], raw: true });
    if (p && p.category) return String(p.category).trim().toUpperCase() === 'ICD';
  } catch (e) { /* master not readable: by the code */ }
  return /^IN[A-Z0-9]{3}6$/.test(c);
}

// Helper: get current sequence number (auto-increment)
let _seqNo = Math.floor(Date.now() / 1000) % 9999999;
// Sequence/control no. must be unique per transmission (1-9999999). The old counter restarted at 1 on every
// server restart (same numbers again); now it starts from the clock and only goes up. 28-Oct-2026
// Job Header keeps the CHA as "NAME - CODE" (picked from CHA Master); ICEGATE wants only the code.
// Before this the 15-char cut sent e.g. "COMMITTED CARGO" as chaCode. 28-Oct-2026
function chaCodeOf(v) {
  const t = String(v || '').trim();
  const i = t.lastIndexOf(' - ');
  return (i >= 0 ? t.slice(i + 3) : t).trim().toUpperCase();
}

function nextSeq() {
  const clock = (Math.floor(Date.now() / 1000) % 9999999) + 1;
  _seqNo = Math.max(_seqNo + 1, clock);
  if (_seqNo > 9999999) _seqNo = 1;
  return _seqNo;
}

// ICEGATE misc-charge (MISC_CH) directory, codes A..N in directory order; D / M / N confirmed from filed BEs (30-Oct-2026)
const MISC_CODE_OF = Object.fromEntries(['BROKERAGE AND COMMISSIONS', 'COST OF CONTAINERS', 'COST OF PACKING', 'HANDLING CHARGES', 'COST OF GOODS AND SERVICES', 'DOCUMENTATION',
  'COUNTRY OF ORIGIN CERTIFICATE', 'LOYALTIES AND LICENCE FEES', 'VALUE OF PROCEEDS WHICH ACCURE', 'COST OF WARRANTY SERVICES', 'OTHER COST OR PAYMENT',
  'OTHER CHARGES AND PAYMENT', 'LOADING CHARGES', 'UNLOADING CHARGES'].map((d, i) => [d, String.fromCharCode(65 + i)]));
// ICEGATE currency directory names (exchange rows of the SB carry them, e.g. US DOLLAR). 29-Oct-2026
// CBIC notifies the rate of exchange in two schedules: Schedule I is rupees per 1 unit, Schedule II is rupees per
// 100 units and holds exactly two currencies - Japanese Yen and Korean Won. ICEGATE wants the notified figure with
// its unitInRs, so the SB exchange row is always filed in that notation.
// 30-Oct-2026: the export screens did not keep unitInRs at all, so every SB filed JPY / KRW as "per 1" and the FOB
// on the Shipping Bill came out 100 times too big. Rows saved before the screens were fixed carry no unitInRs, and
// there is no way to know from the row alone which of the two figures was stored - so it is taken from the size of
// the rate. JPY and KRW have never been anywhere near Rs 5 a unit (they sit around Rs 0.5), while the notified
// per-100 figure is around 55, so the two cannot be confused.
const PER_100_CURRENCIES = ['JPY', 'KRW'];
function sbExchRate(cur, rate, unitInRs) {
  const c = String(cur || '').trim().toUpperCase();
  const want = PER_100_CURRENCIES.includes(c) ? 100 : 1;
  const r = n(rate);
  if (!r) return { unitInRs: fx(want, 2), rate: fx(0, 4) };
  const stored = n(unitInRs) || (want === 100 ? (r > 5 ? 100 : 1) : 1);
  const perUnit = r / (stored || 1);
  return { unitInRs: fx(want, 2), rate: fx(perUnit * want, 4) };
}

const CURRENCY_NAMES = {"AFA":"AFGAHANI","ALL":"ALBANIAN LEK","DZD":"ALGERIAN DINAR","ADP":"ANDORAN PESTA","AON":"ANGOLAN NEW KWANZA","ARS":"ARGENTINE PESOS","AMD":"ARMENIAN DRAM","AWG":"ARUBAN GUILDER","AUD":"AUSTRALIAN DOLLAR","ATS":"AUSTRIAN SCHILLING","AZM":"AZERBAIJAN MANAT","BSD":"BAHAMIAN DOLLAR","BHD":"BAHRAINI DINAR","BDT":"BANGLADESH TAKA","BBD":"BARBADOS DOLLAR","BYB":"BELARUSSIAN RUBLE","BEF":"BELGIAN FRANC","BZD":"BELIZE DOLLAR","BMD":"BERMUDIAN DOLLAR","BTN":"BHUTAN NGULTRUM","BOB":"BOLIVIAN BOLIVIANO","BWP":"BOTSWANA PULA","BRL":"BRAZILIAN REAL","BND":"BRUNEI DOLLAR","BGL":"BULGARIAN LEV","BIF":"BURUNDI FRANC","KHR":"CAMBODIAN REIL","CAD":"CANADIAN DOLLAR","CVE":"CAPE VERDE ESCUDO","KYD":"CAYMAN ISLANDS DOLLA","XOF":"CFA FRANC","XAF":"CFA FRANC","XPF":"CFP FRANCS","CLP":"CHILEAN PESO","COP":"COLOMBIAN PESO","KMF":"COMOROS FRANC","CRC":"COSTA RICAN COLON","HRK":"CROATIA KUNA","CUP":"CUBAN PESO","CYP":"CYPRUS POUND","DKK":"DANISH KRONE","DEM":"DEUTSCH MARK","DJF":"DJIBOUTI FRANC","STD":"DOBRA","DOP":"DOMINICAN PESO","XCD":"EAST CARRIBEAN DOLLA","ECS":"ECUADOR SUCRE","EGP":"EGYPTIAN POUND","SVC":"EL SALVADOR COLON","EEK":"ESTONIAN KROON","ETB":"ETHOPIAN BIRR","EUR":"EURO","EU":"EURO","FKP":"FALKLAND ISLANDSPOUN","FJD":"FIJI DOLLAR","FIM":"FINISH MARKKA","FRF":"FRENCH FRANC","GMD":"GAMBIAN DALASI","GEL":"GEORGIAN LARI","GHC":"GHANA CEDI","GIP":"GIBRALTAR POUND","GRD":"GREEK DRACHMA","GTQ":"GUATEMALA QUETZAL","GNF":"GUINEA FRANC","GWP":"GUINEA-BISSAU PESO","GYD":"GUYANA DOLLAR","HTG":"HAITI GOURDE","HNL":"HONDURAS LEMPIRA","HKD":"HONGKONG DOLLAR","UAH":"HRYVNIA","HUF":"HUNGARIAN FORINT","ISK":"ICELAND KRONA","INR":"INDIAN RUPEE","IDR":"INDONESIAN RUPIAH","IRR":"IRANIAN RIAL","IQD":"IRAQI DINAR","IEP":"IRISH POUNDS","ILS":"ISRAELI SHEKEL","ITL":"ITALIAN LIRA","JMD":"JAMAICAN DOLLAR","JPY":"JAPANESE YEN","JOD":"JORDANIAN DINAR","KZT":"KAZAKSTAN TENGE","KES":"KENYAN SHILLING","PGK":"KINA","KRW":"SOUTH KOREAN WON","CZK":"KORUNA","KWD":"KUWAITI DINAR","ZMK":"KWACHA","NMK":"KYAT","KGS":"KYRGYZSTAN SOM","LAK":"LAOS KIP","LVL":"LATVIAN LAT","LBP":"LEBANESE POUND","SLL":"LEONE","LSL":"LESOTHO LOTI","LRD":"LIBERIAN DOLLAR","LYD":"LIBYAN DINAR","SZL":"LILANGENI","LTL":"LITHUANIAN LITAS","LUF":"LUXEMBOURG FRANCS","MOP":"MACAU PATACA","MKD":"MACEDONIAN DENAR","MGF":"MALAGASSY FRANC","MWK":"MALAWIAN KWACHA","MYR":"MALAYSIAN RINGGIT","MVR":"MALDIVE RUFIYAA","MTL":"MALTESE LIRA","MRO":"MAURITANIAN OUGUIYA","MUR":"MAURITIUS RUPEE","MXN":"MEXICAN PESO","MDL":"MOLDOVAN LEU","MNT":"MONGOLIAN TUGRIK","MAD":"MORACCAN DIRHAM","MZM":"MOZAMBIQUE METICAL","NAD":"NAMIBIA DOLLAR","NPR":"NEPALESE RUPEE","ANG":"NETHERLAND ANTILLIAN","NLG":"NETHERLANDS GUILDER","BAM":"NEW DINAR","TWD":"NEW TAIWAN DOLLAR","NZD":"NEW ZEALAND DOLLAR","NIO":"NICARAGUAN CORDOBA O","NGN":"NIGERIAN NAIRA","KPW":"NORTH KOREAN WON","NOK":"NORWEGIAN KRONES","PKR":"PAKISTANI RUPEE","PAB":"PANAMAN BALBOA","PYG":"PARAGUAY GUARANI","TOP":"PARANGA","PEN":"PERUVIAN NUEVO SOL","UYU":"PESO","PHP":"PHILLIPINES PESOS","PLN":"POLISH ZLOTY","PTE":"PORTUGUESE ESCUDO","GBP":"POUND STERLING","QAR":"QATARI RIAL","ZAR":"SOUTH AFRICAN RAND","OMR":"RIAL OMANIS","ROL":"ROMANIAN LEU","RUR":"ROUBLE","RUB":"RUSSIAN ROUBLE","RWF":"RWANDA FRANC","SAR":"SOUTH ARABIAN RIYAL","SCR":"SEYCHELLES RUPEE","SGD":"SINGAPORE DOLLAR","SKK":"SLOVAKI KORUNA","SIT":"SLOVENIAN TOLAR","SBD":"SOLOMAN ISLANDS DOLL","SOS":"SOMALI SHILLING","ESP":"SPANISH PESETA","LKR":"SRI LANKA RUPEE","SHP":"ST. HELENA POUND","SDD":"SUDANESE DINAR","SRG":"SURINAME GUILDER","SEK":"SWEDISH KRONA","CHF":"SWISS FRANC","SYP":"SYRIAN POUND","TJR":"TAJIK ROUBLE","WST":"TALA","TZS":"TANZANIAN SCHILLING","THB":"THAI BAHTS","TPE":"TIMOR ESCUDO","TTD":"TRINIDAD&TOBAGO DOLL","TMM":"TURKEMENI MANAT","TRY":"TURKISH LIRA","TRL":"TURKISH LIRA","TND":"TURNISIAN DINAR","AED":"UAE DIRHAM","UGX":"UGANDA SHILLING","USD":"US DOLLAR","UZS":"UZBEKISTAN SUM","VUV":"VATU","VEB":"VENEZUELAN BOLIVAR","VND":"VIETNAM DONG","YER":"YEMENI RIAL","CNY":"YUAN RENMINBI","ZRN":"ZAIRE","ZWD":"ZIMBABWE DOLLAR"};
// Helper: format date YYYYMMDD
// Indian screens use DD/MM/YYYY or DD-MM-YYYY; new Date() read those as MM/DD (05/10 became 10 May). 28-Oct-2026
function fmtDate(d) {
  if (!d) return '';
  const t = String(d).trim();
  let m;
  // 18-Nov-2026: a date-time from the database ("2026-11-17T18:30:00.000Z" = 18-Nov midnight IST, how a DATE column
  // comes back) was cut to its UTC day, one day early - the exchange rate of CBIC 31/2026 (effective 18-Nov) went as
  // 20261117. A value with a time and a zone (or a Date) is read as its day in India (UTC+5:30).
  // (SQLite also gives "2026-11-17 18:30:00.000 +00:00")
  const zoned = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(Z|[+-]\d{2}:?\d{2})$/.exec(t);
  if (d instanceof Date || zoned) {
    const dt = d instanceof Date ? d : new Date(zoned[1] + 'T' + zoned[2] + (zoned[3] === 'Z' ? 'Z' : zoned[3].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')));
    if (!isNaN(dt)) { const x = new Date(dt.getTime() + 330 * 60000); return x.getUTCFullYear() + String(x.getUTCMonth() + 1).padStart(2, '0') + String(x.getUTCDate()).padStart(2, '0'); }
  }
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t))) return m[1] + m[2].padStart(2, '0') + m[3].padStart(2, '0');
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0');
  if (/^\d{8}$/.test(t)) return t;
  const dt = d instanceof Date ? d : new Date(t);
  if (isNaN(dt)) return t.replace(/[-/]/g, '').substring(0, 8);
  return dt.getFullYear() + String(dt.getMonth() + 1).padStart(2, '0') + String(dt.getDate()).padStart(2, '0');
}

// Helper: safe string trim
function s(v, max) {
  const str = String(v || '').trim();
  return max ? str.substring(0, max) : str;
}

// Helper: safe number
function n(v) { return Number(v) || 0; }

// Fixed decimals as text, the way production BE files carry them (quantity 6, value 2, rate 4, weight 3).
// Empty stays empty. 28-Oct-2026 (checked against 5 BE JSON files made by Icaffe)
function fx(v, dec) {
  if (v === undefined || v === null || String(v).trim() === '') return '';
  const num = Number(String(v).replace(/,/g, '').trim());
  return isNaN(num) ? String(v).trim() : num.toFixed(dec);
}
function intStr(v) {
  if (v === undefined || v === null || String(v).trim() === '') return '';
  const num = parseInt(String(v).replace(/,/g, ''), 10);
  return isNaN(num) ? String(v).trim() : String(num);
}

// Country code -> name from the Country master (supplierCountryName is a name, e.g. SINGAPORE). 28-Oct-2026
async function countryNameMap() {
  try {
    const Country = require('../models/Country');
    const rows = await Country.findAll({ attributes: ['code', 'name'], raw: true });
    const m = {};
    rows.forEach(r => { if (r.code) m[String(r.code).trim().toUpperCase()] = String(r.name || '').trim().toUpperCase(); });
    return m;
  } catch (e) { return {}; }
}

/**
 * Build BE CACHI01 JSON from jobData + items + invoices
 * Field mapping based on JobHeaderTab.jsx autoField_* labels
 */
// Item popups (Other Duty, NCD, Anti-dumping, Customs CVD, SVB, Policy para, Previous BE, RSP, Re-import) keep their
// values in small objects on the item; the BE JSON reads flat fields. Copy them across (a value typed in the item
// form itself wins). 28-Oct-2026
function flattenItemPopups(item) {
  const o = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return v && typeof v === 'object' ? v : {}; };
  const it = { ...item };
  const set = (k, v) => { if ((it[k] === undefined || it[k] === null || String(it[k]).trim() === '') && v !== undefined && v !== null && String(v).trim() !== '') it[k] = String(v).trim(); };
  if (!it.unit && it.uqc) it.unit = it.uqc;
  const od = o(it.otherDutyData);
  [['Add1(SIA)', 'additionalNotification1', 'additionalNotification1SrNo'], ['Add2(S2)', 'additionalNotification2', 'additionalNotification2SrNo'],
   ['Other(TTA)', 'otherNotification', 'otherNotificationSrNo'], ['Cess', 'cusEducessNotfnNumber', 'cusEducessNotfnSrNo'], ['Health', 'healthNotn', 'healthSrNo'],
   ['Aggregate', 'aggregateDutyNotn', 'aggregateDutyNotnSrNo'], ['Safe Guard', 'safeguardDutyNotn', 'safeguardDutyNotnSrNo']]
    .forEach(([d, kn, ks]) => { set(kn, od[d + '_notnNo']); set(ks, od[d + '_srNo']); });
  const cvd = o(it.cvdData); set('cvdNotificationNo', cvd.notnNo); set('cvdSrNo', cvd.srNo);
  const ncd = o(it.ncdData); set('ncdNotn', ncd.ncdNotificationNo); set('ncdNotnSrNo', ncd.ncdSrNo);
  const add = o(it.addData && Object.keys(o(it.addData)).length ? it.addData : it.antiDumpingData);
  set('antiDumpingDutyNotification', add.notnNo); set('antiDumpingDutySerialNumber', add.srNo); set('cthSerialNumber', add.cth);
  set('supplierSerialNumber', add.supSlNo); set('quantityAsPerAntiDumpingNotn', add.qty);
  const svb = o(it.svbData && Object.keys(o(it.svbData)).length ? it.svbData : it.svbItemData);
  // the item form's SVB box is a Y/N switch; ICEGATE's svbFlag is the load type A/D/B
  // the popup's box is "flag" (A/D/B), the Excel reader's is loadType - both are the load type (30-Oct-2026)
  const svbType = String(svb.loadType || svb.flag || '').trim().toUpperCase();
  it.svbFlag = /^[ADB]$/.test(svbType) && (svb.refNo || svb.loadValue || svb.loadDuty || it.svbReferenceNumber) ? svbType : (/^[ADB]$/.test(String(item.svbFlag || '')) ? item.svbFlag : '');
  set('svbReferenceNumber', svb.refNo); set('svbReferenceDate', svb.date); set('svbLoadAssessableValue', svb.loadValue); set('svbLoadOnDuty', svb.loadDuty);
  set('whetherLoadProvisionalOnAssessableValue', svb.valueStatus); set('whetherLoadProvisionalOnDuty', svb.dutyStatus);
  set('customHouseCodeWhichHasImposedLoad', svb.customHouse1 || svb.customHouse);
  const pp = o(it.policyParaData); set('policyParaNo', pp.paraNo); set('policyYear', pp.year);
  const pb = o(it.prevBeData && Object.keys(o(it.prevBeData)).length ? it.prevBeData : it.previousBeData);
  set('previousBeNo', pb.beNo); set('previousBeDate', pb.beDate); set('prevUnitPriceInvoiced', pb.unitPrice); set('prevCurrencyCode', pb.currency); set('prevCustomSite', pb.customHouse);
  const rsp = o(it.rspData);
  const rf = String(it.rspDutyFlag || rsp.rspDutyFlag || '').trim().toUpperCase();
  if (/^[YNQTDCS]$/.test(rf)) it.rspApplicability = rf;
  const re = o(it.reimportData);
  if (String(re.type || '').toUpperCase() === 'Y' || re.shippingBillNo || re.prevBeNo) it.whetherReimport = 'Y';
  return it;
}

async function buildBE_CACHI01(jobData, items = [], invoices = [], opts = {}) {
  items = (items || []).map(flattenItemPopups);
  // Get sender ID from selected profile or default
  let icegateId = '';
  if (opts.profileId) {
    const p = await IcegateProfile.findByPk(opts.profileId);
    if (p) icegateId = p.loginId;
  } else {
    const dp = await IcegateProfile.findOne({ where: { isDefault: true } });
    if (dp) icegateId = dp.loginId;
  }

  const chaCode    = chaCodeOf(jobData.autoField_3 || jobData.chaCode) || icegateId;
  const today      = fmtDate(new Date());
  const seq        = nextSeq();

  // autoField mapping (from JobHeaderTab labels):
  // autoField_1  = Location (Customs Location/Port Code e.g. INNSAV1)
  // autoField_2  = Port Code short
  // autoField_3  = CHA Details (CHA Code)
  // autoField_4  = IEC Name (Importer Name)
  // autoField_5  = IEC Code
  // autoField_6  = Address 1
  // autoField_7  = Address 2
  // autoField_8  = City
  // autoField_9  = State
  // autoField_10 = Pin
  // autoField_11 = CTX State
  // autoField_12 = State Code
  // autoField_13 = Registration No (GSTIN)
  // autoField_14 = BE Date / Prior BE Date
  // autoField_15 = IGM Date
  // autoField_16 = BL/AWB Date
  // autoField_18 = IGM No
  // autoField_19 = BL/AWB No
  // autoField_20 = Country of Origin
  // autoField_21 = Country of Consignment
  // autoField_22 = Port of Shipment
  // autoField_23 = Master BL No
  // autoField_24 = Vessel/Flight No
  // autoField_25 = Rotation No
  // autoField_30 = Foreign Exchange amount
  // autoField_46 = Govt IEC (Y/N)
  // autoField_47 = Branch Sr No
  // autoField_48 = Branch No (1/2/3)
  // autoField_50 = CTX Type (GSTIN etc)
  // autoField_51 = BE Type (H/W/X)
  // autoField_52 = Mode of Transport (S/A/L)
  // autoField_53 = Importer Type
  // autoField_55 = Green Channel (Y/N)

  const d = jobData || {};

  // Location code. The Job Header keeps the port NAME in autoField_1 and the code in portCode / autoField_2, so
  // autoField_1 first sent e.g. "ACC,Ne" as the customs house. A file import keeps the code in autoField_1. 28-Oct-2026
  const looksPort    = (v) => /^[A-Z]{2}[A-Z0-9]{3,4}$/.test(String(v || '').trim().toUpperCase());
  const portCode     = s(String(d.portCode || d.autoField_2 || (looksPort(d.autoField_1) ? d.autoField_1 : '') || '').trim().toUpperCase(), 6);
  const iecCode      = s(d.autoField_5 || d.iecCode, 10);
  const importerName = s(d.autoField_4, 50);
  const chaCodeVal   = s(chaCode, 15);
  // The header's BE Type / Mode (sent as opts) is what the user sees, so it wins over autoField_51/52.
  // Only H/W/X and S/A/L are valid; anything else (e.g. an importer type that was stored in autoField_51) is ignored. 28-Oct-2026
  const pick1 = (vals, ok, dflt) => { for (const v of vals) { const c = String(v || '').trim().toUpperCase().charAt(0); if (ok.includes(c)) return c; } return dflt; };
  const beType       = pick1([opts.beType, d.autoField_51], 'HWX', 'H');
  const modeTransport= pick1([opts.transportMode, d.autoField_52], 'SAL', 'S');
  // 20-Nov-2026: a sea job at an ICD is filed with mode L (Land), as iCAFFE files it - BE 5098978 (iCAFFE 7675, ICD
  // Tughlakabad, gateway port Mundra) went as "L" and was accepted; EagleView sent "S". The job stays Sea on the screen
  // (gateway IGM and containers); only the file's mode of transport says Land.
  const fileMode     = modeTransport === 'S' && await isIcdLocation(portCode) ? 'L' : modeTransport;
  const countryNames = await countryNameMap();
  const countryName  = (v) => { const t = String(v || '').trim(); return t.length <= 3 && countryNames[t.toUpperCase()] ? countryNames[t.toUpperCase()] : t.toUpperCase(); };

  const hasInvValue = (inv) => String(inv.value || inv.invoiceValue || inv.invValue || '').trim() !== '' && n(inv.value || inv.invoiceValue || inv.invValue) !== 0;
  // Build full invoiceModel with all ICEGATE fields
  const invoiceModel = (invoices && invoices.length > 0 ? invoices : [{}]).map((inv, i) => ({
    messageType:                    opts.isAmendment ? 'A' : 'F',
    customHouseCode:                portCode,
    beNumber:                       s(d.beNo || d.beNumber || ''),
    beDate:                         fmtDate(d.beDate || ''),
    invoiceSerialNumber:            String(i + 1),
    invoiceDate:                    fmtDate(inv.invDate || inv.invoiceDate || inv.invoice_date || ''), // the screen box (invDate) first - an edited date was filed with the old invoiceDate (30-Oct-2026)
    purchaseOrderNumber:            s(inv.purchaseOrderNo || inv.purchaseOrderNumber || ''),
    purchaseOrderDate:              fmtDate(inv.purchaseOrderDate || ''),
    contractNumber:                 s(inv.contractNo || inv.contractNumber || ''),
    contractDate:                   fmtDate(inv.contractDate || ''),
    lcNumber:                       s(inv.lcNo || inv.lcNumber || ''),
    lcDate:                         fmtDate(inv.lcDate || ''),
    svbReferenceNumber:             s(inv.svbReferenceNumber || ''),
    svbReferenceDate:               fmtDate(inv.svbReferenceDate || ''),
    // 12-Nov-2026: a filed SVB invoice carries the load % with 5 decimals, 0.00000 included (iCAFFE BEs)
    svbLoadAssessableValue:         (inv.svbReferenceNumber && String(inv.svbLoadAssessableValue ?? '').trim() !== '' && isFinite(Number(inv.svbLoadAssessableValue))) ? Number(inv.svbLoadAssessableValue).toFixed(5) : s(inv.svbLoadAssessableValue || ''),
    svbLoadOnDuty:                  s(inv.svbLoadOnDuty || ''),
    svbFlag:                        s(inv.svbFlag || ''),
    whetherloadProvisionalOnAssValue: s(inv.whetherloadProvisionalOnAssValue || ''),
    whetherProvisionalOnDuty:       s(inv.whetherProvisionalOnDuty || ''),
    customHouseCodeWhichHasImposedLoad: s(inv.customHouseCodeWhichHasImposedLoad || ''),
    // schema allows 100 / validator 70 - cutting at 35 lost half of many supplier names. 29-Oct-2026
    supplierName:                   s(inv.supplierName || '', 70),
    supplierAddress1:               s(inv.supplierAddress1 || '', 70),
    supplierAddress2:               s(inv.supplierAddress2 || '', 35),
    supplierAddress3:               s(inv.supplierAddress3 || '', 35),
    supplierCountryName:            s(countryName(inv.supplierCountryName || inv.supplierCountry || ''), 35),
    supplierPin:                    s(inv.supplierPin || ''),
    sellerName:                     s(inv.sellerName || ''),
    sellerAddress1:                 s(inv.sellerAddress1 || ''),
    sellerAddress2:                 s(inv.sellerAddress2 || ''),
    sellerAddress3:                 s(inv.sellerAddress3 || ''),
    sellerCountryName:              s(countryName(inv.sellerCountryName || inv.sellerCountry || ''), 35),
    sellerPin:                      s(inv.sellerPin || ''),
    brokerName:                     s(inv.brokerName || ''),
    brokerAddress1:                 s(inv.brokerAddress1 || ''),
    brokerAddress2:                 s(inv.brokerAddress2 || ''),
    brokerAddress3:                 s(inv.brokerAddress3 || ''),
    brokerCountry:                  s(inv.brokerCountry || ''),
    brokerPin:                      s(inv.brokerPin || ''),
    invoiceValue:                   hasInvValue(inv) ? fx(inv.value || inv.invoiceValue || inv.invValue, 2) : '',
    termsOfInvoice:                 s(inv.terms || inv.termsOfInvoice || ''),
    invoiceCurrency:                s(inv.currency || inv.invoiceCurrency || ''),
    natureOfDiscount:               s(inv.natureOfDiscount || ''),
    discountRate:                   fx(inv.discountRate, 4),
    discountAmount:                 fx(inv.discountAmount, 2),
    hssLoadRate:                    fx(inv.hssLoadRate, 2), // filed HSS BEs carry 2 decimals (2.00), 29-Oct-2026
    hssLoadAmount:                  fx(inv.hssLoadAmount, 2),
    freightValue:                   fx(inv.freightValue, 2),
    freightRate:                    fx(inv.freightRate, 4),
    // 30-Oct-2026: the box wins; else Y when an actual freight amount is declared, N when the freight is notional (a
    // rate, or included in CIF / CF terms). The old blanket N filed a declared amount as "not actual".
    // 18-Nov-2026: back to N unless the box says Y - iCAFFE files N on every BE, a declared freight amount included
    // (8870: 10718.25 HKD -> N; 156 of 156 loaded iCAFFE invoices with a freight amount carry N), and ICEGATE takes it
    whetherFreightActual:           s(inv.whetherFreightActual || (hasInvValue(inv) ? 'N' : ''), 1).toUpperCase(),
    // currency only goes with an amount; a % rate has no currency (as in production files). 28-Oct-2026
    freightCurrency:                s(inv.freightCurrency || (n(inv.freightValue) ? (inv.currency || inv.invoiceCurrency || '') : ''), 3),
    // 21-Nov-2026: 4 decimals, as iCAFFE files it ("1.1250", "0.0120": 7675, 7342, 8870); was the typed decimals ("1.125")
    insuranceRate:                  (() => { if (n(inv.insuranceRate) > 0) return fx(inv.insuranceRate, 4); const v = fx(inv.insuranceRate, 4); return /\.\d\d00$/.test(v) ? v.slice(0, -2) : v; })(), // a 0 / blank rate as before
    insuranceValue:                 (() => { const v = fx(inv.insuranceValue, 4); return /\.\d\d00$/.test(v) ? v.slice(0, -2) : v; })(), // up to 4 decimals (0.0343 was sent as 0.03), 29-Oct-2026
    // 21-Nov-2026: the currency goes only with an insurance AMOUNT; a rate (%) has none - iCAFFE leaves it blank
    // (7675, 7342, 8870), EagleView sent the typed / invoice currency with the rate
    insuranceCurrency:              n(inv.insuranceValue) ? s(inv.insuranceCurrency || inv.currency || inv.invoiceCurrency || '', 3) : '',
    miscCharges:                    fx(inv.miscCharges, 2),
    miscCurrency:                   s(inv.miscCurrency || ''),
    miscChargesRate:                fx(inv.miscChargesRate, 4),
    landingRate:                    fx(inv.landingRate, 4),
    loadingCharges:                 fx(inv.loadingCharges || inv.loadingAmount, 2),
    loadingCurrency:                s(inv.loadingCurrency || ''),
    loadRate:                       fx(inv.loadRate || inv.loadingRate, 4),
    agencyCommission:               fx(inv.agencyCommission || inv.agencyCommAmount, 2),
    agencyCommissionCurrency:       s(inv.agencyCommissionCurrency || inv.agencyCommCurrency || ''),
    agencyCommissionRate:           fx(inv.agencyCommissionRate || inv.agencyCommRate, 4),
    natureOfTransaction:            s(inv.natureOfTransaction || ''),
    paymentTerms:                   s(inv.paymentTerms || ''),
    conditionsAttachedWithSale1:    s(inv.conditionsAttachedWithSale1 || ''),
    conditionsAttachedWithSale2:    s(inv.conditionsAttachedWithSale2 || ''),
    conditionsAttachedWithSale3:    s(inv.conditionsAttachedWithSale3 || ''),
    conditionsAttachedWithSale4:    s(inv.conditionsAttachedWithSale4 || ''),
    conditionsAttachedWithSale5:    s(inv.conditionsAttachedWithSale5 || ''),
    valuationMethodApplicable:      s(inv.valuationMethod || inv.valuationMethodApplicable || ''),
    actualInvoiceNumber:            s(inv.invNo || inv.invoiceNo || inv.actualInvoiceNumber || '', 17),
    otherRelevantInform:            s(inv.otherRelevantInform || ''),
    termsPlace:                     s(inv.termsPlace || ''),
    thirdPartyName:                 s(inv.thirdPartyName || ''),
    thirdPartyAddress1:             s(inv.thirdPartyAddress1 || ''),
    thirdPartyAddress2:             s(inv.thirdPartyAddress2 || ''),
    thirdPartyCity:                 s(inv.thirdPartyCity || ''),
    thirdPartyCntrySubDvsn:         s(inv.thirdPartyCntrySubDvsn || ''),
    thirdPartyCountryCode:          s(inv.thirdPartyCountryCode || ''),
    thirdPartyPin:                  s(inv.thirdPartyPin || ''),
    authorizedEconomicOperatorCode: s(inv.aeoCode || inv.authorizedEconomicOperatorCode || '', 17),
    authorizedEconomicOperatorCountry: s(inv.aeoCountry || inv.authorizedEconomicOperatorCountry || '', 2),
    authorizedEconomicOperatorRole: s(inv.aeoRole || inv.authorizedEconomicOperatorRole || '', 3),
    // the screen field is whetherBuyerAndSellerAreRelated; buyerSellerRelated was also the "supplier & seller same" box. 28-Oct-2026
    whetherBuyerAndSellerAreRelated: s(inv.whetherBuyerAndSellerAreRelated || inv.buyerSellerRelated || (hasInvValue(inv) ? 'N' : ''), 1).toUpperCase(),
  }));
  // Ex-bond (X): the invoice values come from the warehouse BE - a filed X BE (other ERP, 29-Oct-2026) carries only the
  // invoice serial no and the invoice no, so the rest is left empty here too
  if (beType === 'X') invoiceModel.forEach(iv => { for (const k of Object.keys(iv)) if (!['messageType', 'customHouseCode', 'beNumber', 'beDate', 'invoiceSerialNumber', 'actualInvoiceNumber'].includes(k)) iv[k] = ''; });

  // Build full itemsModel with all ICEGATE fields
  const itemsModel = (items && items.length > 0 ? items : []).map((item, i) => ({
    messageType:                    opts.isAmendment ? 'A' : 'F',
    customHouseCode:                portCode,
    beNumber:                       s(d.beNo || ''),
    beDate:                         fmtDate(d.beDate || ''),
    invoiceSerialNumber:            s(item.invSrNo || item.invoiceSrNo || '1'),
    itemSerialNumber:               s(item.itemSrNo || String(i + 1)),
    quantity:                       fx(item.qty || item.quantity || 0, 6),
    unitQuantityCode:               s(item.unit || item.unitQuantityCode || ''),
    ritcCode:                       s(item.ritc || item.hsnCode || item.ritcCode || '', 8),
    // split at 60 raw characters, then trimmed - exactly as the other ERP's JSON of two filed W BEs (its .be keeps the
    // spaces; ICES does not mind either way). 29-Oct-2026
    itemDescription1:               s((item.desc || item.description || '').substring(0, 60)),
    itemDescription2:               s((item.desc || item.description || '').substring(60, 120)),
    itemCategory:                   s(item.itemCategory || ''),
    // 18-Nov-2026: blank generic description -> the first 60 characters of the description, as iCAFFE files it (8870:
    // 282 of 283 items, the other one typed; 7342 too). An X BE still sends it blank (below).
    genericDescriptionOfTheItem:    s(item.genericDesc || item.genericDescriptionOfTheItem || (item.desc || item.description || '').substring(0, 60), 60),
    accessoriesForTheItem:          s(item.accessories || ''),
    manufacturerName:               s(item.manufacturer || item.manufacturerName || ''),
    brandName:                      s(item.brandName || ''),
    model:                          s(item.model || ''),
    endUseOfItem:                   s(item.endUse || item.endUseOfItem || ''),
    countryOfOrigin:                s(item.countryOfOrigin || d.autoField_20 || d.countryOfOrigin || ''),
    cth:                            s(item.cth || item.ritc || item.hsnCode || '', 8),
    // the item screen's Rate Type box (rateTypeFlag) was never read: a preferential (P) rate always went as S. 29-Oct-2026
    preferentialStandard:           s(/^P/i.test(String(item.preferentialStandard || item.rateTypeFlag || 'S')) ? 'P' : 'S'),
    ceth:                           s(item.ceth || 'NOEXCISE'),
    // item screen field names (bcdNotificationNo / bcdSrNo ...) were never read before. 28-Oct-2026
    bcdNotification:                s(item.bcdNotification || item.bcdNotificationNo || '', 10),
    bcdNotificationSrNo:            s(item.bcdNotificationSrNo || item.bcdSrNo || '', 10),
    cvdNotification:                s(item.cvdNotification || item.cvdNotificationNo || '', 10),
    cvdNotificationSrNo:            s(item.cvdNotificationSrNo || item.cvdSrNo || '', 10),
    additionalNotification1:        s(item.additionalNotification1 || ''),
    additionalNotification1SrNo:    s(item.additionalNotification1SrNo || ''),
    additionalNotification2:        s(item.additionalNotification2 || ''),
    additionalNotification2SrNo:    s(item.additionalNotification2SrNo || ''),
    otherNotification:              s(item.otherNotification || ''),
    otherNotificationSrNo:          s(item.otherNotificationSrNo || ''),
    cusEducessNotfnNumber:          s(item.cusEducessNotfnNumber || ''),
    cusEducessNotfnSrNo:            s(item.cusEducessNotfnSrNo || ''),
    socialWelfareNotn:              s(item.socialWelfareNotn || item.swsNotificationNo || '', 10),
    socialWelfareNotnSlno:          s(item.socialWelfareNotnSlno || item.swsSrNo || '', 10),
    ncdNotn:                        s(item.ncdNotn || ''),
    ncdNotnSrNo:                    s(item.ncdNotnSrNo || ''),
    antiDumpingDutyNotification:    s(item.antiDumpingDutyNotification || ''),
    antiDumpingDutySerialNumber:    s(item.antiDumpingDutySerialNumber || ''),
    cthSerialNumber:                s(item.cthSerialNumber || ''),
    supplierSerialNumber:           s(item.supplierSerialNumber || ''),
    quantityAsPerAntiDumpingNotn:   s(item.quantityAsPerAntiDumpingNotn || ''),
    tariffValueNotn:                s(item.tariffValueNotn || ''),
    tariffValueItemSerialNumber:    s(item.tariffValueItemSerialNumber || ''),
    quantityAsPerTariffValueNotn:   s(item.quantityAsPerTariffValueNotn || ''),
    saptaNotn:                      s(item.saptaNotn || item.saptaNotificationNo || '', 10),
    saptaSerialNumber:              s(item.saptaSerialNumber || item.saptaSrNo || '', 10),
    healthNotn:                     s(item.healthNotn || item.healthCessNotificationNo || '', 10),
    healthSrNo:                     s(item.healthSrNo || item.healthCessSrNo || '', 10),
    additionalCvdNotn:              s(item.additionalCvdNotn || item.adlCvdNotificationNo || '', 10),
    additionalCvdSrNo:              s(item.additionalCvdSrNo || item.adlCvdSrNo || '', 10),
    aggregateDutyNotn:              s(item.aggregateDutyNotn || ''),
    aggregateDutyNotnSrNo:          s(item.aggregateDutyNotnSrNo || ''),
    safeguardDutyNotn:              s(item.safeguardDutyNotn || ''),
    safeguardDutyNotnSrNo:          s(item.safeguardDutyNotnSrNo || ''),
    unitPriceInvoiced:              fx(item.price || item.unitPrice || 0, 6),
    discountRate:                   s(item.discountRate || ''),
    discountAmount:                 s(item.discountAmount || ''),
    quantityAsPerCth:               s(item.quantityAsPerCth || ''),
    cthQty:                         s(item.cthQty || ''),
    svbReferenceNumber:             s(item.svbReferenceNumber || ''),
    svbReferenceDate:               fmtDate(item.svbReferenceDate || ''),
    svbLoadAssessableValue:         s(item.svbLoadAssessableValue || ''),
    svbLoadOnDuty:                  s(item.svbLoadOnDuty || ''),
    svbFlag:                        s(item.svbFlag || ''),
    whetherLoadProvisionalOnAssessableValue: s(item.whetherLoadProvisionalOnAssessableValue || ''),
    whetherLoadProvisionalOnDuty:   s(item.whetherLoadProvisionalOnDuty || ''),
    customHouseCodeWhichHasImposedLoad: s(item.customHouseCodeWhichHasImposedLoad || ''),
    policyParaNo:                   s(item.policyParaNo || ''),
    policyYear:                     s(item.policyYear || ''),
    rspApplicability:               s(item.rspApplicability || 'N'),
    whetherReimport:                s(item.whetherReimport || 'N'),
    previousBeNo:                   s(item.previousBeNo || ''),
    previousBeDate:                 fmtDate(item.previousBeDate || ''),
    prevUnitPriceInvoiced:          s(item.prevUnitPriceInvoiced || ''),
    prevCurrencyCode:               s(item.prevCurrencyCode || ''),
    prevCustomSite:                 s(item.prevCustomSite || ''),
    customsFlag:                    s(item.customsFlag || ''),
    itemManufacturerType:           s(item.itemManufacturerType || ''),
    itemManufacturerCode:           s(item.itemManufacturerCode || ''),
    itemManufacturerAddress1:       s(item.itemManufacturerAddress1 || ''),
    itemManufacturerAddress2:       s(item.itemManufacturerAddress2 || ''),
    itemManufacturerCity:           s(item.itemManufacturerCity || ''),
    itemManufacturerSubdivision:    s(item.itemManufacturerSubdivision || ''),
    itemManufacturerPin:            s(item.itemManufacturerPin || ''),
    itemManufacturerCntry:          s(item.itemManufacturerCountry || item.itemManufacturerCntry || ''),
    sourceCountry:                  s(item.sourceCountry || ''),
    transitCountry:                 s(item.transitCountry || ''),
    accessoryStatus:                s(item.accessoryStatus || '0'),
  }));
  // 12-Nov-2026: a filed ex-bond (X) BE leaves the item descriptions, manufacturer, brand, model and end use empty
  // (they are on the warehouse BE) and sends N for "load provisional on duty"
  if (beType === 'X') itemsModel.forEach(it => { for (const k of ['itemDescription1', 'itemDescription2', 'genericDescriptionOfTheItem', 'manufacturerName', 'brandName', 'model', 'endUseOfItem']) it[k] = ''; if (!it.whetherLoadProvisionalOnDuty) it.whetherLoadProvisionalOnDuty = 'N'; });

  // Build igmsModel (MAWB/HAWB/IGM details)
  // IGM grid rows (header screen) - one igmsModel entry per row; else the single IGM typed in the header.
  // The screen's field is igmNumber (igmNo was never filled). 28-Oct-2026
  let igmRowsIn = d._igmRows;
  if (typeof igmRowsIn === 'string') { try { igmRowsIn = JSON.parse(igmRowsIn); } catch (e) { igmRowsIn = []; } }
  if (!Array.isArray(igmRowsIn) || !igmRowsIn.length) igmRowsIn = [{
    igmNumber: d.igmNumber || d.igmNo, igmDate: d.igmDate || d.autoField_14, inwardDate: d.inwardDate || d.autoField_17,
    mawbNo: d.mawbNo || d.mawbblNo, mawbDate: d.mawbDate || d.mawbblDate || d.autoField_15, hawbNo: d.hawbNo || d.hawbhblNo,
    hawbDate: d.hawbDate || d.hawbhblDate || d.autoField_16, totalPkg: d.totalPkg, pkgCode: d.pkg, grossWt: d.grossWt,
    wtUnit: d.grossWtUnit, marks1: d.marksAndNumbers1 || d.marks1
  }];
  // a row with nothing in it is not sent (ex-bond BE has no IGM). 28-Oct-2026
  igmRowsIn = igmRowsIn.filter(r => r && ['igmNumber', 'igmNo', 'mawbNo', 'hawbNo'].some(k => String(r[k] || '').trim() !== ''));
  // prior BE (filed before the IGM): a filed prior BE carries IGM no / date / inward date empty and MAWB "NOMAWB" when
  // the master is not known yet (the IGM details come with the "prior to final" amendment). 29-Oct-2026
  const priorBE = /^Y/i.test(String(d.whetherPriorBE || d.priorBE || ''));
  if (priorBE && !igmRowsIn.length) igmRowsIn = [{ mawbNo: '', hawbNo: d.hawbNo || '', hawbDate: d.hawbDate || '', totalPkg: d.totalPkg, pkgCode: d.pkg, grossWt: d.grossWt, wtUnit: d.grossWtUnit, marks1: d.marks1 || 'AS ADDRESS' }];
  if (priorBE) igmRowsIn = igmRowsIn.map(r => ({ ...r, mawbNo: String(r.mawbNo || '').trim() || 'NOMAWB', mawbDate: r.mawbDate || d.jobDate || r.hawbDate || '' }));
  const igmsModel = igmRowsIn.map(r => ({
    messageType:      opts.isAmendment ? 'A' : 'F',
    customHouseCode:  portCode,
    beNumber:         s(d.beNo || ''),
    beDate:           fmtDate(d.beDate || ''),
    igmNumber:        s(r.igmNumber || r.igmNo || ''),
    igmDate:          fmtDate(r.igmDate || ''),
    inwardDate:       fmtDate(r.inwardDate || ''),
    // 30-Oct-2026: no fallback to autoField_19 (that box is the BL / AWB No - a B/L number was going out as the date)
    gatewayIgmNo:     s(d.gatewayIgmNo || '', 7),
    gatewayIgmDate:   fmtDate(d.gatewayIgmDate || ''),
    gatewayPortCode:  s(d.gatewayPortCode || '', 6),
    mawbNo:           s(r.mawbNo || ''),
    mawbDate:         fmtDate(r.mawbDate || ''),
    hawbNo:           s(r.hawbNo || ''),
    hawbDate:         fmtDate(r.hawbDate || ''),
    totalNoOfPackages: intStr(r.totalPkg),
    grossWeight:      fx(r.grossWt, 3),
    unitQuantityCode: s(r.wtUnit || ''),
    packageCode:      s(r.pkgCode || ''),
    marksAndNumbers1: s(r.marks1 || ''),
    marksAndNumbers2: s(r.marks2 || d.marks2 || ''),
    marksAndNumbers3: s(r.marks3 || d.marks3 || ''),
  }));

  // Build ctxModel (CTX / GSTIN details)
  // 30-Oct-2026: the screen now saves the ICEGATE code; labels saved by older jobs are mapped here, anything else
  // (e.g. the word "Select") becomes blank so the validator stops it - it was being filed as the type.
  // A blank type with a 15-character GSTIN is G (derivable), nothing else is assumed.
  const CTX_CODES = { GSTIN: 'G', GSTN: 'G', 'INCOME TAX PAN': 'P', PAN: 'P', AADHAR: 'A', AADHAAR: 'A', PASSPORT: 'I', 'TIN NO': 'T', TIN: 'T', VAT: 'V', CST: 'C', 'SALES TAX REGISTRATION NO': 'S', 'SALES TAX': 'S', 'GST GOVERNMENT': 'O', 'GST GOVERNMENT (UIN)': 'O', 'GST DIPLOMAT': 'D', 'GST DIPLOMAT (UIN)': 'D', 'NOT REGISTERED': 'N', NONE: 'N' };
  const ctxTypeCode = (() => {
    const t = String(d.autoField_50 || d.commercialTaxType || '').trim().toUpperCase();
    if (/^[VCSGPAITDON]$/.test(t)) return t;
    const m = CTX_CODES[t] || CTX_CODES[t.replace(/^[A-Z] - /, '')];
    if (m) return m;
    return /^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(String(d.autoField_13 || '').trim().toUpperCase()) ? 'G' : '';
  })();
  const ctxModel = (d.autoField_13 || d.autoField_12 || ctxTypeCode) ? [{
    messageType:                  opts.isAmendment ? 'A' : 'F',
    customHouseCode:              portCode,
    beNumber:                     s(d.beNo || ''),
    beDate:                       fmtDate(d.beDate || ''),
    stateCode:                    s(d.autoField_12 || ''),
    commercialTaxType:            s(ctxTypeCode, 1),
    commercialTaxRegistrationNo:  s(d.autoField_13 || '', 20),
  }] : [];

  // Build exchangeModel from stored rates
  // One row per currency used on the invoices (invoice, freight, insurance, misc, loading, commission), INR included
  // with rate 1 - production BE files always carry these. Rates come from the job's exchange-rate rows. 28-Oct-2026
  const exIn = (() => { let r = opts.exchangeRates || d._exchangeRates || []; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } } return Array.isArray(r) ? r.slice() : []; })();
  // 20-Nov-2026: the day is the BE date when the job has one (a BE filed earlier and keyed in now, or an amendment), else
  // the day the file is made = the day the BE is filed. It was the job date: iCAFFE 7675 (job 16-10, BE 16-11) filed
  // EUR 108.30 of CBIC 30/2026 (06-11), the rate of the filing day, not 16-10's 108.55; and job 200001 (job date 20-11,
  // BE date 16-11) went as 20261119 (CBIC 32/2026, the newest with 108.30 up to the job date).
  // 18-Nov-2026: the date of a CBIC rate is the effective date of the notification IN FORCE ON THE JOB DATE, from the
  // history of notifications (utils/cbicExchangeRates). A row whose rate is that notification's rate goes with its date
  // - rows saved one day early (CBIC 31/2026 effective 18-Nov saved as 2026-11-17) or with a later notification's date
  // (the master held CBIC 32/2026 a day before it came into force) are corrected. A row with another rate (typed, bank
  // rate) goes as saved; the BE checks warn when it is not the rate in force.
  let histDone = false;
  try {
    const jobDay = (() => { const t = fmtDate(d.beDate || '') || today; return /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : ''; })();
    const codes = exIn.map(e => String((e && e.currencyCode) || '').trim().toUpperCase()).filter(c => c && c !== 'INR');
    if (jobDay && codes.length) {
      const hist = await require('./cbicExchangeRates').historyOf(codes);
      for (let i = 0; i < exIn.length; i++) {
        const e = exIn[i]; if (!e || !e.currencyCode) continue;
        const rows = hist.get(String(e.currencyCode).trim().toUpperCase()); if (!rows || !rows.length) continue;
        histDone = true;
        const per = Number(e.unitInRs) || 1;
        const same = (h) => Math.abs(Number(e.rate) - Number(h.importRate) * per) < 1e-6;
        const inForce = rows.find(h => h.effectiveDate <= jobDay);
        const pick = inForce && same(inForce) ? inForce : rows.find(h => h.effectiveDate <= jobDay && same(h));
        if (pick) exIn[i] = { ...e, effectiveDate: pick.effectiveDate };
      }
    }
  } catch (err) { /* no history: the rows go as saved (and the check below) */ }
  // no history yet: a row with the master's rate dated exactly the day before the master's date takes the master's
  if (!histDone) try {
    const Currency = require('../models/Currency');
    const curRows = await Currency.findAll({ attributes: ['currencyCode', 'importRate', 'effectiveDate'], raw: true });
    const byCode = new Map(curRows.map(c => [String(c.currencyCode || '').trim().toUpperCase(), c]));
    for (let i = 0; i < exIn.length; i++) {
      const e = exIn[i]; if (!e || !e.currencyCode) continue;
      const m = byCode.get(String(e.currencyCode).trim().toUpperCase()); if (!m || !m.effectiveDate) continue;
      const mDay = fmtDate(m.effectiveDate), eDay = fmtDate(e.effectiveDate || '');
      if (!/^\d{8}$/.test(mDay) || !/^\d{8}$/.test(eDay)) continue;
      const nextDay = (() => { const t = new Date(Date.UTC(+eDay.slice(0, 4), +eDay.slice(4, 6) - 1, +eDay.slice(6, 8) + 1)); return t.getUTCFullYear() + String(t.getUTCMonth() + 1).padStart(2, '0') + String(t.getUTCDate()).padStart(2, '0'); })();
      const per = Number(e.unitInRs) || 1;
      if (nextDay === mDay && Math.abs(Number(e.rate) - Number(m.importRate) * per) < 1e-6) exIn[i] = { ...e, effectiveDate: mDay };
    }
  } catch (err) { /* master not readable: the rows go as saved */ }
  const haveCur = new Set(exIn.map(e => String(e.currencyCode || '').trim().toUpperCase()));
  invoiceModel.forEach(iv => ['invoiceCurrency', 'freightCurrency', 'insuranceCurrency', 'miscCurrency', 'loadingCurrency', 'agencyCommissionCurrency'].forEach(k => {
    const c = String(iv[k] || '').trim().toUpperCase();
    if (c === 'INR' && !haveCur.has('INR')) { haveCur.add('INR'); exIn.unshift({ currencyCode: 'INR', unitInRs: 1, rate: 1, effectiveDate: d.exchangeRateDate || d.jobDate || today }); }
  }));
  // 30-Oct-2026: only the currencies the invoices use are filed (a rate row left behind after the invoice currency
  // was changed went into the file as an unused exchange row)
  const usedCur = new Set(); invoiceModel.forEach(iv => ['invoiceCurrency', 'freightCurrency', 'insuranceCurrency', 'miscCurrency', 'loadingCurrency', 'agencyCommissionCurrency'].forEach(k => { const c = String(iv[k] || '').trim().toUpperCase(); if (c) usedCur.add(c); }));
  const exchangeModel = exIn.filter(e => e && e.currencyCode && (!usedCur.size || usedCur.has(String(e.currencyCode).trim().toUpperCase()))).map(e => ({
    messageType:          opts.isAmendment ? 'A' : 'F',
    customHouseCode:      portCode,
    beNumber:             '',
    beDate:               '',
    currencyCode:         s(e.currencyCode || ''),
    standardCurrency:     'Y',
    unitInRs:             fx(e.unitInRs || 1, 2),
    rate:                 fx(e.rate || 0, 4),
    // 18-Nov-2026: INR goes with 20050101 as on every iCAFFE BE (the job date was sent)
    effectiveDate:        String(e.currencyCode || '').trim().toUpperCase() === 'INR' ? '20050101' : fmtDate(e.effectiveDate || ''),
    banknamefornonstandardcurrency: '',
    certificateNumber:    '',
    certificateDate:      '',
  }));

  // Build sbedutyModel from stored duties
  // Duty notifications per item: IGST (G/I), AIDC (C/A), Compensation cess (G/P) etc. From the job's duty rows and
  // each item's IGST popup (igstData / dutyRows). 28-Oct-2026
  const dutyIn = (() => { let r = opts.duties || d._duties || d._sbedutyModel || []; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } } return Array.isArray(r) ? r.slice() : []; })();
  (items || []).forEach((item, i) => {
    const invSr = String(item.invSrNo || item.invoiceSrNo || 1), itmSr = String(item.itemSrNo || (i + 1));
    const already = (row) => dutyIn.some(x => String(x.invoiceSerialNumber || x.invoiceSrNo) === invSr && String(x.itemSerialNumber || x.itemSrNo) === itmSr
      && String(x.notificationNo) === String(row.notificationNo) && String(x.addlDutyFlag || '') === String(row.addlDutyFlag || ''));
    let rows = item.dutyRows; if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = null; } }
    let ig = item.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
    // rows edited in the item's IGST / duty popup replace the job-level (imported) rows of that item
    if (Array.isArray(rows)) for (let k = dutyIn.length - 1; k >= 0; k--) {
      const x = dutyIn[k];
      if (String(x.invoiceSerialNumber || x.invoiceSrNo || '1') === invSr && String(x.itemSerialNumber || x.itemSrNo || '1') === itmSr) dutyIn.splice(k, 1);
    }
    const list = (Array.isArray(rows) ? rows : []).slice();
    // "Infra Cess" in the Other Duty popup = AIDC: notification row C/A
    let od = item.otherDutyData; if (typeof od === 'string') { try { od = JSON.parse(od); } catch (e) { od = null; } }
    if (!Array.isArray(rows) && od && od['Infra Cess_notnNo']) list.push({ notificationNo: od['Infra Cess_notnNo'], notificationSrNo: od['Infra Cess_srNo'] || '', dutyType: 'C', addlDutyFlag: 'A' });
    if (!Array.isArray(rows) && ig && ig.notnNo) list.push({ notificationNo: ig.notnNo, notificationSrNo: ig.srNo, dutyType: 'G', addlDutyFlag: 'I', exmpNotificationNo: ig.exmpNotnNo, exmpNotificationSrNo: ig.exmpSrNo });
    list.forEach(r => {
      const row = { invoiceSrNo: invSr, itemSrNo: itmSr, notificationNo: r.notificationNo || r.notnNo || r.notn, notificationSrNo: r.notificationSrNo || r.srNo || r.slno,
        dutyType: r.dutyType || r.type, addlDutyFlag: r.addlDutyFlag || r.flg || r.flag, exmpNotificationNo: r.exmpNotificationNo, exmpNotificationSrNo: r.exmpNotificationSrNo,
        customsNotnExemptingIgstFlag: r.customsNotnExemptingIgstFlag || r.igstFlag || '' };
      if (row.notificationNo && !already(row)) dutyIn.push(row);
    });
  });
  const sbedutyModel = dutyIn.filter(x => x && (x.notificationNo || x.notnNo)).map(duty => ({
    messageType:            opts.isAmendment ? 'A' : 'F',
    customHouseCode:        portCode,
    beNumber:               '',
    beDate:                 '',
    invoiceSerialNumber:    s(duty.invoiceSerialNumber || duty.invoiceSrNo || '1'),
    itemSerialNumber:       s(duty.itemSerialNumber || duty.itemSrNo || '1'),
    notificationNo:         s(duty.notificationNo || duty.notnNo || '', 10),
    notificationSrNo:       s(duty.notificationSrNo || '', 10),
    dutyType:               s(duty.dutyType || '', 1),
    addlDutyFlag:           s(duty.addlDutyFlag || '', 1),
    exmpNotificationNo:     s(duty.exmpNotificationNo || '', 10),
    exmpNotificationSrNo:   s(duty.exmpNotificationSrNo || '', 10),
    customsNotnExemptingIgstFlag: s(duty.customsNotnExemptingIgstFlag || ''),
    itemSlNo:               s(duty.itemSlNo || ''),
    supplierSlNo:           s(duty.supplierSlNo || ''),
    nou:                    s(duty.nou || ''),
  }));

  // Build infoTypeModel
  const arr = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
  // Item popups (swInfoData, swStmtData, docsData ...) are filled from these job-level rows when a job opens, so an item
  // that has its own popup list is sent from that list only - otherwise every row went twice. 28-Oct-2026
  const parseL = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return Array.isArray(v) ? v : null; };
  const ownPairs = (key) => new Set((items || []).map((it, i) => parseL(it[key]) ? String(it.invSrNo || it.invoiceSrNo || 1) + '/' + String(it.itemSrNo || (i + 1)) : null).filter(Boolean));
  const pairOf = (r) => String(r.invoiceSerialNumber || r.invoiceSrNo || r.invSrNo || '1') + '/' + String(r.itemSerialNumber || r.itemSrNo || r.itmNo || '1');
  const notOwn = (key) => { const own = ownPairs(key); return (r) => !own.has(pairOf(r)); };
  const infoTypeModel = arr(opts.infoTypes || d._infoTypes).filter(notOwn('swInfoData')).map(info => ({
    messageType:          opts.isAmendment ? 'A' : 'F',
    customHouseCode:      portCode,
    beNumber:             '',
    beDate:               '',
    invoiceSerialNumber:  s(info.invoiceSrNo || '1'),
    itemSerialNumber:     s(info.itemSrNo || '1'),
    infoType:             s(info.infoType || ''),
    infoQualifier:        s(info.infoQualifier || ''),
    infoCode:             s(info.infoCode || '', 100),
    infoText:             s(info.infoText || '', 100),
    infoMsr:              fx(info.infoMsr, 6),
    infoUqc:              s(info.infoUqc || ''),
  }));

  // Build statementModel
  const stmtOwn = ownPairs('swStmtData');
  const statementModel = arr(opts.statements || d._statements).filter(r => String(r.itemSerialNumber || r.itemSrNo || '0') === '0' || !stmtOwn.has(pairOf(r))).map(stmt => ({
    messageType:          opts.isAmendment ? 'A' : 'F',
    customHouseCode:      portCode,
    declarationtype:      s(stmt.declarationtype || stmt.declarationType || 'B'),
    declarationNo:        '',
    declarationDate:      '',
    invoiceSerialNumber:  s(stmt.invoiceSrNo || '0'),
    itemSerialNumber:     s(stmt.itemSrNo || '0'),
    statementType:        s(stmt.statementType || 'DEC'),
    statementCode:        s(stmt.statementCode || ''),
    statementText:        s(stmt.statementText || '', 4000),
  }));

  // Single Window / supporting-doc rows typed in the item popups (were never sent). 28-Oct-2026
  const asList = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
  const pickSel = (v) => (v === undefined || v === null || String(v) === 'Select') ? '' : String(v);
  const swConstModel = [], swProdModel = [], ctrlModel = [], supportingDocsModel = [];
  (items || []).forEach((item, i) => {
    const invSr = n(item.invSrNo || item.invoiceSrNo || 1) || 1;
    const itmSr = n(item.itemSrNo || (i + 1)) || (i + 1);
    asList(item.swInfoData).forEach(r => infoTypeModel.push({
      invoiceSerialNumber: invSr, itemSerialNumber: itmSr, infoType: s(pickSel(r.type || r.infoType), 3),
      infoQualifier: s(pickSel(r.qualifier || r.infoQualifier), 100), infoCode: s(pickSel(r.code || r.infoCode), 100),
      infoText: s(r.text || r.infoText || '', 100), infoMsr: fx(r.qty || r.infoMsr, 6), infoUqc: s(r.uqc || r.infoUqc || '', 3)
    }));
    // Every item in production files has CHR / SQC = quantity in the standard UQC. Added when the user did not enter one. 28-Oct-2026
    if (!infoTypeModel.some(x => String(x.invoiceSerialNumber) === String(invSr) && String(x.itemSerialNumber) === String(itmSr) && x.infoType === 'CHR' && x.infoQualifier === 'SQC')) {
      infoTypeModel.push({ invoiceSerialNumber: invSr, itemSerialNumber: itmSr, infoType: 'CHR', infoQualifier: 'SQC', infoCode: '', infoText: '',
        infoMsr: fx(item.sqcQty || item.standardQty || item.qty || item.quantity || 0, 6), infoUqc: s(item.sqcUqc || item.standardUqc || item.unit || item.unitQuantityCode || '', 3) });
    }
    // statement type codes DEC / UTG / REM (old screen values "DECLARATION" / "Undertaking" mapped);
    // "Statement For" BE / Invoice puts the row at BE (0/0) or invoice (inv/0) level. 28-Oct-2026
    asList(item.swStmtData).forEach(r => { const lvl = String(pickSel(r.stmtFor || r.statementFor) || 'Item').toUpperCase(); statementModel.push({
      declarationtype: 'B', invoiceSerialNumber: lvl === 'BE' ? 0 : invSr, itemSerialNumber: (lvl === 'BE' || lvl === 'INVOICE') ? 0 : itmSr,
      statementType: s((({ DECLARATION: 'DEC', UNDERTAKING: 'UTG', REMARK: 'REM' })[String(pickSel(r.typeCode || r.type || r.statementType)).trim().toUpperCase()] || pickSel(r.typeCode || r.type || r.statementType)).toUpperCase(), 3), statementCode: s(pickSel(r.stmtCode || r.code || r.statementCode), 7),
      statementText: s(r.stmtText || r.text || r.statementText || '', 4000)
    }); });
    asList(item.swConstData).forEach((r, k) => swConstModel.push({
      invoiceSerialNumber: invSr, itemSerialNumber: itmSr, constituentSrNo: n(r.srNo) || (k + 1),
      constituentElementName: s(r.name || r.elementName || '', 256), constituentElementCode: s(r.code || '', 17),
      constituentPercentage: r.percent || r.percentage || '', constituentYieldPercentage: r.yield || '', activeIngredientFlag: s(r.active || r.activeIngredient || '', 1)
    }));
    asList(item.swProdData).forEach(r => swProdModel.push({
      invoiceSerialNumber: invSr, itemSerialNumber: itmSr, productionBatchIdentifier: s(r.batch || r.producerName || '', 17),
      productionBatchQuantity: r.qty ? fx(r.qty, 6) : '', unitQuantityCode: s(r.uqc || '', 3), // 6 decimals as in filed CDSCO BEs (13.000000), 29-Oct-2026
      dateOfManufacturing: fmtDate(r.mnfDate || ''), dateOfExpiry: fmtDate(r.expDate || ''), bestBefore: fmtDate(r.bestBefore || '')
    }));
    // 22-Nov-2026: an ex-bond control row carries the quantity released and its unit (filed X BE); the window has no
    // box for them, so they come from the item
    asList(item.swCtrlData).forEach((r, k) => ctrlModel.push({
      invoiceSerialNumber: invSr, itemSerialNumber: itmSr, controlTypeCode: s(pickSel(r.typeCode || r.controlType).toUpperCase(), 17),
      controlLocation: s(r.location || '', 17), controlStartDate: fmtDate(r.startDate || ''), controlEndDate: fmtDate(r.endDate || ''),
      controlResultCode: s(r.resultCode || r.result || '', 17), controlResultText: s(r.resultText || '', 4000), controlMsr: fx(r.msr || r.qty || (beType === 'X' ? (item.qty || item.quantity) : ''), 6), controlUqc: s(r.uqc || (beType === 'X' ? (item.unit || item.uqc || '') : ''), 3), controlSlNo: String(r.slNo || r.controlSlNo || (k + 1)) // 12-Nov-2026: the ex-bond's own control serial (2, 3 ...) when known
    }));
    // e-Sanchit docs: production files send declarationType "E", the importer as beneficiary, fileType PDF. 28-Oct-2026
    // item popup rows: "Doc. For" = this item / this invoice / BE; older rows kept the IRN in icegateId. 28-Oct-2026
    asList(item.docsData).forEach(r => {
      const lvl0 = String(r.docFor || (r.jobLevel ? 'BE' : r.invoiceLevel ? 'INVOICE' : 'ITEM')).toUpperCase(); const lvl = lvl0 === 'HEADER' ? 'BE' : lvl0;
      const oldIrn = !r.irn && /^\d{10,}$/.test(String(r.icegateId || ''));
      supportingDocsModel.push({
      declarationType: 'E', invoiceSerialNumber: lvl === 'BE' ? 0 : invSr, itemSerialNumber: lvl === 'ITEM' ? itmSr : 0,
      chaLicenseNumber: s(chaCodeVal, 15), iec: s(iecCode, 10),
      icegateUserId: s((!oldIrn && r.icegateId) || icegateId, 25), imageReferenceNo: s(r.irn || r.imageReferenceNo || (oldIrn ? r.icegateId : ''), 16), documentTypeCode: s(r.docCode || '', 6),
      // 29-Oct-2026: rows from the shared panel use drn / issuerAddr1 / bene* / placeOfIssue / issueDate; older rows refNo / issuerAddress / beneficiary* / issueLocation / date
      // 19-Nov-2026: the panel's keys first (DRN first, as iCAFFE and the SB). The panel keeps an older row's refNo / issueLocation /
      // date ... next to its new keys, so after an edit those were stale and went instead of what the screen shows.
      documentIssuingPartyCode: s(r.issuerCode || '', 17), documentIssuingPartyName: s(r.issuerName || '', 70), documentIssuingPartyNameAddress1: s(r.issuerAddr1 || r.issuerAddress || r.issuerAddress1 || '', 70),
      documentIssuingPartyNameAddress2: s(r.issuerAddr2 || r.issuerAddress2 || '', 70), documentIssuingPartyNameCity: s(r.issuerCity || '', 35), documentIssuingPartyNamePin: s(r.issuerPin || '', 10),
      documentReferenceNo: s(r.drn || r.refNo || '', 35), placeOfIssue: s(r.placeOfIssue || r.issueLocation || '', 35), documentIssueDate: fmtDate(r.issueDate || r.date || ''), documentExpiryDate: fmtDate(r.expiryDate || ''),
      documentBeneficiaryPartyCode: s(r.beneCode || r.beneficiaryCode || '', 17), documentBeneficiaryPartyName: s(r.beneName || r.beneficiaryName || importerName, 70),
      documentBeneficiaryPartyNameAddress1: s(r.beneAddr1 || r.beneficiaryAddress1 || d.autoField_6 || '', 70), documentBeneficiaryPartyNameAddress2: s(r.beneAddr2 || r.beneficiaryAddress2 || d.autoField_7 || '', 70),
      documentBeneficiaryPartyNameCity: s(r.beneCity || r.beneficiaryCity || d.autoField_8 || '', 35), documentBeneficiaryPartyPin: s(r.benePin || r.beneficiaryPin || d.autoField_10 || '', 10),
      fileType: s(r.fileType || 'PDF', 3).toUpperCase()
      });
    });
  });
  // Rows kept in ICEGATE form on the job (from an imported BE JSON): e-Sanchit docs at BE / invoice level,
  // control, constituent, production rows. Sent back unchanged. 28-Oct-2026
  const asRows = (v) => asList(v).filter(r => r && typeof r === 'object');
  // BE / invoice level e-Sanchit docs: the "Supporting Docs" tab (esanchitDocs) when the job has it, else the imported rows.
  const tabDocs = parseL(d.esanchitDocs);
  const docOwn = ownPairs('docsData');
  asRows(d._supportingDocsModel).filter(r => {
    const itemLevel = String(r.itemSerialNumber || '0') !== '0';
    return itemLevel ? !docOwn.has(pairOf(r)) : !(tabDocs && tabDocs.length);
  }).forEach(r => supportingDocsModel.push({ ...r }));
  (tabDocs || []).filter(x => x && (x.docCode || x.irn)).forEach(x => {
    const lvl = String(x.docFor || 'HEADER').toUpperCase();
    const inv = (lvl === 'INVOICE' || lvl === 'ITEM') && x.invSrNo ? String(x.invSrNo) : '0';
    const itm = lvl === 'ITEM' && x.invSrNo && x.itemSrNo ? String(x.itemSrNo) : '0';
    supportingDocsModel.push({
      declarationType: 'E', invoiceSerialNumber: inv, itemSerialNumber: itm, chaLicenseNumber: s(chaCodeVal, 15), iec: s(iecCode, 10),
      icegateUserId: s((x.isDiffId && x.icegateId) || x.icegateId || icegateId, 25), imageReferenceNo: s(x.irn || '', 16), documentTypeCode: s(x.docCode || '', 6),
      documentIssuingPartyCode: s(x.issuerCode || '', 17), documentIssuingPartyName: s(x.issuerName || '', 70),
      documentIssuingPartyNameAddress1: s(x.issuerAddr1 || '', 70), documentIssuingPartyNameAddress2: s(x.issuerAddr2 || '', 70),
      documentIssuingPartyNameCity: s(x.issuerCity || '', 35), documentIssuingPartyNamePin: s(x.issuerPin || '', 10),
      documentReferenceNo: s(x.drn || '', 35), placeOfIssue: s(x.placeOfIssue || '', 35), documentIssueDate: fmtDate(x.issueDate || ''), documentExpiryDate: fmtDate(x.expiryDate || ''),
      documentBeneficiaryPartyCode: s(x.beneCode || '', 17), documentBeneficiaryPartyName: s(x.beneName || importerName, 70),
      documentBeneficiaryPartyNameAddress1: s(x.beneAddr1 || '', 70), documentBeneficiaryPartyNameAddress2: s(x.beneAddr2 || '', 70),
      documentBeneficiaryPartyNameCity: s(x.beneCity || '', 35), documentBeneficiaryPartyPin: s(x.benePin || '', 10), fileType: s(x.fileType || 'PDF', 3).toUpperCase()
    });
  });
  // 29-Oct-2026: the same IRN at the same level entered twice (item popup + tab 5) is sent once
  {
    const seen = new Set();
    for (let i = supportingDocsModel.length - 1; i >= 0; i--) {
      const r = supportingDocsModel[i]; const k = r.imageReferenceNo ? `${r.imageReferenceNo}|${r.invoiceSerialNumber}|${r.itemSerialNumber}` : '';
      if (k && seen.has(k)) supportingDocsModel.splice(i, 1); else if (k) seen.add(k);
    }
  }
  asRows(d._ctrlModel).filter(notOwn('swCtrlData')).forEach(r => ctrlModel.push({ ...r }));
  asRows(d._sw_ConstModel).filter(notOwn('swConstData')).forEach(r => swConstModel.push({ ...r }));
  asRows(d._sw_ProdModel).filter(notOwn('swProdData')).forEach(r => swProdModel.push({ ...r }));
  // Standard declarations every production BE carries: CUG00/CUG01 for the BE, CUV01-03 (valuation) per invoice.
  // Added only when the job has none of that code yet. opts.noDefaultStatements switches this off. 28-Oct-2026
  if (!opts.noDefaultStatements) {
    const hasStmt = (inv, code) => statementModel.some(x => String(x.invoiceSerialNumber) === String(inv) && String(x.itemSerialNumber) === '0' && x.statementCode === code);
    const add = (inv, code) => { if (!hasStmt(inv, code)) statementModel.push({ declarationtype: 'B', invoiceSerialNumber: inv, itemSerialNumber: 0, statementType: 'DEC', statementCode: code, statementText: '' }); };
    ['CUG00', 'CUG01'].forEach(c => add(0, c));
    invoiceModel.forEach(iv => ['CUV01', 'CUV02', 'CUV03'].forEach(c => add(iv.invoiceSerialNumber, c)));
  }

  // Build CACHI01 JSON structure - complete ICEGATE schema
  const cachi01 = {
    headerField: {
      senderID:                s(icegateId),
      receiverID:              portCode,
      indicator:               opts.indicator || 'P',
      messageID:               'CACHI01',
      sequenceOrControlNumber: seq,
      amendmentReason:         (opts.amendment || opts.isAmendment) ? opts.amendReason : undefined,
      amendmentType:           (opts.amendment || opts.isAmendment) ? opts.amendmentType : undefined,
      // ICEGATE keys a BE by customs house + job number + job date + CHA, so the number must not repeat between our
      // branches / years. 30-Oct-2026: the job's ICEGATE number is the one stored at its first filing (icegateJobNo),
      // else the job's own database id (unique for the whole installation); the running number of the job no
      // (NDL/AI/0012/26 -> 12) is only the fallback for a job that is not saved yet.
      // 30-Oct-2026: an unsaved job has no number - the validator says "save the job first" instead of a clock-made number
      // 18-Nov-2026 (asked by the user): the database id made ICEGATE mails name "job no. 4143" for DEL-AI-1002. Now the
      // number stored at the first filing, else the job no itself / its running number (7342 -> 7342, DEL-AI-1002 ->
      // 1002). One number once per custom house in a financial year: checked by utils/icegateJobNo before a file is made.
      jobNumber:               n(d.icegateJobNo) || require('./icegateJobNo').runningNo(d.jobNo) || '',
      jobDate:                 fmtDate(d.jobDate || today),
      messageType:             (opts.amendment || opts.isAmendment) ? 'A' : 'F',
    },
    master: {
      beModel: [{
        messageType:                      opts.isAmendment ? 'A' : 'F',
        customHouseCode:                  portCode,
        beNumber:                         s(d.beNo || d.beNumber || ''),
        beDate:                           fmtDate(d.beDate || ''),
        beType:                           beType,
        iecCode:                          iecCode,
        // 29-Oct-2026: the branch is picked from the importer's branches (screen keeps it in branchSrNo + autoField_48); a blank
        // one used to go out as 1 silently - now it stays blank and the validator stops the file (filed BEs carry 0 or 2 too)
        branchSrNo:                       s(String(d.branchSrNo ?? d.autoField_48 ?? '').trim()),
        nameOfImporter:                   importerName,
        address1:                         s(d.autoField_6, 35),
        address2:                         s(d.autoField_7, 35),
        city:                             s(d.autoField_8, 35),
        state:                            s(d.autoField_9, 25),
        pin:                              s(d.autoField_10, 6),
        // 30-Oct-2026: the BE Message Format (CACHI01 v2.27) gives the BE class as always N; this was sending P on
        // every BE. A class read from an imported file still wins. 12-Nov-2026: so does the class of a job loaded
        // from iCAFFE (P on every BE it filed), so an amendment goes with the class the BE was filed with.
        // 18-Nov-2026: a job made in EagleView now goes as P too - iCAFFE files every BE (and its BE JSON) with class P,
        // ICEGATE accepts it; asked by the user so hand-made jobs go as iCAFFE's do. A class on the job still wins.
        beClass:                          s(d.beClass || 'P', 1).toUpperCase(),
        modeOfTransport:                  fileMode,
        // schema codes G|U|O|P|E|R|J|D|T|S|V|A|H|I; the screen offers Government/Undertaking/Private/Others/Jobbing. 28-Oct-2026
        // screen field importerType (name or code) first; autoField_53 is the CFS Name box on the screen and only a
        // file import puts a one-letter importer type there. 28-Oct-2026
        importerType:                     s((() => { const t = String(d.importerType || (String(d.autoField_53 || '').trim().length === 1 ? d.autoField_53 : '') || '').trim().toUpperCase();
                                            // 29-Oct-2026: not selected -> blank (was sent as O = Others silently; the validator now asks for it)
                                            return ({ GOVERNMENT: 'G', UNDERTAKING: 'U', 'UNDERTAKING (PSU)': 'U', PRIVATE: 'P', OTHERS: 'O', JOBBING: 'J', REPAIRING: 'R', DESTRUCTION: 'D', EXHIBITION: 'E', 'HAND CARRY JEWELLER': 'H', 'HAND CARRY': 'H', 'UNCLAIMED CARGO': 'I', 'UNCLIAMED CARGO': 'I' })[t.replace(/^[A-Z] - /, '')] || (/^[GUOPERJDTSVAHIMBF]$/.test(t) ? t : ''); })(), 1),
        kachchaBE:                        s(d.kachchaBE || 'N', 1),
        highSeaSaleFlag:                  s(d.highSeaSaleFlag || 'N', 1),
        // foreign port (air: 3-letter IATA e.g. SIN, FRA as in production files). Never our own Indian port. 28-Oct-2026
        portOfOrigin:                     s(d.portOfOrigin || d.autoField_22 || '', 6),
        chaCode:                          chaCodeVal,
        countryOfOrigin:                  s(d.autoField_20 || d.countryOfOrigin || '', 2),
        countryOfConsignment:             s(d.autoField_21 || d.countryOfConsignment || '', 2),
        // 30-Oct-2026: its own screen box; the origin port is only the fallback for jobs keyed before that
        portOfShipment:                   s(d.portOfShipment || d.autoField_22 || d.portOfOrigin || '', 6),
        // screen box is greenChannel (autoField_55 is Delivery Mode on the screen; a file import puts Y/N there)
        greenChannelRequested:            s((() => { const v = String(d.greenChannel || d.greenChannelRequested || (/^[YN]$/i.test(String(d.autoField_55 || '').trim()) ? d.autoField_55 : '') || 'N').trim().toUpperCase(); return v === 'Y' ? 'Y' : 'N'; })(), 1),
        section48Requested:               s(d.section48Requested || d.section48 || 'N', 1),
        whetherPriorBE:                   s(/^[YA]/i.test(String(d.whetherPriorBE || d.priorBE || 'N')) ? 'Y' : 'N', 1),
        authorizedEconomicDealerCode:     s(d.aeoCode || ''),
        firstCheckRequested:              s(d.firstCheckRequested || d.firstCheck || 'N', 1),
        // 13-Nov-2026: upper case, as iCAFFE files it (LDH6R009) - 9 loaded WH jobs keep iCAFFE's typed 'ldh6r009'
        warehouseCode:                    s(String(d.warehouseCode || '').toUpperCase()),
        // 12-Nov-2026: warehouse site / BE and the packages released belong to an ex-bond (X) BE only - filed home and
        // warehouse (W) BEs leave all seven blank (W sent the IGM packages here). The released figures of a loaded X BE
        // are its own (released*), not the warehouse BE's IGM packages.
        warehouseCustomSiteId:            beType !== 'X' ? '' : s(String(d.warehouseCustomSiteId || '').toUpperCase()),
        warehouseBENo:                    beType !== 'X' ? '' : s(d.warehouseBENo || ''),
        warehouseBEDate:                  beType !== 'X' ? '' : fmtDate(d.warehouseBEDate || ''),
        noOfPackagesReleased:             beType !== 'X' ? '' : intStr(d.noOfPackagesReleased || d.totalPkg),
        packageCode:                      beType !== 'X' ? '' : s(d.releasedPkgCode || d.pkg || ''),
        grossWeight:                      beType !== 'X' ? '' : fx(d.releasedGrossWt || d.grossWt, 3),
        unitOfMeasurement:                beType !== 'X' ? '' : s(d.releasedWtUnit || d.grossWtUnit || ''),
        additionalChargesifanyPurchaseonHighseas: '',
        miscellaneousLoad:                '',
        uniqueConsignmentReferenceNo:     s(d.ucr || ''),
        ucrType:                          s(d.ucrType || ''),
        // screen select paymentMethodCode (T / D); before only "paymentMethod" (file import) was read
        paymentMethodCode:                s((() => { const t = String(d.paymentMethodCode || d.paymentMethod || 'T').trim().toUpperCase(); return t.startsWith('D') ? 'D' : 'T'; })(), 1),
      }],
      // 12-Nov-2026: a filed ex-bond (X) BE carries no EXCHANGE / HSS / IGMS rows - they are on the warehouse BE
      exchangeModel:      beType === 'X' ? [] : exchangeModel,
      // permission rows (FCK re-import after repair ...) were always sent empty. 29-Oct-2026
      permissionModel:    (() => { let r = d._permissionRows; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } }
        r = Array.isArray(r) ? r.slice() : []; if (!r.length && d.permissionCode) r.push({ permissionCode: d.permissionCode, reasonsForRequest: d.reasonsForRequest });
        // 29-Oct-2026: the screen's Section 48 / First Check / Provisional assessment flags and their reason popups were
        // never sent (only rows read from an imported file were) - a screen BE with S48 = Y went out with no PERMISSION row
        const Y = (v) => /^Y/i.test(String(v || '').trim());
        const fromScreen = [];
        if (Y(d.section48Requested || d.section48)) fromScreen.push({ permissionCode: 'S48', reasonsForRequest: d.section48Reason || '' });
        if (Y(d.firstCheckRequested || d.firstCheck)) fromScreen.push({ permissionCode: 'FCK', reasonsForRequest: d.firstCheckReason || '' });
        if (Y(d.provAssess || d.provisionalAssessment)) fromScreen.push({ permissionCode: 'PRV', reasonsForRequest: d.provAssessReason || '' });
        for (const x of fromScreen) { const i = r.findIndex(y => y && String(y.permissionCode || '').toUpperCase() === x.permissionCode); if (i >= 0) { if (x.reasonsForRequest) r[i] = { ...r[i], reasonsForRequest: x.reasonsForRequest }; } else r.push(x); }
        // a flag switched back to N on the screen drops the imported row of that code
        r = r.filter(y => { const c = String((y && y.permissionCode) || '').toUpperCase(); return !((c === 'S48' && d.section48Requested != null && !Y(d.section48Requested)) || (c === 'FCK' && d.firstCheckRequested != null && !Y(d.firstCheckRequested)) || (c === 'PRV' && d.provAssess != null && !Y(d.provAssess))); });
        return r.filter(x => x && x.permissionCode).map(x => ({ messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          permissionCode: s(String(x.permissionCode).toUpperCase(), 3), reasonsForRequest: s(x.reasonsForRequest || '', 120) })); })(),
      invoiceModel:       invoiceModel,
      // invoice "Misc charges (not included)" rows (popup was not saved before). 28-Oct-2026
      misc_chModel:       (invoices || []).flatMap((inv, i) => {
        let rows = inv.miscChargeRows; if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = []; } }
        return (Array.isArray(rows) ? rows : []).filter(r => r && (r.amount || r.rate)).map(r => ({
          messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          // rows saved before 30-Oct-2026 carry no code for most charges: derived from the description (ICEGATE directory order A..N)
          invoiceSerialNumber: String(i + 1), miscChargesCode: s(r.code || MISC_CODE_OF[String(r.desc || '').trim().toUpperCase()] || '', 2), miscChargesDscrptn: s(r.desc || '', 35), miscCharges: fx(r.amount, 2), miscRate: fx(r.rate, 4)
        }));
      }),
      itemsModel:         itemsModel,
      // licence debit, RSP and re-import rows from the item popups (were always sent empty). 28-Oct-2026
      licenseModel:       (items || []).flatMap((item, i) => {
        let rows = item.licenceData; if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = []; } }
        return (Array.isArray(rows) ? rows : []).filter(r => r && r.licenceNo).map((r, k) => ({
          messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          invoiceSerialNumber: s(item.invSrNo || item.invoiceSrNo || 1), itemSerialNumberInvoice: s(item.itemSrNo || (i + 1)),
          itemSrNoLicense: s(r.itemSrNoLicence || (k + 1)), debitValue: fx(r.debitValue, 2), debitQuantity: fx(r.debitQty, 2) /* 2 decimals as filed */, debitUnitOfMeasurement: s(r.debitUqc || '', 3),
          licenseRegistrationNumber: s(String(r.licenceNo).replace(/\s/g, ''), 10), licenseRegistrationDate: fmtDate(r.licenceDate || ''), licenseCode: s(r.licenceCode || '', 2), licenseRegnPort: s(r.regnPort || '', 6)
        }));
      }),
      // 30-Oct-2026: an item can be sold at more than one retail price, so rspData is a LIST of slabs now (a job
      // keyed earlier holds one object and is read as a one-slab list). Each slab is its own RSP line (itemSrNoRsp).
      rspModel:           (items || []).flatMap((item, i) => {
        let r = item.rspData; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = null; } }
        const rows = Array.isArray(r) ? r : (r ? [r] : []);
        const live = rows.filter(x => x && (x.rspValue || x.rspNotificationNo));
        if (!live.length) return [];
        // a single slab with no quantity covers the whole item; with several, each carries its own
        return live.map((x, k) => ({ messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          invoiceSerialNumber: s(item.invSrNo || item.invoiceSrNo || 1), itemSerialNumberInvoice: s(item.itemSrNo || (i + 1)), itemSrNoRsp: s(k + 1),
          rsp: fx(x.rspValue, 2), quantity: fx(x.rspQty || (live.length === 1 ? (item.qty || item.quantity) : ''), 3), descItem: s(item.desc || item.description || '', 40),
          rspNotification: s(x.rspNotificationNo || '', 10), rspNotificationSrNo: s(x.rspSrNo || '', 10) }));
      }),
      // DEPB rows: duty exemption claimed under a licence / scrip (filed RoDTEP-scrip BE: Y / RODTEP / 1). From the
      // item's depbData, or the "Exemption notification" fields of a Licence window row. 29-Oct-2026
      depbModel:          (items || []).flatMap((item, i) => {
        const own = (() => { let r = item.depbData; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = []; } } return Array.isArray(r) ? r : (r && typeof r === 'object' ? [r] : []); })();
        let lic = item.licenceData; if (typeof lic === 'string') { try { lic = JSON.parse(lic); } catch (e) { lic = []; } }
        // 30-Oct-2026: no invented serial "1" - a blank Sr No is filed blank and the validator asks for it
        const fromLic = (Array.isArray(lic) ? lic : []).filter(r => r && r.exemptionNotn).map(r => ({ whetherExemption: 'Y', bcdNotification: r.exemptionNotn, bcdNotificationSrNo: r.exemptionSrNo || '' }));
        const seen = new Set();
        return [...own, ...fromLic].filter(r => r && (r.bcdNotification || r.whetherExemption)).filter(r => { const k = `${r.bcdNotification}|${r.bcdNotificationSrNo}`; if (seen.has(k)) return false; seen.add(k); return true; }).map(r => ({
          messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          invoiceSerialNumber: s(item.invSrNo || item.invoiceSrNo || 1), itemSerialNumberInvoice: s(item.itemSrNo || (i + 1)),
          whetherExemption: s(String(r.whetherExemption || 'Y').toUpperCase(), 1), bcdNotification: s(String(r.bcdNotification || '').toUpperCase(), 10), bcdNotificationSrNo: s(r.bcdNotificationSrNo || '', 10) }));
      }),
      // Bond rows (Warehouse BE) and certificate (Ex-Bond) from the header screen. 28-Oct-2026
      bondModel:          (() => {
        let rows = d._bondRows;
        if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = []; } }
        rows = Array.isArray(rows) ? rows.slice() : [];
        if (d.autoField_24 && !rows.some(r => String(r.bondNo) === String(d.autoField_24))) rows.push({ bondNo: d.autoField_24, bondCode: d.autoField_26, bondPort: d.autoField_27 });
        return rows.filter(r => r && r.bondNo).map(r => ({
          messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          bondNumber: s(String(r.bondNo).replace(/\D/g, ''), 10), bondCode: s(r.bondCode || '', 2), bondPort: s(r.bondPort || '', 6)
        }));
      })(),
      // certificate grid (_certRows) + a certificate still in the form; one row per cert no. 28-Oct-2026
      certModel:          (() => {
        let rows = d._certRows;
        if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = []; } }
        rows = Array.isArray(rows) ? rows.slice() : [];
        if (d.autoField_30 && !rows.some(r => String(r.certNo) === String(d.autoField_30))) rows.push({ certNo: d.autoField_30, certDate: d.autoField_31, certType: d.autoField_32 });
        return rows.filter(r => r && r.certNo).map(r => ({
          messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          certificateNumber: s(r.certNo, 30), certificationDate: fmtDate(r.certDate || ''), certificationType: s(String(r.certType || '').toUpperCase(), 2)
        }));
      })(),
      // High-sea-sale seller rows from the header screen (were never sent). 28-Oct-2026
      hssModel:           beType === 'X' ? [] : (() => {
        let rows = d._hssRows;
        if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = []; } }
        return (Array.isArray(rows) ? rows : []).filter(r => r && (r.iecNo || r.iec || r.importerName)).map(r => ({
          messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          iec: s(r.iecNo || r.iec || '', 10), branchSrNo: s(r.branchSrNo || '', 3), importerName: s(r.importerName || '', 50),
          importerAddress1: s(r.address1 || '', 35), importerAddress2: s(r.address2 || '', 35), importerCity: s(r.city || '', 35),
          importerPin: s(r.pin || '', 6), precedingLevel: s((String(r.precedingLevel || '0').match(/\d+/) || ['0'])[0], 2)
        }));
      })(),
      reimportModel:      (items || []).flatMap((item, i) => {
        let r = item.reimportData; if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = null; } }
        const sbNo = r && (r.shippingBillNo || r.prevBeNo);
        if (!sbNo) return [];
        return [{ messageType: opts.isAmendment ? 'A' : 'F', customHouseCode: portCode, beNumber: '', beDate: '',
          invoiceSerialNumber: s(item.invSrNo || item.invoiceSrNo || 1), itemSerialNumber: s(item.itemSrNo || (i + 1)),
          shippingBillNo: s(sbNo, 7), shippingBillDate: fmtDate(r.shippingBillDate || r.prevBeDate || ''), portOfExport: s(r.portOfExport || r.prevCustomHouseCode || '', 6),
          invoiceNoSb: s(r.invoiceNoSb || ''), itemNoSb: s(r.itemNoSb || ''), notificationNo: s(r.notificationNo || '', 10), notificationSrNo: s(r.notificationSrNo || '', 10),
          exportFreight: fx(r.exportFreight, 2), exportInsurance: fx(r.exportInsurance, 2), customsDuty: fx(r.customsDuty, 2), exciseDuty: fx(r.exciseDuty, 2) }];
      }),
      sbedutyModel:       sbedutyModel,
      igmsModel:          beType === 'X' ? [] : igmsModel,
      containerModel:     (d.containers || []).map(c => ({
        messageType:      opts.isAmendment ? 'A' : 'F',
        customHouseCode:  portCode,
        beNumber:         '',
        beDate:           '',
        // schema names: igmNumber, igmDate, lclfcl, contNumber, sealNumber, truckNumber. 28-Oct-2026
        igmNumber:        s(c.igmNumber || c.igmNo || ''),
        igmDate:          fmtDate(c.igmDate || ''),
        lclfcl:           s(c.lclFcl || c.lclfcl || '', 1),
        contNumber:       s(c.contNo || c.containerNo || '', 11),
        sealNumber:       s(c.sealNo || '', 10),
        truckNumber:      s(c.truckNo || '', 20),
      })),
      ctxModel:           ctxModel,
      amendModel:         [],
      infoTypeModel:      infoTypeModel,
      sw_ConstModel:      swConstModel,
      sw_ProdModel:       swProdModel,
      ctrlModel:          ctrlModel,
      statementModel:     statementModel,
      supportingDocsModel: supportingDocsModel,
    },
    // digSign — required fields per CACHI01 schema (startSignature, startCertificate, signerVersion)
    // Filled by icegate.js after DSC signing; empty strings satisfy schema for unsigned drafts
    // Unsigned file = only headerField + master (as production files are before nCode signing); the signer adds digSign. 28-Oct-2026
    digSign: (opts.signerCn || opts.startSignature) ? {
      startSignature:    s(opts.startSignature || ''),
      startCertificate:  s(opts.startCertificate || ''),
      signerVersion:     s(opts.signerVersion || '1'),
    } : undefined,
  };
  if (!cachi01.digSign) delete cachi01.digSign;

  // 18-Nov-2026: every text of the BE goes in capitals, as iCAFFE files it (8870 and 7342: no small letters anywhere
  // but a permission's reason) - EagleView sent what was typed ("Nova 2 Pro 6+128GB&8", "Rule4 Transaction Value").
  // Header and the reason for a permission request are left as they are.
  const KEEP_CASE = new Set(['reasonsForRequest']);
  const upAll = (o) => {
    if (Array.isArray(o)) { o.forEach(upAll); return; }
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') { if (!KEEP_CASE.has(k) && /[a-z]/.test(v)) o[k] = v.toUpperCase(); }
      else if (v && typeof v === 'object') upAll(v);
    }
  };
  upAll(cachi01.master);

  return conformBE(cachi01, opts);
}

/**
 * Build SB CACHE01 JSON from exportData + items + invoices
 * Field mapping based on ExportHeaderTab.jsx exportData fields
 */
// Indian state name/code -> 2-character state code from the State master (e.g. DELHI -> DL). 28-Oct-2026
async function indianStateCodes() {
  const map = {};
  try {
    const State = require('../models/State'); const Country = require('../models/Country');
    const IN = await Country.findOne({ where: { code: 'IN' } });
    const rows = await State.findAll({ where: IN ? { countryId: IN.id } : {}, attributes: ['stateName', 'stateCode'] });
    for (const r of rows) { if (r.stateCode) { map[String(r.stateCode).toUpperCase()] = r.stateCode; if (r.stateName) map[String(r.stateName).trim().toUpperCase()] = r.stateCode; } }
  } catch (e) { /* master not available */ }
  return (v) => { const k = String(v || '').trim().toUpperCase(); return k ? (map[k] || (k.length <= 2 ? k : '')) : ''; };
}

async function buildSB_CACHE01(exportData, items = [], invoices = [], opts = {}) {
  const stateCodeOf = await indianStateCodes();
  let icegateId = '';
  if (opts.profileId) {
    const p = await IcegateProfile.findByPk(opts.profileId);
    if (p) icegateId = p.loginId;
  } else {
    const dp = await IcegateProfile.findOne({ where: { isDefault: true } });
    if (dp) icegateId = dp.loginId;
  }

  const d = exportData || {};
  const today = fmtDate(new Date());
  const seq   = nextSeq();

  // ExportHeaderTab field mapping:
  // customsPortCode     = Customs Port Code (e.g. INNSAV1)
  // shipperIec          = IEC Code (actual 10-digit IEC)
  // chaNo               = CHA License Number (actual CHA code e.g. "DELI999999")
  // shipperName         = Exporter Name
  // shipperAddress1/2   = Address
  // shipperCity/State/Pin = Location
  // shipperGstin        = GSTIN number
  // shipperGstinType    = GSTIN Type
  // consigneeName       = Consignee
  // shipmentMode        = AIR/SEA/LAND

  const portCode = s(d.customsPortCode || d.customsPort || d.autoField_1 || '', 6);
  const modeMap  = { AIR: 'A', SEA: 'S', LAND: 'L', A: 'A', S: 'S', L: 'L' };
  const mode     = modeMap[String(d.shipmentMode || d.ShipmentMode || '').toUpperCase()] || '';

  // ── FIX 1: IEC Code — use actual IEC field from frontend (shipperIec), NOT DB integer shipperId
  // 18-Nov-2026: the SB Header box (shipperIec) first - a job read from a generic file also carries iecCode, which won
  const iecCode  = s(d.shipperIec || d.iecCode || '', 10);

  // ── FIX 2: CHA License Number — use chaNo (actual CHA code like "DELI999999"), NOT chaId (DB integer)
  const chaLicNo = s(d.chaNo || d.chaCode || icegateId, 15);

  // ── CHA Details: pulled from exportData (set by ExportHeaderTab when CHA is selected)
  // chaName, chaAddress are populated from CHA master on selection
  const chaName    = s(d.chaName || '', 50);
  const chaAddress = s(d.chaAddress || '', 35);
  const chaCity    = s(d.chaCity || '', 35);
  const chaPin     = s(d.chaPin || '', 6);
  const chaGstin   = s(d.chaGstin || d.chaGSTIN || '', 15);
  const chaPhone   = s(d.chaPhone || d.chaMobile || '', 15);

  // Build invoice models for SB
  // ── FIX 3: Support both field naming styles:
  //    Short names (frontend formData): no, date, value, buyer, exchRate, contractType
  //    Full names (DB/ICEGATE):  invoiceNo, invoiceDate, invoiceValue, buyerName, exchangeRate, natureOfContract
  const invoiceModel = (invoices && invoices.length > 0 ? invoices : [{}]).map((inv, i) => ({
    invoiceSerialNumber: i + 1,
    actualInvoiceNo:     s(inv.no || inv.invoiceNo || inv.invoice_no || '', 17),
    invoiceDate:         fmtDate(inv.date || inv.invoiceDate || inv.invoice_date),
    invoiceCurrency:     s(inv.currency || '', 3),
    natureOfContract:    s(inv.contractType || inv.natureOfContract || d.shipmentType || 'FOB', 3),
    buyerName:           s(inv.buyer || inv.buyerName || '', 35),
    buyerAddress1:       s(inv.buyerAddress1 || '', 35),
    buyerAddress2:       s(inv.buyerAddress2 || '', 35),
    buyerAddress3:       s(inv.buyerAddress3 || '', 35),
    buyerAddress4:       s(inv.buyerAddress4 || '', 35),
    freightCurrency:     s(inv.freightCurr || inv.currency || '', 3),
    freightAmount:       n(inv.freightAmount || 0),
    insuranceRate:       n(inv.insuranceRate || 0),
    insuranceCurrency:   s(inv.insuranceCurr || inv.currency || '', 3),
    insuranceAmount:     n(inv.insuranceAmount || 0),
    commissionRate:      n(inv.commissionRate || 0),
    commissionCurrency:  s(inv.commissionCurr || '', 3),
    commissionAmount:    n(inv.commissionAmount || 0),
    discountOnFOB:       n(inv.discountRate || 0),
    discountCurrency:    s(inv.discountCurr || '', 3),
    discountAmount:      n(inv.discountAmount || 0),
    // the Invoices tab keeps other deductions in otherRate / otherCurr / otherAmount (were never sent). 29-Oct-2026
    // 18-Nov-2026: the Invoices tab boxes first; otherDeductions* (left by a file) only when they are empty
    otherDeductions:     n(inv.otherRate || inv.otherDeductionsRate || 0),
    otherDeductionsCurrency: s(inv.otherCurr || inv.otherDeductionsCurr || '', 3),
    otherDeductionsAmount:   n(inv.otherAmount || inv.otherDeductionsAmount || 0),
    // F / I / N / B: from the invoice, else from the nature of contract (ICEGATE: CIF B, CI I, CF F, FOB N); was always F
    addFreight:          s(inv.addFreight || ({ CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' })[String(inv.contractType || inv.natureOfContract || '').toUpperCase()] || 'N', 1),
    packingCharges:      n(inv.packingAmount || 0),
    exporterContractNumber: s(inv.contractNo || inv.exporterContractNumber || '', 30),
    natureOfPayment:     s(inv.pymtNature || inv.natureOfPayment || 'NA', 2),
    periodOfPayment:     s(inv.pymtPeriod || inv.periodOfPayment || '0', 3),
    thirdPartyName:       s(inv.tpName || '', 70),
    thirdPartyAddress1:   s(inv.tpAddress1 || '', 70),
    thirdPartyAddress2:   s(inv.tpAddress2 || '', 70),
    thirdPartyCity:       s(inv.tpCity || '', 35),
    // subdivision name, else the code box next to it (tpCntr1 was never sent); tpState is a file's copy. 18-Nov-2026
    thirdPartyCountrySubdivision: s(inv.tpCntryDiv || inv.tpCntr1 || inv.tpState || '', 35),
    // country code (the screen keeps the name in tpCntry and the code in tpCntr2; "UNITED STATES" was cut to "UN")
    thirdPartCountryCode: s(inv.tpCntr2 || (String(inv.tpCntry || '').trim().length === 2 ? inv.tpCntry : ''), 2),
    thirdPartyPin:        s(inv.tpPin || '', 10),
    authorizedEconomicOperatorCode:    s(inv.aeoCode || '', 17),
    authorizedEconomicOperatorCountry: s(inv.aeoCountryCode || inv.aeoRoleCntr || (String(inv.aeoCountry || '').trim().length === 2 ? inv.aeoCountry : ''), 2),
    authorizedEconomicOperatorRole:    s(inv.aeoRole || '', 3),
    termsPlace:          s(inv.termPlace || inv.termsPlace || '', 35)
  }));

  // item numbers + rows of the Items tab detail windows (rows kept as an array or JSON text). 29-Oct-2026
  const itemNos = (it, i) => ({ inv: n(it.invoiceSrNo || it.invSrNo || it.invSr || 1) || 1, itm: n(it.itemSr || it.itemSrNo) || (i + 1) });
  const itemRows = (flag, key) => (items || []).flatMap((it, i) => {
    if (!/^Y/i.test(String(it[flag] || ''))) return [];
    let rows = it[key]; if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = []; } }
    return (Array.isArray(rows) ? rows : []).filter(Boolean).map((r, k) => ({ ...itemNos(it, i), r, k }));
  });

  // Build items model for SB CACHE01
  const itemsModel = (items && items.length > 0 ? items : []).map((item, i) => {
    // 18-Nov-2026: what the Items tab shows (desc / qty / scheme) first. productDescription / quantity are copies made at
    // the first save and description / quantity / schemeCode come with a file: they won, so a description, qty or
    // scheme changed on the screen never reached the SB (JSON or .sb), while SW info SQC had the new qty. chkDesc is
    // "only printed on the checklist" - it is not sent.
    const desc = s(item.desc || item.description || item.productDescription || item.itemDescription || '', 120);
    return {
      invoiceSerialNumber:     n(item.invoiceSrNo || item.invSrNo || item.invSr || 1),
      // item Sr within its invoice (the Items tab numbers items per invoice; a running number was sent before, so
      // item 1 of invoice 2 did not match its drawback / licence / SW info rows). 29-Oct-2026
      itemSerialNumberInvoice: n(item.itemSr || item.itemSrNo) || (i + 1),
      schemeCode:              s((item.scheme ? String(item.scheme).trim().split(/[\s-]/)[0] : '') || item.schemeCode || '00', 2),
      ritcCode:                s(item.ritc || item.hsnCode || item.hsCode || item.hsn_code || '', 8),
      descOfGoods1:            s(desc.substring(0, 40), 40),
      descOfGoods2:            s(desc.substring(40, 80), 40),
      descOfGoods3:            s(desc.substring(80, 120), 40),
      unitOfMeasurement:       s(item.unit || item.uqc || '', 3),
      quantity:                n(item.qty || item.quantity || 0),
      unitPrice:               n(item.rate || item.unitPrice || 0),
      // rate unit and "Per" of the Items tab (were always the qty unit and 1, so a rate per 1000 PCS was filed per piece). 29-Oct-2026
      unitOfRate:              s(item.rateUnit || item.unit || item.uqc || '', 3),
      noOfUnit:                n(item.per) > 0 ? n(item.per) : 1,
      // presentMarketValue is per unit (iCAFFE 19513: 85,509.60 per NOS for 11 NOS). 12-Nov-2026: an item without PMV
      // sent its whole FOB as the per-unit PMV (11 NOS -> 11 times too high); now FOB per unit
      presentMarketValue:      n(item.pmv || item.unitPmv || 0) || (() => { const f = n(item.itemFob || item.fobValue || item.value || 0), q = n(item.qty || item.quantity || 0); return q > 0 ? Math.round(f / q * 100) / 100 : f; })(),
      jobWorkNotificationNo:   s(item.jobWorkNotificationNo || '', 10),
      thirdParty:              s(item.thirdParty || 'N', 1),
      // RoDTEP claim (Scheme tab > RoDTEP / Items tab) also marks the reward item. 29-Oct-2026
      // 18-Nov-2026: the RoDTEP / Reward switches of the item decide; a file's rewardItem only when the item has neither
      // (a file item with Y could not be switched off on the Items tab)
      rewardItem:              s((item.rodtep !== undefined && item.rodtep !== null && item.rodtep !== '') || (item.reward !== undefined && item.reward !== null && item.reward !== '')
        ? (/^Y/i.test(String(item.rodtep || '')) || /^Y/i.test(String(item.reward || '')) || n(item.rodtepAmount) > 0 ? 'Y' : 'N')
        : (/^Y/i.test(String(item.rewardItem || '')) || n(item.rodtepAmount) > 0 ? 'Y' : 'N'), 1),
      // Items tab > Manufacturer window keeps manfProd* (never read before, so these went empty). 29-Oct-2026
      // 18-Nov-2026: the window first; mfg* (from a file) only for a box the window left empty
      itemManufacturerProducerCodeType: s(String(item.manfProdCdType || item.mfgType || '').toUpperCase(), 1),
      itemManufacturerProducerGrowerCode: s(String(item.manfProdCode || item.mfgCode || '').toUpperCase(), 17),
      itemManufacturerProducerGrowerAddress1: s(item.manfProdAddress1 || item.mfgAddress1 || '', 70),
      itemManufacturerProducerGrowerAddress2: s(item.manfProdAddress2 || item.mfgAddress2 || '', 35),
      itemManufacturerProducerGrowerCity: s(item.manfProdCity || item.mfgCity || '', 35),
      itemManufacturerProducerGrowerCountrySubdivision: s(item.manfProdSubDiv || item.manfProdState || item.mfgState || '', 35),
      itemManufacturerProducerGrowerPin: s(item.manfProdPin || item.mfgPin || '', 10),
      itemManufacturerCountry: s(String(item.manfProdCountry || item.mfgCountry || '').toUpperCase(), 2),
      sourceState:             s(stateCodeOf(item.stateCode) || stateCodeOf(item.sourceState) || '', 35),
      transitCountry:          s(String(item.transitCountry || '').toUpperCase(), 2),
      // 0 = no accessories, 1 / 2 from the Accessories window ('NONE' was cut to 'NO'). 29-Oct-2026
      accessoryStatus:         /^Y/i.test(String(item.accessory || '')) ? s(item.accessoryStatus || '1', 2) : s(/^[012]$/.test(String(item.accessoryStatus || '')) ? item.accessoryStatus : '0', 2),
      // the Items tab keeps these as endUse / hawb / totalPkgs: end use always went as GNX100 and HAWB / packages empty. 29-Oct-2026
      endUseOfItem:            s(String(item.endUse || item.endUseOfItem || '').split(/[\s|]/)[0], 20),
      hawbNo:                  s(item.hawb || item.hawbNo || '', 15),
      totalPackage:            n(item.totalPkgs || item.totalPackage || item.packages || 0),
      igstPaymentStatus: (() => {
        const v = String(item.igstPayStatus || item.igstPaymentStatus || item.igstStatus || '');
        if (v.includes('Bond') || v.includes('LUT') || v === 'N') return 'LUT';
        if (v.includes('Payment') || v === 'P') return 'P';
        if (v.includes('Not') || v === 'NA') return 'NIL';
        if (/^select$/i.test(v.trim())) return ''; // nothing picked on the Items tab ('Sel' was sent). 29-Oct-2026
        return s(v, 3);
      })(),
      taxableValue:            n(item.taxableValue || 0),
      igstAmount:              n(item.igstAmt || item.igstAmount || 0),
    };
  });

  const cache01 = {
    headerField: {
      senderID:               icegateId,
      receiverID:             portCode,
      indicator:              opts.indicator || 'P',
      messageID:              'CACHE01',
      sequenceOrControlNumber: seq,
      amendmentReason:        (opts.amendment || opts.isAmendment) ? opts.amendReason : undefined,
      amendmentType:          (opts.amendment || opts.isAmendment) ? opts.amendmentType : undefined,
      // our job no. NDL/AE/26/0004 -> 4 (numeric, as the schema wants); job date from the job. 28-Oct-2026
      jobNumber:              n(d.jobNo) || n((String(d.jobNo || '').match(/(\d+)\D*$/) || [])[1]) || seq,
      jobDate:                fmtDate(d.jobDate || '') || today,
      messageType:            (opts.amendment || opts.isAmendment) ? 'A' : 'F',
    },
    master: {
      sbModel: [{
        // ── FIX 2 applied: chaNo → actual CHA license (not DB integer chaId)
        chaLicenseNumber: chaLicNo,
        // ── FIX 1 applied: shipperIec → actual IEC code (not DB integer shipperId)
        importerExporterCode: iecCode,
        // branch 0 is a real branch serial (was turned into 1); only an empty branch falls back to 1
        branchSrNoOfExporter: (() => { const v = d.shipperBranchSrNo ?? d.branchSrNo; return v === '' || v === null || v === undefined || isNaN(+v) ? 1 : n(v); })(),
        impExpName:      s(d.shipperName || d.exporterName || '', 50),
        impExpAddress1:  s(d.shipperAddress1 || d.address1 || '', 35),
        impExpAddress2:  s(d.shipperAddress2 || d.address2 || '', 35),
        impExpCity:      s(d.shipperCity || d.city || '', 35),
        impExpState:     s(d.shipperState || d.state || '', 25),
        impExpPin:       s(d.shipperPin || d.pin || '', 6),
        // schema allows R (merchant) | F (manufacturer); the screen stores M for merchant
        typeOfExporter:  (() => { const t = String(d.mercManuf || d.exporterType || 'M').trim().toUpperCase(); return t.startsWith('F') || t.startsWith('D') || t.includes('MANUF') ? 'F' : 'R'; })(), // courier: D = manufacturer -> F, C = merchant -> R (schema allows R | F)
        exporterClass:   s(d.shipperClass || 'P', 1), // the screen shows Private when nothing was picked
        // the screen keeps the state of origin in stateOriginCode (it was not read, so the exporter's own state was sent)
        stateOfOriginExporter: s(stateCodeOf(d.stateOriginCode || d.stateOfOrigin) || stateCodeOf(d.shipperState) || '', 2),
        authorizedDealerCode:  s(d.adCode || '', 14),
        // 18-Nov-2026: SB Header > Other Details > EPZ/ICD (autoField_11; a file's epzCode is read into it) - was always
        // sent blank. The schema takes 1 character: a longer entry (an ICD code) is not sent and the check says so.
        epzCode: (() => { const v = String(d.autoField_11 || d.epzCode || '').trim().toUpperCase(); return v.length === 1 ? v : ''; })(),
        consigneeName:     s(d.consigneeName || '', 50),
        consigneeAddress1: s(d.consigneeAddress1 || '', 35),
        consigneeAddress2: s(d.consigneeAddress2 || '', 35),
        consigneeAddress3: s(d.consigneeAddress3 || '', 35),
        consigneeAddress4: s(d.consigneeAddress4 || '', 35),
        consigneeCountry:  s(d.consigneeCountryCode || d.consigneeCountry || '', 2),
        categoryForNEFISB: s(d.nfeiCategoryCode || '', 2),
        rbiWaiverNo:   s(d.rbiNo || d.RBIWaiver || d.rbiWaiverNo || '', 20),
        rbiWaiverDate: fmtDate(d.rbiWaiverDate || d.RBIWaiverDate),
        // the Loading Port box first (an ICD job is filed at the ICD but loaded at the sea / air port); customs location only when it is empty. 29-Oct-2026
        portOfLoading:              s(d.loadingPortCode || d.customsPortCode || d.autoField_5 || d.loadingPort || portCode, 6),
        portOfFinalDestination:     s(d.destPortCode || d.destPort || '', 6),
        countryOfFinalDestination:  s(d.destCountryCode || d.DestinationCountry || '', 2),
        countryOfDischarge:         s(d.discCountryCode || d.discCountry || '', 2),
        portOfDischarge:            s(d.discPortCode || d.discPort || '', 6),
        sealType:           s(d.sealType || '', 1),
        natureOfCargo:      s(d.natureOfCargo || '', 2),
        // SB2 Details screen keeps these in autoField_14..24 (Total Pkgs, Marks, Loose, Gross/Net Wt, MAWB/HAWB). 28-Oct-2026
        // 18-Nov-2026: the SB2 Details boxes first; grossWeight / totalPackages / mawbNo ... (job columns, other imports) only
        // when the box is empty - a value kept in those won over what the operator typed in the box
        grossWeight:        n(d.autoField_18 || d.grossWeight) || 0,
        netWeight:          n(d.autoField_19 || d.netWeight) || 0,
        unitOfMeasurement:  s(d.grWtUnit || d.uqc || '', 3),
        // no made-up 1 when Total Packages is empty (the check "must be more than 0" could never fire). 29-Oct-2026
        totalNumberOfPackages: n(d.autoField_14 || d.totalPackages || d.totalPkgs) || 0,
        marksNumbers:       s([d.autoField_15, d.autoField_16].filter(Boolean).join(' ') || d.marksNumbers || '', 300),
        numberOfLoosePackets: n(d.autoField_17 || d.loosePackets || 0),
        numberOfContainers: n(d.Containers ? d.Containers.length : (d.containers ? d.containers.length : 0)),
        mawbnumber: s(d.autoField_22 || d.mawbNo || d.mawbnumber || '', 15),
        hawbnumber: s(d.autoField_24 || d.hawbNo || d.hawbnumber || '', 15),
        // 3-letter type (GSN = GSTIN, PAN ...) as in the schema; "GSTIN" (5 letters) was sent before. 28-Oct-2026
        gstnType:   (() => { const t = String(d.shipperGstinType || d.GSTINType || 'GSTIN').trim().toUpperCase(); return ({ GSTIN: 'GSN', GST: 'GSN', 'GST GOVERNMENT': 'GSG', 'GST DIPLOMAT': 'GSD', 'INCOME TAX PAN': 'PAN', PAN: 'PAN', TAN: 'TAN', PASSPORT: 'PSP', AADHAR: 'ADH', AADHAAR: 'ADH' })[t] || (t.length <= 3 ? t : 'GSN'); })(),

        gstnId:     s(d.shipperGstin || d.GSTINId || '', 15),
      }],
      invoiceModel: invoiceModel,
      itemModel: itemsModel,
      // Scheme tab > License rows (registration no / date, item Sr in Part E / C, qty, export qty, M / I). Sent empty before. 29-Oct-2026
      licenceModel: (Array.isArray(d.licenseItems) ? d.licenseItems : []).filter(l => l && String(l.regNo || '').trim()).map((l, k, all) => ({
        invoiceSerialNumber:     n(l.invNo || l.invSr || 1) || 1,
        itemSerialNumberInvoice: n(l.itemNo || l.itemSr || 1) || 1,
        srno:                    n(l.srNo) || (all.slice(0, k).filter(x => String(x.invNo) === String(l.invNo) && String(x.itemNo) === String(l.itemNo)).length + 1),
        registrationNo:          s(String(l.regNo).trim(), 25),
        registrationDate:        fmtDate(l.regDate || ''),
        itemSerialNoInPartE:     s(l.snE || '', 10),
        itemSerialNoInPartC:     s(l.snC || '', 10),
        quantity:                n(l.qty),
        exportQuantity:          n(l.expQty !== undefined && l.expQty !== '' ? l.expQty : l.qty),
        whetherIndigenousImported: /^I(ND)?$/i.test(String(l.indImp || '').trim()) || /^INDIG/i.test(String(l.indImp || '')) ? 'I' : 'M',
      })),
      // both container shapes: header screen (ContainerNumber ...) and saved rows (containerNo, size, sealNo ...). 28-Oct-2026
      containerModel: (d.Containers || d.containers || []).map(c => ({
        containerNumber:        s(c.ContainerNumber || c.containerNo || '', 15),
        containerSize:          s(c.ContainerSize || c.size || '', 4),
        exciseSealNo:           s(c.ExciseSealNo || c.exciseSealNo || c.sealNo || '', 35),
        sealDate:               fmtDate(c.SealDate || c.sealDate || ''),
        sealTypeIndicator:      s(c.SealTypeIndicator || c.sealType || '', 5),
        sealDeviceID:           s(c.SealDeviceID || c.deviceId || '', 35),
        movementDocumentType:   s(c.MovementDocumentType || c.docType || '', 5),
        movementDocumentNumber: s(c.MovementDocumentNumber || c.docNo || '', 35),
        eqmntType:              s(c.EqmntType || c.eqmntType || '', 3),
        eqmntQty:               n(c.EqmntQty || c.eqmntQty || 0) || '',
        eqmntQtyCode:           s(c.EqmntQtyCode || c.eqmntQtyCode || '', 3),
      })),
      // Scheme tab > AR4 (items with AR4 = Y). Sent empty before. 29-Oct-2026
      ar4Model: (items || []).filter(it => /^Y/i.test(String(it.ar4 || '')) && String(it.ar4No || '').trim()).map((it, i) => ({
        invoiceSerialNumber:     n(it.invoiceSrNo || it.invSrNo || it.invSr || 1) || 1,
        itemSerialNumberInvoice: n(it.itemSr || it.itemSrNo) || (items.indexOf(it) + 1),
        ar4Number:               s(it.ar4No, 17),
        ar4Date:                 fmtDate(it.ar4Date || ''),
        commissionerate:         s(it.commissionerate || '', 20),
        division:                s(it.division || '', 20),
        range:                   s(it.ar4Range || it.range || '', 20),
        remarks:                 s(it.ar4Remarks || '', 250),
      })),
      // Items tab detail windows (Cess / SW Constituent / SW Control), only for items whose switch is Y. 29-Oct-2026
      cessModel: itemRows('cess', 'cessRows').map(({ inv, itm, r, k }) => ({
        invoiceSerialNumber: inv, itemSerialNumberInvoice: itm, srno: k + 1, cessActCode: s(String(r.cessActCode || '').toUpperCase(), 10),
        quantity: n(r.quantity), itemCessValue: s(/^Y/i.test(String(r.itemCessValue || '')) ? 'Y' : 'N', 1),
      })),
      constituentFinal: itemRows('swConst', 'constRows').map(({ inv, itm, r, k }) => ({
        invoiceSerialNumber: inv, itemSerialNumber: itm, constituentSerialNo: k + 1, constituentElementName: s(r.name, 256),
        constituentElementCode: s(r.code, 17), constituentPercentage: n(r.pct), constituentYieldPercentage: n(r.yieldPct),
        activeIngredient: s(/^Y/i.test(String(r.active || '')) ? 'Y' : 'N', 1),
      })),
      controlType: itemRows('swCtrl', 'ctrlRows').map(({ inv, itm, r, k }) => ({
        invoiceSerialNumber: inv, itemSerialNumber: itm, controlSerialNo: k + 1, controlTypeCode: s(String(r.typeCode || '').toUpperCase(), 17),
        controlLocation: s(r.location, 17), controlStartDate: fmtDate(r.startDate || ''), controlEndDate: fmtDate(r.endDate || ''),
        controlResultCode: s(r.resultCode, 17), controlResultRemarks: s(r.remarks, 4000),
      })),
      // schema names (itemSerialNumberInvoice, dbkScheduleNumber); the old names were not in the schema. 28-Oct-2026
      // rows without a DBK No are not sent (an empty schedule number is rejected). 29-Oct-2026
      dbkModel: (d.dbkItems || []).filter(dbk => dbk && String(dbk.dbkNo || dbk.dbkSrNo || '').trim()).map(dbk => ({
        invoiceSerialNumber:     n(dbk.invSr || dbk.invNo || 1) || 1,
        itemSerialNumberInvoice: n(dbk.itemSr || dbk.itemNo || 1) || 1,
        dbkScheduleNumber:       s(dbk.dbkNo || dbk.dbkSrNo || '', 15),
        drawbackQuantity:        n(dbk.dbkQty || dbk.qty || 0),
        drawbackAvailable:       s(dbk.drawbackAvailable || 'Y', 1),
      })),
      depbModel: [],
      depbParentModel: [],
      dfiaModel: [],
      eouModel: [],
      // one row for every invoice currency (standard ones too, INR at 1), as the production SB files. 29-Oct-2026
      // 18-Nov-2026: built from the invoices on the screen. The rows read from a file were sent whatever the invoices said
      // later - an invoice changed to EUR (or a second invoice in EUR) went with only the file's USD row. A file row is
      // still used for its currency when the invoice has the same rate (it carries the notification date of the file).
      exchangeModel: await (async () => {
        let fileRows = opts.exchangeRates || d._exchangeRates || [];
        if (typeof fileRows === 'string') { try { fileRows = JSON.parse(fileRows); } catch (e) { fileRows = []; } }
        fileRows = (Array.isArray(fileRows) ? fileRows : []).filter(r => r && typeof r === 'object');
        const fileOf = (c) => fileRows.find(r => String(r.invoiceCurrencyCode || r.currencyCode || '').trim().toUpperCase() === c);
        const curs = [];
        (invoices || []).forEach(inv => { const c = String(inv.currency || '').trim().toUpperCase(); if (c && !curs.includes(c)) curs.push(c); });
        if (!curs.length) return fileRows; // nothing on the invoices yet: the file's rows as they came
        // the CBIC export rate in force on the job date (history of notifications) gives the date of a notified rate
        const jobDay = (() => { const t = fmtDate(d.jobDate || '') || today; return /^\d{8}$/.test(t) ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : ''; })();
        let hist = new Map();
        try { if (jobDay) hist = await require('./cbicExchangeRates').historyOf(curs.filter(c => c !== 'INR')); } catch (e) { hist = new Map(); }
        const out = [];
        for (const c of curs) {
          const inv = (invoices || []).find(x => String(x.currency || '').trim().toUpperCase() === c && n(x.exchRate || x.exchangeRate) > 0) || (invoices || []).find(x => String(x.currency || '').trim().toUpperCase() === c);
          const std = String((inv && inv.nonStandardCurr) || '').toUpperCase() === 'Y' ? 'N' : 'Y';
          const f = fileOf(c);
          const typed = inv && n(inv.exchRate || inv.exchangeRate) > 0;
          if (c !== 'INR' && !typed) { if (f) out.push(f); continue; } // no rate on the invoice: the file's row, else none (the check says so)
          const q = c === 'INR' ? { unitInRs: fx(1, 2), rate: 1 } : sbExchRate(c, inv.exchRate || inv.exchangeRate, inv.unitInRs);
          if (f) {
            const fr = n(f.rate) / (n(f.unitInRs) || 1), qr = n(q.rate) / (n(q.unitInRs) || 1);
            if ((c === 'INR' || Math.abs(fr - qr) < 0.00005) && String(f.whetherStandardCurrency || 'Y').toUpperCase() === std) { out.push(f); continue; }
          }
          let eff = fmtDate(inv.exchDate || inv.date || inv.invoiceDate || '');
          const rows = hist.get(c) || [];
          const same = (h) => Math.abs(n(h.exportRate) - n(q.rate) / (n(q.unitInRs) || 1)) < 0.00005;
          const inForce = rows.find(h => h.effectiveDate <= jobDay);
          const pick = inForce && same(inForce) ? inForce : rows.find(h => h.effectiveDate <= jobDay && same(h));
          if (pick) eff = fmtDate(pick.effectiveDate);
          out.push({ invoiceCurrencyCode: s(c, 3), currencyName: s((inv && inv.currencyName) || CURRENCY_NAMES[c] || (f && f.currencyName) || '', 20), unitInRs: q.unitInRs, rate: c === 'INR' ? 1 : q.rate, effectiveDate: eff, whetherStandardCurrency: std });
        }
        return out;
      })(),
      // SW info rows of the Items tab (swInfos: type, qualifier, code, text, msr, uqc) + rows read from a file. 28-Oct-2026
      // Rows every item of the production SB files carries are added when missing: ORC/STO (state code), ORC/DOO
      // (district code), ORC/EPT NCPTI, DTY/GCESS 0 INR, CHR/SQC; "07 | DELHI" style codes of the screen are cut to the
      // code (they were sent as typed). Items that came with rows from a file keep those rows only. 29-Oct-2026
      infoType: (() => {
        const fileRows = opts.infoTypes || d._infoTypes || [];
        const has = (inv, itm) => fileRows.some(r => n(r.invoiceSerialNumber) === inv && n(r.itemSerialNumber) === itm);
        const codeOnly = (t, q, c) => (t === 'ORC' && ['STO', 'DOO', 'EPT'].includes(q) ? String(c || '').split('|')[0].trim() : String(c || '').trim());
        const itemRows = (items || []).flatMap((item, i) => {
          const { inv, itm } = itemNos(item, i);
          const rows = (Array.isArray(item.swInfos) ? item.swInfos : []).filter(r => r && (r.swInfoField1 || r.swInfoField2 || r.swInfoField3 || r.swInfoField4))
            .map(r => { const t = s(r.swInfoField1 || '', 3).toUpperCase(), q = s(r.swInfoField2 || '', 100).toUpperCase();
              return { infoType: t, infoQualifier: q, infoCode: s(codeOnly(t, q, r.swInfoField3), 100), infoText: s(r.swInfoField4 || '', 100), infoMeasure: s(r.swInfoField5 || '', 16), infouqc: s(r.swInfoField6 || '', 3) }; });
          if (!has(inv, itm)) {
            const got = (t, q) => rows.some(r => r.infoType === t && r.infoQualifier === q);
            const st = String(stateCodeOf(item.stateCode) || stateCodeOf(item.sourceState) || stateCodeOf(d.stateOfOrigin || d.stateOriginCode) || '');
            if (!got('ORC', 'STO') && st) rows.push({ infoType: 'ORC', infoQualifier: 'STO', infoCode: st, infoText: '', infoMeasure: '', infouqc: '' });
            if (!got('ORC', 'DOO') && String(item.districtCode || '').trim()) rows.push({ infoType: 'ORC', infoQualifier: 'DOO', infoCode: s(item.districtCode, 100), infoText: '', infoMeasure: '', infouqc: '' });
            if (!got('ORC', 'EPT')) rows.push({ infoType: 'ORC', infoQualifier: 'EPT', infoCode: 'NCPTI', infoText: '', infoMeasure: '', infouqc: '' });
            if (!got('DTY', 'GCESS')) rows.push({ infoType: 'DTY', infoQualifier: 'GCESS', infoCode: '', infoText: '', infoMeasure: String(n(item.cessAmount)), infouqc: 'INR' });
            if (!got('CHR', 'SQC')) rows.push({ infoType: 'CHR', infoQualifier: 'SQC', infoCode: '', infoText: '', infoMeasure: String(item.qty || item.quantity || ''), infouqc: s(item.unit || item.uqc || '', 3) });
          }
          // 19-Nov-2026: SB Header "MOOWR [Y/N]" = Yes -> SW info DIR / MOOWR / MOOWRY on every item (ICES Exports message
          // format 3.3 / 3.7); a DIR / MOOWR row of the item or of the file is kept as it is
          if (/^Y/i.test(String(d.autoField_31 || '')) && !rows.some(r => r.infoType === 'DIR' && r.infoQualifier === 'MOOWR')
            && !fileRows.some(r => n(r.invoiceSerialNumber) === inv && n(r.itemSerialNumber) === itm && String(r.infoType || '').toUpperCase() === 'DIR' && String(r.infoQualifier || '').toUpperCase() === 'MOOWR'))
            rows.push({ infoType: 'DIR', infoQualifier: 'MOOWR', infoCode: 'MOOWRY', infoText: '', infoMeasure: '', infouqc: '' });
          return rows.map((r, k) => ({ invoiceSerialNumber: inv, itemSerialNumber: itm, infoSrNo: k + 1, ...r }));
        });
        // 12-Nov-2026: an item read from a file and then changed in the Items form has its own rows too (the form makes
        // STO / DOO / EPT / GCESS / SQC / RDT): each such row went twice (file row + item row). The item's row wins;
        // file rows of other kinds stay. Serial numbers 1, 2, 3 ... inside each item.
        const key = (r) => `${n(r.invoiceSerialNumber) || 1}/${n(r.itemSerialNumber)}/${String(r.infoType || '').toUpperCase()}/${String(r.infoQualifier || '').toUpperCase()}`;
        const ownKeys = new Set(itemRows.map(key));
        const all = [...fileRows.filter((r) => !ownKeys.has(key(r))), ...itemRows];
        const seq = {};
        return all.map((r) => { const g = `${n(r.invoiceSerialNumber) || 1}/${n(r.itemSerialNumber)}`; seq[g] = (seq[g] || 0) + 1; return { ...r, infoSrNo: seq[g] }; });
      })(),
      itemAccessModel: (items || []).map((it, i) => ({ it, ...itemNos(it, i) })).filter(({ it }) => /^Y/i.test(String(it.accessory || '')) && String(it.accessoryDesc || '').trim()).map(({ it, inv, itm }) => ({
        invoiceSerialNumber: inv, itemSerialNumberInvoice: itm, descriptionOfAccessories: s(it.accessoryDesc, 500),
        itemAccessoriesValue: s(/^Y/i.test(String(it.accessoryValue || '')) ? 'Y' : 'N', 1),
      })),
      itemRawMaterialModel: [],
      jobWorkModel: [],
      packingListModel: (d.PackingDetails || []).map(p => ({
        packingNumberFrom: n(p.PackingNumberFrom || 0),
        packingNumberTo:   n(p.PackingNumberTo || 0),
        packingCode:       s(p.PackingCode || '', 3),
      })),
      production: itemRows('swProd', 'prodRows').map(({ inv, itm, r, k }) => ({
        invoiceSerialNumber: inv, itemSerialNumber: itm, productionSerialNo: k + 1, productionBatchIdentifier: s(String(r.batch || '').toUpperCase(), 17),
        productionBatchQuantity: n(r.qty), unitQuantityCode: s(String(r.uqc || '').toUpperCase(), 3),
        dateOfManufacturing: fmtDate(r.mfgDate || ''), dateOfExpiry: fmtDate(r.expDate || ''), bestBefore: fmtDate(r.bestBefore || ''),
      })),
      // Items tab > Re-Export window rows (reExpField2..22 as the screen keeps them). Sent empty before. 29-Oct-2026
      reexport: (items || []).flatMap((item, i) => {
        let rows = item.reExports; if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = []; } }
        const yn = (v) => (/^Y/i.test(String(v || '')) ? 'Y' : /^N/i.test(String(v || '')) ? 'N' : '');
        return (Array.isArray(rows) ? rows : []).filter(r => r && String(r.reExpField3 || '').trim()).map((r, k) => ({
          invoiceSerialNumber: n(item.invoiceSrNo || item.invSrNo || item.invSr || 1) || 1,
          itemSerialNumber:    n(item.itemSr || item.itemSrNo) || (i + 1),
          serialNo:            k + 1,
          beSite:              s(String(r.reExpField2 || '').toUpperCase(), 6),
          beNo:                n(String(r.reExpField3).replace(/\D/g, '')),
          beDate:              fmtDate(r.reExpField4 || ''),
          beInvoiceNo:         n(r.reExpField5) || 1,
          beItem:              n(r.reExpField6) || 1,
          manualBe:            yn(r.reExpField7) || 'N',
          beQuantityUtilised:  n(r.reExpField8),
          beItemDescription:   s(r.reExpField9 || item.desc || '', 120),
          beQty:               n(r.reExpField10),
          beUqc:               s(String(r.reExpField11 || '').toUpperCase(), 3),
          beAssessedValue:     n(r.reExpField12),
          beDutyPaid:          n(r.reExpField13),
          beDutyPaymentDate:   fmtDate(r.reExpField14 || ''),
          beOtherIdentifiableParameter: s(r.reExpField15 || '', 120),
          beAssessableValueClaimed: n(r.reExpField16),
          beItemUsed:          yn(r.reExpField17),
          commisionerPermission: yn(r.reExpField18),
          inputCredit:         yn(r.reExpField19),
          personalUse:         yn(r.reExpField20),
          modvaAvailed:        yn(r.reExpField21),
          modvatRepaid:        yn(r.reExpField22),
        }));
      }),
      rotationModel: [],
      servTaxRefund: [],
      statement: [...(opts.statements || d._statements || []), ...(items || []).flatMap((item, i) => (Array.isArray(item.swStatements) ? item.swStatements : [])
        .filter(r => r && r.typeCode && r.typeCode !== 'Select')
        .map((r, k) => ({
          invoiceSerialNumber: n(item.invSr || 1) || 1, itemSerialNumber: n(item.itemSr || (i + 1)) || (i + 1), statementSerialNo: k + 1,
          statementType: s(r.typeCode, 3), statementCode: s(r.statementCode && r.statementCode !== 'Select' ? r.statementCode : '', 7), statementText: s(r.text || '', 4000)
        })))],
      stuffModel: [{
        factoryStuffed:    s(/^Y/i.test(String(d.factoryStuffed || '')) ? 'Y' : 'N', 1),
        sampleAccompanied: s(/^Y/i.test(String(d.autoField_32 || d.sampleAccompanied || '')) ? 'Y' : 'N', 1), // "Sample Accomp." of SB2 Details (was always N)
      }],
      // ── e-Sanchit Supporting Documents (IRN + DRN from Items' eSanchitList)
      // ICEGATE CACHE01 supportingDocs[] expects: documentCode, irn, drn
      supportingDocs: (() => {
        // e-Sanchit documents: item window rows (Item / Invoice / SB level, with issuing party, beneficiary, place and
        // dates - 29-Oct-2026; before, every row was sent at item level with only IRN / code / DRN) and job-level rows.
        const docs = [];
        const seen = new Set();
        const dt = (v) => fmtDate(v || '');
        const push = (row) => { const k = [row.invoiceSerialNumber, row.itemSerialNumber, row.imageReferenceNumber || row.documentReferenceNo].join('|'); if (seen.has(k)) return; seen.add(k); docs.push({ ...row, serialNo: docs.length + 1 }); };
        const build = (doc, invSr, itemSr) => {
          if (doc && doc._icegate && typeof doc._icegate === 'object') { push({ ...doc._icegate, icegateId: s(doc._icegate.icegateId || icegateId, 35) }); return; }
          if (!doc || !(doc.irn || doc.drn)) return;
          const lvl = String(doc.docFor || 'Item').toUpperCase();
          push({
            invoiceSerialNumber:  lvl === 'SB' ? 0 : invSr,
            itemSerialNumber:     lvl === 'ITEM' ? itemSr : 0,
            chaLicenseNumber:     s(chaLicNo || '', 15),
            iec:                  s(iecCode || '', 10),
            icegateId:            s((doc.icegateDifferent && doc.icegateId) || icegateId, 35),
            imageReferenceNumber: s(doc.irn || '', 16),
            documentTypeCode:     s(doc.docCode || '', 6),
            documentIssuingPartyCode:             s(doc.issuerCode || '', 17),
            documentIssuingPartyName:             s(doc.issuerName || '', 70),
            documentIssuingPartyNameAddress1:     s(doc.issuerAddress1 || doc.issuerAddress || '', 70),
            documentIssuingPartyNameAddress2:     s(doc.issuerAddress2 || '', 70),
            documentIssuingPartyNameCity:         s(doc.issuerCity || '', 35),
            documentIssuingPartyNamePin:          s(doc.issuerPin || '', 10),
            // 18-Nov-2026: the e-Sanchit DRN, as iCAFFE files it; "Doc. Ref. No." of the window only when there is no DRN.
            // 19-Nov-2026: ICEGATE advisory on LPCOs (12-Nov-2026): "Document reference number" is the number of the
            // document itself (licence / permit / certificate no) - so "Doc. Ref. No." when it is typed, else the DRN.
            documentReferenceNo:  s(doc.refNo || doc.drn || '', 35),
            placeOfIssue:         s(doc.placeOfIssue || doc.issueLocation || '', 35),
            documentIssueDate:    dt(doc.issueDate || doc.date),
            documentExpiryDate:   dt(doc.expiryDate),
            documentBeneficiaryPartyCode:         s(doc.beneficiaryCode || '', 17),
            documentBeneficiaryPartyName:         s(doc.beneficiaryName || d.shipperName || '', 70),
            documentBeneficiaryPartyNameAddress1: s(doc.beneficiaryAddress1 || '', 70),
            documentBeneficiaryPartyNameAddress2: s(doc.beneficiaryAddress2 || '', 70),
            documentBeneficiaryPartyNameCity:     s(doc.beneficiaryCity || '', 35),
            documentBeneficiaryPartyNamePin:      s(doc.beneficiaryPin || '', 10),
            fileType:             s(String(doc.fileType || 'PDF').toUpperCase(), 3),
          });
        };
        const docList = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
        (items || []).forEach(item => {
          // 03-Nov-2026: a saved job comes back from the database with eSanchitList as JSON text ("[]"), not a list -
          // "[]".forEach crashed Preview JSON / Send to ICEGATE for every reopened export job. Accept text or list.
          const list = docList(item.eSanchitList).length ? docList(item.eSanchitList) : docList(item.additionalData?.eSanchitList);
          list.forEach(doc => build(doc, n(item.invSr || 1) || 1, n(item.itemSr || 1) || 1));
        });
        docList(d.eSanchitList).forEach(doc => build(doc && !doc._icegate ? { ...doc, docFor: 'SB' } : doc, 0, 0));
        return docs;
      })(),
      // Items tab > Third Party window (item exported for another exporter). 29-Oct-2026
      thirdPartyModel: (items || []).map((it, i) => ({ it, ...itemNos(it, i) })).filter(({ it }) => /^Y/i.test(String(it.thirdParty || '')) && String(it.tpExpIec || '').trim()).map(({ it, inv, itm }) => ({
        invoiceSerialNumber: inv, itemSerialNumberInvoice: itm, iec: s(String(it.tpExpIec).toUpperCase(), 10), branchSerialNo: n(it.tpExpBranch),
        exporterName: s(it.tpExpName, 50), exporterAddress1: s(it.tpExpAddress1, 50), exporterAddress2: s(it.tpExpAddress2, 35),
        city: s(it.tpExpCity, 35), pin: n(it.tpExpPin), gstnType: s(String(it.tpExpGstnType || '').toUpperCase(), 3),
        gstnId: s(String(it.tpExpGstnId || '').toUpperCase(), 20), itemThirdPartyValue: s(/^Y/i.test(String(it.tpExpValue || '')) ? 'Y' : 'N', 1),
      })),
      amendHistory: [],
    },
    // ── Digital Signature block — filled by icegate.js after DSC signing
    // signerCn and signedAt are passed in opts after local_signer signs the JSON
    // digSign — required fields per CACHE01 schema (startSignature, startCertificate, signerVersion)
    digSign: opts.signerCn ? {
      signerName:        s(opts.signerCn, 100),
      signedAt:          opts.signedAt || new Date().toISOString(),
      signAlgorithm:     'SHA256WithRSA',
      signatureType:     'PKCS7_DETACHED',
      startSignature:    s(opts.startSignature || ''),
      startCertificate:  s(opts.startCertificate || ''),
      signerVersion:     s(opts.signerVersion || '1'),
    } : undefined,
  };
  // unsigned file = headerField + master only, as the production files (the signer adds digSign). 29-Oct-2026
  if (!cache01.digSign) delete cache01.digSign;

  return conformSB(cache01, opts);
}

/**
 * Make the JSON match the ICEGATE schema (utils/icegateSchema.json, from the BE CACHI01 / SB CACHE01 schema v1.2):
 * - keys the schema does not have are removed (e.g. messageType/customHouseCode/beNumber/beDate on every BE row)
 * - number fields are sent as numbers ("1000" -> 1000); empty number fields are left out
 * - models the schema does not have are removed (amendment parts are kept only for an amendment)
 * 28-Oct-2026
 */
let ICEGATE_SCHEMA = null;
function conformToSchema(kind, json, opts = {}) {
  try { ICEGATE_SCHEMA = ICEGATE_SCHEMA || require('./icegateSchema.json'); } catch (e) { return json; }
  const spec = ICEGATE_SCHEMA[kind];
  if (!spec || !json) return json;
  const amend = !!(opts.isAmendment || opts.amendment);
  const fixRow = (row, fields, keep = []) => {
    if (!row || typeof row !== 'object' || !fields) return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      const f = fields[k];
      if (!f) { if (keep.includes(k) && v !== undefined) out[k] = v; continue; }
      if (v === undefined || v === null) continue;
      if (f[0] === 'n') {
        if (v === '') continue;
        const num = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
        if (!isNaN(num)) out[k] = num;
        continue;
      }
      out[k] = typeof v === 'string' ? v : String(v);
    }
    return out;
  };
  const res = { ...json };
  res.headerField = fixRow(json.headerField, spec.headerField, amend ? ['amendmentReason', 'amendmentType'] : []);
  const master = {};
  for (const [k, rows] of Object.entries(json.master || {})) {
    if (!(k in spec.master)) { if (amend && Array.isArray(rows) && rows.length) master[k] = rows; continue; }
    master[k] = Array.isArray(rows) ? rows.map(r => fixRow(r, spec.master[k])) : rows;
  }
  for (const k of Object.keys(spec.master)) if (!(k in master)) master[k] = [];
  res.master = master;
  return res;
}

/**
 * SB layout as production ICEGATE SB JSON files have it (checked against 5 CACHE01 files of another ERP, Oct-2026,
 * filed with indicator P; same check as conformBE does for the BE):
 * - every field of the model is present, in the production order; models not in those files keep the schema order
 * - all values are text, numbers with fixed decimals (quantity "10.000", unit price "5.50000", PMV "4250.00",
 *   SW info measure "10.000000", exchange rate "84.5000", weights "100.000"); optional amounts / rates that are 0
 *   are left empty, and the currency of a charge with no amount too
 * - headerField jobNumber and sequenceOrControlNumber are numbers; no digSign until the file is signed
 * Before, conformToSchema sent numbers and dropped supportingDocs chaLicenseNumber / iec (not in our schema copy). 29-Oct-2026
 */
const SB_NUM = {
  itemModel: { quantity: [3], unitPrice: [5], presentMarketValue: [2], igstAmount: [2, 1], taxableValue: [2, 1], noOfUnit: [0], totalPackage: [0, 1] },
  dbkModel: { drawbackQuantity: [3] },
  infoType: { infoMeasure: [6] },
  exchangeModel: { rate: [4], unitInRs: [2] },
  sbModel: { grossWeight: [3, 1], netWeight: [3, 1], totalNumberOfPackages: [0, 1], numberOfContainers: [0, 1] },
  invoiceModel: { freightAmount: [2, 1], insuranceAmount: [2, 1], commissionAmount: [2, 1], discountAmount: [2, 1], otherDeductionsAmount: [2, 1],
    packingCharges: [2, 1], insuranceRate: [5, 1], commissionRate: [5, 1], discountOnFOB: [5, 1], otherDeductions: [5, 1], periodOfPayment: [0, 1] },
};
// charge currency -> its amount / rate fields
const SB_CUR = { freightCurrency: ['freightAmount'], insuranceCurrency: ['insuranceAmount', 'insuranceRate'], commissionCurrency: ['commissionAmount', 'commissionRate'],
  discountCurrency: ['discountAmount', 'discountOnFOB'], otherDeductionsCurrency: ['otherDeductionsAmount', 'otherDeductions'] };
function addClaimDeclarations(m) {
  const items = Array.isArray(m.itemModel) ? m.itemModel : [];
  if (!items.length) return;
  if (!Array.isArray(m.statement)) m.statement = [];
  const infos = Array.isArray(m.infoType) ? m.infoType : [];
  const itemNo = (it) => it.itemSerialNumberInvoice ?? it.itemSerialNumber; // itemModel names it itemSerialNumberInvoice
  const same = (r, it) => String(r.invoiceSerialNumber) === String(it.invoiceSerialNumber) && String(r.itemSerialNumber) === String(itemNo(it));
  const has = (it, code) => m.statement.some(r => same(r, it) && String(r.statementCode || '').toUpperCase() === code);
  const add = (it, code) => m.statement.push({ invoiceSerialNumber: it.invoiceSerialNumber, itemSerialNumber: itemNo(it), statementSerialNo: 0, statementType: 'DEC', statementCode: code, statementText: '' });
  items.forEach(it => {
    const rodtepY = infos.some(r => same(r, it) && String(r.infoType || '').toUpperCase() === 'DTY' && String(r.infoQualifier || '').toUpperCase() === 'RDT' && String(r.infoCode || '').toUpperCase() === 'RODTEPY');
    if (rodtepY && !has(it, 'RD001')) add(it, 'RD001');
    // a scheme 60 item that already has a declaration (RS001, or RD001 as in one iCAFFE file) is left as it is
    if (String(it.schemeCode || '').trim() === '60' && /^Y/i.test(String(it.rewardItem || '')) && !has(it, 'RS001') && !has(it, 'RD001')) add(it, 'RS001');
  });
}
function conformSB(json, opts = {}) {
  try { ICEGATE_SCHEMA = ICEGATE_SCHEMA || require('./icegateSchema.json'); } catch (e) { return conformToSchema('SB', json, opts); }
  const order = ICEGATE_SCHEMA.SB && ICEGATE_SCHEMA.SB.keyOrder;
  if (!order || !json) return conformToSchema('SB', json, opts);
  const amend = !!(opts.isAmendment || opts.amendment);
  const txt = (v) => (v === undefined || v === null) ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v).trim());
  const fmt = (v, rule) => {
    const t = txt(v); if (!rule || t === '') return t;
    const x = Number(t.replace(/,/g, '')); if (isNaN(x)) return t;
    if (rule[1] && x === 0) return '';
    return rule[0] === null || rule[0] === undefined ? String(x) : x.toFixed(rule[0]);
  };
  const h = json.headerField || {};
  const header = {};
  order.headerField.forEach(k => { header[k] = (k === 'jobNumber' || k === 'sequenceOrControlNumber') ? (Number(h[k]) || 0) : txt(h[k]); });
  if (amend) { if (h.amendmentReason !== undefined) header.amendmentReason = txt(h.amendmentReason); if (h.amendmentType !== undefined) header.amendmentType = txt(h.amendmentType); }
  // 12-Nov-2026: the RoDTEP / RoSCTL declarations go with the claim, as in every production SB of iCAFFE (RD001 for
  // each item with DTY/RDT RODTEPY, RS001 for each scheme 60 reward item). An item typed on the screen had RoDTEP Y
  // (scheme 19 sets it) but no RD001 unless the operator added it in SW Statement - the check only warned.
  if (!amend && json.master) addClaimDeclarations(json.master);
  const master = {};
  for (const [m, keys] of Object.entries(order.master)) {
    const rows = (json.master || {})[m]; const rules = SB_NUM[m] || {};
    master[m] = (Array.isArray(rows) ? rows : []).map(r => {
      const out = {};
      keys.forEach(k => { out[k] = fmt(r[k], rules[k]); });
      if (m === 'invoiceModel') Object.entries(SB_CUR).forEach(([c, f]) => { if (c in out && f.every(k => !out[k])) out[c] = ''; });
      return out;
    });
  }
  // statement serial numbers run through the SB (1, 2, 3 ...), as in the production files
  (master.statement || []).forEach((r, i) => { if ('statementSerialNo' in r) r.statementSerialNo = String(i + 1); });
  if (amend) for (const [m, rows] of Object.entries(json.master || {})) if (!(m in master) && Array.isArray(rows) && rows.length) master[m] = rows;
  const res = { headerField: header, master };
  if (json.digSign) res.digSign = json.digSign;
  return res;
}

/**
 * BE layout as production ICEGATE BE JSON files have it (checked against 5 CACHI01 files made by Icaffe, Oct-2026):
 * - every row keeps messageType / customHouseCode / beNumber / beDate (statementModel: declarationtype/No/Date)
 * - every field of the model is present, in the same order; missing ones are "" (not left out)
 * - all values are text ("10.000000"), except headerField jobNumber and sequenceOrControlNumber (numbers)
 * - no digSign until the file is signed
 * Replaces the fix19 rule (drop those keys, send numbers) which did not match what ICEGATE actually receives. 28-Oct-2026
 */
function conformBE(json, opts = {}) {
  try { ICEGATE_SCHEMA = ICEGATE_SCHEMA || require('./icegateSchema.json'); } catch (e) { return json; }
  const order = ICEGATE_SCHEMA.BE && ICEGATE_SCHEMA.BE.keyOrder;
  if (!order || !json) return json;
  const amend = !!(opts.isAmendment || opts.amendment);
  const txt = (v) => (v === undefined || v === null) ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  const h = json.headerField || {};
  const header = {};
  order.headerField.forEach(k => {
    if (k === 'jobNumber' || k === 'sequenceOrControlNumber') header[k] = Number(h[k]) || 0;
    else header[k] = txt(h[k]);
  });
  if (amend) { if (h.amendmentReason !== undefined) header.amendmentReason = txt(h.amendmentReason); if (h.amendmentType !== undefined) header.amendmentType = txt(h.amendmentType); }
  const master = {};
  for (const [m, keys] of Object.entries(order.master)) {
    const rows = (json.master || {})[m];
    master[m] = (Array.isArray(rows) ? rows : []).map(r => {
      const out = {};
      keys.forEach(k => { out[k] = txt(r[k]); });
      return out;
    });
  }
  // amendment-only models are kept for an amendment
  if (amend) for (const [m, rows] of Object.entries(json.master || {})) if (!(m in master) && Array.isArray(rows) && rows.length) master[m] = rows;
  // common keys: messageType F/A, customHouseCode = receiver
  const mt = amend ? 'A' : 'F';
  Object.values(master).forEach(rows => rows.forEach(r => { if ('messageType' in r && !r.messageType) r.messageType = mt; if ('customHouseCode' in r && !r.customHouseCode) r.customHouseCode = header.receiverID; if (r.declarationtype === '') r.declarationtype = 'B'; }));
  const res = { headerField: header, master };
  if (json.digSign) res.digSign = json.digSign;
  return res;
}

module.exports = { buildBE_CACHI01, buildSB_CACHE01, fmtDate, nextSeq, conformToSchema, conformBE, conformSB };
