import { blobErrorMessage, downloadBlob } from '@/lib/download';
import { fmtDate, todayIso } from '../ui';
import { accountsApi } from '../accountsApi';
import { FOREIGN_POS, TITLES, inWords, num, pdfFileName, round2 } from './gstMath';

// The tax invoice laid out as iCAFFE's: head with logo, Bill To + invoice box, shipment box, charge grid (SAC, Qty, Rate,
// Taxable, CGST / SGST / IGST), GST totals, amount in words, bank details, notes and registered office. A bulk invoice
// (several dockets) prints the bill with the charges added up charge by charge, then every docket with its charges.

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const fixed2 = (value) => num(value).toFixed(2);
const fixed3 = (value) => (String(value ?? '').trim() === '' ? '' : num(value).toFixed(3));
const inrWords = (value) => inWords(value).replace(/^Rupees /, 'INR ').replace(/^Minus Rupees /, 'Minus INR ');
const masterKey = (value) => String(value || '').trim().toUpperCase();
const titleCase = (text) => escapeHtml(text).replace(/\b([A-Z])([A-Z]+)\b/g, (word, first, rest) => first + rest.toLowerCase());
const isSeaDocket = (docketNo) => /\/S[EI]\//i.test(String(docketNo || ''));
const showNarration = (text) => text && !/not in iCAFFE GST print/i.test(text);
const NO_INVOICE = 'This bill has no GST invoice in EagleView';
// the QR and the print extras are optional: the invoice prints without them
const emptyOnError = async (request) => { try { return await request; } catch { return {}; } };

