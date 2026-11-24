import CustomAutocomplete from '../CustomAutocomplete';
import { getParties } from '../../utils/partiesCache'; // shared copy of the party list, 09-Nov-2026
import React, { useState } from 'react';
import { Save, RefreshCw, Trash2, Edit2, Search } from 'lucide-react';
import { askYes } from './switchRow';
import ModernDatePicker from '../common/ModernDatePicker';

export default function AirwayBillStockForm() {
  
  const [activeTab, setActiveTab] = useState('AWB');
  const [partyType, setPartyType] = useState('Select');
  const [airlines, setAirlines] = useState([]);
  const [airlineAddresses, setAirlineAddresses] = useState([]);
  const [selectedAirlineAddress, setSelectedAirlineAddress] = useState('');
  const [iataAddresses, setIataAddresses] = useState([]);
  const [selectedIataAddress, setSelectedIataAddress] = useState('');

  // AWB Stock form state
  const [awbPrefix3, setAwbPrefix3] = useState('');
  const [awbFirst4, setAwbFirst4] = useState('');
  const [awbLast4, setAwbLast4] = useState('');
  const [awbNoOf, setAwbNoOf] = useState('');
  const [awbLastSeqNo, setAwbLastSeqNo] = useState('');

  // HAWB Stock form state
  const [hawbPrefix, setHawbPrefix] = useState('');
  const [hawbStartNo, setHawbStartNo] = useState('');
  const [hawbCount, setHawbCount] = useState('');
  const [hawbEndNo, setHawbEndNo] = useState('');
  const [hawbPartyType, setHawbPartyType] = useState('Select');
  const [hawbPartyId, setHawbPartyId] = useState('');
  const [allParties, setAllParties] = useState([]);

  const [uiModal, setUiModal] = React.useState({ isOpen: false, title: '', message: '', type: 'success' });
  
  const customAlert = (msg) => {
      let title = 'INFORMATION';
      let type = 'success';
      if(msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('please')) {
          title = 'ERROR';
          type = 'error';
      } else if (msg.toLowerCase().includes('success')) {
          title = 'SUCCESS';
          type = 'success';
      }
      setUiModal({ isOpen: true, title, message: String(msg ?? ''), type });
      setTimeout(() => setUiModal({ isOpen: false, title: '', message: '', type: 'success' }), 3000);
  };

  const [queryData, setQueryData] = useState([]);
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stockDate, setStockDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [iataAgents, setIataAgents] = useState([]);

  const calculateLastAwb = (f4, l4, n) => {
    const first4 = f4 !== undefined ? f4 : awbFirst4;
    const last4  = l4 !== undefined ? l4 : awbLast4;
    const count  = n  !== undefined ? n  : awbNoOf;
    if (first4.length + last4.length === 8 && count && !isNaN(count)) {
      const startBase = parseInt(first4 + last4.substring(0, 3), 10);
      const num = parseInt(count, 10);
      const endBase = startBase + num - 1;
      const endCheck = endBase % 7;
      const endStr = endBase.toString().padStart(7, '0') + endCheck.toString();
      setAwbLastSeqNo(endStr.substring(0,4) + ' ' + endStr.substring(4));
    }
  };

  // 28-Oct-2026: rows picked with React state (the old code read the DOM); Unallocate / Void / Delete work on the
  // selected rows of the open tab (AWB or HAWB); the server only changes rows whose status allows it
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleId = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const stockAction = async (action, label) => {
    if (selectedIds.length === 0) return customAlert(`Please select at least one stock row to ${label}.`);
    if (action !== 'unallocate' && !(await askYes(`${label} ${selectedIds.length} selected stock row(s)?`))) return;
    try {
      const res = await fetch('/api/stock/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, type: activeTab === 'HAWB' ? 'HAWB' : 'AWB' })
      });
      const data = await res.json();
      if (data.success) { customAlert('Success: ' + data.message); setSelectedIds([]); handleQuery(); }
      else customAlert("ERROR: " + data.error);
    } catch(e) { customAlert("Network Error: " + e.message); }
  };
  const handleUnallocate = () => stockAction('unallocate', 'unallocate');
  const clearAwb = () => { setAwbPrefix3(''); setAwbFirst4(''); setAwbLast4(''); setAwbNoOf(''); setAwbLastSeqNo(''); setPartyType('Select'); setSelectedIds([]); };
  // 30-Oct-2026: Ending No is shown while typing (Starting No + Count - 1, same digit length); after Save it is the server's value
  const hawbEndPreview = (() => {
    if (/^\d+$/.test(hawbStartNo) && /^\d+$/.test(String(hawbCount)) && parseInt(hawbCount, 10) >= 1 && hawbStartNo.length <= 15) {
      return String(parseInt(hawbStartNo, 10) + parseInt(hawbCount, 10) - 1).padStart(hawbStartNo.length, '0');
    }
    return hawbEndNo;
  })();
  const enteredBy = (() => { try { const u = JSON.parse(localStorage.getItem('user') || '{}') || {}; return u.username || u.name || ''; } catch (e) { return ''; } })();
  const enteredDate = new Date().toLocaleDateString('en-GB');
  const clearHawb = () => { setHawbPrefix(''); setHawbStartNo(''); setHawbCount(''); setHawbEndNo(''); setHawbPartyType('Select'); setHawbPartyId(''); setSelectedIds([]); };

  // Return Stock tab
  const [returnAwb, setReturnAwb] = useState('');
  const [returnAction, setReturnAction] = useState('VOID');
  const [returnInfo, setReturnInfo] = useState(null);
  const verifyReturn = async () => {
    setReturnInfo(null);
    if (!returnAwb.trim()) return customAlert('Please enter the AWB number.');
    try {
      const res = await fetch('/api/stock/verify/' + encodeURIComponent(returnAwb.replace(/\D/g, '')));
      const data = await res.json();
      if (!data.success) return customAlert('ERROR: ' + data.error);
      setReturnInfo(data.data);
    } catch (e) { customAlert('Network Error: ' + e.message); }
  };
  const doReturn = async () => {
    if (!returnAwb.trim()) return customAlert('Please enter the AWB number.');
    if (returnAction === 'VOID' && !(await askYes('VOID cancels this AWB for ever. Continue?'))) return;
    try {
      const res = await fetch('/api/stock/return', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ awbNumber: returnAwb, action: returnAction }) });
      const data = await res.json();
      if (!data.success) return customAlert('ERROR: ' + data.error);
      customAlert('Success: ' + data.message); setReturnInfo(data.data); handleQuery();
    } catch (e) { customAlert('Network Error: ' + e.message); }
  };
