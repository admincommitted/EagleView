// Shared helpers of the Scheme tab (Dbk / License / RoDTEP / RoSCTL / AR4), the S/B checklist and useExportCalc.
import { asList } from '../../../../utils/asList';

export const num = (value) => {
  const number = parseFloat(String(value ?? '').replace(/,/g, ''));
  return isFinite(number) ? number : 0;
};
const round2 = (value) => Math.round(num(value) * 100) / 100;
export const r2 = (value) => round2(value).toFixed(2);
const upper = (value) => String(value || '').trim().toUpperCase();

// "19 - DRAWBACK" / "19" / "19-DBK" -> "19"; the Scheme box of the Items tab wins over the copy a file leaves (schemeCode)
export const schemeCodeOf = (item) => String((item && (item.scheme || item.schemeCode)) || '').trim().split(/[\s-]/)[0].trim();

// scheme 60 is "Drawback + RoSCTL": its items claim drawback too
export const isDbkItem = (item) => ['19', '60'].includes(schemeCodeOf(item));
export const isRosctlItem = (item) => schemeCodeOf(item) === '60';
export const isLicenceItem = (item) => {
  const code = schemeCodeOf(item);
  return code === '03' || (code !== '' && !['00', '19', '60', '99'].includes(code));
};

const capitals = (value) => String(value || '').toUpperCase();
const swInfosOf = (item) => asList(item && item.swInfos);
const swInfoType = (row) => upper(row.swInfoField1 || row.type);
const swInfoQualifier = (row) => upper(row.swInfoField2 || row.qual || row.qualifier);
const rdtRowOf = (item) => swInfosOf(item).find((row) => capitals(row.swInfoField1 || row.type) === 'DTY' && capitals(row.swInfoField2 || row.qual) === 'RDT');
export const hasRdtInfo = (item) => !!rdtRowOf(item);
// the reward flag of a scheme 60 item is its RoSCTL claim (statement RS001) - RoDTEP is not given on RoSCTL goods
export const isRodtepItem = (item) => !isRosctlItem(item) && (capitals(item && item.rodtep) === 'Y' || hasRdtInfo(item));
export const claimsRodtep = (item) => {
  if (!item || isRosctlItem(item)) return false;
  const rdtRow = rdtRowOf(item);
  return rdtRow ? capitals(rdtRow.swInfoField3 || rdtRow.code) === 'RODTEPY' : capitals(item.rodtep) === 'Y';
};

export const invOf = (item) => String((item && (item.invSr || item.invNo)) || 1);
export const itemNoOf = (item, index) => String((item && (item.itemSr || item.itemNo)) || (index + 1));

// item FOB in INR (the Items tab keeps itemFob in INR; files read may only have fobValueInr / fobRs)
export const itemFobInr = (item) => num(item && (item.itemFob || item.fobValueInr || item.fobInr || item.fobRs));

// RoSCTL schedule row of an item. The RoSCTL schedule uses the drawback schedule numbers without the suffix
// (DBK No 62030307B -> RoSCTL 62030307; the Special Advance Authorisation table D -> 62030307-AA); else the RITC.
export const findRosctl = (master, dbkNo, ritc) => {
  const keyOf = (value) => upper(value).replace(/\s+/g, '');
  const byTariffItem = (key) => (key ? (master || []).find((row) => keyOf(row.tariffItem) === key) : null);
  const dbkKey = keyOf(dbkNo);
  if (dbkKey) {
    const base = dbkKey.replace(/[A-Z]$/, '');
    const row = (/D$/.test(dbkKey) ? byTariffItem(base + '-AA') : null) || byTariffItem(base) || byTariffItem(dbkKey);
    if (row) return row;
  }
  return byTariffItem(String(ritc || '').replace(/\D/g, ''));
};

