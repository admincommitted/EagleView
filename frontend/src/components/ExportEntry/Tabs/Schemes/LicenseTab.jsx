import React from 'react';
import { useExportContext } from '../../ExportContext';
import ModernDatePicker from '../../../common/ModernDatePicker';
import { num, isLicenceItem, invOf, itemNoOf } from './schemeUtils';

// Scheme > License (ICEGATE SB "LICENCE" table: registration no / date, item Sr in Part E and Part C, quantity,
// export quantity, indigenous / imported). Reworked 29-Oct-2026:
// - rows saved with the job lost their id, so they were not found again and came back empty: matched by invoice + item no;
// - "Exp Qty" and "Qty" both changed the same value: Exp Qty (export qty of the item) and Qty (qty against the licence) are separate;
// - Reg Dt is a date; Ind/Imp has Imported (M) and Indigenous (I) as in the schema (only "IMP" before);
// - more than one licence row per item (+ Row / remove); the tick boxes did nothing and were removed;
// - checks for the fields ICEGATE needs.
const th = { padding: '6px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #bae6fd' };
const cell = { padding: '3px', borderBottom: '1px solid var(--border-color, #e2e8f0)' };
const inp = { height: '26px', width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '0 5px' };
const IND_IMP = (v) => { const s = String(v || '').toUpperCase(); return s === 'I' || s.startsWith('IND') ? 'I' : 'M'; };

let seq = 0;
const newId = (itemId) => `L${itemId}-${Date.now().toString(36)}${(seq++).toString(36)}`;
const blankRow = (it, i) => ({
  id: newId(it.id), itemId: it.id, srNo: 1, invNo: invOf(it, i), itemNo: itemNoOf(it, i),
  regNo: '', regDate: '', snE: '', snC: '', qty: '', expQty: String(it.qty || it.quantity || ''), uqc: it.unit || it.uqc || 'NOS',
  expDesc: String(it.desc || it.description || '').slice(0, 60), impDesc: '', indImp: 'M', licNo: '', licDt: '', licType: 'DEEC', eoQty: '', eoVal: '',
});

export const licenceRowErrors = (r) => {
  const e = [];
  if (!String(r.regNo || '').trim()) e.push('Reg No');
  if (!r.regDate) e.push('Reg Dt');
  if (!String(r.snE || '').trim()) e.push('Sn E');
  if (!String(r.snC || '').trim()) e.push('Sn C');
  if (num(r.qty) <= 0) e.push('Qty');
  if (num(r.expQty) <= 0) e.push('Exp Qty');
  return e;
};

