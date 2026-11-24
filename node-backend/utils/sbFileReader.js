// Shipping Bill file reader (29-Oct-2026): ICEGATE SB JSON (CACHE01) and ICES flat file (.sb) -> Export screen data.
//
// Both formats are first read into the same rows with the ICEGATE JSON names (sbModel, invoiceModel, itemModel,
// dbkModel, infoType, statement, supportingDocs, exchangeModel ...), then turned into what the Export screen and the
// SB JSON builder (utils/IcegateJsonBuilder.js buildSB_CACHE01) use, so a file read in and sent again keeps its data.
//
// Before: a CACHE01 JSON gave no header field and no item (sbModel is a list, items are in itemModel, not itemsModel);
// the flat file took several columns from the wrong place (exporter class as transport mode, freight as invoice
// value, insurance as freight, present market value as FOB, end use as export scheme, port of discharge as loading
// port) and left out drawback, RoDTEP / SW info, statements and supporting documents.
//
// Flat file layout (fields split by ASCII 29). Every data row starts: 0 'F', 1 customs location, 2 job number,
// 3 job date, 4-5 SB no / date; then the fields in the order of the JSON model. Checked against SB files that exist
// in both forms (same SB as .json and .sb): every non-empty column matched the JSON value of that name.
const GS = '\x1d';

