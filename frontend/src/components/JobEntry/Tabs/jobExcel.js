// Job Excel upload (one workbook for the whole BE): Invoices, Items, Containers, Single Window sheets, Supporting
// (e-Sanchit) docs, item-wise SVB, Licence and Anti-dumping. The reader accepts our own template AND the other ERP's
// "ImportExcel" workbook (sheets INVOICE / ITEM / CONTAINERS / SW_INFOTYPE / SUPPORTING_DOCS / SW_STATEMENT /
// SW_CONSTITUENT / SW_PRODUCTION / SW_CONTROL / ItemWiseSVB / LICENSE / Antidumping with its column names), so files
// staff already keep can be uploaded as they are. The Template / Sample downloads use the same sheet and column names.
// Used by the Invoice tab ("Read Excel"), the Item tab ("Read File") and the Job Query "Download Sample" menu.
import * as XLSX from 'xlsx';
import { jobEntryApi } from '@/components/JobEntry/jobEntryApi';
import { computeItemDuty } from './ItemGridTabParts/helpers';

const normalizeHeader = (header) => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Excel dates arrive 1 ms before local midnight: round to the minute, then take the local date
const excelDateToYmd = (date) => {
  const rounded = new Date(Math.round(date.getTime() / 60000) * 60000);
  return new Date(rounded.getTime() - rounded.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
// text value; a number that is really an integer (RITC 90181100.0, IGM 1111.0, seal 15998141.0) loses the ".0"
const cellText = (value) => {
  if (value === undefined || value === null) return '';
  if (value instanceof Date) return excelDateToYmd(value);
  if (typeof value === 'number') return String(value);
  const text = String(value).trim();
  return /^\d+\.0$/.test(text) ? text.slice(0, -2) : text;
};
// a number cell; "0" / "0.0" of an optional amount means "not given" (the other ERP writes 0.0 in every empty box)
const cellAmount = (value) => {
  const text = cellText(value);
  if (text === '') return '';
  const number = parseFloat(text);
  return Number.isFinite(number) && number === 0 ? '' : text;
};
// date -> yyyy-mm-dd: Date cells, dd-MMM-yyyy, dd-mm-yyyy, dd/mm/yyyy, yyyymmdd, yyyy-mm-dd, Excel serial numbers (44693)
export const ymd = (value) => {
  if (value instanceof Date) return excelDateToYmd(value);
  const text = String(value ?? '').trim();
  if (!text) return '';
  let match = /^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ](\d{2,4})$/.exec(text);
  if (match && MONTHS[match[2].toUpperCase()]) {
    const year = match[3].length === 2 ? '20' + match[3] : match[3];
    return `${year}-${MONTHS[match[2].toUpperCase()]}-${match[1].padStart(2, '0')}`;
  }
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  if (/^\d{4,6}(\.0+)?$/.test(text)) {
    const serial = parseInt(text, 10);
    if (serial > 20000 && serial < 80000) return new Date(Date.UTC(1899, 11, 30) + serial * 86400000).toISOString().slice(0, 10);
  }
  return text;
};
const upperText = (value) => cellText(value).toUpperCase();
const yesNo = (value) => { const letter = upperText(value).charAt(0); return letter === 'Y' ? 'Y' : letter === 'N' ? 'N' : ''; };
const newId = (index) => Date.now() + (index || 0) + Math.random();
const serialText = (value) => cellText(value).replace(/\.0$/, '');
const invoiceKey = (invoiceNo) => cellText(invoiceNo).replace(/\s+/g, '').toUpperCase();
const parseList = (value) => {
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// column spec (the shape the exported *_COLS use): { h: our header, k: screen key, a: other accepted headers, f: converter }
const textColumn = (header, key, aliases = [], convert = cellText) => ({ h: header, k: key, a: Array.isArray(aliases) ? aliases : [aliases], f: convert });
const numberColumn = (header, key, aliases) => textColumn(header, key, aliases, cellAmount);
const dateColumn = (header, key, aliases) => textColumn(header, key, aliases, ymd);
const upperColumn = (header, key, aliases) => textColumn(header, key, aliases, upperText);
const flagColumn = (header, key, aliases) => textColumn(header, key, aliases, yesNo);
const blankRow = (columns) => Object.fromEntries(columns.map((column) => [column.k, '']));

// one column of a row by our header or any alias (header names compared without case / punctuation)
const columnValue = (row, spec) => {
  const headers = Object.keys(row);
  for (const name of [spec.h, ...spec.a]) {
    const header = headers.find((candidate) => normalizeHeader(candidate) === normalizeHeader(name));
    if (header !== undefined && String(row[header]).trim() !== '') return row[header];
  }
  return '';
};
const readColumn = (row, spec) => spec.f(columnValue(row, spec));
// values of the headers that start with a prefix, in sheet order (the other ERP's SUPPORTING_DOCS names its party
// columns DOC_ISSUING_PARTY_... x6 and DOC_BENEFICIARY_PARTY_... x6)
const prefixValues = (row, prefix) => Object.keys(row).filter((header) => normalizeHeader(header).startsWith(normalizeHeader(prefix))).map((header) => cellText(row[header]));
const rowHasValue = (row) => Object.values(row).some((value) => String(value ?? '').trim() !== '');

// ---------------------------------------------------------------------------------------------------------------
// sheet definitions
export const SHEET_NAMES = {
  Invoices: ['Invoices', 'INVOICE', 'Invoice'],
  Items: ['Items', 'ITEM'],
  Containers: ['Containers', 'CONTAINERS', 'Container'],
  SW_InfoType: ['SW_InfoType', 'SW_INFOTYPE', 'SW_INFO_TYPE'],
  SW_Statement: ['SW_Statement', 'SW_STATEMENT', 'Statement'],
  SW_Constituent: ['SW_Constituent', 'SW_CONSTITUENT'],
  SW_Production: ['SW_Production', 'SW_PRODUCTION'],
  SW_Control: ['SW_Control', 'SW_CONTROL'],
  Supporting_Docs: ['Supporting_Docs', 'SUPPORTING_DOCS', 'SupportingDocs', 'eSanchit'],
  Item_SVB: ['Item_SVB', 'ItemWiseSVB', 'SVB'],
  Licence: ['Licence', 'LICENSE', 'License'],
  Antidumping: ['Antidumping', 'ANTIDUMPING', 'Anti_Dumping', 'ADD'],
};

export const INV_COLS = [
  textColumn('Invoice No', 'invNo', ['InvoiceNo', 'INV_NO', 'Inv No', 'Invoice Number']), dateColumn('Invoice Date', 'invDate', ['InvoiceDate', 'INV_DATE']),
  upperColumn('Currency', 'currency', ['CURRENCY', 'Invoice Currency']), textColumn('Invoice Value', 'value', ['TotalValue', 'TOTAL_VALUE', 'Value', 'Invoice Amount']),
  upperColumn('Terms', 'terms', ['TERMS', 'Terms of Invoice']),
  numberColumn('Freight Amount', 'freightValue', ['FrtAmt', 'Freight', 'FREIGHT']), upperColumn('Freight Currency', 'freightCurrency', ['FrtCur']), numberColumn('Freight Rate %', 'freightRate', ['FrtRate', 'Freight Rate']),
  numberColumn('Insurance Amount', 'insuranceValue', ['InsAmt', 'Insurance', 'INSURANCE']), upperColumn('Insurance Currency', 'insuranceCurrency', ['InsCur']), numberColumn('Insurance Rate %', 'insuranceRate', ['InsRate', 'Insurance Rate']),
  flagColumn('Freight Actual (Y/N)', 'whetherFreightActual', ['FreightActual']),
  textColumn('Supplier Name', 'supplierName', ['SupplierName']), textColumn('Supplier Address 1', 'supplierAddress1', ['Address1', 'SupplierAdd1']), textColumn('Supplier Address 2', 'supplierAddress2', ['Address2', 'SupplierAdd2']),
  textColumn('Supplier Address 3', 'supplierAddress3', ['Address3', 'SupplierAdd3']), upperColumn('Supplier Country', 'supplierCountry', ['SupplierCountry']), textColumn('Supplier Pin', 'supplierPin', ['SupplierPinCode']),
  textColumn('Seller Name', 'sellerName', ['SellerName']), textColumn('Seller Address 1', 'sellerAddress1', ['SellerAdd1']), textColumn('Seller Address 2', 'sellerAddress2', ['SellerAdd2']), textColumn('Seller Address 3', 'sellerAddress3', ['SellerAdd3']),
  upperColumn('Seller Country', 'sellerCountryName', ['SellerCountry']), textColumn('Seller Pin', 'sellerPin', ['SellerPinCode']),
  textColumn('Broker Name', 'brokerName', ['BrokerName']), textColumn('Broker Address 1', 'brokerAddress1', ['BrokerAdd1']), textColumn('Broker Address 2', 'brokerAddress2', ['BrokerAdd2']), textColumn('Broker Address 3', 'brokerAddress3', ['BrokerAdd3']),
  upperColumn('Broker Country', 'brokerCountry', ['BrokerCountry']), textColumn('Broker Pin', 'brokerPin', ['BrokerPinCode']),
  numberColumn('Agency Commission', 'agencyCommAmount', ['AgencyComm', 'Agency Commission Amount']), upperColumn('Agency Commission Currency', 'agencyCommCurrency', ['AgencyCommCur']), numberColumn('Agency Commission Rate %', 'agencyCommRate', ['AgencyCommRate']),
  numberColumn('Loading Charges', 'loadingAmount', ['LoadingCharges', 'Loading Amount']), upperColumn('Loading Currency', 'loadingCurrency', ['LoadingCur']), numberColumn('Loading Rate %', 'loadingRate', ['LoadingRate']),
  numberColumn('Misc Charges', 'miscCharges', ['MiscCharges']), upperColumn('Misc Currency', 'miscCurrency', ['MiscCur']), numberColumn('Misc Rate %', 'miscChargesRate', ['MiscRate']),
  numberColumn('HSS Load Rate %', 'hssLoadRate', ['HssRate']), numberColumn('HSS Load Amount', 'hssLoadAmount', ['HssAmt']),
  textColumn('Nature of Discount', 'natureOfDiscount', ['DiscntNat']), numberColumn('Discount Rate %', 'discountRate', ['DiscntRate']), numberColumn('Discount Amount', 'discountAmount', ['DiscntAmt']),
  textColumn('SVB Ref No', 'svbReferenceNumber', ['SVBRefNo']), dateColumn('SVB Ref Date', 'svbReferenceDate', ['SVBDate']), upperColumn('SVB Custom House', 'customHouseCodeWhichHasImposedLoad', ['CustomHouse']),
  numberColumn('SVB Load on Ass. Value %', 'svbLoadAssessableValue', ['SVBonAssess']), numberColumn('SVB Load on Duty %', 'svbLoadOnDuty', ['SVBonDuty']), upperColumn('SVB Flag (A/D/B)', 'svbFlag', ['SVBFlag']),
  upperColumn('SVB Value Provisional (P/F)', 'whetherloadProvisionalOnAssValue', ['SVBonAssessFlag']), upperColumn('SVB Duty Provisional (P/F)', 'whetherProvisionalOnDuty', ['SVBonDutyFlag']),
  textColumn('Other Information', 'otherRelevantInform', ['Description', 'Other Relevant Information']),
  upperColumn('Nature of Transaction', 'natureOfTransaction', ['NatureOfTransaction']), upperColumn('Payment Terms', 'paymentTerms', ['TermsOfPayment']),
  textColumn('Buyer Seller Relationship', 'buyerSellerRelationship', ['BuyerSellerReln']), textColumn('Valuation Method', 'valuationMethod', ['ValMethodApplicable']),
  textColumn('Third Party Name', 'thirdPartyName', ['ThirdPartyName']), textColumn('Third Party Address 1', 'thirdPartyAddress1', ['ThirdPartyAdd1']), textColumn('Third Party Address 2', 'thirdPartyAddress2', ['ThirdPartyAdd2']),
  textColumn('Third Party City', 'thirdPartyCity', ['ThirdPartyCity']), textColumn('Third Party Country Subdivision', 'thirdPartyCntrySubDvsn', ['ThirdPartyCtrySubdv']), upperColumn('Third Party Country', 'thirdPartyCountryCode', ['ThirdPartyCtry']),
  textColumn('Third Party Pin', 'thirdPartyPin', ['ThirdPartyPinCode']), textColumn('Terms Place', 'termsPlace', ['TermsPlace']),
  textColumn('AEO Code', 'authorizedEconomicOperatorCode', ['AEOCode']), upperColumn('AEO Country', 'authorizedEconomicOperatorCountry', ['AEOCtry']), upperColumn('AEO Role', 'authorizedEconomicOperatorRole', ['AEORole']),
  flagColumn('Buyer Seller Related (Y/N)', 'whetherBuyerAndSellerAreRelated', ['BuyerSellerRelated', 'Buyer Seller Related']),
  textColumn('PO No', 'purchaseOrderNumber', ['PONo', 'PO Number']), dateColumn('PO Date', 'purchaseOrderDate', ['PODate']), textColumn('Contract No', 'contractNumber', ['ContractNo']), dateColumn('Contract Date', 'contractDate', ['ContractDate']),
  textColumn('LC No', 'lcNumber', ['LCNo']), dateColumn('LC Date', 'lcDate', ['LCDate']),
];

export const ITEM_COLS = [
  textColumn('Inv No', 'invNo', ['Invoice No']), textColumn('Inv Sr No', 'invSrNo', ['INV_SR_NO', 'Invoice Sr No']), textColumn('Item Sr. No', 'itemSrNo', ['ITEM_SR_NO', 'Item Sr No', 'Item No']),
  textColumn('RITC', 'ritc', ['HS Code', 'HSN']), textColumn('CTH', 'cth'), upperColumn('CETH', 'ceth'),
  textColumn('Description', 'desc', ['ITEM_DESCRIPTION', 'Item Description']), textColumn('Generic Description', 'genericDesc', ['GENERAL_DESCRIPTION', 'Generic Desc']),
  flagColumn('Desc Only In Checklist (Y/N)', 'descOnlyInChecklist', ['CHECKLIST_DESCRIPTION']),
  textColumn('Quantity', 'qty', ['QTY']), upperColumn('Unit', 'unit', ['UQC']), textColumn('Unit Price', 'price', ['UNIT_PRICE', 'Price', 'Rate']), textColumn('Total Value', 'value', ['TOTAL', 'Value', 'Assessable Value', 'Amount']),
  upperColumn('Country of Origin', 'countryOfOrigin', ['ORIGIN_COUNTRY', 'COO']), textColumn('Manufacturer', 'manufacturer', ['MANUFACTURER_NAME']), textColumn('Brand', 'brandName', ['BRAND']), textColumn('Model', 'model', ['MODEL_NO']),
  upperColumn('End Use', 'endUse', ['END_USE']), textColumn('Accessory Status (0/1/2)', 'accessoryStatus', ['ACCESSORY_STATUS']), textColumn('Accessories', 'accessories', ['ITEM_ACCESSORIES']), textColumn('Item Category', 'itemCategory', ['ITEM_CATEGORY']),
  upperColumn('Rate Type (P/S)', 'rateTypeFlag', ['PREF_STD', 'Preferential Standard', 'P/S']),
  textColumn('BCD Notn', 'bcdNotificationNo', ['BCD_NOTN', 'BCD Notification']), textColumn('BCD Sr No', 'bcdSrNo', ['BCD_SLNO']), textColumn('BCD Rate', 'bcdRate'),
  textColumn('SWS Notn', 'swsNotificationNo', ['SWS_NOTN']), textColumn('SWS Sr No', 'swsSrNo', ['SWS_SLNO']), textColumn('SWS Rate', 'swsRate'),
  textColumn('IGST Notn', '_igstNotn', ['IGST_NOTN_NO', 'IGST Notification']), textColumn('IGST Sr No', '_igstSr', ['IGST_NOTN_SLNO']), textColumn('IGST Rate', '_igstRate'),
  upperColumn('IGST Exempting Flag', '_igstFlag', ['IGST_IGST_FLAG', 'EXEMPTING_FLG']), textColumn('IGST Exmp Notn', '_igstExNotn', ['IGST_EXMP_NOTN_NO']), textColumn('IGST Exmp Sr No', '_igstExSr', ['IGST_EXMP_NOTN_SLNO']),
  textColumn('GST Cess Notn', '_cessNotn', ['IGSTCESS_NOTN_NO']), textColumn('GST Cess Sr No', '_cessSr', ['IGSTCESS_NOTN_SLNO']), upperColumn('GST Cess Flag', '_cessFlag', ['IGSTCESS_IGST_FLAG']),
  textColumn('GST Cess Exmp Notn', '_cessExNotn', ['IGSTCESS_EXMP_NOTN_NO']), textColumn('GST Cess Exmp Sr No', '_cessExSr', ['IGSTCESS_EXMP_NOTN_SLNO']),
  textColumn('AIDC Notn', '_aidcNotn', ['AIDC_DUTY_NOTN_NO']), textColumn('AIDC Sr No', '_aidcSr', ['AIDC_DUTY_NOTN_SLNO']), upperColumn('AIDC Flag', '_aidcFlag', ['AIDC_DUTY_FG']),
  textColumn('SAPTA Notn', 'saptaNotificationNo', ['SAPTA_NOTN']), textColumn('SAPTA Sr No', 'saptaSrNo', ['SAPTA_SLNO']),
  textColumn('Health Cess Notn', 'healthCessNotificationNo', ['HEALTHCESS_NOTN_NO']), textColumn('Health Cess Sr No', 'healthCessSrNo', ['HEALTHCESS_NOTN_SLNO']),
  textColumn('CVD Notn', 'cvdNotificationNo', ['CVD_NOTN']), textColumn('CVD Sr No', 'cvdSrNo', ['CVD_SLNO']), textColumn('Addl CVD Notn', 'adlCvdNotificationNo', ['ADDCVD_NOTN']), textColumn('Addl CVD Sr No', 'adlCvdSrNo', ['ADDCVD_SLNO']),
  textColumn('Addl Notn 1', 'additionalNotification1', ['AD1_NOTN']), textColumn('Addl Notn 1 Sr No', 'additionalNotification1SrNo', ['AD1_SLNO']),
  textColumn('Addl Notn 2', 'additionalNotification2', ['AD2_NOTN']), textColumn('Addl Notn 2 Sr No', 'additionalNotification2SrNo', ['AD2_SLNO']),
  textColumn('Other Notn', 'otherNotification', ['OTHER_NOTN']), textColumn('Other Notn Sr No', 'otherNotificationSrNo', ['OTHER_SLNO']),
  upperColumn('Scheme Code', '_schemeCode', ['SCHEME_CODE']), textColumn('Scheme Notn', '_schemeNotn', ['SCHEME_NOTN_NO']), textColumn('Scheme Notn Sr No', '_schemeSr', ['SCHEME_NOTN_SLNO']), flagColumn('Exemption Flag (Y/N)', '_exemptionFlag', ['EXEMPTION_FLAG']),
  textColumn('Licence No', '_licNo', ['LICENSE_REG_NO', 'LICENCE_NO', 'License No']), dateColumn('Licence Date', '_licDate', ['REG_DATE', 'LICENCE_DATE']), upperColumn('Licence Port', '_licPort', ['REG_PORT']), textColumn('Licence Item Sr No', '_licItemSr', ['ITEM_SLNO_LIC']), textColumn('Licence URN', '_licUrn', ['LIC_URN']),
  textColumn('Prev SB No', '_sbNo', ['PREVIOUS_SB_NO']), dateColumn('Prev SB Date', '_sbDate', ['PREVIOUS_SB_DT']), upperColumn('Port of Export', '_sbPort', ['PORT_OF_EXPORT']), textColumn('SB Inv Sr No', '_sbInv', ['INV_SLNO_SB']), textColumn('SB Item Sr No', '_sbItem', ['ITEM_SLNO_SB']),
  textColumn('Reimport Notn', '_reNotn', ['REIMPORT_NOTN']), textColumn('Reimport Notn Sr No', '_reSr', ['REIMPORT_NOTN_SLNO']), numberColumn('SB Freight', '_sbFrt', ['SB_FREIGHT']), numberColumn('SB Insurance', '_sbIns', ['SB_INSURANCE']),
  numberColumn('Customs Duty Paid', '_sbCus', ['CUSTOM_DUTY']), numberColumn('Excise Duty Paid', '_sbExc', ['EXCISE_DUTY']),
  textColumn('Mfr Code Type', 'itemManufacturerType', ['MNF_CODE_TYPE']), textColumn('Mfr Code', 'itemManufacturerCode', ['MNF_CODE']), textColumn('Mfr Address 1', 'itemManufacturerAddress1', ['MNF_ADD1']), textColumn('Mfr Address 2', 'itemManufacturerAddress2', ['MNF_ADD2']),
  textColumn('Mfr City', 'itemManufacturerCity', ['MNF_CITY']), textColumn('Mfr Country Subdivision', 'itemManufacturerSubdivision', ['MNF_CTRY_SUBDV']), textColumn('Mfr Pin', 'itemManufacturerPin', ['MNF_PIN']), upperColumn('Mfr Country', 'itemManufacturerCountry', ['MNF_CTRY']),
  upperColumn('Source Country', 'sourceCountry', ['SOURCE_CTRY']), upperColumn('Transit Country', 'transitCountry', ['TRANSIT_CTRY']),
  numberColumn('RSP Amount', '_rspAmt', ['RSP_AMOUNT']), upperColumn('RSP Flag', '_rspFlag', ['RSP_FLAG']),
  numberColumn('SVB Load on Ass. Value %', '_svbVal', ['SVB_LOAD_ON_ASSVAL']), numberColumn('SVB Load on Duty %', '_svbDuty', ['SVB_LOAD_ON_DUTY']),
  numberColumn('Std Qty (CHR/SQC)', 'sqcQty', ['CTH_UQC_QUANTITY', 'Standard Qty']), upperColumn('Std UQC (CHR/SQC)', 'sqcUqc', ['CTH_UQC', 'Standard UQC']),
  textColumn('SIMS Info Code', '_simsCode', ['SIMS_INFO_CODE']), textColumn('SIMS Info Text', '_simsText', ['SIMS_INFO_TEXT']),
  upperColumn('COO Cert Issuing Country', '_cooCode', ['COO_INFO_CODE']), textColumn('COO Cert No|Date (ddmmyyyy)', '_cooText', ['COO_INFO_TEXT']), upperColumn('Accumulation ACM (Y/N)', '_acm', ['ACM_INFO_CODE']),
  upperColumn('RIS (Y/N)', '_ris', ['RIS_INFO_CODE']), upperColumn('DC (Y/N)', '_dc', ['DC_INFO_CODE']),
  upperColumn('Origin Criteria (COWO/CONWO)', '_orgQual', ['COWO_CONWO_INFO_QUALIFIER', 'COWO_CONWO_INFO_QUAL']), upperColumn('Origin Rule Code (COOG/COOP)', '_orgCode', ['COWO_CONWO_INFO_CODE']), textColumn('Origin Rule Text', '_orgText', ['COWO_CONWO_INFO_TEXT']), upperColumn('Origin Rule UQC', '_orgUqc', ['COWO_CONWO_INFO_UQC']),
  textColumn('Policy Para No', '_ppNo', ['POLICY_PARA_NO']), textColumn('Policy Year', '_ppYear', ['POLICY_YEAR']),
  textColumn('Prev BE No', '_pbNo', ['PREVIOUS_BE_NO']), dateColumn('Prev BE Date', '_pbDate', ['PREVIOUS_BE_DT']), numberColumn('Prev BE Unit Price', '_pbPrice', ['PREV_UNIT_PRICE']), upperColumn('Prev BE Currency', '_pbCur', ['PREV_CURRENCY']), upperColumn('Prev BE Custom House', '_pbCh', ['PREV_CUSTOM_SITE']),
];

export const CONT_COLS = [
  textColumn('Sr No', 'srNo', ['NO']), textColumn('IGM No', 'igmNumber', ['IGM_NO', 'IGM Number']), dateColumn('IGM Date', 'igmDate', ['IGM_DT']), upperColumn('LCL/FCL', 'lclFcl', ['LCFC', 'LCL FCL']),
  upperColumn('Container No', 'contNo', ['CONT_NO', 'Container Number']), textColumn('Seal No', 'sealNo', ['SEAL_NO']), textColumn('Size (20/40/45)', 'contSize', ['CONT_SIZE', 'Container Size']), textColumn('Type', 'contType', ['CONT_TYPE']),
  upperColumn('Truck No', 'truckNo', ['TRUCK_NO']), textColumn('Location Id', 'locationId', ['LOCATION_ID']),
];
// our SW / doc sheets name the invoice ("Inv No" = INV-001); the other ERP's INV_NO / INV_SR_NO is the invoice serial no -
// invoiceSrOf() takes a number that is not an Invoice No on the job as the serial no
const ITEM_KEY = [textColumn('Inv No', 'invNo', ['Invoice No']), textColumn('Inv Sr No', 'invSrNo', ['INV_SR_NO', 'Invoice Sr No']), textColumn('Item Sr. No', 'itemSrNo', ['ITEM_SR_NO', 'ITEM_NO', 'Item Sr No', 'Item No'])];
export const SW_COLS = {
  SW_InfoType: [...ITEM_KEY, upperColumn('InfoType', 'type', ['INFO_TYPE', 'Info Type']), upperColumn('Qualifier', 'qualifier', ['INFO_QUALIFIER']), textColumn('Info Code', 'code', ['INFO_CODE']), textColumn('Info Text', 'text', ['INFO_TEXT']), numberColumn('Qty', 'qty', ['INFO_MSR', 'Measure']), upperColumn('UQC', 'uqc', ['INFO_UQC'])],
  SW_Statement: [...ITEM_KEY, upperColumn('Statement Type', 'typeCode', ['TYPE']), upperColumn('Statement Code', 'stmtCode', ['CODE']), textColumn('Statement Text', 'stmtText', ['TEXT'])],
  SW_Constituent: [...ITEM_KEY, textColumn('Sr No', 'srNo', ['CONST_SRNO']), textColumn('Element Name', 'name', ['CONST_ELEMENT_NM']), textColumn('Element Code', 'code', ['CONST_ELEMENT_CODE']), numberColumn('Percentage', 'percent', ['CONST_PERCENTAGE']), numberColumn('Yield', 'yield', ['CONST_YIELD_PERCENTAGE']), flagColumn('Active Ingredient', 'active', ['ACTIVE_INGREDIENT'])],
  SW_Production: [...ITEM_KEY, textColumn('Batch No', 'batch', ['BATCH_ID', 'Producer Name']), numberColumn('Batch Qty', 'qty', ['BATCH_QUANTITY']), upperColumn('UQC', 'uqc', ['BATCH_UNIT']), dateColumn('Mfg Date', 'mnfDate', ['MANUFACTURER_DATE']), dateColumn('Expiry Date', 'expDate', ['EXPIRY_DATE']), dateColumn('Best Before', 'bestBefore', ['BEST_BEFORE_DATE'])],
  SW_Control: [...ITEM_KEY, upperColumn('Control Type', 'typeCode', ['CONTROL_TYPE']), textColumn('Control Location', 'location', ['CONTROL_LOCATION']), dateColumn('Start Date', 'startDate', ['START_DATE']), dateColumn('End Date', 'endDate', ['END_DATE']), textColumn('Result Code', 'resultCode', ['RESULT_CODE', 'Result']), textColumn('Result Text', 'resultText', ['RESULT_TEXT']),
    // the control serial an ex-bond (X) BE files (the warehouse BE's: 2, 3 ...); empty = 1, 2, 3 per item
    textColumn('Control Sr No', 'slNo', ['CONTROL_SL_NO', 'CONTROL_SR_NO', 'CTRL_SLNO', 'CTRL_SL_NO', 'Control Sl No'])],
};
export const DOC_COLS = [...ITEM_KEY, upperColumn('File Type', 'fileType', ['FILE_TYPE']), textColumn('ICEGATE Id', 'icegateId', ['ICEGATEID']), textColumn('IRN', 'irn', ['Image Reference No']), textColumn('Doc Type Code', 'docCode', ['DOC_TYPE_CODE', 'Document Code']), textColumn('DRN', 'drn'),
  textColumn('Place of Issue', 'placeOfIssue', ['DOC_ISSUED_PLACE']), dateColumn('Issue Date', 'issueDate', ['DOC_ISSUED_DATE']), dateColumn('Expiry Date', 'expiryDate', ['DOC_EXPIRY_DATE']),
  textColumn('Issuer Name', 'issuerName', ['DOC_ISSUING_PARTY_NAME']), textColumn('Issuer Code', 'issuerCode', ['DOC_ISSUING_PARTY_CODE']), textColumn('Issuer Address 1', 'issuerAddr1', ['DOC_ISSUING_PARTY_ADD1']), textColumn('Issuer Address 2', 'issuerAddr2', ['DOC_ISSUING_PARTY_ADD2']),
  textColumn('Issuer City', 'issuerCity', ['DOC_ISSUING_PARTY_CITY']), textColumn('Issuer Pin', 'issuerPin', ['DOC_ISSUING_PARTY_PIN_CODE', 'DOC_ISSUING_PARTY_PIN']),
  textColumn('Beneficiary Name', 'beneName', ['DOC_BENEFICIARY_PARTY_NAME']), textColumn('Beneficiary Code', 'beneCode', ['DOC_BENEFICIARY_PARTY_CODE']), textColumn('Beneficiary Address 1', 'beneAddr1', ['DOC_BENEFICIARY_PARTY_ADD1']),
  textColumn('Beneficiary Address 2', 'beneAddr2', ['DOC_BENEFICIARY_PARTY_ADD2']), textColumn('Beneficiary City', 'beneCity', ['DOC_BENEFICIARY_PARTY_CITY']), textColumn('Beneficiary Pin', 'benePin', ['DOC_BENEFICIARY_PARTY_PIN_CODE', 'DOC_BENEFICIARY_PARTY_PIN'])];
export const SVB_COLS = [...ITEM_KEY, flagColumn('Save In All (Y/N)', 'saveInAll', ['SAVE_IN_ALL']), textColumn('Reference No', 'refNo', ['REFERENCE_NO']), dateColumn('Reference Date', 'date', ['REFERENCE_DATE']), upperColumn('Custom House', 'customHouse', ['CUSTOMHOUSE_CODE']),
  upperColumn('Load On (A/D/B)', 'loadType', ['SVB_LOAD_ON']), numberColumn('Load on Ass. Value %', 'loadValue', ['ASSESSABLE_VALUE']), upperColumn('Value Load Status (P/F)', 'valueStatus', ['ASSESSABLE_LOAD_STAT', 'ASSESSABLE_LOAD_STATUS']),
  numberColumn('Load on Duty %', 'loadDuty', ['DUTY']), upperColumn('Duty Load Status (P/F)', 'dutyStatus', ['DUTY_LOAD_STATUS'])];
export const LIC_COLS = [...ITEM_KEY, upperColumn('Scheme Code', 'licenceCode', ['SCHEME_CODE', 'Licence Code']), textColumn('Scheme Notn', 'exemptionNotn', ['SCHEME_NOTN_NO']), textColumn('Scheme Notn Sr No', 'exemptionSrNo', ['SCHEME_NOTN_SLNO']), flagColumn('Exemption Flag (Y/N)', 'exemptionFlag', ['EXEMPTION_FLAG']),
  textColumn('Licence URN', 'licUrn', ['LIC_URN']), textColumn('Licence No', 'licenceNoRaw', ['LICENSE_NO', 'LICENCE_NO']), dateColumn('Licence Date', 'licenceDateRaw', ['LICENSE_DATE', 'LICENCE_DATE']), textColumn('Registration No', 'licenceNo', ['REGITRATION_NO', 'REGISTRATION_NO']),
  dateColumn('Registration Date', 'licenceDate', ['REGITRATION_DATE', 'REGISTRATION_DATE']), upperColumn('Registration Port', 'regnPort', ['REGITRATION_PORT', 'REGISTRATION_PORT']), textColumn('Licence Item Sr No', 'itemSrNoLicence', ['LICENSE_SR_NO', 'LICENCE_SR_NO']),
  numberColumn('Debit Value (CIF)', 'debitValue', ['CIF_VALUE', 'DEBIT_VALUE']), numberColumn('Debit Duty', 'debitDuty', ['DEBIT_DUTY']), numberColumn('Debit Qty', 'debitQty', ['DEBIT_QUANTITY']), upperColumn('Debit UQC', 'debitUqc', ['DEBIT_QUANTITY_UNIT', 'DEBIT_UQC'])];
export const ADD_COLS = [...ITEM_KEY, flagColumn('Remove (Y/N)', 'isRemove', ['IsRemove']), textColumn('Antidumping Type', 'type', ['Antidumping_Type']), textColumn('Notification No', 'notnNo', ['Notification_No']), textColumn('Notification Sr No', 'srNo', ['Notification_Sr_No']),
  textColumn('CTH Serial No', 'cth', ['CTH_Serial_No']), numberColumn('Quantity', 'qty', ['Quantity']), upperColumn('UQC', 'uqc'), textColumn('Supplier Sl No', 'supSlNo', ['Supplier_Sl_No']), flagColumn('Different Currency (Y/N)', 'flag', ['IsDifferentFlag']), upperColumn('Currency', 'currency', ['IfDifferentCurrency']),
  numberColumn('Rate', 'rate'), numberColumn('Amount', 'amount')];

export const SHEET_COLS = { Invoices: INV_COLS, Items: ITEM_COLS, Containers: CONT_COLS, ...SW_COLS, Supporting_Docs: DOC_COLS, Item_SVB: SVB_COLS, Licence: LIC_COLS, Antidumping: ADD_COLS };
// ex-bond (BE type X): the Items grid's "WH Bal" (quantity still in the warehouse) and "Left" (WH Bal less this
// ex-bond's quantity), just after Quantity. Read File takes WH Bal; Left is always worked out, never read.
export const EXBOND_ITEM_COLS = [
  textColumn('WH Bal', '_whBalanceQty', ['WH Balance', 'WH_BAL', 'Warehouse Balance']),
  textColumn('Left', '_whLeft', ['WH Left', 'Balance Left']),
];
export function itemColumnsFor(exBond) {
  if (!exBond) return ITEM_COLS;
  const afterQty = ITEM_COLS.findIndex((column) => column.k === 'qty') + 1;
  return [...ITEM_COLS.slice(0, afterQty), ...EXBOND_ITEM_COLS, ...ITEM_COLS.slice(afterQty)];
}
const SAMPLE_WH_BALANCES = [150, 20, 5];
const withWarehouseBalance = (sample, index) => {
  const balance = SAMPLE_WH_BALANCES[index] ?? sample.qty;
  return { ...sample, _whBalanceQty: balance, _whLeft: balance - (parseFloat(sample.qty) || 0) };
};

// sample rows (our headers' order) - dummy data only
const SAMPLE = {
  Invoices: [
    Object.assign(blankRow(INV_COLS), { invNo: 'INV-001', invDate: '2026-10-10', currency: 'USD', value: 15500, terms: 'FOB', freightValue: 100, freightCurrency: 'USD', insuranceRate: 1.125, supplierName: '[Supplier A]', supplierAddress1: 'Street 1', supplierAddress2: 'City', supplierCountry: 'CN', whetherBuyerAndSellerAreRelated: 'N', natureOfTransaction: 'O', valuationMethod: 'Rule4 Transaction Value', paymentTerms: 'OTH' }),
    Object.assign(blankRow(INV_COLS), { invNo: 'INV-002', invDate: '2026-10-11', currency: 'EUR', value: 2000, terms: 'CIF', miscCharges: 20, miscCurrency: 'EUR', supplierName: '[Supplier B]', supplierAddress1: 'Street 2', supplierAddress2: 'City', supplierCountry: 'DE', whetherBuyerAndSellerAreRelated: 'N', natureOfTransaction: 'O', valuationMethod: 'Rule4 Transaction Value', paymentTerms: 'OTH' }),
  ],
  Items: [
    Object.assign(blankRow(ITEM_COLS), { invNo: 'INV-001', invSrNo: 1, itemSrNo: 1, ritc: '85171300', cth: '85171300', ceth: 'NOEXCISE', desc: 'MOBILE PHONE MODEL X 128GB', genericDesc: 'MOBILE PHONE', qty: 100, unit: 'NOS', price: 150, value: 15000, countryOfOrigin: 'CN', manufacturer: '[Manufacturer A]', brandName: 'BRAND A', model: 'X-128', endUse: 'GNX200', accessoryStatus: 0, rateTypeFlag: 'S', bcdNotificationNo: '050/2017', bcdSrNo: '1', bcdRate: 20, swsRate: 10, _igstNotn: '009/2025', _igstSr: 'II506', _igstRate: 18, _aidcNotn: '011/2021', _aidcSr: '17', _aidcFlag: 'A', sqcQty: 12.5, sqcUqc: 'KGS' }),
    Object.assign(blankRow(ITEM_COLS), { invNo: 'INV-001', invSrNo: 1, itemSrNo: 2, ritc: '85176290', cth: '85176290', ceth: 'NOEXCISE', desc: 'WIFI ROUTER', genericDesc: 'ROUTER', qty: 20, unit: 'NOS', price: 25, value: 500, countryOfOrigin: 'CN', manufacturer: '[Manufacturer A]', brandName: 'BRAND A', model: 'R-1', endUse: 'GNX200', accessoryStatus: 0, rateTypeFlag: 'S', bcdRate: 20, swsRate: 10, _igstNotn: '009/2025', _igstSr: 'II506', _igstRate: 18, _aidcNotn: '011/2021', _aidcSr: '17', _aidcFlag: 'A', sqcQty: 4, sqcUqc: 'KGS' }),
    Object.assign(blankRow(ITEM_COLS), { invNo: 'INV-002', invSrNo: 2, itemSrNo: 1, ritc: '84713010', cth: '84713010', ceth: 'NOEXCISE', desc: 'LAPTOP 14 INCH', genericDesc: 'LAPTOP', qty: 2, unit: 'NOS', price: 1000, value: 2000, countryOfOrigin: 'DE', manufacturer: '[Manufacturer B]', brandName: 'BRAND B', model: 'L-14', endUse: 'GNX200', accessoryStatus: 0, rateTypeFlag: 'S', bcdRate: 0, swsRate: 10, _igstNotn: '009/2025', _igstSr: 'II506', _igstRate: 18, sqcQty: 3, sqcUqc: 'KGS' }),
  ],
  Containers: [{ srNo: 1, igmNumber: '2345678', igmDate: '2026-10-08', lclFcl: 'FCL', contNo: 'ABCU1234567', sealNo: '15998141', contSize: '40', contType: 'DRY', truckNo: '' }],
  SW_InfoType: [{ invNo: 'INV-001', invSrNo: 1, itemSrNo: 1, type: 'CTG', qualifier: 'CPC', code: 'CPCPR', text: '', qty: '', uqc: '' }],
  SW_Statement: [{ invNo: 'INV-001', invSrNo: 1, itemSrNo: 1, typeCode: 'DEC', stmtCode: 'PC002', stmtText: '' }],
  SW_Constituent: [], SW_Production: [], SW_Control: [],
  Supporting_Docs: [
    { invNo: '', invSrNo: 0, itemSrNo: 0, fileType: 'PDF', icegateId: '', irn: '2026102800012345', docCode: '703000', drn: '', placeOfIssue: 'CHINA', issueDate: '2026-10-05', issuerName: '[Supplier A]', issuerAddr1: 'Street 1', issuerCity: 'City', beneName: '[Importer]', beneAddr1: 'Plot 1', beneCity: 'New Delhi', benePin: '110001' },
    { invNo: 'INV-001', invSrNo: 1, itemSrNo: 0, fileType: 'PDF', icegateId: '', irn: '2026102800012346', docCode: '380000', drn: '', placeOfIssue: 'CHINA', issueDate: '2026-10-10', issuerName: '[Supplier A]', issuerAddr1: 'Street 1', issuerCity: 'City', beneName: '[Importer]', beneAddr1: 'Plot 1', beneCity: 'New Delhi', benePin: '110001' },
  ],
  Item_SVB: [], Licence: [], Antidumping: [],
};

// ---------------------------------------------------------------------------------------------------------------
// template / sample downloads
const sampleRows = (sheetName, columns, exBond) => (SAMPLE[sheetName] || [])
  .map((sample, index) => (exBond && sheetName === 'Items' ? withWarehouseBalance(sample, index) : sample))
  .map((sample) => columns.map((column) => sample[column.k] ?? ''));
const headerRow = (columns) => columns.map((column) => column.h);

// exBond: the Items sheet also has the WH Bal / Left columns of an ex-bond job
export function downloadJobWorkbook(withSample, only, { exBond = false } = {}) {
  const workbook = XLSX.utils.book_new();
  Object.entries(SHEET_COLS).forEach(([sheetName, sheetColumns]) => {
    if (only && !only.includes(sheetName)) return;
    const columns = sheetName === 'Items' ? itemColumnsFor(exBond) : sheetColumns;
    const rows = withSample ? sampleRows(sheetName, columns, exBond) : [];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headerRow(columns), ...rows]), sheetName);
  });
  const baseName = only && only.length === 1 ? ({ Invoices: 'Invoice', Items: 'Item' })[only[0]] || only[0] : 'Job';
  XLSX.writeFile(workbook, `Import_${exBond ? 'ExBond_' : ''}${baseName}_Upload_${withSample ? 'Sample' : 'Template'}.xlsx`);
}
export const downloadInvoiceSample = () => downloadJobWorkbook(true, ['Invoices']);
export const downloadItemWorkbook = (withSample, options) => downloadJobWorkbook(withSample, undefined, options);
export function downloadItemCsv() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headerRow(ITEM_COLS), ...sampleRows('Items', ITEM_COLS)]), 'Items');
  XLSX.writeFile(workbook, 'Item_Upload_Sample.csv', { bookType: 'csv' });
}

