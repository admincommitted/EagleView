// BE amendment, the iCAFFE way (10-Nov-2026).
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
//                       goes on from iCAFFE's last number (3282 on 09-11-2026 -> 3283). A number already in
//                       BeAmendments is skipped (so loading iCAFFE's history later cannot give a number twice).
//   what changed        the copy is turned into the CACHI01 tables and compared, table by table, with the BE as it stood
//                       before: the last amendment of this BE that was sent, else the copy that went to ICEGATE
//                       (filedJson), else the BE job as it is. Each changed row gets A (amended), S (added) or D (deleted);
//                       the codes follow from that (IGM filled in on a prior BE -> A_PBEIGM, new e-Sanchit doc -> S_DOCS ...).
//   the file            only the changed rows of the tables of the chosen codes, then one AMEND row per code
//                       (utils/beFlatFile.writeBeAmendFlat); file name = amendment no + ".be".
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');
const { unpackExtra } = require('./extraFields');

const q = (sql, p = [], t) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, transaction: t });
const x = (sql, p = [], t) => sequelize.query(sql, { replacements: p, transaction: t });
const bad = (m, status = 400) => Object.assign(new Error(m), { status });

// ── codes (iCAFFE's list; A = amend, S = add, D = delete) ────────────────────────────────────────────────────────
const CODES = [
  { code: 'A_MAIN', label: 'BE details (header)', act: 'A', tables: ['BE'] },
  { code: 'A_PBEIGM', label: 'Prior BE made final: IGM details', act: 'A', tables: ['IGMS'] },
  { code: 'A_IGM', label: 'IGM details (incl. MAWB / HAWB)', act: 'A', tables: ['IGMS'] },
  { code: 'A_INV', label: 'Invoice details', act: 'A', tables: ['INVOICE'] },
  { code: 'A_ITEM', label: 'Item details (incl. duty / SW)', act: 'A', tables: ['ITEMS', 'SBEDUTY', 'BE_ITEM_SW_INFO_TYPE', 'BE_ITEM_SW_CONST', 'BE_ITEM_SW_PROD', 'BE_ITEM_SW_CTRL'] },
  { code: 'S_IGMS', label: 'Add IGM', act: 'S', tables: ['IGMS'] },
  { code: 'S_CONT', label: 'Add container', act: 'S', tables: ['CONTAINER'] },
  { code: 'S_INV', label: 'Add invoice', act: 'S', tables: ['INVOICE', 'ITEMS', 'SBEDUTY'] },
  { code: 'S_ITEM', label: 'Add item', act: 'S', tables: ['ITEMS', 'SBEDUTY', 'BE_ITEM_SW_INFO_TYPE', 'BE_ITEM_SW_CONST', 'BE_ITEM_SW_PROD', 'BE_ITEM_SW_CTRL'] },
  { code: 'S_DOCS', label: 'Add supporting documents (e-Sanchit)', act: 'S', tables: ['SUPPORTINGDOCS'] },
  { code: 'S_STMT', label: 'Add statement', act: 'S', tables: ['STATEMENT'] },
  { code: 'D_IGMS', label: 'Delete IGM', act: 'D', tables: ['IGMS'] },
  { code: 'D_CONT', label: 'Delete container', act: 'D', tables: ['CONTAINER'] },
  { code: 'D_INV', label: 'Delete invoice', act: 'D', tables: ['INVOICE'] },
  { code: 'D_ITEM', label: 'Delete item', act: 'D', tables: ['ITEMS'] },
  { code: 'D_DOCS', label: 'Delete supporting documents', act: 'D', tables: ['SUPPORTINGDOCS'] },
];
const CODE = Object.fromEntries(CODES.map(c => [c.code, c]));
// seen in amendments filed from iCAFFE (Submit BE Amend lists, FY 26-27): the others follow the same pattern
const SEEN_IN_ICAFFE = new Set(['A_PBEIGM', 'A_IGM', 'A_MAIN', 'S_DOCS', 'S_IGMS', 'S_ITEM', 'D_IGMS']);
const STATUSES = ['Draft', 'Ready', 'Submitted', 'Accepted', 'Rejected', 'Void'];

