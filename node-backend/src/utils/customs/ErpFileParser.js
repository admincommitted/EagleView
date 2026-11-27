// Parses ERP / ICEGATE JSON and flat files into the Import (jobData) and Export (exportData) screen data.
import { readBeFlat } from './beFlatFile.js';
import { readShippingBill } from './sbFileReader.js';

const GS = '\x1d';
// a filed BE splits a long item description at 60 raw characters
const DESCRIPTION_SPLIT_LENGTH = 60;
const RANDOM_ID_SPREAD = 10000;

// description 1 + 2 of a filed BE: joined as they were split (at 60 raw characters = no space in between)
const joinDesc = (first, second) => {
  const part1 = String(first || '');
  const part2 = String(second || '');
  if (!part2) return part1.trim();
  return (part1.length >= DESCRIPTION_SPLIT_LENGTH ? part1 + part2 : part1 + ' ' + part2).trim();
};

const randomRowId = (index) => Date.now() + Math.floor(Math.random() * RANDOM_ID_SPREAD) + index;

// ─── HEURISTIC JSON → BE jobData MAPPING ──────────────────────────────────────
const BE_JSON_KEYS = {
  autoField_1: ['customsLocation', 'location', 'portCode', 'port', 'customsPort', 'locCode'],
  autoField_2: ['portCodeShort', 'portCode2'],
  autoField_3: ['chaCode', 'chaDetails', 'chaLicNo', 'chaLicenseNumber', 'chaLicense'],
  autoField_4: ['importerName', 'nameOfImporter', 'impExpName', 'importer', 'iecName', 'consigneeName'],
  autoField_5: ['iecCode', 'importerExporterCode', 'iec', 'iecNo'],
  autoField_6: ['address1', 'addr1', 'impExpAddress1', 'importerAddress1'],
  autoField_7: ['address2', 'addr2', 'impExpAddress2', 'importerAddress2'],
  autoField_8: ['city', 'impExpCity', 'importerCity'],
  autoField_9: ['state', 'impExpState', 'importerState'],
  autoField_10: ['pin', 'pinCode', 'zip', 'impExpPin'],
  autoField_11: ['ctxState', 'taxState'],
  autoField_12: ['stateCode', 'taxStateCode'],
  autoField_13: ['registrationNo', 'gstin', 'gstNo', 'taxId'],
  autoField_15: ['igmDate', 'igmDt'],
  autoField_16: ['blDate', 'awbDate', 'billOfLadingDate'],
  autoField_18: ['igmNo', 'igmNumber'],
  autoField_19: ['blNo', 'awbNo', 'billOfLadingNo', 'blNumber', 'awbNumber'],
  autoField_20: ['countryOfOrigin', 'originCountry', 'coo'],
  autoField_21: ['countryOfConsignment', 'consignmentCountry'],
  autoField_22: ['portOfShipment', 'loadingPort', 'portOfLoading'],
  autoField_23: ['masterBlNo', 'masterBL'],
  autoField_24: ['vesselName', 'flightNo', 'vesselOrFlightNo', 'vessel', 'flight'],
  autoField_25: ['rotationNo', 'rotNo'],
  autoField_46: ['govtIec', 'governmentIec'],
  autoField_48: ['branchNo', 'branchNumber'],
  autoField_51: ['beType', 'billOfEntryType', 'boeType'],
  autoField_52: ['modeOfTransport', 'transportMode', 'shipmentMode'],
  autoField_53: ['importerType', 'impType'],
  autoField_55: ['greenChannel', 'greenChannelRequested'],
};

// ─── HEURISTIC JSON → SB exportData MAPPING ───────────────────────────────────
const SB_JSON_KEYS = {
  customsPort: ['customsPort', 'portCode', 'port', 'location', 'locCode'],
  iecCode: ['iecCode', 'importerExporterCode', 'iec'],
  shipperName: ['shipperName', 'exporterName', 'impExpName', 'exporter'],
  address1: ['address1', 'addr1', 'impExpAddress1'],
  address2: ['address2', 'addr2', 'impExpAddress2'],
  city: ['city', 'impExpCity'],
  state: ['state', 'impExpState'],
  pin: ['pin', 'pinCode', 'zip', 'impExpPin'],
  chaCode: ['chaCode', 'chaLicenseNumber', 'chaDetails'],
  sbType: ['sbType', 'shippingBillType'],
  shipmentMode: ['shipmentMode', 'modeOfTransport', 'transportMode'],
  autoField_6: ['countryOfDestination', 'destCountry', 'destinationCountry'],
  autoField_7: ['portOfDestination', 'destPort'],
  autoField_5: ['portOfLoading', 'loadingPort'],
  autoField_22: ['vesselOrFlightNo', 'vesselName', 'flightNo', 'vessel'],
  autoField_23: ['vesselOrFlightDate', 'vesselDate', 'flightDate'],
  autoField_24: ['rotationNo', 'rotNo'],
  autoField_25: ['rotationDate', 'rotDate'],
  autoField_8: ['stateOfOrigin', 'stateOrigin'],
  autoField_32: ['sbType', 'shippingBillType'],
};

const normalizeKey = (key) => key.toLowerCase().replace(/[_\s-]/g, '');
const isFilled = (value) => value !== undefined && value !== null && value !== '';

function findValue(obj, keys) {
  for (const key of keys) {
    if (isFilled(obj[key])) return obj[key];
    const found = Object.keys(obj).find((k) => normalizeKey(k) === normalizeKey(key));
    if (found && isFilled(obj[found])) return obj[found];
  }
  return undefined;
}

