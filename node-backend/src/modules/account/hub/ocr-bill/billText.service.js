import { GST_SLABS, nearestOf } from '../shared/hubFormat.service.js';

const DEFAULT_GST_SLAB = 18;
const MONTH_NUMBERS = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

/** A bill amount as a number ("1,23,456.50" -> 123456.5; 0 when not a number). */
export const amountOf = (text) => {
  const number = parseFloat(String(text || '').replace(/[^\d.-]/g, ''));
  return isFinite(number) ? number : 0;
};

const fullYear = (year) => (year.length === 2 ? '20' + year : year);

/** A bill date as YYYY-MM-DD: 2026-11-05, 05/11/2026, 5-11-26, 05 Nov 2026 ...; '' when not a date. */
export const isoDateOf = (text) => {
  const value = String(text || '').trim();
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  let match = value.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})$/);
  if (match) return `${fullYear(match[3])}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = value.match(/^(\d{1,2})[/\-. ]([A-Za-z]{3})[A-Za-z]*[/\-. ,]*(\d{2,4})$/);
  if (match && MONTH_NUMBERS[match[2].toUpperCase()]) {
    return `${fullYear(match[3])}-${String(MONTH_NUMBERS[match[2].toUpperCase()]).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return '';
};

const GSTIN_IN_TEXT = /\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/g;
const INVOICE_NO = /(?:invoice|bill|inv)\s*(?:no|number|#)\.?\s*[:-]?\s*([A-Z0-9][A-Z0-9/-]{2,30})/i;
const INVOICE_DATE =
  /(?:invoice|bill|inv)?\s*date\s*[:-]?\s*(\d{1,2}[/\-. ](?:\d{1,2}|[A-Za-z]{3,9})[/\-. ,]*\d{2,4})/i;
const RATE_SUFFIX = '(?:\\s*@?\\s*\\d+(?:\\.\\d+)?\\s*%)?';
const CGST_AMOUNT = new RegExp('CGST' + RATE_SUFFIX + '[^\\d\\n]{0,25}([\\d,]+\\.\\d{2})', 'i');
const SGST_AMOUNT = new RegExp('(?:SGST|UTGST)' + RATE_SUFFIX + '[^\\d\\n]{0,25}([\\d,]+\\.\\d{2})', 'i');
const IGST_AMOUNT = new RegExp('IGST' + RATE_SUFFIX + '[^\\d\\n]{0,25}([\\d,]+\\.\\d{2})', 'i');
const TAXABLE_AMOUNT = /(?:taxable\s*(?:value|amount)|sub\s*total)[^\d\n]{0,20}([\d,]+\.\d{2})/i;
const TOTAL_AMOUNT =
  /(?:grand\s*total|total\s*(?:invoice\s*)?amount|net\s*payable|amount\s*payable)[^\d\n]{0,20}([\d,]+\.\d{2})/i;
const HOUSE_NO = /\b(?:HAWB|HBL|H\.?A\.?W\.?B)\s*(?:no)?\.?\s*[:-]?\s*([A-Z0-9\-/]{4,25})/i;
const MASTER_NO =
  /\b(?:MAWB|MBL|M\.?A\.?W\.?B)\s*(?:no)?\.?\s*[:-]?\s*([0-9]{3}[\s-]?[0-9]{4}\s?[0-9]{4}|[A-Z0-9\-/]{6,25})/i;

/** What can be read from the bill text with patterns (GSTIN, invoice no, date, GST amounts, HAWB / MAWB). */
export function billByPatterns(text) {
  const billText = String(text || '');
  const bill = { lines: [] };
  const gstins = [...new Set(billText.toUpperCase().match(GSTIN_IN_TEXT) || [])];
  bill.gstins = gstins;
  bill.vendorGstin = gstins[0] || '';
  const invoiceNo = billText.match(INVOICE_NO);
  if (invoiceNo) bill.invoiceNo = invoiceNo[1];
  const invoiceDate = billText.match(INVOICE_DATE);
  if (invoiceDate) bill.invoiceDate = isoDateOf(invoiceDate[1]);
  const amountMatching = (pattern) => {
    const match = billText.match(pattern);
    return match ? amountOf(match[1]) : 0;
  };
  bill.cgst = amountMatching(CGST_AMOUNT);
  bill.sgst = amountMatching(SGST_AMOUNT);
  bill.igst = amountMatching(IGST_AMOUNT);
  bill.taxable = amountMatching(TAXABLE_AMOUNT);
  bill.total = amountMatching(TOTAL_AMOUNT);
  const houseNo = billText.match(HOUSE_NO);
  if (houseNo) bill.hblNo = houseNo[1];
  const masterNo = billText.match(MASTER_NO);
  if (masterNo) bill.mblNo = masterNo[1];
  if (bill.taxable) {
    const gst = bill.igst || bill.cgst + bill.sgst;
    const rate = gst ? Math.round((gst / bill.taxable) * 100) : 0;
    bill.lines = [
      { description: 'As per bill', amount: bill.taxable, gstRate: nearestOf(GST_SLABS, rate, DEFAULT_GST_SLAB) },
    ];
  }
  return bill;
}
