// Due Agent / Due Carrier charges window (29-Oct-2026). Before, "Add" did nothing; now the rows are the AWB's
// Other Charges with entitlement agent / carrier (saved in AwbOtherCharges with the AWB), charge list from the
// Airway Bill Charges master.
import React, { useState } from 'react';
import ModalFrame, { inp, sel, lab, addBtn, th, td, delBtn } from './_ModalFrame';

export default function ChargesWindow({ isOpen, onClose, title, entitlement, charges = [], setCharges, masterCharges = [], currency }) {
  const empty = { code: '', rate: '', amount: '', ppcc: 'PP' };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  if (!isOpen) return null;
  const rows = (charges || []).map((c, idx) => ({ ...c, idx })).filter(c => c.code && String(c.entitlement || '').toLowerCase() === entitlement);
  const nameOf = (code) => { const m = masterCharges.find(x => String(x.awbChargeCode || '').toUpperCase() === String(code).toUpperCase()); return m ? (m.awbChargeName || m.chargeName || '') : ''; };
  const active = masterCharges.filter(m => m.isActive !== false && m.awbChargeCode);
  const add = () => {
    setErr('');
    const code = String(f.code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}[AC]?$/.test(code)) return setErr('Choose a charge (IATA code of 2 letters)');
    const amount = parseFloat(f.amount);
    if (!(amount > 0)) return setErr('Enter the amount');
    const row = { id: Date.now(), code, entitlement, ppcc: f.ppcc === 'CC' ? 'CC' : 'PP', amount: amount.toFixed(2), rate: f.rate, description: nameOf(code) };
    const list = [...(charges || [])];
    const blank = list.findIndex(c => !c.code);
    if (blank >= 0) list[blank] = { ...list[blank], ...row, id: list[blank].id }; else list.push(row);
    setCharges && setCharges(list);
    setF(empty);
  };
  const remove = (idx) => { const list = [...charges]; list.splice(idx, 1); setCharges && setCharges(list); };
  const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  return (
    <ModalFrame title={title} width={640} onClose={onClose} footer={`${rows.length} charge(s), total ${total.toFixed(2)} ${currency || ''} - saved with the AWB (Other Charges)`}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 70px auto', gap: '8px', alignItems: 'end', marginBottom: '8px' }}>
        <div><label style={lab}>Charge Name</label>
          <select value={f.code} onChange={e => setF({ ...f, code: e.target.value })} style={sel}>
            <option value="">Select</option>
            {active.map(m => <option key={m.id || m.awbChargeCode} value={m.awbChargeCode}>{m.awbChargeCode} - {m.awbChargeName}</option>)}
          </select>
          {active.length === 0 && <div style={{ fontSize: '10px', color: '#b45309' }}>No charges in Master &gt; Airway Bill Charges Master</div>}
        </div>
        <div><label style={lab}>Rate</label><input value={f.rate} onChange={e => setF({ ...f, rate: e.target.value.replace(/[^\d.]/g, '') })} style={inp} /></div>
        <div><label style={lab}>Amount</label><input value={f.amount} onChange={e => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} style={inp} /></div>
        <div><label style={lab}>P/C</label><select value={f.ppcc} onChange={e => setF({ ...f, ppcc: e.target.value })} style={inp}><option value="PP">P</option><option value="CC">C</option></select></div>
        <button onClick={add} style={addBtn}>+Add</button>
      </div>
      {err && <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '6px' }}>{err}</div>}
      <div style={{ border: '1px solid #000', backgroundColor: 'white', maxHeight: '240px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Code</th><th style={th}>Charge Name</th><th style={th}>Rate</th><th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={th}>P/C</th><th style={{ ...th, textAlign: 'center' }}>Delete</th></tr></thead>
          <tbody>
            {rows.map(r => <tr key={r.idx}><td style={{ ...td, fontWeight: 700 }}>{r.code}</td><td style={td}>{r.description || nameOf(r.code)}</td><td style={td}>{r.rate || ''}</td><td style={{ ...td, textAlign: 'right' }}>{r.amount}</td><td style={td}>{r.ppcc === 'CC' ? 'C' : 'P'}</td><td style={{ ...td, textAlign: 'center' }}><button style={delBtn} onClick={() => remove(r.idx)}>✕</button></td></tr>)}
            {rows.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#64748b' }}>No {entitlement} charges</td></tr>}
          </tbody>
        </table>
      </div>
    </ModalFrame>
  );
}
