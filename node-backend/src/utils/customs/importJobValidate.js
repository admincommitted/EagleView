// Save-time checks for an import job. An Excel / JSON import, a copy, or a typo could otherwise put impossible data
// into the database (a BE date before the IGM date, a negative quantity, "12,000" as a number, an item under invoice 7
// of a 2-invoice job...). Nothing here asks for a field to be FILLED - a draft may be incomplete; that is the ICEGATE
// validator's job before filing. This refuses values that cannot be right, and normalises the harmless ones (commas in
// numbers, spaces, letter case of codes).
const DATE_KEYS_JOB = [
  'jobDate',
  'beDate',
  'assessmentDate',
  'dutyPaidDate',
  'oocDate',
  'igmDate',
  'inwardDate',
  'mawbDate',
  'hawbDate',
  'gatewayIgmDate',
  'autoField_14',
  'autoField_15',
  'autoField_16',
  'autoField_17',
  'warehouseBEDate',
  'autoField_31',
];
const DATE_KEYS_INV = [
  'invDate',
  'invoiceDate',
  'poDate',
  'purchaseOrderDate',
  'contractDate',
  'lcDate',
  'svbReferenceDate',
];
const NUM_KEYS_JOB = ['totalPkg', 'grossWt', 'itemTotal', 'invTotal', 'totalDuty', 'cifTotalInr'];
const NUM_KEYS_INV = [
  'value',
  'invValue',
  'invoiceValue',
  'landingRate',
  'freightValue',
  'freightRate',
  'insuranceValue',
  'insuranceRate',
  'miscCharges',
  'miscChargesRate',
  'loadingAmount',
  'loadingRate',
  'agencyCommAmount',
  'agencyCommRate',
  'discountAmount',
  'discountRate',
  'exRate',
  'exchangeRate',
  'hssLoadRate',
  'hssLoadAmount',
];
const NUM_KEYS_ITEM = [
  'qty',
  'quantity',
  'price',
  'unitPrice',
  'value',
  'assessableValue',
  'bcdRate',
  'bcdAmount',
  'swsRate',
  'swsAmount',
  'healthCessRate',
  'healthCessAmount',
  'cvdRate',
  'cvdAmount',
  'adlCvdRate',
  'adlCvdAmount',
  'saptaRate',
  'saptaAmount',
  'sqcQty',
  'assessableValueInr',
  'totalDuty',
];
const JOB_DATES_NOT_IN_FUTURE = [
  'beDate',
  'assessmentDate',
  'dutyPaidDate',
  'oocDate',
  'igmDate',
  'inwardDate',
  'mawbDate',
  'hawbDate',
  'gatewayIgmDate',
];
const JOB_YES_NO_FLAGS = ['kachchaBE', 'highSeaSaleFlag', 'greenChannel', 'section48Requested', 'firstCheckRequested'];
const ITEM_RATE_KEYS = ['bcdRate', 'swsRate', 'healthCessRate', 'cvdRate', 'adlCvdRate', 'saptaRate'];
const MAX_DUTY_RATE_PERCENT = 1000;
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const DAY_MS = 86400000;

// Some values live under two keys: the screen box and an older column / ICEGATE-named key that the JSON builder
// and a few screens fall back to. The box wins: when the box key is in the payload, the shadow takes its value
// (a cleared box clears the shadow), so a stale GSTIN / CTX type / MAWB / port cannot be filed.
const SHADOW_JOB = {
  autoField_50: 'commercialTaxType',
  autoField_13: 'commercialTaxRegistrationNo',
  autoField_11: 'ctxStateName',
  autoField_12: 'stateCode',
  mawbNo: 'mawbblNo',
  hawbNo: 'hawbhblNo',
  igmNumber: 'igmNo',
  portCode: 'autoField_2',
};
// fill-only shadows (older rows may hold the value only under the shadow key; never cleared from a blank box)
const FILL_JOB = {
  autoField_4: 'nameOfImporter',
  autoField_5: 'iecCode',
  autoField_6: 'address1',
  autoField_7: 'address2',
  autoField_8: 'city',
  autoField_9: 'state',
  autoField_10: 'pin',
  autoField_48: 'branchSrNo',
  autoField_49: 'aeoCode',
};
// invoice shadows: the screen writes invNo / invDate / value / currency / terms; file imports also carry the ICEGATE
// names, and the builder reads those first - so the box value is copied over them
const SHADOW_INVOICE = {
  invNo: 'invoiceNo',
  invDate: 'invoiceDate',
  value: 'invoiceValue',
  currency: 'invoiceCurrency',
  terms: 'termsOfInvoice',
};

