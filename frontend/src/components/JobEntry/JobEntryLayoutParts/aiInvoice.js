import { newRowId } from './screenRowId';

const numberText = (value) => {
  const number = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isNaN(number) ? '' : String(number);
};

export const extractedInvoiceNo = (extract) => String(extract.invoiceNo || extract.invoice_no || '').trim();

export const isInvoiceOnJob = (invoices, invoiceNo) =>
  !!invoiceNo && invoices.some((invoice) => String(invoice.invNo || invoice.invoiceNo || '').trim().toUpperCase() === invoiceNo.toUpperCase());

function itemFromExtract(line, index, invSrNo, invNo) {
  const qty = numberText(line.qty || line.quantity);
  const price = numberText(line.unitPrice || line.unit_price || line.price);
  const value = numberText(line.amount || line.total_item_amount || line.value) || (qty && price ? String(+(qty * price).toFixed(2)) : '');
  const ritc = String(line.ritc || line.hs_code || line.hsCode || '').replace(/\D/g, '').slice(0, 8);
  const unit = String(line.unit || line.uqc || '').toUpperCase();
  const description = line.desc || line.description || '';
  return {
    id: newRowId(), srNo: index + 1, itemSrNo: String(index + 1), itemNo: String(index + 1), invSrNo, invNo,
    desc: description, productDescription: description, ritc, hsCode: ritc, cth: ritc, ceth: 'NOEXCISE',
    qty, quantity: qty, unit, uqc: unit, price, unitPrice: price, value, swsRate: '10',
  };
}

// The PDF read by AI becomes a NEW invoice (next Inv Sr No) with its items.
export function invoiceFromExtract(extract, invSrNo) {
  const lines = Array.isArray(extract) ? extract : (Array.isArray(extract.items) ? extract.items : []);
  const invNo = extractedInvoiceNo(extract);
  const items = lines.map((line, index) => itemFromExtract(line, index, invSrNo, invNo));
  const total = numberText(extract.invoiceValue || extract.totalValue) || String(+items.reduce((sum, item) => sum + (parseFloat(item.value) || 0), 0).toFixed(2));
  const invoice = {
    id: Date.now(), invNo, invoiceNo: invNo, invDate: extract.invoiceDate || extract.invoice_date || '', currency: String(extract.currency || '').toUpperCase(),
    value: total, supplierName: extract.supplierName || extract.shipper || '', items,
  };
  return { invoice, items };
}
