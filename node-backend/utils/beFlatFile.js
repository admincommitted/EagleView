// ICES 1.5 Bill of Entry flat file (.be), message CACHI01 - writer and reader (29-Oct-2026).
// Layout checked against two production .be files from another ERP:
// - fields separated by ASCII 29 (GS), records end with CRLF, sections start with "<TABLE>NAME", file ends "<END-BE>"
//   and "TREC<GS><control no>";
// - HREC: HREC|ZZ|sender (ICEGATE id)|ZZ|receiver (port)|ICES1_5|T/P|(empty)|CACHI01|control no|YYYYMMDD|HHMM;
// - every record starts with: message type (F fresh / A amendment) | customs house | job no | job date | BE no | BE date,
//   then the fields of that table in exactly the order of the CACHI01 JSON schema model (BE = beModel, ITEMS = itemsModel ...);
//   STATEMENT has no BE no / BE date in front (4 leading fields).
// Before, the BE "flat file" was a guess (invoice no read from the invoice date column, RITC from the UQC column ...) and
// the job screen could only download the JSON.
const SCHEMA = require('./icegateSchema.json').BE.master;

const GS = '\x1d';
// section name in the file -> JSON model; order = order in the file
const TABLES = [
  ['BE', 'beModel'], ['EXCHANGE', 'exchangeModel'], ['PERMISSION', 'permissionModel'], ['INVOICE', 'invoiceModel'],
  ['MISC_CH', 'misc_chModel'], ['ITEMS', 'itemsModel'], ['LICENCE', 'licenseModel'], ['RSP', 'rspModel'], ['DEPB', 'depbModel'],
  ['BOND', 'bondModel'], ['CERT', 'certModel'], ['HSS', 'hssModel'], ['REIMPORT', 'reimportModel'], ['SBEDUTY', 'sbedutyModel'],
  ['IGMS', 'igmsModel'], ['CONTAINER', 'containerModel'], ['CTX', 'ctxModel'], ['BE_ITEM_SW_INFO_TYPE', 'infoTypeModel'],
  ['BE_ITEM_SW_CONST', 'sw_ConstModel'], ['BE_ITEM_SW_PROD', 'sw_ProdModel'], ['BE_ITEM_SW_CTRL', 'ctrlModel'],
  ['STATEMENT', 'statementModel'], ['SUPPORTINGDOCS', 'supportingDocsModel'],
];
// seen in the production files: BE EXCHANGE PERMISSION INVOICE ITEMS REIMPORT SBEDUTY IGMS CTX BE_ITEM_SW_INFO_TYPE
// STATEMENT SUPPORTINGDOCS. The other names follow the ICEGATE segment list (MISC_CH, LICENCE, RSP, DEPB, BOND, CERT,
// HSS, CONTAINER, SW_CONST / SW_PROD / SW_CTRL with the BE_ITEM_ prefix seen on SW_INFO_TYPE) - not yet seen in a file.
const CONFIRMED = new Set(['BE', 'EXCHANGE', 'PERMISSION', 'INVOICE', 'ITEMS', 'REIMPORT', 'SBEDUTY', 'IGMS', 'CTX', 'BE_ITEM_SW_INFO_TYPE', 'STATEMENT', 'SUPPORTINGDOCS',
  'BOND', 'CERT', 'BE_ITEM_SW_CTRL', 'LICENCE', 'DEPB', 'CONTAINER', 'HSS', 'BE_ITEM_SW_PROD']); // HSS from two filed high-sea-sale warehouse (W) BEs; SW_PROD from two filed cosmetics (CDSCO) W BEs, 29-Oct-2026 // BOND / CERT / SW_CTRL from a filed ex-bond (X) BE; LICENCE / DEPB from a filed RoDTEP-scrip BE; CONTAINER from filed sea (INTKD6) and land (INPPG6) BEs, 29-Oct-2026
