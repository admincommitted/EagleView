// ICES 1.5 Bill of Entry flat file (.be), message CACHI01 - writer and reader.
// Layout checked against two production .be files from another ERP:
// - fields separated by ASCII 29 (GS), records end with CRLF, sections start with "<TABLE>NAME", file ends "<END-BE>"
//   and "TREC<GS><control no>";
// - HREC: HREC|ZZ|sender (ICEGATE id)|ZZ|receiver (port)|ICES1_5|T/P|(empty)|CACHI01|control no|YYYYMMDD|HHMM;
// - every record starts with: message type (F fresh / A amendment) | customs house | job no | job date | BE no | BE date,
//   then the fields of that table in exactly the order of the CACHI01 JSON schema model (BE = beModel, ITEMS = itemsModel ...);
//   STATEMENT has no BE no / BE date in front (4 leading fields).
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'icegateSchema.json'), 'utf8')).BE.master;

const GS = '\x1d';
const LINE_END = '\r\n';

// section name in the file -> JSON model; order = order in the file
const TABLES = [
  ['BE', 'beModel'],
  ['EXCHANGE', 'exchangeModel'],
  ['PERMISSION', 'permissionModel'],
  ['INVOICE', 'invoiceModel'],
  ['MISC_CH', 'misc_chModel'],
  ['ITEMS', 'itemsModel'],
  ['LICENCE', 'licenseModel'],
  ['RSP', 'rspModel'],
  ['DEPB', 'depbModel'],
  ['BOND', 'bondModel'],
  ['CERT', 'certModel'],
  ['HSS', 'hssModel'],
  ['REIMPORT', 'reimportModel'],
  ['SBEDUTY', 'sbedutyModel'],
  ['IGMS', 'igmsModel'],
  ['CONTAINER', 'containerModel'],
  ['CTX', 'ctxModel'],
  ['BE_ITEM_SW_INFO_TYPE', 'infoTypeModel'],
  ['BE_ITEM_SW_CONST', 'sw_ConstModel'],
  ['BE_ITEM_SW_PROD', 'sw_ProdModel'],
  ['BE_ITEM_SW_CTRL', 'ctrlModel'],
  ['STATEMENT', 'statementModel'],
  ['SUPPORTINGDOCS', 'supportingDocsModel'],
];

// Section names confirmed by filed BEs (fresh, high-sea-sale and cosmetics warehouse W BEs, an ex-bond X BE, a
// RoDTEP-scrip BE, sea and land BEs). The other names (MISC_CH, RSP, CTX ..., BE_ITEM_SW_CONST) follow the ICEGATE
// segment list and are not yet seen in a file.
const CONFIRMED_TABLES = new Set([
  'BE',
  'EXCHANGE',
  'PERMISSION',
  'INVOICE',
  'ITEMS',
  'REIMPORT',
  'SBEDUTY',
  'IGMS',
  'CTX',
  'BE_ITEM_SW_INFO_TYPE',
  'STATEMENT',
  'SUPPORTINGDOCS',
  'BOND',
  'CERT',
  'BE_ITEM_SW_CTRL',
  'LICENCE',
  'DEPB',
  'CONTAINER',
  'HSS',
  'BE_ITEM_SW_PROD',
]);

// Ex-bond (BE type X), from a filed X BE: HREC field 8 is "X" (empty otherwise) and INVOICE has 75 fields - the schema
// order up to otherRelevantInform; termsPlace ... whetherBuyerAndSellerAreRelated are not in the record.
const EXBOND_INVOICE_LEN = 75;
const SHORT_PREFIX = new Set(['STATEMENT']); // no BE no / BE date in front
const SHORT_LEAD_LENGTH = 4;
const FULL_LEAD_LENGTH = 6;
const AMEND_REASON_MAX_LENGTH = 120;