const hasOwn = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const isBlank = (v) => str(v) === '';

// yyyy-mm-dd, dd-mm-yyyy, dd/mm/yyyy, yyyymmdd, ISO datetime -> yyyy-mm-dd; null when not a real date
function ymd(v) {
  const s = str(v);
  if (!s) return '';
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s);
  let y, mo, d;
  if (m) [y, mo, d] = [m[1], m[2], m[3]];
  else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s)))
    [y, mo, d] = [m[3], m[2].padStart(2, '0'), m[1].padStart(2, '0')];
  else if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) [y, mo, d] = [m[1], m[2], m[3]];
  else return null;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +mo - 1 || dt.getUTCDate() !== +d) return null;
  if (+y < MIN_YEAR || +y > MAX_YEAR) return null;
  return `${y}-${mo}-${d}`;
}
const todayIST = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
const plusDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
// "12,000.50" -> 12000.5 ; letters -> NaN
const numOf = (v) => {
  const s = str(v).replace(/,/g, '');
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
};

function createReport() {
  const errors = [],
    warnings = [],
    notes = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  // dates: normalise, refuse impossible ones
  const fixDates = (obj, keys, where) => {
    for (const k of keys) {
      if (isBlank(obj[k])) continue;
      const d = ymd(obj[k]);
      if (d === null) {
        err(where, `${k} "${str(obj[k])}" is not a date`);
        continue;
      }
      if (d !== str(obj[k])) {
        obj[k] = d;
        notes.push(`${where}: ${k} written as ${d}`);
      }
    }
  };
  // numbers: normalise, refuse letters / negatives
  const fixNums = (obj, keys, where) => {
    for (const k of keys) {
      if (isBlank(obj[k])) continue;
      const n = numOf(obj[k]);
      if (Number.isNaN(n)) {
        err(where, `${k} "${str(obj[k])}" is not a number`);
        continue;
      }
      if (n < 0) {
        err(where, `${k} cannot be negative (${n})`);
        continue;
      }
      const clean = str(obj[k]).replace(/,/g, '');
      if (clean !== str(obj[k])) obj[k] = clean;
    }
  };
  return { errors, warnings, notes, err, warn, fixDates, fixNums };
}

function syncJobShadows(p) {
  for (const [box, shadow] of Object.entries(SHADOW_JOB)) if (hasOwn(p, box)) p[shadow] = isBlank(p[box]) ? '' : p[box];
  for (const [box, shadow] of Object.entries(FILL_JOB)) {
    if (!isBlank(p[box])) p[shadow] = p[box];
    else if (!isBlank(p[shadow]) && hasOwn(p, box)) p[box] = p[shadow];
  }
}