// YYYYMMDD -> YYYY-MM-DD for date input fields
function fmtDate(date) {
  if (!date || date.length !== 8) return date || '';
  return date.substring(0, 4) + '-' + date.substring(4, 6) + '-' + date.substring(6, 8);
}

// ─── DETECT FORMAT ─────────────────────────────────────────────────────────────
function detectFormat(obj) {
  if (obj.headerField && obj.master) {
    if (obj.master.BEModel || obj.master.beModel) return 'CACHI01';
    if (obj.master.SBModel || obj.master.sbModel) return 'CACHE01';
  }
  if (obj.beType || obj.iecCode || obj.nameOfImporter) return 'BE_GENERIC';
  if (obj.sbType || obj.importerExporterCode || obj.impExpName) return 'SB_GENERIC';
  return 'UNKNOWN';
}

// ─── CACHI01 JSON → BE jobData ─────────────────────────────────────────────────
const SINGLE_ROW_MODELS = ['beModel', 'igmModel', 'igmsModel', 'ctxModel', 'exchangeModel', 'permissionModel'];
const KEPT_ARRAY_MODELS = [
  'supportingDocsModel',
  'licenseModel',
  'misc_chModel',
  'rspModel',
  'depbModel',
  'bondModel',
  'certModel',
  'hssModel',
  'reimportModel',
  'amendModel',
  'sw_ConstModel',
  'sw_ProdModel',
  'ctrlModel',
];
// kept in ICEGATE form on the job so the BE JSON sends them back unchanged
const JOB_ICEGATE_ROW_MODELS = ['supportingDocsModel', 'ctrlModel', 'sw_ConstModel', 'sw_ProdModel'];
// item fields the BE JSON builder reads back under the same name
const ITEM_PASSTHROUGH_FIELDS = [
  'additionalNotification1',
  'additionalNotification1SrNo',
  'additionalNotification2',
  'additionalNotification2SrNo',
  'otherNotification',
  'otherNotificationSrNo',
  'cusEducessNotfnNumber',
  'cusEducessNotfnSrNo',
  'ncdNotn',
  'ncdNotnSrNo',
  'antiDumpingDutyNotification',
  'antiDumpingDutySerialNumber',
  'cthSerialNumber',
  'supplierSerialNumber',
  'quantityAsPerAntiDumpingNotn',
  'tariffValueNotn',
  'tariffValueItemSerialNumber',
  'quantityAsPerTariffValueNotn',
  'aggregateDutyNotn',
  'aggregateDutyNotnSrNo',
  'safeguardDutyNotn',
  'safeguardDutyNotnSrNo',
  'discountRate',
  'discountAmount',
  'quantityAsPerCth',
  'cthQty',
  'svbReferenceNumber',
  'svbReferenceDate',
  'svbLoadAssessableValue',
  'svbLoadOnDuty',
  'svbFlag',
  'whetherLoadProvisionalOnAssessableValue',
  'whetherLoadProvisionalOnDuty',
  'customHouseCodeWhichHasImposedLoad',
  'policyParaNo',
  'policyYear',
  'previousBeNo',
  'previousBeDate',
  'prevUnitPriceInvoiced',
  'prevCurrencyCode',
  'prevCustomSite',
  'customsFlag',
  'itemManufacturerType',
  'itemManufacturerCode',
  'itemManufacturerCity',
  'itemManufacturerSubdivision',
  'itemManufacturerPin',
  'cth',
  'ceth',
  'accessoryStatus',
];
// an ICD custom house code (INxxx6)
const ICD_CUSTOM_HOUSE = /^IN[A-Z0-9]{3}6$/;

const modelValue = (master, name) => master[name] || master[name.toLowerCase()] || [];
const modelRows = (master, name) => {
  const rows = modelValue(master, name);
  return Array.isArray(rows) ? rows : [rows];
};
const firstRowOf = (rows) => (Array.isArray(rows) ? rows[0] || {} : rows);

// every field of the single-row models and of the header goes onto the job first, so no data is lost
function copySingleRowModels(master, header, jobData) {
  for (const model of SINGLE_ROW_MODELS) Object.assign(jobData, firstRowOf(modelValue(master, model)));
  Object.assign(jobData, header);
}

function keepArrayModels(master, result) {
  for (const model of KEPT_ARRAY_MODELS) {
    const rows = modelValue(master, model);
    if (rows.length > 0) result['_' + model] = rows;
  }
}

// bond / certificate / high-sea-sale rows -> the header screen's own grids
function mapHeaderGrids(master, jobData) {
  const bonds = modelRows(master, 'bondModel');
  if (bonds.length) {
    jobData._bondRows = bonds.map((bond, index) => ({
      id: Date.now() + index,
      bondNo: bond.bondNumber || '',
      bondCode: bond.bondCode || '',
      bondPort: bond.bondPort || '',
    }));
  }
  const certificates = modelRows(master, 'certModel');
  if (certificates.length) {
    jobData._certRows = certificates.map((cert, index) => ({
      id: Date.now() + index,
      certNo: cert.certificateNumber || '',
      certDate: fmtDate(cert.certificationDate) || '',
      certType: cert.certificationType || '',
    }));
    jobData.certificate = 'Y';
  }
  const highSeaSales = modelRows(master, 'hssModel');
  if (highSeaSales.length) {
    jobData._hssRows = highSeaSales.map((row, index) => ({
      id: Date.now() + index,
      importerName: row.importerName || '',
      iecNo: row.iec || '',
      branchSrNo: row.branchSrNo || '',
      address1: row.importerAddress1 || '',
      address2: row.importerAddress2 || '',
      city: row.importerCity || '',
      pin: row.importerPin || '',
      precedingLevel: 'Level- ' + (row.precedingLevel || '0'),
    }));
  }
  JOB_ICEGATE_ROW_MODELS.forEach((model) => {
    const rows = modelRows(master, model);
    if (rows.length) jobData['_' + model] = rows;
  });
}

