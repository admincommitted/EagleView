// Booking confirmation to the shipper - filled from the saved AWB (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Tx, box, cap, title, Letterhead, Sign, dmy, kg, airportText } from './docKit';

export default function BookingConfirmationModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Booking Confirmation" fileName={`Booking_${awbNumber || ''}`} awbId={awbId} awbType={awbType}>
      {(d) => {
        const f1 = (d.flights || [])[0] || {}, f2 = (d.flights || [])[1] || {};
        return (
          <>
            <Letterhead c={d.company} />
            <h1 style={title}>BOOKING CONFIRMATION</h1>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '6px 0 10px' }}>
              <span>Ref: <In name="ref" v={d.hawbNo || d.awbNo} w="160px" /></span>
              <span>Date: <In name="date" v={dmy(d.today)} w="110px" /></span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody><tr>
              <td style={{ ...box, width: '50%' }}><span style={cap}>To (shipper)</span><Tx name="to" v={d.shipperBlock} rows={4} /></td>
              <td style={box}><span style={cap}>Consignee / destination</span><Tx name="cnee" v={[d.consignee.name, d.destination.name ? `${d.destination.name} (${d.destination.code})` : d.destination.code].filter(Boolean).join('\n')} rows={4} /></td>
            </tr></tbody></table>
            <p style={{ fontSize: '11px', margin: '10px 0' }}>Dear Sir / Madam,<br />We confirm the space booked for your shipment as below. Please deliver the cargo and documents before the cut-off times.</p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
              <tr><td colSpan={4} style={{ ...box, background: '#eef2f7', fontWeight: 'bold' }}>FLIGHT AND ROUTING</td></tr>
              <tr>
                <td style={box}><span style={cap}>Airline</span><In name="airline" v={d.airline.name ? `${d.airline.name}${d.airline.code ? ' (' + d.airline.code + ')' : ''}` : ''} /></td>
                <td style={box}><span style={cap}>MAWB No.</span><In name="mawb" v={d.mawbNo || awbNumber} /></td>
                <td style={box}><span style={cap}>HAWB No.</span><In name="hawb" v={d.hawbNo} /></td>
                <td style={box}><span style={cap}>From / to</span><In name="route" v={[d.origin.code, ...(d.routing || []).map(r => r.to)].filter((x, i, a) => x && a.indexOf(x) === i).join(' - ') || [d.origin.code, d.destination.code].filter(Boolean).join(' - ')} /></td>
              </tr>
              <tr>
                <td style={box}><span style={cap}>Flight 1 / date</span><In name="f1" v={f1.flight ? `${f1.flight} / ${dmy(f1.date)}${f1.time ? ' ' + f1.time : ''}` : ''} /></td>
                <td style={box}><span style={cap}>Flight 2 / date</span><In name="f2" v={f2.flight ? `${f2.flight} / ${dmy(f2.date)}` : ''} /></td>
                <td style={box}><span style={cap}>Cargo cut-off</span><In name="cargoCut" v="" /></td>
                <td style={box}><span style={cap}>Documents cut-off</span><In name="docCut" v="" /></td>
              </tr>
              <tr>
                <td style={box} colSpan={2}><span style={cap}>Airport of departure</span><In name="dep" v={airportText(d.origin)} /></td>
                <td style={box} colSpan={2}><span style={cap}>Deliver cargo at (terminal / warehouse)</span><In name="terminal" v="" /></td>
              </tr>
              <tr><td colSpan={4} style={{ ...box, background: '#eef2f7', fontWeight: 'bold' }}>CARGO</td></tr>
              <tr>
                <td style={box}><span style={cap}>Pieces</span><In name="pcs" v={d.pieces} /></td>
                <td style={box}><span style={cap}>Gross weight (kg)</span><In name="gw" v={kg(d.gross)} /></td>
                <td style={box}><span style={cap}>Chargeable weight (kg)</span><In name="cw" v={kg(d.chargeable)} /></td>
                <td style={box}><span style={cap}>Volume (CBM)</span><In name="vol" v={d.volume || ''} /></td>
              </tr>
              <tr>
                <td style={box} colSpan={3}><span style={cap}>Commodity</span><Tx name="goods" v={d.goods} rows={2} /></td>
                <td style={box}><span style={cap}>Special handling</span><In name="shc" v={(d.shc || []).join(' ')} /></td>
              </tr>
              <tr><td style={box} colSpan={4}><span style={cap}>Dimensions</span><Tx name="dims" v={d.dimsText} rows={2} /></td></tr>
            </tbody></table>
            <p style={{ fontSize: '10px', marginTop: '10px' }}>The booking is subject to the airline's confirmation and conditions of carriage. Dangerous goods, temperature-controlled or oversized cargo must be declared before acceptance.</p>
            <Sign right={`For ${d.company.name || 'the agent'} - authorised signatory`} left={d.user ? `Prepared by ${d.user}` : 'Prepared by'} />
          </>
        );
      }}
    </DocWindow>
  );
}