const css = (bulk) => `@page { size: A4; margin: 8mm 8mm ${bulk ? '14mm' : '8mm'} } * { box-sizing: border-box } body { margin: 0; padding: 0 2px; font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 8.6px; color: #111 }
    table { border-collapse: collapse; width: 100% } td, th { vertical-align: top } .r { text-align: right } .s { font-size: 7.6px; color: #444 } .red { color: #b91c1c } b { font-weight: 700 }
    .pg { border: 1px solid #333 }
    .hd td { vertical-align: middle } .hd .lg { width: 96px; padding: 8px 4px 8px 10px } .logo { width: 84px; display: block } .hl { padding: 8px 10px 8px 6px }
    .cn { font-family: Georgia, 'Times New Roman', serif; font-size: 15px; font-weight: 700; color: #014e58; letter-spacing: .8px; line-height: 1.1 } .tg { color: #f68121; font-size: 8.6px; font-weight: 700; letter-spacing: .4px; margin-top: 2px }
    .rule { width: 72px; height: 2.5px; background: #f68121; margin: 5px 0 5px } .ad { font-size: 8.4px; color: #333; line-height: 1.55 }
    .ids { margin-top: 3px; font-size: 8.2px; color: #014e58 } .ids span { margin-right: 14px; white-space: nowrap } .ids b { color: #014e58; font-weight: 700; margin-right: 3px }
    .hq { width: 104px; text-align: center; padding: 6px 10px 6px 0 } .qr { width: 90px; height: 90px; display: block; margin: 0 auto } .qc { font-size: 7px; color: #666; margin-top: 1px }
    .band { border-top: 1px solid #333; display: flex; align-items: center; padding: 4px 10px }
    .band .bl { flex: 1 } .band .ti { flex: 0 0 auto; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; color: #111 } .band .orig { flex: 1; text-align: right; font-size: 8.4px; font-weight: 700 }
    .irn { font-size: 7.6px; line-height: 1.5; word-break: break-all; padding: 0 10px 3px }
    .box { border-top: 1px solid #333 }  .box > tbody > tr > td { padding: 4px 8px } .box > tbody > tr > td + td { border-left: 0 } .bt { font-size: 9.2px; margin-bottom: 3px } .adr { margin-bottom: 4px; line-height: 1.45 } .gp { margin-top: 2px }
    .kv td { padding: 1.5px 0 } .kv .k { font-weight: 700; white-space: nowrap; width: 1%; padding-right: 6px } .kv .c { width: 10px; font-weight: 700 } .kv .v { padding-left: 4px }
    .box.ship > tbody > tr > td { padding: 0 8px } .ship .kv td { padding: 2px 0 } .ship .kv .k { width: 104px }
    .ag td { padding: 2px 5px } .ag .k { font-weight: 700; white-space: nowrap; width: 1% } .ag .v { min-width: 60px } .dn { background: #e7f0f1; border-bottom: 1px solid #333; font-size: 9px }
    .ch { margin-top: 0 } .ch th { background: #014e58; color: #fff; font-weight: 700; border: 1px solid #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 3px 3px; text-align: center; font-size: 8px } .ch td { border: 1px solid #333; padding: 2.5px 3px }
    .ch .pl { text-align: left } .ch thead { display: table-header-group } .ch tr { page-break-inside: avoid } .tot td { font-weight: 700; background: #e7f0f1 }
    .tt { border-top: 1px solid #333 } .tt .tl { padding: 6px 8px } .tt .tr { width: 34%; padding: 4px 8px; border-left: 1px solid #333 } .tt .kv .k { width: auto } .tt .gt td { font-weight: 700; font-size: 10.5px; border-top: 1px solid #333; padding-top: 3px; color: #014e58 }
    .words { font-weight: 700; font-size: 9.4px; margin-bottom: 4px } .note { margin-top: 4px; font-style: italic } .rm { margin-top: 8px }
    .bank { border-top: 1px solid #333 } .bank > tbody > tr > td { padding: 6px 8px } .bh { font-weight: 700; color: #014e58; margin-bottom: 4px; font-size: 9px; letter-spacing: .3px }
    .bg td { padding: 3px 7px } .bk { width: 82px; color: #555; background: #f3f7f7; white-space: nowrap } .bv { font-weight: 700 } .bv.an { font-size: 9.6px; letter-spacing: .4px } .sg { width: 34%; text-align: center; border-left: 1px solid #333; vertical-align: top } .bank > tbody > tr > td.sg { padding: 6px 12px 8px }
    .sgi { display: flex; flex-direction: column; justify-content: space-between; min-height: 66px } .sl { border-top: 1px dotted #555; margin: 0 22px; padding-top: 3px }
    .notes { border-top: 1px solid #333 } .notes td { padding: 4px 8px } .nh { width: 62px; font-weight: 700 } .notes ol { margin: 0; padding-left: 14px } .notes li { margin: 1px 0 } .notes li.b { font-weight: 700 }
    .ro { border-top: 1px solid #333; text-align: center; padding: 5px 8px; font-size: 8px }
    .ann { page-break-before: always } .ann .blk { border: 1px solid #333; margin-bottom: 8px; page-break-inside: avoid } .ann .ch th { font-size: 7.8px }
    .pf { position: fixed; left: 0; right: 0; bottom: -10mm; font-size: 8px; font-weight: 700; display: flex; justify-content: space-between; border-top: 1px solid #999; padding-top: 3px }
    .ch { border-style: hidden } .ch th { border-color: #8fb4b9 } .ch thead tr:last-child th, .ch thead th[rowspan] { border-bottom-color: #333 } .box:has(+ .ch), .ag:has(+ .ch) { border-bottom: 1px solid #333 }
    .bg { border: 0 } .bg td { border: 1px solid #333 }`;

// SAC from the charge master where the line has none; a bill whose GST is only at bill level (loaded from iCAFFE)
// gets that GST spread over its taxable lines, so the grid adds up to the bill
function printLines(invoice, sacMaster) {
  const lines = (invoice.lines || []).map((line) => ({ ...line, sac: line.sac || (sacMaster[masterKey(line.charge)] || {}).sac || '', qty: num(line.qty) || 1, inrAmount: num(line.inrAmount || line.amount) }));
  const billTax = round2(num(invoice.igst) + num(invoice.cgst) + num(invoice.sgst));
  const lineTax = round2(lines.reduce((total, line) => total + num(line.igst) + num(line.cgst) + num(line.sgst), 0));
  if (billTax && !lineTax) {
    const taxable = lines.filter((line) => { const master = sacMaster[masterKey(line.charge)]; return !(master && master.rate === 0 && master.sac); });
    const base = round2(taxable.reduce((total, line) => total + line.inrAmount, 0));
    const ratePct = base ? [5, 12, 18, 28].reduce((best, rate) => (Math.abs(billTax / base * 100 - rate) < Math.abs(billTax / base * 100 - best) ? rate : best), 18) : 0;
    const interState = num(invoice.igst) > 0;
    let left = billTax;
    taxable.forEach((line, index) => {
      const tax = index === taxable.length - 1 ? round2(left) : round2(line.inrAmount * ratePct / 100);
      left = round2(left - tax);
      if (interState) Object.assign(line, { igstPct: ratePct, igst: tax, cgstPct: 0, sgstPct: 0, cgst: 0, sgst: 0 });
      else Object.assign(line, { cgstPct: ratePct / 2, sgstPct: ratePct / 2, cgst: round2(tax / 2), sgst: round2(tax - round2(tax / 2)), igstPct: 0, igst: 0 });
    });
  }
  return lines.map((line) => ({ ...line, igst: num(line.igst), cgst: num(line.cgst), sgst: num(line.sgst), total: round2(line.inrAmount + num(line.igst) + num(line.cgst) + num(line.sgst)) }));
}

