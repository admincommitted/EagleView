// Values of the S/B checklist, read from the fields the export screens really use. One place for the screen, the
// print and the Excel file.
import { asList } from '../../../../utils/asList';
import { rateText } from '../../../../utils/cbicExchange';
import { invoiceRate, invoiceFobFc, contractOf } from '../../../../utils/exportFob';
import {
  num, schemeCodeOf, claimsRodtep, isRodtepItem, isRosctlItem, itemFobInr, rodtepAmount, rosctlRowsOf, rodtepRowOf, rodtepRateOf,
  rodtepQtyOf, itemUnitPmv, itemTotalPmv, claimSum,
} from '../Schemes/schemeUtils';
import { districtsOf } from '../ExportItemTabParts/districtCodes';

// 'YYYY-MM-DD' / 'YYYYMMDD' -> 'DD-MM-YYYY'
export const toDashDate = (value) => {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(value || ''));
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || '');
};
const checklistDate = (value) => (/invalid/i.test(String(value || '')) ? '' : toDashDate(value));
const fixed2 = (value) => num(value).toFixed(2);

// the CACHE01 request the server builds the Shipping Bill from
export const shippingBillRequest = ({ exportData, items, dbkItems, licenseItems }) => ({
  exportData: { ...(exportData || {}), dbkItems: dbkItems || [], licenseItems: licenseItems || [] },
  items,
  invoices: exportData?.invoices || [],
});

const levelOf = (invoiceSr, itemSr) => {
  if (String(itemSr || '0') !== '0') return 'ITEM';
  return String(invoiceSr || '0') !== '0' ? 'INVOICE' : 'SB';
};
const pairOf = (invoiceSr, itemSr) => `${invoiceSr} / ${itemSr}`;

const statementFromIcegate = (row) => ({
  invItemNo: pairOf(row.invoiceSerialNumber, row.itemSerialNumber), statementFor: levelOf(row.invoiceSerialNumber, row.itemSerialNumber),
  statementType: row.statementType, statementCode: row.statementCode, statementText: row.statementText,
});
const infoFromIcegate = (row, invItemNo) => ({
  invItemNo, type: row.infoType, qualifier: row.infoQualifier, code: row.infoCode, text: row.infoText, measurement: row.infoMeasure, unit: row.infouqc,
});
const docFromIcegate = (row) => ({
  invItemNo: pairOf(row.invoiceSerialNumber, row.itemSerialNumber), statementFor: levelOf(row.invoiceSerialNumber, row.itemSerialNumber),
  irnNo: row.imageReferenceNumber, docType: row.documentTypeCode, issuedParty: row.documentIssuingPartyName, refNo: row.documentReferenceNo,
  place: row.placeOfIssue, issueDt: toDashDate(row.documentIssueDate), expDt: toDashDate(row.documentExpiryDate),
  bnfParty: row.documentBeneficiaryPartyName, fileName: row.fileType, ceSanchitId: row.icegateId,
});
const docFromScreen = (doc, invItemNo, statementFor, fileName) => ({
  invItemNo, statementFor, irnNo: doc.irn, docType: doc.docCode, issuedParty: doc.issuerName || doc.issuingParty, refNo: doc.refNo || doc.drn,
  place: doc.placeOfIssue, issueDt: toDashDate(doc.issueDate), expDt: toDashDate(doc.expiryDate), bnfParty: doc.beneficiaryName || doc.beneficiaryParty, fileName,
});

