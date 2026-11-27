/**
 * Checks the CACHI01 (Bill of Entry) / CACHE01 (Shipping Bill) JSON that will actually be sent to ICEGATE.
 * Field lengths come from the ICEGATE JSON schemas v1.2 (see project notes "icegate-json-filing-notes").
 * errors   = ICEGATE will reject / the field is mandatory  → submit is blocked
 * warnings = probably wrong or usually needed              → shown, submit allowed
 */

const IEC = /^[A-Z0-9]{10}$/;
const GSTIN = /^[0-9]{2}[A-Z0-9]{10}[0-9A-Z][Z1-9A-Z][0-9A-Z]$/;
const PIN6 = /^[1-9][0-9]{5}$/;
const CC2 = /^[A-Z]{2}$/;
const CUR3 = /^[A-Z]{3}$/;
const RITC8 = /^[0-9]{8}$/;

const str = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// ISO 6346 container check digit (A=10, multiples of 11 skipped)
function isoCheck(s) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = s[i];
    let v = /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 55;
    if (!/\d/.test(ch)) v += Math.floor((v - 1) / 10);
    sum += v * 2 ** i;
  }
  return (sum % 11) % 10 === +s[10];
}
function validDate(v) {
  const s = str(v);
  if (!/^\d{8}$/.test(s)) return false;
  const y = +s.slice(0, 4),
    m = +s.slice(4, 6),
    d = +s.slice(6, 8);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y > 1990;
}
function future(v) {
  const s = str(v);
  if (!validDate(s)) return false;
  const today = new Date();
  const t = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return +s > t;
}

function makeCollector() {
  const errors = [],
    warnings = [];
  return {
    errors,
    warnings,
    err: (where, msg) => errors.push(`${where}: ${msg}`),
    warn: (where, msg) => warnings.push(`${where}: ${msg}`),
    req(where, v, label, max) {
      const s = str(v);
      if (!s) {
        errors.push(`${where}: ${label} is mandatory`);
        return false;
      }
      if (max && s.length > max) errors.push(`${where}: ${label} max ${max} characters (now ${s.length})`);
      return true;
    },
    len(where, v, label, max) {
      const s = str(v);
      if (s && s.length > max) errors.push(`${where}: ${label} max ${max} characters (now ${s.length})`);
    },
    date(where, v, label, mandatory, noFuture) {
      const s = str(v);
      if (!s) {
        if (mandatory) errors.push(`${where}: ${label} is mandatory`);
        return;
      }
      if (!validDate(s)) errors.push(`${where}: ${label} is not a valid date`);
      else if (noFuture && future(s)) errors.push(`${where}: ${label} cannot be a future date`);
    },
  };
}

// The Job Header has IGM boxes and an IGM grid; the JSON is built from the grid when it has rows. Boxes
// edited after the row was added (packages, dates, weight, MAWB...) and not "Update"d would not be filed.
function igmBoxCheck(d, c) {
  if (!d || typeof d !== 'object') return;
  let rows = d._igmRows;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      rows = [];
    }
  }
  if (!Array.isArray(rows) || !rows.length) return;
  const t = (v) =>
    String(v ?? '')
      .trim()
      .toUpperCase();
  const box = {
    igmNumber: t(d.igmNumber || d.igmNo),
    igmDate: t(d.igmDate || d.autoField_14),
    mawbNo: t(d.mawbNo || d.mawbblNo),
    mawbDate: t(d.mawbDate || d.autoField_15),
    hawbNo: t(d.hawbNo || d.hawbhblNo),
    hawbDate: t(d.hawbDate || d.autoField_16),
    inwardDate: t(d.inwardDate || d.autoField_17),
    totalPkg: t(d.totalPkg),
    pkgCode: t(d.pkg),
    grossWt: t(d.grossWt),
    wtUnit: t(d.grossWtUnit),
    marks1: t(d.marksAndNumbers1 || d.marks1),
  };
  if (!box.igmNumber && !box.mawbNo && !box.hawbNo) return; // boxes are empty (cleared after Add) - nothing to compare
  const key = (r) => [t(r.igmNumber || r.igmNo), t(r.mawbNo), t(r.hawbNo)].join('|');
  const idx = rows.findIndex((r) => key(r) === key(box));
  if (idx === -1) {
    c.err(
      'IGM',
      `IGM / MAWB / HAWB typed in the Job Header boxes (${[box.igmNumber, box.mawbNo, box.hawbNo].filter(Boolean).join(' / ')}) is not in the IGM grid - click Add in the IGM grid, or Clear the boxes`,
    );
    return;
  }
  const r = rows[idx];
  const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
  // A date is the same date in any form (a parsed .be has 20260920 in the boxes and 2026-09-20 in the grid)
  const ymd = (v) => {
    const s = t(v);
    let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s);
    if (m) return m[1] + m[2] + m[3];
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
    return m ? m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0') : s;
  };
  const DATES = new Set(['igmDate', 'mawbDate', 'hawbDate', 'inwardDate']);
  const same = (k) => (DATES.has(k) ? ymd(box[k]) === ymd(r[k]) : box[k] === t(r[k]));
  const diffs = [];
  for (const [k, label] of [
    ['igmDate', 'IGM date'],
    ['mawbDate', 'MAWB date'],
    ['hawbDate', 'HAWB date'],
    ['inwardDate', 'inward date'],
    ['pkgCode', 'package code'],
    ['wtUnit', 'weight unit'],
    ['marks1', 'marks'],
  ])
    if (box[k] && !same(k)) diffs.push(label);
  for (const [k, label] of [
    ['totalPkg', 'packages'],
    ['grossWt', 'gross weight'],
  ])
    if (box[k] && num(box[k]) !== num(r[k])) diffs.push(label);
  if (diffs.length)
    c.err(
      'IGM',
      `Job Header IGM boxes differ from IGM grid row ${idx + 1} (${diffs.join(', ')}) - the grid row is what gets filed: click Update in the IGM grid, or re-select the row`,
    );
}

// e-Sanchit codes iCAFFE asks for on every BE (its "Validate Job": "Missing Mandatory Doc Code For BE level /
// For Invoice level"). Names as in the e-Sanchit code master.
const BE_TRANSPORT_DOCS = {
  704000: 'Master B/L',
  714000: 'House B/L',
  705000: 'B/L',
  703000: 'House waybill',
  709000: 'Tanker B/L',
  710000: 'Sea waybill',
  711000: 'Inland waterway B/L',
  740000: 'Air waybill',
  741000: 'Master air waybill',
  700000: 'Waybill',
};
const BE_INVOICE_DOCS = {
  380000: 'Commercial invoice',
  331000: 'Commercial invoice with packing list',
  325000: 'Proforma invoice',
};