function supplyNote(invoice, company) {
  const lut = company.lutNo ? ' (LUT ' + company.lutNo + ')' : '';
  const withoutPayment = /without/i.test(invoice.paymentOption || '');
  if (invoice.sez) return withoutPayment ? 'Supply meant for SEZ under LUT without payment of IGST' + lut : 'Supply meant for SEZ with payment of IGST';
  if (invoice.pos === FOREIGN_POS) return withoutPayment ? 'Supply meant for export of services under LUT without payment of IGST' + lut : 'Export of services with payment of IGST';
  if (invoice.kind === 'reimbursable') return 'Reimbursement of expenses incurred as pure agent on behalf of the client - not a supply under GST';
  return invoice.rcm ? 'Tax payable on reverse charge: Yes' : '';
}

export async function invoiceHtml(id) {
  const [invoice, qr, printData] = await Promise.all([accountsApi.gstInvoice(id), emptyOnError(accountsApi.gstInvoiceQr(id)), emptyOnError(accountsApi.gstInvoicePrintData(id))]);
  const company = printData.head || {}; const party = printData.party || {}; const sacMaster = printData.sac || {}; const docketInfo = printData.dockets || {};
  const kind = invoice.kind; const title = TITLES[kind] || 'TAX INVOICE';
  const docWord = kind === 'creditnote' ? 'Credit Note' : kind === 'debitnote' ? 'Debit Note' : 'Invoice';
  const fcy = invoice.currency && invoice.currency !== 'INR' && !invoice.hideExRate;
  const lines = printLines(invoice, sacMaster);
  const dockets = [...new Set([...(invoice.dockets || []), ...lines.map((line) => line.jobNo)].map((docketNo) => String(docketNo || '').trim()).filter(Boolean))];
  if (!dockets.length && invoice.jobNo) dockets.push(invoice.jobNo);
  const bulk = !!invoice.bulk || dockets.length > 1;
  const shipmentOf = (docketNo) => docketInfo[masterKey(docketNo)] || {};
  const note = supplyNote(invoice, company);
  const totals = { igst: num(invoice.igst), cgst: num(invoice.cgst), sgst: num(invoice.sgst), gross: num(invoice.grossInr), total: num(invoice.total), round: num(invoice.roundOffAmt), advance: num(invoice.advance) };
  const lineSum = round2(lines.reduce((total, line) => total + line.total, 0));
  const placeOfSupply = escapeHtml((invoice.posName || party.stateName || '') + (invoice.pos && invoice.pos !== FOREIGN_POS ? ' (' + invoice.pos + ')' : party.stateCode ? ' (' + party.stateCode + ')' : ''));

  const irnBox = invoice.irn ? `<div class="irn"><div><b>IRN</b> : ${escapeHtml(invoice.irn)}${invoice.irnStatus === 'Cancelled' ? ' <b class="red">(CANCELLED)</b>' : ''}</div>${invoice.ackNo ? `<div><b>Ack No.</b> : ${escapeHtml(invoice.ackNo)} &nbsp; <b>Ack Date</b> : ${fmtDate(invoice.ackDate)}</div>` : ''}</div>` : '';
  const qrImage = qr && qr.dataUrl ? `<img class="qr" src="${qr.dataUrl}">` : '';
  const address = [company.address1, company.address2].filter(Boolean).map(titleCase).join(', ').replace(/\s*,\s*,/g, ',').replace(/\s+,/g, ',');
  const head = `<table class="hd"><tr>
      ${company.logo ? `<td class="lg"><img class="logo" src="${company.logo}"></td>` : ''}
      <td class="hl"><div class="cn">${escapeHtml(company.name || '')}</div>${company.tagline ? `<div class="tg">${escapeHtml(company.tagline)}</div>` : ''}<div class="rule"></div>
        <div class="ad">${address}</div>
        <div class="ad">${company.phone ? 'Ph: ' + escapeHtml(company.phone) : ''}${company.fax ? ' &nbsp;|&nbsp; Fax: ' + escapeHtml(company.fax) : ''}${company.email ? ' &nbsp;|&nbsp; ' + escapeHtml(company.email) : ''}${company.website ? ' &nbsp;|&nbsp; ' + escapeHtml(company.website) : ''}</div>
        <div class="ids"><span><b>GSTIN</b> ${escapeHtml(company.gstin || '')}</span><span><b>PAN</b> ${escapeHtml(company.pan || '')}</span><span><b>CIN</b> ${escapeHtml(company.cin || '')}</span>${company.stateName ? `<span><b>State</b> ${escapeHtml(company.stateName)} (${escapeHtml(company.stateCode)})</span>` : ''}</div></td>
      ${qrImage ? `<td class="hq">${qrImage}<div class="qc">e-Invoice</div></td>` : ''}</tr></table>
    <div class="band"><span class="bl"></span><span class="ti">${title}${invoice.status === 'Void' ? ' - VOID' : ''}</span><span class="orig">Original For Recipient</span></div>
    ${irnBox}`;
  const keyValue = (key, value, bold) => `<tr><td class="k">${key}</td><td class="c">:</td><td class="v">${bold ? '<b>' + value + '</b>' : value}</td></tr>`;
  const billTo = (right) => `<table class="box"><tr><td style="width:58%"><div class="bt"><b>Bill To. : ${escapeHtml(invoice.partyName)}</b></div><div class="adr">${escapeHtml(party.address || invoice.address || '')}</div>
      <div class="gp"><b>GSTN No. :</b> ${escapeHtml(party.gstin || invoice.gstin || 'Unregistered')}</div>${party.stateName ? `<div><b>State :</b> ${escapeHtml(party.stateName)}</div>` : ''}${party.stateCode ? `<div><b>Code :</b> ${escapeHtml(party.stateCode)}</div>` : ''}${party.pan ? `<div><b>PAN No. :</b> ${escapeHtml(party.pan)}</div>` : ''}${invoice.countryCode && invoice.countryCode !== 'IN' ? `<div><b>Country :</b> ${escapeHtml(invoice.countryCode)}</div>` : ''}</td>
      <td><table class="kv">${right}</table></td></tr></table>`;
  const shipBox = (docketNo, annex) => {
    const shipment = shipmentOf(docketNo); const sea = isSeaDocket(docketNo);
    const labels = sea ? { master: 'MBL No.', masterDate: 'MBL Date', house: 'HBL No', houseDate: 'HBL Date', carrier: 'SHIPPING LINE' } : { master: 'MAWB No.', masterDate: 'MAWB Date', house: 'HAWB No', houseDate: 'HAWB Date', carrier: 'AIRLINE' };
    const text = (value) => escapeHtml(value || '');
    const mawb = shipment.mawbNo || (!annex ? invoice.mawbNo : '') || ''; const hawb = shipment.hawbNo || (!annex ? invoice.hawbNo : '') || '';
    if (annex) {
      const rows = [['Docket No', '<b>' + text(docketNo) + '</b>', sea ? 'MBL No.' : 'AWB No.', text(mawb), sea ? 'MBL Date' : 'AWB Date', text(shipment.mawbDate), 'PKGS', text(shipment.pkgs)],
        [labels.carrier, text(shipment.carrier), labels.house, text(hawb), sea ? 'HBL DT.' : 'HAWB DT.', text(shipment.hawbDate), 'Gross Wt.', text(fixed3(shipment.grossWt))],
        ['Origin', text(shipment.origin), 'INV NO', text(shipment.partyInvoice), 'INV DT.', '', 'Chargeable Wt.', text(fixed3(shipment.chargeableWt))],
        ['Destination', text(shipment.destination), shipment.isImport ? 'BE NO' : 'SB NO', text(shipment.sbNo), shipment.isImport ? 'BE DT.' : 'SB DT.', text(shipment.sbDate), 'Freight Terms', text(shipment.freightTerms)]];
      return `<table class="ag">${rows.map((row) => `<tr>${[0, 2, 4, 6].map((index) => `<td class="k">${row[index]}</td><td class="v">${row[index + 1]}</td>`).join('')}</tr>`).join('')}
        <tr><td class="k">Consignee</td><td class="v" colspan="5">${text(shipment.consignee)}</td><td class="k">Shipment Terms</td><td class="v">${text(shipment.shipmentTerms)}</td></tr>
        <tr><td class="k">Shipper</td><td class="v" colspan="7">${text(shipment.shipper)}</td></tr></table>`;
    }
    const cells = [[labels.master, mawb, labels.masterDate, shipment.mawbDate], [labels.house, hawb, labels.houseDate, shipment.hawbDate], [labels.carrier, shipment.carrier, 'PKGS', shipment.pkgs],
      ['Origin', shipment.origin, 'Gross Wt.', fixed3(shipment.grossWt)], ['Destination', shipment.destination, 'Chargeable Wt.', fixed3(shipment.chargeableWt)],
      ['Party Invoice', shipment.partyInvoice, 'CBM', shipment.cbm], ['Consignee', shipment.consignee, 'Freight Terms', shipment.freightTerms], ['Shipper', shipment.shipper, 'Shipment Terms', shipment.shipmentTerms],
      ['Goods Description', shipment.goods, shipment.isImport ? 'BE No. & Date' : 'SB No. & Date', [shipment.sbNo, shipment.sbDate].filter(Boolean).join(' / ')]]
      .concat(shipment.containers ? [['Container No.', shipment.containers, 'IGM No.', shipment.igmNo]] : []);
    return `<table class="box ship">${cells.map((cell) => `<tr><td><table class="kv"><tr><td class="k">${cell[0]}</td><td class="c">:</td><td class="v">${text(cell[1])}</td></tr></table></td><td style="width:42%"><table class="kv"><tr><td class="k">${cell[2]}</td><td class="c">:</td><td class="v">${text(cell[3])}</td></tr></table></td></tr>`).join('')}</table>`;
  };
  const gstHead = `<tr><th rowspan="2" class="pl">Particulars</th><th rowspan="2">SAC<br>Code</th>${fcy ? '<th rowspan="2">Cur</th><th rowspan="2">Ex Rate</th>' : ''}<th rowspan="2">Qty</th><th rowspan="2">Rate</th><th rowspan="2">Amt</th><th rowspan="2">Tax. Amt</th><th colspan="2">CGST</th><th colspan="2">SGST</th><th colspan="2">IGST</th><th>Total</th></tr>
    <tr><th>Rate</th><th>Amt.</th><th>Rate</th><th>Amt.</th><th>Rate</th><th>Amt.</th><th>Amt.</th></tr>`;
  const gstRow = (line) => `<tr><td class="pl">${escapeHtml(line.charge)}${showNarration(line.narration) ? `<div class="s">${escapeHtml(line.narration)}</div>` : ''}${line.containerNo ? `<div class="s">Cntr ${escapeHtml(line.containerNo)}</div>` : ''}${line.receiptNo ? `<div class="s">Rcpt ${escapeHtml(line.receiptNo)} ${fmtDate(line.receiptDate)}</div>` : ''}</td>
    <td>${escapeHtml(line.sac)}</td>${fcy ? `<td>${escapeHtml(line.currency || invoice.currency)}</td><td class="r">${num(line.exRate || invoice.exRate).toFixed(3)}</td>` : ''}<td class="r">${num(line.qty).toFixed(2)}</td><td class="r">${fixed2(line.rate || line.amount)}</td><td class="r">${fixed2(fcy ? line.amount : line.inrAmount)}</td><td class="r">${fixed2(line.inrAmount)}</td>
    <td class="r">${fixed2(line.cgstPct)}</td><td class="r">${fixed2(line.cgst)}</td><td class="r">${fixed2(line.sgstPct)}</td><td class="r">${fixed2(line.sgst)}</td><td class="r">${fixed2(line.igstPct)}</td><td class="r">${fixed2(line.igst)}</td><td class="r">${fixed2(line.total)}</td></tr>`;
  const gstTotal = (rows) => {
    const sum = (key) => round2(rows.reduce((total, line) => total + num(line[key]), 0));
    return `<tr class="tot"><td class="r" colspan="${fcy ? 6 : 4}">Total Amount::</td><td class="r">${fixed2(fcy ? sum('amount') : sum('inrAmount'))}</td><td class="r">${fixed2(sum('inrAmount'))}</td><td></td><td class="r">${fixed2(sum('cgst'))}</td><td></td><td class="r">${fixed2(sum('sgst'))}</td><td></td><td class="r">${fixed2(sum('igst'))}</td><td class="r">${fixed2(sum('total'))}</td></tr>`;
  };
  const totalsBox = `<table class="tt"><tr><td class="tl">
      <div class="words">${escapeHtml(inrWords(totals.total))}</div>${fcy && invoice.totalFcy ? `<div class="s">(${escapeHtml(invoice.currency)} ${fixed2(invoice.totalFcy)} - ${escapeHtml(inWords(num(invoice.totalFcy), invoice.currency))})</div>` : ''}
      ${note ? `<div class="note">${escapeHtml(note)}</div>` : ''}<div class="rm"><b>Remarks</b> ${invoice.remarks && !/^Loaded from iCAFFE/i.test(invoice.remarks) ? ': ' + escapeHtml(invoice.remarks) : ''}</div></td>
    <td class="tr"><table class="kv">
      <tr><td class="k">Total Taxable</td><td class="v r">${fixed2(totals.gross)}</td></tr><tr><td class="k">Total IGST</td><td class="v r">${fixed2(totals.igst)}</td></tr><tr><td class="k">Total SGST</td><td class="v r">${fixed2(totals.sgst)}</td></tr><tr><td class="k">Total CGST</td><td class="v r">${fixed2(totals.cgst)}</td></tr>
      ${totals.round ? `<tr><td class="k">Round Off</td><td class="v r">${fixed2(totals.round)}</td></tr>` : ''}<tr class="gt"><td class="k">Total ${docWord}</td><td class="v r">${fixed2(totals.total)}</td></tr>
      ${totals.advance ? `<tr><td class="k">Advance Amount</td><td class="v r">${fixed2(totals.advance)}</td></tr><tr class="gt"><td class="k">Net Payable</td><td class="v r">${fixed2(round2(totals.total - totals.advance))}</td></tr>` : ''}</table></td></tr></table>`;
  const bank = company.bank || {};
  const foot = `<table class="bank"><tr><td><div class="bh">Bank Details</div><table class="bg">
      <tr><td class="bk">Account Name</td><td class="bv">${escapeHtml(bank.name || company.name || '')}</td><td class="bk">Account No.</td><td class="bv an">${escapeHtml(bank.accountNo || '')}</td></tr>
      <tr><td class="bk">Bank Name</td><td class="bv">${escapeHtml(bank.bankName || '')}</td><td class="bk">IFSC Code</td><td class="bv">${escapeHtml(bank.ifsc || '')}</td></tr>
      ${bank.branch || bank.swift ? `<tr><td class="bk">Branch</td><td class="bv" colspan="${bank.swift ? 1 : 3}">${escapeHtml(bank.branch || '')}</td>${bank.swift ? `<td class="bk">SWIFT</td><td class="bv">${escapeHtml(bank.swift)}</td>` : ''}</tr>` : ''}</table></td>
      <td class="sg"><div class="sgi"><div>For <b>${escapeHtml(company.name || '')}</b></div><div class="sl">Authorised Signatory</div></div></td></tr></table>
    <table class="notes"><tr><td class="nh">Spl. Note</td><td><ol>${(company.notes || []).map((text, index) => `<li${index === 0 ? ' class="b"' : ''}>${escapeHtml(text)}</li>`).join('')}</ol></td></tr></table>
    <div class="ro"><b>Registered Office : ${escapeHtml(company.regOffice || '')}</b></div>`;
  const againstInvoice = (invoice.prevInvoiceNo ? keyValue('Against Invoice No.', escapeHtml(invoice.prevInvoiceNo), true) + keyValue('Invoice Date', fmtDate(invoice.prevInvoiceDate)) + (invoice.reason ? keyValue('Reason', escapeHtml(invoice.reason)) : '') : '')
    + (fcy ? keyValue('Currency', escapeHtml(invoice.currency) + ' @ ' + invoice.exRate) : '');

  let body;
  if (!bulk) {
    const docketNo = dockets[0] || invoice.jobNo || '';
    const right = keyValue(docWord + ' No.', escapeHtml(invoice.invoiceNo), true) + keyValue(docWord + ' Date', fmtDate(invoice.date)) + (docketNo ? keyValue('Docket No', escapeHtml(docketNo)) : '') + keyValue('Party Ref. No', escapeHtml(invoice.quotationNo || ''))
      + keyValue('A/C Of', escapeHtml(shipmentOf(docketNo).shipper || '')) + keyValue('Place of Supply', placeOfSupply) + againstInvoice;
    body = `<div class="pg">${head}${billTo(right)}${docketNo || invoice.mawbNo ? shipBox(docketNo) : ''}
      <table class="ch"><thead>${gstHead}</thead><tbody>${lines.map(gstRow).join('')}${gstTotal(lines)}</tbody></table>${totalsBox}${foot}</div>`;
  } else {
    // page 1: the charges added up charge by charge (Qty = dockets with that charge)
    const groups = new Map();
    for (const line of lines) {
      const key = [masterKey(line.charge), line.sac, line.narration || '', line.currency || 'INR', num(line.exRate) || 1, line.igstPct, line.cgstPct].join('|');
      if (!groups.has(key)) groups.set(key, { ...line, qty: 0, rate: '', amount: 0, inrAmount: 0, igst: 0, cgst: 0, sgst: 0, total: 0, receiptNo: '', containerNo: '' });
      const group = groups.get(key);
      group.qty += 1;
      for (const field of ['amount', 'inrAmount', 'igst', 'cgst', 'sgst', 'total']) group[field] = round2(group[field] + num(line[field]));
    }
    const summary = [...groups.values()].map((group) => ({ ...group, rate: group.qty ? round2(group.amount / group.qty) : group.amount }));
    const noteWord = kind === 'creditnote' ? 'CREDIT NOTE' : kind === 'debitnote' ? 'DEBIT NOTE' : 'BILL';
    const right = keyValue(noteWord + ' NO', escapeHtml(invoice.invoiceNo), true) + keyValue(noteWord + ' DATE', fmtDate(invoice.date)) + keyValue('Dockets', String(dockets.length)) + keyValue('Place of Supply', placeOfSupply) + againstInvoice;
    const annexHead = `<tr><th rowspan="2">Sr.</th><th rowspan="2" class="pl">Charge Name</th><th rowspan="2">Receipt No.</th><th rowspan="2">Receipt Date</th><th rowspan="2">SAC Code</th><th rowspan="2">Amount</th><th rowspan="2">Dis.</th><th colspan="2">CGST</th><th colspan="2">SGST</th><th colspan="2">IGST</th></tr><tr><th>Rate</th><th>Amt.</th><th>Rate</th><th>Amt.</th><th>Rate</th><th>Amt.</th></tr>`;
    const annex = dockets.map((docketNo) => {
      const docketLines = lines.filter((line) => String(line.jobNo || '').trim() === docketNo);
      if (!docketLines.length) return '';
      const sum = (key) => round2(docketLines.reduce((total, line) => total + num(line[key]), 0));
      return `<div class="blk">${shipBox(docketNo, true)}<table class="ch"><thead>${annexHead}</thead><tbody>${docketLines.map((line, index) => `<tr><td class="r">${index + 1}</td><td class="pl">${escapeHtml(line.charge)}${showNarration(line.narration) ? `<div class="s">${escapeHtml(line.narration)}</div>` : ''}</td><td>${escapeHtml(line.receiptNo || '')}</td><td>${line.receiptDate ? fmtDate(line.receiptDate) : ''}</td><td>${escapeHtml(line.sac)}</td><td class="r">${fixed2(line.inrAmount)}</td><td class="r">${fixed2(line.discount)}</td><td class="r">${fixed2(line.cgstPct)}</td><td class="r">${fixed2(line.cgst)}</td><td class="r">${fixed2(line.sgstPct)}</td><td class="r">${fixed2(line.sgst)}</td><td class="r">${fixed2(line.igstPct)}</td><td class="r">${fixed2(line.igst)}</td></tr>`).join('')}
        <tr class="tot"><td colspan="5" class="r">TOTAL ::</td><td class="r">${fixed2(sum('inrAmount'))}</td><td></td><td></td><td class="r">${fixed2(sum('cgst'))}</td><td></td><td class="r">${fixed2(sum('sgst'))}</td><td></td><td class="r">${fixed2(sum('igst'))}</td></tr></tbody></table></div>`;
    }).join('');
    body = `<div class="pg">${head}${billTo(right)}<table class="ch"><thead>${gstHead}</thead><tbody>${summary.map(gstRow).join('')}${gstTotal(summary)}</tbody></table>${totalsBox}${foot}</div>
      <div class="ann">${annex}</div><div class="pf"><span>Bill No. : ${escapeHtml(invoice.invoiceNo)}</span><span>Bill Date : ${fmtDate(invoice.date)}</span><span>${escapeHtml(company.branchName ? 'Branch : ' + company.branchName : '')}</span></div>`;
  }
  const footer = `${kind === 'creditnote' ? 'Credit Note' : kind === 'debitnote' ? 'Debit Note' : 'Bill'} No. : ${escapeHtml(invoice.invoiceNo)} &nbsp; &nbsp; Date : ${fmtDate(invoice.date)}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoiceNo)}</title>${bulk ? `<meta name="pdf-footer" content="${footer}">` : ''}<style>${css(bulk)}</style></head><body>${body}</body></html>`;
  if (Math.abs(lineSum - round2(totals.total - totals.round)) > 1 && !bulk) console.warn('invoice print: lines', lineSum, 'bill', totals.total);
  return { html, inv: invoice };
}

