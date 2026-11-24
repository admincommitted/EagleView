// Form state and logic, part 2 of 4
// Split out of CreateMasterWaybill.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { recalcRow, withVolWt, volWtFromCbm, volWtFromDims, cbmOf, cbmFromDims, goodsWithDims } from '../weightCalc';
import { getMaster } from '../../../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import { airportCountryOf } from '../awbValidate'; // country from the airport master, not the first 2 letters of the code (DEL is not DE)
import React from 'react';
import { dataCache } from '../../../CustomAutocomplete';
import { showSuccessToast } from '../../printLogic';
import { useLocation, useNavigate } from 'react-router-dom';

export default function useMasterWaybill2(ctx) {
  const { depAirport, destAirport, linkedHawbs, setDestAirportName, setLinkedHawbs } = ctx;
  // Consol: houses -> master (29-Oct-2026). Before: the "CONSOLIDATION AS PER MANIFEST n PCS / n KGS" text was written
  // once and never updated when houses were added / removed (and the weight came out as 150.30000000001), it replaced
  // any goods text not saying CONSOLIDATION, and the master's rate line stayed empty. Now the text is kept up to date
  // (only our own text is rewritten), and an EMPTY master rate line is filled from the houses (pieces, weight, volume);
  // a master line the user filled is never changed - VALIDATE EDI shows a difference.
  React.useEffect(() => {
      if (!linkedHawbs.length) return;
      const totalPcs = linkedHawbs.reduce((acc, curr) => acc + (parseInt(curr.pcs, 10) || 0), 0);
      const totalWt = +linkedHawbs.reduce((acc, curr) => acc + (parseFloat(curr.wt) || 0), 0).toFixed(2);
      const totalVol = +linkedHawbs.reduce((acc, curr) => acc + (parseFloat(curr.vol) || 0), 0).toFixed(3);
      const auto = `CONSOLIDATION AS PER MANIFEST\n${totalPcs} PCS / ${totalWt} KGS`;
      const cur = String(natureOfGoods || '');
      if (!cur.trim() || /^CONSOLIDATION AS PER MANIFEST\n\d+ PCS \/ [\d.]+ KGS$/.test(cur)) { if (cur !== auto) setNatureOfGoods(auto); }
      else if (!/CONSOL/i.test(cur)) setNatureOfGoods(`${auto}\n${cur}`);
      setRateLines(prev => {
        const list = Array.isArray(prev) ? prev : [];
        const filled = list.some(r => r && ((parseFloat(r.noOfPcs ?? r.pieces) || 0) > 0 || (parseFloat(r.grossWeight) || 0) > 0));
        if (filled || !(totalPcs > 0 && totalWt > 0)) return prev;
        const base = list[0] || { id: Date.now(), gwUnit: 'K', isRounded: true, rateClassCode: 'Q' };
        const volKg = totalVol > 0 ? +volWtFromCbm(totalVol, densityGroup).toFixed(2) : '';
        const row = recalcRow({ ...base, noOfPcs: String(totalPcs), pieces: String(totalPcs), grossWeight: String(totalWt), volumetricWeight: volKg, goodsDescription: base.goodsDescription || 'CONSOLIDATION AS PER ATTACHED MANIFEST' }, 'grossWeight');
        return [row, ...list.slice(1)];
      });
    }, [linkedHawbs]); // eslint-disable-line


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

  const handleDestAirportSelect = (opt) => {
    if (opt) setDestAirportName(opt.subtitle || '');
    if (opt && opt.countryCode) {
      const currency = COUNTRY_CURRENCY_MAP[opt.countryCode];
      if (currency) setDestinationCurrency(currency);
    }
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

  // Controlled state for fields previously scraped from DOM
  const [flightNumber1, setFlightNumber1] = React.useState('');
  const [flightDate1, setFlightDate1] = React.useState('');
  const [flightTime1, setFlightTime1] = React.useState('');
  const [flightTime2, setFlightTime2] = React.useState('');
  const [flightNumber2, setFlightNumber2] = React.useState('');
  const [flightDate2, setFlightDate2] = React.useState('');
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
                      currentCharges[emptyIdx] = { ...currentCharges[emptyIdx], ...bc, id: Date.now() + Math.random() };
                  } else {
                      currentCharges.push({ ...bc, id: Date.now() + Math.random() });
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

  const [showHSCode, setShowHSCode] = React.useState(false);
  const [hsCodeTargetIndex, setHsCodeTargetIndex] = React.useState(null);

  const [showAddParty, setShowAddParty] = React.useState(false);

  const [showSubAgentMaster, setShowSubAgentMaster] = React.useState(false);

  const [showOverseasMaster, setShowOverseasMaster] = React.useState(false);

  const [currentAwbId, setCurrentAwbId] = React.useState(null);
  
  const [parties, setParties] = React.useState({
    'Shipper': {}, 'Consignee': {}, 'Buyer': {}, 'Sub Agent': {}, 'Overseas Agent': {}, 'Notify 1': {}, 'Notify 2': {}
  });

  // Fully automate OCI sync based on Shipper/Consignee selection
  React.useEffect(() => {
      setOciRows(prev => {
          const originalStr = JSON.stringify(prev || []);
          let newOcis = JSON.parse(originalStr);
          
          const shp = parties["Shipper"];
            if (shp) {
                const shpCcode = (shp.countryCode || shp.country || (shp.addresses && shp.addresses[0]?.country) || airportCountryOf(depAirport, ctx.masterAirports) || 'IN').substring(0,2).toUpperCase();
                const shpTax = (shp.addresses && shp.addresses[0] && (shp.addresses[0].regNo || shp.addresses[0].gstin)) || shp.taxId || shp.panNumber || shp.iec || '';
                if (shpTax) {
                    const existingShp = newOcis.find(r => r.infoId === 'SHP');
                    if (existingShp) {
                        existingShp.countryCode = shpCcode;
                        existingShp.suppInfo = shpTax;
                        existingShp.customsId = getCustomsIdForParty(shp, shpCcode);
                    } else {
                        newOcis.push({ id: Date.now(), countryCode: shpCcode, infoId: 'SHP', customsId: getCustomsIdForParty(shp, shpCcode), suppInfo: shpTax });
                    }
                }
            }
            
            const cne = parties["Consignee"];
            if (cne) {
                const cneCcode = (cne.countryCode || cne.country || (cne.addresses && cne.addresses[0]?.country) || airportCountryOf(destAirport, ctx.masterAirports) || '').substring(0,2).toUpperCase();
                const cneTax = (cne.addresses && cne.addresses[0] && (cne.addresses[0].regNo || cne.addresses[0].gstin)) || cne.taxId || cne.panNumber || cne.iec || '';
                if (cneTax && cneCcode) {
                    // ICS2 Logic: If country is in Europe/UK, default to 'E' (EORI), else 'T' (Tax)
                    const existingCne = newOcis.find(r => r.infoId === 'CNE');
                    const defaultCustomsId = getCustomsIdForParty(cne, cneCcode);
                    if (existingCne) {
                        existingCne.countryCode = cneCcode;
                        existingCne.suppInfo = cneTax;
                        existingCne.customsId = defaultCustomsId;
                    } else {
                        newOcis.push({ id: Date.now() + 1, countryCode: cneCcode, infoId: 'CNE', customsId: defaultCustomsId, suppInfo: cneTax });
                    }
                }
            }
            
            // Remove SHP/CNE rows if party was removed
          if (!shp) newOcis = newOcis.filter(r => r.infoId !== 'SHP');
          if (!cne) newOcis = newOcis.filter(r => r.infoId !== 'CNE');
          
          // Only update if there's an actual difference to avoid infinite re-renders or unnecessary state updates
          const isDifferent = originalStr !== JSON.stringify(newOcis);
          return isDifferent ? newOcis : prev;
      });
  }, [parties['Shipper'], parties['Consignee']]);
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
  const [awbDropList, setAwbDropList] = React.useState([]);
  const [showAwbDrop, setShowAwbDrop] = React.useState(false);
    const [awbFocusedIndex, setAwbFocusedIndex] = React.useState(-1);
  const awbSuffixInputRef = React.useRef(null);
  const awbDropdownRef = React.useRef(null);

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

    };

    updatePosition();

    if (showAwbDrop) {

      window.addEventListener('scroll', updatePosition, true);

      window.addEventListener('resize', updatePosition);

      return () => {

        window.removeEventListener('scroll', updatePosition, true);

        window.removeEventListener('resize', updatePosition);

      };

    }

  }, [showAwbDrop, awbDropList]);

  const awbNo = awbPrefix + awbSuffix;

  // Auto-fetch linked HAWBs whenever a valid MAWB number is set (prefix=3 digits + suffix=8 digits)
  React.useEffect(() => {
    if (awbPrefix && awbSuffix && awbPrefix.length === 3 && awbSuffix.length === 8) {
      const mawbNumber = `${awbPrefix}-${awbSuffix}`;
      fetch(`/api/awb/linked-hawbs/${encodeURIComponent(mawbNumber)}`)
        .then(r => r.ok ? r.json() : [])
        .then(hawbs => {
          // 29-Oct-2026: a master with no houses kept the house list of the master shown before; now the list is the
          // saved houses of THIS master plus the ones linked on screen and not saved yet
          if (Array.isArray(hawbs)) {
            setLinkedHawbs(prev => [...hawbs.map(h => ({
              id: h.id,
              type: 'H',
              awb: h.awbNumber || '',
              depDate: h.flightDate1 || '',
              org: h.origin || '',
              dest: h.destination || '',
              awbDate: h.createdAt ? h.createdAt.split('T')[0] : '',
              shc: 'GEN',
              pcs: h.totalPieces || 0,
              wt: parseFloat(h.grossWeight) || 0,
              vol: parseFloat(h.totalVolume) || 0,
              shipperName: h.shipperName || '',
              consigneeName: h.consigneeName || '',
            })), ...(prev || []).filter(p => p.local && !hawbs.some(h => h.awbNumber === p.awb))]);
          }
        })
        .catch(() => {});
    }
  }, [awbPrefix, awbSuffix]);

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

  // XFZB / XFFM Send states
  const [showCsdSendMenu, setShowCsdSendMenu] = React.useState(false);
  const [csdSendOptions, setCsdSendOptions] = React.useState({ securityStatus: 'SPX', screeningMethod: 'XRY', issuerName: '' });
  const [sendingXfzb, setSendingXfzb] = React.useState(false);
  const [sendingXffm, setSendingXffm] = React.useState(false);
  const [xfwbSent, setXfwbSent] = React.useState(false);

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
  
  // Smart SPH Effect
  React.useEffect(() => {
    const rules = [
      { code: 'ACT', ssr: 'ACT - ACTIVE TEMPERATURE CONTROLLED SYSTEM', osi: 'MAINTAIN ACTIVE TEMPERATURE CONTROL' },
      { code: 'AOG', ssr: 'AOG - AIRCRAFT ON GROUND URGENT', osi: 'URGENT AIRCRAFT SPARES' },
      { code: 'ATT', ssr: 'ATT - GOODS ATTACHED TO AIR WAYBILL', osi: '' },
      { code: 'AVI', ssr: 'AVI - LIVE ANIMAL /SPECIES/ /QUANTITY/', osi: 'SHIPPERS CERTIFICATION FOR LIVE ANIMALS ATTACHED' },
      { code: 'BIG', ssr: 'BIG - OUTSIZED CARGO', osi: 'OUTSIZED CARGO - SPECIAL HANDLING REQUIRED' },
      { code: 'BUP', ssr: 'BUP - BULK UNITIZATION PROGRAMME', osi: 'SHIPPER LOADED UNIT' },
      { code: 'CAO', ssr: 'CAO - CARGO AIRCRAFT ONLY', osi: '' },
      { code: 'CAT', ssr: 'CAT - CARGO ATTENDANT ACCOMPANYING', osi: '' },
      { code: 'COL', ssr: 'COL - COOL GOODS', osi: 'MAINTAIN COOL TEMPERATURE' },
      { code: 'COM', ssr: 'COM - COMPANY MAIL', osi: '' },
      { code: 'CRT', ssr: 'CRT - CONTROL ROOM TEMPERATURE', osi: 'MAINTAIN +15C TO +25C' },
      { code: 'DGD', ssr: 'DGD - DANGEROUS GOODS AS PER ATTACHED DGD', osi: '' },
      { code: 'DIP', ssr: 'DIP - DIPLOMATIC MAIL', osi: 'DIPLOMATIC CARGO - DO NOT OPEN' },
      { code: 'EAP', ssr: 'EAP - E-FREIGHT WITH PAPER DOCUMENTS', osi: '' },
      { code: 'EAT', ssr: 'EAT - FOODSTUFFS', osi: 'FOODSTUFFS - DO NOT STOW WITH POISONS' },
      { code: 'EAW', ssr: 'EAW - E-FREIGHT NO PAPER DOCUMENTS', osi: '' },
      { code: 'ELI', ssr: 'LITHIUM ION BATTERIES AS PER SECTION II OF PI', osi: '' },
      { code: 'ELM', ssr: 'LITHIUM METAL BATTERIES AS PER SECTION II OF PI', osi: '' },
      { code: 'FIL', ssr: 'FIL - UNDEVELOPED FILM / DO NOT X-RAY', osi: '' },
      { code: 'FRI', ssr: 'FRI - FROZEN GOODS', osi: 'MAINTAIN FREEZING TEMPERATURE' },
      { code: 'HEG', ssr: 'HEG - HATCHING EGGS', osi: 'HANDLE WITH EXTREME CARE' },
      { code: 'HUM', ssr: 'HUM - HUMAN REMAINS', osi: 'DEATH CERTIFICATE AND EMBALMING CERTIFICATE ATTACHED' },
      { code: 'ICE', ssr: 'ICE - DRY ICE / UN1845 / CLASS 9', osi: '' },
      { code: 'LHO', ssr: 'LHO - LIVING HUMAN ORGANS', osi: 'URGENT MEDICAL TRANSPORT' },
      { code: 'MAG', ssr: 'MAG - MAGNETIZED MATERIAL', osi: '' },
      { code: 'MUW', ssr: 'MUW - MUNITIONS OF WAR', osi: 'MILITARY CARGO' },
      { code: 'OBX', ssr: 'OBX - OBNOXIOUS CARGO', osi: 'STOW AWAY FROM FOODSTUFFS' },
      { code: 'PAC', ssr: 'PAC - PASSENGER AND CARGO', osi: '' },
      { code: 'PEA', ssr: 'PEA - HUNTING TROPHIES', osi: '' },
      { code: 'PER', ssr: 'PER - PERISHABLE CARGO', osi: 'NOTIFY CONSIGNEE IMMEDIATELY UPON ARRIVAL' },
      { code: 'PIL', ssr: 'PIL - PHARMACEUTICALS', osi: 'MAINTAIN STRICT TEMPERATURE CONTROLS' },
      { code: 'QTA', ssr: 'QTA - QUICK TRANSIT', osi: 'QUICK TRANSIT REQUIRED' },
      { code: 'RAC', ssr: 'RAC - RESERVED AIR CARGO', osi: '' },
      { code: 'RDS', ssr: 'RDS - RADIOACTIVE MATERIAL', osi: '' },
      { code: 'SAL', ssr: 'SAL - SURFACE MAIL', osi: '' },
      { code: 'SHL', ssr: 'SHL - SAVE HUMAN LIFE', osi: 'ABSOLUTE PRIORITY HANDLING REQUIRED' },
      { code: 'SOC', ssr: 'SOC - SHIPPER OWNED CONTAINER', osi: '' },
      { code: 'SPX', ssr: 'SPX - SECURE FOR PASSENGER AND CARGO AIRCRAFT', osi: '' },
      { code: 'VAL', ssr: 'VAL - VALUABLE CARGO', osi: 'VALUABLE CARGO UNDER ESCORT' },
      { code: 'VOL', ssr: 'VOL - VOLUME CARGO', osi: '' },
      { code: 'VUN', ssr: 'VUN - VULNERABLE CARGO', osi: 'VULNERABLE CARGO - SPECIAL SECURITY REQUIRED' },
      { code: 'WET', ssr: 'WET - WET CARGO', osi: 'STOW IN WATERTIGHT CONTAINERS' },
    ];

    let newSsr = ssrText || '';
    let newOsi = osiText || '';

    rules.forEach(r => {
      if (!sphCodes.includes(r.code)) {
         if (r.ssr) newSsr = newSsr.split('\n').filter(line => line !== r.ssr).join('\n');
         if (r.osi) newOsi = newOsi.split('\n').filter(line => line !== r.osi).join('\n');
      }
    });

    rules.forEach(r => {
      if (sphCodes.includes(r.code)) {
         if (r.ssr && !newSsr.includes(r.ssr)) newSsr = (newSsr ? newSsr + '\n' : '') + r.ssr;
         if (r.osi && !newOsi.includes(r.osi)) newOsi = (newOsi ? newOsi + '\n' : '') + r.osi;
      }
    });

    newSsr = newSsr.replace(/^\n+|\n+$/g, '');
    newOsi = newOsi.replace(/^\n+|\n+$/g, '');

    if (newSsr !== ssrText) setSsrText(newSsr);
    if (newOsi !== osiText) setOsiText(newOsi);
  }, [sphCodes]);

  // Smart Commodity Effect
  React.useEffect(() => {
    if (natureOfGoods.includes('PHARMA') || natureOfGoods.includes('MEDICINE')) {
      if (!sphCodes.includes('PIL')) {
         const emptyIndex = sphCodes.findIndex(c => c === '');
         if (emptyIndex !== -1) {
            const newCodes = [...sphCodes];
            newCodes[emptyIndex] = 'PIL';
            setSphCodes(newCodes);
         }
      }
    }
  }, [natureOfGoods]);

  // AWB Validation logic for red border
  const getAwbError = () => {
     if (!awbSuffix || awbSuffix.length < 8) return null;
     const serial = parseInt(awbSuffix.substring(0, 7), 10);
     const check = parseInt(awbSuffix.substring(7, 8), 10);
     if (serial % 7 !== check) return 'Invalid check digit (expected ' + (serial % 7) + ', got ' + check + '). MOD-7 validation failed.';
     return null;
  };


  const [ociRows, setOciRows] = React.useState([{ id: 1, countryCode: '', infoId: '', customsId: '', suppInfo: '' }]);
  const [dimRows, setDimRows] = React.useState([]);
  const [densityGroup, setDensityGroup] = React.useState('1:6');
  const [volume, setVolume] = React.useState('');
  const [mcUnit, setMcUnit] = React.useState('MC');
  const [noDimensions, setNoDimensions] = React.useState(false);
  
  // Auto-tick No Dimensions if no dims and no volume are provided
  React.useEffect(() => {
    const vol = parseFloat(volume) || 0;
    if (dimRows.length === 0 && vol === 0) {
      setNoDimensions(true);
    } else {
      setNoDimensions(false);
    }
  }, [dimRows, volume]);

  // Volumetric weight from the Volume box: volume (MC / CC / CF) in cbm x 1,000,000 / divisor of the ratio (1:6 = 6000
  // cm3 per kg, IATA standard). Was volume x 167 whatever the unit, and the ratio was changed by the screen itself from
  // the cargo's own density (light cargo got 1:8 = 125 kg per cbm). 29-Oct-2026
  React.useEffect(() => {
    const cbm = cbmOf(volume, mcUnit);
    if (!(cbm > 0) || !(rateLines || []).length) return;
    // 11-Nov-2026: rate lines with their own dimensions / volume (Rate Line window) are the source - their volumetric
    // weight is not overwritten from the Volume box. Before, ADD in the window put the sum of the lines' volume in the
    // box and this effect then wrote the box's weight back on line 1: the window's 5470.52 kg became 5470.50 (3-decimal
    // CBM), a manual chargeable weight was replaced, and a wrong value in the box was multiplied onto line 1.
    if ((rateLines || []).some(r => r && ((parseFloat(r.volume) || 0) > 0 || (Array.isArray(r.dimensions) && r.dimensions.some(d => parseFloat(d.length) > 0))))) return;
    // with dimension lines they are the source (the 3-decimal volume would give a slightly different weight)
    const volWt = +((dimRows || []).length && !noDimensions ? volWtFromDims(dimRows, densityGroup) : volWtFromCbm(cbm, densityGroup)).toFixed(2);
    const cur = parseFloat(rateLines[0].volumetricWeight) || 0;
    if (Math.abs(cur - volWt) > 0.01) setRateLines(prev => withVolWt(prev, volWt));
  }, [volume, densityGroup, mcUnit, dimRows, noDimensions]); // eslint-disable-line

  // (the density group is no longer picked from the cargo's density: it set the divisor and so the volumetric weight. 29-Oct-2026)
  // ────────────────────────────────────────────────────────────────────────

  // ── Auto-fill outer VOLUME (CBM) from rate lines ─────────────────────────
  React.useEffect(() => {
    // 1. Try to sum CBM volumes from rate lines (set when user enters L×W×H in modal)
    const totalCbm = rateLines.reduce((sum, r) => sum + (parseFloat(r.volume) || 0), 0);
    if (totalCbm > 0) {
      setVolume(prev => {
        const rounded = totalCbm.toFixed(3);
        return prev !== rounded ? rounded : prev;
      });
      setMcUnit('MC'); // the rate lines' volume is in cbm (a CF / CC unit left on the box changed the volumetric weight)
      return;
    }
    }, [rateLines, densityGroup]);
  // ────────────────────────────────────────────────────────────────────────

    const handleOciChange = (id, field, val) => { setOciRows(ociRows.map(r => r.id === id ? { ...r, [field]: val } : r)); };
  const handleAutoFilleCSD = () => {
    const shpCountry = (parties['Shipper']?.country || airportCountryOf(depAirport, ctx.masterAirports) || 'IN').toUpperCase().substring(0,2);
    const newRows = [
      { id: Date.now() + 101, countryCode: shpCountry, infoId: 'SEC', customsId: 'V', suppInfo: 'SPX' },
      { id: Date.now() + 102, countryCode: shpCountry, infoId: 'SEC', customsId: 'SM', suppInfo: 'XRY' },
      { id: Date.now() + 103, countryCode: shpCountry, infoId: 'SEC', customsId: 'RA', suppInfo: '' }
    ];
    let currentRows = [...ociRows];
    newRows.forEach(nr => {
       if (!currentRows.some(cr => cr.infoId === nr.infoId && cr.customsId === nr.customsId)) {
           currentRows.push(nr);
       }
    });
    setOciRows(currentRows);
  };

  
  const getCustomsIdForParty = (party, ccode = '') => {
      if (!party) return 'T';
      const ctxType = party.ctxType || (party.addresses && party.addresses[0] && party.addresses[0].ctxType) || '';
      if (ctxType.toLowerCase() === 'passport') return 'P';
      const euCountries = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB','CH','NO'];
      if (ccode && euCountries.includes(ccode)) return 'E';
      return 'T';
  };
  return { COUNTRY_CURRENCY_MAP, accountingInfo, activeRowIndex, agentDetails, awbDropList, awbDropdownRef, awbFocusedIndex, awbNo, awbPrefix, awbSuffix, awbSuffixInputRef, carriageValue, ccChargesDest, chargeCode, confirmModal, csdSendOptions, currencyCode, currentAwbId, customsValue, densityGroup, destinationCurrency, dimRows, draftConfirmOpen, dueAgentCC, dueAgentPP, dueCarrierCC, dueCarrierPP, executedDate, executedPlace, flightDate1, flightDate2, flightNumber1, flightNumber2, flightTime1, flightTime2, getAwbError, getCustomsIdForParty, getLoggedInUser, getTodayDate, handleAutoCalculateCharges, handleAutoFilleCSD, handleDestAirportSelect, handleGridChange, handleLoadTemplate, handleOciChange, handleOtherChargeChange, hsCodeTargetIndex, iataAgents, insuranceValue, location, logsData, masterAirlines, masterAirports, masterCharges, masterCurrencies, masterSph, mcUnit, natureOfGoods, navigate, noDimensions, ociRows, osiText, otherCharges, otherPC, parties, rateLines, savedDraftData, sci, selectedTemplate, sendingXffm, sendingXfzb, setAccountingInfo, setActiveRowIndex, setAgentDetails, setAwbDropList, setAwbFocusedIndex, setAwbPrefix, setAwbSuffix, setCarriageValue, setCcChargesDest, setChargeCode, setConfirmModal, setCsdSendOptions, setCurrencyCode, setCurrentAwbId, setCustomsValue, setDensityGroup, setDestinationCurrency, setDimRows, setDraftConfirmOpen, setExecutedDate, setExecutedPlace, setFlightDate1, setFlightDate2, setFlightNumber1, setFlightNumber2, setFlightTime1, setFlightTime2, setHsCodeTargetIndex, setIataAgents, setInsuranceValue, setLogsData, setMasterAirlines, setMasterAirports, setMasterCharges, setMasterCurrencies, setMasterSph, setMcUnit, setNatureOfGoods, setNoDimensions, setOciRows, setOsiText, setOtherCharges, setOtherPC, setParties, setRateLines, setSavedDraftData, setSci, setSelectedTemplate, setSendingXffm, setSendingXfzb, setShowAddParty, setShowAvi, setShowAwbDrop, setShowBooking, setShowCca, setShowCommodity, setShowCoo, setShowCsd, setShowCsdSendMenu, setShowDgd, setShowDimension, setShowDo, setShowDocsMenu, setShowDueAgent, setShowDueCarrier, setShowHSCode, setShowHandling, setShowLabel, setShowLithium, setShowLogsModal, setShowManifest, setShowOverseasMaster, setShowRateLine, setShowSli, setShowSubAgentMaster, setShowTemp, setSignatureCarrier, setSignatureShipper, setSphCodes, setSsrText, setTaxCC, setTaxPP, setUiModal, setValChargeCC, setValChargePP, setVolume, setWeightChargeCC, setWeightChargePP, setWtValPC, setXfwbSent, showAddParty, showAvi, showAwbDrop, showBooking, showCca, showCommodity, showCoo, showCsd, showCsdSendMenu, showDgd, showDimension, showDo, showDocsMenu, showDueAgent, showDueCarrier, showHSCode, showHandling, showLabel, showLithium, showLogsModal, showManifest, showOverseasMaster, showRateLine, showSli, showSubAgentMaster, showTemp, signatureCarrier, signatureShipper, sphCodes, ssrText, taxCC, taxPP, totalAgentAmount, totalCC, totalCarrierAmount, totalPP, uiModal, valChargeCC, valChargePP, volume, weightChargeCC, weightChargePP, wtValPC, xfwbSent };
}
