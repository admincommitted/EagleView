import React from 'react';
import { useExportContext } from '../../ExportContext';
import ModernDatePicker from '../../../common/ModernDatePicker';
import { invOf, itemNoOf } from './schemeUtils';

// Scheme > AR4 (ICEGATE SB "AR4" table). 29-Oct-2026: Range and Remarks added (in the ICEGATE table, missing here),
// the list is updated from the latest items (a stale copy could undo a change typed just before), required fields marked.
const th = { padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #bae6fd' };
const cell = { padding: '3px 4px', borderBottom: '1px solid var(--border-color, #e2e8f0)' };
const inp = { height: '26px', width: '100%', boxSizing: 'border-box', fontSize: '12px', padding: '0 6px' };
const miss = (v) => ({ borderColor: String(v || '').trim() ? 'var(--border-color, #cbd5e1)' : '#ef4444' });

export const ar4Missing = (it) => ['ar4No', 'ar4Date', 'commissionerate', 'division', 'ar4Range'].filter((f) => !String(it[f] || '').trim());

export default function Ar4Tab() {
  const { items, setItems } = useExportContext();
  const updateItem = (id, field, value) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const rows = (items || []).map((it, i) => ({ it, i })).filter(({ it }) => String(it.ar4 || '').toUpperCase() === 'Y');
  const bad = rows.filter(({ it }) => ar4Missing(it).length).length;
  const txt = (it, f, ph, max) => <input type="text" className="grid-input" placeholder={ph} maxLength={max} style={{ ...inp, ...miss(it[f]) }} value={it[f] || ''} onChange={(e) => updateItem(it.id, f, e.target.value)} />;
  return (
    <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
        <strong style={{ fontSize: 13, color: 'var(--primary-text, #0369a1)' }}>AR4 Details (Central Excise)</strong>
        <span style={{ color: bad ? '#b45309' : '#047857', fontWeight: 600 }}>{bad ? `${bad} item(s) incomplete` : `${rows.length} item(s) complete`}</span>
      </div>
      <div style={{ overflow: 'auto', border: '1px solid var(--border-color, #cbd5e1)', background: '#fff' }}>
        <table className="compact-table" style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#dbeafe', color: 'var(--primary-text, #0369a1)' }}>
              <th style={{ ...th, width: 50 }}>Inv</th>
              <th style={{ ...th, width: 50 }}>Item</th>
              <th style={{ ...th, width: 150 }}>AR4 No *</th>
              <th style={{ ...th, width: 120 }}>AR4 Date *</th>
              <th style={th}>Commissionerate *</th>
              <th style={th}>Division *</th>
              <th style={th}>Range *</th>
              <th style={th}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ it, i }) => (
              <tr key={it.id ?? i} style={{ background: ar4Missing(it).length ? '#fffbeb' : '#fff' }}>
                <td style={{ ...cell, textAlign: 'center', color: '#059669', fontWeight: 600 }}>{invOf(it, i)}</td>
                <td style={{ ...cell, textAlign: 'center', color: '#0369a1', fontWeight: 600 }}>{itemNoOf(it, i)}</td>
                <td style={cell}>{txt(it, 'ar4No', 'AR4 No', 17)}</td>
                <td style={cell}><ModernDatePicker className="grid-input" style={{ ...inp, ...miss(it.ar4Date) }} value={it.ar4Date || ''} onChange={(e) => updateItem(it.id, 'ar4Date', e.target.value)} /></td>
                <td style={cell}>{txt(it, 'commissionerate', 'Commissionerate', 20)}</td>
                <td style={cell}>{txt(it, 'division', 'Division', 20)}</td>
                <td style={cell}>{txt(it, 'ar4Range', 'Range', 20)}</td>
                <td style={cell}><input type="text" className="grid-input" placeholder="Remarks" maxLength={250} style={inp} value={it.ar4Remarks || ''} onChange={(e) => updateItem(it.id, 'ar4Remarks', e.target.value)} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>No item has AR4 = Y.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