// Column order of a table in the FILE where it differs from the JSON schema. INVOICE: in three filed BEs the insurance
// AMOUNT sits in the first of the two insurance columns (27.16 with currency INR, proportional to the invoice value) and
// the RATE in the second (1.1250 without currency - the standard 1.125 %), i.e. value, rate, currency - the JSON schema
// lists rate, value.
const swapInsuranceColumns = (columns) => {
  const ordered = columns.slice();
  const rateIndex = ordered.indexOf('insuranceRate');
  const valueIndex = ordered.indexOf('insuranceValue');
  if (rateIndex >= 0 && valueIndex >= 0) {
    ordered[rateIndex] = 'insuranceValue';
    ordered[valueIndex] = 'insuranceRate';
  }
  return ordered;
};
const FILE_ORDER = { invoiceModel: swapInsuranceColumns };

const columnsOf = (model) => {
  const columns = Object.keys(SCHEMA[model] || {});
  return FILE_ORDER[model] ? FILE_ORDER[model](columns) : columns;
};

// No trim: filed BEs split a long item description at 60 raw characters, so description 1 ends with a space and
// description 2 starts with one.
const clean = (value) => (value === undefined || value === null ? '' : String(value)).replace(/[\x1d\r\n]+/g, ' ');
const twoDigits = (n) => String(n).padStart(2, '0');
const fileDateOf = (now) => `${now.getFullYear()}${twoDigits(now.getMonth() + 1)}${twoDigits(now.getDate())}`;
const fileTimeOf = (now) => twoDigits(now.getHours()) + twoDigits(now.getMinutes());
const rowsOfModel = (master, model) => (Array.isArray(master[model]) ? master[model] : []);

function writeBeFlat(cachi, opts = {}) {
  const header = (cachi && cachi.headerField) || {};
  const master = (cachi && cachi.master) || {};
  const firstBe = (master.beModel || [])[0] || {};
  const port = clean(header.receiverID || firstBe.customHouseCode);
  const jobNo = clean(header.jobNumber);
  const jobDate = clean(header.jobDate);
  const beNo = clean(opts.beNo ?? firstBe.beNumber);
  const beDate = clean(opts.beDate ?? firstBe.beDate);
  const messageType = clean(header.messageType || 'F') || 'F';
  const controlNo = clean(opts.controlNo || header.sequenceOrControlNumber || jobNo || 1);
  const now = opts.now || new Date();
  const isExBond = clean(firstBe.beType).toUpperCase() === 'X';

  const lines = [
    [
      'HREC',
      'ZZ',
      clean(header.senderID),
      'ZZ',
      port,
      'ICES1_5',
      clean(header.indicator || 'P'),
      isExBond ? 'X' : '',
      'CACHI01',
      controlNo,
      fileDateOf(now),
      fileTimeOf(now),
    ].join(GS),
  ];
  const unconfirmedTables = [];

  for (const [tag, model] of TABLES) {
    const rows = rowsOfModel(master, model);
    if (!rows.length) continue;
    if (!CONFIRMED_TABLES.has(tag)) unconfirmedTables.push(tag);
    const columns = columnsOf(model);
    lines.push('<TABLE>' + tag);
    for (const row of rows) {
      const lead = SHORT_PREFIX.has(tag)
        ? [clean(row.messageType) || messageType, port, jobNo, jobDate]
        : [clean(row.messageType) || messageType, port, jobNo, jobDate, beNo, beDate];
      let record = lead.concat(columns.map((key) => clean(row[key])));
      if (isExBond && tag === 'INVOICE') record = record.slice(0, EXBOND_INVOICE_LEN);
      lines.push(record.join(GS));
    }
  }
  lines.push('<END-BE>');
  lines.push(['TREC', controlNo].join(GS));
  const text = lines.join(LINE_END) + LINE_END;
  return opts.withInfo ? { text, unconfirmedTables } : text;
}

