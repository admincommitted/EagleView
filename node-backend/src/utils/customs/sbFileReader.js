// Shipping Bill file reader: ICEGATE SB JSON (CACHE01) and ICES flat file (.sb) -> Export screen data.
//
// Both formats are first read into the same rows with the ICEGATE JSON names (sbModel, invoiceModel, itemModel,
// dbkModel, infoType, statement, supportingDocs, exchangeModel ...), then turned into what the Export screen and the
// SB JSON builder (IcegateJsonBuilder.buildSB_CACHE01) use, so a file read in and sent again keeps its data.
// In a CACHE01 JSON sbModel is a list and the items are in itemModel (not itemsModel).
//
// Flat file layout (fields split by ASCII 29). Every data row starts: 0 'F', 1 customs location, 2 job number,
// 3 job date, 4-5 SB no / date; then the fields in the order of the JSON model. Checked against SB files that exist
// in both forms (same SB as .json and .sb): every non-empty column matched the JSON value of that name.
const GS = '\x1d';
const LINE_END = '\r\n';
const BYTE_ORDER_MARK = /^﻿/;

const SB_COLS = {
  6: 'chaLicenseNumber',
  7: 'importerExporterCode',
  8: 'branchSrNoOfExporter',
  9: 'impExpName',
  10: 'impExpAddress1',
  11: 'impExpAddress2',
  12: 'impExpCity',
  13: 'impExpState',
  14: 'impExpPin',
  15: 'typeOfExporter',
  16: 'exporterClass',
  17: 'stateOfOriginExporter',
  18: 'authorizedDealerCode',
  19: 'epzCode',
  20: 'consigneeName',
  21: 'consigneeAddress1',
  22: 'consigneeAddress2',
  23: 'consigneeAddress3',
  24: 'consigneeAddress4',
  25: 'consigneeCountry',
  26: 'categoryForNEFISB',
  27: 'rbiWaiverNo',
  28: 'rbiWaiverDate',
  29: 'portOfLoading',
  30: 'portOfFinalDestination',
  31: 'countryOfFinalDestination',
  32: 'countryOfDischarge',
  33: 'portOfDischarge',
  34: 'sealType',
  35: 'natureOfCargo',
  36: 'grossWeight',
  37: 'netWeight',
  38: 'unitOfMeasurement',
  39: 'totalNumberOfPackages',
  40: 'marksNumbers',
  41: 'numberOfLoosePackets',
  42: 'numberOfContainers',
  43: 'mawbnumber',
  44: 'hawbnumber',
  48: 'gstnType',
  49: 'gstnId',
};
const INV_COLS = {
  6: 'invoiceSerialNumber',
  7: 'actualInvoiceNo',
  8: 'invoiceDate',
  9: 'invoiceCurrency',
  10: 'natureOfContract',
  11: 'buyerName',
  12: 'buyerAddress1',
  13: 'buyerAddress2',
  14: 'buyerAddress3',
  15: 'buyerAddress4',
  16: 'freightCurrency',
  17: 'freightAmount',
  18: 'insuranceRate',
  19: 'insuranceCurrency',
  20: 'insuranceAmount',
  21: 'commissionRate',
  22: 'commissionCurrency',
  23: 'commissionAmount',
  24: 'discountOnFOB',
  25: 'discountCurrency',
  26: 'discountAmount',
  27: 'otherDeductions',
  28: 'otherDeductionsCurrency',
  29: 'otherDeductionsAmount',
  30: 'addFreight',
  31: 'packingCharges',
  32: 'exporterContractNumber',
  33: 'natureOfPayment',
  34: 'periodOfPayment',
  38: 'thirdPartyName',
  39: 'thirdPartyAddress1',
  40: 'thirdPartyAddress2',
  41: 'thirdPartyCity',
  42: 'thirdPartyCountrySubdivision',
  43: 'thirdPartCountryCode',
  44: 'thirdPartyPin',
  45: 'authorizedEconomicOperatorCode',
  46: 'authorizedEconomicOperatorCountry',
  47: 'authorizedEconomicOperatorRole',
  48: 'termsPlace',
};
const ITEM_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'schemeCode',
  9: 'ritcCode',
  10: 'descOfGoods1',
  11: 'descOfGoods2',
  12: 'descOfGoods3',
  13: 'unitOfMeasurement',
  14: 'quantity',
  15: 'unitPrice',
  16: 'unitOfRate',
  17: 'noOfUnit',
  18: 'presentMarketValue',
  19: 'jobWorkNotificationNo',
  20: 'thirdParty',
  21: 'rewardItem',
  25: 'itemManufacturerProducerCodeType',
  26: 'itemManufacturerProducerGrowerCode',
  27: 'itemManufacturerProducerGrowerAddress1',
  28: 'itemManufacturerProducerGrowerAddress2',
  29: 'itemManufacturerProducerGrowerCity',
  30: 'itemManufacturerProducerGrowerCountrySubdivision',
  31: 'itemManufacturerProducerGrowerPin',
  32: 'itemManufacturerCountry',
  33: 'sourceState',
  34: 'transitCountry',
  35: 'accessoryStatus',
  36: 'endUseOfItem',
  37: 'hawbNo',
  38: 'totalPackage',
  39: 'igstPaymentStatus',
  40: 'taxableValue',
  41: 'igstAmount',
};
const DBK_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'dbkScheduleNumber',
  9: 'drawbackQuantity',
}; // column 10 = amendment type
const INFO_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumber',
  8: 'infoSrNo',
  9: 'infoType',
  10: 'infoQualifier',
  11: 'infoCode',
  12: 'infoText',
  13: 'infoMeasure',
  14: 'infouqc',
};
const STMT_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumber',
  8: 'statementSerialNo',
  9: 'statementType',
  10: 'statementCode',
  11: 'statementText',
};
const DOC_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumber',
  8: 'serialNo',
  9: 'imageReferenceNumber',
  10: 'documentTypeCode',
  11: 'documentIssuingPartyCode',
  12: 'documentIssuingPartyNameAddress1',
  13: 'documentIssuingPartyNameAddress2',
  14: 'documentIssuingPartyNameCity',
  15: 'documentIssuingPartyNamePin',
  16: 'documentReferenceNo',
  17: 'placeOfIssue',
  18: 'documentIssueDate',
  19: 'documentExpiryDate',
  20: 'documentBeneficiaryPartyCode',
  21: 'documentBeneficiaryPartyNameAddress1',
  22: 'documentBeneficiaryPartyNameAddress2',
  23: 'documentBeneficiaryPartyNameCity',
  24: 'documentBeneficiaryPartyNamePin',
  25: 'fileType',
  26: 'documentIssuingPartyName',
  27: 'documentBeneficiaryPartyName',
  28: 'icegateId',
};
const EXCH_COLS = {
  6: 'invoiceCurrencyCode',
  7: 'currencyName',
  8: 'unitInRs',
  9: 'rate',
  10: 'effectiveDate',
  11: 'whetherStandardCurrency',
};
// LICENCE (ICES 1.5 Exports message format, CACHE01 part 12): the licence rows of an Advance Licence SB
const LIC_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'srno',
  9: 'registrationNo',
  10: 'registrationDate',
  11: 'itemSerialNoInPartE',
  12: 'itemSerialNoInPartC',
  13: 'quantity',
  14: 'exportQuantity',
  15: 'whetherIndigenousImported',
};
const CONT_COLS = {
  4: 'containerNumber',
  5: 'containerSize',
  6: 'exciseSealNo',
  7: 'sealDate',
  8: 'sealTypeIndicator',
  9: 'sealDeviceID',
  10: 'movementDocumentType',
  11: 'movementDocumentNumber',
}; // no SB no / date columns
// The other CACHE01 parts, from the same format document (columns = Sr. No. - 1; the amendment type / no /
// date columns stay empty in a fresh "F" file). PACKINGLIST, ROTATION, STUFF and CONTAINER have no SB no / date columns.
const ACCESS_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'descriptionOfAccessories' };
const TP_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'iec',
  9: 'branchSerialNo',
  10: 'exporterName',
  11: 'exporterAddress1',
  12: 'exporterAddress2',
  13: 'city',
  14: 'pin',
  18: 'gstnType',
  19: 'gstnId',
};
const CESS_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'srno',
  9: 'cessActCode',
  10: 'quantity',
};
const RAW_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'rawMaterialCode', 9: 'quantity' };
const DEPB_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'groupCode',
  9: 'itemCode',
  10: 'quantity',
};
const DEPBP_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'srNo',
  9: 'groupCode',
  10: 'itemCode',
  11: 'quantity',
  12: 'unitQuantityCode',
  13: 'quantityPercentage',
};
const DFIA_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'srno',
  9: 'sionGroupCode',
  10: 'sionSerialNumber',
  11: 'sionIoNormSerialNo',
  12: 'quantity',
  13: 'unitOfMeasurement',
  14: 'itemDescription',
  15: 'technicalCharacteristics',
  16: 'fileNumber',
  17: 'licenseNumber',
};
const JOBWORK_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'srno',
  9: 'beNumber',
  10: 'beDate',
  11: 'beInvoiceSerialNo',
  12: 'beInvoiceNumber',
  13: 'beItemNumber',
  14: 'bePortCode',
  15: 'beQtyUsed',
  16: 'qtyUnits',
};
const AR4_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumberInvoice',
  8: 'ar4Number',
  9: 'ar4Date',
  10: 'commissionerate',
  11: 'division',
  12: 'range',
  13: 'remarks',
};
const PACK_COLS = { 4: 'packingNumberFrom', 5: 'packingNumberTo', 6: 'packingCode' };
const ROT_COLS = { 4: 'rotationDate', 5: 'rotationNumber' };
const EOU_COLS = {
  6: 'ieCodeOfTheEOU',
  7: 'branchSrNumberOfIE',
  8: 'examinationDate',
  9: 'examiningOfficerName',
  10: 'examiningOfficerDesignation',
  11: 'supervisingOfficerName',
  12: 'supervisingOfficerDesignation',
  13: 'commissionerate',
  14: 'division',
  15: 'range',
  16: 'sealNo',
  17: 'itemValuesVerifiedByExaminingOfficer',
  18: 'sampleForwarded',
};
const STUFF_COLS = { 4: 'factoryStuffed', 5: 'sampleAccompanied' };
const CONST_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumber',
  8: 'constituentSerialNo',
  9: 'constituentElementName',
  10: 'constituentElementCode',
  11: 'constituentPercentage',
  12: 'constituentYieldPercentage',
  13: 'activeIngredient',
};
const PROD_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumber',
  8: 'productionSerialNo',
  9: 'productionBatchIdentifier',
  10: 'productionBatchQuantity',
  11: 'unitQuantityCode',
  12: 'dateOfManufacturing',
  13: 'dateOfExpiry',
  14: 'bestBefore',
};
const CTRL_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumber',
  8: 'controlSerialNo',
  9: 'controlTypeCode',
  10: 'controlLocation',
  11: 'controlStartDate',
  12: 'controlEndDate',
  13: 'controlResultCode',
  14: 'controlResultRemarks',
};
const REEXP_COLS = {
  6: 'invoiceSerialNumber',
  7: 'itemSerialNumber',
  8: 'serialNo',
  9: 'beSite',
  10: 'beNo',
  11: 'beDate',
  12: 'beInvoiceNo',
  13: 'beItem',
  14: 'manualBe',
  15: 'beQuantityUtilised',
  16: 'beItemDescription',
  17: 'beQty',
  18: 'beUqc',
  19: 'beAssessedValue',
  20: 'beDutyPaid',
  21: 'beDutyPaymentDate',
  22: 'beOtherIdentifiableParameter',
  23: 'beAssessableValueClaimed',
  24: 'beItemUsed',
  25: 'commisionerPermission',
  26: 'inputCredit',
  27: 'personalUse',
  28: 'modvaAvailed',
  29: 'modvatRepaid',
};
// section name in the file -> [JSON model, columns, row length, lead]; order = order of the CACHE01 parts (format 3.7).
// lead 'sb': F | custom house | job no | job date | SB no | SB date; 'job': F | custom house | job no | job date.
const FLAT_DEFS = [
  ['SB', 'sbModel', SB_COLS, 50, 'sb'],
  ['INVOICE', 'invoiceModel', INV_COLS, 49, 'sb'],
  ['EXCHANGE', 'exchangeModel', EXCH_COLS, 15, 'sb'],
  ['ITEM', 'itemModel', ITEM_COLS, 42, 'sb'],
  ['ITEMACCESS', 'itemAccessModel', ACCESS_COLS, 9, 'sb'],
  ['THIRDPARTY', 'thirdPartyModel', TP_COLS, 20, 'sb'],
  ['CESS', 'cessModel', CESS_COLS, 14, 'sb'],
  ['DBK', 'dbkModel', DBK_COLS, 13, 'sb'],
  ['ITEMRAWMTRL', 'itemRawMaterialModel', RAW_COLS, 13, 'sb'],
  ['DEPB', 'depbModel', DEPB_COLS, 14, 'sb'],
  ['DEPBPARENT', 'depbParentModel', DEPBP_COLS, 17, 'sb'],
  ['LICENCE', 'licenceModel', LIC_COLS, 19, 'sb'],
  ['DFIA', 'dfiaModel', DFIA_COLS, 21, 'sb'],
  ['JOBWORK', 'jobWorkModel', JOBWORK_COLS, 20, 'sb'],
  ['AR4', 'ar4Model', AR4_COLS, 14, 'sb'],
  ['PACKINGLIST', 'packingListModel', PACK_COLS, 7, 'job'],
  ['ROTATION', 'rotationModel', ROT_COLS, 6, 'job'],
  ['EOU', 'eouModel', EOU_COLS, 22, 'sb'],
  ['STUFF', 'stuffModel', STUFF_COLS, 6, 'job'],
  ['CONTAINER', 'containerModel', CONT_COLS, 12, 'job'],
  ['SW_INFO_TYPE', 'infoType', INFO_COLS, 15, 'sb'],
  ['SW_CONST', 'constituentFinal', CONST_COLS, 14, 'sb'],
  ['SW_PROD', 'production', PROD_COLS, 15, 'sb'],
  ['SW_CTRL', 'controlType', CTRL_COLS, 15, 'sb'],
  ['STATEMENT', 'statement', STMT_COLS, 12, 'sb'],
  ['Supportingdocs', 'supportingDocs', DOC_COLS, 29, 'sb'],
  ['REEXPORT', 'reexport', REEXP_COLS, 30, 'sb'],
];
const TABLES = Object.fromEntries(FLAT_DEFS.map(([tag, model, cols]) => [tag.toUpperCase(), [model, cols]]));

