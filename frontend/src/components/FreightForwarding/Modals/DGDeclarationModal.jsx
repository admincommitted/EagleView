// Shipper's Declaration for Dangerous Goods (IATA DGR layout) - shipper, consignee, AWB, airports, aircraft limitation
// (CAO from the special handling codes) filled from the saved AWB; the goods lines are typed (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Tx, Ck, box, cap, Sign, dmy, airportText } from './docKit';

const red = '#b91c1c';

export default function DGDeclarationModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Shipper's Declaration for Dangerous Goods" fileName={`DGD_${awbNumber || ''}`} awbId={awbId} awbType={awbType} landscape sheetWidth={1060}>
      {(d) => {
        const s = new Set(d.shc || []);
        const cao = s.has('CAO');
        const rad = ['RRY', 'RRW', 'RRE'].some(c => s.has(c));
        return (
          <div style={{ border: `4px solid ${red}`, padding: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
              <tr>
                <td style={{ ...box, width: '50%' }} rowSpan={2}><span style={cap}>Shipper</span><Tx name="shipper" v={d.shipperBlock} rows={5} /></td>
                <td style={box}><span style={cap}>Air Waybill No.</span><In name="awb" v={[d.mawbNo || awbNumber, d.hawbNo ? 'HAWB ' + d.hawbNo : ''].filter(Boolean).join(' / ')} /></td>
              </tr>
              <tr><td style={box}><span style={cap}>Page</span><In name="page" v="1" w="40px" /> of <In name="pages" v="1" w="40px" /> pages   <span style={{ marginLeft: '20px' }}>Shipper's reference No.</span> <In name="ref" v="" w="140px" /></td></tr>
              <tr>
                <td style={box}><span style={cap}>Consignee</span><Tx name="consignee" v={d.consigneeBlock} rows={5} /></td>
                <td style={{ ...box, fontSize: '10px', color: red }}>
                  <b>WARNING</b><br />Failure to comply in all respects with the applicable Dangerous Goods Regulations may be in breach of the applicable law, subject to legal penalties.
                </td>
              </tr>
              <tr>
                <td style={box}>
                  <span style={cap}>Transport details - this shipment is within the limitations prescribed for (delete non-applicable)</span>
                  <Ck name="pax" on={!cao} label="PASSENGER AND CARGO AIRCRAFT" /><Ck name="cao" on={cao} label="CARGO AIRCRAFT ONLY" />
                  <div style={{ marginTop: '6px', display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}><span style={cap}>Airport of departure (optional)</span><In name="dep" v={airportText(d.origin)} /></div>
                  </div>
                </td>
                <td style={box}><span style={cap}>Shipment type (delete non-applicable)</span><Ck name="nonRad" on={!rad} label="NON-RADIOACTIVE" /><Ck name="rad" on={rad} label="RADIOACTIVE" /></td>
              </tr>
              <tr><td style={box} colSpan={2}><span style={cap}>Airport of destination</span><In name="dest" v={airportText(d.destination)} /></td></tr>
            </tbody></table>
            <div style={{ fontWeight: 'bold', fontSize: '11px', margin: '8px 0 4px' }}>NATURE AND QUANTITY OF DANGEROUS GOODS</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{[['UN or ID No.', '9%'], ['Proper shipping name', '27%'], ['Class or division (subsidiary hazard)', '12%'], ['Packing group', '8%'], ['Quantity and type of packing', '22%'], ['Packing instruction', '9%'], ['Authorisation', '13%']].map(([h, w]) => <th key={h} style={{ ...box, width: w, background: '#fee2e2', fontSize: '9.5px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
              <tbody>{[0, 1, 2, 3, 4].map(i => (
                <tr key={i}>
                  <td style={box}><In name={`un${i}`} v="" /></td>
                  <td style={box}><Tx name={`psn${i}`} v="" rows={2} /></td>
                  <td style={box}><In name={`cls${i}`} v="" /></td>
                  <td style={box}><In name={`pg${i}`} v="" /></td>
                  <td style={box}><Tx name={`qty${i}`} v="" rows={2} /></td>
                  <td style={box}><In name={`pi${i}`} v="" /></td>
                  <td style={box}><In name={`auth${i}`} v="" /></td>
                </tr>
              ))}</tbody>
            </table>
            <div style={{ marginTop: '8px' }}><span style={cap}>Additional handling information</span><Tx name="handling" v={[d.handling, (d.shc || []).length ? 'SHC: ' + d.shc.join(' ') : ''].filter(Boolean).join('\n')} rows={2} /></div>
            <div style={{ marginTop: '4px' }}>24-hour emergency contact: <In name="emergency" v="" w="50%" /></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}><tbody><tr>
              <td style={{ ...box, width: '60%', fontSize: '10px' }}>I hereby declare that the contents of this consignment are fully and accurately described above by the proper shipping name, and are classified, packaged, marked and labelled/placarded, and are in all respects in proper condition for transport according to applicable international and national governmental regulations. I declare that all of the applicable air transport requirements have been met.</td>
              <td style={box}><span style={cap}>Name / title of signatory</span><In name="signatory" v="" /><span style={{ ...cap, marginTop: '6px' }}>Place and date</span><In name="placeDate" v={`${d.executed.place || d.company.city || ''} ${dmy(d.today)}`} /><span style={{ ...cap, marginTop: '6px' }}>Signature (see warning above)</span><div style={{ height: '22px' }} /></td>
            </tr></tbody></table>
          </div>
        );
      }}
    </DocWindow>
  );
}
