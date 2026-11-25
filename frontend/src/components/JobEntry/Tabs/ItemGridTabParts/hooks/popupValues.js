import toast from 'react-hot-toast';

// Popup data comes back from the database as text after a reload: read it as a list / object
export const parseJson = (value, fallback) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const asListOrNull = (value) => {
  const parsed = parseJson(value, null);
  return Array.isArray(parsed) ? parsed : null;
};

export const asList = (value) => asListOrNull(value) || [];

export const asObject = (value, defaults) => {
  const parsed = parseJson(value, null);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...defaults, ...parsed } : { ...defaults };
};

export const asObjectOrNull = (value) => parseJson(value, null);

const hasText = (value) => String(value ?? '').trim() !== '';

// The popup's own object, else the older key it was saved under
export const filledOr = (primary, fallback) => (primary && Object.keys(asObject(primary, {})).length ? primary : fallback);

// An item read from an ICEGATE / other-ERP file carries the popup values as FLAT ICEGATE keys (svbReferenceNumber,
// previousBeNo ...). The builder files them, so the popup opens with those values when its own object is empty.
const flatValues = (item, keyMap) => Object.fromEntries(
  Object.entries(keyMap)
    .filter(([, source]) => item && item[source] !== undefined && item[source] !== null && hasText(item[source]))
    .map(([key, source]) => [key, String(item[source])])
);

export const popupValues = (item, own, defaults, keyMap) => {
  const values = asObject(own, {});
  return Object.keys(values).some((key) => hasText(values[key])) ? { ...defaults, ...values } : { ...defaults, ...flatValues(item, keyMap) };
};

// Saving a popup blanks the flat keys of the same thing, so the builder files the popup (and a cleared popup clears the file)
const blankKeys = (...keys) => Object.fromEntries(keys.map((key) => [key, '']));

export const FLAT_KEYS_BLANK = {
  cvd: blankKeys('cvdNotificationNo', 'cvdSrNo'),
  svb: blankKeys('svbReferenceNumber', 'svbReferenceDate', 'svbLoadAssessableValue', 'svbLoadOnDuty', 'whetherLoadProvisionalOnAssessableValue', 'whetherLoadProvisionalOnDuty', 'customHouseCodeWhichHasImposedLoad'),
  antiDumping: blankKeys('antiDumpingDutyNotification', 'antiDumpingDutySerialNumber', 'cthSerialNumber', 'supplierSerialNumber', 'quantityAsPerAntiDumpingNotn'),
  policyPara: blankKeys('policyParaNo', 'policyYear'),
  ncd: blankKeys('ncdNotn', 'ncdNotnSrNo'),
  previousBe: blankKeys('previousBeNo', 'previousBeDate', 'prevUnitPriceInvoiced', 'prevCurrencyCode', 'prevCustomSite'),
};

export const hasAnyValue = (values) => !!values && Object.entries(values).some(([key, value]) => !['flag', 'type', 'id'].includes(key) && hasText(value));

export const patchItem = (items, itemId, patch) => items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));

export const noItemSelected = (selectedRowId) => {
  if (selectedRowId) return false;
  toast('Select an item first');
  return true;
};
