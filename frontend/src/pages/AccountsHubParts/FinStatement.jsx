// 07-Nov-2026: Balance Sheet, Profit & Loss and Trial Balance on one engine (GET /api/accounts-hub/fin-statement).
// Every ledger's opening / period Dr-Cr / closing comes from the books in the branch + year scope of the top bar; the
// screen totals it per group. "Show" picks how deep the statement opens (main groups, all groups, groups + ledgers);
// any group can still be opened or closed by clicking it. Print and Excel give exactly what is open on the screen.
import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Download, FileText, ChevronRight, ChevronDown, RefreshCw, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { api, inputStyle } from './ui';

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const fmt = (v) => (Math.abs(v) < 0.005 ? '' : Math.abs(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtSigned = (v) => (Math.abs(v) < 0.005 ? '' : (v < 0 ? '-' : '') + fmt(v));
const dmy = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '');
const todayIso = () => new Date().toISOString().slice(0, 10);
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const LEVELS = [['1', 'Main groups'], ['2', 'Main + sub groups'], ['9', 'All groups'], ['L', 'Groups + ledgers']];
let headP = null;
const companyHead = () => (headP = headP || api('/api/accounts-hub/company-head').catch(() => { headP = null; return { name: '', address: '' }; }));
const scopeText = () => { const c = window.__acctx || {}; return (c.branch === 'ALL' || !c.branch ? 'All branches' : c.branch); };

const TITLES = { bs: ['Balance Sheet', 'Statement of assets and liabilities'], pl: ['Profit & Loss Account', 'Income and expenses of the period'], tb: ['Trial Balance', 'Opening, period and closing balance of every account'] };

// group tree with totals: node = { key, kind: 'g'|'l', id, name, depth, nature, op, dr, cr, cl, kids }
function buildTree(data) {
  const byId = new Map(data.groups.map(g => [g.id, { key: 'g' + g.id, kind: 'g', id: g.id, name: g.name, p: g.p, nature: g.n, op: 0, dr: 0, cr: 0, cl: 0, kids: [] }]));
  const roots = [];
  for (const g of byId.values()) { const par = g.p && byId.get(g.p); if (par) par.kids.push(g); else roots.push(g); }
  for (const l of data.ledgers) { const g = byId.get(l.g); if (g) g.kids.push({ key: 'l' + l.id, kind: 'l', id: l.id, name: l.name, op: l.op, dr: l.dr, cr: l.cr, cl: l.cl, kids: [] }); }
  const sum = (n, depth, nature) => {
    n.depth = depth; n.nature = n.nature || nature;
    if (n.kind === 'g') {
      n.op = n.dr = n.cr = n.cl = 0;
      for (const k of n.kids) { sum(k, depth + 1, n.nature); n.op += k.op; n.dr += k.dr; n.cr += k.cr; n.cl += k.cl; }
      n.op = r2(n.op); n.dr = r2(n.dr); n.cr = r2(n.cr); n.cl = r2(n.cl);
      n.kids = n.kids.filter(k => Math.abs(k.op) >= 0.005 || Math.abs(k.dr) >= 0.005 || Math.abs(k.cr) >= 0.005 || Math.abs(k.cl) >= 0.005);
      n.kids.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'g' ? -1 : 1));
    }
    return n;
  };
  return roots.map(r => sum(r, 0, r.nature)).filter(r => r.kids.length);
}
// keys that are open at a level
function openAt(roots, level) {
  const s = new Set();
  const walk = (n) => {
    if (n.kind !== 'g') return;
    const hasG = n.kids.some(k => k.kind === 'g');
    const o = level === 'L' ? n.kids.length > 0 : level === '9' ? hasG : hasG && n.depth < Number(level) - 1;
    if (o) s.add(n.key); n.kids.forEach(walk);
  };
  roots.forEach(walk);
  return s;
}
// rows as on screen
function visibleRows(nodes, open, value) {
  const out = [];
  const walk = (n) => { out.push({ n, v: value(n) }); if (open.has(n.key)) n.kids.forEach(walk); };
  nodes.forEach(walk);
  return out;
}

