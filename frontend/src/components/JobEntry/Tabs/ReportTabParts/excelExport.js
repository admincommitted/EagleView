// "Export to Excel" of Import > Report: built from the same figures as the CHA Checklist - assessable value and duty
// by computeItemDuty, exchange rate from the job, amounts as numbers with 2 decimals, codes (CTH, IEC) as text.
// The job keeps importer / IEC in autoField_4 / autoField_5 and invoice terms in termsOfInvoice.
import { computeItemDuty } from '../ItemGridTabParts/helpers';
import { exRateOf } from './sections/reportFormat';

const num = (value) => parseFloat(String(value ?? '').replace(/,/g, '')) || 0;
const parsed = (value, fallback) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const jsonList = (value) => { const list = parsed(value, []); return Array.isArray(list) ? list : []; };
const jsonObject = (value) => { const object = parsed(value, {}); return object && typeof object === 'object' ? object : {}; };
const dmy = (value) => { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || '')); return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value || ''); };
const invoiceSrNo = (invoice, index) => String(invoice.invoiceSrNo || invoice.invSrNo || index + 1);
const itemInvoiceSrNo = (item) => String(item.invSrNo || item.invoiceSrNo || 1);
const invoiceNo = (invoice) => invoice.invNo || invoice.invoiceNo || '';
const invoiceDate = (invoice) => invoice.invDate || invoice.invoiceDate;
const invoiceTerms = (invoice) => invoice.terms || invoice.termsOfInvoice || '';
const itemNo = (item, index) => String(item.itemSrNo || item.itemNo || index + 1);
const itemDescription = (item) => item.desc || item.productDescription || '';
const itemCth = (item) => String(item.ritc || item.hsCode || item.cth || '');
const itemQty = (item) => num(item.qty || item.quantity);
const itemUqc = (item) => item.uqc || item.unit || '';
const itemPrice = (item) => num(item.price || item.unitPrice);

// sheet from rows; numbers get a format, columns a width
function sheet(XLSX, rows, { qty = [], rate = [], merges = [] } = {}) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let column = range.s.c; column <= range.e.c; column++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (!cell || cell.t !== 'n') continue;
      cell.z = qty.includes(column) ? '#,##0.000' : rate.includes(column) ? '0.0000' : '#,##0.00';
    }
  }
  if (merges.length) worksheet['!merges'] = merges;
  const widths = [];
  rows.forEach((row) => row.forEach((value, column) => {
    const length = typeof value === 'number' ? 14 : String(value ?? '').length + 2;
    widths[column] = Math.min(50, Math.max(widths[column] || 8, length));
  }));
  worksheet['!cols'] = widths.map((width) => ({ wch: width }));
  return worksheet;
}

const CHECKLIST_HEADERS = ['Item No', 'Item Details', 'Unit Price', 'Qty', 'UQC', 'Assess Value', 'CTH', 'CETH', 'BCD Rate %', 'BCD (Rs)', 'SWS Rate %', 'SWS (Rs)', 'IGST Rate %', 'IGST (Rs)', 'Other Duty (Rs)', 'Total Duty (Rs)'];
const ITEM_HEADERS = ['Inv Sr', 'Invoice No', 'Item No', 'Description', 'CTH', 'Qty', 'UQC', 'Unit Price', 'Currency', 'Item Value (FC)', 'Ex. Rate', 'Assess Value', 'BCD %', 'BCD', 'BCD Notn', 'BCD Sr', 'SWS', 'IGST %', 'IGST', 'IGST Notn', 'Other Duty', 'Total Duty', 'Country of Origin'];
const INVOICE_HEADERS = ['Sr', 'Invoice No', 'Date', 'Supplier', 'Terms', 'Currency', 'Ex. Rate', 'Invoice Value', 'Freight', 'Insurance', 'Misc', 'Items', 'Assess Value', 'Total Duty'];
const DOC_HEADERS = ['#', 'Doc Code', 'IRN', 'DRN', 'File', 'Issued By', 'Issue Date', 'Expiry'];