function checkJobHeader(p, report) {
  const { err } = report;
  const J = 'Job';
  syncJobShadows(p);
  report.fixDates(p, DATE_KEYS_JOB, J);
  report.fixNums(p, NUM_KEYS_JOB, J);
  const latestAllowedDay = plusDays(todayIST(), 1);
  if (!isBlank(p.jobDate) && ymd(p.jobDate) && ymd(p.jobDate) > latestAllowedDay)
    err(J, `Job date ${p.jobDate} is in the future`);
  if (!isBlank(p.shipmentMode) && !['AIR', 'SEA', 'LAND'].includes(str(p.shipmentMode).toUpperCase()))
    err(J, `Shipment mode "${p.shipmentMode}" must be AIR, SEA or LAND`);
  else if (!isBlank(p.shipmentMode)) p.shipmentMode = str(p.shipmentMode).toUpperCase();
  if (!isBlank(p.boeType) && !['HOME_CONSUMPTION', 'WAREHOUSE', 'EX_BOND'].includes(str(p.boeType).toUpperCase()))
    err(J, `BE type "${p.boeType}" must be HOME_CONSUMPTION, WAREHOUSE or EX_BOND`);
  else if (!isBlank(p.boeType)) p.boeType = str(p.boeType).toUpperCase();
  if (!isBlank(p.autoField_5) && !/^[A-Z0-9]{10}$/i.test(str(p.autoField_5)))
    err(J, `IEC "${str(p.autoField_5)}" must be 10 letters / digits`);
  if (
    !isBlank(p.autoField_13) &&
    /^G$/i.test(str(p.autoField_50)) &&
    !/^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/i.test(str(p.autoField_13))
  )
    err(J, `GSTIN "${str(p.autoField_13)}" is not a valid 15-character GSTIN`);
  if (!isBlank(p.autoField_10) && !/^\d{6}$/.test(str(p.autoField_10)))
    err(J, `Importer PIN "${str(p.autoField_10)}" must be 6 digits`);
  if (!isBlank(p.beNo) && !/^\d{1,7}$/.test(str(p.beNo))) err(J, `BE No "${str(p.beNo)}" must be up to 7 digits`);
  if (!isBlank(p.autoField_48) && !/^\d{1,3}$/.test(str(p.autoField_48)))
    err(J, `Branch Sr No "${str(p.autoField_48)}" must be a number`);
  for (const k of JOB_DATES_NOT_IN_FUTURE)
    if (ymd(p[k]) && ymd(p[k]) > plusDays(todayIST(), 1)) err(J, `${k} ${p[k]} is in the future`);
  const igm = ymd(p.igmDate || p.autoField_14),
    inward = ymd(p.inwardDate || p.autoField_17),
    be = ymd(p.beDate);
  if (igm && inward && inward < igm) err(J, `Inward date ${inward} is before the IGM date ${igm}`);
  if (be && ymd(p.assessmentDate) && ymd(p.assessmentDate) < be) err(J, `Assessment date is before the BE date ${be}`);
  if (be && ymd(p.dutyPaidDate) && ymd(p.dutyPaidDate) < be) err(J, `Duty paid date is before the BE date ${be}`);
  if (be && ymd(p.oocDate) && ymd(p.oocDate) < be) err(J, `Out of charge date is before the BE date ${be}`);
  if (!isBlank(p.totalPkg) && numOf(p.totalPkg) !== null && !Number.isInteger(numOf(p.totalPkg)))
    err(J, `Total packages "${str(p.totalPkg)}" must be a whole number`);
  for (const k of JOB_YES_NO_FLAGS)
    if (!isBlank(p[k]) && !/^[YN]$/i.test(str(p[k]))) err(J, `${k} must be Y or N (now "${str(p[k])}")`);
}

function checkIgmRows(p, report) {
  let rows = p._igmRows;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      rows = null;
    }
  }
  if (Array.isArray(rows)) {
    rows.forEach((row, i) => {
      if (!row || typeof row !== 'object') return;
      const where = `IGM row ${i + 1}`;
      report.fixDates(row, ['igmDate', 'inwardDate', 'mawbDate', 'hawbDate'], where);
      report.fixNums(row, ['totalPkg', 'grossWt'], where);
      const igm = ymd(row.igmDate),
        inward = ymd(row.inwardDate);
      if (igm && inward && inward < igm) report.err(where, `Inward date ${inward} is before the IGM date ${igm}`);
    });
  }
  if (Array.isArray(rows) && typeof p._igmRows === 'string') p._igmRows = JSON.stringify(rows);
}

