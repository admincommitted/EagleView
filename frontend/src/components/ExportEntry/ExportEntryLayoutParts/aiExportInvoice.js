const DAY_FIRST_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

const isoDate = (value) => {
  const text = String(value || '').trim();
  const dayFirst = DAY_FIRST_DATE.exec(text);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
};

const amountOf = (value) => {
  const number = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
};

function itemFromExtract(line, index) {
  const qty = amountOf(line.qty);
  const rate = amountOf(line.unitPrice);
  const amount = amountOf(line.amount) || qty * rate;
  const unit = String(line.unit || '').toUpperCase().slice(0, 3);
  return {
    id: Date.now() + index + 1, invSr: 1, itemSr: index + 1, scheme: '',
    ritc: String(line.ritc || '').replace(/\D/g, '').slice(0, 8),
    desc: String(line.desc || '').toUpperCase(),
    qty: qty ? String(qty) : '', unit, rateUnit: unit, per: '1', rate: rate ? String(rate) : '',
    totalFc: amount ? amount.toFixed(2) : '', igstPayStatus: 'Select', endUse: '',
  };
}

// The invoice PDF read by AI becomes THE invoice of the job (invoice 1) with its items, under the field names the
// Invoices and Items tabs use.
export function invoiceFromExtract(extract) {
  const items = (Array.isArray(extract.items) ? extract.items : []).map(itemFromExtract);
  const itemsTotal = items.reduce((sum, item) => sum + amountOf(item.totalFc), 0);
  const statedValue = amountOf(extract.totalValue || extract.invoiceValue);
  const invoice = {
    id: 1,
    no: String(extract.invoiceNo || '').toUpperCase().slice(0, 17),
    date: isoDate(extract.invoiceDate),
    currency: String(extract.currency || '').toUpperCase().slice(0, 3),
    value: statedValue ? String(statedValue) : (itemsTotal ? itemsTotal.toFixed(2) : ''),
    contractType: 'FOB',
    addFreight: 'N',
  };
  const buyerName = extract.buyerName ? String(extract.buyerName).toUpperCase().slice(0, 35) : '';
  return { invoice, items, buyerName };
}
