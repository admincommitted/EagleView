
import React, { useState, useEffect } from 'react';
import { Save, Ship, Search, Edit2, Trash2 } from "lucide-react";
import switchRow, { askDelete } from './switchRow';

export default function VesselMasterForm() {
  const [vessels, setVessels] = useState([]);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    id: '',
    vesselName: '',
    imoNumber: '',
    callSign: '',
    carrierAgent: ''
  });

  useEffect(() => {
    fetchVessels();
  }, []);

  const fetchVessels = async () => {
    try {
      const res = await fetch('/api/masters/vessels?all=1');
      const data = await res.json();
      setVessels(Array.isArray(data) ? data : []); // an error answer is not a list (it crashed the screen)
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) {
        alert('ERROR: Image size must be less than 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, customLogo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getLogoUrl = (agentName) => {
    if (!agentName) return null;
    const name = agentName.toUpperCase();
    if (name.includes('MSC')) return 'https://logo.clearbit.com/msc.com';
    if (name.includes('MAERSK')) return 'https://logo.clearbit.com/maersk.com';
    if (name.includes('CMA')) return 'https://logo.clearbit.com/cma-cgm.com';
    if (name.includes('EVERGREEN')) return 'https://logo.clearbit.com/evergreen-line.com';
    if (name.includes('HMM')) return 'https://logo.clearbit.com/hmm21.com';
    if (name.includes('OOCL')) return 'https://logo.clearbit.com/oocl.com';
    if (name.includes('COSCO')) return 'https://logo.clearbit.com/coscoshipping.com';
    if (name.includes('ONE')) return 'https://logo.clearbit.com/one-line.com';
    if (name.includes('HAPAG')) return 'https://logo.clearbit.com/hapag-lloyd.com';
    if (name.includes('ZIM')) return 'https://logo.clearbit.com/zim.com';
    return null;
  };


  const handleSave = async () => {
    if(!formData.vesselName || !formData.imoNumber) return alert('Please fill the required fields (*)');
    if(/^\d+$/.test(String(formData.imoNumber).trim()) && String(formData.imoNumber).trim().length !== 7) return alert('IMO number must be 7 digits');
    try {
      const url = formData.id ? `/api/masters/vessels/${formData.id}` : '/api/masters/vessels';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData({ id: '', vesselName: '', imoNumber: '', callSign: '', carrierAgent: '' });
        fetchVessels();
      } else { const err = await res.json().catch(() => ({})); alert('Not saved: ' + (err.error || err.message || ('HTTP ' + res.status))); }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (item) => {
    setFormData(item);
  };
  
  // 22-Nov-2026: a row is switched off (kept as inactive, off the job screens' lists) instead of deleted
  const isOn = (r) => !(r.isActive === false || r.isActive === 0);
  const handleSwitch = async (row) => { if (await switchRow('vessels', { ...row, isActive: isOn(row) }, 'vessel / flight ' + (row.vesselName || ''))) fetchVessels(); };

  const handleDelete = async (id) => {
    if (!(await askDelete('Delete this vessel / flight?'))) return;
    try {
      const res = await fetch(`/api/masters/vessels/${id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json().catch(() => ({})); return alert('Not deleted: ' + (err.error || ('HTTP ' + res.status))); }
      fetchVessels();
    } catch (err) {
      alert('Not deleted: ' + err.message);
    }
  };

  const filteredData = vessels.filter(v => 
    v.vesselName?.toLowerCase().includes(search.toLowerCase()) || 
    v.imoNumber?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Left Sidebar for Search & Select */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#3b82f6" /> SEARCH
          </h3>
        </div>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="SEARCH..." value={search} onChange={e => setSearch(e.target.value)} 
            style={{ marginBottom: '8px' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredData.map(v => {
                const logoSrc = v.customLogo || getLogoUrl(v.carrierAgent);
                return (
                <li 
                  id={`vessel-item-${v.id}`} 
                  key={v.id} 
                  onClick={() => handleEdit(v)} 
                  style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid var(--border-color, #cbd5e1)', borderLeft: formData.id === v.id ? '4px solid #3b82f6' : '4px solid transparent', margin: '0 8px', borderRadius: formData.id === v.id ? '6px' : '0', 
                    cursor: 'pointer', 
                    background: formData.id === v.id ? '#eff6ff' : 'transparent', 
                    color: formData.id === v.id ? 'var(--primary-color-end, #1d4ed8)' : 'var(--text-main, var(--text-main, #0f172a))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: formData.id === v.id ? '0 2px 6px rgba(59,130,246,0.15)' : 'none', transform: formData.id === v.id ? 'scale(1.01)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => { if(formData.id !== v.id) e.currentTarget.style.background = 'var(--bg-input, var(--bg-input, #f1f5f9))' }}
                  onMouseLeave={(e) => { if(formData.id !== v.id) e.currentTarget.style.background = 'transparent' }}
                >
                  {logoSrc ? (
                    <img 
                      src={logoSrc} 
                      alt="logo" 
                      style={{ width: '36px', height: '26px', borderRadius: '4px', objectFit: 'contain', background: 'var(--bg-app, var(--bg-app, #f8fafc))', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} 
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div style={{ display: logoSrc ? 'none' : 'flex', width: '36px', height: '26px', borderRadius: '4px', background: formData.id === v.id ? '#3b82f6' : 'var(--primary-bg-light, #e0f2fe)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ship size={14} color={formData.id === v.id ? 'var(--primary-color-end, #1d4ed8)' : 'var(--text-muted, var(--text-muted, #64748b))'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: formData.id === v.id ? 700 : 600, color: formData.id === v.id ? 'var(--primary-color-end, #1d4ed8)' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '13px', transition: 'color 0.2s' }}>
                      {v.vesselName}
                    </div>
                    <div style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '11px', marginTop: '2px', fontWeight: 600, transition: 'color 0.2s' }}>
                      IMO: {v.imoNumber}
                    </div>
                  </div>
                </li>
              )})}
          </ul>
        </div>
      </div>
      
      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary-color)' }}>
        <h3 style={{ marginBottom: '1rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}><span style={{ width: '8px', height: '18px', background: 'linear-gradient(to bottom, #0284c7, #38bdf8)', borderRadius: '4px' }}></span><Ship size={18} color="var(--primary-text, #0284c7)" /> ADD VESSEL (SEA OPERATIONS)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Vessel Name</label>
            <input type="text" className="input-field" placeholder="Full Vessel Name" value={formData.vesselName || ""} onChange={e => setFormData({...formData, vesselName: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>IMO Number</label>
            <input type="text" className="input-field" placeholder="e.g. 9777204" value={formData.imoNumber || ""} onChange={e => setFormData({...formData, imoNumber: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Call Sign</label>
            <input type="text" className="input-field" placeholder="Radio Call Sign" value={formData.callSign || ""} onChange={e => setFormData({...formData, callSign: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Carrier Agent</label>
            <input type="text" className="input-field" placeholder="Shipping Line (e.g. MSC)" value={formData.carrierAgent || ""} onChange={e => setFormData({...formData, carrierAgent: e.target.value.toUpperCase()})} />
          </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Custom Logo</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ fontSize: '10px', padding: '4px', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', width: '100%' }} />
            </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setFormData({ id: '', vesselName: '', imoNumber: '', callSign: '', carrierAgent: '' })}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={16}/> Save (Ctrl+S)</button>
        </div>
      </div>
      <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Vessel Directory</h3>
          <input type="text" className="input-field" placeholder="Search vessel..." style={{ width: '200px' }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Vessel Name</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>IMO Number</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Call Sign</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Carrier Agent</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', opacity: isOn(item) ? 1 : 0.6 }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.vesselName}{item.isActive === false || item.isActive === 0 ? <span style={{ marginLeft: '8px', background: '#fee2e2', color: '#991b1b', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>INACTIVE</span> : null}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
        <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #000000', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{item.imoNumber}</span>
    </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
        <span style={{ background: '#e0f2fe', color: 'var(--primary-text, #0369a1)', border: '1px solid #000000', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{item.callSign}</span>
    </td>
                  <td style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        {(item.customLogo || getLogoUrl(item.carrierAgent)) && (
                            <img src={item.customLogo || getLogoUrl(item.carrierAgent)} alt="logo" style={{ width: '28px', height: '16px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                        <span style={{ color: 'var(--text-main, var(--text-main, #0f172a))' }}>{item.carrierAgent}</span>
                    </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <span onClick={() => handleEdit(item)} style={{ color: 'var(--primary-color-end, #2563eb)', cursor: 'pointer', fontWeight: 600, marginRight: '10px' }}>Edit</span>
                      <span onClick={() => handleSwitch(item)} style={{ color: isOn(item) ? '#b45309' : '#15803d', cursor: 'pointer', fontWeight: 600 }}>{isOn(item) ? 'Switch off' : 'Switch on'}</span>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
      </div>
    </div>
  );
}
