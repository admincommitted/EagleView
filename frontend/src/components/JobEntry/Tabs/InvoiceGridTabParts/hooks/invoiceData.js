export const upperTrim = (value) => String(value ?? '').trim().toUpperCase();

export const invoiceNumberOf = (invoice) => String(invoice?.invNo || invoice?.invoiceNo || '').trim();

// Invoice Nos match ignoring case and spaces ("INV 1" = "inv1"); the server refuses a duplicate too
const compactNumber = (value) => upperTrim(value).replace(/\s+/g, '');

export const indexOfInvoiceNumber = (invoices, invoiceNumber, exceptId) =>
  invoices.findIndex((invoice) => compactNumber(invoiceNumberOf(invoice)) === compactNumber(invoiceNumber) && invoice.id !== exceptId);

export const isoFromDayFirst = (text) => {
  const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text;
};

const withoutCommas = (cell) => String(cell || '').replace(/,/g, '');

// a row pasted from Excel: Invoice No | Date | Value | Currency | Terms | Freight | Insurance | Misc. - only what is pasted is kept
export const pastedInvoice = (cells) => {
  const invNo = String(cells[0] || '').trim();
  if (!invNo) return null;
  const invoice = {
    invNo,
    invDate: isoFromDayFirst(String(cells[1] || '').trim()),
    value: withoutCommas(cells[2]),
    currency: String(cells[3] || '').toUpperCase(),
    terms: String(cells[4] || '').toUpperCase(),
    freightValue: withoutCommas(cells[5]),
    insuranceValue: withoutCommas(cells[6]),
    miscCharges: withoutCommas(cells[7]),
  };
  return Object.fromEntries(Object.entries(invoice).filter(([, value]) => value !== ''));
};

export const splitPastedInvoices = (pastedInvoices, currentInvoices) => {
  const knownNumbers = new Set(currentInvoices.map((invoice) => compactNumber(invoiceNumberOf(invoice))));
  const accepted = [];
  const duplicates = [];
  for (const invoice of pastedInvoices) {
    const number = compactNumber(invoice.invNo);
    if (knownNumbers.has(number)) duplicates.push(invoice.invNo);
    else { knownNumbers.add(number); accepted.push(invoice); }
  }
  return { accepted, duplicates };
};

const SERVER_FIELDS = ['invoiceSerialNumber', 'invoiceSrNo', 'items', 'importJobId', 'createdAt', 'updatedAt'];
const CHARGE_CURRENCY_FIELDS = [
  ['freightValue', 'freightCurrency'], ['insuranceValue', 'insuranceCurrency'], ['miscCharges', 'miscCurrency'], ['loadingAmount', 'loadingCurrency'],
  ['agencyCommAmount', 'agencyCommCurrency'], ['discountAmount', 'discountCurrency'], ['hssLoadAmount', 'hssCurrency'],
];

// an amount without a currency is not a complete charge: a charge left on the default takes the invoice currency
export const cleanInvoice = (invoice) => {
  const cleaned = { ...invoice };
  SERVER_FIELDS.forEach((field) => delete cleaned[field]);
  const invoiceCurrency = upperTrim(cleaned.currency || cleaned.invoiceCurrency);
  for (const [amountField, currencyField] of CHARGE_CURRENCY_FIELDS) {
    if (parseFloat(cleaned[amountField]) > 0 && !upperTrim(cleaned[currencyField]) && invoiceCurrency) cleaned[currencyField] = invoiceCurrency;
  }
  return cleaned;
};

const COPY_DROPPED_FIELDS = ['id', 'importJobId', 'importInvoiceId', 'createdAt', 'updatedAt', 'items'];

export const copyWithoutIds = (record) => {
  const copy = JSON.parse(JSON.stringify(record));
  COPY_DROPPED_FIELDS.forEach((field) => delete copy[field]);
  return copy;
};

export const invoiceSerialOf = (item) => String(item.invSrNo || '1');

// items point to their invoice by position (Inv Sr No): after the invoice list changed, old position -> invoice id -> new position
export const remapItems = (items, oldInvoices, newInvoices, { dropMissing = true } = {}) => {
  if (!items?.length) return items || [];
  const moved = [];
  items.forEach((item) => {
    const oldIndex = (parseInt(item.invSrNo || item.invoiceSrNo, 10) || 1) - 1;
    const invoice = oldInvoices[oldIndex];
    const newIndex = invoice ? newInvoices.findIndex((candidate) => candidate.id === invoice.id) : -1;
    if (newIndex === -1) {
      if (!dropMissing) moved.push(item);
      return;
    }
    moved.push({ ...item, invSrNo: String(newIndex + 1), invNo: invoiceNumberOf(newInvoices[newIndex]) });
  });
  return moved;
};

export const invoiceCurrencies = (invoice) =>
  [invoice.currency || invoice.invoiceCurrency, invoice.freightCurrency, invoice.insuranceCurrency, invoice.miscCurrency, invoice.loadingCurrency, invoice.agencyCommCurrency]
    .map(upperTrim)
    .filter((currency) => currency && currency !== 'INR');
