import { beTypeOf, transportModeOf } from './jobCodes';
import { newRowId } from './screenRowId';

// popup rows saved on the item itself come back as JSON text; they win over the job-level rows below
const ITEM_POPUP_FIELDS = ['swInfoData', 'swConstData', 'swProdData', 'swCtrlData', 'swStmtData', 'docsData', 'dutyRows', 'igstData', 'licenceData',
  'schemeCatData', 'addData', 'antiDumpingData', 'cvdData', 'svbData', 'otherDutyData', 'policyParaData', 'prevBeData', 'reimportData', 'rspData', 'ncdData'];

const supportingDocRow = (doc) => ({
  icegateId: doc.icegateUserId || '',
  docCode: doc.documentTypeCode || doc.documentClassCode || '',
  docName: '',
  irn: doc.imageReferenceNo || '',
  drn: doc.documentReferenceNo || doc.documentReferenceNumber || '',
  issueDate: doc.documentIssueDate || '',
  expiryDate: doc.documentExpiryDate || '',
  placeOfIssue: doc.placeOfIssue || doc.documentIssueLocation || '',
  issuerCode: doc.documentIssuingPartyCode || '',
  issuerName: doc.documentIssuingPartyName || doc.documentIssuerName || '',
  issuerAddr1: doc.documentIssuingPartyNameAddress1 || doc.documentIssuerAddress || '',
  issuerAddr2: doc.documentIssuingPartyNameAddress2 || '',
  issuerCity: doc.documentIssuingPartyNameCity || '',
  issuerPin: doc.documentIssuingPartyNamePin || '',
  beneCode: doc.documentBeneficiaryPartyCode || '',
  beneName: doc.documentBeneficiaryPartyName || '',
  beneAddr1: doc.documentBeneficiaryPartyNameAddress1 || '',
  beneAddr2: doc.documentBeneficiaryPartyNameAddress2 || '',
  beneCity: doc.documentBeneficiaryPartyNameCity || '',
  benePin: doc.documentBeneficiaryPartyPin || '',
  fileType: String(doc.fileType || 'PDF').toUpperCase(),
  docFor: 'ITEM',
});

// job-level ICEGATE rows (keyed by invoice / item serial no) -> the item's popup rows
const ITEM_POPUP_ROWS = [
  {
    field: 'swInfoData',
    sources: ['_infoTypes', '_infoTypeModel', '_infotypemodel'],
    // ICEGATE: infoMsr is the quantity, infoUqc the unit
    toRow: (row) => ({ agency: row.agencyCode || 'ALL', type: row.infoType || '', qualifier: row.infoQualifier || '', code: row.infoCode || '', text: row.infoText || '', qty: row.infoMsr || row.infoQty || '', uqc: row.infoUqc || '' }),
  },
  {
    field: 'swConstData',
    sources: ['_sw_ConstModel', '_sw_constmodel'],
    toRow: (row) => ({ srNo: row.constituentSrNo || row.constituentSerialNumber || '', name: row.constituentElementName || '', code: row.constituentElementCode || '', percent: row.constituentPercentage || '', yield: row.constituentYieldPercentage || '', active: row.activeIngredientFlag || row.activeIngredient || '' }),
  },
  {
    field: 'swProdData',
    sources: ['_sw_ProdModel', '_sw_prodmodel'],
    toRow: (row) => ({ batch: row.productionBatchIdentifier || row.batchNumber || '', qty: row.productionBatchQuantity || row.manufacturingQuantity || '', uqc: row.unitQuantityCode || '', mnfDate: row.dateOfManufacturing || '', expDate: row.dateOfExpiry || '', bestBefore: row.bestBefore || '' }),
  },
  {
    field: 'swCtrlData',
    sources: ['_ctrlModel', '_ctrlmodel'],
    toRow: (row) => ({ typeCode: row.controlTypeCode || '', location: row.controlLocation || '', startDate: row.controlStartDate || '', endDate: row.controlEndDate || '', resultCode: row.controlResultCode || '', resultText: row.controlResultText || '', msr: row.controlMsr || '', uqc: row.controlUqc || '' }),
  },
  {
    field: 'swStmtData',
    sources: ['_statements', '_statementModel', '_statementmodel'],
    toRow: (row) => ({ typeCode: row.statementType || '', stmtCode: row.statementCode || '', stmtText: row.statementText || '', stmtFor: row.statementFor || '' }),
  },
  { field: 'docsData', sources: ['_supportingDocsModel', '_supportingdocsmodel'], toRow: supportingDocRow },
];

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const listOrNull = (value) => {
  const parsed = typeof value === 'string' ? parseJson(value, null) : value;
  return Array.isArray(parsed) ? parsed : null;
};

