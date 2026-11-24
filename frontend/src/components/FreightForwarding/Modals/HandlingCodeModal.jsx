// Handling (SPH) codes window. 29-Oct-2026: "Add" did nothing and the list was always empty; now the codes are the
// AWB's SPH codes (saved with the AWB, max 9), picked from the SPH master.
import React, { useState } from 'react';
import ModalFrame, { sel, addBtn, th, td, delBtn } from './_ModalFrame';

const HandlingCodeModal = ({ isOpen, onClose, codes = [], setCodes, masterSph = [] }) => {
  const [pick, setPick] = useState('');
  const [err, setErr] = useState('');
  if (!isOpen) return null;
  const list = (codes || []).filter(Boolean);
  const descOf = (c) => (masterSph.find(m => m.code === c) || {}).description || '';
  const write = (next) => { const nine = [...next.slice(0, 9)]; while (nine.length < 9) nine.push(''); setCodes && setCodes(nine); };
  const add = () => {
    setErr('');
    if (!pick) return setErr('Choose a handling code');
    if (list.includes(pick)) return setErr(`${pick} is already added`);
    if (list.length >= 9) return setErr('An AWB can have at most 9 SPH codes');
    write([...list, pick]); setPick('');
  };
  return (
    <ModalFrame title="Add Handling Code" width={520} onClose={onClose} footer={`${list.length} of 9 codes - saved with the AWB`}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <select value={pick} onChange={e => setPick(e.target.value)} style={{ ...sel, flex: 1 }}>
          <option value="">Select</option>
          {masterSph.map(m => <option key={m.code} value={m.code}>{m.code} - {m.description}</option>)}
        </select>
        <button onClick={add} style={addBtn}>+Add</button>
      </div>
      {err && <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '6px' }}>{err}</div>}
      <div style={{ border: '1px solid #000', backgroundColor: 'white', maxHeight: '220px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...th, width: '60px' }}>Code</th><th style={th}>Description</th><th style={{ ...th, width: '50px', textAlign: 'center' }}>Delete</th></tr></thead>
          <tbody>
            {list.map(c => <tr key={c}><td style={{ ...td, fontWeight: 700 }}>{c}</td><td style={td}>{descOf(c)}</td><td style={{ ...td, textAlign: 'center' }}><button style={delBtn} onClick={() => write(list.filter(x => x !== c))}>✕</button></td></tr>)}
            {list.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: '#64748b' }}>No handling codes</td></tr>}
          </tbody>
        </table>
      </div>
    </ModalFrame>
  );
};

export default HandlingCodeModal;
