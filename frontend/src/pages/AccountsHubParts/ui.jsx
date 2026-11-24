// 04-Nov-2026 (v3): look and building blocks of the Accounts screens.
// Same colours as the rest of EagleView (theme gradient, light-blue section strips, folder tabs, coloured action
// buttons) with iCAFFE's screen layout: field boxes on top, an entry strip with Add, a grid, totals, an action bar.
import React from 'react';

export const T = {
  grad: 'linear-gradient(135deg, var(--primary-color-start, #0284c7), var(--primary-color-end, #075985))',
  tabGrad: 'linear-gradient(to right, var(--primary-color-start, #0ea5e9), var(--primary-color-end, #2563eb))',
  brand: 'var(--primary-color-end, #075985)', brandA: 'var(--primary-color-start, #0284c7)', brandLight: 'var(--primary-bg-light, #e0f2fe)',
  head: 'var(--primary-text, #0275a8)', headBg: 'var(--primary-bg-light, #e1f0fa)', headBorder: 'color-mix(in srgb, var(--primary-border, #93c5fd) 55%, #ffffff)',
  box: 'color-mix(in srgb, var(--primary-bg-light, #eff6ff) 55%, #ffffff)', boxBorder: 'color-mix(in srgb, var(--primary-border, #93c5fd) 40%, #ffffff)',
  ink: 'var(--primary-color-end, #075985)', inkSoft: '#334155',
  paper: 'var(--bg-app, #f4f7f9)', panel: '#ffffff', rule: '#cbd5e1', ruleSoft: '#e2e8f0',
  text: 'var(--text-main, #0f172a)', muted: 'var(--text-muted, #64748b)',
  dr: '#b91c1c', cr: '#047857', amber: '#b45309', amberBg: '#fffbeb', okBg: '#ecfdf5', drBg: '#fef2f2',
};
export const inr = (v, dec = 2) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? '' : Number(v).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
export const fmtDate = (d) => { if (!d) return ''; const s = String(d).slice(0, 10); const [y, m, dd] = s.split('-'); return dd && m && y ? `${dd}/${m}/${y}` : s; };
export const todayIso = () => new Date().toISOString().slice(0, 10);
// 06-Nov-2026: the financial year is the one picked in the top bar (GlobalContext keeps it in window.__acctx)
const ctxYear = () => { const c = (typeof window !== 'undefined' && window.__acctx) || {}; return c.fyStart && c.fyEnd ? [String(c.fyStart).slice(0, 10), String(c.fyEnd).slice(0, 10)] : null; };
export const fyStart = () => { const y = ctxYear(); if (y) return y[0]; const d = new Date(); return (d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear()) + '-04-01'; };
export const fyEnd = () => { const y = ctxYear(); return y ? y[1] : (Number(fyStart().slice(0, 4)) + 1) + '-03-31'; };
export const fyId = () => ((typeof window !== 'undefined' && window.__acctx) || {}).fyId || '';
export const api = async (url, opt) => {
  const r = await fetch(url, opt);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) throw new Error(j.error || j.message || ('HTTP ' + r.status));
  return j;
};
export const postJson = (url, body, method = 'POST') => api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// cached lookups; plain names go to /lookups/<name>
const LOOKUPS = ['ledgers', 'groups', 'tdsnatures', 'costcentres', 'sac', 'years'];
const cache = {};
export const lookup = (path, fresh) => {
  const url = '/api/accounts-hub/' + (LOOKUPS.includes(path) ? 'lookups/' + path : path);
  const c = (typeof window !== 'undefined' && window.__acctx) || {}; const key = url + '#' + (c.branch || '') + '#' + (c.fyId || ''); // per top-bar branch / year
  if (fresh) delete cache[key];
  return (cache[key] = cache[key] || api(url).catch(() => { delete cache[key]; return []; }));
};

