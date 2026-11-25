import * as XLSX from 'xlsx';
import { invoiceSerialOf } from './itemForm';

// numbers may come with thousands commas; a RITC typed as a number loses its leading zero (03061790 -> 3061790)
export const xlNum = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (text === '') return '';
  const number = parseFloat(text);
  return isFinite(number) ? String(number) : '';
};
export const xlRitc = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 7 ? `0${digits}` : digits;
};

const RITC_HEADERS = ['ritc', 'hscode', 'hsn', 'cth', 'ritccode'];
const DESCRIPTION_HEADERS = ['description', 'desc', 'itemdescription', 'goods'];
const INVOICE_SERIAL_HEADERS = ['invsr', 'invoicesr', 'invsrno', 'invoiceserial', 'invoicesrno'];

const pick = (row, names) => {
  const header = Object.keys(row).find((key) => names.includes(key.replace(/[^a-z]/gi, '').toLowerCase()));
  return header === undefined ? '' : String(row[header]).trim();
};

/**
 * Items from an Excel / CSV sheet. Columns: InvSr, Scheme, RITC, Description, Qty, Unit, Rate (header names are
 * flexible). Rows of an invoice the job does not have are left out (skipped); item numbers run per invoice after the
 * items already there.
 */
export async function readItemsSheet(file, existingItems, invoiceCount) {
  const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
  const lastSerial = {};
  existingItems.forEach((item) => {
    const serial = invoiceSerialOf(item);
    lastSerial[serial] = Math.max(lastSerial[serial] || 0, parseInt(item.itemSr, 10) || 0);
  });
  const items = [];
  const skipped = [];
  rows.forEach((row, index) => {
    const ritc = xlRitc(pick(row, RITC_HEADERS));
    const desc = pick(row, DESCRIPTION_HEADERS);
    if (!ritc && !desc) return;
    const invoiceText = pick(row, INVOICE_SERIAL_HEADERS);
    const invSr = invoiceText === '' ? 1 : parseInt(invoiceText, 10);
    if (!(invSr >= 1) || invSr > Math.max(1, invoiceCount || 0)) {
      skipped.push(`row ${index + 2} (InvSr ${invoiceText || '?'})`);
      return;
    }
    const qty = xlNum(pick(row, ['qty', 'quantity']));
    const rate = xlNum(pick(row, ['rate', 'price', 'unitprice']));
    const unit = (pick(row, ['unit', 'uqc', 'uom']) || 'NOS').toUpperCase().slice(0, 3);
    lastSerial[invSr] = (lastSerial[invSr] || 0) + 1;
    items.push({
      id: Date.now() + index, invSr, itemSr: lastSerial[invSr],
      scheme: pick(row, ['scheme', 'schemecode']), ritc, desc: desc.toUpperCase(), qty, unit, per: '1', rate, rateUnit: unit,
      totalFc: (parseFloat(qty) || 0) && (parseFloat(rate) || 0) ? (parseFloat(qty) * parseFloat(rate)).toFixed(2) : '',
    });
  });
  return { items, skipped };
}
