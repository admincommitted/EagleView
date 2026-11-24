// Right-click menu of a job row (Import / Export job lists). 18-Nov-2026
// menu = { x, y, items: [ { head } | { sep: true } | { label, icon: LucideIcon, onClick, disabled, title, danger } ] }
// Closes on a click outside, Escape, scroll, resize or window blur. Arrow keys / Enter work.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export default function RowContextMenu({ menu, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!menu || !ref.current) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = menu.x, y = menu.y;
    if (x + r.width > vw - 8) x = Math.max(8, vw - r.width - 8);
    if (y + r.height > vh - 8) y = Math.max(8, Math.min(menu.y - r.height, vh - r.height - 8));
    setPos({ x, y });
    const first = ref.current.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }, [menu]);

  useEffect(() => {
    if (!menu) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const list = Array.from(ref.current ? ref.current.querySelectorAll('button:not([disabled])') : []);
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      const n = e.key === 'ArrowDown' ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1);
      list[n].focus();
    };
    // scrolling the page closes the menu; scrolling inside the menu (long list on a small screen) does not
    const close = (e) => { if (e && e.type === 'scroll' && ref.current && e.target instanceof Node && ref.current.contains(e.target)) return; onClose(); };
    document.addEventListener('mousedown', down, true);
    document.addEventListener('keydown', key, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('mousedown', down, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  return (
    <div ref={ref} role="menu" aria-label="Job actions" onContextMenu={(e) => e.preventDefault()}
      style={{ position: 'fixed', left: (pos || menu).x, top: (pos || menu).y, visibility: pos ? 'visible' : 'hidden', zIndex: 10050, minWidth: '250px', maxWidth: '340px',
        maxHeight: 'calc(100vh - 16px)', overflowY: 'auto', background: '#ffffff', border: '1px solid #94a3b8', borderRadius: '6px',
        boxShadow: '0 12px 28px rgba(15,23,42,0.22)', padding: '4px 0', fontSize: '12px', textTransform: 'none' }}>
      {menu.items.filter(Boolean).map((it, i) => {
        if (it.sep) return <div key={i} style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />;
        if (it.head) return <div key={i} style={{ padding: '6px 12px 3px', fontSize: '10.5px', fontWeight: 700, color: '#64748b', letterSpacing: '0.2px' }}>{it.head}</div>;
        const Icon = it.icon;
        const color = it.disabled ? '#94a3b8' : it.danger ? '#dc2626' : '#0f172a';
        return (
          <button key={i} type="button" role="menuitem" disabled={!!it.disabled} title={it.title || ''}
            onClick={() => { onClose(); if (it.onClick) it.onClick(); }}
            onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.focus({ preventScroll: true }); }}
            onFocus={(e) => { e.currentTarget.style.background = it.danger ? '#fef2f2' : '#eff6ff'; }}
            onBlur={(e) => { e.currentTarget.style.background = 'transparent'; }}
            style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', outline: 'none',
              textAlign: 'left', cursor: it.disabled ? 'not-allowed' : 'pointer', color, fontSize: '12px', fontWeight: 500, textTransform: 'none' }}>
            {Icon ? <Icon size={14} color={it.disabled ? '#cbd5e1' : (it.iconColor || (it.danger ? '#dc2626' : '#475569'))} /> : <span style={{ width: 14 }} />}
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.note && <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>{it.note}</span>}
          </button>
        );
      })}
    </div>
  );
}
