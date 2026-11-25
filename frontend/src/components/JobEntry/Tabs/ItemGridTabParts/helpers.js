import { PER_100_CURRENCIES } from '../../../../utils/cbicExchange';
import { getItemForm } from './hooks/itemForm';

export { PER_100_CURRENCIES };

export const initialItems = [];

export const FLAG_NAMES = {
  'Scheme Code Category': 'schemeCodCategoryFlag',
  'Licence': 'licenceFlag',
  'Re-Import': 'reImportFlag',
  'RSP Duty': 'rspDutyFlag',
  'NCD Custom Duty': 'ncdCustomDutyFlag',
  'Anti Dumping Duty': 'antiDumpingDutyFlag',
  'Other Duty': 'otherDutyFlag',
  'SW Infotype': 'swInfotypeFlag',
  'SW Constituent': 'swConstituentFlag',
  'SW Production': 'swProductionFlag',
  'SW Control': 'swControlFlag',
  'SW Statement': 'swStatementFlag',
  'Supporting Docs': 'supportingDocsFlag',
  'Customs CVD': 'customsCvdFlag',
};

export const OTHER_DUTY_NAMES = ['Add1(SIA)', 'Add2(S2)', 'Other(TTA)', 'Cess', 'Health', 'Aggregate', 'Safe Guard', 'Infra Cess'];

const FREIGHT_INCLUDED_TERMS = ['CIF', 'CF', 'C&F', 'CFR'];
const INSURANCE_INCLUDED_TERMS = ['CIF', 'CI'];
const DUTY_BASIS_LETTERS = ['S', 'H', 'L', 'B', 'A'];

const toNumber = (value) => parseFloat(String(value ?? '').replace(/,/g, '')) || 0;
const hasValue = (value) => String(value ?? '').trim() !== '';
const roundToPaisa = (amount) => Math.round(amount * 100) / 100;

const parseJson = (value, fallback) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const asObject = (value) => {
  const parsed = parseJson(value, null);
  return parsed && typeof parsed === 'object' ? parsed : {};
};

