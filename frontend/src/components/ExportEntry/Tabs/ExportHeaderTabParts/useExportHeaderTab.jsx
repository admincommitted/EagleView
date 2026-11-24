// State and logic
// Split out of ExportHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useEffect, useState } from 'react';
import { getMaster } from '../../../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import { isDbkItem } from '../Schemes/schemeUtils';
import { getParties } from '../../../../utils/partiesCache'; // shared copy of the party list, 09-Nov-2026
import { useExportContext } from '../../ExportContext';
import toast from 'react-hot-toast';
import { loadForeignPorts } from '../../../../utils/foreignPorts';

// party master values -> SB codes. Party master: Manufacturer / Merchant / Merchant Exporter Courier [C] /
// Manufacturer Exporter Courier [D]; Private / Government / Undertaking / Others / Warehouse Shipping Bill [W]
export const partyMerc = (v) => { const t = String(v || '').toUpperCase(); if (!t) return ''; if (/COURIER/.test(t)) return /MANUF/.test(t) ? 'D' : 'C'; if (/\[D\]$/.test(t) || t === 'D') return 'D'; if (/\[C\]$/.test(t) || t === 'C') return 'C'; if (/MANUF/.test(t) || t === 'F') return 'F'; if (/MERCH/.test(t) || t === 'M' || t === 'R') return 'M'; return ''; };
export const partyClass = (v) => { const t = String(v || '').toUpperCase(); if (!t) return ''; if (/WAREHOUSE|\[W\]/.test(t) || t === 'W') return 'W'; if (/^GOV/.test(t) || t === 'G') return 'G'; if (/^PRIV/.test(t) || t === 'P') return 'P'; return ''; };

