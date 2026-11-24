// Consignment security declaration (CSD) - filled from the saved AWB; for a MAWB every live house is listed
// (11-Nov-2026, see docKit.jsx). Before, this window was not reachable from any menu.
import React from 'react';
import { DocWindow, In, Tx, Ck, box, cap, title, dmy, kg } from './docKit';

const STATUS = [['SPX', 'Secure for passenger, all-cargo and all-mail aircraft'], ['SCO', 'Secure for all-cargo and all-mail aircraft only'], ['SHR', 'Secure for passenger, all-cargo and all-mail aircraft - high risk requirements']];
const METHOD = [['XRY', 'X-ray'], ['EDS', 'Explosive detection system'], ['ETD', 'Explosive trace detection'], ['PHS', 'Physical search'], ['VCK', 'Visual check'], ['EDD', 'Explosive detection dogs'], ['AOM', 'Other means']];

export default function SecurityDeclarationModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Consignment Security Declaration" fileName={`CSD_${awbNumber || ''}`} awbId={awbId} awbType={awbType} landscape sheetWidth={1060}>
      {(d) => {
        const rows = (d.houses || []).length ? d.houses : [{ hawb: d.hawbNo || '-', shipper: d.shipper.name, consignee: d.consignee.name, origin: d.origin.code, destination: d.destination.code, pieces: d.pieces, gross: d.gross, goods: d.goods }];
        const now = new Date(); const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        return (
          <>
            <h1 style={title}>CONSIGNMENT SECURITY DECLARATION</h1>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}><tbody>
              <tr>
                <td style={{ ...box, width: '40%' }} rowSpan={2}><span style={cap}>Regulated entity issuing the security status (regulated agent / known consignor)</span>
                  <In name="raName" v={d.company.name} /><Tx name="raAddress" v={d.company.address} rows={2} />
                  <div style={{ marginTop: '4px' }}>RA / KC code: <In name="raCode" v="" w="160px" />   Valid till: <In name="raValid" v="" w="110px" /></div></td>
                <td style={box}><span style={cap}>Air Waybill No.</span><In name="awb" v={d.mawbNo || awbNumber} /></td>
                <td style={box}><span style={cap}>Origin / destination</span><In name="route" v={[d.origin.code, d.destination.code].filter(Boolean).join(' - ')} /></td>
                <td style={box}><span style={cap}>Airline / flight</span><In name="flight" v={[d.airline.code, ((d.flights || [])[0] || {}).flight].filter(Boolean).join(' ')} /></td>
              </tr>
              <tr>
                <td style={box}><span style={cap}>Total pieces</span><In name="pcs" v={d.pieces} /></td>
                <td style={box}><span style={cap}>Gross weight (kg)</span><In name="gw" v={kg(d.gross)} /></td>
                <td style={box}><span style={cap}>House waybills</span><In name="hawbs" v={(d.houses || []).length ? `${d.houses.length} - ${d.houses.map(h => h.hawb).join(', ')}` : d.hawbNo} /></td>
              </tr>
            </tbody></table>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
              <thead><tr>{['HAWB', 'Shipper', 'Consignee', 'From - to', 'Pcs', 'Gross kg', 'Description of goods'].map(h => <th key={h} style={{ ...box, background: '#eef2f7', fontSize: '10px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((h, i) => (
                <tr key={i}>
                  <td style={box}>{h.hawb}</td><td style={box}>{h.shipper}</td><td style={box}>{h.consignee}</td><td style={box}>{[h.origin, h.destination].filter(Boolean).join(' - ')}</td>
                  <td style={{ ...box, textAlign: 'right' }}>{h.pieces}</td><td style={{ ...box, textAlign: 'right' }}>{kg(h.gross)}</td><td style={{ ...box, whiteSpace: 'pre-line' }}>{String(h.goods || '').split('\n').slice(0, 3).join('\n')}</td>
                </tr>
              ))}</tbody>
            </table>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}><tbody><tr>
              <td style={{ ...box, width: '50%' }}><span style={cap}>Security status</span>{STATUS.map(([c, l]) => <div key={c}><Ck name={`st${c}`} on={c === 'SPX'} label={`${c} - ${l}`} /></div>)}</td>
              <td style={box}><span style={cap}>Received from (code)</span><In name="receivedFrom" v="" />
                <span style={{ ...cap, marginTop: '6px' }}>Screening method</span>{METHOD.map(([c, l]) => <Ck key={c} name={`m${c}`} on={false} label={`${c} ${l}`} />)}
                <span style={{ ...cap, marginTop: '6px' }}>Grounds for exemption</span><In name="exempt" v="" /></td>
            </tr></tbody></table>
            <div style={{ marginTop: '8px' }}><span style={cap}>Additional security information</span><Tx name="info" v="" rows={2} /></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}><tbody><tr>
              <td style={box}><span style={cap}>Name of the person issuing the security status</span><In name="issuer" v={d.user} /></td>
              <td style={box}><span style={cap}>Date and time of issue</span><In name="issued" v={`${dmy(d.today)} ${hhmm}`} /></td>
              <td style={{ ...box, width: '30%' }}><span style={cap}>Signature</span><div style={{ height: '26px' }} /></td>
            </tr></tbody></table>
          </>
        );
      }}
    </DocWindow>
  );
}
