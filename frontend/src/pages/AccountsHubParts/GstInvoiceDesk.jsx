// 05-Nov-2026: GST Invoice - iCAFFE's Operation > GST Invoice, inside Accounts.
// One screen for the nine kinds (Service, Reimbursable, Other, Debit Note, Courier, Credit Note, Consultancy, CAN, OverSeas Agent),
// laid out as on iCAFFE: Invoice tab (party / docket / GST header, charge line, charge grid, totals) and Search tab.
// Save posts the invoice to the books at once (see routes/accountsGstInvoice.js); the posting is shown before Save.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, Pencil, RotateCcw, Printer, Plus, Trash2, Search, Ban, FileMinus, Receipt, RefreshCw, X, Mail, MessageCircle, FileJson, ClipboardList, Layers, Send, XCircle, Settings } from 'lucide-react';
import { T, inr, fmtDate, todayIso, api, postJson, Box, Btn, ActionBar, inputStyle as uiInput, Sheet, Grid, Badge, PostingTable, Money } from './ui';

// compact fields for this screen: small label over a 25px box, tight gaps
const inputStyle = { ...uiInput, height: 25, padding: '0 6px', fontSize: 11.5, boxSizing: 'border-box' };
const roStyle = { ...inputStyle, background: '#eef2f6', color: '#334155' };
const mandStyle = { ...inputStyle, borderColor: '#f87171' };
function Field({ label, children, required, span = 1, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, gridColumn: `span ${span}`, minWidth: 0, ...style }}>
      <label style={{ margin: 0, fontSize: 10.5, fontWeight: 700, lineHeight: '13px', color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}{required && <span style={{ color: T.dr }}> *</span>}</label>
      {children}
    </div>
  );
}
import { useGlobalContext } from '../../GlobalContext';

const BASE = '/api/accounts-hub/gst-invoice';
const PARTY_TYPES = { overseas: [['overseas', 'OverSeas Agent'], ['shipper', 'Shipper'], ['supplier', 'Supplier']], _: [['importer', 'Importer'], ['shipper', 'Shipper / Exporter'], ['subagent', 'Sub Agent'], ['overseas', 'OverSeas Agent']] };
const TITLES = { creditnote: 'CREDIT NOTE', debitnote: 'DEBIT NOTE', reimbursable: 'REIMBURSEMENT INVOICE', can: 'CARGO ARRIVAL NOTICE CUM TAX INVOICE', overseas: 'INVOICE' };
const fyStartIso = () => { const d = new Date(); return (d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear()) + '-04-01'; };
const n = (v) => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
const r2 = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;
const emptyHead = (kind, branch) => ({ kind, date: todayIso(), branchCode: branch || '', division: '', partyType: kind === 'overseas' ? 'overseas' : '', partyName: '', partyId: null, partyBranchId: null, ledgerId: null,
  address: '', gstin: '', stateName: '', stateCode: '', pos: kind === 'overseas' ? '97' : '', posName: kind === 'overseas' ? 'Foreign Country' : '', sez: '', paymentOption: '', countryCode: '', currency: 'INR', exRate: 1, costCentre: '', roundOff: 1,
  gstExempt: false, hideExRate: false, rcm: false, withOut: false, prevInvoiceNo: '', prevInvoiceDate: '', reason: '', docketBy: kind === 'overseas' ? 'hawb' : 'docket', jobNo: '', hawbNo: '', mawbNo: '',
  quotationNo: '', email: '', advance: '', remarks: '', bulk: false, dockets: [] });
const emptyLine = () => ({ jobNo: '', containerNo: '', charge: '', sac: '', gstRate: 18, currency: 'INR', exRate: 1, rate: '', unit: '', qty: 1, discount: 0, receiptNo: '', receiptDate: '', costCentre: '', narration: '' });

// same arithmetic as the server, for the live figures on screen (the server recomputes on Save)
function calc(h, lines, our, kind) {
  const foreign = h.pos === '97'; const zero = (h.sez || foreign) && /without/i.test(h.paymentOption || '');
  const gstOn = kind.gst && !h.gstExempt && !zero && !h.rcm; const intra = !foreign && !h.sez && String(h.pos || '') === (our && our.code);
  const ls = lines.map(l => { const amount = r2(n(l.rate) * (n(l.qty) || 1) - n(l.discount)); const inrAmount = r2(amount * (n(l.exRate) || 1)); const g = gstOn ? n(l.gstRate) : 0;
    const igstPct = gstOn && !intra ? g : 0, cgstPct = gstOn && intra ? g / 2 : 0;
    return { ...l, amount, inrAmount, igstPct, cgstPct, sgstPct: cgstPct, igst: r2(inrAmount * igstPct / 100), cgst: r2(inrAmount * cgstPct / 100), sgst: r2(inrAmount * cgstPct / 100) }; });
  const gross = r2(ls.reduce((s, l) => s + l.inrAmount, 0)); const igst = r2(ls.reduce((s, l) => s + l.igst, 0)), cgst = r2(ls.reduce((s, l) => s + l.cgst, 0)), sgst = r2(ls.reduce((s, l) => s + l.sgst, 0));
  const raw = r2(gross + igst + cgst + sgst); const total = h.roundOff === 0 || h.roundOff === '0' ? raw : Math.round(raw);
  return { lines: ls, charge: r2(ls.reduce((s, l) => s + l.amount, 0)), gross, igst, cgst, sgst, roundOff: r2(total - raw), total, gstOn, intra, zero, foreign };
}