function mapBeModel(be, jobData) {
  if (be.customHouseCode) {
    jobData.autoField_2 = be.customHouseCode;
    jobData.portCode = be.customHouseCode;
  }
  if (be.chaCode) jobData.autoField_3 = be.chaCode;
  // autoField_40-45 are the HIGH SEA SELLER boxes - the importer is never the seller, so they are not filled from it
  if (be.nameOfImporter) jobData.autoField_4 = be.nameOfImporter;
  if (be.iecCode) jobData.autoField_5 = be.iecCode;
  if (be.address1) jobData.autoField_6 = be.address1;
  if (be.address2) jobData.autoField_7 = be.address2;
  if (be.city) jobData.autoField_8 = be.city;
  if (be.state) {
    jobData.autoField_9 = be.state;
    jobData.autoField_11 = be.state;
  }
  if (be.pin) jobData.autoField_10 = be.pin;
  if (be.beType) jobData.autoField_51 = be.beType;
  if (be.modeOfTransport) {
    jobData.autoField_52 = be.modeOfTransport;
    jobData.trans = be.modeOfTransport;
  }
  if (be.countryOfOrigin) {
    jobData.autoField_20 = be.countryOfOrigin;
    jobData.countryOfOrigin = be.countryOfOrigin;
  }
  if (be.countryOfConsignment) {
    jobData.autoField_21 = be.countryOfConsignment;
    jobData.countryOfConsignment = be.countryOfConsignment;
  }
  if (be.portOfShipment) {
    jobData.autoField_22 = be.portOfShipment;
    jobData.portOfOrigin = be.portOfShipment;
  }
  // screen keys too (Job Header shows greenChannel / importerType / paymentMethodCode)
  if (be.greenChannelRequested) {
    jobData.autoField_55 = be.greenChannelRequested;
    jobData.greenChannel = be.greenChannelRequested;
  }
  if (be.importerType) {
    jobData.autoField_53 = be.importerType;
    jobData.importerType = be.importerType;
  }
  if (be.branchSrNo) jobData.autoField_48 = be.branchSrNo;
  if (be.portOfOrigin) jobData.portOfOrigin = be.portOfOrigin;
  if (be.paymentMethodCode) {
    jobData.paymentMethod = be.paymentMethodCode;
    jobData.paymentMethodCode = be.paymentMethodCode;
  }
  if (be.uniqueConsignmentReferenceNo) jobData.ucr = be.uniqueConsignmentReferenceNo;
  if (be.ucrType) jobData.ucrType = be.ucrType;
  if (be.warehouseCode) jobData.warehouseCode = be.warehouseCode;
  if (be.warehouseBENo) jobData.warehouseBENo = be.warehouseBENo;
  if (be.warehouseBEDate) jobData.warehouseBEDate = fmtDate(be.warehouseBEDate);
  if (be.warehouseCustomSiteId) jobData.warehouseCustomSiteId = be.warehouseCustomSiteId;
  if (be.beClass) jobData.beClass = be.beClass;
  // flags
  if (be.highSeaSaleFlag) jobData.highSeaSaleFlag = be.highSeaSaleFlag;
  if (be.kachchaBE) jobData.kachchaBE = be.kachchaBE;
  if (be.whetherPriorBE) jobData.whetherPriorBE = be.whetherPriorBE;
  if (be.firstCheckRequested) jobData.firstCheckRequested = be.firstCheckRequested;
  if (be.section48Requested) jobData.section48Requested = be.section48Requested;
  if (be.authorizedEconomicDealerCode) jobData.aeoCode = be.authorizedEconomicDealerCode;
  // packages / weight from beModel (fallback if igmsModel is empty)
  if (be.noOfPackagesReleased) jobData.totalPkg = be.noOfPackagesReleased;
  if (be.packageCode) jobData.pkg = be.packageCode;
  if (be.grossWeight) jobData.grossWt = be.grossWeight;
  if (be.unitOfMeasurement) jobData.grossWtUnit = be.unitOfMeasurement;
}

const igmGridRow = (igm, index) => ({
  id: Date.now() + index,
  igmNo: igm.igmNumber || '',
  igmDate: fmtDate(igm.igmDate) || '',
  mawbNo: igm.mawbNo || '',
  mawbDate: fmtDate(igm.mawbDate) || '',
  hawbNo: igm.hawbNo || '',
  hawbDate: fmtDate(igm.hawbDate) || '',
  inwardDate: fmtDate(igm.inwardDate) || '',
  totalPkg: igm.totalNoOfPackages || '',
  pkgCode: igm.packageCode || '',
  grossWt: igm.grossWeight || '',
  wtUnit: igm.unitQuantityCode || '',
  marks1: igm.marksAndNumbers1 || '',
  marks2: igm.marksAndNumbers2 || '',
  marks3: igm.marksAndNumbers3 || '',
  lineNo: igm.lineNo || igm.lineNumber || '',
});

// An ICD BE filed as mode L (Land) with a gateway IGM or containers is sea cargo moved inland - iCAFFE files its sea
// jobs at an ICD that way. It opens as a Sea job, so the Job Header shows the ICD box and the containers; the BE file
// is made with L again for the ICD.
function isSeaCargoAtIcd(be, jobData, firstIgm, master) {
  const customHouse = String(be.customHouseCode || (jobData && jobData.portCode) || '')
    .trim()
    .toUpperCase();
  const containers = master.containerModel || master.containermodel || [];
  const isLandMode =
    String(be.modeOfTransport || '')
      .trim()
      .toUpperCase() === 'L';
  const hasGatewayOrContainers = firstIgm.gatewayIgmNo || (Array.isArray(containers) && containers.length);
  return isLandMode && ICD_CUSTOM_HOUSE.test(customHouse) && hasGatewayOrContainers;
}

