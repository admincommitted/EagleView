// Commodity-wise break-up of the shipment (29-Oct-2026). Before, "Add" did nothing. The rows are kept with the AWB
// (extra document COMMODITY in table AwbExtraDocs).
import React, { useState } from 'react';
import ModalFrame, { inp, sel, lab, addBtn, th, td, delBtn } from './_ModalFrame';

const COMMODITIES = ['GENERAL CARGO', 'GARMENTS', 'TEXTILES', 'PHARMACEUTICALS', 'ELECTRONICS', 'MACHINERY PARTS', 'AIRCRAFT PARTS', 'AUTOMOBILE PARTS', 'LEATHER GOODS', 'HANDICRAFTS', 'GEMS & JEWELLERY', 'PERISHABLES', 'DOCUMENTS', 'CHEMICALS (NON-DG)', 'OTHERS'];

const CommodityModal = ({ isOpen, onClose, rows = [], setRows }) => {
  const empty = { commodity: '', pkgs: '', grossWt: '', chgWt: '' };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState('');
  if (!isOpen) return null;
  const num = (v) => String(v || '').replace(/[^\d.]/g, '');
  const add = () => {
    setErr('');
    if (!f.commodity.trim()) return setErr('Choose or type the commodity');
    if (!(parseInt(f.pkgs, 10) > 0)) return setErr('Enter the number of packages');
    if (!(parseFloat(f.grossWt) > 0)) return setErr('Enter the gross weight');
    setRows && setRows([...(rows || []), { ...f, commodity: f.commodity.trim().toUpperCase(), id: Date.now() }]);
    setF(empty);
  };
  const tot = (k) => (rows || []).reduce((s, r) => s + (parseFloat(r[k]) || 0), 0);
  return (
    <ModalFrame title="Commodity" width={620} onClose={onClose} footer={`Total: ${tot('pkgs')} pkgs, Gr.Wt ${tot('grossWt').toFixed(2)}, Chg.Wt ${tot('chgWt').toFixed(2)} - saved with the AWB`}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'end', marginBottom: '8px' }}>
        <div><label style={lab}>Commodity</label>
          <input list="awb-commodity-list" value={f.commodity} onChange={e => setF({ ...f, commodity: e.target.value })} style={sel} placeholder="Select or type" />
          <datalist id="awb-commodity-list">{COMMODITIES.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <div><label style={lab}>Pkgs</label><input value={f.pkgs} onChange={e => setF({ ...f, pkgs: num(e.target.value).replace('.', '') })} style={inp} /></div>
        <div><label style={lab}>Gr.Wt</label><input value={f.grossWt} onChange={e => setF({ ...f, grossWt: num(e.target.value) })} style={inp} /></div>
        <div><label style={lab}>Chg.Wt</label><input value={f.chgWt} onChange={e => setF({ ...f, chgWt: num(e.target.value) })} style={inp} /></div>
        <button onClick={add} style={addBtn}>+Add</button>
      </div>
      {err && <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '6px' }}>{err}</div>}
      <div style={{ border: '1px solid #000', backgroundColor: 'white', maxHeight: '240px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>#</th><th style={th}>Commodity</th><th style={{ ...th, textAlign: 'right' }}>Pkgs</th><th style={{ ...th, textAlign: 'right' }}>Gr.Wt</th><th style={{ ...th, textAlign: 'right' }}>Chg.Wt</th><th style={{ ...th, textAlign: 'center' }}>Delete</th></tr></thead>
          <tbody>
            {(rows || []).map((r, i) => <tr key={r.id || i}><td style={td}>{i + 1}</td><td style={td}>{r.commodity}</td><td style={{ ...td, textAlign: 'right' }}>{r.pkgs}</td><td style={{ ...td, textAlign: 'right' }}>{r.grossWt}</td><td style={{ ...td, textAlign: 'right' }}>{r.chgWt}</td>
              <td style={{ ...td, textAlign: 'center' }}><button style={delBtn} onClick={() => setRows && setRows(rows.filter((_, k) => k !== i))}>✕</button></td></tr>)}
            {(!rows || rows.length === 0) && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#64748b' }}>No commodity lines</td></tr>}
          </tbody>
        </table>
      </div>
    </ModalFrame>
  );
};

export default CommodityModal;