// SW statements / SW info / supporting documents of the checklist are the rows of the Shipping Bill that will be filed
// (CACHE01 built by the server); until the server answers, the rows of the screen (the items' own rows and the rows
// kept with a job read from a file).
export function singleWindowRows(cache01, exportData, items) {
  const master = cache01 && cache01.master;
  if (master) {
    return {
      statements: asList(master.statement).map(statementFromIcegate),
      infos: asList(master.infoType).map((row) => infoFromIcegate(row, pairOf(row.invoiceSerialNumber, row.itemSerialNumber))),
      docs: asList(master.supportingDocs).map(docFromIcegate),
    };
  }
  const job = exportData || {};
  const jobPair = (row) => pairOf(row.invoiceSerialNumber ?? row.invSr ?? 0, row.itemSerialNumber ?? row.itemSr ?? 0);
  const statements = asList(job._statements).map((row) => ({ ...statementFromIcegate(row), invItemNo: jobPair(row) }));
  const infos = asList(job._infoTypes).map((row) => infoFromIcegate(row, jobPair(row)));
  const docs = [];
  (items || []).forEach((item, index) => {
    const invItemNo = pairOf(item.invSr || 1, item.itemSr || index + 1);
    asList(item.swStatements).forEach((statement) => statements.push({
      ...statement, invItemNo, statementFor: statement.statementFor || 'ITEM',
      statementType: statement.statementType || statement.stmtType || statement.type,
      statementCode: statement.statementCode || statement.stmtCode || statement.code,
    }));
    asList(item.swInfos).forEach((row) => infos.push({
      invItemNo, type: row.swInfoField1 || row.type, qualifier: row.swInfoField2 || row.qual || row.qualifier, code: row.swInfoField3 || row.code,
      text: row.swInfoField4 || row.text, measurement: row.swInfoField5 || row.msr || row.measurement, unit: row.swInfoField6 || row.uqc || row.unit,
    }));
    asList(item.supportDocs || item.eSanchitList).forEach((doc) => docs.push(docFromScreen(doc, invItemNo, String(doc.docFor || 'ITEM').toUpperCase(), doc.fileName || doc.fileType)));
  });
  asList(job.eSanchitList).forEach((doc) => {
    const icegate = doc && doc._icegate;
    docs.push(icegate ? docFromIcegate(icegate) : docFromScreen(doc, '0 / 0', 'SB', doc.fileType));
  });
  return { statements, infos, docs };
}

// names next to the codes, as iCAFFE prints them (SW info "06 - HARYANA", "60 - FARIDABAD")
export const infoCodeTextOf = (stateMaster, infos) => (row) => {
  const qualifier = String(row.qualifier || '').toUpperCase(), code = String(row.code || '').trim();
  if (!code) return '';
  if (qualifier === 'STO') {
    const state = (stateMaster || []).find((entry) => String(parseInt(entry.taxCode, 10)) === String(parseInt(code, 10)));
    return state ? `${code} - ${state.stateName}` : code;
  }
  if (qualifier === 'DOO') {
    const stateRow = (infos || []).find((other) => other.invItemNo === row.invItemNo && String(other.qualifier || '').toUpperCase() === 'STO');
    const district = stateRow ? districtsOf(stateRow.code).find(([districtCode]) => String(districtCode) === code) : null;
    return district ? `${code} - ${district[1]}` : code;
  }
  return code;
};

// doc type "331000 Commercial invoice which includes a packing list"
export const docTypeTextOf = (docMaster) => (docType) => {
  const code = String(docType || '').trim();
  const entry = code && (docMaster || []).find((row) => String(row.documentCode) === code);
  return entry ? `${code} ${entry.description}` : code;
};

// total PMV = per-unit PMV x qty when the item has no total
export function checklistTotals(exportData, items) {
  const sumOf = (valueOf) => (items || []).reduce((sum, item) => sum + valueOf(item), 0).toFixed(2);
  const pmv = sumOf(itemTotalPmv);
  const taxable = sumOf((item) => parseFloat(item.taxableValue) || 0);
  const igst = sumOf((item) => parseFloat(item.igstAmt) || 0);
  return {
    pmv: num(pmv) > 0 ? pmv : (exportData?.totalPmv || pmv),
    taxable: exportData?.totalTaxableValue || taxable,
    igst: exportData?.totalIgstAmount || igst,
  };
}

export const igstPayStatusOf = (item) => {
  if (parseFloat(item?.igstAmt || 0) > 0) return 'PAYMENT';
  return item?.igstPayStatus && item.igstPayStatus !== 'Select' ? item.igstPayStatus : 'LUT';
};

