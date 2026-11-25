import { perUnit, rateText, unitsOf, PER_100_CURRENCIES } from '@/utils/cbicExchange';

// ICEGATE pairing of the nature of contract with "unit price includes": CIF = B, CI = I, CF = F, FOB = N
export const ADD_FLAG_OF_CONTRACT = { CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' };
export const FREIGHT_CONTRACTS = ['CIF', 'CF'];
export const INSURANCE_CONTRACTS = ['CIF', 'CI'];
export const PAYMENT_NATURES = ['DP', 'AP', 'LC', 'DA', 'NA'];

export const EMPTY_INVOICE_FORM = { no: '', date: '', value: '', buyer: '', currency: '', exchRate: '', unitInRs: '' };
export const EMPTY_BUYER = { name: '', address1: '', address2: '', address3: '', address4: '', city: '' };

const EMPTY_THIRD_PARTY = { tpName: '', tpAddress1: '', tpAddress2: '', tpCity: '', tpCntryDiv: '', tpCntr1: '', tpCntry: '', tpCntr2: '', tpPin: '' };
const DAY_MS = 864e5;

const text = (value) => String(value || '').trim();
const invoiceSerialOf = (item) => parseInt(item.invSr, 10) || 1;

export const invoiceNoOf = (invoice) => invoice.no || invoice.invoiceNo || '';

// item FOB (INR): the item's share of the invoice FOB, with rupees per ONE unit (the invoice keeps the CBIC notation)
export function itemFobFor(item, invoice) {
  const rupeesPerUnit = perUnit(invoice.currency, invoice.exchRate || invoice.exchangeRate, invoice.unitInRs);
  const itemTotal = parseFloat(item.totalFc || item.total)
    || ((parseFloat(item.qty) || 0) * (parseFloat(item.rate ?? item.price) || 0) / (parseFloat(item.per) || 1));
  if (!rupeesPerUnit || !itemTotal) return item.itemFob;
  const invoiceValue = parseFloat(invoice.value || invoice.invoiceValue) || 0;
  const invoiceFob = parseFloat(invoice.invFobInr) || 0;
  const fobShare = invoiceValue > 0 && invoiceFob > 0 ? Math.min(1, invoiceFob / (invoiceValue * rupeesPerUnit)) : 1;
  return (itemTotal * rupeesPerUnit * fobShare).toFixed(2);
}

export function repricedItems(items, invoices) {
  return items.map((item) => {
    const invoice = invoices[invoiceSerialOf(item) - 1];
    if (!invoice) return item;
    const itemFob = itemFobFor(item, invoice);
    return itemFob === item.itemFob ? item : { ...item, itemFob };
  });
}

// items of deleted invoices go (or move to invoice 1 when kept); later invoices move up and items are renumbered
export function itemsAfterInvoiceDelete(items, goneSerials, deleteItems) {
  const kept = items.filter((item) => !(deleteItems && goneSerials.includes(invoiceSerialOf(item))));
  const moved = kept.map((item) => {
    const serial = invoiceSerialOf(item);
    if (goneSerials.includes(serial)) return { ...item, invSr: 1 };
    return { ...item, invSr: serial - goneSerials.filter((gone) => gone < serial).length };
  });
  const countPerInvoice = {};
  return moved.map((item) => {
    const serial = invoiceSerialOf(item);
    countPerInvoice[serial] = (countPerInvoice[serial] || 0) + 1;
    return { ...item, itemSr: countPerInvoice[serial] };
  });
}

export const countItemsOfInvoice = (items, serial) => items.filter((item) => invoiceSerialOf(item) === serial).length;

export function headerTotals(invoices) {
  const totalFob = invoices.reduce((sum, invoice) => sum + (parseFloat(invoice.invFobInr) || 0), 0);
  const totalValue = invoices.reduce((sum, invoice) => sum + (parseFloat(invoice.value) || 0), 0);
  return { fobRs: totalFob > 0 ? totalFob.toFixed(2) : '', invoiceValue: totalValue > 0 ? totalValue.toFixed(2) : '' };
}

// ICEGATE invoice rules (SB message format): errors stop the save, warnings are asked
export function checkInvoice({ formData, invoices, selectedId, natureOfContract, consigneeSame, buyerDetails, thirdPartyDetails, exportData }) {
  const errors = [];
  const warnings = [];
  const no = text(formData.no);
  if (!no) errors.push('Invoice No is mandatory');
  else if (no.length > 17) errors.push('Invoice No can have at most 17 characters');
  else if (invoices.some((invoice) => invoice.id !== selectedId && text(invoiceNoOf(invoice)).toUpperCase() === no.toUpperCase())) errors.push(`Invoice No ${no} is already in this job`);

  if (!formData.date) errors.push('Invoice Date is mandatory');
  else {
    const invoiceDate = new Date(formData.date);
    const today = new Date();
    if (!isNaN(invoiceDate)) {
      if (invoiceDate > today) errors.push('Invoice Date is in the future');
      else if ((today - invoiceDate) / DAY_MS > 366) errors.push('Invoice Date is more than 1 year old (ICEGATE allows up to 1 year)');
    }
  }
  if (!(parseFloat(formData.value) > 0)) errors.push('Invoice Value must be more than 0');
  if (!formData.currency) errors.push('Invoice currency is mandatory');
  if (!(parseFloat(formData.exchRate) > 0)) errors.push('Exchange rate is missing for ' + (formData.currency || 'the currency'));
  // CBIC Schedule II quotes JPY / KRW per 100 units: a rate read as per-1 makes every rupee figure 100 times too big
  else if (PER_100_CURRENCIES.includes(text(formData.currency).toUpperCase())) {
    warnings.push(`${formData.currency} is in Schedule II of the CBIC notification - the rate is taken as ${rateText(formData.currency, formData.exchRate, formData.unitInRs)}, i.e. Rs ${perUnit(formData.currency, formData.exchRate, formData.unitInRs).toFixed(4)} for one ${formData.currency}`);
  }
  if (FREIGHT_CONTRACTS.includes(natureOfContract) && !(parseFloat(formData.freightAmount) > 0)) errors.push(`Freight is mandatory for ${natureOfContract}`);
  if (INSURANCE_CONTRACTS.includes(natureOfContract) && !(parseFloat(formData.insuranceAmount) > 0) && !(parseFloat(formData.insuranceRate) > 0)) errors.push(`Insurance (amount or rate) is mandatory for ${natureOfContract}`);

  const paymentNature = String(formData.pymtNature || '').slice(0, 2).toUpperCase();
  if (paymentNature && !PAYMENT_NATURES.includes(paymentNature)) errors.push('Payment nature must be DP, AP, LC, DA or NA');
  // the realisation period under FEMA is only a warning of the ICEGATE check; iCAFFE files SBs with 180 days and more
  if (text(formData.pymtPeriod) && !/^\d{1,3}$/.test(text(formData.pymtPeriod))) errors.push('Payment period must be in days (0 - 999)');
  if (parseFloat(formData.invFobInr) < 0) errors.push('Charges are more than the invoice value (FOB below 0)');

  if (consigneeSame === 'N' && !text(buyerDetails.name || formData.buyer)) errors.push('Buyer name is needed when the buyer is not the consignee');
  if (consigneeSame === 'N' && !text(buyerDetails.address1 || formData.buyerAddress1)) errors.push('Buyer Address 1 is mandatory (Buyer details)');
  if (consigneeSame === 'Y' && !text(exportData.consigneeAddress1)) warnings.push('Consignee Address 1 is empty on the SB Header (it goes as the buyer address)');
  if (thirdPartyDetails === 'Y' && !text(formData.tpName)) errors.push('Third party name is needed (Third Party Details = Y)');
  if (thirdPartyDetails === 'Y' && !/^[A-Z]{2}$/.test(String(formData.tpCntr2 || '').toUpperCase())) errors.push('Third party country code (2 letters) is mandatory');
  if (thirdPartyDetails === 'Y' && !text(formData.tpAddress1)) errors.push('Third party Address 1 is mandatory');
  return { errors, warnings };
}

export function buildInvoice(base, { formData, natureOfContract, addFreightInsurance, igstBasedOn, consigneeSame, thirdPartyDetails, buyerDetails, exportData }) {
  const buyer = consigneeSame === 'Y'
    ? {
      buyer: exportData.consigneeName || '', buyerAddress1: exportData.consigneeAddress1 || '', buyerAddress2: exportData.consigneeAddress2 || '',
      buyerAddress3: exportData.consigneeAddress3 || '', buyerAddress4: exportData.consigneeAddress4 || '',
    }
    : {
      buyer: buyerDetails.name || formData.buyer || '', buyerAddress1: buyerDetails.address1 || '', buyerAddress2: buyerDetails.address2 || '',
      buyerAddress3: buyerDetails.address3 || '', buyerAddress4: buyerDetails.address4 || '', buyerCity: buyerDetails.city || '',
    };
  const thirdParty = thirdPartyDetails === 'Y' ? {} : EMPTY_THIRD_PARTY;
  const no = text(formData.no);
  return {
    ...base, ...formData, ...buyer, ...thirdParty,
    contractType: natureOfContract, natureOfContract,
    addFreight: String(addFreightInsurance || '').toUpperCase().slice(0, 1), igstBasedOn, consigneeSame, thirdParty: thirdPartyDetails,
    invoiceNo: no, no, invoiceDate: formData.date, invoiceValue: formData.value,
    exchangeRate: formData.exchRate, buyerName: buyer.buyer,
    // the units the rate is quoted for (100 for JPY / KRW, CBIC Schedule II): every rupee figure divides by it
    unitInRs: parseFloat(formData.unitInRs) || unitsOf(formData.currency),
  };
}

export const nextInvoiceId = (invoices) => (invoices.length ? Math.max(...invoices.map((invoice) => Number(invoice.id) || 0)) + 1 : 1);