// Assessable value of an item in INR (estimate for the duty boxes): item value x exchange rate, plus the item's share
// of freight / insurance / misc when the invoice terms do not already include them.
export function itemAssessableINR({ itemValue, invSrNo, invNo }, invoices = [], jobData = {}) {
  const invoiceList = invoices || [];
  const invoice = invoiceList.find((entry) => invNo && entry.invNo === invNo) || invoiceList[(parseInt(invSrNo, 10) || 1) - 1] || {};
  const invoiceCurrency = String(invoice.currency || invoice.invoiceCurrency || '').trim().toUpperCase();
  const exchangeRates = parseJson(jobData._exchangeRates, []);

  const rupeesPerUnit = (currency) => {
    const code = String(currency || invoiceCurrency || '').trim().toUpperCase();
    if (!code || code === 'INR') return 1;
    const notified = (Array.isArray(exchangeRates) ? exchangeRates : []).find((rate) => String(rate.currencyCode || '').toUpperCase() === code);
    if (notified) return toNumber(notified.rate) / (toNumber(notified.unitInRs) || 1);
    // CBIC notifies Schedule II currencies (JPY, KRW) per 100 units, so a rate typed off the notification is per 100
    const typedRate = toNumber(invoice.exRate || invoice.exchangeRate);
    if (code === invoiceCurrency && typedRate) return typedRate / (PER_100_CURRENCIES.includes(code) ? 100 : 1);
    return 0;
  };

  const invoiceRate = rupeesPerUnit(invoiceCurrency);
  const itemForeignValue = toNumber(itemValue);
  const invoiceForeignValue = toNumber(invoice.value || invoice.invValue || invoice.invoiceValue) || itemForeignValue;
  const itemShare = invoiceForeignValue ? itemForeignValue / invoiceForeignValue : 1;
  const terms = String(invoice.terms || invoice.termsOfInvoice || '').toUpperCase();
  const invoiceInr = invoiceForeignValue * invoiceRate;

  // misc charges come first: a freight / insurance RATE is a % of invoice value + misc charges
  const misc = toNumber(invoice.miscCharges)
    ? toNumber(invoice.miscCharges) * rupeesPerUnit(invoice.miscCurrency)
    : (toNumber(invoice.miscChargesRate) ? toNumber(invoice.miscChargesRate) / 100 * invoiceInr : 0);
  const charge = (amount, currency, ratePercent) => (toNumber(amount)
    ? toNumber(amount) * rupeesPerUnit(currency)
    : (toNumber(ratePercent) ? toNumber(ratePercent) / 100 * (invoiceInr + misc) : 0));
  const isAir = /^A/i.test(String(jobData.shipmentMode || jobData.autoField_52 || jobData.transportMode || ''));

  // Customs Valuation Rules, 2007 as ICES applies them: freight not given -> 20 % of FOB, insurance not given ->
  // 1.125 % of FOB, air freight capped at 20 % of FOB. The flags say which figure is notional (marked on the checklist).
  const notional = {};
  const freightIncluded = FREIGHT_INCLUDED_TERMS.includes(terms);
  let freight = freightIncluded ? 0 : charge(invoice.freightValue, invoice.freightCurrency, invoice.freightRate);
  if (!freightIncluded && !toNumber(invoice.freightValue) && !toNumber(invoice.freightRate)) { freight = invoiceInr * 0.20; notional.freight = true; }
  if (isAir && !freightIncluded && freight > invoiceInr * 0.20) { freight = invoiceInr * 0.20; notional.freightCapped = true; }
  const insuranceIncluded = INSURANCE_INCLUDED_TERMS.includes(terms);
  let insurance = insuranceIncluded ? 0 : charge(invoice.insuranceValue, invoice.insuranceCurrency, invoice.insuranceRate);
  if (!insuranceIncluded && !toNumber(invoice.insuranceValue) && !toNumber(invoice.insuranceRate)) { insurance = invoiceInr * 0.01125; notional.insurance = true; }
  const cif = itemForeignValue * invoiceRate + itemShare * (freight + insurance + misc);

  // the loads ICES adds: high sea sale - HSS load % of the CIF or the HSS amount in rupees shared by value;
  // SVB - the load % on the assessable value from the SVB order, on CIF + HSS load
  const hssRate = toNumber(invoice.hssLoadRate);
  const hssAmount = toNumber(invoice.hssLoadAmount);
  const hss = hssRate ? cif * hssRate / 100 : (hssAmount ? itemShare * hssAmount : 0);
  const svbPercent = toNumber(invoice.svbLoadAssessableValue);
  const svb = svbPercent ? (cif + hss) * svbPercent / 100 : 0;
  const assessableValue = cif + hss + svb;

  return {
    av: roundToPaisa(assessableValue),
    rateFound: invoiceRate > 0,
    currency: invoiceCurrency,
    notional,
    freightInr: roundToPaisa(itemShare * freight),
    insuranceInr: roundToPaisa(itemShare * insurance),
    hssInr: roundToPaisa(hss),
    svbInr: roundToPaisa(svb),
  };
}

