// Form state and logic, part 1 of 4
// Split out of CreateMasterWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React from 'react';
import { showValidationErrorsModal } from '../../printLogic';

export default function useMasterWaybill1() {
  const [depAirport, setDepAirport] = React.useState('');
  const [destAirport, setDestAirport] = React.useState('');
  const [destAirportName, setDestAirportName] = React.useState('');

  // Auto-resolve Destination Airport Name if missing (e.g. loaded from DB or manually typed)
  React.useEffect(() => {
    if (destAirport && destAirport.length >= 3 && (!destAirportName || !destAirportName.includes('-'))) {
        fetch('/api/locations/airports?q=' + destAirport)
          .then(r => r.json())
          .then(data => {
              const match = data.find(a => (a.iataCode === destAirport || a.code === destAirport));
              if (match) {
                  setDestAirportName((match.cityName || match.name) + ' - ' + (match.airportName || match.name));
              }
          }).catch(err => console.log(err));
    }
  }, [destAirport, destAirportName]);

  const [by1, setBy1] = React.useState('');
  const [by2, setBy2] = React.useState('');
  const [by3, setBy3] = React.useState('');
  const [to1, setTo1] = React.useState('');
  const [to2, setTo2] = React.useState('');
  const [to3, setTo3] = React.useState('');

  const [flight3, setFlight3] = React.useState('');
  const [flightDate3, setFlightDate3] = React.useState('');
  const [arrivalDate1, setArrivalDate1] = React.useState('');
  const [shipperEmail, setShipperEmail] = React.useState('');
  const [consigneeEmail, setConsigneeEmail] = React.useState('');
  const [agentLocationCode, setAgentLocationCode] = React.useState('');
  const [productId, setProductId] = React.useState('GEN');

  const [showAwbVault, setShowAwbVault] = React.useState(false);
  const [tempAwbId, setTempAwbId] = React.useState(Math.random().toString(36).substring(7)); // new one on CLEAR / MODIFY: e-documents of a dropped draft stayed in the next AWB's pouch (29-Oct-2026)

    const [linkedHawbs, setLinkedHawbs] = React.useState([]);
    const [showLinkHawb, setShowLinkHawb] = React.useState(false);
    const [hawbSearchText, setHawbSearchText] = React.useState('');

    const handleLinkHawb = async (thisMasterNo = '') => {
        if (!hawbSearchText.trim()) return;
        try {
             const res = await fetch(`/api/awb/hawb?awbNumber=${encodeURIComponent(hawbSearchText.trim().toUpperCase())}`);
             if (!res.ok) {
               showValidationErrorsModal([`HAWB '${hawbSearchText}' not found in database. Please create the HAWB first.`]);
               return;
             }
             const hawb = await res.json();
             // Check if already linked
             if (linkedHawbs.some(h => h.awb === hawb.awbNumber)) {
               showValidationErrorsModal(['This HAWB is already linked!']);
               return;
             }
             // 29-Oct-2026: a VOID house could be linked, and a house of another master was taken over without a word
             if (hawb.status === 'VOID') { showValidationErrorsModal([`HAWB ${hawb.awbNumber} is VOID.`]); return; }
             const thisMaster = typeof thisMasterNo === 'string' ? thisMasterNo : '';
             const bare = (v) => String(v || '').replace(/\D/g, '');
             // 11-Nov-2026: a house from / to another airport than this master - ask
             { const mo = String(depAirport || '').trim().toUpperCase(), md = String(destAirport || '').trim().toUpperCase(), ho = String(hawb.origin || '').trim().toUpperCase(), hd = String(hawb.destination || '').trim().toUpperCase();
               if (((mo && ho && mo !== ho) || (md && hd && md !== hd)) && !window.confirm(`HAWB ${hawb.awbNumber} is ${ho || '?'} - ${hd || '?'}, this MAWB is ${mo || '?'} - ${md || '?'}.\nLink it anyway?`)) return; }
             if (hawb.masterAwbNumber && bare(hawb.masterAwbNumber) !== bare(thisMaster) && !window.confirm(`HAWB ${hawb.awbNumber} is on master ${hawb.masterAwbNumber}. Move it to ${thisMaster || 'this master'} when you save?`)) return;
             setLinkedHawbs(prev => [...prev, {
               id: hawb.id || Date.now(),
               type: 'H',
               awb: hawb.awbNumber || hawbSearchText,
               depDate: hawb.flightDate1 || '',
               org: hawb.origin || '',
               dest: hawb.destination || '',
               awbDate: hawb.createdAt ? hawb.createdAt.split('T')[0] : '',
               shc: hawb.sphCodes?.[0] || 'GEN',
               pcs: hawb.totalPieces || 0,
               wt: parseFloat(hawb.grossWeight) || 0,
               vol: parseFloat(hawb.totalVolume) || 0,
               shipperName: hawb.shipperName || '',
               consigneeName: hawb.consigneeName || '',
               local: true, // not saved on this master yet
             }]);
             setHawbSearchText('');
        } catch (err) {
             console.error('HAWB link error:', err);
             showValidationErrorsModal(['Error fetching HAWB: ' + err.message]);
        }
    };
  // document windows (DG declaration, SLI, DO, commodity list ...) kept per AWB - saved in AwbExtraDocs (29-Oct-2026)
  const [extraDocs, setExtraDocs] = React.useState({});
  return { setTempAwbId, extraDocs, setExtraDocs, agentLocationCode, arrivalDate1, by1, by2, by3, consigneeEmail, depAirport, destAirport, destAirportName, flight3, flightDate3, handleLinkHawb, hawbSearchText, linkedHawbs, productId, setAgentLocationCode, setArrivalDate1, setBy1, setBy2, setBy3, setConsigneeEmail, setDepAirport, setDestAirport, setDestAirportName, setFlight3, setFlightDate3, setHawbSearchText, setLinkedHawbs, setProductId, setShipperEmail, setShowAwbVault, setShowLinkHawb, setTo1, setTo2, setTo3, shipperEmail, showAwbVault, showLinkHawb, tempAwbId, to1, to2, to3 };
}