// igmsModel → jobData._igmRows (the IGM grid); the scalar IGM fields stay blank so they do not duplicate the grid
function mapIgmRows(master, be, jobData) {
  const igmRows = master.igmsModel || master.igmModel || master.igmmodel || [];
  jobData._igmRows = [];
  // ICD: gateway IGM of the first row (Job Header "ICD Specification")
  const firstIgm = (Array.isArray(igmRows) && igmRows[0]) || {};
  if (firstIgm.gatewayIgmNo) jobData.gatewayIgmNo = firstIgm.gatewayIgmNo;
  if (firstIgm.gatewayIgmDate) jobData.gatewayIgmDate = fmtDate(firstIgm.gatewayIgmDate);
  if (firstIgm.gatewayPortCode) jobData.gatewayPortCode = firstIgm.gatewayPortCode;
  if (isSeaCargoAtIcd(be, jobData, firstIgm, master)) {
    jobData.autoField_52 = 'S';
    jobData.trans = 'S';
  }
  if (Array.isArray(igmRows)) igmRows.forEach((igm, index) => jobData._igmRows.push(igmGridRow(igm, index)));
}

// ctxModel → jobData (CTX / GST state details)
function mapCtx(master, jobData) {
  const ctx = firstRowOf(master.ctxModel || master.ctxmodel || []);
  if (ctx.stateCode) jobData.autoField_12 = ctx.stateCode;
  if (ctx.commercialTaxType) {
    jobData.autoField_50 =
      ctx.commercialTaxType === 'GSTN' || ctx.commercialTaxType === 'GSTIN' ? 'GSTIN' : ctx.commercialTaxType;
  }
  if (ctx.commercialTaxRegistrationNo) jobData.autoField_13 = ctx.commercialTaxRegistrationNo;
}

const cachiInvoice = (inv, index) => ({
  ...inv,
  id: randomRowId(index),
  // the serial number is not an invoice number - a file without actualInvoiceNumber gives a blank Invoice No (the save
  // then says which invoice to fill in)
  invoiceNo: inv.actualInvoiceNumber || inv.invoiceNo || '',
  invNo: inv.actualInvoiceNumber || inv.invoiceNo || '',
  invoiceDate: fmtDate(inv.invoiceDate) || '',
  invDate: fmtDate(inv.invoiceDate) || '',
  currency: inv.invoiceCurrency || inv.currency || '',
  value: parseFloat(inv.invoiceValue || inv.value) || 0,
  invValue: parseFloat(inv.invoiceValue || inv.value) || 0,
  supplierName: inv.supplierName || inv.supplier_name || inv.buyerName || '',
  supplierAddress1: inv.supplierAddress1 || '',
  supplierAddress2: inv.supplierAddress2 || '',
  supplierCountry: inv.supplierCountryName || '',
  terms: inv.termsOfInvoice || inv.terms || '',
  termsPlace: inv.termsPlace || '',
  paymentTerms: inv.paymentTerms || '',
  natureOfTransaction: inv.natureOfTransaction || '',
  freightValue: inv.freightValue || '',
  freightCurrency: inv.freightCurrency || '',
  freightRate: inv.freightRate || '',
  whetherFreightActual: inv.whetherFreightActual || '',
  insuranceValue: inv.insuranceValue || '',
  insuranceCurrency: inv.insuranceCurrency || '',
  insuranceRate: inv.insuranceRate || '',
  miscCharges: inv.miscCharges || '',
  miscCurrency: inv.miscCurrency || '',
  discountRate: inv.discountRate || '',
  discountAmount: inv.discountAmount || '',
  valuationMethod: inv.valuationMethodApplicable || '',
  buyerSellerRelated: inv.whetherBuyerAndSellerAreRelated || '',
  purchaseOrderNo: inv.purchaseOrderNumber || '',
  purchaseOrderDate: inv.purchaseOrderDate || '',
  contractNo: inv.contractNumber || '',
  lcNo: inv.lcNumber || '',
  lcDate: inv.lcDate || '',
});

const itemQuantity = (item) => parseFloat(item.quantity || item.qty) || 0;
const itemUnitPrice = (item) => parseFloat(item.unitPriceInvoiced || item.unitPrice) || 0;

// item total = qty x unit price
function itemTotalValue(item) {
  const quantity = itemQuantity(item);
  const unitPrice = itemUnitPrice(item);
  return quantity && unitPrice
    ? (quantity * unitPrice).toFixed(2)
    : String(parseFloat(item.assessableValue || 0) || '');
}

const passthroughFields = (item) =>
  Object.fromEntries(
    ITEM_PASSTHROUGH_FIELDS.filter((key) => item[key] !== undefined && item[key] !== '').map((key) => [key, item[key]]),
  );

