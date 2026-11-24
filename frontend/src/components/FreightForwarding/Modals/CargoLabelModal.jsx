// Cargo labels - one per piece, from the saved AWB: airline, AWB number with a scannable barcode (Code 39), destination,
// total pieces, weight and the HAWB. A MAWB with houses gives each house's pieces their own labels (11-Nov-2026).
// Before: four blank boxes with a drawn "|| ||||" in place of a barcode.
import React from 'react';
import { DocWindow, Barcode39, kg } from './docKit';

function Label({ d, hawb, piece, of, pcsTotal, weight, dest }) {
  const awb = d.mawbNo || '';
  return (
    <div className="keep" style={{ border: '2px solid #000', padding: '8px 10px', height: '250px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid #000', paddingBottom: '3px' }}>
        <b style={{ fontSize: '14px' }}>{d.airline.name || 'AIRLINE'}</b><span style={{ fontSize: '11px' }}>{d.airline.code}</span>
      </div>
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>AIR WAYBILL No.</div>
      <div style={{ textAlign: 'center', fontSize: '26px', fontWeight: 'bold', letterSpacing: '1px' }}>{awb || '___-________'}</div>
      <div style={{ margin: '2px 0 4px' }}>{awb && <Barcode39 value={`${awb.replace(/\D/g, '')}${String(piece).padStart(5, '0')}`} height={38} unit={1.1} />}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid #000', paddingTop: '4px', flex: 1 }}>
        <div><div style={{ fontSize: '9px' }}>DESTINATION</div><div style={{ fontSize: '30px', fontWeight: 'bold', lineHeight: 1 }}>{dest || ''}</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '9px' }}>PIECE / TOTAL</div><div style={{ fontSize: '20px', fontWeight: 'bold' }}>{piece} / {of}</div>{pcsTotal !== of && <div style={{ fontSize: '9px' }}>AWB total {pcsTotal}</div>}</div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: '9px' }}>TOTAL WT (KG)</div><div style={{ fontSize: '16px', fontWeight: 'bold' }}>{kg(weight)}</div></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000', paddingTop: '3px', fontSize: '11px' }}>
        <span>ORIGIN <b>{d.origin.code}</b></span>{hawb && <span>HAWB <b style={{ fontSize: '13px' }}>{hawb}</b></span>}
      </div>
    </div>
  );
}

export default function CargoLabelModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  const [only, setOnly] = React.useState('');
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Cargo Labels" fileName={`Labels_${awbNumber || ''}`} awbId={awbId} awbType={awbType}
      extraButtons={<label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>Labels per piece up to <input value={only} onChange={e => setOnly(e.target.value.replace(/\D/g, ''))} placeholder="all" style={{ width: '50px', padding: '4px' }} /></label>}>
      {(d) => {
        // one group per house (MAWB with houses), else the AWB / HAWB itself
        const groups = (d.houses || []).length ? d.houses.map(h => ({ hawb: h.hawb, pcs: h.pieces || 1, wt: h.gross, dest: h.destination || d.destination.code }))
          : [{ hawb: d.hawbNo, pcs: parseInt(d.pieces, 10) || 1, wt: d.gross, dest: d.destination.code }];
        const cap = Number(only) || 500;
        const labels = [];
        groups.forEach(g => { for (let i = 1; i <= Math.min(g.pcs, cap); i++) labels.push({ ...g, piece: i }); });
        if (!d.mawbNo) return <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Save the AWB first - the labels are made from its number, pieces and destination.</div>;
        return (
          <>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>{labels.length} label(s): {groups.map(g => `${g.hawb ? 'HAWB ' + g.hawb + ': ' : ''}${g.pcs} pcs`).join(', ')}. Barcode = AWB number + piece number.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {labels.map((l, i) => <Label key={i} d={d} hawb={l.hawb} piece={l.piece} of={l.pcs} pcsTotal={d.pieces} weight={l.wt} dest={l.dest} />)}
            </div>
          </>
        );
      }}
    </DocWindow>
  );
}