// ------------------------------------------------------------------ boxes
// iCAFFE-style field box; with a title it gets the app's light-blue section strip
export function Box({ title, right, children, style, pad = 10, bodyStyle }) {
  return (
    <div style={{ background: T.box, border: `1px solid ${T.boxBorder}`, borderRadius: 6, overflow: 'hidden', minWidth: 0, ...style }}>
      {title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: T.headBg, borderBottom: `1px solid ${T.headBorder}`, color: T.head, fontSize: 11.5, fontWeight: 800 }}>
          <span>{title}</span><span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{right}</span>
        </div>
      )}
      <div style={{ padding: pad, ...bodyStyle }}>{children}</div>
    </div>
  );
}
export const Panel = ({ children, style, pad = 12 }) => <Box pad={pad} style={{ background: T.panel, ...style }}>{children}</Box>;

// folder tabs - the same .tab-container / .custom-tab look used on every other EagleView form
export function Tabs({ tabs, value, onChange, right }) {
  return (
    <div className="tab-container" style={{ marginBottom: 0 }}>
      {tabs.map(t => (
        <div key={t.id} className={'custom-tab' + (t.id === value ? ' active' : '')} onClick={() => onChange(t.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {t.icon && <t.icon size={12} />}{t.label}
        </div>
      ))}
      {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 4 }}>{right}</div>}
    </div>
  );
}