// Ex-bond (BE type X), from a filed X BE: HREC field 8 is "X" (empty otherwise) and INVOICE has 75 fields - the schema
// order up to otherRelevantInform; termsPlace ... whetherBuyerAndSellerAreRelated are not in the record.
const EXBOND_INVOICE_LEN = 75;
const SHORT_PREFIX = new Set(['STATEMENT']); // no BE no / BE date in front
// Column order of a table in the FILE where it differs from the JSON schema. INVOICE: in three filed BEs the insurance
// AMOUNT sits in the first of the two insurance columns (27.16 with currency INR, proportional to the invoice value) and
// the RATE in the second (1.1250 without currency - the standard 1.125 %), i.e. value, rate, currency - the JSON schema
// lists rate, value. 29-Oct-2026
const FILE_ORDER = { invoiceModel: (cols) => { const c = cols.slice(); const i = c.indexOf('insuranceRate'), j = c.indexOf('insuranceValue'); if (i >= 0 && j >= 0) { c[i] = 'insuranceValue'; c[j] = 'insuranceRate'; } return c; } };
const colsOf = (model) => { const cols = Object.keys(SCHEMA[model] || {}); return FILE_ORDER[model] ? FILE_ORDER[model](cols) : cols; };

// no trim (29-Oct-2026): filed BEs split a long item description at 60 raw characters, so description 1 ends with a
// space and description 2 starts with one - trimming changed 200+ lines of two filed W BEs
const clean = (v) => (v === undefined || v === null ? '' : String(v)).replace(/[\x1d\r\n]+/g, ' ');
const two = (n) => String(n).padStart(2, '0');

function writeBeFlat(cj, opts = {}) {
  const h = (cj && cj.headerField) || {}; const m = (cj && cj.master) || {};
  const be0 = (m.beModel || [])[0] || {};
  const port = clean(h.receiverID || be0.customHouseCode);
  const jobNo = clean(h.jobNumber); const jobDate = clean(h.jobDate);
  const beNo = clean(opts.beNo ?? be0.beNumber); const beDate = clean(opts.beDate ?? be0.beDate);
  const msgType = clean(h.messageType || 'F') || 'F';
  const ctl = clean(opts.controlNo || h.sequenceOrControlNumber || jobNo || 1);
  const now = opts.now || new Date();
  const ymd = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  const hhmm = two(now.getHours()) + two(now.getMinutes());
  const exBond = clean(be0.beType).toUpperCase() === 'X';
  const out = [['HREC', 'ZZ', clean(h.senderID), 'ZZ', port, 'ICES1_5', clean(h.indicator || 'P'), exBond ? 'X' : '', 'CACHI01', ctl, ymd, hhmm].join(GS)];
  const unknown = [];
  for (const [tag, model] of TABLES) {
    const rows = Array.isArray(m[model]) ? m[model] : [];
    if (!rows.length) continue;
    if (!CONFIRMED.has(tag)) unknown.push(tag);
    const cols = colsOf(model);
    out.push('<TABLE>' + tag);
    for (const r of rows) {
      const lead = SHORT_PREFIX.has(tag)
        ? [clean(r.messageType) || msgType, port, jobNo, jobDate]
        : [clean(r.messageType) || msgType, port, jobNo, jobDate, beNo, beDate];
      let rec = lead.concat(cols.map(k => clean(r[k])));
      if (exBond && tag === 'INVOICE') rec = rec.slice(0, EXBOND_INVOICE_LEN);
      out.push(rec.join(GS));
    }
  }
  out.push('<END-BE>');
  out.push(['TREC', ctl].join(GS));
  const text = out.join('\r\n') + '\r\n';
  return opts.withInfo ? { text, unconfirmedTables: unknown } : text;
}