const SB_COLS = { 6: 'chaLicenseNumber', 7: 'importerExporterCode', 8: 'branchSrNoOfExporter', 9: 'impExpName', 10: 'impExpAddress1', 11: 'impExpAddress2', 12: 'impExpCity', 13: 'impExpState', 14: 'impExpPin', 15: 'typeOfExporter', 16: 'exporterClass', 17: 'stateOfOriginExporter', 18: 'authorizedDealerCode', 19: 'epzCode', 20: 'consigneeName', 21: 'consigneeAddress1', 22: 'consigneeAddress2', 23: 'consigneeAddress3', 24: 'consigneeAddress4', 25: 'consigneeCountry', 26: 'categoryForNEFISB', 27: 'rbiWaiverNo', 28: 'rbiWaiverDate', 29: 'portOfLoading', 30: 'portOfFinalDestination', 31: 'countryOfFinalDestination', 32: 'countryOfDischarge', 33: 'portOfDischarge', 34: 'sealType', 35: 'natureOfCargo', 36: 'grossWeight', 37: 'netWeight', 38: 'unitOfMeasurement', 39: 'totalNumberOfPackages', 40: 'marksNumbers', 41: 'numberOfLoosePackets', 42: 'numberOfContainers', 43: 'mawbnumber', 44: 'hawbnumber', 48: 'gstnType', 49: 'gstnId' };
const INV_COLS = { 6: 'invoiceSerialNumber', 7: 'actualInvoiceNo', 8: 'invoiceDate', 9: 'invoiceCurrency', 10: 'natureOfContract', 11: 'buyerName', 12: 'buyerAddress1', 13: 'buyerAddress2', 14: 'buyerAddress3', 15: 'buyerAddress4', 16: 'freightCurrency', 17: 'freightAmount', 18: 'insuranceRate', 19: 'insuranceCurrency', 20: 'insuranceAmount', 21: 'commissionRate', 22: 'commissionCurrency', 23: 'commissionAmount', 24: 'discountOnFOB', 25: 'discountCurrency', 26: 'discountAmount', 27: 'otherDeductions', 28: 'otherDeductionsCurrency', 29: 'otherDeductionsAmount', 30: 'addFreight', 31: 'packingCharges', 32: 'exporterContractNumber', 33: 'natureOfPayment', 34: 'periodOfPayment', 38: 'thirdPartyName', 39: 'thirdPartyAddress1', 40: 'thirdPartyAddress2', 41: 'thirdPartyCity', 42: 'thirdPartyCountrySubdivision', 43: 'thirdPartCountryCode', 44: 'thirdPartyPin', 45: 'authorizedEconomicOperatorCode', 46: 'authorizedEconomicOperatorCountry', 47: 'authorizedEconomicOperatorRole', 48: 'termsPlace' };
const ITEM_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'schemeCode', 9: 'ritcCode', 10: 'descOfGoods1', 11: 'descOfGoods2', 12: 'descOfGoods3', 13: 'unitOfMeasurement', 14: 'quantity', 15: 'unitPrice', 16: 'unitOfRate', 17: 'noOfUnit', 18: 'presentMarketValue', 19: 'jobWorkNotificationNo', 20: 'thirdParty', 21: 'rewardItem', 25: 'itemManufacturerProducerCodeType', 26: 'itemManufacturerProducerGrowerCode', 27: 'itemManufacturerProducerGrowerAddress1', 28: 'itemManufacturerProducerGrowerAddress2', 29: 'itemManufacturerProducerGrowerCity', 30: 'itemManufacturerProducerGrowerCountrySubdivision', 31: 'itemManufacturerProducerGrowerPin', 32: 'itemManufacturerCountry', 33: 'sourceState', 34: 'transitCountry', 35: 'accessoryStatus', 36: 'endUseOfItem', 37: 'hawbNo', 38: 'totalPackage', 39: 'igstPaymentStatus', 40: 'taxableValue', 41: 'igstAmount' };
const DBK_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'dbkScheduleNumber', 9: 'drawbackQuantity' }; // column 10 = amendment type (was drawbackAvailable "Y")
const INFO_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumber', 8: 'infoSrNo', 9: 'infoType', 10: 'infoQualifier', 11: 'infoCode', 12: 'infoText', 13: 'infoMeasure', 14: 'infouqc' };
const STMT_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumber', 8: 'statementSerialNo', 9: 'statementType', 10: 'statementCode', 11: 'statementText' };
const DOC_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumber', 8: 'serialNo', 9: 'imageReferenceNumber', 10: 'documentTypeCode', 11: 'documentIssuingPartyCode', 12: 'documentIssuingPartyNameAddress1', 13: 'documentIssuingPartyNameAddress2', 14: 'documentIssuingPartyNameCity', 15: 'documentIssuingPartyNamePin', 16: 'documentReferenceNo', 17: 'placeOfIssue', 18: 'documentIssueDate', 19: 'documentExpiryDate', 20: 'documentBeneficiaryPartyCode', 21: 'documentBeneficiaryPartyNameAddress1', 22: 'documentBeneficiaryPartyNameAddress2', 23: 'documentBeneficiaryPartyNameCity', 24: 'documentBeneficiaryPartyNamePin', 25: 'fileType', 26: 'documentIssuingPartyName', 27: 'documentBeneficiaryPartyName', 28: 'icegateId' };
const EXCH_COLS = { 6: 'invoiceCurrencyCode', 7: 'currencyName', 8: 'unitInRs', 9: 'rate', 10: 'effectiveDate', 11: 'whetherStandardCurrency' };
// 12-Nov-2026: LICENCE (ICES 1.5 Exports message format, CACHE01 part 12): the licence rows of an Advance Licence SB
const LIC_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'srno', 9: 'registrationNo', 10: 'registrationDate', 11: 'itemSerialNoInPartE', 12: 'itemSerialNoInPartC', 13: 'quantity', 14: 'exportQuantity', 15: 'whetherIndigenousImported' };
const CONT_COLS = { 4: 'containerNumber', 5: 'containerSize', 6: 'exciseSealNo', 7: 'sealDate', 8: 'sealTypeIndicator', 9: 'sealDeviceID', 10: 'movementDocumentType', 11: 'movementDocumentNumber' }; // no SB no / date columns
// 19-Nov-2026: the other CACHE01 parts, from the same format document (columns = Sr. No. - 1; the amendment type / no /
// date columns stay empty in a fresh "F" file). PACKINGLIST, ROTATION, STUFF and CONTAINER have no SB no / date columns.
const ACCESS_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'descriptionOfAccessories' };
const TP_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'iec', 9: 'branchSerialNo', 10: 'exporterName', 11: 'exporterAddress1', 12: 'exporterAddress2', 13: 'city', 14: 'pin', 18: 'gstnType', 19: 'gstnId' };
const CESS_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'srno', 9: 'cessActCode', 10: 'quantity' };
const RAW_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'rawMaterialCode', 9: 'quantity' };
const DEPB_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'groupCode', 9: 'itemCode', 10: 'quantity' };
const DEPBP_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'srNo', 9: 'groupCode', 10: 'itemCode', 11: 'quantity', 12: 'unitQuantityCode', 13: 'quantityPercentage' };
const DFIA_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'srno', 9: 'sionGroupCode', 10: 'sionSerialNumber', 11: 'sionIoNormSerialNo', 12: 'quantity', 13: 'unitOfMeasurement', 14: 'itemDescription', 15: 'technicalCharacteristics', 16: 'fileNumber', 17: 'licenseNumber' };
const JOBWORK_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'srno', 9: 'beNumber', 10: 'beDate', 11: 'beInvoiceSerialNo', 12: 'beInvoiceNumber', 13: 'beItemNumber', 14: 'bePortCode', 15: 'beQtyUsed', 16: 'qtyUnits' };
const AR4_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumberInvoice', 8: 'ar4Number', 9: 'ar4Date', 10: 'commissionerate', 11: 'division', 12: 'range', 13: 'remarks' };
const PACK_COLS = { 4: 'packingNumberFrom', 5: 'packingNumberTo', 6: 'packingCode' };
const ROT_COLS = { 4: 'rotationDate', 5: 'rotationNumber' };
const EOU_COLS = { 6: 'ieCodeOfTheEOU', 7: 'branchSrNumberOfIE', 8: 'examinationDate', 9: 'examiningOfficerName', 10: 'examiningOfficerDesignation', 11: 'supervisingOfficerName', 12: 'supervisingOfficerDesignation', 13: 'commissionerate', 14: 'division', 15: 'range', 16: 'sealNo', 17: 'itemValuesVerifiedByExaminingOfficer', 18: 'sampleForwarded' };
const STUFF_COLS = { 4: 'factoryStuffed', 5: 'sampleAccompanied' };
const CONST_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumber', 8: 'constituentSerialNo', 9: 'constituentElementName', 10: 'constituentElementCode', 11: 'constituentPercentage', 12: 'constituentYieldPercentage', 13: 'activeIngredient' };
const PROD_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumber', 8: 'productionSerialNo', 9: 'productionBatchIdentifier', 10: 'productionBatchQuantity', 11: 'unitQuantityCode', 12: 'dateOfManufacturing', 13: 'dateOfExpiry', 14: 'bestBefore' };
const CTRL_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumber', 8: 'controlSerialNo', 9: 'controlTypeCode', 10: 'controlLocation', 11: 'controlStartDate', 12: 'controlEndDate', 13: 'controlResultCode', 14: 'controlResultRemarks' };
const REEXP_COLS = { 6: 'invoiceSerialNumber', 7: 'itemSerialNumber', 8: 'serialNo', 9: 'beSite', 10: 'beNo', 11: 'beDate', 12: 'beInvoiceNo', 13: 'beItem', 14: 'manualBe', 15: 'beQuantityUtilised', 16: 'beItemDescription', 17: 'beQty', 18: 'beUqc', 19: 'beAssessedValue', 20: 'beDutyPaid', 21: 'beDutyPaymentDate', 22: 'beOtherIdentifiableParameter', 23: 'beAssessableValueClaimed', 24: 'beItemUsed', 25: 'commisionerPermission', 26: 'inputCredit', 27: 'personalUse', 28: 'modvaAvailed', 29: 'modvatRepaid' };
// section name in the file -> [JSON model, columns, row length, lead]; order = order of the CACHE01 parts (format 3.7).
// lead 'sb': F | custom house | job no | job date | SB no | SB date; 'job': F | custom house | job no | job date.
const FLAT_DEFS = [
    ['SB', 'sbModel', SB_COLS, 50, 'sb'], ['INVOICE', 'invoiceModel', INV_COLS, 49, 'sb'], ['EXCHANGE', 'exchangeModel', EXCH_COLS, 15, 'sb'], ['ITEM', 'itemModel', ITEM_COLS, 42, 'sb'],
    ['ITEMACCESS', 'itemAccessModel', ACCESS_COLS, 9, 'sb'], ['THIRDPARTY', 'thirdPartyModel', TP_COLS, 20, 'sb'], ['CESS', 'cessModel', CESS_COLS, 14, 'sb'], ['DBK', 'dbkModel', DBK_COLS, 13, 'sb'],
    ['ITEMRAWMTRL', 'itemRawMaterialModel', RAW_COLS, 13, 'sb'], ['DEPB', 'depbModel', DEPB_COLS, 14, 'sb'], ['DEPBPARENT', 'depbParentModel', DEPBP_COLS, 17, 'sb'], ['LICENCE', 'licenceModel', LIC_COLS, 19, 'sb'],
    ['DFIA', 'dfiaModel', DFIA_COLS, 21, 'sb'], ['JOBWORK', 'jobWorkModel', JOBWORK_COLS, 20, 'sb'], ['AR4', 'ar4Model', AR4_COLS, 14, 'sb'], ['PACKINGLIST', 'packingListModel', PACK_COLS, 7, 'job'],
    ['ROTATION', 'rotationModel', ROT_COLS, 6, 'job'], ['EOU', 'eouModel', EOU_COLS, 22, 'sb'], ['STUFF', 'stuffModel', STUFF_COLS, 6, 'job'], ['CONTAINER', 'containerModel', CONT_COLS, 12, 'job'],
    ['SW_INFO_TYPE', 'infoType', INFO_COLS, 15, 'sb'], ['SW_CONST', 'constituentFinal', CONST_COLS, 14, 'sb'], ['SW_PROD', 'production', PROD_COLS, 15, 'sb'], ['SW_CTRL', 'controlType', CTRL_COLS, 15, 'sb'],
    ['STATEMENT', 'statement', STMT_COLS, 12, 'sb'], ['Supportingdocs', 'supportingDocs', DOC_COLS, 29, 'sb'], ['REEXPORT', 'reexport', REEXP_COLS, 30, 'sb'],
];
const TABLES = Object.fromEntries(FLAT_DEFS.map(([tag, model, cols]) => [tag.toUpperCase(), [model, cols]]));