export function buildImportWorkbook(XLSX, { jobData, items, esanchitDocs }) {
  const job = jobData || {};
  const invoices = job.invoices || [];
  const jobItems = items || [];
  const dutyOf = new Map(jobItems.map((item) => [item, computeItemDuty(item, invoices, job)]));
  const groups = invoices.length
    ? invoices.map((invoice, index) => ({ invoice, srNo: invoiceSrNo(invoice, index), items: jobItems.filter((item) => itemInvoiceSrNo(item) === invoiceSrNo(invoice, index)) }))
    : [{ invoice: {}, srNo: '1', items: jobItems }];
  const total = (list, key) => list.reduce((sum, item) => sum + (dutyOf.get(item)[key] || 0), 0);
  const otherDutyTotal = (list) => total(list, 'health') + total(list, 'add') + total(list, 'other');
  const jobNo = job.jobNo && job.jobNo !== 'DRAFT' ? job.jobNo : 'DRAFT';
  const workbook = XLSX.utils.book_new();

  // 1. CHA Checklist (same layout as the report)
  const checklist = [['CHA Checklist'], [],
    ['Job No.', jobNo, 'Total Value', total(jobItems, 'av'), 'Total Duty', total(jobItems, 'total')],
    ['Importer', job.nameOfImporter || job.autoField_4 || '', 'IEC', String(job.iecCode || job.autoField_5 || ''), 'B/E No.', job.beNo ? `${job.beNo} Dt. ${dmy(job.beDate)}` : ''],
    ['MAWB / HAWB No', `${job.mawbNo || 'NOMAWB'} / ${job.hawbNo || '-'}`, 'No. of Pkgs', job.totalPkg || job.pkg || '', 'Gross Wt.', num(job.grossWt) || '', 'No. of Containers', jsonList(job.containers).length || ''], []];
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: CHECKLIST_HEADERS.length - 1 } }];
  groups.forEach((group) => {
    const { invoice } = group;
    const rate = exRateOf(invoice.currency, job, invoice);
    merges.push({ s: { r: checklist.length, c: 0 }, e: { r: checklist.length, c: 10 } });
    checklist.push([`Invoice No. & Date : ${invoiceNo(invoice)}${invoiceDate(invoice) ? ' - ' + dmy(invoiceDate(invoice)) : ''}  (${invoice.currency || ''} ${invoice.value || invoice.invValue || ''} ${invoiceTerms(invoice)})`, '', '', '', '', '', '', '', '', '', '', 'Exchange Rate', rate || 'not entered']);
    checklist.push(CHECKLIST_HEADERS);
    group.items.forEach((item, index) => {
      const duty = dutyOf.get(item);
      const igst = jsonObject(item.igstData);
      const cth = itemCth(item);
      checklist.push([itemNo(item, index), itemDescription(item), itemPrice(item), itemQty(item), itemUqc(item), duty.av, cth, String(item.ceth || item.cethCode || cth),
        num(item.bcdRate), duty.bcd, String(item.swsRate ?? '').trim() === '' ? 10 : num(item.swsRate), duty.sws, num(igst.rate), duty.igst, duty.health + duty.add + duty.other, duty.total]);
    });
    checklist.push(['Invoice total', `${group.items.length} items`, '', '', '', total(group.items, 'av'), '', '', '', total(group.items, 'bcd'), '', total(group.items, 'sws'), '', total(group.items, 'igst'), otherDutyTotal(group.items), total(group.items, 'total')]);
    const licences = group.items.flatMap((item) => jsonList(item.licenceData).filter((licence) => licence?.licenceNo).map((licence) => ({ ...licence, item: item.itemSrNo || item.itemNo })));
    if (licences.length) {
      licences.forEach((licence) => checklist.push(['Licence No. & Dt.', `${licence.licenceNo}${licence.licenceDate ? ' - ' + dmy(licence.licenceDate) : ''} [Item ${licence.item}]`, 'Debited Value', num(licence.debitValue) || '', 'Debited Qty', num(licence.debitQty) || '', licence.debitUqc || '']));
    } else {
      checklist.push(['Licence No. & Dt.', '-'], ['Debited Value', '-'], ['Debited Quantity', '-']);
    }
    checklist.push([]);
  });
  checklist.push(['Duty is an estimate from the rates entered in the job; final duty is as assessed by Customs (ICES).']);
  XLSX.utils.book_append_sheet(workbook, sheet(XLSX, checklist, { qty: [3], merges }), 'CHA Checklist');

  // 2. Items (one flat table, good for filters / pivots)
  const itemRows = [ITEM_HEADERS, ...jobItems.map((item, index) => {
    const duty = dutyOf.get(item);
    const igst = jsonObject(item.igstData);
    const invoice = invoices.find((candidate, position) => invoiceSrNo(candidate, position) === itemInvoiceSrNo(item)) || {};
    return [num(itemInvoiceSrNo(item)), invoiceNo(invoice), itemNo(item, index), itemDescription(item), itemCth(item), itemQty(item), itemUqc(item),
      itemPrice(item), duty.currency || invoice.currency || '', duty.itemValue, exRateOf(invoice.currency, job, invoice) || '', duty.av, num(item.bcdRate), duty.bcd, String(item.bcdNotificationNo || item.bcdNotification || ''), String(item.bcdSrNo || ''),
      duty.sws, num(igst.rate), duty.igst, String(igst.notnNo || ''), duty.health + duty.add + duty.other, duty.total, item.countryOfOrigin || item.coo || job.countryOfOrigin || ''];
  })];
  XLSX.utils.book_append_sheet(workbook, sheet(XLSX, itemRows, { qty: [5], rate: [10] }), 'Items');

  // 3. Invoices
  const invoiceRows = [INVOICE_HEADERS, ...(invoices.length ? groups : []).map(({ invoice, srNo, items: groupItems }) => [
    num(srNo), invoiceNo(invoice), dmy(invoiceDate(invoice)), invoice.supplierName || job.supplierName || '', invoiceTerms(invoice),
    invoice.currency || '', exRateOf(invoice.currency, job, invoice) || '', num(invoice.value || invoice.invValue), num(invoice.freight || invoice.freightValue), num(invoice.insurance || invoice.insuranceValue), num(invoice.miscCharges),
    groupItems.length, total(groupItems, 'av'), total(groupItems, 'total')])];
  XLSX.utils.book_append_sheet(workbook, sheet(XLSX, invoiceRows, { rate: [6] }), 'Invoices');

  // 4. Job header (with the real keys of the job)
  const headerRows = [['Field', 'Value'],
    ['Job No', jobNo], ['Job Date', dmy(job.jobDate)], ['B/E Type', job.boeType || 'HOME'], ['Port / Branch', job.portCode || job.branchCode || ''], ['Importer', job.nameOfImporter || job.autoField_4 || ''], ['IEC', String(job.iecCode || job.autoField_5 || '')],
    ['Branch Sr No', String(job.branchSrNo || job.autoField_48 || '')], ['GSTIN', job.commercialTaxRegistrationNo || ''], ['CHA', job.chaCode || job.autoField_3 || ''], ['B/E No / Date', job.beNo ? `${job.beNo} / ${dmy(job.beDate)}` : ''],
    ['Mode', job.shipmentMode || ''], ['MAWB / MBL', job.mawbNo || ''], ['HAWB / HBL', job.hawbNo || ''], ['IGM No / Date', [job.igmNumber || job.igmNo, dmy(job.igmDate)].filter(Boolean).join(' / ')], ['Inward Date', dmy(job.inwardDate)],
    ['Packages', job.totalPkg || job.pkg || ''], ['Gross Wt', job.grossWt ? `${job.grossWt} ${job.grossWtUnit || ''}` : ''], ['Country of Origin', job.countryOfOrigin || ''], ['Country of Consignment', job.countryOfConsignment || ''], ['Port of Origin', job.portOfOrigin || '']];
  XLSX.utils.book_append_sheet(workbook, sheet(XLSX, headerRows), 'Job Header');

  // 5. Duty summary
  const dutyRows = [['Duty', 'Amount (Rs)'], ['Total Assessable Value', total(jobItems, 'av')], ['Basic Customs Duty (BCD)', total(jobItems, 'bcd')], ['Social Welfare Surcharge (SWS)', total(jobItems, 'sws')], ['IGST', total(jobItems, 'igst')],
    ['Health Cess', total(jobItems, 'health')], ['Anti-Dumping Duty', total(jobItems, 'add')], ['Other Duty', total(jobItems, 'other')], ['TOTAL DUTY (estimate)', total(jobItems, 'total')]];
  XLSX.utils.book_append_sheet(workbook, sheet(XLSX, dutyRows), 'Duty Summary');

  // 6. Supporting documents
  const docs = esanchitDocs || [];
  if (docs.length) {
    const docRows = [DOC_HEADERS, ...docs.map((doc, index) => [index + 1, String(doc.docCode || ''), doc.irn || '', doc.drn || '', doc.fileName || '', doc.issuerName || '', dmy(doc.issueDate), dmy(doc.expiryDate)])];
    XLSX.utils.book_append_sheet(workbook, sheet(XLSX, docRows), 'Supporting Docs');
  }
  return workbook;
}