// ------------------------------------------------------------------ amount in words (Indian system)
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (x) => (x < 20 ? ONES[x] : TENS[Math.floor(x / 10)] + (x % 10 ? ' ' + ONES[x % 10] : ''));
const three = (x) => (x >= 100 ? ONES[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
export function inWords(v, cur = 'INR') {
  const neg = v < 0; v = Math.abs(r2(v)); let r = Math.floor(v); const p = Math.round((v - r) * 100);
  const parts = []; const cr = Math.floor(r / 10000000); r %= 10000000; const lk = Math.floor(r / 100000); r %= 100000; const th = Math.floor(r / 1000); r %= 1000;
  if (cr) parts.push(three(cr) + ' Crore'); if (lk) parts.push(two(lk) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (r) parts.push(three(r));
  const main = cur === 'INR' ? 'Rupees ' : cur + ' '; const sub = cur === 'INR' ? ' Paise' : ' Cents';
  return (neg ? 'Minus ' : '') + main + (parts.join(' ') || 'Zero') + (p ? ' and ' + two(p) + sub : '') + ' Only';
}

// ------------------------------------------------------------------ print (tax invoice)
// 08-Nov-2026: laid out as iCAFFE's tax invoice. One docket: head with logo, Bill To + invoice box, the shipment box (MAWB,
// airline, origin / destination, packages, weights, consignee, shipper ...), the charge grid with SAC, Qty, Rate, Amount,
// Taxable, CGST / SGST / IGST (rate and amount) and Total, the GST totals, amount in words, bank details, notes and the
// registered office. Several dockets (bulk invoice): page 1 is the bill - charges added up charge by charge - and the
// following pages list every docket with its shipment details and charges, as iCAFFE's bulk invoice does.
// Better than iCAFFE: IRN, Ack and the signed QR on every e-invoice, place of supply, round off, the receiver / authorised
// signatory, table heads repeated on each page, and bills loaded from iCAFFE (no SAC / GST on their lines) get the SAC from
// the charge master and the bill's GST spread over the lines, so the lines add up to the bill.
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f2 = (v) => n(v).toFixed(2);
const f3 = (v) => (String(v ?? '').trim() === '' ? '' : n(v).toFixed(3));
// words as iCAFFE prints them: "INR Eighteen Thousand Four Hundred Four Only"
const inrWords = (v) => inWords(v).replace(/^Rupees /, 'INR ').replace(/^Minus Rupees /, 'Minus INR ');
export async function invoiceHtml(id) {
  const [inv, meta, qr, pd] = await Promise.all([api(BASE + '/' + id), api(BASE + '/meta').catch(() => ({ our: {} })), api(BASE + '/' + id + '/qr').catch(() => ({})), api(BASE + '/' + id + '/print-data').catch(() => ({}))]);
  const H = pd.head || {}; const P = pd.party || {}; const SAC = pd.sac || {}; const DK = pd.dockets || {};
  const kind = inv.kind; const title = TITLES[kind] || 'TAX INVOICE';
  // 08-Nov-2026: credit / debit notes print in the same design - only the words change (No., Date, Total) and the original invoice is shown
  const docWord = kind === 'creditnote' ? 'Credit Note' : kind === 'debitnote' ? 'Debit Note' : 'Invoice';
  const fcy = inv.currency && inv.currency !== 'INR' && !inv.hideExRate;
  // lines: SAC from the charge master where the line has none; a bill whose GST is only at bill level (loaded from iCAFFE)
  // gets that GST spread over its taxable lines so the grid adds up to the bill
  let lines = (inv.lines || []).map(l => ({ ...l, sac: l.sac || (SAC[String(l.charge || '').trim().toUpperCase()] || {}).sac || '', qty: n(l.qty) || 1, inrAmount: n(l.inrAmount || l.amount) }));
  const billTax = r2(n(inv.igst) + n(inv.cgst) + n(inv.sgst)); const lineTax = r2(lines.reduce((s, l) => s + n(l.igst) + n(l.cgst) + n(l.sgst), 0));
  if (billTax && !lineTax) {
    const taxable = lines.filter(l => { const m = SAC[String(l.charge || '').trim().toUpperCase()]; return !(m && m.rate === 0 && m.sac); });
    const base = r2(taxable.reduce((s, l) => s + l.inrAmount, 0));
    const pct = base ? [5, 12, 18, 28].reduce((b, x) => (Math.abs(billTax / base * 100 - x) < Math.abs(billTax / base * 100 - b) ? x : b), 18) : 0;
    const igst = n(inv.igst) > 0; let left = billTax;
    taxable.forEach((l, i) => {
      const t = i === taxable.length - 1 ? r2(left) : r2(l.inrAmount * pct / 100); left = r2(left - t);
      if (igst) { l.igstPct = pct; l.igst = t; l.cgstPct = l.sgstPct = 0; l.cgst = l.sgst = 0; } else { l.cgstPct = l.sgstPct = pct / 2; l.cgst = r2(t / 2); l.sgst = r2(t - r2(t / 2)); l.igstPct = 0; l.igst = 0; }
    });
  }
  lines = lines.map(l => ({ ...l, igst: n(l.igst), cgst: n(l.cgst), sgst: n(l.sgst), total: r2(l.inrAmount + n(l.igst) + n(l.cgst) + n(l.sgst)) }));
  const dockets = [...new Set([...(inv.dockets || []), ...lines.map(l => l.jobNo)].map(d => String(d || '').trim()).filter(Boolean))];
  if (!dockets.length && inv.jobNo) dockets.push(inv.jobNo);
  const bulk = !!inv.bulk || dockets.length > 1;
  const sea = (d) => /\/S[EI]\//i.test(String(d || ''));
  const dkOf = (d) => DK[String(d || '').trim().toUpperCase()] || {};
  const note = inv.sez ? (/without/i.test(inv.paymentOption || '') ? 'Supply meant for SEZ under LUT without payment of IGST' + (H.lutNo ? ' (LUT ' + H.lutNo + ')' : '') : 'Supply meant for SEZ with payment of IGST')
    : inv.pos === '97' ? (/without/i.test(inv.paymentOption || '') ? 'Supply meant for export of services under LUT without payment of IGST' + (H.lutNo ? ' (LUT ' + H.lutNo + ')' : '') : 'Export of services with payment of IGST')
    : kind === 'reimbursable' ? 'Reimbursement of expenses incurred as pure agent on behalf of the client - not a supply under GST' : inv.rcm ? 'Tax payable on reverse charge: Yes' : '';
  const T = { igst: n(inv.igst), cgst: n(inv.cgst), sgst: n(inv.sgst), gross: n(inv.grossInr), total: n(inv.total), round: n(inv.roundOffAmt), adv: n(inv.advance) };
  const lineSum = r2(lines.reduce((s, l) => s + l.total, 0));
  const irnBox = inv.irn ? `<div class="irn"><div><b>IRN</b> : ${esc(inv.irn)}${inv.irnStatus === 'Cancelled' ? ' <b class="red">(CANCELLED)</b>' : ''}</div>${inv.ackNo ? `<div><b>Ack No.</b> : ${esc(inv.ackNo)} &nbsp; <b>Ack Date</b> : ${fmtDate(inv.ackDate)}</div>` : ''}</div>` : '';
  const qrImg = qr && qr.dataUrl ? `<img class="qr" src="${qr.dataUrl}">` : '';
  // 08-Nov-2026: head in the company's colours (teal and orange of the logo): logo, name, address, the registration nos.,
  // the e-invoice QR; then the title line
  const tc = (t) => esc(t).replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase());
  const adr = [H.address1, H.address2].filter(Boolean).map(tc).join(', ').replace(/\s*,\s*,/g, ',').replace(/\s+,/g, ',');
  const head = `<table class="hd"><tr>
      ${H.logo ? `<td class="lg"><img class="logo" src="${H.logo}"></td>` : ''}
      <td class="hl"><div class="cn">${esc(H.name || '')}</div>${H.tagline ? `<div class="tg">${esc(H.tagline)}</div>` : ''}<div class="rule"></div>
        <div class="ad">${adr}</div>
        <div class="ad">${H.phone ? 'Ph: ' + esc(H.phone) : ''}${H.fax ? ' &nbsp;|&nbsp; Fax: ' + esc(H.fax) : ''}${H.email ? ' &nbsp;|&nbsp; ' + esc(H.email) : ''}${H.website ? ' &nbsp;|&nbsp; ' + esc(H.website) : ''}</div>
        <div class="ids"><span><b>GSTIN</b> ${esc(H.gstin || '')}</span><span><b>PAN</b> ${esc(H.pan || '')}</span><span><b>CIN</b> ${esc(H.cin || '')}</span>${H.stateName ? `<span><b>State</b> ${esc(H.stateName)} (${esc(H.stateCode)})</span>` : ''}</div></td>
      ${qrImg ? `<td class="hq">${qrImg}<div class="qc">e-Invoice</div></td>` : ''}</tr></table>
    <div class="band"><span class="bl"></span><span class="ti">${title}${inv.status === 'Void' ? ' - VOID' : ''}</span><span class="orig">Original For Recipient</span></div>
    ${irnBox}`;
  const kv = (k, v, bold) => `<tr><td class="k">${k}</td><td class="c">:</td><td class="v">${bold ? '<b>' + v + '</b>' : v}</td></tr>`;
  const billTo = (right) => `<table class="box"><tr><td style="width:58%"><div class="bt"><b>Bill To. : ${esc(inv.partyName)}</b></div><div class="adr">${esc(P.address || inv.address || '')}</div>
      <div class="gp"><b>GSTN No. :</b> ${esc(P.gstin || inv.gstin || 'Unregistered')}</div>${P.stateName ? `<div><b>State :</b> ${esc(P.stateName)}</div>` : ''}${P.stateCode ? `<div><b>Code :</b> ${esc(P.stateCode)}</div>` : ''}${P.pan ? `<div><b>PAN No. :</b> ${esc(P.pan)}</div>` : ''}${inv.countryCode && inv.countryCode !== 'IN' ? `<div><b>Country :</b> ${esc(inv.countryCode)}</div>` : ''}</td>
      <td><table class="kv">${right}</table></td></tr></table>`;
  const shipBox = (d, opts = {}) => {
    const s = dkOf(d); const isSea = sea(d);
    const L = isSea ? { m: 'MBL No.', md: 'MBL Date', h: 'HBL No', hd: 'HBL Date', c: 'SHIPPING LINE' } : { m: 'MAWB No.', md: 'MAWB Date', h: 'HAWB No', hd: 'HAWB Date', c: 'AIRLINE' };
    const v = (x) => esc(x || '');
    const mawb = s.mawbNo || (!opts.annex ? inv.mawbNo : '') || ''; const hawb = s.hawbNo || (!opts.annex ? inv.hawbNo : '') || '';
    const cells = [[L.m, mawb, L.md, s.mawbDate], [L.h, hawb, L.hd, s.hawbDate], [L.c, s.carrier, 'PKGS', s.pkgs], ['Origin', s.origin, 'Gross Wt.', f3(s.grossWt)], ['Destination', s.destination, 'Chargeable Wt.', f3(s.chargeableWt)],
      ['Party Invoice', s.partyInvoice, 'CBM', s.cbm], ['Consignee', s.consignee, 'Freight Terms', s.freightTerms], ['Shipper', s.shipper, 'Shipment Terms', s.shipmentTerms], ['Goods Description', s.goods, s.isImport ? 'BE No. & Date' : 'SB No. & Date', [s.sbNo, s.sbDate].filter(Boolean).join(' / ')]].concat(s.containers ? [['Container No.', s.containers, 'IGM No.', s.igmNo]] : []);
    if (opts.annex) { // iCAFFE's bulk annexure: four pairs a row
      const g = [['Docket No', '<b>' + v(d) + '</b>', isSea ? 'MBL No.' : 'AWB No.', v(mawb), isSea ? 'MBL Date' : 'AWB Date', v(s.mawbDate), 'PKGS', v(s.pkgs)],
        [L.c, v(s.carrier), L.h, v(hawb), isSea ? 'HBL DT.' : 'HAWB DT.', v(s.hawbDate), 'Gross Wt.', v(f3(s.grossWt))],
        ['Origin', v(s.origin), 'INV NO', v(s.partyInvoice), 'INV DT.', '', 'Chargeable Wt.', v(f3(s.chargeableWt))],
        ['Destination', v(s.destination), s.isImport ? 'BE NO' : 'SB NO', v(s.sbNo), s.isImport ? 'BE DT.' : 'SB DT.', v(s.sbDate), 'Freight Terms', v(s.freightTerms)]];
      return `<table class="ag">${g.map(r => `<tr>${[0, 2, 4, 6].map(i => `<td class="k">${r[i]}</td><td class="v">${r[i + 1]}</td>`).join('')}</tr>`).join('')}
        <tr><td class="k">Consignee</td><td class="v" colspan="5">${v(s.consignee)}</td><td class="k">Shipment Terms</td><td class="v">${v(s.shipmentTerms)}</td></tr>
        <tr><td class="k">Shipper</td><td class="v" colspan="7">${v(s.shipper)}</td></tr></table>`;
    }
    return `<table class="box ship">${cells.map(c => `<tr><td><table class="kv"><tr><td class="k">${c[0]}</td><td class="c">:</td><td class="v">${v(c[1])}</td></tr></table></td><td style="width:42%"><table class="kv"><tr><td class="k">${c[2]}</td><td class="c">:</td><td class="v">${v(c[3])}</td></tr></table></td></tr>`).join('')}</table>`;
  };
  const gstHead = `<tr><th rowspan="2" class="pl">Particulars</th>${bulk ? '' : ''}<th rowspan="2">SAC<br>Code</th>${fcy ? '<th rowspan="2">Cur</th><th rowspan="2">Ex Rate</th>' : ''}<th rowspan="2">Qty</th><th rowspan="2">Rate</th><th rowspan="2">Amt</th><th rowspan="2">Tax. Amt</th><th colspan="2">CGST</th><th colspan="2">SGST</th><th colspan="2">IGST</th><th>Total</th></tr>
    <tr><th>Rate</th><th>Amt.</th><th>Rate</th><th>Amt.</th><th>Rate</th><th>Amt.</th><th>Amt.</th></tr>`;
  const showNarr = (t) => t && !/not in iCAFFE GST print/i.test(t);
  const gstRow = (l) => `<tr><td class="pl">${esc(l.charge)}${showNarr(l.narration) ? `<div class="s">${esc(l.narration)}</div>` : ''}${l.containerNo ? `<div class="s">Cntr ${esc(l.containerNo)}</div>` : ''}${l.receiptNo ? `<div class="s">Rcpt ${esc(l.receiptNo)} ${fmtDate(l.receiptDate)}</div>` : ''}</td>
    <td>${esc(l.sac)}</td>${fcy ? `<td>${esc(l.currency || inv.currency)}</td><td class="r">${n(l.exRate || inv.exRate).toFixed(3)}</td>` : ''}<td class="r">${n(l.qty).toFixed(2)}</td><td class="r">${f2(l.rate || l.amount)}</td><td class="r">${f2(fcy ? l.amount : l.inrAmount)}</td><td class="r">${f2(l.inrAmount)}</td>
    <td class="r">${f2(l.cgstPct)}</td><td class="r">${f2(l.cgst)}</td><td class="r">${f2(l.sgstPct)}</td><td class="r">${f2(l.sgst)}</td><td class="r">${f2(l.igstPct)}</td><td class="r">${f2(l.igst)}</td><td class="r">${f2(l.total)}</td></tr>`;
  const gstTotal = (ls) => { const s = (k) => r2(ls.reduce((a, l) => a + n(l[k]), 0));
    return `<tr class="tot"><td class="r" colspan="${fcy ? 6 : 4}">Total Amount::</td><td class="r">${f2(fcy ? s('amount') : s('inrAmount'))}</td><td class="r">${f2(s('inrAmount'))}</td><td></td><td class="r">${f2(s('cgst'))}</td><td></td><td class="r">${f2(s('sgst'))}</td><td></td><td class="r">${f2(s('igst'))}</td><td class="r">${f2(s('total'))}</td></tr>`; };
  const totals = `<table class="tt"><tr><td class="tl">
      <div class="words">${esc(inrWords(T.total))}</div>${fcy && inv.totalFcy ? `<div class="s">(${esc(inv.currency)} ${f2(inv.totalFcy)} - ${esc(inWords(n(inv.totalFcy), inv.currency))})</div>` : ''}
      ${note ? `<div class="note">${esc(note)}</div>` : ''}<div class="rm"><b>Remarks</b> ${inv.remarks && !/^Loaded from iCAFFE/i.test(inv.remarks) ? ': ' + esc(inv.remarks) : ''}</div></td>
    <td class="tr"><table class="kv">
      <tr><td class="k">Total Taxable</td><td class="v r">${f2(T.gross)}</td></tr><tr><td class="k">Total IGST</td><td class="v r">${f2(T.igst)}</td></tr><tr><td class="k">Total SGST</td><td class="v r">${f2(T.sgst)}</td></tr><tr><td class="k">Total CGST</td><td class="v r">${f2(T.cgst)}</td></tr>
      ${T.round ? `<tr><td class="k">Round Off</td><td class="v r">${f2(T.round)}</td></tr>` : ''}<tr class="gt"><td class="k">Total ${docWord}</td><td class="v r">${f2(T.total)}</td></tr>
      ${T.adv ? `<tr><td class="k">Advance Amount</td><td class="v r">${f2(T.adv)}</td></tr><tr class="gt"><td class="k">Net Payable</td><td class="v r">${f2(r2(T.total - T.adv))}</td></tr>` : ''}</table></td></tr></table>`;
  const B = H.bank || {};
  // 08-Nov-2026: bank details as a small grid - account name / no., bank / IFSC, branch
  const foot = `<table class="bank"><tr><td><div class="bh">Bank Details</div><table class="bg">
      <tr><td class="bk">Account Name</td><td class="bv">${esc(B.name || H.name || '')}</td><td class="bk">Account No.</td><td class="bv an">${esc(B.accountNo || '')}</td></tr>
      <tr><td class="bk">Bank Name</td><td class="bv">${esc(B.bankName || '')}</td><td class="bk">IFSC Code</td><td class="bv">${esc(B.ifsc || '')}</td></tr>
      ${B.branch || B.swift ? `<tr><td class="bk">Branch</td><td class="bv" colspan="${B.swift ? 1 : 3}">${esc(B.branch || '')}</td>${B.swift ? `<td class="bk">SWIFT</td><td class="bv">${esc(B.swift)}</td>` : ''}</tr>` : ''}</table></td>
      <td class="sg"><div class="sgi"><div>For <b>${esc(H.name || '')}</b></div><div class="sl">Authorised Signatory</div></div></td></tr></table>
    <table class="notes"><tr><td class="nh">Spl. Note</td><td><ol>${(H.notes || []).map((t, i) => `<li${i === 0 ? ' class="b"' : ''}>${esc(t)}</li>`).join('')}</ol></td></tr></table>
    <div class="ro"><b>Registered Office : ${esc(H.regOffice || '')}</b></div>`;
  const css = `@page { size: A4; margin: 8mm 8mm ${bulk ? '14mm' : '8mm'} } * { box-sizing: border-box } body { margin: 0; padding: 0 2px; font-family: Verdana, Arial, Helvetica, sans-serif; font-size: 8.6px; color: #111 }
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
  let body;
  if (!bulk) {
    const d = dockets[0] || inv.jobNo || '';
    const right = kv(docWord + ' No.', esc(inv.invoiceNo), true) + kv(docWord + ' Date', fmtDate(inv.date)) + (d ? kv('Docket No', esc(d)) : '') + kv('Party Ref. No', esc(inv.quotationNo || ''))
      + kv('A/C Of', esc(dkOf(d).shipper || '')) + kv('Place of Supply', esc((inv.posName || P.stateName || '') + (inv.pos && inv.pos !== '97' ? ' (' + inv.pos + ')' : P.stateCode ? ' (' + P.stateCode + ')' : '')))
      + (inv.prevInvoiceNo ? kv('Against Invoice No.', esc(inv.prevInvoiceNo), true) + kv('Invoice Date', fmtDate(inv.prevInvoiceDate)) + (inv.reason ? kv('Reason', esc(inv.reason)) : '') : '') + (fcy ? kv('Currency', esc(inv.currency) + ' @ ' + inv.exRate) : '');
    body = `<div class="pg">${head}${billTo(right)}${d || inv.mawbNo ? shipBox(d) : ''}
      <table class="ch"><thead>${gstHead}</thead><tbody>${lines.map(gstRow).join('')}${gstTotal(lines)}</tbody></table>${totals}${foot}</div>`;
  } else {
    // page 1: the charges added up charge by charge (Qty = dockets with that charge)
    const g = new Map();
    for (const l of lines) {
      const k = [String(l.charge || '').trim().toUpperCase(), l.sac, l.narration || '', l.currency || 'INR', n(l.exRate) || 1, l.igstPct, l.cgstPct].join('|');
      if (!g.has(k)) g.set(k, { ...l, qty: 0, rate: '', amount: 0, inrAmount: 0, igst: 0, cgst: 0, sgst: 0, total: 0, receiptNo: '', containerNo: '' });
      const a = g.get(k); a.qty += 1; for (const f of ['amount', 'inrAmount', 'igst', 'cgst', 'sgst', 'total']) a[f] = r2(a[f] + n(l[f]));
    }
    const sum = [...g.values()].map(a => ({ ...a, rate: a.qty ? r2(a.amount / a.qty) : a.amount }));
    const right = kv(kind === 'creditnote' ? 'CREDIT NOTE NO' : kind === 'debitnote' ? 'DEBIT NOTE NO' : 'BILL NO', esc(inv.invoiceNo), true) + kv(kind === 'creditnote' ? 'CREDIT NOTE DATE' : kind === 'debitnote' ? 'DEBIT NOTE DATE' : 'BILL DATE', fmtDate(inv.date)) + kv('Dockets', String(dockets.length)) + kv('Place of Supply', esc((inv.posName || P.stateName || '') + (inv.pos && inv.pos !== '97' ? ' (' + inv.pos + ')' : P.stateCode ? ' (' + P.stateCode + ')' : '')))
      + (inv.prevInvoiceNo ? kv('Against Invoice No.', esc(inv.prevInvoiceNo), true) + kv('Invoice Date', fmtDate(inv.prevInvoiceDate)) + (inv.reason ? kv('Reason', esc(inv.reason)) : '') : '') + (fcy ? kv('Currency', esc(inv.currency) + ' @ ' + inv.exRate) : '');
    const annHead = `<tr><th rowspan="2">Sr.</th><th rowspan="2" class="pl">Charge Name</th><th rowspan="2">Receipt No.</th><th rowspan="2">Receipt Date</th><th rowspan="2">SAC Code</th><th rowspan="2">Amount</th><th rowspan="2">Dis.</th><th colspan="2">CGST</th><th colspan="2">SGST</th><th colspan="2">IGST</th></tr><tr><th>Rate</th><th>Amt.</th><th>Rate</th><th>Amt.</th><th>Rate</th><th>Amt.</th></tr>`;
    const annex = dockets.map(d => { const ls = lines.filter(l => String(l.jobNo || '').trim() === d); if (!ls.length) return ''; const s = (k) => r2(ls.reduce((a, l) => a + n(l[k]), 0));
      return `<div class="blk">${shipBox(d, { annex: true })}<table class="ch"><thead>${annHead}</thead><tbody>${ls.map((l, i) => `<tr><td class="r">${i + 1}</td><td class="pl">${esc(l.charge)}${showNarr(l.narration) ? `<div class="s">${esc(l.narration)}</div>` : ''}</td><td>${esc(l.receiptNo || '')}</td><td>${l.receiptDate ? fmtDate(l.receiptDate) : ''}</td><td>${esc(l.sac)}</td><td class="r">${f2(l.inrAmount)}</td><td class="r">${f2(l.discount)}</td><td class="r">${f2(l.cgstPct)}</td><td class="r">${f2(l.cgst)}</td><td class="r">${f2(l.sgstPct)}</td><td class="r">${f2(l.sgst)}</td><td class="r">${f2(l.igstPct)}</td><td class="r">${f2(l.igst)}</td></tr>`).join('')}
        <tr class="tot"><td colspan="5" class="r">TOTAL ::</td><td class="r">${f2(s('inrAmount'))}</td><td></td><td></td><td class="r">${f2(s('cgst'))}</td><td></td><td class="r">${f2(s('sgst'))}</td><td></td><td class="r">${f2(s('igst'))}</td></tr></tbody></table></div>`; }).join('');
    body = `<div class="pg">${head}${billTo(right)}<table class="ch"><thead>${gstHead}</thead><tbody>${sum.map(gstRow).join('')}${gstTotal(sum)}</tbody></table>${totals}${foot}</div>
      <div class="ann">${annex}</div><div class="pf"><span>Bill No. : ${esc(inv.invoiceNo)}</span><span>Bill Date : ${fmtDate(inv.date)}</span><span>${esc(H.branchName ? 'Branch : ' + H.branchName : '')}</span></div>`;
  }
  const footer = `${kind === 'creditnote' ? 'Credit Note' : kind === 'debitnote' ? 'Debit Note' : 'Bill'} No. : ${esc(inv.invoiceNo)} &nbsp; &nbsp; Date : ${fmtDate(inv.date)}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(inv.invoiceNo)}</title>${bulk ? `<meta name="pdf-footer" content="${footer}">` : ''}<style>${css}</style></head><body>${body}</body></html>`;
  if (Math.abs(lineSum - r2(T.total - T.round)) > 1 && !bulk) console.warn('invoice print: lines', lineSum, 'bill', T.total);
  return { html, inv };
}
// 08-Nov-2026: the invoice behind a voucher as a PDF - opened in a new tab, or downloaded
async function invoicePdf(voucherId) {
  const head = await api(BASE + '/by-voucher/' + voucherId);
  if (!head || !head.id) throw Object.assign(new Error('This bill has no GST invoice in EagleView'), { noInvoice: true });
  const { html, inv } = await invoiceHtml(head.id);
  const r = await fetch(BASE + '/' + head.id + '/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'PDF not made (HTTP ' + r.status + ')'); }
  return { blob: await r.blob(), name: String(inv.invoiceNo).replace(/[\/\\]+/g, '-') + '.pdf', inv };
}
export async function openInvoicePdf(voucherId, download) {
  // the tab is opened at once (on the click) so the browser does not block it, and filled when the PDF is ready
  const w = download ? null : window.open('', '_blank');
  if (w) { try { w.document.write('<p style="font:14px sans-serif;padding:20px">Making the invoice PDF...</p>'); } catch (e) { /* ignore */ } }
  try {
    const { blob, name } = await invoicePdf(voucherId); const url = URL.createObjectURL(blob);
    if (download || !w) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
    else w.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (e) {
    // 09-Nov-2026: when the PDF cannot be made, the saved invoice still opens in the tab - the same page as Print
    if (w && !e.noInvoice) {
      try {
        const head = await api(BASE + '/by-voucher/' + voucherId);
        if (head && head.id) { const { html } = await invoiceHtml(head.id); w.document.open(); w.document.write(html); w.document.close(); return { pdf: false, reason: e.message }; }
      } catch (e2) { /* fall through */ }
    }
    if (w) w.close(); throw e;
  }
  return { pdf: true };
}
// Mail / WhatsApp of the invoice behind a voucher (PDF attached), as a small window over the screen
export function InvoiceSend({ voucherId, mode, onClose }) {
  const [inv, setInv] = useState(null); const [contact, setContact] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { (async () => { try { const head = await api(BASE + '/by-voucher/' + voucherId); if (!head || !head.id) throw new Error('This bill has no GST invoice in EagleView');
    const full = await api(BASE + '/' + head.id); setInv(full); setContact(await api(BASE + '/' + head.id + '/contact').catch(() => ({}))); } catch (e) { setErr(e.message); } })(); }, [voucherId]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '80px 16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, width: 'min(820px, 100%)', boxShadow: '0 20px 50px rgba(15,23,42,.35)', padding: 8 }}>
        {err ? <div style={{ padding: 12, color: T.dr, fontSize: 12 }}>{err} <Btn small kind="ghost" onClick={onClose}><X size={11} /> Close</Btn></div>
          : inv && contact ? <SendPanel mode={mode} inv={inv} h={{ email: contact.email || inv.email || '' }} initialTo={mode === 'whatsapp' ? contact.phone || '' : undefined} onClose={onClose} onDone={() => null} />
            : <div style={{ padding: 12, fontSize: 12, color: T.muted }}>Opening...</div>}
      </div>
    </div>
  );
}
// 08-Nov-2026: a bill opened from Outstanding / reports - the invoice as a PDF, with Print, Download, Mail and WhatsApp
export function InvoiceViewer({ voucherId, invoiceId, onClose }) {
  const nav = useNavigate();
  const [inv, setInv] = useState(null); const [url, setUrl] = useState(''); const [err, setErr] = useState(''); const [mode, setMode] = useState(null); const [contact, setContact] = useState({});
  const [page, setPage] = useState(''); const [pdfErr, setPdfErr] = useState(''); // 09-Nov-2026: the invoice page when no PDF can be made
  useEffect(() => {
    let alive = true; let made = '';
    (async () => {
      try {
        const head = invoiceId ? { id: invoiceId } : await api(BASE + '/by-voucher/' + voucherId);
        if (!head || !head.id) throw new Error('This bill has no GST invoice in EagleView');
        const { html, inv: full } = await invoiceHtml(head.id); if (!alive) return; setInv(full);
        api(BASE + '/' + head.id + '/contact').then(c => alive && setContact(c || {})).catch(() => null);
        const r = await fetch(BASE + '/' + head.id + '/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html }) });
        if (!r.ok) { const j = await r.json().catch(() => ({})); if (alive) { setPage(html); setPdfErr(j.error || 'PDF not made (HTTP ' + r.status + ')'); } return; }
        made = URL.createObjectURL(await r.blob()); if (alive) setUrl(made);
      } catch (e) { if (alive) setErr(e.message); }
    })();
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [voucherId, invoiceId]);
  const fileName = inv ? String(inv.invoiceNo).replace(/[\/\\]+/g, '-') + '.pdf' : 'invoice.pdf';
  const dl = () => { if (!url) return; const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); };
  const prt = () => { const w = window.open(url, '_blank'); if (w) setTimeout(() => { try { w.print(); } catch (e) { /* the PDF viewer has its own Print */ } }, 800); };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, width: 'min(1000px, 100%)', height: 'min(92vh, 1100px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(15,23,42,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${T.headBorder}`, flexWrap: 'wrap' }}>
          <b style={{ fontSize: 13, marginRight: 'auto' }}>{inv ? inv.invoiceNo + ' - ' + inv.partyName + ' - ' + (inv.currency && inv.currency !== 'INR' && inv.totalFcy ? inv.currency + ' ' + inr(inv.totalFcy) : 'INR ' + inr(inv.total)) : 'Invoice'}{inv && inv.irn && inv.irnStatus !== 'Cancelled' && <span style={{ marginLeft: 6, fontSize: 10, color: '#047857' }}>IRN</span>}</b>
          <Btn small kind="plain" onClick={dl} disabled={!url}><Receipt size={12} /> Download PDF</Btn>
          <Btn small kind="plain" onClick={prt} disabled={!url}><Printer size={12} /> Print</Btn>
          <Btn small kind="plain" onClick={() => setMode('mail')} disabled={!inv}><Mail size={12} /> E-mail</Btn>
          <Btn small kind="plain" onClick={() => setMode('whatsapp')} disabled={!inv}><MessageCircle size={12} /> WhatsApp</Btn>
          {inv && <Btn small kind="ghost" onClick={() => nav('/accounts-hub?item=gst' + inv.kind + '&inv=' + encodeURIComponent(inv.invoiceNo))}>Open in GST Invoice</Btn>}
          <Btn small kind="ghost" onClick={onClose}><X size={12} /> Close</Btn>
        </div>
        {mode && inv && <div style={{ padding: 8, borderBottom: `1px solid ${T.headBorder}` }}><SendPanel mode={mode} inv={inv} h={{ email: contact.email || inv.email || '' }} initialTo={mode === 'whatsapp' ? contact.phone || '' : undefined} onClose={() => setMode(null)} onDone={() => setMode(null)} /></div>}
        <div style={{ flex: 1, background: '#f1f5f9' }}>
          {err ? <div style={{ padding: 16, color: T.dr, fontSize: 12 }}>{err}</div>
            : url ? <iframe title="invoice" src={url} style={{ width: '100%', height: '100%', border: 0 }} />
            : page ? <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}><div title={pdfErr} style={{ padding: '4px 10px', fontSize: 11, color: T.amber, background: T.amberBg }}>PDF could not be made on this computer - the saved invoice is shown; Print works from here.<button type="button" onClick={() => printInvoice(inv.id)} style={{ marginLeft: 8, fontSize: 11, cursor: 'pointer' }}>Print</button></div><iframe title="invoice" srcDoc={page} style={{ width: '100%', flex: 1, border: 0, background: '#fff' }} /></div>
              : <div style={{ padding: 16, fontSize: 12, color: T.muted }}>Making the PDF...</div>}
        </div>
      </div>
    </div>
  );
}
export async function printInvoice(id) {
  const { html } = await invoiceHtml(id);
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* ignore */ } setTimeout(() => f.remove(), 1500); }, 250);
}