const t = (v) => (v === undefined || v === null ? '' : String(v).replace(/&AMP;/gi, '&').trim());
const num = (v) => { const x = parseFloat(t(v).replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };
const ymd = (v) => { const s = t(v); if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : s; };

// ---- 1. read the file into ICEGATE rows ----
function readFlat(text) {
    const header = {}; const master = {}; const unknownTables = new Set();
    let cur = null;
    for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
        const line = raw.replace(/^﻿/, '');
        if (!line.trim()) continue;
        const f = line.split(GS);
        const tag = f[0].trim();
        if (tag === 'HREC') { Object.assign(header, { senderID: t(f[2]), receiverID: t(f[4]), indicator: t(f[6]), messageID: t(f[8]), jobNumber: t(f[9]), jobDate: t(f[10]) }); continue; }
        if (tag.startsWith('<TABLE>')) { cur = tag.slice(7).trim().toUpperCase(); if (!TABLES[cur]) unknownTables.add(cur); continue; }
        if (tag.startsWith('<')) { cur = null; continue; }
        if (tag !== 'F' || !cur || !TABLES[cur]) continue;
        const [model, cols] = TABLES[cur];
        const row = {};
        for (const [i, k] of Object.entries(cols)) row[k] = t(f[+i]);
        if (cur === 'SB') { header.receiverID = header.receiverID || t(f[1]); header.jobNumber = header.jobNumber || t(f[2]); header.jobDate = header.jobDate || t(f[3]); }
        (master[model] = master[model] || []).push(row);
    }
    if (!master.sbModel || !master.sbModel.length) {
        if (unknownTables.has('BE')) throw Object.assign(new Error('This is a Bill of Entry flat file - read it in Import (BE), not in Export'), { status: 400 });
        throw Object.assign(new Error('Not an ICEGATE shipping bill flat file: no <TABLE>SB section found'), { status: 400 });
    }
    return { headerField: header, master, format: 'ICES_FLAT_SB', unknownTables: [...unknownTables] };
}

