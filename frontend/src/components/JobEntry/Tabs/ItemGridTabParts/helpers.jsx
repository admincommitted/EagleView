// Helpers and constants
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';

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

// Assessable value of an item in INR (estimate for the duty boxes). The duty boxes used the item's invoice-currency
// total as if it were rupees. Now: item value x exchange rate, plus the item's share of freight / insurance / misc
// when the invoice terms do not already include them. 28-Oct-2026
// CBIC notifies the rate of exchange in two schedules: Schedule I is rupees per 1 unit, Schedule II is rupees per
// 100 units and holds exactly two currencies. A rate read off the notification for these is a per-100 figure.
// 30-Oct-2026: the list now lives in utils/cbicExchange.js so the export side uses the same one.
import { PER_100_CURRENCIES } from '../../../../utils/cbicExchange';
export { PER_100_CURRENCIES };

export function itemAssessableINR({ itemValue, invSrNo, invNo }, invoices = [], jobData = {}) {
  const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
  const inv = (invoices || []).find(i => invNo && i.invNo === invNo) || (invoices || [])[(parseInt(invSrNo, 10) || 1) - 1] || {};
  const invCur = String(inv.currency || inv.invoiceCurrency || '').trim().toUpperCase();
  let rates = jobData._exchangeRates;
  if (typeof rates === 'string') { try { rates = JSON.parse(rates); } catch (e) { rates = []; } }
  const rateOf = (cur) => {
    const c = String(cur || invCur || '').trim().toUpperCase();
    if (!c || c === 'INR') return 1;
    const r = (Array.isArray(rates) ? rates : []).find(x => String(x.currencyCode || '').toUpperCase() === c);
    if (r) return num(r.rate) / (num(r.unitInRs) || 1);
    // 30-Oct-2026: the invoice's own typed rate was used as rupees per 1 unit. CBIC notifies Japanese Yen and
    // Korean Won in Schedule II, per 100 units - so a typed 56.10 for JPY meant Rs 0.5610 a yen, and taking it
    // as per-yen made the assessable value (and every duty on it) 100 times too big.
    if (c === invCur && num(inv.exRate || inv.exchangeRate)) return num(inv.exRate || inv.exchangeRate) / (PER_100_CURRENCIES.includes(c) ? 100 : 1);
    return 0;
  };
  const exInv = rateOf(invCur);
  const itemFc = num(itemValue);
  const invFc = num(inv.value || inv.invValue || inv.invoiceValue) || itemFc;
  const share = invFc ? itemFc / invFc : 1;
  const terms = String(inv.terms || inv.termsOfInvoice || '').toUpperCase();
  const fobInr = invFc * exInv; // invoice value in INR (the base of the notional charges)
  // 12-Nov-2026: misc charges come first - a freight / insurance RATE is a % of invoice value + misc charges, as iCAFFE
  // worked them out (7733: freight 20 % and insurance 1.125 % of FOB + misc, AV 1.07 % low without it)
  const misc = num(inv.miscCharges) ? num(inv.miscCharges) * rateOf(inv.miscCurrency) : (num(inv.miscChargesRate) ? num(inv.miscChargesRate) / 100 * fobInr : 0);
  const charge = (amt, cur, ratePct) => num(amt) ? num(amt) * rateOf(cur) : (num(ratePct) ? num(ratePct) / 100 * (fobInr + misc) : 0);
  const air = /^A/i.test(String(jobData.shipmentMode || jobData.autoField_52 || jobData.transportMode || ''));
  // 30-Oct-2026: ICES rules of the Customs Valuation Rules, 2007 applied to the estimate (they were missing, so every
  // FOB / air BE was under-estimated): insurance not given -> 1.125 % of FOB; freight not given -> 20 % of FOB;
  // air freight is capped at 20 % of FOB. The flags say which figure is notional so the checklist can mark it.
  const notional = {};
  let freight = ['CIF', 'CF', 'C&F', 'CFR'].includes(terms) ? 0 : charge(inv.freightValue, inv.freightCurrency, inv.freightRate);
  if (!['CIF', 'CF', 'C&F', 'CFR'].includes(terms) && !num(inv.freightValue) && !num(inv.freightRate)) { freight = fobInr * 0.20; notional.freight = true; }
  if (air && !['CIF', 'CF', 'C&F', 'CFR'].includes(terms) && freight > fobInr * 0.20) { freight = fobInr * 0.20; notional.freightCapped = true; }
  let insurance = ['CIF', 'CI'].includes(terms) ? 0 : charge(inv.insuranceValue, inv.insuranceCurrency, inv.insuranceRate);
  if (!['CIF', 'CI'].includes(terms) && !num(inv.insuranceValue) && !num(inv.insuranceRate)) { insurance = fobInr * 0.01125; notional.insurance = true; }
  const cif = itemFc * exInv + share * (freight + insurance + misc);
  // 12-Nov-2026: the loads ICES adds, as iCAFFE worked them out on the filed BEs (24,092 high-sea-sale items and 2,094
  // SVB items came out low): high sea sale - HSS load % of the CIF (2 % as a rule) or the HSS amount in rupees, shared
  // by value; SVB - the load % on the assessable value from the SVB order, on CIF + HSS load (5940: 147.11 %).
  const hssRate = num(inv.hssLoadRate), hssAmt = num(inv.hssLoadAmount);
  const hss = hssRate ? cif * hssRate / 100 : (hssAmt ? share * hssAmt : 0);
  const svbPct = num(inv.svbLoadAssessableValue);
  const svb = svbPct ? (cif + hss) * svbPct / 100 : 0;
  const av = cif + hss + svb;
  return { av: Math.round(av * 100) / 100, rateFound: exInv > 0, currency: invCur, notional, freightInr: Math.round(share * freight * 100) / 100, insuranceInr: Math.round(share * insurance * 100) / 100,
    hssInr: Math.round(hss * 100) / 100, svbInr: Math.round(svb * 100) / 100 };
}

