import { amountOf } from './billingData';

export const PAYMENT_VOUCHER_TYPES = [
  { value: 'Receipt', label: 'Bank Receipt (F6)' },
  { value: 'Payment', label: 'Bank Payment (F5)' },
  { value: 'Contra', label: 'Contra Entry (F4)' },
];

export const INSTRUMENT_TYPES = ['NEFT/RTGS', 'SWIFT Wire', 'Cheque', 'UPI'];

export const REF_TYPE_OPTIONS = [
  { value: 'AGAINST', label: 'Agst Ref' },
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'ON_ACCOUNT', label: 'On Account' },
];

export const BANK_CASH_GROUPS = 'Bank Accounts,Cash-in-Hand';

/** Debtors for a receipt, creditors for a payment, bank / cash for a contra. */
export const partyGroupsFor = (voucherType) => {
  if (voucherType === 'Contra') return BANK_CASH_GROUPS;
  return voucherType === 'Receipt' ? 'Sundry Debtors' : 'Sundry Creditors';
};

export const allocationsFromBills = (bills) => (bills || []).map((bill, index) => ({
  id: 'b' + index, refType: 'AGAINST', refNo: bill.billNo || bill.refNo, againstVoucherId: bill.voucherId,
  date: bill.date, pendingAmt: bill.pending, allocatedAmt: '', fcyAmt: '', overdueDays: bill.overdueDays,
}));

export const onAccountRow = () => ({
  id: 'n' + Date.now(), refType: 'ON_ACCOUNT', refNo: '', againstVoucherId: null, date: '', pendingAmt: 0, allocatedAmt: '', fcyAmt: '',
});

export const isOverAllocated = (row) => amountOf(row.allocatedAmt) > row.pendingAmt && row.refType === 'AGAINST';

/** Oldest open bills first; returns the new rows and what is left unallocated. */
export function allocateOldestFirst(allocations, amount) {
  let left = amount;
  const next = allocations.map((row) => ({ ...row, allocatedAmt: '' }));
  allocations
    .filter((row) => row.refType === 'AGAINST' && row.pendingAmt > 0)
    .sort((first, second) => String(first.date || '').localeCompare(String(second.date || '')))
    .forEach((bill) => {
      if (left <= 0.009) return;
      const given = Math.min(left, bill.pendingAmt);
      left = Math.round((left - given) * 100) / 100;
      const row = next.find((candidate) => candidate.id === bill.id);
      if (row) row.allocatedAmt = given.toFixed(2);
    });
  return { allocations: next, left };
}

/**
 * Receipt / contra: bank Dr, party Cr (plus TDS Dr, which the party withheld; bank charges an extra Dr / Cr pair).
 * Payment: party Dr, bank Cr (bank charges are an extra Dr with the bank Cr covering both; TDS we deducted is a Cr).
 */
export function paymentDetails({ form, voucherType, enableForex, currency, roe }) {
  const cash = amountOf(form.receivedAmountINR);
  const tds = amountOf(form.tdsDeducted);
  const charges = amountOf(form.bankCharges);
  const forex = enableForex ? amountOf(form.forexGainLoss) : 0;
  const bankForex = {
    currency: enableForex ? currency : null,
    roe: enableForex ? roe : null,
    amountFcy: enableForex ? amountOf(form.receivedAmountFCY) : null,
  };
  const details = [];

  if (voucherType === 'Receipt' || voucherType === 'Contra') {
    details.push({ ledgerId: form.bankCashLedgerId, dc: 'Dr', amount: cash, ...bankForex, remarks: form.instrumentNo || null });
    if (tds) details.push({ ledgerId: form.tdsLedgerId, dc: 'Dr', amount: tds, remarks: 'TDS withheld by the party' });
    if (forex > 0) details.push({ ledgerId: form.forexLedgerId, dc: 'Cr', amount: forex, remarks: 'Exchange gain' });
    if (forex < 0) details.push({ ledgerId: form.forexLedgerId, dc: 'Dr', amount: -forex, remarks: 'Exchange loss' });
    details.push({ ledgerId: form.partyLedgerId, dc: 'Cr', amount: cash + tds + (forex > 0 ? forex : 0) + (forex < 0 ? forex : 0), remarks: null });
    if (charges) {
      details.push({ ledgerId: form.chargesLedgerId, dc: 'Dr', amount: charges, remarks: 'Bank charges on this receipt' });
      details.push({ ledgerId: form.bankCashLedgerId, dc: 'Cr', amount: charges, remarks: 'Bank charges debited by the bank' });
    }
  } else {
    details.push({ ledgerId: form.partyLedgerId, dc: 'Dr', amount: cash, remarks: null });
    if (charges) details.push({ ledgerId: form.chargesLedgerId, dc: 'Dr', amount: charges, remarks: 'Bank charges on this payment' });
    if (tds) details.push({ ledgerId: form.tdsLedgerId, dc: 'Cr', amount: tds, remarks: 'TDS we deducted' });
    details.push({ ledgerId: form.bankCashLedgerId, dc: 'Cr', amount: cash + charges - tds, ...bankForex, remarks: form.instrumentNo || null });
  }
  return details;
}

export const allocationPostings = ({ allocations, partyLedgerId, enableForex }) => allocations
  .filter((row) => amountOf(row.allocatedAmt) > 0)
  .map((row) => ({
    ledgerId: partyLedgerId, refType: row.refType, refNo: row.refNo || null,
    againstVoucherId: row.refType === 'AGAINST' ? row.againstVoucherId : null,
    amount: amountOf(row.allocatedAmt), amountFcy: enableForex ? amountOf(row.fcyAmt) : null,
  }));
