// Screen section: RITC / CTH / CETH lookup (the (i) buttons next to those boxes on the Item's Details row), 29-Oct-2026.
// One real search window on the Tariff master (GET /api/masters/tariffheaders/all?q=...) - the three windows it
// replaces showed one fixed sample row and could not be opened from anywhere.
import { Search, X } from 'lucide-react';
import React from 'react';
import BodyPortal from '../../../../common/BodyPortal';

export default function SearchSection({ ctx }) {
  const { tariffSearch, setTariffSearch, runTariffSearch, pickTariff } = ctx;
  if (!tariffSearch || !tariffSearch.open) return null;
  const t = tariffSearch;
  const label = { ritc: 'RITC / HS code', cth: 'CTH (customs tariff heading)', ceth: 'CETH (central excise tariff heading)' }[t.field] || 'Tariff';
  const inp = { height: '28px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' };
  return (
    <BodyPortal>
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '12px' }} onClick={(e) => { if (e.target === e.currentTarget) setTariffSearch({ ...t, open: false }); }}>
      <div role="dialog" aria-label="Tariff search" style={{ background: '#fff', borderRadius: '8px', width: '100%', maxWidth: '760px', maxHeight: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <strong style={{ fontSize: '14px', color: '#0f172a' }}>Search {label}</strong>
          <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setTariffSearch({ ...t, open: false })} />
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', gap: '8px', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
          <Search size={14} color="#64748b" />
          <input autoFocus style={{ ...inp, flex: 1 }} placeholder="HS code (digits) or words of the description - Enter to search" value={t.q} onChange={e => setTariffSearch({ ...t, q: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') runTariffSearch(); }} />
          <button type="button" onClick={runTariffSearch} style={{ height: '28px', padding: '0 14px', border: 'none', borderRadius: '5px', background: '#0284c7', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{t.loading ? 'Searching…' : 'Search'}</button>
        </div>
        <div style={{ overflow: 'auto', flex: '1 1 auto', minHeight: '200px', maxHeight: '55vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
              <tr><th style={{ padding: '6px 10px', textAlign: 'left', width: '110px' }}>HS code</th><th style={{ padding: '6px 10px', textAlign: 'left' }}>Description</th><th style={{ padding: '6px 10px', textAlign: 'left', width: '60px' }}>UQC</th><th style={{ padding: '6px 10px', textAlign: 'left', width: '70px' }}>BCD %</th></tr>
            </thead>
            <tbody>
              {t.rows.length === 0 && <tr><td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>{t.loading ? 'Searching the Tariff master…' : t.searched ? 'Nothing found - try fewer digits or another word' : 'Type a code or a description and press Enter'}</td></tr>}
              {t.rows.map((r, i) => (
                <tr key={r.id || i} onClick={() => pickTariff(r)} style={{ cursor: 'pointer', background: i % 2 ? '#fcfcfd' : '#fff' }} onMouseOver={e => e.currentTarget.style.background = '#eff6ff'} onMouseOut={e => e.currentTarget.style.background = i % 2 ? '#fcfcfd' : '#fff'}>
                  <td style={{ padding: '5px 10px', fontWeight: 700, color: '#1d4ed8', borderBottom: '1px solid #f1f5f9' }}>{r.hsnCode}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f5f9' }}>{r.description}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f5f9' }}>{r.uqc}</td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid #f1f5f9' }}>{r.bcd != null ? r.bcd : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Click a line to put its code in the {label.split(' ')[0]} box{t.field === 'ritc' ? ' (CTH / CETH too when empty; description when the auto switch is on or the box is empty)' : ''}.</span>
          <button type="button" onClick={() => setTariffSearch({ ...t, open: false })} style={{ height: '28px', padding: '0 14px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
    </BodyPortal>
  );
}