// Duty estimate for one item (checklist only; ICEGATE computes the real duty), added up the way ICES does:
//   BCD = AV x rate (or the SAPTA / preferential rate when BCD is blank); SWS = 10 % of BCD; Health cess = AV x rate
//   CVD / Addl CVD / SAPTA-as-additional / Anti-dumping / other duties (AIDC = "Infra Cess") = AV x their %
//   (a typed Duty Amount is used when there is no %)
//   IGST and Compensation cess = rate x (AV + every customs duty above)
//   Totals are kept to the paisa per item; the BE total is rounded to the rupee (totalRounded).
export function computeItemDuty(item, invoices = [], jobData = {}) {
  // ICES values the item as qty x unit price; the "Total Amount" box is only used when qty or price is missing
  const itemValue = toNumber(item.qty || item.quantity) * toNumber(item.price || item.unitPrice) || toNumber(item.value);
  const valuation = itemAssessableINR({ itemValue, invSrNo: item.invSrNo, invNo: item.invNo }, invoices, jobData);
  const av = valuation.av;
  const percentOrAmount = (rate, amount) => (hasValue(rate) ? av * toNumber(rate) / 100 : toNumber(amount));

  // A specific rate is rupees x quantity in the UQC the tariff states it in. When that is not the item's own unit the
  // operator gives the quantity in that unit (specQty); with that box empty nothing is guessed.
  const itemQty = toNumber(item.qty || item.quantity);
  const itemUqc = String(item.unit || item.uqc || '').trim().toUpperCase();
  const specificUnitsFor = (uqc) => {
    const specificUqc = String(uqc || '').trim().toUpperCase();
    const typedQty = toNumber(item.specQty);
    if (typedQty) return typedQty;
    if (!specificUqc || specificUqc === itemUqc) return itemQty;
    return null;
  };

  // one duty line: the percentage side, the specific side, and which of them the tariff says to apply
  // (basis S = specific, H = whichever higher, L = whichever lower, B = both added, A = ad valorem)
  const dutyLine = (percent, specificRate, specificUqc, basisCode, typedAmount) => {
    const basisLetter = String(basisCode || '').trim().toUpperCase().charAt(0);
    const adValorem = hasValue(percent) ? av * toNumber(percent) / 100 : null;
    // a specific rate of Rs 0 is no specific rate
    const hasSpecific = hasValue(specificRate) && toNumber(specificRate) > 0;
    const units = hasSpecific ? specificUnitsFor(specificUqc) : null;
    const specific = hasSpecific && units !== null ? toNumber(specificRate) * units : null;
    const needQty = hasSpecific && units === null;
    const basis = DUTY_BASIS_LETTERS.includes(basisLetter)
      ? basisLetter
      : (specific !== null && adValorem !== null ? 'H' : specific !== null ? 'S' : 'A');
    let amount = null;
    let applied = basis;
    if (basis === 'S') {
      amount = specific;
    } else if (basis === 'B') {
      amount = (adValorem || 0) + (specific || 0);
    } else if (basis === 'H' || basis === 'L') {
      if (adValorem !== null && specific !== null) {
        const higher = basis === 'H';
        amount = higher ? Math.max(adValorem, specific) : Math.min(adValorem, specific);
        applied = (higher ? specific > adValorem : specific < adValorem) ? 'S' : 'A'; // a tie reads as the percentage
      } else {
        amount = adValorem !== null ? adValorem : specific;
        applied = adValorem !== null ? 'A' : 'S';
      }
    } else {
      amount = adValorem;
    }
    if (amount === null) amount = toNumber(typedAmount);
    return { amount, adv: adValorem, spec: specific, applied, needQty, units };
  };

  const bcdUqc = item.bcdSpecUqc || item.bcdUnit || item.specUqc;
  let bcdLine;
  if (hasValue(item.bcdRate) || hasValue(item.bcdSpecAmount)) bcdLine = dutyLine(item.bcdRate, item.bcdSpecAmount, bcdUqc, item.bcdRateBasis, item.bcdAmount);
  else if (hasValue(item.saptaRate)) bcdLine = dutyLine(item.saptaRate, '', '', 'A', item.bcdAmount);
  else bcdLine = { amount: toNumber(item.bcdAmount), adv: null, spec: null, applied: 'A', needQty: false, units: null };

  // every duty line is rounded to the paisa before it is added up or used as the IGST base, as ICES does
  const toPaisa = (amount) => Math.round((Number(amount) || 0) * 100 + (amount >= 0 ? 1e-7 : -1e-7)) / 100;
  const bcd = toPaisa(bcdLine.amount);
  // SWS is 10 % of BCD unless a notification is given without a rate - that is the exemption (e.g. 011/2018)
  const swsPercent = hasValue(item.swsRate) ? toNumber(item.swsRate) : (hasValue(item.swsNotificationNo) ? 0 : 10);
  const sws = toPaisa(bcd * swsPercent / 100);
  const health = toPaisa(percentOrAmount(item.healthCessRate, item.healthCessAmount));
  const cvd = toPaisa(percentOrAmount(item.cvdRate, item.cvdAmount));
  const adlCvd = toPaisa(percentOrAmount(item.adlCvdRate, item.adlCvdAmount));
  const sapta = hasValue(item.bcdRate) ? toPaisa(percentOrAmount(item.saptaRate, item.saptaAmount)) : 0; // used as the BCD above when BCD is blank
  const antiDumping = asObject(item.addData);
  const add = toPaisa(hasValue(antiDumping.rate) ? av * toNumber(antiDumping.rate) / 100 : toNumber(antiDumping.amount));
  const otherDuty = asObject(item.otherDutyData);
  // a line marked foregone (exempted, e.g. Aggregate under 072/2017) is shown but neither paid nor in the IGST base
  const otherLines = OTHER_DUTY_NAMES.map((dutyName) => ({
    name: dutyName === 'Infra Cess' ? 'AIDC' : dutyName,
    foregone: /^Y/i.test(String(otherDuty[dutyName + '_foregone'] || '')),
    amount: toPaisa(hasValue(otherDuty[dutyName + '_rate']) ? av * toNumber(otherDuty[dutyName + '_rate']) / 100 : toNumber(otherDuty[dutyName + '_dutyAmount'])),
  })).filter((line) => line.amount);
  const other = otherLines.reduce((sum, line) => sum + (line.foregone ? 0 : line.amount), 0);
  const aidc = (otherLines.find((line) => line.name === 'AIDC') || {}).amount || 0;
  const customsDuties = bcd + sws + health + cvd + adlCvd + sapta + add + other;

  const igst = asObject(item.igstData);
  const igstBase = toPaisa(av) + customsDuties;
  // an IGST exemption notification (igstData or the item's G/I duty row) without an effective rate (igstData.exmpRate)
  // is a full exemption
  const dutyRows = parseJson(item.dutyRows, null);
  const igstDutyRow = (Array.isArray(dutyRows) ? dutyRows : []).find((row) => row && row.dutyType === 'G' && row.addlDutyFlag === 'I') || {};
  const igstExempt = String(igst.exmpNotnNo ?? '').trim() !== '' || String(igstDutyRow.exmpNotificationNo ?? '').trim() !== '';
  const igstAmount = toPaisa(igstExempt
    ? (hasValue(igst.exmpRate) ? igstBase * toNumber(igst.exmpRate) / 100 : 0)
    : (hasValue(igst.rate) ? igstBase * toNumber(igst.rate) / 100 : toNumber(igst.amount)));
  const compCess = toPaisa(hasValue(igst.cessRate) ? igstBase * toNumber(igst.cessRate) / 100 : toNumber(igst.cessAmount));

  // duty foregone (BCD debited to a licence / scrip, or every duty of an EOU / exempted item) stays in the IGST base
  // and the SWS but is not payable
  const gross = bcd + sws + health + cvd + adlCvd + sapta + add + other + igstAmount + compCess;
  const foregone = Math.min(toNumber(item.dutyForegone), gross);
  const total = gross - foregone;

  return {
    bcdBasis: {
      applied: bcdLine.applied,
      adv: bcdLine.adv === null ? null : roundToPaisa(bcdLine.adv),
      spec: bcdLine.spec === null ? null : roundToPaisa(bcdLine.spec),
      needQty: bcdLine.needQty,
      units: bcdLine.units,
      uqc: String(bcdUqc || '').toUpperCase(),
    },
    rateFound: valuation.rateFound,
    currency: valuation.currency,
    notional: valuation.notional || {},
    itemValue: roundToPaisa(itemValue),
    av: roundToPaisa(av),
    bcd: roundToPaisa(bcd),
    sws: roundToPaisa(sws),
    health: roundToPaisa(health),
    cvd: roundToPaisa(cvd),
    adlCvd: roundToPaisa(adlCvd),
    sapta: roundToPaisa(sapta),
    add: roundToPaisa(add),
    other: roundToPaisa(other),
    aidc: roundToPaisa(aidc),
    otherLines,
    igstBase: roundToPaisa(igstBase),
    igst: roundToPaisa(igstAmount),
    compCess: roundToPaisa(compCess),
    foregone: roundToPaisa(foregone),
    total: roundToPaisa(total),
    totalRounded: Math.round(total),
  };
}

