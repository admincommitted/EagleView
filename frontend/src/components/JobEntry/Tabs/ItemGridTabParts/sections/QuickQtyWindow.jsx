// Quick Quantity Entry for an Ex-Bond BE (22-Nov-2026).
// An ex-bond clears part of its warehouse BE, so the work is "type the quantity of each item". Through the item form
// that is: open the item, type, MODIFY, wait - 200 times. Here every item is one row with its warehouse balance; the
// quantities are typed down the column (Enter / Down = next row) or pasted from Excel, and written in one go.
//   items            - the job's items
//   onApply(qtyById) - { [item.id]: quantity typed } for the rows that changed
//   onClose()
import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ClipboardPaste, Check, RotateCcw } from 'lucide-react';

const C = { accent: '#7c3aed', accentDark: '#6d28d9', accentSoft: '#f5f3ff', accentLine: '#ddd6fe', text: 'var(--text-main, #0f172a)', muted: 'var(--text-muted, #64748b)',
  line: 'var(--border-color, #e2e8f0)', panel: 'var(--bg-panel, #ffffff)', soft: 'var(--bg-input, #f8fafc)', red: '#b91c1c', redSoft: '#fee2e2', green: '#166534', greenSoft: '#dcfce7' };
const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : null; };
const show = (v) => (v === null || v === undefined ? '' : String(Math.round(v * 1e6) / 1e6));
const btn = { padding: '6px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' };