const handleQuery = async () => {
      try {
        const urlParams = new URLSearchParams();
        if (fromDate) urlParams.append('fromDate', fromDate);
        if (toDate) urlParams.append('toDate', toDate);
        if (filterStatus && filterStatus !== 'ALL') urlParams.append('status', filterStatus);
        
        const endpoint = activeTab === 'HAWB' ? '/api/stock/hawb/list' : '/api/stock/list';
        const url = `${endpoint}?${urlParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      if(Array.isArray(data)) { setQueryData(data); setSelectedIds([]); }
    } catch(e) {
      console.error(e);
      customAlert('Failed to load AWB stock list: ' + e.message);
    }
  };


  React.useEffect(() => { setSelectedIds([]); handleQuery(); }, [activeTab]);

  React.useEffect(() => {
    handleQuery();
    fetch('/api/masters/airlines')
      .then(r => { if(!r.ok) throw new Error('Airlines load failed'); return r.json(); })
      .then(d => { if(Array.isArray(d)) setAirlines(d); })
      .catch(e => { console.error(e); customAlert('Failed to load airlines: ' + e.message); });
    getParties()
      .then(d => { if(Array.isArray(d)) setAllParties(d); })
      .catch(e => console.error(e));
    
    fetch('/api/masters/iataagents')
      .then(r => { if(!r.ok) throw new Error('IATA Agents load failed'); return r.json(); })
      .then(d => { if(Array.isArray(d)) setIataAgents(d); })
      .catch(e => { console.error(e); customAlert('Failed to load IATA agents: ' + e.message); });
  }, []);



  
  const handleHawbSave = async () => {
    try {
      if (!hawbStartNo || !hawbCount) {
        customAlert('Please enter Starting No and Count.');
        return;
      }
      if (!/^\d+$/.test(hawbStartNo.trim()) || !/^\d+$/.test(String(hawbCount).trim()) || parseInt(hawbCount, 10) < 1) return customAlert('Error: Starting No and Count must be numbers.');
      const response = await fetch('/api/stock/hawb/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: hawbPrefix.trim(), startSerialNumber: hawbStartNo.trim(), count: parseInt(hawbCount, 10), partyType: hawbPartyType !== 'Select' ? hawbPartyType : null, partyId: hawbPartyId || null, stockDate })
      });
      const data = await response.json();
      if (data.success) {
        customAlert(`SUCCESS: Generated ${data.generated} HAWBs (From ${data.startHawb} to ${data.endHawb})` + (data.skipped ? ` - ${data.skipped} already existed` : ''));
        setHawbEndNo(data.endHawb.replace(hawbPrefix, '')); handleQuery();
      } else {
        customAlert('ERROR: ' + data.error);
      }
    } catch (e) { customAlert('Network Error: ' + e.message); }
  };

  const handleSave = async () => {
    try {
      if (!/^\d{3}$/.test(awbPrefix3) || !/^\d+$/.test(String(awbNoOf).trim()) || parseInt(awbNoOf, 10) < 1) {
        customAlert('Please enter valid 3-digit Airline Prefix and Count (NO OF AWB).');
        return;
      }
      if (!/^\d{4}$/.test(awbFirst4) || !/^\d{4}$/.test(awbLast4)) return customAlert('Error: enter the first AWB serial as 4 + 4 digits (last digit = check digit).');
      const startSerial = awbFirst4 + (awbLast4.substring(0,3));
      if (Number(startSerial) % 7 !== Number(awbLast4[3])) return customAlert(`Error: check digit is wrong. For ${startSerial} it must be ${Number(startSerial) % 7} (serial mod 7).`);
      const response = await fetch('/api/stock/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ airlinePrefix: awbPrefix3, startSerialNumber: startSerial + awbLast4[3], count: parseInt(awbNoOf, 10), stockDate })
      });
      const data = await response.json();
      if (data.success) {
        customAlert(`SUCCESS: Generated ${data.generated} AWBs (From ${data.startAwb} to ${data.endAwb})` + (data.skipped ? ` - ${data.skipped} already existed` : ''));
        setAwbPrefix3(''); setAwbFirst4(''); setAwbLast4(''); setAwbNoOf(''); setAwbLastSeqNo(''); handleQuery();
      } else {
        customAlert('ERROR: ' + (data.error || 'Failed to generate stock.'));
      }
    } catch (e) { customAlert('Network Error: ' + e.message); }
  };

  const tabStyle = (isActive) => ({

    padding: '6px 16px',
    background: isActive ? '#f0f9ff' : 'transparent',
    color: isActive ? 'var(--primary-text, #0369a1)' : 'var(--text-muted, var(--text-muted, #64748b))',
    borderBottom: isActive ? '2px solid #0369a1' : '2px solid transparent',
    fontWeight: isActive ? 'bold' : 'normal',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s',
    textTransform: 'uppercase'
  });

  const panelStyle = {
    border: '1px solid var(--border-color, #cbd5e1)',
    borderRadius: '6px',
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    overflow: 'hidden'
  };

  const headerStyle = {
    background: '#e0f2fe',
    padding: '6px 16px',
    borderBottom: '1px solid #9ebdd2',
    borderLeft: '6px solid #0284c7',
    color: 'var(--text-main, var(--text-main, #0f172a))',
    fontWeight: 'bold',
    fontSize: '12px',
    textTransform: 'uppercase'
  };

  const inputGroupStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'var(--text-main, var(--text-main, #1e293b))',
    width: '120px',
    minWidth: '120px',
    textAlign: 'right',
    textTransform: 'uppercase'
  };

  const inputStyle = {
    padding: '6px 10px',
    border: '1px solid var(--border-color, #cbd5e1)',
    borderRadius: '4px',
    fontSize: '11px',
    outline: 'none',
    color: 'var(--text-main, var(--text-main, #0f172a))',
    background: 'var(--bg-panel, var(--bg-panel, #ffffff))',
    transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out'
  };

  const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 'bold',
    borderRadius: '4px',
    cursor: 'pointer',
    border: 'none',
    color: '#fff',
    textTransform: 'uppercase',
    minWidth: '90px',
    justifyContent: 'center'
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>

        <style>{`
          .premium-input {
            transition: all 0.2s ease;
            background-color: var(--bg-app, #f8fafc);
            border: 1px solid var(--border-color, #cbd5e1);
            border-radius: 4px;
            padding: 6px 10px;
            color: var(--text-main, #0f172a);
            font-size: 11px;
            font-weight: 500;
          }
          .premium-input:focus {
            border-color: #0ea5e9 !important;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.05), 0 0 0 2px rgba(14, 165, 233, 0.2) !important;
            background-color: var(--bg-panel, #ffffff) !important;
            outline: none;
          }
          .premium-input-mandatory {
            background-color: #fff1f2;
            border-color: #fda4af;
          }
          .premium-input[readonly], .premium-input:disabled {
            background-color: var(--bg-input, #f1f5f9);
            border-color: var(--border-color, #cbd5e1);
            color: var(--text-muted, #475569);
          }
          .premium-input::placeholder { color: #94a3b8; font-style: normal; }
          .premium-input-mandatory:focus {
            border-color: #e11d48 !important;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.05), 0 0 0 2px rgba(225, 29, 72, 0.2) !important;
            background-color: var(--bg-panel, #ffffff) !important;
          }
          .action-btn {
            transition: all 0.2s;
            cursor: pointer;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          }
          .action-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .data-table th {
            background-color: var(--bg-input, #f1f5f9);
            color: var(--text-muted, #475569);
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 700;
            padding: 8px 12px;
            border-bottom: 2px solid var(--border-color, #e2e8f0);
          }
          .data-table td {
            padding: 8px 12px;
            font-size: 12px;
            color: var(--text-main, #1e293b);
            border-bottom: 1px solid var(--bg-input, #f1f5f9);
          }
          .data-table tr:hover td {
            background-color: var(--bg-app, #f8fafc);
          }
        `}</style>

      {/* Content (30-Oct-2026: the empty "Search" sidebar was removed - it was never wired to anything) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

<div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', padding: '8px' }}>
      
      {/* Tabs Bar */}
      <div style={{ display: 'flex', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={tabStyle(activeTab === 'AWB')} onClick={() => setActiveTab('AWB')}>AirWayBill Stock</div>
        <div style={tabStyle(activeTab === 'HAWB')} onClick={() => setActiveTab('HAWB')}>HAWB Stock</div>
        <div style={tabStyle(activeTab === 'ISSUE')} onClick={() => setActiveTab('ISSUE')}>Issue Stock to SubAgent</div>
        <div style={tabStyle(activeTab === 'RETURN')} onClick={() => setActiveTab('RETURN')}>Return Stock</div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        
        {/* AWB STOCK TAB */}
        {activeTab === 'AWB' && (
          <>
            <div className="modern-panel" style={panelStyle}>
              <div style={headerStyle}>AIRWAYBILL STOCK</div>
              
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Party Type</label>
                    <select className="premium-input premium-input-mandatory" value={partyType} onChange={e => setPartyType(e.target.value)} style={{ flex: 1 }}>
                      <option>Select</option>
                      <option>Airline</option>
                      <option>IATA</option>
                    </select>
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Stock Date</label>
                    <ModernDatePicker className="premium-input" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ flex: 1 }} />
                  </div>

                  {(partyType === 'Airline' || partyType === 'IATA') && (
                    <>
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>AirLine</label>
                        <CustomAutocomplete
                          staticData={airlines.filter(a => a.prefix && a.prefix.trim() !== '').map(a => ({
                            id: a.prefix,
                            title: `${a.prefix} - ${a.name} (${a.code2})`,
                            subtitle: a.code3 ? `Accounting: ${a.code3}` : '',
                            raw: a
                          }))}
                          placeholder="SEARCH & SELECT AIRLINE..."
                          className="premium-input premium-input-mandatory"
                          style={{ flex: 1 }}
                          onSelect={opt => {
                            if (opt && opt.raw && opt.raw.prefix) {
                              setAwbPrefix3(opt.raw.prefix);
                            }
                          }}
                        />
                      </div>
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>AirLine Address</label>
                        <select className="premium-input" style={{ flex: 1 }} value={selectedAirlineAddress} onChange={e => setSelectedAirlineAddress(e.target.value)}>
                            {airlineAddresses.length > 0 ? airlineAddresses.map((a, i) => <option key={i} value={a}>{a}</option>) : <option value="">Select Address</option>}
                          </select>
                      </div>
                    </>
                  )}

                  {partyType === 'IATA' && (
                    <>
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>IATA</label>
                        <CustomAutocomplete
                            staticData={iataAgents.map(a => ({
                              id: a.id,
                              title: `${a.iataCode || ''} - ${a.name}`,
                              subtitle: a.address || '',
                              raw: a
                            }))}
                            placeholder="SEARCH & SELECT IATA AGENT..."
                            className="premium-input premium-input-mandatory"
                            style={{ flex: 1 }}
                          />
                      </div>
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>IATA Address</label>
                        <select className="premium-input" style={{ flex: 1 }} value={selectedIataAddress} onChange={e => setSelectedIataAddress(e.target.value)}>
                            {iataAddresses.length > 0 ? iataAddresses.map((a, i) => <option key={i} value={a}>{a}</option>) : <option value="">Select Address</option>}
                          </select>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
                    <label style={labelStyle}>AirWayBill No</label>
                    <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'center' }}>
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="3 DIGIT" style={{ width: '60px' }} value={awbPrefix3} onChange={e => setAwbPrefix3(e.target.value.replace(/\D/g, ''))} maxLength={3} />
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="FIRST 4 DIG" style={{ width: "90px" }} value={awbFirst4} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAwbFirst4(v); calculateLastAwb(v, awbLast4, awbNoOf); }} maxLength={4} />
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="LAST 4 DIG" style={{ width: "90px" }} value={awbLast4} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAwbLast4(v); calculateLastAwb(awbFirst4, v, awbNoOf); }} maxLength={4} />
                      
                      <label style={{ fontSize: '11px', marginLeft: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-main, var(--text-main, #1e293b))' }}>No of AWB</label>
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="NO OF" style={{ width: "60px" }} value={awbNoOf} onChange={e => { const v = e.target.value.replace(/\D/g, ''); setAwbNoOf(v); calculateLastAwb(awbFirst4, awbLast4, v); }} />

                      <label style={{ fontSize: '11px', marginLeft: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Last Stock Seq.No</label>
                      <input type="text" className="premium-input" placeholder="LAST STOCK SEQ.NO" style={{ flex: 1 }} value={awbLastSeqNo} readOnly />
                    </div>

                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                  <button className="modern-btn action-btn" onClick={handleSave} style={{ ...btnStyle, background: "#22c55e" }}><Save size={14} /> Save</button>
                  <button className="modern-btn action-btn" title="Deletes the selected AVAILABLE rows in Query Detail" onClick={() => stockAction('delete', 'Delete')} style={{ ...btnStyle, background: '#ef4444' }}><Trash2 size={14} /> Delete</button>
                  <button className="modern-btn action-btn" onClick={clearAwb} style={{ ...btnStyle, background: "#3b82f6" }}><RefreshCw size={14} /> Clear</button>
                  <button className="modern-btn action-btn" title="Voids the selected rows in Query Detail" onClick={() => stockAction('void', 'Void')} style={{ ...btnStyle, background: '#dc2626', color: '#ffffff' }}>Void</button>
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
                  <div style={inputGroupStyle}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', textTransform: 'uppercase' }}>Entered By</label>
                    <input type="text" className="premium-input" readOnly style={{ ...inputStyle, width: '120px' }} value={enteredBy} />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', textTransform: 'uppercase' }}>Entered Date</label>
                    <input type="text" className="premium-input" readOnly style={{ ...inputStyle, width: '120px' }} value={enteredDate} />
                  </div>
                </div>
              </div>
            </div>

            </>
          )}


        {/* HAWB STOCK TAB */}
        {activeTab === 'HAWB' && (
          <>
            <div className="modern-panel" style={panelStyle}>
              <div style={headerStyle}>HAWB STOCK</div>
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    
                    <div style={inputGroupStyle}>
                      <label style={labelStyle}>Party Type</label>
                      <select className="premium-input premium-input-mandatory" value={hawbPartyType} onChange={e => setHawbPartyType(e.target.value)} style={{ flex: 1 }}>
                        <option>Select</option>
                        <option>Consolidator</option>
                        <option>Agent</option>
                      </select>
                    </div>

                    <div style={inputGroupStyle}>
                      <label style={labelStyle}>Stock Date</label>
                      <ModernDatePicker className="premium-input" value={stockDate} onChange={e => setStockDate(e.target.value)} style={{ flex: 1 }} />
                    </div>

                    {(hawbPartyType === 'Consolidator' || hawbPartyType === 'Agent') && (
                      <div style={inputGroupStyle}>
                        <label style={labelStyle}>{hawbPartyType} Name</label>
                        <CustomAutocomplete
                          staticData={
                            hawbPartyType === 'Agent' 
                              ? iataAgents.map(a => ({
                                  id: a.id,
                                  title: `${a.iataCode || ''} - ${a.name}`,
                                  subtitle: a.address || '',
                                  raw: a
                                }))
                              : allParties.filter(p => p.partyType === 'CONSOLIDATOR').map(p => ({
                                  id: p.id,
                                  title: `${p.code || ''} - ${p.name}`,
                                  subtitle: p.city || '',
                                  raw: p
                                }))
                          }
                          onSelect={opt => setHawbPartyId(opt.id)}
                          placeholder={`SEARCH & SELECT ${String(hawbPartyType).toUpperCase()}...`}
                          className="premium-input premium-input-mandatory"
                          style={{ flex: 1 }}
                        />
                      </div>
                    )}
                    
                    {hawbPartyType === 'Select' && <div></div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
                    <label style={labelStyle}>HAWB No</label>
                    <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'center' }}>
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="PREFIX" title="Optional letters in front of the number, e.g. HBL" style={{ width: '80px' }} value={hawbPrefix} onChange={e => setHawbPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))} maxLength={10} />
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="STARTING NO" style={{ width: '130px' }} value={hawbStartNo} onChange={e => setHawbStartNo(e.target.value.replace(/\D/g, ''))} />
                      <input type="text" className="premium-input" placeholder="ENDING NO" title="Worked out from Starting No + No of HAWB" style={{ width: '130px' }} value={hawbEndPreview} readOnly />

                      <label style={{ fontSize: '11px', marginLeft: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-main, var(--text-main, #1e293b))' }}>No of HAWB</label>
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="COUNT" style={{ width: '80px' }} value={hawbCount} onChange={e => setHawbCount(e.target.value.replace(/\D/g, ''))} maxLength={6} />
                    </div>

                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                  <button className="modern-btn action-btn" onClick={handleHawbSave} style={{ ...btnStyle, background: "#22c55e" }}><Save size={14} /> Save</button>
                  <button className="modern-btn action-btn" title="Deletes the selected AVAILABLE rows in Query Detail" onClick={() => stockAction('delete', 'Delete')} style={{ ...btnStyle, background: '#ef4444' }}><Trash2 size={14} /> Delete</button>
                  <button className="modern-btn action-btn" onClick={clearHawb} style={{ ...btnStyle, background: "#3b82f6" }}><RefreshCw size={14} /> Clear</button>
                  <button className="modern-btn action-btn" title="Voids the selected rows in Query Detail" onClick={() => stockAction('void', 'Void')} style={{ ...btnStyle, background: '#dc2626', color: '#ffffff' }}>Void</button>
                </div>

                  {/* Meta */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
                    <div style={inputGroupStyle}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', textTransform: 'uppercase' }}>Entered By</label>
                      <input type="text" className="premium-input" readOnly style={{ ...inputStyle, width: '120px' }} value={enteredBy} />
                    </div>
                    <div style={inputGroupStyle}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', textTransform: 'uppercase' }}>Entered Date</label>
                      <input type="text" className="premium-input" readOnly style={{ ...inputStyle, width: '120px' }} value={enteredDate} />
                    </div>
                  </div>
              </div>
            </div>
          </>
        )}

        {/* ISSUE STOCK TAB */}
        {activeTab === 'ISSUE' && (
          <>
            <div className="modern-panel" style={panelStyle}>
              <div style={headerStyle}>ISSUE STOCK TO SUBAGENT</div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Sub Agent</label>
                    <select className="premium-input premium-input-mandatory" style={{ flex: 1 }}>
                      <option>Select</option>
                      <option>AGENT A</option>
                      <option>AGENT B</option>
                    </select>
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Issue Date</label>
                    <ModernDatePicker className="premium-input" value={stockDate} onChange={e => setStockDate(e.target.value)} style={{ flex: 1 }} />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Airline/IATA</label>
                    <select className="premium-input" style={{ flex: 1 }}>
                      <option>Select</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
                    <label style={labelStyle}>AirWayBill No</label>
                    <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'center' }}>
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="STARTING NO" style={{ ...inputStyle, width: '120px' }} />
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="ENDING NO" style={{ ...inputStyle, width: '120px' }} />
                      <label style={{ fontSize: '11px', marginLeft: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-main, var(--text-main, #1e293b))' }}>Total Count</label>
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="QTY" style={{ width: '60px' }} />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                  <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 600 }}>Issuing stock to a sub-agent is not available yet (nothing is saved from this tab).</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* RETURN STOCK TAB */}
        {activeTab === 'RETURN' && (
          <>
            <div className="modern-panel" style={panelStyle}>
              <div style={headerStyle}>RETURN STOCK</div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Return Date</label>
                    <ModernDatePicker className="premium-input" value={stockDate} onChange={e => setStockDate(e.target.value)} style={{ flex: 1 }} />
                  </div>
                  <div style={inputGroupStyle}>
                    <label style={labelStyle}>Status</label>
                    <select className="premium-input premium-input-mandatory" style={{ flex: 1 }} value={returnAction} onChange={e => setReturnAction(e.target.value)}>
                      <option value="VOID">Voided</option>
                      <option value="UNUSED">Unused</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
                    <label style={labelStyle}>AirWayBill No</label>
                    <div style={{ display: 'flex', gap: '4px', flex: 1, alignItems: 'center' }}>
                      <input type="text" className="premium-input premium-input-mandatory" placeholder="AWB NUMBER (11 DIGITS)" style={{ ...inputStyle, width: '200px' }} value={returnAwb} onChange={e => { setReturnAwb(e.target.value); setReturnInfo(null); }} />
                      <button className="modern-btn action-btn" onClick={verifyReturn} style={{ ...btnStyle, background: 'var(--primary-color-start, #0ea5e9)' }}><Search size={14} /> Verify</button>
                      {returnInfo && <span style={{ fontSize: '12px', fontWeight: 700, color: returnInfo.status === 'AVAILABLE' ? '#16a34a' : returnInfo.status === 'USED' || returnInfo.status === 'VOID' ? '#dc2626' : '#d97706' }}>{returnInfo.fullAwbNumber}: {returnInfo.status}</span>}
                    </div>
                  </div>
                </div>

                

                  {/* Hint Box */}
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '10px 12px', marginTop: '12px', marginBottom: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e3a8a', fontWeight: 'bold', fontSize: '12px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                      Important Stock Rule:
                    </div>
                    <div style={{ color: '#1e40af', fontSize: '11px', paddingLeft: '20px', lineHeight: '1.5' }}>
                      <span style={{fontWeight: 600}}>� Unused (Unallocate):</span> Makes the AWB <span style={{color: '#16a34a', fontWeight: 'bold'}}>AVAILABLE</span> again for reuse.<br/>
                      <span style={{fontWeight: 600}}>� Voided:</span> Permanently cancels the AWB. It will <span style={{color: '#dc2626', fontWeight: 'bold'}}>NEVER</span> be available for reuse.
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color, #e2e8f0)' }}>
                  <button className="modern-btn action-btn" onClick={doReturn} style={{ ...btnStyle, background: '#22c55e' }}><Save size={14} /> Return Stock</button>
                  <button className="modern-btn action-btn" onClick={() => { setReturnAwb(''); setReturnInfo(null); setReturnAction('VOID'); }} style={{ ...btnStyle, background: "#3b82f6" }}><RefreshCw size={14} /> Clear</button>
                </div>
              </div>
            </div>
          </>
        )}

{/* GLOBAL QUERY DETAIL (Visible in all tabs) */}
        <div className="modern-panel" style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', overflow: 'hidden', marginTop: '16px' }}>
          <div style={{ background: '#f8fafc', padding: '8px 16px', fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main, var(--text-main, #0f172a))', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            QUERY DETAIL
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', textTransform: 'uppercase' }}>From Date</label>
                <ModernDatePicker className="premium-input" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #94a3b8', borderRadius: '4px', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', textTransform: 'uppercase' }}>To Date</label>
                <ModernDatePicker className="premium-input" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: '6px 12px', border: '1px solid #94a3b8', borderRadius: '4px', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #1e293b))', textTransform: 'uppercase' }}>Status</label>
                <select className="premium-input" style={{ padding: '6px 12px', border: '1px solid #94a3b8', borderRadius: '4px', fontSize: '13px', width: '80px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}><option value="ALL">ALL</option><option value="AVAILABLE">AVAILABLE</option><option value="ALLOCATED">ALLOCATED</option><option value="USED">USED</option><option value="VOID">VOID</option></select>
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button className="modern-btn action-btn" style={{ padding: '6px 16px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: 'none', background: '#f59e0b', color: '#fff', marginRight: '8px' }} onClick={handleUnallocate}>Unallocate{selectedIds.length ? ` (${selectedIds.length})` : ''}</button>
                  <button className="modern-btn action-btn" onClick={handleQuery} style={{ padding: '6px 16px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', cursor: 'pointer', border: 'none', background: '#0ea5e9', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>Query</button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRadius: '4px', overflow: 'hidden' }}>
                <thead style={{ background: '#e0f2fe', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                  <tr>
                    <th style={{ padding: '6px', borderBottom: '1px solid #9ebdd2', borderRight: '1px solid #9ebdd2', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span>Select</span>
                          <input type="checkbox" checked={queryData.length > 0 && selectedIds.length === queryData.length} onChange={e => setSelectedIds(e.target.checked ? queryData.map(r => r.id) : [])} />
                        </div>
                      </th>
                    <th style={{ padding: '6px', borderBottom: '1px solid #9ebdd2', borderRight: '1px solid #9ebdd2', fontWeight: 'bold', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '6px', borderBottom: '1px solid #9ebdd2', borderRight: '1px solid #9ebdd2', fontWeight: 'bold', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '6px', borderBottom: '1px solid #9ebdd2', borderRight: '1px solid #9ebdd2', fontWeight: 'bold', textTransform: 'uppercase' }}>{activeTab === 'HAWB' ? 'HAWB No' : 'AWB No'}</th>
                    <th style={{ padding: '6px', borderBottom: '1px solid #9ebdd2', borderRight: '1px solid #9ebdd2', fontWeight: 'bold', textTransform: 'uppercase' }}>Stock No</th>
                    <th style={{ padding: '6px', borderBottom: '1px solid #9ebdd2', borderRight: '1px solid #9ebdd2', fontWeight: 'bold', textTransform: 'uppercase' }}>{activeTab === 'HAWB' ? 'Prefix' : 'Airline'}</th>
                    <th style={{ padding: '6px', borderBottom: '1px solid #9ebdd2', fontWeight: 'bold', textTransform: 'uppercase' }}>{activeTab === 'HAWB' ? 'Party Name' : 'IATA Name'}</th>
                  </tr>
                </thead>
                <tbody>
                  {queryData && queryData.length > 0 ? queryData.map((row, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'var(--bg-panel, var(--bg-panel, #ffffff))' : 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span style={{ visibility: 'hidden', fontWeight: 'bold', textTransform: 'uppercase' }}>Select</span>
                        <input type="checkbox" className="stock-checkbox" value={row.id} checked={selectedIds.includes(row.id)} onChange={() => toggleId(row.id)} />
                      </div>
                    </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>{(row.stockDate || row.createdAt) ? String(row.stockDate || row.createdAt).substring(0,10) : ''}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)', fontWeight: 'bold', color: row.status === 'AVAILABLE' ? '#10b981' : (row.status === 'VOID' ? '#dc2626' : row.status === 'USED' ? '#64748b' : '#f59e0b') }}>{row.status}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>{activeTab === 'HAWB' ? row.fullHawbNumber : row.fullAwbNumber}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>{row.sequenceNumber}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>{activeTab === 'HAWB' ? (row.prefix || '') : (row.airlinePrefix || '')}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>{activeTab === 'HAWB' ? (row.partyName || (row.party ? row.party.name : '')) : ''}</td>
                    </tr>
                  )) : (
                  <tr>
                    <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>No data found</td>
                  </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
      </div>

      
        


      {uiModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1.5rem', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <h3 style={{ color: uiModal.type === 'error' ? '#ef4444' : '#22c55e', margin: '0 0 1rem 0' }}>{uiModal.title}</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#334155', fontWeight: 500 }}>{uiModal.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
