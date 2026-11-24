// Form state and logic, part 1 of 3
// Split out of CreateAirWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { recalcRow, withVolWt, volWtFromCbm, volWtFromDims, cbmOf, cbmFromDims, goodsWithDims } from '../weightCalc';
import { getMaster } from '../../../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import { airportCountryOf } from '../awbValidate';
import React from 'react';
import { dataCache } from '../../../CustomAutocomplete';
import { showSuccessToast } from '../../printLogic';
import { useLocation, useNavigate } from 'react-router-dom';

export default function useAirWaybill1() {
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
    { id: 1, code: '', entitlement: 'carrier', ppcc: 'PP', description: '', amount: '' },
    { id: 2, code: '', entitlement: 'agent',   ppcc: 'PP', description: '', amount: '' }
    // 22-Nov-2026: two blank rows at the start (were six); more come with "+ Add row" or the auto-fill
  ]);

  const handleOtherChargeChange = (id, field, value) => {
    setOtherCharges(prev => prev.map(r => {
      if (r.id === id) {
        const updatedRow = { ...r, [field]: value };
        if (field === 'rate' && value && !isNaN(parseFloat(value))) {
          const chgWt = rateLines.reduce((sum, row) => sum + (parseFloat(row.chargeableWeight) || 0), 0) || rateLines.reduce((sum, row) => sum + (parseFloat(row.grossWeight) || 0), 0) || 0;
          if (chgWt > 0) {
            updatedRow.amount = (parseFloat(value) * chgWt).toFixed(2);
          }
        }
        return updatedRow;
      }
      return r;
    }));
  };

    const handleAutoCalculateCharges = () => {
    let chgWt = rateLines.reduce((sum, line) => sum + (parseFloat(line.chargeableWeight ?? line.chgWt) || 0), 0); // was line.chgWt only (always 0: surcharges went on gross weight)
    
    // Calculate from state if needed
    if (chgWt === 0 && rateLines[0]) chgWt = parseFloat(rateLines[0].grossWeight) || 0;

    if (chgWt === 0) {
      showSuccessToast('Warning', 'Please enter Chargeable Weight first!', true);
      return;
    }

    // Standard Rates Database
    let mycRate = 10; // Default Fuel Surcharge per kg
    let sccRate = 5;  // Default Security Surcharge per kg
    let awcFee = 500; // Flat Airway Bill Fee

    if (awbPrefix === '098') { // Air India
      mycRate = 15; sccRate = 5; awcFee = 700;
    } else if (awbPrefix === '176') { // Emirates
      mycRate = 20; sccRate = 8; awcFee = 650;
    } else if (awbPrefix === '125') { // British Airways
      mycRate = 18; sccRate = 7; awcFee = 600;
    }

    const baseCharges = [
      { code: 'AW', entitlement: 'carrier', amount: awcFee.toFixed(2) },
      { code: 'MY', entitlement: 'carrier', amount: (mycRate * chgWt).toFixed(2) },
      { code: 'SC', entitlement: 'carrier', amount: (sccRate * chgWt).toFixed(2) }
    ];
    let currentCharges = [...otherCharges];
    baseCharges.forEach(bc => {
        const existingIndex = currentCharges.findIndex(c => c.code === bc.code);
        if (existingIndex >= 0) {
            currentCharges[existingIndex].amount = bc.amount;
        } else {
                const emptyIdx = currentCharges.findIndex(c => !c.code && !c.amount);
                if (emptyIdx >= 0) {
                    currentCharges[emptyIdx] = { ...currentCharges[emptyIdx], ...bc, id: currentCharges[emptyIdx].id };
                } else {
                    currentCharges.push({ id: Date.now() + Math.random(), ...bc });
                }
            }
    });

    
    // Also auto-fill Weight Charge
    const totalAmountSumVal = rateLines.reduce((sum, row) => sum + (parseFloat(row.total) || parseFloat(row.totalAmount) || 0), 0).toFixed(2);
    if (totalAmountSumVal > 0) {
       if (wtValPC === 'P') {
           if (typeof setWeightChargePP === 'function') setWeightChargePP(totalAmountSumVal);
           if (typeof setWeightChargeCC === 'function') setWeightChargeCC('');
       } else {
           if (typeof setWeightChargeCC === 'function') setWeightChargeCC(totalAmountSumVal);
           if (typeof setWeightChargePP === 'function') setWeightChargePP('');
       }
    }
    setOtherCharges(currentCharges);
    showSuccessToast('Success', 'Auto-calculated charges applied!');
  };

  const totalAgentAmount = otherCharges.filter(c => c.entitlement === 'agent').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  const totalCarrierAmount = otherCharges.filter(c => c.entitlement === 'carrier').reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);

  // 11-Nov-2026: due agent / due carrier by each row's own PP / CC - before, the header Other (P/C) decided, so a row
  // set to CC still counted as prepaid here while the XFWB sent it as collect (the two totals did not match)
  const rowAmt = (pc, ent) => otherCharges.filter(c => c.entitlement === ent && (String(c.ppcc || '').toUpperCase() === 'CC') === (pc === 'C')).reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  const dueAgentPP = rowAmt('P', 'agent');
  const dueAgentCC = rowAmt('C', 'agent');
  const dueCarrierPP = rowAmt('P', 'carrier');
  const dueCarrierCC = rowAmt('C', 'carrier');

  const totalPP = (parseFloat(weightChargePP) || 0) + (parseFloat(valChargePP) || 0) + (parseFloat(taxPP) || 0) + dueAgentPP + dueCarrierPP;
  const totalCC = (parseFloat(weightChargeCC) || 0) + (parseFloat(valChargeCC) || 0) + (parseFloat(taxCC) || 0) + dueAgentCC + dueCarrierCC;


  const [showHandling, setShowHandling] = React.useState(false);

  const [showDueCarrier, setShowDueCarrier] = React.useState(false);

  const [showDueAgent, setShowDueAgent] = React.useState(false);

  const [showCommodity, setShowCommodity] = React.useState(false);

  // Controlled state for previously DOM-scraped fields
  const [flightNumber1, setFlightNumber1] = React.useState('');
  const [flightDate1, setFlightDate1] = React.useState('');
  const [flightTime1, setFlightTime1] = React.useState('');
  const [flightNumber2, setFlightNumber2] = React.useState('');
  const [flightDate2, setFlightDate2] = React.useState('');
  const [flightTime2, setFlightTime2] = React.useState('');
  const [flight3, setFlight3] = React.useState('');
  const [flightDate3, setFlightDate3] = React.useState('');
  const [arrivalDate1, setArrivalDate1] = React.useState('');
  const [shipperEmail, setShipperEmail] = React.useState('');
  const [consigneeEmail, setConsigneeEmail] = React.useState('');
  const [agentCity, setAgentCity] = React.useState('');
  const [agentCountry, setAgentCountry] = React.useState('');
  const [agentLocationCode, setAgentLocationCode] = React.useState('');
  const [productId, setProductId] = React.useState('GEN');
  const [hsCodeTargetIndex, setHsCodeTargetIndex] = React.useState(null);
  const [currencyCode, setCurrencyCode] = React.useState('INR'); // was USD - exports from India are rated in INR (11-Nov-2026)
  const [chargeCode, setChargeCode] = React.useState('PP');
  const [carriageValue, setCarriageValue] = React.useState('NVD');
  const [customsValue, setCustomsValue] = React.useState('NCV');
  const [insuranceValue, setInsuranceValue] = React.useState('XXX');
  const [accountingInfo, setAccountingInfo] = React.useState('FREIGHT PREPAID'); // shown on the screen - before it was blank here and filled silently on save
  const [signatureShipper, setSignatureShipper] = React.useState('');
  const [signatureCarrier, setSignatureCarrier] = React.useState('');
  
    const getTodayDate = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const [executedDate, setExecutedDate] = React.useState(getTodayDate());
  const [executedPlace, setExecutedPlace] = React.useState('NEW DELHI');

  const [showHSCode, setShowHSCode] = React.useState(false);

  const [showAddParty, setShowAddParty] = React.useState(false);

  const [showSubAgentMaster, setShowSubAgentMaster] = React.useState(false);

  const [showOverseasMaster, setShowOverseasMaster] = React.useState(false);

  const [currentAwbId, setCurrentAwbId] = React.useState(null);
  
  const [parties, setParties] = React.useState({
    'Shipper': {}, 'Consignee': {}, 'Buyer': {}, 'Sub Agent': {}, 'Overseas Agent': {}, 'Notify 1': {}, 'Notify 2': {}
  });