const headerFromHrec = (parts) => ({
  senderID: parts[2] || '',
  receiverID: parts[4] || '',
  indicator: parts[6] || 'P',
  exBondFlag: parts[7] || '',
  messageID: parts[8] || 'CACHI01',
  sequenceOrControlNumber: parts[9] || '',
  fileDate: parts[10] || '',
  fileTime: parts[11] || '',
});

const amendRowOf = (parts) => ({
  jobNumber: parts[2] || '',
  jobDate: parts[3] || '',
  beNumber: parts[4] || '',
  beDate: parts[5] || '',
  amendCode: parts[6] || '',
  amendReason: parts[7] || '',
  amendSrNo: parts[8] || '',
  amendDate: parts[9] || '',
});

// .be text -> { headerField, master } with the JSON schema names (rows as objects)
function readBeFlat(text) {
  const modelByTag = Object.fromEntries(TABLES);
  const master = {};
  const headerField = {};
  const unknownTables = [];
  let currentTable = null;

  for (const rawLine of String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')) {
    const line = rawLine.replace(/^﻿/, '');
    if (!line.trim()) continue;
    if (line.startsWith('<TABLE>')) {
      currentTable = line.slice(7).trim().toUpperCase();
      if (!modelByTag[currentTable] && currentTable !== 'AMEND') unknownTables.push(currentTable);
      continue;
    }
    if (line.startsWith('<END')) {
      currentTable = null;
      continue;
    }

    const parts = line.split(GS);
    if (parts[0] === 'HREC') {
      Object.assign(headerField, headerFromHrec(parts));
      continue;
    }
    if (currentTable === 'AMEND' && parts[0] !== 'TREC') {
      (master.amendRows = master.amendRows || []).push(amendRowOf(parts));
      continue;
    }
    if (parts[0] === 'TREC' || !currentTable || !modelByTag[currentTable]) continue;

    const model = modelByTag[currentTable];
    const leadLength = SHORT_PREFIX.has(currentTable) ? SHORT_LEAD_LENGTH : FULL_LEAD_LENGTH;
    const row = { messageType: parts[0] || 'F', customHouseCode: parts[1] || '' };
    if (leadLength === FULL_LEAD_LENGTH) {
      row.beNumber = parts[4] || '';
      row.beDate = parts[5] || '';
    }
    columnsOf(model).forEach((key, index) => {
      const value = parts[leadLength + index];
      if (value !== undefined && value !== '') row[key] = value;
    });
    if (!headerField.jobNumber && parts[2]) {
      headerField.jobNumber = parts[2];
      headerField.jobDate = parts[3] || '';
      headerField.messageType = parts[0] || 'F';
    }
    (master[model] = master[model] || []).push(row);
  }
  return { headerField, master, unknownTables: [...new Set(unknownTables)] };
}

// ── Amendment file (message CACHI01_A) ──────────────────────────────────────────────────────────────────────────
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
  A_IGM: { label: 'IGM details', tables: ['IGMS'] },
  A_MAIN: { label: 'Main BE details (header)', tables: ['BE'] },
  A_INV: { label: 'Invoice details', tables: ['INVOICE'] },
  A_ITEM: { label: 'Item details', tables: ['ITEMS', 'SBEDUTY', 'BE_ITEM_SW_INFO_TYPE'] },
  S_IGMS: { label: 'Add IGM line', tables: ['IGMS'] },
  S_CONT: { label: 'Add container', tables: ['CONTAINER'] },
  S_DOCS: { label: 'Add supporting documents (e-Sanchit)', tables: ['SUPPORTINGDOCS'] },
  S_STMT: { label: 'Add statement', tables: ['STATEMENT'] },
  // the rest of iCAFFE's list (Add Invoice / Add Item / Delete ...) - layout as above, not yet seen in a filed file
  S_INV: { label: 'Add invoice', tables: ['INVOICE', 'ITEMS', 'SBEDUTY'] },
  S_ITEM: { label: 'Add item', tables: ['ITEMS', 'SBEDUTY', 'BE_ITEM_SW_INFO_TYPE'] },
  D_IGMS: { label: 'Delete IGM', tables: ['IGMS'] },
  D_CONT: { label: 'Delete container', tables: ['CONTAINER'] },
  D_INV: { label: 'Delete invoice', tables: ['INVOICE'] },
  D_ITEM: { label: 'Delete item', tables: ['ITEMS'] },
  D_DOCS: { label: 'Delete supporting documents', tables: ['SUPPORTINGDOCS'] },
};