const cleanText = (value) =>
  value === undefined || value === null ? '' : String(value).replace(/&AMP;/gi, '&').trim();
const num = (value) => {
  const parsed = parseFloat(cleanText(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const ymd = (value) => {
  const text = cleanText(value);
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  const match = text.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
};
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// ---- 1. read the file into ICEGATE rows ----
const headerFromHrec = (fields) => ({
  senderID: cleanText(fields[2]),
  receiverID: cleanText(fields[4]),
  indicator: cleanText(fields[6]),
  messageID: cleanText(fields[8]),
  jobNumber: cleanText(fields[9]),
  jobDate: cleanText(fields[10]),
});

function readFlat(fileText) {
  const header = {};
  const master = {};
  const unknownTables = new Set();
  let currentTable = null;
  for (const rawLine of String(fileText || '')
    .replace(/\r/g, '')
    .split('\n')) {
    const line = rawLine.replace(BYTE_ORDER_MARK, '');
    if (!line.trim()) continue;
    const fields = line.split(GS);
    const tag = fields[0].trim();
    if (tag === 'HREC') {
      Object.assign(header, headerFromHrec(fields));
      continue;
    }
    if (tag.startsWith('<TABLE>')) {
      currentTable = tag.slice(7).trim().toUpperCase();
      if (!TABLES[currentTable]) unknownTables.add(currentTable);
      continue;
    }
    if (tag.startsWith('<')) {
      currentTable = null;
      continue;
    }
    if (tag !== 'F' || !currentTable || !TABLES[currentTable]) continue;
    const [model, cols] = TABLES[currentTable];
    const row = {};
    for (const [index, key] of Object.entries(cols)) row[key] = cleanText(fields[+index]);
    if (currentTable === 'SB') {
      header.receiverID = header.receiverID || cleanText(fields[1]);
      header.jobNumber = header.jobNumber || cleanText(fields[2]);
      header.jobDate = header.jobDate || cleanText(fields[3]);
    }
    (master[model] = master[model] || []).push(row);
  }
  if (!master.sbModel || !master.sbModel.length) {
    if (unknownTables.has('BE'))
      throw badRequest('This is a Bill of Entry flat file - read it in Import (BE), not in Export');
    throw badRequest('Not an ICEGATE shipping bill flat file: no <TABLE>SB section found');
  }
  return { headerField: header, master, format: 'ICES_FLAT_SB', unknownTables: [...unknownTables] };
}

// keys as ICEGATE sends them, also older / other spellings
const JSON_MODEL_ALIASES = {
  sbModel: ['sbModel', 'SBModel'],
  invoiceModel: ['invoiceModel'],
  itemModel: ['itemModel', 'itemsModel'],
  dbkModel: ['dbkModel'],
  infoType: ['infoType', 'infoTypeModel'],
  statement: ['statement', 'statementModel'],
  supportingDocs: ['supportingDocs', 'supportingDocsModel'],
  exchangeModel: ['exchangeModel'],
  containerModel: ['containerModel'],
  stuffModel: ['stuffModel'],
  licenceModel: ['licenceModel'],
  packingListModel: ['packingListModel'],
};
const asList = (value) => (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []);

function readJson(obj) {
  const source = (obj && obj.master) || {};
  const master = {};
  for (const [model, names] of Object.entries(JSON_MODEL_ALIASES)) {
    const foundName = names.find((name) => source[name] !== undefined);
    master[model] = foundName ? asList(source[foundName]) : [];
  }
  if (!master.sbModel.length) throw badRequest('Not an ICEGATE shipping bill JSON: master.sbModel is missing');
  return { headerField: obj.headerField || {}, master, format: 'CACHE01' };
}

// ---- 2. ICEGATE rows -> Export screen ----
const GST_TYPE = {
  GSN: 'GSTIN',
  GSG: 'GST GOVERNMENT',
  GSD: 'GST DIPLOMAT',
  PAN: 'INCOME TAX PAN',
  TAN: 'TAN',
  PSP: 'PASSPORT',
  ADH: 'AADHAR',
};
const IGST_LABEL = {
  LUT: 'Export Under Bond (LUT)',
  P: 'Export Against Payment (P)',
  NIL: 'Not Applicable (NA)',
  NA: 'Not Applicable (NA)',
};
function modeOf(location, sb) {
  if (cleanText(sb.mawbnumber) || cleanText(sb.hawbnumber)) return 'AIR';
  const c = cleanText(location).toUpperCase().slice(-1);
  return c === '4' ? 'AIR' : c === '1' ? 'SEA' : c === '6' || c === '2' ? 'LAND' : '';
}

function toExportScreen(doc) {
  const h = doc.headerField || {};
  const m = doc.master;
  const sb = m.sbModel[0] || {};
  const location = cleanText(h.receiverID);
  // kept as ICEGATE rows (date YYYYMMDD): the SB JSON builder sends _exchangeRates as they are
  const exch = (m.exchangeModel || []).map((r) => ({
    ...r,
    rate: num(r.rate),
    unitInRs: num(r.unitInRs) || 1,
    effectiveDate: ymd(r.effectiveDate).replace(/-/g, ''),
  }));
  // rupees for ONE unit (the row is in CBIC notation - per 100 for JPY / KRW)
  const exchRowOf = (currency) =>
    exch.find((x) => cleanText(x.invoiceCurrencyCode).toUpperCase() === cleanText(currency).toUpperCase()) || null;
  const rateOf = (currency) => {
    const row = exchRowOf(currency);
    return row ? row.rate / (row.unitInRs || 1) : 0;
  };
  // the invoice row of the screens keeps the rate the way the notification quotes it, with the units beside it
  // (a per-unit figure would be divided by 100 again by the screens)

  const exportData = {
    customsPortCode: location,
    shipmentMode: modeOf(location, sb),
    autoField_13: cleanText(h.jobNumber), // "User Job No" - the job number in the file (our own job number is not changed)
    chaNo: cleanText(sb.chaLicenseNumber),
    shipperIec: cleanText(sb.importerExporterCode),
    shipperBranchSrNo: cleanText(sb.branchSrNoOfExporter),
    shipperName: cleanText(sb.impExpName),
    shipperAddress1: cleanText(sb.impExpAddress1),
    shipperAddress2: cleanText(sb.impExpAddress2),
    shipperCity: cleanText(sb.impExpCity),
    shipperState: cleanText(sb.impExpState),
    shipperPin: cleanText(sb.impExpPin),
    mercManuf: /^F/i.test(cleanText(sb.typeOfExporter)) ? 'F' : cleanText(sb.typeOfExporter) ? 'M' : '',
    shipperClass: cleanText(sb.exporterClass),
    stateOriginCode: cleanText(sb.stateOfOriginExporter),
    adCode: cleanText(sb.authorizedDealerCode),
    autoField_11: cleanText(sb.epzCode),
    consigneeName: cleanText(sb.consigneeName),
    consigneeAddress1: cleanText(sb.consigneeAddress1),
    consigneeAddress2: cleanText(sb.consigneeAddress2),
    consigneeAddress3: cleanText(sb.consigneeAddress3),
    consigneeAddress4: cleanText(sb.consigneeAddress4),
    consigneeCountryCode: cleanText(sb.consigneeCountry),
    nfeiCategoryCode: cleanText(sb.categoryForNEFISB),
    rbiNo: cleanText(sb.rbiWaiverNo),
    rbiWaiverDate: ymd(sb.rbiWaiverDate),
    loadingPortCode: cleanText(sb.portOfLoading),
    destPortCode: cleanText(sb.portOfFinalDestination),
    destCountryCode: cleanText(sb.countryOfFinalDestination),
    discCountryCode: cleanText(sb.countryOfDischarge),
    discPortCode: cleanText(sb.portOfDischarge),
    sealType: cleanText(sb.sealType),
    natureOfCargo: cleanText(sb.natureOfCargo),
    autoField_18: cleanText(sb.grossWeight),
    autoField_19: cleanText(sb.netWeight),
    grWtUnit: cleanText(sb.unitOfMeasurement),
    autoField_14: cleanText(sb.totalNumberOfPackages),
    autoField_16: cleanText(sb.marksNumbers),
    autoField_17: cleanText(sb.numberOfLoosePackets),
    autoField_22: cleanText(sb.mawbnumber),
    autoField_24: cleanText(sb.hawbnumber),
    shipperGstinType: GST_TYPE[cleanText(sb.gstnType).toUpperCase()] || cleanText(sb.gstnType),
    shipperGstin: cleanText(sb.gstnId),
  };
  const stuff = (m.stuffModel || [])[0];
  if (stuff) {
    exportData.factoryStuffed = /^Y/i.test(cleanText(stuff.factoryStuffed)) ? 'Yes' : 'No';
    exportData.autoField_32 = /^Y/i.test(cleanText(stuff.sampleAccompanied)) ? 'Yes' : 'No';
  }
  // rows the SB JSON builder sends again as they are (file values win over values made up from the screen)
  exportData._exchangeRates = exch;
  // serial numbers inside each item: 1, 2, 3 ... (some files carry the sending system's own numbers, e.g. 12, 14, 16)
  const renumber = (rows, key) => {
    const seen = {};
    return rows
      .map((r, i) => ({ r, i, n: +cleanText(r[key]) || 0 }))
      .sort(
        (a, b) =>
          (+cleanText(a.r.invoiceSerialNumber) || 1) - (+cleanText(b.r.invoiceSerialNumber) || 1) ||
          (+cleanText(a.r.itemSerialNumber) || 0) - (+cleanText(b.r.itemSerialNumber) || 0) ||
          a.n - b.n ||
          a.i - b.i,
      )
      .map(({ r }) => {
        const g = `${+cleanText(r.invoiceSerialNumber) || 1}/${+cleanText(r.itemSerialNumber) || 0}`;
        seen[g] = (seen[g] || 0) + 1;
        return { ...r, [key]: String(seen[g]) };
      });
  };
  exportData._infoTypes = renumber(m.infoType || [], 'infoSrNo');
  exportData._statements = renumber(m.statement || [], 'statementSerialNo');
  Object.keys(exportData).forEach((k) => {
    if (exportData[k] === '') delete exportData[k];
  });

  // supporting documents -> e-Sanchit lists (job level when item 0)
  // _icegate: the whole row from the file, sent again as it is (issuer, beneficiary, dates, invoice level)
  const docRow = (d) => ({
    _icegate: {
      ...d,
      chaLicenseNumber: cleanText(d.chaLicenseNumber) || cleanText(sb.chaLicenseNumber),
      iec: cleanText(d.iec) || cleanText(sb.importerExporterCode),
    },
    invSr: +cleanText(d.invoiceSerialNumber) || 0,
    irn: cleanText(d.imageReferenceNumber),
    drn: cleanText(d.documentReferenceNo),
    docCode: cleanText(d.documentTypeCode),
    issueDate: ymd(d.documentIssueDate),
    expiryDate: ymd(d.documentExpiryDate),
    issuingParty: cleanText(d.documentIssuingPartyName),
    beneficiaryParty: cleanText(d.documentBeneficiaryPartyName),
    placeOfIssue: cleanText(d.placeOfIssue),
    fileType: cleanText(d.fileType),
  });
  const docsOf = (inv, itm) =>
    (m.supportingDocs || [])
      .filter(
        (d) =>
          String(+cleanText(d.invoiceSerialNumber) || 0) === String(inv) &&
          String(+cleanText(d.itemSerialNumber) || 0) === String(itm),
      )
      .map(docRow);
  const jobDocs = (m.supportingDocs || []).filter((d) => !+cleanText(d.itemSerialNumber)).map(docRow);
  if (jobDocs.length) exportData.eSanchitList = jobDocs;

  const items = (m.itemModel || []).map((r, i) => {
    const inv = +cleanText(r.invoiceSerialNumber) || 1,
      itm = +cleanText(r.itemSerialNumberInvoice) || i + 1;
    const qty = num(r.quantity),
      rate = num(r.unitPrice);
    const desc = [r.descOfGoods1, r.descOfGoods2, r.descOfGoods3].map(cleanText).filter(Boolean).join(' ');
    const dbk = (m.dbkModel || []).find(
      (d) => (+cleanText(d.invoiceSerialNumber) || 1) === inv && (+cleanText(d.itemSerialNumberInvoice) || 0) === itm,
    );
    const igst = cleanText(r.igstPaymentStatus).toUpperCase();
    const reward = /^Y/i.test(cleanText(r.rewardItem)) ? 'Y' : 'N';
    const totalFc = +(qty * rate).toFixed(4);
    const ex = rateOf(
      (m.invoiceModel || []).find((x) => (+cleanText(x.invoiceSerialNumber) || 1) === inv)?.invoiceCurrency,
    );
    return {
      // Export screen names (id: the Drawback tab finds an item's drawback row by this id)
      id: inv * 1000 + itm,
      invSr: inv,
      itemSr: itm,
      scheme: cleanText(r.schemeCode),
      ritc: cleanText(r.ritcCode),
      desc,
      qty: cleanText(r.quantity),
      unit: cleanText(r.unitOfMeasurement),
      rate: cleanText(r.unitPrice),
      rateUnit: cleanText(r.unitOfRate),
      per: cleanText(r.noOfUnit) || '1',
      totalFc: String(totalFc),
      pmv: cleanText(r.presentMarketValue),
      itemFob: ex ? String(+(totalFc * ex).toFixed(2)) : '',
      endUse: cleanText(r.endUseOfItem),
      igstPayStatus: IGST_LABEL[igst] || igst || 'Select',
      taxableValue: cleanText(r.taxableValue),
      igstAmt: cleanText(r.igstAmount),
      sourceState: cleanText(r.sourceState),
      stateCode: cleanText(r.sourceState),
      hawb: cleanText(r.hawbNo),
      totalPkgs: cleanText(r.totalPackage),
      thirdParty: /^Y/i.test(cleanText(r.thirdParty)) ? 'Y' : 'N',
      reward,
      rodtep: reward,
      accessory: cleanText(r.accessoryStatus),
      transitCountry: cleanText(r.transitCountry),
      jobWorkNotificationNo: cleanText(r.jobWorkNotificationNo),
      manfDetails: cleanText(r.itemManufacturerProducerGrowerCode) ? 'Y' : 'N',
      mfgType: cleanText(r.itemManufacturerProducerCodeType),
      mfgCode: cleanText(r.itemManufacturerProducerGrowerCode),
      mfgAddress1: cleanText(r.itemManufacturerProducerGrowerAddress1),
      mfgAddress2: cleanText(r.itemManufacturerProducerGrowerAddress2),
      mfgCity: cleanText(r.itemManufacturerProducerGrowerCity),
      mfgState: cleanText(r.itemManufacturerProducerGrowerCountrySubdivision),
      mfgPin: cleanText(r.itemManufacturerProducerGrowerPin),
      mfgCountry: cleanText(r.itemManufacturerCountry),
      // the Items tab > Manufacturer window reads manfProd*
      manfProdCdType: cleanText(r.itemManufacturerProducerCodeType),
      manfProdCode: cleanText(r.itemManufacturerProducerGrowerCode),
      manfProdAddress1: cleanText(r.itemManufacturerProducerGrowerAddress1),
      manfProdAddress2: cleanText(r.itemManufacturerProducerGrowerAddress2),
      manfProdCity: cleanText(r.itemManufacturerProducerGrowerCity),
      manfProdSubDiv: cleanText(r.itemManufacturerProducerGrowerCountrySubdivision),
      manfProdPin: cleanText(r.itemManufacturerProducerGrowerPin),
      manfProdCountry: cleanText(r.itemManufacturerCountry),
      dbkNo: dbk ? cleanText(dbk.dbkScheduleNumber) : '',
      dbkQty: dbk ? cleanText(dbk.drawbackQuantity) : '',
      eSanchitList: docsOf(inv, itm),
      suppDocs: docsOf(inv, itm).length ? 'Y' : 'N',
      swInfo: (m.infoType || []).some(
        (x) => (+cleanText(x.invoiceSerialNumber) || 1) === inv && (+cleanText(x.itemSerialNumber) || 0) === itm,
      )
        ? 'Y'
        : 'N',
      swStatement: (m.statement || []).some(
        (x) => (+cleanText(x.invoiceSerialNumber) || 1) === inv && (+cleanText(x.itemSerialNumber) || 0) === itm,
      )
        ? 'Y'
        : 'N',
      // names the SB JSON builder reads
      invoiceSrNo: inv,
      hsnCode: cleanText(r.ritcCode),
      description: desc,
      quantity: qty,
      uqc: cleanText(r.unitOfMeasurement),
      unitPrice: rate,
      schemeCode: cleanText(r.schemeCode),
      endUseOfItem: cleanText(r.endUseOfItem),
      rewardItem: reward,
      accessoryStatus: cleanText(r.accessoryStatus) || 'NONE',
      hawbNo: cleanText(r.hawbNo),
      totalPackage: num(r.totalPackage),
      igstPaymentStatus: igst,
      igstAmount: num(r.igstAmount),
    };
  });

  const invoices = (m.invoiceModel || []).map((r, i) => {
    const sr = +cleanText(r.invoiceSerialNumber) || i + 1;
    const value = items.filter((it) => it.invSr === sr).reduce((s, it) => s + num(it.totalFc), 0);
    return {
      id: sr,
      srNo: sr,
      no: cleanText(r.actualInvoiceNo),
      invoiceNo: cleanText(r.actualInvoiceNo),
      date: ymd(r.invoiceDate),
      invoiceDate: ymd(r.invoiceDate),
      currency: cleanText(r.invoiceCurrency),
      value: value ? String(+value.toFixed(2)) : '',
      invoiceValue: value ? String(+value.toFixed(2)) : '',
      contractType: cleanText(r.natureOfContract),
      natureOfContract: cleanText(r.natureOfContract),
      ...(() => {
        const q = exchRowOf(r.invoiceCurrency);
        const v = q && q.rate ? String(q.rate) : '';
        return { exchRate: v, exchangeRate: v, unitInRs: q ? q.unitInRs || 1 : '' };
      })(),
      buyer: cleanText(r.buyerName),
      buyerName: cleanText(r.buyerName),
      buyerAddress1: cleanText(r.buyerAddress1),
      buyerAddress2: cleanText(r.buyerAddress2),
      buyerAddress3: cleanText(r.buyerAddress3),
      buyerAddress4: cleanText(r.buyerAddress4),
      freightCurr: cleanText(r.freightCurrency),
      freightAmount: cleanText(r.freightAmount),
      insuranceRate: cleanText(r.insuranceRate),
      insuranceCurr: cleanText(r.insuranceCurrency),
      insuranceAmount: cleanText(r.insuranceAmount),
      commissionRate: cleanText(r.commissionRate),
      commissionCurr: cleanText(r.commissionCurrency),
      commissionAmount: cleanText(r.commissionAmount),
      discountRate: cleanText(r.discountOnFOB),
      discountCurr: cleanText(r.discountCurrency),
      discountAmount: cleanText(r.discountAmount),
      otherRate: cleanText(r.otherDeductions),
      otherCurr: cleanText(r.otherDeductionsCurrency),
      otherAmount: cleanText(r.otherDeductionsAmount),
      otherDeductionsRate: cleanText(r.otherDeductions),
      otherDeductionsCurr: cleanText(r.otherDeductionsCurrency),
      otherDeductionsAmount: cleanText(r.otherDeductionsAmount),
      addFreight: cleanText(r.addFreight),
      packingAmount: cleanText(r.packingCharges),
      contractNo: cleanText(r.exporterContractNumber),
      pymtNature: cleanText(r.natureOfPayment),
      pymtPeriod: cleanText(r.periodOfPayment),
      tpName: cleanText(r.thirdPartyName),
      tpAddress1: cleanText(r.thirdPartyAddress1),
      tpAddress2: cleanText(r.thirdPartyAddress2),
      tpCity: cleanText(r.thirdPartyCity),
      tpState: cleanText(r.thirdPartyCountrySubdivision),
      tpCntryDiv: cleanText(r.thirdPartyCountrySubdivision),
      tpCntry: cleanText(r.thirdPartCountryCode),
      tpCntr2: cleanText(r.thirdPartCountryCode),
      tpPin: cleanText(r.thirdPartyPin),
      thirdParty: cleanText(r.thirdPartyName) ? 'Y' : 'N',
      aeoCode: cleanText(r.authorizedEconomicOperatorCode),
      aeoCountry: cleanText(r.authorizedEconomicOperatorCountry),
      aeoCountryCode: cleanText(r.authorizedEconomicOperatorCountry),
      aeoRole: cleanText(r.authorizedEconomicOperatorRole),
      termPlace: cleanText(r.termsPlace),
    };
  });

  // same shape as the Drawback tab rows (id = the item's id, srNo / invNo / itemNo / accUnit)
  const dbkItems = (m.dbkModel || [])
    .map((d) => {
      const inv = +cleanText(d.invoiceSerialNumber) || 1,
        itm = +cleanText(d.itemSerialNumberInvoice) || 1;
      const it = items.find((x) => x.invSr === inv && x.itemSr === itm);
      return {
        id: inv * 1000 + itm,
        srNo: itm,
        invNo: inv,
        itemNo: itm,
        invSr: inv,
        itemSr: itm,
        dbkNo: cleanText(d.dbkScheduleNumber),
        dbkQty: cleanText(d.drawbackQuantity),
        accUnit: it ? it.unit : '',
        drawbackAvailable: cleanText(d.drawbackAvailable) || 'Y',
        dbkRtAdv: '',
        dbkRtSpe: '',
        dbkVal: '',
      };
    })
    .sort((a, b) => a.invSr - b.invSr || a.itemSr - b.itemSr);
  exportData.dbkItems = dbkItems;
  // licence rows (Scheme > License) of an Advance Licence SB
  const licenseItems = (m.licenceModel || [])
    .map((l, k) => {
      const inv = +cleanText(l.invoiceSerialNumber) || 1,
        itm = +cleanText(l.itemSerialNumberInvoice) || 1;
      const it = items.find((x) => x.invSr === inv && x.itemSr === itm);
      const ii = cleanText(l.whetherIndigenousImported).toUpperCase();
      return {
        id: `LF${inv}-${itm}-${k + 1}`,
        itemId: it ? it.id : undefined,
        invNo: String(inv),
        itemNo: String(itm),
        srNo: +cleanText(l.srno) || 1,
        regNo: cleanText(l.registrationNo),
        regDate: ymd(l.registrationDate),
        snE: cleanText(l.itemSerialNoInPartE),
        snC: cleanText(l.itemSerialNoInPartC),
        qty: cleanText(l.quantity),
        expQty: cleanText(l.exportQuantity),
        uqc: it ? it.unit : '',
        indImp: ii === 'I' || ii === 'N' ? 'I' : 'M',
        expDesc: it ? String(it.desc || '').slice(0, 60) : '',
        impDesc: '',
        licNo: '',
        licDt: '',
        licType: 'DEEC',
        eoQty: '',
        eoVal: '',
      };
    })
    .sort((a, b) => +a.invNo - +b.invNo || +a.itemNo - +b.itemNo || a.srNo - b.srNo);
  if (licenseItems.length) exportData.licenseItems = licenseItems;
  const containers = (m.containerModel || []).map((c) => ({
    containerNo: cleanText(c.containerNumber),
    size: cleanText(c.containerSize),
    sealNo: cleanText(c.exciseSealNo),
    sealDate: ymd(c.sealDate),
    sealType: cleanText(c.sealTypeIndicator),
    deviceId: cleanText(c.sealDeviceID),
  }));

  const totalFc = items.reduce((s, i) => s + num(i.totalFc), 0);
  const counts = {
    invoices: invoices.length,
    items: items.length,
    drawback: dbkItems.length,
    licence: licenseItems.length,
    rodtepItems: items.filter((i) => i.reward === 'Y').length,
    swInfo: exportData._infoTypes.length,
    statements: exportData._statements.length,
    documents: (m.supportingDocs || []).length,
    containers: containers.length,
    exchangeRates: exch.length,
  };
  return {
    exportData,
    invoices,
    items,
    dbkItems,
    licenseItems: licenseItems.length ? licenseItems : undefined,
    containers: containers.length ? containers : undefined,
    exchangeRates: exch,
    infoTypes: exportData._infoTypes,
    statements: exportData._statements,
    summary: {
      jobNo: cleanText(h.jobNumber),
      jobDate: ymd(h.jobDate),
      customsPort: location,
      mode: exportData.shipmentMode || '',
      exporterName: cleanText(sb.impExpName),
      iecCode: cleanText(sb.importerExporterCode),
      chaCode: cleanText(sb.chaLicenseNumber),
      loadingPort: cleanText(sb.portOfLoading),
      destCountry: cleanText(sb.countryOfFinalDestination),
      destPort: cleanText(sb.portOfFinalDestination),
      invoiceCount: invoices.length,
      itemCount: items.length,
      totalValueFc: +totalFc.toFixed(2),
      gstin: cleanText(sb.gstnId),
      counts,
    },
  };
}

function readShippingBill(input, hint) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  const trimmed = text.replace(BYTE_ORDER_MARK, '').trim();
  let doc;
  if (hint === 'flat' || trimmed.startsWith('HREC') || trimmed.includes(GS)) doc = readFlat(trimmed);
  else {
    let obj;
    try {
      obj = typeof input === 'object' && input ? input : JSON.parse(trimmed);
    } catch {
      doc = readFlat(trimmed);
    }
    if (!doc) doc = readJson(obj);
  }
  const screen = toExportScreen(doc);
  return {
    ...screen,
    detectedFormat: doc.format === 'CACHE01' ? 'CACHE01' : 'FLAT_FILE_SB',
    unknownTables: doc.unknownTables || [],
  };
}

// ---- 3. CACHE01 JSON -> ICES 1.5 shipping bill flat file (.sb) ----
// Same layout readFlat() reads and the ICEGATE sample files use: HREC (12 fields), <TABLE>name sections whose rows
// start F | custom house | job no | job date | SB no | SB date (only F .. job date for the 'job' tables), then the fields
// at the column numbers above, <END-SB>, TREC. Fields separated by ASCII 29, CRLF line ends. Row lengths as in the
// ICEGATE files / the format document (all parts of format 3.7). STUFF only when factory stuffed / sample accompanied
// is Y (iCAFFE leaves the N / N part out).
// fields the flat format keeps shorter than the JSON (format 3.7 lengths)
const FLAT_MAX = {
  'sbModel.consigneeAddress4': 35,
  'invoiceModel.thirdPartyAddress2': 50,
  'itemModel.sourceState': 2,
  'itemModel.accessoryStatus': 1,
  'thirdPartyModel.exporterAddress1': 35,
  'supportingDocs.icegateId': 15,
  'supportingDocs.documentReferenceNo': 17,
};
const cleanFlatField = (value) =>
  (value === undefined || value === null ? '' : String(value)).replace(/[\x1d\r\n]+/g, ' ').trim();
const isYes = (value) => /^Y/i.test(cleanFlatField(value));

function flatRecord(row, { model, cols, rowLength, lead }, prefix, opts) {
  const fields = Array.from({ length: rowLength }, () => '');
  [fields[0], fields[1], fields[2], fields[3]] = prefix;
  if (lead === 'sb') {
    fields[4] = cleanFlatField(opts.sbNo);
    fields[5] = cleanFlatField(opts.sbDate);
  }
  for (const [index, key] of Object.entries(cols)) {
    if (+index >= rowLength) continue;
    const value = cleanFlatField(row[key]);
    const maxLength = FLAT_MAX[model + '.' + key];
    fields[+index] = maxLength ? value.slice(0, maxLength) : value;
  }
  return fields.join(GS);
}

function writeFlat(json, opts = {}) {
  const header = (json && json.headerField) || {};
  const master = (json && json.master) || {};
  const jobNo = cleanFlatField(header.jobNumber);
  const jobDate = cleanFlatField(header.jobDate);
  const port = cleanFlatField(header.receiverID);
  const messageType = cleanFlatField(header.messageType || 'F') || 'F';
  const now = opts.now || new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  const lines = [
    [
      'HREC',
      'ZZ',
      cleanFlatField(header.senderID),
      'ZZ',
      port,
      'ICES1_5',
      cleanFlatField(header.indicator || 'P'),
      '',
      'CACHE01',
      jobNo,
      jobDate,
      hhmm,
    ].join(GS),
  ];
  const prefix = [messageType, port, jobNo, jobDate];
  for (const [tag, model, cols, rowLength, lead] of FLAT_DEFS) {
    let rows = Array.isArray(master[model]) ? master[model] : [];
    if (tag === 'STUFF') rows = rows.filter((r) => isYes(r.factoryStuffed) || isYes(r.sampleAccompanied));
    if (!rows.length) continue;
    lines.push('<TABLE>' + tag);
    for (const row of rows) lines.push(flatRecord(row, { model, cols, rowLength, lead }, prefix, opts));
  }
  lines.push('<END-SB>');
  lines.push(['TREC', jobNo].join(GS));
  return lines.join(LINE_END) + LINE_END;
}

export { readShippingBill, readJson, writeFlat };
