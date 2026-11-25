// Export FOB in one place, also for a job read from a file / Excel / AI PDF that never had the invoice open.
//
// Rule (same as the Invoices tab form): FOB (INR) = invoice value x rate - freight (CIF / CF) - insurance (CIF / CI),
// each charge converted with the rate of its own currency (blank currency = the invoice currency, INR = 1, other
// currencies = Currency master export rate). An item gets its share of the invoice FOB in proportion to its value.
// Commission, discount and other deductions are shown and sent to ICEGATE but not taken out of
// FOB - iCAFFE does not take them out (job 16518: commission USD 223 -> FOB Rs 21,14,825.00 = value - freight;
// job 38962: other deduction EUR 740 -> FOB = invoice value).
import { perUnit, normCur } from './cbicExchange';

const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(x) ? x : 0; };
const pick = (o, ...keys) => { for (const k of keys) { const v = o && o[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; };

export const contractOf = (inv) => {
  const c = String(pick(inv, 'contractType', 'natureOfContract', 'incoterm') || 'FOB').trim().toUpperCase().replace(/\s+/g, '');
  if (c === 'C&F' || c === 'CFR' || c === 'CNF') return 'CF';
  return c;
};

// rupees for one unit of the invoice currency
export const invoiceRate = (inv) => perUnit(inv && inv.currency, inv && (inv.exchRate || inv.exchangeRate), inv && inv.unitInRs);

// the charges taken out of the invoice value, as [amount, currency]
const chargesOf = (inv) => {
  const c = contractOf(inv);
  const list = [];
  if (c === 'CIF' || c === 'CF') list.push([pick(inv, 'freightAmount', 'freightAmt'), pick(inv, 'freightCurr', 'freightCurrency')]);
  if (c === 'CIF' || c === 'CI') list.push([pick(inv, 'insuranceAmount', 'insAmt'), pick(inv, 'insuranceCurr', 'insuranceCurrency')]);
  return list.filter(([a]) => num(a) !== 0);
};

// rate of a charge currency; null when the currency is not the invoice's / INR and the master has no rate (yet)
const chargeRate = (inv, cur, currencies) => {
  const c = normCur(cur);
  if (!c || c === normCur(inv && inv.currency)) return invoiceRate(inv);
  if (c === 'INR') return 1;
  const m = (currencies || []).find((x) => normCur(x.currencyCode || x.code) === c);
  const r = m ? num(m.exportRate) : 0;
  return r > 0 ? r : null;
};

// invoice FOB in INR (number), or null when it cannot be worked out yet
export const invoiceFobInr = (inv, currencies) => {
  const value = num(pick(inv, 'value', 'invoiceValue'));
  const ex = invoiceRate(inv);
  if (!value || !ex) return null;
  let fob = value * ex;
  for (const [amt, cur] of chargesOf(inv)) {
    const r = chargeRate(inv, cur, currencies);
    if (r === null) return null;
    fob -= num(amt) * r;
  }
  return Math.round(fob * 100) / 100;
};

// item value in the invoice currency
export const itemValueFc = (it) => num(it && (it.totalFc || it.total)) || (num(it && it.qty) * num(it && (it.rate ?? it.price)) / (num(it && it.per) || 1));

// item FOB (INR) as text, from its invoice; null when it cannot be worked out
export const itemFobFromInvoice = (it, inv) => {
  const ex = invoiceRate(inv);
  const tot = itemValueFc(it);
  if (!ex || !tot) return null;
  const v = num(pick(inv, 'value', 'invoiceValue')), f = num(inv && inv.invFobInr);
  const share = v > 0 && f > 0 ? Math.min(1, f / (v * ex)) : 1;
  return (tot * ex * share).toFixed(2);
};

// invoice FOB in the invoice currency (for the checklist)
export const invoiceFobFc = (inv) => { const ex = invoiceRate(inv), f = num(inv && inv.invFobInr); return ex && f ? (f / ex).toFixed(2) : ''; };