const cachiItem = (item, index) => ({
  id: randomRowId(index),
  invoiceSrNo: Number(item.invoiceSerialNumber || item.invoiceSrNo) || 1,
  invSrNo: String(item.invoiceSerialNumber || item.invoiceSrNo || '1'),
  srNo: Number(item.itemSerialNumber || item.itemNo || item.srNo) || 0,
  itemSrNo: String(item.itemSerialNumber || item.srNo || '1'),
  hsnCode: item.ritcCode || item.hsnCode || item.ritc || '',
  ritc: item.ritcCode || item.hsnCode || item.ritc || '',
  // a filed BE splits the text at 60 raw characters ("...PHONE MO" + "DEL NOVA 2 PRO)") - joined without a space then
  description: joinDesc(item.itemDescription1, item.itemDescription2) || item.description || '',
  desc: joinDesc(item.itemDescription1, item.itemDescription2) || item.description || '',
  genericDesc: item.genericDescriptionOfTheItem || '',
  quantity: itemQuantity(item),
  qty: String(itemQuantity(item)),
  unit: item.unitQuantityCode || item.unit || item.uqc || 'NOS',
  unitPrice: itemUnitPrice(item),
  price: String(itemUnitPrice(item)),
  manufacturer: item.manufacturerName || '',
  brandName: item.brandName || '',
  model: item.model || '',
  endUse: item.endUseOfItem || '',
  countryOfOrigin: item.countryOfOrigin || '',
  itemManufacturerAddress1: item.itemManufacturerAddress1 || '',
  itemManufacturerAddress2: item.itemManufacturerAddress2 || '',
  itemManufacturerCountry: item.itemManufacturerCntry || '',
  preferentialStandard: item.preferentialStandard || '',
  rspApplicability: item.rspApplicability || 'N',
  whetherReimport: item.whetherReimport || 'N',
  assessableValue: parseFloat(item.assessableValue || item.value || item.fobValue) || 0,
  value: itemTotalValue(item),
  foc: 'N',
  itemCategory: item.itemCategory || '',
  accessories: item.accessoriesForTheItem || '',
  sourceCountry: item.sourceCountry || '',
  transitCountry: item.transitCountry || '',
  // notifications + other item fields, so re-sending a read BE keeps them
  bcdNotificationNo: item.bcdNotification || '',
  bcdSrNo: item.bcdNotificationSrNo || '',
  cvdNotificationNo: item.cvdNotification || '',
  cvdSrNo: item.cvdNotificationSrNo || '',
  swsNotificationNo: item.socialWelfareNotn || '',
  swsSrNo: item.socialWelfareNotnSlno || '',
  saptaNotificationNo: item.saptaNotn || '',
  saptaSrNo: item.saptaSerialNumber || '',
  healthCessNotificationNo: item.healthNotn || '',
  healthCessSrNo: item.healthSrNo || '',
  adlCvdNotificationNo: item.additionalCvdNotn || '',
  adlCvdSrNo: item.additionalCvdSrNo || '',
  ...passthroughFields(item),
});

const cachiExchangeRate = (rate) => ({
  currencyCode: rate.currencyCode || '',
  rate: parseFloat(rate.rate) || 0,
  unitInRs: parseFloat(rate.unitInRs) || 1,
  effectiveDate: fmtDate(rate.effectiveDate) || '',
});

const lclFclOf = (container) => {
  const code = String(container.lclfcl || container.fclLclCode || '')
    .toUpperCase()
    .slice(0, 1);
  return code === 'F' ? 'FCL' : code === 'L' ? 'LCL' : '';
};

// schema names are contNumber / lclfcl / sealNumber / truckNumber
const cachiContainer = (container, index) => ({
  ...container,
  id: randomRowId(index),
  contNo: container.contNumber || container.containerNumber || '',
  sealNo: container.sealNumber || '',
  truckNo: container.truckNumber || '',
  lclFcl: lclFclOf(container),
  contSize: container.containerSize || '',
  contType: container.containerType || '',
  igmNo: container.igmNumber || '',
  igmDate: container.igmDate || '',
});

const cachiDuty = (duty) => ({
  invoiceSrNo: duty.invoiceSerialNumber || '1',
  itemSrNo: duty.itemSerialNumber || '1',
  notificationNo: duty.notificationNo || '',
  notificationSrNo: duty.notificationSrNo || '',
  dutyType: duty.dutyType || '',
  addlDutyFlag: duty.addlDutyFlag || '',
  exmpNotificationNo: duty.exmpNotificationNo || '',
  exmpNotificationSrNo: duty.exmpNotificationSrNo || '',
  customsNotnExemptingIgstFlag: duty.customsNotnExemptingIgstFlag || '',
});

const cachiInfoType = (info) => ({
  invoiceSrNo: info.invoiceSerialNumber || '1',
  itemSrNo: info.itemSerialNumber || '1',
  infoType: info.infoType || '',
  infoQualifier: info.infoQualifier || '',
  infoCode: info.infoCode || '',
  infoText: info.infoText || '',
  infoMsr: info.infoMsr || '',
  infoUqc: info.infoUqc || '',
});

const cachiStatement = (statement) => ({
  invoiceSrNo: statement.invoiceSerialNumber || '0',
  itemSrNo: statement.itemSerialNumber || '0',
  statementType: statement.statementType || '',
  statementCode: statement.statementCode || '',
  statementText: statement.statementText || '',
  declarationType: statement.declarationtype || '',
});

const findItem = (items, invoiceSerial, itemSerial) =>
  items.find(
    (item) =>
      String(item.invSrNo) === String(invoiceSerial || '1') && String(item.itemSrNo) === String(itemSerial || '1'),
  );

const reimportDataOf = (row) => ({
  type: 'Y',
  shippingBillNo: row.shippingBillNo || '',
  shippingBillDate: fmtDate(row.shippingBillDate) || '',
  portOfExport: row.portOfExport || '',
  invoiceNoSb: row.invoiceNoSb || '',
  itemNoSb: row.itemNoSb || '',
  notificationNo: row.notificationNo || '',
  notificationSrNo: row.notificationSrNo || '',
  exportFreight: row.exportFreight || '',
  exportInsurance: row.exportInsurance || '',
  customsDuty: row.customsDuty || '',
  exciseDuty: row.exciseDuty || '',
});

