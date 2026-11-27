// Checks when an Export (SB) job is saved - the same idea as the Import job checks (importJobValidate.js): wrong
// dates, negative values or a repeated invoice are refused at save time instead of being found only when the SB goes
// to ICEGATE. Only impossible values are refused - a draft may still be incomplete.
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;
const IST_OFFSET_MS = 5.5 * 3600000;
const DAY_MS = 86400000;

const str = (v) => (v == null ? '' : String(v)).trim();
const isBlank = (v) => str(v) === '';
const numOf = (v) => {
  if (isBlank(v)) return null;
  const n = Number(str(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

function ymd(v) {
  const s = str(v);
  if (!s) return '';
  let m = /^(\d{4})-?(\d{2})-?(\d{2})(?:[T\s].*)?$/.exec(s);
  let y, mo, d;
  if (m) {
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  } else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) {
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  } else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < MIN_YEAR || y > MAX_YEAR)
    return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const todayIST = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
const plusDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);

const JOB_DATES = ['jobDate', 'sbDate', 'leoDate', 'mawbDate', 'hawbDate', 'ewayBillDate'];
const NOT_FUTURE = ['jobDate', 'sbDate', 'leoDate'];
const JOB_NUMS = ['grossWeight', 'totalPackages', 'fobRs', 'dbkRs'];
const INV_NUMS = [
  'value',
  'exchRate',
  'freightAmount',
  'freightRate',
  'insuranceAmount',
  'insuranceRate',
  'discountAmount',
  'discountRate',
  'commissionAmount',
  'commissionRate',
  'packingAmount',
  'otherAmount',
];
const ITEM_NUMS = [
  'qty',
  'price',
  'itemFob',
  'fobValueInr',
  'totalFc',
  'igstAmt',
  'igstRate',
  'taxableValue',
  'totalPkgs',
];
const INVOICE_CURRENCY_KEYS = ['currency', 'freightCurr', 'insuranceCurr'];

function createChecker() {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const dateCheck = (obj, keys, where, notFuture) => {
    for (const k of keys) {
      if (isBlank(obj[k])) continue;
      const d = ymd(obj[k]);
      if (d === null) {
        err(where, `${k} "${str(obj[k])}" is not a date`);
        continue;
      }
      if (notFuture.includes(k) && d > plusDays(todayIST(), 1)) err(where, `${k} ${d} is in the future`);
    }
  };
  const numCheck = (obj, keys, where) => {
    for (const k of keys) {
      const n = numOf(obj[k]);
      if (n === null) continue;
      if (Number.isNaN(n)) err(where, `${k} "${str(obj[k])}" is not a number`);
      else if (n < 0) err(where, `${k} cannot be negative (${n})`);
    }
  };
  return { errors, err, dateCheck, numCheck };
}

function checkJobHeader(p, { err, dateCheck, numCheck }) {
  const J = 'Job';
  dateCheck(p, JOB_DATES, J, NOT_FUTURE);
  numCheck(p, JOB_NUMS, J);
  const sb = ymd(p.sbDate),
    leo = ymd(p.leoDate);
  if (sb && leo && leo < sb) err(J, `LEO date ${leo} is before the SB date ${sb}`);
  const iec = str(p.shipperIec);
  if (iec && !/^[A-Z0-9]{10}$/i.test(iec)) err(J, `Exporter IEC "${iec}" must be 10 letters / digits`);
  const gstin = str(p.shipperGstin);
  if (gstin && !/^[0-9A-Z]{15}$/i.test(gstin)) err(J, `Exporter GSTIN "${gstin}" is not a valid 15-character GSTIN`);
  const pin = str(p.shipperPin);
  if (pin && !/^\d{6}$/.test(pin)) err(J, `Exporter PIN "${pin}" must be 6 digits`);
  for (const k of ['sbNo', 'sbNumber']) {
    const v = str(p[k]);
    if (v && !/^\d{1,7}$/.test(v)) err(J, `SB No "${v}" must be up to 7 digits`);
  }
  const mode = str(p.shipmentMode).toUpperCase();
  if (mode && !['AIR', 'SEA', 'LAND'].includes(mode))
    err(J, `Shipment mode "${p.shipmentMode}" must be AIR, SEA or LAND`);
}

function checkInvoiceItems(items, invoiceTitle, { err, numCheck }) {
  const seenItemNos = new Set();
  items.forEach((item, j) => {
    if (!item || typeof item !== 'object') return;
    const Wi = `${invoiceTitle} item ${str(item.itemSr) || j + 1}`;
    numCheck(item, ITEM_NUMS, Wi);
    const ritc = str(item.ritc);
    if (ritc && !/^\d{4,8}$/.test(ritc)) err(Wi, `RITC "${ritc}" must be digits (8 for filing)`);
    const itemNo = str(item.itemSr);
    if (itemNo) {
      if (seenItemNos.has(itemNo)) err(Wi, `Item Sr No ${itemNo} is used twice in this invoice`);
      seenItemNos.add(itemNo);
    }
  });
}

function checkInvoices(p, checker) {
  const { err, dateCheck, numCheck } = checker;
  const invoices = Array.isArray(p.invoices) ? p.invoices : [];
  const firstIndexByKey = new Map();
  invoices.forEach((inv, i) => {
    if (!inv || typeof inv !== 'object') return;
    const no = str(inv.invoiceNo || inv.no);
    const W = `Invoice ${i + 1}${no ? ' (' + no + ')' : ''}`;
    const key = no.replace(/\s+/g, '').toUpperCase();
    if (key) {
      if (firstIndexByKey.has(key))
        err(
          W,
          `Invoice No "${no}" is already on this job as invoice ${firstIndexByKey.get(key) + 1} - a duplicate is not saved`,
        );
      else firstIndexByKey.set(key, i);
    }
    dateCheck(inv, ['date', 'invoiceDate', 'lcDate', 'bankCertDate'], W, ['date', 'invoiceDate']);
    numCheck(inv, INV_NUMS, W);
    for (const currencyKey of INVOICE_CURRENCY_KEYS) {
      const currency = str(inv[currencyKey]).toUpperCase();
      if (currency && !/^[A-Z]{3}$/.test(currency))
        err(W, `${currencyKey === 'currency' ? 'Currency' : currencyKey} "${currency}" must be a 3-letter code`);
    }
    const exchangeRate = numOf(inv.exchRate ?? inv.exchangeRate);
    if (exchangeRate === 0) err(W, 'Exchange rate cannot be 0');
    checkInvoiceItems(Array.isArray(inv.items) ? inv.items : [], W, checker);
  });
}

// the container number rule is for sea only: an air SB lists ULDs here (e.g. AKE12345AI)
function checkContainers(p, { err }) {
  const sea = str(p.shipmentMode).toUpperCase() === 'SEA';
  (Array.isArray(p.containers) ? p.containers : []).forEach((c, i) => {
    const no = str(c && (c.containerNo || c.ContainerNumber))
      .replace(/\s+/g, '')
      .toUpperCase();
    if (sea && no && !/^[A-Z]{4}\d{7}$/.test(no))
      err(`Container ${i + 1}`, `Container no "${no}" must be 4 letters + 7 digits`);
  });
}

function validateExportSave(p) {
  const checker = createChecker();
  if (!p || typeof p !== 'object') return { errors: ['No job data'] };
  checkJobHeader(p, checker);
  checkInvoices(p, checker);
  checkContainers(p, checker);
  return { errors: checker.errors };
}

export { validateExportSave, ymd };