// ------------------------------------------------------------------ small typeahead
function Suggest({ value, onText, onPick, fetcher, render, placeholder, style, mandatory, disabled, minChars = 2 }) {
  const [list, setList] = useState([]); const [open, setOpen] = useState(false); const tm = useRef(null); const [hi, setHi] = useState(0);
  useEffect(() => () => clearTimeout(tm.current), []);
  const ask = (s) => { clearTimeout(tm.current); if (String(s).trim().length < minChars) { setList([]); return; } tm.current = setTimeout(() => fetcher(s).then(r => { setList(r || []); setHi(0); setOpen(true); }).catch(() => setList([])), 250); };
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} disabled={disabled} placeholder={placeholder} style={{ ...(mandatory && !value ? mandStyle : inputStyle), ...style }}
        onChange={e => { onText(e.target.value); ask(e.target.value); }} onFocus={() => list.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 180)}
        onKeyDown={e => { if (!open || !list.length) return; if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(list.length - 1, h + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)); } else if (e.key === 'Enter') { e.preventDefault(); onPick(list[hi]); setOpen(false); } }} />
      {open && list.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 30, top: 27, left: 0, right: 0, minWidth: 280, maxHeight: 260, overflow: 'auto', background: '#fff', border: `1px solid ${T.headBorder}`, borderRadius: 6, boxShadow: '0 8px 20px rgba(15,23,42,.14)' }}>
          {list.map((it, i) => <div key={i} onMouseDown={() => { onPick(it); setOpen(false); }} style={{ padding: '5px 8px', cursor: 'pointer', fontSize: 11.5, background: i === hi ? T.headBg : '#fff', borderBottom: '1px solid #f1f5f9' }}>{render(it)}</div>)}
        </div>
      )}
    </div>
  );
}
const Check = ({ label, checked, onChange, disabled }) => <label style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0, cursor: disabled ? 'default' : 'pointer', fontSize: 11, fontWeight: 600, opacity: disabled ? 0.55 : 1, height: 25, whiteSpace: 'nowrap' }}><input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /> {label}</label>;