// ---------------------------------------------------------------------------------------------------------------
// reader
const sheetRows = (workbook, name) => {
  const wanted = (SHEET_NAMES[name] || [name]).map(normalizeHeader);
  const sheetName = workbook.SheetNames.find((candidate) => wanted.includes(normalizeHeader(candidate)))
    || workbook.SheetNames.find((candidate) => wanted.some((wantedName) => normalizeHeader(candidate).includes(wantedName)));
  return sheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }).filter(rowHasValue) : [];
};
const readRow = (row, columns) => Object.fromEntries(columns.map((column) => [column.k, readColumn(row, column)]));
const readWorkbook = (arrayBuffer) => XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

// SW_Control rows of one item from a workbook (Single Window Control popup "Excel" button). Rows naming another item
// are left out; a sheet without Inv / Item Sr No columns gives all its rows to this item.
export function readControlRowsFor(arrayBuffer, invoices = [], item = {}) {
  const rows = sheetRows(readWorkbook(arrayBuffer), 'SW_Control');
  const invoiceKeys = (invoices || []).map((invoice) => invoiceKey(invoice.invNo || invoice.invoiceNo));
  const ownInvoiceSr = serialText(item.invSrNo || '1');
  const ownItemSr = serialText(item.itemSrNo ?? item.itemNo);
  let other = 0;
  const controlRows = [];
  rows.forEach((row, index) => {
    const values = readRow(row, SHEET_COLS.SW_Control);
    if (!cellText(values.typeCode)) return;
    const invoiceNo = invoiceKey(values.invNo);
    const invoiceSr = invoiceNo && invoiceKeys.includes(invoiceNo) ? String(invoiceKeys.indexOf(invoiceNo) + 1) : serialText(values.invSrNo || (/^\d+$/.test(invoiceNo) ? invoiceNo : ''));
    const itemSr = serialText(values.itemSrNo);
    if ((itemSr && itemSr !== ownItemSr) || (invoiceSr && itemSr && invoiceSr !== ownInvoiceSr)) { other++; return; }
    controlRows.push({
      id: Date.now() + index, typeCode: String(values.typeCode).toUpperCase().replace(/\s/g, ''), location: cellText(values.location), startDate: values.startDate, endDate: values.endDate,
      resultCode: cellText(values.resultCode), resultText: cellText(values.resultText), slNo: serialText(values.slNo),
    });
  });
  return { rows: controlRows, other, total: rows.length };
}

