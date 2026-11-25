import { isValidElement } from 'react';

// a table cell given as a plain value / node, or as { value, colSpan, className }
export const cellSpecOf = (cell) =>
  (cell !== null && typeof cell === 'object' && !isValidElement(cell) && 'value' in cell ? cell : { value: cell });

export const parseNumber =(value) => parseFloat(String(value ?? '').replace(/,/g, '')) || 0;

export const formatAmount = (value, decimals = 2) =>
  parseNumber(value).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const toDmy = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || '');
};

export const invoiceNoOf = (invoice) => invoice.invNo || invoice.invoiceNo || '';
export const invoiceSrOf = (invoice, index) => String(invoice.invoiceSrNo || invoice.invSrNo || index + 1);
export const itemInvoiceSr = (item) => String(item.invSrNo || item.invoiceSrNo || 1);
export const itemNoOf = (item, index) => item.itemSrNo || item.itemNo || index + 1;
export const itemTagOf = (item, index) => `${itemInvoiceSr(item)}/${itemNoOf(item, index)}`;
export const itemDescriptionOf = (item) => item.desc || item.productDescription || '';
export const itemCthOf = (item) => item.ritc || item.hsCode || item.cth || '';
export const itemQtyOf = (item) => item.qty || item.quantity;
export const itemUqcOf = (item) => item.uqc || item.unit || '';
export const itemPriceOf = (item) => item.price || item.unitPrice;

export const parseJsonList = (value) => {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
};

// exchange rate of a currency for this job (same source as the duty estimate: job exchange rates, else invoice rate)
export function exRateOf(currency, jobData, invoice = {}) {
  const code = String(currency || '').trim().toUpperCase();
  if (!code || code === 'INR') return 1;
  const rate = parseJsonList(jobData?._exchangeRates).find((row) => String(row.currencyCode || '').toUpperCase() === code);
  if (rate) return parseNumber(rate.rate) / (parseNumber(rate.unitInRs) || 1);
  return parseNumber(invoice.exRate || invoice.exchangeRate) || 0;
}

export const parseJsonObject = (value) => {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  return parsed && typeof parsed === 'object' ? parsed : {};
};