const invoiceKeyOf = (inv) =>
  str(inv && (inv.invNo || inv.invoiceNo || inv.invoiceNumber))
    .replace(/\s+/g, '')
    .toUpperCase();

// the same invoice number twice on one job (case / space insensitive) - whatever path put it there (screen, Excel,
// copy...). ICES keys the invoice by its serial, so two rows with one number would be filed as two invoices.
function checkInvoiceNumbers(invoices, { err }) {
  const firstIndexByKey = new Map();
  invoices.forEach((inv, i) => {
    const k = invoiceKeyOf(inv);
    if (!k) return;
    if (firstIndexByKey.has(k))
      err(
        `Invoice ${i + 1}`,
        `Invoice No "${str(inv.invNo || inv.invoiceNo || inv.invoiceNumber)}" is already on this job as invoice ${firstIndexByKey.get(k) + 1} - a duplicate is not saved`,
      );
    else firstIndexByKey.set(k, i);
  });
  invoices.forEach((inv, i) => {
    if (inv && typeof inv === 'object' && !invoiceKeyOf(inv) && Array.isArray(inv.items) && inv.items.length) {
      err(
        `Invoice ${i + 1}`,
        `has ${inv.items.length} item(s) but no Invoice No - enter the invoice in 3. Invoices (select the row, fill it, Modify)`,
      );
    }
  });
}

// connected fields: an item sits under the invoice its Inv Sr No says; value = qty x unit price; the item currency is
// the invoice currency. Returns the item value to add to the invoice total, or null.
function checkItem(item, itemIndex, context, report) {
  const { err, warn } = report;
  const { invoiceTitle, invoiceIndex, invoiceCount, currency, seenItemKeys } = context;
  const Wi = `${invoiceTitle} item ${str(item.itemSrNo) || itemIndex + 1}`;
  report.fixNums(item, NUM_KEYS_ITEM, Wi);
  const sr = str(item.invSrNo);
  if (sr && /^\d+$/.test(sr) && (+sr < 1 || +sr > invoiceCount))
    err(Wi, `Inv Sr No ${sr} does not exist (this job has ${invoiceCount} invoice(s))`);
  const isr = str(item.itemSrNo);
  if (isr && !/^\d{1,4}$/.test(isr)) err(Wi, `Item Sr No "${isr}" must be a whole number (1-9999)`);
  else if (isr && +isr < 1) err(Wi, 'Item Sr No must be 1 or more');
  const key = `${sr || invoiceIndex + 1}/${isr}`;
  if (isr) {
    if (seenItemKeys.has(key)) err(Wi, `Item Sr No ${isr} is used twice in invoice ${sr || invoiceIndex + 1}`);
    seenItemKeys.add(key);
  }
  const ritc = str(item.ritc || item.hsCode);
  if (ritc && !/^\d{4,8}$/.test(ritc)) err(Wi, `RITC "${ritc}" must be digits (8 for filing)`);
  const cth = str(item.cth);
  if (cth && !/^\d{4,8}$/.test(cth)) err(Wi, `CTH "${cth}" must be digits`);
  const coo = str(item.countryOfOrigin).toUpperCase();
  if (coo && !/^[A-Z]{2}$/.test(coo)) err(Wi, `Country of origin "${coo}" must be a 2-letter code`);
  else if (coo && !isBlank(item.countryOfOrigin)) item.countryOfOrigin = coo;
  const rateType = str(item.rateTypeFlag).toUpperCase();
  if (rateType && !/^[SP]$/.test(rateType)) err(Wi, `Rate type "${rateType}" must be S or P`);
  else if (rateType) item.rateTypeFlag = rateType;
  if (!isBlank(item.accessoryStatus) && !/^[012]$/.test(str(item.accessoryStatus)))
    err(Wi, `Accessory status must be 0, 1 or 2`);
  for (const r of ITEM_RATE_KEYS)
    if (!isBlank(item[r]) && numOf(item[r]) > MAX_DUTY_RATE_PERCENT) err(Wi, `${r} ${str(item[r])} % is not a rate`);
  const qty = numOf(item.qty ?? item.quantity),
    price = numOf(item.price ?? item.unitPrice);
  if (qty !== null && !Number.isNaN(qty) && qty === 0 && (price || 0) > 0) warn(Wi, 'Quantity is 0');
  if (sr && /^\d+$/.test(sr) && +sr !== invoiceIndex + 1 && +sr >= 1 && +sr <= invoiceCount)
    err(Wi, `Inv Sr No ${sr} but the item is under invoice ${invoiceIndex + 1}`);
  const value = numOf(item.value);
  if (
    qty !== null &&
    price !== null &&
    value !== null &&
    qty > 0 &&
    price > 0 &&
    value > 0 &&
    str(item.foc).toUpperCase() !== 'Y' &&
    Math.abs(value - qty * price) > Math.max(1, qty * price * 0.01)
  ) {
    err(Wi, `Value ${value} does not match Qty ${qty} x Unit price ${price} = ${(qty * price).toFixed(2)}`);
  }
  const itemCurrency = str(item.currency || item.itemCurrency).toUpperCase();
  if (itemCurrency && currency && itemCurrency !== currency)
    err(Wi, `Item currency ${itemCurrency} differs from the invoice currency ${currency}`);
  return value !== null && value > 0 ? value : null;
}