const svbLoadType = (loadValue, loadDuty) => (loadValue && loadDuty ? 'B' : (loadValue ? 'A' : (loadDuty ? 'D' : '')));
const STATEMENT_TYPES = { DECLARATION: 'DEC', UNDERTAKING: 'UTG', REMARK: 'REM' };
const ATTACHED_SHEETS = ['SW_InfoType', 'SW_Constituent', 'SW_Production', 'SW_Control', 'Licence', 'Item_SVB', 'Antidumping', 'Supporting_Docs', 'SW_Statement'];

// Single Window info rows typed on the item line: SIMS registration, certificate of origin (CAROTAR) particulars
const itemLineInfoRows = (values) => {
  const infoRow = (type, qualifier, code, text = '', uqc = '') => ({ agency: 'ALL', type, qualifier, code, text, qty: '', uqc });
  const rows = [];
  if (values._simsCode || values._simsText) rows.push(infoRow('PNM', 'SIU', cellText(values._simsCode), cellText(values._simsText)));
  if (values._cooCode || values._cooText) rows.push(infoRow('ORC', 'COO', values._cooCode, cellText(values._cooText)));
  if (values._orgQual === 'COWO') rows.push(infoRow('ORC', 'ORG', 'COWO'));
  else if (values._orgQual || values._orgCode) rows.push(infoRow('ORC', 'ORG', values._orgCode || 'COOG', cellText(values._orgText), values._orgUqc));
  if (values._acm) rows.push(infoRow('ORC', 'ACM', values._acm));
  if (values._ris) rows.push(infoRow('ORC', 'RIS', values._ris));
  if (values._dc) rows.push(infoRow('ORC', 'DC', values._dc));
  return rows;
};