function readJson(obj) {
    const m = (obj && obj.master) || {};
    const list = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []);
    const master = {};
    // keys as ICEGATE sends them, also older / other spellings
    const alias = { sbModel: ['sbModel', 'SBModel'], invoiceModel: ['invoiceModel'], itemModel: ['itemModel', 'itemsModel'], dbkModel: ['dbkModel'], infoType: ['infoType', 'infoTypeModel'], statement: ['statement', 'statementModel'], supportingDocs: ['supportingDocs', 'supportingDocsModel'], exchangeModel: ['exchangeModel'], containerModel: ['containerModel'], stuffModel: ['stuffModel'], licenceModel: ['licenceModel'], packingListModel: ['packingListModel'] };
    for (const [k, names] of Object.entries(alias)) { const n = names.find((x) => m[x] !== undefined); master[k] = n ? list(m[n]) : []; }
    if (!master.sbModel.length) throw Object.assign(new Error('Not an ICEGATE shipping bill JSON: master.sbModel is missing'), { status: 400 });
    return { headerField: obj.headerField || {}, master, format: 'CACHE01' };
}

// ---- 2. ICEGATE rows -> Export screen ----
const GST_TYPE = { GSN: 'GSTIN', GSG: 'GST GOVERNMENT', GSD: 'GST DIPLOMAT', PAN: 'INCOME TAX PAN', TAN: 'TAN', PSP: 'PASSPORT', ADH: 'AADHAR' };
const IGST_LABEL = { LUT: 'Export Under Bond (LUT)', P: 'Export Against Payment (P)', NIL: 'Not Applicable (NA)', NA: 'Not Applicable (NA)' };
function modeOf(location, sb) {
    if (t(sb.mawbnumber) || t(sb.hawbnumber)) return 'AIR';
    const c = t(location).toUpperCase().slice(-1);
    return c === '4' ? 'AIR' : c === '1' ? 'SEA' : c === '6' || c === '2' ? 'LAND' : '';
}

