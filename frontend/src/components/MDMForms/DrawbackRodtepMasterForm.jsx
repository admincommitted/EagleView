import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, FileText, Search, ChevronRight, Activity, Percent, ShieldAlert, Tag } from 'lucide-react';
import { askDelete } from './switchRow';

const DrawbackRodtepMasterForm = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  
  const initialForm = { id: '', tariffItem: '', description: '', schemeDescription: '', schemeCode: '', drawbackRate: 0, drawbackCap: 0, rodtepRate: 0, rodtepCap: 0, rosctlRate: 0, rosctlCap: 0, exportDuty: 0, dgftPolicy: 'FREE', uqc: '' };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/masters/drawbacks?all=1');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    try {
      if (typeof payload !== 'undefined' && !payload.id) delete payload.id;
      const method = formData.id ? 'PUT' : 'POST';
      const url = formData.id ? `/api/masters/drawbacks/${formData.id}` : '/api/masters/drawbacks?all=1';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(initialForm);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if(!(await askDelete("Delete this record?"))) return;
    try {
      const res = await fetch(`/api/masters/drawbacks/${id}`, { method: 'DELETE' });
      if(res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredData = data.filter(d => 
    d.tariffItem?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', background: '#f1f5f9', padding: '1rem' }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{ width: '320px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(to right, #ffffff, #fff7ed)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '13px', fontWeight: 800, color: '#ea580c', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '0.5px' }}>
            <Search size={16} strokeWidth={2.5} /> EXPORT SCHEDULES
          </h3>
          <div style={{ position: 'relative' }}>
            <input type="text" className="input-field" placeholder="Search Tariff Item or Desc..." style={{ width: '100%', paddingLeft: '32px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          </div>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
          {filteredData.map(item => (
            <div 
              key={item.id} 
              onClick={() => setFormData(item)}
              style={{ 
                padding: '8px', 
                marginBottom: '4px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: formData.id === item.id ? '#fff7ed' : '#fff',
                border: formData.id === item.id ? '1px solid #fed7aa' : '1px solid #f1f5f9',
                boxShadow: formData.id === item.id ? '0 2px 4px rgba(234,88,12,0.05)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
              <div style={{ background: formData.id === item.id ? '#ea580c' : '#f1f5f9', color: formData.id === item.id ? '#fff' : '#94a3b8', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={16} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: formData.id === item.id ? '#ea580c' : '#334155', fontSize: '13px', marginBottom: '2px' }}>{item.tariffItem}</div>
                <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '190px', fontWeight: 500 }}>{item.description}</div>
              </div>
              {formData.id === item.id && <ChevronRight size={16} color="#ea580c" />}
            </div>
          ))}
          {filteredData.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>NO MATCHING ITEMS FOUND</div>
          )}
        </div>
      </div>

      {/* RIGHT MAIN PANEL */}
      <div style={{ flex: 1, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Header Toolbar */}
        <div style={{ background: 'linear-gradient(90deg, #fff7ed, #ffffff)', padding: '1rem 1.5rem', borderBottom: '1px solid #ffedd5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: '#ea580c', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px' }}>
            <Activity size={20} strokeWidth={2.5} /> DRAWBACK / RODTEP / EXPORT MASTER
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setFormData(initialForm)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <RefreshCw size={14} strokeWidth={2.5} /> CLEAR
            </button>
            <button onClick={handleSave} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, boxShadow: '0 4px 6px rgba(234,88,12,0.2)' }}>
              <Save size={14} strokeWidth={2.5} /> {formData.id ? 'UPDATE' : 'SAVE'}
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#fafaf9' }}>
          <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Primary Info Banner */}
            <div style={{ background: '#fff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 2fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#ea580c', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>TARIFF ITEM (HSN) *</label>
                  <input type="text" className="input-field" placeholder="e.g. 6109" style={{ border: '1px solid #fed7aa', background: '#fff7ed', fontSize: '16px', fontWeight: 700, width: '100%', height: '32px', color: '#9a3412' }} value={formData.tariffItem} onChange={e => setFormData({...formData, tariffItem: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#0284c7', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>SCHEME CODE (SR NO)</label>
                  <input type="text" className="input-field" placeholder="e.g. 610901A" style={{ border: '1px solid #bae6fd', background: '#f0f9ff', fontSize: '14px', fontWeight: 700, width: '100%', height: '32px', color: '#0369a1', textTransform: 'uppercase' }} value={formData.schemeCode} onChange={e => setFormData({...formData, schemeCode: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>COMMODITY DESCRIPTION (HSN DESC) *</label>
                  <input type="text" className="input-field" placeholder="General description of goods..." style={{ border: '1px solid #cbd5e1', fontSize: '14px', width: '100%', height: '32px', textTransform: 'uppercase', fontWeight: 600, color: '#334155' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value.toUpperCase()})} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>SCHEME SPECIFIC DESCRIPTION (OPTIONAL)</label>
                <input type="text" className="input-field" placeholder="Specific description exactly as per Drawback / RoDTEP schedule..." style={{ border: '1px solid #cbd5e1', fontSize: '13px', width: '100%', height: '32px', textTransform: 'uppercase', fontWeight: 600, color: '#334155', background: '#f8fafc' }} value={formData.schemeDescription} onChange={e => setFormData({...formData, schemeDescription: e.target.value.toUpperCase()})} />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* DBK Block */}
              <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '4px solid #3b82f6', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.05)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}><Percent size={16} color="#3b82f6" /> DRAWBACK (DBK)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>RATE (%)</label>
                    <input type="number" step="0.01" className="input-field" value={formData.drawbackRate} onChange={e=>setFormData({...formData, drawbackRate: e.target.value})} style={{ width: '100%', fontWeight: 700, color: '#3b82f6' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>CAP LIMIT (RS)</label>
                    <input type="number" step="0.01" className="input-field" value={formData.drawbackCap} onChange={e=>setFormData({...formData, drawbackCap: e.target.value})} style={{ width: '100%', fontWeight: 600 }} />
                  </div>
                </div>
              </div>

              {/* RODTEP Block */}
              <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '4px solid #10b981', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}><Percent size={16} color="#10b981" /> RODTEP SCHEME</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>RATE (%)</label>
                    <input type="number" step="0.01" className="input-field" value={formData.rodtepRate} onChange={e=>setFormData({...formData, rodtepRate: e.target.value})} style={{ width: '100%', fontWeight: 700, color: '#10b981' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>CAP (RS)</label>
                    <input type="number" step="0.01" className="input-field" value={formData.rodtepCap} onChange={e=>setFormData({...formData, rodtepCap: e.target.value})} style={{ width: '100%', fontWeight: 600 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>UQC</label>
                    <input type="text" className="input-field" value={formData.uqc} onChange={e=>setFormData({...formData, uqc: e.target.value.toUpperCase()})} placeholder="E.G. KGS" style={{ width: '100%', textTransform: 'uppercase', fontWeight: 600 }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* RoSCTL Block */}
              <div style={{ background: '#fff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '4px solid #a855f7', boxShadow: '0 4px 6px -1px rgba(168, 85, 247, 0.05)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}><Percent size={16} color="#a855f7" /> RoSCTL (GARMENTS)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>RATE (%)</label>
                    <input type="number" step="0.01" className="input-field" value={formData.rosctlRate} onChange={e=>setFormData({...formData, rosctlRate: e.target.value})} style={{ width: '100%', fontWeight: 700, color: '#a855f7' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>CAP (RS)</label>
                    <input type="number" step="0.01" className="input-field" value={formData.rosctlCap} onChange={e=>setFormData({...formData, rosctlCap: e.target.value})} style={{ width: '100%', fontWeight: 600 }} />
                  </div>
                </div>
              </div>

              {/* EXPORT DUTY & DGFT POLICY Block */}
              <div style={{ background: '#fff1f2', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecdd3', borderLeft: '4px solid #e11d48', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.05)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#9f1239', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}><ShieldAlert size={16} color="#e11d48" /> EXPORT TARIFF & LICENCE</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#be123c', marginBottom: '6px' }}>EXPORT DUTY (%)</label>
                    <input type="number" step="0.01" className="input-field" style={{ borderColor: '#fda4af', width: '100%', fontWeight: 700, color: '#e11d48', background: '#fff' }} value={formData.exportDuty} onChange={e=>setFormData({...formData, exportDuty: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#be123c', marginBottom: '6px' }}>DGFT LICENCE POLICY</label>
                    <select className="input-field" style={{ borderColor: '#fda4af', color: formData.dgftPolicy === 'FREE' ? '#16a34a' : '#e11d48', fontWeight: 800, width: '100%', background: '#fff', height: '32px' }} value={formData.dgftPolicy} onChange={e=>setFormData({...formData, dgftPolicy: e.target.value})}>
                      <option value="FREE" style={{color: '#16a34a'}}>FREE</option>
                      <option value="RESTRICTED" style={{color: '#e11d48'}}>RESTRICTED</option>
                      <option value="PROHIBITED" style={{color: '#e11d48'}}>PROHIBITED</option>
                      <option value="STE" style={{color: '#ea580c'}}>STE</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
  
            <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', background: '#fff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#334155', fontWeight: 800, fontSize: '11px' }}>TARIFF ITEM</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#334155', fontWeight: 800, fontSize: '11px' }}>DESCRIPTION</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', color: '#334155', fontWeight: 800, fontSize: '11px' }}>DBK %</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', color: '#334155', fontWeight: 800, fontSize: '11px' }}>RoDTEP %</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', color: '#334155', fontWeight: 800, fontSize: '11px' }}>RoSCTL %</th>
                    <th style={{ padding: '6px 12px', textAlign: 'center', color: '#334155', fontWeight: 800, fontSize: '11px' }}>POLICY</th>
                    <th style={{ padding: '6px 12px', textAlign: 'right', color: '#334155', fontWeight: 800, fontSize: '11px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length > 0 ? data.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #cbd5e1', background: formData.id === item.id ? '#fff7ed' : (idx % 2 === 0 ? '#fff' : '#f8fafc'), transition: 'background 0.2s' }}>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ fontWeight: 800, color: '#ea580c' }}>{item.tariffItem}</div>
                        {item.schemeCode && <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 700 }}>{item.schemeCode}</div>}
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ color: '#475569', fontWeight: 600, marginBottom: item.schemeDescription ? '4px' : '0' }}>{item.description}</div>
                        {item.schemeDescription && <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>{item.schemeDescription}</div>}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800, color: '#3b82f6' }}>{item.drawbackRate}%</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800, color: '#10b981' }}>{item.rodtepRate}%</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: 800, color: '#a855f7' }}>{item.rosctlRate || 0}%</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, background: item.dgftPolicy === "FREE" ? '#dcfce7' : '#ffe4e6', color: item.dgftPolicy === "FREE" ? '#16a34a' : '#e11d48' }}>
                          {item.dgftPolicy || "FREE"}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                          <span onClick={() => setFormData(item)} style={{ color: '#0284c7', cursor: 'pointer', fontWeight: 800, fontSize: '11px' }}>EDIT</span>
                          <span onClick={() => handleDelete(item.id)} style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 800, fontSize: '11px' }}>DELETE</span>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
                        NO SCHEDULE DATA FOUND
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default DrawbackRodtepMasterForm;
