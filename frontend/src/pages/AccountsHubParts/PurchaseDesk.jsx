// 04-Nov-2026 (v4): vendor bill screen laid out like iCAFFE's Trade Invoice - party box on top, a charge strip with Add,
// the "Charge Information" grid, the TDS box and the bill totals. Trade (against a job), Non trade, and both under reverse
// charge. Charges pick up SAC / GST % / ledger from GST Charges; GST splits IGST or CGST + SGST by the place of supply.
// v4 adds the rest of iCAFFE's Trade Invoice: HBL / Master no, SEZ supplier, Pay / Rec on each charge, a 2nd TDS,
// Hold Payment (no payment can be set against the bill until it is released), and the Credit Note tab - the vendor's
// credit note set against one of its bills (booked as a Debit Note: every line of the bill reversed).
// Posts one voucher:
//   bill:  expense Dr (taxable) | Input GST Dr | vendor Cr (bill - TDS) | TDS Payable Cr
//   RCM:   expense Dr | RCM Input Dr | RCM Tax Payable Cr | vendor Cr (taxable - TDS) | TDS Payable Cr
//   credit note: the same lines with Dr and Cr swapped, set against the bill
// Bill details (bill no / dates, HBL, SEZ, TDS sections, hold) are saved to /api/accounts-hub/purchase-info/:voucherId.
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Save, RotateCcw, Copy, PauseCircle, ScanText, X } from 'lucide-react';
import { T, inr, fmtDate, todayIso, api, postJson, lookup, Box, Btn, ActionBar, Field, inputStyle, roStyle, mandStyle, Money, LedgerPicker, SuggestBox, BalanceStrip, PostingTable, Grid, useBalance, PartyNote, Badge } from './ui';
// 05-Nov-2026: iCAFFE numbering - trade / non-trade invoices take the JN series of the branch + division (given on Save)
const P_DIVS = [['AE', 'Export Air'], ['AI', 'Import Air'], ['SE', 'Export Sea'], ['SI', 'Import Sea']];
const pDivFrom = (v) => { const m = /(?:^|\/|-)(AE|AI|SE|SI)(?:\/|-|$)/.exec(String(v || '').toUpperCase()); return m ? m[1] : ''; };
import { readExcel, sampleExcel, ExcelButtons, ledgerByName } from './extras';