const LIVE_DUTY_FIELDS = ['value', 'qty', 'price', 'invNo', 'bcdRate', 'bcdAmount', 'bcdUnit', 'bcdSpecAmount', 'bcdRateBasis', 'specQty', 'swsRate', 'swsAmount', 'healthCessRate', 'healthCessAmount', 'cvdRate', 'cvdAmount', 'adlCvdRate', 'adlCvdAmount', 'saptaRate', 'saptaAmount'];

// IGST / cess base read live from the item form (the popup recalculates while typing): AV + every customs duty line
export function igstBaseFromForm(form, selectedItem, invoices = [], jobData = {}) {
  const liveItem = { ...(selectedItem || {}) };
  LIVE_DUTY_FIELDS.forEach((name) => { if (form && form.elements[name]) liveItem[name] = form.elements[name].value; });
  return computeItemDuty(liveItem, invoices, jobData);
}

const rupees = (amount) => '₹ ' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// What the duty estimate actually applied, in words the operator can check against the tariff page
export function dutyBasisText(basis) {
  if (!basis) return '';
  if (basis.needQty) return 'Specific rate is per ' + basis.uqc + ' - put the quantity in ' + basis.uqc + ' in "Qty in duty unit", else only the % is applied';
  if (basis.adv !== null && basis.spec !== null) return 'BCD: ' + rupees(basis.adv) + ' by rate, ' + rupees(basis.spec) + ' at the specific rate - ' + (basis.applied === 'S' ? 'specific' : 'rate') + ' applied';
  if (basis.spec !== null) return 'BCD: specific rate only - ' + rupees(basis.spec) + ' on ' + basis.units + ' ' + basis.uqc;
  return '';
}