// "[State 3.6%/Rs 37.4 + Central 2.45%/Rs 25.5]" in the schedule description -> the two levies
export const rosctlSplit = (description) => {
  const match = /State\s*([\d.]+)\s*%(?:\s*\/\s*Rs\.?\s*([\d.]+))?\s*\+\s*Central\s*([\d.]+)\s*%(?:\s*\/\s*Rs\.?\s*([\d.]+))?/i.exec(String(description || ''));
  return match ? { stateRate: num(match[1]), stateCap: num(match[2]), centralRate: num(match[3]), centralCap: num(match[4]) } : null;
};

// drawback schedule row of a DBK No: schedule code, else the code with the ICEGATE suffix B (610901 -> 610901B), else tariff item
export const findDbk = (master, dbkNo) => {
  const key = upper(dbkNo);
  if (!key) return null;
  const byCode = (code) => (master || []).find((row) => upper(row.schemeCode) === code);
  return byCode(key) || (/\d$/.test(key) ? byCode(key + 'B') : null) || (master || []).find((row) => upper(row.tariffItem) === key) || null;
};

// A claim is never guessed: when the schedule caps it per unit (or the rate is per unit) and no quantity is keyed,
// the amount is null and the screens say why - claiming the full percentage of FOB would over-claim.
export const CAP_NEEDS_QTY = 'The schedule caps this claim per unit - key the quantity before the amount can be worked out';
export const SPEC_NEEDS_QTY = 'This is a rate per unit - key the quantity before the amount can be worked out';
// a claim that could not be worked out shows as blank, never as 0 (0 reads as "nothing due")
export const claimText = (value) => (value === null || value === undefined ? '' : r2(value));
export const claimSum = (list) => (list || []).reduce((sum, value) => sum + (value === null || value === undefined ? 0 : num(value)), 0);
export const claimPending = (list) => (list || []).filter((value) => value === null || value === undefined).length;

// All-industry rate: % of FOB, limited by the cap (Rs per unit x qty); entries with only a specific rate: Rs per unit x qty
export const dbkAmount = ({ fob, qty, rateAdv, rateSpe, cap }) => {
  const quantity = num(qty), advRate = num(rateAdv), specRate = num(rateSpe), capPerUnit = num(cap);
  if (advRate > 0) {
    if (capPerUnit > 0 && !(quantity > 0)) return null;
    const amount = num(fob) * advRate / 100;
    return round2(capPerUnit > 0 ? Math.min(amount, capPerUnit * quantity) : amount);
  }
  if (specRate > 0) return quantity > 0 ? round2(specRate * quantity) : null;
  return 0;
};

// RoDTEP: % of FOB, limited by the cap per unit; entries notified as Rs per UQC (rsPerUqc): Rs x qty
export const rodtepAmount = ({ fob, qty, rate, cap, rsPerUqc }) => {
  const quantity = num(qty), percent = num(rate), capPerUnit = num(cap), rupeesPerUnit = num(rsPerUqc);
  if (!(percent > 0)) {
    if (!(rupeesPerUnit > 0)) return 0;
    return quantity > 0 ? round2(rupeesPerUnit * quantity) : null;
  }
  if (capPerUnit > 0 && !(quantity > 0)) return null;
  const amount = num(fob) * percent / 100;
  return round2(capPerUnit > 0 ? Math.min(amount, capPerUnit * quantity) : amount);
};

// why an amount came back blank ('' when it did not)
export const claimWhy = ({ qty, rateAdv, rateSpe, cap }) => {
  const quantity = num(qty), advRate = num(rateAdv), specRate = num(rateSpe), capPerUnit = num(cap);
  if (advRate > 0 && capPerUnit > 0 && !(quantity > 0)) return CAP_NEEDS_QTY;
  if (!(advRate > 0) && specRate > 0 && !(quantity > 0)) return SPEC_NEEDS_QTY;
  return '';
};

// Excel cell -> 'YYYY-MM-DD' (date cells come as serial numbers, text as dd-mm-yyyy / dd/mm/yyyy / yyyy-mm-dd)
export const toIsoDate = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' && value > 20000 && value < 80000) return new Date(Math.round((value - 25569) * 86400000)).toISOString().slice(0, 10);
  const text = String(value).trim();
  let match = /^(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})$/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return text;
};