const ROW_ACTION_PATTERN = /^[ASD]$/;

function writeBeAmendFlat(cachi, opts = {}) {
  const header = (cachi && cachi.headerField) || {};
  const master = (cachi && cachi.master) || {};
  const firstBe = (master.beModel || [])[0] || {};
  const port = clean(header.receiverID || firstBe.customHouseCode);
  const beNo = clean(opts.beNo ?? firstBe.beNumber).replace(/\D/g, '');
  const beDate = clean(opts.beDate ?? firstBe.beDate).replace(/\D/g, '');
  if (!beNo || !beDate) throw new Error('BE No and BE Date of the filed BE are needed for an amendment');
  const codes = (opts.codes || []).map((code) => String(code).toUpperCase()).filter((code) => AMEND_CODES[code]);
  if (!codes.length) throw new Error('Choose what is amended (amendment code)');
  const reason = clean(opts.reason);
  if (!reason) throw new Error('Give the reason for the amendment');

  const now = opts.now || new Date();
  const fileDate = fileDateOf(now);
  const jobNo = clean(opts.jobNo || header.jobNumber);
  const jobDate = clean(opts.jobDate || fileDate);
  const controlNo = clean(opts.controlNo || header.sequenceOrControlNumber || jobNo || 1);
  const lines = [
    [
      'HREC',
      'ZZ',
      clean(header.senderID),
      'ZZ',
      port,
      'ICES1_5',
      clean(header.indicator || 'P'),
      '',
      'CACHI01_A',
      controlNo,
      fileDate,
      fileTimeOf(now),
    ].join(GS),
  ];

  const wantedTables = new Set(codes.flatMap((code) => AMEND_CODES[code].tables));
  const emptyTables = [];
  for (const [tag, model] of TABLES) {
    if (!wantedTables.has(tag)) continue;
    const rows = rowsOfModel(master, model);
    if (!rows.length) {
      emptyTables.push(tag);
      continue;
    }
    const columns = columnsOf(model);
    lines.push('<TABLE>' + tag);
    for (const row of rows) {
      // with opts.rowAct each row says what happens to it - A amended, S added, D deleted (BE amendment register)
      const action = opts.rowAct && ROW_ACTION_PATTERN.test(String(row._act || '')) ? row._act : 'A';
      const lead = SHORT_PREFIX.has(tag) ? [action, port, '', ''] : [action, port, '', '', beNo, beDate];
      lines.push(lead.concat(columns.map((key) => clean(row[key]))).join(GS));
    }
  }
  if (emptyTables.length)
    throw new Error('Nothing to send for ' + emptyTables.join(', ') + ' - fill that part of the job first');

  lines.push('<TABLE>AMEND');
  // the amendment date is the (amendment) job date, not the file date: a filed amendment made on the 29th for a job of
  // the 28th carries the 28th in both
  codes.forEach((code, index) =>
    lines.push(
      [
        'A',
        port,
        jobNo,
        jobDate,
        beNo,
        beDate,
        code,
        reason.slice(0, AMEND_REASON_MAX_LENGTH),
        String(index + 1),
        jobDate,
      ].join(GS),
    ),
  );
  lines.push('<END-BE>');
  lines.push(['TREC', controlNo].join(GS));
  return {
    text: lines.join(LINE_END) + LINE_END,
    unconfirmedCodes: codes.filter((code) => !AMEND_CODES[code].confirmed),
  };
}

export { writeBeFlat, readBeFlat, writeBeAmendFlat, AMEND_CODES, TABLES as BE_FLAT_TABLES };
