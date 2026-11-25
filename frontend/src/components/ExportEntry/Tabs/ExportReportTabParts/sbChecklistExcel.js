// The S/B checklist as one Excel sheet - the same values as the checklist on the screen.
import { hidesInsurance, igstPayStatusOf } from './checklistData';

const ITEM_HEADINGS = ['INV SR', 'INV NO', 'ITEM NO', 'RITC', 'DESCRIPTION', 'QTY', 'UNIT', 'RATE', 'TOTAL VALUE', 'FOB (FC)', 'FOB (INR)', 'SCHEME', 'REWARD', 'RODTEP',
  'PMV (INR/UNIT)', 'TOTAL PMV (INR)', 'END USE', 'IGST PAY STATUS', 'TAXABLE VALUE', 'IGST %', 'IGST AMT', 'HAWB NO', 'TOTAL PKG', 'SOURCE STATE', 'TRANSIT COUNTRY'];
const amountText = (amount) => (amount === null ? '' : (amount || 0).toFixed(2));

function invoiceBlock({ invoice, index, no, date, valInr, fobInr, fobFc, contract, rate, buyer, buyerAddr, charges }, invoiceCount) {
  const noInsurance = hidesInsurance(contract);
  return [
    [],
    ['INVOICE DETAILS', `INVOICE NO. ${index + 1} of ${invoiceCount}`],
    ['INV. VAL', invoice.value || invoice.invoiceValue || '', invoice.currency || '', valInr ? valInr + ' (INR)' : ''],
    ['FOB VAL (INR)', fobInr, 'FOB FC', fobFc ? `${fobFc} (${invoice.currency || ''})` : ''],
    ['INVOICE NO.', no, 'INVOICE DATE', date],
    ['INV CURR', invoice.currency || '', 'NATURE OF CONTRACT', contract],
    ['EXCHANGE RATE', rate, 'CONTRACT NO.', invoice.contractNo || ''],
    ['', 'RATE', 'CUR', 'AMOUNT'],
    ...charges.map((charge) => {
      const hide = charge.label === 'Insurance' && noInsurance;
      return [charge.label.toUpperCase(), hide ? '' : charge.rate, hide ? '' : charge.currency, hide ? '' : charge.amount];
    }),
    ['NATURE OF PAYMENT', String(invoice.pymtNature || '').split('||')[0].trim(), 'PAYMENT PRD.', invoice.pymtPeriod ? invoice.pymtPeriod + ' DAYS' : ''],
    ["BUYER'S NAME & ADDRESS", [buyer, ...buyerAddr].join('\n')],
  ];
}

const itemLine = (row) => {
  const { item } = row;
  const igstAmount = parseFloat(item?.igstAmt || 0);
  return [
    row.invSr, row.invNo, row.itemSr, item.ritc || '', item.desc || item.description || '', row.qty, row.unit, row.rate, row.total, row.fobFc, row.fobInr,
    row.scheme, row.reward, row.rosctl === 'Y' ? 'RoSCTL' : row.rodtep, row.unitPmv, row.totalPmv, item.endUse || '', igstPayStatusOf(item),
    parseFloat(item.taxableValue || 0).toFixed(2), row.igstRate, igstAmount.toFixed(2), row.hawb, row.totalPkg, row.sourceState, row.transitCountry,
  ];
};

// a titled block of rows, left out when there are no rows
const block = (title, headings, lines, totalLine) => (lines.length ? [[], [title], headings, ...lines, ...(totalLine ? [totalLine] : [])] : []);

