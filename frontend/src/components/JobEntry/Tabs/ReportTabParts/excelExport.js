// "Export to Excel" of Import > Report (28-Oct-2026).
// The old export wrote raw screen fields: many columns came out blank (the job keeps importer / IEC in autoField_4 /
// autoField_5, invoice terms in termsOfInvoice ...), duty amounts were empty (they are not stored on the item) and
// numbers were text. Now the workbook is built from the same figures as the CHA Checklist: assessable value and duty
// by computeItemDuty, exchange rate from the job, amounts as numbers with 2 decimals, codes (CTH, IEC) as text.
import { computeItemDuty } from '../ItemGridTabParts/helpers';
import { exRateOf } from './sections/SimpleReports';

const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
const list = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
const obj = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } } return v && typeof v === 'object' ? v : {}; };
const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || ''); };
const invSr = (inv, i) => String(inv.invoiceSrNo || inv.invSrNo || i + 1);
const itInv = (it) => String(it.invSrNo || it.invoiceSrNo || 1);

// sheet from rows; numbers get a format, columns a width
function sheet(XLSX, aoa, { money = [], qty = [], rate = [], merges = [] } = {}) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
    if (!cell || cell.t !== 'n') continue;
    cell.z = qty.includes(C) ? '#,##0.000' : rate.includes(C) ? '0.0000' : '#,##0.00';
  }
  if (merges.length) ws['!merges'] = merges;
  const w = [];
  aoa.forEach(r => r.forEach((v, i) => { const len = typeof v === 'number' ? 14 : String(v ?? '').length + 2; w[i] = Math.min(50, Math.max(w[i] || 8, len)); }));
  ws['!cols'] = w.map(x => ({ wch: x }));
  return ws;
}

