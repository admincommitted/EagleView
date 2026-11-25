import { asList } from '@/utils/asList';

// Detail windows of the Y/N switches of an item. They fill the ICEGATE tables cessModel, thirdPartyModel,
// itemAccessModel, constituentFinal, production and controlType. Field lengths follow the SB CACHE01 schema v1.2.
export const DETAIL_WINDOWS = {
  manf: {
    title: 'Manufacturer / Producer / Grower', flag: 'manfDetails', kind: 'form', columns: 4,
    hint: 'Goods not made by the exporter: the maker of this item (ICEGATE item manufacturer fields).',
    fields: [
      { key: 'manfProdName', label: 'Name (for checklist)', max: 70, span: 2 },
      { key: 'manfProdCdType', label: 'Code type *', max: 1, required: true, upper: true, placeholder: 'e.g. G', title: 'Manufacturer code type (1 character, as per the ICEGATE code list)' },
      { key: 'manfProdCode', label: 'Code *', max: 17, required: true, upper: true, placeholder: 'GSTIN / PAN / IEC' },
      { key: 'manfProdAddress1', label: 'Address 1 *', max: 70, required: true, span: 2 },
      { key: 'manfProdAddress2', label: 'Address 2', max: 35, span: 2 },
      { key: 'manfProdCity', label: 'City *', max: 35, required: true },
      { key: 'manfProdSubDiv', label: 'State / subdivision', max: 35 },
      { key: 'manfProdPin', label: 'PIN', max: 10 },
      { key: 'manfProdCountry', label: 'Country (2 letters) *', max: 2, required: true, upper: true, pattern: /^[A-Z]{2}$/, placeholder: 'IN' },
      { key: 'transitCountry', label: 'Transit country (2 letters)', max: 2, upper: true, pattern: /^[A-Z]{2}$/ },
    ],
  },
  thirdParty: {
    title: 'Third Party Exporter', flag: 'thirdParty', kind: 'form', columns: 4,
    hint: 'Item exported on behalf of another exporter (ICEGATE THIRD PARTY table).',
    fields: [
      { key: 'tpExpIec', label: 'IEC *', max: 10, required: true, upper: true, pattern: /^[A-Z0-9]{10}$/ },
      { key: 'tpExpBranch', label: 'Branch Sr No *', max: 3, required: true, digits: true },
      { key: 'tpExpName', label: 'Exporter name *', max: 50, required: true, upper: true, span: 2 },
      { key: 'tpExpAddress1', label: 'Address 1 *', max: 50, required: true, upper: true, span: 2 },
      { key: 'tpExpAddress2', label: 'Address 2', max: 35, upper: true, span: 2 },
      { key: 'tpExpCity', label: 'City *', max: 35, required: true, upper: true },
      { key: 'tpExpPin', label: 'PIN *', max: 6, required: true, digits: true, pattern: /^[1-9][0-9]{5}$/ },
      {
        key: 'tpExpGstnType', label: 'GSTN type *', required: true,
        options: [['GSN', 'GSN - GSTIN'], ['GSG', 'GSG - GST Govt'], ['GSD', 'GSD - GST Diplomat'], ['PAN', 'PAN'], ['TAN', 'TAN'], ['PSP', 'PSP - Passport'], ['ADH', 'ADH - Aadhaar']],
      },
      { key: 'tpExpGstnId', label: 'GSTN id *', max: 20, required: true, upper: true },
      { key: 'tpExpValue', label: 'Value of third party (Y/N)', yesNo: true },
    ],
  },
  accessory: {
    title: 'Accessories', flag: 'accessory', kind: 'form', columns: 4,
    hint: 'Accessories sent with this item.',
    fields: [
      { key: 'accessoryStatus', label: 'Accessory status *', required: true, options: [['1', '1 - Included in the item price'], ['2', '2 - Invoiced separately']] },
      { key: 'accessoryValue', label: 'Accessories have value (Y/N)', yesNo: true },
      { key: 'accessoryDesc', label: 'Description of accessories *', max: 500, required: true, span: 4, area: true },
    ],
  },
  cess: {
    title: 'Export Cess', flag: 'cess', kind: 'grid', rowsKey: 'cessRows', maxRows: 99,
    hint: 'Cess act code and quantity for each cess on this item (ICEGATE CESS table).',
    fields: [
      { key: 'cessActCode', label: 'Cess act code *', max: 10, required: true, upper: true, width: 160 },
      { key: 'quantity', label: 'Quantity *', number: true, required: true, width: 120 },
      { key: 'itemCessValue', label: 'Cess on value (Y/N)', yesNo: true, width: 140 },
    ],
  },
  swConst: {
    title: 'SW Constituents', flag: 'swConst', kind: 'grid', rowsKey: 'constRows', maxRows: 99,
    hint: 'Constituents of the item (single window: chemicals, food, drugs).',
    fields: [
      { key: 'name', label: 'Element name *', max: 256, required: true, width: 220 },
      { key: 'code', label: 'Element code', max: 17, upper: true, width: 120 },
      { key: 'pct', label: 'Percentage *', number: true, required: true, width: 100 },
      { key: 'yieldPct', label: 'Yield %', number: true, width: 90 },
      { key: 'active', label: 'Active ingredient', yesNo: true, width: 120 },
    ],
  },
  swProd: {
    title: 'SW Production Batches', flag: 'swProd', kind: 'grid', rowsKey: 'prodRows', maxRows: 99,
    hint: 'Production batch details (single window: food, drugs, cosmetics).',
    fields: [
      { key: 'batch', label: 'Batch id *', max: 17, required: true, upper: true, width: 140 },
      { key: 'qty', label: 'Batch qty *', number: true, required: true, width: 100 },
      { key: 'uqc', label: 'UQC *', max: 3, required: true, upper: true, width: 70 },
      { key: 'mfgDate', label: 'Mfg date *', date: true, required: true, width: 130 },
      { key: 'expDate', label: 'Expiry date', date: true, width: 130 },
      { key: 'bestBefore', label: 'Best before', date: true, width: 130 },
    ],
  },
  swCtrl: {
    title: 'SW Control', flag: 'swCtrl', kind: 'grid', rowsKey: 'ctrlRows', maxRows: 99,
    hint: 'Controls / tests done on the item (single window).',
    fields: [
      { key: 'typeCode', label: 'Control type code *', max: 17, required: true, upper: true, width: 140 },
      { key: 'location', label: 'Location', max: 17, upper: true, width: 120 },
      { key: 'startDate', label: 'Start date', date: true, width: 130 },
      { key: 'endDate', label: 'End date', date: true, width: 130 },
      { key: 'resultCode', label: 'Result code', max: 17, upper: true, width: 110 },
      { key: 'remarks', label: 'Remarks', max: 4000, width: 220 },
    ],
  },
};

