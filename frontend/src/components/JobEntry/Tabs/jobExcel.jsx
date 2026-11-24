// Job Excel upload (one workbook for the whole BE): Invoices, Items, Containers, Single Window sheets, Supporting
// (e-Sanchit) docs, item-wise SVB, Licence and Anti-dumping. The reader accepts our own template AND the other ERP's
// "ImportExcel" workbook (sheets INVOICE / ITEM / CONTAINERS / SW_INFOTYPE / SUPPORTING_DOCS / SW_STATEMENT /
// SW_CONSTITUENT / SW_PRODUCTION / SW_CONTROL / ItemWiseSVB / LICENSE / Antidumping with its column names), so files
// staff already keep can be uploaded as they are. The Template / Sample downloads use the same sheet and column names.
// Used by the Invoice tab ("Read Excel"), the Item tab ("Read File") and the Job Query "Download Sample" menu. 29-Oct-2026
import * as XLSX from 'xlsx';
import { computeItemDuty } from './ItemGridTabParts/helpers';

// ---------------------------------------------------------------------------------------------------------------
// helpers
const norm = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Excel dates arrive 1 ms before local midnight: round to the minute, then take the local date
const xlDate = (v) => { const d = new Date(Math.round(v.getTime() / 60000) * 60000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const MON = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
// text value; a number that is really an integer (RITC 90181100.0, IGM 1111.0, seal 15998141.0) loses the ".0"
const txt = (v) => {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return xlDate(v);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  const t = String(v).trim();
  return /^\d+\.0$/.test(t) ? t.slice(0, -2) : t;
};
// a number cell; "0" / "0.0" of an optional amount means "not given" (the other ERP writes 0.0 in every empty box)
const num = (v) => { const t = txt(v); if (t === '') return ''; const n = parseFloat(t); return Number.isFinite(n) ? (n === 0 ? '' : t) : t; };
// date -> yyyy-mm-dd: Date cells, dd-MMM-yyyy, dd-mm-yyyy, dd/mm/yyyy, yyyymmdd, yyyy-mm-dd, Excel serial numbers (44693)
export const ymd = (v) => {
  if (v instanceof Date) return xlDate(v);
  const t = String(v ?? '').trim(); let m;
  if (!t) return '';
  if ((m = /^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ](\d{2,4})$/.exec(t)) && MON[m[2].toUpperCase()]) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${MON[m[2].toUpperCase()]}-${m[1].padStart(2, '0')}`; }
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d{4,6}(\.0+)?$/.test(t)) { const n = parseInt(t, 10); if (n > 20000 && n < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000); return d.toISOString().slice(0, 10); } }
  return t;
};
const up = (v) => txt(v).toUpperCase();
const yn = (v) => { const c = up(v).charAt(0); return c === 'Y' ? 'Y' : c === 'N' ? 'N' : ''; };
const newId = (i) => Date.now() + (i || 0) + Math.random();

// column spec: { h: our header, k: key, a: [other accepted headers] , f: converter }
const C = (h, k, a = [], f = txt) => ({ h, k, a: Array.isArray(a) ? a : [a], f });
const CN = (h, k, a) => C(h, k, a, num);
const CD = (h, k, a) => C(h, k, a, ymd);
const CU = (h, k, a) => C(h, k, a, up);
const CY = (h, k, a) => C(h, k, a, yn);

// read one column of a row by our header or any alias (header names compared without case / punctuation)
const col = (row, spec) => {
  const keys = Object.keys(row);
  for (const n of [spec.h, ...spec.a]) { const k = keys.find(x => norm(x) === norm(n)); if (k !== undefined && String(row[k]).trim() !== '') return row[k]; }
  return '';
};
const read = (row, spec) => spec.f(col(row, spec));
// values of the headers that start with a prefix, in sheet order (the other ERP's SUPPORTING_DOCS names its party
// columns DOC_ISSUING_PARTY_… x6 and DOC_BENEFICIARY_PARTY_… x6)
const prefixVals = (row, prefix) => Object.keys(row).filter(k => norm(k).startsWith(norm(prefix))).map(k => txt(row[k]));
const rowHas = (row) => Object.values(row).some(v => String(v ?? '').trim() !== '');

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
  C('Invoice No', 'invNo', ['InvoiceNo', 'INV_NO', 'Inv No', 'Invoice Number']), CD('Invoice Date', 'invDate', ['InvoiceDate', 'INV_DATE']),
  CU('Currency', 'currency', ['CURRENCY', 'Invoice Currency']), C('Invoice Value', 'value', ['TotalValue', 'TOTAL_VALUE', 'Value', 'Invoice Amount']),
  CU('Terms', 'terms', ['TERMS', 'Terms of Invoice']),
  CN('Freight Amount', 'freightValue', ['FrtAmt', 'Freight', 'FREIGHT']), CU('Freight Currency', 'freightCurrency', ['FrtCur']), CN('Freight Rate %', 'freightRate', ['FrtRate', 'Freight Rate']),
  CN('Insurance Amount', 'insuranceValue', ['InsAmt', 'Insurance', 'INSURANCE']), CU('Insurance Currency', 'insuranceCurrency', ['InsCur']), CN('Insurance Rate %', 'insuranceRate', ['InsRate', 'Insurance Rate']),
  CY('Freight Actual (Y/N)', 'whetherFreightActual', ['FreightActual']),
  C('Supplier Name', 'supplierName', ['SupplierName']), C('Supplier Address 1', 'supplierAddress1', ['Address1', 'SupplierAdd1']), C('Supplier Address 2', 'supplierAddress2', ['Address2', 'SupplierAdd2']),
  C('Supplier Address 3', 'supplierAddress3', ['Address3', 'SupplierAdd3']), CU('Supplier Country', 'supplierCountry', ['SupplierCountry']), C('Supplier Pin', 'supplierPin', ['SupplierPinCode']),
  C('Seller Name', 'sellerName', ['SellerName']), C('Seller Address 1', 'sellerAddress1', ['SellerAdd1']), C('Seller Address 2', 'sellerAddress2', ['SellerAdd2']), C('Seller Address 3', 'sellerAddress3', ['SellerAdd3']),
  CU('Seller Country', 'sellerCountryName', ['SellerCountry']), C('Seller Pin', 'sellerPin', ['SellerPinCode']),
  C('Broker Name', 'brokerName', ['BrokerName']), C('Broker Address 1', 'brokerAddress1', ['BrokerAdd1']), C('Broker Address 2', 'brokerAddress2', ['BrokerAdd2']), C('Broker Address 3', 'brokerAddress3', ['BrokerAdd3']),
  CU('Broker Country', 'brokerCountry', ['BrokerCountry']), C('Broker Pin', 'brokerPin', ['BrokerPinCode']),
  CN('Agency Commission', 'agencyCommAmount', ['AgencyComm', 'Agency Commission Amount']), CU('Agency Commission Currency', 'agencyCommCurrency', ['AgencyCommCur']), CN('Agency Commission Rate %', 'agencyCommRate', ['AgencyCommRate']),
  CN('Loading Charges', 'loadingAmount', ['LoadingCharges', 'Loading Amount']), CU('Loading Currency', 'loadingCurrency', ['LoadingCur']), CN('Loading Rate %', 'loadingRate', ['LoadingRate']),
  CN('Misc Charges', 'miscCharges', ['MiscCharges']), CU('Misc Currency', 'miscCurrency', ['MiscCur']), CN('Misc Rate %', 'miscChargesRate', ['MiscRate']),
  CN('HSS Load Rate %', 'hssLoadRate', ['HssRate']), CN('HSS Load Amount', 'hssLoadAmount', ['HssAmt']),
  C('Nature of Discount', 'natureOfDiscount', ['DiscntNat']), CN('Discount Rate %', 'discountRate', ['DiscntRate']), CN('Discount Amount', 'discountAmount', ['DiscntAmt']),
  C('SVB Ref No', 'svbReferenceNumber', ['SVBRefNo']), CD('SVB Ref Date', 'svbReferenceDate', ['SVBDate']), CU('SVB Custom House', 'customHouseCodeWhichHasImposedLoad', ['CustomHouse']),
  CN('SVB Load on Ass. Value %', 'svbLoadAssessableValue', ['SVBonAssess']), CN('SVB Load on Duty %', 'svbLoadOnDuty', ['SVBonDuty']), CU('SVB Flag (A/D/B)', 'svbFlag', ['SVBFlag']),
  CU('SVB Value Provisional (P/F)', 'whetherloadProvisionalOnAssValue', ['SVBonAssessFlag']), CU('SVB Duty Provisional (P/F)', 'whetherProvisionalOnDuty', ['SVBonDutyFlag']),
  C('Other Information', 'otherRelevantInform', ['Description', 'Other Relevant Information']),
  CU('Nature of Transaction', 'natureOfTransaction', ['NatureOfTransaction']), CU('Payment Terms', 'paymentTerms', ['TermsOfPayment']),
  C('Buyer Seller Relationship', 'buyerSellerRelationship', ['BuyerSellerReln']), C('Valuation Method', 'valuationMethod', ['ValMethodApplicable']),
  C('Third Party Name', 'thirdPartyName', ['ThirdPartyName']), C('Third Party Address 1', 'thirdPartyAddress1', ['ThirdPartyAdd1']), C('Third Party Address 2', 'thirdPartyAddress2', ['ThirdPartyAdd2']),
  C('Third Party City', 'thirdPartyCity', ['ThirdPartyCity']), C('Third Party Country Subdivision', 'thirdPartyCntrySubDvsn', ['ThirdPartyCtrySubdv']), CU('Third Party Country', 'thirdPartyCountryCode', ['ThirdPartyCtry']),
  C('Third Party Pin', 'thirdPartyPin', ['ThirdPartyPinCode']), C('Terms Place', 'termsPlace', ['TermsPlace']),
  C('AEO Code', 'authorizedEconomicOperatorCode', ['AEOCode']), CU('AEO Country', 'authorizedEconomicOperatorCountry', ['AEOCtry']), CU('AEO Role', 'authorizedEconomicOperatorRole', ['AEORole']),
  CY('Buyer Seller Related (Y/N)', 'whetherBuyerAndSellerAreRelated', ['BuyerSellerRelated', 'Buyer Seller Related']),
  C('PO No', 'purchaseOrderNumber', ['PONo', 'PO Number']), CD('PO Date', 'purchaseOrderDate', ['PODate']), C('Contract No', 'contractNumber', ['ContractNo']), CD('Contract Date', 'contractDate', ['ContractDate']),
  C('LC No', 'lcNumber', ['LCNo']), CD('LC Date', 'lcDate', ['LCDate']),
];

export const ITEM_COLS = [
  C('Inv No', 'invNo', ['Invoice No']), C('Inv Sr No', 'invSrNo', ['INV_SR_NO', 'Invoice Sr No']), C('Item Sr. No', 'itemSrNo', ['ITEM_SR_NO', 'Item Sr No', 'Item No']),
  C('RITC', 'ritc', ['HS Code', 'HSN']), C('CTH', 'cth'), CU('CETH', 'ceth'),
  C('Description', 'desc', ['ITEM_DESCRIPTION', 'Item Description']), C('Generic Description', 'genericDesc', ['GENERAL_DESCRIPTION', 'Generic Desc']),
  CY('Desc Only In Checklist (Y/N)', 'descOnlyInChecklist', ['CHECKLIST_DESCRIPTION']),
  C('Quantity', 'qty', ['QTY']), CU('Unit', 'unit', ['UQC']), C('Unit Price', 'price', ['UNIT_PRICE', 'Price', 'Rate']), C('Total Value', 'value', ['TOTAL', 'Value', 'Assessable Value', 'Amount']),
  CU('Country of Origin', 'countryOfOrigin', ['ORIGIN_COUNTRY', 'COO']), C('Manufacturer', 'manufacturer', ['MANUFACTURER_NAME']), C('Brand', 'brandName', ['BRAND']), C('Model', 'model', ['MODEL_NO']),
  CU('End Use', 'endUse', ['END_USE']), C('Accessory Status (0/1/2)', 'accessoryStatus', ['ACCESSORY_STATUS']), C('Accessories', 'accessories', ['ITEM_ACCESSORIES']), C('Item Category', 'itemCategory', ['ITEM_CATEGORY']),
  CU('Rate Type (P/S)', 'rateTypeFlag', ['PREF_STD', 'Preferential Standard', 'P/S']),
  C('BCD Notn', 'bcdNotificationNo', ['BCD_NOTN', 'BCD Notification']), C('BCD Sr No', 'bcdSrNo', ['BCD_SLNO']), C('BCD Rate', 'bcdRate'),
  C('SWS Notn', 'swsNotificationNo', ['SWS_NOTN']), C('SWS Sr No', 'swsSrNo', ['SWS_SLNO']), C('SWS Rate', 'swsRate'),
  C('IGST Notn', '_igstNotn', ['IGST_NOTN_NO', 'IGST Notification']), C('IGST Sr No', '_igstSr', ['IGST_NOTN_SLNO']), C('IGST Rate', '_igstRate'),
  CU('IGST Exempting Flag', '_igstFlag', ['IGST_IGST_FLAG', 'EXEMPTING_FLG']), C('IGST Exmp Notn', '_igstExNotn', ['IGST_EXMP_NOTN_NO']), C('IGST Exmp Sr No', '_igstExSr', ['IGST_EXMP_NOTN_SLNO']),
  C('GST Cess Notn', '_cessNotn', ['IGSTCESS_NOTN_NO']), C('GST Cess Sr No', '_cessSr', ['IGSTCESS_NOTN_SLNO']), CU('GST Cess Flag', '_cessFlag', ['IGSTCESS_IGST_FLAG']),
  C('GST Cess Exmp Notn', '_cessExNotn', ['IGSTCESS_EXMP_NOTN_NO']), C('GST Cess Exmp Sr No', '_cessExSr', ['IGSTCESS_EXMP_NOTN_SLNO']),
  C('AIDC Notn', '_aidcNotn', ['AIDC_DUTY_NOTN_NO']), C('AIDC Sr No', '_aidcSr', ['AIDC_DUTY_NOTN_SLNO']), CU('AIDC Flag', '_aidcFlag', ['AIDC_DUTY_FG']),
  C('SAPTA Notn', 'saptaNotificationNo', ['SAPTA_NOTN']), C('SAPTA Sr No', 'saptaSrNo', ['SAPTA_SLNO']),
  C('Health Cess Notn', 'healthCessNotificationNo', ['HEALTHCESS_NOTN_NO']), C('Health Cess Sr No', 'healthCessSrNo', ['HEALTHCESS_NOTN_SLNO']),
  C('CVD Notn', 'cvdNotificationNo', ['CVD_NOTN']), C('CVD Sr No', 'cvdSrNo', ['CVD_SLNO']), C('Addl CVD Notn', 'adlCvdNotificationNo', ['ADDCVD_NOTN']), C('Addl CVD Sr No', 'adlCvdSrNo', ['ADDCVD_SLNO']),
  C('Addl Notn 1', 'additionalNotification1', ['AD1_NOTN']), C('Addl Notn 1 Sr No', 'additionalNotification1SrNo', ['AD1_SLNO']),
  C('Addl Notn 2', 'additionalNotification2', ['AD2_NOTN']), C('Addl Notn 2 Sr No', 'additionalNotification2SrNo', ['AD2_SLNO']),
  C('Other Notn', 'otherNotification', ['OTHER_NOTN']), C('Other Notn Sr No', 'otherNotificationSrNo', ['OTHER_SLNO']),
  CU('Scheme Code', '_schemeCode', ['SCHEME_CODE']), C('Scheme Notn', '_schemeNotn', ['SCHEME_NOTN_NO']), C('Scheme Notn Sr No', '_schemeSr', ['SCHEME_NOTN_SLNO']), CY('Exemption Flag (Y/N)', '_exemptionFlag', ['EXEMPTION_FLAG']),
  C('Licence No', '_licNo', ['LICENSE_REG_NO', 'LICENCE_NO', 'License No']), CD('Licence Date', '_licDate', ['REG_DATE', 'LICENCE_DATE']), CU('Licence Port', '_licPort', ['REG_PORT']), C('Licence Item Sr No', '_licItemSr', ['ITEM_SLNO_LIC']), C('Licence URN', '_licUrn', ['LIC_URN']),
  C('Prev SB No', '_sbNo', ['PREVIOUS_SB_NO']), CD('Prev SB Date', '_sbDate', ['PREVIOUS_SB_DT']), CU('Port of Export', '_sbPort', ['PORT_OF_EXPORT']), C('SB Inv Sr No', '_sbInv', ['INV_SLNO_SB']), C('SB Item Sr No', '_sbItem', ['ITEM_SLNO_SB']),
  C('Reimport Notn', '_reNotn', ['REIMPORT_NOTN']), C('Reimport Notn Sr No', '_reSr', ['REIMPORT_NOTN_SLNO']), CN('SB Freight', '_sbFrt', ['SB_FREIGHT']), CN('SB Insurance', '_sbIns', ['SB_INSURANCE']),
  CN('Customs Duty Paid', '_sbCus', ['CUSTOM_DUTY']), CN('Excise Duty Paid', '_sbExc', ['EXCISE_DUTY']),
  C('Mfr Code Type', 'itemManufacturerType', ['MNF_CODE_TYPE']), C('Mfr Code', 'itemManufacturerCode', ['MNF_CODE']), C('Mfr Address 1', 'itemManufacturerAddress1', ['MNF_ADD1']), C('Mfr Address 2', 'itemManufacturerAddress2', ['MNF_ADD2']),
  C('Mfr City', 'itemManufacturerCity', ['MNF_CITY']), C('Mfr Country Subdivision', 'itemManufacturerSubdivision', ['MNF_CTRY_SUBDV']), C('Mfr Pin', 'itemManufacturerPin', ['MNF_PIN']), CU('Mfr Country', 'itemManufacturerCountry', ['MNF_CTRY']),
  CU('Source Country', 'sourceCountry', ['SOURCE_CTRY']), CU('Transit Country', 'transitCountry', ['TRANSIT_CTRY']),
  CN('RSP Amount', '_rspAmt', ['RSP_AMOUNT']), CU('RSP Flag', '_rspFlag', ['RSP_FLAG']),
  CN('SVB Load on Ass. Value %', '_svbVal', ['SVB_LOAD_ON_ASSVAL']), CN('SVB Load on Duty %', '_svbDuty', ['SVB_LOAD_ON_DUTY']),
  CN('Std Qty (CHR/SQC)', 'sqcQty', ['CTH_UQC_QUANTITY', 'Standard Qty']), CU('Std UQC (CHR/SQC)', 'sqcUqc', ['CTH_UQC', 'Standard UQC']),
  C('SIMS Info Code', '_simsCode', ['SIMS_INFO_CODE']), C('SIMS Info Text', '_simsText', ['SIMS_INFO_TEXT']),
  CU('COO Cert Issuing Country', '_cooCode', ['COO_INFO_CODE']), C('COO Cert No|Date (ddmmyyyy)', '_cooText', ['COO_INFO_TEXT']), CU('Accumulation ACM (Y/N)', '_acm', ['ACM_INFO_CODE']),
  CU('RIS (Y/N)', '_ris', ['RIS_INFO_CODE']), CU('DC (Y/N)', '_dc', ['DC_INFO_CODE']),
  CU('Origin Criteria (COWO/CONWO)', '_orgQual', ['COWO_CONWO_INFO_QUALIFIER', 'COWO_CONWO_INFO_QUAL']), CU('Origin Rule Code (COOG/COOP)', '_orgCode', ['COWO_CONWO_INFO_CODE']), C('Origin Rule Text', '_orgText', ['COWO_CONWO_INFO_TEXT']), CU('Origin Rule UQC', '_orgUqc', ['COWO_CONWO_INFO_UQC']),
  C('Policy Para No', '_ppNo', ['POLICY_PARA_NO']), C('Policy Year', '_ppYear', ['POLICY_YEAR']),
  C('Prev BE No', '_pbNo', ['PREVIOUS_BE_NO']), CD('Prev BE Date', '_pbDate', ['PREVIOUS_BE_DT']), CN('Prev BE Unit Price', '_pbPrice', ['PREV_UNIT_PRICE']), CU('Prev BE Currency', '_pbCur', ['PREV_CURRENCY']), CU('Prev BE Custom House', '_pbCh', ['PREV_CUSTOM_SITE']),
];

export const CONT_COLS = [
  C('Sr No', 'srNo', ['NO']), C('IGM No', 'igmNumber', ['IGM_NO', 'IGM Number']), CD('IGM Date', 'igmDate', ['IGM_DT']), CU('LCL/FCL', 'lclFcl', ['LCFC', 'LCL FCL']),
  CU('Container No', 'contNo', ['CONT_NO', 'Container Number']), C('Seal No', 'sealNo', ['SEAL_NO']), C('Size (20/40/45)', 'contSize', ['CONT_SIZE', 'Container Size']), C('Type', 'contType', ['CONT_TYPE']),
  CU('Truck No', 'truckNo', ['TRUCK_NO']), C('Location Id', 'locationId', ['LOCATION_ID']),
];
// our SW / doc sheets name the invoice ("Inv No" = INV-001); the other ERP's INV_NO / INV_SR_NO is the invoice serial no -
// srOf() takes a number that is not an Invoice No on the job as the serial no
const ITEM_KEY = [C('Inv No', 'invNo', ['Invoice No']), C('Inv Sr No', 'invSrNo', ['INV_SR_NO', 'Invoice Sr No']), C('Item Sr. No', 'itemSrNo', ['ITEM_SR_NO', 'ITEM_NO', 'Item Sr No', 'Item No'])];
export const SW_COLS = {
  SW_InfoType: [...ITEM_KEY, CU('InfoType', 'type', ['INFO_TYPE', 'Info Type']), CU('Qualifier', 'qualifier', ['INFO_QUALIFIER']), C('Info Code', 'code', ['INFO_CODE']), C('Info Text', 'text', ['INFO_TEXT']), CN('Qty', 'qty', ['INFO_MSR', 'Measure']), CU('UQC', 'uqc', ['INFO_UQC'])],
  SW_Statement: [...ITEM_KEY, CU('Statement Type', 'typeCode', ['TYPE']), CU('Statement Code', 'stmtCode', ['CODE']), C('Statement Text', 'stmtText', ['TEXT'])],
  SW_Constituent: [...ITEM_KEY, C('Sr No', 'srNo', ['CONST_SRNO']), C('Element Name', 'name', ['CONST_ELEMENT_NM']), C('Element Code', 'code', ['CONST_ELEMENT_CODE']), CN('Percentage', 'percent', ['CONST_PERCENTAGE']), CN('Yield', 'yield', ['CONST_YIELD_PERCENTAGE']), CY('Active Ingredient', 'active', ['ACTIVE_INGREDIENT'])],
  SW_Production: [...ITEM_KEY, C('Batch No', 'batch', ['BATCH_ID', 'Producer Name']), CN('Batch Qty', 'qty', ['BATCH_QUANTITY']), CU('UQC', 'uqc', ['BATCH_UNIT']), CD('Mfg Date', 'mnfDate', ['MANUFACTURER_DATE']), CD('Expiry Date', 'expDate', ['EXPIRY_DATE']), CD('Best Before', 'bestBefore', ['BEST_BEFORE_DATE'])],
  SW_Control: [...ITEM_KEY, CU('Control Type', 'typeCode', ['CONTROL_TYPE']), C('Control Location', 'location', ['CONTROL_LOCATION']), CD('Start Date', 'startDate', ['START_DATE']), CD('End Date', 'endDate', ['END_DATE']), C('Result Code', 'resultCode', ['RESULT_CODE', 'Result']), C('Result Text', 'resultText', ['RESULT_TEXT']),
    // 13-Nov-2026: the control serial an ex-bond (X) BE files (the warehouse BE's: 2, 3 ...); empty = 1, 2, 3 per item
    C('Control Sr No', 'slNo', ['CONTROL_SL_NO', 'CONTROL_SR_NO', 'CTRL_SLNO', 'CTRL_SL_NO', 'Control Sl No'])],
};
export const DOC_COLS = [...ITEM_KEY, CU('File Type', 'fileType', ['FILE_TYPE']), C('ICEGATE Id', 'icegateId', ['ICEGATEID']), C('IRN', 'irn', ['Image Reference No']), C('Doc Type Code', 'docCode', ['DOC_TYPE_CODE', 'Document Code']), C('DRN', 'drn'),
  C('Place of Issue', 'placeOfIssue', ['DOC_ISSUED_PLACE']), CD('Issue Date', 'issueDate', ['DOC_ISSUED_DATE']), CD('Expiry Date', 'expiryDate', ['DOC_EXPIRY_DATE']),
  C('Issuer Name', 'issuerName', ['DOC_ISSUING_PARTY_NAME']), C('Issuer Code', 'issuerCode', ['DOC_ISSUING_PARTY_CODE']), C('Issuer Address 1', 'issuerAddr1', ['DOC_ISSUING_PARTY_ADD1']), C('Issuer Address 2', 'issuerAddr2', ['DOC_ISSUING_PARTY_ADD2']),
  C('Issuer City', 'issuerCity', ['DOC_ISSUING_PARTY_CITY']), C('Issuer Pin', 'issuerPin', ['DOC_ISSUING_PARTY_PIN_CODE', 'DOC_ISSUING_PARTY_PIN']),
  C('Beneficiary Name', 'beneName', ['DOC_BENEFICIARY_PARTY_NAME']), C('Beneficiary Code', 'beneCode', ['DOC_BENEFICIARY_PARTY_CODE']), C('Beneficiary Address 1', 'beneAddr1', ['DOC_BENEFICIARY_PARTY_ADD1']),
  C('Beneficiary Address 2', 'beneAddr2', ['DOC_BENEFICIARY_PARTY_ADD2']), C('Beneficiary City', 'beneCity', ['DOC_BENEFICIARY_PARTY_CITY']), C('Beneficiary Pin', 'benePin', ['DOC_BENEFICIARY_PARTY_PIN_CODE', 'DOC_BENEFICIARY_PARTY_PIN'])];
export const SVB_COLS = [...ITEM_KEY, CY('Save In All (Y/N)', 'saveInAll', ['SAVE_IN_ALL']), C('Reference No', 'refNo', ['REFERENCE_NO']), CD('Reference Date', 'date', ['REFERENCE_DATE']), CU('Custom House', 'customHouse', ['CUSTOMHOUSE_CODE']),
  CU('Load On (A/D/B)', 'loadType', ['SVB_LOAD_ON']), CN('Load on Ass. Value %', 'loadValue', ['ASSESSABLE_VALUE']), CU('Value Load Status (P/F)', 'valueStatus', ['ASSESSABLE_LOAD_STAT', 'ASSESSABLE_LOAD_STATUS']),
  CN('Load on Duty %', 'loadDuty', ['DUTY']), CU('Duty Load Status (P/F)', 'dutyStatus', ['DUTY_LOAD_STATUS'])];
export const LIC_COLS = [...ITEM_KEY, CU('Scheme Code', 'licenceCode', ['SCHEME_CODE', 'Licence Code']), C('Scheme Notn', 'exemptionNotn', ['SCHEME_NOTN_NO']), C('Scheme Notn Sr No', 'exemptionSrNo', ['SCHEME_NOTN_SLNO']), CY('Exemption Flag (Y/N)', 'exemptionFlag', ['EXEMPTION_FLAG']),
  C('Licence URN', 'licUrn', ['LIC_URN']), C('Licence No', 'licenceNoRaw', ['LICENSE_NO', 'LICENCE_NO']), CD('Licence Date', 'licenceDateRaw', ['LICENSE_DATE', 'LICENCE_DATE']), C('Registration No', 'licenceNo', ['REGITRATION_NO', 'REGISTRATION_NO']),
  CD('Registration Date', 'licenceDate', ['REGITRATION_DATE', 'REGISTRATION_DATE']), CU('Registration Port', 'regnPort', ['REGITRATION_PORT', 'REGISTRATION_PORT']), C('Licence Item Sr No', 'itemSrNoLicence', ['LICENSE_SR_NO', 'LICENCE_SR_NO']),
  CN('Debit Value (CIF)', 'debitValue', ['CIF_VALUE', 'DEBIT_VALUE']), CN('Debit Duty', 'debitDuty', ['DEBIT_DUTY']), CN('Debit Qty', 'debitQty', ['DEBIT_QUANTITY']), CU('Debit UQC', 'debitUqc', ['DEBIT_QUANTITY_UNIT', 'DEBIT_UQC'])];
export const ADD_COLS = [...ITEM_KEY, CY('Remove (Y/N)', 'isRemove', ['IsRemove']), C('Antidumping Type', 'type', ['Antidumping_Type']), C('Notification No', 'notnNo', ['Notification_No']), C('Notification Sr No', 'srNo', ['Notification_Sr_No']),
  C('CTH Serial No', 'cth', ['CTH_Serial_No']), CN('Quantity', 'qty', ['Quantity']), CU('UQC', 'uqc'), C('Supplier Sl No', 'supSlNo', ['Supplier_Sl_No']), CY('Different Currency (Y/N)', 'flag', ['IsDifferentFlag']), CU('Currency', 'currency', ['IfDifferentCurrency']),
  CN('Rate', 'rate'), CN('Amount', 'amount')];

export const SHEET_COLS = { Invoices: INV_COLS, Items: ITEM_COLS, Containers: CONT_COLS, ...SW_COLS, Supporting_Docs: DOC_COLS, Item_SVB: SVB_COLS, Licence: LIC_COLS, Antidumping: ADD_COLS };

// sample rows (our headers' order) - dummy data only
const SAMPLE = {
  Invoices: [
    Object.assign(Object.fromEntries(INV_COLS.map(c => [c.k, ''])), { invNo: 'INV-001', invDate: '2026-10-10', currency: 'USD', value: 15500, terms: 'FOB', freightValue: 100, freightCurrency: 'USD', insuranceRate: 1.125, supplierName: '[Supplier A]', supplierAddress1: 'Street 1', supplierAddress2: 'City', supplierCountry: 'CN', whetherBuyerAndSellerAreRelated: 'N', natureOfTransaction: 'O', valuationMethod: 'Rule4 Transaction Value', paymentTerms: 'OTH' }),
    Object.assign(Object.fromEntries(INV_COLS.map(c => [c.k, ''])), { invNo: 'INV-002', invDate: '2026-10-11', currency: 'EUR', value: 2000, terms: 'CIF', miscCharges: 20, miscCurrency: 'EUR', supplierName: '[Supplier B]', supplierAddress1: 'Street 2', supplierAddress2: 'City', supplierCountry: 'DE', whetherBuyerAndSellerAreRelated: 'N', natureOfTransaction: 'O', valuationMethod: 'Rule4 Transaction Value', paymentTerms: 'OTH' }),
  ],
  Items: [
    Object.assign(Object.fromEntries(ITEM_COLS.map(c => [c.k, ''])), { invNo: 'INV-001', invSrNo: 1, itemSrNo: 1, ritc: '85171300', cth: '85171300', ceth: 'NOEXCISE', desc: 'MOBILE PHONE MODEL X 128GB', genericDesc: 'MOBILE PHONE', qty: 100, unit: 'NOS', price: 150, value: 15000, countryOfOrigin: 'CN', manufacturer: '[Manufacturer A]', brandName: 'BRAND A', model: 'X-128', endUse: 'GNX200', accessoryStatus: 0, rateTypeFlag: 'S', bcdNotificationNo: '050/2017', bcdSrNo: '1', bcdRate: 20, swsRate: 10, _igstNotn: '009/2025', _igstSr: 'II506', _igstRate: 18, _aidcNotn: '011/2021', _aidcSr: '17', _aidcFlag: 'A', sqcQty: 12.5, sqcUqc: 'KGS' }),
    Object.assign(Object.fromEntries(ITEM_COLS.map(c => [c.k, ''])), { invNo: 'INV-001', invSrNo: 1, itemSrNo: 2, ritc: '85176290', cth: '85176290', ceth: 'NOEXCISE', desc: 'WIFI ROUTER', genericDesc: 'ROUTER', qty: 20, unit: 'NOS', price: 25, value: 500, countryOfOrigin: 'CN', manufacturer: '[Manufacturer A]', brandName: 'BRAND A', model: 'R-1', endUse: 'GNX200', accessoryStatus: 0, rateTypeFlag: 'S', bcdRate: 20, swsRate: 10, _igstNotn: '009/2025', _igstSr: 'II506', _igstRate: 18, _aidcNotn: '011/2021', _aidcSr: '17', _aidcFlag: 'A', sqcQty: 4, sqcUqc: 'KGS' }),
    Object.assign(Object.fromEntries(ITEM_COLS.map(c => [c.k, ''])), { invNo: 'INV-002', invSrNo: 2, itemSrNo: 1, ritc: '84713010', cth: '84713010', ceth: 'NOEXCISE', desc: 'LAPTOP 14 INCH', genericDesc: 'LAPTOP', qty: 2, unit: 'NOS', price: 1000, value: 2000, countryOfOrigin: 'DE', manufacturer: '[Manufacturer B]', brandName: 'BRAND B', model: 'L-14', endUse: 'GNX200', accessoryStatus: 0, rateTypeFlag: 'S', bcdRate: 0, swsRate: 10, _igstNotn: '009/2025', _igstSr: 'II506', _igstRate: 18, sqcQty: 3, sqcUqc: 'KGS' }),
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
export function downloadJobWorkbook(withSample, only) {
  const wb = XLSX.utils.book_new();
  Object.entries(SHEET_COLS).forEach(([name, cols]) => {
    if (only && !only.includes(name)) return;
    const rows = withSample ? (SAMPLE[name] || []).map(r => cols.map(c => r[c.k] ?? '')) : [];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols.map(c => c.h), ...rows]), name);
  });
  const base = only && only.length === 1 ? ({ Invoices: 'Invoice', Items: 'Item' })[only[0]] || only[0] : 'Job';
  XLSX.writeFile(wb, `Import_${base}_Upload_${withSample ? 'Sample' : 'Template'}.xlsx`);
}
export const downloadInvoiceSample = () => downloadJobWorkbook(true, ['Invoices']);
export const downloadItemWorkbook = (withSample) => downloadJobWorkbook(withSample);
export function downloadItemCsv() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ITEM_COLS.map(c => c.h), ...SAMPLE.Items.map(r => ITEM_COLS.map(c => r[c.k] ?? ''))]), 'Items');
  XLSX.writeFile(wb, 'Item_Upload_Sample.csv', { bookType: 'csv' });
}

// ---------------------------------------------------------------------------------------------------------------
// reader
const sheetRows = (wb, name) => {
  const wanted = (SHEET_NAMES[name] || [name]).map(norm);
  const sn = wb.SheetNames.find(n => wanted.includes(norm(n))) || wb.SheetNames.find(n => wanted.some(w => norm(n).includes(w)));
  return sn ? XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' }).filter(rowHas) : [];
};
const readRow = (row, cols) => { const o = {}; cols.forEach(c => { o[c.k] = read(row, c); }); return o; };

/**
 * Read a job workbook. invoices = the job's current invoices (Inv No -> Sr No; new ones from the file are appended).
 * Returns { invoices, items, containers, jobDocs, statements, warnings, found }:
 *  - invoices: rows read from the Invoices sheet (screen field names), in file order
 *  - items: item objects (screen field names + popup objects: igstData / dutyRows / otherDutyData / svbData / licenceData /
 *           depbData / reimportData / rspData / policyParaData / prevBeData / addData / swInfoData / swStmtData / swConstData /
 *           swProdData / swCtrlData / docsData) ready for setItems
 *  - containers: jobData.containers rows; jobDocs: BE / invoice level e-Sanchit rows (tab 5 shape); statements: BE / invoice
 *    level statement rows (jobData._statements shape)
 */
// SW_Control rows of one item from a workbook (Single Window Control popup "Excel" button). Rows naming another item
// are left out; a sheet without Inv / Item Sr No columns gives all its rows to this item. 13-Nov-2026
export function readControlRowsFor(arrayBuffer, invoices = [], item = {}) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const rows = sheetRows(wb, 'SW_Control');
  const srN = (v) => txt(v).replace(/\.0$/, '');
  const invNos = (invoices || []).map(iv => txt(iv.invNo || iv.invoiceNo).replace(/\s+/g, '').toUpperCase());
  const myInv = srN(item.invSrNo || '1'), myItem = srN(item.itemSrNo ?? item.itemNo);
  let other = 0;
  const out = [];
  rows.forEach((row, i) => {
    const d = readRow(row, SHEET_COLS.SW_Control);
    if (!txt(d.typeCode)) return;
    const n = txt(d.invNo).replace(/\s+/g, '').toUpperCase();
    const inv = n && invNos.includes(n) ? String(invNos.indexOf(n) + 1) : srN(d.invSrNo || (/^\d+$/.test(n) ? n : ''));
    const itm = srN(d.itemSrNo);
    if ((itm && itm !== myItem) || (inv && itm && inv !== myInv)) { other++; return; }
    out.push({ id: Date.now() + i, typeCode: String(d.typeCode).toUpperCase().replace(/\s/g, ''), location: txt(d.location), startDate: d.startDate, endDate: d.endDate, resultCode: txt(d.resultCode), resultText: txt(d.resultText), slNo: srN(d.slNo) });
  });
  return { rows: out, other, total: rows.length };
}

// existingItems (13-Nov-2026): the job's items. A file with SW / licence / SVB / doc sheets but no Items sheet adds its
// rows to these (ex-bond BE: items entered first, the warehouse BE's controls uploaded after) - returned as itemsOnJob.
export function readJobWorkbook(arrayBuffer, invoices = [], startSrByInv = {}, existingItems = []) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const warnings = [];
  const found = {};

  // ---- invoices
  const invRows = sheetRows(wb, 'Invoices');
  const fileInvoices = [];
  const keyOf = (n) => txt(n).replace(/\s+/g, '').toUpperCase();
  invRows.forEach((row, i) => {
    const d = readRow(row, INV_COLS);
    if (!d.invNo) { warnings.push(`Invoices row ${i + 2}: no Invoice No - skipped`); return; }
    // the same Invoice No twice in the sheet = one invoice; the first row is kept (30-Oct-2026)
    if (fileInvoices.some(fi => keyOf(fi.invNo) === keyOf(d.invNo))) { warnings.push(`Invoices row ${i + 2}: Invoice No "${d.invNo}" is repeated - the first row is used`); return; }
    if (d.valuationMethod && /^rule\s*4$/i.test(d.valuationMethod)) d.valuationMethod = 'Rule4 Transaction Value';
    if (d.terms && !['CIF', 'FOB', 'CF', 'CI'].includes(d.terms)) warnings.push(`${d.invNo}: terms "${d.terms}" is not CIF/FOB/CF/CI`);
    if (!(parseFloat(d.value) > 0)) warnings.push(`${d.invNo}: invoice value missing`);
    // the other ERP's rate / amount columns both carry 0.0 when unused - num() already drops zeros
    Object.keys(d).forEach(k => { if (d[k] === '') delete d[k]; });
    fileInvoices.push({ id: newId(i), ...d });
  });
  found.invoices = fileInvoices.length;

  // Inv No -> Sr No over the job's invoices followed by the file's new ones (file order)
  const allInv = [...(invoices || [])];
  fileInvoices.forEach(fi => { if (!allInv.some(iv => keyOf(iv.invNo || iv.invoiceNo) === keyOf(fi.invNo))) allInv.push(fi); });
  const invNoOf = (sr) => txt((allInv[parseInt(sr, 10) - 1] || {}).invNo || (allInv[parseInt(sr, 10) - 1] || {}).invoiceNo || '');
  const byName = (n) => { const i = allInv.findIndex(iv => keyOf(iv.invNo || iv.invoiceNo) === keyOf(n)); return i >= 0 ? String(i + 1) : ''; };
  // a serial no in the file counts the file's own Invoices sheet (1 = its first invoice) when there is one; otherwise the job's invoices
  const bySr = (sr) => { if (!/^\d+$/.test(sr) || sr === '0') return ''; if (!fileInvoices.length) return sr; const fi = fileInvoices[parseInt(sr, 10) - 1]; return fi ? byName(fi.invNo) || sr : sr; };
  const srOf = (d, where) => {
    const n = txt(d.invNo);
    if (n && byName(n)) return byName(n);
    const sr = bySr(txt(d.invSrNo).replace(/\.0$/, ''));
    if (sr) return sr;
    if (bySr(n)) return bySr(n); // INV_NO 1 = serial no
    if (n) warnings.push(`${where}: invoice "${n}" is not on this job - put under invoice 1`);
    return '1';
  };

  // ---- items
  const next = { ...startSrByInv };
  const items = [];
  sheetRows(wb, 'Items').forEach((row, i) => {
    const d = readRow(row, ITEM_COLS);
    const ritc = txt(d.ritc).replace(/\D/g, '');
    if (!ritc && !d.desc) return;
    const invSrNo = srOf(d, `Items row ${i + 2}`);
    let itemSrNo = txt(d.itemSrNo).replace(/\.0$/, '');
    if (!itemSrNo) { next[invSrNo] = (next[invSrNo] || 0) + 1; itemSrNo = String(next[invSrNo]); }
    else next[invSrNo] = Math.max(next[invSrNo] || 0, parseInt(itemSrNo, 10) || 0);
    if (ritc && ritc.length !== 8) warnings.push(`Items row ${i + 2}: RITC ${ritc} is not 8 digits`);
    const qty = txt(d.qty), price = txt(d.price);
    const it = {
      id: newId(i), invNo: txt(d.invNo) || invNoOf(invSrNo), invSrNo, itemSrNo, itemNo: itemSrNo,
      ritc, hsCode: ritc, cth: txt(d.cth).replace(/\D/g, '') || ritc, ceth: d.ceth || 'NOEXCISE',
      desc: d.desc, productDescription: d.desc, genericDesc: d.genericDesc, descOnlyInChecklist: d.descOnlyInChecklist,
      qty, quantity: qty, unit: d.unit, uqc: d.unit, price, unitPrice: price,
      value: num(d.value) || (qty && price ? (parseFloat(qty) * parseFloat(price)).toFixed(2) : ''),
      countryOfOrigin: d.countryOfOrigin, manufacturer: d.manufacturer, brandName: d.brandName, model: d.model, endUse: d.endUse,
      accessoryStatus: txt(d.accessoryStatus) || '0', accessories: d.accessories, itemCategory: d.itemCategory, rateTypeFlag: d.rateTypeFlag || 'S',
      bcdNotificationNo: d.bcdNotificationNo, bcdSrNo: d.bcdSrNo, bcdRate: d.bcdRate, swsNotificationNo: d.swsNotificationNo, swsSrNo: d.swsSrNo, swsRate: d.swsRate || '10', swsFlag: 'A',
      saptaNotificationNo: d.saptaNotificationNo, saptaSrNo: d.saptaSrNo, healthCessNotificationNo: d.healthCessNotificationNo, healthCessSrNo: d.healthCessSrNo,
      cvdNotificationNo: d.cvdNotificationNo, cvdSrNo: d.cvdSrNo, adlCvdNotificationNo: d.adlCvdNotificationNo, adlCvdSrNo: d.adlCvdSrNo,
      additionalNotification1: d.additionalNotification1, additionalNotification1SrNo: d.additionalNotification1SrNo, additionalNotification2: d.additionalNotification2, additionalNotification2SrNo: d.additionalNotification2SrNo,
      otherNotification: d.otherNotification, otherNotificationSrNo: d.otherNotificationSrNo,
      itemManufacturerType: d.itemManufacturerType, itemManufacturerCode: d.itemManufacturerCode, itemManufacturerAddress1: d.itemManufacturerAddress1, itemManufacturerAddress2: d.itemManufacturerAddress2,
      itemManufacturerCity: d.itemManufacturerCity, itemManufacturerSubdivision: d.itemManufacturerSubdivision, itemManufacturerPin: d.itemManufacturerPin, itemManufacturerCountry: d.itemManufacturerCountry,
      sourceCountry: d.sourceCountry, transitCountry: d.transitCountry, sqcQty: d.sqcQty, sqcUqc: d.sqcUqc, foc: 'N',
      igstData: null, dutyRows: null, otherDutyData: null, svbData: null, licenceData: null, depbData: null, reimportData: null, rspData: null, policyParaData: null, prevBeData: null, addData: null,
      swInfoData: null, swStmtData: null, swConstData: null, swProdData: null, swCtrlData: null, docsData: null,
    };
    // duty notification rows (SBEDUTY): IGST G/I, GST compensation cess G/P, AIDC C/A
    const rows = [];
    if (d._igstNotn) { rows.push({ dutyType: 'G', addlDutyFlag: 'I', igstFlag: d._igstFlag, notificationNo: d._igstNotn, notificationSrNo: d._igstSr, exmpNotificationNo: d._igstExNotn, exmpNotificationSrNo: d._igstExSr });
      it.igstData = { notnNo: d._igstNotn, srNo: d._igstSr, rate: d._igstRate, flag: 'A', amount: '', exmpNotnNo: d._igstExNotn, exmpSrNo: d._igstExSr }; it.igstDutyFlag = 'Y'; }
    else if (d._igstRate) { it.igstData = { notnNo: '', srNo: '', rate: d._igstRate, flag: 'A', amount: '' }; it.igstDutyFlag = 'Y'; }
    if (d._cessNotn) rows.push({ dutyType: 'G', addlDutyFlag: 'P', igstFlag: d._cessFlag, notificationNo: d._cessNotn, notificationSrNo: d._cessSr, exmpNotificationNo: d._cessExNotn, exmpNotificationSrNo: d._cessExSr });
    // AIDC: duty type C (the other ERP's AIDC_DUTY_FG), additional duty flag A - as in every filed BE
    if (d._aidcNotn) { rows.push({ dutyType: /^G/.test(d._aidcFlag) ? 'G' : 'C', addlDutyFlag: 'A', igstFlag: '', notificationNo: d._aidcNotn, notificationSrNo: d._aidcSr, exmpNotificationNo: '', exmpNotificationSrNo: '' });
      it.otherDutyData = { 'Infra Cess_notnNo': d._aidcNotn, 'Infra Cess_srNo': d._aidcSr }; it.otherDutyFlag = 'Y'; }
    if (rows.length) { it.dutyRows = rows; it.igstDutyFlag = 'Y'; }
    // licence / scheme (DEPB) typed on the item line
    if (d._licNo || d._schemeCode) {
      it.licenceData = [{ id: newId(i), licenceNo: txt(d._licNo), licenceDate: d._licDate, licenceCode: d._schemeCode, regnPort: d._licPort, itemSrNoLicence: txt(d._licItemSr), debitValue: '', debitQty: '', debitUqc: '', licUrn: d._licUrn,
        exemptionNotn: d._exemptionFlag === 'Y' ? d._schemeNotn : '', exemptionSrNo: d._exemptionFlag === 'Y' ? d._schemeSr : '' }];
      it.licenceFlag = 'Y';
      if (d._exemptionFlag === 'Y' && d._schemeNotn) it.depbData = [{ whetherExemption: 'Y', bcdNotification: d._schemeNotn, bcdNotificationSrNo: d._schemeSr || '' }]; // 30-Oct-2026: no invented Sr No "1" (the filing validator asks for it)
    }
    // re-import (previous shipping bill)
    if (d._sbNo) { it.reimportData = { type: 'Y', shippingBillNo: txt(d._sbNo), shippingBillDate: d._sbDate, portOfExport: d._sbPort, invoiceNoSb: txt(d._sbInv), itemNoSb: txt(d._sbItem), notificationNo: d._reNotn, notificationSrNo: d._reSr,
      exportFreight: d._sbFrt, exportInsurance: d._sbIns, customsDuty: d._sbCus, exciseDuty: d._sbExc }; it.whetherReimport = 'Y'; it.reImportFlag = 'Y'; }
    if (d._rspAmt) { it.rspData = { rspValue: d._rspAmt, rspAmount: d._rspAmt }; it.rspDutyFlag = d._rspFlag || 'Y'; }
    else if (d._rspFlag) it.rspDutyFlag = d._rspFlag;
    if (d._svbVal || d._svbDuty) { it.svbData = { refNo: '', date: '', loadType: d._svbVal && d._svbDuty ? 'B' : (d._svbVal ? 'A' : (d._svbDuty ? 'D' : '')), loadValue: d._svbVal, loadDuty: d._svbDuty, valueStatus: '', dutyStatus: '', customHouse: '' }; it.svbFlag = 'Y'; }
    if (d._ppNo || d._ppYear) { it.policyParaData = { paraNo: txt(d._ppNo), year: txt(d._ppYear) }; it.policyParaFlag = 'Y'; }
    if (d._pbNo) { it.prevBeData = { beNo: txt(d._pbNo), beDate: d._pbDate, unitPrice: d._pbPrice, currency: d._pbCur, customHouse: d._pbCh }; it.previousBeFlag = 'Y'; }
    // Single Window info rows typed on the item line: SIMS registration, certificate of origin (CAROTAR) particulars
    const info = [];
    if (d._simsCode || d._simsText) info.push({ agency: 'ALL', type: 'PNM', qualifier: 'SIU', code: txt(d._simsCode), text: txt(d._simsText), qty: '', uqc: '' });
    if (d._cooCode || d._cooText) info.push({ agency: 'ALL', type: 'ORC', qualifier: 'COO', code: d._cooCode, text: txt(d._cooText), qty: '', uqc: '' });
    if (d._orgQual === 'COWO') info.push({ agency: 'ALL', type: 'ORC', qualifier: 'ORG', code: 'COWO', text: '', qty: '', uqc: '' });
    else if (d._orgQual || d._orgCode) info.push({ agency: 'ALL', type: 'ORC', qualifier: 'ORG', code: d._orgCode || 'COOG', text: txt(d._orgText), qty: '', uqc: d._orgUqc });
    if (d._acm) info.push({ agency: 'ALL', type: 'ORC', qualifier: 'ACM', code: d._acm, text: '', qty: '', uqc: '' });
    if (d._ris) info.push({ agency: 'ALL', type: 'ORC', qualifier: 'RIS', code: d._ris, text: '', qty: '', uqc: '' });
    if (d._dc) info.push({ agency: 'ALL', type: 'ORC', qualifier: 'DC', code: d._dc, text: '', qty: '', uqc: '' });
    if (info.length) { it.swInfoData = info.map((r, k) => ({ id: newId(k), ...r })); it.swInfotypeFlag = 'Y'; }
    items.push(it);
  });
  found.items = items.length;

  // ---- rows that attach to an item (SW sheets, item-level docs, SVB, licence, anti-dumping): to the file's own items,
  // or - no Items sheet - to the job's items (copies; the caller puts them back). 13-Nov-2026
  const onJob = !items.length && Array.isArray(existingItems) && existingItems.length > 0;
  const arrOf = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return Array.isArray(v) ? v : []; };
  const targets = onJob ? existingItems.map(it => ({ ...it })) : items;
  const srNorm = (v) => txt(v).replace(/\.0$/, '');
  const findItem = (d, where) => {
    const sr = srNorm(d.itemSrNo);
    const invSr = (d.invNo || d.invSrNo) ? srOf(d, where) : null;
    return targets.find(it => srNorm(it.itemSrNo ?? it.itemNo) === sr && (!invSr || srNorm(it.invSrNo || '1') === String(invSr)));
  };
  const sameRow = (a, b) => Object.keys(b).every(k => k === 'id' || String(a[k] ?? '').trim().toUpperCase() === String(b[k] ?? '').trim().toUpperCase());
  const attach = (sheet, key, flag, map) => {
    let n = 0, dup = 0;
    sheetRows(wb, sheet).forEach((row, i) => {
      const d = readRow(row, SHEET_COLS[sheet]);
      const it = findItem(d, `${sheet} row ${i + 2}`);
      if (!it) { warnings.push(`${sheet} row ${i + 2}: no matching item (Inv Sr No ${txt(d.invSrNo) || txt(d.invNo)} / Item Sr No ${txt(d.itemSrNo)})`); return; }
      const r = map(d, it); if (!r) return;
      const have = arrOf(it[key]);
      if (onJob && have.some(h => sameRow(h, r))) { dup++; return; } // the same row uploaded again
      it[key] = [...have, { id: newId(i), ...r }];
      if (flag) it[flag] = 'Y'; n++;
    });
    if (n) found[sheet] = n;
    if (dup) warnings.push(`${sheet}: ${dup} row(s) already on the item - skipped`);
  };
  attach('SW_InfoType', 'swInfoData', 'swInfotypeFlag', d => ({ agency: 'ALL', type: d.type, qualifier: d.qualifier, code: txt(d.code), text: txt(d.text), qty: d.qty, uqc: d.uqc }));
  attach('SW_Constituent', 'swConstData', 'swConstituentFlag', d => ({ srNo: txt(d.srNo), name: d.name, code: txt(d.code), percent: d.percent, yield: d.yield, active: d.active || '' })); // 30-Oct-2026: the active-ingredient flag is typed, not assumed
  attach('SW_Production', 'swProdData', 'swProductionFlag', d => ({ batch: txt(d.batch), qty: d.qty, uqc: d.uqc, mnfDate: d.mnfDate, expDate: d.expDate, bestBefore: d.bestBefore }));
  attach('SW_Control', 'swCtrlData', 'swControlFlag', d => ({ typeCode: d.typeCode, location: d.location, startDate: d.startDate, endDate: d.endDate, resultCode: txt(d.resultCode), resultText: d.resultText, slNo: txt(d.slNo).replace(/\.0$/, '') }));
  attach('Licence', 'licenceData', 'licenceFlag', (d, it) => {
    const r = { licenceNo: txt(d.licenceNo) || txt(d.licenceNoRaw), licenceDate: d.licenceDate || d.licenceDateRaw, licenceCode: d.licenceCode, regnPort: d.regnPort, itemSrNoLicence: txt(d.itemSrNoLicence), debitValue: d.debitValue, debitDuty: d.debitDuty, debitQty: d.debitQty, debitUqc: d.debitUqc, licUrn: txt(d.licUrn),
      exemptionNotn: d.exemptionFlag === 'Y' ? txt(d.exemptionNotn) : '', exemptionSrNo: d.exemptionFlag === 'Y' ? txt(d.exemptionSrNo) : '' };
    if (d.exemptionFlag === 'Y' && d.exemptionNotn) it.depbData = [...(Array.isArray(it.depbData) ? it.depbData : []), { whetherExemption: 'Y', bcdNotification: txt(d.exemptionNotn), bcdNotificationSrNo: txt(d.exemptionSrNo) || '' }];
    return r;
  });
  // one SVB block per item (last row wins); "Save In All" copies it to every item of that invoice
  let svbAll = null;
  sheetRows(wb, 'Item_SVB').forEach((row, i) => {
    const d = readRow(row, SVB_COLS);
    if (!d.refNo && !d.loadValue && !d.loadDuty) return;
    const it = findItem(d, `Item_SVB row ${i + 2}`);
    const svb = { refNo: txt(d.refNo), date: d.date, customHouse: d.customHouse, customHouse1: d.customHouse, loadType: d.loadType || (d.loadValue && d.loadDuty ? 'B' : (d.loadValue ? 'A' : (d.loadDuty ? 'D' : ''))), loadValue: d.loadValue, valueStatus: d.valueStatus, loadDuty: d.loadDuty, dutyStatus: d.dutyStatus };
    if (!it) { warnings.push(`Item_SVB row ${i + 2}: no matching item`); return; }
    it.svbData = svb; it.svbFlag = 'Y'; found.Item_SVB = (found.Item_SVB || 0) + 1;
    if (d.saveInAll === 'Y') svbAll = { inv: it.invSrNo, svb };
  });
  if (svbAll) targets.filter(it => it.invSrNo === svbAll.inv && !it.svbData).forEach(it => { it.svbData = { ...svbAll.svb }; it.svbFlag = 'Y'; });
  sheetRows(wb, 'Antidumping').forEach((row, i) => {
    const d = readRow(row, ADD_COLS);
    if (!d.notnNo) return;
    const it = findItem(d, `Antidumping row ${i + 2}`);
    if (!it) { warnings.push(`Antidumping row ${i + 2}: no matching item`); return; }
    if (d.isRemove === 'Y') { /* the other ERP's "IsRemove" = row is a removal; nothing to add */ }
    const add = { type: txt(d.type), notnNo: txt(d.notnNo), srNo: txt(d.srNo), cth: txt(d.cth), qty: d.qty, uqc: d.uqc, supSlNo: txt(d.supSlNo), flag: d.flag, currency: d.currency, rate: d.rate, amount: d.amount, currencyRate: '', difference: '' };
    it.addData = add; it.antiDumpingData = add; it.antiDumpingDutyFlag = 'Y';
    it.antiDumpingDutyNotification = add.notnNo; it.antiDumpingDutySerialNumber = add.srNo; it.cthSerialNumber = add.cth; it.supplierSerialNumber = add.supSlNo; it.quantityAsPerAntiDumpingNotn = add.qty;
    found.Antidumping = (found.Antidumping || 0) + 1;
  });

  // ---- statements: item rows to the item (swStmtData); BE (0/0) and invoice (inv/0) rows to the job
  const statements = [];
  sheetRows(wb, 'SW_Statement').forEach((row, i) => {
    const d = readRow(row, SW_COLS.SW_Statement);
    if (!d.stmtCode) return;
    const itemSr = txt(d.itemSrNo).replace(/\.0$/, '') || '0';
    const typeCode = ({ DECLARATION: 'DEC', UNDERTAKING: 'UTG', REMARK: 'REM' })[d.typeCode] || d.typeCode || 'DEC';
    if (itemSr === '0') {
      const invSr = (d.invNo || (txt(d.invSrNo) && txt(d.invSrNo) !== '0')) ? srOf(d, `SW_Statement row ${i + 2}`) : '0';
      statements.push({ invoiceSrNo: invSr, itemSrNo: '0', statementType: typeCode, statementCode: d.stmtCode, statementText: d.stmtText, declarationType: 'B' });
      return;
    }
    const it = findItem(d, `SW_Statement row ${i + 2}`);
    if (!it) { warnings.push(`SW_Statement row ${i + 2}: no matching item`); return; }
    it.swStmtData = [...(Array.isArray(it.swStmtData) ? it.swStmtData : []), { id: newId(i), typeCode, stmtCode: d.stmtCode, stmtText: d.stmtText, stmtFor: 'Item' }];
    it.swStatementFlag = 'Y'; found.SW_Statement = (found.SW_Statement || 0) + 1;
  });
  if (statements.length) found.SW_Statement = (found.SW_Statement || 0) + statements.length;

  // ---- supporting (e-Sanchit) docs: item rows to the item popup, BE / invoice rows to tab 5
  const jobDocs = [];
  sheetRows(wb, 'Supporting_Docs').forEach((row, i) => {
    const d = readRow(row, DOC_COLS);
    if (!d.irn && !d.docCode) return;
    // the other ERP's party columns may be named only by prefix (DOC_ISSUING_PARTY_… / DOC_BENEFICIARY_PARTY_…)
    { const p = prefixVals(row, 'DOC_ISSUING_PARTY'); if (p.length === 6) [d.issuerName, d.issuerCode, d.issuerAddr1, d.issuerAddr2, d.issuerCity, d.issuerPin] = p; }
    { const p = prefixVals(row, 'DOC_BENEFICIARY_PARTY'); if (p.length === 6) [d.beneName, d.beneCode, d.beneAddr1, d.beneAddr2, d.beneCity, d.benePin] = p; }
    const irn = txt(d.irn);
    if (irn && !/^\d{16}$/.test(irn)) warnings.push(`Supporting_Docs row ${i + 2}: IRN "${irn}" is not the 16-digit e-Sanchit number`);
    const itemSr = txt(d.itemSrNo).replace(/\.0$/, '') || '0';
    const invGiven = d.invNo || (txt(d.invSrNo) && txt(d.invSrNo) !== '0');
    const base = { irn, drn: txt(d.drn), docCode: txt(d.docCode), docName: '', fileName: '', fileType: d.fileType || 'PDF', issuerCode: txt(d.issuerCode), issuerName: d.issuerName, issuerAddr1: d.issuerAddr1, issuerAddr2: d.issuerAddr2, issuerCity: d.issuerCity, issuerPin: txt(d.issuerPin),
      beneCode: txt(d.beneCode), beneName: d.beneName, beneAddr1: d.beneAddr1, beneAddr2: d.beneAddr2, beneCity: d.beneCity, benePin: txt(d.benePin), placeOfIssue: d.placeOfIssue, issueDate: d.issueDate, expiryDate: d.expiryDate,
      isDiffId: !!txt(d.icegateId), icegateId: txt(d.icegateId), isApplicable: true };
    if (itemSr !== '0') {
      const it = findItem(d, `Supporting_Docs row ${i + 2}`);
      if (!it) { warnings.push(`Supporting_Docs row ${i + 2}: no matching item`); return; }
      it.docsData = [...(Array.isArray(it.docsData) ? it.docsData : []), { id: `doc-${Date.now()}-${i}`, ...base, docFor: 'ITEM', invSrNo: it.invSrNo, itemSrNo: it.itemSrNo }];
      it.supportingDocsFlag = 'Y';
    } else if (invGiven) {
      jobDocs.push({ id: `doc-${Date.now()}-${i}`, ...base, docFor: 'INVOICE', invSrNo: srOf(d, `Supporting_Docs row ${i + 2}`), itemSrNo: '' });
    } else {
      jobDocs.push({ id: `doc-${Date.now()}-${i}`, ...base, docFor: 'HEADER', invSrNo: '', itemSrNo: '' });
    }
    found.Supporting_Docs = (found.Supporting_Docs || 0) + 1;
  });

  // ---- containers
  const containers = [];
  sheetRows(wb, 'Containers').forEach((row, i) => {
    const d = readRow(row, CONT_COLS);
    if (!d.contNo) return;
    const lf = String(d.lclFcl || '').charAt(0);
    containers.push({ id: newId(i), srNo: txt(d.srNo) || String(containers.length + 1), igmNumber: txt(d.igmNumber), igmDate: d.igmDate, contNo: d.contNo, sealNo: txt(d.sealNo),
      lclFcl: lf === 'F' ? 'FCL' : lf === 'L' ? 'LCL' : '', contSize: txt(d.contSize).replace(/\.0$/, ''), contType: d.contType, truckNo: d.truckNo, locationId: txt(d.locationId) });
  });
  if (containers.length) found.Containers = containers.length;

  return { invoices: fileInvoices, items, containers, jobDocs, statements, warnings, found,
    itemsOnJob: onJob && Object.entries(found).some(([k, v]) => k !== 'items' && k !== 'Containers' && v) ? targets : null };
}

/**
 * Merge what the file holds into the job: invoices matched on Invoice No (update) else added; items replaced or
 * appended (replace = true/false, asked by the caller); containers / tab-5 docs / job statements added when not there.
 * Returns { invoices, items, jobDataPatch, esanchitDocs, summary } - nothing is set here (the two tabs keep their own state).
 */
export function mergeJobWorkbook(read, { invoices = [], items = [], jobData = {}, esanchitDocs = [], replaceItems = false }) {
  const invKey = (iv) => txt(iv.invNo || iv.invoiceNo).replace(/\s+/g, '').toUpperCase(); // "INV 1" and "inv1" are the same invoice (30-Oct-2026)
  let newInvoices = [...invoices]; let invAdded = 0, invUpdated = 0;
  read.invoices.forEach(fi => {
    const { id, ...data } = fi;
    const at = newInvoices.findIndex(iv => invKey(iv) === invKey(fi));
    if (at >= 0) { newInvoices = newInvoices.map((iv, j) => j === at ? { ...iv, ...data } : iv); invUpdated++; }
    else { newInvoices.push({ id, ...data }); invAdded++; }
  });
  // items: same Inv Sr No + Item Sr No already on the job (append mode) -> next free number
  const keep = replaceItems ? [] : [...items];
  const notes = [];
  const readItems = read.items.map(it => ({ ...it }));
  const clash = readItems.filter(n => keep.some(o => String(o.invSrNo) === String(n.invSrNo) && String(o.itemSrNo) === String(n.itemSrNo)));
  if (clash.length) {
    const nextSr = {};
    clash.forEach(n => { const k = String(n.invSrNo); nextSr[k] = Math.max(nextSr[k] || 0, ...[...keep, ...readItems].filter(x => String(x.invSrNo) === k).map(x => parseInt(x.itemSrNo, 10) || 0)) + 1; n.itemSrNo = String(nextSr[k]); n.itemNo = n.itemSrNo; });
    notes.push(clash.length + ' item(s) renumbered because that Item Sr No already exists');
  }
  // item Inv No from the merged invoice list (file gave only the Sr No)
  readItems.forEach(it => { if (!it.invNo) it.invNo = txt((newInvoices[parseInt(it.invSrNo, 10) - 1] || {}).invNo || ''); });
  const newItems = read.items.length ? [...keep, ...readItems] : (read.itemsOnJob || items);

  const jobDataPatch = {};
  if (read.containers.length) {
    const have = Array.isArray(jobData.containers) ? jobData.containers : [];
    const add = read.containers.filter(c => !have.some(h => txt(h.contNo).toUpperCase() === txt(c.contNo).toUpperCase()));
    jobDataPatch.containers = [...have, ...add];
    if (add.length < read.containers.length) notes.push((read.containers.length - add.length) + ' container(s) already on the job - skipped');
  }
  if (read.statements.length) {
    let have = jobData._statements; if (typeof have === 'string') { try { have = JSON.parse(have); } catch (e) { have = []; } }
    have = Array.isArray(have) ? have : [];
    const key = (s) => [s.invoiceSrNo || s.invoiceSerialNumber || '0', s.itemSrNo || s.itemSerialNumber || '0', s.statementType, s.statementCode].join('|');
    const add = read.statements.filter(s => !have.some(h => key(h) === key(s)));
    if (add.length) jobDataPatch._statements = [...have, ...add];
  }
  let newDocs = Array.isArray(esanchitDocs) ? esanchitDocs : [];
  if (read.jobDocs.length) {
    const add = read.jobDocs.filter(d => !d.irn || !newDocs.some(h => txt(h.irn) === d.irn && String(h.docFor || 'HEADER') === d.docFor && String(h.invSrNo || '') === String(d.invSrNo || '')));
    newDocs = [...newDocs, ...add];
    if (add.length < read.jobDocs.length) notes.push((read.jobDocs.length - add.length) + ' supporting doc(s) already on the job (same IRN) - skipped');
  }
  const parts = [];
  if (invAdded || invUpdated) parts.push(`${invAdded} invoice(s) added, ${invUpdated} updated`);
  if (read.items.length) parts.push(`${read.items.length} item(s) ${replaceItems ? 'replaced the old ones' : 'imported'}`);
  if (read.itemsOnJob) parts.push('added to the job\'s items');
  if (read.containers.length) parts.push(`${read.containers.length} container(s)`);
  if (read.jobDocs.length) parts.push(`${read.jobDocs.length} BE/invoice doc(s)`);
  ['SW_InfoType', 'SW_Constituent', 'SW_Production', 'SW_Control', 'Licence', 'Item_SVB', 'Antidumping', 'Supporting_Docs', 'SW_Statement'].forEach(k => { if (read.found[k]) parts.push(`${read.found[k]} ${k.replace('_', ' ')} row(s)`); });
  return { invoices: newInvoices, items: newItems, jobDataPatch, esanchitDocs: newDocs, summary: parts.join(', ') || 'nothing found in the file', notes: [...notes, ...read.warnings] };
}

// ---------------------------------------------------------------------------------------------------------------
// after an import: duty rates + duty amounts
// The other ERP's workbook carries notification numbers but no rates, so the duty estimate came out 0. Blank BCD / IGST
// rates (and UQC) are taken from the Tariff master (/api/tariff/:ritc) - values already in the row are kept.
export async function fillRatesFromTariff(items, fetchFn) {
  const doFetch = fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { items, filled: 0, notFound: [] };
  const igOf = (it) => { let ig = it.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } } return ig && typeof ig === 'object' ? ig : null; };
  const needs = (it) => !String(it.bcdRate ?? '').trim() || !String((igOf(it) || {}).rate ?? '').trim() || !String(it.unit || it.uqc || '').trim() || !String(it.bcdSpecAmount ?? '').trim();
  const codes = [...new Set(items.filter(needs).map(it => String(it.ritc || it.hsCode || '').replace(/\D/g, '')).filter(c => c.length >= 4))];
  const found = {};
  const notFound = [];
  await Promise.all(codes.map(async (c) => {
    // 30-Oct-2026: only an exact 8-digit line fills rates; a nearest-heading answer counts as not found
    try { const r = await doFetch('/api/tariff/' + c); const j = await r.json(); if (j && j.success && j.data && j.data.exact !== false) found[c] = j.data; else notFound.push(c); }
    catch (e) { notFound.push(c); }
  }));
  let filled = 0;
  const out = items.map(it => {
    if (!needs(it)) return it;
    const t = found[String(it.ritc || it.hsCode || '').replace(/\D/g, '')];
    if (!t) return it;
    const n = { ...it }; let did = false;
    if (!String(n.bcdRate ?? '').trim() && t.bcdRate != null) { n.bcdRate = String(t.bcdRate); did = true; }
    // 30-Oct-2026: the tariff's specific side (Rs per kg / per 1000 / per tonne) and how it combines with the
    // percentage were left behind, so "20% or Rs 115 per kg, whichever is higher" filled in as a bare 20%.
    // 18-Nov-2026: only a real specific rate - a tariff line with Rs 0 put "0" on every item (job NDL/AI/200001: 283 items),
    // and the checklist then listed each one as "BCD by rate applied (the other side came to Rs 0.00)"
    if (t.bcd && parseFloat(t.bcd.amount) > 0 && !String(n.bcdSpecAmount ?? '').trim()) {
      n.bcdSpecAmount = String(t.bcd.amount);
      if (!String(n.bcdUnit ?? '').trim() && t.bcd.uqc) n.bcdUnit = String(t.bcd.uqc).toUpperCase();
      if (!String(n.bcdRateBasis ?? '').trim() && t.bcd.basis) n.bcdRateBasis = String(t.bcd.basis);
      did = true;
    }
    const ig = igOf(n);
    if (t.igstRate != null && !String((ig || {}).rate ?? '').trim()) { n.igstData = { notnNo: '', srNo: '', flag: 'A', amount: '', ...(ig || {}), rate: String(t.igstRate) }; n.igstDutyFlag = 'Y'; did = true; }
    if (!String(n.unit || n.uqc || '').trim() && t.uqc) { n.unit = t.uqc; n.uqc = t.uqc; did = true; }
    if (did) filled++;
    return n;
  });
  return { items: out, filled, notFound };
}

// the same figures as the Item tab's Re-Calculate button: duty amounts per item + the totals strip values
export function recalcDuty(items, invoices, jobData) {
  let cif = 0, duty = 0, noRate = 0;
  const next = items.map(it => {
    const d = computeItemDuty(it, invoices, jobData);
    if (!d.rateFound) { noRate++; return it; }
    cif += d.av; duty += d.total;
    let ig = it.igstData; if (typeof ig === 'string') { try { ig = JSON.parse(ig); } catch (e) { ig = null; } }
    return { ...it, value: it.value || (d.itemValue ? d.itemValue.toFixed(2) : it.value), assessableValueInr: d.av.toFixed(2),
      bcdAmount: d.bcd.toFixed(2), swsAmount: d.sws.toFixed(2), healthCessAmount: d.health ? d.health.toFixed(2) : it.healthCessAmount,
      igstData: ig ? { ...ig, amount: d.igst.toFixed(2) } : ig, totalDuty: d.total.toFixed(2) };
  });
  const itemTotal = next.reduce((s, it) => s + ((parseFloat(it.qty || it.quantity) * parseFloat(it.price || it.unitPrice)) || parseFloat(it.value) || 0), 0);
  return { items: next, totals: { itemTotal: itemTotal.toFixed(2), cifTotalInr: cif.toFixed(2), invTotal: cif.toFixed(2), totalDuty: duty.toFixed(2) }, noRate, cif, duty };
}