// one Items sheet row as an item (screen field names + popup objects)
const itemFromRow = (values, index, { invSrNo, itemSrNo, ritc, invNo }) => {
  const qty = cellText(values.qty);
  const price = cellText(values.price);
  const item = {
    id: newId(index), invNo, invSrNo, itemSrNo, itemNo: itemSrNo,
    ritc, hsCode: ritc, cth: cellText(values.cth).replace(/\D/g, '') || ritc, ceth: values.ceth || 'NOEXCISE',
    desc: values.desc, productDescription: values.desc, genericDesc: values.genericDesc, descOnlyInChecklist: values.descOnlyInChecklist,
    qty, quantity: qty, unit: values.unit, uqc: values.unit, price, unitPrice: price,
    value: cellAmount(values.value) || (qty && price ? (parseFloat(qty) * parseFloat(price)).toFixed(2) : ''),
    countryOfOrigin: values.countryOfOrigin, manufacturer: values.manufacturer, brandName: values.brandName, model: values.model, endUse: values.endUse,
    accessoryStatus: cellText(values.accessoryStatus) || '0', accessories: values.accessories, itemCategory: values.itemCategory, rateTypeFlag: values.rateTypeFlag || 'S',
    bcdNotificationNo: values.bcdNotificationNo, bcdSrNo: values.bcdSrNo, bcdRate: values.bcdRate, swsNotificationNo: values.swsNotificationNo, swsSrNo: values.swsSrNo, swsRate: values.swsRate || '10', swsFlag: 'A',
    saptaNotificationNo: values.saptaNotificationNo, saptaSrNo: values.saptaSrNo, healthCessNotificationNo: values.healthCessNotificationNo, healthCessSrNo: values.healthCessSrNo,
    cvdNotificationNo: values.cvdNotificationNo, cvdSrNo: values.cvdSrNo, adlCvdNotificationNo: values.adlCvdNotificationNo, adlCvdSrNo: values.adlCvdSrNo,
    additionalNotification1: values.additionalNotification1, additionalNotification1SrNo: values.additionalNotification1SrNo, additionalNotification2: values.additionalNotification2, additionalNotification2SrNo: values.additionalNotification2SrNo,
    otherNotification: values.otherNotification, otherNotificationSrNo: values.otherNotificationSrNo,
    itemManufacturerType: values.itemManufacturerType, itemManufacturerCode: values.itemManufacturerCode, itemManufacturerAddress1: values.itemManufacturerAddress1, itemManufacturerAddress2: values.itemManufacturerAddress2,
    itemManufacturerCity: values.itemManufacturerCity, itemManufacturerSubdivision: values.itemManufacturerSubdivision, itemManufacturerPin: values.itemManufacturerPin, itemManufacturerCountry: values.itemManufacturerCountry,
    sourceCountry: values.sourceCountry, transitCountry: values.transitCountry, sqcQty: values.sqcQty, sqcUqc: values.sqcUqc, foc: 'N',
    igstData: null, dutyRows: null, otherDutyData: null, svbData: null, licenceData: null, depbData: null, reimportData: null, rspData: null, policyParaData: null, prevBeData: null, addData: null,
    swInfoData: null, swStmtData: null, swConstData: null, swProdData: null, swCtrlData: null, docsData: null,
  };
  // duty notification rows (SBEDUTY): IGST G/I, GST compensation cess G/P, AIDC C/A
  const dutyRows = [];
  if (values._igstNotn) {
    dutyRows.push({ dutyType: 'G', addlDutyFlag: 'I', igstFlag: values._igstFlag, notificationNo: values._igstNotn, notificationSrNo: values._igstSr, exmpNotificationNo: values._igstExNotn, exmpNotificationSrNo: values._igstExSr });
    item.igstData = { notnNo: values._igstNotn, srNo: values._igstSr, rate: values._igstRate, flag: 'A', amount: '', exmpNotnNo: values._igstExNotn, exmpSrNo: values._igstExSr };
    item.igstDutyFlag = 'Y';
  } else if (values._igstRate) {
    item.igstData = { notnNo: '', srNo: '', rate: values._igstRate, flag: 'A', amount: '' };
    item.igstDutyFlag = 'Y';
  }
  if (values._cessNotn) dutyRows.push({ dutyType: 'G', addlDutyFlag: 'P', igstFlag: values._cessFlag, notificationNo: values._cessNotn, notificationSrNo: values._cessSr, exmpNotificationNo: values._cessExNotn, exmpNotificationSrNo: values._cessExSr });
  // AIDC: duty type C (the other ERP's AIDC_DUTY_FG), additional duty flag A - as in every filed BE
  if (values._aidcNotn) {
    dutyRows.push({ dutyType: /^G/.test(values._aidcFlag) ? 'G' : 'C', addlDutyFlag: 'A', igstFlag: '', notificationNo: values._aidcNotn, notificationSrNo: values._aidcSr, exmpNotificationNo: '', exmpNotificationSrNo: '' });
    item.otherDutyData = { 'Infra Cess_notnNo': values._aidcNotn, 'Infra Cess_srNo': values._aidcSr };
    item.otherDutyFlag = 'Y';
  }
  if (dutyRows.length) { item.dutyRows = dutyRows; item.igstDutyFlag = 'Y'; }
  // licence / scheme (DEPB) typed on the item line
  if (values._licNo || values._schemeCode) {
    const exempted = values._exemptionFlag === 'Y';
    item.licenceData = [{
      id: newId(index), licenceNo: cellText(values._licNo), licenceDate: values._licDate, licenceCode: values._schemeCode, regnPort: values._licPort, itemSrNoLicence: cellText(values._licItemSr),
      debitValue: '', debitQty: '', debitUqc: '', licUrn: values._licUrn, exemptionNotn: exempted ? values._schemeNotn : '', exemptionSrNo: exempted ? values._schemeSr : '',
    }];
    item.licenceFlag = 'Y';
    // no invented Sr No "1" when the file gives none (the filing validator asks for it)
    if (exempted && values._schemeNotn) item.depbData = [{ whetherExemption: 'Y', bcdNotification: values._schemeNotn, bcdNotificationSrNo: values._schemeSr || '' }];
  }
  // re-import (previous shipping bill)
  if (values._sbNo) {
    item.reimportData = {
      type: 'Y', shippingBillNo: cellText(values._sbNo), shippingBillDate: values._sbDate, portOfExport: values._sbPort, invoiceNoSb: cellText(values._sbInv), itemNoSb: cellText(values._sbItem),
      notificationNo: values._reNotn, notificationSrNo: values._reSr, exportFreight: values._sbFrt, exportInsurance: values._sbIns, customsDuty: values._sbCus, exciseDuty: values._sbExc,
    };
    item.whetherReimport = 'Y';
    item.reImportFlag = 'Y';
  }
  if (values._rspAmt) { item.rspData = { rspValue: values._rspAmt, rspAmount: values._rspAmt }; item.rspDutyFlag = values._rspFlag || 'Y'; }
  else if (values._rspFlag) item.rspDutyFlag = values._rspFlag;
  if (values._svbVal || values._svbDuty) {
    item.svbData = { refNo: '', date: '', loadType: svbLoadType(values._svbVal, values._svbDuty), loadValue: values._svbVal, loadDuty: values._svbDuty, valueStatus: '', dutyStatus: '', customHouse: '' };
    item.svbFlag = 'Y';
  }
  if (values._ppNo || values._ppYear) { item.policyParaData = { paraNo: cellText(values._ppNo), year: cellText(values._ppYear) }; item.policyParaFlag = 'Y'; }
  if (values._pbNo) { item.prevBeData = { beNo: cellText(values._pbNo), beDate: values._pbDate, unitPrice: values._pbPrice, currency: values._pbCur, customHouse: values._pbCh }; item.previousBeFlag = 'Y'; }
  const infoRows = itemLineInfoRows(values);
  if (infoRows.length) { item.swInfoData = infoRows.map((row, rowIndex) => ({ id: newId(rowIndex), ...row })); item.swInfotypeFlag = 'Y'; }
  return item;
};