// ================================================================== the screen
export default function GstInvoiceDesk({ kind: kindId }) {
  const nav = useNavigate(); const [params, setParams] = useSearchParams();
  const g = useGlobalContext() || {};
  const myBranch = (g.activeBranch && !g.activeBranch.isAll && (g.activeBranch.branchCode || g.activeBranch.branch_code)) || ''; // 'All branches' = pick one on the form
  const [meta, setMeta] = useState(null); const [metaErr, setMetaErr] = useState('');
  const [tab, setTab] = useState('entry');
  const [h, setH] = useState(() => emptyHead(kindId, myBranch));
  const [lines, setLines] = useState([]); const [ln, setLn] = useState(emptyLine()); const [editIdx, setEditIdx] = useState(-1);
  const [branches, setBranches] = useState([]); // branches of the picked party
  const [editId, setEditId] = useState(null); const [loaded, setLoaded] = useState(null); // invoice open for Modify
  const [nextNo, setNextNo] = useState(''); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState(null); const [showPost, setShowPost] = useState(false);
  const [exp, setExp] = useState(null); const [job, setJob] = useState(null);
  const [panel, setPanel] = useState(null); const [provJob, setProvJob] = useState('');
  const reloadLoaded = () => loaded && api(BASE + '/' + loaded.id).then(setLoaded).catch(() => null);
  const kind = useMemo(() => (meta ? meta.kinds.find(k => k.id === kindId) : null) || { id: kindId, label: kindId, gst: true }, [meta, kindId]);
  const set = (k) => (v) => setH(o => ({ ...o, [k]: v && v.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));
  useEffect(() => { api(BASE + '/meta').then(setMeta).catch(e => setMetaErr(e.message)); }, []);
  // 05-Nov-2026: the invoice no comes from the division's iCAFFE series (Settings > Number Series); division from the docket, or chosen
  const divFrom = (v) => { const m = /(?:^|\/|-)(AE|AI|SE|SI)(?:\/|-|$)/.exec(String(v || '').toUpperCase()); return m ? m[1] : ''; };
  const divAuto = divFrom(h.jobNo) || divFrom((h.dockets || [])[0]) || divFrom((lines.find(l => l.jobNo) || {}).jobNo);
  const division = h.division || divAuto;
  const [noNote, setNoNote] = useState('');
  useEffect(() => { if (!editId) api(`${BASE}/next-no?kind=${kindId}&branch=${encodeURIComponent(h.branchCode || myBranch)}&date=${h.date}&division=${division}`).then(r => { setNextNo(r.no); setNoNote(r.note || ''); }).catch(() => setNextNo('')); }, [kindId, h.date, h.branchCode, editId, division]);
  // switching kind from the menu = a fresh screen
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } clear(); setTab('entry'); }, [kindId]);
  // opened from a report / voucher (voucher=), from the search (inv=), or "Credit Note" on an invoice (prev=)
  useEffect(() => {
    const vid = params.get('voucher'), inv = params.get('inv'), prev = params.get('prev');
    if (vid) api(BASE + '/by-voucher/' + vid).then(r => (r ? openInvoice(r) : setMsg({ bad: true, t: 'This voucher was not made from GST Invoice - open it from the voucher screens' }))).catch(e => setMsg({ bad: true, t: e.message }));
    else if (inv) api(BASE + '/by-no?no=' + encodeURIComponent(inv)).then(r => r && openInvoice(r)).catch(() => null);
    else if (prev) api(BASE + '/by-no?no=' + encodeURIComponent(prev)).then(r => { if (!r) return; const { id, invoiceNo, status, voucherId, lines: ls, kind: k0, createdBy, modifiedBy, ...rest } = r;
      setH({ ...emptyHead(kindId, myBranch), ...pickHead(rest), prevInvoiceNo: invoiceNo, prevInvoiceDate: r.date, reason: '' }); setLines(ls.map(l => ({ ...l }))); setMsg({ t: 'Copied from ' + invoiceNo + ' - change the lines to what is being ' + (kindId === 'creditnote' ? 'credited' : 'debited') }); }).catch(() => null);
    // "GST Invoice" on the Shipment Registration docket: the docket comes filled in (05-Nov-2026)
    else if (params.get('job')) { const jn = params.get('job');
      api(`${BASE}/job?by=docket&no=${encodeURIComponent(jn)}`).then(j => { setJob(j || null); setH(o => ({ ...o, jobNo: j ? j.jobNo : jn, hawbNo: (j && j.hawbNo) || o.hawbNo, mawbNo: (j && j.mawbNo) || o.mawbNo, branchCode: o.branchCode || (j && j.branchCode) || '' }));
        setMsg({ t: j ? 'Docket ' + j.jobNo + (j.party ? ' - ' + j.party : '') + (j.mawbNo ? ' - MAWB ' + j.mawbNo : '') + ' - pick the party and add the charges' : 'Docket ' + jn + ' not found' }); }).catch(() => setH(o => ({ ...o, jobNo: jn }))); }
  }, [params.get('voucher'), params.get('inv'), params.get('prev'), params.get('job')]);

  const our = meta ? meta.our : null;
  // 09-Nov-2026: a bill loaded from iCAFFE opens for viewing only - no charge entry, no edit / delete of lines, no Save;
  // its totals are the bill's own (the server fills place of supply, address and line GST for viewing)
  const viewOnly = !!(loaded && (loaded.viewOnly || loaded.createdBy === 'iCAFFE'));
  const c = useMemo(() => {
    const x = calc(h, lines, our, kind);
    if (!viewOnly || !loaded) return x;
    return { ...x, igst: n(loaded.igst), cgst: n(loaded.cgst), sgst: n(loaded.sgst), roundOff: n(loaded.roundOffAmt), total: n(loaded.total) };
  }, [h, lines, our, kind, viewOnly, loaded]);
  const lineCalc = useMemo(() => calc(h, ln.charge ? [ln] : [], our, kind).lines[0], [ln, h, our, kind]);

  // posting preview (debounced) - the exact voucher Save will make
  useEffect(() => {
    if (!lines.length || !(h.partyName || h.ledgerId) || !h.pos && kind.gst) { setPosting(null); return; }
    const tm = setTimeout(() => postJson(BASE + '/preview', { ...h, kind: kindId, lines }).then(r => setPosting(r.posting)).catch(() => setPosting(null)), 500);
    return () => clearTimeout(tm);
  }, [h, lines, kindId]);

  function pickHead(r) { const o = {}; for (const k of Object.keys(emptyHead(kindId, ''))) if (r[k] !== undefined && r[k] !== null) o[k] = typeof emptyHead(kindId, '')[k] === 'boolean' ? !!r[k] : r[k]; return o; }
  function openInvoice(r) {
    if (r.kind !== kindId) { setParams({ item: 'gst' + r.kind, inv: r.invoiceNo }); return; }
    setH({ ...emptyHead(kindId, myBranch), ...pickHead(r) }); setLines(r.lines.map(l => ({ ...l }))); setEditId(r.id); setLoaded(r); setTab('entry'); setLn(emptyLine()); setEditIdx(-1);
    setMsg(r.status === 'Void' ? { bad: true, t: 'This invoice is VOID' + (r.voidReason ? ' - ' + r.voidReason : '') }
      : r.createdBy === 'iCAFFE' ? { t: 'Opened ' + r.invoiceNo + ' - loaded from iCAFFE, view only (print / mail work; for a change issue a credit / debit note)' + (r.received ? ' - ' + inr(r.received) + ' already received / credited against it' : '') }
      : { t: 'Opened ' + r.invoiceNo + ' for Modify' + (r.received ? ' - ' + inr(r.received) + ' already received / credited against it' : '') });
  }
  function clear() { setH(emptyHead(kindId, myBranch)); setLines([]); setLn(emptyLine()); setEditIdx(-1); setEditId(null); setLoaded(null); setBranches([]); setJob(null); setExp(null); setMsg(null); setPosting(null); setPanel(null);
    if (params.get('voucher') || params.get('inv') || params.get('prev') || params.get('job')) setParams({ item: 'gst' + kindId }); }

  // ---- party
  const pickParty = (p) => {
    const b = p.branches[0] || {};
    setBranches(p.branches);
    setH(o => ({ ...o, partyName: p.name, partyId: p.partyId || null, ledgerId: p.ledgerId || null, partyBranchId: b.id || null, ...branchFields(b, o) }));
    // iCAFFE: the invoice is made only on the party's account (ledger)
    if (!p.ledgerId) api(`${BASE}/party-account?partyId=${p.partyId || ''}&name=${encodeURIComponent(p.name)}&gstin=${encodeURIComponent(b.gstin || '')}`)
      .then(a => { if (a) setH(o => (o.partyName === p.name ? { ...o, ledgerId: a.ledgerId } : o)); else setMsg({ bad: true, t: 'Party Account not created ! Make the ledger of ' + p.name + ' in Accounts > Masters > Ledger Account, then pick the party again.' }); })
      .catch(e => setMsg({ bad: true, t: e.message + ' (type the account name in Party and pick the ledger from the list)' })); // 06-Nov-2026: look-alike accounts are never guessed
  };
  const branchFields = (b, o) => {
    const st = meta && b.gstin ? meta.states.find(s => s.code === String(b.gstin).slice(0, 2)) : meta && b.state ? meta.states.find(s => s.name.toUpperCase() === String(b.state).toUpperCase()) : null;
    const foreign = b.country && b.country !== 'IN';
    return { address: b.address || '', gstin: b.gstin || '', stateName: st ? st.name : (b.state || ''), stateCode: st ? st.code : '', email: b.email || o.email || '',
      pos: foreign || kindId === 'overseas' ? '97' : st ? st.code : o.pos, posName: foreign || kindId === 'overseas' ? 'Foreign Country' : st ? st.name : o.posName,
      countryCode: foreign ? b.country : o.countryCode, sez: b.sez ? (o.sez || 'SEZ SUPPLIES WITH PAYMENT') : o.sez, gstExempt: b.exempt || o.gstExempt };
  };
  const onGstin = (v) => { const g2 = String(v || '').toUpperCase(); const st = meta && /^\d{2}/.test(g2) ? meta.states.find(s => s.code === g2.slice(0, 2)) : null;
    setH(o => ({ ...o, gstin: g2, ...(st ? { stateName: st.name, stateCode: st.code, pos: o.pos === '97' ? o.pos : st.code, posName: o.pos === '97' ? o.posName : st.name } : {}) })); };

  // ---- docket / house no
  const findJob = async () => {
    const no = h.docketBy === 'hawb' ? h.hawbNo : h.jobNo; if (!String(no || '').trim()) return;
    try {
      const j = await api(`${BASE}/job?by=${h.docketBy}&no=${encodeURIComponent(no.trim())}`); setJob(j);
      if (!j) { setMsg({ bad: true, t: 'No job found for ' + no + ' - the invoice can still be saved with this number' }); return; }
      setH(o => (o.bulk ? { ...o, dockets: o.dockets.includes(j.jobNo) ? o.dockets : [...o.dockets, j.jobNo], jobNo: '', hawbNo: '' }
        : { ...o, jobNo: j.jobNo, hawbNo: j.hawbNo || o.hawbNo, mawbNo: j.mawbNo || o.mawbNo, branchCode: o.branchCode || j.branchCode || '' }));
      setMsg({ t: j.dir + ' job ' + j.jobNo + (j.party ? ' - ' + j.party : '') + (j.mawbNo ? ' - MAWB ' + j.mawbNo : '') + (h.partyName ? '' : ' - type the party or pick "' + (j.party || '') + '"') });
    } catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  const showExpense = async () => {
    if (!h.jobNo) { setMsg({ bad: true, t: 'Enter the docket no first' }); return; }
    try { setExp(await api(BASE + '/expenses?jobNo=' + encodeURIComponent(h.jobNo))); } catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  const prevLookup = async () => {
    if (!h.prevInvoiceNo) return;
    const r = await api(BASE + '/by-no?no=' + encodeURIComponent(h.prevInvoiceNo)).catch(() => null);
    if (!r) { setMsg({ bad: true, t: 'Invoice ' + h.prevInvoiceNo + ' not found' }); return; }
    setH(o => ({ ...o, prevInvoiceDate: r.date, ...(o.partyName ? {} : pickHead({ partyType: r.partyType, partyName: r.partyName, partyId: r.partyId, ledgerId: r.ledgerId, address: r.address, gstin: r.gstin, stateName: r.stateName, stateCode: r.stateCode, pos: r.pos, posName: r.posName, jobNo: r.jobNo, hawbNo: r.hawbNo, mawbNo: r.mawbNo, currency: r.currency, exRate: r.exRate })) }));
    setMsg({ t: 'Against ' + r.invoiceNo + ' of ' + fmtDate(r.date) + ' - ' + r.partyName + ' - ' + inr(r.total) });
  };

  // ---- charge line
  const pickCharge = (cg) => setLn(o => ({ ...o, charge: cg.name, sac: cg.sac || o.sac, gstRate: cg.exempt ? 0 : cg.gstRate != null && cg.gstRate !== '' ? Number(cg.gstRate) : o.gstRate }));
  const curRate = (code) => { const cu = meta && meta.currencies.find(x => x.code === code); return cu ? (kindId === 'overseas' || h.pos === '97' ? cu.exportRate : cu.importRate) || 1 : 1; };
  const addLine = () => {
    if (!String(ln.charge).trim()) { setMsg({ bad: true, t: 'Choose the charge' }); return; }
    if (!(n(ln.rate) * (n(ln.qty) || 1))) { setMsg({ bad: true, t: 'Enter the rate' }); return; }
    if (h.bulk && !(ln.jobNo && (ln.jobNo === '*ALL*' || h.dockets.includes(ln.jobNo)))) { setMsg({ bad: true, t: 'Bulk invoice: choose the docket of this charge (or all dockets)' }); return; }
    const row = { ...ln, jobNo: ln.jobNo || h.jobNo, charge: String(ln.charge).toUpperCase().trim() };
    if (h.bulk && ln.jobNo === '*ALL*' && editIdx < 0) setLines(ls => [...ls, ...h.dockets.map(d => ({ ...row, jobNo: d }))]);
    else setLines(ls => (editIdx >= 0 ? ls.map((x, i) => (i === editIdx ? { ...row, jobNo: row.jobNo === '*ALL*' ? x.jobNo : row.jobNo } : x)) : [...ls, row]));
    setLn({ ...emptyLine(), currency: ln.currency, exRate: ln.exRate, jobNo: h.bulk ? ln.jobNo : '' }); setEditIdx(-1); setMsg(null);
  };
  const addFromSheet = (ls) => { setLines(x => [...x, ...ls]); setMsg({ t: ls.length + ' charge(s) added from the provisional sheet of ' + ls[0].jobNo }); setPanel(null); };
  // iCAFFE: Bulk Invoice needs the party first, then opens the "Bulk invoice" popup (dockets of this party)
  const setBulk = (on) => {
    if (on && !String(h.partyName || '').trim()) { setMsg({ bad: true, t: 'Please Select Party' }); return; }
    if (on && !h.ledgerId) { setMsg({ bad: true, t: 'Party Account not created !' }); return; }
    setH(o => ({ ...o, bulk: on, dockets: on ? (o.dockets.length ? o.dockets : o.jobNo ? [o.jobNo] : []) : [], jobNo: on ? '' : (o.dockets[0] || o.jobNo) })); setPanel(on ? 'dockets' : null);
  };
  // Ok on the popup: each ticked docket's cost sheet into the grid, docket-wise; a charge already there for that docket is skipped
  const addBulkDockets = async (ds) => {
    if (!ds.length) { setMsg({ bad: true, t: 'No docket records selected.' }); return false; }
    try {
      const r = await postJson(BASE + '/bulk-cost', { dockets: ds });
      const have = new Set(lines.map(l => String(l.jobNo || '').toUpperCase() + '|' + String(l.charge).toUpperCase()));
      const add = []; const dup = []; const none = [];
      for (const d of r) {
        if (!d.lines.length) { none.push(d.docketNo); continue; }
        const dd = [];
        for (const l of d.lines) { const k = d.docketNo + '|' + l.charge; if (have.has(k)) { dd.push(l.charge); continue; } have.add(k); add.push({ ...emptyLine(), ...l }); }
        if (dd.length) dup.push('The following charges already exist for docket ' + d.docketNo + ': ' + dd.join(', '));
      }
      setLines(x => [...x, ...add]);
      setH(o => ({ ...o, dockets: [...o.dockets, ...ds.filter(d => !o.dockets.includes(d))] }));
      setMsg({ bad: !!(dup.length || none.length), t: [add.length + ' charge(s) added from the cost sheet of ' + ds.length + ' docket(s)', ...dup, none.length ? 'No provisional cost sheet on ' + none.join(', ') + ' - add its charges by hand or make the sheet' : ''].filter(Boolean).join('. ') });
      return true;
    } catch (e) { setMsg({ bad: true, t: e.message }); return false; }
  };
  // iCAFFE warns when this kind of invoice is already made for the party and docket
  useEffect(() => {
    if (h.bulk || !h.jobNo || !h.partyName || kind.againstBill) return undefined;
    const tm = setTimeout(() => api(`${BASE}/exists?kind=${kindId}&party=${encodeURIComponent(h.partyName)}&jobNo=${encodeURIComponent(h.jobNo)}&not=${editId || 0}`)
      .then(r => { if (r && r.length) setMsg({ bad: true, t: kind.label + ' Invoice already generated for this party and docket no. (' + r.map(x => x.invoiceNo).join(', ') + ')' }); }).catch(() => null), 600);
    return () => clearTimeout(tm);
  }, [h.jobNo, h.partyName, h.bulk, kindId, editId]);
  const billExpense = (e) => { setLn({ ...emptyLine(), charge: e.charge, rate: e.amount, jobNo: h.jobNo, currency: 'INR', exRate: 1, gstRate: kindId === 'reimbursable' ? 0 : 18 }); setExp(null); setMsg({ t: 'Check the rate and GST % of ' + e.charge + ', then Add' }); };

  // ---- save / modify / void
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = { ...h, division, kind: kindId, branchCode: h.branchCode || myBranch, roundOff: Number(h.roundOff), lines };
      const r = editId ? await postJson(BASE + '/' + editId, body, 'PUT') : await postJson(BASE, body);
      setMsg({ ok: true, t: (editId ? 'Modified ' : 'Saved ') + r.invoiceNo + ' - ' + inr(r.total) + ' posted to accounts' });
      const full = await api(BASE + '/' + r.id); setEditId(r.id); setLoaded(full);
    } catch (e) { setMsg({ bad: true, t: e.message }); }
    setBusy(false);
  };
  const voidIt = async () => {
    if (!loaded) return; const reason = window.prompt('Void ' + loaded.invoiceNo + '? Its voucher leaves the books; the number stays. Reason:'); if (!reason) return;
    try { await postJson(BASE + '/' + loaded.id + '/void', { reason }); setMsg({ ok: true, t: loaded.invoiceNo + ' is void' }); setLoaded({ ...loaded, status: 'Void', voidReason: reason }); }
    catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  const isVoid = loaded && loaded.status === 'Void';
  const irnLive = !!(loaded && loaded.irn && loaded.irnStatus !== 'Cancelled');
  const del = async () => {
    if (!loaded || !window.confirm('Delete ' + loaded.invoiceNo + ' and its voucher? A copy is kept for audit. This cannot be undone from the screen.')) return;
    try { await api(BASE + '/' + loaded.id, { method: 'DELETE' }); const no = loaded.invoiceNo; clear(); setMsg({ ok: true, t: no + ' deleted' }); } catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  const postGstn = async () => {
    setBusy(true); setMsg({ t: 'Posting ' + loaded.invoiceNo + ' to the GST portal (IRP)...' });
    try { const r = await postJson(BASE + '/post-gstn', { ids: [loaded.id] }); const x0 = r.results[0] || {};
      setMsg(x0.ok ? { ok: true, t: 'IRN generated - Ack No ' + (x0.ackNo || '') + ' - it prints with the QR' } : { bad: true, t: 'Not posted: ' + (x0.error || 'no reply') }); reloadLoaded();
      if (!x0.ok && /not set up/i.test(x0.error || '')) setPanel('irn'); }
    catch (e) { setMsg({ bad: true, t: e.message }); }
    setBusy(false);
  };
  const parties = PARTY_TYPES[kindId === 'overseas' ? 'overseas' : '_'];
  const fcyInvoice = h.currency && h.currency !== 'INR';

  if (metaErr) return <Box title={'GST Invoice - ' + kind.label}><div style={{ color: T.dr, fontWeight: 700 }}>Could not load the invoice set-up: {metaErr}</div></Box>;
  return (
    <Sheet tabs={[{ id: 'entry', label: kind.label + (kind.label === 'OverSeas Agent' ? ' Invoice' : '') }, { id: 'search', label: 'Search' }]} tab={tab} onTab={setTab}
      right={<span style={{ fontSize: 11, color: T.muted }}>GST Invoice - posts to the books on Save</span>}>
      {tab === 'search' && <InvoiceSearch kindId={kindId} meta={meta} onOpen={(r) => api(BASE + '/' + r.id).then(openInvoice).catch(e => setMsg({ bad: true, t: e.message }))} />}
      {tab === 'entry' && <>
        {viewOnly && <div style={{ margin: '0 0 8px', padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, color: '#1e3a8a', fontWeight: 600 }}>
          VIEW ONLY - bill loaded from iCAFFE. Print, mail and WhatsApp work; for a change issue a credit / debit note.{loaded && loaded.viewNote ? ' (' + loaded.viewNote + ')' : ''}
        </div>}
        <fieldset disabled={viewOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        {/* -------- header: party, docket, GST, invoice - one compact box (05-Nov-2026) */}
        <Box pad={8} title={<span>Invoice {loaded && <Badge tone={isVoid ? 'bad' : 'ok'}>{isVoid ? 'VOID' : loaded.invoiceNo}</Badge>}</span>}
          right={<span style={{ fontSize: 10.5, color: T.muted, fontWeight: 600 }}>{our ? 'Our GSTIN ' + (our.gstin || '-') + ' (' + our.name + ')' : ''}{kind.gst ? ' - ' + (!h.pos ? 'choose Place of Supply' : c.zero ? 'zero rated, no GST' : h.gstExempt ? 'GST exempted' : h.rcm ? 'reverse charge' : c.intra ? 'CGST + SGST' : 'IGST') : ' - no GST'}</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: '5px 8px' }}>
            <Field label="Party Type" required><select style={h.partyType ? inputStyle : mandStyle} value={h.partyType} onChange={set('partyType')}><option value="">Select Party</option>{parties.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <Field label={<span style={{ display: 'inline-flex', gap: 8 }}>{(kindId === 'overseas' ? [['hawb', 'H/AWB'], ['master', 'Master']] : [['docket', 'Docket'], ['hawb', 'H/AWB']]).map(([v, l]) => <label key={v} style={{ display: 'inline-flex', gap: 3, margin: 0, alignItems: 'center', cursor: 'pointer', fontSize: 10.5 }}><input type="radio" style={{ margin: 0 }} checked={h.docketBy === v} onChange={() => set('docketBy')(v)} />{l}</label>)}</span>}>
              <input style={inputStyle} value={h.docketBy === 'hawb' ? h.hawbNo : h.docketBy === 'master' ? h.mawbNo : h.jobNo} placeholder={h.bulk ? 'ADD DOCKET' : h.docketBy === 'hawb' ? 'H/AWB NO' : h.docketBy === 'master' ? 'MASTER NO' : 'DOCKET NO.'}
                onChange={e => set(h.docketBy === 'hawb' ? 'hawbNo' : h.docketBy === 'master' ? 'mawbNo' : 'jobNo')(e.target.value.toUpperCase())} onBlur={() => h.docketBy !== 'master' && findJob()} onKeyDown={e => e.key === 'Enter' && findJob()} /></Field>
            <Field label={<span>Party{job && job.party && !h.partyName ? <> - <a style={{ cursor: 'pointer', color: T.head }} onClick={() => setH(o => ({ ...o, partyName: job.party }))}>{job.party}</a></> : null}</span>} required span={3}>
              <Suggest value={h.partyName} mandatory placeholder="PARTY NAME - type 2 letters" onText={v => setH(o => ({ ...o, partyName: v, partyId: null, ledgerId: null }))} onPick={pickParty}
                fetcher={s => api(`${BASE}/parties?type=${h.partyType}&q=${encodeURIComponent(s)}`)}
                render={p => <div><b>{p.name}</b> <span style={{ fontSize: 10, color: T.muted }}>{p.source === 'ledger' ? 'ledger in accounts' : (p.partyType || '') + (p.hasAccount ? ' - account ✓' : ' - no account')}{p.branches[0] && p.branches[0].gstin ? ' - ' + p.branches[0].gstin : ''}{p.branches.length > 1 ? ' - ' + p.branches.length + ' branches' : ''}</span></div>} />
            </Field>
            <Field label="Invoice No" span={2}><input style={roStyle} readOnly title={noNote} value={editId ? (loaded && loaded.invoiceNo) || '' : nextNo ? nextNo + '  (on Save)' : noNote ? noNote : 'on Save'} /></Field>
            <Field label="Date" required><input type="date" style={inputStyle} value={h.date} onChange={set('date')} /></Field>

            <Field label="GST No"><input style={inputStyle} value={h.gstin} maxLength={15} onChange={e => onGstin(e.target.value)} placeholder="GST NO" /></Field>
            <Field label="State / Code"><input style={roStyle} value={h.stateName ? h.stateName + (h.stateCode ? ' (' + h.stateCode + ')' : '') : ''} readOnly placeholder="STATE" /></Field>
            <Field label="Party Address" span={3}>
              {branches.length > 1 ? <select style={inputStyle} value={h.partyBranchId || ''} onChange={e => { const b = branches.find(x => String(x.id) === e.target.value); if (b) setH(o => ({ ...o, partyBranchId: b.id, ...branchFields(b, o) })); }}>{branches.map(b => <option key={b.id} value={b.id}>{b.label} - {b.address} {b.gstin ? '(' + b.gstin + ')' : ''}</option>)}</select>
                : <input style={inputStyle} value={h.address} onChange={set('address')} placeholder="PARTY ADDRESS" />}
            </Field>
            <Field label="Currency"><select style={inputStyle} value={h.currency} onChange={e => { const v = e.target.value; setH(o => ({ ...o, currency: v, exRate: v === 'INR' ? 1 : curRate(v) })); setLn(o => ({ ...o, currency: v, exRate: v === 'INR' ? 1 : curRate(v) })); }}>
              <option value="INR">INR</option>{(meta ? meta.currencies : []).filter(x => x.code !== 'INR').map(x => <option key={x.code} value={x.code}>{x.code} - {x.name}</option>)}</select></Field>
            <Field label="Ex. Rate"><input style={fcyInvoice ? inputStyle : roStyle} readOnly={!fcyInvoice} value={h.exRate} onChange={set('exRate')} /></Field>
            <Field label="Branch"><select style={inputStyle} value={h.branchCode || myBranch} onChange={set('branchCode')} disabled={!!editId}>{(meta ? meta.branches : []).map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}{!(meta && meta.branches.length) && <option value="">-</option>}</select></Field>
            <Field label="Division" required><select style={division ? inputStyle : mandStyle} value={division} onChange={set('division')} disabled={!!editId} title="The invoice no comes from this division's series (iCAFFE)"><option value="">Select</option>{[['AE', 'Export Air'], ['AI', 'Import Air'], ['SE', 'Export Sea'], ['SI', 'Import Sea']].map(([k, l]) => <option key={k} value={k}>{k} - {l}</option>)}</select></Field>

            <Field label="Place Of Supply" required={kind.gst}><select style={kind.gst && !h.pos ? mandStyle : inputStyle} value={h.pos} onChange={e => { const v = e.target.value; const st = meta.states.find(s => s.code === v); setH(o => ({ ...o, pos: v, posName: v === '97' ? 'Foreign Country' : st ? st.name : '' })); }}>
              <option value="">Select</option>{(meta ? meta.states : []).map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}<option value="97">Foreign Country</option></select></Field>
            <Field label="SEZ"><select style={inputStyle} value={h.sez} onChange={set('sez')}><option value="">No SEZ</option><option value="SEZ SUPPLIES WITH PAYMENT">SEZ with payment</option><option value="SEZ SUPPLIES WITHOUT PAYMENT">SEZ without payment</option></select></Field>
            <Field label="Payment Option"><select style={inputStyle} value={h.paymentOption} onChange={set('paymentOption')}><option value="">Select</option><option value="SUPPLIES WITH PAYMENT">With payment</option><option value="SUPPLIES WITHOUT PAYMENT">Without payment (LUT)</option>{kindId === 'overseas' && <option value="REIMBURSABLE">Reimbursable</option>}</select></Field>
            {kindId === 'overseas' || h.pos === '97' ? <Field label="Country Code"><input style={inputStyle} value={h.countryCode} maxLength={3} onChange={e => set('countryCode')(e.target.value.toUpperCase())} placeholder="GB, US" /></Field>
              : <Field label="Round Off"><select style={inputStyle} value={String(h.roundOff)} onChange={e => set('roundOff')(Number(e.target.value))}><option value="1">Round Off</option><option value="0">No round off</option></select></Field>}
            <Field label="Email"><input style={inputStyle} value={h.email} onChange={set('email')} placeholder="Email" /></Field>
            <Field label="Cost Center"><input style={inputStyle} value={h.costCentre} onChange={set('costCentre')} placeholder="Cost Center" /></Field>
            <Field label="Quotation No." span={2}><input style={inputStyle} value={h.quotationNo} onChange={set('quotationNo')} placeholder="QUOTATION NO." /></Field>
          </div>
          {/* options + docket / previous invoice / bulk dockets in one strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '4px 14px', marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${T.headBorder}` }}>
            <Check label="GST Exempted" checked={h.gstExempt} onChange={set('gstExempt')} disabled={!kind.gst} />
            <Check label="Hide Ex.Rate" checked={h.hideExRate} onChange={set('hideExRate')} />
            <Check label="RCM" checked={h.rcm} onChange={set('rcm')} disabled={!kind.gst} />
            {!kind.againstBill && <Check label="Bulk Invoice" checked={h.bulk} onChange={setBulk} />}
            {kind.againstBill && <Check label="WithOut prev. invoice" checked={h.withOut} onChange={set('withOut')} />}
            {(kindId === 'overseas' || h.pos === '97') && <Field label="Round Off" style={{ width: 120 }}><select style={inputStyle} value={String(h.roundOff)} onChange={e => set('roundOff')(Number(e.target.value))}><option value="1">Round Off</option><option value="0">No round off</option></select></Field>}
            <span style={{ width: 1, alignSelf: 'stretch', background: T.headBorder }} />
            {h.bulk ? <>
              {h.dockets.map(d => <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 7px', border: `1px solid ${T.headBorder}`, borderRadius: 6, background: '#fff', fontSize: 11 }}>
                <b>{d}</b><a style={{ cursor: 'pointer', color: T.head, fontSize: 10.5 }} title="Provisional sheet of this docket" onClick={() => { setProvJob(d); setPanel('prov'); }}>sheet</a>
                <span style={{ fontSize: 10.5, color: T.muted }}>{inr(lines.filter(l => l.jobNo === d).reduce((a, l) => a + r2(n(l.rate) * (n(l.qty) || 1) * (n(l.exRate) || 1) - n(l.discount) * (n(l.exRate) || 1)), 0))}</span>
                <span style={{ cursor: 'pointer', color: T.dr }} onClick={() => setH(o => ({ ...o, dockets: o.dockets.filter(x => x !== d) }))}><X size={11} /></span></span>)}
              <Btn small kind="ghost" onClick={() => setPanel('dockets')}><Layers size={11} /> Choose dockets ({h.dockets.length})</Btn>
            </> : kind.againstBill ? <>
              <Field label="Previous Invoice No." required={!h.withOut} style={{ width: 170 }}><input style={!h.withOut && !h.prevInvoiceNo ? mandStyle : inputStyle} disabled={h.withOut} value={h.prevInvoiceNo} onChange={e => set('prevInvoiceNo')(e.target.value.toUpperCase())} onBlur={prevLookup} placeholder="PREVIOUS INVOICE NO" /></Field>
              <Field label="Date" style={{ width: 95 }}><input style={roStyle} readOnly value={fmtDate(h.prevInvoiceDate)} /></Field>
              <Field label="Reason To Issue" required style={{ width: 230 }}><select style={h.reason ? inputStyle : mandStyle} value={h.reason} onChange={set('reason')}><option value="">SELECT</option>{(meta ? meta.reasons : []).map(r => <option key={r}>{r}</option>)}</select></Field>
            </> : <>
              <Field label="MAWB / MBL" style={{ width: 140 }}><input style={inputStyle} value={h.mawbNo} onChange={e => set('mawbNo')(e.target.value.toUpperCase())} /></Field>
              <Field label="HAWB / HBL" style={{ width: 140 }}><input style={inputStyle} value={h.hawbNo} onChange={e => set('hawbNo')(e.target.value.toUpperCase())} /></Field>
              {job && <span style={{ fontSize: 11, color: T.muted, paddingBottom: 5 }}>{[job.dir, job.mode, job.sbBe ? (job.dir === 'Export' ? 'SB ' : 'BE ') + job.sbBe : ''].filter(Boolean).join(' - ')}</span>}
              <Btn small kind="ghost" onClick={showExpense} disabled={!h.jobNo}><Search size={11} /> Show Expense</Btn>
              <Btn small kind="ghost" onClick={() => { setProvJob(h.jobNo); setPanel('prov'); }} disabled={!h.jobNo}><ClipboardList size={11} /> Provisional Sheet</Btn>
            </>}
          </div>
        </Box>
        </fieldset>
        {exp && (
          <Grid title={'Expenses booked on ' + h.jobNo} right={<Btn small kind="ghost" onClick={() => setExp(null)}><X size={11} /> Close</Btn>} maxHeight={200} empty="No expense booked on this docket yet"
            cols={[{ label: 'Voucher', render: e => <b>{e.voucherNumber}</b> }, { label: 'Date', render: e => fmtDate(e.date) }, { label: 'Type', key: 'baseType' }, { label: 'Bill No', key: 'billNo' }, { label: 'Charge', key: 'charge' },
              { label: 'Expense', right: true, render: e => inr(e.amount) }, { label: 'Billed so far', right: true, render: e => (e.billed ? inr(e.billed) : '') }, { label: '', render: e => <Btn small kind="plain" onClick={() => billExpense(e)}><Plus size={11} /> Bill it</Btn> }]}
            rows={exp} />
        )}
        {panel === 'dockets' && h.bulk && <BulkInvoicePopup partyName={h.partyName} partyId={h.partyId} chosen={h.dockets} onOk={async ds => { if (await addBulkDockets(ds)) setPanel(null); }} onClose={() => setPanel(null)} />}
        {panel === 'prov' && provJob && <ProvisionalSheet key={provJob} jobNo={provJob} partyName={h.partyName} onAdd={isVoid ? null : addFromSheet} onClose={() => setPanel(null)} />}
        {/* -------- charge line: two rows */}
        {!viewOnly && <Box pad={8} title={editIdx >= 0 ? 'Charge (editing line ' + (editIdx + 1) + ')' : 'Charge'}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '5px 8px', alignItems: 'end' }}>
            <Field label="Charge" required span={3}>
              <Suggest value={ln.charge} mandatory minChars={1} placeholder="CHARGE" onText={v => setLn(o => ({ ...o, charge: v }))} onPick={pickCharge}
                fetcher={s => api(BASE + '/charges?q=' + encodeURIComponent(s))} render={cg => <div><b>{cg.name}</b> <span style={{ fontSize: 10, color: T.muted }}>{cg.sac ? 'SAC ' + cg.sac : ''}{cg.gstRate != null ? ' - GST ' + cg.gstRate + '%' : ''}{cg.master ? '' : ' - from charge list'}</span></div>} />
            </Field>
            <Field label="SAC"><input style={inputStyle} value={ln.sac} onChange={e => setLn({ ...ln, sac: e.target.value })} placeholder="SAC" /></Field>
            <Field label="Currency"><select style={inputStyle} value={ln.currency} onChange={e => setLn({ ...ln, currency: e.target.value, exRate: e.target.value === 'INR' ? 1 : curRate(e.target.value) })}>
              <option value="INR">INR</option>{(meta ? meta.currencies : []).filter(x => x.code !== 'INR').map(x => <option key={x.code} value={x.code}>{x.code}</option>)}</select></Field>
            <Field label="Ex.Rate"><input style={ln.currency === 'INR' ? roStyle : inputStyle} readOnly={ln.currency === 'INR'} value={ln.exRate} onChange={e => setLn({ ...ln, exRate: e.target.value })} /></Field>
            <Field label="Rate" required><input style={ln.rate ? inputStyle : mandStyle} value={ln.rate} onChange={e => setLn({ ...ln, rate: e.target.value })} placeholder="RATE" onKeyDown={e => e.key === 'Enter' && addLine()} /></Field>
            <Field label="Unit"><input style={inputStyle} value={ln.unit} onChange={e => setLn({ ...ln, unit: e.target.value.toUpperCase() })} placeholder="UNIT" /></Field>
            <Field label="Qty"><input style={inputStyle} value={ln.qty} onChange={e => setLn({ ...ln, qty: e.target.value })} onKeyDown={e => e.key === 'Enter' && addLine()} /></Field>
            <Field label="Discount"><input style={inputStyle} value={ln.discount} onChange={e => setLn({ ...ln, discount: e.target.value })} /></Field>
            <Field label="GST %"><input style={kind.gst ? inputStyle : roStyle} readOnly={!kind.gst} value={kind.gst ? ln.gstRate : 0} onChange={e => setLn({ ...ln, gstRate: e.target.value })} /></Field>
            <Field label="INR Amount"><input style={{ ...roStyle, fontWeight: 700 }} readOnly value={lineCalc ? inr(lineCalc.inrAmount) : ''} placeholder="INR" /></Field>

            <Field label="Container No"><input style={inputStyle} value={ln.containerNo} onChange={e => setLn({ ...ln, containerNo: e.target.value.toUpperCase() })} placeholder="CONTAINER" /></Field>
            {kindId === 'reimbursable' || kindId === 'can' ? <>
              <Field label="Receipt No"><input style={inputStyle} value={ln.receiptNo} onChange={e => setLn({ ...ln, receiptNo: e.target.value })} placeholder="RECEIPT NO" /></Field>
              <Field label="Receipt Date"><input type="date" style={inputStyle} value={ln.receiptDate} onChange={e => setLn({ ...ln, receiptDate: e.target.value })} /></Field>
            </> : h.bulk ? <Field label="Docket (line)" required span={2}><select style={ln.jobNo ? inputStyle : mandStyle} value={ln.jobNo} onChange={e => setLn({ ...ln, jobNo: e.target.value })}><option value="">Select</option>{editIdx < 0 && <option value="*ALL*">All {h.dockets.length} dockets (one line each)</option>}{h.dockets.map(d => <option key={d}>{d}</option>)}</select></Field>
              : <Field label="Docket (line)" span={2}><input style={inputStyle} value={ln.jobNo || h.jobNo} onChange={e => setLn({ ...ln, jobNo: e.target.value.toUpperCase() })} /></Field>}
            <Field label="Narration" span={6}><input style={inputStyle} value={ln.narration} onChange={e => setLn({ ...ln, narration: e.target.value })} placeholder="Narration" onKeyDown={e => e.key === 'Enter' && addLine()} /></Field>
            <Field label="IGST / CGST / SGST %"><input style={roStyle} readOnly value={lineCalc ? `${lineCalc.igstPct} / ${lineCalc.cgstPct} / ${lineCalc.sgstPct}` : c.gstOn ? (c.intra ? 'C + S' : 'IGST') : 'No GST'} /></Field>
            <div style={{ display: 'flex', gap: 4 }}>
              <Btn kind="primary" onClick={addLine} disabled={isVoid}><Plus size={13} /> {editIdx >= 0 ? 'Update' : 'Add'}</Btn>
              {editIdx >= 0 && <Btn kind="clear" onClick={() => { setLn(emptyLine()); setEditIdx(-1); }}><X size={12} /></Btn>}
            </div>
          </div>
        </Box>}
        {/* -------- charge information */}
        <Grid title={'Charge Information (' + lines.length + ')'} maxHeight={430} minHeight={230} empty="Add the charges above" activeKey={editIdx} rowKey={(r, i) => i}
          cols={[
            { label: '', render: (r, i) => viewOnly ? null : <span style={{ display: 'inline-flex', gap: 8 }}><span style={{ cursor: 'pointer', color: T.head }} title="Edit" onClick={() => { setLn({ ...r }); setEditIdx(i); }}><Pencil size={12} /></span><span style={{ cursor: 'pointer', color: T.dr }} title="Delete" onClick={() => { setLines(ls => ls.filter((_, j) => j !== i)); if (editIdx === i) { setEditIdx(-1); setLn(emptyLine()); } }}><Trash2 size={12} /></span></span> },
            { label: 'Docket No', render: r => r.jobNo || h.jobNo }, { label: 'Container', key: 'containerNo' }, { label: 'Charge', render: r => <b>{r.charge}</b> }, { label: 'SAC', key: 'sac' }, { label: 'Unit', key: 'unit' },
            { label: 'Qty', right: true, key: 'qty' }, { label: 'Rate', right: true, render: r => inr(r.rate) }, { label: 'Amount', right: true, render: (r, i) => inr(c.lines[i] && c.lines[i].amount) }, { label: 'Disc.', right: true, render: r => (n(r.discount) ? inr(r.discount) : '') },
            { label: 'Cur / Ex', render: r => (r.currency && r.currency !== 'INR' ? r.currency + ' @ ' + r.exRate : 'INR') }, { label: 'INR Amount', right: true, render: (r, i) => <b>{inr(c.lines[i] && c.lines[i].inrAmount)}</b> },
            { label: 'GST %', right: true, render: (r, i) => c.lines[i] && (c.lines[i].igstPct ? 'I ' + c.lines[i].igstPct : c.lines[i].cgstPct ? 'C+S ' + c.lines[i].cgstPct * 2 : '0') },
            { label: 'IGST', right: true, render: (r, i) => inr(c.lines[i] && c.lines[i].igst) }, { label: 'CGST', right: true, render: (r, i) => inr(c.lines[i] && c.lines[i].cgst) }, { label: 'SGST', right: true, render: (r, i) => inr(c.lines[i] && c.lines[i].sgst) },
            { label: 'Receipt', render: r => (r.receiptNo ? r.receiptNo + (r.receiptDate ? ' ' + fmtDate(r.receiptDate) : '') : '') }, { label: 'Narration', key: 'narration', wrap: true },
          ]}
          rows={lines} foot={['', 'Total', '', '', '', '', '', '', inr(c.charge), '', '', inr(c.gross), '', inr(c.igst), inr(c.cgst), inr(c.sgst), '', '']} />
        {/* -------- totals: one row */}
        <Box pad={8}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '5px 8px', alignItems: 'end' }}>
            <Field label="Gross (INR)"><input style={roStyle} readOnly value={inr(c.gross)} /></Field>
            <Field label="IGST"><input style={roStyle} readOnly value={inr(c.igst)} /></Field>
            <Field label="CGST"><input style={roStyle} readOnly value={inr(c.cgst)} /></Field>
            <Field label="SGST"><input style={roStyle} readOnly value={inr(c.sgst)} /></Field>
            <Field label="Round Off"><input style={roStyle} readOnly value={inr(c.roundOff)} /></Field>
            <Field label={'Invoice Total' + (fcyInvoice && n(h.exRate) ? ' (' + h.currency + ' ' + inr(c.total / n(h.exRate)) + ')' : '')} span={2}><input style={{ ...roStyle, fontWeight: 800, color: T.head }} readOnly value={inr(c.total)} /></Field>
            <Field label="Advance"><input style={inputStyle} value={h.advance} onChange={set('advance')} placeholder="0.00" /></Field>
            <Field label="Payable"><input style={{ ...roStyle, fontWeight: 800 }} readOnly value={inr(r2(c.total - n(h.advance)))} /></Field>
            <Field label="Remarks (printed)" span={3}><input style={inputStyle} value={h.remarks} onChange={set('remarks')} placeholder="Remarks" /></Field>
          </div>
        </Box>
        <ActionBar note={msg && <span style={{ color: msg.bad ? T.dr : msg.ok ? T.cr : T.inkSoft, fontWeight: 700 }}>{msg.t}</span>}>
          <Btn kind="save" onClick={save} disabled={viewOnly || busy || isVoid || !lines.length || !!(loaded && loaded.irn && loaded.irnStatus !== 'Cancelled')} title={loaded && loaded.irn && loaded.irnStatus !== 'Cancelled' ? 'IRN generated - issue a credit / debit note instead' : ''}><Save size={13} /> {busy ? 'Saving' : editId ? 'Save changes' : 'Save'}</Btn>
          <Btn kind="plain" onClick={() => setTab('search')}><Pencil size={13} /> Modify</Btn>
          <Btn kind="clear" onClick={clear}><RotateCcw size={13} /> Clear</Btn>
          <Btn kind="plain" onClick={() => loaded && printInvoice(loaded.id)} disabled={!loaded} title={loaded ? '' : 'Save or open an invoice first'}><Printer size={13} /> Print</Btn>
          {loaded && !viewOnly && !isVoid && !irnLive && <Btn kind="danger" onClick={voidIt}><Ban size={13} /> Void</Btn>}
          {loaded && !viewOnly && !irnLive && <Btn kind="danger" onClick={del}><Trash2 size={13} /> Delete</Btn>}
          {loaded && !viewOnly && !isVoid && kindId !== 'reimbursable' && !loaded.irn && <Btn kind="primary" onClick={postGstn} disabled={busy}><Send size={13} /> Post To GSTN</Btn>}
          {irnLive && !viewOnly && <Btn kind="danger" onClick={() => setPanel(panel === 'cancelirn' ? null : 'cancelirn')}><XCircle size={13} /> Cancel IRN</Btn>}
          {loaded && !isVoid && !kind.againstBill && <Btn kind="ghost" onClick={() => setParams({ item: 'gstcreditnote', prev: loaded.invoiceNo })}><FileMinus size={12} /> Credit Note</Btn>}
          {loaded && !isVoid && !kind.againstBill && <Btn kind="ghost" onClick={() => setParams({ item: 'gstdebitnote', prev: loaded.invoiceNo })}><Receipt size={12} /> Debit Note</Btn>}
          {loaded && !isVoid && <Btn kind="plain" onClick={() => setPanel(panel === 'mail' ? null : 'mail')}><Mail size={13} /> Send Mail</Btn>}
          {loaded && !isVoid && <Btn kind="plain" onClick={() => setPanel(panel === 'wa' ? null : 'wa')}><MessageCircle size={13} /> WhatsApp</Btn>}
          {loaded && !isVoid && kindId !== 'reimbursable' && <Btn kind="plain" onClick={() => setPanel(panel === 'irn' ? null : 'irn')}><FileJson size={13} /> {loaded.irn ? 'IRN ' + (loaded.irnStatus === 'Cancelled' ? 'cancelled' : 'details') : 'E-Invoice JSON'}</Btn>}
          {posting && <Btn kind="ghost" onClick={() => setShowPost(s => !s)}>{showPost ? 'Hide' : 'Show'} posting</Btn>}
          {loaded && loaded.notes && loaded.notes.length > 0 && <span style={{ fontSize: 11, color: T.muted }}>Notes on it: {loaded.notes.map(x => x.invoiceNo + ' (' + inr(x.total) + ')').join(', ')}</span>}
        </ActionBar>
        {loaded && (panel === 'mail' || panel === 'wa') && <SendPanel key={panel} mode={panel} inv={loaded} h={h} onClose={() => setPanel(null)} onDone={reloadLoaded} />}
        {loaded && panel === 'irn' && <IrnPanel inv={loaded} onClose={() => setPanel(null)} onDone={reloadLoaded} />}
        {loaded && panel === 'cancelirn' && <CancelIrnPanel inv={loaded} onClose={() => setPanel(null)} onDone={(t) => { setMsg({ ok: true, t }); setPanel(null); reloadLoaded(); }} />}
        {showPost && posting && <PostingTable title="Posting on Save (voucher in the books)" lines={posting.map(l => ({ ...l, ledgerName: l.ledger }))} />}
      </>}
    </Sheet>
  );
}