export default function FinStatement({ mode = 'bs' }) {
  const ctx = window.__acctx || {};
  const [from, setFrom] = useState(ctx.fyStart || '');
  const [to, setTo] = useState(() => { const e = ctx.fyEnd || ''; const t = todayIso(); return e && t > e ? e : t; });
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState('1'); const [open, setOpen] = useState(new Set());
  const [title, sub] = TITLES[mode];

  const load = () => {
    setBusy(true); setErr('');
    const qs = new URLSearchParams({ to }); if (mode !== 'bs' && from) qs.set('from', from); if (mode === 'bs' && ctx.fyStart) qs.set('from', ctx.fyStart);
    api('/api/accounts-hub/fin-statement?' + qs.toString()).then(d => { setData(d); if (!from) setFrom(d.from); }).catch(e => setErr(e.message)).finally(() => setBusy(false));
  };
  useEffect(() => { load(); }, [to, from]);
  const roots = useMemo(() => (data ? buildTree(data) : []), [data]);
  useEffect(() => { setOpen(openAt(roots, level)); }, [roots, level]);
  const toggle = (k) => setOpen(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const nat = (n) => roots.filter(r => r.nature === n);
  const total = (list, f) => r2(list.reduce((a, r) => a + f(r), 0));

  // ---- the three statements
  let sides = null, tb = null, pl = null;
  if (data && mode === 'bs') {
    const liab = nat('Liabilities'), asset = nat('Assets');
    const profit = r2(-(total(nat('Income'), r => r.cl) + total(nat('Expenses'), r => r.cl)));
    const L = total(liab, r => -r.cl), A = total(asset, r => r.cl);
    sides = { left: { label: 'Liabilities', nodes: liab, val: (n) => -n.cl, extra: profit >= 0 ? ['Profit & Loss A/c', profit] : null, total: r2(L + Math.max(profit, 0)) },
      right: { label: 'Assets', nodes: asset, val: (n) => n.cl, extra: profit < 0 ? ['Profit & Loss A/c (loss)', -profit] : null, total: r2(A + Math.max(-profit, 0)) } };
  }
  if (data && mode === 'pl') {
    const inc = nat('Income'), exp = nat('Expenses');
    const I = total(inc, r => r.cr - r.dr), E = total(exp, r => r.dr - r.cr), np = r2(I - E);
    pl = np;
    sides = { left: { label: 'Expenses', nodes: exp, val: (n) => n.dr - n.cr, extra: np >= 0 ? ['Net Profit', np] : null, total: r2(E + Math.max(np, 0)) },
      right: { label: 'Income', nodes: inc, val: (n) => n.cr - n.dr, extra: np < 0 ? ['Net Loss', -np] : null, total: r2(I + Math.max(-np, 0)) } };
  }
  if (data && mode === 'tb') {
    const all = [...nat('Liabilities'), ...nat('Assets'), ...nat('Income'), ...nat('Expenses')];
    tb = { nodes: all, rows: visibleRows(all, open, n => n),
      tot: { opDr: total(all, r => Math.max(r.op, 0)), opCr: total(all, r => Math.max(-r.op, 0)), dr: total(all, r => r.dr), cr: total(all, r => r.cr), clDr: total(all, r => Math.max(r.cl, 0)), clCr: total(all, r => Math.max(-r.cl, 0)) } };
  }
  // per-row Dr / Cr split for the TB (a group shows its net, like iCAFFE's consolidated trial balance)
  const split = (v) => [v > 0 ? v : 0, v < 0 ? -v : 0];

  const periodText = mode === 'bs' ? 'As on ' + dmy(to) : 'From ' + dmy(from) + ' To ' + dmy(to);

  // ---- print / excel: exactly the rows open on the screen
  const sideRows = (side) => [...visibleRows(side.nodes, open, side.val), ...(side.extra ? [{ extra: true, n: { name: side.extra[0], depth: 0, kind: 'g' }, v: side.extra[1] }] : [])];
  const doPrint = async () => {
    const h = await companyHead();
    const pad = (n) => 'padding-left:' + (4 + n.depth * 14) + 'px;' + (n.kind === 'g' ? 'font-weight:' + (n.depth === 0 ? 700 : 600) : 'color:#333');
    let body = '';
    if (sides) {
      const tbl = (side) => `<table><thead><tr><th>${esc(side.label)}</th><th style="width:120px">Amount</th></tr></thead><tbody>${sideRows(side).map(r => `<tr${r.extra ? ' class="x"' : ''}><td style="${pad(r.n)}">${esc(r.n.name)}</td><td class="n" style="${r.n.kind === 'g' && r.n.depth === 0 ? 'font-weight:700' : ''}">${fmtSigned(r.v)}</td></tr>`).join('')}</tbody><tfoot><tr><td>Total</td><td class="n">${fmt(side.total)}</td></tr></tfoot></table>`;
      body = `<div class="two"><div>${tbl(sides.left)}</div><div>${tbl(sides.right)}</div></div>`;
    } else if (tb) {
      body = `<table><thead><tr><th rowspan="2">Account</th><th colspan="2">Opening</th><th colspan="2">Transactions</th><th colspan="2">Closing</th></tr><tr><th>Debit</th><th>Credit</th><th>Debit</th><th>Credit</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${
        tb.rows.map(({ n }) => { const [od, oc] = split(n.op), [cd, cc] = split(n.cl); return `<tr><td style="${pad(n)}">${esc(n.name)}</td><td class="n">${fmt(od)}</td><td class="n">${fmt(oc)}</td><td class="n">${fmt(n.dr)}</td><td class="n">${fmt(n.cr)}</td><td class="n">${fmt(cd)}</td><td class="n">${fmt(cc)}</td></tr>`; }).join('')
      }</tbody><tfoot><tr><td>Grand Total</td>${['opDr', 'opCr', 'dr', 'cr', 'clDr', 'clCr'].map(k => `<td class="n">${fmt(tb.tot[k])}</td>`).join('')}</tr></tfoot></table>`;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      @page { size: ${mode === 'tb' ? 'A4 landscape' : 'A4'}; margin: 10mm } body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000 }
      .co { text-align: center; font-size: 15px; font-weight: 700 } .ad { text-align: center; font-size: 10px } .ti { text-align: center; font-size: 12px; font-weight: 700; margin: 8px 0 2px; text-decoration: underline }
      .meta { display: flex; justify-content: space-between; margin: 6px 0 } table { border-collapse: collapse; width: 100% } th, td { border: 1px solid #777; padding: 2px 4px } th { background: #e9eef3 }
      td.n { text-align: right; white-space: nowrap } tfoot td { font-weight: 700; border-top: 1.5px solid #000 } tr.x td { font-weight: 700 } .two { display: flex; gap: 8px; align-items: flex-start } .two > div { flex: 1 }
    </style></head><body><div class="co">${esc(h.name)}</div>${h.address ? `<div class="ad">${esc(h.address)}</div>` : ''}<div class="ti">${esc(title)}</div>
    <div class="meta"><span>Scope : ${esc(scopeText())}</span><span>${esc(periodText)}</span><span>Printed on ${dmy(todayIso())}</span></div>${body}</body></html>`;
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { /* ignore */ } setTimeout(() => f.remove(), 1500); }, 250);
  };
  const doExcel = async () => {
    const [XLSX, h] = await Promise.all([import('xlsx'), companyHead()]);
    const ind = (n) => '    '.repeat(n.depth || 0) + n.name;
    const num = (v) => (Math.abs(v) < 0.005 ? '' : r2(v));
    const aoa = [[h.name], [h.address || ''], [title], ['Scope : ' + scopeText() + '    ' + periodText], []];
    if (sides) {
      const L = sideRows(sides.left), R = sideRows(sides.right);
      aoa.push([sides.left.label, 'Amount', '', sides.right.label, 'Amount']);
      for (let i = 0; i < Math.max(L.length, R.length); i++) { const a = L[i], b = R[i]; aoa.push([a ? ind(a.n) : '', a ? num(a.v) : '', '', b ? ind(b.n) : '', b ? num(b.v) : '']); }
      aoa.push(['Total', r2(sides.left.total), '', 'Total', r2(sides.right.total)]);
    } else if (tb) {
      aoa.push(['Account', 'Opening Debit', 'Opening Credit', 'Debit', 'Credit', 'Closing Debit', 'Closing Credit']);
      tb.rows.forEach(({ n }) => { const [od, oc] = split(n.op), [cd, cc] = split(n.cl); aoa.push([ind(n), num(od), num(oc), num(n.dr), num(n.cr), num(cd), num(cc)]); });
      aoa.push(['Grand Total', ...['opDr', 'opCr', 'dr', 'cr', 'clDr', 'clCr'].map(k => r2(tb.tot[k]))]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = sides ? [{ wch: 50 }, { wch: 18 }, { wch: 3 }, { wch: 50 }, { wch: 18 }] : [{ wch: 50 }, ...Array(6).fill({ wch: 16 })];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, title.replace(/[^\w ]/g, '').slice(0, 31));
    XLSX.writeFile(wb, title.replace(/[^\w]+/g, '_') + '_' + to + '.xlsx');
  };

  // ---- screen
  const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' };
  const Row = ({ n, v, extra }) => {
    const isG = n.kind === 'g' && !extra; const can = isG && n.kids.length > 0; const isOpen = open.has(n.key);
    return (
      <div onClick={() => can && toggle(n.key)} className="table-row-hover" style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px', paddingLeft: 12 + (n.depth || 0) * 18, borderBottom: '1px solid #f1f5f9', cursor: can ? 'pointer' : 'default', background: extra ? '#f0fdf4' : n.depth === 0 && isG ? '#fafbfc' : 'transparent' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: extra || (isG && n.depth === 0) ? 800 : isG ? 600 : 400, color: extra ? '#15803d' : isG ? '#0f172a' : '#475569' }}>
          {can ? (isOpen ? <ChevronDown size={13} color="#0284c7" /> : <ChevronRight size={13} color="#0284c7" />) : <span style={{ width: 13 }} />}{n.name}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: extra || (isG && n.depth === 0) ? 800 : 600, color: v < 0 ? '#b91c1c' : '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{fmtSigned(v)}</span>
      </div>
    );
  };
  const Side = ({ s }) => (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#f1f5f9', padding: '8px 12px', fontWeight: 800, borderBottom: '1px solid #cbd5e1', fontSize: 12.5 }}>{s.label}</div>
      {visibleRows(s.nodes, open, s.val).map(r => <Row key={r.n.key} n={r.n} v={r.v} />)}
      {s.extra && <Row extra n={{ name: s.extra[0], depth: 0, kind: 'g', kids: [] }} v={s.extra[1]} />}
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#e2e8f0', borderTop: '2px solid #0f172a', fontWeight: 900, fontSize: 14 }}><span>Total</span><span>{fmt(s.total)}</span></div>
    </div>
  );
  const diff = sides ? r2(sides.left.total - sides.right.total) : 0;

  return (
    <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
      <style>{`.table-row-hover:hover { background: #f8fafc !important } @keyframes finspin { to { transform: rotate(360deg) } } .finspin { animation: finspin .8s linear infinite }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12, background: '#f8fafc', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ background: '#6366f1', padding: 8, borderRadius: 6, color: '#fff' }}><FileText size={20} /></div>
        <div style={{ marginRight: 'auto' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
          <span style={{ fontSize: 11, color: '#64748b' }}>{sub} - {scopeText()}{data && data.fy && data.fy.name ? ' | FY ' + data.fy.name : ''}</span>
        </div>
        {mode !== 'bs' && <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>From <input type="date" style={{ ...inputStyle, width: 140 }} value={from} onChange={e => setFrom(e.target.value)} /></label>}
        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{mode === 'bs' ? 'As on' : 'To'} <input type="date" style={{ ...inputStyle, width: 140 }} value={to} onChange={e => setTo(e.target.value)} /></label>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }} title="How deep the statement opens - Print and Excel give the same">Show{' '}
          <select style={{ ...inputStyle, width: 170 }} value={level} onChange={e => setLevel(e.target.value)}>{LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <button style={btn} onClick={() => setOpen(openAt(roots, 'L'))} title="Open every group and ledger"><ChevronsUpDown size={14} /> Expand all</button>
        <button style={btn} onClick={() => setOpen(new Set())} title="Close every group"><ChevronsDownUp size={14} /> Collapse all</button>
        <button style={btn} onClick={load} disabled={busy}><RefreshCw size={14} className={busy ? 'finspin' : ''} /> {busy ? 'Loading...' : 'Refresh'}</button>
        <button style={btn} onClick={doPrint} disabled={!data} title="Prints what is open on the screen"><Printer size={14} /> Print</button>
        <button style={btn} onClick={doExcel} disabled={!data} title="Excel of what is open on the screen"><Download size={14} /> Excel</button>
      </div>
      {err && <div style={{ padding: 10, color: '#b91c1c', fontWeight: 700 }}>Could not load: {err}</div>}
      {!data && !err && <div style={{ padding: 40, textAlign: 'center', color: '#6366f1', fontWeight: 700 }}><RefreshCw size={16} className="finspin" /> Loading {title}...</div>}
      {data && (
        <div style={{ border: '1px solid #94a3b8', borderRadius: 8, background: '#fff', overflow: 'hidden', opacity: busy ? 0.6 : 1 }}>
          <div style={{ padding: '14px 20px', borderBottom: '2px solid #0f172a', textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>{periodText} - {scopeText()}</div>
          </div>
          {sides && <div style={{ display: 'flex', minHeight: 300 }}><div style={{ flex: 1, display: 'flex', borderRight: '1px solid #e2e8f0' }}><Side s={sides.left} /></div><div style={{ flex: 1, display: 'flex' }}><Side s={sides.right} /></div></div>}
          {sides && Math.abs(diff) >= 1 && <div style={{ padding: '8px 14px', background: '#fef2f2', color: '#b91c1c', fontWeight: 700, fontSize: 12 }}>Difference of {fmt(diff)} - the books do not balance in this scope (with one branch picked, entries between branches and the company-wide opening can cause this; pick All branches).</div>}
          {tb && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ background: '#f1f5f9' }}><th rowSpan={2} style={{ textAlign: 'left', padding: 8 }}>Account</th><th colSpan={2}>Opening</th><th colSpan={2}>Transactions</th><th colSpan={2}>Closing</th></tr>
                  <tr style={{ background: '#f1f5f9' }}>{['Debit', 'Credit', 'Debit', 'Credit', 'Debit', 'Credit'].map((x, i) => <th key={i} style={{ textAlign: 'right', padding: '4px 8px' }}>{x}</th>)}</tr></thead>
                <tbody>{tb.rows.map(({ n }) => {
                  const [od, oc] = split(n.op), [cd, cc] = split(n.cl); const isG = n.kind === 'g'; const can = isG && n.kids.length;
                  return (<tr key={n.key} className="table-row-hover" onClick={() => can && toggle(n.key)} style={{ borderBottom: '1px solid #f1f5f9', cursor: can ? 'pointer' : 'default' }}>
                    <td style={{ padding: '4px 8px', paddingLeft: 8 + n.depth * 18, fontWeight: isG ? (n.depth === 0 ? 800 : 600) : 400 }}>{can ? (open.has(n.key) ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : null} {n.name}</td>
                    {[od, oc, n.dr, n.cr, cd, cc].map((v, i) => <td key={i} style={{ textAlign: 'right', padding: '4px 8px', fontVariantNumeric: 'tabular-nums', fontWeight: isG && n.depth === 0 ? 700 : 400 }}>{fmt(v)}</td>)}
                  </tr>);
                })}</tbody>
                <tfoot><tr style={{ background: '#e2e8f0', fontWeight: 900, borderTop: '2px solid #0f172a' }}><td style={{ padding: 8 }}>Grand Total</td>{['opDr', 'opCr', 'dr', 'cr', 'clDr', 'clCr'].map(k => <td key={k} style={{ textAlign: 'right', padding: 8 }}>{fmt(tb.tot[k])}</td>)}</tr></tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
