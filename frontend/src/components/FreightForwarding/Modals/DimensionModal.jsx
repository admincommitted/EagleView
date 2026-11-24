import React, { useEffect, useState } from 'react';
import { volWtFromDims, cbmFromDims, divisorOf, chargeableOf } from '../awb/weightCalc';

// Dimension window (rebuilt 29-Oct-2026). Before: it always opened empty (the saved dimensions were lost when it was
// opened again), the "Save & Update Chargeable Wt" button only closed it, rows could not be removed, and the divisor was
// fixed. Now it opens with the AWB's dimensions, uses the ratio of the screen (IATA 1:6 = 6000 cm3 per kg) and both
// buttons apply. The volumetric weight is worked out by weightCalc.js, the same as the rate lines.
const num = (v) => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
const toRow = (d, i) => ({ id: d.id || `${Date.now()}-${i}`, length: num(d.length ?? d.len), width: num(d.width ?? d.wid), height: num(d.height ?? d.ht),
  pkgs: parseInt(d.pkgs ?? d.pcs ?? d.pieces ?? d.noOfUnits, 10) || 1, unit: /^IN/i.test(String(d.unit || d.cmIn || '')) ? 'INCH' : 'CMT' });

const DimensionModal = ({ isOpen, onClose, onSave, initialDims, densityGroup }) => {
  const [dims, setDims] = useState([]);
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [pkgs, setPkgs] = useState('');
  const [unit, setUnit] = useState('CMT');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setDims((Array.isArray(initialDims) ? initialDims : []).map(toRow).filter(d => d.length && d.width && d.height));
    setLength(''); setWidth(''); setHeight(''); setPkgs(''); setErr('');
  }, [isOpen]); // eslint-disable-line

  if (!isOpen) return null;
  const divisor = divisorOf(densityGroup);
  const rowVol = (d) => volWtFromDims([d], densityGroup);

  const handleAdd = () => {
    const l = num(length), w = num(width), h = num(height), p = parseInt(pkgs, 10);
    if (!(l > 0 && w > 0 && h > 0 && p > 0)) { setErr('Enter length, width, height and pieces (all more than 0)'); return; }
    setErr('');
    setDims([...dims, { id: Date.now(), length: l, width: w, height: h, pkgs: p, unit }]);
    setLength(''); setWidth(''); setHeight(''); setPkgs('');
  };
  const totalVolWt = +volWtFromDims(dims, densityGroup).toFixed(2);
  const apply = () => { if (onSave) onSave(dims, totalVolWt); onClose(); };
  const inp = { width: '100%', padding: '4px', border: '1px solid #64748b', fontSize: '12px', boxSizing: 'border-box' };
  const keyAdd = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#eef2f6', border: '1px solid #000000', borderRadius: '4px', width: '640px', maxWidth: 'calc(100vw - 24px)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
        <div style={{ backgroundColor: 'var(--primary-bg-light, #e0f2fe)', padding: '6px 12px', borderBottom: '1px solid #94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', color: 'var(--text-main, #0f172a)', fontSize: '13px' }}>Dimensions</span>
          <button type="button" onClick={onClose} title="Close without applying" style={{ background: 'white', border: '1px solid #64748b', cursor: 'pointer', padding: '0 6px', fontSize: '12px' }}>✕</button>
        </div>

        <div style={{ padding: '8px' }}>
          <div style={{ marginBottom: '8px', color: 'var(--primary-text, #0369a1)', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#f0f9ff', padding: '4px 8px', borderRadius: '2px', border: '1px solid #bae6fd' }}>
            Volumetric weight = L x W x H x pieces / {divisor} (cm, ratio {densityGroup && /^1:/.test(densityGroup) ? densityGroup : '1:6'}); inches are converted to cm. Chargeable weight is rounded up to the next 0.5 kg.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'end', marginBottom: '8px' }}>
            <div><label style={{ fontSize: '11px', display: 'block' }}>Length</label><input type="number" min="0" value={length} onChange={e => setLength(e.target.value)} onKeyDown={keyAdd} style={inp} /></div>
            <div><label style={{ fontSize: '11px', display: 'block' }}>Width</label><input type="number" min="0" value={width} onChange={e => setWidth(e.target.value)} onKeyDown={keyAdd} style={inp} /></div>
            <div><label style={{ fontSize: '11px', display: 'block' }}>Height</label><input type="number" min="0" value={height} onChange={e => setHeight(e.target.value)} onKeyDown={keyAdd} style={inp} /></div>
            <div><label style={{ fontSize: '11px', display: 'block' }}>Pieces</label><input type="number" min="1" value={pkgs} onChange={e => setPkgs(e.target.value)} onKeyDown={keyAdd} style={inp} /></div>
            <div><label style={{ fontSize: '11px', display: 'block' }}>Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)} style={inp}><option value="CMT">CMT</option><option value="INCH">INCH</option></select>
            </div>
            <button type="button" onClick={handleAdd} style={{ backgroundColor: 'var(--primary-color-end, #2563eb)', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>+Add</button>
          </div>
          {err && <div style={{ color: '#b91c1c', fontSize: '11px', marginBottom: '6px' }}>{err}</div>}

          <div style={{ border: '1px solid #64748b', backgroundColor: 'white', minHeight: '100px', maxHeight: '180px', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1.2fr 1fr 30px', backgroundColor: '#dbeafe', padding: '4px 8px', borderBottom: '1px solid #94a3b8', fontWeight: 'bold', fontSize: '12px', color: '#1e40af' }}>
              <div>Length</div><div>Width</div><div>Height</div><div>Pieces</div><div>Unit</div><div>CBM</div><div>Vol Wt (kg)</div><div />
            </div>
            {dims.map(d => (
              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1.2fr 1fr 30px', padding: '4px 8px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', alignItems: 'center' }}>
                <div>{d.length}</div><div>{d.width}</div><div>{d.height}</div><div>{d.pkgs}</div><div>{d.unit}</div>
                <div>{cbmFromDims([d]).toFixed(3)}</div>
                <div style={{ fontWeight: 'bold', color: '#047857' }}>{rowVol(d).toFixed(2)}</div>
                <button type="button" title="Remove" onClick={() => setDims(dims.filter(x => x.id !== d.id))} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>
            ))}
            {!dims.length && <div style={{ padding: '10px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>No dimension line yet</div>}
          </div>

          <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff', border: '1px solid #64748b', display: 'flex', justifyContent: 'flex-end', gap: '16px', fontSize: '12px', flexWrap: 'wrap' }}>
            <div>Pieces: <strong>{dims.reduce((a, c) => a + c.pkgs, 0)}</strong></div>
            <div>Volume: <strong>{cbmFromDims(dims).toFixed(3)} CBM</strong></div>
            <div style={{ color: '#047857' }}>Volumetric Wt: <strong>{totalVolWt.toFixed(2)} kg</strong></div>
            <div>Chargeable if gross is lower: <strong>{chargeableOf(0, totalVolWt).toFixed(2)} kg</strong></div>
          </div>
        </div>

        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: 'var(--primary-bg-light, #e0f2fe)', borderTop: '1px solid #94a3b8' }}>
          <button type="button" onClick={onClose} style={{ padding: '6px 12px', background: '#fff', color: '#334155', border: '1px solid #94a3b8', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>CANCEL</button>
          <button type="button" onClick={apply} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>APPLY - UPDATE VOL &amp; CHARGEABLE WT</button>
        </div>
      </div>
    </div>
  );
};

export default DimensionModal;
