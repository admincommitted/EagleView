// 10-Nov-2026: checks when an Export (SB) job is saved - as the Import job has (utils/importJobValidate.js).
// Before, the server saved whatever came; wrong dates, negative values or a repeated invoice were found only when the
// SB went to ICEGATE. Only impossible values are refused - a draft may still be incomplete.
const str = (v) => (v == null ? '' : String(v)).trim();
const isBlank = (v) => str(v) === '';
const numOf = (v) => { if (isBlank(v)) return null; const n = Number(str(v).replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };
function ymd(v) {
  const s = str(v); if (!s) return '';
  let m = /^(\d{4})-?(\d{2})-?(\d{2})(?:[T\s].*)?$/.exec(s); let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 1990 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const today = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10); // India date
const plusDays = (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

const JOB_DATES = ['jobDate', 'sbDate', 'leoDate', 'mawbDate', 'hawbDate', 'ewayBillDate'];
const NOT_FUTURE = ['jobDate', 'sbDate', 'leoDate'];
const JOB_NUMS = ['grossWeight', 'totalPackages', 'fobRs', 'dbkRs'];
const INV_NUMS = ['value', 'exchRate', 'freightAmount', 'freightRate', 'insuranceAmount', 'insuranceRate', 'discountAmount', 'discountRate', 'commissionAmount', 'commissionRate', 'packingAmount', 'otherAmount'];
const ITEM_NUMS = ['qty', 'price', 'itemFob', 'fobValueInr', 'totalFc', 'igstAmt', 'igstRate', 'taxableValue', 'totalPkgs'];

function validateExportSave(p) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const J = 'Job';
  const dateCheck = (obj, keys, where, notFuture) => {
    for (const k of keys) {
      if (isBlank(obj[k])) continue;
      const d = ymd(obj[k]);
      if (d === null) { err(where, `${k} "${str(obj[k])}" is not a date`); continue; }
      if (notFuture.includes(k) && d > plusDays(today(), 1)) err(where, `${k} ${d} is in the future`);
    }
  };
  const numCheck = (obj, keys, where) => {
    for (const k of keys) {
      const n = numOf(obj[k]); if (n === null) continue;
      if (Number.isNaN(n)) err(where, `${k} "${str(obj[k])}" is not a number`);
      else if (n < 0) err(where, `${k} cannot be negative (${n})`);
    }
  };
  if (!p || typeof p !== 'object') return { errors: ['No job data'] };
  dateCheck(p, JOB_DATES, J, NOT_FUTURE);
  numCheck(p, JOB_NUMS, J);
  const sb = ymd(p.sbDate), leo = ymd(p.leoDate);
  if (sb && leo && leo < sb) err(J, `LEO date ${leo} is before the SB date ${sb}`);
  const iec = str(p.shipperIec); if (iec && !/^[A-Z0-9]{10}$/i.test(iec)) err(J, `Exporter IEC "${iec}" must be 10 letters / digits`);
  const gst = str(p.shipperGstin); if (gst && !/^[0-9A-Z]{15}$/i.test(gst)) err(J, `Exporter GSTIN "${gst}" is not a valid 15-character GSTIN`);
  const pin = str(p.shipperPin); if (pin && !/^\d{6}$/.test(pin)) err(J, `Exporter PIN "${pin}" must be 6 digits`);
  for (const k of ['sbNo', 'sbNumber']) { const v = str(p[k]); if (v && !/^\d{1,7}$/.test(v)) err(J, `SB No "${v}" must be up to 7 digits`); }
  const mode = str(p.shipmentMode).toUpperCase(); if (mode && !['AIR', 'SEA', 'LAND'].includes(mode)) err(J, `Shipment mode "${p.shipmentMode}" must be AIR, SEA or LAND`);

  const invs = Array.isArray(p.invoices) ? p.invoices : [];
  const seen = new Map();
  invs.forEach((inv, i) => {
    if (!inv || typeof inv !== 'object') return;
    const no = str(inv.invoiceNo || inv.no);
    const W = `Invoice ${i + 1}${no ? ' (' + no + ')' : ''}`;
    const k = no.replace(/\s+/g, '').toUpperCase();
    if (k) { if (seen.has(k)) err(W, `Invoice No "${no}" is already on this job as invoice ${seen.get(k) + 1} - a duplicate is not saved`); else seen.set(k, i); }
    dateCheck(inv, ['date', 'invoiceDate', 'lcDate', 'bankCertDate'], W, ['date', 'invoiceDate']);
    numCheck(inv, INV_NUMS, W);
    for (const kc of ['currency', 'freightCurr', 'insuranceCurr']) { const cur = str(inv[kc]).toUpperCase(); if (cur && !/^[A-Z]{3}$/.test(cur)) err(W, `${kc === 'currency' ? 'Currency' : kc} "${cur}" must be a 3-letter code`); }
    const ex = numOf(inv.exchRate ?? inv.exchangeRate); if (ex === 0) err(W, 'Exchange rate cannot be 0');
    const items = Array.isArray(inv.items) ? inv.items : [];
    const seenItem = new Set();
    items.forEach((it, j) => {
      if (!it || typeof it !== 'object') return;
      const Wi = `${W} item ${str(it.itemSr) || j + 1}`;
      numCheck(it, ITEM_NUMS, Wi);
      const ritc = str(it.ritc); if (ritc && !/^\d{4,8}$/.test(ritc)) err(Wi, `RITC "${ritc}" must be digits (8 for filing)`);
      const isr = str(it.itemSr); if (isr) { if (seenItem.has(isr)) err(Wi, `Item Sr No ${isr} is used twice in this invoice`); seenItem.add(isr); }
    });
  });
  // 18-Nov-2026: an air SB lists ULDs here (e.g. AKE12345AI) - the sea container rule refused every air job with ULD details
  const sea = str(p.shipmentMode).toUpperCase() === 'SEA';
  (Array.isArray(p.containers) ? p.containers : []).forEach((c, i) => {
    const no = str(c && (c.containerNo || c.ContainerNumber)).replace(/\s+/g, '').toUpperCase();
    if (sea && no && !/^[A-Z]{4}\d{7}$/.test(no)) err(`Container ${i + 1}`, `Container no "${no}" must be 4 letters + 7 digits`);
  });
  return { errors };
}

module.exports = { validateExportSave, ymd };
