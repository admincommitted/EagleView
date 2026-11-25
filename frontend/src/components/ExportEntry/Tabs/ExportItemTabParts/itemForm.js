import { asList, withItemLists } from '@/utils/asList';
import { detailMissing } from './itemDetailWindows';

export const BLANK_ITEM_FORM = {
  invSr: 1, itemSr: 1, scheme: '', ritc: '', desc: '', chkDesc: '', qty: '', unit: '', per: '1', rate: '', rateUnit: '', totalFc: '',
  pmvOption: 'Percentage', pmvPer: '', pmv: '', totalPmv: '', itemFob: '',
  endUse: '', igstPayStatus: 'Select', taxableValue: '', igstRate: '', igstAmt: '',
  rodtep: 'N', swInfo: 'N', swStatement: 'N', suppDocs: 'N', reExport: 'N', manfDetails: 'N',
  sourceState: '', stateCode: '', hawb: '', totalPkgs: '', swConst: 'N', swProd: 'N', swCtrl: 'N',
  accessory: 'N', cess: 'N', thirdParty: 'N', ar4: 'N', reward: 'N', addInTemplate: false, addInMiddle: '', copyLicence: '',
};

const SWITCHES_WITH_DETAILS = ['manf', 'cess', 'thirdParty', 'accessory', 'swConst', 'swProd', 'swCtrl'];

export const invoiceSerialOf = (item) => parseInt(item.invSr, 10) || 1;

// the form after Save / Clear: the origin (state / district) stays for the next item
export const clearedItemForm = (invSr, itemSr, previous) => ({
  ...BLANK_ITEM_FORM, invSr, itemSr,
  sourceState: previous.sourceState || '', stateCode: previous.stateCode || '', districtCode: previous.districtCode || '', eSanchitList: [],
});

// the form of Add Item
export const newItemForm = (invSr, itemSr) => ({
  ...BLANK_ITEM_FORM, invSr, itemSr, eSanchitList: [],
  unit: 'NOS', rateUnit: 'NOS', pmvPer: '110', taxableValue: '0', igstRate: '0', igstAmt: '0',
});

// the list keeps both the screen names and the names the SB builder / grid read
export const buildItemRow = (form) => ({
  ...form, ritc: String(form.ritc || '').replace(/\D/g, ''), uqc: form.unit, price: form.rate, total: form.totalFc,
  pmvType: form.pmvOption === 'Percentage' ? '%' : 'M', unitPmv: form.pmv, totalPmv: form.totalPmv,
  suppDocs: asList(form.eSanchitList).length ? 'Y' : (form.suppDocs || 'N'),
});

// serial 1, 2, 3 ... inside each invoice
export function renumberItems(list) {
  const countPerInvoice = {};
  return list.map((item) => {
    const serial = invoiceSerialOf(item);
    countPerInvoice[serial] = (countPerInvoice[serial] || 0) + 1;
    return { ...item, itemSr: countPerInvoice[serial] };
  });
}

// what an item needs before Save / Modify (ICEGATE: RITC 8 digits, description, qty, UQC, unit price ...)
export function missingItemFields(form, exportData) {
  const missing = [];
  const ritc = String(form.ritc || '').replace(/\D/g, '');
  if (!String(form.scheme || '').trim()) missing.push('Scheme code');
  if (ritc.length !== 8) missing.push('RITC (8 digits)');
  if (!String(form.desc || '').trim()) missing.push('Description');
  if (!(parseFloat(form.qty) > 0)) missing.push('Quantity');
  if (!String(form.unit || '').trim()) missing.push('Qty unit (UQC)');
  if (!(parseFloat(form.rate) > 0)) missing.push('Rate');
  if (/\(P\)/.test(String(form.igstPayStatus || '')) && !(parseFloat(form.taxableValue) > 0 && parseFloat(form.igstAmt) > 0)) missing.push('Taxable value and IGST amount (IGST paid)');
  if (!form.igstPayStatus || form.igstPayStatus === 'Select') missing.push('IGST Pay Status');
  if (!String(form.endUse || '').trim()) missing.push('End Use (e.g. GNX100)');
  // SW info ORC / STO and ORC / DOO (state and district of origin) go with every item
  if (!String(form.stateCode || '').trim()) missing.push('Source State');
  if (!String(form.districtCode || '').trim()) missing.push('District of origin');
  if (!(parseFloat(form.per) > 0)) missing.push('Per (more than 0)');
  if (!(exportData?.invoices || []).length) missing.push('an invoice (Invoices tab)');
  SWITCHES_WITH_DETAILS.forEach((key) => {
    const detail = detailMissing(key, form);
    if (detail) missing.push(detail);
  });
  return missing;
}

const isOriginRow = (row, qualifier) => String(row.infoType || '').toUpperCase() === 'ORC' && String(row.infoQualifier || '').toUpperCase() === qualifier;

// an item opened in the form. An item read from a file has its state / district of origin only in the SB's SW info
// rows (ORC / STO, ORC / DOO); the form keeps them on the item. The form uses rate / unit, the list price / uqc.
export function formFromItem(listItem, exportData, states) {
  const item = withItemLists(listItem);
  const invoiceSerial = String(item.invSr || 1);
  const itemSerial = String(item.itemSr || '');
  const infoRows = asList(exportData?._infoTypes);
  const originCode = (qualifier) => {
    const ownRow = infoRows.find((row) => isOriginRow(row, qualifier) && String(row.invoiceSerialNumber || 1) === invoiceSerial && String(row.itemSerialNumber || '') === itemSerial);
    const jobRow = infoRows.find((row) => isOriginRow(row, qualifier) && String(row.itemSerialNumber || '0') === '0');
    return String((ownRow || jobRow || {}).infoCode || '').trim();
  };
  const stateCode = item.stateCode || originCode('STO') || String(exportData?.stateOriginCode || '').trim();
  const districtCode = item.districtCode || originCode('DOO');
  const state = stateCode && (states || []).find((row) => String(parseInt(row.taxCode, 10)) === String(parseInt(stateCode, 10)));
  return {
    ...item,
    rate: item.rate ?? item.price ?? '', unit: item.unit || item.uqc || '', rateUnit: item.rateUnit || item.unit || item.uqc || '', per: item.per || '1',
    pmvOption: item.pmvOption || (item.pmvType === 'M' ? 'Manual' : 'Percentage'), pmv: item.unitPmv ?? item.pmv ?? '',
    invSr: parseInt(item.invSr, 10) || 1, eSanchitList: asList(item.eSanchitList),
    stateCode: stateCode ? String(stateCode).padStart(2, '0') : '', districtCode: districtCode || '', sourceState: item.sourceState || (state ? state.stateName : ''),
  };
}
