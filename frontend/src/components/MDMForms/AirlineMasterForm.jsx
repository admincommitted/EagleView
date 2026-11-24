import React, { useState } from 'react';
import FieldAutocomplete from '../FieldAutocomplete';
import { Save, RefreshCw, PlusCircle, Search, Edit2, Trash2, FileText, Settings } from 'lucide-react';
import { askConfirm } from './switchRow';
import ModernDatePicker from '../common/ModernDatePicker';

export default function AirlineMasterForm() {
  const [activeTab, setActiveTab] = useState('AirlineMaster');
  const [searchTerm, setSearchTerm] = useState('');
  const [airlines, setAirlines] = useState([]);
  const [airlineForm, setAirlineForm] = useState({ name: '', code3: '', code2: '', prefix: '', status: 'ACTIVE', customLogo: '' });
  const [uiModal, setUiModal] = React.useState({ isOpen: false, title: '', message: '', type: 'success' });
  
  const customAlert = (msg) => {
      let title = 'INFORMATION';
      let type = 'success';
      if(msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('error')) {
          title = 'ERROR';
          type = 'error';
      } else if (msg.toLowerCase().includes('success')) {
          title = 'SUCCESS';
          type = 'success';
      }
      setUiModal({ isOpen: true, title, message: String(msg ?? ''), type });
      setTimeout(() => setUiModal({ isOpen: false, title: '', message: '', type: 'success' }), 3000);
  };

  React.useEffect(() => {
    fetchAirlines();
  }, []);

  const fetchAirlines = () => {
    fetch('/api/masters/airlines?all=1')
      .then(res => res.json())
      .then(data => {
        const processed = (Array.isArray(data) ? data : []).map(a => {
           if (a.otherData && typeof a.otherData === 'string') {
              try { a.otherData = JSON.parse(a.otherData); } catch(e) { a.otherData = {}; }
           }
           if (!a.otherData) a.otherData = {};
           return a;
        });
        setAirlines(processed);
        // keep the airline being edited (the old code read a stale value and jumped back to the first airline)
        setAirlineForm(prev => prev.id ? (processed.find(a => a.id === prev.id) || prev) : (prev.name || !processed.length ? prev : processed[0]));
      })
      .catch(err => console.error(err));
  };

  // 28-Oct-2026: Save crashed every time ("payload" was used before it was declared); codes now upper case and checked,
  // duplicate codes / prefix blocked, and the new id kept after the first save (a second Save made a copy)
  const handleSave = () => {
    const up = (v) => String(v || '').trim().toUpperCase();
    const f = { ...airlineForm, name: up(airlineForm.name), code3: up(airlineForm.code3), code2: up(airlineForm.code2), prefix: String(airlineForm.prefix || '').trim(), pan: up(airlineForm.pan) };
    if (!f.name || !f.code3 || !f.code2 || !f.prefix) {
      customAlert('Error: Please fill in Airline Name, 3 Letter Code, 2 Letter Code, and 3-Digit Prefix!');
      return;
    }
    if (!/^[A-Z]{3}$/.test(f.code3)) return customAlert('Error: 3 Letter Code must be 3 letters (e.g. UAE)');
    if (!/^[A-Z0-9]{2}$/.test(f.code2)) return customAlert('Error: 2 Letter Code must be 2 letters / digits (e.g. EK, 6E)');
    if (!/^\d{3}$/.test(f.prefix)) return customAlert('Error: AWB Prefix must be 3 digits (e.g. 176)');
    if (f.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(f.pan)) return customAlert('Error: PAN must be like ABCDE1234F');
    if (f.trackingUrl && !/^https?:\/\/\S+$/i.test(f.trackingUrl)) return customAlert('Error: Tracking link must start with http:// or https://');
    const clash = airlines.find(a => a.id !== f.id && (up(a.code2) === f.code2 || String(a.prefix || '') === f.prefix || up(a.code3) === f.code3));
    if (clash) return customAlert(`Duplicate: ${clash.name} already uses code ${clash.code2} / ${clash.code3} / prefix ${clash.prefix}`);

    const method = f.id ? 'PUT' : 'POST';
    const url = f.id ? `/api/masters/airlines/${f.id}` : '/api/masters/airlines';
    
    const payload = { ...f };
    if (!payload.id) delete payload.id;
    delete payload.createdAt; delete payload.updatedAt;
    if (typeof payload.otherData === 'object') {
       payload.otherData = JSON.stringify(payload.otherData);
    }
    
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      customAlert('Airline saved successfully!');
      const saved = data.data || data;
      setAirlineForm({ ...f, id: f.id || saved.id });
      fetchAirlines();
    })
    .catch(err => customAlert('Error saving airline: ' + err.message));
  };

  const filteredAirlines = airlines.filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(a).some(val => val && String(val).toLowerCase().includes(term));
  });

  const tabStyle = (isActive) => ({
    padding: '8px 24px',
    background: isActive ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'transparent',
    color: isActive ? 'var(--bg-panel, var(--bg-panel, #ffffff))' : 'var(--text-muted, var(--text-muted, #475569))',
    borderRadius: '6px',
    fontWeight: isActive ? 700 : 600,
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    boxShadow: isActive ? '0 4px 6px -1px rgba(37, 99, 235, 0.3), 0 2px 4px -1px rgba(37, 99, 235, 0.2)' : 'none'
  });

  const sectionHeaderStyle = {
    fontWeight: 700, 
    fontSize: '13px', 
    color: 'var(--primary-color)', 
    borderBottom: '2px solid var(--primary-color)', 
    paddingBottom: '0.25rem', 
    marginBottom: '1rem', 
    textTransform: 'uppercase',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

    const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) {
        customAlert('ERROR: Logo file size must be less than 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('customLogo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOtherDataChange = (field, value) => {
    setAirlineForm(prev => ({
      ...prev,
      otherData: { ...(prev.otherData || {}), [field]: value }
    }));
  };

  const addInsuranceRule = () => {
      const currentRules = airlineForm.otherData?.insuranceRules || [];
      handleOtherDataChange('insuranceRules', [...currentRules, { dateFrom: '', dateTo: '', percent: '' }]);
  };
  
  const updateInsuranceRule = (idx, field, value) => {
      const currentRules = [...(airlineForm.otherData?.insuranceRules || [])];
      currentRules[idx][field] = value;
      handleOtherDataChange('insuranceRules', currentRules);
  };
  
  const removeInsuranceRule = (idx) => {
      const currentRules = [...(airlineForm.otherData?.insuranceRules || [])];
      currentRules.splice(idx, 1);
      handleOtherDataChange('insuranceRules', currentRules);
  };

  // 22-Nov-2026: an airline is switched off / on (status INACTIVE / ACTIVE), not deleted. AWB screens list only airlines that are not INACTIVE.
  const handleSwitch = async () => {
    if (!airlineForm.id) return customAlert('Error: select a saved airline first');
    const off = (airlineForm.status || 'ACTIVE') !== 'INACTIVE';
    if (off && !(await askConfirm({ title: 'Switch off this airline?', message: `${airlineForm.name || ''} (${airlineForm.prefix || ''})`, note: 'It is not deleted. It stays in this master as INACTIVE, is not offered on AWB screens, and can be switched on again.', okLabel: 'Switch off', cancelLabel: 'Keep it on' }))) return;
    try {
      const res = await fetch(`/api/masters/airlines/${airlineForm.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: off ? 'INACTIVE' : 'ACTIVE' }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Not changed');
      setAirlineForm(prev => ({ ...prev, status: off ? 'INACTIVE' : 'ACTIVE' })); fetchAirlines();
    } catch (err) { customAlert('Error: ' + err.message); }
  };

  const handleInputChange = (field, value) => {
    setAirlineForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      
      {/* Left Sidebar for Search & Select */}
      <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#3b82f6" /> Search Airline
            <span style={{ fontSize: '10px', backgroundColor: 'var(--primary-bg-light, #e0f2fe)', color: 'var(--text-muted, var(--text-muted, #475569))', padding: '2px 6px', borderRadius: '12px', marginLeft: 'auto' }}>
              {airlines.length} TOTAL
            </span>
          </h3>
          <input 
            type="text" 
            className="input-field" 
            placeholder="ENTER AIRLINE NAME..." 
            style={{ marginBottom: '0.75rem', textTransform: 'uppercase' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="input-field" style={{ textTransform: 'uppercase' }}>
            <option>ALL STATUS</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredAirlines.map((a, idx) => {
              const isSelected = airlineForm?.name === a.name;
              return (
                <li 
                  key={idx} 
                  onClick={() => setAirlineForm(a)}
                  style={{ 
                    padding: '0.75rem 1rem', 
                    borderBottom: '1px solid var(--border-color, #e2e8f0)', 
                    fontSize: '12px', 
                    cursor: 'pointer', 
                    background: isSelected ? '#eff6ff' : 'transparent', 
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'var(--primary-color-end, #1d4ed8)' : '#334155',
                    borderBottom: '1px solid var(--border-color, #cbd5e1)', borderLeft: isSelected ? '4px solid #3b82f6' : '4px solid transparent', margin: '0 8px', borderRadius: isSelected ? '6px' : '0', boxShadow: isSelected ? '0 2px 6px rgba(59,130,246,0.15)' : 'none', transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                    transition: 'all 0.15s ease-in-out'
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                      <img 
                          src={a.customLogo || `https://pics.avs.io/200/200/${a.code2}.png`} 
                          alt={a.code2} 
                          style={{ width: '70px', height: '45px', objectFit: 'contain' }} 
                          onError={(e) => { e.target.style.display = 'none'; }} 
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ background: isSelected ? '#3b82f6' : 'var(--bg-input, var(--bg-input, #f1f5f9))', color: isSelected ? 'var(--bg-panel, var(--bg-panel, #ffffff))' : 'var(--text-muted, var(--text-muted, #475569))', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', border: isSelected ? '1px solid #2563eb' : '1px solid var(--border-color, #e2e8f0)' }}>{a.prefix || 'N/A'}</span>
                                <span style={{ fontWeight: 700, fontSize: '12px', color: isSelected ? 'var(--primary-color-end, #1d4ed8)' : 'var(--text-main, var(--text-main, #0f172a))', lineHeight: '1.2' }}>{a.name}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px', fontWeight: 600 }}>CODE: <span style={{color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700}}>{a.code2} / {a.code3}</span></span>
                                <span style={{ background: a.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: (a.status === 'ACTIVE' ? '#166534' : '#991b1b'), padding: '2px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold', border: a.status === 'ACTIVE' ? '1px solid #22c55e' : '1px solid #fecaca' }}>{a.status}</span>
                            </div>
                        </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingBottom: '1rem' }}>
        
        {/* Tabs Bar */}
        <div className="glass-panel" style={{ 
          display: 'flex', 
          background: 'var(--bg-panel, var(--bg-panel, #ffffff))', 
          padding: '0',
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          <div style={tabStyle(activeTab === 'AirlineMaster')} onClick={() => setActiveTab('AirlineMaster')}>
            <FileText size={16} />
            Airline Master Details
          </div>
          <div style={tabStyle(activeTab === 'Other')} onClick={() => setActiveTab('Other')}>
            <Settings size={16} />
            Other Details
          </div>
        </div>

        {activeTab === 'AirlineMaster' && (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* BASIC INFORMATION SECTION */}
            <div>
              <div style={{...sectionHeaderStyle, position: 'relative'}}>
                 <span>Basic Information</span>
                 {airlineForm?.code2 && (
                    <img 
                       src={airlineForm.customLogo || `https://pics.avs.io/200/200/${airlineForm.code2}.png`} 
                       alt="Airline Logo" 
                       style={{ position: 'absolute', right: 0, bottom: '5px', height: '40px', width: 'auto', maxWidth: '120px', objectFit: 'contain', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.1))' }} 
                       onError={(e) => { e.target.style.display = 'none'; }}
                    />
                 )}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1.25rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Airline Name <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" value={airlineForm?.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} style={{ textTransform: 'uppercase' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>3 Letter Code <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" value={airlineForm?.code3 || ''} onChange={(e) => handleInputChange('code3', e.target.value)} style={{ textTransform: 'uppercase' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>2 Letter Code <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" value={airlineForm?.code2 || ''} onChange={(e) => handleInputChange('code2', e.target.value)} style={{ textTransform: 'uppercase' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>3-Digit Prefix <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" placeholder="098" maxLength="3" value={airlineForm?.prefix || ''} onChange={(e) => handleInputChange('prefix', e.target.value.replace(/[^0-9]/g, ''))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Status</label>
                  <select className="input-field" value={airlineForm?.status || 'ACTIVE'} onChange={(e) => handleInputChange('status', e.target.value)} style={{ textTransform: 'uppercase' }}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Custom Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: '11px', padding: '4px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px' }} />
                </div>
              </div>
            </div>

            {/* FINANCIAL & COMMISSION SECTION */}
            <div>
              <div style={sectionHeaderStyle}>Financial & Commission</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Commission Rate</label>
                  <input type="text" className="input-field" placeholder="0.00" value={airlineForm?.commRate || ''} onChange={(e) => handleInputChange('commRate', e.target.value)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Commission Type</label>
                  <select className="input-field" value={airlineForm?.commType || 'NET'} onChange={(e) => handleInputChange('commType', e.target.value)} style={{ textTransform: 'uppercase' }}>
                    <option value="NET">NET</option>
                    <option value="GROSS">GROSS</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Account No</label>
                  <input type="text" className="input-field" value={airlineForm?.accountNo || ''} onChange={(e) => handleInputChange('accountNo', e.target.value)} style={{ textTransform: 'uppercase' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>PAN Number</label>
                  <input type="text" className="input-field" value={airlineForm?.pan || ''} onChange={(e) => handleInputChange('pan', e.target.value)} style={{ textTransform: 'uppercase' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Tracking Website Link</label>
                  <input type="url" className="input-field" value={airlineForm?.trackingUrl || ''} onChange={(e) => handleInputChange('trackingUrl', e.target.value.trim())} placeholder="https://airline-site/track?awb={awb}" />
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Opens from Track Shipments. Use {'{awb}'} for 17612345675, {'{awbdash}'} for 176-12345675, {'{prefix}'} / {'{serial}'} for the two parts.</span>
                </div>
              </div>
            </div>

            {/* ADDRESS & CONTACT DETAILS SECTION */}
            <div>
              <div style={sectionHeaderStyle}>Address & Contact Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Address Line 1 <span style={{color: 'red'}}>*</span></label>
                  <input type="text" className="input-field" placeholder="BUILDING NO. / STREET" value={airlineForm?.address1 || ''} onChange={(e) => handleInputChange('address1', e.target.value)} style={{ textTransform: 'uppercase' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Address Line 2</label>
                  <input type="text" className="input-field" placeholder="AREA / LANDMARK" value={airlineForm?.address2 || ''} onChange={(e) => handleInputChange('address2', e.target.value)} style={{ textTransform: 'uppercase' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>City</label>
                  <FieldAutocomplete listType="city" className="input-field" placeholder="NEW DELHI" value={airlineForm?.city || ''} onChange={(e) => handleInputChange('city', e.target.value)} onSelect={(opt) => handleInputChange('city', opt.title)} style={{ textTransform: 'uppercase', width: '100%', padding: '6px 12px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>State</label>
                  <FieldAutocomplete listType="state" className="input-field" placeholder="DL" value={airlineForm?.state || ''} onChange={(e) => handleInputChange('state', e.target.value)} onSelect={(opt) => handleInputChange('state', opt.title)} style={{ textTransform: 'uppercase', width: '100%', padding: '6px 12px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Country</label>
                  <FieldAutocomplete listType="country" className="input-field" placeholder="IN" value={airlineForm?.country || ''} onChange={(e) => handleInputChange('country', e.target.value)} onSelect={(opt) => handleInputChange('country', opt.title)} style={{ textTransform: 'uppercase', width: '100%', padding: '6px 12px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'uppercase' }}>Contact Person</label>
                  <input type="text" className="input-field" placeholder="MANAGER NAME" value={airlineForm?.contact || ''} onChange={(e) => handleInputChange('contact', e.target.value)} style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Other' && (
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              
              {/* Incentive Payable */}
              <div>
                <div style={sectionHeaderStyle}>Incentive Payable</div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: '0.75rem', alignItems: 'center', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', textAlign: 'center' }}>VALUE</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', textAlign: 'center' }}>RATE</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', textAlign: 'center' }}>%</div>
                  
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>CHRG WT +</div>
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.incPlusValue || ''} onChange={(e) => handleOtherDataChange('incPlusValue', e.target.value)} />
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.incPlusRate || ''} onChange={(e) => handleOtherDataChange('incPlusRate', e.target.value)} />
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.incPlusPercent || ''} onChange={(e) => handleOtherDataChange('incPlusPercent', e.target.value)} />
                  
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>CHRG WT -</div>
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.incMinusValue || ''} onChange={(e) => handleOtherDataChange('incMinusValue', e.target.value)} />
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.incMinusRate || ''} onChange={(e) => handleOtherDataChange('incMinusRate', e.target.value)} />
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.incMinusPercent || ''} onChange={(e) => handleOtherDataChange('incMinusPercent', e.target.value)} />
                </div>
              </div>

              {/* Commission Payable */}
              <div>
                <div style={sectionHeaderStyle}>Commission Payable</div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: '0.75rem', alignItems: 'center', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div></div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', textAlign: 'center' }}>VALUE</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', textAlign: 'center' }}>RATE</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', textAlign: 'center' }}>%</div>
                  
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>CHRG WT +</div>
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.commPlusValue || ''} onChange={(e) => handleOtherDataChange('commPlusValue', e.target.value)} />
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.commPlusRate || ''} onChange={(e) => handleOtherDataChange('commPlusRate', e.target.value)} />
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.commPlusPercent || ''} onChange={(e) => handleOtherDataChange('commPlusPercent', e.target.value)} />
                  
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>CHRG WT -</div>
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.commMinusValue || ''} onChange={(e) => handleOtherDataChange('commMinusValue', e.target.value)} />
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.commMinusRate || ''} onChange={(e) => handleOtherDataChange('commMinusRate', e.target.value)} />
                  <input type="text" className="input-field" style={{ textAlign: 'right' }} value={airlineForm?.otherData?.commMinusPercent || ''} onChange={(e) => handleOtherDataChange('commMinusPercent', e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <div style={sectionHeaderStyle}>
                <span>Airline Insurance Details</span>
                <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center' }} onClick={addInsuranceRule}>
                  <PlusCircle size={14} style={{ marginRight: '6px' }}/> ADD RULE
                </button>
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', borderBottom: '2px solid var(--border-color, #cbd5e1)' }}>
                    <tr>
                      <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700 }}>DATE FROM</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700 }}>DATE TO</th>
                      <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700 }}>PERCENT (%)</th>
                      <th style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700 }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(airlineForm?.otherData?.insuranceRules || []).map((rule, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-input, var(--bg-input, #f1f5f9))'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '10px', color: '#334155', fontWeight: 500 }}>
                          <ModernDatePicker style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none' }} value={rule.dateFrom || ''} onChange={(e) => updateInsuranceRule(idx, 'dateFrom', e.target.value)} />
                      </td>
                      <td style={{ padding: '10px', color: '#334155', fontWeight: 500 }}>
                          <ModernDatePicker style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none' }} value={rule.dateTo || ''} onChange={(e) => updateInsuranceRule(idx, 'dateTo', e.target.value)} />
                      </td>
                      <td style={{ padding: '10px', color: '#334155', fontWeight: 500 }}>
                          <input type="text" placeholder="0.00" style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none' }} value={rule.percent || ''} onChange={(e) => updateInsuranceRule(idx, 'percent', e.target.value)} />
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => removeInsuranceRule(idx)}><Trash2 size={12}/> DELETE</span>
                      </td>
                    </tr>
                    ))}
                    {(!airlineForm?.otherData?.insuranceRules || airlineForm.otherData.insuranceRules.length === 0) && (
                      <tr>
                        <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No insurance rules added. Click "ADD RULE" to create one.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: 'auto', padding: '1rem 1.5rem', background: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderTop: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.05)', zIndex: 10 }}>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', fontWeight: 600, letterSpacing: '0.5px' }} onClick={() => setAirlineForm({ name: '', code3: '', code2: '', prefix: '', status: 'ACTIVE', customLogo: '' })}>
            <RefreshCw size={14} style={{ marginRight: '8px' }}/> CLEAR
          </button>
          <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 20px', fontWeight: 600, letterSpacing: '0.5px', background: '#fff', color: '#b45309', border: '1px solid #f59e0b' }} onClick={handleSwitch}>{(airlineForm.status || 'ACTIVE') !== 'INACTIVE' ? 'Switch off' : 'Switch on'}</button>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', padding: '8px 24px', fontWeight: 600, letterSpacing: '0.5px' }} onClick={handleSave}>
            <Save size={14} style={{ marginRight: '8px' }}/> SAVE (CTRL+S)
          </button>
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