export default function LicenseTab() {
  const { items, licenseItems, setLicenseItems } = useExportContext();
  const licList = React.useMemo(() => (items || []).map((it, i) => ({ it, i })).filter(({ it }) => isLicenceItem(it)), [items]);

  React.useEffect(() => {
    setLicenseItems((prev) => {
      const rest = [...(prev || [])];
      const take = (fn) => { const out = []; for (let k = rest.length - 1; k >= 0; k--) if (fn(rest[k])) out.unshift(rest.splice(k, 1)[0]); return out; };
      const next = [];
      // rows are found by invoice + item no; the item id (kept while the screen is open) only finds rows of an item
      // that was renumbered (ids of saved rows come from other tables and are not compared)
      // 12-Nov-2026: by the item id first (an item / invoice deleted moved the licence rows to the next item), then by
      // invoice + item no for rows saved with the job, never taking rows of another item on the screen
      const liveIds = new Set((items || []).map((x) => x.id).filter((x) => x != null));
      licList.forEach(({ it, i }) => {
        const inv = invOf(it, i), itm = itemNoOf(it, i);
        let mine = it.id != null ? take((p) => p.itemId != null && p.itemId === it.id) : [];
        if (!mine.length) mine = take((p) => !(p.itemId != null && liveIds.has(p.itemId)) && String(p.invNo || 1) === inv && String(p.itemNo) === itm);
        if (!mine.length) mine = [blankRow(it, i)];
        mine.forEach((p, k) => {
          const r = { ...p, itemId: it.id, invNo: inv, itemNo: itm, srNo: k + 1, indImp: IND_IMP(p.indImp) };
          if (r.id == null || typeof r.id !== 'string' || !r.id.startsWith('L')) r.id = newId(it.id);
          if (r.expQty === undefined || r.expQty === '') r.expQty = String(it.qty || it.quantity || p.qty || '');
          next.push(r);
        });
      });
      const same = next.length === (prev || []).length && next.every((r, k) => prev[k] && prev[k].id === r.id && JSON.stringify({ ...r, id: 0 }) === JSON.stringify({ ...prev[k], id: 0 }));
      return same ? prev : next;
    });
  }, [licList, setLicenseItems]);

  const update = (id, field, value) => setLicenseItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const addRow = (row) => setLicenseItems((prev) => {
    const at = prev.findIndex((r) => r.id === row.id);
    const key = (r) => r.invNo + '/' + r.itemNo;
    const sameItem = prev.filter((r) => key(r) === key(row));
    const nr = { ...row, id: newId(row.itemId), srNo: sameItem.length + 1, regNo: '', regDate: '', snE: '', snC: '', qty: '', licNo: '', licDt: '', impDesc: '', eoQty: '', eoVal: '' };
    const last = prev.map(key).lastIndexOf(key(row));
    const out = [...prev]; out.splice((last >= 0 ? last : at) + 1, 0, nr); return out;
  });
  const removeRow = (row) => setLicenseItems((prev) => {
    const out = prev.filter((r) => r.id !== row.id);
    let n = 0; return out.map((r) => (r.invNo === row.invNo && r.itemNo === row.itemNo ? { ...r, srNo: ++n } : r));
  });

  const rows = licenseItems || [];
  const bad = rows.filter((r) => licenceRowErrors(r).length).length;
  const field = (r, f, extra = {}) => (
    <input type="text" className="grid-input" value={r[f] ?? ''} onChange={(e) => update(r.id, f, e.target.value)} style={{ ...inp, ...extra }} />
  );
  const req = (ok) => ({ borderColor: ok ? 'var(--border-color, #cbd5e1)' : '#ef4444' });

  return (
    <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border-color, #cbd5e1)', background: '#fff' }}>
        <table className="compact-table" style={{ width: '100%', minWidth: 1500, borderCollapse: 'collapse', fontSize: 11, textAlign: 'center' }}>
          <thead>
            <tr style={{ background: 'var(--primary-bg-light, #f0f9ff)', color: 'var(--primary-text, #0369a1)', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ ...th, width: 40 }}>Inv</th>
              <th style={{ ...th, width: 40 }}>Itm</th>
              <th style={{ ...th, width: 34 }}>Sr</th>
              <th style={{ ...th, width: 120 }}>Reg No *</th>
              <th style={{ ...th, width: 112 }}>Reg Dt *</th>
              <th style={{ ...th, width: 56 }}>Sn E *</th>
              <th style={{ ...th, width: 56 }}>Sn C *</th>
              <th style={{ ...th, width: 74 }}>Qty *</th>
              <th style={{ ...th, width: 74 }}>Exp Qty *</th>
              <th style={{ ...th, width: 50 }}>UQC</th>
              <th style={th}>Exp Item Desc</th>
              <th style={th}>Imp Item Desc</th>
              <th style={{ ...th, width: 84 }}>Ind / Imp</th>
              <th style={{ ...th, width: 100 }}>Lic No</th>
              <th style={{ ...th, width: 112 }}>Lic Dt</th>
              <th style={{ ...th, width: 70 }}>Lic Type</th>
              <th style={{ ...th, width: 64 }}>EO Qty</th>
              <th style={{ ...th, width: 74 }}>EO Val</th>
              <th style={{ ...th, width: 64 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const errs = licenceRowErrors(r);
              return (
                <tr key={r.id} style={{ background: errs.length ? '#fffbeb' : '#fff' }} title={errs.length ? 'Missing: ' + errs.join(', ') : ''}>
                  <td style={{ ...cell, fontWeight: 600, color: '#059669' }}>{r.invNo}</td>
                  <td style={{ ...cell, fontWeight: 600, color: '#0369a1' }}>{r.itemNo}</td>
                  <td style={cell}>{r.srNo}</td>
                  <td style={cell}>{field(r, 'regNo', req(String(r.regNo || '').trim()))}</td>
                  <td style={cell}><ModernDatePicker value={r.regDate || ''} onChange={(e) => update(r.id, 'regDate', e.target.value)} className="grid-input" style={{ ...inp, ...req(r.regDate) }} /></td>
                  <td style={cell}>{field(r, 'snE', req(String(r.snE || '').trim()))}</td>
                  <td style={cell}>{field(r, 'snC', req(String(r.snC || '').trim()))}</td>
                  <td style={cell}>{field(r, 'qty', { textAlign: 'right', ...req(num(r.qty) > 0) })}</td>
                  <td style={cell}>{field(r, 'expQty', { textAlign: 'right', ...req(num(r.expQty) > 0) })}</td>
                  <td style={cell}>{field(r, 'uqc', { background: '#f0fdf4' })}</td>
                  <td style={cell}>{field(r, 'expDesc', { minWidth: 140 })}</td>
                  <td style={cell}>{field(r, 'impDesc', { minWidth: 140 })}</td>
                  <td style={cell}>
                    <select className="grid-input" value={IND_IMP(r.indImp)} onChange={(e) => update(r.id, 'indImp', e.target.value)} style={inp}>
                      <option value="M" title="Imported">M - Imp</option>
                      <option value="I" title="Indigenous">I - Ind</option>
                    </select>
                  </td>
                  <td style={cell}>{field(r, 'licNo')}</td>
                  <td style={cell}><ModernDatePicker value={r.licDt || ''} onChange={(e) => update(r.id, 'licDt', e.target.value)} className="grid-input" style={inp} /></td>
                  <td style={cell}>
                    <select className="grid-input" value={r.licType || 'DEEC'} onChange={(e) => update(r.id, 'licType', e.target.value)} style={inp}>
                      <option value="DEEC">DEEC</option><option value="EPCG">EPCG</option><option value="DFIA">DFIA</option>
                    </select>
                  </td>
                  <td style={cell}>{field(r, 'eoQty', { textAlign: 'right' })}</td>
                  <td style={cell}>{field(r, 'eoVal', { textAlign: 'right' })}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    <button type="button" title="Another licence row for this item" onClick={() => addRow(r)} style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', borderRadius: 3, fontSize: 11, padding: '1px 6px', cursor: 'pointer' }}>+</button>
                    {r.srNo > 1 && <button type="button" title="Remove this licence row" onClick={() => removeRow(r)} style={{ marginLeft: 3, border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', borderRadius: 3, fontSize: 11, padding: '1px 6px', cursor: 'pointer' }}>×</button>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={19} style={{ padding: 16, color: '#64748b' }}>No item has a licence scheme code.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: '0.5rem', background: 'var(--bg-panel, #e0f2fe)', padding: '0.4rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 11 }}>
        <span style={{ color: bad ? '#b45309' : '#047857', fontWeight: 600 }}>{bad ? `${bad} row(s) incomplete` : `${rows.length} row(s) complete`}</span>
        <span style={{ color: '#64748b' }}>* Sent to ICEGATE: Reg No, Reg Dt, Sn E / Sn C (item Sr in Part E / C), Qty, Exp Qty, Ind/Imp. Lic No, type and EO are for your records.</span>
      </div>
    </div>
  );
}
