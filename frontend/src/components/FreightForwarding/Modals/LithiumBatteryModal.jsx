// Lithium battery declaration (Section II) - filled from the saved AWB; the battery type is ticked from its special
// handling codes (ELI = lithium ion, ELM = lithium metal) (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Ck, box, cap, title, Letterhead, Sign, dmy, kg } from './docKit';

export default function LithiumBatteryModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Lithium Battery Declaration" fileName={`Lithium_${awbNumber || ''}`} awbId={awbId} awbType={awbType}>
      {(d) => {
        const s = new Set(d.shc || []);
        return (
          <>
            <Letterhead c={d.company} small />
            <h1 style={title}>LITHIUM BATTERY DECLARATION</h1>
            <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '10px' }}>Lithium batteries shipped under Section II of the IATA Dangerous Goods Regulations (PI 965-970)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
              <tr>
                <td style={box}><span style={cap}>Air Waybill No.</span><In name="awb" v={d.mawbNo || awbNumber} /></td>
                <td style={box}><span style={cap}>HAWB No.</span><In name="hawb" v={d.hawbNo} /></td>
                <td style={box}><span style={cap}>Origin / destination</span><In name="route" v={[d.origin.code, d.destination.code].filter(Boolean).join(' - ')} /></td>
              </tr>
              <tr>
                <td style={box} colSpan={2}><span style={cap}>Shipper</span><In name="shipper" v={d.shipper.name} /></td>
                <td style={box}><span style={cap}>Pieces / gross kg</span><In name="pcs" v={d.pieces ? `${d.pieces} / ${kg(d.gross)}` : ''} /></td>
              </tr>
              <tr><td style={box} colSpan={3}><span style={cap}>Goods</span><In name="goods" v={String(d.goods || '').split('\n')[0]} /></td></tr>
            </tbody></table>
            <div style={{ ...box, marginTop: '8px', lineHeight: 2 }}>
              <span style={cap}>The packages contain</span>
              <div><Ck name="un3480" on={false} label="UN 3480 - lithium ion batteries (PI 965)" /></div>
              <div><Ck name="un3481" on={s.has('ELI')} label="UN 3481 - lithium ion batteries packed with / contained in equipment (PI 966 / 967)" /></div>
              <div><Ck name="un3090" on={false} label="UN 3090 - lithium metal batteries (PI 968)" /></div>
              <div><Ck name="un3091" on={s.has('ELM')} label="UN 3091 - lithium metal batteries packed with / contained in equipment (PI 969 / 970)" /></div>
              <div style={{ marginTop: '4px' }}>Packing instruction: <In name="pi" v="" w="80px" />   Watt-hour rating / lithium content per cell or battery: <In name="wh" v="" w="120px" /></div>
            </div>
            <div style={{ fontSize: '10.5px', marginTop: '10px', lineHeight: 1.5 }}>
              <div>- The packages are marked with the lithium battery mark.</div>
              <div>- Handle with care: a flammability hazard exists if a package is damaged.</div>
              <div>- If a package is damaged, inspect and repack it before it travels on.</div>
              <div>- The shipment complies with Section II of the applicable packing instruction.</div>
            </div>
            <div style={{ marginTop: '10px' }}>Emergency contact (24 hours): <In name="emergency" v="" w="60%" /></div>
            <Sign left={`Name of shipper: ${d.shipper.name || ''}`} right={`Signature and date ${dmy(d.today)}`} />
          </>
        );
      }}
    </DocWindow>
  );
}
