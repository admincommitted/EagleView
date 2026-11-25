// Excel template and upload of the Scheme tab (Dbk, License, AR4). Sheet rows are matched to the rows of the tab by
// INV NO + ITEM NO only; a row with other numbers is reported as not found.
import { invOf, itemNoOf, toIsoDate, num, dbkAmount, itemFobInr, flagOn } from './schemeUtils';

export const EXCEL_TABS = ['dbk', 'license', 'ar4'];

const pick = (sheetRow, ...keys) => {
  const key = keys.find((name) => sheetRow[name] !== undefined && sheetRow[name] !== '');
  return key === undefined ? undefined : sheetRow[key];
};
const trimmed = (value) => (value === undefined ? undefined : String(value).trim());
const keyOfSheetRow = (sheetRow) => ({
  inv: String(pick(sheetRow, 'INV NO', 'Inv No', 'invNo', 'INV') ?? '').trim(),
  itm: String(pick(sheetRow, 'ITEM NO', 'Item No', 'itemNo', 'ITEM') ?? '').trim(),
});
const notFoundText = ({ inv, itm }) => `${inv || '?'}/${itm || '?'}`;
const definedOnly = (values) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));

export function templateOf(tab, { dbkItems, licenseItems, ar4Rows }) {
  if (tab === 'dbk') {
    return {
      fileName: 'DBK_Template.xlsx',
      rows: (dbkItems || []).map((row) => ({
        'INV NO': row.invNo, 'ITEM NO': row.itemNo, 'DBK No': row.dbkNo || '', 'DBK Qty': row.dbkQty || '', 'Acc Unit': row.accUnit || '',
        'DBK Rt Adv': row.dbkRtAdv || '', 'DBK Rt Spe': row.dbkRtSpe || '', 'DBK Cap': row.dbkCap || '', 'DBK Val': row.dbkVal || '', 'DBK Available': row.drawbackAvailable || 'Y',
      })),
    };
  }
  if (tab === 'license') {
    return {
      fileName: 'License_Template.xlsx',
      rows: (licenseItems || []).map((row) => ({
        'INV NO': row.invNo, 'ITEM NO': row.itemNo, 'Reg No': row.regNo || '', 'Reg Dt': row.regDate || '', 'Sn E': row.snE || '', 'Sn C': row.snC || '',
        'Qty': row.qty || '', 'Exp Qty': row.expQty || '', 'UQC': row.uqc || '', 'Ind/Imp': row.indImp || 'M', 'Lic No': row.licNo || '', 'Lic Dt': row.licDt || '', 'Lic Type': row.licType || '',
      })),
    };
  }
  if (tab === 'ar4') {
    return {
      fileName: 'AR4_Template.xlsx',
      rows: ar4Rows.map(({ item, index }) => ({
        'INV NO': invOf(item), 'ITEM NO': itemNoOf(item, index), 'AR4 No': item.ar4No || '', 'AR4 Date': item.ar4Date || '',
        'Commissionerate': item.commissionerate || '', 'Division': item.division || '', 'Range': item.ar4Range || '', 'Remarks': item.ar4Remarks || '',
      })),
    };
  }
  return null;
}

// A DBK Val from the sheet counts as "typed by hand" only when it differs from the value the rates give: the template
// carries the worked-out values, so uploading it again must not freeze every amount.
export function dbkRowsFromSheet(sheetRows, dbkItems, items) {
  const rows = (dbkItems || []).map((row) => ({ ...row }));
  const notFound = [];
  let used = 0;
  sheetRows.forEach((sheetRow) => {
    const key = keyOfSheetRow(sheetRow);
    const target = rows.find((row) => String(row.invNo) === key.inv && String(row.itemNo) === key.itm);
    if (!target) { notFound.push(notFoundText(key)); return; }
    const before = { ...target };
    const values = {
      dbkNo: trimmed(pick(sheetRow, 'DBK No', 'DBK NO', 'dbkNo')), dbkQty: trimmed(pick(sheetRow, 'DBK Qty', 'dbkQty', 'QTY')), accUnit: trimmed(pick(sheetRow, 'Acc Unit', 'accUnit', 'UQC')),
      dbkRtAdv: trimmed(pick(sheetRow, 'DBK Rt Adv', 'dbkRtAdv')), dbkRtSpe: trimmed(pick(sheetRow, 'DBK Rt Spe', 'dbkRtSpe')), dbkCap: trimmed(pick(sheetRow, 'DBK Cap', 'dbkCap')),
      dbkVal: trimmed(pick(sheetRow, 'DBK Val', 'dbkVal')), drawbackAvailable: trimmed(pick(sheetRow, 'DBK Available', 'drawbackAvailable')),
    };
    Object.entries(definedOnly(values)).forEach(([field, value]) => {
      target[field] = field === 'drawbackAvailable' ? (/^N/i.test(value) ? 'N' : 'Y') : value;
    });
    // a new DBK No without rates takes the rates of the schedule master
    if (values.dbkNo !== undefined && values.dbkRtAdv === undefined && values.dbkRtSpe === undefined) Object.assign(target, { dbkRtAdv: '', dbkRtSpe: '', dbkCap: '' });
    const item = (items || []).find((other, index) => invOf(other) === String(target.invNo) && itemNoOf(other, index) === String(target.itemNo));
    if (values.dbkQty !== undefined && item) target.dbkQtyAuto = num(target.dbkQty) === num(item.qty || item.quantity);
    const haveRate = num(target.dbkRtAdv) > 0 || num(target.dbkRtSpe) > 0;
    const worked = haveRate && item ? dbkAmount({ fob: itemFobInr(item), qty: target.dbkQty, rateAdv: target.dbkRtAdv, rateSpe: target.dbkRtSpe, cap: target.dbkCap }) : null;
    const typedValue = values.dbkVal !== undefined && String(values.dbkVal).trim() !== '';
    const sameAsBefore = typedValue && String(before.dbkVal ?? '').trim() !== '' && Math.abs(num(values.dbkVal) - num(before.dbkVal)) < 0.01;
    const sameAsWorked = typedValue && worked !== null && Math.abs(num(values.dbkVal) - worked) < 0.01;
    target.valManual = typedValue && (sameAsBefore ? flagOn(before.valManual) : !sameAsWorked);
    if (!target.valManual && haveRate && item) target.dbkVal = worked === null ? '' : worked.toFixed(2);
    used++;
  });
  return { rows, used, notFound };
}

