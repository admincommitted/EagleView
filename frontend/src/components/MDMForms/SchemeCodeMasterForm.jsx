import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Search, ChevronRight, Activity, Tag, Trash2, ShieldCheck } from 'lucide-react';
import { askDelete } from './switchRow';

export default function SchemeCodeMasterForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  
  const initialForm = { code: '', desc: '', requiresLicense: false, requiresDbk: false, requiresRodtep: false, isActive: true };
  const [formData, setFormData] = useState(initialForm);
  // Using code as the unique identifier since it's the primary key
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/masters/schemecodes');
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    if (!formData.code || !formData.desc) return alert("Code and Description are required!");
    try {
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/api/masters/schemecodes/${encodeURIComponent(formData.code)}` : '/api/masters/schemecodes';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(initialForm);
        setIsEdit(false);
        fetchData();
      } else {
        alert("Error saving record");
      }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (code) => {
    if(!(await askDelete("Delete this scheme code?"))) return;
    try {
      const res = await fetch(`/api/masters/schemecodes/${encodeURIComponent(code)}`, { method: 'DELETE' });
      if(res.ok) {
          fetchData();
          if (formData.code === code) {
              setFormData(initialForm);
              setIsEdit(false);
          }
      }
    } catch (err) { console.error(err); }
  };

  const filteredData = data.filter(d => 
    d.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.desc?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%', background: 'var(--bg-input, #f1f5f9)', padding: '1rem' }}>
      
      {/* LEFT SIDEBAR */}
      <div style={{ width: '320px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'linear-gradient(to right, var(--bg-panel, #ffffff), #0284c710)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '13px', fontWeight: 800, color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', letterSpacing: '0.5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Search size={16} strokeWidth={2.5} /> SEARCH SCHEME
            </div>
            <span style={{ background: '#0284c7', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>{filteredData.length}</span>
          </h3>
          <div style={{ position: 'relative' }}>
            <input type="text" className="input-field" placeholder="Search Code or Desc..." style={{ width: '100%', paddingLeft: '32px', background: 'var(--bg-app, #f8fafc)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          </div>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem' }}>
          {filteredData.slice(0, 100).map(item => (
            <div 
              key={item.code} 
              onClick={() => { setFormData(item); setIsEdit(true); }}
              style={{ 
                padding: '8px', 
                marginBottom: '4px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: formData.code === item.code ? '#0284c715' : '#fff',
                border: formData.code === item.code ? '1px solid #0284c7' : '1px solid var(--bg-input, #f1f5f9)',
                transition: 'all 0.2s',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
              <div style={{ background: formData.code === item.code ? '#0284c7' : 'var(--bg-input, #f1f5f9)', color: formData.code === item.code ? '#fff' : '#94a3b8', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={16} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: formData.code === item.code ? '#0284c7' : '#334155', fontSize: '13px', marginBottom: '2px' }}>{item.code}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '190px', fontWeight: 500 }}>{item.desc}</div>
              </div>
              {formData.code === item.code && <ChevronRight size={16} color="#0284c7" />}
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN PANEL */}
      <div style={{ flex: 1, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', padding: '1rem 1.5rem', borderBottom: '1px solid #0284c730', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '15px', fontWeight: 800, letterSpacing: '0.5px' }}>
            <Activity size={20} strokeWidth={2.5} /> EXPORT SCHEME CODES MASTER
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            {isEdit && (
              <button onClick={() => handleDelete(formData.code)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: '#ef4444', border: '1px solid #dc2626', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                <Trash2 size={14} strokeWidth={2.5} /> DELETE
              </button>
            )}
            <button onClick={() => { setFormData(initialForm); setIsEdit(false); }} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', color: 'var(--text-muted, #475569)', border: '1px solid var(--border-color, #cbd5e1)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
              <RefreshCw size={14} strokeWidth={2.5} /> CLEAR
            </button>
            <button onClick={handleSave} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0284c7', color: '#fff', border: 'none', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
              <Save size={14} strokeWidth={2.5} /> {isEdit ? 'UPDATE' : 'SAVE'}
            </button>
          </div>
        </div>

        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div style={{ background: 'linear-gradient(to right bottom, #ffffff, #f0f9ff)', padding: '1rem', borderRadius: '8px', border: '1px solid #bae6fd', boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.1)', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#0284c7', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>SCHEME CODE *</label>
                  <input type="text" className="input-field" placeholder="e.g. 19" style={{ border: '1px solid #0284c7', background: '#0284c705', fontSize: '16px', fontWeight: 700, width: '100%', height: '36px', color: '#0284c7' }} value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} disabled={isEdit} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '8px' }}>DESCRIPTION *</label>
                  <input type="text" className="input-field" placeholder="Scheme Name..." style={{ border: '1px solid var(--border-color, #cbd5e1)', fontSize: '14px', width: '100%', height: '36px', textTransform: 'uppercase', fontWeight: 600, color: '#334155' }} value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value.toUpperCase()})} />
                </div>
            </div>

            <div style={{ background: 'linear-gradient(to right bottom, #ffffff, #f8fafc)', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '5px solid #3b82f6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '16px' }}><ShieldCheck size={14} style={{position: 'relative', top: '2px', marginRight: '4px'}}/> SYSTEM RULES ENGINE</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: formData.requiresDbk ? '#7e22ce' : '#64748b', background: formData.requiresDbk ? '#f3e8ff' : '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: formData.requiresDbk ? '1px solid #d8b4fe' : '1px solid transparent', transition: 'all 0.2s' }}>
                    <input type="checkbox" checked={formData.requiresDbk} onChange={e=>setFormData({...formData, requiresDbk: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                    Calculates Drawback
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: formData.requiresRodtep ? '#c2410c' : '#64748b', background: formData.requiresRodtep ? '#ffedd5' : '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: formData.requiresRodtep ? '1px solid #fdba74' : '1px solid transparent', transition: 'all 0.2s' }}>
                    <input type="checkbox" checked={formData.requiresRodtep} onChange={e=>setFormData({...formData, requiresRodtep: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                    Calculates RoDTEP
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: formData.requiresLicense ? '#0f766e' : '#64748b', background: formData.requiresLicense ? '#ccfbf1' : '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: formData.requiresLicense ? '1px solid #5eead4' : '1px solid transparent', transition: 'all 0.2s' }}>
                    <input type="checkbox" checked={formData.requiresLicense} onChange={e=>setFormData({...formData, requiresLicense: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                    Requires DGFT License
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: formData.isActive ? '#15803d' : '#b91c1c', background: formData.isActive ? '#dcfce7' : '#fee2e2', padding: '8px 12px', borderRadius: '8px', border: formData.isActive ? '1px solid #86efac' : '1px solid #fca5a5', transition: 'all 0.2s' }}>
                    <input type="checkbox" checked={formData.isActive} onChange={e=>setFormData({...formData, isActive: e.target.checked})} style={{ width: '16px', height: '16px' }} />
                    Is Active?
                  </label>
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
