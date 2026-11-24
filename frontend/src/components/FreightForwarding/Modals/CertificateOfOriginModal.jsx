// Certificate of origin (draft for the chamber of commerce / export council) - filled from the saved AWB
// (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Tx, box, cap, title, dmy, kg, flightText } from './docKit';

const COUNTRY = { IN: 'INDIA', GB: 'UNITED KINGDOM', US: 'UNITED STATES', AE: 'UNITED ARAB EMIRATES', DE: 'GERMANY', FR: 'FRANCE', NL: 'NETHERLANDS', SG: 'SINGAPORE', HK: 'HONG KONG', CN: 'CHINA', JP: 'JAPAN' };

export default function CertificateOfOriginModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Certificate of Origin" fileName={`COO_${awbNumber || ''}`} awbId={awbId} awbType={awbType}>
      {(d) => {
        const oc = d.origin.country || 'IN';
        return (
          <>
            <h1 style={{ ...title, marginBottom: '10px' }}>CERTIFICATE OF ORIGIN</h1>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
              <tr>
                <td style={{ ...box, width: '55%' }}><span style={cap}>1. Exporter / consignor (name, address, country)</span><Tx name="exporter" v={d.shipperBlock} rows={5} /></td>
                <td style={box}><span style={cap}>Certificate No.</span><In name="certNo" v="" /><span style={{ ...cap, marginTop: '8px' }}>Issued in</span><In name="issuedIn" v={COUNTRY[oc] || oc} /></td>
              </tr>
              <tr>
                <td style={box}><span style={cap}>2. Consignee (name, address, country)</span><Tx name="consignee" v={d.consigneeBlock} rows={5} /></td>
                <td style={box}><span style={cap}>Invoice No. and date</span><In name="invoice" v="" /><span style={{ ...cap, marginTop: '8px' }}>Country of origin of the goods</span><In name="coo" v={COUNTRY[oc] || oc} /></td>
              </tr>
              <tr>
                <td style={box}><span style={cap}>3. Means of transport and route</span><In name="transport" v={['BY AIR', d.airline.name, flightText(d), d.mawbNo ? 'AWB ' + d.mawbNo : '', d.hawbNo ? 'HAWB ' + d.hawbNo : ''].filter(Boolean).join('  ')} /></td>
                <td style={box}><span style={cap}>Port of loading / discharge</span><In name="ports" v={[d.origin.name || d.origin.code, d.destination.name || d.destination.code].filter(Boolean).join(' / ')} /></td>
              </tr>
            </tbody></table>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
              <thead><tr>{['Marks and numbers', 'Number and kind of packages; description of goods', 'HS code', 'Gross weight / quantity'].map(h => <th key={h} style={{ ...box, background: '#eef2f7', fontSize: '10px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
              <tbody><tr>
                <td style={{ ...box, width: '17%' }}><Tx name="marks" v={d.hawbNo || d.awbNo} rows={7} /></td>
                <td style={box}><Tx name="goods" v={`${d.pieces || ''} PACKAGES\n${d.goods || ''}`} rows={7} /></td>
                <td style={{ ...box, width: '13%' }}><Tx name="hs" v={(d.hsCodes || []).join('\n')} rows={7} /></td>
                <td style={{ ...box, width: '16%' }}><Tx name="qty" v={d.gross ? `${kg(d.gross)} KGS` : ''} rows={7} /></td>
              </tr></tbody>
            </table>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}><tbody><tr>
              <td style={{ ...box, width: '50%', height: '130px' }}><span style={cap}>Declaration by the exporter</span>
                <div style={{ fontSize: '10px' }}>The undersigned declares that the details and statements above are correct and that all the goods were produced in {COUNTRY[oc] || oc}.</div>
                <div style={{ marginTop: '40px', fontSize: '10px' }}>Place and date: <In name="expPlace" v={`${d.executed.place || d.company.city || ''} ${dmy(d.today)}`} w="60%" /></div>
                <div style={{ marginTop: '6px', fontSize: '10px' }}>Signature and stamp of the exporter</div></td>
              <td style={box}><span style={cap}>Certification</span>
                <div style={{ fontSize: '10px' }}>It is certified, on the basis of the documents produced, that the declaration by the exporter is correct.</div>
                <div style={{ marginTop: '58px', fontSize: '10px' }}>Place, date, signature and stamp of the certifying authority</div></td>
            </tr></tbody></table>
          </>
        );
      }}
    </DocWindow>
  );
}