// Duty estimate for one item (checklist only; ICEGATE computes the real duty). Rates are % from the item.
// 30-Oct-2026 (was: IGST on AV + BCD + SWS + ADD + typed amounts): the way ICES adds it up -
//   BCD = AV x rate (or the SAPTA / preferential rate when BCD is blank); SWS = 10 % of BCD; Health cess = AV x rate
//   CVD / Addl CVD / SAPTA-as-additional / Anti-dumping / other duties (Add1, Add2, Other, Cess, Aggregate, Safeguard,
//   AIDC = "Infra Cess") = AV x their % (a typed Duty Amount is used when there is no %)
//   IGST = rate x (AV + every customs duty above)   Compensation cess = rate x the same base (igstData.cessRate / cessAmount)
//   Totals are kept to the paisa per item; the BE total is rounded to the rupee (totalRounded) like ICES does.
export const OTHER_DUTY_NAMES = ['Add1(SIA)', 'Add2(S2)', 'Other(TTA)', 'Cess', 'Health', 'Aggregate', 'Safe Guard', 'Infra Cess'];
export function computeItemDuty(item, invoices = [], jobData = {}) {
  const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
  const obj = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return v && typeof v === 'object' ? v : {}; };
  // ICES values the item as qty x unit price; the "Total Amount" box is only used when qty or price is missing
  const qp = num(item.qty || item.quantity) * num(item.price || item.unitPrice);
  const itemValue = qp || num(item.value);
  const r = itemAssessableINR({ itemValue, invSrNo: item.invSrNo, invNo: item.invNo }, invoices, jobData);
  const av = r.av;
  const has = (v) => String(v ?? '').trim() !== '';
  const pctOr = (rate, amount) => (has(rate) ? av * num(rate) / 100 : num(amount));
  // 30-Oct-2026: every rate was read as a percentage, so a tariff line like "20% or Rs 115 per kg, whichever is
  // higher" (most of chapters 50-63) and the specific-only lines (cigarettes per 1000, gold per 10 g, oils per
  // tonne) came out far short. A specific rate is rupees x quantity, in the UQC the tariff states it in - which is
  // not always the item's own unit, so the operator can give the quantity in that unit (specQty) and nothing is
  // guessed when the units differ and that box is empty.
  const itemQty = num(item.qty || item.quantity);
  const itemUqc = String(item.unit || item.uqc || '').trim().toUpperCase();
  const specUnitsFor = (uqc) => {
    const su = String(uqc || '').trim().toUpperCase();
    const typed = num(item.specQty);
    if (typed) return typed;
    if (!su || su === itemUqc) return itemQty;
    return null; // a different unit and no quantity given for it: the specific side cannot be worked out
  };
  // one duty line: the percentage side, the specific side, and which of them the tariff says to apply
  const dutyLine = (pct, specAmt, specUqc, basisIn, typedAmount) => {
    const b = String(basisIn || '').trim().toUpperCase().charAt(0);
    const adv = has(pct) ? av * num(pct) / 100 : null;
    // 18-Nov-2026: a specific rate of Rs 0 is no specific rate (Read File put "0" from the tariff on every item, and the
    // checklist read each as "whichever is higher" with a Rs 0 side)
    const hasSpec = has(specAmt) && num(specAmt) > 0;
    const units = hasSpec ? specUnitsFor(specUqc) : null;
    const spec = hasSpec && units !== null ? num(specAmt) * units : null;
    const needQty = hasSpec && units === null;
    const basis = b === 'S' || b === 'H' || b === 'L' || b === 'B' || b === 'A' ? b
      : (spec !== null && adv !== null ? 'H' : spec !== null ? 'S' : 'A');
    let amount = null, applied = basis;
    if (basis === 'S') { amount = spec; }
    else if (basis === 'B') { amount = (adv || 0) + (spec || 0); }
    else if (basis === 'H' || basis === 'L') {
      if (adv !== null && spec !== null) {
        const hi = basis === 'H';
        amount = hi ? Math.max(adv, spec) : Math.min(adv, spec);
        applied = (hi ? spec > adv : spec < adv) ? 'S' : 'A'; // a tie reads as the percentage
      } else { amount = adv !== null ? adv : spec; applied = adv !== null ? 'A' : 'S'; }
    } else { amount = adv; }
    if (amount === null) amount = num(typedAmount);
    return { amount, adv, spec, applied, needQty, units };
  };
  const bcdLine = has(item.bcdRate) || has(item.bcdSpecAmount)
    ? dutyLine(item.bcdRate, item.bcdSpecAmount, item.bcdSpecUqc || item.bcdUnit || item.specUqc, item.bcdRateBasis, item.bcdAmount)
    : (has(item.saptaRate) ? dutyLine(item.saptaRate, '', '', 'A', item.bcdAmount) : { amount: num(item.bcdAmount), adv: null, spec: null, applied: 'A', needQty: false, units: null });
  // 17-Nov-2026: every duty line is rounded to the paisa before it is added up or used as the IGST base, as ICES does -
  // IGST on the unrounded lines came out a paisa off (job 7342: 18,610.24 against ICEGATE's 18,610.23)
  const r2 = (x) => Math.round((Number(x) || 0) * 100 + (x >= 0 ? 1e-7 : -1e-7)) / 100;
  const bcd = r2(bcdLine.amount);
  // 12-Nov-2026: SWS is 10 % of BCD unless a notification is given without a rate - that is the exemption (011/2018:
  // iCAFFE / ICES charge no SWS; 4,500 loaded items came out with SWS)
  const sws = r2(bcd * (has(item.swsRate) ? num(item.swsRate) : (has(item.swsNotificationNo) ? 0 : 10)) / 100);
  const health = r2(pctOr(item.healthCessRate, item.healthCessAmount));
  const cvd = r2(pctOr(item.cvdRate, item.cvdAmount));
  const adlCvd = r2(pctOr(item.adlCvdRate, item.adlCvdAmount));
  const sapta = has(item.bcdRate) ? r2(pctOr(item.saptaRate, item.saptaAmount)) : 0; // used as the BCD above when BCD is blank
  const addD = obj(item.addData);
  const add = r2(has(addD.rate) ? av * num(addD.rate) / 100 : num(addD.amount));
  const od = obj(item.otherDutyData);
  // 12-Nov-2026: a line marked foregone (exempted: iCAFFE's Aggregate under 072/2017) is shown but neither paid nor in the IGST base
  const otherLines = OTHER_DUTY_NAMES.map(n => ({ name: n === 'Infra Cess' ? 'AIDC' : n, foregone: /^Y/i.test(String(od[n + '_foregone'] || '')), amount: r2(has(od[n + '_rate']) ? av * num(od[n + '_rate']) / 100 : num(od[n + '_dutyAmount'])) })).filter(l => l.amount);
  const other = otherLines.reduce((s, l) => s + (l.foregone ? 0 : l.amount), 0);
  const aidc = (otherLines.find(l => l.name === 'AIDC') || {}).amount || 0;
  const customsDuties = bcd + sws + health + cvd + adlCvd + sapta + add + other;
  const ig = obj(item.igstData);
  const igstBase = r2(av) + customsDuties;
  // 12-Nov-2026: an IGST exemption notification (igstData or the item's G/I duty row) without an effective rate
  // (igstData.exmpRate) is a full exemption - 2,840 of 2,850 loaded items with one had IGST 0 (010/2025, 052/2003 ...)
  let dRows = item.dutyRows; if (typeof dRows === 'string') { try { dRows = JSON.parse(dRows); } catch (e) { dRows = null; } }
  const giRow = (Array.isArray(dRows) ? dRows : []).find(r => r && r.dutyType === 'G' && r.addlDutyFlag === 'I') || {};
  const igExempt = String(ig.exmpNotnNo ?? '').trim() !== '' || String(giRow.exmpNotificationNo ?? '').trim() !== '';
  const igst = r2(igExempt ? (has(ig.exmpRate) ? igstBase * num(ig.exmpRate) / 100 : 0)
    : (has(ig.rate) ? igstBase * num(ig.rate) / 100 : num(ig.amount)));
  const compCess = r2(has(ig.cessRate) ? igstBase * num(ig.cessRate) / 100 : num(ig.cessAmount));
  const round = (x) => Math.round(x * 100) / 100;
  // 12-Nov-2026: duty foregone (loaded iCAFFE jobs: BCD debited to a licence / scrip, or every duty of an EOU / exempted
  // item) stays in the IGST base and the SWS but is not payable - job 11 was 27,406 too high, EOU job 6160 not 0
  const gross = bcd + sws + health + cvd + adlCvd + sapta + add + other + igst + compCess;
  const foregone = Math.min(num(item.dutyForegone), gross);
  const total = gross - foregone;
  return { bcdBasis: { applied: bcdLine.applied, adv: bcdLine.adv === null ? null : round(bcdLine.adv), spec: bcdLine.spec === null ? null : round(bcdLine.spec), needQty: bcdLine.needQty, units: bcdLine.units, uqc: String(item.bcdSpecUqc || item.bcdUnit || item.specUqc || '').toUpperCase() },
    rateFound: r.rateFound, currency: r.currency, notional: r.notional || {}, itemValue: round(itemValue), av: round(av), bcd: round(bcd), sws: round(sws), health: round(health), cvd: round(cvd), adlCvd: round(adlCvd), sapta: round(sapta), add: round(add), other: round(other), aidc: round(aidc), otherLines,
    igstBase: round(igstBase), igst: round(igst), compCess: round(compCess), foregone: round(foregone), total: round(total), totalRounded: Math.round(total) };
}