/**
 * Read a job workbook. invoices = the job's current invoices (Inv No -> Sr No; new ones from the file are appended).
 * existingItems = the job's items: a file with SW / licence / SVB / doc sheets but no Items sheet adds its rows to
 * these (ex-bond BE: items entered first, the warehouse BE's controls uploaded after) - returned as itemsOnJob.
 * Returns { invoices, items, containers, jobDocs, statements, warnings, found, itemsOnJob }:
 *  - invoices: rows read from the Invoices sheet (screen field names), in file order
 *  - items: item objects (screen field names + popup objects: igstData / dutyRows / otherDutyData / svbData / licenceData /
 *           depbData / reimportData / rspData / policyParaData / prevBeData / addData / swInfoData / swStmtData / swConstData /
 *           swProdData / swCtrlData / docsData) ready for setItems
 *  - containers: jobData.containers rows; jobDocs: BE / invoice level e-Sanchit rows (tab 5 shape); statements: BE / invoice
 *    level statement rows (jobData._statements shape)
 */
export function readJobWorkbook(arrayBuffer, invoices = [], startSrByInv = {}, existingItems = []) {
  const workbook = readWorkbook(arrayBuffer);
  const warnings = [];
  const found = {};

  // ---- invoices
  const fileInvoices = [];
  sheetRows(workbook, 'Invoices').forEach((row, index) => {
    const values = readRow(row, INV_COLS);
    const where = `Invoices row ${index + 2}`;
    if (!values.invNo) { warnings.push(`${where}: no Invoice No - skipped`); return; }
    // the same Invoice No twice in the sheet = one invoice; the first row is kept
    if (fileInvoices.some((invoice) => invoiceKey(invoice.invNo) === invoiceKey(values.invNo))) { warnings.push(`${where}: Invoice No "${values.invNo}" is repeated - the first row is used`); return; }
    if (values.valuationMethod && /^rule\s*4$/i.test(values.valuationMethod)) values.valuationMethod = 'Rule4 Transaction Value';
    if (values.terms && !['CIF', 'FOB', 'CF', 'CI'].includes(values.terms)) warnings.push(`${values.invNo}: terms "${values.terms}" is not CIF/FOB/CF/CI`);
    if (!(parseFloat(values.value) > 0)) warnings.push(`${values.invNo}: invoice value missing`);
    // the other ERP's rate / amount columns both carry 0.0 when unused - cellAmount() already drops zeros
    Object.keys(values).forEach((key) => { if (values[key] === '') delete values[key]; });
    fileInvoices.push({ id: newId(index), ...values });
  });
  found.invoices = fileInvoices.length;

  // Inv No -> Sr No over the job's invoices followed by the file's new ones (file order)
  const allInvoices = [...(invoices || [])];
  fileInvoices.forEach((fileInvoice) => {
    if (!allInvoices.some((invoice) => invoiceKey(invoice.invNo || invoice.invoiceNo) === invoiceKey(fileInvoice.invNo))) allInvoices.push(fileInvoice);
  });
  const invoiceNoAt = (sr) => { const invoice = allInvoices[parseInt(sr, 10) - 1] || {}; return cellText(invoice.invNo || invoice.invoiceNo || ''); };
  const srByInvoiceNo = (invoiceNo) => { const index = allInvoices.findIndex((invoice) => invoiceKey(invoice.invNo || invoice.invoiceNo) === invoiceKey(invoiceNo)); return index >= 0 ? String(index + 1) : ''; };
  // a serial no in the file counts the file's own Invoices sheet (1 = its first invoice) when there is one; otherwise the job's invoices
  const srBySerial = (sr) => {
    if (!/^\d+$/.test(sr) || sr === '0') return '';
    if (!fileInvoices.length) return sr;
    const fileInvoice = fileInvoices[parseInt(sr, 10) - 1];
    return fileInvoice ? srByInvoiceNo(fileInvoice.invNo) || sr : sr;
  };
  const invoiceSrOf = (values, where) => {
    const invoiceNo = cellText(values.invNo);
    if (invoiceNo && srByInvoiceNo(invoiceNo)) return srByInvoiceNo(invoiceNo);
    const sr = srBySerial(serialText(values.invSrNo));
    if (sr) return sr;
    if (srBySerial(invoiceNo)) return srBySerial(invoiceNo); // INV_NO 1 = serial no
    if (invoiceNo) warnings.push(`${where}: invoice "${invoiceNo}" is not on this job - put under invoice 1`);
    return '1';
  };

  // ---- items
  const lastSrByInvoice = { ...startSrByInv };
  const items = [];
  sheetRows(workbook, 'Items').forEach((row, index) => {
    const values = readRow(row, ITEM_COLS);
    const ritc = cellText(values.ritc).replace(/\D/g, '');
    if (!ritc && !values.desc) return;
    const invSrNo = invoiceSrOf(values, `Items row ${index + 2}`);
    let itemSrNo = serialText(values.itemSrNo);
    if (!itemSrNo) { lastSrByInvoice[invSrNo] = (lastSrByInvoice[invSrNo] || 0) + 1; itemSrNo = String(lastSrByInvoice[invSrNo]); }
    else lastSrByInvoice[invSrNo] = Math.max(lastSrByInvoice[invSrNo] || 0, parseInt(itemSrNo, 10) || 0);
    if (ritc && ritc.length !== 8) warnings.push(`Items row ${index + 2}: RITC ${ritc} is not 8 digits`);
    const item = itemFromRow(values, index, { invSrNo, itemSrNo, ritc, invNo: cellText(values.invNo) || invoiceNoAt(invSrNo) });
    // an ex-bond file's WH Bal (0 is a real balance); a linked warehouse BE puts its own balance back on open / save
    const warehouseBalance = parseFloat(cellText(columnValue(row, EXBOND_ITEM_COLS[0])).replace(/,/g, ''));
    if (Number.isFinite(warehouseBalance)) item._whBalanceQty = warehouseBalance;
    items.push(item);
  });
  found.items = items.length;

  // ---- rows that attach to an item (SW sheets, item-level docs, SVB, licence, anti-dumping): to the file's own items,
  // or - no Items sheet - to the job's items (copies; the caller puts them back)
  const onJob = !items.length && Array.isArray(existingItems) && existingItems.length > 0;
  const targets = onJob ? existingItems.map((item) => ({ ...item })) : items;
  const findItem = (values, where) => {
    const itemSr = serialText(values.itemSrNo);
    const invoiceSr = (values.invNo || values.invSrNo) ? invoiceSrOf(values, where) : null;
    return targets.find((item) => serialText(item.itemSrNo ?? item.itemNo) === itemSr && (!invoiceSr || serialText(item.invSrNo || '1') === String(invoiceSr)));
  };
  const sameRow = (existing, added) => Object.keys(added).every((key) => key === 'id' || String(existing[key] ?? '').trim().toUpperCase() === String(added[key] ?? '').trim().toUpperCase());
  const attachRows = (sheetName, dataKey, flagName, toRow) => {
    let attached = 0;
    let duplicates = 0;
    sheetRows(workbook, sheetName).forEach((row, index) => {
      const values = readRow(row, SHEET_COLS[sheetName]);
      const item = findItem(values, `${sheetName} row ${index + 2}`);
      if (!item) { warnings.push(`${sheetName} row ${index + 2}: no matching item (Inv Sr No ${cellText(values.invSrNo) || cellText(values.invNo)} / Item Sr No ${cellText(values.itemSrNo)})`); return; }
      const newRow = toRow(values, item);
      if (!newRow) return;
      const existingRows = parseList(item[dataKey]);
      if (onJob && existingRows.some((existing) => sameRow(existing, newRow))) { duplicates++; return; } // the same row uploaded again
      item[dataKey] = [...existingRows, { id: newId(index), ...newRow }];
      if (flagName) item[flagName] = 'Y';
      attached++;
    });
    if (attached) found[sheetName] = attached;
    if (duplicates) warnings.push(`${sheetName}: ${duplicates} row(s) already on the item - skipped`);
  };
  attachRows('SW_InfoType', 'swInfoData', 'swInfotypeFlag', (values) => ({ agency: 'ALL', type: values.type, qualifier: values.qualifier, code: cellText(values.code), text: cellText(values.text), qty: values.qty, uqc: values.uqc }));
  // the active-ingredient flag is as typed, not assumed
  attachRows('SW_Constituent', 'swConstData', 'swConstituentFlag', (values) => ({ srNo: cellText(values.srNo), name: values.name, code: cellText(values.code), percent: values.percent, yield: values.yield, active: values.active || '' }));
  attachRows('SW_Production', 'swProdData', 'swProductionFlag', (values) => ({ batch: cellText(values.batch), qty: values.qty, uqc: values.uqc, mnfDate: values.mnfDate, expDate: values.expDate, bestBefore: values.bestBefore }));
  attachRows('SW_Control', 'swCtrlData', 'swControlFlag', (values) => ({ typeCode: values.typeCode, location: values.location, startDate: values.startDate, endDate: values.endDate, resultCode: cellText(values.resultCode), resultText: values.resultText, slNo: serialText(values.slNo) }));
  attachRows('Licence', 'licenceData', 'licenceFlag', (values, item) => {
    const exempted = values.exemptionFlag === 'Y';
    const licence = {
      licenceNo: cellText(values.licenceNo) || cellText(values.licenceNoRaw), licenceDate: values.licenceDate || values.licenceDateRaw, licenceCode: values.licenceCode, regnPort: values.regnPort,
      itemSrNoLicence: cellText(values.itemSrNoLicence), debitValue: values.debitValue, debitDuty: values.debitDuty, debitQty: values.debitQty, debitUqc: values.debitUqc, licUrn: cellText(values.licUrn),
      exemptionNotn: exempted ? cellText(values.exemptionNotn) : '', exemptionSrNo: exempted ? cellText(values.exemptionSrNo) : '',
    };
    if (exempted && values.exemptionNotn) {
      item.depbData = [...(Array.isArray(item.depbData) ? item.depbData : []), { whetherExemption: 'Y', bcdNotification: cellText(values.exemptionNotn), bcdNotificationSrNo: cellText(values.exemptionSrNo) || '' }];
    }
    return licence;
  });

  // one SVB block per item (last row wins); "Save In All" copies it to every item of that invoice
  let svbForAll = null;
  sheetRows(workbook, 'Item_SVB').forEach((row, index) => {
    const values = readRow(row, SVB_COLS);
    if (!values.refNo && !values.loadValue && !values.loadDuty) return;
    const item = findItem(values, `Item_SVB row ${index + 2}`);
    const svb = {
      refNo: cellText(values.refNo), date: values.date, customHouse: values.customHouse, customHouse1: values.customHouse, loadType: values.loadType || svbLoadType(values.loadValue, values.loadDuty),
      loadValue: values.loadValue, valueStatus: values.valueStatus, loadDuty: values.loadDuty, dutyStatus: values.dutyStatus,
    };
    if (!item) { warnings.push(`Item_SVB row ${index + 2}: no matching item`); return; }
    item.svbData = svb;
    item.svbFlag = 'Y';
    found.Item_SVB = (found.Item_SVB || 0) + 1;
    if (values.saveInAll === 'Y') svbForAll = { invoiceSr: item.invSrNo, svb };
  });
  if (svbForAll) targets.filter((item) => item.invSrNo === svbForAll.invoiceSr && !item.svbData).forEach((item) => { item.svbData = { ...svbForAll.svb }; item.svbFlag = 'Y'; });

  // the other ERP's "IsRemove" column marks a removal row; nothing is done with it
  sheetRows(workbook, 'Antidumping').forEach((row, index) => {
    const values = readRow(row, ADD_COLS);
    if (!values.notnNo) return;
    const item = findItem(values, `Antidumping row ${index + 2}`);
    if (!item) { warnings.push(`Antidumping row ${index + 2}: no matching item`); return; }
    const antiDumping = {
      type: cellText(values.type), notnNo: cellText(values.notnNo), srNo: cellText(values.srNo), cth: cellText(values.cth), qty: values.qty, uqc: values.uqc, supSlNo: cellText(values.supSlNo),
      flag: values.flag, currency: values.currency, rate: values.rate, amount: values.amount, currencyRate: '', difference: '',
    };
    item.addData = antiDumping;
    item.antiDumpingData = antiDumping;
    item.antiDumpingDutyFlag = 'Y';
    item.antiDumpingDutyNotification = antiDumping.notnNo;
    item.antiDumpingDutySerialNumber = antiDumping.srNo;
    item.cthSerialNumber = antiDumping.cth;
    item.supplierSerialNumber = antiDumping.supSlNo;
    item.quantityAsPerAntiDumpingNotn = antiDumping.qty;
    found.Antidumping = (found.Antidumping || 0) + 1;
  });

  // ---- statements: item rows to the item (swStmtData); BE (0/0) and invoice (inv/0) rows to the job
  const statements = [];
  sheetRows(workbook, 'SW_Statement').forEach((row, index) => {
    const values = readRow(row, SW_COLS.SW_Statement);
    if (!values.stmtCode) return;
    const where = `SW_Statement row ${index + 2}`;
    const itemSr = serialText(values.itemSrNo) || '0';
    const typeCode = STATEMENT_TYPES[values.typeCode] || values.typeCode || 'DEC';
    if (itemSr === '0') {
      const invoiceGiven = values.invNo || (cellText(values.invSrNo) && cellText(values.invSrNo) !== '0');
      statements.push({ invoiceSrNo: invoiceGiven ? invoiceSrOf(values, where) : '0', itemSrNo: '0', statementType: typeCode, statementCode: values.stmtCode, statementText: values.stmtText, declarationType: 'B' });
      return;
    }
    const item = findItem(values, where);
    if (!item) { warnings.push(`${where}: no matching item`); return; }
    item.swStmtData = [...(Array.isArray(item.swStmtData) ? item.swStmtData : []), { id: newId(index), typeCode, stmtCode: values.stmtCode, stmtText: values.stmtText, stmtFor: 'Item' }];
    item.swStatementFlag = 'Y';
    found.SW_Statement = (found.SW_Statement || 0) + 1;
  });
  if (statements.length) found.SW_Statement = (found.SW_Statement || 0) + statements.length;

  // ---- supporting (e-Sanchit) docs: item rows to the item popup, BE / invoice rows to tab 5
  const jobDocs = [];
  sheetRows(workbook, 'Supporting_Docs').forEach((row, index) => {
    const values = readRow(row, DOC_COLS);
    if (!values.irn && !values.docCode) return;
    const where = `Supporting_Docs row ${index + 2}`;
    // the other ERP's party columns may be named only by prefix (DOC_ISSUING_PARTY_... / DOC_BENEFICIARY_PARTY_...)
    const issuer = prefixValues(row, 'DOC_ISSUING_PARTY');
    if (issuer.length === 6) [values.issuerName, values.issuerCode, values.issuerAddr1, values.issuerAddr2, values.issuerCity, values.issuerPin] = issuer;
    const beneficiary = prefixValues(row, 'DOC_BENEFICIARY_PARTY');
    if (beneficiary.length === 6) [values.beneName, values.beneCode, values.beneAddr1, values.beneAddr2, values.beneCity, values.benePin] = beneficiary;
    const irn = cellText(values.irn);
    if (irn && !/^\d{16}$/.test(irn)) warnings.push(`${where}: IRN "${irn}" is not the 16-digit e-Sanchit number`);
    const itemSr = serialText(values.itemSrNo) || '0';
    const invoiceGiven = values.invNo || (cellText(values.invSrNo) && cellText(values.invSrNo) !== '0');
    const doc = {
      irn, drn: cellText(values.drn), docCode: cellText(values.docCode), docName: '', fileName: '', fileType: values.fileType || 'PDF',
      issuerCode: cellText(values.issuerCode), issuerName: values.issuerName, issuerAddr1: values.issuerAddr1, issuerAddr2: values.issuerAddr2, issuerCity: values.issuerCity, issuerPin: cellText(values.issuerPin),
      beneCode: cellText(values.beneCode), beneName: values.beneName, beneAddr1: values.beneAddr1, beneAddr2: values.beneAddr2, beneCity: values.beneCity, benePin: cellText(values.benePin),
      placeOfIssue: values.placeOfIssue, issueDate: values.issueDate, expiryDate: values.expiryDate,
      isDiffId: !!cellText(values.icegateId), icegateId: cellText(values.icegateId), isApplicable: true,
    };
    if (itemSr !== '0') {
      const item = findItem(values, where);
      if (!item) { warnings.push(`${where}: no matching item`); return; }
      item.docsData = [...(Array.isArray(item.docsData) ? item.docsData : []), { id: `doc-${Date.now()}-${index}`, ...doc, docFor: 'ITEM', invSrNo: item.invSrNo, itemSrNo: item.itemSrNo }];
      item.supportingDocsFlag = 'Y';
    } else if (invoiceGiven) {
      jobDocs.push({ id: `doc-${Date.now()}-${index}`, ...doc, docFor: 'INVOICE', invSrNo: invoiceSrOf(values, where), itemSrNo: '' });
    } else {
      jobDocs.push({ id: `doc-${Date.now()}-${index}`, ...doc, docFor: 'HEADER', invSrNo: '', itemSrNo: '' });
    }
    found.Supporting_Docs = (found.Supporting_Docs || 0) + 1;
  });

  // ---- containers
  const containers = [];
  sheetRows(workbook, 'Containers').forEach((row, index) => {
    const values = readRow(row, CONT_COLS);
    if (!values.contNo) return;
    const loadLetter = String(values.lclFcl || '').charAt(0);
    containers.push({
      id: newId(index), srNo: cellText(values.srNo) || String(containers.length + 1), igmNumber: cellText(values.igmNumber), igmDate: values.igmDate, contNo: values.contNo, sealNo: cellText(values.sealNo),
      lclFcl: loadLetter === 'F' ? 'FCL' : loadLetter === 'L' ? 'LCL' : '', contSize: serialText(values.contSize), contType: values.contType, truckNo: values.truckNo, locationId: cellText(values.locationId),
    });
  });
  if (containers.length) found.Containers = containers.length;

  const attachedToJobItems = onJob && Object.entries(found).some(([key, count]) => key !== 'items' && key !== 'Containers' && count);
  return { invoices: fileInvoices, items, containers, jobDocs, statements, warnings, found, itemsOnJob: attachedToJobItems ? targets : null };
}