// permission rows on the job, re-import rows on their item
function mapPermissionAndReimport(master, result) {
  const permissions = modelRows(master, 'permissionModel');
  if (permissions.length) {
    result.jobData._permissionRows = permissions.map((p) => ({
      permissionCode: p.permissionCode || '',
      reasonsForRequest: p.reasonsForRequest || '',
    }));
  }
  for (const row of modelRows(master, 'reimportModel')) {
    const item = findItem(result.items, row.invoiceSerialNumber, row.itemSerialNumber);
    if (!item) continue;
    item.reimportData = reimportDataOf(row);
    item.whetherReimport = 'Y';
  }
}

// licence debit rows -> the item's Licence window (licenceData); DEPB rows (duty exemption under a scrip, e.g.
// RoDTEP) -> item.depbData
function mapLicenceAndDepb(master, items) {
  for (const row of modelRows(master, 'licenseModel')) {
    const item = findItem(items, row.invoiceSerialNumber, row.itemSerialNumberInvoice);
    if (!item) continue;
    item.licenceData = Array.isArray(item.licenceData) ? item.licenceData : [];
    item.licenceData.push({
      id: Date.now() + item.licenceData.length,
      licenceNo: row.licenseRegistrationNumber || '',
      licenceDate: fmtDate(row.licenseRegistrationDate) || '',
      licenceCode: row.licenseCode || '',
      regnPort: row.licenseRegnPort || '',
      itemSrNoLicence: row.itemSrNoLicense || '',
      debitValue: row.debitValue || '',
      debitQty: row.debitQuantity || '',
      debitUqc: row.debitUnitOfMeasurement || '',
    });
    item.licenceFlag = 'Y';
  }
  for (const row of modelRows(master, 'depbModel')) {
    const item = findItem(items, row.invoiceSerialNumber, row.itemSerialNumberInvoice);
    if (!item) continue;
    item.depbData = Array.isArray(item.depbData) ? item.depbData : [];
    item.depbData.push({
      whetherExemption: row.whetherExemption || 'Y',
      bcdNotification: row.bcdNotification || '',
      bcdNotificationSrNo: row.bcdNotificationSrNo || '',
    });
  }
}

// the duty / exchange / info / statement rows also go on the job itself, so a direct save / re-send keeps them
function copyRowListsToJob(result) {
  if (result.duties.length) result.jobData._duties = result.duties;
  if (result.exchangeRates.length) result.jobData._exchangeRates = result.exchangeRates;
  if (result.infoTypes.length) result.jobData._infoTypes = result.infoTypes;
  if (result.statements.length) result.jobData._statements = result.statements;
}

function parseCachi01ToBE(jsonObj, result) {
  const header = jsonObj.headerField || {};
  const master = jsonObj.master || {};
  const be = firstRowOf(master.BEModel || master.beModel || []);
  const invoiceRows = master.invoiceModel || master.invoicemodel || [];
  const itemRows = master.itemsModel || master.itemsmodel || [];
  const { jobData } = result;

  copySingleRowModels(master, header, jobData);
  keepArrayModels(master, result);
  mapHeaderGrids(master, jobData);
  mapBeModel(be, jobData);
  mapIgmRows(master, be, jobData);
  mapCtx(master, jobData);
  if (header.jobNumber) jobData._jobNo = String(header.jobNumber);
  if (header.jobDate) jobData._jobDate = header.jobDate;

  result.invoices = invoiceRows.map(cachiInvoice);
  result.items = itemRows.map(cachiItem);
  result.exchangeRates = (master.exchangeModel || master.exchangemodel || []).map(cachiExchangeRate);
  const containerRows = master.containerModel || master.containermodel || [];
  if (containerRows.length > 0) jobData.containers = containerRows.map(cachiContainer);
  result.duties = (master.sbedutyModel || master.sbedutymodel || []).map(cachiDuty);
  result.infoTypes = (master.infoTypeModel || master.infotypemodel || []).map(cachiInfoType);
  mapPermissionAndReimport(master, result);
  mapLicenceAndDepb(master, result.items);
  result.statements = (master.statementModel || master.statementmodel || []).map(cachiStatement);
  copyRowListsToJob(result);
  return result;
}

// ─── PARSE JSON → BE jobData ───────────────────────────────────────────────────
function parseJsonToBE(jsonObj) {
  const result = { jobData: {}, invoices: [], items: [], detectedFormat: '' };
  const format = detectFormat(jsonObj);
  result.detectedFormat = format;
  if (format === 'CACHI01') return parseCachi01ToBE(jsonObj, result);

  const isGenericBe = format === 'BE_GENERIC';
  const invoiceRows = isGenericBe ? jsonObj.invoices || jsonObj.invoiceModel || [] : jsonObj.invoices || [];
  const itemRows = isGenericBe ? jsonObj.items || jsonObj.itemsModel || [] : jsonObj.items || [];

  for (const [field, keys] of Object.entries(BE_JSON_KEYS)) {
    const value = findValue(jsonObj, keys);
    if (value !== undefined) result.jobData[field] = String(value).trim();
  }

  result.invoices = invoiceRows.map((inv, index) => ({
    id: randomRowId(index),
    invoiceNo: inv.invoiceNo || inv.invoice_no || inv.InvoiceNo || '',
    invoiceDate: inv.invoiceDate || inv.invoice_date || inv.InvoiceDate || '',
    currency: inv.invoiceCurrency || inv.currency || 'USD',
    value: inv.invoiceValue || inv.value || 0,
    quantity: inv.invoiceQuantity || inv.quantity || 0,
    uqc: inv.invoiceUqc || inv.uqc || 'NOS',
  }));

  result.items = itemRows.map((item, index) => ({
    id: randomRowId(index),
    hsnCode: item.hsnCode || item.hsn_code || '',
    description: item.description || item.itemDescription || item.commodityDescription || '',
    quantity: item.quantity || item.qty || 0,
    unit: item.unit || item.uqc || 'NOS',
    assessableValue: item.assessableValue || item.value || item.fobValue || 0,
    invoiceSrNo: item.invoiceSrNo || 1,
  }));

  return result;
}