function toExportScreen(doc) {
    const h = doc.headerField || {}; const m = doc.master; const sb = m.sbModel[0] || {};
    const location = t(h.receiverID);
    // kept as ICEGATE rows (date YYYYMMDD): the SB JSON builder sends _exchangeRates as they are
    const exch = (m.exchangeModel || []).map((r) => ({ ...r, rate: num(r.rate), unitInRs: num(r.unitInRs) || 1, effectiveDate: ymd(r.effectiveDate).replace(/-/g, '') }));
    // rupees for ONE unit (the row is in CBIC notation - per 100 for JPY / KRW)
    const rateOf = (cur) => { const r = exch.find((x) => t(x.invoiceCurrencyCode).toUpperCase() === t(cur).toUpperCase()); return r ? r.rate / (r.unitInRs || 1) : 0; };
    // 30-Oct-2026: the invoice row of the screens keeps the rate the way the notification quotes it, with the units
    // beside it. Handing back only the per-unit figure left the screens dividing a per-unit rate by 100 again.
    const exchRowOf = (cur) => exch.find((x) => t(x.invoiceCurrencyCode).toUpperCase() === t(cur).toUpperCase()) || null;

    const exportData = {
        customsPortCode: location, shipmentMode: modeOf(location, sb),
        autoField_13: t(h.jobNumber), // "User Job No" - the job number in the file (our own job number is not changed)
        chaNo: t(sb.chaLicenseNumber), shipperIec: t(sb.importerExporterCode), shipperBranchSrNo: t(sb.branchSrNoOfExporter),
        shipperName: t(sb.impExpName), shipperAddress1: t(sb.impExpAddress1), shipperAddress2: t(sb.impExpAddress2), shipperCity: t(sb.impExpCity),
        shipperState: t(sb.impExpState), shipperPin: t(sb.impExpPin),
        mercManuf: /^F/i.test(t(sb.typeOfExporter)) ? 'F' : t(sb.typeOfExporter) ? 'M' : '', shipperClass: t(sb.exporterClass),
        stateOriginCode: t(sb.stateOfOriginExporter), adCode: t(sb.authorizedDealerCode), autoField_11: t(sb.epzCode),
        consigneeName: t(sb.consigneeName), consigneeAddress1: t(sb.consigneeAddress1), consigneeAddress2: t(sb.consigneeAddress2),
        consigneeAddress3: t(sb.consigneeAddress3), consigneeAddress4: t(sb.consigneeAddress4), consigneeCountryCode: t(sb.consigneeCountry),
        nfeiCategoryCode: t(sb.categoryForNEFISB), rbiNo: t(sb.rbiWaiverNo), rbiWaiverDate: ymd(sb.rbiWaiverDate),
        loadingPortCode: t(sb.portOfLoading), destPortCode: t(sb.portOfFinalDestination), destCountryCode: t(sb.countryOfFinalDestination),
        discCountryCode: t(sb.countryOfDischarge), discPortCode: t(sb.portOfDischarge), sealType: t(sb.sealType), natureOfCargo: t(sb.natureOfCargo),
        autoField_18: t(sb.grossWeight), autoField_19: t(sb.netWeight), grWtUnit: t(sb.unitOfMeasurement), autoField_14: t(sb.totalNumberOfPackages),
        autoField_16: t(sb.marksNumbers), autoField_17: t(sb.numberOfLoosePackets), autoField_22: t(sb.mawbnumber), autoField_24: t(sb.hawbnumber),
        shipperGstinType: GST_TYPE[t(sb.gstnType).toUpperCase()] || t(sb.gstnType), shipperGstin: t(sb.gstnId),
    };
    const stuff = (m.stuffModel || [])[0];
    if (stuff) { exportData.factoryStuffed = /^Y/i.test(t(stuff.factoryStuffed)) ? 'Yes' : 'No'; exportData.autoField_32 = /^Y/i.test(t(stuff.sampleAccompanied)) ? 'Yes' : 'No'; }
    // rows the SB JSON builder sends again as they are (file values win over values made up from the screen)
    exportData._exchangeRates = exch;
    // serial numbers inside each item: 1, 2, 3 ... (some files carry the sending system's own numbers, e.g. 12, 14, 16)
    const renumber = (rows, key) => {
        const seen = {};
        return rows.map((r, i) => ({ r, i, n: +t(r[key]) || 0 }))
            .sort((a, b) => (+t(a.r.invoiceSerialNumber) || 1) - (+t(b.r.invoiceSerialNumber) || 1) || (+t(a.r.itemSerialNumber) || 0) - (+t(b.r.itemSerialNumber) || 0) || a.n - b.n || a.i - b.i)
            .map(({ r }) => { const g = `${+t(r.invoiceSerialNumber) || 1}/${+t(r.itemSerialNumber) || 0}`; seen[g] = (seen[g] || 0) + 1; return { ...r, [key]: String(seen[g]) }; });
    };
    exportData._infoTypes = renumber(m.infoType || [], 'infoSrNo');
    exportData._statements = renumber(m.statement || [], 'statementSerialNo');
    Object.keys(exportData).forEach((k) => { if (exportData[k] === '') delete exportData[k]; });

    // supporting documents -> e-Sanchit lists (job level when item 0)
    // _icegate: the whole row from the file, sent again as it is (issuer, beneficiary, dates, invoice level)
    const docRow = (d) => ({ _icegate: { ...d, chaLicenseNumber: t(d.chaLicenseNumber) || t(sb.chaLicenseNumber), iec: t(d.iec) || t(sb.importerExporterCode) }, invSr: +t(d.invoiceSerialNumber) || 0, irn: t(d.imageReferenceNumber), drn: t(d.documentReferenceNo), docCode: t(d.documentTypeCode), issueDate: ymd(d.documentIssueDate), expiryDate: ymd(d.documentExpiryDate), issuingParty: t(d.documentIssuingPartyName), beneficiaryParty: t(d.documentBeneficiaryPartyName), placeOfIssue: t(d.placeOfIssue), fileType: t(d.fileType) });
    const docsOf = (inv, itm) => (m.supportingDocs || []).filter((d) => String(+t(d.invoiceSerialNumber) || 0) === String(inv) && String(+t(d.itemSerialNumber) || 0) === String(itm)).map(docRow);
    const jobDocs = (m.supportingDocs || []).filter((d) => !(+t(d.itemSerialNumber))).map(docRow);
    if (jobDocs.length) exportData.eSanchitList = jobDocs;

    const items = (m.itemModel || []).map((r, i) => {
        const inv = +t(r.invoiceSerialNumber) || 1, itm = +t(r.itemSerialNumberInvoice) || i + 1;
        const qty = num(r.quantity), rate = num(r.unitPrice);
        const desc = [r.descOfGoods1, r.descOfGoods2, r.descOfGoods3].map(t).filter(Boolean).join(' ');
        const dbk = (m.dbkModel || []).find((d) => (+t(d.invoiceSerialNumber) || 1) === inv && (+t(d.itemSerialNumberInvoice) || 0) === itm);
        const igst = t(r.igstPaymentStatus).toUpperCase();
        const reward = /^Y/i.test(t(r.rewardItem)) ? 'Y' : 'N';
        const totalFc = +(qty * rate).toFixed(4);
        const ex = rateOf((m.invoiceModel || []).find((x) => (+t(x.invoiceSerialNumber) || 1) === inv)?.invoiceCurrency);
        return {
            // Export screen names (id: the Drawback tab finds an item's drawback row by this id)
            id: inv * 1000 + itm, invSr: inv, itemSr: itm, scheme: t(r.schemeCode), ritc: t(r.ritcCode), desc, qty: t(r.quantity), unit: t(r.unitOfMeasurement), rate: t(r.unitPrice),
            rateUnit: t(r.unitOfRate), per: t(r.noOfUnit) || '1', totalFc: String(totalFc), pmv: t(r.presentMarketValue), itemFob: ex ? String(+(totalFc * ex).toFixed(2)) : '',
            endUse: t(r.endUseOfItem), igstPayStatus: IGST_LABEL[igst] || igst || 'Select', taxableValue: t(r.taxableValue), igstAmt: t(r.igstAmount),
            sourceState: t(r.sourceState), stateCode: t(r.sourceState), hawb: t(r.hawbNo), totalPkgs: t(r.totalPackage), thirdParty: /^Y/i.test(t(r.thirdParty)) ? 'Y' : 'N',
            reward, rodtep: reward, accessory: t(r.accessoryStatus), transitCountry: t(r.transitCountry), jobWorkNotificationNo: t(r.jobWorkNotificationNo),
            manfDetails: t(r.itemManufacturerProducerGrowerCode) ? 'Y' : 'N', mfgType: t(r.itemManufacturerProducerCodeType), mfgCode: t(r.itemManufacturerProducerGrowerCode),
            mfgAddress1: t(r.itemManufacturerProducerGrowerAddress1), mfgAddress2: t(r.itemManufacturerProducerGrowerAddress2), mfgCity: t(r.itemManufacturerProducerGrowerCity),
            mfgState: t(r.itemManufacturerProducerGrowerCountrySubdivision), mfgPin: t(r.itemManufacturerProducerGrowerPin), mfgCountry: t(r.itemManufacturerCountry),
            // 18-Nov-2026: the Items tab > Manufacturer window reads manfProd* - the file's maker was in the SB but the window was empty
            manfProdCdType: t(r.itemManufacturerProducerCodeType), manfProdCode: t(r.itemManufacturerProducerGrowerCode), manfProdAddress1: t(r.itemManufacturerProducerGrowerAddress1),
            manfProdAddress2: t(r.itemManufacturerProducerGrowerAddress2), manfProdCity: t(r.itemManufacturerProducerGrowerCity), manfProdSubDiv: t(r.itemManufacturerProducerGrowerCountrySubdivision),
            manfProdPin: t(r.itemManufacturerProducerGrowerPin), manfProdCountry: t(r.itemManufacturerCountry),
            dbkNo: dbk ? t(dbk.dbkScheduleNumber) : '', dbkQty: dbk ? t(dbk.drawbackQuantity) : '',
            eSanchitList: docsOf(inv, itm), suppDocs: docsOf(inv, itm).length ? 'Y' : 'N',
            swInfo: (m.infoType || []).some((x) => (+t(x.invoiceSerialNumber) || 1) === inv && (+t(x.itemSerialNumber) || 0) === itm) ? 'Y' : 'N',
            swStatement: (m.statement || []).some((x) => (+t(x.invoiceSerialNumber) || 1) === inv && (+t(x.itemSerialNumber) || 0) === itm) ? 'Y' : 'N',
            // names the SB JSON builder reads
            invoiceSrNo: inv, hsnCode: t(r.ritcCode), description: desc, quantity: qty, uqc: t(r.unitOfMeasurement), unitPrice: rate, schemeCode: t(r.schemeCode),
            endUseOfItem: t(r.endUseOfItem), rewardItem: reward, accessoryStatus: t(r.accessoryStatus) || 'NONE', hawbNo: t(r.hawbNo), totalPackage: num(r.totalPackage),
            igstPaymentStatus: igst, igstAmount: num(r.igstAmount),
        };
    });

    const invoices = (m.invoiceModel || []).map((r, i) => {
        const sr = +t(r.invoiceSerialNumber) || i + 1;
        const value = items.filter((it) => it.invSr === sr).reduce((s, it) => s + num(it.totalFc), 0);
        return {
            id: sr, srNo: sr, no: t(r.actualInvoiceNo), invoiceNo: t(r.actualInvoiceNo), date: ymd(r.invoiceDate), invoiceDate: ymd(r.invoiceDate), currency: t(r.invoiceCurrency),
            value: value ? String(+value.toFixed(2)) : '', invoiceValue: value ? String(+value.toFixed(2)) : '', contractType: t(r.natureOfContract), natureOfContract: t(r.natureOfContract),
            ...(() => { const q = exchRowOf(r.invoiceCurrency); const v = q && q.rate ? String(q.rate) : '';
              return { exchRate: v, exchangeRate: v, unitInRs: q ? (q.unitInRs || 1) : '' }; })(),
            buyer: t(r.buyerName), buyerName: t(r.buyerName), buyerAddress1: t(r.buyerAddress1), buyerAddress2: t(r.buyerAddress2), buyerAddress3: t(r.buyerAddress3), buyerAddress4: t(r.buyerAddress4),
            freightCurr: t(r.freightCurrency), freightAmount: t(r.freightAmount), insuranceRate: t(r.insuranceRate), insuranceCurr: t(r.insuranceCurrency), insuranceAmount: t(r.insuranceAmount),
            commissionRate: t(r.commissionRate), commissionCurr: t(r.commissionCurrency), commissionAmount: t(r.commissionAmount),
            discountRate: t(r.discountOnFOB), discountCurr: t(r.discountCurrency), discountAmount: t(r.discountAmount),
            otherRate: t(r.otherDeductions), otherCurr: t(r.otherDeductionsCurrency), otherAmount: t(r.otherDeductionsAmount),
            otherDeductionsRate: t(r.otherDeductions), otherDeductionsCurr: t(r.otherDeductionsCurrency), otherDeductionsAmount: t(r.otherDeductionsAmount),
            addFreight: t(r.addFreight), packingAmount: t(r.packingCharges), contractNo: t(r.exporterContractNumber), pymtNature: t(r.natureOfPayment), pymtPeriod: t(r.periodOfPayment),
            tpName: t(r.thirdPartyName), tpAddress1: t(r.thirdPartyAddress1), tpAddress2: t(r.thirdPartyAddress2), tpCity: t(r.thirdPartyCity), tpState: t(r.thirdPartyCountrySubdivision),
            tpCntryDiv: t(r.thirdPartyCountrySubdivision), tpCntry: t(r.thirdPartCountryCode), tpCntr2: t(r.thirdPartCountryCode), tpPin: t(r.thirdPartyPin), thirdParty: t(r.thirdPartyName) ? 'Y' : 'N', addFreight: t(r.addFreight),
            aeoCode: t(r.authorizedEconomicOperatorCode), aeoCountry: t(r.authorizedEconomicOperatorCountry), aeoCountryCode: t(r.authorizedEconomicOperatorCountry), aeoRole: t(r.authorizedEconomicOperatorRole), termPlace: t(r.termsPlace),
        };
    });

    // same shape as the Drawback tab rows (id = the item's id, srNo / invNo / itemNo / accUnit)
    const dbkItems = (m.dbkModel || []).map((d) => {
        const inv = +t(d.invoiceSerialNumber) || 1, itm = +t(d.itemSerialNumberInvoice) || 1;
        const it = items.find((x) => x.invSr === inv && x.itemSr === itm);
        return { id: inv * 1000 + itm, srNo: itm, invNo: inv, itemNo: itm, invSr: inv, itemSr: itm, dbkNo: t(d.dbkScheduleNumber), dbkQty: t(d.drawbackQuantity), accUnit: it ? it.unit : '', drawbackAvailable: t(d.drawbackAvailable) || 'Y', dbkRtAdv: '', dbkRtSpe: '', dbkVal: '' };
    })
        .sort((a, b) => a.invSr - b.invSr || a.itemSr - b.itemSr);
    exportData.dbkItems = dbkItems;
    // 12-Nov-2026: licence rows (Scheme > License). They were read from the file but never handed to the screen, so an
    // Advance Licence SB read from a file had blank licence rows and its JSON / checklist lost the licence.
    const licenseItems = (m.licenceModel || []).map((l, k) => {
        const inv = +t(l.invoiceSerialNumber) || 1, itm = +t(l.itemSerialNumberInvoice) || 1;
        const it = items.find((x) => x.invSr === inv && x.itemSr === itm);
        const ii = t(l.whetherIndigenousImported).toUpperCase();
        return { id: `LF${inv}-${itm}-${k + 1}`, itemId: it ? it.id : undefined, invNo: String(inv), itemNo: String(itm), srNo: +t(l.srno) || 1, regNo: t(l.registrationNo), regDate: ymd(l.registrationDate),
            snE: t(l.itemSerialNoInPartE), snC: t(l.itemSerialNoInPartC), qty: t(l.quantity), expQty: t(l.exportQuantity), uqc: it ? it.unit : '', indImp: ii === 'I' || ii === 'N' ? 'I' : 'M',
            expDesc: it ? String(it.desc || '').slice(0, 60) : '', impDesc: '', licNo: '', licDt: '', licType: 'DEEC', eoQty: '', eoVal: '' };
    }).sort((a, b) => +a.invNo - +b.invNo || +a.itemNo - +b.itemNo || a.srNo - b.srNo);
    if (licenseItems.length) exportData.licenseItems = licenseItems;
    const containers = (m.containerModel || []).map((c) => ({ containerNo: t(c.containerNumber), size: t(c.containerSize), sealNo: t(c.exciseSealNo), sealDate: ymd(c.sealDate), sealType: t(c.sealTypeIndicator), deviceId: t(c.sealDeviceID) }));

    const totalFc = items.reduce((s, i) => s + num(i.totalFc), 0);
    const counts = { invoices: invoices.length, items: items.length, drawback: dbkItems.length, licence: licenseItems.length, rodtepItems: items.filter((i) => i.reward === 'Y').length, swInfo: exportData._infoTypes.length, statements: exportData._statements.length, documents: (m.supportingDocs || []).length, containers: containers.length, exchangeRates: exch.length };
    return {
        exportData, invoices, items, dbkItems, licenseItems: licenseItems.length ? licenseItems : undefined, containers: containers.length ? containers : undefined,
        exchangeRates: exch, infoTypes: exportData._infoTypes, statements: exportData._statements,
        summary: {
            jobNo: t(h.jobNumber), jobDate: ymd(h.jobDate), customsPort: location, mode: exportData.shipmentMode || '', exporterName: t(sb.impExpName), iecCode: t(sb.importerExporterCode),
            chaCode: t(sb.chaLicenseNumber), loadingPort: t(sb.portOfLoading), destCountry: t(sb.countryOfFinalDestination), destPort: t(sb.portOfFinalDestination),
            invoiceCount: invoices.length, itemCount: items.length, totalValueFc: +totalFc.toFixed(2), gstin: t(sb.gstnId), counts,
        },
    };
}