const REFRESH_DUTY_FIELDS = ['value', 'qty', 'price', 'uqc', 'unit', 'invNo', 'bcdRate', 'bcdAmount', 'bcdUnit', 'bcdSpecAmount', 'bcdRateBasis', 'specQty', 'swsRate', 'healthCessRate', 'healthCessAmount'];

// Re-fills the item form's duty boxes from what is typed in it. Every box is read and written through the item form
// itself (#item-form), never through the page: name="qty", "rate", "flag" and "uqc" also exist in the popups.
export function refreshItemDutyBoxes(selectedItem, invoices = [], jobData = {}) {
  if (typeof document === 'undefined') return null;
  const form = getItemForm();
  if (!form) return null;
  const field = (name) => form.elements[name];
  const fieldValue = (name) => (field(name) ? field(name).value : '');
  const percentOr = (name, fallback) => { const percent = parseFloat(fieldValue(name)); return isNaN(percent) ? fallback : percent; };

  const liveItem = { ...(selectedItem || {}) };
  REFRESH_DUTY_FIELDS.forEach((name) => { if (field(name)) liveItem[name] = fieldValue(name); });
  const valuation = itemAssessableINR({ itemValue: liveItem.value, invNo: liveItem.invNo, invSrNo: liveItem.invSrNo }, invoices, jobData);
  const hint = document.getElementById('item-av-hint');
  if (hint) {
    hint.textContent = valuation.rateFound
      ? `Ass. value ₹ ${valuation.av.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (estimate)`
      : `Exchange rate for ${valuation.currency || 'the invoice currency'} is missing`;
  }
  if (!valuation.rateFound) return valuation;

  const duty = computeItemDuty(liveItem, invoices, jobData);
  if (field('bcdAmount') && (fieldValue('bcdRate') !== '' || fieldValue('bcdSpecAmount') !== '')) field('bcdAmount').value = duty.bcd.toFixed(2);
  const note = document.getElementById('item-bcd-basis-note');
  if (note) note.textContent = dutyBasisText(duty.bcdBasis);
  if (field('swsAmount')) field('swsAmount').value = (duty.bcd * percentOr('swsRate', 10) / 100).toFixed(2);
  if (field('healthCessAmount') && fieldValue('healthCessRate') !== '') field('healthCessAmount').value = (valuation.av * percentOr('healthCessRate', 0) / 100).toFixed(2);
  return valuation;
}