// RoSCTL: % of FOB, limited by the cap per unit (same rule as RoDTEP)
export const rosctlAmount = rodtepAmount;

// Exports under Advance Authorisation / EOU / SEZ claim RoDTEP at the Appendix 4RE rates (lower), DTA exports at the
// Appendix 4R rates (iCAFFE 16518, scheme 03: 29372200 at 0.4% (4RE), not 0.7% (4R)).
const SCHEMES_4RE = new Set(['01', '02', '03', '04', '05', '16', '17', '34', '35', '39', '41', '44', '46', '63']);
export const isAppendix4RE = (item) => SCHEMES_4RE.has(schemeCodeOf(item));
export const rodtepRowOf = (master, item) => {
  const ritc = String((item && (item.ritc || item.hsnCode)) || '').replace(/\D/g, '');
  return ritc ? (master || []).find((row) => String(row.tariffItem || '').replace(/\D/g, '') === ritc) || null : null;
};
const isSet = (value) => value !== null && value !== undefined && value !== '';
// the rate an item claims: { rate, cap, rsPerUqc, uqc, appendix } (null when the RITC is not in the schedule)
export const rodtepRateOf = (scheduleRow, item) => {
  if (!scheduleRow) return null;
  const at4RE = isAppendix4RE(item) && isSet(scheduleRow.rateAA);
  return {
    rate: num(at4RE ? scheduleRow.rateAA : scheduleRow.rate),
    cap: num(at4RE ? scheduleRow.capAA : scheduleRow.cap),
    rsPerUqc: num(at4RE ? scheduleRow.rsPerUqcAA : scheduleRow.rsPerUqc),
    uqc: String(scheduleRow.uqc || '').toUpperCase(),
    appendix: at4RE ? '4RE' : '4R',
  };
};

const serialOf = (value, fallback) => String(parseInt(value, 10) || fallback);
// SW info measurement of an item: its own rows, else the rows kept with the job (a job read from a file) / the CACHE01 rows
const infoMeasureOf = (item, infoRows, type, qualifier) => {
  const own = swInfosOf(item).find((row) => swInfoType(row) === type && swInfoQualifier(row) === qualifier);
  if (own) return { msr: num(own.swInfoField5 ?? own.msr ?? own.measurement), uqc: upper(own.swInfoField6 || own.uqc || own.unit) };
  const invoiceSr = serialOf((item && (item.invSr || item.invNo)) || 1, 1);
  const itemSr = serialOf((item && (item.itemSr || item.itemNo)) || 0, 0);
  const jobRow = (infoRows || []).find((row) => upper(row.infoType || row.type) === type && upper(row.infoQualifier || row.qualifier) === qualifier
    && serialOf(row.invoiceSerialNumber ?? row.invSr ?? String(row.invItemNo || '').split('/')[0], 1) === invoiceSr
    && serialOf(row.itemSerialNumber ?? row.itemSr ?? String(row.invItemNo || '').split('/')[1], 0) === itemSr);
  return jobRow ? { msr: num(jobRow.infoMeasure ?? jobRow.measurement), uqc: upper(jobRow.infouqc || jobRow.unit) } : null;
};

// The RoDTEP quantity is the measurement of the item's SW info row DTY / RDT, in the unit of the RoDTEP schedule
// (iCAFFE 19513: 139.7 KGS for 11 NOS of 83071000); the item qty only when there is no RDT measurement and the item
// unit is the schedule's.
export const rodtepQtyOf = (item, infoRows, scheduleUqc) => {
  const rdt = infoMeasureOf(item, infoRows, 'DTY', 'RDT');
  if (rdt && rdt.msr > 0) return { qty: rdt.msr, unit: rdt.uqc || upper(scheduleUqc), from: 'RDT' };
  const sqc = infoMeasureOf(item, infoRows, 'CHR', 'SQC');
  const itemUnit = upper(item && (item.unit || item.uqc)), scheduleUnit = upper(scheduleUqc);
  if (sqc && sqc.msr > 0 && (!scheduleUnit || sqc.uqc === scheduleUnit)) return { qty: sqc.msr, unit: sqc.uqc || scheduleUnit, from: 'SQC' };
  if (!scheduleUnit || itemUnit === scheduleUnit) return { qty: num(item && (item.qty || item.quantity)), unit: itemUnit || scheduleUnit, from: 'ITEM' };
  return { qty: 0, unit: scheduleUnit, from: 'NONE' };
};

