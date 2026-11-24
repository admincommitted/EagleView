// Sales module - shared calls and small pieces of screen. 11-Nov-2026.
import React from 'react';
import { createPortal } from 'react-dom';

// pop-ups go straight under <body>: the page area makes its own stacking layer and the top bar would cover them
export const Layer = ({ children }) => createPortal(children, document.body);

export async function api(path, opts = {}) {
  const o = { ...opts };
  if (o.body && typeof o.body !== 'string') { o.body = JSON.stringify(o.body); o.headers = { 'Content-Type': 'application/json', ...(o.headers || {}) }; }
  const res = await fetch('/api/sales-hub' + path, o);
  let d = {}; try { d = await res.json(); } catch (e) { d = { success: false, error: 'Server answered ' + res.status }; }
  if (!res.ok || d.success === false) { const err = new Error(d.error || ('Server answered ' + res.status)); Object.assign(err, d, { status: res.status }); throw err; }
  return d;
}

export const C = {
  ink: '#0f172a', mute: '#64748b', line: '#e2e8f0', soft: '#f8fafc', head: '#0c4a6e', accent: '#0369a1', accentBg: '#e0f2fe',
  green: '#15803d', greenBg: '#dcfce7', amber: '#b45309', amberBg: '#fef3c7', red: '#b91c1c', redBg: '#fee2e2', grey: '#475569', greyBg: '#f1f5f9',
};
export const inr = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }));
export const crore = (n) => { const v = Number(n || 0); if (Math.abs(v) >= 1e7) return (v / 1e7).toFixed(2) + ' Cr'; if (Math.abs(v) >= 1e5) return (v / 1e5).toFixed(2) + ' L'; return inr(v); };
export const dmy = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : (v || ''); };
export const lbl = { display: 'block', fontSize: '11px', fontWeight: 600, color: C.grey, marginBottom: '3px' };
export const inp = { width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: '#fff', color: C.ink };
export const btn = (kind) => ({
  padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px',
  ...(kind === 'primary' ? { background: C.accent, color: '#fff', border: '1px solid ' + C.accent }
    : kind === 'danger' ? { background: '#fff', color: C.red, border: '1px solid #fca5a5' }
    : kind === 'ghost' ? { background: 'transparent', color: C.accent, border: '1px solid transparent' }
    : { background: '#fff', color: '#334155', border: '1px solid #cbd5e1' }),
});

const STATUS_STYLE = { PROSPECT: [C.accentBg, C.accent], ACTIVE: [C.greenBg, C.green], ON_HOLD: [C.amberBg, C.amber], LOST: [C.greyBg, C.grey], BLOCKED: [C.redBg, C.red] };
const ACT_STYLE = { ACTIVE: [C.greenBg, C.green, 'Billing'], SLOWING: [C.amberBg, C.amber, 'Slowing'], DORMANT: [C.redBg, C.red, 'Dormant'], NONE: [C.greyBg, C.grey, 'Not billed'] };
export function Chip({ text, bg, fg, title }) {
  return <span title={title} style={{ display: 'inline-block', padding: '1px 7px', borderRadius: '10px', fontSize: '10.5px', fontWeight: 700, background: bg, color: fg, whiteSpace: 'nowrap' }}>{text}</span>;
}
export const StatusChip = ({ status, label }) => { const s = STATUS_STYLE[status] || [C.greyBg, C.grey]; return <Chip text={label || status} bg={s[0]} fg={s[1]} />; };
export const ActivityChip = ({ activity, last }) => { const s = ACT_STYLE[activity] || ACT_STYLE.NONE; return <Chip text={s[2]} bg={s[0]} fg={s[1]} title={last ? 'Last bill ' + dmy(last) : 'No sales bill since last year'} />; };

export function Field({ label, children, span, hint }) {
  return (
    <div style={{ gridColumn: span ? `span ${span}` : undefined, minWidth: 0 }}>
      <label style={lbl}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '10.5px', color: C.mute, marginTop: '2px' }}>{hint}</div>}
    </div>
  );
}
export function Section({ title, right, children }) {
  return (
    <section style={{ border: '1px solid ' + C.line, borderRadius: '6px', background: '#fff', marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 12px', borderBottom: '1px solid ' + C.line, background: C.soft, borderRadius: '6px 6px 0 0' }}>
        <h4 style={{ margin: 0, fontSize: '12.5px', color: C.head }}>{title}</h4>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>{right}</div>
      </div>
      <div style={{ padding: '10px 12px' }}>{children}</div>
    </section>
  );
}
export const grid = (min = 170) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: '8px 12px' });