// ─── PARSE plain (non-ICEGATE) JSON → SB exportData ──────────────────────────
function legacyParseJsonToSB(jsonObj) {
  const result = { exportData: {}, invoices: [], items: [], detectedFormat: '' };
  const format = detectFormat(jsonObj);
  result.detectedFormat = format;

  let source = jsonObj;
  let invoiceRows;
  let itemRows;
  if (format === 'CACHE01') {
    const header = jsonObj.headerField || {};
    const master = jsonObj.master || {};
    const sb = master.SBModel || master.sbModel || {};
    source = { ...header, ...sb };
    invoiceRows = master.invoiceModel || [];
    itemRows = master.itemsModel || [];
  } else {
    invoiceRows = jsonObj.invoices || jsonObj.invoiceModel || [];
    itemRows = jsonObj.items || jsonObj.itemsModel || [];
  }

  for (const [field, keys] of Object.entries(SB_JSON_KEYS)) {
    const value = findValue(source, keys);
    if (value !== undefined) result.exportData[field] = String(value).trim();
  }

  result.invoices = invoiceRows.map((inv, index) => ({
    id: randomRowId(index),
    invoiceNo: inv.invoiceNo || inv.invoice_no || inv.actualInvoiceNumber || inv.invoiceSerialNumber || '',
    invoiceDate: inv.invoiceDate || inv.invoice_date || '',
    currency: inv.invoiceCurrency || inv.currency || 'USD',
    value: parseFloat(inv.invoiceValue || inv.value) || 0,
    quantity: parseFloat(inv.invoiceQuantity || inv.quantity) || 0,
    uqc: inv.invoiceUqc || inv.uqc || 'NOS',
    terms: inv.terms || inv.termsOfInvoice || '',
    supplierName: inv.buyerName || inv.supplierName || inv.supplier_name || '',
  }));

  result.items = itemRows.map((item, index) => ({
    id: randomRowId(index),
    hsnCode: item.hsnCode || item.hsn_code || item.ritcCode || item.ritc || '',
    description:
      item.description ||
      item.itemDescription ||
      ((item.itemDescription1 || '') + ' ' + (item.itemDescription2 || '')).trim() ||
      '',
    quantity: parseFloat(item.quantity || item.qty) || 0,
    unit: item.unit || item.uqc || item.unitQuantityCode || 'NOS',
    fobValue: parseFloat(item.fobValue || item.assessableValue || item.value) || 0,
    invoiceSrNo: Number(item.invoiceSrNo || item.invoiceSerialNumber) || 1,
    srNo: Number(item.itemSerialNumber || item.itemNo || item.srNo) || 0,
  }));

  return result;
}

// ─── ICEGATE ICES 1.5 FLAT FILE PARSER (.BE) ──────────────────────────────────
// ICES 1.5 BE flat file -> the same result as a CACHI01 JSON. The layout is the JSON schema order (see beFlatFile.js,
// checked against production .be files).
function parseFlatFileToBE(text) {
  const cachi = readBeFlat(text);
  if (String((cachi.headerField || {}).messageID || '').endsWith('_A')) {
    throw new Error('This is a BE amendment file (CACHI01_A), not a Bill of Entry - it cannot be read into a job');
  }
  if (cachi.master && cachi.master.beModel && cachi.master.beModel.length) {
    const result = parseJsonToBE(cachi);
    result.detectedFormat = 'ICES1_5_BE';
    if (cachi.unknownTables && cachi.unknownTables.length) result.unknownTables = cachi.unknownTables;
    return result;
  }
  return legacyParseFlatFileToBE(text);
}

// Fallback for a .be file without a readable BE table, by fixed columns (from a 5650.be analysis):
// HREC: F[2]=SenderID, F[4]=Port, F[7]=BEType, F[8]=MessageType, F[9]=SeqNo, F[10]=Date
// BE:   F[2]=JobNo, F[3]=JobDate, F[6]=BEType(X=ExBond/H=Home/W=WH), F[7]=IEC
//       F[8]=BranchSrNo, F[9]=ImporterName, F[10]=Addr1, F[11]=Addr2
//       F[12]=City, F[13]=State, F[14]=Pin, F[15]=BEClass(P=Provisional)
//       F[16]=Mode(A=Air/S=Sea/L=Land), F[19]=HighSeaSaleFlag
//       F[20]=PortOfOrigin, F[21]=CHA, F[22]=COO, F[23]=COC, F[24]=PortOfShipment
//       F[30]=WarehouseCode, F[31]=WHCustomsCode, F[32]=WHBENo, F[33]=WHBEDate
//       F[36]=GrossWeight, F[37]=WeightUnit
const BE_MODE_BY_CODE = { A: 'AIR', S: 'SEA', L: 'LAND' };
const flatField = (parts, index) => (parts[index] || '').replace(/&AMP;/gi, '&').trim();

