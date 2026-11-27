// The nine kinds of GST invoice, as on iCAFFE. Every saved invoice is a voucher in the books at once (Sales; Credit
// Note for credit notes), numbered with the invoice no:
//   Dr party (the party's debtor ledger)   Cr one income ledger per charge   Cr Output IGST / CGST / SGST   +/- Round Off
//   Reimbursable: no GST; the charges go back to the cost ledger of the charge (else "Reimbursement of Expenses")
//   Credit Note: the same lines reversed, against the earlier invoice
export const KINDS = {
  service: { label: 'Service', prefix: 'SI', base: 'Sales', gst: true },
  reimbursable: { label: 'Reimbursable', prefix: 'RI', base: 'Sales', gst: false },
  other: { label: 'Other', prefix: 'OI', base: 'Sales', gst: true },
  debitnote: { label: 'Debit Note', prefix: 'DN', base: 'Sales', gst: true, againstBill: true },
  courier: { label: 'Courier', prefix: 'CR', base: 'Sales', gst: true },
  creditnote: { label: 'Credit Note', prefix: 'CN', base: 'Credit Note', gst: true, againstBill: true },
  consultancy: { label: 'Consultancy', prefix: 'CO', base: 'Sales', gst: true },
  can: { label: 'CAN', prefix: 'CA', base: 'Sales', gst: true },
  overseas: { label: 'OverSeas Agent', prefix: 'OA', base: 'Sales', gst: true, overseas: true },
};

export const CREDIT_NOTE = 'creditnote';
export const DEBIT_NOTE = 'debitnote';
export const REIMBURSABLE = 'reimbursable';
export const OVERSEAS = 'overseas';
export const VOID = 'Void';
export const FOREIGN_POS = '97';

export const REASONS = [
  'Sales Return',
  'Post Sale Discount',
  'Deficiency in Service',
  'Correction In Invoice',
  'Change In POS',
  'Finalization of Provisional assessment',
  'Others',
];

export const GST_STATES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  10: 'Bihar',
  11: 'Sikkim',
  12: 'Arunachal Pradesh',
  13: 'Nagaland',
  14: 'Manipur',
  15: 'Mizoram',
  16: 'Tripura',
  17: 'Meghalaya',
  18: 'Assam',
  19: 'West Bengal',
  20: 'Jharkhand',
  21: 'Odisha',
  22: 'Chhattisgarh',
  23: 'Madhya Pradesh',
  24: 'Gujarat',
  25: 'Daman & Diu',
  26: 'Dadra & Nagar Haveli and Daman & Diu',
  27: 'Maharashtra',
  29: 'Karnataka',
  30: 'Goa',
  31: 'Lakshadweep',
  32: 'Kerala',
  33: 'Tamil Nadu',
  34: 'Puducherry',
  35: 'Andaman & Nicobar Islands',
  36: 'Telangana',
  37: 'Andhra Pradesh',
  38: 'Ladakh',
  97: 'Other Territory',
};

const ICAFFE_USER = 'iCAFFE';
const ICAFFE_LOADER_REMARK = /^Loaded from iCAFFE/i;

/** Bills loaded from iCAFFE's Sales Register are view only here: their voucher came from iCAFFE. */
export const fromIcaffe = (invoice) => !!invoice && invoice.createdBy === ICAFFE_USER;

/** Bills loaded from iCAFFE carry the loader's note as remarks; it is shown blank. */
export const realRemark = (text) => (ICAFFE_LOADER_REMARK.test(String(text || '').trim()) ? '' : text || '');

export const ICAFFE_VIEW_ONLY_MESSAGE =
  "This bill was loaded from iCAFFE (its voucher is iCAFFE's) - it is view only here; for a change issue a credit / debit note";

const isWithoutPayment = (invoice) => /without/i.test(invoice.paymentOption || '');

/** IRP supply type of an invoice: SEZ / export with or without payment of tax, else B2B. */
export function eInvoiceSupplyType(invoice) {
  if (invoice.sez) return isWithoutPayment(invoice) ? 'SEZWOP' : 'SEZWP';
  if (invoice.pos === FOREIGN_POS) return isWithoutPayment(invoice) ? 'EXPWOP' : 'EXPWP';
  return 'B2B';
}