async function pdfFailure(error) {
  if (!error.response) return error.message;
  const message = await blobErrorMessage(error);
  return message === error.message ? 'PDF not made (HTTP ' + error.response.status + ')' : message;
}

// the server turns the invoice html into a PDF; failure = { failed: message }
export async function makeInvoicePdf(id, html) {
  try {
    return { blob: await accountsApi.gstInvoicePdf(id, html) };
  } catch (error) {
    if (!error.response) throw error;
    return { failed: await pdfFailure(error) };
  }
}

const invoiceOfVoucher = async (voucherId) => {
  const head = await accountsApi.gstInvoiceByVoucher(voucherId);
  if (!head || !head.id) throw Object.assign(new Error(NO_INVOICE), { noInvoice: true });
  return head;
};
export { invoiceOfVoucher, NO_INVOICE };

async function invoicePdf(voucherId) {
  const head = await invoiceOfVoucher(voucherId);
  const { html, inv: invoice } = await invoiceHtml(head.id);
  const pdf = await makeInvoicePdf(head.id, html);
  if (pdf.failed) throw new Error(pdf.failed);
  return { blob: pdf.blob, name: pdfFileName(invoice.invoiceNo) + '.pdf', inv: invoice };
}

const PDF_URL_LIFETIME_MS = 120000;

