// Cargo Charges Correction Advice (CCA) - the "as issued" side comes from the saved AWB; the revised side is typed.
// After the flight has left, corrections to a sent AWB go to the airline this way (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Tx, box, cap, title, Letterhead, Sign, dmy, kg, money, flightText } from './docKit';

export default function CCAModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Cargo Charges Correction Advice" fileName={`CCA_${awbNumber || ''}`} awbId={awbId} awbType={awbType}>
      {(d) => {
        const c = d.charges || {}; const l0 = (d.lines || [])[0] || {};
        const pp = /^P/i.test(d.chargeCode || 'P');
        const rows = [
          ['Pieces', d.pieces], ['Gross weight (kg)', kg(d.gross)], ['Chargeable weight (kg)', kg(d.chargeable)], ['Rate class', l0.rateClass], ['Rate / charge', l0.rate ? money(l0.rate) : ''],
          ['Weight charge', money(pp ? c.weightPP : c.weightCC)], ['Valuation charge', money(pp ? c.valPP : c.valCC)], ['Tax', money(pp ? c.taxPP : c.taxCC)],
          ['Other charges due agent', money(pp ? c.agentPP : c.agentCC)], ['Other charges due carrier', money(pp ? c.carrierPP : c.carrierCC)],
          [`Total ${pp ? 'prepaid' : 'collect'}`, money(pp ? c.totalPP : c.totalCC)], ['Currency', d.currency], ['Prepaid / collect', d.chargeCode],
        ];
        return (
          <>
            <Letterhead c={d.company} small />
            <h1 style={title}>CARGO CHARGES CORRECTION ADVICE (CCA)</h1>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}><tbody>
              <tr>
                <td style={box}><span style={cap}>Air Waybill No.</span><In name="awb" v={d.mawbNo || awbNumber} /></td>
                <td style={box}><span style={cap}>HAWB No.</span><In name="hawb" v={d.hawbNo} /></td>
                <td style={box}><span style={cap}>CCA No.</span><In name="ccaNo" v="" /></td>
                <td style={box}><span style={cap}>CCA date</span><In name="ccaDate" v={dmy(d.today)} /></td>
              </tr>
              <tr>
                <td style={box}><span style={cap}>Issuing carrier</span><In name="carrier" v={d.airline.name} /></td>
                <td style={box}><span style={cap}>Origin / destination</span><In name="route" v={[d.origin.code, d.destination.code].filter(Boolean).join(' - ')} /></td>
                <td style={box}><span style={cap}>Flight / date</span><In name="flight" v={flightText(d)} /></td>
                <td style={box}><span style={cap}>AWB date</span><In name="awbDate" v={dmy(d.executed.date || d.date)} /></td>
              </tr>
              <tr><td style={box} colSpan={4}><span style={cap}>To (station / office)</span><In name="to" v={d.destination.code ? `${d.airline.name || 'AIRLINE'} - ${d.destination.code}` : ''} /></td></tr>
            </tbody></table>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead><tr>{['Item', 'As issued (from the AWB)', 'Revised'].map(h => <th key={h} style={{ ...box, background: '#eef2f7', textAlign: 'left', fontSize: '10px' }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(([k, v], i) => (
                <tr key={k}><td style={{ ...box, width: '34%' }}>{k}</td><td style={box}><In name={`old${i}`} v={v} /></td><td style={box}><In name={`new${i}`} v="" /></td></tr>
              ))}</tbody>
            </table>
            <div style={{ marginTop: '10px' }}><span style={cap}>Reason for correction</span><Tx name="reason" v="" rows={3} /></div>
            <div style={{ marginTop: '6px' }}><span style={cap}>Other changes (parties, routing, goods)</span><Tx name="other" v="" rows={2} /></div>
            <Sign left={`Issued by ${d.company.name || ''}${d.user ? ' - ' + d.user : ''}`} right="Authorised signature and stamp" />
          </>
        );
      }}
    </DocWindow>
  );
}