function validateBE(json, opts = {}) {
  const c = makeCollector();
  const h = (json && json.headerField) || {};
  const m = (json && json.master) || {};
  if (opts.screen) igmBoxCheck(opts.screen, c);
  if (!str(h.senderID)) c.err('Header', 'ICEGATE ID (sender) missing - select an ICEGATE profile');
  if (!/^[A-Z0-9]{6}$/.test(str(h.receiverID)))
    c.err('Header', 'Customs location / port code must be 6 characters (e.g. INDEL4)');
  if (!(num(h.jobNumber) >= 1 && num(h.jobNumber) <= 9999999))
    c.err(
      'Header',
      !(num(h.jobNumber) >= 1)
        ? "Job number is blank - save the job first (the ICEGATE job number is the saved job's number)"
        : 'Job number must be 1 to 9999999 (numeric)',
    );

  // the header's own job date and indicator (checked on the SB side too)
  c.date('Header', h.jobDate, 'Job date', true, true);
  if (str(h.indicator) && !['T', 'P'].includes(str(h.indicator).toUpperCase()))
    c.err('Header', 'Indicator must be T (test) or P (production)');

  const be = (m.beModel || [])[0];
  if (!be) {
    c.err('BE', 'BE details missing');
    return c;
  }
  const W = 'Header';
  // SEZ types Z / T / M / V / S were added by ICEGATE (Mar-2026 advisories).
  if (!['H', 'W', 'X', 'Z', 'T', 'M', 'V', 'S'].includes(str(be.beType)))
    c.err(W, 'BE Type must be H, W, X (or SEZ type Z / T / M / V / S)');
  // the BE Message Format gives the BE class as always N
  // iCAFFE files every BE with class P (26 of 26 filed .be files) - only an unknown class is a warning
  if (str(be.beClass) && !['N', 'P'].includes(str(be.beClass).toUpperCase()))
    c.warn(W, 'BE class is "' + str(be.beClass) + '" - the BE message format expects N (iCAFFE files P)');
  if (str(be.uniqueConsignmentReferenceNo) && !str(be.ucrType))
    c.err(W, 'UCR No is given: enter the UCR Type too (AWB / BL ...)');
  if (!str(be.importerType))
    c.err(W, 'Importer Type is mandatory (Job Header: Private / Government / Undertaking / Others ...)');
  else if (!'GUOPJREDTSVAHIMBFW'.split('').includes(str(be.importerType)))
    c.warn(W, 'Importer type "' + str(be.importerType) + '" is not an ICEGATE code');
  for (const [k, l] of [
    ['kachchaBE', 'Kachcha BE'],
    ['highSeaSaleFlag', 'High sea sale'],
    ['greenChannelRequested', 'Green channel'],
    ['section48Requested', 'Section 48'],
    ['whetherPriorBE', 'Prior BE'],
    ['firstCheckRequested', 'First check'],
  ])
    if (str(be[k]) && !['Y', 'N'].includes(str(be[k]))) c.err(W, l + ' must be Y or N (now "' + str(be[k]) + '")');
  // ex-bond: the high-sea seller was declared on the warehouse BE (a filed X BE has HSS = Y and no HSS rows)
  if (str(be.highSeaSaleFlag) === 'Y' && str(be.beType) !== 'X' && !(m.hssModel || []).length)
    c.err('High Sea Sale', 'High sea sale = Y: give the seller (HSS) details');
  // the sale chain: one seller per level, starting at 0 and without a gap
  {
    const hss = m.hssModel || [];
    const lvl = (r) => {
      const t = String(r.precedingLevel ?? '').match(/\d+/);
      return t ? parseInt(t[0], 10) : 0;
    };
    const seen = new Map();
    hss.forEach((r, i) => {
      const w = `High Sea Sale ${i + 1}`;
      if (!str(r.iec)) c.err(w, 'Seller IEC is mandatory');
      else if (!/^[A-Z0-9]{10}$/i.test(str(r.iec))) c.err(w, 'Seller IEC must be 10 letters / digits');
      if (!str(r.importerName)) c.err(w, 'Seller name is mandatory');
      const n = lvl(r);
      if (seen.has(n))
        c.err(
          w,
          'Level ' +
            n +
            ' is used by two sellers (' +
            seen.get(n) +
            ' and ' +
            str(r.importerName) +
            ') - each seller of the chain has its own level',
        );
      else seen.set(n, str(r.importerName));
    });
    for (let n = 0; n < seen.size; n++)
      if (!seen.has(n))
        c.err('High Sea Sale', 'Level ' + n + ' is missing - the sale chain runs 0, 1, 2 ... without a gap');
  }
  // on a high sea sale the purchase is "on high seas" (P) and the HSS load is declared on the invoice
  if (str(be.highSeaSaleFlag) === 'Y') {
    const invs = m.invoiceModel || [];
    // a warning only - real filed HSS BEs carry O, and ex-bond BEs leave it blank
    if (
      str(be.beType) !== 'X' &&
      invs.length &&
      !invs.some((iv) => ['P', 'O'].includes(str(iv.natureOfTransaction).toUpperCase()))
    )
      c.warn(
        'High Sea Sale',
        'High sea sale = Y: Nature of transaction is normally P (purchase on high seas) or O on the invoice',
      );
    // not on an ex-bond - its invoice rows carry only the serial and invoice no (the HSS load is on the WH BE)
    if (
      str(be.beType) !== 'X' &&
      invs.length &&
      !invs.some((iv) => num(iv.hssLoadAmount) > 0 || num(iv.hssLoadRate) > 0)
    )
      c.warn('High Sea Sale', 'High sea sale = Y but no HSS load amount / rate is declared on any invoice');
  }
  for (const [i, hs] of (m.hssModel || []).entries()) {
    const w = `High Sea Sale ${i + 1}`;
    if (!IEC.test(str(hs.iec).toUpperCase())) c.err(w, 'Seller IEC must be 10 letters/digits');
    c.req(w, hs.importerName, 'Seller name', 50);
  }
  if (str(be.whetherPriorBE) === 'Y' && (m.igmsModel || []).some((g) => str(g.inwardDate)))
    c.warn(W, 'Prior BE: inward date is normally empty');
  if (!['S', 'A', 'L'].includes(str(be.modeOfTransport))) c.err(W, 'Mode of transport must be S, A or L');
  if (c.req(W, be.iecCode, 'IEC Code') && !IEC.test(str(be.iecCode).toUpperCase()))
    c.err(W, 'IEC Code must be 10 letters/digits');
  // 0 is a valid branch (filed BEs from another ERP carry 0)
  if (String(be.branchSrNo ?? '').trim() === '')
    c.err(W, 'Importer Branch Sr. No. is mandatory (Job Header: Select Branch - as in the IEC, 0 to 999)');
  else if (!(num(be.branchSrNo) >= 0 && num(be.branchSrNo) <= 999)) c.err(W, 'Branch Sr. No. must be 0 to 999');
  c.req(W, be.nameOfImporter, 'Importer Name', 50);
  c.req(W, be.address1, 'Importer Address 1', 35);
  c.len(W, be.address2, 'Importer Address 2', 35);
  c.req(W, be.city, 'City', 35);
  c.len(W, be.state, 'State', 25);
  if (str(be.pin) && !PIN6.test(str(be.pin))) c.err(W, 'PIN must be 6 digits');
  if (!str(be.pin)) c.err(W, 'PIN is mandatory');
  c.req(W, be.chaCode, 'CHA Code', 15);
  if (!CC2.test(str(be.countryOfOrigin))) c.err(W, 'Country of Origin must be a 2-letter code (e.g. CN)');
  if (!CC2.test(str(be.countryOfConsignment))) c.err(W, 'Country of Consignment must be a 2-letter code');
  if (!str(be.portOfShipment)) c.err(W, 'Port of Shipment / Origin Port is mandatory');
  else c.len(W, be.portOfShipment, 'Port of Shipment', 6);
  // ICEGATE refuses an empty portOfOrigin ("Port of Origin should be of type character having length 6")
  if (!str(be.portOfOrigin))
    c.err(
      W,
      'Port of Origin is mandatory (Job Header > Port of Origin, e.g. ' +
        (str(be.portOfShipment) || 'BKK') +
        ' / USATL) - ICEGATE refuses the BE without it',
    );
  else c.len(W, be.portOfOrigin, 'Port of Origin', 6);
  // production air BEs use the 3-letter airport code (SIN, FRA).
  if (str(be.modeOfTransport) === 'A' && str(be.portOfShipment).length > 3)
    c.warn(
      W,
      'Air shipment: Port of Shipment is usually the 3-letter airport code (e.g. SIN), now "' +
        str(be.portOfShipment) +
        '"',
    );
  // every currency used on the invoices needs an exchange-rate row.
  const rates = new Set((m.exchangeModel || []).map((e) => str(e.currencyCode).toUpperCase()));
  (m.invoiceModel || []).forEach((iv, i) =>
    [
      'invoiceCurrency',
      'freightCurrency',
      'insuranceCurrency',
      'miscCurrency',
      'loadingCurrency',
      'agencyCommissionCurrency',
    ].forEach((k) => {
      const cur = str(iv[k]).toUpperCase();
      if (cur && cur !== 'INR' && !rates.has(cur))
        c.err('Exchange Rate', 'No exchange rate for ' + cur + ' (Invoice ' + (i + 1) + ')');
    }),
  );

  // a rate of 0 (currency row without a rate) is refused
  (m.exchangeModel || []).forEach((e) => {
    if (str(e.currencyCode).toUpperCase() !== 'INR' && !(num(e.rate) > 0))
      c.err('Exchange Rate', 'Exchange rate for ' + str(e.currencyCode) + ' is 0 - use "Update Exchange Rate"');
  });
  // CBIC notifies Japanese Yen and Korean Won in Schedule II of the exchange-rate notification, per
  // 100 units. A rate copied from there into a row left at "per 1" (or the other way round) assesses the whole BE
  // 100 times out, so the rupees-per-unit that comes out of the row is checked against a plausible band.
  (m.exchangeModel || []).forEach((e) => {
    const cur = str(e.currencyCode).toUpperCase();
    if (!['JPY', 'KRW'].includes(cur)) return;
    const unit = num(e.unitInRs) || 1;
    const per = num(e.rate) / unit;
    if (!(per > 0)) return;
    if (per > 5 || per < 0.01)
      c.err(
        'Exchange Rate',
        cur +
          ' comes to Rs ' +
          Math.round(per * 10000) / 10000 +
          ' a unit (rate ' +
          str(e.rate) +
          ' per ' +
          unit +
          '). CBIC notifies ' +
          cur +
          ' per 100 units - enter the notified figure with Unit in Rs. 100, else the duty comes out 100 times out',
      );
  });
  c.len(W, be.warehouseCode, 'Warehouse code', 8);
  c.len(W, be.authorizedEconomicDealerCode || be.adCode, 'AD code', 10);
  c.len(W, be.uniqueConsignmentReferenceNo, 'UCR No', 35);
  c.len(W, be.ucrType, 'UCR Type', 6);
  // Section 48 / First Check / Provisional assessment asked for without the PERMISSION row (reason)
  const perm = (m.permissionModel || []).map((p) => str(p.permissionCode).toUpperCase());
  if (str(be.section48Requested) === 'Y' && !perm.includes('S48'))
    c.err('Permission', 'Section 48 = Y but no S48 permission row - give the reason in the Section 48 popup');
  if (str(be.firstCheckRequested) === 'Y' && !perm.includes('FCK'))
    c.err('Permission', 'First Check = Y but no FCK permission row - give the reason in the First Check popup');
  (m.permissionModel || []).forEach((p) => {
    const code = str(p.permissionCode).toUpperCase();
    if (!str(p.reasonsForRequest)) {
      if (['S48', 'FCK', 'PRV'].includes(code)) c.err('Permission', code + ': the reason for the request is mandatory');
      else c.warn('Permission', code + ': reason for the request is empty');
    }
  });
  // W / X BE - package code in the BE row; filed W BEs leave packages released / gross weight empty, so
  // only the package code is asked for, the rest is a reminder
  if (['W', 'X'].includes(str(be.beType))) {
    const W2 = str(be.beType) === 'W' ? 'Warehouse' : 'Ex-Bond';
    // a warehouse BE can carry the package code and the weight on its IGM line (where the screen puts them),
    // so the reminder to "fill the IGM details" is made only when the figure is nowhere on the BE
    const igms = m.igmsModel || [];
    const anyPkgCode = str(be.packageCode) || igms.some((g) => str(g.packageCode));
    const anyWeight =
      num(be.noOfPackagesReleased) > 0 ||
      num(be.grossWeight) > 0 ||
      igms.some((g) => num(g.totalNoOfPackages) > 0 || num(g.grossWeight) > 0);
    if (!anyPkgCode) c.warn(W2, 'Package code is empty (IGM details > package code)');
    if (!anyWeight) c.warn(W2, 'Packages / gross weight are empty - fill the IGM details if this BE needs them');
  }

  // production W BEs are filed without a bond row too (bond on record) - so only a reminder.
  if (str(be.beType) === 'W' && !(m.bondModel || []).length)
    c.warn('Bond', 'Warehouse (W) BE has no bond row - add one if this BE needs a bond');
  for (const [i, b] of (m.bondModel || []).entries()) {
    const w = `Bond ${i + 1}`;
    if (!(num(b.bondNumber) > 0)) c.err(w, 'Bond No must be numeric');
    c.req(w, b.bondCode, 'Bond Code', 2);
    c.req(w, b.bondPort, 'Bond Port', 6);
    // e-Bond: the purpose code goes in the bond code column; "EB" is rejected (ICEGATE error 553).
    if (str(b.bondCode).toUpperCase() === 'EB')
      c.err(w, 'Bond Code EB is not valid - for an e-Bond give its purpose code (e.g. W1, P3, R1)');
  }
  if (str(be.beType) === 'X') {
    if (!str(be.warehouseCode)) c.err('Ex-Bond', 'Warehouse Code is mandatory');
    if (!str(be.warehouseBENo)) c.warn('Ex-Bond', 'Warehouse BE No is empty - link the warehouse BE');
  }
  for (const [i, ce] of (m.certModel || []).entries()) {
    const w = `Certificate ${i + 1}`;
    c.req(w, ce.certificateNumber, 'Certificate No', 30);
    c.date(w, ce.certificationDate, 'Certificate Date', true, true);
    c.req(w, ce.certificationType, 'Certificate Type', 2);
  }

  for (const [i, x] of (m.ctxModel || []).entries()) {
    const w = `CTX ${i + 1}`;
    // the type must be one of the schema codes (never the word "Select" or a label) and a
    // registration no is needed for every type except N
    if (!str(x.commercialTaxType)) c.err(w, 'CTX Type is mandatory (Job Header: G = GSTIN, P = PAN, ...)');
    else if (!'VCSGPAITDON'.split('').includes(str(x.commercialTaxType)))
      c.err(w, 'CTX Type "' + str(x.commercialTaxType) + '" is not an ICEGATE code (V C S G P A I T D O N)');
    if (str(x.commercialTaxType) !== 'N' && !str(x.commercialTaxRegistrationNo))
      c.err(w, 'CTX Registration No (GSTIN / PAN ...) is mandatory');
    if (str(x.commercialTaxType) === 'G' && !GSTIN.test(str(x.commercialTaxRegistrationNo).toUpperCase()))
      c.err(w, 'GSTIN format is wrong (15 characters, e.g. 07AAAAA0000A1Z5)');
    // ICEGATE error 819: the PAN inside the GSTIN must be the one of the IEC.
    else if (
      str(x.commercialTaxType) === 'G' &&
      IEC.test(str(be.iecCode).toUpperCase()) &&
      /^[A-Z]{5}\d{4}[A-Z]$/.test(str(be.iecCode).toUpperCase()) &&
      str(x.commercialTaxRegistrationNo).toUpperCase().slice(2, 12) !== str(be.iecCode).toUpperCase()
    )
      c.err(
        w,
        'PAN in the GSTIN (' +
          str(x.commercialTaxRegistrationNo).toUpperCase().slice(2, 12) +
          ') does not match the IEC (' +
          str(be.iecCode).toUpperCase() +
          ')',
      );
    c.len(w, x.commercialTaxRegistrationNo, 'Registration No', 20);
    if (!str(x.stateCode)) c.err(w, 'State Code is mandatory');
  }
  if (!(m.ctxModel || []).length) c.warn('CTX', 'GSTIN / CTX details are empty');
  if ((m.ctxModel || []).length > 1) c.err('CTX', 'Only one CTX (GSTIN) row is allowed - now ' + m.ctxModel.length);

  const invs = m.invoiceModel || [];
  if (!invs.length) c.err('Invoice', 'At least one invoice is required');
  // Ex-bond (X) BE: invoice details come from the warehouse BE; production files leave them blank.
  const exBond = str(be.beType) === 'X';
  for (const [i, inv] of invs.entries()) {
    const w = `Invoice ${i + 1}`;
    c.req(w, inv.actualInvoiceNumber, 'Invoice No', 16);
    if (exBond) continue;
    c.date(w, inv.invoiceDate, 'Invoice Date', true, true);
    if (!CUR3.test(str(inv.invoiceCurrency))) c.err(w, 'Currency must be a 3-letter code (e.g. USD)');
    if (!(num(inv.invoiceValue) > 0)) c.err(w, 'Invoice Value must be more than 0');
    // an invoice dated after the BE / job date is a keying mistake
    {
      const id = /^\d{8}$/.test(str(inv.invoiceDate)) ? str(inv.invoiceDate) : '';
      const jd = /^\d{8}$/.test(str(h.jobDate)) ? str(h.jobDate) : '';
      if (id && jd && id > jd) c.err(w, 'Invoice date (' + id + ') is after the job date (' + jd + ')');
    }
    if (!['CIF', 'FOB', 'CF', 'CI'].includes(str(inv.termsOfInvoice).toUpperCase()))
      c.err(w, 'Terms must be CIF, FOB, CF or CI');
    if (
      ['FOB', 'CI'].includes(str(inv.termsOfInvoice).toUpperCase()) &&
      !(num(inv.freightValue) > 0) &&
      !(num(inv.freightRate) > 0)
    )
      c.warn(w, 'Terms are FOB/CI but Freight is empty');
    if (
      ['FOB', 'CF'].includes(str(inv.termsOfInvoice).toUpperCase()) &&
      !(num(inv.insuranceValue) > 0) &&
      !(num(inv.insuranceRate) > 0)
    )
      c.warn(w, 'Terms are FOB/CF but Insurance is empty');
    c.req(w, inv.supplierName, 'Supplier Name', 70);
    c.len(w, inv.supplierAddress1, 'Supplier Address 1', 70);
    // ICEGATE BE format: freight / insurance as a rate OR an amount, never both; codes of nature of
    // transaction, payment terms, related buyer; invoice value = sum of the items (error 260)
    if (num(inv.freightValue) > 0 && num(inv.freightRate) > 0)
      c.err(w, 'Freight: give the amount or the rate, not both');
    if (num(inv.insuranceValue) > 0 && num(inv.insuranceRate) > 0)
      c.err(w, 'Insurance: give the amount or the rate, not both');
    if (num(inv.freightValue) > 0 && !CUR3.test(str(inv.freightCurrency))) c.err(w, 'Freight currency is missing');
    if (num(inv.insuranceValue) > 0 && !CUR3.test(str(inv.insuranceCurrency)))
      c.err(w, 'Insurance currency is missing');
    if (str(inv.natureOfTransaction) && !'SCHFORPGM'.split('').includes(str(inv.natureOfTransaction)))
      c.err(
        w,
        'Nature of transaction must be S, C, H, F, O, R, P, G or M (now "' + str(inv.natureOfTransaction) + '")',
      );
    if (!str(inv.natureOfTransaction)) c.err(w, 'Nature of transaction is mandatory (S = sale ...)');
    if (!str(inv.paymentTerms)) c.err(w, 'Terms of Payment is mandatory (OTH / AP / DP / DA / LC) - 3. Invoices'); // ICEGATE invoice field (M)
    if (str(inv.whetherBuyerAndSellerAreRelated) && !['Y', 'N'].includes(str(inv.whetherBuyerAndSellerAreRelated)))
      c.err(w, 'Buyer and seller related must be Y or N');
    const its = (m.itemsModel || []).filter(
      (it) => (num(it.invoiceSerialNumber) || 1) === (num(inv.invoiceSerialNumber) || i + 1),
    );
    const sum = its.reduce((a, it) => a + num(it.quantity) * num(it.unitPriceInvoiced) - num(it.discountAmount), 0);
    if (
      its.length &&
      num(inv.invoiceValue) > 0 &&
      Math.abs(sum - num(inv.invoiceValue)) > Math.max(1, num(inv.invoiceValue) * 0.001)
    )
      c.err(
        w,
        'Invoice value ' +
          num(inv.invoiceValue).toFixed(2) +
          ' does not tally with its items ' +
          sum.toFixed(2) +
          ' (ICEGATE error 260)',
      );
    if (!its.length) c.err(w, 'Invoice has no item');
  }

  const items = m.itemsModel || [];
  if (!items.length) c.err('Item', 'At least one item is required');
  // an item pointing at an invoice serial that does not exist
  {
    const invNos = new Set(invs.map((inv, i) => num(inv.invoiceSerialNumber) || i + 1));
    items.forEach((it, i) => {
      const n = num(it.invoiceSerialNumber) || 1;
      if (invs.length && !invNos.has(n))
        c.err(`Item ${i + 1}`, 'Invoice Sr No ' + n + ' does not exist (invoices 1-' + invs.length + ')');
    });
  }
  // the same Item Sr No twice in one invoice (ICES keys the item by invoice sr + item sr)
  {
    const seen = new Set();
    items.forEach((it) => {
      const k = `${num(it.invoiceSerialNumber) || 1}/${num(it.itemSerialNumber)}`;
      if (seen.has(k)) c.err(`Item ${k}`, 'Item Sr No used twice in this invoice - change it in 4. Items (Modify)');
      seen.add(k);
    });
  }
  for (const [i, it] of items.entries()) {
    const w = `Item ${i + 1}`;
    if (!RITC8.test(str(it.ritcCode))) c.err(w, 'RITC / CTH must be exactly 8 digits');
    if (!(num(it.quantity) > 0)) c.err(w, 'Quantity must be more than 0');
    c.req(w, it.unitQuantityCode, 'UQC', 3);
    if (!exBond) c.req(w, it.itemDescription1, 'Description', 60);
    else c.len(w, it.itemDescription1, 'Description', 60); // ex-bond: the item is the WH BE's (filed X BEs carry no description)
    if (!(num(it.unitPriceInvoiced) > 0)) c.err(w, 'Unit Price must be more than 0');
    if (str(it.countryOfOrigin) && !CC2.test(str(it.countryOfOrigin)))
      c.err(w, 'Country of Origin must be a 2-letter code');
    // mandatory item fields of the BE format; "N.A." is accepted for brand / model
    if (!exBond) {
      if (!str(it.countryOfOrigin)) c.err(w, 'Country of Origin is mandatory');
      if (!str(it.brandName)) c.err(w, 'Brand is mandatory (N.A. when none)');
      if (!str(it.model)) c.err(w, 'Model is mandatory (N.A. when none)');
      if (!str(it.endUseOfItem)) c.err(w, 'End use is mandatory (e.g. GNX200)');
      if (str(it.cth) && str(it.cth) !== str(it.ritcCode))
        c.err(w, 'CTH (' + str(it.cth) + ') must be the same as RITC (' + str(it.ritcCode) + ')');
      const ceth = str(it.ceth).toUpperCase();
      if (!ceth) c.err(w, 'CETH is mandatory (NOEXCISE when none)');
      // ICES refused DEL-AI-1002 (CTH 98049000, CETH 98049000) with error 317 "Invalid CETH": Chapter 98
      // exists only in the Customs tariff, not in the Central Excise tariff, so its CETH is never a 98xx heading
      else if (str(it.ritcCode).slice(0, 2) === '98') {
        if (ceth.slice(0, 2) === '98')
          c.err(
            w,
            'CETH ' +
              ceth +
              " is a Chapter 98 heading - ICES refuses it (error 317 Invalid CETH). Items > CETH: enter NOEXCISE or the goods' own 8-digit heading",
          );
        else if (ceth !== 'NOEXCISE' && !/^\d{8}$/.test(ceth))
          c.err(w, 'CETH ' + ceth + ' must be 8 digits (or NOEXCISE)');
      } else if (ceth !== 'NOEXCISE' && ceth.slice(0, 4) !== str(it.ritcCode).slice(0, 4))
        c.err(w, 'CETH ' + ceth + ': first 4 digits must match the CTH');
      // the message format's field lengths - ICES cuts or rejects a longer value
      c.len(w, it.brandName, 'Brand', 35);
      c.len(w, it.model, 'Model', 35);
      c.len(w, it.endUseOfItem, 'End use', 10);
      c.len(w, it.manufacturerName || it.manufacturer, 'Manufacturer', 70);
      c.len(w, it.descOfGoods1 || it.itemDescription, 'Description', 60);
      if (str(it.preferentialStandard) && !['P', 'S'].includes(str(it.preferentialStandard)))
        c.err(w, 'Preferential / standard must be P or S');
      if (str(it.accessoryStatus) && !['0', '1', '2'].includes(str(it.accessoryStatus)))
        c.err(w, 'Accessory status must be 0, 1 or 2');
      if (str(it.whetherReimport) && !['Y', 'N'].includes(str(it.whetherReimport)))
        c.err(w, 'Re-import must be Y or N');
      // IGST levy notification in SBEDUTY (duty type G) - ICEGATE error 399
      const sd = (m.sbedutyModel || []).filter(
        (r) =>
          (num(r.invoiceSerialNumber) || 1) === (num(it.invoiceSerialNumber) || 1) &&
          num(r.itemSerialNumber) === num(it.itemSerialNumber),
      );
      if (!sd.some((r) => str(r.dutyType) === 'G' && str(r.notificationNo)))
        c.err(w, 'IGST notification no / Sr No is missing (Items > IGST duty) - ICEGATE error 399');
      for (const r of sd)
        if (str(r.notificationNo) && !str(r.notificationSrNo))
          c.err(w, 'Notification ' + str(r.notificationNo) + ': Sr No is empty');
      if (
        !(m.infoTypeModel || []).some(
          (r) =>
            (num(r.invoiceSerialNumber) || 1) === (num(it.invoiceSerialNumber) || 1) &&
            num(r.itemSerialNumber) === num(it.itemSerialNumber) &&
            str(r.infoType) === 'CHR' &&
            str(r.infoQualifier) === 'SQC',
        )
      )
        c.warn(w, 'SW Info CHR / SQC (statistical quantity) is missing');
      // a preferential (FTA) rate needs the CAROTAR set - the trade-agreement notification, the COO
      // certificate rows (ORC/COO, ORC/ORG) and the COO certificate itself in e-Sanchit; a bare "P" is queried / rejected
      if (str(it.preferentialStandard) === 'P') {
        const mine = (r) =>
          (num(r.invoiceSerialNumber) || 1) === (num(it.invoiceSerialNumber) || 1) &&
          num(r.itemSerialNumber) === num(it.itemSerialNumber);
        const sw = (m.infoTypeModel || []).filter(mine);
        const has = (t, q) => sw.some((r) => str(r.infoType) === t && str(r.infoQualifier) === q);
        if (!str(it.bcdNotification))
          c.err(
            w,
            'Preferential rate (P): the FTA / CEPA notification no + Sr No is mandatory (Items > BCD notification)',
          );
        if (!has('ORC', 'COO'))
          c.err(w, 'Preferential rate (P): SW Info ORC / COO (certificate of origin no + date) is missing (CAROTAR)');
        const coo = sw.find((r) => str(r.infoType) === 'ORC' && str(r.infoQualifier) === 'COO');
        if (coo && !String(coo.infoText || '').includes('|'))
          c.warn(
            w,
            'Preferential rate (P): SW Info ORC / COO text should be "certificate no|issue date" (pipe between them)',
          );
        // BE message format 2.27 (COO additional information) gives the origin criteria either as ORC / ORG
        // (COWO / COOG / COOP) or with the qualifier COWO / CONWO itself - both are accepted
        if (!has('ORC', 'ORG') && !has('ORC', 'COWO') && !has('ORC', 'CONWO'))
          c.err(
            w,
            'Preferential rate (P): SW Info origin criteria is missing - ORC / ORG (COWO / COOG / COOP) or ORC / COWO / CONWO (CAROTAR)',
          );
        if (!has('ORC', 'ACM')) c.warn(w, 'Preferential rate (P): SW Info ORC / ACM (accumulation Y/N) not given');
        if (!has('ORC', 'RIS'))
          c.warn(w, 'Preferential rate (P): SW Info ORC / RIS (retroactive issuance Y/N) not given');
        if (!has('ORC', 'DC')) c.warn(w, 'Preferential rate (P): SW Info ORC / DC (direct consignment Y/N) not given');
        const cooDoc = (m.supportingDocsModel || []).some(
          (sd) => str(sd.documentTypeCode).startsWith('861') && (num(sd.itemSerialNumber) === 0 || mine(sd)),
        );
        if (!cooDoc)
          c.err(
            w,
            'Preferential rate (P): the Certificate of Origin (e-Sanchit doc code 861xxx) is not attached at BE or item level',
          );
        // ICEGATE advisories - India-New Zealand FTA (from 20-Oct-2026: CoO under e-Sanchit code 861021 at item
        // level) and India-Oman CEPA (Advisory 33/2026: code 861020); both need the statement DEC / CUF02 (text blank)
        const cooCountry = coo ? str(coo.infoCode) : '';
        const fta = { NZ: ['861021', 'India-New Zealand FTA', true], OM: ['861020', 'India-Oman CEPA', false] }[
          cooCountry
        ];
        if (fta) {
          const [code, name, itemLevel] = fta;
          const docOk = (m.supportingDocsModel || []).some(
            (sd) =>
              str(sd.documentTypeCode) === code &&
              (itemLevel ? mine(sd) && num(sd.itemSerialNumber) > 0 : num(sd.itemSerialNumber) === 0 || mine(sd)),
          );
          if (!docOk)
            c.err(
              w,
              `${name}: the Certificate of Origin must be in e-Sanchit under document code ${code}${itemLevel ? ', declared at ITEM level' : ''}`,
            );
          if (
            !(m.statementModel || []).some((st) => str(st.statementType) === 'DEC' && str(st.statementCode) === 'CUF02')
          )
            c.err(w, `${name}: add the statement DEC / CUF02 (statement text blank) - Items > SW Statement`);
        }
      }
    }
  }

  for (const [i, mc] of (m.misc_chModel || []).entries()) {
    // the code is the key of the MISC_CH row (A..N); a blank one is rejected, not just doubtful
    if (!str(mc.miscChargesCode))
      c.err(
        `Misc charge ${i + 1} (invoice ${str(mc.invoiceSerialNumber)})`,
        `"${str(mc.miscChargesDscrptn)}" has no ICEGATE charge code - re-select the charge in 3. Invoices > Misc charges (not included)`,
      );
    else if (!/^[A-N]$/.test(str(mc.miscChargesCode).toUpperCase()))
      c.err(`Misc charge ${i + 1}`, `Charge code "${str(mc.miscChargesCode)}" is not one of the ICEGATE codes A-N`);
  }
  // Single Window statement / control codes.
  for (const [i, st] of (m.statementModel || []).entries()) {
    const w = `Statement ${i + 1} (${str(st.statementCode) || '?'})`;
    if (!['DEC', 'UTG', 'REM'].includes(str(st.statementType)))
      c.err(w, 'Statement type must be DEC, UTG or REM (now "' + str(st.statementType) + '")');
    if (!str(st.statementCode)) c.err(w, 'Statement code is empty');
    if (str(st.statementType) === 'REM' && !str(st.statementText)) c.err(w, 'REM statement needs the text');
  }
  for (const [i, ct] of (m.ctrlModel || []).entries()) {
    if (!str(ct.controlTypeCode) || /\s/.test(str(ct.controlTypeCode)))
      c.err(
        `SW Control ${i + 1}`,
        'Control type must be the ICEGATE code without spaces (now "' +
          str(ct.controlTypeCode) +
          '") - open the item SW Control popup',
      );
  }
  // item popups (licence, SVB, re-import).
  for (const [i, l] of (m.licenseModel || []).entries()) {
    const w = `Licence ${i + 1} (item ${str(l.itemSerialNumberInvoice)})`;
    if (!/^\d{1,10}$/.test(str(l.licenseRegistrationNumber))) c.err(w, 'Licence / Regn No must be up to 10 digits');
    if (!str(l.licenseRegistrationDate)) c.err(w, 'Licence date is mandatory');
    if (str(l.licenseRegnPort) && !/^[A-Z0-9]{6}$/.test(str(l.licenseRegnPort)))
      c.err(w, 'Regn Port must be 6 characters');
    if (!(num(l.debitValue) > 0) && !(num(l.debitQuantity) > 0)) c.warn(w, 'Debit value / quantity is empty');
  }
  // RSP slabs: each line needs a retail price, and the quantities of one item cannot exceed the item
  {
    const byItem = new Map();
    (m.rspModel || []).forEach((r, i) => {
      const w = `RSP ${i + 1} (invoice ${str(r.invoiceSerialNumber)} item ${str(r.itemSerialNumberInvoice)})`;
      if (!(num(r.rsp) > 0)) c.err(w, 'Retail sale price (RSP) must be more than 0');
      if (str(r.rspNotification) && !str(r.rspNotificationSrNo))
        c.err(w, 'RSP notification ' + str(r.rspNotification) + ': its Sr No is empty');
      const k = str(r.invoiceSerialNumber) + '/' + str(r.itemSerialNumberInvoice);
      byItem.set(k, (byItem.get(k) || 0) + num(r.quantity));
    });
    byItem.forEach((qty, k) => {
      const [iv, itm] = k.split('/');
      const it = items.find(
        (x) =>
          str(x.invoiceSerialNumber) === iv &&
          str(
            x.itemSerialNumberInvoice != null && x.itemSerialNumberInvoice !== ''
              ? x.itemSerialNumberInvoice
              : x.itemSerialNumber,
          ) === itm,
      );
      if (it && num(it.quantity) > 0 && qty > num(it.quantity) + 0.001)
        c.err(
          'RSP',
          'Invoice ' +
            iv +
            ' item ' +
            itm +
            ': the RSP lines add up to ' +
            qty +
            ', more than the item quantity ' +
            num(it.quantity),
        );
    });
  }
  // exemption (DEPB) rows: a notification needs its serial number (no invented "1")
  for (const [i, r] of (m.depbModel || []).entries()) {
    const w = `Exemption ${i + 1} (item ${str(r.itemSerialNumberInvoice || r.itemSrNo)})`;
    if (str(r.whetherExemption) === 'Y' && !str(r.bcdNotification))
      c.err(w, 'Exemption = Y but the notification no is empty');
    if (str(r.bcdNotification) && !str(r.bcdNotificationSrNo))
      c.err(
        w,
        'Notification ' +
          str(r.bcdNotification) +
          ': the Sr No of the notification entry is empty (Licence window > Exemption Sr No)',
      );
  }
  for (const [i, it] of items.entries()) {
    if (str(it.svbFlag) && !str(it.svbReferenceNumber))
      c.err(`Item ${i + 1}`, 'SVB load given but SVB Ref No is empty');
    // ICES refuses a re-import item without its RE-IMPORT row, so this is an error, not a warning
    if (
      str(it.whetherReimport) === 'Y' &&
      !(m.reimportModel || []).some(
        (r) =>
          str(r.itemSerialNumber) === str(it.itemSerialNumber) &&
          str(r.invoiceSerialNumber) === str(it.invoiceSerialNumber),
      )
    )
      c.err(`Item ${i + 1}`, 'Re-import = Y: enter the Shipping Bill details in the Re-Import popup');
  }
  for (const [i, r] of (m.reimportModel || []).entries()) {
    if (!/^\d{1,7}$/.test(str(r.shippingBillNo)))
      c.err(`Re-import ${i + 1}`, 'Shipping Bill No must be up to 7 digits');
    if (!str(r.shippingBillDate)) c.err(`Re-import ${i + 1}`, 'Shipping Bill Date is mandatory');
  }

  const igms = m.igmsModel || [];
  if (!igms.length && !exBond) c.warn('IGM', 'IGM details are empty');
  for (const [i, g] of igms.entries()) {
    const w = `IGM ${i + 1}`;
    if (!str(g.igmNumber) && str(be.whetherPriorBE) !== 'Y') c.warn(w, 'IGM No is empty (fine only for a prior BE)');
    c.date(w, g.igmDate, 'IGM Date', false, true);
    c.date(w, g.inwardDate, 'Inward Date', false, true);
    // the order of the dates - ICES refuses an inward date before the IGM, or a MAWB / BL dated after it
    {
      const d8 = (v) => (/^\d{8}$/.test(str(v)) ? str(v) : '');
      const ig = d8(g.igmDate),
        iw = d8(g.inwardDate),
        mw = d8(g.mawbDate),
        hw = d8(g.hawbDate);
      if (ig && iw && iw < ig) c.err(w, 'Inward date (' + iw + ') is before the IGM date (' + ig + ')');
      if (ig && mw && mw > ig) c.err(w, 'MAWB / BL date (' + mw + ') is after the IGM date (' + ig + ')');
      if (mw && hw && hw < mw) c.warn(w, 'HAWB / HBL date (' + hw + ') is before the MAWB / BL date (' + mw + ')');
      if (
        ig &&
        str(be.beDate) &&
        /^\d{8}$/.test(str(be.beDate)) &&
        str(be.beDate) < ig &&
        str(be.whetherPriorBE) !== 'Y'
      )
        c.warn(w, 'BE date is before the IGM date - a BE filed before the IGM is a prior BE (Prior BE = Y)');
    }
    // gateway IGM (sea cargo moved from the gateway port to an ICD): all three or none, and a real date
    {
      const gw = [str(g.gatewayIgmNo), str(g.gatewayIgmDate), str(g.gatewayPortCode)];
      if (gw.some(Boolean) && !gw.every(Boolean))
        c.err(
          w,
          'Gateway IGM: No, Date and Port code go together (now: ' +
            ['No', 'Date', 'Port'].filter((_, k) => gw[k]).join(', ') +
            ')',
        );
      if (gw[1]) c.date(w, g.gatewayIgmDate, 'Gateway IGM Date', false, true);
      if (gw[2] && !/^[A-Z0-9]{6}$/.test(gw[2].toUpperCase()))
        c.err(w, 'Gateway port code must be 6 characters (e.g. INNSA1)');
      // a sea job at an ICD is filed as mode L (as iCAFFE), so L at an ICD counts as sea here
      if (['S', 'L'].includes(str(be.modeOfTransport)) && str(h.receiverID).endsWith('6') && !gw[0])
        c.warn(
          w,
          'Sea BE at an ICD (' + str(h.receiverID) + '): the gateway IGM No / Date / Port are normally required',
        );
    }
    if (str(be.modeOfTransport) === 'A' && !str(g.mawbNo)) c.err(w, 'MAWB No is mandatory for Air');
    c.len(w, g.mawbNo, 'MAWB No', 20);
    c.len(w, g.hawbNo, 'HAWB No', 20);
    c.date(w, g.mawbDate, 'MAWB Date', false, true);
    c.date(w, g.hawbDate, 'HAWB Date', false, true);
    if (str(be.whetherPriorBE) === 'Y' && str(g.mawbNo) === 'NOMAWB' && !str(g.hawbNo))
      c.err(w, 'Prior BE without the MAWB: the HAWB No is needed');
    if (!(num(g.totalNoOfPackages) > 0)) c.err(w, 'Total Packages must be more than 0');
    if (!(num(g.grossWeight) > 0)) c.err(w, 'Gross Weight must be more than 0');
    // IGM line checks (ICEGATE errors 632-642): MAWB 11 digits for air, B/L at least 2 characters
    if (
      str(be.modeOfTransport) === 'A' &&
      str(g.mawbNo) &&
      str(g.mawbNo) !== 'NOMAWB' &&
      !/^\d{11}$/.test(str(g.mawbNo).replace(/[-\s]/g, ''))
    )
      c.warn(w, 'MAWB No is normally 11 digits (now "' + str(g.mawbNo) + '")'); // NOMAWB = prior BE without the master yet
    if (
      (str(be.modeOfTransport) === 'S' || (str(be.modeOfTransport) === 'L' && str(h.receiverID).endsWith('6'))) &&
      str(g.mawbNo).length < 2
    )
      c.err(w, 'B/L No must be at least 2 characters');
    if (!str(g.unitQuantityCode)) c.err(w, 'Weight unit is mandatory');
    if (!str(g.packageCode)) c.warn(w, 'Package code is empty (e.g. CTN, PKG)');
  }
  // containers: mandatory for sea BEs (not ex-bond / SEZ T, M).
  // also an ICD BE in mode L with a gateway IGM (sea cargo moved inland) - the iCAFFE / EagleView ICD file
  const icdSea =
    str(be.modeOfTransport) === 'L' &&
    str(((json && json.headerField) || {}).receiverID).endsWith('6') &&
    (m.igmsModel || []).some((g) => str(g.gatewayIgmNo));
  if (
    (str(be.modeOfTransport) === 'S' || icdSea) &&
    !exBond &&
    !['T', 'M'].includes(str(be.beType)) &&
    !(m.containerModel || []).length
  )
    c.err('Container', 'Sea BE: container details are mandatory (Job Header > Containers)');
  for (const [i, ct] of (m.containerModel || []).entries()) {
    const w = `Container ${i + 1}`;
    const no = str(ct.contNumber || ct.containerNo);
    if (!no) c.err(w, 'Container No is mandatory');
    else if (!/^[A-Z]{4}[0-9]{7}$/.test(no.toUpperCase()))
      c.warn(w, 'Container No usually is 4 letters + 7 digits (e.g. ABCU1234567)');
    else if (!isoCheck(no.toUpperCase()))
      c.warn(w, 'Container No ' + no + ': the check digit does not match (ISO 6346)');
    c.len(w, ct.sealNumber || ct.sealNo, 'Seal No', 10);
    if (
      (m.containerModel || []).findIndex(
        (x) => str(x.contNumber || x.containerNo).toUpperCase() === no.toUpperCase(),
      ) !== i
    )
      c.err(w, 'Container No ' + no + ' is given twice');
    if (str(ct.lclfcl) && !['L', 'F'].includes(str(ct.lclfcl).toUpperCase())) c.err(w, 'LCL/FCL must be L or F');
  }
  // e-Sanchit documents (SUPPORTINGDOCS, ICEGATE errors 822 / 827).
  const docs = m.supportingDocsModel || [];
  // the mandatory documents of iCAFFE's "Validate Job" (it stops the BE file without them): a transport document
  // at BE level and an invoice document at invoice level.
  // Test copy: 246 of 250 filed iCAFFE BEs have both (the other 4 have no document at all), and all 94 warehouse / ex-bond BEs.
  // iCAFFE does not ask it for every invoice: 36 of those 246 have the invoice document on one invoice of several.
  {
    const code = (sd) => str(sd.documentTypeCode).toUpperCase();
    const beLevel = (sd) => num(sd.invoiceSerialNumber) === 0 && num(sd.itemSerialNumber) === 0;
    const invLevel = (sd) => num(sd.invoiceSerialNumber) > 0 && num(sd.itemSerialNumber) === 0;
    if (!docs.some((sd) => BE_TRANSPORT_DOCS[code(sd)] && beLevel(sd))) {
      const other = docs.find((sd) => BE_TRANSPORT_DOCS[code(sd)]);
      c.err(
        'Documents',
        'e-Sanchit: no transport document at BE level. Attach the B/L or AWB with Doc. for = BE (all invoices), as one of: ' +
          Object.entries(BE_TRANSPORT_DOCS)
            .map(([k, v]) => k + ' ' + v)
            .join(', ') +
          (other ? ` (${code(other)} is attached at invoice / item level - change its Doc. for to BE)` : ''),
      );
    }
    if (!docs.some((sd) => BE_INVOICE_DOCS[code(sd)] && invLevel(sd))) {
      const other = docs.find((sd) => BE_INVOICE_DOCS[code(sd)]);
      c.err(
        'Documents',
        'e-Sanchit: no invoice document at invoice level. Attach the invoice with Doc. for = Invoice and its invoice no, as one of: ' +
          Object.entries(BE_INVOICE_DOCS)
            .map(([k, v]) => k + ' ' + v)
            .join(', ') +
          (other
            ? ` (${code(other)} is attached at ${beLevel(other) ? 'BE' : 'item'} level - change its Doc. for to Invoice)`
            : ''),
      );
    }
  }
  for (const [i, sd] of docs.entries()) {
    const w = `Document ${i + 1}`;
    if (!/^\d{16}$/.test(str(sd.imageReferenceNo))) c.err(w, 'IRN must be the 16-digit e-Sanchit number');
    if (!/^[0-9A-Z]{6}$/.test(str(sd.documentTypeCode).toUpperCase()))
      c.err(w, 'Document type code must be the 6-character e-Sanchit code');
    c.req(w, sd.icegateUserId, 'ICEGATE user id', 35);
    c.req(w, sd.documentIssuingPartyName, 'Issuing party name', 70);
    c.req(w, sd.placeOfIssue, 'Place of issue', 35);
    if (!validDate(sd.documentIssueDate)) c.err(w, 'Issue date is mandatory');
    c.req(w, sd.documentBeneficiaryPartyName, 'Beneficiary name', 70);
    c.req(w, sd.fileType, 'File type', 5);
    // The same IRN attached twice to the SAME invoice + item is dropped by the builder - say so.
    // The key is IRN + invoice + item, as the builder de-duplicates (IcegateJsonBuilder): one invoice PDF attached
    // to every item of the BE is not a duplicate.
    const dk = (x) => str(x.imageReferenceNo) + '|' + str(x.invoiceSerialNumber) + '|' + str(x.itemSerialNumber);
    if (docs.findIndex((x) => dk(x) === dk(sd)) !== i)
      c.warn(w, 'IRN ' + str(sd.imageReferenceNo) + ' is attached twice to the same item - only one copy is filed');
  }
  return c;
}