const [awbPrefix, setAwbPrefix] = React.useState('');
  const [logsData, setLogsData] = React.useState([]);
  const [showLogsModal, setShowLogsModal] = React.useState(false);
    
  const getLoggedInUser = () => {
      try {
          const t = localStorage.getItem('token');
          if(t) {
              const p = JSON.parse(atob(t.split('.')[1]));
              return p.email ? p.email.split('@')[0].toUpperCase() : 'ADMIN';
          }
      } catch(e){}
      return 'ADMIN';
  };

  const [uiModal, setUiModal] = React.useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [isSaving, setIsSaving] = React.useState(false);
    React.useEffect(() => {
        const handleToast = (e) => {
            setUiModal({ isOpen: true, title: e.detail.title, message: e.detail.message, type: e.detail.isError ? 'error' : 'success' });
        };
        const handleValidationErrors = (e) => {
            const errList = e.detail.errors.join('\n• ');
            setUiModal({ isOpen: true, title: 'VALIDATION ERRORS', message: 'Please fix the following EDI errors:\n• ' + errList, type: 'error' });
        };
        window.addEventListener('show-toast', handleToast);
        window.addEventListener('show-validation-errors', handleValidationErrors);
        return () => {
            window.removeEventListener('show-toast', handleToast);
            window.removeEventListener('show-validation-errors', handleValidationErrors);
        };
    }, []);

  const [confirmModal, setConfirmModal] = React.useState({ isOpen: false, title: '', message: '', onConfirm: null, onCancel: null });
  const [awbSuffix, setAwbSuffix] = React.useState('');
    const [hawbNumber, setHawbNumber] = React.useState('');
  const [awbDropList, setAwbDropList] = React.useState([]);
  const [showAwbDrop, setShowAwbDrop] = React.useState(false);
    const [awbFocusedIndex, setAwbFocusedIndex] = React.useState(-1);
  const awbSuffixInputRef = React.useRef(null);
  const awbDropdownRef = React.useRef(null);

  // HAWB Stock autofill dropdown state
  const [hawbStockList, setHawbStockList] = React.useState([]);
  const [hawbStockFiltered, setHawbStockFiltered] = React.useState([]);
  const [showHawbDrop, setShowHawbDrop] = React.useState(false);
  const [hawbSearchVal, setHawbSearchVal] = React.useState('');
  const hawbDropdownRef = React.useRef(null);
  const hawbBtnRef = React.useRef(null);

  React.useLayoutEffect(() => {

    const updatePosition = () => {

      if (showAwbDrop && awbDropdownRef.current && awbSuffixInputRef.current) {

      const rect = awbSuffixInputRef.current.getBoundingClientRect();
      awbDropdownRef.current.style.position = 'fixed';
      awbDropdownRef.current.style.top = (rect.bottom + 2) + 'px';
      awbDropdownRef.current.style.left = rect.left + 'px';
      awbDropdownRef.current.style.width = Math.max(rect.width, 320) + 'px';
      awbDropdownRef.current.style.zIndex = '99';
    }
    if (showHawbDrop && hawbDropdownRef.current && hawbBtnRef.current) {
      const rect = hawkBtnRect();
      if (rect) {
        hawbDropdownRef.current.style.position = 'fixed';
        hawbDropdownRef.current.style.top = (rect.bottom + 2) + 'px';
        hawbDropdownRef.current.style.left = rect.left + 'px';
        hawbDropdownRef.current.style.zIndex = '99';
      }
    

      }

    };

    updatePosition();

    if (showAwbDrop || showHawbDrop) {

      window.addEventListener('scroll', updatePosition, true);

      window.addEventListener('resize', updatePosition);

      return () => {

        window.removeEventListener('scroll', updatePosition, true);

        window.removeEventListener('resize', updatePosition);

      };

    }

  }, [showAwbDrop, awbDropList, showHawbDrop, hawbStockList]);

  const hawkBtnRect = () => hawbBtnRef.current ? hawbBtnRef.current.getBoundingClientRect() : null;

  const openHawbStockDrop = async () => {
    if (showHawbDrop) { setShowHawbDrop(false); return; }
    try {
      const res = await fetch('/api/stock/hawb/list?status=AVAILABLE');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setHawbStockList(list);
      setHawbStockFiltered(list);
      setHawbSearchVal('');
      setShowHawbDrop(true);
    } catch (e) {
      setHawbStockList([]); setHawbStockFiltered([]); setShowHawbDrop(false);
    }
  };

  const filterHawbStock = (val) => {
    setHawbSearchVal(val);
    if (!val.trim()) { setHawbStockFiltered(hawbStockList); return; }
    setHawbStockFiltered(hawbStockList.filter(h => (h.fullHawbNumber || '').includes(val)));
  };


  const awbNo = awbPrefix + awbSuffix;
  const [showDgd, setShowDgd] = React.useState(false);
  const [showAvi, setShowAvi] = React.useState(false);
  const [showCsd, setShowCsd] = React.useState(false);
    const [showLithium, setShowLithium] = React.useState(false);
  const [showCoo, setShowCoo] = React.useState(false);
  const [showLabel, setShowLabel] = React.useState(false);
  const [showBooking, setShowBooking] = React.useState(false);
  const [showCca, setShowCca] = React.useState(false);
  const [showTemp, setShowTemp] = React.useState(false);
  const [showManifest, setShowManifest] = React.useState(false);
  const [showSli, setShowSli] = React.useState(false);
  const [showDo, setShowDo] = React.useState(false);
  const [showDocsMenu, setShowDocsMenu] = React.useState(false);

  const [selectedTemplate, setSelectedTemplate] = React.useState('SELECT');
  
  const handleLoadTemplate = () => {
    if (selectedTemplate === 'GENERAL CARGO') {
        setNatureOfGoods('GENERAL CONSOLIDATION CARGO');
        setSphCodes(['GEN', '', '', '', '', '', '', '', '']);
        setSsrText('');
    } else if (selectedTemplate === 'PERISHABLE GOODS') {
        setNatureOfGoods('FRESH VEGETABLES AND FRUITS');
        setSphCodes(['PER', '', '', '', '', '', '', '', '']);
        setSsrText('KEEP COOL AT 2-8 DEG C');
    } else if (selectedTemplate === 'DANGEROUS GOODS') {
        setNatureOfGoods('DANGEROUS GOODS AS PER ATTACHED DGD');
        setSphCodes(['DGD', 'CAO', '', '', '', '', '', '', '']);
        setSsrText('DANGEROUS GOODS SHIPPERS DECLARATION ATTACHED');
    } else if (selectedTemplate === 'PHARMACEUTICALS') {
        setNatureOfGoods('LIFE SAVING DRUGS / MEDICINES');
        setSphCodes(['PIL', 'COL', '', '', '', '', '', '', '']);
        setSsrText('MAINTAIN TEMPERATURE 15-25 DEG C');
    } else if (selectedTemplate === 'LIVE ANIMALS') {
        setNatureOfGoods('LIVE ANIMALS');
        setSphCodes(['AVI', '', '', '', '', '', '', '', '']);
        setSsrText('LIVE ANIMALS - DO NOT X-RAY');
    } else if (selectedTemplate === 'VALUABLE CARGO') {
        setNatureOfGoods('VALUABLE CARGO');
        setSphCodes(['VAL', 'SEC', '', '', '', '', '', '', '']);
        setSsrText('HIGH VALUE SECURITY REQUIRED');
    }
  };

  const [sphCodes, setSphCodes] = React.useState(Array(9).fill(''));

  const [ssrText, setSsrText] = React.useState('');
  const [sci, setSci] = React.useState('');
  const [osiText, setOsiText] = React.useState('');
  const [natureOfGoods, setNatureOfGoods] = React.useState('');
  
  
  // Smart SCI Auto-Fill
  React.useEffect(() => {
    if (sci && sci !== '') return; // Don't override if user already selected something manually
    if (!destAirport && !parties['Consignee']?.country) return;

    let cneCountry = (parties['Consignee']?.country || airportCountryOf(destAirport, masterAirports) || '').toUpperCase().substring(0, 2);
    // Rough mapping for IATA codes if we only have destAirport
    if (destAirport && !parties['Consignee']?.country) {
        // Some quick fallbacks if country is not explicitly known
        if (['FRA', 'MUC', 'HAM', 'CGN', 'LEJ'].includes(destAirport)) cneCountry = 'DE';
        if (['CDG', 'ORY', 'LYS'].includes(destAirport)) cneCountry = 'FR';
        if (['MXP', 'FCO', 'VCE'].includes(destAirport)) cneCountry = 'IT';
        if (['AMS', 'EIN', 'RTM', 'MST'].includes(destAirport)) cneCountry = 'NL';
        if (['MAD', 'BCN', 'VLC'].includes(destAirport)) cneCountry = 'ES';
        if (['LHR', 'LGW', 'MAN'].includes(destAirport)) cneCountry = 'GB';
        if (['BRU', 'LGG'].includes(destAirport)) cneCountry = 'BE';
    }

    const euCountries = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE', 'CH', 'NO'];
    
    if (euCountries.includes(cneCountry)) {
        setSci('T1');
    } else if (cneCountry) {
        setSci('X');
    }
  }, [destAirport, parties, sci]);
  // document windows (DG declaration, SLI, DO, commodity list ...) kept per AWB - saved in AwbExtraDocs (29-Oct-2026)
  const [extraDocs, setExtraDocs] = React.useState({});
  return { setTempAwbId, extraDocs, setExtraDocs, COUNTRY_CURRENCY_MAP, accountingInfo, activeRowIndex, agentCity, agentCountry, agentDetails, agentLocationCode, arrivalDate1, awbDropList, awbDropdownRef, awbFocusedIndex, awbNo, awbPrefix, awbSuffix, awbSuffixInputRef, by1, by2, by3, carriageValue, ccChargesDest, chargeCode, confirmModal, consigneeEmail, currencyCode, currentAwbId, customsValue, depAirport, destAirport, destAirportName, destinationCurrency, draftConfirmOpen, dueAgentCC, dueAgentPP, dueCarrierCC, dueCarrierPP, executedDate, executedPlace, filterHawbStock, flight3, flightDate1, flightDate2, flightDate3, flightNumber1, flightNumber2, flightTime1, flightTime2, getLoggedInUser, getTodayDate, handleAutoCalculateCharges, handleGridChange, handleLoadTemplate, handleOtherChargeChange, hawbBtnRef, hawbDropdownRef, hawbNumber, hawbSearchVal, hawbStockFiltered, hawbStockList, hawkBtnRect, hsCodeTargetIndex, iataAgents, insuranceValue, isSaving, location, logsData, masterAirlines, masterAirports, masterCharges, masterCurrencies, masterSph, natureOfGoods, navigate, openHawbStockDrop, osiText, otherCharges, otherPC, parties, productId, rateLines, savedDraftData, sci, selectedTemplate, setAccountingInfo, setActiveRowIndex, setAgentCity, setAgentCountry, setAgentDetails, setAgentLocationCode, setArrivalDate1, setAwbDropList, setAwbFocusedIndex, setAwbPrefix, setAwbSuffix, setBy1, setBy2, setBy3, setCarriageValue, setCcChargesDest, setChargeCode, setConfirmModal, setConsigneeEmail, setCurrencyCode, setCurrentAwbId, setCustomsValue, setDepAirport, setDestAirport, setDestAirportName, setDestinationCurrency, setDraftConfirmOpen, setExecutedDate, setExecutedPlace, setFlight3, setFlightDate1, setFlightDate2, setFlightDate3, setFlightNumber1, setFlightNumber2, setFlightTime1, setFlightTime2, setHawbNumber, setHawbSearchVal, setHawbStockFiltered, setHawbStockList, setHsCodeTargetIndex, setIataAgents, setInsuranceValue, setIsSaving, setLogsData, setMasterAirlines, setMasterAirports, setMasterCharges, setMasterCurrencies, setMasterSph, setNatureOfGoods, setOsiText, setOtherCharges, setOtherPC, setParties, setProductId, setRateLines, setSavedDraftData, setSci, setSelectedTemplate, setShipperEmail, setShowAddParty, setShowAvi, setShowAwbDrop, setShowAwbVault, setShowBooking, setShowCca, setShowCommodity, setShowCoo, setShowCsd, setShowDgd, setShowDimension, setShowDo, setShowDocsMenu, setShowDueAgent, setShowDueCarrier, setShowHSCode, setShowHandling, setShowHawbDrop, setShowLabel, setShowLithium, setShowLogsModal, setShowManifest, setShowOverseasMaster, setShowRateLine, setShowSli, setShowSubAgentMaster, setShowTemp, setSignatureCarrier, setSignatureShipper, setSphCodes, setSsrText, setTaxCC, setTaxPP, setTo1, setTo2, setTo3, setUiModal, setValChargeCC, setValChargePP, setWeightChargeCC, setWeightChargePP, setWtValPC, shipperEmail, showAddParty, showAvi, showAwbDrop, showAwbVault, showBooking, showCca, showCommodity, showCoo, showCsd, showDgd, showDimension, showDo, showDocsMenu, showDueAgent, showDueCarrier, showHSCode, showHandling, showHawbDrop, showLabel, showLithium, showLogsModal, showManifest, showOverseasMaster, showRateLine, showSli, showSubAgentMaster, showTemp, signatureCarrier, signatureShipper, sphCodes, ssrText, taxCC, taxPP, tempAwbId, to1, to2, to3, totalAgentAmount, totalCC, totalCarrierAmount, totalPP, uiModal, valChargeCC, valChargePP, weightChargeCC, weightChargePP, wtValPC };
}