function checkInvoice(inv, i, p, invoices, seenItemKeys, report) {
  const { err, warn } = report;
  const W = `Invoice ${i + 1}${str(inv.invNo) ? ' (' + str(inv.invNo) + ')' : ''}`;
  for (const [box, shadow] of Object.entries(SHADOW_INVOICE))
    if (hasOwn(inv, box)) inv[shadow] = isBlank(inv[box]) ? '' : inv[box];
  report.fixDates(inv, DATE_KEYS_INV, W);
  report.fixNums(inv, NUM_KEYS_INV, W);
  for (const k of ['invDate', 'invoiceDate'])
    if (ymd(inv[k]) && ymd(inv[k]) > plusDays(todayIST(), 1)) err(W, `Invoice date ${inv[k]} is in the future`);
  const currency = str(inv.currency || inv.invoiceCurrency).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) err(W, `Currency "${currency}" must be a 3-letter code`);
  else if (currency) {
    if (!isBlank(inv.currency)) inv.currency = currency;
    if (!isBlank(inv.invoiceCurrency)) inv.invoiceCurrency = currency;
  }
  const terms = str(inv.terms || inv.termsOfInvoice).toUpperCase();
  if (terms && !['CIF', 'FOB', 'CF', 'CI', 'C&F', 'CFR'].includes(terms))
    err(W, `Terms "${terms}" must be CIF, FOB, CF or CI`);
  else if (terms) {
    if (!isBlank(inv.terms)) inv.terms = terms;
    if (!isBlank(inv.termsOfInvoice)) inv.termsOfInvoice = terms;
  }
  // a job read from iCAFFE (and its BE amendment copies) carries the rate AND the amount iCAFFE worked out from it -
  // that is how the BE was filed, so it is saved as it is (a fresh BE is still checked at filing)
  const fromIcaffe = !isBlank(p.icaffeRowId) || !isBlank(p._amendmentId);
  if (
    !fromIcaffe &&
    !isBlank(inv.freightValue) &&
    !isBlank(inv.freightRate) &&
    numOf(inv.freightValue) &&
    numOf(inv.freightRate)
  )
    err(W, 'Freight: give the amount OR the rate, not both');
  if (
    !fromIcaffe &&
    !isBlank(inv.insuranceValue) &&
    !isBlank(inv.insuranceRate) &&
    numOf(inv.insuranceValue) &&
    numOf(inv.insuranceRate)
  )
    err(W, 'Insurance: give the amount OR the rate, not both');
  if (['CIF', 'CF', 'C&F', 'CFR'].includes(terms) && (numOf(inv.freightValue) || numOf(inv.freightRate)))
    err(W, `Terms ${terms} already include freight - the freight amount / rate must be empty`);
  if (['CIF', 'CI'].includes(terms) && (numOf(inv.insuranceValue) || numOf(inv.insuranceRate)))
    err(W, `Terms ${terms} already include insurance - the insurance amount / rate must be empty`);
  const nature = str(inv.natureOfTransaction).toUpperCase();
  if (nature && !/^[SCHFORPGM]$/.test(nature))
    err(W, `Nature of transaction "${nature}" must be one of S C H F O R P G M`);
  for (const k of ['exRate', 'exchangeRate'])
    if (!isBlank(inv[k]) && numOf(inv[k]) === 0) err(W, `Exchange rate cannot be 0`);

  const items = Array.isArray(inv.items) ? inv.items : [];
  const context = { invoiceTitle: W, invoiceIndex: i, invoiceCount: invoices.length, currency, seenItemKeys };
  let itemSum = 0,
    itemSumKnown = false;
  items.forEach((item, k) => {
    if (!item || typeof item !== 'object') return;
    const value = checkItem(item, k, context, report);
    if (value !== null) {
      itemSum += value;
      itemSumKnown = true;
    }
  });
  const invoiceValue = numOf(inv.value ?? inv.invoiceValue);
  // items are typed one by one, so while a job is being entered they add up to LESS than the invoice value - that
  // is incomplete, not impossible, and must still save. Items worth MORE than the invoice cannot be right and are
  // refused; the exact tally (ICEGATE error 260) is checked when the BE is validated / filed (icegateValidate).
  if (
    itemSumKnown &&
    invoiceValue !== null &&
    invoiceValue > 0 &&
    Math.abs(invoiceValue - itemSum) > Math.max(1, invoiceValue * 0.005)
  ) {
    if (itemSum > invoiceValue)
      err(
        W,
        `Items ${itemSum.toFixed(2)} are worth more than the invoice value ${invoiceValue} - correct the invoice value or the item values`,
      );
    else
      warn(
        W,
        `Items so far ${itemSum.toFixed(2)} of invoice value ${invoiceValue} (${(invoiceValue - itemSum).toFixed(2)} still to enter) - the BE can be filed only when they tally`,
      );
  }
}

function checkContainers(p, { err }) {
  const containers = Array.isArray(p.containers) ? p.containers : [];
  containers.forEach((c, i) => {
    if (!c || typeof c !== 'object') return;
    const no = str(c.containerNo || c.contNo || c.ContainerNumber || c.contNumber).toUpperCase();
    if (no && !/^[A-Z]{4}\d{7}$/.test(no))
      err(`Container ${i + 1}`, `Container no "${no}" must be 4 letters + 7 digits`);
  });
}

function validateImportSave(p) {
  const report = createReport();
  const { errors, warnings, notes } = report;
  if (!p || typeof p !== 'object') return { errors: ['Job: nothing to save'], warnings, notes };

  checkJobHeader(p, report);
  checkIgmRows(p, report);

  const invoices = Array.isArray(p.invoices) ? p.invoices : [];
  const seenItemKeys = new Set();
  checkInvoiceNumbers(invoices, report);
  invoices.forEach((inv, i) => {
    if (!inv || typeof inv !== 'object') return;
    checkInvoice(inv, i, p, invoices, seenItemKeys, report);
  });
  checkContainers(p, report);
  return { errors, warnings, notes };
}

export { validateImportSave, ymd, numOf };