function readShippingBill(input, hint) {
    const text = typeof input === 'string' ? input : JSON.stringify(input);
    const trimmed = text.replace(/^﻿/, '').trim();
    let doc;
    if (hint === 'flat' || trimmed.startsWith('HREC') || trimmed.includes(GS)) doc = readFlat(trimmed);
    else {
        let obj;
        try { obj = typeof input === 'object' && input ? input : JSON.parse(trimmed); } catch (e) { doc = readFlat(trimmed); }
        if (!doc) doc = readJson(obj);
    }
    const out = toExportScreen(doc);
    return { ...out, detectedFormat: doc.format === 'CACHE01' ? 'CACHE01' : 'FLAT_FILE_SB', unknownTables: doc.unknownTables || [] };
}

// ---- 3. CACHE01 JSON -> ICES 1.5 shipping bill flat file (.sb) (29-Oct-2026) ----
// Same layout readFlat() reads and the ICEGATE sample files use: HREC (12 fields), <TABLE>name sections whose rows
// start F | custom house | job no | job date | SB no | SB date (only F .. job date for the 'job' tables), then the fields
// at the column numbers above, <END-SB>, TREC. Fields separated by ASCII 29, CRLF line ends. Row lengths as in the
// ICEGATE files / the format document. 19-Nov-2026: all parts of format 3.7 (was 10 tables); STUFF only when factory
// stuffed / sample accompanied is Y (iCAFFE leaves the N / N part out).
// 19-Nov-2026: fields the flat format keeps shorter than the JSON (format 3.7 lengths)
const FLAT_MAX = { 'sbModel.consigneeAddress4': 35, 'invoiceModel.thirdPartyAddress2': 50, 'itemModel.sourceState': 2, 'itemModel.accessoryStatus': 1,
    'thirdPartyModel.exporterAddress1': 35, 'supportingDocs.icegateId': 15, 'supportingDocs.documentReferenceNo': 17 };
