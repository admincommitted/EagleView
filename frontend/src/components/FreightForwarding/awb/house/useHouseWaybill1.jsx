// Form state and logic, part 1 of 4
// Split out of CreateHouseWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { recalcRow, withVolWt, volWtFromCbm, volWtFromDims, cbmOf, cbmFromDims, goodsWithDims } from '../weightCalc';
import { getMaster } from '../../../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import React from 'react';
import { dataCache } from '../../../CustomAutocomplete';
import { useLocation, useNavigate } from 'react-router-dom';

export default function useHouseWaybill1() {
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
  const [destinationCurrency, setDestinationCurrency] = React.useState('');
    const [ccChargesDest, setCcChargesDest] = React.useState('');

  const COUNTRY_CURRENCY_MAP = {
    'IN': 'INR', 'US': 'USD', 'AE': 'AED', 'GB': 'GBP', 'EU': 'EUR',
    'SG': 'SGD', 'AU': 'AUD', 'CA': 'CAD', 'JP': 'JPY', 'CN': 'CNY',
    'HK': 'HKD', 'CH': 'CHF', 'SE': 'SEK', 'NO': 'NOK', 'DK': 'DKK',
    'NZ': 'NZD', 'MX': 'MXN', 'BR': 'BRL', 'ZA': 'ZAR', 'RU': 'RUB',
    'KR': 'KRW', 'TH': 'THB', 'MY': 'MYR', 'ID': 'IDR', 'PH': 'PHP',
    'VN': 'VND', 'BD': 'BDT', 'PK': 'PKR', 'LK': 'LKR', 'NP': 'NPR',
    'QA': 'QAR', 'SA': 'SAR', 'KW': 'KWD', 'BH': 'BHD', 'OM': 'OMR',
    'EG': 'EGP', 'NG': 'NGN', 'KE': 'KES', 'GH': 'GHS', 'TZ': 'TZS',
    'ET': 'ETB', 'MU': 'MUR', 'MV': 'MVR', 'NL': 'EUR', 'DE': 'EUR',
    'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'BE': 'EUR', 'AT': 'EUR',
    'PT': 'EUR', 'GR': 'EUR', 'FI': 'EUR', 'IE': 'EUR', 'TR': 'TRY',
    'IL': 'ILS', 'JO': 'JOD', 'LB': 'LBP', 'PL': 'PLN', 'CZ': 'CZK',
    'HU': 'HUF', 'RO': 'RON', 'HR': 'HRK', 'UA': 'UAH', 'AR': 'ARS',
    'CL': 'CLP', 'CO': 'COP', 'PE': 'PEN', 'UY': 'UYU',
  };

  // Auto-fill destination currency
  React.useEffect(() => {
    if (destAirport && destAirport.length === 3) {
      const airports = dataCache['/api/locations/airports'];
      if (airports) {
        const match = airports.find(x => (x.iataCode || x.code || x.title) === destAirport);
        if (match && match.countryCode) {
          const currency = COUNTRY_CURRENCY_MAP[match.countryCode];
          if (currency) setDestinationCurrency(currency);
        }
      } else {
        fetch(`/api/locations/airports?q=${destAirport}`)
          .then(r => r.json())
          .then(data => {
            const arr = Array.isArray(data) ? data : (data.data || []);
            const match = arr.find(a => (a.iataCode || a.code || a.title) === destAirport);
            if (match) {
              const cc = match.countryCode || match.country || '';
              const currency = COUNTRY_CURRENCY_MAP[cc];
              if (currency) setDestinationCurrency(currency);
            }
          })
          .catch(() => {});
      }
    }
  }, [destAirport]);

  const [showAwbVault, setShowAwbVault] = React.useState(false);
  const [tempAwbId, setTempAwbId] = React.useState(Math.random().toString(36).substring(7)); // new one on CLEAR / MODIFY: e-documents of a dropped draft stayed in the next AWB's pouch (29-Oct-2026)

  const [draftConfirmOpen, setDraftConfirmOpen] = React.useState(false);
  const [savedDraftData, setSavedDraftData] = React.useState(null);

  const [iataAgents, setIataAgents] = React.useState([]);
  const [agentDetails, setAgentDetails] = React.useState({ name: '', code: '', place: '', account: '', docs: 'SHIPMENT WITH DOCUMENTS', eori: '', accountingInfo: 'FREIGHT PREPAID' });

  

  
  React.useEffect(() => {
    getMaster('/api/masters/iataagents')
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setIataAgents(arr);
        const defaultAgent = arr.find(a => a.isDefault);
        if (defaultAgent) {
           let place = '';
           try {
             const branches = JSON.parse(defaultAgent.branches);
             if (branches && branches.length > 0) place = branches[0].city || '';
           } catch(e) {}
           setAgentDetails(prev => ({ ...prev, name: defaultAgent.name, code: defaultAgent.iataCode || '', place }));
        }
      }).catch(err => console.error(err));
  }, []);

  const [masterAirports, setMasterAirports] = React.useState([]);
  const [masterAirlines, setMasterAirlines] = React.useState([]);
  const [masterCurrencies, setMasterCurrencies] = React.useState([]);
  const [masterCharges, setMasterCharges] = React.useState([]);
  const [masterSph, setMasterSph] = React.useState([]);

  React.useEffect(() => {
      fetch('/api/masters/airports').then(r=>r.json()).then(d => { if(Array.isArray(d)) setMasterAirports(d) }).catch(e=>console.error(e));
      getMaster('/api/masters/airlines').then(d => { if(Array.isArray(d)) setMasterAirlines(d) }).catch(e=>console.error(e));
      getMaster('/api/masters/currencies').then(d => { if(Array.isArray(d)) setMasterCurrencies(d) }).catch(e=>console.error(e));
      fetch('/api/masters/charges').then(r=>r.json()).then(d => { if(Array.isArray(d)) setMasterCharges(d) }).catch(e=>console.error(e));
      fetch('/api/masters/specialhandlingcodes').then(r=>r.json()).then(d => { if(Array.isArray(d)) setMasterSph(d) }).catch(e=>console.error(e));
  }, []);



  const navigate = useNavigate();
  const location = useLocation();

  const [showDimension, setShowDimension] = React.useState(false);

    const [showRateLine, setShowRateLine] = React.useState(false);
  const [activeRowIndex, setActiveRowIndex] = React.useState(null);
  
  // rate line edit: chargeable weight (IATA: higher of gross / volumetric, up to the next 0.5 kg) and total follow
  // weightCalc.js. Functional update: two changes in a row (the ROUND box) were lost with the old copy. 29-Oct-2026
  const handleGridChange = (index, field, value) => {
    setRateLines(prev => { const list = [...(prev || [])]; list[index] = recalcRow({ ...list[index], [field]: value }, field); return list; });
  };

    const [rateLines, setRateLines] = React.useState([]);
  
  // Charges State Logic
  const [wtValPC, setWtValPC] = React.useState('P');
  const [otherPC, setOtherPC] = React.useState('P');
  
  const [weightChargePP, setWeightChargePP] = React.useState('');
  const [weightChargeCC, setWeightChargeCC] = React.useState('');
  
  const [valChargePP, setValChargePP] = React.useState('');
  const [valChargeCC, setValChargeCC] = React.useState('');
  
  const [taxPP, setTaxPP] = React.useState('');
  const [taxCC, setTaxCC] = React.useState('');

  const [otherCharges, setOtherCharges] = React.useState([
    { id: 1, code: '', entitlement: 'carrier', amount: '', ppcc: 'PP', description: '' },
    { id: 2, code: '', entitlement: 'agent', amount: '', ppcc: 'PP', description: '' }
    // 22-Nov-2026: two blank rows at the start (were six); more come with "+ Add row" or the auto-fill
  ]);

  const handleOtherChargeChange = (id, field, value) => {
    setOtherCharges(prev => prev.map(r => {
      if (r.id === id) {
        const row = { ...r, [field]: value };
        if (field === 'rate') {
          const chgWt = parseFloat(rateLines.reduce((sum, rl) => sum + (parseFloat(rl.chargeableWeight) || 0), 0)) || parseFloat(rateLines.reduce((sum, rl) => sum + (parseFloat(rl.grossWeight) || 0), 0)) || 0;
          if (chgWt > 0 && value && !isNaN(parseFloat(value))) {
            row.amount = (parseFloat(value) * chgWt).toFixed(2);
          }
        }
        return row;
      }
      return r;
    }));
  };
  // document windows (DG declaration, SLI, DO, commodity list ...) kept per AWB - saved in AwbExtraDocs (29-Oct-2026)
  const [extraDocs, setExtraDocs] = React.useState({});
  return { setTempAwbId, extraDocs, setExtraDocs, COUNTRY_CURRENCY_MAP, activeRowIndex, agentDetails, by1, by2, by3, ccChargesDest, depAirport, destAirport, destAirportName, destinationCurrency, draftConfirmOpen, handleGridChange, handleOtherChargeChange, iataAgents, location, masterAirlines, masterAirports, masterCharges, masterCurrencies, masterSph, navigate, otherCharges, otherPC, rateLines, savedDraftData, setActiveRowIndex, setAgentDetails, setBy1, setBy2, setBy3, setCcChargesDest, setDepAirport, setDestAirport, setDestAirportName, setDestinationCurrency, setDraftConfirmOpen, setIataAgents, setMasterAirlines, setMasterAirports, setMasterCharges, setMasterCurrencies, setMasterSph, setOtherCharges, setOtherPC, setRateLines, setSavedDraftData, setShowAwbVault, setShowDimension, setShowRateLine, setTaxCC, setTaxPP, setTo1, setTo2, setTo3, setValChargeCC, setValChargePP, setWeightChargeCC, setWeightChargePP, setWtValPC, showAwbVault, showDimension, showRateLine, taxCC, taxPP, tempAwbId, to1, to2, to3, valChargeCC, valChargePP, weightChargeCC, weightChargePP, wtValPC };
}
