// 04-Nov-2026: Accounts reports.
//   ReportView   - every register / balance report: period presets, filters, totals strip, sort by any column, group with
//                  sub-totals, filter rows, click a row to open its voucher or ledger, Excel and print
//                  05-Nov-2026: laid out like iCAFFE - banded headers, default grouping, company block on print / Excel
//   LedgerReport - iCAFFE's Ledger: one account, opening, every entry with the other side, running balance, month totals
// Backend: /api/accounts-hub/reports/:name, /api/accounts-hub/ledger-report
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Download, Printer, RefreshCw, ArrowUp, ArrowDown, ChevronRight, ChevronDown, FileText, BookUser } from 'lucide-react';
import { T, inr, fmtDate, todayIso, api, lookup, Box, Btn, ActionBar, Field, inputStyle, roStyle, Money, Badge, LedgerPicker, Empty } from './ui';
import { deskOf } from './CommandSearch';
import VoucherDrawer from './VoucherDrawer';

// ---- period presets (financial year April - March)
const iso = (d) => d.toISOString().slice(0, 10);
const fyStartOf = (d) => new Date(Date.UTC(d.getUTCMonth() < 3 ? d.getUTCFullYear() - 1 : d.getUTCFullYear(), 3, 1));
export const PRESETS = {
  thisMonth: ['This month', () => { const n = new Date(); return [iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1))), todayIso()]; }],
  lastMonth: ['Last month', () => { const n = new Date(); return [iso(new Date(Date.UTC(n.getFullYear(), n.getMonth() - 1, 1))), iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), 0)))]; }],
  thisQuarter: ['This quarter', () => { const n = new Date(); const q = Math.floor(((n.getMonth() + 9) % 12) / 3); const fs = fyStartOf(new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1))); return [iso(new Date(Date.UTC(fs.getUTCFullYear(), 3 + q * 3, 1))), todayIso()]; }],
  // 06-Nov-2026: the year picked in the top bar (to today while it is running)
  thisFy: ['This financial year', () => { const c = window.__acctx || {}; if (c.fyStart && c.fyEnd) { const e = String(c.fyEnd).slice(0, 10); return [String(c.fyStart).slice(0, 10), e < todayIso() ? e : todayIso()]; } return [iso(fyStartOf(new Date())), todayIso()]; }],
  lastFy: ['Last financial year', () => { const c = window.__acctx || {}; const s = c.fyStart ? new Date(String(c.fyStart).slice(0, 10) + 'T00:00:00Z') : fyStartOf(new Date()); return [iso(new Date(Date.UTC(s.getUTCFullYear() - 1, 3, 1))), iso(new Date(Date.UTC(s.getUTCFullYear(), 2, 31)))]; }],
};
export function PeriodPicker({ from, to, onChange }) {
  const [preset, setPreset] = useState('thisFy');
  return (
    <>
      <Field label="Period"><select style={inputStyle} value={preset} onChange={e => { setPreset(e.target.value); if (PRESETS[e.target.value]) { const [f, t] = PRESETS[e.target.value][1](); onChange(f, t); } }}>
        {Object.entries(PRESETS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}<option value="custom">Custom dates</option></select></Field>
      <Field label="From Date"><input type="date" style={inputStyle} value={from} onChange={e => { setPreset('custom'); onChange(e.target.value, to); }} /></Field>
      <Field label="To Date"><input type="date" style={inputStyle} value={to} onChange={e => { setPreset('custom'); onChange(from, e.target.value); }} /></Field>
    </>
  );
}
const exportCsv = (name, cols, rows) => {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [cols.map(c => esc(c.label)).join(',')].concat(rows.map(r => cols.map(c => esc(c.type === 'date' ? fmtDate(r[c.key]) : r[c.key])).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' })); a.download = name.replace(/[^\w]+/g, '_') + '.csv'; a.click();
};
const isNum = (c) => ['money', 'int'].includes(c.type);
const thStyle = { position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc', cursor: 'pointer', userSelect: 'none' };
// 05-Nov-2026: iCAFFE prints and exports every report under the company block - name, address, report title, scope, period
let headPromise = null;
const companyHead = () => (headPromise = headPromise || api('/api/accounts-hub/company-head').catch(() => { headPromise = null; return { name: '', address: '' }; }));
// header rows: a band row for columns that carry a group (Closing Balance > Debit / Credit), like iCAFFE
const bands = (cols) => { const out = []; for (const c of cols) { const g = c.group || ''; const last = out[out.length - 1]; if (last && last.g === g && g) last.n++; else out.push({ g, n: 1, c }); } return out; };
const hasBands = (cols) => cols.some(c => c.group);
const plain = (c, v) => (c.type === 'money' ? inr(v) : c.type === 'date' ? fmtDate(v) : (v ?? ''));
const escH = (v) => String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const periodText = (data, filters, p) => (filters.includes('from') && data.from ? 'From ' + fmtDate(data.from) + ' To ' + fmtDate(data.to) : filters.includes('asOn') ? 'As On ' + fmtDate(p.asOn) : '');
async function printReport({ title, subtitle, period, scope, cols, groups, rows, totals, totalKeys, note }) {
  const h = await companyHead();
  const td = (c, v, b) => `<td style="text-align:${isNum(c) ? 'right' : 'left'};${b ? 'font-weight:700' : ''}">${escH(plain(c, v))}</td>`;
  const tot = (t, label) => cols.map((c, i) => (i === 0 ? `<td style="font-weight:700">${escH(label)}</td>` : totalKeys.includes(c.key) ? td(c, t[c.key], true) : '<td></td>')).join('');
  const head = (hasBands(cols) ? '<tr>' + bands(cols).map(b => (b.g ? `<th colspan="${b.n}">${escH(b.g)}</th>` : `<th rowspan="2">${escH(b.c.label)}</th>`)).join('') + '</tr><tr>' + cols.filter(c => c.group).map(c => `<th>${escH(c.label)}</th>`).join('') + '</tr>'
    : '<tr>' + cols.map(c => `<th>${escH(c.label)}</th>`).join('') + '</tr>');
  let body = '';
  if (groups) for (const g of groups) body += `<tr class="g"><td colspan="${cols.length}">${escH(g.k)}</td></tr>` + g.list.map(r => '<tr>' + cols.map(c => td(c, r[c.key])).join('') + '</tr>').join('') + (totalKeys.length ? `<tr class="st">${tot(g.t, 'Total')}</tr>` : '');
  else body = rows.map(r => '<tr>' + cols.map(c => td(c, r[c.key])).join('') + '</tr>').join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escH(title)}</title><style>
    @page { size: ${cols.length > 9 ? 'A4 landscape' : 'A4'}; margin: 10mm }
    body { font-family: Arial, Helvetica, sans-serif; font-size: ${cols.length > 16 ? 8 : 10}px; color: #000 }
    .co { text-align: center; font-size: 15px; font-weight: 700 } .ad { text-align: center; font-size: 10px; margin-top: 2px } .ti { text-align: center; font-size: 12px; font-weight: 700; margin: 8px 0 2px; text-decoration: underline }
    .meta { display: flex; justify-content: space-between; font-size: 10px; margin: 6px 0 } table { border-collapse: collapse; width: 100% }
    th, td { border: 1px solid #555; padding: 2px 4px; vertical-align: top } th { background: #e9eef3 } tr.g td { font-weight: 700; background: #f4f6f8 } tr.st td, tfoot td { font-weight: 700; border-top: 1.5px solid #000 }
    .note { font-size: 9px; margin-top: 6px; color: #333 }</style></head><body>
    <div class="co">${escH(h.name)}</div>${h.address ? `<div class="ad">${escH(h.address)}</div>` : ''}${h.contact ? `<div class="ad">${escH(h.contact)}</div>` : ''}${h.gstin ? `<div class="ad">GSTIN: ${escH(h.gstin)}</div>` : ''}
    <div class="ti">${escH(subtitle || title)}</div>
    <div class="meta"><span>Scope : ${escH(scope)}</span><span>${escH(period)}</span><span>Printed on ${fmtDate(new Date().toISOString())}</span></div>
    <table><thead>${head}</thead><tbody>${body}</tbody>${totalKeys.length ? `<tfoot><tr>${tot(totals, 'Grand Total')}</tr></tfoot>` : ''}</table>
    ${note ? `<div class="note">${escH(note)}</div>` : ''}</body></html>`;
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* ignore */ } setTimeout(() => f.remove(), 1500); }, 250);
}
// real Excel: company block, title, period, the two header rows, rows (with group headings and sub-totals), grand total
async function excelReport({ title, subtitle, period, scope, cols, groups, rows, totals, totalKeys }) {
  const [XLSX, h] = await Promise.all([import('xlsx'), companyHead()]);
  const val = (c, v) => (c.type === 'money' || c.type === 'int' ? (v === '' || v == null ? '' : Number(v) || 0) : c.type === 'date' ? fmtDate(v) : (v ?? ''));
  const aoa = [[h.name], [h.address || ''], [subtitle || title], ['Scope : ' + scope + '    ' + period], []];
  const merges = [0, 1, 2, 3].map(r => ({ s: { r, c: 0 }, e: { r, c: Math.max(0, cols.length - 1) } }));
  if (hasBands(cols)) {
    const r1 = [], r2 = []; let ci = 0; const top = aoa.length;
    for (const b of bands(cols)) { if (b.g) { r1.push(b.g, ...Array(b.n - 1).fill('')); merges.push({ s: { r: top, c: ci }, e: { r: top, c: ci + b.n - 1 } }); cols.slice(ci, ci + b.n).forEach(c => r2.push(c.label)); } else { r1.push(b.c.label); r2.push(''); merges.push({ s: { r: top, c: ci }, e: { r: top + 1, c: ci } }); } ci += b.n; }
    aoa.push(r1, r2);
  } else aoa.push(cols.map(c => c.label));
  const tot = (t, label) => cols.map((c, i) => (i === 0 ? label : totalKeys.includes(c.key) ? Number(t[c.key]) || 0 : ''));
  if (groups) for (const g of groups) { aoa.push([g.k]); g.list.forEach(r => aoa.push(cols.map(c => val(c, r[c.key])))); if (totalKeys.length) aoa.push(tot(g.t, 'Total')); }
  else rows.forEach(r => aoa.push(cols.map(c => val(c, r[c.key]))));
  if (totalKeys.length) aoa.push(tot(totals, 'Grand Total'));
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!merges'] = merges;
  ws['!cols'] = cols.map(c => ({ wch: Math.min(40, Math.max(10, String(c.label).length + 2, c.type === 'money' ? 14 : 0)) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, String(title).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31));
  XLSX.writeFile(wb, String(title).replace(/[^\w]+/g, '_') + '.xlsx');
}

// ================================================================== generic report
const BILL_TYPES = [['', 'All'], ['invoice', 'Invoice'], ['creditnote', 'Credit Note']];
export function ReportView({ item }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const filters = item.filters || ['from', 'to'];
  const [fy0] = useState(() => PRESETS.thisFy[1]());
  const [p, setP] = useState({ from: fy0[0], to: fy0[1], asOn: todayIso(), partyType: '', jobNo: params.get('jobNo') || '', groupId: '', ledgerId: '', fyId: '',
    party: '', search: '', billType: '', cn: false, rtype: 'unbilled', vtype: 'all', detail: false, r1: 30, r2: 30, r3: 30, r4: 30, r5: 30 });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [groupBy, setGroupBy] = useState('');
  const [more, setMore] = useState(1); // 08-Nov-2026: rows shown = a cell budget (wide reports) x more
  const [closed, setClosed] = useState({});
  const [look, setLook] = useState({ ledgers: [], groups: [], years: [] });
  useEffect(() => {
    Promise.all([filters.includes('ledger') ? lookup('ledgers') : [], filters.includes('group') ? lookup('groups') : [], filters.includes('fy') ? lookup('years') : []])
      .then(([ledgers, groups, years]) => setLook({ ledgers, groups, years }));
  }, [item.id]);
  const run = async (all) => {
    if (filters.includes('ledger') && !p.ledgerId) { setErr('Choose the account'); return; }
    setBusy(true); setErr('');
    const qs = new URLSearchParams({ ...(item.extra || {}) });
    const on = (k) => filters.includes(k);
    if (on('from')) qs.set('from', p.from); if (on('to')) qs.set('to', p.to);
    if (on('asOn')) qs.set('asOn', p.asOn); if (on('partyType') && p.partyType) qs.set('type', p.partyType);
    if (on('jobNo') && p.jobNo) qs.set('jobNo', p.jobNo); if (on('group') && p.groupId) qs.set('groupId', p.groupId);
    if (on('ledger') && p.ledgerId) qs.set('ledgerId', p.ledgerId); if (on('fy') && p.fyId) qs.set('fyId', p.fyId);
    if (on('party') && p.party.trim()) qs.set('party', p.party.trim()); if (on('billType') && p.billType) qs.set('billType', p.billType);
    // 09-Nov-2026: search on the server (Purchase Register loads only the latest 100 bills until you search or ask for all)
    if (on('search') && p.search.trim()) qs.set('q', p.search.trim()); if (all === true) qs.set('all', '1');
    if (on('cn') && p.cn) qs.set('cn', '1'); if (on('rtype')) qs.set('rtype', p.rtype); if (on('vtype')) qs.set('vtype', p.vtype);
    if (on('buckets')) { [1, 2, 3, 4, 5].forEach(i => qs.set('r' + i, String(p['r' + i] || 30))); if (p.detail) qs.set('detail', '1'); }
    try { const d = await api('/api/accounts-hub/reports/' + item.report + '?' + qs.toString()); setData(d); setClosed({}); setGroupBy(d.groupBy || ''); setSort({ key: null, dir: 1 }); }
    catch (e) { setErr(e.message); setData(null); }
    setBusy(false);
  };
  useEffect(() => { if (!filters.includes('ledger')) run(); }, [item.id]);
  useEffect(() => { setMore(1); }, [data]);
  const cols = data ? data.columns : [];
  // the grouped column shows as the heading of each block, not again on every row
  const shown = groupBy ? cols.filter(c => c.key !== groupBy) : cols;
  const textCols = cols.filter(c => (c.type === 'text' || c.key === groupBy) && !['narration'].includes(c.key));
  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.rows.filter(x => !q || cols.some(c => String(x[c.key] ?? '').toLowerCase().includes(q.toLowerCase())));
    if (sort.key) { const c = cols.find(x => x.key === sort.key); r = [...r].sort((a, b) => { const va = a[sort.key], vb = b[sort.key]; const d = c && isNum(c) ? (Number(va) || 0) - (Number(vb) || 0) : String(va ?? '').localeCompare(String(vb ?? '')); return d * sort.dir; }); }
    return r;
  }, [data, q, sort]);
  const totalKeys = data && data.totals ? data.totals : [];
  const totalsOf = (list) => { const t = {}; for (const k of totalKeys) t[k] = list.reduce((s, r) => s + (Number(r[k]) || 0), 0); return t; };
  const totals = useMemo(() => totalsOf(rows), [rows]);
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const m = new Map(); for (const r of rows) { const k = String(r[groupBy] ?? '') || '(blank)'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return [...m.entries()].map(([k, list]) => ({ k, list, t: totalsOf(list) }));
  }, [rows, groupBy]);
  const cell = (c, v) => plain(c, v);
  // 08-Nov-2026: a GST invoice (_k = its kind) opens on the GST Invoice desk, any other voucher on its voucher screen
  // 09-Nov-2026: a voucher row opens the Voucher Details side panel (Open voucher there goes to the GST Invoice / voucher desk)
  const [vd, setVd] = useState(null);
  const drill = (r) => { if (r._v) setVd(r._v); else if (r._l) nav('/accounts-hub?item=ledger&ledger=' + r._l); };
  const canDrill = rows.some(r => r._v || r._l);
  const scope = item.scope || 'All Branches';
  const outArgs = () => ({ title: item.label, subtitle: data.subtitle || item.label, period: periodText(data, filters, p), scope, cols: shown, groups, rows, totals, totalKeys, note: data.note });
  const Row = ({ r, i }) => (
    <tr className={r._v || r._l ? 'table-row-hover' : ''} onClick={() => drill(r)} style={{ borderTop: '1px solid #f1f5f9', background: r._v && String(r._v) === String(vd) ? T.headBg : i % 2 ? '#fbfdff' : '#fff' }}>
      {shown.map(c => <td key={c.key} style={{ textAlign: isNum(c) ? 'right' : 'left', whiteSpace: c.type === 'money' || c.type === 'date' ? 'nowrap' : 'normal', fontVariantNumeric: 'tabular-nums' }}>{cell(c, r[c.key])}</td>)}
    </tr>
  );
  const totalCells = (t, label) => shown.map((c, i) => <td key={c.key} style={{ textAlign: isNum(c) ? 'right' : 'left', whiteSpace: 'nowrap', fontWeight: 800 }}>{i === 0 ? label : totalKeys.includes(c.key) ? (c.type === 'money' ? inr(t[c.key]) : t[c.key]) : ''}</td>);
  const moneyTotals = totalKeys.map(k => cols.find(c => c.key === k)).filter(Boolean).slice(0, 8);
  const sortTh = (c, extra) => (
    <th key={c.key} {...extra} onClick={() => setSort(s => ({ key: c.key, dir: s.key === c.key ? -s.dir : (isNum(c) ? -1 : 1) }))} style={{ ...thStyle, top: extra && extra.top != null ? extra.top : 0, textAlign: isNum(c) ? 'right' : 'left', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{c.label}{sort.key === c.key && (sort.dir > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}</span>
    </th>);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const cap = Math.min(rows.length, Math.max(100, Math.min(1000, Math.floor(150000 / Math.max(1, shown.length)))) * more);
  const printSafe = () => { if (rows.length * Math.max(1, shown.length) > 400000) { setErr('This report is too big to print (' + rows.length + ' rows x ' + shown.length + ' columns) - use Excel, or narrow the period / party'); return; } printReport(outArgs()); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Box title={item.label} right={<span style={{ fontWeight: 600, color: T.muted, fontSize: 10.5 }}>{item.desc}</span>} style={{ background: '#fff' }} bodyStyle={{ paddingBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
          {filters.includes('from') && <PeriodPicker from={p.from} to={p.to} onChange={(f, t) => setP({ ...p, from: f, to: t })} />}
          {filters.includes('asOn') && <Field label="As On"><input type="date" style={inputStyle} value={p.asOn} onChange={set('asOn')} /></Field>}
          {filters.includes('partyType') && <Field label="Account Type"><select style={inputStyle} value={p.partyType} onChange={set('partyType')}><option value="">Both</option><option value="debtors">Debtors</option><option value="creditors">Creditors</option></select></Field>}
          {filters.includes('billType') && <Field label="Type"><select style={inputStyle} value={p.billType} onChange={set('billType')}>{BILL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
          {filters.includes('search') && <Field label="Search" span={2}><input style={inputStyle} value={p.search} onChange={set('search')} onKeyDown={e => { if (e.key === 'Enter') run(); }} placeholder="Voucher, invoice no, party, docket, MAWB / HAWB, narration or amount" /></Field>}
          {filters.includes('party') && <Field label="Party Name" span={2}><input style={inputStyle} value={p.party} onChange={set('party')} placeholder="All parties" /></Field>}
          {filters.includes('jobNo') && <Field label="Docket No"><input style={inputStyle} value={p.jobNo} onChange={set('jobNo')} placeholder="All dockets" /></Field>}
          {filters.includes('cn') && <Field label="Credit Note"><label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, margin: 0, cursor: 'pointer' }}><input type="checkbox" checked={p.cn} onChange={set('cn')} /> Credit notes only</label></Field>}
          {filters.includes('rtype') && <Field label="Report Type"><select style={inputStyle} value={p.rtype} onChange={set('rtype')}><option value="unbilled">UNBILLED</option><option value="short">BILLED / SHORT</option></select></Field>}
          {filters.includes('vtype') && <Field label="Type"><select style={inputStyle} value={p.vtype} onChange={set('vtype')}><option value="all">All</option><option value="bank">Bank</option><option value="cash">Cash</option><option value="journal">Journal</option></select></Field>}
          {filters.includes('buckets') && <Field label="Interval In Days (R1 - R5)" span={2}><div style={{ display: 'flex', gap: 4 }}>{[1, 2, 3, 4, 5].map(i => <input key={i} type="number" min="1" style={{ ...inputStyle, width: '20%', textAlign: 'right' }} value={p['r' + i]} onChange={set('r' + i)} title={'R' + i} />)}</div></Field>}
          {filters.includes('buckets') && <Field label="Report"><select style={inputStyle} value={p.detail ? '1' : ''} onChange={e => setP({ ...p, detail: e.target.value === '1' })}><option value="">Summary</option><option value="1">Detailed (bill wise)</option></select></Field>}
          {filters.includes('group') && <Field label="Group" span={2}><select style={inputStyle} value={p.groupId} onChange={set('groupId')}><option value="">All groups</option>{look.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>}
          {filters.includes('fy') && <Field label="Financial Year"><select style={inputStyle} value={p.fyId} onChange={set('fyId')}><option value="">Current</option>{look.years.map(y => <option key={y.id} value={y.id}>{y.name || y.code}</option>)}</select></Field>}
          {filters.includes('ledger') && <Field label="Account Name" required span={2}><LedgerPicker id="repl" list={look.ledgers} value={p.ledgerId} onChange={v => setP({ ...p, ledgerId: v })} mandatory /></Field>}
        </div>
      </Box>
      <ActionBar note={err}>
        <Btn kind="primary" onClick={() => run()} disabled={busy}><RefreshCw size={13} /> {busy ? 'Loading' : 'Show'}</Btn>
        <Btn kind="save" onClick={() => excelReport(outArgs()).catch(e => setErr('Excel not made: ' + e.message))} disabled={!rows.length}><Download size={13} /> Excel</Btn>
        <Btn kind="plain" onClick={printSafe} disabled={!data}><Printer size={13} /> Print</Btn>
        <Btn kind="ghost" onClick={() => exportCsv(item.label, cols, rows)} disabled={!rows.length} title="Plain CSV of the rows"><FileText size={12} /> CSV</Btn>
        {data && <>
          <span style={{ width: 1, height: 22, background: T.headBorder, margin: '0 4px' }} />
          <div style={{ position: 'relative' }}><Search size={12} style={{ position: 'absolute', left: 7, top: 8, color: T.muted }} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter rows" style={{ ...inputStyle, width: 190, paddingLeft: 24 }} /></div>
          {textCols.length > 0 && <select style={{ ...inputStyle, width: 170 }} value={groupBy} onChange={e => { setGroupBy(e.target.value); setClosed({}); }}><option value="">No grouping</option>{textCols.map(c => <option key={c.key} value={c.key}>Group by {c.label}</option>)}</select>}
          {canDrill && <span style={{ marginLeft: 'auto', fontSize: 11, color: T.muted }}>Click a row to open it</span>}
        </>}
      </ActionBar>
      {data && data.limited && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: T.amberBg, border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
          <span>Latest <b>{data.limited.shown}</b> of <b>{Number(data.limited.total).toLocaleString('en-IN')}</b> bills in this period are shown. Search above (voucher, invoice no, party, docket, amount) to find any other bill.</span>
          <Btn small kind="clear" onClick={() => run(true)} disabled={busy}>Load all {Number(data.limited.total).toLocaleString('en-IN')}</Btn>
        </div>
      )}
      {data && moneyTotals.length > 0 && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: '10px 16px' }}>
          <div><div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>Rows</div><div style={{ fontSize: 16, fontWeight: 800 }}>{rows.length}</div></div>
          {moneyTotals.map(c => <div key={c.key}><div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>{c.group && c.label.length < 8 ? c.group + ' ' : ''}{c.label}</div><div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{c.type === 'money' ? inr(totals[c.key]) : totals[c.key]}</div></div>)}
          <div style={{ marginLeft: 'auto', fontSize: 11, color: T.muted, alignSelf: 'center' }}>{periodText(data, filters, p)}</div>
        </div>
      )}
      {data && (
        <Box title={(data.title ? data.title + ' - ' : '') + (data.subtitle || item.label)} right={data.note ? <span style={{ fontWeight: 600, color: T.muted, fontSize: 10.5 }}>{data.note}</span> : null} pad={0} style={{ background: '#fff' }}>
          <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                {hasBands(shown) ? <>
                  <tr>{bands(shown).map((b, i) => (b.g ? <th key={'b' + i} colSpan={b.n} style={{ ...thStyle, cursor: 'default', textAlign: 'center', borderBottom: `1px solid ${T.headBorder}`, color: T.head }}>{b.g}</th> : sortTh(b.c, { rowSpan: 2 })))}</tr>
                  <tr>{shown.filter(c => c.group).map(c => sortTh(c, { top: 24 }))}</tr>
                </> : <tr>{shown.map(c => sortTh(c))}</tr>}
              </thead>
              <tbody>
                {!groups && rows.slice(0, cap).map((r, i) => <Row key={i} r={r} i={i} />)}
                {groups && groups.map(g => (
                  <React.Fragment key={g.k}>
                    <tr onClick={() => setClosed(c => ({ ...c, [g.k]: !c[g.k] }))} style={{ background: T.headBg, cursor: 'pointer', borderTop: `1px solid ${T.headBorder}` }}>
                      {shown.map((c, i) => <td key={c.key} style={{ textAlign: isNum(c) ? 'right' : 'left', fontWeight: 800, color: T.head, whiteSpace: 'nowrap' }}>
                        {i === 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{closed[g.k] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}{g.k} ({g.list.length})</span>
                          : totalKeys.includes(c.key) ? (c.type === 'money' ? inr(g.t[c.key]) : g.t[c.key]) : ''}</td>)}
                    </tr>
                    {!closed[g.k] && g.list.slice(0, cap).map((r, i) => <Row key={i} r={r} i={i} />)}
                  </React.Fragment>
                ))}
                {!rows.length && <tr><td colSpan={shown.length || 1} style={{ textAlign: 'center', color: T.muted, padding: 28 }}>{data.rows.length ? 'No row matches the filter' : 'No entries for this period'}</td></tr>}
              </tbody>
              {rows.length > 0 && totalKeys.length > 0 && <tfoot style={{ position: 'sticky', bottom: 0 }}><tr style={{ background: T.headBg, borderTop: `2px solid ${T.headBorder}` }}>{totalCells(totals, 'Grand Total (' + rows.length + ')')}</tr></tfoot>}
            </table>
            {rows.length > cap && !groups && <div style={{ padding: 8, fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 10 }}>Showing {cap.toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')} rows - totals are for all rows; Excel has all of them.<Btn kind="ghost" onClick={() => setMore(m => m + 1)}>Show more</Btn></div>}
          </div>
        </Box>
      )}
      {vd && <VoucherDrawer id={vd} ids={(groups ? groups.flatMap(g => (closed[g.k] ? [] : g.list)) : rows.slice(0, cap)).map(r => r._v)} onMove={setVd} onClose={() => setVd(null)} />}
    </div>
  );
}

// ================================================================== LEDGER
const signed = (v) => (v ? inr(Math.abs(v)) + (v < 0 ? ' Cr' : ' Dr') : '0.00');
export function LedgerReport() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [ledgers, setLedgers] = useState([]);
  const [fy0] = useState(() => PRESETS.thisFy[1]());
  const [p, setP] = useState({ ledgerId: params.get('ledger') || '', from: fy0[0], to: fy0[1] });
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [showNarr, setShowNarr] = useState(true);
  const [q, setQ] = useState('');
  const [vd, setVd] = useState(null); // 09-Nov-2026: Voucher Details side panel
  useEffect(() => { lookup('ledgers').then(setLedgers); }, []);
  const run = async (pp = p) => {
    if (!pp.ledgerId) { setErr('Choose the account'); return; }
    setBusy(true); setErr('');
    try { setD(await api(`/api/accounts-hub/ledger-report?ledgerId=${pp.ledgerId}&from=${pp.from}&to=${pp.to}`)); const s = new URLSearchParams(params); s.set('ledger', pp.ledgerId); setParams(s); }
    catch (e) { setErr(e.message); setD(null); }
    setBusy(false);
  };
  useEffect(() => { if (p.ledgerId) run(); }, []);
  const rows = d ? d.rows.filter(r => !q || [r.voucherNumber, r.contra, r.refNo, r.jobNo, r.narration, r.typeName].some(v => String(v || '').toLowerCase().includes(q.toLowerCase()))) : [];
  const months = useMemo(() => { const m = new Map(); for (const r of rows) { const k = String(r.date).slice(0, 7); const x = m.get(k) || { dr: 0, cr: 0, n: 0, last: 0 }; x.dr += r.debit; x.cr += r.credit; x.n++; x.last = r.balance; m.set(k, x); } return m; }, [rows]);
  const out = [];
  if (d) {
    let prev = null;
    rows.forEach((r, i) => {
      const k = String(r.date).slice(0, 7);
      if (monthly && prev && prev !== k) out.push({ month: prev });
      out.push(r); prev = k;
      if (monthly && i === rows.length - 1) out.push({ month: k });
    });
  }
  const mName = (k) => new Date(k + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const xl = () => exportCsv('Ledger_' + d.ledger.name, [{ key: 'date', label: 'Date', type: 'date' }, { key: 'typeName', label: 'Type' }, { key: 'voucherNumber', label: 'Voucher No' }, { key: 'contra', label: 'Particulars' }, { key: 'refNo', label: 'Ref / Chq' }, { key: 'jobNo', label: 'Job' }, { key: 'narration', label: 'Narration' }, { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' }, { key: 'balance', label: 'Balance' }],
    [{ date: d.from, contra: 'Opening balance', balance: d.opening }, ...rows, { date: d.to, contra: 'Closing balance', debit: d.debit, credit: d.credit, balance: d.closing }]);
  const stat = (label, value, color) => <div><div style={{ fontSize: 10, fontWeight: 800, color: T.muted, textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: 15, fontWeight: 800, color: color || '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{value}</div></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Box title="Ledger" right={<span style={{ fontWeight: 600, color: T.muted, fontSize: 10.5 }}>Statement of one account with running balance</span>} style={{ background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) repeat(3, minmax(0, 1fr))', gap: 10, alignItems: 'end' }}>
          <Field label="Account Name" required><LedgerPicker id="ledrep" list={ledgers} value={p.ledgerId} onChange={v => { const n = { ...p, ledgerId: v }; setP(n); if (v) run(n); }} mandatory /></Field>
          <PeriodPicker from={p.from} to={p.to} onChange={(f, t) => setP({ ...p, from: f, to: t })} />
        </div>
      </Box>
      <ActionBar note={err}>
        <Btn kind="primary" onClick={() => run()} disabled={busy}><RefreshCw size={13} /> {busy ? 'Loading' : 'Show'}</Btn>
        <Btn kind="save" onClick={xl} disabled={!d}><Download size={13} /> Excel</Btn>
        <Btn kind="plain" onClick={() => window.print()} disabled={!d}><Printer size={13} /> Print</Btn>
        {d && <>
          <span style={{ width: 1, height: 22, background: T.headBorder, margin: '0 4px' }} />
          <div style={{ position: 'relative' }}><Search size={12} style={{ position: 'absolute', left: 7, top: 8, color: T.muted }} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Voucher, party, ref, job" style={{ ...inputStyle, width: 200, paddingLeft: 24 }} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0, cursor: 'pointer' }}><input type="checkbox" checked={monthly} onChange={e => setMonthly(e.target.checked)} /> Month totals</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0, cursor: 'pointer' }}><input type="checkbox" checked={showNarr} onChange={e => setShowNarr(e.target.checked)} /> Narration</label>
          <Btn kind="ghost" onClick={() => nav('/accounts-hub?item=ledgers&ledger=' + d.ledger.id)}><BookUser size={12} /> Account master</Btn>
        </>}
      </ActionBar>
      {!d && !busy && <Empty title="Choose an account to see its ledger">Type the name in Account Name; the statement opens for the period chosen.</Empty>}
      {d && (
        <>
          <div style={{ background: '#fff', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{d.ledger.name}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{[d.ledger.groupName, d.ledger.gstin, d.ledger.state].filter(Boolean).join(' | ')}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{fmtDate(d.from)} to {fmtDate(d.to)}</div>
            </div>
            {stat('Opening', signed(d.opening))}
            {stat('Debit', inr(d.debit), T.dr)}
            {stat('Credit', inr(d.credit), T.cr)}
            {stat('Closing', signed(d.closing), d.closing < 0 ? T.cr : d.closing > 0 ? T.dr : null)}
            {stat('Entries', rows.length)}
          </div>
          <Box pad={0} style={{ background: '#fff' }}>
            <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 430px)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Date', 'Voucher', 'Particulars', 'Ref / Chq', 'Job', 'Debit', 'Credit', 'Balance'].map((h, i) => <th key={h} style={{ ...thStyle, cursor: 'default', textAlign: i >= 5 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  <tr style={{ background: '#f8fafc' }}><td>{fmtDate(d.from)}</td><td /><td style={{ fontWeight: 800 }}>Opening balance</td><td /><td /><td style={{ textAlign: 'right' }}>{d.opening > 0 ? inr(d.opening) : ''}</td><td style={{ textAlign: 'right' }}>{d.opening < 0 ? inr(-d.opening) : ''}</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{signed(d.opening)}</td></tr>
                  {out.map((r, i) => r.month ? (
                    <tr key={'m' + i} style={{ background: T.headBg }}>
                      <td colSpan={5} style={{ fontWeight: 800, color: T.head }}>{mName(r.month)} - {months.get(r.month).n} entries</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{inr(months.get(r.month).dr)}</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{inr(months.get(r.month).cr)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{signed(months.get(r.month).last)}</td>
                    </tr>
                  ) : (
                    <tr key={i} className="table-row-hover" onClick={() => setVd(r.id)} title="Show this voucher's details" style={{ borderTop: '1px solid #f1f5f9', background: String(vd) === String(r.id) ? T.headBg : undefined }}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><b style={{ color: T.head }}>{r.voucherNumber}</b><div style={{ fontSize: 10, color: T.muted }}>{r.typeName}{r.status && !/approv/i.test(r.status) ? ' - ' + r.status : ''}</div></td>
                      <td style={{ maxWidth: 420 }}><div style={{ fontWeight: 600 }}>{r.dc === 'Cr' ? 'By ' : 'To '}{r.contra || '-'}</div>{showNarr && (r.narration || r.remarks) && <div style={{ fontSize: 10.5, color: T.muted }}>{[r.narration, r.remarks].filter(Boolean).join(' - ')}</div>}{r.currency && r.currency !== 'INR' && r.amountFcy ? <div style={{ fontSize: 10, color: T.muted }}>{r.currency} {inr(r.amountFcy)}</div> : null}</td>
                      <td>{r.refNo || ''}</td>
                      <td>{r.jobNo || ''}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.debit ? <Money v={r.debit} side="Dr" /> : ''}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.credit ? <Money v={r.credit} side="Cr" /> : ''}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{signed(r.balance)}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: T.muted, padding: 22 }}>No entries in this period</td></tr>}
                </tbody>
                <tfoot style={{ position: 'sticky', bottom: 0 }}><tr style={{ background: T.headBg, borderTop: `2px solid ${T.headBorder}` }}>
                  <td>{fmtDate(d.to)}</td><td /><td style={{ fontWeight: 800 }}>Closing balance</td><td /><td />
                  <td style={{ textAlign: 'right', fontWeight: 800 }}>{inr(d.debit)}</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{inr(d.credit)}</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{signed(d.closing)}</td>
                </tr></tfoot>
              </table>
            </div>
          </Box>
        </>
      )}
      {vd && <VoucherDrawer id={vd} ids={rows.map(r => r.id)} onMove={setVd} onClose={() => setVd(null)} />}
    </div>
  );
}