function writeFlat(json, opts = {}) {
    const h = (json && json.headerField) || {}; const m = (json && json.master) || {};
    const clean = (v) => (v === undefined || v === null ? '' : String(v)).replace(/[\x1d\r\n]+/g, ' ').trim();
    const jobNo = clean(h.jobNumber); const jobDate = clean(h.jobDate); const port = clean(h.receiverID);
    const msg = clean(h.messageType || 'F') || 'F';
    const now = opts.now || new Date();
    const hhmm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const out = [['HREC', 'ZZ', clean(h.senderID), 'ZZ', port, 'ICES1_5', clean(h.indicator || 'P'), '', 'CACHE01', jobNo, jobDate, hhmm].join(GS)];
    for (const [tag, model, cols, len, lead] of FLAT_DEFS) {
        let rows = Array.isArray(m[model]) ? m[model] : [];
        if (tag === 'STUFF') rows = rows.filter(r => /^Y/i.test(clean(r.factoryStuffed)) || /^Y/i.test(clean(r.sampleAccompanied)));
        if (!rows.length) continue;
        out.push('<TABLE>' + tag);
        for (const r of rows) {
            const f = new Array(len).fill('');
            f[0] = msg; f[1] = port; f[2] = jobNo; f[3] = jobDate;
            if (lead === 'sb') { f[4] = clean(opts.sbNo); f[5] = clean(opts.sbDate); }
            for (const [i, k] of Object.entries(cols)) if (+i < len) { const v = clean(r[k]); const mx = FLAT_MAX[model + '.' + k]; f[+i] = mx ? v.slice(0, mx) : v; }
            out.push(f.join(GS));
        }
    }
    out.push('<END-SB>');
    out.push(['TREC', jobNo].join(GS));
    return out.join('\r\n') + '\r\n';
}

module.exports = { readShippingBill, readFlat, readJson, toExportScreen, writeFlat };
