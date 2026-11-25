import { newRowId } from './screenRowId';

const IMPORTER_FIELDS = [['autoField_4', 'nameOfImporter'], ['autoField_5', 'iecCode'], ['autoField_6', 'address1'], ['autoField_7', 'address2'],
  ['autoField_8', 'city'], ['autoField_9', 'state'], ['autoField_10', 'pin'], ['autoField_48', 'branchSrNo'], ['autoField_49', 'aeoCode']];
const IMPORTER_EXTRA_FIELDS = ['autoField_11', 'autoField_12', 'autoField_13', 'autoField_50', 'importerPartyId'];
// an ex-bond repeats these from its warehouse BE
const REPEATED_FROM_WAREHOUSE_BE = ['countryOfOrigin', 'countryOfOriginName', 'autoField_20', 'portOfOrigin', 'portOfOriginName', 'autoField_22',
  'portOfShipment', 'portOfShipmentName', 'autoField_23', 'countryOfConsignment', 'countryOfConsignmentName', 'autoField_21', 'importerType',
  'autoField_53', 'govtPrivate', 'importerClass', 'beClass', 'pkg', 'grossWtUnit'];
const FLAGS_WITH_ROWS = [['bond', '_bondRows'], ['certificate', '_certRows'], ['highSeaSaleFlag', '_hssRows']];

const toNumber = (value) => {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
};

const isGiven = (value) => value !== undefined && value !== null && String(value).trim() !== '';
const givenOnly = (key, value) => (isGiven(value) ? { [key]: value } : {});

