// Shipper's certification for live animals - filled from the saved AWB (11-Nov-2026, see docKit.jsx).
import React from 'react';
import { DocWindow, In, Tx, Ck, box, cap, title, Sign, dMonY, kg, airportText, flightText } from './docKit';

export default function LiveAnimalCertModal({ isOpen, onClose, awbNumber, awbId, awbType }) {
  return (
    <DocWindow isOpen={isOpen} onClose={onClose} title="Live Animals - Shipper's Certification" fileName={`AVI_${awbNumber || ''}`} awbId={awbId} awbType={awbType}>
      {(d) => (
        <>
          <h1 style={title}>SHIPPER'S CERTIFICATION FOR LIVE ANIMALS</h1>
          <div style={{ textAlign: 'center', fontSize: '10px', marginBottom: '10px' }}>To be completed in duplicate - one copy stays with the airline, one goes with the animals (IATA Live Animals Regulations)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr>
              <td style={box}><span style={cap}>Air Waybill No.</span><In name="awb" v={d.mawbNo || awbNumber} /></td>
              <td style={box}><span style={cap}>HAWB No.</span><In name="hawb" v={d.hawbNo} /></td>
              <td style={box}><span style={cap}>Flight / date</span><In name="flight" v={flightText(d)} /></td>
            </tr>
            <tr>
              <td style={box}><span style={cap}>Airport of departure</span><In name="dep" v={airportText(d.origin)} /></td>
              <td style={box} colSpan={2}><span style={cap}>Airport of destination</span><In name="dest" v={airportText(d.destination)} /></td>
            </tr>
            <tr>
              <td style={box} colSpan={2}><span style={cap}>Shipper</span><Tx name="shipper" v={d.shipperBlock} rows={3} /></td>
              <td style={box}><span style={cap}>Consignee</span><Tx name="consignee" v={d.consigneeBlock} rows={3} /></td>
            </tr>
          </tbody></table>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
            <thead><tr>{['Number of animals', 'Common name', 'Scientific name', 'Container (LAR No.)'].map(h => <th key={h} style={{ ...box, background: '#eef2f7', fontSize: '10px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
            <tbody>{[0, 1, 2, 3].map(i => (
              <tr key={i}>
                <td style={{ ...box, width: '15%' }}><In name={`qty${i}`} v={i === 0 ? d.pieces : ''} /></td>
                <td style={box}><In name={`common${i}`} v={i === 0 ? String(d.goods || '').split('\n')[0] : ''} /></td>
                <td style={box}><In name={`sci${i}`} v="" /></td>
                <td style={{ ...box, width: '20%' }}><In name={`cont${i}`} v="" /></td>
              </tr>
            ))}</tbody>
          </table>
          <div style={{ marginTop: '8px' }}><span style={cap}>Special feeding and watering instructions</span><Tx name="feeding" v="" rows={3} /></div>
          <div style={{ ...box, marginTop: '8px' }}>
            <span style={cap}>CITES</span>
            <Ck name="citesY" on={false} label="Species covered by CITES" /><Ck name="citesN" on={false} label="Not covered" /> Permit No.: <In name="permit" v="" w="160px" />   Health certificate No.: <In name="health" v="" w="160px" />
          </div>
          <p style={{ fontSize: '10px', marginTop: '10px', lineHeight: 1.45 }}>
            I certify that the animals above are in good health and fit to travel, that they are properly described, packed in containers that meet the IATA Live Animals Regulations,
            and that all export, transit and import requirements have been met.
          </p>
          <Sign left={`Name of shipper: ${d.shipper.name || ''}`} right={`Signature and date ${dMonY(d.today)}`} />
        </>
      )}
    </DocWindow>
  );
}
