import React, { useState, useEffect } from 'react';
import { Save, Search, RefreshCw, Calculator, Tags, Zap } from 'lucide-react';
import switchRow from './switchRow';
import ModernDatePicker from '../common/ModernDatePicker';

export default function RspMasterForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  
  const initialForm = { id: '', cethCode: '', description: '', notificationNo: '', serialNo: '', abatementRate: 0, effectiveDate: '', isActive: true };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/masters/rspabatements');
      const json = await res.json();
      setData(Array.isArray(json) ? json : []); // an error answer is not a list (it crashed the screen)
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if(!formData.cethCode || !formData.description) return alert('Please fill the required fields (*)');
    try {
      const url = formData.id ? `/api/masters/rspabatements/${formData.id}` : '/api/masters/rspabatements';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(initialForm);
        fetchData();
      } else { const err = await res.json().catch(() => ({})); alert('Not saved: ' + (err.error || err.message || ('HTTP ' + res.status))); }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (item) => {
    setFormData(item);
  };
  
  // 22-Nov-2026: a row is switched off / on, not deleted (it stays in the master as inactive)
  const handleSwitch = async (row) => {
    const done = await switchRow('rspabatements', row, 'RSP entry ' + (row.cethCode || ''));
    if (done) { if (formData && String(formData.id) === String(row.id)) setFormData(initialForm); fetchData(); }
  };

  const filteredData = data.filter(i => 
    i.cethCode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#4f46e5" /> SEARCH RSP ({filteredData.length}) / ABATEMENT
          </h3>
          <input type="text" className="input-field" placeholder="Search CETH or Description..." style={{ width: '100%' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredData.map(i => (
              <li 
                key={i.id} 
                onClick={() => handleEdit(i)} 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border-color, #cbd5e1)', 
                  cursor: 'pointer', 
                  background: formData.id === i.id ? 'linear-gradient(90deg, #eef2ff 0%, var(--bg-panel, #ffffff) 100%)' : 'transparent', 
                  borderLeft: formData.id === i.id ? '4px solid #4f46e5' : '4px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { if(formData.id !== i.id) e.currentTarget.style.background = 'var(--bg-app, var(--bg-app, #f8fafc))' }}
                onMouseLeave={(e) => { if(formData.id !== i.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', 
                  background: formData.id === i.id ? 'linear-gradient(135deg, #4f46e5, #4338ca)' : 'linear-gradient(135deg, var(--border-color, #e2e8f0), var(--border-color, #cbd5e1))', 
                  color: formData.id === i.id ? '#fff' : 'var(--text-muted, var(--text-muted, #64748b))', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  boxShadow: formData.id === i.id ? '0 2px 4px rgba(79,70,229,0.3)' : 'none'
                }}>
                  <Tags size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: formData.id === i.id ? 700 : 600, color: formData.id === i.id ? '#312e81' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>
                      {i.cethCode}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#4f46e5', background: '#e0e7ff', padding: '2px 6px', borderRadius: '4px' }}>
                      {i.abatementRate}% ABATEMENT
                    </div>
                  </div>
                  <div style={{ color: formData.id === i.id ? '#4338ca' : 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px', marginTop: '4px', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                    {i.description}
                  </div>
                </div>
              </li>
            ))}
            {filteredData.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                No records found.
              </div>
            )}
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, color: '#312e81', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span style={{ width: '8px', height: '18px', background: 'linear-gradient(to bottom, #4f46e5, #4338ca)', borderRadius: '4px' }}></span>
                <Calculator size={20} color="#4338ca" /> RSP & ABATEMENT MASTER
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSave} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#4f46e5', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <Save size={16} /> SAVE MAPPING (CTRL+S)
              </button>
              <button onClick={() => setFormData(initialForm)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <RefreshCw size={16} /> CLEAR
              </button>
            </div>
          </div>

          <div style={{ padding: '12px', background: '#eff6ff', border: '1px solid #000000', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '11px', color: '#1e3a8a', lineHeight: '1.5' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary-color-end, #1d4ed8)', display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={14} /> HOW THIS LIST IS USED:</span> 
            THIS IS A REFERENCE LIST OF CETH CODES WITH THEIR RSP NOTIFICATION, SERIAL NO AND ABATEMENT %. THE ITEM SCREEN DOES NOT FILL FROM IT YET - ENTER THE RSP DETAILS ON THE ITEM YOURSELF.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem', background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>CETH CODE *</label>
                <input type="text" className="input-field" placeholder="E.G. 24031110" style={{ border: '1px solid #000000', boxShadow: '0 0 0 1px rgba(79,70,229,0.1)', textTransform: 'uppercase', width: '100%' }} value={formData.cethCode} onChange={e => setFormData({...formData, cethCode: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>COMMODITY DESCRIPTION *</label>
                <input type="text" className="input-field" placeholder="E.G. HUKKAH OR GUDAKU TOBACCO" style={{ border: '1px solid #000000', boxShadow: '0 0 0 1px rgba(79,70,229,0.1)', textTransform: 'uppercase', width: '100%' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value.toUpperCase()})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>NOTIFICATION NO *</label>
                <input type="text" className="input-field" placeholder="E.G. 049/2008" style={{ border: '1px solid #000000', width: '100%' }} value={formData.notificationNo} onChange={e => setFormData({...formData, notificationNo: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>SERIAL NO *</label>
                <input type="text" className="input-field" placeholder="E.G. 21" style={{ border: '1px solid #000000', width: '100%' }} value={formData.serialNo} onChange={e => setFormData({...formData, serialNo: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>ABATEMENT RATE (%) *</label>
                <input type="number" step="0.01" className="input-field" placeholder="0.00" style={{ border: '1px solid #000000', width: '100%' }} value={formData.abatementRate} onChange={e => setFormData({...formData, abatementRate: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>EFFECTIVE DATE</label>
                <ModernDatePicker className="input-field" style={{ width: '100%', borderColor: 'var(--border-color, var(--border-color, #cbd5e1))' }} value={String(formData.effectiveDate || '').slice(0, 10)} onChange={e => setFormData({...formData, effectiveDate: e.target.value})} />
              </div>
              <div style={{ paddingBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0, fontWeight: 600, color: '#334155' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: '#4f46e5' }} checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> IS ACTIVE
                </label>
              </div>
            </div>

          </div>

          <div style={{ borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>CETH Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Description</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Notif/Sr No</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Abatement</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((i) => (
                  <tr key={i.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', background: formData.id === i.id ? '#eef2ff' : '#fff', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #000000', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{i.cethCode}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 600, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.description}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 600 }}>{i.notificationNo} / {i.serialNo}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#4f46e5', fontWeight: 700 }}>{i.abatementRate}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span onClick={() => handleEdit(i)} style={{ color: 'var(--primary-color-end, #2563eb)', cursor: 'pointer', fontWeight: 600, marginRight: '10px' }}>Edit</span>
                      <span onClick={() => handleSwitch(i)} style={{ color: (i.isActive ? '#b45309' : '#15803d'), cursor: 'pointer', fontWeight: 600 }}>{i.isActive ? 'Switch off' : 'Switch on'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '1rem', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', textAlign: 'left' }}>
            * ENSURES ACCURATE MRP-BASED CUSTOMS ASSESSMENT FOR HIGH-VALUE GOODS.
          </div>
        </div>
      </div>
    </div>
  );
}