// the page frame of one screen: folder tabs, then the white sheet
export function Sheet({ tabs, tab, onTab, right, children }) {
  return (
    <div>
      <Tabs tabs={tabs} value={tab} onChange={onTab} right={right} />
      <div style={{ background: T.panel, border: '1px solid #94a3b8', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

// ------------------------------------------------------------------ buttons
// save = green, delete = red, clear = blue, print / search = light blue - as on iCAFFE, with the app's button classes
export function Btn({ children, onClick, kind = 'plain', disabled, title, type = 'button', small }) {
  const cls = { save: 'btn btn-success', primary: 'btn btn-primary', danger: 'btn btn-danger', clear: 'btn', plain: 'btn btn-secondary', ghost: 'btn' }[kind] || 'btn btn-secondary';
  const ghost = kind === 'ghost' ? { background: 'transparent', color: T.head, border: '1px dashed ' + T.headBorder }
    : kind === 'primary' ? { background: T.grad, color: '#fff', border: 'none', boxShadow: '0 2px 6px var(--primary-shadow, rgba(2,132,199,0.25))' }
    : kind === 'clear' ? { background: '#fff', color: T.head, border: '1px solid ' + T.headBorder } : {};
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={cls}
      style={{ height: small ? 26 : 32, padding: small ? '0 10px' : '0 14px', fontSize: small ? 11 : 12, fontWeight: 700, borderRadius: 6, whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, gap: 6, ...ghost }}>
      {children}
    </button>
  );
}
export function ActionBar({ children, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 10px', background: T.headBg, border: `1px solid ${T.headBorder}`, borderRadius: 6 }}>
      {children}
      {note && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: /^(Saved|Merged|Updated|Deleted|Closed|Re-opened)/.test(note) ? T.cr : T.dr }}>{note}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ fields
export function Field({ label, children, hint, required, span = 1, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: `span ${span}`, minWidth: 0, ...style }}>
      <label style={{ margin: 0 }}>{label}{required && <span style={{ color: T.dr }}> *</span>}</label>
      {children}
      {hint && <span style={{ fontSize: 10.5, color: T.muted }}>{hint}</span>}
    </div>
  );
}
// label left, field right (iCAFFE's top boxes)
export function Row({ label, children, required, w = 104 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${w}px minmax(0, 1fr)`, alignItems: 'center', gap: 8, minHeight: 30 }}>
      <label style={{ margin: 0 }}>{label}{required && <span style={{ color: T.dr }}> *</span>}</label>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
export const inputStyle = { width: '100%', height: 28, borderRadius: 5, border: '1px solid #94a3b8', padding: '0 8px', fontSize: 11.5, background: 'var(--bg-input, #fff)', color: 'var(--input-text, #000)', outline: 'none', fontWeight: 500 };
export const roStyle = { ...inputStyle, background: '#eef2f6', color: '#334155' };
export const mandStyle = { ...inputStyle, borderColor: '#f87171' };

export function Money({ v, side, strong, muted }) {
  const color = side === 'Dr' ? T.dr : side === 'Cr' ? T.cr : T.text;
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 800 : 600, color: muted ? T.muted : color, whiteSpace: 'nowrap' }}>{inr(v)}</span>;
}

export function Badge({ children, tone = 'muted' }) {
  const m = { muted: ['#eef2f6', T.inkSoft], ok: [T.okBg, T.cr], warn: [T.amberBg, T.amber], bad: [T.drBg, T.dr], brand: [T.headBg, T.head] }[tone] || ['#eef2f6', T.inkSoft];
  return <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, background: m[0], color: m[1], whiteSpace: 'nowrap' }}>{children}</span>;
}
export const statusTone = (s) => (/approv/i.test(s) ? 'ok' : /reject|return/i.test(s) ? 'bad' : 'warn');

// 06-Nov-2026: type-ahead list used by every account / charge box (the browser's own <datalist> showed at most
// 4,000 of the 7,600 iCAFFE ledgers, matched only from the start, and the box emptied itself while typing).
// Matches every word typed, anywhere in the name ("kotak 2647" finds KOTAK MAHINDRA BANK A/C NO - 2647171181);
// names starting with what was typed come first. Keys: Down / Up move, Enter or Tab picks, Esc closes,
// F2 lists everything. The list floats over the page so a box near the bottom of a panel is not cut off.
const normS = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
export function SuggestBox({ text, onText, items, getLabel, getSub, getKey, onPick, placeholder, style, disabled, autoFocus, max = 80, title }) {
  const [open, setOpen] = React.useState(false);
  const [all, setAll] = React.useState(false);       // F2 / first focus on a filled box: show everything
  const [hi, setHi] = React.useState(0);
  const [pos, setPos] = React.useState(null);
  const ref = React.useRef(null); const listRef = React.useRef(null);
  const place = () => { const r = ref.current && ref.current.getBoundingClientRect(); if (!r) return;
    const below = window.innerHeight - r.bottom; const h = Math.min(300, Math.max(below - 12, 160));
    setPos(below < 170 && r.top > below ? { left: r.left, width: Math.max(r.width, 300), bottom: window.innerHeight - r.top + 2, maxHeight: Math.min(300, r.top - 12) } : { left: r.left, width: Math.max(r.width, 300), top: r.bottom + 2, maxHeight: h }); };
  React.useEffect(() => { if (!open) return; place(); const f = () => place(); window.addEventListener('scroll', f, true); window.addEventListener('resize', f);
    return () => { window.removeEventListener('scroll', f, true); window.removeEventListener('resize', f); }; }, [open]);
  const q = all ? '' : normS(text);
  const matches = React.useMemo(() => {
    if (!open) return [];
    const words = q.split(' ').filter(Boolean); const a = [], b = [];
    for (const it of items || []) { const l = normS(getLabel(it)); if (!words.every(w => l.includes(w))) continue; (q && l.startsWith(q) ? a : b).push(it); if (a.length >= max) break; }
    return a.concat(b).slice(0, max);
  }, [open, q, items]);
  React.useEffect(() => { setHi(0); }, [q]);
  React.useEffect(() => { const el = listRef.current && listRef.current.children[hi]; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }, [hi]);
  const pick = (it) => { onPick(it); setOpen(false); setAll(false); };
  const onKey = (e) => {
    if (e.key === 'F2') { e.preventDefault(); setAll(true); setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) { setOpen(true); return; } setHi(h => Math.min(h + 1, matches.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); return; }
    if (e.key === 'Escape') { setOpen(false); setAll(false); return; }
    if ((e.key === 'Enter' || e.key === 'Tab') && open && matches[hi] && (normS(text) || all)) { if (e.key === 'Enter') e.preventDefault(); pick(matches[hi]); }
  };
  const nItems = (items || []).length;
  return (
    <>
      <input ref={ref} value={text} disabled={disabled} autoFocus={autoFocus} title={title} autoComplete="off" placeholder={placeholder} style={style}
        onChange={e => { onText(e.target.value); setAll(false); setOpen(true); }}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={onKey}
        onBlur={() => setTimeout(() => { setOpen(false); setAll(false); }, 150)} />
      {open && pos && !disabled && (
        <div ref={listRef} style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxHeight, overflowY: 'auto', zIndex: 3000,
          background: 'var(--bg-input, #fff)', color: 'var(--input-text, #0f172a)', border: '1px solid #94a3b8', borderRadius: 6, boxShadow: '0 8px 24px rgba(15,23,42,.18)', fontSize: 11.5 }}>
          {matches.map((it, i) => (
            <div key={getKey ? getKey(it) : i} onMouseDown={e => { e.preventDefault(); pick(it); }} onMouseEnter={() => setHi(i)}
              style={{ padding: '5px 9px', cursor: 'pointer', background: i === hi ? 'rgba(56,189,248,.18)' : 'transparent', borderBottom: '1px solid rgba(148,163,184,.18)' }}>
              <div style={{ fontWeight: 700 }}>{getLabel(it)}</div>
              {getSub && getSub(it) ? <div style={{ fontSize: 10, opacity: 0.7 }}>{getSub(it)}</div> : null}
            </div>))}
          {!matches.length && <div style={{ padding: '8px 10px', opacity: 0.7 }}>{nItems ? 'Nothing matches "' + text + '"' : 'List is empty'}</div>}
          {matches.length >= max && <div style={{ padding: '5px 10px', fontSize: 10, opacity: 0.7 }}>Showing the first {max} - type more to narrow</div>}
        </div>)}
    </>
  );
}

// ledger picker: type to search, shows the group; value = ledger id
// 06-Nov-2026: what is typed stays in the box (it used to be wiped while typing / on leaving the box); a name that
// is not a ledger is shown in red until one is picked; leaving the box with exactly one match picks it.
export function LedgerPicker({ value, onChange, list, placeholder = 'Type ledger name', id, autoFocus, disabled, mandatory }) {
  const cur = list.find(l => String(l.id) === String(value));
  const [text, setText] = React.useState(cur ? cur.name : '');
  const prev = React.useRef(value);
  React.useEffect(() => {
    // follow the value only when it changes from outside (a picked ledger, a cleared form, a voucher opened)
    if (cur && normS(cur.name) !== normS(text)) setText(cur.name);
    else if (!value && prev.current && !cur) setText('');
    prev.current = value;
  }, [value, cur && cur.name]);
  const exact = (t) => list.find(l => normS(l.name) === normS(t));
  const typed = text && !value;
  return (
    <SuggestBox text={text} items={list} getLabel={l => l.name} getSub={l => l.groupName || ''} getKey={l => l.id} disabled={disabled} autoFocus={autoFocus}
      placeholder={list.length ? placeholder : 'No ledgers yet'} title={typed ? 'Pick the account from the list' : undefined}
      style={(mandatory && !value) || typed ? mandStyle : inputStyle}
      onText={t => { setText(t); const o = exact(t); if (o) { prev.current = o.id; onChange(o.id, o); } else if (value) { prev.current = ''; onChange('', null); } }}
      onPick={o => { setText(o.name); prev.current = o.id; onChange(o.id, o); }} />
  );
}

// current balance of a ledger (as iCAFFE shows next to the cash / bank book)
export function useBalance(id) {
  const [b, setB] = React.useState(null);
  React.useEffect(() => { setB(null); if (id) api('/api/accounts-hub/ledger-balance/' + id).then(setB).catch(() => setB(null)); }, [id]);
  return b;
}

// totals strip under a voucher
export function BalanceStrip({ dr, cr, extra }) {
  const diff = Math.round((dr - cr) * 100) / 100;
  const ok = dr > 0 && Math.abs(diff) < 0.01;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '7px 12px', borderRadius: 6, flexWrap: 'wrap', fontSize: 11.5,
      background: ok ? T.okBg : dr || cr ? T.amberBg : '#f1f5f9', border: `1px solid ${ok ? '#a7f3d0' : dr || cr ? '#fde68a' : T.rule}` }}>
      <span style={{ fontWeight: 700, color: T.inkSoft }}>Dr. <Money v={dr} side="Dr" strong /></span>
      <span style={{ fontWeight: 700, color: T.inkSoft }}>Cr. <Money v={cr} side="Cr" strong /></span>
      {extra}
      <span style={{ marginLeft: 'auto', fontWeight: 800, color: ok ? T.cr : dr || cr ? T.amber : T.muted }}>
        {ok ? 'Balanced' : dr || cr ? `Difference ${inr(Math.abs(diff))} ${diff > 0 ? 'Dr' : 'Cr'}` : 'Enter amounts'}
      </span>
    </div>
  );
}

// grid with the app's table look, inside a titled box
export function Grid({ title, right, cols, rows, empty = 'No entries', foot, maxHeight = 320, minHeight, onRow, rowKey = (r, i) => i, activeKey }) {
  return (
    <Box title={title} right={right} pad={0} style={{ background: T.panel }}>
      <div style={{ overflow: 'auto', maxHeight, minHeight }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: c.right ? 'right' : 'left', width: c.w, background: '#f8fafc' }}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => { const k = rowKey(r, i); const on = activeKey !== undefined && String(k) === String(activeKey); return (
              <tr key={k} className={onRow ? 'table-row-hover' : ''} onClick={onRow ? () => onRow(r) : undefined} style={{ borderTop: `1px solid ${T.ruleSoft}`, background: on ? T.headBg : i % 2 ? '#fbfdff' : '#fff' }}>
                {cols.map((c, j) => <td key={j} style={{ textAlign: c.right ? 'right' : 'left', whiteSpace: c.wrap ? 'normal' : 'nowrap', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' }}>{c.render ? c.render(r, i) : r[c.key]}</td>)}
              </tr>); })}
            {!rows.length && <tr><td colSpan={cols.length} style={{ textAlign: 'center', color: T.muted, padding: '26px 8px' }}>{empty}</td></tr>}
          </tbody>
          {foot && rows.length > 0 && <tfoot style={{ position: 'sticky', bottom: 0 }}><tr style={{ background: T.headBg, fontWeight: 800 }}>{foot.map((f, i) => <td key={i} style={{ textAlign: cols[i] && cols[i].right ? 'right' : 'left', borderTop: `2px solid ${T.headBorder}`, whiteSpace: 'nowrap' }}>{f}</td>)}</tr></tfoot>}
        </table>
      </div>
    </Box>
  );
}

// read-only posting
export function PostingTable({ lines, title = 'Posting' }) {
  const dr = lines.filter(l => l.dc === 'Dr').reduce((s, l) => s + Number(l.amount || 0), 0);
  const cr = lines.filter(l => l.dc === 'Cr').reduce((s, l) => s + Number(l.amount || 0), 0);
  return (
    <Grid title={title} maxHeight={360}
      cols={[{ label: 'Account Name', render: l => <div><div style={{ fontWeight: 700 }}>{l.ledgerName || l.name}</div>{(l.groupName || l.remarks) && <div style={{ fontSize: 10, color: T.muted }}>{[l.groupName, l.remarks].filter(Boolean).join(' - ')}</div>}</div>, wrap: true },
        { label: 'Debit', right: true, w: 140, render: l => (l.dc === 'Dr' ? <Money v={l.amount} side="Dr" /> : '') },
        { label: 'Credit', right: true, w: 140, render: l => (l.dc === 'Cr' ? <Money v={l.amount} side="Cr" /> : '') }]}
      rows={lines} foot={['Total', <Money v={dr} side="Dr" strong />, <Money v={cr} side="Cr" strong />]} />
  );
}
export const thS = { textAlign: 'left' };
export const tdS = { verticalAlign: 'top' };

export function Empty({ title, children, action }) {
  return (
    <div style={{ padding: '30px 20px', textAlign: 'center', color: T.muted }}>
      <div style={{ fontWeight: 800, color: T.head, fontSize: 13, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, marginBottom: action ? 12 : 0 }}>{children}</div>
      {action}
    </div>
  );
}

// red / amber note under a party picker: blacklisted, inactive, MSME 45-day rule
export function PartyNote({ b }) {
  if (!b) return null;
  const items = [];
  if (Number(b.isBlacklisted)) items.push(['bad', 'Blacklisted party' + (b.blacklistReason ? ': ' + b.blacklistReason : '')]);
  if (b.isActive !== undefined && b.isActive !== null && Number(b.isActive) === 0) items.push(['bad', 'This account is marked inactive']);
  if (b.msmeNo) items.push(['warn', 'MSME supplier - pay within ' + (Number(b.msmeAgreementDays) || 45) + ' days']);
  if (!items.length) return null;
  return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>{items.map(([t, m], i) => <Badge key={i} tone={t}>{m}</Badge>)}</div>;
}
