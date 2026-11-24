// Delivery Order (release letter to the airline / warehouse) - filled from the saved AWB (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Tx, Ck, box, cap, title, Letterhead, Sign, dmy, kg, flightText } from './docKit';

export default function DeliveryOrderModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Delivery Order" fileName={`DO_${awbNumber || ''}`} awbId={awbId} awbType={awbType}>
      {(d) => (
        <>
          <Letterhead c={d.company} />
          <h1 style={title}>DELIVERY ORDER</h1>
          <div style={{ textAlign: 'center', fontSize: '10.5px', marginBottom: '10px' }}>AUTHORISATION TO RELEASE CARGO</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr>
              <td style={{ ...box, width: '55%' }}><span style={cap}>To (airline / cargo terminal / warehouse in-charge)</span><Tx name="to" v={[d.airline.name ? `${d.airline.name} - CARGO` : '', d.destination.name ? `${d.destination.name} (${d.destination.code})` : ''].filter(Boolean).join('\n')} rows={4} /></td>
              <td style={box}>
                <span style={cap}>D.O. No.</span><In name="doNo" v={`DO/${d.hawbNo || String(d.awbNo || '').replace(/\D/g, '').slice(-8)}`} />
                <span style={{ ...cap, marginTop: '6px' }}>D.O. date</span><In name="doDate" v={dmy(d.today)} />
                <span style={{ ...cap, marginTop: '6px' }}>Valid till</span><In name="valid" v="" />
              </td>
            </tr>
          </tbody></table>
          <p style={{ fontSize: '11px', margin: '10px 0' }}>Please deliver the consignment below, arrived by the flight mentioned, to the consignee or their authorised customs broker on proof of identity and payment of your charges.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr>
              <td style={{ ...box, width: '33%' }}><span style={cap}>MAWB No.</span><In name="mawb" v={d.mawbNo || awbNumber} /></td>
              <td style={{ ...box, width: '33%' }}><span style={cap}>HAWB No.</span><In name="hawb" v={d.hawbNo} /></td>
              <td style={box}><span style={cap}>Flight / date</span><In name="flight" v={flightText(d)} /></td>
            </tr>
            <tr>
              <td style={box}><span style={cap}>From / to</span><In name="route" v={[d.origin.code, d.destination.code].filter(Boolean).join(' - ')} /></td>
              <td style={box}><span style={cap}>Pieces</span><In name="pcs" v={d.pieces} /></td>
              <td style={box}><span style={cap}>Gross weight (kg)</span><In name="gw" v={kg(d.gross)} /></td>
            </tr>
            <tr><td style={box} colSpan={3}><span style={cap}>Description of goods / marks and numbers</span><Tx name="goods" v={d.goods} rows={3} /></td></tr>
            <tr>
              <td style={box} colSpan={2}><span style={cap}>Consignee (name and address)</span><Tx name="consignee" v={d.consigneeBlock} rows={4} /></td>
              <td style={box}><span style={cap}>Customs broker / authorised person</span><Tx name="cha" v="" rows={4} /></td>
            </tr>
            <tr><td style={box} colSpan={3}>
              <span style={cap}>Before release</span>
              <Ck name="cleared" on={false} label="Customs cleared (BE / OOC)" /><Ck name="freight" on={/^P/i.test(d.chargeCode || 'P')} label={/^P/i.test(d.chargeCode || 'P') ? 'Freight prepaid' : 'Freight collect received'} /><Ck name="doPaid" on={false} label="D.O. charges paid" />
              <span style={{ ...cap, marginTop: '6px' }}>BE No. / date</span><In name="be" v="" w="50%" />
            </td></tr>
          </tbody></table>
          <Sign left={`For ${d.company.name || 'the agent'} - authorised signatory and stamp`} right="Received by (consignee / broker) - name, signature, date" />
        </>
      )}
    </DocWindow>
  );
}