// an item with several licence rows: each sheet row fills the next row of that item not filled from the sheet yet
export function licenceRowsFromSheet(sheetRows, licenseItems) {
  const rows = (licenseItems || []).map((row) => ({ ...row }));
  const filled = new Set();
  const notFound = [];
  let used = 0;
  sheetRows.forEach((sheetRow) => {
    const key = keyOfSheetRow(sheetRow);
    const isSameItem = (row) => String(row.invNo) === key.inv && String(row.itemNo) === key.itm;
    const target = rows.find((row) => isSameItem(row) && !filled.has(row)) || rows.find(isSameItem);
    if (!target) { notFound.push(notFoundText(key)); return; }
    filled.add(target);
    const values = {
      regNo: trimmed(pick(sheetRow, 'Reg No', 'regNo')), regDate: pick(sheetRow, 'Reg Dt', 'regDate', 'Reg Date'), snE: trimmed(pick(sheetRow, 'Sn E', 'snE')), snC: trimmed(pick(sheetRow, 'Sn C', 'snC')),
      qty: trimmed(pick(sheetRow, 'Qty', 'qty')), expQty: trimmed(pick(sheetRow, 'Exp Qty', 'expQty')), uqc: trimmed(pick(sheetRow, 'UQC', 'uqc')), indImp: trimmed(pick(sheetRow, 'Ind/Imp', 'indImp')),
      licNo: trimmed(pick(sheetRow, 'Lic No', 'licNo', 'License No')), licDt: pick(sheetRow, 'Lic Dt', 'licDt', 'License Date'), licType: trimmed(pick(sheetRow, 'Lic Type', 'licType')),
    };
    if (values.regDate !== undefined) values.regDate = toIsoDate(values.regDate);
    if (values.licDt !== undefined) values.licDt = toIsoDate(values.licDt);
    Object.assign(target, definedOnly(values));
    used++;
  });
  return { rows, used, notFound };
}

export function ar4PatchesFromSheet(sheetRows, ar4Rows) {
  const itemIdByKey = new Map(ar4Rows.map(({ item, index }) => [invOf(item) + '/' + itemNoOf(item, index), item.id]));
  const patches = new Map();
  const notFound = [];
  let used = 0;
  sheetRows.forEach((sheetRow) => {
    const key = keyOfSheetRow(sheetRow);
    const itemId = itemIdByKey.get(key.inv + '/' + key.itm);
    if (itemId === undefined) { notFound.push(notFoundText(key)); return; }
    const values = {
      ar4No: trimmed(pick(sheetRow, 'AR4 No', 'ar4No')), ar4Date: pick(sheetRow, 'AR4 Date', 'ar4Date'), commissionerate: trimmed(pick(sheetRow, 'Commissionerate', 'commissionerate')),
      division: trimmed(pick(sheetRow, 'Division', 'division')), ar4Range: trimmed(pick(sheetRow, 'Range', 'ar4Range')), ar4Remarks: trimmed(pick(sheetRow, 'Remarks', 'ar4Remarks')),
    };
    if (values.ar4Date !== undefined) values.ar4Date = toIsoDate(values.ar4Date);
    patches.set(itemId, definedOnly(values));
    used++;
  });
  return { patches, used, notFound };
}