// IGST / cess base read live from the item form (the modal recalculates while typing): AV + every customs duty line
export function igstBaseFromForm(form, selectedItem, invoices = [], jobData = {}) {
  const g = (n) => parseFloat(form && form.elements[n] ? String(form.elements[n].value).replace(/,/g, '') : 0) || 0;
  const live = { ...(selectedItem || {}) };
  for (const n of ['value', 'qty', 'price', 'invNo', 'bcdRate', 'bcdAmount', 'bcdUnit', 'bcdSpecAmount', 'bcdRateBasis', 'specQty', 'swsRate', 'swsAmount', 'healthCessRate', 'healthCessAmount', 'cvdRate', 'cvdAmount', 'adlCvdRate', 'adlCvdAmount', 'saptaRate', 'saptaAmount']) if (form && form.elements[n]) live[n] = form.elements[n].value;
  const d = computeItemDuty(live, invoices, jobData);
  void g;
  return d;
}

// What the duty estimate actually applied, in words the operator can check against the tariff page. 30-Oct-2026
export function dutyBasisText(b) {
  if (!b) return '';
  const rs = (v) => '\u20b9 ' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  if (b.needQty) return 'Specific rate is per ' + b.uqc + ' - put the quantity in ' + b.uqc + ' in "Qty in duty unit", else only the % is applied';
  if (b.adv !== null && b.spec !== null) return 'BCD: ' + rs(b.adv) + ' by rate, ' + rs(b.spec) + ' at the specific rate - ' + (b.applied === 'S' ? 'specific' : 'rate') + ' applied';
  if (b.spec !== null) return 'BCD: specific rate only - ' + rs(b.spec) + ' on ' + b.units + ' ' + b.uqc;
  return '';
}