// ================================================================== Search tab (iCAFFE columns)
function InvoiceSearch({ kindId, meta, onOpen }) {
  const [f, setF] = useState({ from: fyStartIso(), to: todayIso(), partyType: '', party: '', by: 'invoice', no: '', status: '', remarks: '', all: false });
  const [rows, setRows] = useState(null); const [more, setMore] = useState(false); const [err, setErr] = useState(''); const [sel, setSel] = useState({}); const [note, setNote] = useState('');
  const chosen = (rows || []).filter(r => sel[r.id]);
  const bulkJson = async () => { setNote(''); try { const r = await downloadEInvoice(chosen.map(x => x.id), 'einvoice_bulk_' + todayIso() + '.json'); setNote((r.json.length ? r.json.length + ' invoice(s) in the JSON - upload on the IRP bulk tool' : 'Nothing to export') + (r.skipped.length ? '. Left out: ' + r.skipped.join('; ') : '')); } catch (e) { setNote(e.message); } };
  const postSel = async () => { setNote('Posting ' + chosen.length + ' invoice(s) to the GST portal...');
    try { const r = await postJson(BASE + '/post-gstn', { ids: chosen.map(x => x.id) }); const ok = r.results.filter(x => x.ok).length; setNote(ok + ' of ' + r.results.length + ' got an IRN' + (r.results.some(x => !x.ok) ? '. Not posted: ' + r.results.filter(x => !x.ok).map(x => x.invoiceNo + ' (' + x.error + ')').join('; ') : '')); run(); }
    catch (e) { setNote(e.message); } };
  const printSel = async () => { for (const r of chosen) { await printInvoice(r.id); await new Promise(z => setTimeout(z, 1800)); } };
  const run = async () => {
    setErr('');
    const qs = new URLSearchParams(); if (!f.all) qs.set('kind', kindId);
    for (const k of ['from', 'to', 'partyType', 'party', 'by', 'no', 'status', 'remarks']) if (f[k]) qs.set(k, f[k]);
    try { const r = await fetch(BASE + '?' + qs.toString()); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); setRows(j); setMore(r.headers.get('X-More') === '1'); } catch (e) { setErr(e.message); setRows([]); }
  };
  useEffect(() => { run(); }, [kindId]);
  const s = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const total = (rows || []).filter(r => r.status !== 'Void').reduce((a, r) => a + (r.kind === 'creditnote' ? -1 : 1) * n(r.total), 0);
  return (
    <>
      <Box title="Search">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8, alignItems: 'end' }}>
          <Field label="From Date"><input type="date" style={inputStyle} value={f.from} onChange={s('from')} /></Field>
          <Field label="To Date"><input type="date" style={inputStyle} value={f.to} onChange={s('to')} /></Field>
          <Field label="Party Type"><select style={inputStyle} value={f.partyType} onChange={s('partyType')}><option value="">Select Party</option>{PARTY_TYPES._.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Party Name" span={2}><input style={inputStyle} value={f.party} onChange={s('party')} placeholder="PARTY NAME" /></Field>
          <Field label="Status"><select style={inputStyle} value={f.status} onChange={s('status')}><option value="">All</option><option value="Approved">Approved</option><option value="Void">Void</option></select></Field>
          <Field label={<span style={{ display: 'inline-flex', gap: 10 }}>{[['docket', 'Docket No'], ['invoice', 'Invoice No'], ['hawb', 'H/AWB No']].map(([v, l]) => <label key={v} style={{ display: 'inline-flex', gap: 4, margin: 0, alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}><input type="radio" checked={f.by === v} onChange={() => setF({ ...f, by: v })} />{l}</label>)}</span>} span={2}>
            <input style={inputStyle} value={f.no} onChange={s('no')} onKeyDown={e => e.key === 'Enter' && run()} placeholder={f.by === 'docket' ? 'DOCKET NO.' : f.by === 'hawb' ? 'H/AWB NO' : 'INVOICE NO.'} /></Field>
          <Field label="Remark" span={2}><input style={inputStyle} value={f.remarks} onChange={s('remarks')} onKeyDown={e => e.key === 'Enter' && run()} /></Field>
          <Field label="Scope"><label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, margin: 0, cursor: 'pointer' }}><input type="checkbox" checked={f.all} onChange={s('all')} /> All invoice types</label></Field>
          <div style={{ display: 'flex', gap: 6 }}><Btn kind="primary" onClick={run}><Search size={13} /> Search</Btn><Btn kind="clear" onClick={() => setF({ from: fyStartIso(), to: todayIso(), partyType: '', party: '', by: 'invoice', no: '', status: '', remarks: '', all: false })}><RefreshCw size={12} /> Clear</Btn></div>
        </div>
        {err && <div style={{ color: T.dr, fontWeight: 700, marginTop: 6 }}>{err}</div>}
      </Box>
      <Grid title={'Search Invoice - Total Invoice : ' + (rows ? rows.length : 0) + (more ? ' (first 500 - narrow the search)' : '') + (rows && rows.length ? ' - Net ' + inr(total) : '')} maxHeight={460} onRow={onOpen} empty="No invoice for this search"
        right={<>{note && <span style={{ fontSize: 11, color: T.inkSoft, fontWeight: 700 }}>{note}</span>}
          <Btn small kind="ghost" onClick={printSel} disabled={!chosen.length}><Printer size={11} /> Print ticked ({chosen.length})</Btn>
          <Btn small kind="ghost" onClick={bulkJson} disabled={!chosen.length}><FileJson size={11} /> E-Invoice JSON ({chosen.length})</Btn>
          <Btn small kind="primary" onClick={postSel} disabled={!chosen.length}><Send size={11} /> Post To GSTN ({chosen.length})</Btn></>}
        cols={[
          { label: <input type="checkbox" checked={!!rows && rows.length > 0 && chosen.length === rows.length} onChange={e => setSel(e.target.checked ? Object.fromEntries((rows || []).map(r => [r.id, true])) : {})} />, render: r => <input type="checkbox" checked={!!sel[r.id]} onClick={e => e.stopPropagation()} onChange={e => setSel({ ...sel, [r.id]: e.target.checked })} /> },
          { label: 'Print', render: r => <span style={{ cursor: 'pointer', color: T.head }} onClick={e => { e.stopPropagation(); printInvoice(r.id); }} title="Print"><Printer size={12} /></span> },
          { label: 'Bill NO', render: r => <b style={{ color: T.head }}>{r.invoiceNo}</b> }, { label: 'Bill Date', render: r => fmtDate(r.date) },
          ...(f.all ? [{ label: 'Type', key: 'kindLabel' }] : []),
          { label: 'Previous/DR/CR No.', key: 'prevInvoiceNo' }, { label: 'Previous Bill Type', key: 'prevKind' },
          { label: 'Status', render: r => <Badge tone={r.status === 'Void' ? 'bad' : 'ok'}>{r.status === 'Void' ? 'Void' : 'Approved'}</Badge> }, { label: 'Supply Type', key: 'supplyType' },
          { label: 'IRN Status', render: r => (r.irn ? <Badge tone={r.irnStatus === 'Cancelled' ? 'bad' : 'ok'}>{r.irnStatus || 'Generated'}</Badge> : '') },
          { label: 'Party', key: 'partyName', wrap: true }, { label: 'Docket No', render: r => (r.bulk ? 'Bulk: ' + (r.dockets ? JSON.parse(r.dockets).join(', ') : '') : r.jobNo) }, { label: 'H/AWB No', key: 'hawbNo' },
          { label: 'Total', right: true, render: r => <span style={{ textDecoration: r.status === 'Void' ? 'line-through' : 'none' }}>{inr(r.total)}{r.currency && r.currency !== 'INR' && r.totalFcy ? <div style={{ fontSize: 10, color: T.muted }}>{r.currency} {inr(r.totalFcy)}</div> : null}</span> },
          { label: 'Entered By', key: 'createdBy' }, { label: 'Entered Date', render: r => fmtDate(r.createdAt) }, { label: 'Modified By', key: 'modifiedBy' }, { label: 'Modified Date', render: r => (r.modifiedBy ? fmtDate(r.updatedAt) : '') },
          { label: 'Cost Center', key: 'costCentre' }, { label: 'Remark', key: 'remarks', wrap: true },
        ]}
        rows={rows || []} />
    </>
  );
}