export const PURCHASE_DESKS = {
  trade: { title: 'Trade Invoice', rcm: false, needJob: true },
  nontrade: { title: 'Non Trade Invoice', rcm: false, needJob: false },
  tradercm: { title: 'Trade Invoice (RCM)', rcm: true, needJob: true },
  nontradercm: { title: 'Non Trade Invoice (RCM)', rcm: true, needJob: false },
};
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'SAR'];
const SLABS = ['0', '5', '12', '18', '28'];
const num = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(v * 100) / 100;
const addDays = (iso, d) => { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const blankCharge = () => ({ charge: '', ledgerId: '', sac: '', pr: 'Pay', currency: 'INR', roe: '1', qty: '1', rate: '', gstRate: '18', jobNo: '', remarks: '' });
const blankTds = (on) => ({ on, natureId: '', rate: '', base: 'taxable' });
const flip = (dc) => (dc === 'Dr' ? 'Cr' : 'Dr');

// 05-Nov-2026: Modify / Copy of a saved bill or vendor credit note opens in this form again. Charges are read back from
// the expense lines (remarks "Rec <charge> SAC <sac> Job <job>"), GST from the GST lines, the rest from the bill details.
const isGstName = (n) => /\b(i|c|s|ut)?gst\b|rcm/i.test(String(n || ''));
export function purchaseFromVoucher(v) {
  if (!v || !Array.isArray(v.lines) || !v.lines.length) return null;
  const p = v.purchase || {};
  const cnMode = v.baseType === 'Debit Note' || p.kind === 'cn';
  const vSide = cnMode ? 'Dr' : 'Cr'; const eSide = cnMode ? 'Cr' : 'Dr';
  const L = v.lines.map(l => ({ ...l, amount: num(l.amount), remarks: l.remarks || '', tax: /duties|tax/i.test(l.groupName || '') }));
  const vend = L.find(l => l.dc === vSide && /^(bill|credit note) /i.test(l.remarks)) || L.find(l => l.dc === vSide && /creditor/i.test(l.groupName || ''))
    || L.filter(l => l.dc === vSide && !l.tax && !/round off/i.test(l.ledgerName || '')).sort((a, b) => b.amount - a.amount)[0];
  if (!vend) return null;
  const gstL = L.filter(l => l !== vend && l.tax && isGstName(l.ledgerName));
  const tdsL = L.filter(l => l !== vend && l.tax && /tds/i.test(l.ledgerName || ''));
  const roL = L.filter(l => l !== vend && /round off/i.test(l.ledgerName || ''));
  const chg = L.filter(l => l !== vend && !gstL.includes(l) && !tdsL.includes(l) && !roL.includes(l));
  if (!chg.length) return null;
  const rcm = gstL.some(l => /rcm/i.test(l.ledgerName));
  const taxable = chg.reduce((a, l) => a + (l.dc === eSide ? l.amount : -l.amount), 0);
  const gst = gstL.filter(l => l.dc === eSide && (!rcm || /input/i.test(l.ledgerName))).reduce((a, l) => a + l.amount, 0) - (rcm ? 0 : gstL.filter(l => l.dc !== eSide).reduce((a, l) => a + l.amount, 0));
  const pct = taxable ? gst / taxable * 100 : 0;
  const slab = gst ? SLABS.reduce((a, x) => (Math.abs(num(x) - pct) < Math.abs(num(a) - pct) ? x : a), '18') : (Number(p.isSez) && p.sezType === 'lut' ? '18' : '0');
  const lines = chg.map(l => {
    let r = l.remarks.replace(/^Rec\s+/i, ''); const sac = (r.match(/\bSAC (\S+)/) || [])[1] || ''; const job = (r.match(/\bJob (\S+)/) || [])[1] || '';
    r = r.replace(/\s*\bSAC \S+/, '').replace(/\s*\bJob \S+/, '').trim();
    const fc = l.currency && l.currency !== 'INR' && num(l.amountFcy);
    return { ...blankCharge(), charge: r || l.ledgerName, ledgerId: l.ledgerId, sac, pr: l.dc === eSide ? 'Pay' : 'Rec', currency: fc ? l.currency : 'INR', roe: fc ? String(l.roe || '') : '1', qty: '1', rate: String(fc ? num(l.amountFcy) : l.amount), gstRate: slab, jobNo: job || v.jobNo || '' };
  });
  return { mode: cnMode ? 'cn' : 'bill', vendor: vend.ledgerId, vendorAmount: vend.amount, lines, roundOff: roL.length > 0 || Math.abs(vend.amount - Math.round(vend.amount)) < 0.001,
    tdsSecs: [p.tds1Section || (tdsL[0] && (String(tdsL[0].remarks).match(/\b19\d[A-Z]*\b/) || [])[0]) || '', p.tds2Section || ''], tdsAmts: [num(p.tds1Amount) || (tdsL[0] ? tdsL[0].amount : 0), num(p.tds2Amount)],
    h: { voucherNumber: v.voucherNumber, date: String(v.date).slice(0, 10), billNo: p.billNo || v.refNo || '', billDate: String(p.billDate || v.date).slice(0, 10), dueDate: String(p.dueDate || addDays(String(v.date).slice(0, 10), 30)).slice(0, 10),
      jobNo: v.jobNo || '', narration: v.narration || '', supply: gstL.some(l => /igst/i.test(l.ledgerName)) ? 'inter' : 'intra', branchCode: v.branchCode || '', hblNo: p.hblNo || '', mblNo: p.mblNo || '',
      isSez: Number(p.isSez) === 1, sezType: p.sezType || 'igst', hold: Number(p.holdPayment) === 1, holdReason: p.holdReason || '', against: p.againstVoucherId ? String(p.againstVoucherId) : '', cnReason: p.cnReason || '' } };
}

export function PurchaseForm({ desk, typeId, onSaved, onClear, draftKey, initial, editId, actions }) {
  const seed = useMemo(() => (initial ? purchaseFromVoucher(initial) : null), []);
  const keepAgainst = React.useRef(!!(seed && seed.h.against));
  const cfg = PURCHASE_DESKS[desk];
  const [mode, setMode] = useState(seed ? seed.mode : 'bill'); // 'bill' | 'cn'
  const [cnTypeId, setCnTypeId] = useState(null);
  const [h, setH] = useState(() => (seed ? { ...seed.h, ...(editId ? {} : { voucherNumber: '', date: todayIso(), billNo: '', hold: false, holdReason: '' }) }
    : { voucherNumber: '', date: todayIso(), billNo: '', billDate: todayIso(), dueDate: addDays(todayIso(), 30), jobNo: '', narration: '', supply: 'intra', branchCode: '',
    hblNo: '', mblNo: '', isSez: false, sezType: 'igst', hold: false, holdReason: '', against: '', cnReason: '' }));
  const [vendor, setVendor] = useState(seed ? seed.vendor : '');
  const [cur, setCur] = useState(blankCharge());
  const [editAt, setEditAt] = useState(-1);
  const [lines, setLines] = useState(seed ? seed.lines : []);
  const [tds, setTds] = useState(blankTds(true));
  const [tds2, setTds2] = useState(blankTds(false));
  const [roundOff, setRoundOff] = useState(seed ? seed.roundOff : true);
  const [look, setLook] = useState({ all: [], creditors: [], expenses: [], charges: [], tds: [], tax: null });
  const [bills, setBills] = useState([]);
  const [msg, setMsg] = useState(''); const [saving, setSaving] = useState(false);
  const [ocr, setOcr] = useState(null); // { busy, file, source, warnings }
  const ocrInput = React.useRef(null);
  const v = useBalance(vendor);
  const cn = mode === 'cn';
  const useType = editId ? initial.voucherTypeId : cn ? cnTypeId : typeId;

  useEffect(() => {
    Promise.all([lookup('ledgers'), lookup('ledgers-in?groups=Sundry Creditors'), lookup('ledgers-in?nature=Expenses'), api('/api/accounts-hub/masters/gstcharges').catch(() => []), lookup('tdsnatures'),
      postJson('/api/accounts-hub/tax-ledgers', {}).catch(() => null)])
      .then(([all, creditors, expenses, charges, tdsN, tax]) => setLook({ all, creditors, expenses, charges, tds: tdsN, tax }));
    lookup('voucher-types').then(ts => { const t = (ts || []).find(x => x.baseType === 'Debit Note'); setCnTypeId(t ? t.id : null); });
  }, [typeId]);
  // the voucher no follows the type: Purchase for a bill, Debit Note for a vendor credit note
  const pDiv = h.division || pDivFrom(h.jobNo) || pDivFrom((lines.find(l => l.jobNo) || {}).jobNo);
  useEffect(() => { if (useType && !editId) api('/api/vouchers/next-number/' + useType + '?' + new URLSearchParams({ division: pDiv || '', branch: h.branchCode || '', date: h.date || '' }).toString()).then(r => setH(x => ({ ...x, icaffe: !!r.icaffe, voucherNumber: r.icaffe ? (r.nextNumber || r.note || 'on Save') : (r.nextNumber || '') }))).catch(() => {}); }, [useType, pDiv, h.branchCode, h.date]);
  // vendor registered outside Delhi (state code 07, the company's GST state) -> IGST; can be changed by hand. SEZ is always IGST.
  useEffect(() => { if (v && v.gstin && /^\d{2}/.test(v.gstin)) setH(x => ({ ...x, supply: x.isSez ? 'inter' : v.gstin.slice(0, 2) === '07' ? 'intra' : 'inter' })); }, [v && v.gstin]);
  // TDS sections of the saved bill, once the sections are loaded
  useEffect(() => {
    if (!seed || !look.tds.length) return;
    const nat = (sec) => (sec ? look.tds.find(n => String(n.section).toUpperCase() === String(sec).toUpperCase()) : null);
    const n1 = nat(seed.tdsSecs[0]), n2 = nat(seed.tdsSecs[1]);
    const taxable = seed.lines.reduce((a, l) => a + (l.pr === 'Rec' ? -1 : 1) * num(l.rate) * num(l.qty || 1) * (l.currency === 'INR' ? 1 : num(l.roe)), 0);
    const baseOf = (n, amt) => (n && amt && taxable && Math.abs(Math.round(taxable * num(n.rate) / 100) - amt) > 1 ? 'bill' : 'taxable');
    setTds(n1 ? { on: true, natureId: String(n1.id), rate: String(n1.rate), base: baseOf(n1, seed.tdsAmts[0]) } : blankTds(!!seed.tdsAmts[0]));
    setTds2(n2 ? { on: true, natureId: String(n2.id), rate: String(n2.rate), base: baseOf(n2, seed.tdsAmts[1]) } : blankTds(false));
  }, [look.tds.length]);
  useEffect(() => { if (keepAgainst.current) keepAgainst.current = false; else setH(x => ({ ...x, against: '' })); if (cn && vendor) api('/api/accounts-hub/vendor-bills?ledgerId=' + vendor).then(setBills).catch(() => setBills([])); else setBills([]); }, [cn, vendor]);

  const switchMode = (m) => { if (m === mode || editId) return; setMode(m); setLines([]); setCur(blankCharge()); setEditAt(-1); setMsg(''); setTds(blankTds(true)); setTds2(blankTds(false));
    setH(x => ({ ...x, hold: false, holdReason: '', against: '', cnReason: '', billNo: '', isSez: false, sezType: 'igst', hblNo: '', mblNo: '' })); };
  const bill = bills.find(b => String(b.id) === String(h.against));

  // credit note: copy the charges of the chosen bill, so only the amounts need changing
  const copyFromBill = async () => {
    if (!bill) return setMsg('Choose the bill first');
    try {
      const vb = await api('/api/accounts-hub/vouchers/' + bill.id);
      const t = look.tax || {}; const taxIds = new Set(Object.values(t).map(String));
      const exp = (vb.lines || []).filter(l => l.dc === 'Dr' && String(l.ledgerId) !== String(vendor) && !taxIds.has(String(l.ledgerId)));
      const gstSum = (vb.lines || []).filter(l => l.dc === 'Dr' && [t.inputIgst, t.inputCgst, t.inputSgst, t.rcmInput].map(String).includes(String(l.ledgerId))).reduce((s, l) => s + num(l.amount), 0);
      const base = exp.reduce((s, l) => s + num(l.amount), 0);
      const pct = base ? (gstSum / base) * 100 : 0;
      const slab = SLABS.reduce((a, s) => (Math.abs(num(s) - pct) < Math.abs(num(a) - pct) ? s : a), '0');
      setLines(exp.map(l => ({ ...blankCharge(), charge: String(l.remarks || l.ledgerName || '').split(' SAC ')[0] || l.ledgerName, ledgerId: l.ledgerId, rate: String(l.amount), gstRate: slab, jobNo: vb.jobNo || '' })));
      const p = vb.purchase || {};
      const nat = (sec) => (sec ? look.tds.find(n => String(n.section).toUpperCase() === String(sec).toUpperCase()) : null);
      const n1 = nat(p.tds1Section), n2 = nat(p.tds2Section);
      setTds(n1 ? { on: true, natureId: String(n1.id), rate: String(n1.rate), base: 'taxable' } : blankTds(true));
      setTds2(n2 ? { on: true, natureId: String(n2.id), rate: String(n2.rate), base: 'taxable' } : blankTds(false));
      setH(x => ({ ...x, jobNo: x.jobNo || vb.jobNo || '', hblNo: x.hblNo || p.hblNo || bill.hblNo || '', mblNo: x.mblNo || p.mblNo || bill.mblNo || '',
        isSez: Number(p.isSez) === 1, sezType: p.sezType || 'igst' }));
      setMsg('Charges copied from bill ' + (bill.billNo || bill.voucherNumber) + ' - change the amounts to what the credit note says');
    } catch (e) { setMsg('Could not read the bill: ' + e.message); }
  };

  const pickCharge = (name) => {
    const c = look.charges.find(x => String(x.chargeName).toLowerCase() === String(name).toLowerCase());
    setCur(x => (c ? { ...x, charge: c.chargeName, sac: c.sacCode || '', gstRate: c.gstRate != null ? String(c.gstRate) : x.gstRate, ledgerId: c.expenseLedgerId || x.ledgerId } : { ...x, charge: name }));
  };
  const noTax = h.isSez && h.sezType === 'lut';
  const lineCalc = (l) => {
    const sign = l.pr === 'Rec' ? -1 : 1;
    const fcAmt = r2(num(l.qty || 1) * num(l.rate)); const tx = r2(l.currency === 'INR' ? fcAmt : fcAmt * num(l.roe));
    const g = noTax ? 0 : r2(tx * num(l.gstRate) / 100);
    return { fcAmt, tx: sign * tx, gst: sign * g };
  };
  const curCalc = lineCalc(cur);
  const supply = h.isSez ? 'inter' : h.supply;
  const split = (g) => (supply === 'inter' ? { igst: g, cgst: 0, sgst: 0 } : { igst: 0, cgst: r2(g / 2), sgst: r2(g - r2(g / 2)) });

  // ---- Read Excel: charges into the grid
  const XL = [{ key: 'charge', label: 'Charge', aliases: ['charge name', 'description'] }, { key: 'ledger', label: 'Expense Ledger', aliases: ['ledger', 'account'] }, { key: 'sac', label: 'SAC' },
    { key: 'pr', label: 'Pay/Rec', aliases: ['payrec'] }, { key: 'currency', label: 'Currency', aliases: ['curr'] }, { key: 'roe', label: 'Ex Rate', aliases: ['exrate', 'roe'] }, { key: 'qty', label: 'Quantity', aliases: ['qty'] },
    { key: 'rate', label: 'Rate' }, { key: 'gstRate', label: 'GST %', aliases: ['gst', 'gstrate'] }, { key: 'jobNo', label: 'Docket No', aliases: ['job no', 'docket', 'job'] }, { key: 'remarks', label: 'Narration', aliases: ['remarks'] }];
  const chargeOf = (name) => look.charges.find(x => String(x.chargeName).toLowerCase() === String(name || '').trim().toLowerCase());
  const readXl = async (file) => {
    setMsg('');
    try {
      const rows = await readExcel(file, XL); const bad = []; const got = [];
      for (const r of rows) {
        const c = chargeOf(r.charge); const l = r.ledger ? ledgerByName(look.all, r.ledger) : null; const ledgerId = l ? l.id : c && c.expenseLedgerId ? c.expenseLedgerId : '';
        if (!r.charge && !ledgerId) { bad.push('row ' + r._row + ' (no charge)'); continue; }
        if (!ledgerId) { bad.push('row ' + r._row + ' (expense ledger "' + (r.ledger || '') + '" not found)'); continue; }
        if (!(num(r.rate) > 0)) { bad.push('row ' + r._row + ' (no rate)'); continue; }
        const curr = String(r.currency || 'INR').toUpperCase();
        got.push({ ...blankCharge(), charge: c ? c.chargeName : r.charge, ledgerId, sac: r.sac || (c && c.sacCode) || '', pr: /^r/i.test(r.pr) ? 'Rec' : 'Pay', currency: curr, roe: curr === 'INR' ? '1' : String(num(r.roe) || ''),
          qty: String(num(r.qty) || 1), rate: String(num(r.rate)), gstRate: SLABS.includes(String(num(r.gstRate))) && r.gstRate !== '' ? String(num(r.gstRate)) : c && c.gstRate != null ? String(c.gstRate) : '18', jobNo: r.jobNo || h.jobNo, remarks: r.remarks });
      }
      if (got.length) setLines(x => [...x, ...got]);
      setMsg((got.length ? 'Read ' + got.length + ' charge' + (got.length === 1 ? '' : 's') + ' from Excel' : 'Nothing read') + (bad.length ? ' - skipped ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? ' and ' + (bad.length - 5) + ' more' : '') : ''));
    } catch (e) { setMsg('Could not read the Excel: ' + e.message); }
  };
  // ---- OCR: read the vendor bill and fill the form; the bill is attached to the voucher
  const readBill = async (file) => {
    if (!file) return;
    setMsg(''); setOcr({ busy: true, file: file.name });
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/accounts-hub/ocr-bill', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      const d = j.data || {};
      if (j.vendor) setVendor(j.vendor.id);
      const gst = num(d.igst) || num(d.cgst) + num(d.sgst);
      setH(x => ({ ...x, billNo: d.invoiceNo || x.billNo, billDate: d.invoiceDate || x.billDate, dueDate: d.dueDate || (d.invoiceDate ? addDays(d.invoiceDate, 30) : x.dueDate),
        hblNo: d.hblNo || x.hblNo, mblNo: d.mblNo || x.mblNo, jobNo: x.jobNo || d.jobNo || '', supply: num(d.igst) ? 'inter' : num(d.cgst) ? 'intra' : x.supply }));
      const ls = (d.lines || []).map(l => ({ ...blankCharge(), charge: l.charge || l.description, ledgerId: l.expenseLedgerId || '', sac: l.sac || '', qty: '1', rate: String(num(l.amount)),
        gstRate: SLABS.includes(String(num(l.gstRate))) ? String(num(l.gstRate)) : '18', currency: 'INR', roe: '1', jobNo: h.jobNo || d.jobNo || '', remarks: l.description && l.description !== l.charge ? l.description : '' }));
      if (ls.length) setLines(ls);
      const noLedger = ls.filter(l => !l.ledgerId).length;
      if (draftKey) {
        const ad = new FormData(); ad.append('files', file); ad.append('draftKey', draftKey); ad.append('documentType', 'VENDOR BILL');
        fetch('/api/vouchers/documents', { method: 'POST', body: ad }).then(() => window.dispatchEvent(new Event('acc-docs-changed'))).catch(() => {});
      }
      setOcr({ file: file.name, source: j.source, warnings: [...(j.warnings || []), ...(noLedger ? [noLedger + ' charge' + (noLedger === 1 ? ' has' : 's have') + ' no expense ledger - Edit and choose it'] : []),
        ...(d.total && gst && Math.abs(num(d.taxable) + gst - num(d.total)) > 1 ? ['Bill total ' + inr(d.total) + ' is not taxable + GST - check round off / other charges'] : [])],
        summary: [d.vendorName, d.invoiceNo, d.invoiceDate, d.total ? 'total ' + inr(d.total) : ''].filter(Boolean).join(' / ') });
    } catch (e) { setOcr(null); setMsg('Could not read the bill: ' + e.message); }
  };
  const add = () => {
    setMsg('');
    if (!cur.charge && !cur.ledgerId) return setMsg('Choose the charge');
    if (!cur.ledgerId) return setMsg('Choose the expense ledger for this charge');
    if (!curCalc.tx) return setMsg('Enter the rate');
    const l = { ...cur, jobNo: cur.jobNo || h.jobNo };
    setLines(x => (editAt >= 0 ? x.map((y, i) => (i === editAt ? l : y)) : [...x, l]));
    setCur({ ...blankCharge(), jobNo: cur.jobNo, currency: cur.currency, roe: cur.roe, gstRate: cur.gstRate }); setEditAt(-1);
  };

  const calc = useMemo(() => {
    const L = lines.map(l => ({ ...l, ...lineCalc(l) }));
    const taxable = r2(L.reduce((s, l) => s + l.tx, 0)); const gst = r2(L.reduce((s, l) => s + l.gst, 0));
    const { igst, cgst, sgst } = split(gst);
    const billValue = cfg.rcm ? taxable : r2(taxable + gst);
    const tdsOf = (x) => (x.on && num(x.rate) ? Math.round((x.base === 'bill' ? billValue : taxable) * num(x.rate) / 100) : 0);
    const tds1Amt = tdsOf(tds); const tds2Amt = tdsOf(tds2); const tdsAmt = tds1Amt + tds2Amt;
    let payable = r2(billValue - tdsAmt);
    const rounded = roundOff ? Math.round(payable) : payable; const ro = r2(rounded - payable); payable = rounded;
    return { L, taxable, gst, igst, cgst, sgst, billValue, tds1Amt, tds2Amt, tdsAmt, payable, ro };
  }, [lines, supply, tds, tds2, roundOff, cfg.rcm, noTax]);

  const secOf = (x) => (look.tds.find(n => String(n.id) === String(x.natureId)) || {}).section || '';
  const posting = useMemo(() => {
    const t = look.tax || {}; const out = [];
    const put = (ledgerId, amt, dc, rest = {}) => { if (!ledgerId || !r2(amt)) return; out.push({ ledgerId, dc: amt < 0 ? flip(dc) : dc, amount: r2(Math.abs(amt)), ...rest }); };
    calc.L.forEach(l => put(l.ledgerId, l.tx, 'Dr', { remarks: [l.pr === 'Rec' && 'Rec', l.charge, l.sac && 'SAC ' + l.sac, l.jobNo && 'Job ' + l.jobNo].filter(Boolean).join(' ') || null, ...(l.currency !== 'INR' ? { currency: l.currency, amountFcy: l.fcAmt, roe: num(l.roe) } : {}) }));
    if (calc.gst) {
      if (cfg.rcm) { put(t.rcmInput, calc.gst, 'Dr', { remarks: 'GST under reverse charge' }); put(t.rcmPayable, calc.gst, 'Cr', { remarks: 'GST payable under reverse charge' }); }
      else { put(t.inputIgst, calc.igst, 'Dr'); put(t.inputCgst, calc.cgst, 'Dr'); put(t.inputSgst, calc.sgst, 'Dr'); }
    }
    put(t.tdsPayable, calc.tds1Amt, 'Cr', { remarks: secOf(tds) || 'TDS' });
    put(t.tdsPayable, calc.tds2Amt, 'Cr', { remarks: (secOf(tds2) || 'TDS') + ' (2nd TDS)' });
    if (calc.ro) out.push({ ledgerId: t.roundOff, dc: calc.ro > 0 ? 'Dr' : 'Cr', amount: Math.abs(calc.ro), remarks: 'Round off' });
    if (vendor) put(vendor, calc.payable, 'Cr', { remarks: h.billNo ? (cn ? 'Credit note ' : 'Bill ') + h.billNo : null });
    const ok = out.filter(p => p.ledgerId);
    return cn ? ok.map(p => ({ ...p, dc: flip(p.dc) })) : ok;
  }, [calc, vendor, look, cfg.rcm, tds.natureId, tds2.natureId, h.billNo, cn]);
  const dr = posting.filter(p => p.dc === 'Dr').reduce((s, p) => s + p.amount, 0);
  const cr = posting.filter(p => p.dc === 'Cr').reduce((s, p) => s + p.amount, 0);
  const nameOf = (id) => (look.all.find(l => String(l.id) === String(id)) || {}).name || '';

  const save = async () => {
    setMsg('');
    if (!useType) return setMsg(cn ? 'Voucher type "Debit Note" is missing - add it in Masters, Voucher types' : 'Voucher type is missing');
    if (!vendor) return setMsg('Choose the party (vendor)');
    if (!h.billNo) return setMsg(cn ? 'Enter the credit note no given by the vendor' : 'Enter the vendor invoice no');
    if (cn && !bill) return setMsg('Choose the bill this credit note is against');
    if (!cn && cfg.needJob && !h.jobNo && !lines.some(l => l.jobNo)) return setMsg('A trade invoice needs the docket / job no');
    if (!lines.length) return setMsg(cur.charge ? 'Click Add to put the charge in the grid' : 'Add at least one charge');
    if (lines.some(l => !l.ledgerId)) return setMsg('Every charge needs its expense ledger - Edit the lines marked in red');
    if (calc.taxable <= 0) return setMsg('The charges add up to nil or less - check Pay / Rec on the lines');
    if (h.hold && !h.holdReason.trim()) return setMsg('Give the reason for holding the payment');
    if (tds.on && tds2.on && tds.natureId && tds.natureId === tds2.natureId) return setMsg('1st and 2nd TDS have the same section - use one');
    const canCredit = bill ? bill.left + (editId && seed && String(seed.h.against) === String(bill.id) ? seed.vendorAmount : 0) : 0;
    if (cn && calc.payable - canCredit > 0.01) return setMsg('Credit note ' + inr(calc.payable) + ' is more than what is left on the bill (' + inr(canCredit) + ')');
    if (!look.tax) return setMsg('GST / TDS ledgers could not be set up - check the Duties & Taxes group');
    if (!posting.length || Math.abs(dr - cr) > 0.01) return setMsg('Debit and credit must be equal before saving');
    setSaving(true);
    try {
      const d8 = (s) => s.split('-').reverse().join('/');
      const narration = h.narration || (cn
        ? `Credit note ${h.billNo} dated ${d8(h.billDate)} against bill ${bill.billNo || bill.voucherNumber}${h.cnReason ? ' - ' + h.cnReason : ''}`
        : `${cfg.title} - bill ${h.billNo} dated ${d8(h.billDate)}, due ${d8(h.dueDate)}${h.hblNo ? ', HBL ' + h.hblNo : ''}`);
      const allocations = cn && calc.payable > 0 ? [{ ledgerId: vendor, againstVoucherId: bill.id, refNo: bill.billNo || bill.voucherNumber, refType: 'AGAINST', amount: calc.payable }] : [];
      const body = { voucherTypeId: useType, voucherNumber: h.voucherNumber, division: pDiv || null, ownBranch: h.branchCode || null, date: h.date, narration, refNo: h.billNo, jobNo: h.jobNo || (lines.find(l => l.jobNo) || {}).jobNo || null, branchCode: h.branchCode || null, details: posting, ...(cn || !editId ? { allocations } : {}) };
      let id;
      if (editId) { await postJson('/api/accounts-hub/vouchers/' + editId, body, 'PUT'); id = editId; }
      else { const r = await postJson('/api/vouchers', body); id = r && r.data && r.data.id; }
      if (id) {
        await postJson('/api/accounts-hub/purchase-info/' + id, {
          kind: cn ? 'cn' : 'bill', desk, billNo: h.billNo, billDate: h.billDate, dueDate: cn ? null : h.dueDate, hblNo: h.hblNo, mblNo: h.mblNo,
          isSez: h.isSez ? 1 : 0, sezType: h.isSez ? h.sezType : null, tds1Section: calc.tds1Amt ? secOf(tds) : null, tds1Amount: calc.tds1Amt || null,
          tds2Section: calc.tds2Amt ? secOf(tds2) : null, tds2Amount: calc.tds2Amt || null, againstVoucherId: cn ? bill.id : null, cnReason: cn ? h.cnReason : null,
          holdPayment: !cn && h.hold ? 1 : 0, holdReason: !cn && h.hold ? h.holdReason.trim() : null,
        }).catch(e => window.console && console.warn('bill details not saved', e));
      }
      onSaved(id);
    } catch (e) { setMsg('Not saved: ' + e.message); }
    setSaving(false);
  };

  const set = (k) => (e) => setH({ ...h, [k]: e.target.value });
  const setC = (k) => (e) => setCur({ ...cur, [k]: e.target.value });
  const cs = split(curCalc.gst);
  const g6 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, alignItems: 'end' };
  const seg = (on) => ({ padding: '5px 14px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', border: 'none', background: on ? T.grad : 'transparent', color: on ? '#fff' : T.head });
  const tdsRow = (x, setX, label, amt) => (
    <div style={{ display: 'grid', gridTemplateColumns: '84px minmax(200px, 2fr) repeat(3, minmax(100px, 1fr))', gap: 10, alignItems: 'end' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6, whiteSpace: 'nowrap' }}><input type="checkbox" checked={x.on} onChange={e => setX({ ...x, on: e.target.checked })} /> {label}</label>
      <Field label="TDS Account / Section"><select style={inputStyle} value={x.natureId} disabled={!x.on} onChange={e => { const n = look.tds.find(y => String(y.id) === e.target.value); setX({ ...x, natureId: e.target.value, rate: n ? String(n.rate) : '' }); }}>
        <option value="">No TDS</option>{look.tds.map(n => <option key={n.id} value={n.id}>{n.section} - {n.name} ({n.rate}%)</option>)}</select></Field>
      <Field label="TDS On"><select style={inputStyle} value={x.base} disabled={!x.on} onChange={e => setX({ ...x, base: e.target.value })}><option value="taxable">Taxable</option><option value="bill">Bill value</option></select></Field>
      <Field label="TDS Rate"><input style={{ ...inputStyle, textAlign: 'right' }} disabled={!x.on} value={x.rate} onChange={e => setX({ ...x, rate: e.target.value })} inputMode="decimal" /></Field>
      <Field label="TDS Amount"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={inr(amt)} /></Field>
    </div>
  );
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: `1px solid ${T.headBorder}`, borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
          <button type="button" style={seg(!cn)} onClick={() => switchMode('bill')}>Invoice</button>
          <button type="button" style={seg(cn)} onClick={() => switchMode('cn')}>Credit Note</button>
        </div>
        {cn && <span style={{ fontSize: 11.5, color: T.inkSoft }}>Vendor's credit note against one of its bills - booked as a Debit Note, every line of the bill reversed.</span>}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
          <Btn kind="primary" onClick={() => ocrInput.current && ocrInput.current.click()} disabled={ocr && ocr.busy} title="Read the vendor's bill (PDF or photo) and fill this form"><ScanText size={13} /> {ocr && ocr.busy ? 'Reading bill' : 'Read bill (OCR)'}</Btn>
          <input ref={ocrInput} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => { readBill(e.target.files && e.target.files[0]); e.target.value = ''; }} />
        </span>
      </div>
      {ocr && !ocr.busy && (
        <div style={{ fontSize: 11.5, padding: '7px 10px', borderRadius: 6, background: ocr.warnings.length ? T.amberBg : T.okBg, border: '1px solid ' + (ocr.warnings.length ? '#fde68a' : '#a7f3d0'), color: T.inkSoft }}>
          <b style={{ color: ocr.warnings.length ? T.amber : T.cr }}>Filled from {ocr.file}{ocr.source === 'gemini' ? ' (read by AI)' : ' (from the bill text)'}</b>{ocr.summary ? ' - ' + ocr.summary : ''}. Check every field before Save; the bill is attached to the voucher.
          {ocr.warnings.map((w, i) => <div key={i} style={{ color: T.amber, marginTop: 2 }}>- {w}</div>)}
        </div>
      )}
      {ocr && ocr.busy && <div style={{ fontSize: 11.5, padding: '7px 10px', borderRadius: 6, background: T.headBg, color: T.head, fontWeight: 700 }}>Reading {ocr.file} - this can take up to a minute</div>}
      {cfg.rcm && <div style={{ fontSize: 11.5, fontWeight: 700, color: T.amber, background: T.amberBg, border: '1px solid #fde68a', padding: '6px 10px', borderRadius: 6 }}>Reverse charge - the GST on this bill is paid by you, not the vendor.</div>}
      <Box>
        <div style={g6}>
          <Field label="Division" required><select style={pDiv ? inputStyle : mandStyle} value={pDiv} onChange={set('division')} disabled={!!editId}><option value="">Select</option>{P_DIVS.map(([k, l]) => <option key={k} value={k}>{k} - {l}</option>)}</select></Field>
          <Field label="Voucher No" required><input style={h.voucherNumber ? (h.icaffe ? { ...inputStyle, background: '#eef2f6' } : inputStyle) : mandStyle} readOnly={!!h.icaffe && !editId} value={h.voucherNumber} onChange={set('voucherNumber')} /></Field>
          <Field label="Date" required><input type="date" style={inputStyle} value={h.date} onChange={set('date')} /></Field>
          <Field label="Branch"><input style={inputStyle} value={h.branchCode} onChange={set('branchCode')} placeholder="This branch" /></Field>
          <Field label="Select Party" required span={2}><LedgerPicker id="vendor" list={look.creditors.length ? look.creditors : look.all} value={vendor} onChange={setVendor} autoFocus placeholder="Vendor (Sundry Creditors)" mandatory /><PartyNote b={v} /></Field>
          <Field label="Party GSTIN"><input readOnly style={roStyle} value={v ? v.gstin || '' : ''} /></Field>
          <Field label="State"><input readOnly style={roStyle} value={v ? v.state || (v.gstin ? 'Code ' + v.gstin.slice(0, 2) : '') : ''} /></Field>
          <Field label={cn ? 'Credit Note No' : 'Invoice No'} required><input style={h.billNo ? inputStyle : mandStyle} value={h.billNo} onChange={set('billNo')} placeholder={cn ? 'Vendor credit note no' : 'Vendor bill no'} /></Field>
          <Field label={cn ? 'Credit Note Date' : 'Invoice Date'} required><input type="date" style={inputStyle} value={h.billDate} onChange={e => setH({ ...h, billDate: e.target.value, dueDate: addDays(e.target.value, (v && v.creditDays) || 30) })} /></Field>
          {!cn && <Field label="Due Date"><input type="date" style={inputStyle} value={h.dueDate} onChange={set('dueDate')} /></Field>}
          <Field label="Place Of Supply"><select style={h.isSez ? roStyle : inputStyle} disabled={h.isSez} value={supply} onChange={set('supply')}><option value="intra">Same state (CGST + SGST)</option><option value="inter">Other state (IGST)</option></select></Field>
          <Field label="Docket / Job No" required={cfg.needJob && !cn}><input style={cfg.needJob && !cn && !h.jobNo ? mandStyle : inputStyle} value={h.jobNo} onChange={set('jobNo')} placeholder={cfg.needJob ? 'Job of this bill' : 'Optional'} /></Field>
          <Field label="HBL / HAWB No"><input style={inputStyle} value={h.hblNo} onChange={set('hblNo')} /></Field>
          <Field label="Master (MBL / MAWB) No"><input style={inputStyle} value={h.mblNo} onChange={set('mblNo')} /></Field>
          <Field label="SEZ Supplier">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={h.isSez} onChange={e => setH({ ...h, isSez: e.target.checked })} />
              <select style={{ ...(h.isSez ? inputStyle : roStyle), flex: 1 }} disabled={!h.isSez} value={h.sezType} onChange={set('sezType')}><option value="igst">With IGST</option><option value="lut">Without tax (LUT)</option></select>
            </div>
          </Field>
          <Field label="Party Balance"><input readOnly style={roStyle} value={v ? inr(v.balance) + ' ' + v.side : ''} /></Field>
        </div>
      </Box>

      {cn && (
        <Box title="Against Bill" right={bill ? <Btn small kind="ghost" onClick={copyFromBill}><Copy size={11} /> Copy charges from this bill</Btn> : null}>
          <div style={g6}>
            <Field label="Bill" required span={2}><select style={bill ? inputStyle : mandStyle} value={h.against} onChange={set('against')} disabled={!vendor}>
              <option value="">{vendor ? (bills.length ? 'Choose the bill' : 'No bills of this vendor') : 'Choose the party first'}</option>
              {bills.map(b => <option key={b.id} value={b.id} disabled={b.left <= 0 && String(b.id) !== String(h.against)}>{(b.billNo || '-') + ' / ' + b.voucherNumber + ' / ' + fmtDate(b.date) + ' / ' + inr(b.amount) + (b.credited ? ' (credited ' + inr(b.credited) + ')' : '')}</option>)}
            </select></Field>
            <Field label="Bill Amount"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={bill ? inr(bill.amount) : ''} /></Field>
            <Field label="Already Credited"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={bill ? inr(bill.credited) : ''} /></Field>
            <Field label="Can Still Credit"><input readOnly style={{ ...roStyle, textAlign: 'right', fontWeight: 800 }} value={bill ? inr(bill.left) : ''} /></Field>
            <Field label="Reason" span={2}><input style={inputStyle} value={h.cnReason} onChange={set('cnReason')} placeholder="Rate difference, short shipment, discount ..." /></Field>
          </div>
        </Box>
      )}

      <Box>
        <div style={g6}>
          <Field label="Charge" required span={2}><SuggestBox text={cur.charge || ''} onText={v => pickCharge(v)} onPick={c => pickCharge(c.chargeName)} items={look.charges} getLabel={c => c.chargeName} getKey={c => c.id} getSub={c => [c.sacCode, c.gstRate != null && c.gstRate + '%'].filter(Boolean).join(' - ')} style={cur.charge ? inputStyle : mandStyle} placeholder="Air freight, THC, CHA ..." /></Field>
          <Field label="SAC"><input style={inputStyle} value={cur.sac} onChange={setC('sac')} /></Field>
          <Field label="Pay / Rec"><select style={inputStyle} value={cur.pr} onChange={setC('pr')}><option value="Pay">Pay (charge)</option><option value="Rec">Rec (less from bill)</option></select></Field>
          <Field label="Expense Ledger" required span={2}><LedgerPicker id="pl" list={look.expenses.length ? look.expenses : look.all} value={cur.ledgerId} onChange={x => setCur({ ...cur, ledgerId: x })} placeholder="Expense ledger" mandatory /></Field>
          <Field label="Currency"><select style={inputStyle} value={cur.currency} onChange={e => setCur({ ...cur, currency: e.target.value, roe: e.target.value === 'INR' ? '1' : cur.roe })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Ex.Rate"><input style={cur.currency === 'INR' ? roStyle : inputStyle} readOnly={cur.currency === 'INR'} value={cur.roe} onChange={setC('roe')} inputMode="decimal" /></Field>
          <Field label="Quantity"><input style={{ ...inputStyle, textAlign: 'right' }} value={cur.qty} onChange={setC('qty')} inputMode="decimal" /></Field>
          <Field label="Rate" required><input style={{ ...(num(cur.rate) ? inputStyle : mandStyle), textAlign: 'right' }} value={cur.rate} onChange={setC('rate')} inputMode="decimal" onKeyDown={e => e.key === 'Enter' && add()} /></Field>
          <Field label="Amt. (FC)"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={cur.currency === 'INR' ? '' : inr(curCalc.fcAmt)} /></Field>
          <Field label="Amount (INR)"><input readOnly style={{ ...roStyle, textAlign: 'right', fontWeight: 800 }} value={inr(curCalc.tx)} /></Field>
          <Field label="GST %"><select style={noTax ? roStyle : inputStyle} disabled={noTax} value={cur.gstRate} onChange={setC('gstRate')}>{SLABS.map(g => <option key={g} value={g}>{g}%</option>)}</select></Field>
          <Field label="SGST Amt"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={inr(cs.sgst)} /></Field>
          <Field label="CGST Amt"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={inr(cs.cgst)} /></Field>
          <Field label="IGST Amt"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={inr(cs.igst)} /></Field>
          <Field label="Docket No"><input style={inputStyle} value={cur.jobNo} onChange={setC('jobNo')} placeholder={h.jobNo || 'Same as bill'} /></Field>
          <Field label="Charge Narration" span={2}><input style={inputStyle} value={cur.remarks} onChange={setC('remarks')} /></Field>
          <Field label="Invoice Amount"><input readOnly style={{ ...roStyle, textAlign: 'right' }} value={inr(cfg.rcm ? curCalc.tx : curCalc.tx + curCalc.gst)} /></Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn kind="primary" onClick={add}><Plus size={13} /> {editAt >= 0 ? 'Update' : 'Add'}</Btn></div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}><ExcelButtons label="Read charges from Excel" onFile={readXl} onSample={() => sampleExcel('trade_invoice_charges_sample', XL, [['AIR FREIGHT', 'AIR FREIGHT EXPENSE', '996531', 'Pay', 'USD', 84.5, 120, 2.35, 18, 'AE/001', ''], ['INCENTIVE', 'INCENTIVE RECEIVED', '', 'Rec', 'INR', 1, 1, 500, 18, 'AE/001', '']])} /></div>
      </Box>

      <Grid title="Charge Information" maxHeight={260} empty={cn ? 'Choose the bill and copy its charges, or enter them above' : 'Enter a charge and rate above, then Add'}
        rows={calc.L}
        cols={[
          { label: 'Edit', w: 40, render: (l, i) => <span onClick={() => { setCur(lines[i]); setEditAt(i); }} style={{ cursor: 'pointer', color: T.head }}><Pencil size={13} /></span> },
          { label: 'Delete', w: 48, render: (l, i) => <span onClick={() => setLines(x => x.filter((_, j) => j !== i))} style={{ cursor: 'pointer', color: T.dr }}><Trash2 size={13} /></span> },
          { label: 'Docket Number', render: l => l.jobNo },
          { label: 'Pay/Rec', render: l => <Badge tone={l.pr === 'Rec' ? 'warn' : 'brand'}>{l.pr || 'Pay'}</Badge> },
          { label: 'SAC', render: l => l.sac },
          { label: 'Charge Name', wrap: true, render: l => <div><b>{l.charge}</b><div style={{ fontSize: 10, color: l.ledgerId ? T.muted : T.dr, fontWeight: l.ledgerId ? 400 : 800 }}>{l.ledgerId ? nameOf(l.ledgerId) : 'Choose the expense ledger (Edit)'}</div></div> },
          { label: 'Qty', right: true, render: l => l.qty },
          { label: 'Rate', right: true, render: l => inr(l.rate) },
          { label: 'Cur', render: l => (l.currency !== 'INR' ? l.currency + ' @ ' + l.roe : 'INR') },
          { label: 'Amount', right: true, render: l => <Money v={l.tx} /> },
          { label: 'GST %', right: true, render: l => (noTax ? '0%' : l.gstRate + '%') },
          { label: 'SGST', right: true, render: l => inr(split(l.gst).sgst) },
          { label: 'CGST', right: true, render: l => inr(split(l.gst).cgst) },
          { label: 'IGST', right: true, render: l => inr(split(l.gst).igst) },
          { label: 'Narration', wrap: true, render: l => l.remarks },
        ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 10, alignItems: 'start' }} className="acc-bill-foot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Box title={cn ? 'TDS (reversed on the credit note)' : 'TDS'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tdsRow(tds, setTds, '1st TDS', calc.tds1Amt)}
              {tdsRow(tds2, setTds2, '2nd TDS', calc.tds2Amt)}
            </div>
          </Box>
          {!cn && (
            <Box title="Hold Payment" right={h.hold ? <Badge tone="warn">No payment until released</Badge> : null}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 10, alignItems: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6, whiteSpace: 'nowrap' }}><input type="checkbox" checked={h.hold} onChange={e => setH({ ...h, hold: e.target.checked })} /> <PauseCircle size={13} /> Hold this bill</label>
                <Field label="Reason" required={h.hold}><input style={h.hold && !h.holdReason ? mandStyle : h.hold ? inputStyle : roStyle} disabled={!h.hold} value={h.holdReason} onChange={set('holdReason')} placeholder="Short delivery, rate dispute, documents pending ..." /></Field>
              </div>
            </Box>
          )}
          <Box><Field label="Narration"><input style={inputStyle} value={h.narration} onChange={set('narration')} placeholder={cn ? 'Leave blank to use the credit note and bill no' : 'Leave blank to use the bill no and dates'} /></Field></Box>
        </div>
        <Box title={cn ? 'Credit Note Total' : 'Bill Total'} pad={0}>
          <div style={{ padding: '6px 12px', fontSize: 12 }}>
            {[['Taxable Value', calc.taxable], ['CGST', calc.cgst], ['SGST', calc.sgst], ['IGST', calc.igst], ...(cfg.rcm ? [['GST paid by you (RCM)', calc.gst ? -calc.gst : 0]] : []),
              [cn ? 'Credit Note Value' : 'Bill Value', calc.billValue], ['1st TDS', calc.tds1Amt ? -calc.tds1Amt : 0], ...(calc.tds2Amt ? [['2nd TDS', -calc.tds2Amt]] : [])].map(([k, val]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: T.inkSoft }}>{k}</span><Money v={val} /></div>
            ))}
            {noTax && <div style={{ fontSize: 10.5, color: T.amber, padding: '2px 0' }}>SEZ under LUT - no GST on this bill</div>}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}><input type="checkbox" checked={roundOff} onChange={e => setRoundOff(e.target.checked)} /> Round off {calc.ro ? '(' + inr(calc.ro) + ')' : ''}</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: T.headBg, borderTop: `1px solid ${T.headBorder}` }}><b style={{ color: T.head }}>{cn ? 'Less From Party' : 'Payable To Party'}</b><Money v={calc.payable} side={cn ? 'Dr' : 'Cr'} strong /></div>
        </Box>
      </div>

      {posting.length > 0 && <PostingTable title="This will post" lines={posting.map(p => ({ ...p, ledgerName: nameOf(p.ledgerId) }))} />}
      <BalanceStrip dr={dr} cr={cr} />
      {editId && <div style={{ padding: '8px 12px', borderRadius: 6, background: T.amberBg, border: '1px solid #fde68a', fontSize: 12, fontWeight: 600, color: T.amber }}>Modifying {cn ? 'credit note' : 'bill'} {initial.voucherNumber}. Charges, GST and TDS are read back from the saved voucher - check them before Save changes; after saving the voucher goes back for approval.</div>}
      <ActionBar note={msg}>
        <Btn kind="save" onClick={save} disabled={saving}>{editId ? <Pencil size={13} /> : <Save size={13} />} {saving ? 'Saving' : editId ? 'Save changes' : cn ? 'Save credit note' : 'Save'}</Btn>
        {!editId && actions}
        <Btn kind="clear" onClick={onClear}>{editId ? <X size={13} /> : <RotateCcw size={13} />} {editId ? 'Cancel' : 'Clear'}</Btn>
      </ActionBar>
      <style>{`@media (max-width: 900px) { .acc-bill-foot { grid-template-columns: 1fr !important; } }`}</style>
    </>
  );
}