export default function QuickQtyWindow({ items, onApply, onClose }) {
  const rows = useMemo(() => (items || []).map(it => ({ id: it.id, inv: String(it.invSrNo || '1'), sr: String(it.itemSrNo || it.itemNo || ''), desc: it.desc || it.productDescription || it.genericDesc || '',
    unit: it.unit || it.uqc || '', was: String(it.qty || it.quantity || ''), bal: num(it._whBalanceQty) })), [items]);
  const [typed, setTyped] = useState({});      // id -> text in the box (only rows that were touched)
  const [paste, setPaste] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [note, setNote] = useState('');
  const boxes = useRef({});
  const manyInv = new Set(rows.map(r => r.inv)).size > 1;
  const valOf = (r) => (r.id in typed ? typed[r.id] : r.was);
  const state = (r) => { const t = valOf(r); const q = num(t); if (String(t).trim() === '' || q === null || q < 0) return 'bad'; if (r.bal !== null && q > r.bal + 1e-6) return 'over'; return num(r.was) === q ? 'same' : 'changed'; };
  const counts = rows.reduce((c, r) => { c[state(r)]++; return c; }, { same: 0, changed: 0, over: 0, bad: 0 });
  const focusRow = (k) => { const r = rows[k]; const e = r && boxes.current[r.id]; if (e) { e.focus(); e.select(); } };
  const fillFromPaste = () => {
    // rows of "Item Sr No <tab> Quantity" (or "Inv Sr No, Item Sr No, Quantity" on a job with several invoices)
    const next = { ...typed }; let hit = 0; const miss = [];
    paste.split(/\r?\n/).forEach(line => {
      const p = line.split(/[\t;]|,(?=\s*\d)|\s{2,}|\s+(?=\S+$)/).map(s => s.trim()).filter(s => s !== ''); if (p.length < 2) return;
      const q = num(p[p.length - 1]); const sr = String(parseInt(p[p.length - 2], 10)); const inv = p.length >= 3 ? String(parseInt(p[p.length - 3], 10)) : null;
      if (q === null || sr === 'NaN') return; // a heading row
      const r = rows.filter(x => String(parseInt(x.sr, 10)) === sr && (inv === null || x.inv === inv));
      if (r.length === 1) { next[r[0].id] = show(q); hit++; } else miss.push(sr);
    });
    setTyped(next);
    setNote(hit || miss.length ? `${hit} quantity(ies) filled from the paste` + (miss.length ? ` - not matched to one item: Item Sr No ${miss.slice(0, 10).join(', ')}${miss.length > 10 ? ' ...' : ''}` : '') : 'Nothing read - paste two columns: Item Sr No and Quantity');
    if (hit) setPasteOpen(false);
  };
  const apply = () => {
    if (counts.over || counts.bad) { const k = rows.findIndex(r => ['over', 'bad'].includes(state(r))); focusRow(k); return; }
    const out = {}; rows.forEach(r => { if (state(r) === 'changed') out[r.id] = show(num(valOf(r))); });
    onApply(out);
  };
  const cell = { padding: '3px 8px', borderBottom: '1px solid ' + C.line, fontSize: '12px', whiteSpace: 'nowrap' };
  const head = { ...cell, position: 'sticky', top: 0, background: C.accentSoft, color: C.accentDark, fontWeight: 700, borderBottom: '1px solid ' + C.accentLine, zIndex: 1 };
  return createPortal(
    <div data-quick-qty style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div style={{ width: 'min(880px, 96vw)', maxHeight: '90vh', background: C.panel, color: C.text, borderRadius: '10px', boxShadow: '0 20px 50px rgba(15,23,42,0.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid ' + C.line }}>
          <div style={{ fontSize: '14px', fontWeight: 800 }}>Quick Quantity Entry</div>
          <div style={{ fontSize: '11.5px', color: C.muted }}>{rows.length} item(s) - type down the column (Enter = next row) or paste from Excel</div>
          <button type="button" onClick={onClose} title="Close without changing anything" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
        </div>
        <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid ' + C.line, background: C.soft }}>
          <button type="button" onClick={() => setPasteOpen(o => !o)} style={{ ...btn, background: C.panel, color: C.accentDark, border: '1px solid ' + C.accentLine }}><ClipboardPaste size={14} /> Paste from Excel</button>
          <button type="button" onClick={() => { setTyped({}); setNote(''); }} style={{ ...btn, background: C.panel, color: C.text, border: '1px solid ' + C.line }} title="Every box back to the quantity saved on the job"><RotateCcw size={14} /> Undo typing</button>
          <span style={{ fontSize: '12px', fontWeight: 700, color: C.green }}>{counts.changed} changed</span>
          {counts.over > 0 && <span style={{ fontSize: '12px', fontWeight: 700, color: C.red }}>{counts.over} over the warehouse balance</span>}
          {counts.bad > 0 && <span style={{ fontSize: '12px', fontWeight: 700, color: C.red }}>{counts.bad} not a quantity</span>}
          {note && <span style={{ fontSize: '11.5px', color: C.muted }}>{note}</span>}
        </div>
        {pasteOpen && (
          <div style={{ padding: '8px 14px', borderBottom: '1px solid ' + C.line, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <textarea autoFocus value={paste} onChange={e => setPaste(e.target.value)} placeholder={manyInv ? 'Copy three columns in Excel and paste here:\nInv Sr No   Item Sr No   Quantity' : 'Copy two columns in Excel and paste here:\nItem Sr No   Quantity'}
              style={{ flex: 1, height: '92px', fontFamily: 'Consolas, monospace', fontSize: '12px', padding: '6px 8px', border: '1px solid ' + C.accentLine, borderRadius: '6px', resize: 'vertical', color: '#0f172a', background: '#fff' }} />
            <button type="button" onClick={fillFromPaste} style={{ ...btn, background: C.accent, color: '#fff', border: '1px solid ' + C.accent }}>Fill the boxes</button>
          </div>
        )}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {manyInv && <th style={{ ...head, textAlign: 'left' }}>Inv</th>}
              <th style={{ ...head, textAlign: 'left' }}>Item Sr</th><th style={{ ...head, textAlign: 'left', width: '100%' }}>Description</th><th style={{ ...head, textAlign: 'left' }}>Unit</th>
              <th style={{ ...head, textAlign: 'right' }} title="Quantity still in the warehouse (WH BE quantity less what filed ex-bonds cleared)">WH Bal</th>
              <th style={{ ...head, textAlign: 'right' }}>Saved Qty</th><th style={{ ...head, textAlign: 'right' }}>Quantity</th>
              <th style={{ ...head, textAlign: 'right' }} title="WH balance less the quantity typed">Left</th>
            </tr></thead>
            <tbody>
              {rows.map((r, k) => { const st = state(r); const q = num(valOf(r)); const left = r.bal === null || q === null ? null : Math.round((r.bal - q) * 1e6) / 1e6; const bad = st === 'over' || st === 'bad';
                return (
                  <tr key={r.id} style={{ background: bad ? C.redSoft : st === 'changed' ? C.greenSoft : undefined }}>
                    {manyInv && <td style={cell}>{r.inv}</td>}
                    <td style={{ ...cell, fontWeight: 700 }}>{r.sr}</td>
                    <td style={{ ...cell, maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.desc}>{r.desc}</td>
                    <td style={cell}>{r.unit}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{show(r.bal)}</td>
                    <td style={{ ...cell, textAlign: 'right', color: C.muted }}>{r.was}</td>
                    <td style={{ ...cell, textAlign: 'right', padding: '2px 6px' }}>
                      <input ref={e => { boxes.current[r.id] = e; }} data-qq-sr={r.sr} type="text" inputMode="decimal" value={valOf(r)} autoFocus={k === 0}
                        onFocus={e => e.target.select()} onChange={e => setTyped(t => ({ ...t, [r.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusRow(Math.min(rows.length - 1, k + 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(Math.max(0, k - 1)); } }}
                        style={{ width: '96px', textAlign: 'right', padding: '3px 6px', fontSize: '12px', fontWeight: 700, color: bad ? C.red : '#0f172a', background: '#fff', border: '1px solid ' + (bad ? '#f87171' : st === 'changed' ? '#4ade80' : '#cbd5e1'), borderRadius: '4px' }} />
                    </td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 700, color: left !== null && left < 0 ? C.red : undefined }}>{st === 'over' ? 'over by ' + show(-left) : show(left)}</td>
                  </tr>); })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid ' + C.line }}>
          <span style={{ fontSize: '11.5px', color: C.muted }}>Value and the duty estimate of each changed item follow its quantity. The job is saved when you press the button.</span>
          <button type="button" onClick={onClose} style={{ ...btn, marginLeft: 'auto', background: C.panel, color: C.text, border: '1px solid ' + C.line }}>Close</button>
          <button type="button" onClick={apply} disabled={!counts.changed && !counts.over && !counts.bad} style={{ ...btn, background: counts.over || counts.bad ? C.red : C.accent, color: '#fff', border: '1px solid transparent', opacity: !counts.changed && !counts.over && !counts.bad ? 0.5 : 1 }}>
            <Check size={14} /> {counts.over || counts.bad ? 'Show the first wrong row' : `Write ${counts.changed} quantity(ies) and save`}</button>
        </div>
      </div>
    </div>, document.body);
}
