// 04-Nov-2026: Accounts search (Ctrl+K anywhere): screens and reports, ledgers (name / GSTIN / PAN) and vouchers
// (number, bill / cheque ref, job no, narration or exact amount). Arrow keys + Enter to open.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookUser, FileText, CornerDownLeft, X } from 'lucide-react';
import { canOpen } from '../../utils/permissions';
import { ALL_ITEMS, hrefOf } from './menu';
import { T, inr, fmtDate, api } from './ui';

export default function CommandSearch({ open, onClose, initial = '' }) {
  const [q, setQ] = useState(initial);
  const [data, setData] = useState({ ledgers: [], vouchers: [] });
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const inRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { if (open) { setQ(initial); setSel(0); setTimeout(() => inRef.current && inRef.current.focus(), 30); } }, [open]);
  useEffect(() => {
    const t = q.trim();
    if (!open || t.length < 2) { setData({ ledgers: [], vouchers: [] }); return; }
    setBusy(true);
    const h = setTimeout(() => api('/api/accounts-hub/search?q=' + encodeURIComponent(t)).then(setData).catch(() => setData({ ledgers: [], vouchers: [] })).finally(() => setBusy(false)), 220);
    return () => clearTimeout(h);
  }, [q, open]);

  const screens = useMemo(() => {
    const t = q.trim().toLowerCase();
    const ok = ALL_ITEMS.filter(i => canOpen(hrefOf(i).split('?')[0]));
    if (!t) return ok.filter(i => ['receipt', 'payment', 'journal', 'trade', 'tb', 'ledger', 'partybal', 'monthclosing'].includes(i.id));
    return ok.filter(i => (i.label + ' ' + (i.keywords || '') + ' ' + i.section.title + ' ' + i.desc).toLowerCase().includes(t)).slice(0, 8);
  }, [q]);

  const rows = useMemo(() => [
    ...screens.map(i => ({ kind: 'screen', key: 's' + i.id, title: i.label, sub: i.section.title + ' - ' + i.desc, color: i.section.color, Icon: i.section.icon, go: hrefOf(i) })),
    ...data.ledgers.map(l => ({ kind: 'ledger', key: 'l' + l.id, title: l.name, sub: [l.groupName, l.gstin].filter(Boolean).join(' - '), color: '#0369a1', Icon: BookUser, go: '/accounts-hub?item=ledger&ledger=' + l.id })),
    ...data.vouchers.map(v => ({ kind: 'voucher', key: 'v' + v.id, title: `${v.typeName} ${v.voucherNumber}`, sub: [fmtDate(v.date), v.refNo, v.jobNo].filter(Boolean).join(' - '), amount: v.totalAmount, color: '#0d9488', Icon: FileText, go: '/accounts-hub?item=' + deskOf(v.baseType) + '&voucher=' + v.id })),
  ], [screens, data]);
  useEffect(() => { if (sel >= rows.length) setSel(0); }, [rows.length]);

  if (!open) return null;
  const go = (r) => { onClose(); nav(r.go); };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(rows.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && rows[sel]) { e.preventDefault(); go(rows[sel]); }
    else if (e.key === 'Escape') onClose();
  };
  const groups = [['screen', 'Screens and reports'], ['ledger', 'Ledgers'], ['voucher', 'Vouchers']];
  let idx = -1;
  return (
    <div onMouseDown={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '9vh' }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: 640, maxWidth: 'calc(100vw - 24px)', background: T.panel, borderRadius: 8, overflow: 'hidden', boxShadow: '0 30px 60px -15px rgba(15,23,42,0.45)', border: '1px solid #94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: T.grad }}>
          <Search size={18} color="#fff" />
          <input ref={inRef} value={q} onChange={e => { setQ(e.target.value); setSel(0); }} onKeyDown={key}
            placeholder="Search a screen, ledger, GSTIN, voucher no, bill no, job no or amount"
            style={{ flex: 1, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6, outline: 'none', fontSize: 13, background: '#fff', color: T.text, height: 32, padding: '0 10px' }} />
          {busy && <span style={{ fontSize: 11, color: '#fff' }}>Searching</span>}
          <span onClick={onClose} style={{ cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={16} /></span>
        </div>
        <div ref={listRef} style={{ maxHeight: '56vh', overflowY: 'auto', padding: '6px 0' }}>
          {groups.map(([k, title]) => {
            const g = rows.filter(r => r.kind === k);
            if (!g.length) return null;
            return (
              <div key={k}>
                <div style={{ padding: '5px 16px', fontSize: 11, fontWeight: 800, color: T.head, background: T.headBg, borderTop: `1px solid ${T.headBorder}`, borderBottom: `1px solid ${T.headBorder}` }}>{title}</div>
                {g.map(r => { idx++; const i = idx; const on = i === sel; const I = r.Icon; return (
                  <div key={r.key} onMouseEnter={() => setSel(i)} onClick={() => go(r)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', cursor: 'pointer', background: on ? T.headBg : 'transparent', borderLeft: `3px solid ${on ? r.color : 'transparent'}` }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: r.color + '18', color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 28px' }}><I size={15} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
                    </div>
                    {r.amount != null && <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{inr(r.amount)}</span>}
                    {on && <CornerDownLeft size={14} color={T.muted} />}
                  </div>); })}
              </div>
            );
          })}
          {!rows.length && <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: T.muted }}>{q.trim().length < 2 ? 'Type at least 2 letters' : 'Nothing matches "' + q + '"'}</div>}
        </div>
        <div style={{ display: 'flex', gap: 14, padding: '8px 16px', borderTop: `1px solid ${T.rule}`, fontSize: 10.5, color: T.muted, background: '#F8FAFC' }}>
          <span>Up / Down to move</span><span>Enter to open</span><span>Esc to close</span><span style={{ marginLeft: 'auto' }}>Ctrl + K opens this anywhere</span>
        </div>
      </div>
    </div>
  );
}
export const deskOf = (base) => ({ Receipt: 'receipt', Payment: 'payment', Journal: 'journal', Contra: 'contra', Purchase: 'trade', 'Debit Note': 'trade', Sales: 'gstservice', 'Credit Note': 'gstservice' }[base] || 'journal');