export function checklistSheetRows({ exportData, containers, checklist, singleWindow, totals, infoCodeText, docTypeText }) {
  const job = exportData || {};
  const { statements, infos, docs } = singleWindow;
  return [
    ['INDIAN CUSTOM EDI SYSTEM/EXPORT (ICES/E)'],
    ['SHIPPING BILL FOR EXPORT'],
    ...(checklist.chaName ? [[checklist.chaName]] : []),
    [checklist.cha],
    [`Scheme Desc : ${checklist.schemes.join(', ')}`],
    [],
    ['JOB NO', job.jobNo || '', 'JOB DT', checklist.jobDate, 'USER JOB NO', checklist.userJobNo],
    ['SB NO', checklist.sbNo, 'SB DT', checklist.sbDate, '', ''],
    ['PORT OF LOADING', checklist.loadPort, '', '', 'CHA', checklist.cha],
    ['', '', '', '', 'STATE/ORIG', job.stateOriginName || job.stateOriginCode || ''],
    [],
    ['EXPORTER DETAILS', '', '', 'CONSIGNEE DETAILS'],
    [checklist.iec, '', '', job.consigneeName || ''],
    [`Branch Code : ${checklist.branch}`, '', '', job.consigneeAddress1 || ''],
    [`GSTIN Type : ${checklist.gstinType}`, '', '', job.consigneeAddress2 || ''],
    [`GSTIN Id : ${checklist.gstinId}`, '', '', `${job.consigneeAddress3 || ''} ${job.consigneeAddress4 || ''}`.trim()],
    [`PAN No : ${checklist.pan}`, '', '', checklist.consigneeCountry],
    [`Exp Type : ${checklist.expType}`, '', '', ''],
    [job.shipperName || '', '', '', ''],
    [`${job.shipperAddress1 || ''} ${job.shipperAddress2 || ''}`.trim(), '', '', ''],
    [`${job.shipperCity || ''} ${job.shipperState || ''} ${job.shipperPin || ''}`.trim(), '', '', ''],
    [],
    ['PORT OF LOADING', checklist.loadPort],
    ['COUNTRY OF FINAL DEST.', checklist.destCountry, 'PORT OF FINAL DESTINATION', checklist.destPort],
    ['DISCHARGE COUNTRY', checklist.discCountry, 'DISCHARGE PORT', checklist.discPort],
    ['GROSS WT.', checklist.gross, 'NET WT.', checklist.net],
    ['TOTAL PKGS.', checklist.pkgs, 'LOOSE PKGS', checklist.loose],
    ['NATURE CARGO.', checklist.natureCargo, 'NO. OF CTNS.', (job.Containers || []).length || containers?.length || 0],
    ['MASTER AWB / BL', checklist.mawb, 'HOUSE AWB / BL', checklist.hawb],
    ['DBK BANK A/C NO', job.drawbackAcNo || '', 'FOREX BANK A/C NO.', job.forexCode || ''],
    ['SERVICE TAX REFUND(Y/N)', job.serviceTaxRefund || 'N', 'AD CODE', job.adCode || ''],
    ['RBI WAI. NO / RBI WAI. DATE', [job.rbiWaiverNo, job.rbiWaiverDate].filter(Boolean).join(' / '), 'IFSC CODE', job.ifscCd || ''],
    ['MARKS & NO.', `${job.autoField_16 || ''}\n${job.thisDisplayOnlyInChecklistNotInCustomFlatFile || ''}`.trim()],
    ['TOTAL TAXABLE VALUE', totals.taxable, 'TOTAL IGST AMT', totals.igst],
    ...checklist.invoices.flatMap((invoice) => invoiceBlock(invoice, checklist.invoices.length)),
    [],
    ['ITEM DETAILS'],
    ITEM_HEADINGS,
    ...checklist.itemRows.map(itemLine),
    ...block('DRAWBACK DETAILS', ['INV NO', 'ITEM NO', 'DBK SR NO', 'RATE %', 'RATE RS/UNIT', 'CAP RS/UNIT', 'DBK QTY', 'UNIT', 'DBK AMT (INR)'],
      checklist.dbkRows.map((row) => [row.invNo, row.itemNo, row.dbkNo || '', row.dbkRtAdv || '', row.dbkRtSpe || '', row.dbkCap || '', row.dbkQty || '', row.accUnit || '', row.amt === null ? '' : row.amt.toFixed(2)]),
      ['', '', '', '', '', '', '', 'TOTAL', checklist.dbkTotal.toFixed(2)]),
    ...block('ROSCTL DETAILS', ['INV NO', 'ITEM NO', 'ROSCTL SL NO', 'STATE %', 'STATE CAP', 'CENTRAL %', 'CENTRAL CAP', 'QTY', 'FOB (INR)', 'ROSCTL AMT (INR)'],
      checklist.rosctlRows.map((row) => [row.inv, row.itm, row.slNo || 'NOT IN SCHEDULE', row.split ? row.split.stateRate : row.rate, row.split ? row.split.stateCap : '',
        row.split ? row.split.centralRate : '', row.split ? row.split.centralCap : '', row.qty, row.fob.toFixed(2), amountText(row.amt)]),
      ['', '', '', '', '', '', '', '', 'TOTAL', checklist.rosctlTotal.toFixed(2)]),
    ...block('RODTEP DETAILS', ['INV SR', 'ITEM SR', 'FOB (INR)', 'QTY', 'UNIT', 'RATE %', 'CAP', 'RODTEP AMT (INR)', 'APPENDIX'],
      checklist.rodtepRows.map((row) => [row.invSr, row.itemSr, row.fob.toFixed(2), row.qty, row.unit,
        row.noRate ? 'NOT IN MASTER' : (row.rsPerUqc && !row.rate ? `RS ${row.rsPerUqc}/${row.unit}` : row.rate), row.cap || '', amountText(row.amt), row.appendix]),
      ['', '', '', '', '', '', 'TOTAL', checklist.rodtepTotal.toFixed(2)]),
    ...block('SINGLE WINDOW STATEMENT', ['INV NO/ITEM NO', 'STATEMENT FOR', 'STATEMENT TYPE', 'STATEMENT CODE'],
      statements.map((row) => [row.invItemNo, row.statementFor || '', row.statementType || '', row.statementCode || row.statementText || ''])),
    ...block('SINGLE WINDOW INFO', ['INV NO/ITEM NO', 'TYPE', 'QUALIFIER', 'CODE', 'TEXT', 'MEASUREMENT', 'UNIT'],
      infos.map((row) => [row.invItemNo, row.type || '', row.qualifier || '', infoCodeText(row), row.text || '', row.measurement || '', row.unit || ''])),
    ...block('SINGLE WINDOW SUPPORTING DOCUMENT', ['INV NO/ITEM NO', 'STATEMENT FOR', 'IRN NO', 'DOC TYPE', 'ISSUED PARTY', 'REF NO', 'PLACE', 'ISSUE DT', 'EXP DT', 'BNF PARTY', 'FILE', 'ICEGATE ID'],
      docs.map((row) => [row.invItemNo, row.statementFor || '', row.irnNo || '', docTypeText(row.docType), row.issuedParty || '', row.refNo || '', row.place || '',
        row.issueDt || '', row.expDt || '', row.bnfParty || '', row.fileName || '', row.ceSanchitId || ''])),
    [],
    ['TOTAL INV. VALUE (FC)', checklist.invTotal, 'TOTAL FOB (INR)', checklist.fobTotal],
    ['TOTAL DBK (INR)', checklist.dbkTotal.toFixed(2), checklist.hasRosctl ? 'TOTAL ROSCTL (INR)' : '', checklist.hasRosctl ? checklist.rosctlTotal.toFixed(2) : ''],
    ...(checklist.hasRodtep ? [['TOTAL RODTEP (INR)', checklist.rodtepTotal.toFixed(2)]] : []),
    ['TOTAL PMV (INR)', totals.pmv, 'TOTAL TAXABLE (INR)', totals.taxable],
    ['TOTAL IGST (INR)', totals.igst],
  ];
}