const EXPORTER_TYPES = { F: 'MANUFACTURER', M: 'MERCHANT', C: 'MERCHANT EXPORTER COURIER', D: 'MANUFACTURER EXPORTER COURIER' };
const NATURE_OF_CARGO = { P: 'P - PACKAGED', C: 'C - CONTAINERISED', CP: 'CP - CONTAINERISED & PACKAGED', LB: 'LB - LIQUID BULK', DB: 'DB - DRY BULK' };
// 19 / 60 as ICEGATE has them (the Scheme Code master says 60 = RoDTEP; ICEGATE 60 = Drawback + RoSCTL)
const ICEGATE_SCHEME_NAMES = { 19: 'DRAWBACK (DBK)', 60: 'DRAWBACK AND ROSCTL' };

const portText = (code, name) => (code ? `${name || ''} ( ${code} )`.trim() : (name || ''));
const joinFilled = (values, separator) => values.filter(Boolean).join(separator);

// the item's own RoDTEP / Reward switches first (as the SB); a file's rewardItem only when the item has neither
function rewardFlag(item) {
  const ownSwitch = item.rodtep || item.reward
    ? (/^Y/i.test(String(item.rodtep || '')) || /^Y/i.test(String(item.reward || '')) ? 'Y' : 'N')
    : '';
  const flag = ownSwitch || item.rewardItem || (isRosctlItem(item) || claimsRodtep(item) ? 'Y' : 'N');
  return String(flag).toUpperCase().slice(0, 1) || 'N';
}

const invoiceCharges = (invoice) => [
  ['Freight', invoice.freightRate, invoice.freightCurr, invoice.freightAmount],
  ['Insurance', invoice.insuranceRate, invoice.insuranceCurr, invoice.insuranceAmount],
  ['Commission', invoice.commissionRate, invoice.commissionCurr, invoice.commissionAmount],
  ['Discount', invoice.discountRate, invoice.discountCurr, invoice.discountAmount],
  ['Pack Chargs', invoice.packingRate, invoice.packingCurr, invoice.packingAmount],
  ['Oth. Deduc', invoice.otherRate || invoice.otherDeductionsRate, invoice.otherCurr || invoice.otherDeductionsCurr, invoice.otherAmount || invoice.otherDeductionsAmount],
].map(([label, rate, currency, amount]) => ({
  label,
  rate: rate || '',
  currency: String(amount ?? '').trim() !== '' ? (currency || invoice.currency || '') : (currency || ''),
  amount: amount ?? '',
}));