/**
 * Merge what the file holds into the job: invoices matched on Invoice No (update) else added; items replaced or
 * appended (replace = true/false, asked by the caller); containers / tab-5 docs / job statements added when not there.
 * Returns { invoices, items, jobDataPatch, esanchitDocs, summary, notes } - nothing is set here (the two tabs keep their own state).
 */
export function mergeJobWorkbook(read, { invoices = [], items = [], jobData = {}, esanchitDocs = [], replaceItems = false }) {
  // "INV 1" and "inv1" are the same invoice
  const keyOfInvoice = (invoice) => invoiceKey(invoice.invNo || invoice.invoiceNo);
  let newInvoices = [...invoices];
  let invoicesAdded = 0;
  let invoicesUpdated = 0;
  read.invoices.forEach((fileInvoice) => {
    const { id, ...data } = fileInvoice;
    const at = newInvoices.findIndex((invoice) => keyOfInvoice(invoice) === keyOfInvoice(fileInvoice));
    if (at >= 0) { newInvoices = newInvoices.map((invoice, index) => (index === at ? { ...invoice, ...data } : invoice)); invoicesUpdated++; }
    else { newInvoices.push({ id, ...data }); invoicesAdded++; }
  });

  // items: same Inv Sr No + Item Sr No already on the job (append mode) -> next free number
  const keptItems = replaceItems ? [] : [...items];
  const notes = [];
  const readItems = read.items.map((item) => ({ ...item }));
  const clashing = readItems.filter((fileItem) => keptItems.some((jobItem) => String(jobItem.invSrNo) === String(fileItem.invSrNo) && String(jobItem.itemSrNo) === String(fileItem.itemSrNo)));
  if (clashing.length) {
    const nextSr = {};
    clashing.forEach((fileItem) => {
      const invoiceSr = String(fileItem.invSrNo);
      nextSr[invoiceSr] = Math.max(nextSr[invoiceSr] || 0, ...[...keptItems, ...readItems].filter((item) => String(item.invSrNo) === invoiceSr).map((item) => parseInt(item.itemSrNo, 10) || 0)) + 1;
      fileItem.itemSrNo = String(nextSr[invoiceSr]);
      fileItem.itemNo = fileItem.itemSrNo;
    });
    notes.push(clashing.length + ' item(s) renumbered because that Item Sr No already exists');
  }
  // item Inv No from the merged invoice list (the file gave only the Sr No)
  readItems.forEach((item) => { if (!item.invNo) item.invNo = cellText((newInvoices[parseInt(item.invSrNo, 10) - 1] || {}).invNo || ''); });
  const newItems = read.items.length ? [...keptItems, ...readItems] : (read.itemsOnJob || items);

  const jobDataPatch = {};
  if (read.containers.length) {
    const jobContainers = Array.isArray(jobData.containers) ? jobData.containers : [];
    const added = read.containers.filter((container) => !jobContainers.some((existing) => cellText(existing.contNo).toUpperCase() === cellText(container.contNo).toUpperCase()));
    jobDataPatch.containers = [...jobContainers, ...added];
    if (added.length < read.containers.length) notes.push((read.containers.length - added.length) + ' container(s) already on the job - skipped');
  }
  if (read.statements.length) {
    const jobStatements = parseList(jobData._statements);
    const statementKey = (statement) => [statement.invoiceSrNo || statement.invoiceSerialNumber || '0', statement.itemSrNo || statement.itemSerialNumber || '0', statement.statementType, statement.statementCode].join('|');
    const added = read.statements.filter((statement) => !jobStatements.some((existing) => statementKey(existing) === statementKey(statement)));
    if (added.length) jobDataPatch._statements = [...jobStatements, ...added];
  }
  let newDocs = Array.isArray(esanchitDocs) ? esanchitDocs : [];
  if (read.jobDocs.length) {
    const added = read.jobDocs.filter((doc) => !doc.irn || !newDocs.some((existing) => cellText(existing.irn) === doc.irn && String(existing.docFor || 'HEADER') === doc.docFor && String(existing.invSrNo || '') === String(doc.invSrNo || '')));
    newDocs = [...newDocs, ...added];
    if (added.length < read.jobDocs.length) notes.push((read.jobDocs.length - added.length) + ' supporting doc(s) already on the job (same IRN) - skipped');
  }

  const parts = [];
  if (invoicesAdded || invoicesUpdated) parts.push(`${invoicesAdded} invoice(s) added, ${invoicesUpdated} updated`);
  if (read.items.length) parts.push(`${read.items.length} item(s) ${replaceItems ? 'replaced the old ones' : 'imported'}`);
  if (read.itemsOnJob) parts.push('added to the job\'s items');
  if (read.containers.length) parts.push(`${read.containers.length} container(s)`);
  if (read.jobDocs.length) parts.push(`${read.jobDocs.length} BE/invoice doc(s)`);
  ATTACHED_SHEETS.forEach((sheetName) => { if (read.found[sheetName]) parts.push(`${read.found[sheetName]} ${sheetName.replace('_', ' ')} row(s)`); });
  return { invoices: newInvoices, items: newItems, jobDataPatch, esanchitDocs: newDocs, summary: parts.join(', ') || 'nothing found in the file', notes: [...notes, ...read.warnings] };
}