// Re-fills the item form's duty boxes from what is typed in it. 30-Oct-2026: it lived in the Duty section, so the
// Quantity / Unit Price boxes (in the Details section) changed the assessable value without the duty following -
// which matters now that a specific rate is multiplied by the quantity. Every box is read and written through the
// item form itself (#item-form), never through the page: name="qty", name="rate", name="flag" and name="uqc" also
// exist in the Customs CVD / Other Duty popups, so a document-wide lookup could pick up the popup's box instead.
export function refreshItemDutyBoxes(selectedItem, invoices = [], jobData = {}) {
  if (typeof document === 'undefined') return null;
  const f = document.getElementById('item-form');
  if (!f) return null;
  const el = (n) => f.elements[n];
  const val = (n) => { const e = el(n); return e ? e.value : ''; };
  const pct = (n, d) => { const v = parseFloat(val(n)); return isNaN(v) ? d : v; };
  const live = { ...(selectedItem || {}) };
  ['value', 'qty', 'price', 'uqc', 'unit', 'invNo', 'bcdRate', 'bcdAmount', 'bcdUnit', 'bcdSpecAmount', 'bcdRateBasis', 'specQty',
    'swsRate', 'healthCessRate', 'healthCessAmount'].forEach(k => { if (el(k)) live[k] = val(k); });
  const r = itemAssessableINR({ itemValue: live.value, invNo: live.invNo, invSrNo: live.invSrNo }, invoices, jobData);
  const hint = document.getElementById('item-av-hint');
  if (hint) hint.textContent = r.rateFound
    ? `Ass. value \u20b9 ${r.av.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (estimate)`
    : `Exchange rate for ${r.currency || 'the invoice currency'} is missing`;
  if (!r.rateFound) return r;
  const d = computeItemDuty(live, invoices, jobData);
  if (el('bcdAmount') && (val('bcdRate') !== '' || val('bcdSpecAmount') !== '')) el('bcdAmount').value = d.bcd.toFixed(2);
  const note = document.getElementById('item-bcd-basis-note');
  if (note) note.textContent = dutyBasisText(d.bcdBasis);
  if (el('swsAmount')) el('swsAmount').value = (d.bcd * pct('swsRate', 10) / 100).toFixed(2);
  if (el('healthCessAmount') && val('healthCessRate') !== '') el('healthCessAmount').value = (r.av * pct('healthCessRate', 0) / 100).toFixed(2);
  return r;
}
