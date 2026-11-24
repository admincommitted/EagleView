// 04-Nov-2026 (v4): Accounts menu in the navbar, built the same way as the Masters dropdown - .dropdown-menu with
// independent columns, small uppercase group headings and plain .dropdown-item links. Groups follow iCAFFE's Accounts
// menu. Ctrl+K still opens the accounts search from any page.
import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { canOpen } from '../utils/permissions';
import { SECTIONS, hrefOf } from '../pages/AccountsHubParts/menu';
import CommandSearch from '../pages/AccountsHubParts/CommandSearch';

const allowed = (i) => canOpen(hrefOf(i).split('?')[0]);
// columns: which groups stack in each (like the Masters dropdown)
const COLUMNS = [['masters', 'gstinv'], ['voucher', 'purchase', 'other'], ['reports', 'books']];
const head = { padding: '0.4rem 0.75rem', fontWeight: 800, color: 'var(--primary-text, #1e3a8a)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color, #e2e8f0)' };
const sub = { padding: '0.35rem 0.75rem 0.1rem', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' };

export default function AccountsMegaMenu() {
  const [show, setShow] = useState(false);
  const [palette, setPalette] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const out = (e) => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k' && !window.location.pathname.startsWith('/accounts-hub')) { e.preventDefault(); setShow(false); setPalette(true); }
    };
    document.addEventListener('mousedown', out); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); };
  }, []);

  const groups = Object.fromEntries(SECTIONS.map(s => [s.id, { ...s, items: s.items.filter(allowed) }]));
  const cols = COLUMNS.map(c => c.map(id => groups[id]).filter(g => g && g.items.length)).filter(c => c.length);
  if (!cols.length) return null;

  return (
    <div className="dropdown" ref={ref} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <div className="nav-item" style={{ cursor: 'pointer' }} onClick={() => setShow(s => !s)}>
        <Briefcase size={18} /><span>Accounts</span>
      </div>
      <div className="dropdown-menu" onClick={() => setShow(false)}
        style={{ minWidth: '820px', padding: '1rem', display: show ? 'grid' : 'none', gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, gap: '1rem', alignItems: 'start', maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
            {ci === 0 && canOpen('/accounts-hub') && (
              <div style={{ marginBottom: '8px' }}>
                <div style={head}>Home</div>
                <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <NavLink to="/accounts-hub" end className="dropdown-item" style={{ padding: '0.4rem 0.75rem', fontWeight: 'bold', color: 'var(--primary-text, #0284c7)' }} title="Accounts dashboard">Accounts Dashboard</NavLink>
                </div>
              </div>
            )}
            {col.map(g => (
              <div key={g.id} style={{ marginBottom: '8px' }}>
                <div style={head}>{g.title}</div>
                <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {g.items.map((i, n) => (
                    <React.Fragment key={i.id}>
                      {i.group && (n === 0 || g.items[n - 1].group !== i.group) && <div style={sub}>{i.group}</div>}
                      <NavLink to={hrefOf(i)} className="dropdown-item" style={{ padding: '0.4rem 0.75rem' }} title={i.desc}>{i.label}</NavLink>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
            {ci === cols.length - 1 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={head}>General</div>
                <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div className="dropdown-item" style={{ padding: '0.4rem 0.75rem', cursor: 'pointer' }} onClick={() => setPalette(true)}>Search Accounts (Ctrl+K)</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <CommandSearch open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