// ---------------------------------------------------------------------------------------------------------------
// after an import: duty rates + duty amounts
const igstOf = (item) => {
  let igst = item.igstData;
  if (typeof igst === 'string') {
    try {
      igst = JSON.parse(igst);
    } catch {
      igst = null;
    }
  }
  return igst && typeof igst === 'object' ? igst : null;
};
const isBlank = (value) => !String(value ?? '').trim();
const ritcOf = (item) => String(item.ritc || item.hsCode || '').replace(/\D/g, '');

// The other ERP's workbook carries notification numbers but no rates, so the duty estimate came out 0. Blank BCD / IGST
// rates (and UQC) are taken from the Tariff master - values already in the row are kept. Only an exact 8-digit line
// fills rates; a nearest-heading answer counts as not found. tariffLookup(ritc) answers like GET /tariff/:ritc.
export async function fillRatesFromTariff(items, tariffLookup = jobEntryApi.tariffLine) {
  const needsRates = (item) => isBlank(item.bcdRate) || isBlank((igstOf(item) || {}).rate) || isBlank(item.unit || item.uqc || '') || isBlank(item.bcdSpecAmount);
  const codes = [...new Set(items.filter(needsRates).map(ritcOf).filter((code) => code.length >= 4))];
  const tariffByCode = {};
  const notFound = [];
  await Promise.all(codes.map(async (code) => {
    try {
      const response = await tariffLookup(code);
      if (response && response.success && response.data && response.data.exact !== false) tariffByCode[code] = response.data;
      else notFound.push(code);
    } catch {
      notFound.push(code);
    }
  }));
  let filled = 0;
  const withRates = items.map((item) => {
    if (!needsRates(item)) return item;
    const tariff = tariffByCode[ritcOf(item)];
    if (!tariff) return item;
    const updated = { ...item };
    let changed = false;
    if (isBlank(updated.bcdRate) && tariff.bcdRate != null) { updated.bcdRate = String(tariff.bcdRate); changed = true; }
    // the tariff's specific side (Rs per kg / per 1000 / per tonne) and how it combines with the percentage, e.g.
    // "20% or Rs 115 per kg, whichever is higher" - only a real specific rate (a tariff line with Rs 0 is none)
    if (tariff.bcd && parseFloat(tariff.bcd.amount) > 0 && isBlank(updated.bcdSpecAmount)) {
      updated.bcdSpecAmount = String(tariff.bcd.amount);
      if (isBlank(updated.bcdUnit) && tariff.bcd.uqc) updated.bcdUnit = String(tariff.bcd.uqc).toUpperCase();
      if (isBlank(updated.bcdRateBasis) && tariff.bcd.basis) updated.bcdRateBasis = String(tariff.bcd.basis);
      changed = true;
    }
    const igst = igstOf(updated);
    if (tariff.igstRate != null && isBlank((igst || {}).rate)) {
      updated.igstData = { notnNo: '', srNo: '', flag: 'A', amount: '', ...(igst || {}), rate: String(tariff.igstRate) };
      updated.igstDutyFlag = 'Y';
      changed = true;
    }
    if (isBlank(updated.unit || updated.uqc || '') && tariff.uqc) { updated.unit = tariff.uqc; updated.uqc = tariff.uqc; changed = true; }
    if (changed) filled++;
    return updated;
  });
  return { items: withRates, filled, notFound };
}

