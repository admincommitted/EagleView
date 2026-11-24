// State and logic
// Split out of TactMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Activity, AlertTriangle, FileText, Globe, Plane, Shield } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function useTactMasterForm(ctx) {
  const [activeSubTab, setActiveSubTab] = useState('country');

  const [countryRules, setCountryRules] = useState([]);
  const [carrierRules, setCarrierRules] = useState([]);
  const [dgrMaster, setDgrMaster] = useState([]);
  const [equipmentRules, setEquipmentRules] = useState([]);
  const [surcharges, setSurcharges] = useState([]);
    const [tactRates, setTactRates] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [shcConflicts, setShcConflicts] = useState([]);
  const [addons, setAddons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAircraft, setSelectedAircraft] = useState(null);

  const fetchData = async () => {
    try {
      const [countries, carriers, dgr, equip, surch, icer, shc, addonRes] = await Promise.all([
        axios.get('/api/tact/country-rules'),
        axios.get('/api/tact/carrier-rules'),
        axios.get('/api/tact/dgr'),
        axios.get('/api/tact/equipment'),
        axios.get('/api/tact/surcharges'),
          axios.get('/api/tact/exchange-rates'),
          axios.get('/api/tact/shc-conflicts'),
          axios.get('/api/tact/proportional-rates'),
      ]);
      setCountryRules(countries.data);
      setCarrierRules(carriers.data);
      setDgrMaster(dgr.data);
      setEquipmentRules(equip.data);
      setSurcharges(surch.data);
        setExchangeRates(icer.data);
        setShcConflicts(shc.data);
        setAddons(addonRes.data);
        const rates = await axios.get('/api/tact/rates');
        setTactRates(rates.data);
    } catch (err) {
      console.error("Error fetching TACT data:", err);
      toast.error('Failed to connect to TACT Database.');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  const downloadCSV = () => {
    let dataToDownload = [];
    let filename = '';
    
    if (activeSubTab === 'country') { dataToDownload = countryRules; filename = 'TACT_Country_Rules.csv'; }
    else if (activeSubTab === 'carrier') { dataToDownload = carrierRules; filename = 'TACT_Carrier_Embargoes.csv'; }
    else if (activeSubTab === 'dgr') { dataToDownload = dgrMaster; filename = 'IATA_DGR_Master.csv'; }
    else if (activeSubTab === 'equipment') { dataToDownload = equipmentRules; filename = 'Aircraft_Equipment_Limits.csv'; }
    else if (activeSubTab === 'rates') { dataToDownload = surcharges; filename = 'TACT_Surcharges.csv'; }
      else if (activeSubTab === 'gcr') { dataToDownload = tactRates; filename = 'IATA_GCR_Rates.csv'; }
      else if (activeSubTab === 'icer') { dataToDownload = exchangeRates; filename = 'IATA_Exchange_Rates.csv'; }
      else if (activeSubTab === 'shc') { dataToDownload = shcConflicts; filename = 'IATA_SHC_Conflicts.csv'; }
      else if (activeSubTab === 'addons') { dataToDownload = addons; filename = 'TACT_Addon_Rates.csv'; }
    
    if (dataToDownload.length === 0) {
        toast.error('No data available to download for this tab.');
        return;
    }
    
    // Generate CSV
    // 28-Oct-2026: id left out (a downloaded file uploaded again failed on duplicate ids); nested rows (GCR rate details) left out
    const headers = Object.keys(dataToDownload[0]).filter(k => !['id', 'createdAt', 'updatedAt'].includes(k) && (dataToDownload[0][k] === null || typeof dataToDownload[0][k] !== 'object'));
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of dataToDownload) {
        const values = headers.map(header => {
            let val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
            val = val.replace(/"/g, '""');
            if (val.search(/("|,|\n)/g) >= 0) val = `"${val}"`;
            return val;
        });
        csvRows.push(values.join(','));
    }
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

const filteredCountry = countryRules.filter(r => Object.values(r).join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredCarrier = carrierRules.filter(r => Object.values(r).join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredDgr = dgrMaster.filter(r => Object.values(r).join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredEquipment = equipmentRules.filter(r => Object.values(r).join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredSurcharges = surcharges.filter(r => Object.values(r).join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredExchangeRates = exchangeRates.filter(r => Object.values(r).join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredShcConflicts = shcConflicts.filter(r => Object.values(r).join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredAddons = addons.filter(r => Object.values(r).join(' ').toLowerCase().includes(searchTerm.toLowerCase()));

  const filteredTactRates = tactRates.filter(r => 
      `${r.originCode} ${r.destinationCode} ${r.carrierCode} ${r.currencyCode}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const tabs = [
      { id: 'country', label: 'Sec 7: Country Rules', icon: Globe },
        { id: 'carrier', label: 'Sec 8: Carrier Rules', icon: Plane },
      { id: 'rates', label: 'TACT Surcharges', icon: Activity },
      { id: 'gcr', label: 'IATA GCR Rates', icon: FileText },
      { id: 'dgr', label: 'DGR & UN Masters', icon: AlertTriangle },
      { id: 'equipment', label: 'Aircraft Equipment', icon: Shield },
        { id: 'icer', label: 'IATA Exchange Rates', icon: Activity },
        { id: 'shc', label: 'SHC Conflicts', icon: AlertTriangle },
        { id: 'addons', label: 'TACT Add-on Rates', icon: Activity },
    ];


  const getCompanyLogo = (make) => {
    if (!make || make === 'N/A') return <span style={{ color: '#94a3b8' }}>N/A</span>;
    
    let brandColor = '#475569';
    let brandName = make.toUpperCase();

    if (make === 'Airbus') { brandColor = '#00205B'; }
    if (make === 'Boeing') { brandColor = '#0039A6'; }
    if (make === 'Embraer') { brandColor = '#00508F'; }
    if (make === 'ATR') { brandColor = '#0062A5'; }
    if (make === 'Bombardier') { brandColor = '#333333'; }
    if (make === 'McDonnell Douglas') { brandColor = '#D3212D'; }
    if (make === 'Antonov') { brandColor = '#0055A4'; }
    if (make === 'Ilyushin') { brandColor = '#1d4ed8'; }
    if (make === 'Lockheed Martin') { brandColor = '#475569'; }
    if (make === 'Cessna') { brandColor = '#0369a1'; }
    if (make === 'Saab') { brandColor = '#004B87'; }
    if (make === 'Fokker') { brandColor = '#F58220'; }
    if (make === 'Tupolev') { brandColor = '#b91c1c'; }
    if (make === 'British Aerospace') { brandColor = '#1d4ed8'; }
    if (make === 'Beechcraft') { brandColor = '#0f172a'; }
    if (make === 'Fairchild') { brandColor = '#334155'; }
    if (make === 'Short Brothers') { brandColor = '#0f766e'; }
    if (make === 'Convair') { brandColor = '#57534e'; }

    
  
return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ 
          width: '20px', height: '20px', borderRadius: '4px', 
          backgroundColor: brandColor, display: 'flex', 
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
        }}>
          <Plane size={12} color="#ffffff" style={{ transform: 'rotate(45deg)' }} />
        </div>
        <span style={{ 
          fontWeight: 'bold', 
          color: brandColor, 
          fontSize: '14px'
        }}>
          {brandName}
        </span>
      </div>
    );
  };
  return { activeSubTab, addons, carrierRules, countryRules, dgrMaster, downloadCSV, equipmentRules, exchangeRates, fetchData, filteredAddons, filteredCarrier, filteredCountry, filteredDgr, filteredEquipment, filteredExchangeRates, filteredShcConflicts, filteredSurcharges, filteredTactRates, getCompanyLogo, searchTerm, selectedAircraft, setActiveSubTab, setAddons, setCarrierRules, setCountryRules, setDgrMaster, setEquipmentRules, setExchangeRates, setSearchTerm, setSelectedAircraft, setShcConflicts, setSurcharges, setTactRates, shcConflicts, surcharges, tabs, tactRates };
}