export function buildChecklist({ exportData, items, dbkItems, rodteps, rosctlMaster, schemeMaster, chaMaster, cache01 }) {
  const job = exportData || {};
  const fieldOf = (...keys) => {
    const key = keys.find((name) => job[name] !== undefined && job[name] !== null && String(job[name]).trim() !== '');
    return key === undefined ? '' : String(job[key]);
  };
  const schemeName = (code) => ICEGATE_SCHEME_NAMES[code] || ((schemeMaster || []).find((row) => String(row.code) === code) || {}).desc || '';
  const schemeText = (code) => `${code}${schemeName(code) ? ' - ' + schemeName(code) : ''}`;
  const invoices = job.invoices || [];
  const invoiceOfItem = (item) => invoices[(parseInt(item.invSr, 10) || 1) - 1] || {};
  const infoRows = Array.isArray(cache01?.master?.infoType) ? cache01.master.infoType : (Array.isArray(job._infoTypes) ? job._infoTypes : []);
  const hasRosctl = (items || []).some(isRosctlItem);

  const itemRows = (items || []).map((item, index) => {
    const invoice = invoiceOfItem(item);
    const exchangeRate = invoiceRate(invoice);
    const fob = itemFobInr(item);
    const code = schemeCodeOf(item);
    const taxable = num(item.taxableValue), igstAmount = num(item.igstAmt || item.igstAmount);
    return {
      item, index, invSr: item.invSr || 1, itemSr: item.itemSr || index + 1,
      invNo: invoice.no || invoice.invoiceNo || '', invDate: checklistDate(invoice.date || invoice.invoiceDate),
      qty: item.qty || item.quantity || '', unit: item.unit || item.uqc || '', rate: item.rate || item.price || item.unitPrice || '', total: item.totalFc || item.total || '',
      fobFc: exchangeRate && fob ? fixed2(fob / exchangeRate) : '', fobInr: fob ? fixed2(fob) : '', currency: invoice.currency || '',
      scheme: code ? schemeText(code) : '', reward: rewardFlag(item),
      rodtep: claimsRodtep(item) ? 'Y' : 'N', rosctl: isRosctlItem(item) ? 'Y' : 'N',
      unitPmv: itemUnitPmv(item) ? fixed2(itemUnitPmv(item)) : '', totalPmv: itemTotalPmv(item) ? fixed2(itemTotalPmv(item)) : '',
      igstRate: taxable > 0 && igstAmount > 0 ? (Math.round(igstAmount / taxable * 100000) / 1000).toFixed(3) : '',
      hawb: item.hawb || item.hawbNo || '', totalPkg: item.totalPkgs || item.totalPackage || '0', accessory: item.accessory || item.accessoryStatus || '',
      mfgType: item.mfgType || '', mfgCode: item.mfgCode || '', mfgAddr: joinFilled([item.mfgAddress1, item.mfgAddress2, item.mfgCity, item.mfgState, item.mfgPin], ', '),
      sourceState: item.sourceState || '', transitCountry: item.transitCountry || '',
    };
  });

  const dbkRows = (dbkItems || []).map((row) => ({ ...row, amt: String(row.dbkVal ?? '').trim() === '' ? null : num(row.dbkVal) }));
  // Appendix 4RE rate for AA / EOU / SEZ items; RoDTEP qty = SW info DTY / RDT in the schedule unit
  const rodtepRows = (items || [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isRodtepItem(item) && claimsRodtep(item))
    .map(({ item, index }) => {
      const rate = rodtepRateOf(rodtepRowOf(rodteps, item), item);
      const fob = itemFobInr(item);
      const quantity = rodtepQtyOf(item, infoRows, rate && rate.uqc);
      return {
        invSr: item.invSr || 1, itemSr: item.itemSr || index + 1, fob, qty: quantity.qty ? String(quantity.qty) : '', unit: quantity.unit || '',
        rate: rate ? rate.rate : 0, cap: rate ? rate.cap : 0, rsPerUqc: rate ? rate.rsPerUqc : 0, appendix: rate ? rate.appendix : '',
        amt: rate ? rodtepAmount({ fob, qty: quantity.qty, rate: rate.rate, cap: rate.cap, rsPerUqc: rate.rsPerUqc }) : 0,
        noRate: !rate, noQty: !!rate && quantity.from === 'NONE',
      };
    });
  const rosctlRows = hasRosctl ? rosctlRowsOf(items, dbkItems, rosctlMaster) : [];
  const totalOfRows = (rows) => claimSum(rows.map((row) => row.amt));

  const valueByCurrency = {};
  invoices.forEach((invoice) => {
    const currency = invoice.currency || '';
    valueByCurrency[currency] = (valueByCurrency[currency] || 0) + num(invoice.value || invoice.invoiceValue);
  });
  const schemeCodes = [...new Set(itemRows.map((row) => schemeCodeOf(row.item)).filter(Boolean))];
  const weightUnit = fieldOf('grWtUnit') || 'KGS';
  const chaNo = fieldOf('chaNo');

  return {
    jobDate: checklistDate(fieldOf('jobDate') || (job.etpDetails && job.etpDetails.JobDate) || ''),
    userJobNo: fieldOf('autoField_13'), sbNo: fieldOf('sbNo', 'sbNumber'), sbDate: checklistDate(fieldOf('autoField_26', 'sbDate')),
    iec: fieldOf('shipperIec', 'ieCode'), branch: fieldOf('shipperBranchSrNo', 'branchSrNo') || '0', gstinType: fieldOf('shipperGstinType', 'gstnType'),
    gstinId: fieldOf('shipperGstin', 'gstnId'), pan: fieldOf('autoField_12', 'panNo'),
    expType: EXPORTER_TYPES[fieldOf('mercManuf').toUpperCase()] || fieldOf('exporterType', 'ExpType'),
    cha: chaNo,
    chaName: fieldOf('chaName') || ((chaMaster || []).find((row) => String(row.chaCode || '').trim() === chaNo.trim()) || {}).chaName || '',
    loadPort: portText(fieldOf('customsPortCode', 'loadingPortCode'), fieldOf('customsPortName', 'loadingPortName')),
    destCountry: fieldOf('destCountryName') || fieldOf('destCountryCode'), destPort: portText(fieldOf('destPortCode'), fieldOf('destPortName')),
    discCountry: fieldOf('discCountryName', 'destCountryName') || fieldOf('discCountryCode', 'destCountryCode'),
    discPort: portText(fieldOf('discPortCode', 'destPortCode'), fieldOf('discPortName', 'destPortName')),
    consigneeCountry: fieldOf('consigneeCountry', 'consigneeCountryCode'),
    gross: fieldOf('autoField_18', 'grossWeight') ? `${fieldOf('autoField_18', 'grossWeight')} ${weightUnit}` : '',
    net: fieldOf('autoField_19') ? `${fieldOf('autoField_19')} ${weightUnit}` : '',
    pkgs: fieldOf('autoField_14', 'totalPackages') ? `${fieldOf('autoField_14', 'totalPackages')} ${fieldOf('pkgsUnit') || 'PKG'}` : '',
    loose: fieldOf('autoField_17') || '0',
    natureCargo: NATURE_OF_CARGO[fieldOf('natureOfCargo').toUpperCase()] || fieldOf('natureOfCargo'),
    mawb: joinFilled([fieldOf('autoField_22', 'mawbNo'), checklistDate(fieldOf('autoField_23', 'mawbDate'))], ' / '),
    hawb: joinFilled([fieldOf('autoField_24', 'hawbNo'), checklistDate(fieldOf('autoField_25', 'hawbDate'))], ' / '),
    schemes: schemeCodes.map(schemeText),
    invoices: invoices.map((invoice, index) => {
      const value = num(invoice.value || invoice.invoiceValue);
      return {
        invoice, index, no: invoice.no || invoice.invoiceNo || '', date: checklistDate(invoice.date || invoice.invoiceDate),
        valInr: invoiceRate(invoice) && value ? fixed2(value * invoiceRate(invoice)) : '',
        fobInr: invoice.invFobInr ? fixed2(invoice.invFobInr) : '', fobFc: invoiceFobFc(invoice), contract: contractOf(invoice),
        rate: rateText(invoice.currency, invoice.exchRate || invoice.exchangeRate, invoice.unitInRs),
        buyer: invoice.buyer || invoice.buyerName || '',
        buyerAddr: [invoice.buyerAddress1, invoice.buyerAddress2, invoice.buyerAddress3, invoice.buyerAddress4].filter(Boolean),
        charges: invoiceCharges(invoice),
      };
    }),
    itemRows, dbkRows, dbkTotal: totalOfRows(dbkRows), rodtepRows, rodtepTotal: totalOfRows(rodtepRows), rosctlRows, rosctlTotal: totalOfRows(rosctlRows),
    hasRodtep: rodtepRows.length > 0, hasRosctl,
    invTotal: Object.entries(valueByCurrency).filter(([, value]) => value).map(([currency, value]) => `${currency} ${value.toFixed(2)}`).join(' + '),
    fobTotal: fixed2(invoices.reduce((sum, invoice) => sum + num(invoice.invFobInr), 0)),
    preparedBy: fieldOf('enteredBy', 'createdBy'),
  };
}

// insurance is not part of a CF / FOB / EXW invoice
export const hidesInsurance = (contract) => ['CF', 'FOB', 'EXW'].includes(contract);
