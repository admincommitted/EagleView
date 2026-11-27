// BE amendment, the iCAFFE way.
//
// iCAFFE (EDI Operation > Amend BE): the BE job is never changed. "Click To Amend" copies the whole BE job into a new
// job of the amendment series (its own number, e.g. 3282 for BE job 8494), the changes are made on that copy, and
// "Submit BE Amend" makes the CACHI01_A file from the copy (signed / unsigned download, or mail to ICEGATE).
//
// Here:
//   BeAmendments        one row per amendment: amendment no / date, BE no / date, request letter no / date, codes,
//                       reason, status (Draft / Ready / Submitted / Accepted / Rejected / Void), the copy, the file, how
//                       and when it was sent, the ICEGATE reply.
//   the copy            an ordinary ImportJobs row (with its invoices, items, containers), jobNo "AMD/<branch>/<div>/<no>",
//                       status AMENDMENT, extendedData _amendmentId / _amendOfJobId / _amendOfJobNo / _amendNo. Job lists
//                       leave these rows out; the original job is not touched.
//   the number          Number Series document BE_AMEND per branch + division + financial year; New Delhi Import Air
//                       goes on from iCAFFE's last number (3282 -> 3283). A number already in BeAmendments is skipped
//                       (so loading iCAFFE's history later cannot give a number twice).
//   what changed        the copy is turned into the CACHI01 tables and compared, table by table, with the BE as it stood
//                       before: the last amendment of this BE that was sent, else the copy that went to ICEGATE
//                       (filedJson), else the BE job as it is. Each changed row gets A (amended), S (added) or D (deleted);
//                       the codes follow from that (IGM filled in on a prior BE -> A_PBEIGM, new e-Sanchit doc -> S_DOCS ...).
//   the file            only the changed rows of the tables of the chosen codes, then one AMEND row per code
//                       (beFlatFile.writeBeAmendFlat); file name = amendment no + ".be".
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { ImportJob, ImportInvoice, ImportItem, ImportContainer } from '../../models/index.js';
import { unpackExtra } from '../db/extraFields.js';
import * as numberSeries from '../common/numberSeries.js';
import { buildBE_CACHI01 } from './IcegateJsonBuilder.js';
import { BE_FLAT_TABLES, writeBeAmendFlat } from './beFlatFile.js';

const selectRows = (sql, replacements = [], transaction) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction,
  });
const execute = (sql, replacements = [], transaction) => sequelize.query(sql, { replacements, transaction });
const httpError = (message, status = 400) => Object.assign(new Error(message), { status });

// ── codes (iCAFFE's list; A = amend, S = add, D = delete) ────────────────────────────────────────────────────────
const ITEM_TABLES = [
  'ITEMS',
  'SBEDUTY',
  'BE_ITEM_SW_INFO_TYPE',
  'BE_ITEM_SW_CONST',
  'BE_ITEM_SW_PROD',
  'BE_ITEM_SW_CTRL',
];
const CODES = [
  { code: 'A_MAIN', label: 'BE details (header)', act: 'A', tables: ['BE'] },
  { code: 'A_PBEIGM', label: 'Prior BE made final: IGM details', act: 'A', tables: ['IGMS'] },
  { code: 'A_IGM', label: 'IGM details (incl. MAWB / HAWB)', act: 'A', tables: ['IGMS'] },
  { code: 'A_INV', label: 'Invoice details', act: 'A', tables: ['INVOICE'] },
  { code: 'A_ITEM', label: 'Item details (incl. duty / SW)', act: 'A', tables: [...ITEM_TABLES] },
  { code: 'S_IGMS', label: 'Add IGM', act: 'S', tables: ['IGMS'] },
  { code: 'S_CONT', label: 'Add container', act: 'S', tables: ['CONTAINER'] },
  { code: 'S_INV', label: 'Add invoice', act: 'S', tables: ['INVOICE', 'ITEMS', 'SBEDUTY'] },
  { code: 'S_ITEM', label: 'Add item', act: 'S', tables: [...ITEM_TABLES] },
  { code: 'S_DOCS', label: 'Add supporting documents (e-Sanchit)', act: 'S', tables: ['SUPPORTINGDOCS'] },
  { code: 'S_STMT', label: 'Add statement', act: 'S', tables: ['STATEMENT'] },
  { code: 'D_IGMS', label: 'Delete IGM', act: 'D', tables: ['IGMS'] },
  { code: 'D_CONT', label: 'Delete container', act: 'D', tables: ['CONTAINER'] },
  { code: 'D_INV', label: 'Delete invoice', act: 'D', tables: ['INVOICE'] },
  { code: 'D_ITEM', label: 'Delete item', act: 'D', tables: ['ITEMS'] },
  { code: 'D_DOCS', label: 'Delete supporting documents', act: 'D', tables: ['SUPPORTINGDOCS'] },
];
const CODE = Object.fromEntries(CODES.map((entry) => [entry.code, entry]));
// seen in amendments filed from iCAFFE (Submit BE Amend lists): the others follow the same pattern
const SEEN_IN_ICAFFE = new Set(['A_PBEIGM', 'A_IGM', 'A_MAIN', 'S_DOCS', 'S_IGMS', 'S_ITEM', 'D_IGMS']);
const STATUSES = ['Draft', 'Ready', 'Submitted', 'Accepted', 'Rejected', 'Void'];