// PMV in INR: ICEGATE's presentMarketValue is per unit; the Items form keeps unitPmv / pmv (per unit) and totalPmv.
// A job read from a file has only the per-unit value, so the total is per-unit x qty.
export const itemUnitPmv = (item) => num(item && (item.unitPmv || item.pmv || item.presentMarketValue));
export const itemTotalPmv = (item) => {
  const total = num(item && item.totalPmv);
  if (total > 0) return total;
  const unitPmv = itemUnitPmv(item), quantity = num(item && (item.qty || item.quantity));
  return unitPmv > 0 && quantity > 0 ? round2(unitPmv * quantity) : 0;
};
export const RDT_QTY_NEEDED = 'Quantity in the RoDTEP schedule unit is needed (SW info DTY / RDT, e.g. KGS for an item in NOS)';

// one RoSCTL row per scheme 60 item: schedule row, levies, estimate (null = cap per unit, quantity not keyed)
export const rosctlRowsOf = (items, dbkRows, master) => (items || [])
  .map((item, index) => ({ item, index }))
  .filter(({ item }) => isRosctlItem(item))
  .map(({ item, index }) => {
    const inv = invOf(item), itm = itemNoOf(item, index);
    const dbkRow = (dbkRows || []).find((row) => String(row.invNo || row.invSr || 1) === inv && String(row.itemNo || row.itemSr) === itm);
    const dbkNo = (dbkRow && dbkRow.dbkNo) || item.dbkNo || '';
    const scheduleRow = findRosctl(master, dbkNo, item.ritc || item.hsnCode);
    const qty = num(item.qty || item.quantity);
    const fob = itemFobInr(item);
    return {
      item, index, inv, itm, dbkNo, scheduleRow,
      slNo: scheduleRow ? scheduleRow.tariffItem : '',
      split: scheduleRow ? rosctlSplit(scheduleRow.description) : null,
      qty, unit: item.unit || item.uqc || (scheduleRow && scheduleRow.uqc) || '', fob,
      rate: scheduleRow ? num(scheduleRow.rate) : 0,
      cap: scheduleRow ? num(scheduleRow.cap) : 0,
      amt: scheduleRow ? rosctlAmount({ fob, qty, rate: scheduleRow.rate, cap: scheduleRow.cap }) : 0,
      noRow: !scheduleRow,
    };
  });

const isBlankText = (value) => !String(value || '').trim();

// the fields ICEGATE needs on a licence row
export const licenceRowErrors = (row) => {
  const missing = [];
  if (isBlankText(row.regNo)) missing.push('Reg No');
  if (!row.regDate) missing.push('Reg Dt');
  if (isBlankText(row.snE)) missing.push('Sn E');
  if (isBlankText(row.snC)) missing.push('Sn C');
  if (num(row.qty) <= 0) missing.push('Qty');
  if (num(row.expQty) <= 0) missing.push('Exp Qty');
  return missing;
};

export const AR4_REQUIRED_FIELDS = ['ar4No', 'ar4Date', 'commissionerate', 'division', 'ar4Range'];
export const ar4Missing = (item) => AR4_REQUIRED_FIELDS.filter((field) => isBlankText(item[field]));

// a yes / no flag of a saved row: the database gives back '0' / '1' / 'true' / 'false' ('0' must read as false)
export const flagOn = (value) => value === true || value === 1 || (typeof value === 'string' && /^(1|true|y|yes)$/i.test(value.trim()));
