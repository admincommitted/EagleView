// State and logic
// Split out of EFreightAWBForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { volWtFromCbm, chargeableOf } from '../../components/FreightForwarding/awb/weightCalc';

export default function useEFreightAWBForm(ctx) {
  const { register, handleSubmit, watch, setValue } = useForm();
  const selectedIataAgentName = watch('iataAgent');
  const watchedAwb = watch('awbNumber');

  
  const [showDimsModal, setShowDimsModal] = useState(false);
  const [dims, setDims] = useState([{ pieces: '', weight: '', length: '', width: '', height: '', volume: '', stackable: false, tiltable: false }]);
  const handleAddDim = () => setDims([...dims, { pieces: '', weight: '', length: '', width: '', height: '', volume: '', stackable: false, tiltable: false }]);
  
  const handleRemoveDim = (index) => {
    if (dims.length > 1) {
      setDims(dims.filter((_, i) => i !== index));
    }
  };

  const updateDim = (index, field, value) => {
    const newDims = [...dims];
    newDims[index][field] = value;
    
    // Auto calculate volume if L, W, H, Pieces are present
    if (['pieces', 'length', 'width', 'height'].includes(field)) {
      const p = parseFloat(newDims[index].pieces) || 0;
      const l = parseFloat(newDims[index].length) || 0;
      const w = parseFloat(newDims[index].width) || 0;
      const h = parseFloat(newDims[index].height) || 0;
      if (p > 0 && l > 0 && w > 0 && h > 0) {
        newDims[index].volume = ((l * w * h * p) / 1000000).toFixed(3);
      }
    }
    setDims(newDims);
  };

  const totalPieces = dims.reduce((sum, d) => sum + (parseFloat(d.pieces) || 0), 0);
  const totalWeight = dims.reduce((sum, d) => sum + (parseFloat(d.weight) || 0), 0);
  const totalVolume = dims.reduce((sum, d) => sum + (parseFloat(d.volume) || 0), 0);
  // IATA volumetric weight: cbm x 1,000,000 / 6000 (was cbm x 167). Chargeable = higher of the Weight box (or the
  // dimension lines' weight) and the volumetric weight, rounded up to the next 0.5 kg / whole lb. 29-Oct-2026
  const volWeight = totalVolume > 0 ? volWtFromCbm(totalVolume).toFixed(2) : '';


    React.useEffect(() => {
    if (dims.length > 0 && dims.some(d => d.pieces || d.weight || d.volume)) {
        setValue('pieces', totalPieces || '');
        setValue('weight', totalWeight || '');
        // For volume field which might not be registered yet
        // Let's not register it if it's not registered, but we can set it
        // Actually, the volume field has no register: <input style={{...inputStyle, paddingRight:'30px'}} />
    }
  }, [totalPieces, totalWeight, totalVolume, setValue]);

  const [airports, setAirports] = useState([]);

  const [currencies, setCurrencies] = useState([]);
  const [sphList, setSphList] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [awbStocks, setAwbStocks] = useState([]);
  const [iataAgents, setIataAgents] = useState([]);

  React.useEffect(() => {
    const fetchMasters = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };
        const [airRes, curRes, sphRes, airlRes, stockRes, iataRes] = await Promise.all([
          axios.get('/api/locations/airports', { headers }).catch(()=>({data:{data:[]}})),
          axios.get('/api/masters/currencies', { headers }).catch(()=>({data:{data:[]}})),
          axios.get('/api/masters/sph-master', { headers }).catch(()=>({data:{data:[]}})),
          axios.get('/api/masters/airlines', { headers }).catch(()=>({data:{data:[]}})),
          axios.get('/api/stock/list?status=AVAILABLE', { headers }).catch(()=>({data:{data:[]}})),
            axios.get('/api/masters/iataagents', { headers }).catch(()=>({data:{data:[]}}))
        ]);
        if(airRes.data && Array.isArray(airRes.data)) setAirports(airRes.data);
        else if(airRes.data?.data) setAirports(airRes.data.data);
        
        if(curRes.data && Array.isArray(curRes.data)) setCurrencies(curRes.data);
        else if(curRes.data?.data) setCurrencies(curRes.data.data);
        
        if(sphRes.data && Array.isArray(sphRes.data)) setSphList(sphRes.data);
        else if(sphRes.data?.data) setSphList(sphRes.data.data);
        
        if(airlRes.data && Array.isArray(airlRes.data)) setAirlines(airlRes.data);
        else if(airlRes.data?.data) setAirlines(airlRes.data.data);
        if(stockRes?.data && Array.isArray(stockRes.data)) setAwbStocks(stockRes.data);
        else if(stockRes?.data?.data) setAwbStocks(stockRes.data.data);
        
        let agentsArr = [];
        if(iataRes?.data && Array.isArray(iataRes.data)) agentsArr = iataRes.data;
        else if(iataRes?.data?.data) agentsArr = iataRes.data.data;
        
        if (agentsArr.length > 0) {
            setIataAgents(agentsArr);
            const defAgent = agentsArr.find(a => a.isDefault) || agentsArr[0];
            setValue('iataAgent', defAgent.name);
        }
      } catch (err) {
        console.error("Error fetching masters", err);
      }
    };
    fetchMasters();
  }, []);


  // ---- the AWB screen's own actions. All four were dead buttons until 30-Oct-2026. ----
  const [otherCharges, setOtherCharges] = useState([{ code: '', description: '', amount: '', dueTo: 'Due Carrier', remarks: '' }]);
  const addCharge = () => setOtherCharges([...otherCharges, { code: '', description: '', amount: '', dueTo: 'Due Carrier', remarks: '' }]);
  const removeCharge = (i) => setOtherCharges(otherCharges.length > 1 ? otherCharges.filter((_, x) => x !== i) : otherCharges);
  const updateCharge = (i, field, value) => {
    const next = [...otherCharges];
    next[i] = { ...next[i], [field]: value };
    setOtherCharges(next);
  };

  const [rateInfo, setRateInfo] = useState(null);
  const [rating, setRating] = useState(false);
  // "Auto Rate": the TACT rates already loaded in this system decide the rate. If there is none for
  // this sector / weight, it says so - it does not make a rate up.
  const autoRate = async () => {
    const origin = watch('origin'), destination = watch('destination');
    const carrier = watch('airline') || watch('carrier') || '';
    if (!origin || !destination) { toast.error('Fill the origin and destination first'); return; }
    if (!(chargeableWeight > 0)) { toast.error('A chargeable weight is needed - fill the weight or the dimensions'); return; }
    setRating(true);
    try {
      const q = new URLSearchParams({ origin, destination, weight: String(chargeableWeight) });
      if (carrier) q.set('carrier', String(carrier).slice(0, 3));
      const r = await axios.get('/api/tact/quote?' + q.toString(), { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } });
      const j = r.data || {};
      setRateInfo(j);
      setValue('rateCharge', j.rate);
      setValue('rateClass', j.rateClass);
      setValue('total', j.amount);
      toast.success('TACT ' + j.rateClass + ' rate ' + j.currency + ' ' + j.rate + ' at the ' + j.weightBreak + ' kg break = ' + j.amount, { duration: 6000 });
    } catch (err) {
      const msg = (err.response && err.response.data && err.response.data.error) || err.message;
      setRateInfo({ success: false, error: msg });
      toast.error(msg, { duration: 8000 });
    }
    setRating(false);
  };

  const printAwb = () => window.print();

  // Bulk dims: the browser reads the CSV / Excel, so no new server dependency is needed
  const downloadDims = async () => {
    const XLSX = await import('xlsx');
    const rows = (dims.length ? dims : [{}]).map(d => ({
      Pieces: d.pieces || '', 'Weight (kg)': d.weight || '', 'Length (cm)': d.length || '',
      'Width (cm)': d.width || '', 'Height (cm)': d.height || '', 'Volume (cbm)': d.volume || '',
      Stackable: d.stackable ? 'Y' : 'N', Tiltable: d.tiltable ? 'Y' : 'N',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Dimensions');
    XLSX.writeFile(wb, 'awb-dimensions-' + (watch('awbNumber') || 'new') + '.xlsx');
  };

  const uploadDims = async (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv|txt)$/i.test(file.name)) { toast.error('Use an Excel or CSV file'); return; }
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!raw.length) throw new Error('that sheet has no rows');
      const keys = Object.keys(raw[0]);
      const find = (words) => keys.find(k => words.some(w => String(k).toLowerCase().replace(/[^a-z]/g, '').includes(w)));
      const kP = find(['piece', 'pcs', 'qty']), kW = find(['weight', 'wt']), kL = find(['length', 'len']),
            kB = find(['width', 'breadth']), kH = find(['height', 'hgt']), kV = find(['volume', 'cbm']),
            kS = find(['stack']), kT = find(['tilt']);
      if (!kP && !kW && !kL) throw new Error('no Pieces / Weight / Length column found. Headings seen: ' + keys.slice(0, 8).join(', '));
      const n = (v) => { const x = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return Number.isFinite(x) ? String(x) : ''; };
      const yes = (v) => /^(y|yes|true|1)$/i.test(String(v).trim());
      const rows = raw.map(r => {
        const d = { pieces: kP ? n(r[kP]) : '', weight: kW ? n(r[kW]) : '', length: kL ? n(r[kL]) : '',
          width: kB ? n(r[kB]) : '', height: kH ? n(r[kH]) : '', volume: kV ? n(r[kV]) : '',
          stackable: kS ? yes(r[kS]) : false, tiltable: kT ? yes(r[kT]) : false };
        // the same volume arithmetic the grid uses, when the file did not carry it
        const p = parseFloat(d.pieces) || 0, l = parseFloat(d.length) || 0, w = parseFloat(d.width) || 0, h = parseFloat(d.height) || 0;
        if (!d.volume && p > 0 && l > 0 && w > 0 && h > 0) d.volume = ((l * w * h * p) / 1000000).toFixed(3);
        return d;
      }).filter(d => d.pieces || d.weight || d.volume);
      if (!rows.length) throw new Error('every row was empty');
      setDims(rows);
      toast.success(rows.length + ' dimension line(s) loaded from ' + file.name);
    } catch (err) {
      toast.error('Could not read that file: ' + err.message);
    }
  };

  const onSubmit = async (data) => {
    try {
      toast.loading('Saving AWB to Database...');
      const payload = {
          awbNumber: data.awbNumber || '000-00000000',
          type: 'MAWB',
          formData: {
              dep: data.origin,
              dest: data.destination,
              totalPieces: data.pieces,
              grossWeight: data.weight,
              shipperName: selectedShipper?.name || '',
              shipperAddress: selectedShipper?.addressLineOne || '',
              consigneeName: selectedConsignee?.name || '',
              ...data
          },
          // 30-Oct-2026: the dimension lines and the charge lines were both dropped here - the payload
          // sent rateLines: [] and no dims at all, so everything typed into those two grids was lost.
          dims: dims.filter(d => d.pieces || d.weight || d.volume).map(d => ({
              pieces: parseFloat(d.pieces) || 0, weight: parseFloat(d.weight) || 0,
              length: parseFloat(d.length) || 0, width: parseFloat(d.width) || 0, height: parseFloat(d.height) || 0,
              volume: parseFloat(d.volume) || 0, stackable: !!d.stackable, tiltable: !!d.tiltable,
          })),
          totals: { pieces: totalPieces, weight: totalWeight, volume: totalVolume, volumetricWeight: parseFloat(volWeight) || 0, chargeableWeight },
          rateLines: otherCharges.filter(c => String(c.code || '').trim() || parseFloat(c.amount)).map(c => ({
              code: c.code || '', description: c.description || '', amount: parseFloat(c.amount) || 0,
              dueTo: c.dueTo || 'Due Carrier', remarks: c.remarks || '',
          })),
      };
      
      await axios.post('/api/awb/create', payload, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
      toast.dismiss();
      toast.success('AWB Successfully Saved to Database!');
    } catch (err) {
      toast.dismiss();
      toast.error('Error saving AWB: ' + err.message);
      console.error(err);
    }
  };

  const [shipmentType, setShipmentType] = useState('Loose');
  const [rightSidebarMode, setRightSidebarMode] = useState(null);
  
  const [showCommodityDropdown, setShowCommodityDropdown] = useState(false);
  const [showShipperDropdown, setShowShipperDropdown] = useState(false);
  const [showConsigneeDropdown, setShowConsigneeDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const parseJwt = (token) => {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (e) {
      return null;
    }
  };
  const token = localStorage.getItem('token');
  const user = token ? parseJwt(token) : null;

  const [showPlacePicker, setShowPlacePicker] = useState(false);
  const [showWeightUnit, setShowWeightUnit] = useState(false);
  const [showVolumeUnit, setShowVolumeUnit] = useState(false);
  const [selectedShipper, setSelectedShipper] = useState(null);
  const [selectedConsignee, setSelectedConsignee] = useState(null);
  const [selectedNotify, setSelectedNotify] = useState(null);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [volumeUnit, setVolumeUnit] = useState('cbm');
  const [routingStops, setRoutingStops] = useState([]);

  // Enhanced Colorful & Clean Theme
  const theme = {
    primary: 'var(--primary-color)', // Global theme color
    secondary: '#4b5563', // Slate gray for secondary elements
    bgLight: '#f3f4f6',
    border: '#e5e7eb',
    textMain: '#111827',
    textMuted: '#6b7280',
    blueText: '#0284c7',
    cardShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
  };

  const inputStyle = {
    width: '100%', height: '38px', padding: '0 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', color: '#111827', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)', boxSizing: 'border-box'
  };

  const labelStyle = {
    display: 'block', fontSize: '12px', color: theme.textMuted, marginBottom: '6px', fontWeight: '600', letterSpacing: '0.3px'
  };

  const sectionStyle = {
    border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: theme.cardShadow, position: 'relative', overflow: 'visible', background: 'color-mix(in srgb, var(--primary-color) 1%, white)'
  };
  
  const sectionHeaderStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', color: theme.primary, fontWeight: '700', fontSize: '14px', textTransform: 'uppercase', backgroundColor: 'color-mix(in srgb, var(--primary-color) 6%, white)', padding: '12px 16px', borderRadius: '6px', margin: '-8px -8px 20px -8px', border: '1px solid color-mix(in srgb, var(--primary-color) 15%, white)'
  };
  const grossForChg = parseFloat(watch('weight')) || totalWeight || 0;
  const chargeableWeight = weightUnit === 'ton' ? Math.max(grossForChg, (parseFloat(volWeight) || 0) / 1000) : chargeableOf(grossForChg, volWeight, /^lb/i.test(weightUnit) ? 'L' : 'K');
  return { addCharge, autoRate, downloadDims, otherCharges, printAwb, rateInfo, rating, removeCharge, updateCharge, uploadDims,
    chargeableWeight, airlines, airports, awbStocks, currencies, dims, handleAddDim, handleRemoveDim, handleSubmit, iataAgents, inputStyle, labelStyle, onSubmit, parseJwt, register, rightSidebarMode, routingStops, sectionHeaderStyle, sectionStyle, selectedConsignee, selectedIataAgentName, selectedNotify, selectedShipper, setAirlines, setAirports, setAwbStocks, setCurrencies, setDims, setIataAgents, setRightSidebarMode, setRoutingStops, setSelectedConsignee, setSelectedNotify, setSelectedShipper, setShipmentType, setShowCommodityDropdown, setShowConsigneeDropdown, setShowDatePicker, setShowDimsModal, setShowPlacePicker, setShowShipperDropdown, setShowTimePicker, setShowVolumeUnit, setShowWeightUnit, setSphList, setValue, setVolumeUnit, setWeightUnit, shipmentType, showCommodityDropdown, showConsigneeDropdown, showDatePicker, showDimsModal, showPlacePicker, showShipperDropdown, showTimePicker, showVolumeUnit, showWeightUnit, sphList, theme, token, totalPieces, totalVolume, totalWeight, updateDim, user, volWeight, volumeUnit, watch, watchedAwb, weightUnit };
}
