import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, FileText, Search, ChevronRight, Activity, Percent, ShieldAlert, Tag, Trash2 , ShieldCheck } from 'lucide-react';
import switchRow from './switchRow';

const ExportPolicyMasterForm = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  
  const initialForm = { id: '', tariffItem: '', description: '', ...{"exportDuty":0,"dgftPolicy":"FREE", isActive: true , uqc: '' } };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/masters/exportpolicies');
      const json = await res.json();
      setData(Array.isArray(json) ? json : []); // an error answer is not a list (it crashed the screen)
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    try {
      let payload = {...formData};
      if (!payload.id) delete payload.id;
      const method = formData.id ? 'PUT' : 'POST';
      const url = formData.id ? `/api/masters/exportpolicies/${formData.id}` : '/api/masters/exportpolicies';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(res.ok) {
        setFormData(initialForm);
        fetchData();
      } else { const err = await res.json().catch(() => ({})); alert('Not saved: ' + (err.error || err.message || ('HTTP ' + res.status))); }
    } catch (err) { console.error(err); }
  };

  // 22-Nov-2026: a row is switched off / on, not deleted (it stays in the master as inactive)
  const handleSwitch = async (row) => {
    const done = await switchRow('exportpolicies', row, 'policy entry ' + (row.tariffItem || ''));
    if (done) { if (formData && String(formData.id) === String(row.id)) setFormData(initialForm); fetchData(); }
  };

  const filteredData = data.filter(d => 
    d.tariffItem?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', background: 'var(--bg-input, #f1f5f9)', padding: '1rem' }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{ width: '320px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'linear-gradient(to right, var(--bg-panel, #ffffff), #e11d4810)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '13px', fontWeight: 800, color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={16} strokeWidth={2.5} /> SEARCH
            </div>
            <span style={{ background: '#e11d48', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{filteredData.length}</span>
          </h3>
          <div style={{ position: 'relative' }}>
            <input type="text" className="input-field" placeholder="Search Tariff Item or Desc..." style={{ width: '100%', paddingLeft: '32px', background: 'var(--bg-app, #f8fafc)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          </div>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
          {filteredData.slice(0, 100).map(item => (
            <div 
              key={item.id} 
              onClick={() => setFormData(item)}
              style={{ 
                padding: '8px', 
                marginBottom: '4px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: formData.id === item.id ? '#e11d4815' : '#fff',
                border: formData.id === item.id ? `1px solid #e11d48` : '1px solid var(--bg-input, #f1f5f9)',
                transition: 'all 0.2s',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
              <div style={{ background: formData.id === item.id ? '#e11d48' : 'var(--bg-input, #f1f5f9)', color: formData.id === item.id ? '#fff' : '#94a3b8', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={16} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: formData.id === item.id ? '#e11d48' : '#334155', fontSize: '13px', marginBottom: '2px' }}>{item.tariffItem}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '190px', fontWeight: 500 }}>{item.description}</div>
              </div>
              {formData.id === item.id && <ChevronRight size={16} color="#e11d48" />}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN PANEL */}
      <div style={{ flex: 1, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ background: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)', padding: '1rem 1.5rem', borderBottom: '1px solid #e11d4830', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: '#e11d48', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px' }}>
            <Activity size={20} strokeWidth={2.5} /> EXPORT TARIFF & POLICY MASTER
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            {formData.id && (
              <button onClick={() => handleSwitch(formData)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: '#ef4444', border: '1px solid #dc2626', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                {formData.isActive ? 'SWITCH OFF' : 'SWITCH ON'}
              </button>
            )}
            <button onClick={() => setFormData(initialForm)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: 'var(--text-muted, #475569)', border: '1px solid var(--border-color, #cbd5e1)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
              <RefreshCw size={14} strokeWidth={2.5} /> CLEAR
            </button>
            <button onClick={handleSave} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e11d48', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
              <Save size={14} strokeWidth={2.5} /> {formData.id ? 'UPDATE' : 'SAVE'}
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ background: 'linear-gradient(to right bottom, #ffffff, #f0f9ff)', padding: '1rem', borderRadius: '8px', border: '1px solid #bae6fd', boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.1)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 100px', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#e11d48', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>TARIFF ITEM (HSN) *</label>
                  <input type="text" className="input-field" placeholder="e.g. 6109" style={{ border: `1px solid #e11d48`, background: '#e11d4805', fontSize: '16px', fontWeight: 700, width: '100%', height: '32px', color: '#e11d48' }} value={formData.tariffItem} onChange={e => setFormData({...formData, tariffItem: e.target.value})} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>COMMODITY DESCRIPTION (HSN DESC) *</label>
                  <input type="text" className="input-field" placeholder="General description of goods..." style={{ border: '1px solid var(--border-color, #cbd5e1)', fontSize: '14px', width: '100%', height: '32px', textTransform: 'uppercase', fontWeight: 600, color: '#334155' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>UNIT (UQC)</label>
                  <input type="text" className="input-field" placeholder="e.g. SQM" style={{ border: '1px solid var(--border-color, #cbd5e1)', fontSize: '14px', width: '100%', height: '36px', textTransform: 'uppercase', fontWeight: 600, color: '#334155' }} value={formData.uqc || ''} onChange={e => setFormData({...formData, uqc: e.target.value.toUpperCase()})} />
                </div>
              </div>
              
            </div>

            {/* FORM SPECIFIC FIELDS */}
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', borderLeft: `4px solid #e11d48`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '8px' }}>EXPORT DUTY (%)</label>
                    <input type="number" step="0.01" className="input-field" value={formData.exportDuty} onChange={e=>setFormData({...formData, exportDuty: e.target.value})} style={{ width: '100%', fontWeight: 700, color: '#e11d48', fontSize: '14px', height: '36px' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748b)', marginBottom: '8px' }}>DGFT LICENCE POLICY</label>
                    <select className="input-field" style={{ width: '100%', fontWeight: 700, height: '36px' }} value={formData.dgftPolicy} onChange={e=>setFormData({...formData, dgftPolicy: e.target.value})}>
                      <option value="FREE">FREE</option>
                      <option value="RESTRICTED">RESTRICTED</option>
                      <option value="PROHIBITED">PROHIBITED</option>
                      <option value="STE">STE</option>
                    </select>
                  </div>
                </div>
              
            </div>

            <div style={{ borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ background: 'var(--bg-app, #f8fafc)', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                  <tr>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#334155', fontWeight: 800, fontSize: '11px' }}>TARIFF ITEM</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#334155', fontWeight: 800, fontSize: '11px' }}>DESCRIPTION</th>
                    <th style={{ padding: "6px 12px", textAlign: "center", color: "#334155", fontWeight: 800, fontSize: "11px" }}>DUTY %</th><th style={{ padding: "6px 12px", textAlign: "center", color: "#334155", fontWeight: 800, fontSize: "11px" }}>POLICY</th><th style={{ padding: "6px 12px", textAlign: "center", color: "#334155", fontWeight: 800, fontSize: "11px" }}>UNIT</th>
                    <th style={{ padding: '6px 12px', textAlign: 'right', color: '#334155', fontWeight: 800, fontSize: '11px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length > 0 ? filteredData.slice(0, 100).map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', background: formData.id === item.id ? '#e11d4810' : (idx % 2 === 0 ? '#fff' : 'var(--bg-app, #f8fafc)'), transition: 'background 0.2s' }}>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ fontWeight: 800, color: '#e11d48' }}>{item.tariffItem}</div>
                        {item.schemeCode && <div style={{ fontSize: '10px', color: 'var(--primary-text, #0284c7)', fontWeight: 700 }}>{item.schemeCode}</div>}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ color: 'var(--text-muted, #475569)', fontWeight: 600 }}>{item.description}</div>
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 800, color: "#e11d48" }}>{item.exportDuty}%</td><td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 800 }}>{item.dgftPolicy}</td><td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700, color: "#475569" }}>{item.uqc || "-"}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                          <span onClick={() => setFormData(item)} style={{ color: 'var(--primary-text, #0284c7)', cursor: 'pointer', fontWeight: 800, fontSize: '11px' }}>EDIT</span>
                          <span onClick={() => handleSwitch(item)} style={{ color: (item.isActive ? '#b45309' : '#15803d'), cursor: 'pointer', fontWeight: 800, fontSize: '11px' }}>{item.isActive ? 'SWITCH OFF' : 'SWITCH ON'}</span>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>NO SCHEDULE DATA FOUND</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ background: 'linear-gradient(to right bottom, #ffffff, #f8fafc)', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '5px solid #3b82f6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '16px' }}><ShieldCheck size={14} style={{position: 'relative', top: '2px', marginRight: '4px'}}/> SYSTEM RULES ENGINE</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: formData.isActive ? '#15803d' : '#b91c1c', background: formData.isActive ? '#dcfce7' : '#fee2e2', padding: '8px 12px', borderRadius: '8px', border: formData.isActive ? '1px solid #86efac' : '1px solid #fca5a5', transition: 'all 0.2s' }}>
                    <input type="checkbox" checked={formData.isActive} onChange={e=>setFormData({...formData, isActive: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                    Schedule Active?
                  </label>
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportPolicyMasterForm;