// bill details shown when a saved purchase bill or credit note is opened, with Hold / Release
export function PurchaseInfoBox({ v, onChanged }) {
  const p = v.purchase;
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [msg, setMsg] = useState('');
  if (!p && v.baseType !== 'Purchase') return null;
  const held = p && Number(p.holdPayment) === 1;
  const isBill = v.baseType === 'Purchase';
  const hold = async (on) => {
    setMsg('');
    if (on && !reason.trim()) return setMsg('Give the reason');
    try { await postJson('/api/accounts-hub/purchase-info/' + v.id + '/hold', { hold: on ? 1 : 0, reason: reason.trim() }); setOpen(false); setReason(''); onChanged(); }
    catch (e) { setMsg(e.message); }
  };
  const cell = (k, val) => (val ? <div key={k} style={{ minWidth: 0 }}><div style={{ fontSize: 10, color: T.muted, fontWeight: 700 }}>{k}</div><div style={{ fontSize: 12, fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</div></div> : null);
  return (
    <Box title={p && p.kind === 'cn' ? 'Credit Note Details' : 'Bill Details'}
      right={isBill ? (held ? <><Badge tone="warn">Payment on hold</Badge><Btn small kind="clear" onClick={() => hold(false)}>Release payment</Btn></> : <Btn small kind="ghost" onClick={() => setOpen(o => !o)}><PauseCircle size={11} /> Hold payment</Btn>) : null}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        {p && [
          cell(p.kind === 'cn' ? 'Credit Note No' : 'Invoice No', p.billNo), cell('Date', fmtDate(p.billDate)), cell('Due Date', fmtDate(p.dueDate)),
          cell('HBL / HAWB', p.hblNo), cell('Master No', p.mblNo), cell('SEZ', Number(p.isSez) ? (p.sezType === 'lut' ? 'Yes, without tax (LUT)' : 'Yes, with IGST') : ''),
          cell('1st TDS', p.tds1Amount ? (p.tds1Section || 'TDS') + ' - ' + inr(p.tds1Amount) : ''), cell('2nd TDS', p.tds2Amount ? (p.tds2Section || 'TDS') + ' - ' + inr(p.tds2Amount) : ''),
          cell('Against Bill', p.againstNo ? p.againstNo + ' / ' + fmtDate(p.againstDate) : ''), cell('Reason', p.cnReason),
          cell('Held', held ? p.holdReason + (p.holdBy ? ' - ' + p.holdBy : '') + (p.holdAt ? ', ' + fmtDate(p.holdAt) : '') : ''),
        ]}
        {!p && <div style={{ fontSize: 11.5, color: T.muted }}>No bill details were saved with this voucher.</div>}
      </div>
      {open && !held && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <input autoFocus style={{ ...inputStyle, flex: 1 }} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is the payment held?" onKeyDown={e => e.key === 'Enter' && hold(true)} />
          <Btn small kind="primary" onClick={() => hold(true)}>Hold</Btn>
        </div>
      )}
      {msg && <div style={{ marginTop: 6, fontSize: 11.5, color: T.dr }}>{msg}</div>}
      {v.creditNotes && v.creditNotes.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5 }}><b style={{ color: T.head }}>Credit notes against this bill: </b>
          {v.creditNotes.map(c => <span key={c.id} style={{ marginRight: 12 }}>{c.billNo || c.voucherNumber} ({fmtDate(c.date)}, {inr(c.totalAmount)})</span>)}
        </div>
      )}
    </Box>
  );
}
