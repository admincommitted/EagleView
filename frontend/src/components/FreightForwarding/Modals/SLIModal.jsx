// Shipper's Letter of Instruction - filled from the saved AWB (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Tx, Ck, box, cap, title, Letterhead, Sign, dmy, kg, airportText, flightText, isPrepaid } from './docKit';

export default function SLIModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Shipper's Letter of Instruction" fileName={`SLI_${awbNumber || ''}`} awbId={awbId} awbType={awbType}>
      {(d) => (
        <>
          <Letterhead c={d.company} small />
          <h1 style={title}>SHIPPER'S LETTER OF INSTRUCTION</h1>
          <div style={{ textAlign: 'right', fontSize: '11px', marginBottom: '6px' }}>Date: <In name="date" v={dmy(d.today)} w="110px" /></div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr>
              <td style={{ ...box, width: '50%' }}><span style={cap}>1. Shipper (name and address)</span><Tx name="shipper" v={d.shipperBlock} rows={5} /></td>
              <td style={box}>
                <span style={cap}>Air Waybill No.</span><In name="awb" v={d.mawbNo || awbNumber} />
                <span style={{ ...cap, marginTop: '6px' }}>House Waybill No.</span><In name="hawb" v={d.hawbNo} />
                <span style={{ ...cap, marginTop: '6px' }}>Shipper's reference / invoice No.</span><In name="ref" v="" />
              </td>
            </tr>
            <tr>
              <td style={box}><span style={cap}>2. Consignee (name and address)</span><Tx name="consignee" v={d.consigneeBlock} rows={5} /></td>
              <td style={box}><span style={cap}>3. Notify party</span><Tx name="notify" v={d.notifyBlock || 'SAME AS CONSIGNEE'} rows={5} /></td>
            </tr>
            <tr>
              <td style={box}><span style={cap}>Airport of departure</span><In name="dep" v={airportText(d.origin)} /></td>
              <td style={box}><span style={cap}>Airport of destination</span><In name="dest" v={airportText(d.destination)} /></td>
            </tr>
            <tr>
              <td style={box}><span style={cap}>Airline / flight requested</span><In name="flight" v={[d.airline.name, flightText(d)].filter(Boolean).join('  ')} /></td>
              <td style={box}><span style={cap}>Freight</span><Ck name="pp" on={isPrepaid(d)} label="Prepaid" /><Ck name="cc" on={!isPrepaid(d)} label="Collect" />
                <span style={{ ...cap, marginTop: '6px' }}>Currency</span><In name="cur" v={d.currency} w="80px" /></td>
            </tr>
            <tr>
              <td style={box}><span style={cap}>Declared value for carriage / for customs</span><In name="dvc" v={`${d.declared.carriage || 'NVD'} / ${d.declared.customs || 'NCV'}`} /></td>
              <td style={box}><span style={cap}>Insurance</span><Ck name="insY" on={d.declared.insurance && d.declared.insurance !== 'XXX'} label="Yes" /><Ck name="insN" on={!d.declared.insurance || d.declared.insurance === 'XXX'} label="No" /> Amount <In name="ins" v={d.declared.insurance && d.declared.insurance !== 'XXX' ? d.declared.insurance : ''} w="120px" /></td>
            </tr>
            <tr><td style={box} colSpan={2}><span style={cap}>Handling information / special handling codes</span><In name="handling" v={[d.handling, (d.shc || []).join(' ')].filter(Boolean).join('  ')} /></td></tr>
          </tbody></table>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead><tr>{['Marks & numbers', 'No. of pcs', 'Gross wt (kg)', 'Dimensions (L x W x H)', 'Nature and quantity of goods'].map(h => <th key={h} style={{ ...box, background: '#eef2f7', fontSize: '10px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
            <tbody><tr>
              <td style={{ ...box, width: '15%' }}><Tx name="marks" v={d.hawbNo || d.awbNo} rows={6} /></td>
              <td style={{ ...box, width: '10%' }}><Tx name="pcs" v={d.pieces} rows={6} /></td>
              <td style={{ ...box, width: '12%' }}><Tx name="gw" v={kg(d.gross)} rows={6} /></td>
              <td style={{ ...box, width: '22%' }}><Tx name="dims" v={d.dimsText || (d.volume ? `Volume ${d.volume} CBM` : '')} rows={6} /></td>
              <td style={box}><Tx name="goods" v={[d.goods, (d.hsCodes || []).length ? 'HS: ' + d.hsCodes.join(', ') : ''].filter(Boolean).join('\n')} rows={6} /></td>
            </tr></tbody>
          </table>
          <p style={{ fontSize: '10px', marginTop: '10px', lineHeight: 1.45 }}>
            I/We hereby authorise {d.company.name || 'the forwarding agent'} to prepare and sign the Air Waybill and all other documents needed for this shipment on my/our behalf.
            I/We certify that the particulars above are correct and that, unless declared on a Shipper's Declaration for Dangerous Goods, the consignment contains no dangerous goods as defined by the IATA Dangerous Goods Regulations.
          </p>
          <Sign left="Name of shipper / company stamp" right="Signature and date" />
        </>
      )}
    </DocWindow>
  );
}