// ================================================================== Provisional Sheet (cost sheet of a docket)
// Proposed from the job's quotation, charge rules and costs booked, or the sheet saved before; shows what is billed and
// what is left; ticked lines go to the invoice. Also opened on its own from the menu (ProvisionalSheetScreen).
export function ProvisionalSheet({ jobNo, partyName, onAdd, onClose, embedded }) {
  const [d, setD] = useState(null); const [rows, setRows] = useState([]); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [pick, setPick] = useState({});
  const load = (keep) => { setErr(''); if (!keep) setMsg(''); api(BASE + '/provisional?jobNo=' + encodeURIComponent(jobNo)).then(r => { setD(r); setRows(r.lines.map(l => ({ ...l }))); setPick(Object.fromEntries(r.lines.map((l, i) => [i, l.toBill > 0.009 && !l.optional]))); }).catch(e => setErr(e.message)); }; // 08-Nov-2026: offered lines (cartage, costs outside the contract) come unticked
  useEffect(() => { if (jobNo) load(); }, [jobNo]);
  const upd = (i, k, v) => setRows(rs => rs.map((r, j) => { if (j !== i) return r; const o = { ...r, [k]: v }; o.sellInr = r2(n(o.sellRate) * (n(o.qty) || 1) * (n(o.exRate) || 1)); o.buyInr = r2(n(o.buyRate) * (n(o.qty) || 1) * (n(o.exRate) || 1)); o.toBill = r2(o.sellInr - n(o.billed)); return o; }));
  const save = async () => { try { const r = await postJson(BASE + '/provisional', { jobNo, partyName, lines: rows, remarks: d.remarks }, 'PUT'); setMsg('Sheet saved - ' + r.lines + ' charges'); load(true); } catch (e) { setErr(e.message); } };
  const add = () => {
    const sel = rows.filter((r, i) => pick[i] && r.toBill > 0.009);
    if (!sel.length) { setErr('Tick the charges to bill (with something left to bill)'); return; }
    onAdd(sel.map(r => { const part = r.billed > 0.009; const ex = n(r.exRate) || 1;
      return { ...emptyLine(), jobNo, charge: r.charge, sac: r.sac || '', gstRate: r.gstRate, currency: r.currency || 'INR', exRate: ex, qty: part ? 1 : n(r.qty) || 1, rate: part ? r2(r.toBill / ex) : n(r.sellRate), narration: part ? 'Balance of provisional ' + inr(r.sellInr) : '' }; }));
  };
  const tot = rows.reduce((a, r) => ({ buy: a.buy + n(r.buyInr), sell: a.sell + n(r.sellInr), cost: a.cost + n(r.actualCost), billed: a.billed + n(r.billed), left: a.left + Math.max(0, n(r.toBill)) }), { buy: 0, sell: 0, cost: 0, billed: 0, left: 0 });
  const cell = { ...inputStyle, height: 24, padding: '0 5px' };
  return (
    <Box title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ClipboardList size={12} /> Provisional Sheet - {jobNo}{d && <Badge tone={d.source === 'saved' ? 'ok' : 'warn'}>{d.source === 'saved' ? 'saved' + (d.savedBy ? ' by ' + d.savedBy : '') : 'proposed - not saved yet'}</Badge>}</span>}
      right={<>{!embedded && <Btn small kind="ghost" onClick={onClose}><X size={11} /> Close</Btn>}</>}>
      {err && <div style={{ color: T.dr, fontWeight: 700, marginBottom: 6 }}>{err}</div>}
      {!d && !err && <div style={{ color: T.muted }}>Loading the sheet</div>}
      {d && <>
        {d.job && <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>{d.job.dir} {d.job.mode || ''} job of {fmtDate(d.job.jobDate)}{d.job.party ? ' - ' + d.job.party : ''}{d.job.grossWeight ? ' - ' + d.job.grossWeight + ' kg' : ''}</div>}
        {/* 08-Nov-2026: the customer contract the rates come from */}
        <div style={{ fontSize: 11, marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {d.contract ? <Badge tone="ok">Contract {d.contract.contractNo} - valid to {fmtDate(d.contract.validTo)}</Badge> : <span style={{ color: T.muted }}>No active contract for this customer on the docket date - charge rules and costs booked are proposed.</span>}
          {d.contract && d.source === 'saved' && <span style={{ color: T.muted }}>The sheet was saved before - the contract rates show only on a new sheet.</span>}
          {(d.notes || []).map((n0, i) => <span key={i} style={{ color: '#b45309', fontWeight: 600 }}>{n0}</span>)}
        </div>
        <div style={{ overflow: 'auto', maxHeight: 340 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['', 'Charge', 'SAC', 'GST %', 'Cur', 'Ex.Rate', 'Qty', 'Buy Rate', 'Sell Rate', 'Buy (INR)', 'Sell (INR)', 'Cost booked', 'Billed', 'To bill', 'From', ''].map((h0, i) => <th key={i} style={{ background: '#f8fafc', textAlign: i >= 5 && i <= 13 ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h0}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td>{onAdd && <input type="checkbox" checked={!!pick[i]} onChange={e => setPick({ ...pick, [i]: e.target.checked })} />}</td>
                <td><input style={{ ...cell, minWidth: 170, fontWeight: 700 }} value={r.charge} onChange={e => upd(i, 'charge', e.target.value.toUpperCase())} /></td>
                <td><input style={{ ...cell, width: 70 }} value={r.sac || ''} onChange={e => upd(i, 'sac', e.target.value)} /></td>
                <td><input style={{ ...cell, width: 46, textAlign: 'right' }} value={r.gstRate} onChange={e => upd(i, 'gstRate', e.target.value)} /></td>
                <td><input style={{ ...cell, width: 46 }} value={r.currency} onChange={e => upd(i, 'currency', e.target.value.toUpperCase())} /></td>
                <td><input style={{ ...cell, width: 58, textAlign: 'right' }} value={r.exRate} onChange={e => upd(i, 'exRate', e.target.value)} /></td>
                <td><input style={{ ...cell, width: 56, textAlign: 'right' }} value={r.qty} onChange={e => upd(i, 'qty', e.target.value)} /></td>
                <td><input style={{ ...cell, width: 80, textAlign: 'right' }} value={r.buyRate} onChange={e => upd(i, 'buyRate', e.target.value)} /></td>
                <td><input style={{ ...cell, width: 80, textAlign: 'right' }} value={r.sellRate} onChange={e => upd(i, 'sellRate', e.target.value)} /></td>
                <td style={{ textAlign: 'right' }}>{inr(r.buyInr)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{inr(r.sellInr)}</td>
                <td style={{ textAlign: 'right', color: n(r.actualCost) > n(r.sellInr) && n(r.sellInr) ? T.dr : undefined }}>{n(r.actualCost) ? inr(r.actualCost) : ''}</td>
                <td style={{ textAlign: 'right' }}>{n(r.billed) ? inr(r.billed) : ''}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: r.toBill > 0.009 ? T.head : T.muted }}>{inr(r.toBill)}</td>
                <td style={{ fontSize: 10, color: T.muted, whiteSpace: 'nowrap' }}>{r.from}{r.note ? <span style={{ color: '#b45309' }}> - {r.note}</span> : null}{r.notGst && r.charge ? <span style={{ color: T.dr, fontWeight: 700 }}> - not in GST Charges</span> : null}</td>
                <td><span style={{ cursor: 'pointer', color: T.dr }} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}><Trash2 size={12} /></span></td>
              </tr>))}
              {!rows.length && <tr><td colSpan={16} style={{ textAlign: 'center', color: T.muted, padding: 18 }}>Nothing proposed for this docket - add the charges below</td></tr>}
            </tbody>
            <tfoot><tr style={{ background: T.headBg, fontWeight: 800 }}><td /><td>Total</td><td colSpan={7} /><td style={{ textAlign: 'right' }}>{inr(tot.buy)}</td><td style={{ textAlign: 'right' }}>{inr(tot.sell)}</td><td style={{ textAlign: 'right' }}>{inr(tot.cost)}</td><td style={{ textAlign: 'right' }}>{inr(tot.billed)}</td><td style={{ textAlign: 'right' }}>{inr(tot.left)}</td><td colSpan={2} /></tr></tfoot>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <Btn small kind="ghost" onClick={() => setRows(rs => [...rs, { charge: '', sac: '', gstRate: 18, currency: 'INR', exRate: 1, qty: 1, buyRate: 0, sellRate: 0, buyInr: 0, sellInr: 0, actualCost: 0, billed: 0, toBill: 0, from: 'Added' }])}><Plus size={11} /> Add charge</Btn>
          <Btn small kind="save" onClick={save}><Save size={11} /> Save sheet</Btn>
          {onAdd && <Btn small kind="primary" onClick={add}><Plus size={11} /> Add ticked to invoice</Btn>}
          <span style={{ fontSize: 11, color: T.muted }}>Expected margin {inr(tot.sell - Math.max(tot.buy, tot.cost))} - Sell {inr(tot.sell)} vs cost {inr(Math.max(tot.buy, tot.cost))}</span>
          {msg && <span style={{ fontSize: 11, fontWeight: 700, color: T.cr }}>{msg}</span>}
        </div>
      </>}
    </Box>
  );
}
export function ProvisionalSheetScreen() {
  const [no, setNo] = useState(''); const [open, setOpen] = useState('');
  return (
    <Sheet tabs={[{ id: 'p', label: 'Provisional Sheet' }]} tab="p" onTab={() => {}} right={<span style={{ fontSize: 11, color: T.muted }}>What each docket should be billed - used by GST Invoice</span>}>
      <Box title="Docket">
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <Field label="Docket No" style={{ width: 260 }}><input style={inputStyle} value={no} onChange={e => setNo(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && setOpen(no.trim())} placeholder="DOCKET NO." /></Field>
          <Btn kind="primary" onClick={() => setOpen(no.trim())} disabled={!no.trim()}><Search size={13} /> Show</Btn>
        </div>
      </Box>
      {open && <ProvisionalSheet key={open} jobNo={open} embedded />}
    </Sheet>
  );
}

// ================================================================== Bulk Invoice popup (iCAFFE "Bulk invoice")
// From / To date + Search -> dockets whose shipper / importer is the invoice party; tick (or select all) -> Ok
function BulkInvoicePopup({ partyName, partyId, chosen, onOk, onClose }) {
  const [f, setF] = useState({ from: '', to: '' }); const [rows, setRows] = useState(null); const [err, setErr] = useState(''); const [order, setOrder] = useState([]); const [busy, setBusy] = useState(false);
  const search = async () => {
    setErr('');
    if (!String(partyName || '').trim() || !f.from || !f.to) { setErr('Please fill in all required fields: Party, From Date, and To Date.'); return; }
    try { setRows(await api(`${BASE}/bulk-dockets?party=${encodeURIComponent(partyName)}${partyId ? '&partyId=' + partyId : ''}&from=${f.from}&to=${f.to}`)); setOrder([]); } catch (e) { setErr(e.message); setRows([]); }
  };
  const list = (rows || []).filter(r => !chosen.includes(r.docketNo));
  const tog = (d) => setOrder(o => (o.includes(d) ? o.filter(x => x !== d) : [...o, d])); // the order ticked = the order on the invoice
  const all = list.length > 0 && list.every(r => order.includes(r.docketNo));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 70 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, width: 'min(980px, 96vw)', boxShadow: '0 20px 50px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: T.headBg || '#e1f0fa', borderBottom: `1px solid ${T.headBorder}` }}>
          <b style={{ color: T.head }}>Bulk invoice</b><span style={{ marginLeft: 10, fontSize: 11, color: T.muted }}>Party: <b>{partyName}</b> - dockets where this party is the shipper / importer</span>
          <span style={{ marginLeft: 'auto', cursor: 'pointer' }} onClick={onClose}><X size={14} /></span>
        </div>
        <div style={{ padding: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <Field label="From Date" required style={{ width: 150 }}><input type="date" style={f.from ? inputStyle : mandStyle} value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></Field>
            <Field label="To Date" required style={{ width: 150 }}><input type="date" style={f.to ? inputStyle : mandStyle} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></Field>
            <Btn kind="primary" onClick={search}><Search size={13} /> Search</Btn>
            {chosen.length > 0 && <span style={{ fontSize: 11, color: T.muted, paddingBottom: 6 }}>Already on this invoice: {chosen.join(', ')}</span>}
          </div>
          {err && <div style={{ color: T.dr, fontWeight: 700, marginTop: 6 }}>{err}</div>}
          <div style={{ marginTop: 8 }}>
            <Grid maxHeight={330} minHeight={140} empty={rows ? 'No docket of this party in these dates' : 'Enter From / To date and Search'} onRow={r => tog(r.docketNo)} rowKey={r => r.docketNo}
              cols={[{ label: <input type="checkbox" title="Select all" checked={all} onChange={e => setOrder(e.target.checked ? [...order, ...list.map(r => r.docketNo).filter(d => !order.includes(d))] : [])} />, render: r => <input type="checkbox" readOnly checked={order.includes(r.docketNo)} /> },
                { label: 'Docket No', render: r => <b>{r.docketNo}</b> }, { label: 'Date', render: r => fmtDate(r.docketDate) }, { label: 'Shipper / Importer', key: 'party', wrap: true }, { label: 'Job', render: r => r.dir + ' ' + (r.mode || '') },
                { label: 'MAWB / MBL', key: 'mawbNo' }, { label: 'HAWB / HBL', key: 'hawbNo' }, { label: 'Cost sheet', render: r => (r.costSheet ? <Badge tone="ok">Yes</Badge> : <Badge tone="muted">No</Badge>) },
                { label: 'Billed on', render: r => r.billedOn.join(', ') }]} rows={list} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <span style={{ marginRight: 'auto', fontSize: 11, color: T.muted, alignSelf: 'center' }}>{order.length} docket(s) ticked - Ok brings each docket's cost sheet charges to the invoice</span>
            <Btn kind="clear" onClick={onClose}>Close</Btn>
            <Btn kind="save" disabled={busy} onClick={async () => { setBusy(true); await onOk(order); setBusy(false); }}>Ok</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================== Send Mail / WhatsApp / e-Invoice panels
function SendPanel({ mode, inv, h, onClose, onDone, initialTo }) {
  const [to, setTo] = useState(mode === 'mail' ? h.email || '' : initialTo || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState((TITLES[inv.kind] || 'Invoice').replace(/^./, c => c) + ' ' + inv.invoiceNo + ' - ' + inv.partyName);
  const [body, setBody] = useState(`Dear Sir / Madam,\n\nPlease find attached our ${(inv.kindLabel || 'invoice').toLowerCase()} ${inv.invoiceNo} dated ${fmtDate(inv.date)} for ${inv.currency && inv.currency !== 'INR' && inv.totalFcy ? inv.currency + ' ' + inr(inv.totalFcy) + ' (INR ' + inr(inv.total) + ')' : 'INR ' + inr(inv.total)}${inv.jobNo ? ', docket ' + inv.jobNo : ''}${inv.hawbNo ? ', HAWB ' + inv.hawbNo : ''}.\n\nRegards,\nAccounts`);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null);
  const send = async () => {
    setBusy(true); setMsg(null);
    try {
      if (mode === 'mail') { const { html } = await invoiceHtml(inv.id); const r = await postJson(BASE + '/' + inv.id + '/mail', { to, cc, subject, body, html }); setMsg({ ok: true, t: 'Mailed to ' + r.to + ' with the invoice PDF' }); }
      else { const { html } = await invoiceHtml(inv.id); const r = await postJson(BASE + '/' + inv.id + '/whatsapp', { to, message: body, html }); setMsg({ ok: true, t: 'Sent on WhatsApp' + (r.pdf ? ' with the invoice PDF' : '') + ' (' + r.via + ')' }); }
      onDone && onDone();
    } catch (e) { setMsg({ bad: true, t: e.message }); }
    setBusy(false);
  };
  return (
    <Box title={mode === 'mail' ? 'Send Mail - ' + inv.invoiceNo + ' (PDF attached)' : 'Send WhatsApp - ' + inv.invoiceNo + ' (PDF attached)'} right={<Btn small kind="ghost" onClick={onClose}><X size={11} /> Close</Btn>}>
      <div style={{ display: 'grid', gridTemplateColumns: mode === 'mail' ? '1.2fr 1fr 2fr' : '1fr 3fr', gap: 8 }}>
        <Field label={mode === 'mail' ? 'To' : 'Mobile No'} required><input style={to ? inputStyle : mandStyle} value={to} onChange={e => setTo(e.target.value)} placeholder={mode === 'mail' ? 'name@company.com; other@...' : '10 digits or with country code'} /></Field>
        {mode === 'mail' && <Field label="Cc"><input style={inputStyle} value={cc} onChange={e => setCc(e.target.value)} /></Field>}
        {mode === 'mail' && <Field label="Subject"><input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} /></Field>}
        <Field label="Message" span={mode === 'mail' ? 3 : 1}><textarea style={{ ...inputStyle, height: 110, padding: 6 }} value={body} onChange={e => setBody(e.target.value)} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <Btn kind="save" onClick={send} disabled={busy || !to}>{mode === 'mail' ? <Mail size={13} /> : <MessageCircle size={13} />} {busy ? 'Sending' : 'Send'}</Btn>
        {msg && <span style={{ fontWeight: 700, color: msg.bad ? T.dr : T.cr }}>{msg.t}</span>}
        {inv.mailLog && inv.mailLog.length > 0 && <span style={{ fontSize: 11, color: T.muted, marginLeft: 'auto' }}>Sent before: {inv.mailLog.slice(-3).map(l => (l.type === 'mail' ? 'mail ' : 'WhatsApp ') + l.to + ' ' + fmtDate(l.at)).join('; ')}</span>}
      </div>
    </Box>
  );
}
const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); };
export async function downloadEInvoice(ids, name) {
  const r = await api(BASE + '/einvoice?ids=' + ids.join(','));
  if (r.json.length) download(name || 'einvoice_' + todayIso() + '.json', JSON.stringify(r.json.length === 1 ? r.json[0] : r.json, null, 2));
  return r;
}
function IrnPanel({ inv, onClose, onDone }) {
  const [f, setF] = useState({ irn: inv.irn || '', ackNo: inv.ackNo || '', ackDate: inv.ackDate || todayIso(), signedQr: inv.signedQr || '' });
  const [msg, setMsg] = useState(null); const [showSet, setSet] = useState(false);
  const json = async () => { try { const r = await downloadEInvoice([inv.id], String(inv.invoiceNo).replace(/[\/\\]+/g, '-') + '_einvoice.json'); setMsg(r.json.length ? { ok: true, t: 'JSON downloaded - upload it on the IRP (einvoice1.gst.gov.in, or the offline tool), then enter the IRN here' } : { bad: true, t: r.skipped.join('; ') }); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  const save = async () => { try { await postJson(BASE + '/' + inv.id + '/irn', f); setMsg({ ok: true, t: 'IRN saved - it prints on the invoice with the QR' }); onDone(); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  const cancel = async () => { const reason = window.prompt('Cancel IRN of ' + inv.invoiceNo + '? (Do it on the IRP too - allowed within 24 hours.) Reason:'); if (!reason) return; try { const r = await postJson(BASE + '/' + inv.id + '/irn-cancel', { reason }); setMsg({ ok: true, t: r.note }); onDone(); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  return (
    <Box title={'E-Invoice (IRN) - ' + inv.invoiceNo} right={<Btn small kind="ghost" onClick={onClose}><X size={11} /> Close</Btn>}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>Step 1: Download the JSON (IRP schema 1.1). Step 2: upload it on the IRP. Step 3: enter the IRN, Ack No / Date and paste the Signed QR Code from the IRP reply.{inv.irnStatus ? ' Status now: ' + inv.irnStatus + (inv.irnCancelReason ? ' (' + inv.irnCancelReason + ')' : '') : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr 1fr', gap: 8 }}>
        <Field label="IRN (64 characters)"><input style={inputStyle} value={f.irn} onChange={e => setF({ ...f, irn: e.target.value.trim() })} /></Field>
        <Field label="Ack No"><input style={inputStyle} value={f.ackNo} onChange={e => setF({ ...f, ackNo: e.target.value.trim() })} /></Field>
        <Field label="Ack Date"><input type="date" style={inputStyle} value={String(f.ackDate).slice(0, 10)} onChange={e => setF({ ...f, ackDate: e.target.value })} /></Field>
        <Field label="Signed QR Code (from the IRP reply)" span={3}><textarea style={{ ...inputStyle, height: 60, padding: 6 }} value={f.signedQr} onChange={e => setF({ ...f, signedQr: e.target.value })} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <Btn kind="plain" onClick={json}><FileJson size={13} /> Download JSON</Btn>
        <Btn kind="save" onClick={save} disabled={!f.irn || !f.ackNo}><Save size={13} /> Save IRN</Btn>
        <Btn kind="ghost" onClick={() => setSet(v => !v)}><Settings size={12} /> E-Invoice Settings (for Post To GSTN)</Btn>
        {msg && <span style={{ fontWeight: 700, color: msg.bad ? T.dr : T.cr }}>{msg.t}</span>}
      </div>
      {showSet && <div style={{ marginTop: 10 }}><EinvSettings /></div>}
    </Box>
  );
}
// Cancel IRN: on the IRP through the API when E-Invoice Settings are filled, else only marked here
function CancelIrnPanel({ inv, onClose, onDone }) {
  const [code, setCode] = useState('2'); const [rem, setRem] = useState(''); const [api2, setApi2] = useState(true); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(null);
  useEffect(() => { api(BASE + '/einv-settings').then(r => { setReady(r.ready); setApi2(r.ready); }).catch(() => setReady(false)); }, []);
  const hrs = inv.ackDate ? (Date.now() - new Date(String(inv.ackDate).replace(' ', 'T')).getTime()) / 3600000 : 0;
  const go = async () => { if (!rem.trim()) { setMsg({ bad: true, t: 'Give the remark' }); return; } setBusy(true);
    try { const r = await postJson(BASE + '/' + inv.id + '/irn-cancel', { code, reason: rem.trim(), viaApi: api2 }); onDone(r.note); } catch (e) { setMsg({ bad: true, t: e.message }); } setBusy(false); };
  return (
    <Box title={'Cancel IRN - ' + inv.invoiceNo} right={<Btn small kind="ghost" onClick={onClose}><X size={11} /> Close</Btn>}>
      <div style={{ fontSize: 11, color: hrs > 24 ? T.dr : T.muted, marginBottom: 6 }}>IRN {String(inv.irn).slice(0, 18)}... Ack {inv.ackNo} of {fmtDate(inv.ackDate)}. {hrs > 24 ? 'More than 24 hours since the IRN - the IRP will not cancel it; issue a credit note instead.' : 'The IRP allows cancelling within 24 hours of generation.'}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr 1.4fr auto', gap: 8, alignItems: 'end' }}>
        <Field label="Reason" required><select style={inputStyle} value={code} onChange={e => setCode(e.target.value)}><option value="1">Duplicate</option><option value="2">Data entry mistake</option><option value="3">Order cancelled</option><option value="4">Others</option></select></Field>
        <Field label="Remark" required><input style={rem ? inputStyle : mandStyle} value={rem} maxLength={100} onChange={e => setRem(e.target.value)} placeholder="Why it is cancelled" /></Field>
        <Check label={ready ? 'Cancel on the IRP (API)' : 'API not set up - mark here only'} checked={api2} disabled={!ready} onChange={setApi2} />
        <Btn kind="danger" onClick={go} disabled={busy}><XCircle size={13} /> {busy ? 'Cancelling' : 'Cancel IRN'}</Btn>
      </div>
      {msg && <div style={{ marginTop: 6, fontWeight: 700, color: msg.bad ? T.dr : T.cr }}>{msg.t}</div>}
    </Box>
  );
}
// E-Invoice API settings (Post To GSTN): typed by the user; password and secret are never shown back
export function EinvSettings() {
  const [f, setF] = useState(null); const [msg, setMsg] = useState(null);
  const load = () => api(BASE + '/einv-settings').then(r => setF({ ...r, clientSecret: '', password: '', publicKey: '' })).catch(e => setMsg({ bad: true, t: e.message }));
  useEffect(() => { load(); }, []);
  const save = async () => { try { await postJson(BASE + '/einv-settings', { baseUrl: f.baseUrl, clientId: f.clientId, clientSecret: f.clientSecret, username: f.username, password: f.password, gstin: f.gstin, publicKey: f.publicKey }, 'PUT'); setMsg({ ok: true, t: 'Saved' }); load(); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  if (!f) return <div style={{ color: T.muted }}>{msg ? msg.t : 'Loading'}</div>;
  const s2 = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Box title={<span>E-Invoice Settings {f.ready ? <Badge tone="ok">ready</Badge> : <Badge tone="warn">not complete</Badge>}</span>}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>From the NIC e-invoice API registration (or your GSP, if it gives the same API). Sandbox: https://einv-apisandbox.nic.in - for live, the production URL NIC / GSP gives you.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '5px 8px' }}>
        <Field label="API Base URL" span={2}><input style={inputStyle} value={f.baseUrl} onChange={s2('baseUrl')} /></Field>
        <Field label="GSTIN (blank = ours)"><input style={inputStyle} value={f.gstin} onChange={s2('gstin')} /></Field>
        <Field label="Client ID"><input style={inputStyle} value={f.clientId} onChange={s2('clientId')} /></Field>
        <Field label={'Client Secret' + (f.clientSecretSet ? ' (saved)' : '')}><input type="password" autoComplete="new-password" style={inputStyle} value={f.clientSecret} onChange={s2('clientSecret')} placeholder={f.clientSecretSet ? 'leave blank to keep' : ''} /></Field>
        <Field label="API User Name"><input style={inputStyle} value={f.username} onChange={s2('username')} /></Field>
        <Field label={'API Password' + (f.passwordSet ? ' (saved)' : '')}><input type="password" autoComplete="new-password" style={inputStyle} value={f.password} onChange={s2('password')} placeholder={f.passwordSet ? 'leave blank to keep' : ''} /></Field>
        <Field label={'NIC Public Key (PEM)' + (f.publicKeySet ? ' (saved)' : '')} span={5}><textarea style={{ ...inputStyle, height: 48, padding: 4, fontFamily: 'monospace', fontSize: 10 }} value={f.publicKey} onChange={s2('publicKey')} placeholder={f.publicKeySet ? 'saved - paste only to replace' : '-----BEGIN PUBLIC KEY----- ...'} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}><Btn kind="save" onClick={save}><Save size={13} /> Save settings</Btn>{msg && <span style={{ fontWeight: 700, color: msg.bad ? T.dr : T.cr }}>{msg.t}</span>}</div>
    </Box>
  );
}