// .be text -> { headerField, master } with the JSON schema names (rows as objects)
function readBeFlat(text) {
  const byTag = Object.fromEntries(TABLES);
  const master = {}; const headerField = {}; const unknownTables = [];
  let cur = null;
  const ymdTo = (d) => d;
  for (const raw of String(text || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/^﻿/, '');
    if (!line.trim()) continue;
    if (line.startsWith('<TABLE>')) { cur = line.slice(7).trim().toUpperCase(); if (!byTag[cur] && cur !== 'AMEND') unknownTables.push(cur); continue; }
    if (line.startsWith('<END')) { cur = null; continue; }
    const p = line.split(GS);
    if (p[0] === 'HREC') {
      Object.assign(headerField, { senderID: p[2] || '', receiverID: p[4] || '', indicator: p[6] || 'P', exBondFlag: p[7] || '', messageID: p[8] || 'CACHI01', sequenceOrControlNumber: p[9] || '', fileDate: ymdTo(p[10] || ''), fileTime: p[11] || '' });
      continue;
    }
    if (cur === 'AMEND' && p[0] !== 'TREC') { (master.amendRows = master.amendRows || []).push({ jobNumber: p[2] || '', jobDate: p[3] || '', beNumber: p[4] || '', beDate: p[5] || '', amendCode: p[6] || '', amendReason: p[7] || '', amendSrNo: p[8] || '', amendDate: p[9] || '' }); continue; }
    if (p[0] === 'TREC' || !cur || !byTag[cur]) continue;
    const model = byTag[cur];
    const lead = SHORT_PREFIX.has(cur) ? 4 : 6;
    const row = { messageType: p[0] || 'F', customHouseCode: p[1] || '' };
    if (lead === 6) { row.beNumber = p[4] || ''; row.beDate = p[5] || ''; }
    colsOf(model).forEach((k, i) => { const v = p[lead + i]; if (v !== undefined && v !== '') row[k] = v; });
    if (!headerField.jobNumber && p[2]) { headerField.jobNumber = p[2]; headerField.jobDate = p[3] || ''; headerField.messageType = p[0] || 'F'; }
    (master[model] = master[model] || []).push(row);
  }
  return { headerField, master, unknownTables: [...new Set(unknownTables)] };
}

