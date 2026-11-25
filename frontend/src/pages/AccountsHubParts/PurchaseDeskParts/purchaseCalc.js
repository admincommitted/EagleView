import { num, r2, sumOf } from '../VoucherDeskParts/amounts';
import { flipSide } from './purchaseConfig';

// one charge in rupees; a Rec line ("less from bill") counts negative
export const chargeAmounts = (charge, noTax) => {
  const sign = charge.pr === 'Rec' ? -1 : 1;
  const fcAmt = r2(num(charge.qty || 1) * num(charge.rate));
  const taxable = r2(charge.currency === 'INR' ? fcAmt : fcAmt * num(charge.roe));
  const gst = noTax ? 0 : r2(taxable * num(charge.gstRate) / 100);
  return { fcAmt, tx: sign * taxable, gst: sign * gst };
};

export const splitGst = (gst, supply) => (supply === 'inter'
  ? { igst: gst, cgst: 0, sgst: 0 }
  : { igst: 0, cgst: r2(gst / 2), sgst: r2(gst - r2(gst / 2)) });

// taxable, GST, bill value, the two TDS, round off and what is payable to the vendor
export function billTotals({ lines, supply, tds, tds2, roundOff, rcm, noTax }) {
  const charges = lines.map((charge) => ({ ...charge, ...chargeAmounts(charge, noTax) }));
  const taxable = r2(sumOf(charges, (charge) => charge.tx));
  const gst = r2(sumOf(charges, (charge) => charge.gst));
  const billValue = rcm ? taxable : r2(taxable + gst);
  const tdsOf = (entry) => (entry.on && num(entry.rate) ? Math.round((entry.base === 'bill' ? billValue : taxable) * num(entry.rate) / 100) : 0);
  const tds1Amt = tdsOf(tds);
  const tds2Amt = tdsOf(tds2);
  const tdsAmt = tds1Amt + tds2Amt;
  const beforeRounding = r2(billValue - tdsAmt);
  const payable = roundOff ? Math.round(beforeRounding) : beforeRounding;
  return { L: charges, taxable, gst, ...splitGst(gst, supply), billValue, tds1Amt, tds2Amt, tdsAmt, payable, ro: r2(payable - beforeRounding) };
}

// bill:  expense Dr (taxable) | Input GST Dr | vendor Cr (bill - TDS) | TDS Payable Cr
// RCM:   expense Dr | RCM Input Dr | RCM Tax Payable Cr | vendor Cr (taxable - TDS) | TDS Payable Cr
// credit note: the same lines with Dr and Cr swapped
export function billPosting({ totals, tax, rcm, tds1Section, tds2Section, vendor, billNo, creditNote }) {
  const ledgers = tax || {};
  const lines = [];
  const put = (ledgerId, amount, dc, rest = {}) => {
    if (!ledgerId || !r2(amount)) return;
    lines.push({ ledgerId, dc: amount < 0 ? flipSide(dc) : dc, amount: r2(Math.abs(amount)), ...rest });
  };
  totals.L.forEach((charge) => put(charge.ledgerId, charge.tx, 'Dr', {
    remarks: [charge.pr === 'Rec' && 'Rec', charge.charge, charge.sac && 'SAC ' + charge.sac, charge.jobNo && 'Job ' + charge.jobNo].filter(Boolean).join(' ') || null,
    ...(charge.currency !== 'INR' ? { currency: charge.currency, amountFcy: charge.fcAmt, roe: num(charge.roe) } : {}),
  }));
  if (totals.gst) {
    if (rcm) {
      put(ledgers.rcmInput, totals.gst, 'Dr', { remarks: 'GST under reverse charge' });
      put(ledgers.rcmPayable, totals.gst, 'Cr', { remarks: 'GST payable under reverse charge' });
    } else {
      put(ledgers.inputIgst, totals.igst, 'Dr');
      put(ledgers.inputCgst, totals.cgst, 'Dr');
      put(ledgers.inputSgst, totals.sgst, 'Dr');
    }
  }
  put(ledgers.tdsPayable, totals.tds1Amt, 'Cr', { remarks: tds1Section || 'TDS' });
  put(ledgers.tdsPayable, totals.tds2Amt, 'Cr', { remarks: (tds2Section || 'TDS') + ' (2nd TDS)' });
  if (totals.ro) lines.push({ ledgerId: ledgers.roundOff, dc: totals.ro > 0 ? 'Dr' : 'Cr', amount: Math.abs(totals.ro), remarks: 'Round off' });
  if (vendor) put(vendor, totals.payable, 'Cr', { remarks: billNo ? (creditNote ? 'Credit note ' : 'Bill ') + billNo : null });
  const posted = lines.filter((line) => line.ledgerId);
  return creditNote ? posted.map((line) => ({ ...line, dc: flipSide(line.dc) })) : posted;
}