// ── table ───────────────────────────────────────────────────────────────────────────────────────────────────────
let ready = null;
const ensure = () => (ready = ready || (async () => {
  await x(`CREATE TABLE IF NOT EXISTS BeAmendments (
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
    UNIQUE (branchCode, division, fyCode, amendNo))`);
  await x('CREATE INDEX IF NOT EXISTS idx_beamend_job ON BeAmendments (importJobId)');
  await x('CREATE INDEX IF NOT EXISTS idx_beamend_status ON BeAmendments (status)');
  await x('CREATE INDEX IF NOT EXISTS idx_beamend_be ON BeAmendments (beNo)');
  // number series: New Delhi Import Air continues iCAFFE's amendment numbers (last seen 3282 on 09-11-2026)
  const ns = require('./numberSeries'); await ns.ensure();
  const has = (await q("SELECT 1 FROM NumberSeries WHERE docType = 'BE_AMEND' LIMIT 1")).length;
  if (!has) {
    const s = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize reads
    await x(`INSERT OR IGNORE INTO NumberSeries (docType, branchCode, division, fyCode, format, pad, nextNo, source, isActive, modifiedBy, createdAt, updatedAt)
      VALUES ('BE_AMEND', 'DEL', 'AI', ?, '{N}', 0, 3283, 'iCAFFE Submit BE Amend: last no 3282 on 09-11-2026', 1, 'system', ?, ?)`, [ns.fyCodeOf(new Date().toISOString()), s, s]);
  }
})().catch(e => { ready = null; throw e; }));

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ymd = (v) => { const s = String(v || '').trim(); let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const divisionOf = (job) => { const mode = String(job.shipmentMode || '').toUpperCase(); return mode === 'AIR' ? 'AI' : mode === 'SEA' ? 'SI' : mode === 'LAND' ? 'LI' : 'AI'; };
const parseJ = (v, d) => { if (v == null || v === '') return d; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return d; } };
const isCopy = (job) => !!(job && (job._amendmentId || /^AMD\//.test(String(job.jobNo || ''))));

// a job with its invoices / items / containers, extendedData unpacked (as GET /api/import-jobs/:id gives it)
async function loadJob(id, t) {
  const ImportJob = require('../models/ImportJob'); const ImportInvoice = require('../models/ImportInvoice');
  const ImportItem = require('../models/ImportItem'); const ImportContainer = require('../models/ImportContainer');
  const j = await ImportJob.findByPk(id, {
    include: [{ model: ImportInvoice, as: 'invoices', include: [{ model: ImportItem, as: 'items' }] }, { model: ImportContainer, as: 'containers' }],
    order: [[{ model: ImportInvoice, as: 'invoices' }, 'id', 'ASC'], [{ model: ImportInvoice, as: 'invoices' }, { model: ImportItem, as: 'items' }, 'id', 'ASC'], [{ model: ImportContainer, as: 'containers' }, 'id', 'ASC']],
    transaction: t,
  });
  if (!j) return null;
  let d = unpackExtra(j.toJSON(), 'extendedData');
  ['_bondRows', '_hssRows'].forEach(k => { if (typeof d[k] === 'string') d[k] = parseJ(d[k], d[k]); });
  d.invoices = (d.invoices || []).map(inv => { const i2 = unpackExtra(inv, 'extendedData'); i2.items = (i2.items || []).map(it => unpackExtra(it, 'extendedData')); return i2; });
  d.containers = (d.containers || []).map(c => unpackExtra(c, 'extendedData'));
  return d;
}

// the job as the Job Entry screen holds it (jobData / items / invoices / e-Sanchit tab) - the same steps as
// JobEntryLayout.loadJobForEditing, so the CACHI01 made here is the one the screen would make
function jobToScreen(loaded) {
  const invoices = loaded.invoices || [];
  let items = [];
  invoices.forEach((inv, k) => { (inv.items || []).forEach(it => items.push({ ...it, invSrNo: String(k + 1), invNo: String(inv.invNo || inv.invoiceNo || it.invNo || '') })); });
  const asArr = (v) => { v = parseJ(v, []); return Array.isArray(v) ? v : []; };
  items = items.map(item => {
    const invNo = String(item.invSrNo || '1'); const itmNo = String(item.itemSrNo || item.itemNo || '1');
    ['swInfoData', 'swConstData', 'swProdData', 'swCtrlData', 'swStmtData', 'docsData', 'dutyRows', 'igstData', 'licenceData', 'schemeCatData', 'addData', 'antiDumpingData',
      'cvdData', 'svbData', 'otherDutyData', 'policyParaData', 'prevBeData', 'reimportData', 'rspData', 'ncdData'].forEach(k => { if (typeof item[k] === 'string') item[k] = parseJ(item[k], item[k]); });
    const match = (arr) => asArr(arr).filter(r => String(r.invoiceSerialNumber || r.invoiceSrNo || r.invSrNo) === invNo && String(r.itemSerialNumber || r.itemSrNo || r.itmNo) === itmNo);
    const rid = () => Date.now() + Math.random();
    const info = match(loaded._infoTypes || loaded._infoTypeModel || loaded._infotypemodel);
    if (info.length && !Array.isArray(item.swInfoData)) item.swInfoData = info.map(r => ({ agency: r.agencyCode || 'ALL', type: r.infoType || '', qualifier: r.infoQualifier || '', code: r.infoCode || '', text: r.infoText || '', qty: r.infoMsr || r.infoQty || '', uqc: r.infoUqc || '', id: rid() }));
    const cons = match(loaded._sw_ConstModel || loaded._sw_constmodel);
    if (cons.length && !Array.isArray(item.swConstData)) item.swConstData = cons.map(r => ({ srNo: r.constituentSrNo || r.constituentSerialNumber || '', name: r.constituentElementName || '', code: r.constituentElementCode || '', percent: r.constituentPercentage || '', yield: r.constituentYieldPercentage || '', active: r.activeIngredientFlag || r.activeIngredient || '', id: rid() }));
    const prod = match(loaded._sw_ProdModel || loaded._sw_prodmodel);
    if (prod.length && !Array.isArray(item.swProdData)) item.swProdData = prod.map(r => ({ batch: r.productionBatchIdentifier || r.batchNumber || '', qty: r.productionBatchQuantity || r.manufacturingQuantity || '', uqc: r.unitQuantityCode || '', mnfDate: r.dateOfManufacturing || '', expDate: r.dateOfExpiry || '', bestBefore: r.bestBefore || '', id: rid() }));
    const ctrl = match(loaded._ctrlModel || loaded._ctrlmodel);
    if (ctrl.length && !Array.isArray(item.swCtrlData)) item.swCtrlData = ctrl.map(r => ({ typeCode: r.controlTypeCode || '', location: r.controlLocation || '', startDate: r.controlStartDate || '', endDate: r.controlEndDate || '', resultCode: r.controlResultCode || '', resultText: r.controlResultText || '', msr: r.controlMsr || '', uqc: r.controlUqc || '', id: rid() }));
    const stmt = match(loaded._statements || loaded._statementModel || loaded._statementmodel);
    if (stmt.length && !Array.isArray(item.swStmtData)) item.swStmtData = stmt.map(r => ({ typeCode: r.statementType || '', stmtCode: r.statementCode || '', stmtText: r.statementText || '', stmtFor: r.statementFor || '', id: rid() }));
    // the file's whole document row in the panel's keys (drn, issuer*, bene*, expiry), as the job screen does. 19-Nov-2026
    const docs = match(loaded._supportingDocsModel || loaded._supportingdocsmodel);
    if (docs.length && !Array.isArray(item.docsData)) item.docsData = docs.map(r => ({ icegateId: r.icegateUserId || '', docCode: r.documentTypeCode || r.documentClassCode || '', docName: '', irn: r.imageReferenceNo || '', drn: r.documentReferenceNo || r.documentReferenceNumber || '', issueDate: r.documentIssueDate || '', expiryDate: r.documentExpiryDate || '', placeOfIssue: r.placeOfIssue || r.documentIssueLocation || '', issuerCode: r.documentIssuingPartyCode || '', issuerName: r.documentIssuingPartyName || r.documentIssuerName || '', issuerAddr1: r.documentIssuingPartyNameAddress1 || r.documentIssuerAddress || '', issuerAddr2: r.documentIssuingPartyNameAddress2 || '', issuerCity: r.documentIssuingPartyNameCity || '', issuerPin: r.documentIssuingPartyNamePin || '', beneCode: r.documentBeneficiaryPartyCode || '', beneName: r.documentBeneficiaryPartyName || '', beneAddr1: r.documentBeneficiaryPartyNameAddress1 || '', beneAddr2: r.documentBeneficiaryPartyNameAddress2 || '', beneCity: r.documentBeneficiaryPartyNameCity || '', benePin: r.documentBeneficiaryPartyPin || '', fileType: String(r.fileType || 'PDF').toUpperCase(), docFor: 'ITEM', id: rid() }));
    return item;
  });
  // e-Sanchit tab (BE / invoice level docs)
  let esanchitDocs = asArr(loaded.esanchitDocs);
  if (!esanchitDocs.length) {
    const head = asArr(loaded._supportingDocsModel || loaded._supportingdocsmodel).filter(d => String(d.itemSerialNumber || '0') === '0');
    esanchitDocs = head.map((d, i) => ({
      id: i + 1, srNo: i + 1, docFor: String(d.invoiceSerialNumber || '0') === '0' ? 'HEADER' : 'INVOICE', invSrNo: String(d.invoiceSerialNumber || '0') === '0' ? '' : String(d.invoiceSerialNumber),
      icegateId: d.icegateUserId || '', fileType: d.fileType || 'PDF', irn: d.imageReferenceNo || '', drn: d.documentReferenceNo || '', docCode: d.documentTypeCode || '', fileName: d.fileType || '',
      issuerCode: d.documentIssuingPartyCode || '', issuerName: d.documentIssuingPartyName || '', issuerAddr1: d.documentIssuingPartyNameAddress1 || '', issuerAddr2: d.documentIssuingPartyNameAddress2 || '',
      issuerCity: d.documentIssuingPartyNameCity || '', issuerPin: d.documentIssuingPartyNamePin || '', beneCode: d.documentBeneficiaryPartyCode || '', beneName: d.documentBeneficiaryPartyName || '',
      beneAddr1: d.documentBeneficiaryPartyNameAddress1 || '', beneAddr2: d.documentBeneficiaryPartyNameAddress2 || '', beneCity: d.documentBeneficiaryPartyNameCity || '', benePin: d.documentBeneficiaryPartyPin || '',
      placeOfIssue: d.placeOfIssue || '', issueDate: d.documentIssueDate || '', expiryDate: d.documentExpiryDate || '',
    }));
  }
  const transportMode = loaded.shipmentMode === 'AIR' ? 'A' : loaded.shipmentMode === 'LAND' ? 'L' : 'S';
  const beType = loaded.boeType === 'WAREHOUSE' ? 'W' : loaded.boeType === 'EX_BOND' ? 'X' : 'H';
  return { jobData: { ...loaded, esanchitDocs }, items, invoices, beType, transportMode };
}

async function cachiOf(loaded, opts = {}) {
  const { buildBE_CACHI01 } = require('./IcegateJsonBuilder');
  const s = jobToScreen(loaded);
  return buildBE_CACHI01(s.jobData, s.items, s.invoices, { beType: s.beType, transportMode: s.transportMode, profileId: opts.profileId, indicator: 'P', isAmendment: true, amendment: true, amendReason: opts.reason });
}

// ── what changed: CACHI01 tables of the base vs the copy ─────────────────────────────────────────────────────────
const { BE_FLAT_TABLES } = require('./beFlatFile');
const MODEL = Object.fromEntries(BE_FLAT_TABLES);
const VOLATILE = new Set(['messageType', 'customHouseCode', 'beNumber', 'beDate', 'jobNumber', 'jobDate', 'declarationNo', 'declarationDate', 'sequenceOrControlNumber', '_act']);
const s = (v) => (v === undefined || v === null ? '' : String(v)).trim();
const pairKey = (r) => s(r.invoiceSerialNumber) + '/' + s(r.itemSerialNumber);
const KEY = {
  BE: () => 'BE',
  IGMS: (r, i) => 'IGM ' + (i + 1),
  INVOICE: (r) => 'Inv ' + s(r.invoiceSerialNumber),
  ITEMS: (r) => 'Item ' + pairKey(r),
  SBEDUTY: (r) => 'Duty ' + pairKey(r) + ' ' + s(r.dutyType || r.dutyCode || r.dutyTypeCode),
  BE_ITEM_SW_INFO_TYPE: (r) => 'SW info ' + pairKey(r) + ' ' + s(r.infoType) + ' ' + s(r.infoQualifier) + ' ' + s(r.infoCode),
  BE_ITEM_SW_CONST: (r) => 'SW const ' + pairKey(r) + ' ' + s(r.constituentSerialNumber || r.constituentSrNo),
  BE_ITEM_SW_PROD: (r) => 'SW prod ' + pairKey(r) + ' ' + s(r.productionBatchIdentifier),
  BE_ITEM_SW_CTRL: (r) => 'SW ctrl ' + pairKey(r) + ' ' + s(r.controlTypeCode),
  CONTAINER: (r) => 'Cont ' + s(r.containerNumber || r.containerNo),
  SUPPORTINGDOCS: (r) => 'Doc ' + (s(r.imageReferenceNo) || s(r.documentReferenceNo)) + ' ' + pairKey(r),
  STATEMENT: (r) => 'Stmt ' + pairKey(r) + ' ' + s(r.statementCode) + ' ' + s(r.statementText).slice(0, 40),
};
const DIFF_TABLES = Object.keys(KEY);
const fieldsOf = (r) => Object.keys(r || {}).filter(k => !VOLATILE.has(k));
function compareRows(a, b) { const keys = new Set([...fieldsOf(a), ...fieldsOf(b)]); const out = []; for (const k of keys) if (s(a[k]) !== s(b[k])) out.push({ field: k, was: s(a[k]), now: s(b[k]) }); return out; }

function diffCachi(base, copy) {
  const bm = (base && base.master) || {}; const cm = (copy && copy.master) || {};
  const changes = [];
  for (const tag of DIFF_TABLES) {
    const model = MODEL[tag]; if (!model) continue;
    const br = Array.isArray(bm[model]) ? bm[model] : []; const cr = Array.isArray(cm[model]) ? cm[model] : [];
    const bk = new Map(br.map((r, i) => [KEY[tag](r, i), r])); const ck = new Map(cr.map((r, i) => [KEY[tag](r, i), { r, i }]));
    for (const [k, { r, i }] of ck) {
      const old = bk.get(k);
      if (!old) changes.push({ table: tag, key: k, act: 'S', index: i, fields: [] });
      else { const f = compareRows(old, r); if (f.length) changes.push({ table: tag, key: k, act: 'A', index: i, fields: f }); }
    }
    for (const [k, r] of bk) if (!ck.has(k)) changes.push({ table: tag, key: k, act: 'D', index: -1, row: r, fields: [] });
  }
  return changes;
}

// codes that follow from the changes
function suggestCodes(changes, base) {
  const out = new Set(); const has = (tag, act) => changes.some(c => c.table === tag && c.act === act);
  const itemTables = ['ITEMS', 'SBEDUTY', 'BE_ITEM_SW_INFO_TYPE', 'BE_ITEM_SW_CONST', 'BE_ITEM_SW_PROD', 'BE_ITEM_SW_CTRL'];
  if (has('BE', 'A')) out.add('A_MAIN');
  if (has('IGMS', 'A')) {
    // a prior BE (IGM not yet filed when the BE was) becomes final once the IGM no / date / inward date are filled in
    const be0 = (((base || {}).master || {}).beModel || [])[0] || {};
    const prior = /^Y/i.test(s(be0.priorBe || be0.whetherPriorBe || be0.priorBeFlag || be0.whetherPriorBE));
    const igmField = (f) => ['igmNumber', 'igmDate', 'inwardDate'].includes(f.field);
    const filledIn = changes.some(c => c.table === 'IGMS' && c.act === 'A' && c.fields.some(f => igmField(f) && !f.was && f.now));
    // only the IGM no / date / inward date make it "prior to final"; any other IGM change (MAWB / HAWB / pkgs) is A_IGM
    const igmTouched = changes.some(c => c.table === 'IGMS' && c.act === 'A' && c.fields.some(igmField));
    out.add(filledIn || (prior && igmTouched) ? 'A_PBEIGM' : 'A_IGM');
  }
  if (has('IGMS', 'S')) out.add('S_IGMS'); if (has('IGMS', 'D')) out.add('D_IGMS');
  if (has('INVOICE', 'A')) out.add('A_INV'); if (has('INVOICE', 'S')) out.add('S_INV'); if (has('INVOICE', 'D')) out.add('D_INV');
  const newInv = new Set(changes.filter(c => c.table === 'INVOICE' && c.act === 'S').map(c => c.key.replace('Inv ', '')));
  const itemIn = (c) => newInv.has(c.key.replace(/^[^\d]*/, '').split('/')[0]);
  if (changes.some(c => itemTables.includes(c.table) && c.act === 'A')) out.add('A_ITEM');
  if (changes.some(c => c.table === 'ITEMS' && c.act === 'S' && !itemIn(c))) out.add('S_ITEM');
  if (changes.some(c => c.table === 'ITEMS' && c.act === 'D')) out.add('D_ITEM');
  if (has('CONTAINER', 'S')) out.add('S_CONT'); if (has('CONTAINER', 'D')) out.add('D_CONT');
  if (has('SUPPORTINGDOCS', 'S')) out.add('S_DOCS'); if (has('SUPPORTINGDOCS', 'D')) out.add('D_DOCS');
  if (has('STATEMENT', 'S')) out.add('S_STMT');
  return [...out];
}

// the BE as it stood before this amendment: the last amendment of the same BE that was sent, else what went to ICEGATE,
// else the BE job itself
async function baseFor(am, t) {
  const prev = (await q(`SELECT amendedJobId FROM BeAmendments WHERE importJobId = ? AND id <> ? AND status IN ('Submitted', 'Accepted') AND amendedJobId IS NOT NULL
      AND (amendDate < ? OR (amendDate = ? AND id < ?)) ORDER BY amendDate DESC, id DESC LIMIT 1`, [am.importJobId, am.id, am.amendDate, am.amendDate, am.id], t))[0];
  if (prev) { const j = await loadJob(prev.amendedJobId, t); if (j) return { from: 'amendment', job: j }; }
  const parent = await loadJob(am.importJobId, t);
  if (!parent) throw bad('The BE job of this amendment is not there any more', 404);
  const filed = parseJ(parent.filedJson, null);
  if (filed && filed.master) return { from: 'filed', job: parent, cachi: filed };
  return { from: 'job', job: parent };
}

async function changesFor(am, opts = {}) {
  const base = await baseFor(am);
  const copy = await loadJob(am.amendedJobId);
  if (!copy) throw bad('The amended job of this amendment is not there any more', 404);
  const [bc, cc] = await Promise.all([base.cachi ? Promise.resolve(base.cachi) : cachiOf(base.job, opts), cachiOf(copy, opts)]);
  const changes = diffCachi(bc, cc);
  return { base: { from: base.from, jobId: base.job.id, jobNo: base.job.jobNo }, changes, suggested: suggestCodes(changes, bc), copyCachi: cc, baseCachi: bc };
}

// ── the file ────────────────────────────────────────────────────────────────────────────────────────────────────
function checkFile(cachi, codes, am) {
  const errors = [];
  if (!(cachi.headerField || {}).senderID) errors.push('ICEGATE ID (sender) missing - choose the ICEGATE user (profile)');
  if (!String(am.beNo || '').replace(/\D/g, '')) errors.push('BE No of the filed BE is empty');
  if (!ymd(am.beDate)) errors.push('BE Date of the filed BE is empty');
  if (!String(am.reason || '').trim()) errors.push('Reason is empty');
  if (!codes.length) errors.push('No amendment code chosen');
  if (codes.some(c => ['A_PBEIGM', 'A_IGM', 'S_IGMS'].includes(c))) {
    const igms = (cachi.master || {}).igmsModel || [];
    if (!igms.length) errors.push('IGM details are empty (Job Header > IGM)');
    igms.forEach((g, i) => {
      const w = `IGM ${i + 1}: `;
      if (!g.igmNumber) errors.push(w + 'IGM No is empty');
      if (!g.igmDate) errors.push(w + 'IGM Date is empty');
      if (codes.includes('A_PBEIGM') && !g.inwardDate) errors.push(w + 'Inward date is empty (needed to make a prior BE final)');
      if (!g.mawbNo) errors.push(w + 'MAWB / BL No is empty');
      if (!(Number(g.totalNoOfPackages) > 0)) errors.push(w + 'Packages are empty');
      if (!(Number(g.grossWeight) > 0)) errors.push(w + 'Gross weight is empty');
    });
  }
  if (codes.includes('S_DOCS') && !((cachi.master || {}).supportingDocsModel || []).some(d => d.imageReferenceNo)) errors.push('S_DOCS: no e-Sanchit document with an IRN on the amended job');
  return errors;
}

// rows that go in the file: per table, the rows of the copy that changed (A / S) and the rows that were deleted (D,
// taken from the base); a table of a chosen code with no change is sent whole (as the file made before 10-Nov did)
function rowsForFile(changes, cc, codes, include) {
  const m = {}; const tables = new Set(codes.flatMap(c => (CODE[c] || {}).tables || []));
  const acts = new Set(codes.map(c => c.slice(0, 1)));
  for (const tag of tables) {
    const model = MODEL[tag]; if (!model) continue;
    const all = Array.isArray((cc.master || {})[model]) ? cc.master[model] : [];
    const ch = changes.filter(c => c.table === tag && acts.has(c.act) && (!include || include.has(c.table + '|' + c.key)));
    if (!ch.length) { m[model] = all.map(r => ({ ...r, _act: 'A' })); continue; }
    m[model] = ch.map(c => c.act === 'D' ? { ...c.row, _act: 'D' } : { ...all[c.index], _act: c.act });
  }
  return m;
}

async function makeFile(am, opts = {}) {
  const codes = parseJ(am.codes, []).map(c => String(c).toUpperCase()).filter(c => CODE[c]);
  const ch = await changesFor(am, { profileId: opts.profileId || am.icegateProfileId, reason: am.reason });
  const include = Array.isArray(opts.include) && opts.include.length ? new Set(opts.include) : null;
  const errors = checkFile(ch.copyCachi, codes, am);
  if (errors.length) throw Object.assign(bad('The file cannot be made: ' + errors.join('; ')), { errors });
  const master = { ...ch.copyCachi.master, ...rowsForFile(ch.changes, ch.copyCachi, codes, include) };
  const { writeBeAmendFlat } = require('./beFlatFile');
  const jobNo = String(am.amendNo || '').replace(/\D/g, '').slice(-7);
  const { text, unconfirmedCodes } = writeBeAmendFlat({ headerField: ch.copyCachi.headerField, master }, {
    codes, reason: String(am.reason || '').toUpperCase(), jobNo, jobDate: ymd(am.amendDate).replace(/-/g, ''),
    beNo: am.beNo, beDate: ymd(am.beDate).replace(/-/g, ''), rowAct: true,
  });
  return { fileName: (jobNo || 'BEAMD') + '.be', text, codes, unconfirmedCodes: (unconfirmedCodes || []).concat(codes.filter(c => !SEEN_IN_ICAFFE.has(c))).filter((c, i, a) => a.indexOf(c) === i), changes: ch.changes, base: ch.base };
}

module.exports = { CODES, CODE, STATUSES, SEEN_IN_ICAFFE, ensure, today, ymd, divisionOf, isCopy, loadJob, jobToScreen, cachiOf, diffCachi, suggestCodes, changesFor, makeFile, parseJ };