// New Delhi Import Air continues iCAFFE's amendment numbers (iCAFFE's last one is 3282)
const ICAFFE_NEXT_AMEND_NO = 3283;
const AMEND_JOB_NO_DIGITS = 7;

// ── table ───────────────────────────────────────────────────────────────────────────────────────────────────────
const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS BeAmendments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    importJobId INTEGER NOT NULL, parentJobNo TEXT,
    amendNo TEXT NOT NULL, amendDate TEXT NOT NULL, branchCode TEXT NOT NULL DEFAULT '', division TEXT NOT NULL DEFAULT '', fyCode TEXT NOT NULL DEFAULT '',
    beNo TEXT, beDate TEXT, reqLetterNo TEXT, reqLetterDate TEXT, codes TEXT, reason TEXT,
    status TEXT NOT NULL DEFAULT 'Draft', amendedJobId INTEGER,
    icegateProfileId INTEGER, fileName TEXT, fileText TEXT, fileMadeAt TEXT, fileMadeBy TEXT, fileCodes TEXT,
    signedFileB64 TEXT, signedAt TEXT, signer TEXT,
    transferMode TEXT, submittedAt TEXT, submittedBy TEXT, mailTo TEXT, mailMessageId TEXT,
    ackStatus TEXT, ackText TEXT, ackAt TEXT,
    source TEXT DEFAULT 'EagleView', remarks TEXT,
    createdBy TEXT, updatedBy TEXT, createdAt DATETIME, updatedAt DATETIME,
    UNIQUE (branchCode, division, fyCode, amendNo))`;

// the timestamp form Sequelize reads back from SQLite
const sequelizeTimestamp = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');

async function seedAmendmentNumberSeries() {
  await numberSeries.ensure();
  const hasSeries = (await selectRows("SELECT 1 FROM NumberSeries WHERE docType = 'BE_AMEND' LIMIT 1")).length;
  if (hasSeries) return;
  const stamp = sequelizeTimestamp();
  await execute(
    `INSERT OR IGNORE INTO NumberSeries (docType, branchCode, division, fyCode, format, pad, nextNo, source, isActive, modifiedBy, createdAt, updatedAt)
      VALUES ('BE_AMEND', 'DEL', 'AI', ?, '{N}', 0, ${ICAFFE_NEXT_AMEND_NO}, 'iCAFFE Submit BE Amend: last no 3282 on 09-11-2026', 1, 'system', ?, ?)`,
    [numberSeries.fyCodeOf(new Date().toISOString()), stamp, stamp],
  );
}

let ready = null;
const ensure = () =>
  (ready =
    ready ||
    (async () => {
      await execute(CREATE_TABLE_SQL);
      await execute('CREATE INDEX IF NOT EXISTS idx_beamend_job ON BeAmendments (importJobId)');
      await execute('CREATE INDEX IF NOT EXISTS idx_beamend_status ON BeAmendments (status)');
      await execute('CREATE INDEX IF NOT EXISTS idx_beamend_be ON BeAmendments (beNo)');
      await seedAmendmentNumberSeries();
    })().catch((error) => {
      ready = null;
      throw error;
    }));

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────
const pad2 = (value) => String(value).padStart(2, '0');
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};
const ymd = (value) => {
  const text = String(value || '').trim();
  let match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
};
const DIVISION_BY_MODE = { AIR: 'AI', SEA: 'SI', LAND: 'LI' };
const divisionOf = (job) => DIVISION_BY_MODE[String(job.shipmentMode || '').toUpperCase()] || 'AI';
const parseJ = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const isCopy = (job) => !!(job && (job._amendmentId || String(job.jobNo || '').startsWith('AMD/')));

const JOB_INCLUDE = [
  { model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] },
  { model: ImportContainer, as: 'containers' },
];
const JOB_ORDER = [
  [{ model: ImportInvoice, as: 'invoices' }, 'id', 'ASC'],
  [{ model: ImportInvoice, as: 'invoices' }, { model: ImportItem, as: 'items' }, 'id', 'ASC'],
  [{ model: ImportContainer, as: 'containers' }, 'id', 'ASC'],
];

// a job with its invoices / items / containers, extendedData unpacked (as GET /api/import-jobs/:id gives it)
async function loadJob(id, transaction) {
  const job = await ImportJob.findByPk(id, { include: JOB_INCLUDE, order: JOB_ORDER, transaction });
  if (!job) return null;
  const loaded = unpackExtra(job.toJSON(), 'extendedData');
  ['_bondRows', '_hssRows'].forEach((key) => {
    if (typeof loaded[key] === 'string') loaded[key] = parseJ(loaded[key], loaded[key]);
  });
  loaded.invoices = (loaded.invoices || []).map((invoice) => {
    const unpacked = unpackExtra(invoice, 'extendedData');
    unpacked.items = (unpacked.items || []).map((item) => unpackExtra(item, 'extendedData'));
    return unpacked;
  });
  loaded.containers = (loaded.containers || []).map((container) => unpackExtra(container, 'extendedData'));
  return loaded;
}

// ── job -> Job Entry screen state ────────────────────────────────────────────────────────────────────────────────
const ITEM_JSON_FIELDS = [
  'swInfoData',
  'swConstData',
  'swProdData',
  'swCtrlData',
  'swStmtData',
  'docsData',
  'dutyRows',
  'igstData',
  'licenceData',
  'schemeCatData',
  'addData',
  'antiDumpingData',
  'cvdData',
  'svbData',
  'otherDutyData',
  'policyParaData',
  'prevBeData',
  'reimportData',
  'rspData',
  'ncdData',
];

const asArray = (value) => {
  const parsed = parseJ(value, []);
  return Array.isArray(parsed) ? parsed : [];
};
const rowId = () => Date.now() + Math.random();

const swInfoRow = (r) => ({
  agency: r.agencyCode || 'ALL',
  type: r.infoType || '',
  qualifier: r.infoQualifier || '',
  code: r.infoCode || '',
  text: r.infoText || '',
  qty: r.infoMsr || r.infoQty || '',
  uqc: r.infoUqc || '',
  id: rowId(),
});
const swConstRow = (r) => ({
  srNo: r.constituentSrNo || r.constituentSerialNumber || '',
  name: r.constituentElementName || '',
  code: r.constituentElementCode || '',
  percent: r.constituentPercentage || '',
  yield: r.constituentYieldPercentage || '',
  active: r.activeIngredientFlag || r.activeIngredient || '',
  id: rowId(),
});
const swProdRow = (r) => ({
  batch: r.productionBatchIdentifier || r.batchNumber || '',
  qty: r.productionBatchQuantity || r.manufacturingQuantity || '',
  uqc: r.unitQuantityCode || '',
  mnfDate: r.dateOfManufacturing || '',
  expDate: r.dateOfExpiry || '',
  bestBefore: r.bestBefore || '',
  id: rowId(),
});
const swCtrlRow = (r) => ({
  typeCode: r.controlTypeCode || '',
  location: r.controlLocation || '',
  startDate: r.controlStartDate || '',
  endDate: r.controlEndDate || '',
  resultCode: r.controlResultCode || '',
  resultText: r.controlResultText || '',
  msr: r.controlMsr || '',
  uqc: r.controlUqc || '',
  id: rowId(),
});
const swStmtRow = (r) => ({
  typeCode: r.statementType || '',
  stmtCode: r.statementCode || '',
  stmtText: r.statementText || '',
  stmtFor: r.statementFor || '',
  id: rowId(),
});
// the file's whole document row in the panel's keys (drn, issuer*, bene*, expiry), as the job screen does
const itemDocRow = (r) => ({
  icegateId: r.icegateUserId || '',
  docCode: r.documentTypeCode || r.documentClassCode || '',
  docName: '',
  irn: r.imageReferenceNo || '',
  drn: r.documentReferenceNo || r.documentReferenceNumber || '',
  issueDate: r.documentIssueDate || '',
  expiryDate: r.documentExpiryDate || '',
  placeOfIssue: r.placeOfIssue || r.documentIssueLocation || '',
  issuerCode: r.documentIssuingPartyCode || '',
  issuerName: r.documentIssuingPartyName || r.documentIssuerName || '',
  issuerAddr1: r.documentIssuingPartyNameAddress1 || r.documentIssuerAddress || '',
  issuerAddr2: r.documentIssuingPartyNameAddress2 || '',
  issuerCity: r.documentIssuingPartyNameCity || '',
  issuerPin: r.documentIssuingPartyNamePin || '',
  beneCode: r.documentBeneficiaryPartyCode || '',
  beneName: r.documentBeneficiaryPartyName || '',
  beneAddr1: r.documentBeneficiaryPartyNameAddress1 || '',
  beneAddr2: r.documentBeneficiaryPartyNameAddress2 || '',
  beneCity: r.documentBeneficiaryPartyNameCity || '',
  benePin: r.documentBeneficiaryPartyPin || '',
  fileType: String(r.fileType || 'PDF').toUpperCase(),
  docFor: 'ITEM',
  id: rowId(),
});

// item panel field <- the job's CACHI01 rows (first matching key wins) and how one row maps
const ITEM_PANELS = [
  { field: 'swInfoData', sources: ['_infoTypes', '_infoTypeModel', '_infotypemodel'], toRow: swInfoRow },
  { field: 'swConstData', sources: ['_sw_ConstModel', '_sw_constmodel'], toRow: swConstRow },
  { field: 'swProdData', sources: ['_sw_ProdModel', '_sw_prodmodel'], toRow: swProdRow },
  { field: 'swCtrlData', sources: ['_ctrlModel', '_ctrlmodel'], toRow: swCtrlRow },
  { field: 'swStmtData', sources: ['_statements', '_statementModel', '_statementmodel'], toRow: swStmtRow },
  { field: 'docsData', sources: ['_supportingDocsModel', '_supportingdocsmodel'], toRow: itemDocRow },
];
const firstFilled = (loaded, keys) => keys.reduce((found, key) => found || loaded[key], undefined);

function fillItemPanels(item, loaded) {
  const invoiceNo = String(item.invSrNo || '1');
  const itemNo = String(item.itemSrNo || item.itemNo || '1');
  ITEM_JSON_FIELDS.forEach((key) => {
    if (typeof item[key] === 'string') item[key] = parseJ(item[key], item[key]);
  });
  const rowsOfThisItem = (rows) =>
    asArray(rows).filter(
      (r) =>
        String(r.invoiceSerialNumber || r.invoiceSrNo || r.invSrNo) === invoiceNo &&
        String(r.itemSerialNumber || r.itemSrNo || r.itmNo) === itemNo,
    );
  for (const { field, sources, toRow } of ITEM_PANELS) {
    const rows = rowsOfThisItem(firstFilled(loaded, sources));
    if (rows.length && !Array.isArray(item[field])) item[field] = rows.map(toRow);
  }
  return item;
}

const headerDocRow = (d, index) => {
  const atHeader = String(d.invoiceSerialNumber || '0') === '0';
  return {
    id: index + 1,
    srNo: index + 1,
    docFor: atHeader ? 'HEADER' : 'INVOICE',
    invSrNo: atHeader ? '' : String(d.invoiceSerialNumber),
    icegateId: d.icegateUserId || '',
    fileType: d.fileType || 'PDF',
    irn: d.imageReferenceNo || '',
    drn: d.documentReferenceNo || '',
    docCode: d.documentTypeCode || '',
    fileName: d.fileType || '',
    issuerCode: d.documentIssuingPartyCode || '',
    issuerName: d.documentIssuingPartyName || '',
    issuerAddr1: d.documentIssuingPartyNameAddress1 || '',
    issuerAddr2: d.documentIssuingPartyNameAddress2 || '',
    issuerCity: d.documentIssuingPartyNameCity || '',
    issuerPin: d.documentIssuingPartyNamePin || '',
    beneCode: d.documentBeneficiaryPartyCode || '',
    beneName: d.documentBeneficiaryPartyName || '',
    beneAddr1: d.documentBeneficiaryPartyNameAddress1 || '',
    beneAddr2: d.documentBeneficiaryPartyNameAddress2 || '',
    beneCity: d.documentBeneficiaryPartyNameCity || '',
    benePin: d.documentBeneficiaryPartyPin || '',
    placeOfIssue: d.placeOfIssue || '',
    issueDate: d.documentIssueDate || '',
    expiryDate: d.documentExpiryDate || '',
  };
};

// e-Sanchit tab (BE / invoice level docs)
function esanchitDocsOf(loaded) {
  const saved = asArray(loaded.esanchitDocs);
  if (saved.length) return saved;
  const headerDocs = asArray(loaded._supportingDocsModel || loaded._supportingdocsmodel).filter(
    (d) => String(d.itemSerialNumber || '0') === '0',
  );
  return headerDocs.map(headerDocRow);
}

// the job as the Job Entry screen holds it (jobData / items / invoices / e-Sanchit tab) - the same steps as
// JobEntryLayout.loadJobForEditing, so the CACHI01 made here is the one the screen would make
function jobToScreen(loaded) {
  const invoices = loaded.invoices || [];
  const items = [];
  invoices.forEach((invoice, index) => {
    (invoice.items || []).forEach((item) =>
      items.push({
        ...item,
        invSrNo: String(index + 1),
        invNo: String(invoice.invNo || invoice.invoiceNo || item.invNo || ''),
      }),
    );
  });
  const screenItems = items.map((item) => fillItemPanels(item, loaded));
  const esanchitDocs = esanchitDocsOf(loaded);
  const transportMode = loaded.shipmentMode === 'AIR' ? 'A' : loaded.shipmentMode === 'LAND' ? 'L' : 'S';
  const beType = loaded.boeType === 'WAREHOUSE' ? 'W' : loaded.boeType === 'EX_BOND' ? 'X' : 'H';
  return { jobData: { ...loaded, esanchitDocs }, items: screenItems, invoices, beType, transportMode };
}

async function cachiOf(loaded, opts = {}) {
  const screen = jobToScreen(loaded);
  return buildBE_CACHI01(screen.jobData, screen.items, screen.invoices, {
    beType: screen.beType,
    transportMode: screen.transportMode,
    profileId: opts.profileId,
    indicator: 'P',
    isAmendment: true,
    amendment: true,
    amendReason: opts.reason,
  });
}

// ── what changed: CACHI01 tables of the base vs the copy ─────────────────────────────────────────────────────────
const MODEL = Object.fromEntries(BE_FLAT_TABLES);
const VOLATILE_FIELDS = new Set([
  'messageType',
  'customHouseCode',
  'beNumber',
  'beDate',
  'jobNumber',
  'jobDate',
  'declarationNo',
  'declarationDate',
  'sequenceOrControlNumber',
  '_act',
]);
const text = (value) => (value === undefined || value === null ? '' : String(value)).trim();
const pairKey = (r) => text(r.invoiceSerialNumber) + '/' + text(r.itemSerialNumber);
const ROW_KEY = {
  BE: () => 'BE',
  IGMS: (r, index) => 'IGM ' + (index + 1),
  INVOICE: (r) => 'Inv ' + text(r.invoiceSerialNumber),
  ITEMS: (r) => 'Item ' + pairKey(r),
  SBEDUTY: (r) => 'Duty ' + pairKey(r) + ' ' + text(r.dutyType || r.dutyCode || r.dutyTypeCode),
  BE_ITEM_SW_INFO_TYPE: (r) =>
    'SW info ' + pairKey(r) + ' ' + text(r.infoType) + ' ' + text(r.infoQualifier) + ' ' + text(r.infoCode),
  BE_ITEM_SW_CONST: (r) => 'SW const ' + pairKey(r) + ' ' + text(r.constituentSerialNumber || r.constituentSrNo),
  BE_ITEM_SW_PROD: (r) => 'SW prod ' + pairKey(r) + ' ' + text(r.productionBatchIdentifier),
  BE_ITEM_SW_CTRL: (r) => 'SW ctrl ' + pairKey(r) + ' ' + text(r.controlTypeCode),
  CONTAINER: (r) => 'Cont ' + text(r.containerNumber || r.containerNo),
  SUPPORTINGDOCS: (r) => 'Doc ' + (text(r.imageReferenceNo) || text(r.documentReferenceNo)) + ' ' + pairKey(r),
  STATEMENT: (r) => 'Stmt ' + pairKey(r) + ' ' + text(r.statementCode) + ' ' + text(r.statementText).slice(0, 40),
};
const DIFF_TABLES = Object.keys(ROW_KEY);
const fieldsOf = (row) => Object.keys(row || {}).filter((key) => !VOLATILE_FIELDS.has(key));

function compareRows(before, after) {
  const keys = new Set([...fieldsOf(before), ...fieldsOf(after)]);
  const differences = [];
  for (const key of keys) {
    if (text(before[key]) !== text(after[key]))
      differences.push({ field: key, was: text(before[key]), now: text(after[key]) });
  }
  return differences;
}

function diffCachi(base, copy) {
  const baseMaster = (base && base.master) || {};
  const copyMaster = (copy && copy.master) || {};
  const changes = [];
  for (const tag of DIFF_TABLES) {
    const model = MODEL[tag];
    if (!model) continue;
    const baseRows = Array.isArray(baseMaster[model]) ? baseMaster[model] : [];
    const copyRows = Array.isArray(copyMaster[model]) ? copyMaster[model] : [];
    const baseByKey = new Map(baseRows.map((row, index) => [ROW_KEY[tag](row, index), row]));
    const copyByKey = new Map(copyRows.map((row, index) => [ROW_KEY[tag](row, index), { row, index }]));
    for (const [key, { row, index }] of copyByKey) {
      const oldRow = baseByKey.get(key);
      if (!oldRow) {
        changes.push({ table: tag, key, act: 'S', index, fields: [] });
        continue;
      }
      const fields = compareRows(oldRow, row);
      if (fields.length) changes.push({ table: tag, key, act: 'A', index, fields });
    }
    for (const [key, row] of baseByKey) {
      if (!copyByKey.has(key)) changes.push({ table: tag, key, act: 'D', index: -1, row, fields: [] });
    }
  }
  return changes;
}

const IGM_FINAL_FIELDS = ['igmNumber', 'igmDate', 'inwardDate'];

function igmAmendCode(changes, base) {
  // a prior BE (IGM not yet filed when the BE was) becomes final once the IGM no / date / inward date are filled in
  const firstBe = (((base || {}).master || {}).beModel || [])[0] || {};
  const isPriorBe = /^Y/i.test(
    text(firstBe.priorBe || firstBe.whetherPriorBe || firstBe.priorBeFlag || firstBe.whetherPriorBE),
  );
  const isIgmFinalField = (field) => IGM_FINAL_FIELDS.includes(field.field);
  const igmAmendments = changes.filter((c) => c.table === 'IGMS' && c.act === 'A');
  const filledIn = igmAmendments.some((c) => c.fields.some((f) => isIgmFinalField(f) && !f.was && f.now));
  // only the IGM no / date / inward date make it "prior to final"; any other IGM change (MAWB / HAWB / pkgs) is A_IGM
  const igmTouched = igmAmendments.some((c) => c.fields.some(isIgmFinalField));
  return filledIn || (isPriorBe && igmTouched) ? 'A_PBEIGM' : 'A_IGM';
}

// codes that follow from the changes
function suggestCodes(changes, base) {
  const codes = new Set();
  const has = (tag, act) => changes.some((c) => c.table === tag && c.act === act);
  if (has('BE', 'A')) codes.add('A_MAIN');
  if (has('IGMS', 'A')) codes.add(igmAmendCode(changes, base));
  if (has('IGMS', 'S')) codes.add('S_IGMS');
  if (has('IGMS', 'D')) codes.add('D_IGMS');
  if (has('INVOICE', 'A')) codes.add('A_INV');
  if (has('INVOICE', 'S')) codes.add('S_INV');
  if (has('INVOICE', 'D')) codes.add('D_INV');
  const newInvoiceNos = new Set(
    changes.filter((c) => c.table === 'INVOICE' && c.act === 'S').map((c) => c.key.replace('Inv ', '')),
  );
  const isInNewInvoice = (change) => newInvoiceNos.has(change.key.replace(/^[^\d]*/, '').split('/')[0]);
  if (changes.some((c) => ITEM_TABLES.includes(c.table) && c.act === 'A')) codes.add('A_ITEM');
  if (changes.some((c) => c.table === 'ITEMS' && c.act === 'S' && !isInNewInvoice(c))) codes.add('S_ITEM');
  if (changes.some((c) => c.table === 'ITEMS' && c.act === 'D')) codes.add('D_ITEM');
  if (has('CONTAINER', 'S')) codes.add('S_CONT');
  if (has('CONTAINER', 'D')) codes.add('D_CONT');
  if (has('SUPPORTINGDOCS', 'S')) codes.add('S_DOCS');
  if (has('SUPPORTINGDOCS', 'D')) codes.add('D_DOCS');
  if (has('STATEMENT', 'S')) codes.add('S_STMT');
  return [...codes];
}

const PREVIOUS_SENT_AMENDMENT_SQL = `SELECT amendedJobId FROM BeAmendments WHERE importJobId = ? AND id <> ? AND status IN ('Submitted', 'Accepted') AND amendedJobId IS NOT NULL
      AND (amendDate < ? OR (amendDate = ? AND id < ?)) ORDER BY amendDate DESC, id DESC LIMIT 1`;

// the BE as it stood before this amendment: the last amendment of the same BE that was sent, else what went to ICEGATE,
// else the BE job itself
async function baseFor(amendment, transaction) {
  const previous = (
    await selectRows(
      PREVIOUS_SENT_AMENDMENT_SQL,
      [amendment.importJobId, amendment.id, amendment.amendDate, amendment.amendDate, amendment.id],
      transaction,
    )
  )[0];
  if (previous) {
    const previousCopy = await loadJob(previous.amendedJobId, transaction);
    if (previousCopy) return { from: 'amendment', job: previousCopy };
  }
  const parent = await loadJob(amendment.importJobId, transaction);
  if (!parent) throw httpError('The BE job of this amendment is not there any more', 404);
  const filed = parseJ(parent.filedJson, null);
  if (filed && filed.master) return { from: 'filed', job: parent, cachi: filed };
  return { from: 'job', job: parent };
}

async function changesFor(amendment, opts = {}) {
  const base = await baseFor(amendment);
  const copy = await loadJob(amendment.amendedJobId);
  if (!copy) throw httpError('The amended job of this amendment is not there any more', 404);
  const [baseCachi, copyCachi] = await Promise.all([
    base.cachi ? Promise.resolve(base.cachi) : cachiOf(base.job, opts),
    cachiOf(copy, opts),
  ]);
  const changes = diffCachi(baseCachi, copyCachi);
  return {
    base: { from: base.from, jobId: base.job.id, jobNo: base.job.jobNo },
    changes,
    suggested: suggestCodes(changes, baseCachi),
    copyCachi,
    baseCachi,
  };
}

// ── the file ────────────────────────────────────────────────────────────────────────────────────────────────────
const IGM_CODES = ['A_PBEIGM', 'A_IGM', 'S_IGMS'];

function igmErrors(igmRows, codes) {
  const errors = [];
  if (!igmRows.length) errors.push('IGM details are empty (Job Header > IGM)');
  igmRows.forEach((igm, index) => {
    const prefix = `IGM ${index + 1}: `;
    if (!igm.igmNumber) errors.push(prefix + 'IGM No is empty');
    if (!igm.igmDate) errors.push(prefix + 'IGM Date is empty');
    if (codes.includes('A_PBEIGM') && !igm.inwardDate)
      errors.push(prefix + 'Inward date is empty (needed to make a prior BE final)');
    if (!igm.mawbNo) errors.push(prefix + 'MAWB / BL No is empty');
    if (!(Number(igm.totalNoOfPackages) > 0)) errors.push(prefix + 'Packages are empty');
    if (!(Number(igm.grossWeight) > 0)) errors.push(prefix + 'Gross weight is empty');
  });
  return errors;
}

function checkFile(cachi, codes, amendment) {
  const errors = [];
  if (!(cachi.headerField || {}).senderID)
    errors.push('ICEGATE ID (sender) missing - choose the ICEGATE user (profile)');
  if (!String(amendment.beNo || '').replace(/\D/g, '')) errors.push('BE No of the filed BE is empty');
  if (!ymd(amendment.beDate)) errors.push('BE Date of the filed BE is empty');
  if (!String(amendment.reason || '').trim()) errors.push('Reason is empty');
  if (!codes.length) errors.push('No amendment code chosen');
  if (codes.some((code) => IGM_CODES.includes(code)))
    errors.push(...igmErrors((cachi.master || {}).igmsModel || [], codes));
  const hasDocWithIrn = ((cachi.master || {}).supportingDocsModel || []).some((doc) => doc.imageReferenceNo);
  if (codes.includes('S_DOCS') && !hasDocWithIrn)
    errors.push('S_DOCS: no e-Sanchit document with an IRN on the amended job');
  return errors;
}

// rows that go in the file: per table, the rows of the copy that changed (A / S) and the rows that were deleted (D,
// taken from the base); a table of a chosen code with no change is sent whole
function rowsForFile(changes, copyCachi, codes, include) {
  const master = {};
  const tables = new Set(codes.flatMap((code) => (CODE[code] || {}).tables || []));
  const actions = new Set(codes.map((code) => code.slice(0, 1)));
  for (const tag of tables) {
    const model = MODEL[tag];
    if (!model) continue;
    const allRows = Array.isArray((copyCachi.master || {})[model]) ? copyCachi.master[model] : [];
    const tableChanges = changes.filter(
      (c) => c.table === tag && actions.has(c.act) && (!include || include.has(c.table + '|' + c.key)),
    );
    if (!tableChanges.length) {
      master[model] = allRows.map((row) => ({ ...row, _act: 'A' }));
      continue;
    }
    master[model] = tableChanges.map((c) =>
      c.act === 'D' ? { ...c.row, _act: 'D' } : { ...allRows[c.index], _act: c.act },
    );
  }
  return master;
}

const uniqueValues = (values) => values.filter((value, index, all) => all.indexOf(value) === index);

async function makeFile(amendment, opts = {}) {
  const codes = parseJ(amendment.codes, [])
    .map((code) => String(code).toUpperCase())
    .filter((code) => CODE[code]);
  const found = await changesFor(amendment, {
    profileId: opts.profileId || amendment.icegateProfileId,
    reason: amendment.reason,
  });
  const include = Array.isArray(opts.include) && opts.include.length ? new Set(opts.include) : null;
  const errors = checkFile(found.copyCachi, codes, amendment);
  if (errors.length) throw Object.assign(httpError('The file cannot be made: ' + errors.join('; ')), { errors });

  const master = { ...found.copyCachi.master, ...rowsForFile(found.changes, found.copyCachi, codes, include) };
  const jobNo = String(amendment.amendNo || '')
    .replace(/\D/g, '')
    .slice(-AMEND_JOB_NO_DIGITS);
  const { text: fileText, unconfirmedCodes } = writeBeAmendFlat(
    { headerField: found.copyCachi.headerField, master },
    {
      codes,
      reason: String(amendment.reason || '').toUpperCase(),
      jobNo,
      jobDate: ymd(amendment.amendDate).replace(/-/g, ''),
      beNo: amendment.beNo,
      beDate: ymd(amendment.beDate).replace(/-/g, ''),
      rowAct: true,
    },
  );
  return {
    fileName: (jobNo || 'BEAMD') + '.be',
    text: fileText,
    codes,
    unconfirmedCodes: uniqueValues((unconfirmedCodes || []).concat(codes.filter((code) => !SEEN_IN_ICAFFE.has(code)))),
    changes: found.changes,
    base: found.base,
  };
}

export {
  CODES,
  CODE,
  STATUSES,
  SEEN_IN_ICAFFE,
  ensure,
  today,
  ymd,
  divisionOf,
  isCopy,
  loadJob,
  changesFor,
  makeFile,
  parseJ,
};