export default function useExportHeaderTab(ctx) {
  // 30-Oct-2026: handleShipperSelect / handleConsigneeSelect / handleAddPacking / handleRemovePacking /
  // handleRemoveContainer were removed - they were the old versions of code that now lives elsewhere
  // (RichPartySelect fills the shipper / consignee; the Packing and Container windows keep their own rows),
  // and nothing on any screen called them any more.

  const { exportData, setExportData, items, dbkItems } = useExportContext();
  const shipmentMode = exportData.shipmentMode || 'AIR';
  const handleChange = (e) => setExportData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
  const [parties, setParties] = useState([]);
  const [chas, setChas] = useState([]);
  const [ports, setPorts] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [countries, setCountries] = useState([]);
  const [uqcs, setUqcs] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [foreignAirports, setForeignAirports] = useState([]);
  
  const filteredPorts = shipmentMode === "AIR" ? [...ports.filter(p => p.category === "AIR"), ...foreignAirports] : ports;
  // 29-Oct-2026: Indian ports (customs location, loading port, gateway) and foreign ports (destination, discharge) are
  // separate lists. Before, an AIR job offered foreign airports as customs location / loading port and only the
  // 3-letter IATA code (DXB) was put in destination / discharge port, which ICEGATE does not accept (it wants AEDXB).
  const isIndian = (p) => /^IN/i.test(String(p.portCode || '')) || /INDIA/i.test(String(p.country || ''));
  const indianPorts = (() => {
    const all = ports.filter(isIndian);
    const byMode = shipmentMode === 'AIR' ? all.filter(p => p.category === 'AIR') : shipmentMode === 'SEA' ? all.filter(p => p.category !== 'AIR') : all;
    return byMode.length ? byMode : all;
  })();
  // 04-Nov-2026: + the UN/LOCODE list (45,000 foreign ports, sea and air) read from iCAFFE; a code already offered is not repeated
  const [locodes, setLocodes] = useState([]);
  useEffect(() => { loadForeignPorts().then(setLocodes); }, []);
  const foreignPorts = (() => {
    const base = [...(shipmentMode === 'AIR' ? foreignAirports : []), ...ports.filter(p => !isIndian(p))];
    const have = new Set(base.map(p => String(p.portCode || '').toUpperCase()));
    return base.concat(locodes.filter(p => !have.has(p.portCode)));
  })();
  
  useEffect(() => {
    getParties().then(data => { if(Array.isArray(data)) setParties(data); else if(data.success) setParties(data.data); }).catch(err => console.error('Fetch error:', err));
    fetch('/api/masters/cha-master').then(res=>res.json()).then(data => { 
      let chaData = Array.isArray(data) ? data : (data.success ? data.data : []);
      setChas(chaData);
      const defaultCha = chaData.find(c => c.isDefault);
      if (defaultCha && !exportData.chaNo) {
        setExportData(prev => ({ ...prev, chaNo: defaultCha.chaCode, chaName: defaultCha.chaName, chaAddress: defaultCha.chaAddress }));
      }
    }).catch(err => console.error('Fetch error:', err));
    // foreign airports as customs port codes: country + IATA code (AE + DXB = AEDXB); Indian airports are in the ports master
    fetch('/api/locations/airports').then(res=>res.json()).then(data => { const arr = Array.isArray(data) ? data : data.data || [];
      setForeignAirports(arr.filter(a => a.iataCode && a.countryCode && String(a.countryCode).toUpperCase() !== 'IN')
        .map(a => ({ portCode: (String(a.countryCode) + String(a.iataCode)).toUpperCase(), iataCode: a.iataCode, countryCode: String(a.countryCode).toUpperCase(), portName: a.cityName + (a.airportName ? ' - ' + a.airportName : ''), category: 'AIR' }))); }).catch(e => console.error(e));
    // cities for the exporter City box: searched as the operator types (searchCities). 12-Nov-2026: the whole City
    // master (1,50,187 rows, about 48 MB) was loaded here each time the tab opened and held up the other lists.
    getMaster('/api/masters/countries').then(data => { if(Array.isArray(data)) setCountries(data); else if (data.success) setCountries(data.data); }).catch(err => console.error('Fetch error:', err));
    getMaster('/api/masters/uqcs').then(data => { if(Array.isArray(data)) setUqcs(data); else if(data.success) setUqcs(data.data);}).catch(err => console.error('Fetch error:', err));
    fetch('/api/masters/vessels').then(res=>res.json()).then(data => { if(Array.isArray(data)) setVessels(data); else if(data.success) setVessels(data.data);}).catch(err => console.error('Fetch error:', err));
    getMaster('/api/masters/airlines').then(data => { if(Array.isArray(data)) setAirlines(data); else if(data.success) setAirlines(data.data);}).catch(err => console.error('Fetch error:', err));
    fetch('/api/masters/warehouses').then(res=>res.json()).then(data => { if(Array.isArray(data)) setWarehouses(data); else if(data.success) setWarehouses(data.data);}).catch(err => console.error('Fetch error:', err));
    getMaster('/api/masters/states').then(data => { if(Array.isArray(data)) setStates(data); else if(data.success) setStates(data.data);}).catch(err => console.error('Fetch error:', err));
    getMaster('/api/masters/ports').then(data => {
      const arr = Array.isArray(data) ? data : (data.data || []);
      setPorts(arr.map(p => ({ portCode: p.portCode, portName: p.portName, category: p.category || 'ICD' })));
    }).catch(err => console.error('Fetch ports error:', err));
  }, []);

  // exporter of the job in the party master: by id, else by IEC, else by name (jobs made from a file / Excel or
  // typed by hand have no shipperId, so Branch Sr. No had no list). 29-Oct-2026
  const norm = (v) => String(v || '').trim().toUpperCase();
  const selectedShipper = parties.find(p => p.id === parseInt(exportData.shipperId))
    || (exportData.shipperIec ? parties.find(p => p.isShipper !== false && norm(p.taxId) === norm(exportData.shipperIec)) : null)
    || (exportData.shipperName ? parties.find(p => p.isShipper && norm(p.name) === norm(exportData.shipperName)) : null);
  const shipperBranches = selectedShipper ? (selectedShipper.branches || []) : [];
  const shipperAdCodes = selectedShipper ? (selectedShipper.adCodes || []) : [];

  
  const handleShipperBranchSelect = (e) => {
    const branchSrNo = e.target.value;
    const branch = shipperBranches.find(b => String(b.branchSrNo) === String(branchSrNo));
    if (branch) {
      setExportData({
        ...exportData,
        shipperBranchSrNo: branchSrNo,
        shipperAddress1: branch.address1 || '',
        shipperAddress2: branch.address2 || '',
        shipperCity: branch.city || '',
        shipperState: branch.state || '',
        shipperPin: branch.pinCode || '',
        shipperGstin: branch.gstin || branch.regNo || ''
      });
    } else {
      setExportData({ ...exportData, shipperBranchSrNo: branchSrNo });
    }
  };

  
  
  // When a job is opened (or a new one started): the window values follow the job. Before, Factory Stuffed, the
  // Packing / Container / ETP flags and the ETP details kept the previous job's values (or showed No while the job
  // had Yes); a new job also kept the last job's packing and container lists.
  useEffect(() => {
    if (!exportData) return;
    const pk = Array.isArray(exportData.PackingDetails) ? exportData.PackingDetails : [];
    const ct = Array.isArray(exportData.Containers) ? exportData.Containers : [];
    setPackingList(pk); setPackingFlag(pk.length || exportData.packingFlag === 'Y' ? 'Y' : 'N');
    setContainerList(ct); setContainerFlag(ct.length || exportData.containerFlag === 'Y' ? 'Y' : 'N');
    setNfeiCategory(exportData.nfeiCategory || ''); setNfeiCategoryCode(exportData.nfeiCategoryCode || '');
    setFactoryAddress(exportData.factoryAddress || '');
    setFactoryStuffed(/^Y/i.test(String(exportData.factoryStuffed || '')) ? 'Yes' : 'No');
    const etp = exportData.etpDetails && typeof exportData.etpDetails === 'object' ? exportData.etpDetails : null;
    setEtpDetails(prev => etp ? { ...prev, ...etp } : { JobNo: '', JobDate: '', SiteId: '', GatewayPort: '', StuffPort: '', CarrierCode: '', PortOfDischarge: '', CarrierNumber: '', BondCode: '', BondNumber: '', BondDate: '', BondSite: '', ExpTransShippmentDate: '', ExpTransShippmentNo: '', AirWayBillNo: '' });
    setEtpFlag(etp || exportData.etpFlag === 'Y' ? 'Y' : 'N');
    // values the screen shows as chosen are also stored (the SB JSON got an empty exporter class while the box said Private)
    setExportData(prev => {
      const add = {};
      if (!prev.shipperGstinType) add.shipperGstinType = 'GSTIN';
      if (!prev.natureOfCargo && (prev.shipmentMode || 'AIR') === 'AIR') add.natureOfCargo = 'P';
      return Object.keys(add).length ? { ...prev, ...add } : prev;
    });
  }, [exportData.id, exportData.jobNo]); // when a job is loaded or a new one started

  // FOB Rs / DBK Rs follow the items and the drawback rows: worked out by useExportCalc (12-Nov-2026: they were
  // only worked out while this tab was open)
  // state of origin set from the GSTIN (code only): show its name from the state master
  useEffect(() => {
    if (!exportData.stateOriginCode || exportData.stateOriginName || !states.length) return;
    const st = states.find(s => String(s.taxCode) === String(exportData.stateOriginCode));
    if (st) setExportData(prev => ({ ...prev, stateOriginName: st.stateName }));
  }, [exportData.stateOriginCode, states.length]);
  // Values from the party master (Merchant / Manufacturer, Class, Branch Sr. No ...). On opening a job only empty
  // boxes are filled; "From Party Master" (fromParty(true)) takes everything again from the master.
  const fromParty = (force) => {
    const p = selectedShipper;
    if (!p) { if (force) toast.error('Exporter not found in the Party Master (check the name / IEC)'); return; }
    const branches = p.branches || [];
    const gst = norm(exportData.shipperGstin);
    const br = branches.find(b => String(b.branchSrNo) === String(exportData.shipperBranchSrNo))
      || (gst ? branches.find(b => norm(b.gstin || b.regNo) === gst) : null)
      || (branches.length === 1 ? branches[0] : null)
      || (force ? branches[0] : null);
    const merc = partyMerc(p.mercManuf), cls = partyClass(p.classType);
    setExportData(prev => {
      const n = { ...prev, shipperId: p.id };
      const put = (k, v) => { if (v !== undefined && v !== null && v !== '' && (force || !prev[k])) n[k] = v; };
      put('mercManuf', merc); put('shipperClass', cls); put('shipperIec', p.taxId);
      if (br) {
        put('shipperBranchSrNo', br.branchSrNo);
        if (force || !prev.shipperAddress1) { n.shipperAddress1 = br.address1 || ''; n.shipperAddress2 = br.address2 || ''; n.shipperCity = br.city || ''; n.shipperState = br.state || ''; n.shipperPin = br.pinCode || ''; }
        put('shipperGstin', norm(br.gstin || br.regNo));
      }
      const ads = p.adCodes || [];
      if (ads.length === 1) put('adCode', ads[0].adCode);
      put('autoField_12', p.panNumber); put('panNo', p.panNumber);
      return n;
    });
    if (force) toast.success(`Exporter details taken from the Party Master${br ? ' (branch ' + br.branchSrNo + ')' : ''}`);
    if (force && p.classType && !cls) toast(`Class "${p.classType}" in the Party Master has no ICEGATE code - choose the class on screen`, { icon: 'ℹ️' });
  };
  useEffect(() => { if (selectedShipper) fromParty(false); }, [selectedShipper && selectedShipper.id, exportData.id]);

  const hasDrawback = (items || []).some(isDbkItem) || (dbkItems || []).some(d => d.dbkNo); // 19 and 60 (12-Nov-2026)

  const [packingFlag, setPackingFlag] = useState('N');
  const [isPackingModalOpen, setIsPackingModalOpen] = useState(false);
  const [packingList, setPackingList] = useState([]);
  const [currentPacking, setCurrentPacking] = useState({ PackingNumberFrom: '', PackingNumberTo: '', PackingCode: '' });

  
  const [nfeiCategory, setNfeiCategory] = useState('');
  const [nfeiCategoryCode, setNfeiCategoryCode] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const [factoryStuffed, setFactoryStuffed] = useState('No');
  const [factoryAddress, setFactoryAddress] = useState('');
  const [isFactoryAddressModalOpen, setIsFactoryAddressModalOpen] = useState(false);
  const [isMarksNoModalOpen, setIsMarksNoModalOpen] = useState(false);
  const [isConfirmFactoryOpen, setIsConfirmFactoryOpen] = useState(false);

  const [exBondJob, setExBondJob] = useState('N');
  const [handCarry, setHandCarry] = useState('N');

  const handleFactoryStuffedChange = (e) => {
    const val = e.target.value;
    setFactoryStuffed(val);
    setExportData(prev => ({ ...prev, factoryStuffed: val }));
    if (val === 'Yes') {
      setIsConfirmFactoryOpen(true);
    }
  };

  const categoryList = [
    { code: '04', desc: 'CURRENCY CHEST' },
    { code: '05', desc: 'TOURIST GOODS' },
    { code: '06', desc: 'DEFENCE GOODS' },
    { code: '07', desc: 'GIFT PARCEL' },
    { code: '08', desc: 'OTHERS' },
    { code: '09', desc: 'FOR SEZ DTA ONLY' },
    { code: '01', desc: 'FREE TRADE SAMPLE' },
    { code: '02', desc: 'DIPLOMATIC GOODS' },
    { code: '03', desc: 'WARRANTY REPLACEMENT' },
  ];

    
  const [containerFlag, setContainerFlag] = useState('N');
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);
  const [containerList, setContainerList] = useState([]);
  const [currentContainer, setCurrentContainer] = useState({ ContainerNumber: '', ContainerSize: '', ContainerType: '', ExciseSealNo: '', SealDate: '', NoOfPktsStuffed: '', VGM: '', SealTypeIndicator: '', SealDeviceID: '', MovementDocumentType: '', MovementDocumentNumber: '', EqmntType: '', EqmntQty: '', EqmntQtyCode: '' });

  const handleAddContainer = () => {
    const no = String(currentContainer.ContainerNumber || '').trim().toUpperCase();
    if (!no) { toast.error(shipmentMode === 'SEA' ? 'Enter the container number' : 'Enter the ULD number'); return; }
    if (shipmentMode === 'SEA' && !/^[A-Z]{4}[0-9]{7}$/.test(no)) { toast.error('Container number is 4 letters + 7 digits (e.g. ABCU1234567)'); return; }
    if (containerList.some(c => String(c.ContainerNumber || '').toUpperCase() === no)) { toast.error(no + ' is already in the list'); return; }
    const newList = [...containerList, { ...currentContainer, ContainerNumber: no }];
    setContainerList(newList);
    setExportData(prev => ({ ...prev, Containers: newList }));
    setCurrentContainer({ ContainerNumber: '', ContainerSize: '', ContainerType: '', ExciseSealNo: '', SealDate: '', NoOfPktsStuffed: '', VGM: '', SealTypeIndicator: '', SealDeviceID: '', MovementDocumentType: '', MovementDocumentNumber: '', EqmntType: '', EqmntQty: '', EqmntQtyCode: '' });
  };
  
  const [etpFlag, setEtpFlag] = useState('N');
  const [isEtpModalOpen, setIsEtpModalOpen] = useState(false);
  const [etpDetails, setEtpDetails] = useState({ JobNo: '', JobDate: '', SiteId: '', GatewayPort: '', StuffPort: '', CarrierCode: '', PortOfDischarge: '', CarrierNumber: '', BondCode: '', BondNumber: '', BondDate: '', BondSite: '', ExpTransShippmentDate: '', ExpTransShippmentNo: '', AirWayBillNo: '' });

  const handleFlagChange = (field, setter, modalSetter, value) => {
    const upperVal = value.toUpperCase();
    setter(upperVal);
    setExportData(prev => ({ ...prev, [field]: upperVal }));
    if (upperVal === 'Y') {
      modalSetter(true);
    }
  };
  // City box: up to 50 cities matching the text typed (2 letters or more)
  const cityReq = React.useRef(0);
  const searchCities = (q) => {
    const t = String(q || '').trim();
    if (t.length < 2) { setCities([]); return; }
    const my = ++cityReq.current;
    setTimeout(() => {
      if (my !== cityReq.current) return;
      fetch('/api/locations/cities?q=' + encodeURIComponent(t) + '&limit=50').then(r => r.json()).then(data => { if (my !== cityReq.current) return; const seen = new Set(); setCities((Array.isArray(data) ? data : (data.data || [])).filter(c => c && c.cityName && !seen.has(String(c.cityName).toUpperCase()) && seen.add(String(c.cityName).toUpperCase()))); }).catch(() => {});
    }, 250);
  };
  return { searchCities, fromParty, indianPorts, foreignPorts, hasDrawback, airlines, categoryList, chas, cities, containerFlag, containerList, countries, currentContainer, currentPacking, etpDetails, etpFlag, exBondJob, exportData, factoryAddress, factoryStuffed, filteredPorts, foreignAirports, handCarry, handleAddContainer, handleChange, handleFactoryStuffedChange, handleFlagChange, handleShipperBranchSelect, isCategoryModalOpen, isConfirmFactoryOpen, isContainerModalOpen, isEtpModalOpen, isFactoryAddressModalOpen, isMarksNoModalOpen, isPackingModalOpen, nfeiCategory, nfeiCategoryCode, packingFlag, packingList, parties, ports, selectedShipper, setAirlines, setChas, setCities, setContainerFlag, setContainerList, setCountries, setCurrentContainer, setCurrentPacking, setEtpDetails, setEtpFlag, setExBondJob, setExportData, setFactoryAddress, setFactoryStuffed, setForeignAirports, setHandCarry, setIsCategoryModalOpen, setIsConfirmFactoryOpen, setIsContainerModalOpen, setIsEtpModalOpen, setIsFactoryAddressModalOpen, setIsMarksNoModalOpen, setIsPackingModalOpen, setNfeiCategory, setNfeiCategoryCode, setPackingFlag, setPackingList, setParties, setPorts, setStates, setUqcs, setVessels, setWarehouses, shipmentMode, shipperAdCodes, shipperBranches, states, uqcs, vessels, warehouses };
}