// the same figures as the Item tab's Re-Calculate button: duty amounts per item + the totals strip values
export function recalcDuty(items, invoices, jobData) {
  let cif = 0;
  let duty = 0;
  let noRate = 0;
  const recalculated = items.map((item) => {
    const estimate = computeItemDuty(item, invoices, jobData);
    if (!estimate.rateFound) { noRate++; return item; }
    cif += estimate.av;
    duty += estimate.total;
    let igst = item.igstData;
    if (typeof igst === 'string') {
      try {
        igst = JSON.parse(igst);
      } catch {
        igst = null;
      }
    }
    return {
      ...item, value: item.value || (estimate.itemValue ? estimate.itemValue.toFixed(2) : item.value), assessableValueInr: estimate.av.toFixed(2),
      bcdAmount: estimate.bcd.toFixed(2), swsAmount: estimate.sws.toFixed(2), healthCessAmount: estimate.health ? estimate.health.toFixed(2) : item.healthCessAmount,
      igstData: igst ? { ...igst, amount: estimate.igst.toFixed(2) } : igst, totalDuty: estimate.total.toFixed(2),
    };
  });
  const itemTotal = recalculated.reduce((sum, item) => sum + ((parseFloat(item.qty || item.quantity) * parseFloat(item.price || item.unitPrice)) || parseFloat(item.value) || 0), 0);
  return { items: recalculated, totals: { itemTotal: itemTotal.toFixed(2), cifTotalInr: cif.toFixed(2), invTotal: cif.toFixed(2), totalDuty: duty.toFixed(2) }, noRate, cif, duty };
}