export const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';
const plainLabel = (field) => field.label.replace(' *', '');

export function fieldError(field, value) {
  if (isBlank(value)) return field.required ? `${plainLabel(field)} is mandatory` : '';
  if (field.pattern && !field.pattern.test(String(value).trim().toUpperCase())) return `${plainLabel(field)} is not valid`;
  if (field.number && !(parseFloat(value) > 0)) return `${plainLabel(field)} must be more than 0`;
  return '';
}

// count of filled details (shown on the switch)
export function detailCount(key, formData) {
  const detail = DETAIL_WINDOWS[key];
  if (!detail) return 0;
  if (detail.kind === 'grid') return asList(formData[detail.rowsKey]).length;
  return detail.fields.some((field) => field.required && !isBlank(formData[field.key])) ? 1 : 0;
}

// what is missing for a switch set to Y (checked when the item is saved)
export function detailMissing(key, formData) {
  const detail = DETAIL_WINDOWS[key];
  if (!detail || String(formData[detail.flag] || 'N').toUpperCase() !== 'Y') return '';
  if (detail.kind === 'grid') {
    const rows = asList(formData[detail.rowsKey]);
    if (!rows.length) return `${detail.title}: add at least one row`;
    return rows.some((row) => detail.fields.some((field) => fieldError(field, row[field.key]))) ? `${detail.title}: complete the rows` : '';
  }
  return detail.fields.some((field) => fieldError(field, formData[field.key])) ? `${detail.title}: fill the details` : '';
}