// pick several codes (services, competitors) as tick boxes
export function MultiPick({ options, value, onChange, disabled, cols = 200 }) {
  const set = new Set((Array.isArray(value) ? value : String(value || '').split(',')).map(s => s.trim()).filter(Boolean));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cols}px, 1fr))`, gap: '2px 10px' }}>
      {options.map(([code, label]) => (
        <label key={code} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', cursor: disabled ? 'default' : 'pointer', color: set.has(code) ? C.ink : C.grey }}>
          <input type="checkbox" disabled={disabled} checked={set.has(code)} onChange={() => { const n = new Set(set); n.has(code) ? n.delete(code) : n.add(code); onChange([...n]); }} />
          {label}
        </label>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, width = 760, footer }) {
  return (<Layer>
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-label={title} style={{ background: C.soft, borderRadius: '8px', width, maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#fff', borderBottom: '1px solid ' + C.line, borderRadius: '8px 8px 0 0' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: C.ink }}>{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: C.mute }}>×</button>
        </div>
        <div style={{ overflow: 'auto', padding: '12px 14px' }}>{children}</div>
        {footer && <div style={{ padding: '10px 14px', borderTop: '1px solid ' + C.line, background: '#fff', display: 'flex', gap: '8px', justifyContent: 'flex-end', borderRadius: '0 0 8px 8px' }}>{footer}</div>}
      </div>
    </div>
  </Layer>);
}
// ---- coloured cards, the same look as the Director MIS / main dashboards (14-Nov-2026) ----
// tone = [main colour, light background]
export const TONE = {
  blue: ['#2563eb', '#eff6ff'], violet: ['#7c3aed', '#f5f3ff'], green: ['#059669', '#ecfdf5'], red: ['#dc2626', '#fef2f2'],
  amber: ['#d97706', '#fffbeb'], cyan: ['#0891b2', '#ecfeff'], slate: ['#64748b', '#f1f5f9'], pink: ['#db2777', '#fdf2f8'],
};
export const cardShadow = '0 4px 6px -1px rgba(15,23,42,.06), 0 2px 4px -2px rgba(15,23,42,.04)';
export function IconBadge({ icon: Icon, tone = 'blue', size = 34 }) {
  const [fg, bg] = TONE[tone] || TONE.blue;
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {Icon ? <Icon size={Math.round(size * 0.5)} /> : null}
    </span>
  );
}
// a figure: label, big value, icon in its colour, a coloured bottom edge; a button when it opens something
export function KpiCard({ label, value, icon, tone = 'blue', tint, children, onClick, compact, valueColor, title }) {
  const [fg, bg] = TONE[tone] || TONE.blue;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={title} className={onClick ? 'sales-kpi sales-kpi-click' : 'sales-kpi'}
      style={{ textAlign: 'left', font: 'inherit', color: 'inherit', width: '100%', minWidth: 0, background: tint ? bg : '#fff', border: '1px solid ' + C.line, borderBottom: `4px solid ${fg}`,
        borderRadius: '12px', padding: compact ? '10px 12px' : '14px 16px', boxShadow: cardShadow, cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
        <div style={{ fontSize: '11px', color: C.grey, fontWeight: 700, flex: 1, minWidth: 0, paddingTop: compact ? '4px' : '7px' }}>{label}</div>
        {icon && <IconBadge icon={icon} tone={tone} size={compact ? 28 : 34} />}
      </div>
      <div style={{ fontSize: compact ? '20px' : '24px', fontWeight: 800, color: valueColor || C.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{value}</div>
      {children && <div style={{ fontSize: '11.5px', color: C.grey, display: 'flex', flexDirection: 'column', gap: '2px' }}>{children}</div>}
    </Tag>
  );
}
// a panel with a coloured icon in its heading
export function Card({ title, icon, tone = 'blue', right, children, pad = true, edge }) {
  return (
    <section style={{ background: '#fff', border: '1px solid ' + C.line, borderLeft: edge ? `4px solid ${(TONE[tone] || TONE.blue)[0]}` : '1px solid ' + C.line, borderRadius: '12px',
      boxShadow: cardShadow, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid ' + C.line, flexWrap: 'wrap' }}>
        {icon && <IconBadge icon={icon} tone={tone} size={28} />}
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: C.ink }}>{title}</h4>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>
      </div>
      <div style={{ padding: pad ? '12px 14px' : 0, flex: 1, minHeight: 0 }}>{children}</div>
    </section>
  );
}

export const th = { padding: '6px 8px', textAlign: 'left', fontSize: '11px', color: C.grey, fontWeight: 700, background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1, whiteSpace: 'nowrap' };
export const td = { padding: '6px 8px', fontSize: '12px', borderTop: '1px solid #f1f5f9', verticalAlign: 'top' };