export function buildImportWorkbook(XLSX, { jobData, items, esanchitDocs }) {
  const j = jobData || {};
  const invoices = j.invoices || [];
  const its = items || [];
  const duty = new Map(its.map(it => [it, computeItemDuty(it, invoices, j)]));
  const groups = invoices.length ? invoices.map((inv, i) => ({ inv, sr: invSr(inv, i), list: its.filter(it => itInv(it) === invSr(inv, i)) })) : [{ inv: {}, sr: '1', list: its }];
  const sum = (arr, k) => arr.reduce((s, it) => s + (duty.get(it)[k] || 0), 0);
  const jobNo = j.jobNo && j.jobNo !== 'DRAFT' ? j.jobNo : 'DRAFT';
  const wb = XLSX.utils.book_new();

  // 1. CHA Checklist (same layout as the report)
  const H = ['Item No', 'Item Details', 'Unit Price', 'Qty', 'UQC', 'Assess Value', 'CTH', 'CETH', 'BCD Rate %', 'BCD (Rs)', 'SWS Rate %', 'SWS (Rs)', 'IGST Rate %', 'IGST (Rs)', 'Other Duty (Rs)', 'Total Duty (Rs)'];
  const a = [['CHA Checklist'], [],
    ['Job No.', jobNo, 'Total Value', sum(its, 'av'), 'Total Duty', sum(its, 'total')],
    ['Importer', j.nameOfImporter || j.autoField_4 || '', 'IEC', String(j.iecCode || j.autoField_5 || ''), 'B/E No.', j.beNo ? `${j.beNo} Dt. ${dmy(j.beDate)}` : ''],
    ['MAWB / HAWB No', `${j.mawbNo || 'NOMAWB'} / ${j.hawbNo || '-'}`, 'No. of Pkgs', j.totalPkg || j.pkg || '', 'Gross Wt.', num(j.grossWt) || '', 'No. of Containers', list(j.containers).length || ''], []];
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: H.length - 1 } }];
  groups.forEach(g => {
    const inv = g.inv, rate = exRateOf(inv.currency, j, inv);
    merges.push({ s: { r: a.length, c: 0 }, e: { r: a.length, c: 10 } });
    a.push([`Invoice No. & Date : ${inv.invNo || inv.invoiceNo || ''}${inv.invDate || inv.invoiceDate ? ' - ' + dmy(inv.invDate || inv.invoiceDate) : ''}  (${inv.currency || ''} ${inv.value || inv.invValue || ''} ${inv.terms || inv.termsOfInvoice || ''})`, '', '', '', '', '', '', '', '', '', '', 'Exchange Rate', rate || 'not entered']);
    a.push(H);
    g.list.forEach((it, i) => {
      const d = duty.get(it), ig = obj(it.igstData), cth = String(it.ritc || it.hsCode || it.cth || '');
      a.push([String(it.itemSrNo || it.itemNo || i + 1), it.desc || it.productDescription || '', num(it.price || it.unitPrice), num(it.qty || it.quantity), it.uqc || it.unit || '', d.av, cth, String(it.ceth || it.cethCode || cth),
        num(it.bcdRate), d.bcd, String(it.swsRate ?? '').trim() === '' ? 10 : num(it.swsRate), d.sws, num(ig.rate), d.igst, d.health + d.add + d.other, d.total]);
    });
    a.push(['Invoice total', `${g.list.length} items`, '', '', '', sum(g.list, 'av'), '', '', '', sum(g.list, 'bcd'), '', sum(g.list, 'sws'), '', sum(g.list, 'igst'), sum(g.list, 'health') + sum(g.list, 'add') + sum(g.list, 'other'), sum(g.list, 'total')]);
    const lic = g.list.flatMap(it => list(it.licenceData).filter(x => x && x.licenceNo).map(x => ({ ...x, item: it.itemSrNo || it.itemNo })));
    if (lic.length) lic.forEach(x => a.push(['Licence No. & Dt.', `${x.licenceNo}${x.licenceDate ? ' - ' + dmy(x.licenceDate) : ''} [Item ${x.item}]`, 'Debited Value', num(x.debitValue) || '', 'Debited Qty', num(x.debitQty) || '', x.debitUqc || '']));
    else { a.push(['Licence No. & Dt.', '-']); a.push(['Debited Value', '-']); a.push(['Debited Quantity', '-']); }
    a.push([]);
  });
  a.push(['Duty is an estimate from the rates entered in the job; final duty is as assessed by Customs (ICES).']);
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, a, { qty: [3], merges }), 'CHA Checklist');

  // 2. Items (one flat table, good for filters / pivots)
  const ih = ['Inv Sr', 'Invoice No', 'Item No', 'Description', 'CTH', 'Qty', 'UQC', 'Unit Price', 'Currency', 'Item Value (FC)', 'Ex. Rate', 'Assess Value', 'BCD %', 'BCD', 'BCD Notn', 'BCD Sr', 'SWS', 'IGST %', 'IGST', 'IGST Notn', 'Other Duty', 'Total Duty', 'Country of Origin'];
  const ia = [ih, ...its.map((it, i) => {
    const d = duty.get(it), ig = obj(it.igstData), inv = invoices.find((x, k) => invSr(x, k) === itInv(it)) || {};
    return [num(itInv(it)), inv.invNo || inv.invoiceNo || '', String(it.itemSrNo || it.itemNo || i + 1), it.desc || it.productDescription || '', String(it.ritc || it.hsCode || it.cth || ''), num(it.qty || it.quantity), it.uqc || it.unit || '',
      num(it.price || it.unitPrice), d.currency || inv.currency || '', d.itemValue, exRateOf(inv.currency, j, inv) || '', d.av, num(it.bcdRate), d.bcd, String(it.bcdNotificationNo || it.bcdNotification || ''), String(it.bcdSrNo || ''),
      d.sws, num(ig.rate), d.igst, String(ig.notnNo || ''), d.health + d.add + d.other, d.total, it.countryOfOrigin || it.coo || j.countryOfOrigin || ''];
  })];
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, ia, { qty: [5], rate: [10] }), 'Items');

  // 3. Invoices
  const va = [['Sr', 'Invoice No', 'Date', 'Supplier', 'Terms', 'Currency', 'Ex. Rate', 'Invoice Value', 'Freight', 'Insurance', 'Misc', 'Items', 'Assess Value', 'Total Duty'],
    ...groups.filter(g => invoices.length).map(g => { const inv = g.inv; return [num(g.sr), inv.invNo || inv.invoiceNo || '', dmy(inv.invDate || inv.invoiceDate), inv.supplierName || j.supplierName || '', inv.terms || inv.termsOfInvoice || '',
      inv.currency || '', exRateOf(inv.currency, j, inv) || '', num(inv.value || inv.invValue), num(inv.freight || inv.freightValue), num(inv.insurance || inv.insuranceValue), num(inv.miscCharges), g.list.length, sum(g.list, 'av'), sum(g.list, 'total')]; })];
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, va, { rate: [6] }), 'Invoices');

  // 4. Job header (with the real keys of the job)
  const ha = [['Field', 'Value'],
    ['Job No', jobNo], ['Job Date', dmy(j.jobDate)], ['B/E Type', j.boeType || 'HOME'], ['Port / Branch', j.portCode || j.branchCode || ''], ['Importer', j.nameOfImporter || j.autoField_4 || ''], ['IEC', String(j.iecCode || j.autoField_5 || '')],
    ['Branch Sr No', String(j.branchSrNo || j.autoField_48 || '')], ['GSTIN', j.commercialTaxRegistrationNo || ''], ['CHA', j.chaCode || j.autoField_3 || ''], ['B/E No / Date', j.beNo ? `${j.beNo} / ${dmy(j.beDate)}` : ''],
    ['Mode', j.shipmentMode || ''], ['MAWB / MBL', j.mawbNo || ''], ['HAWB / HBL', j.hawbNo || ''], ['IGM No / Date', [j.igmNumber || j.igmNo, dmy(j.igmDate)].filter(Boolean).join(' / ')], ['Inward Date', dmy(j.inwardDate)],
    ['Packages', j.totalPkg || j.pkg || ''], ['Gross Wt', j.grossWt ? `${j.grossWt} ${j.grossWtUnit || ''}` : ''], ['Country of Origin', j.countryOfOrigin || ''], ['Country of Consignment', j.countryOfConsignment || ''], ['Port of Origin', j.portOfOrigin || '']];
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, ha), 'Job Header');

  // 5. Duty summary
  const da = [['Duty', 'Amount (Rs)'], ['Total Assessable Value', sum(its, 'av')], ['Basic Customs Duty (BCD)', sum(its, 'bcd')], ['Social Welfare Surcharge (SWS)', sum(its, 'sws')], ['IGST', sum(its, 'igst')],
    ['Health Cess', sum(its, 'health')], ['Anti-Dumping Duty', sum(its, 'add')], ['Other Duty', sum(its, 'other')], ['TOTAL DUTY (estimate)', sum(its, 'total')]];
  XLSX.utils.book_append_sheet(wb, sheet(XLSX, da), 'Duty Summary');

  // 6. Supporting documents
  const docs = esanchitDocs || [];
  if (docs.length) XLSX.utils.book_append_sheet(wb, sheet(XLSX, [['#', 'Doc Code', 'IRN', 'DRN', 'File', 'Issued By', 'Issue Date', 'Expiry'], ...docs.map((d, i) => [i + 1, String(d.docCode || ''), d.irn || '', d.drn || '', d.fileName || '', d.issuerName || '', dmy(d.issueDate), dmy(d.expiryDate)])]), 'Supporting Docs');
  return wb;
}