// the invoice behind a voucher as a PDF - opened in a new tab, or downloaded
export async function openInvoicePdf(voucherId, download) {
  // the tab is opened at once (on the click) so the browser does not block it, and filled when the PDF is ready
  const tab = download ? null : window.open('', '_blank');
  if (tab) { try { tab.document.write('<p style="font:14px sans-serif;padding:20px">Making the invoice PDF...</p>'); } catch { /* the tab may refuse writes */ } }
  try {
    const { blob, name } = await invoicePdf(voucherId);
    if (download || !tab) { downloadBlob(blob, name); return { pdf: true }; }
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), PDF_URL_LIFETIME_MS);
  } catch (error) {
    // when the PDF cannot be made, the saved invoice still opens in the tab - the same page as Print
    if (tab && !error.noInvoice) {
      try {
        const head = await accountsApi.gstInvoiceByVoucher(voucherId);
        if (head && head.id) {
          const { html } = await invoiceHtml(head.id);
          tab.document.open(); tab.document.write(html); tab.document.close();
          return { pdf: false, reason: error.message };
        }
      } catch { /* falls through to closing the tab */ }
    }
    if (tab) tab.close();
    throw error;
  }
  return { pdf: true };
}

const PRINT_DELAY_MS = 250;
const PRINT_FRAME_LIFETIME_MS = 1500;

export async function printInvoice(id) {
  const { html } = await invoiceHtml(id);
  const frame = document.createElement('iframe');
  frame.className = 'tw:fixed tw:right-0 tw:bottom-0 tw:h-0 tw:w-0 tw:border-0';
  document.body.appendChild(frame);
  frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();
  setTimeout(() => {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { /* print window closed */ }
    setTimeout(() => frame.remove(), PRINT_FRAME_LIFETIME_MS);
  }, PRINT_DELAY_MS);
}

export async function downloadEInvoice(ids, name) {
  const result = await accountsApi.gstInvoiceEinvoiceJson(ids);
  if (result.json.length) {
    const text = JSON.stringify(result.json.length === 1 ? result.json[0] : result.json, null, 2);
    downloadBlob(new Blob([text], { type: 'application/json' }), name || 'einvoice_' + todayIso() + '.json');
  }
  return result;
}
