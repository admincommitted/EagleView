// Time and temperature sensitive cargo instruction - filled from the saved AWB; the range is ticked from its special
// handling codes (COL / CRT / FRO / ERT, ICE for dry ice) (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Tx, Ck, box, cap, title, Letterhead, Sign, dmy, kg, flightText } from './docKit';

export default function TemperatureControlModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Temperature Control Instructions" fileName={`Temperature_${awbNumber || ''}`} awbId={awbId} awbType={awbType}>
      {(d) => {
        const s = new Set(d.shc || []);
        return (
          <>
            <Letterhead c={d.company} small />
            <h1 style={title}>TIME AND TEMPERATURE SENSITIVE CARGO</h1>
            <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '8px' }}>Shipper's instructions (IATA TCR chapter 17)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
              <tr>
                <td style={box}><span style={cap}>Air Waybill No.</span><In name="awb" v={d.mawbNo || awbNumber} /></td>
                <td style={box}><span style={cap}>HAWB No.</span><In name="hawb" v={d.hawbNo} /></td>
                <td style={box}><span style={cap}>Origin</span><In name="org" v={d.origin.code} /></td>
                <td style={box}><span style={cap}>Destination</span><In name="dst" v={d.destination.code} /></td>
              </tr>
              <tr>
                <td style={box} colSpan={2}><span style={cap}>Shipper</span><In name="shipper" v={d.shipper.name} /></td>
                <td style={box} colSpan={2}><span style={cap}>Consignee</span><In name="consignee" v={d.consignee.name} /></td>
              </tr>
              <tr>
                <td style={box}><span style={cap}>Pieces</span><In name="pcs" v={d.pieces} /></td>
                <td style={box}><span style={cap}>Gross weight (kg)</span><In name="gw" v={kg(d.gross)} /></td>
                <td style={box} colSpan={2}><span style={cap}>Flight / date</span><In name="flight" v={flightText(d)} /></td>
              </tr>
              <tr><td style={box} colSpan={4}><span style={cap}>Goods</span><In name="goods" v={String(d.goods || '').split('\n')[0]} /></td></tr>
            </tbody></table>
            <div style={{ ...box, marginTop: '8px' }}>
              <span style={cap}>Temperature range required</span>
              <Ck name="col" on={s.has('COL')} label="COL  +2 to +8 °C" /><Ck name="crt" on={s.has('CRT')} label="CRT  +15 to +25 °C" /><Ck name="ert" on={s.has('ERT')} label="ERT  +2 to +25 °C" /><Ck name="fro" on={s.has('FRO')} label="FRO  -20 °C or below" />
              <div style={{ marginTop: '6px' }}>Other range: <In name="range" v="" w="200px" /></div>
            </div>
            <div style={{ ...box, marginTop: '8px' }}>
              <span style={cap}>Packaging and cooling</span>
              <Ck name="ice" on={s.has('ICE')} label="Dry ice (UN 1845)" /><Ck name="gel" on={false} label="Gel packs" /><Ck name="active" on={false} label="Active container" /><Ck name="passive" on={false} label="Passive / insulated box" />
              <div style={{ marginTop: '6px' }}>Dry ice per package (kg): <In name="iceKg" v="" w="90px" />   Data logger No.: <In name="logger" v="" w="140px" /></div>
            </div>
            <div style={{ marginTop: '8px' }}><span style={cap}>Instructions during transit / on delay</span><Tx name="instr" v="" rows={3} /></div>
            <div style={{ marginTop: '6px' }}><span style={cap}>24 x 7 emergency contact (name and phone)</span><In name="emergency" v="" /></div>
            <Sign left={`Shipper: ${d.shipper.name || ''}`} right={`Signature and date ${dmy(d.today)}`} />
          </>
        );
      }}
    </DocWindow>
  );
}