function readLegacyBeRow(parts, jobData) {
  jobData._jobNo = flatField(parts, 2);
  jobData._jobDate = fmtDate(flatField(parts, 3));
  jobData.autoField_51 = flatField(parts, 6); // BEType: X=ExBond, H=Home, W=Warehousing
  jobData.autoField_5 = flatField(parts, 7); // IEC Code
  jobData.autoField_48 = flatField(parts, 8); // Branch Sr No
  jobData.autoField_4 = flatField(parts, 9); // Importer Name
  jobData.autoField_6 = flatField(parts, 10); // Address 1
  jobData.autoField_7 = flatField(parts, 11); // Address 2
  jobData.autoField_8 = flatField(parts, 12); // City
  jobData.autoField_9 = flatField(parts, 13); // State
  jobData.autoField_10 = flatField(parts, 14); // Pin
  jobData.autoField_52 = BE_MODE_BY_CODE[flatField(parts, 16)] || flatField(parts, 16);
  jobData.autoField_3 = flatField(parts, 21); // CHA Code
  jobData.autoField_20 = flatField(parts, 22); // Country of Origin
  jobData.autoField_21 = flatField(parts, 23); // Country of Consignment
  jobData.autoField_22 = flatField(parts, 24); // Port of Shipment
  // warehouse fields go to their named Job Header boxes (autoField_18 / 19 are "Bulk shipment" / ICD gateway date)
  jobData.warehouseCode = flatField(parts, 30);
  jobData.warehouseCustomSiteId = flatField(parts, 31);
  jobData.warehouseBENo = flatField(parts, 32);
  jobData.warehouseBEDate = fmtDate(flatField(parts, 33));
  if (flatField(parts, 36)) {
    jobData.grossWt = flatField(parts, 36);
    jobData.grossWtUnit = flatField(parts, 37);
  }
  // importer / country / port also into the named keys the screen shows
  Object.assign(jobData, {
    nameOfImporter: jobData.autoField_4,
    iecCode: jobData.autoField_5,
    branchSrNo: jobData.autoField_48,
    address1: jobData.autoField_6,
    address2: jobData.autoField_7,
    city: jobData.autoField_8,
    state: jobData.autoField_9,
    pin: jobData.autoField_10,
    chaCode: jobData.autoField_3,
    countryOfOrigin: jobData.autoField_20,
    countryOfConsignment: jobData.autoField_21,
    portOfOrigin: jobData.autoField_22,
    userJobNo: jobData._jobNo,
    jobDate: jobData._jobDate,
  });
  if (flatField(parts, 19)) jobData.highSeaSaleFlag = flatField(parts, 19);
}

// screen keys too (invNo / invDate / ...) so the Invoice tab shows them
const legacyBeInvoice = (parts, invoiceCount) => ({
  srNo: Number(flatField(parts, 6)) || invoiceCount + 1,
  invoiceNo: flatField(parts, 7),
  invNo: flatField(parts, 7),
  invoiceDate: fmtDate(flatField(parts, 8)),
  invDate: fmtDate(flatField(parts, 8)),
  currency: flatField(parts, 9),
  terms: flatField(parts, 10),
  value: parseFloat(flatField(parts, 17)) || 0,
  supplierName: flatField(parts, 11),
  supplierCountry: flatField(parts, 14),
});

function legacyBeItem(parts, itemCount) {
  const quantity = parseFloat(flatField(parts, 14)) || 0;
  const value = parseFloat(flatField(parts, 18)) || 0;
  const description = (flatField(parts, 10) + ' ' + flatField(parts, 11)).trim();
  const ritc = flatField(parts, 9);
  const uqc = flatField(parts, 13);
  return {
    invoiceSrNo: Number(flatField(parts, 6)) || 1,
    invSrNo: String(Number(flatField(parts, 6)) || 1),
    srNo: Number(flatField(parts, 7)) || itemCount + 1,
    itemSrNo: String(Number(flatField(parts, 7)) || itemCount + 1),
    hsnCode: ritc,
    ritc,
    cth: ritc,
    description,
    desc: description,
    uqc,
    unit: uqc,
    quantity,
    qty: String(quantity),
    price: quantity ? String(+(value / quantity).toFixed(6)) : '',
    assessableValue: value,
    value: String(value),
  };
}

function legacyParseFlatFileToBE(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const jobData = {};
  const invoices = [];
  const items = [];
  let currentTable = '';

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim()) continue;
    if (line.startsWith('<TABLE>')) {
      currentTable = line.replace('<TABLE>', '').trim().toUpperCase();
      continue;
    }
    const parts = line.split(GS);
    if (line.startsWith('HREC')) {
      jobData.autoField_2 = flatField(parts, 4);
      jobData.portCode = flatField(parts, 4); // customs port, e.g. INDEL4
      jobData._seqNo = flatField(parts, 9);
      jobData._fileDate = fmtDate(flatField(parts, 10));
      continue;
    }
    if (!line.startsWith('F')) continue;
    if (currentTable === 'BE') readLegacyBeRow(parts, jobData);
    else if (currentTable === 'INVOICE') invoices.push(legacyBeInvoice(parts, invoices.length));
    else if (currentTable === 'ITEMS') items.push(legacyBeItem(parts, items.length));
  }

  return { jobData, invoices, items, detectedFormat: 'ICES1_5_BE' };
}

// Shipping bill: ICEGATE CACHE01 JSON and ICES .sb flat files are read by sbFileReader.js; the reader here is only for
// plain (non-ICEGATE) SB JSON.
function parseJsonToSB(jsonObj) {
  if (detectFormat(jsonObj || {}) === 'CACHE01') return readShippingBill(jsonObj);
  return legacyParseJsonToSB(jsonObj);
}

function parseFlatFileToSB(text) {
  return readShippingBill(String(text || ''), 'flat');
}

export { parseJsonToBE, parseJsonToSB, parseFlatFileToBE, parseFlatFileToSB, detectFormat };