const firstGiven = (loaded, keys) => keys.map((key) => loaded[key]).find(Boolean);

function rowsOfItem(rows, invSrNo, itemSrNo) {
  return (listOrNull(rows) || []).filter((row) =>
    String(row.invoiceSerialNumber || row.invoiceSrNo || row.invSrNo) === invSrNo
    && String(row.itemSerialNumber || row.itemSrNo || row.itmNo) === itemSrNo);
}

function withPopupRows(item, loaded) {
  const mapped = { ...item };
  ITEM_POPUP_FIELDS.forEach((field) => {
    if (typeof mapped[field] === 'string') mapped[field] = parseJson(mapped[field], mapped[field]);
  });
  const invSrNo = String(mapped.invSrNo || '1');
  const itemSrNo = String(mapped.itemSrNo || mapped.itemNo || '1');
  ITEM_POPUP_ROWS.forEach(({ field, sources, toRow }) => {
    const rows = rowsOfItem(firstGiven(loaded, sources), invSrNo, itemSrNo);
    if (rows.length && !Array.isArray(mapped[field])) mapped[field] = rows.map((row) => ({ ...toRow(row), id: newRowId() }));
  });
  return mapped;
}

const headerDocRow = (doc, index) => {
  const isBeLevel = String(doc.invoiceSerialNumber || '0') === '0';
  return {
    id: newRowId(),
    srNo: index + 1,
    docFor: isBeLevel ? 'HEADER' : 'INVOICE',
    invSrNo: isBeLevel ? '' : String(doc.invoiceSerialNumber),
    icegateId: doc.icegateUserId || '',
    fileType: doc.fileType || 'PDF',
    irn: doc.imageReferenceNo || '',
    drn: doc.documentReferenceNo || '',
    docCode: doc.documentTypeCode || '',
    fileName: doc.fileType || '',
    issuerCode: doc.documentIssuingPartyCode || '',
    issuerName: doc.documentIssuingPartyName || '',
    issuerAddr1: doc.documentIssuingPartyNameAddress1 || '',
    issuerAddr2: doc.documentIssuingPartyNameAddress2 || '',
    issuerCity: doc.documentIssuingPartyNameCity || '',
    issuerPin: doc.documentIssuingPartyNamePin || '',
    beneCode: doc.documentBeneficiaryPartyCode || '',
    beneName: doc.documentBeneficiaryPartyName || '',
    beneAddr1: doc.documentBeneficiaryPartyNameAddress1 || '',
    beneAddr2: doc.documentBeneficiaryPartyNameAddress2 || '',
    beneCity: doc.documentBeneficiaryPartyNameCity || '',
    benePin: doc.documentBeneficiaryPartyPin || '',
    placeOfIssue: doc.placeOfIssue || '',
    issueDate: doc.documentIssueDate || '',
    expiryDate: doc.documentExpiryDate || '',
  };
};

// BE-level (invoice 0) and invoice-level documents (item 0) are the job's e-Sanchit documents
function esanchitDocsOf(loaded) {
  const savedDocs = listOrNull(loaded.esanchitDocs);
  if (savedDocs?.length) return savedDocs;
  const allDocs = listOrNull(loaded._supportingDocsModel) || listOrNull(loaded._supportingdocsmodel) || [];
  const headerDocs = allDocs.filter((doc) => String(doc.itemSerialNumber || '0') === '0');
  return headerDocs.length ? headerDocs.map(headerDocRow) : (listOrNull(loaded.finalDocs) || []);
}

// A saved job (GET /import-jobs/:id) in the shape the job screen holds it. The job list's right-click menu uses it
// too, so a BE file made from the list is the same as the one made on the screen.
export function mapLoadedImportJob(loaded) {
  const invoices = loaded.invoices || [];
  // an item's Inv Sr No / Inv No come from the invoice it was saved under
  const items = invoices
    .flatMap((invoice, index) => (invoice.items || []).map((item) => ({ ...item, invSrNo: String(index + 1), invNo: String(invoice.invNo || invoice.invoiceNo || item.invNo || '') })))
    .map((item) => withPopupRows(item, loaded));

  return {
    jobData: { ...loaded, invoices },
    items,
    esanchitDocs: esanchitDocsOf(loaded),
    transportMode: transportModeOf(loaded.shipmentMode),
    beType: beTypeOf(loaded.boeType),
  };
}