// ── Amendment file (message CACHI01_A), 29-Oct-2026 ──────────────────────────────────────────────────────────
// Layout from a filed amendment (prior BE -> final, code A_PBEIGM):
//   HREC ... |CACHI01_A| ...
//   <TABLE>IGMS   A|port|(empty)|(empty)|BE no|BE date|<the 17 IGMS fields as in a fresh BE>
//   <TABLE>AMEND  A|port|job no|job date|BE no|BE date|<amendment code>|<reason>|<serial no>|<amendment date YYYYMMDD>
//   <END-BE> / TREC
// i.e. the changed sections come first (key = BE no + date, no job no), then one AMEND row per change.
// Which sections go with which code: A_PBEIGM -> IGMS is confirmed by that file; the others follow the ICEGATE code list
// (A = amend, S = add, D = delete; IGM, MAIN = BE, INV, ITEM, IGMS, CONT, DOCS, STMT) and are not yet seen in a filed file.
const AMEND_CODES = {
  A_PBEIGM: { label: 'Prior BE: IGM details (prior to final)', tables: ['IGMS'], confirmed: true },
  A_IGM:    { label: 'IGM details', tables: ['IGMS'] },
  A_MAIN:   { label: 'Main BE details (header)', tables: ['BE'] },
  A_INV:    { label: 'Invoice details', tables: ['INVOICE'] },
  A_ITEM:   { label: 'Item details', tables: ['ITEMS', 'SBEDUTY', 'BE_ITEM_SW_INFO_TYPE'] },
  S_IGMS:   { label: 'Add IGM line', tables: ['IGMS'] },
  S_CONT:   { label: 'Add container', tables: ['CONTAINER'] },
  S_DOCS:   { label: 'Add supporting documents (e-Sanchit)', tables: ['SUPPORTINGDOCS'] },
  S_STMT:   { label: 'Add statement', tables: ['STATEMENT'] },
  // 10-Nov-2026: the rest of iCAFFE's list (Add Invoice / Add Item / Delete ...) - layout as above, not yet seen in a filed file
  S_INV:    { label: 'Add invoice', tables: ['INVOICE', 'ITEMS', 'SBEDUTY'] },
  S_ITEM:   { label: 'Add item', tables: ['ITEMS', 'SBEDUTY', 'BE_ITEM_SW_INFO_TYPE'] },
  D_IGMS:   { label: 'Delete IGM', tables: ['IGMS'] },
  D_CONT:   { label: 'Delete container', tables: ['CONTAINER'] },
  D_INV:    { label: 'Delete invoice', tables: ['INVOICE'] },
  D_ITEM:   { label: 'Delete item', tables: ['ITEMS'] },
  D_DOCS:   { label: 'Delete supporting documents', tables: ['SUPPORTINGDOCS'] },
};
function writeBeAmendFlat(cj, opts = {}) {
  const h = (cj && cj.headerField) || {}; const m = (cj && cj.master) || {};
  const be0 = (m.beModel || [])[0] || {};
  const port = clean(h.receiverID || be0.customHouseCode);
  const beNo = clean(opts.beNo ?? be0.beNumber).replace(/\D/g, ''); const beDate = clean(opts.beDate ?? be0.beDate).replace(/\D/g, '');
  if (!beNo || !beDate) throw new Error('BE No and BE Date of the filed BE are needed for an amendment');
  const codes = (opts.codes || []).map(c => String(c).toUpperCase()).filter(c => AMEND_CODES[c]);
  if (!codes.length) throw new Error('Choose what is amended (amendment code)');
  const reason = clean(opts.reason);
  if (!reason) throw new Error('Give the reason for the amendment');
  const now = opts.now || new Date();
  const ymd = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`;
  const hhmm = two(now.getHours()) + two(now.getMinutes());
  const jobNo = clean(opts.jobNo || h.jobNumber); const jobDate = clean(opts.jobDate || ymd);
  const ctl = clean(opts.controlNo || h.sequenceOrControlNumber || jobNo || 1);
  const out = [['HREC', 'ZZ', clean(h.senderID), 'ZZ', port, 'ICES1_5', clean(h.indicator || 'P'), '', 'CACHI01_A', ctl, ymd, hhmm].join(GS)];
  const want = new Set(codes.flatMap(c => AMEND_CODES[c].tables));
  const empty = [];
  for (const [tag, model] of TABLES) {
    if (!want.has(tag)) continue;
    const rows = Array.isArray(m[model]) ? m[model] : [];
    if (!rows.length) { empty.push(tag); continue; }
    const cols = colsOf(model);
    out.push('<TABLE>' + tag);
    for (const r of rows) {
      // 10-Nov-2026 (opts.rowAct): each row says what happens to it - A amended, S added, D deleted (BE amendment register)
      const act = opts.rowAct && /^[ASD]$/.test(String(r._act || '')) ? r._act : 'A';
      const lead = SHORT_PREFIX.has(tag) ? [act, port, '', ''] : [act, port, '', '', beNo, beDate];
      out.push(lead.concat(cols.map(k => clean(r[k]))).join(GS));
    }
  }
  if (empty.length) throw new Error('Nothing to send for ' + empty.join(', ') + ' - fill that part of the job first');
  out.push('<TABLE>AMEND');
  // the amendment date is the (amendment) job date, not the file date: a filed amendment made on the 29th for a job of the 28th carries 20261028 in both
  codes.forEach((c, i) => out.push(['A', port, jobNo, jobDate, beNo, beDate, c, reason.slice(0, 120), String(i + 1), jobDate].join(GS)));
  out.push('<END-BE>');
  out.push(['TREC', ctl].join(GS));
  return { text: out.join('\r\n') + '\r\n', unconfirmedCodes: codes.filter(c => !AMEND_CODES[c].confirmed) };
}

module.exports = { writeBeFlat, readBeFlat, writeBeAmendFlat, AMEND_CODES, BE_FLAT_TABLES: TABLES };