function validateSB(json, opts = {}) {
  const c = makeCollector();
  const h = (json && json.headerField) || {};
  const m = (json && json.master) || {};
  if (!str(h.senderID)) c.err('Header', 'ICEGATE ID (sender) missing - select an ICEGATE profile');
  if (!/^[A-Z0-9]{6}$/.test(str(h.receiverID))) c.err('Header', 'Customs port code must be 6 characters (e.g. INDEL4)');
  if (!(num(h.jobNumber) >= 1 && num(h.jobNumber) <= 9999999))
    c.err(
      'Header',
      !(num(h.jobNumber) >= 1)
        ? "Job number is blank - save the job first (the ICEGATE job number is the saved job's number)"
        : 'Job number must be 1 to 9999999 (numeric)',
    );

  if (str(h.jobDate) && !validDate(h.jobDate)) c.err('Header', 'Job Date is not a valid date');
  if (!['T', 'P'].includes(str(h.indicator))) c.err('Header', 'Indicator must be T (test) or P (production)');

  // amendment of a filed SB: ICEGATE finds the SB by port + job no + job date + CHA, so these must be
  // the ones of the first filing; the reason and type travel in the header.
  if (opts.amendment) {
    const A = 'Amendment';
    if (str(h.messageType) !== 'A') c.err(A, 'Message type must be A for an amendment');
    if (!str(opts.amendReason || h.amendmentReason)) c.err(A, 'Amendment reason is mandatory');
    else if (str(opts.amendReason || h.amendmentReason).length > 250)
      c.err(A, 'Amendment reason is too long (max 250 characters)');
    if (!str(opts.amendmentType || h.amendmentType)) c.warn(A, 'Amendment type is empty');
    if (!str(opts.sbNo))
      c.err(A, 'This job has no SB number yet - an amendment is only for a filed SB (enter the SB No / date first)');
    else if (!/^\d{7}$/.test(str(opts.sbNo))) c.warn(A, 'SB No ' + str(opts.sbNo) + ' is not 7 digits');
    if (str(opts.sbNo) && !str(opts.sbDate)) c.err(A, 'SB date is empty');
    c.warn(
      A,
      'Same job no / job date / port / CHA as the first filing are needed; ICEGATE JSON amendment was "under development" in the Mar-2026 advisory - check that it is open before sending',
    );
  }
  const sb = (m.sbModel || [])[0];
  if (!sb) {
    c.err('SB', 'Shipping bill details missing');
    return c;
  }
  const mode = str(opts.mode).toUpperCase().slice(0, 1); // A / S / L (screen Shipment Mode)
  const W = 'Exporter';
  c.req(W, sb.chaLicenseNumber, 'CHA Licence No', 15);
  if (c.req(W, sb.importerExporterCode, 'IEC Code') && !IEC.test(str(sb.importerExporterCode).toUpperCase()))
    c.err(W, 'IEC Code must be 10 letters/digits');
  if (!/^\d{1,3}$/.test(str(sb.branchSrNoOfExporter))) c.err(W, 'Branch Sr. No. is mandatory (0 - 999, as in the IEC)');
  c.req(W, sb.impExpName, 'Exporter Name', 50);
  c.req(W, sb.impExpAddress1, 'Exporter Address 1', 35);
  c.len(W, sb.impExpAddress2, 'Exporter Address 2', 35);
  // production SB files often leave city / PIN empty (ICEGATE takes the address of the IEC branch): warnings.
  if (!str(sb.impExpCity)) c.warn(W, 'Exporter City is empty');
  else c.len(W, sb.impExpCity, 'City', 35);
  c.len(W, sb.impExpState, 'State', 25);
  if (!str(sb.impExpPin)) c.warn(W, 'Exporter PIN is empty');
  else if (!PIN6.test(str(sb.impExpPin))) c.err(W, 'PIN must be 6 digits');
  if (!['R', 'F'].includes(str(sb.typeOfExporter))) c.warn(W, 'Type of Exporter should be R or F');
  if (!['P', 'G'].includes(str(sb.exporterClass))) c.warn(W, 'Exporter Class should be P or G');
  if (str(sb.stateOfOriginExporter) && str(sb.stateOfOriginExporter).length > 2)
    c.err(W, 'State of Origin must be a 2-character code');
  if (!str(sb.authorizedDealerCode))
    c.warn(W, 'AD Code is empty (needed for foreign exchange / drawback / IGST refund)');
  // SB Header > Other Details > EPZ/ICD goes as epzCode (1 character); a longer entry is not sent
  if (str(opts.epzTyped) && str(opts.epzTyped).length !== 1)
    c.warn(
      W,
      `EPZ/ICD "${str(opts.epzTyped)}" is not sent - the SB takes a 1-character EPZ code (leave the box empty when there is none)`,
    );
  c.len(W, sb.authorizedDealerCode, 'AD Code', 10);
  if (str(sb.gstnType).toUpperCase().startsWith('GST') && str(sb.gstnId) && !GSTIN.test(str(sb.gstnId).toUpperCase()))
    c.err(W, 'GSTIN format is wrong (15 characters)');
  if (!str(sb.gstnId)) c.warn(W, 'GSTIN is empty');
  // SB message format v3.5 / ICEGATE notes
  if (!str(sb.stateOfOriginExporter)) c.err(W, 'State of Origin is mandatory (SB Header > Port Details)');
  if (str(sb.gstnType) && !['GSN', 'GSG', 'GSD', 'PAN', 'TAN', 'PSP', 'ADH'].includes(str(sb.gstnType)))
    c.err(W, 'GSTN Type must be GSN, GSG, GSD, PAN, TAN, PSP or ADH');
  if (
    str(sb.gstnType) === 'GSN' &&
    GSTIN.test(str(sb.gstnId).toUpperCase()) &&
    IEC.test(str(sb.importerExporterCode).toUpperCase()) &&
    /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(str(sb.importerExporterCode).toUpperCase()) &&
    str(sb.gstnId).toUpperCase().slice(2, 12) !== str(sb.importerExporterCode).toUpperCase()
  )
    c.err(
      W,
      'PAN in the GSTIN (' +
        str(sb.gstnId).slice(2, 12) +
        ') does not match the IEC (' +
        str(sb.importerExporterCode) +
        ')',
    );
  if (str(sb.gstnType) === 'PAN' && str(sb.gstnId) && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(str(sb.gstnId).toUpperCase()))
    c.err(W, 'PAN must be 10 characters (AAAAA9999A)');

  const C = 'Consignee';
  c.req(C, sb.consigneeName, 'Consignee Name', 35);
  c.req(C, sb.consigneeAddress1, 'Consignee Address 1', 35);
  c.len(C, sb.consigneeAddress2, 'Consignee Address 2', 35);
  if (!CC2.test(str(sb.consigneeCountry))) c.err(C, 'Consignee Country must be a 2-letter code (e.g. US)');
  else if (str(sb.consigneeCountry) === 'IN')
    c.warn(C, 'Consignee Country is India - check (allowed only for SEZ / special cases)');

  const P = 'Ports';
  if (!/^[A-Z0-9]{6}$/.test(str(sb.portOfLoading)))
    c.err(P, 'Port of Loading must be a 6-character code (e.g. INDEL4)');
  c.req(P, sb.portOfFinalDestination, 'Port of Final Destination', 6);
  if (!CC2.test(str(sb.countryOfFinalDestination))) c.err(P, 'Country of Final Destination must be a 2-letter code');
  if (!str(sb.portOfDischarge)) c.err(P, 'Port of Discharge is mandatory');
  else c.len(P, sb.portOfDischarge, 'Port of Discharge', 6);
  if (!CC2.test(str(sb.countryOfDischarge))) c.err(P, 'Country of Discharge is mandatory (2-letter code)');
  // air SBs carry the 3-letter airport code (production files: PAR, FLO ...), sea the 5-character UN/LOCODE.
  const pfd = str(sb.portOfFinalDestination);
  if (pfd && ![3, 5, 6].includes(pfd.length))
    c.warn(
      P,
      'Port of Final Destination should be a 3-letter airport code or a 5-character port code (e.g. DXB / AEDXB)',
    );
  if (mode === 'S' && pfd.length === 3)
    c.warn(
      P,
      'Sea shipment: Port of Final Destination ' + pfd + ' looks like an airport code - use the 5-character port code',
    );
  if (
    CC2.test(str(sb.countryOfFinalDestination)) &&
    pfd.length >= 5 &&
    /^[A-Z]{2}/.test(pfd) &&
    str(sb.portOfFinalDestination).slice(0, 2) !== str(sb.countryOfFinalDestination)
  )
    c.warn(
      P,
      'Port of Final Destination ' +
        str(sb.portOfFinalDestination) +
        ' is not in country ' +
        str(sb.countryOfFinalDestination),
    );

  const G = 'Packages';
  if (!(num(sb.totalNumberOfPackages) > 0)) c.err(G, 'Total Packages must be more than 0');
  if (!(num(sb.grossWeight) > 0)) c.err(G, 'Gross Weight must be more than 0');
  if (!(num(sb.netWeight) > 0)) c.err(G, 'Net Weight must be more than 0');
  if (num(sb.netWeight) > num(sb.grossWeight) && num(sb.grossWeight) > 0)
    c.err(G, 'Net Weight cannot be more than Gross Weight');
  c.req(G, sb.unitOfMeasurement, 'Weight Unit', 3);
  c.len(G, sb.marksNumbers, 'Marks & Numbers', 300);
  if (str(sb.sealType) && !['A', 'W', 'S'].includes(str(sb.sealType))) c.err(G, 'Seal Type must be A, W or S');
  const noc = str(sb.natureOfCargo);
  // production SB files (air and sea) are filed with it empty: a warning when empty, an error only for a wrong code.
  if (!noc) c.warn(G, 'Nature of Cargo is empty (C, CP, P, LB or DB - SB2 Details)');
  else if (!['C', 'CP', 'P', 'LB', 'DB'].includes(noc))
    c.err(G, 'Nature of Cargo must be C, CP, P, LB or DB (now "' + noc + '")');
  else if (mode === 'A' && noc !== 'P') c.err(G, 'Air shipment: Nature of Cargo must be P (packaged)');
  if (['C', 'CP'].includes(noc) && !(m.containerModel || []).length)
    c.err(G, 'Nature of Cargo ' + noc + ' (containerised): add the containers (SB Header > Containers)');
  if (mode === 'A' && !str(sb.mawbnumber)) c.warn(G, 'MAWB No is empty (air shipment)');
  if (!str(sb.marksNumbers)) c.warn(G, 'Marks & Numbers are empty');
  for (const [i, ct] of (m.containerModel || []).entries()) {
    const w = `Container ${i + 1}`;
    if (!str(ct.containerNumber)) c.err(w, 'Container No is mandatory');
    else if (!/^[A-Z]{4}[0-9]{7}$/.test(str(ct.containerNumber).toUpperCase()))
      c.warn(w, 'Container No ' + str(ct.containerNumber) + ' is not in the ISO format (4 letters + 7 digits)');
    if (str(ct.containerSize) && !/^(20|40|45)/.test(str(ct.containerSize)))
      c.warn(w, 'Container size should be 20 / 40 / 45');
    if (str(ct.sealDate) && !validDate(ct.sealDate)) c.err(w, 'Seal Date is not a valid date');
    // ISO 6346 check digit; factory stuffed containers are self-sealed (e-seal).
    if (
      mode !== 'A' &&
      /^[A-Z]{4}\d{7}$/.test(str(ct.containerNumber).toUpperCase()) &&
      !isoCheck(str(ct.containerNumber).toUpperCase())
    )
      c.warn(
        w,
        'Container No ' + str(ct.containerNumber) + ': the check digit does not match (ISO 6346) - check the number',
      );
    if (str(((m.stuffModel || [])[0] || {}).factoryStuffed) === 'Y' && !str(ct.exciseSealNo))
      c.warn(w, 'Factory stuffed: the seal (e-seal) number of the container is empty');
    if (
      (m.containerModel || []).findIndex(
        (x) => str(x.containerNumber).toUpperCase() === str(ct.containerNumber).toUpperCase(),
      ) !== i
    )
      c.err(w, 'Container No ' + str(ct.containerNumber) + ' is given twice');
  }
  c.len(G, sb.mawbnumber, 'MAWB No', 15);
  c.len(G, sb.hawbnumber, 'HAWB No', 15);

  const invs = m.invoiceModel || [];
  if (!invs.length) c.err('Invoice', 'At least one invoice is required');
  for (const [i, inv] of invs.entries()) {
    const w = `Invoice ${i + 1}`;
    c.req(w, inv.actualInvoiceNo, 'Invoice No', 17);
    c.date(w, inv.invoiceDate, 'Invoice Date', true, true);
    if (!CUR3.test(str(inv.invoiceCurrency))) c.err(w, 'Currency must be a 3-letter code (e.g. USD)');
    if (!['CIF', 'CF', 'CI', 'FOB'].includes(str(inv.natureOfContract).toUpperCase()))
      c.err(w, 'Nature of Contract must be CIF, CF, CI or FOB');
    if (str(inv.natureOfPayment) && !['DP', 'AP', 'LC', 'DA', 'NA'].includes(str(inv.natureOfPayment).toUpperCase()))
      c.err(w, 'Nature of Payment must be DP, AP, LC, DA or NA');
    c.req(w, inv.buyerName, 'Buyer Name', 35);
    c.req(w, inv.buyerAddress1, 'Buyer Address 1', 35);
    c.len(w, inv.thirdPartyName, 'Third Party Name', 70);
    if (str(inv.thirdPartCountryCode) && !CC2.test(str(inv.thirdPartCountryCode)))
      c.err(w, 'Third Party Country must be a 2-letter code');
    if (validDate(inv.invoiceDate)) {
      const d0 = new Date(
        Date.UTC(
          +str(inv.invoiceDate).slice(0, 4),
          +str(inv.invoiceDate).slice(4, 6) - 1,
          +str(inv.invoiceDate).slice(6, 8),
        ),
      );
      if ((Date.now() - d0) / 86400000 > 366) c.err(w, 'Invoice Date is more than 1 year old');
    }
    const noc2 = str(inv.natureOfContract).toUpperCase();
    if (['CIF', 'CF'].includes(noc2) && !(num(inv.freightAmount) > 0)) c.err(w, 'Freight is mandatory for ' + noc2);
    if (['CIF', 'CI'].includes(noc2) && !(num(inv.insuranceAmount) > 0) && !(num(inv.insuranceRate) > 0))
      c.err(w, 'Insurance (amount or rate) is mandatory for ' + noc2);
    if (str(inv.addFreight) && !['F', 'I', 'N', 'B'].includes(str(inv.addFreight)))
      c.err(w, 'Add Freight must be F, I, N or B');
    else if (
      { CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' }[noc2] &&
      str(inv.addFreight) !== { CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' }[noc2]
    )
      c.warn(
        w,
        'Add Freight is ' +
          str(inv.addFreight) +
          '; ICEGATE advisory: ' +
          noc2 +
          ' = ' +
          { CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' }[noc2],
      );
    if (!str(inv.natureOfPayment)) c.err(w, 'Nature of Payment is mandatory');
    // iCAFFE filed SB 26628 with 180 days, so 180 and more are allowed. Days, up to 3 digits; more than
    // 270 days (9 months, the usual FEMA realisation period; RBI has allowed 15 months for some shipments) is a warning.
    if (str(inv.periodOfPayment) && !/^\d{1,3}$/.test(str(inv.periodOfPayment)))
      c.err(w, 'Payment period must be in days, up to 3 digits (now "' + str(inv.periodOfPayment) + '")');
    else if (num(inv.periodOfPayment) > 270)
      c.warn(
        w,
        'Payment period ' +
          str(inv.periodOfPayment) +
          ' days is more than 9 months - check the export realisation period allowed by RBI',
      );
    if (str(inv.thirdPartyName) && (!str(inv.thirdPartyAddress1) || !CC2.test(str(inv.thirdPartCountryCode))))
      c.err(w, 'Third party: Address 1 and country code are mandatory');
    if (str(inv.freightCurrency) && !CUR3.test(str(inv.freightCurrency)))
      c.err(w, 'Freight currency must be a 3-letter code');
    const nonStd =
      (opts.invoices || [])[i] && String((opts.invoices || [])[i].nonStandardCurr || '').toUpperCase() === 'Y';
    if (nonStd && !(m.exchangeModel || []).some((x) => str(x.invoiceCurrencyCode) === str(inv.invoiceCurrency)))
      c.err(w, 'Non-standard currency ' + str(inv.invoiceCurrency) + ': enter its exchange rate (Invoices tab)');
  }

  // the same exchange-rate checks as the BE side: a 0 rate, or a Japanese Yen / Korean Won rate in the
  // wrong units - CBIC notifies those two in Schedule II, per 100 units, and a per-100 figure filed as "per 1" puts
  // the FOB (and the drawback and RoDTEP worked out on it) 100 times out.
  (m.exchangeModel || []).forEach((e) => {
    const cur = str(e.invoiceCurrencyCode).toUpperCase();
    if (!cur || cur === 'INR') return;
    if (!(num(e.rate) > 0)) {
      c.err('Exchange Rate', 'Exchange rate for ' + cur + ' is 0 - set it on the Invoices tab');
      return;
    }
    if (!['JPY', 'KRW'].includes(cur)) return;
    const unit = num(e.unitInRs) || 1;
    const per = num(e.rate) / unit;
    if (per > 5 || per < 0.01)
      c.err(
        'Exchange Rate',
        cur +
          ' comes to Rs ' +
          Math.round(per * 10000) / 10000 +
          ' a unit (rate ' +
          str(e.rate) +
          ' per ' +
          unit +
          '). CBIC notifies ' +
          cur +
          ' per 100 units - enter the notified figure, which is kept with Unit in Rs. 100, else the FOB comes out 100 times out',
      );
  });
  // every invoice currency needs an exchange row (an item FOB in rupees cannot be worked out without one)
  for (const [i, inv] of invs.entries()) {
    const cur = str(inv.invoiceCurrency).toUpperCase();
    if (!cur || cur === 'INR') continue;
    if (!(m.exchangeModel || []).some((x) => str(x.invoiceCurrencyCode).toUpperCase() === cur))
      c.err(`Invoice ${i + 1}`, 'No exchange rate for ' + cur + ' (Invoices tab)');
  }

  const items = m.itemModel || [];
  if (!items.length) c.err('Item', 'At least one item is required');
  // every invoice needs items, every item an invoice, no item number twice
  for (const [i] of invs.entries())
    if (!items.some((it) => (num(it.invoiceSerialNumber) || 1) === i + 1))
      c.err(`Invoice ${i + 1}`, 'Invoice has no item (Items tab)');
  const seenItem = new Set();
  for (const it of items) {
    const k = `${num(it.invoiceSerialNumber) || 1}/${num(it.itemSerialNumberInvoice)}`;
    if ((num(it.invoiceSerialNumber) || 1) > invs.length)
      c.err(`Item ${k}`, 'Invoice ' + (num(it.invoiceSerialNumber) || 1) + ' does not exist');
    if (seenItem.has(k)) c.err(`Item ${k}`, 'Item number used twice in the invoice - use Arrange Item Serial No');
    seenItem.add(k);
  }
  const schemes = new Set(items.map((it) => str(it.schemeCode)));
  if (schemes.has('99') && schemes.size > 1)
    c.err('Item', 'Scheme 99 (NFEI) cannot be mixed with other schemes in one SB');
  const infoOf = (it) =>
    (m.infoType || []).filter(
      (r) =>
        (num(r.invoiceSerialNumber) || 1) === (num(it.invoiceSerialNumber) || 1) &&
        num(r.itemSerialNumber) === num(it.itemSerialNumberInvoice),
    );
  for (const [i, it] of items.entries()) {
    const w = `Item ${i + 1}`;
    if (!/^\d{2}$/.test(str(it.schemeCode))) c.err(w, 'Scheme Code must be 2 digits (e.g. 00, 19, 60)');
    if (!RITC8.test(str(it.ritcCode))) c.err(w, 'RITC must be exactly 8 digits');
    c.req(w, it.descOfGoods1, 'Description', 40);
    if (!(num(it.quantity) > 0)) c.err(w, 'Quantity must be more than 0');
    if (!(num(it.unitPrice) > 0)) c.err(w, 'Unit Price must be more than 0');
    c.req(w, it.unitOfMeasurement, 'UQC', 3);
    if (str(it.igstPaymentStatus) === 'P' && !(num(it.igstAmount) > 0)) c.err(w, 'IGST paid (P) but IGST Amount is 0');
    if (!str(it.igstPaymentStatus)) c.err(w, 'IGST Pay Status is mandatory (NA / LUT / P)');
    else if (!['LUT', 'P', 'NIL', 'NA'].includes(str(it.igstPaymentStatus)))
      c.err(w, 'IGST Pay Status must be NA, LUT or P (now "' + str(it.igstPaymentStatus) + '")');
    if (str(it.igstPaymentStatus) === 'P' && !(num(it.taxableValue) > 0))
      c.err(w, 'IGST paid (P) but Taxable Value is 0');
    if (
      str(it.igstPaymentStatus) &&
      str(it.igstPaymentStatus) !== 'P' &&
      (num(it.igstAmount) > 0 || num(it.taxableValue) > 0)
    )
      c.warn(w, 'Taxable value / IGST amount are only for IGST paid (P)');
    if (!str(it.endUseOfItem)) c.err(w, 'End Use is mandatory (e.g. GNX100)');
    c.req(w, it.unitOfRate, 'Rate Unit', 3);
    if (!(num(it.noOfUnit) > 0)) c.err(w, 'Per (no. of units) must be more than 0');
    if (!['Y', 'N'].includes(str(it.rewardItem))) c.err(w, 'Reward item must be Y or N');
    const rdt = infoOf(it).find((r) => str(r.infoType) === 'DTY' && str(r.infoQualifier) === 'RDT');
    // production files: scheme 19 items carry DTY/RDT (RODTEPY + statement RD001, or RODTEPN); scheme 60 (RoSCTL) reward
    // items have no RDT row but statement RS001; reward item N with RODTEPY also occurs.
    const stmtOf = (code) =>
      (m.statement || []).some(
        (s) =>
          (num(s.invoiceSerialNumber) || 1) === (num(it.invoiceSerialNumber) || 1) &&
          num(s.itemSerialNumber) === num(it.itemSerialNumberInvoice) &&
          str(s.statementCode).toUpperCase() === code,
      );
    const rodtepY = rdt && str(rdt.infoCode) === 'RODTEPY';
    if (str(it.rewardItem) === 'Y' && str(it.schemeCode) !== '60' && !rodtepY)
      c.err(w, 'RoDTEP claimed: SW Info DTY / RDT / RODTEPY is missing (Scheme > RoDTEP or SW Info)');
    if (str(it.schemeCode) === '60' && str(it.rewardItem) === 'Y' && !rodtepY && !stmtOf('RS001'))
      c.warn(w, 'Scheme 60 reward item: RoSCTL declaration statement RS001 is missing (Items > SW Statement)');
    if (rodtepY && !stmtOf('RD001'))
      c.warn(w, 'RODTEPY: RoDTEP declaration statement RD001 is missing (Items > SW Statement)');
    if (rdt && !['RODTEPY', 'RODTEPN'].includes(str(rdt.infoCode)))
      c.err(w, 'SW Info DTY / RDT code must be RODTEPY or RODTEPN');
    if (str(it.schemeCode) === '19' && !rdt) c.warn(w, 'Scheme 19: SW Info DTY / RDT (RODTEPY or RODTEPN) is missing');
    const has = (t, q) => infoOf(it).some((r) => str(r.infoType) === t && str(r.infoQualifier) === q);
    if (!has('CHR', 'SQC')) c.warn(w, 'SW Info CHR / SQC (statistical quantity) is missing');
    // an item whose unit is not the unit of the tariff / RoDTEP schedule gets its SQC row in the schedule unit
    // with the quantity left to the operator - warn instead of filing it empty
    {
      const sqc = infoOf(it).find((r) => str(r.infoType) === 'CHR' && str(r.infoQualifier) === 'SQC');
      if (sqc && !(num(sqc.infoMeasure) > 0))
        c.err(
          w,
          `SW Info CHR / SQC quantity is empty - enter the quantity of this item in ${str(sqc.infouqc) || 'the tariff unit'} (Items > SW Info)`,
        );
      const rdtq = infoOf(it).find((r) => str(r.infoType) === 'DTY' && str(r.infoQualifier) === 'RDT');
      if (rdtq && str(rdtq.infoCode) === 'RODTEPY' && !(num(rdtq.infoMeasure) > 0))
        c.err(
          w,
          `SW Info DTY / RDT (RODTEPY) quantity is empty - enter the quantity in ${str(rdtq.infouqc) || 'the RoDTEP schedule unit'} (Items > SW Info)`,
        );
    }
    if (!has('ORC', 'STO'))
      c.err(w, 'SW Info ORC / STO (state of origin) is missing - pick the Source State of the item');
    if (!has('ORC', 'DOO'))
      c.err(w, 'SW Info ORC / DOO (district of origin) is missing - pick the District of the item');
    const sto = infoOf(it).find((r) => str(r.infoType) === 'ORC' && str(r.infoQualifier) === 'STO');
    if (sto && !/^\d{1,2}$/.test(str(sto.infoCode)))
      c.err(w, 'SW Info ORC / STO code must be the state code (e.g. 07), now "' + str(sto.infoCode) + '"');
    if (!has('ORC', 'EPT')) c.warn(w, 'SW Info ORC / EPT (export preference, e.g. NCPTI) is missing');
    if (!has('DTY', 'GCESS')) c.warn(w, 'SW Info DTY / GCESS (GST compensation cess, 0 INR when none) is missing');
    if (!(num(it.presentMarketValue) > 0)) c.warn(w, 'PMV (present market value) is 0');
  }

  // Scheme tab: drawback / licence / AR4 rows must point to an item of the SB, and the fields ICEGATE needs.
  const itemKey = new Set(items.map((it) => `${num(it.invoiceSerialNumber) || 1}/${num(it.itemSerialNumberInvoice)}`));
  const keyOf = (r) => `${num(r.invoiceSerialNumber) || 1}/${num(r.itemSerialNumberInvoice)}`;
  for (const [i, it] of items.entries()) {
    if (str(it.schemeCode) === '19' && !(m.dbkModel || []).some((d) => keyOf(d) === keyOf(it)))
      c.err(`Item ${i + 1}`, 'Scheme 19 (Drawback): enter the DBK No and Qty in Scheme > Dbk');
  }
  for (const [i, d] of (m.dbkModel || []).entries()) {
    const w = `Drawback ${i + 1} (inv ${num(d.invoiceSerialNumber) || 1} item ${num(d.itemSerialNumberInvoice)})`;
    if (!itemKey.has(keyOf(d))) c.err(w, 'No item with this invoice / item number');
    c.req(w, d.dbkScheduleNumber, 'DBK No', 15);
    if (!(num(d.drawbackQuantity) > 0)) c.err(w, 'DBK Qty must be more than 0');
    if (str(d.drawbackAvailable) && !['Y', 'N'].includes(str(d.drawbackAvailable)))
      c.err(w, 'Drawback Available must be Y or N');
  }
  for (const [i, l] of (m.licenceModel || []).entries()) {
    const w = `Licence ${i + 1} (inv ${num(l.invoiceSerialNumber) || 1} item ${num(l.itemSerialNumberInvoice)})`;
    if (!itemKey.has(keyOf(l))) c.err(w, 'No item with this invoice / item number');
    c.req(w, l.registrationNo, 'Reg No', 25);
    if (!str(l.registrationDate)) c.err(w, 'Reg Date is mandatory');
    c.req(w, l.itemSerialNoInPartE, 'Item Sr in Part E', 10);
    c.req(w, l.itemSerialNoInPartC, 'Item Sr in Part C', 10);
    if (!(num(l.quantity) > 0)) c.err(w, 'Qty must be more than 0');
    if (!(num(l.exportQuantity) > 0)) c.err(w, 'Export Qty must be more than 0');
    if (!['M', 'I'].includes(str(l.whetherIndigenousImported)))
      c.err(w, 'Ind/Imp must be M (imported) or I (indigenous)');
  }
  // drawback with suffix A / C needs the DBK declaration statement (DB001 / DB002 / DB003).
  if (
    (m.dbkModel || []).some((d) => /[AC]$/i.test(str(d.dbkScheduleNumber))) &&
    !(m.statement || []).some((s) => /^DB00[123]$/.test(str(s.statementCode).toUpperCase()))
  )
    c.err(
      'Drawback',
      'DBK No with suffix A / C: add the drawback declaration statement DB001 / DB002 / DB003 (Items > SW Statement)',
    );
  // supporting documents (e-Sanchit): fields ICEGATE needs
  if (!(m.supportingDocs || []).length)
    c.warn('Documents', 'No supporting document (e-Sanchit) - invoice and packing list are usually needed');
  for (const [i, sd] of (m.supportingDocs || []).entries()) {
    const w = `Document ${i + 1}`;
    if (!/^\d{16}$/.test(str(sd.imageReferenceNumber))) c.err(w, 'IRN must be the 16-digit e-Sanchit number');
    if (!/^[0-9A-Z]{6}$/.test(str(sd.documentTypeCode).toUpperCase()))
      c.err(w, 'Document type code must be the 6-character e-Sanchit code (e.g. 380000, 022CO1)');
    c.req(w, sd.documentIssuingPartyName, 'Issuing party name', 70);
    c.req(w, sd.placeOfIssue, 'Place of issue', 35);
    if (!validDate(sd.documentIssueDate)) c.err(w, 'Issue date is mandatory');
    c.req(w, sd.documentBeneficiaryPartyName, 'Beneficiary name', 70);
    c.req(w, sd.fileType, 'File type', 5);
  }
  for (const [i, a] of (m.ar4Model || []).entries()) {
    const w = `AR4 ${i + 1} (inv ${num(a.invoiceSerialNumber) || 1} item ${num(a.itemSerialNumberInvoice)})`;
    c.req(w, a.ar4Number, 'AR4 No', 17);
    if (!/^\d{8}$/.test(str(a.ar4Date))) c.err(w, 'AR4 Date is mandatory');
    c.req(w, a.commissionerate, 'Commissionerate', 20);
    c.req(w, a.division, 'Division', 20);
    c.req(w, a.range, 'Range', 20);
  }
  // Items tab detail windows: manufacturer, accessories, cess, third party, SW constituent / production / control.
  const itemNo = (r) =>
    `${num(r.invoiceSerialNumber) || 1}/${num(r.itemSerialNumberInvoice != null ? r.itemSerialNumberInvoice : r.itemSerialNumber)}`;
  const tag = (name, r, k) =>
    `${name} ${k + 1} (inv ${num(r.invoiceSerialNumber) || 1} item ${num(r.itemSerialNumberInvoice != null ? r.itemSerialNumberInvoice : r.itemSerialNumber)})`;
  for (const [i, it] of items.entries()) {
    const w = `Item ${i + 1} (inv ${num(it.invoiceSerialNumber) || 1} item ${num(it.itemSerialNumberInvoice)})`;
    const mf = [
      'itemManufacturerProducerCodeType',
      'itemManufacturerProducerGrowerCode',
      'itemManufacturerProducerGrowerAddress1',
      'itemManufacturerProducerGrowerCity',
      'itemManufacturerCountry',
    ];
    if (mf.some((k) => str(it[k]))) {
      if (!str(it.itemManufacturerProducerCodeType)) c.err(w, 'Manufacturer code type is empty (Items > Manufacturer)');
      if (!str(it.itemManufacturerProducerGrowerCode)) c.err(w, 'Manufacturer code is empty (Items > Manufacturer)');
      if (!str(it.itemManufacturerProducerGrowerAddress1)) c.err(w, 'Manufacturer address 1 is empty');
      if (!str(it.itemManufacturerProducerGrowerCity)) c.err(w, 'Manufacturer city is empty');
      if (!CC2.test(str(it.itemManufacturerCountry)))
        c.err(w, 'Manufacturer country must be a 2-letter code (e.g. IN)');
    }
    if (str(it.transitCountry) && !CC2.test(str(it.transitCountry)))
      c.err(w, 'Transit country must be a 2-letter code');
    if (str(it.accessoryStatus) && !['0', '1', '2'].includes(str(it.accessoryStatus)))
      c.warn(w, 'Accessory status should be 0, 1 or 2 (now "' + str(it.accessoryStatus) + '")');
    if (
      ['1', '2'].includes(str(it.accessoryStatus)) &&
      !(m.itemAccessModel || []).some((a) => itemNo(a) === itemNo(it))
    )
      c.err(w, 'Accessory status ' + str(it.accessoryStatus) + ' but no accessory description (Items > Accessory)');
    if (str(it.thirdParty) === 'Y' && !(m.thirdPartyModel || []).some((t) => itemNo(t) === itemNo(it)))
      c.err(w, 'Third party = Y but the third party exporter is not filled (Items > Third Party)');
  }
  const keys = new Set(items.map(itemNo));
  const own = (w, r) => {
    if (!keys.has(itemNo(r))) c.err(w, 'No item with this invoice / item number');
  };
  for (const [k, a] of (m.itemAccessModel || []).entries()) {
    const w = tag('Accessory', a, k);
    own(w, a);
    c.req(w, a.descriptionOfAccessories, 'Description of accessories', 500);
  }
  for (const [k, r] of (m.cessModel || []).entries()) {
    const w = tag('Cess', r, k);
    own(w, r);
    c.req(w, r.cessActCode, 'Cess act code', 10);
    if (!(num(r.quantity) > 0)) c.err(w, 'Cess quantity must be more than 0');
  }
  for (const [k, t] of (m.thirdPartyModel || []).entries()) {
    const w = tag('Third party', t, k);
    own(w, t);
    if (!IEC.test(str(t.iec).toUpperCase())) c.err(w, 'IEC must be 10 letters/digits');
    c.req(w, t.exporterName, 'Exporter name', 50);
    c.req(w, t.exporterAddress1, 'Address 1', 50);
    c.req(w, t.city, 'City', 35);
    if (!PIN6.test(str(t.pin))) c.err(w, 'PIN must be 6 digits');
    if (!['GSN', 'GSG', 'GSD', 'PAN', 'TAN', 'PSP', 'ADH'].includes(str(t.gstnType)))
      c.err(w, 'GSTN type must be GSN, GSG, GSD, PAN, TAN, PSP or ADH');
    c.req(w, t.gstnId, 'GSTN id', 20);
    if (str(t.gstnType) === 'GSN' && str(t.gstnId) && !GSTIN.test(str(t.gstnId).toUpperCase()))
      c.err(w, 'GSTIN format is wrong (15 characters)');
  }
  for (const [k, r] of (m.constituentFinal || []).entries()) {
    const w = tag('SW Constituent', r, k);
    own(w, r);
    c.req(w, r.constituentElementName, 'Element name', 256);
    if (!(num(r.constituentPercentage) > 0 && num(r.constituentPercentage) <= 100))
      c.err(w, 'Percentage must be more than 0 and up to 100');
    if (num(r.constituentYieldPercentage) > 100) c.err(w, 'Yield % can not be more than 100');
  }
  for (const [k, r] of (m.production || []).entries()) {
    const w = tag('SW Production', r, k);
    own(w, r);
    c.req(w, r.productionBatchIdentifier, 'Batch id', 17);
    if (!(num(r.productionBatchQuantity) > 0)) c.err(w, 'Batch quantity must be more than 0');
    c.req(w, r.unitQuantityCode, 'UQC', 3);
    if (!/^\d{8}$/.test(str(r.dateOfManufacturing))) c.err(w, 'Manufacturing date is mandatory');
    if (/^\d{8}$/.test(str(r.dateOfExpiry)) && str(r.dateOfExpiry) < str(r.dateOfManufacturing))
      c.err(w, 'Expiry date is before the manufacturing date');
  }
  for (const [k, r] of (m.controlType || []).entries()) {
    const w = tag('SW Control', r, k);
    own(w, r);
    if (!str(r.controlTypeCode) || /\s/.test(str(r.controlTypeCode)))
      c.err(w, 'Control type code is empty or has spaces');
    if (
      /^\d{8}$/.test(str(r.controlStartDate)) &&
      /^\d{8}$/.test(str(r.controlEndDate)) &&
      str(r.controlEndDate) < str(r.controlStartDate)
    )
      c.err(w, 'End date is before the start date');
  }
  return c;
}

function validateIcegateJson(kind, json, opts = {}) {
  const c = kind === 'SB' ? validateSB(json, opts) : validateBE(json, opts);
  return { ok: c.errors.length === 0, errors: c.errors, warnings: c.warnings };
}

export { validateIcegateJson };