function rowsOf(value) {
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const warehouseItemKey = (item) => `${String(item.invSrNo || '1').trim()}/${String(item.itemSrNo || item.itemNo || '').trim()}`;

// The warehouse balance (WH qty - qty cleared by filed ex-bonds) read again for the ex-bond on the screen.
export function applyWarehouseBalances(items, { whQty = {}, byKey = {} }) {
  let refreshed = 0;
  const overBalance = [];
  const next = items.map((item) => {
    const key = warehouseItemKey(item);
    if (!(key in whQty)) return item;
    const counts = byKey[key] || {};
    const original = toNumber(whQty[key]);
    const cleared = toNumber(counts.cleared);
    const draft = toNumber(counts.draft);
    const balance = Math.max(0, +(original - cleared).toFixed(6));
    if (toNumber(item.qty || item.quantity) > balance + 1e-6) overBalance.push(String(item.itemSrNo || ''));
    const unchanged = item._whBalanceQty !== undefined && toNumber(item._whBalanceQty) === balance && toNumber(item._whClearedQty) === cleared
      && toNumber(item._whDraftQty) === draft && toNumber(item._whOriginalQty) === original;
    if (unchanged) return item;
    refreshed++;
    return { ...item, _whOriginalQty: original, _whClearedQty: cleared, _whDraftQty: draft, _whBalanceQty: balance };
  });
  return { items: refreshed ? next : items, refreshed, overBalance };
}

// the value follows the balance quantity (value = qty x unit price), else Save refuses the item
function valueForBalance(item, balance) {
  const unitPrice = parseFloat(String(item.price ?? item.unitPrice ?? '').replace(/,/g, ''));
  const warehouseQty = parseFloat(item.quantity || item.qty) || 0;
  if (!(unitPrice > 0) || !(balance > 0) || Math.abs(balance - warehouseQty) < 1e-9) return null;
  const value = (balance * unitPrice).toFixed(2);
  return { value, assessableValue: value };
}

// Every ex-bond item of a Sec 65 warehouse carries a SEC65 control row: warehouse code, the item's CTH and the
// W BE item no. The dates and result code are typed on one item and copied with "Apply to All Items".
function sec65Control(item, warehouseCode) {
  const controlRows = rowsOf(item.swCtrlData);
  if (controlRows.length || !String(warehouseCode || '').trim()) return null;
  return {
    swCtrlData: [{ id: newRowId(), typeCode: 'SEC65', location: String(warehouseCode).trim().toUpperCase(), startDate: '', endDate: '', resultCode: '',
      resultText: String(item.cth || item.ritc || '').trim(), slNo: String(item.itemSrNo || item.itemNo || '').trim() }],
    swControlFlag: 'Y',
  };
}

// The warehouse BE's invoices / items with the quantity still in the warehouse; fully cleared items are left out.
export function exBondCopyOf(warehouseBe, warehouseCode) {
  const invoices = [];
  const items = [];
  let fullyCleared = 0;
  (warehouseBe.invoices || []).forEach((invoice, index) => {
    const invoiceItems = (invoice.items || [])
      .map((item) => {
        const balance = item._whBalanceQty !== undefined ? item._whBalanceQty : (parseFloat(item.quantity || item.qty) || 0);
        return {
          ...item, id: newRowId(), importInvoiceId: undefined, invSrNo: String(item.invSrNo || index + 1),
          _whOriginalQty: item.quantity || item.qty, _whClearedQty: item._whClearedQty || 0, _whBalanceQty: balance,
          _whOriginalValue: item.value || item.assessableValue, qty: String(balance), quantity: String(balance),
          ...valueForBalance(item, balance),
          ...sec65Control(item, warehouseCode),
        };
      })
      .filter((item) => {
        if (parseFloat(item._whBalanceQty) > 0) return true;
        fullyCleared++;
        return false;
      });
    invoices.push({ ...invoice, id: undefined, importJobId: undefined, items: invoiceItems });
    items.push(...invoiceItems);
  });
  return { invoices, items, fullyCleared };
}

export const sec65RowsToFill = (items) =>
  items.filter((item) => (item.swCtrlData || []).some?.((row) => row.typeCode === 'SEC65' && !row.resultCode)).length;

// The job after linking a WH BE: importer and repeated boxes only where still empty (a Y/N flag counts as empty while
// it is N), the WH BE No / Date / code, and the balance invoices when they are copied.
export function withWarehouseHeader(job, warehouseBe, warehouseJob, copiedInvoices) {
  const isBlank = (key) => !String(job[key] || '').trim();
  const filled = {};
  IMPORTER_FIELDS.forEach(([autoField, name]) => {
    const value = warehouseBe[autoField] || warehouseBe[name];
    if (isBlank(autoField) && value) {
      filled[autoField] = value;
      filled[name] = value;
    }
  });
  IMPORTER_EXTRA_FIELDS.forEach((key) => { if (isBlank(key) && warehouseBe[key]) filled[key] = warehouseBe[key]; });
  REPEATED_FROM_WAREHOUSE_BE.forEach((key) => { if (isBlank(key) && isGiven(warehouseBe[key])) filled[key] = warehouseBe[key]; });
  FLAGS_WITH_ROWS.forEach(([flag, rowsKey]) => {
    const warehouseHasFlag = String(warehouseBe[flag] || '').toUpperCase() === 'Y';
    const jobHasFlag = String(job[flag] || 'N').toUpperCase() === 'Y';
    if (warehouseHasFlag && !jobHasFlag && !rowsOf(job[rowsKey]).length) {
      filled[flag] = 'Y';
      if (rowsOf(warehouseBe[rowsKey]).length) filled[rowsKey] = warehouseBe[rowsKey];
    }
  });

  const port = warehouseJob.customsPort || warehouseBe.portCode || warehouseBe.autoField_2;
  const warehouseCode = warehouseJob.warehouseCode || warehouseBe.warehouseCode;
  const warehouseBeNo = warehouseJob.beNo || warehouseBe.beNo;
  const warehouseBeDate = warehouseJob.beDate || warehouseBe.beDate;
  // linking a DIFFERENT WH job replaces its BE No / Date / code, so the ex-bond is never filed against the old WH BE
  const isRelink = String(job.inBondJobId || '') && String(job.inBondJobId) !== String(warehouseJob.id);
  const warehouseFields = isRelink
    ? { warehouseCode: warehouseCode || '', warehouseBENo: warehouseBeNo || '', warehouseBEDate: warehouseBeDate || '', warehouseCustomSiteId: port || '' }
    : { ...givenOnly('warehouseCode', warehouseCode), ...givenOnly('warehouseBENo', warehouseBeNo), ...givenOnly('warehouseBEDate', warehouseBeDate), ...givenOnly('warehouseCustomSiteId', port) };

  const locationName = warehouseBe.locationName || warehouseBe.autoField_1;
  const portFields = isBlank('portCode') && port
    ? { portCode: port, autoField_2: port, ...(locationName ? { locationName, autoField_1: locationName } : {}) }
    : {};

  return {
    ...job,
    ...filled,
    _inBondJobId: warehouseJob.id,
    inBondJobId: warehouseJob.id,
    inBondJobNo: warehouseJob.jobNo || warehouseBe.jobNo || '',
    ...warehouseFields,
    ...portFields,
    ...(copiedInvoices ? { invoices: copiedInvoices, _importedItems: null, _importedFinalDocs: null } : {}),
  };
}
