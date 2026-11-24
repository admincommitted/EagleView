import React, { useState, useEffect } from 'react';
import { Save, FileText, Search, Scale, Edit2, Trash2, RefreshCw } from 'lucide-react';
import switchRow from './switchRow';

export default function UqcMasterForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [uqcData, setUqcData] = useState([]);
  
  const initialForm = { id: '', uqcCode: '', description: '', isActive: true };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchUqcs();
  }, []);

  const fetchUqcs = async () => {
    try {
      const res = await fetch('/api/masters/uqcs');
      const data = await res.json();
      setUqcData(Array.isArray(data) ? data : []); // an error answer is not a list (it crashed the screen)
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if(!formData.uqcCode || !formData.description) return alert('Please fill the required fields (*)');
    if(!/^[A-Z]{2,4}$/.test(String(formData.uqcCode).trim().toUpperCase())) return alert('UQC code: 2-4 letters as in the CBIC UQC list (e.g. KGS, NOS)');
    try {
      const url = formData.id ? `/api/masters/uqcs/${formData.id}` : '/api/masters/uqcs';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(initialForm);
        fetchUqcs();
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
    const done = await switchRow('uqcs', row, 'UQC ' + (row.uqcCode || row.code || ''));
    if (done) { if (formData && String(formData.id) === String(row.id)) setFormData(initialForm); fetchUqcs(); }
  };

  const filteredData = uqcData.filter(u => 
    u.uqcCode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#8b5cf6" /> SEARCH UQC ({filteredData.length})
          </h3>
          <input type="text" className="input-field" placeholder="Search Code or Desc..." style={{ width: '100%' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredData.map(u => (
              <li 
                key={u.id} 
                onClick={() => handleEdit(u)} 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border-color, #cbd5e1)', 
                  cursor: 'pointer', 
                  background: formData.id === u.id ? 'linear-gradient(90deg, #f5f3ff 0%, var(--bg-panel, #ffffff) 100%)' : 'transparent', 
                  borderLeft: formData.id === u.id ? '4px solid #8b5cf6' : '4px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { if(formData.id !== u.id) e.currentTarget.style.background = 'var(--bg-app, var(--bg-app, #f8fafc))' }}
                onMouseLeave={(e) => { if(formData.id !== u.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', 
                  background: formData.id === u.id ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'linear-gradient(135deg, var(--border-color, #e2e8f0), var(--border-color, #cbd5e1))', 
                  color: formData.id === u.id ? '#fff' : 'var(--text-muted, var(--text-muted, #64748b))', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  boxShadow: formData.id === u.id ? '0 2px 4px rgba(139,92,246,0.3)' : 'none'
                }}>
                  <Scale size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: formData.id === u.id ? 700 : 600, color: formData.id === u.id ? '#5b21b6' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>
                    {u.uqcCode}
                  </div>
                  <div style={{ color: formData.id === u.id ? '#8b5cf6' : 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px', marginTop: '2px', fontWeight: 700 }}>
                    {u.description}
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
            <h3 style={{ margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span style={{ width: '8px', height: '18px', background: 'linear-gradient(to bottom, #8b5cf6, #6d28d9)', borderRadius: '4px' }}></span>
                <Scale size={20} color="#6d28d9" /> ADD/EDIT UQC (UNIT OF MEASUREMENT)
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSave} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <Save size={16} /> SAVE (CTRL+S)
              </button>
              <button onClick={() => setFormData(initialForm)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <RefreshCw size={16} /> CLEAR
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>UQC Code *</label>
              <input type="text" className="input-field" placeholder="e.g. KGS" style={{ border: '1px solid #000000', boxShadow: '0 0 0 1px rgba(139,92,246,0.1)', textTransform: 'uppercase' }} value={formData.uqcCode} onChange={e => setFormData({...formData, uqcCode: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Description *</label>
              <input type="text" className="input-field" placeholder="e.g. KILOGRAMS" style={{ border: '1px solid #000000', boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value.toUpperCase()})} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0, fontWeight: 600, color: '#334155' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }} checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> Is Active
              </label>
            </div>
          </div>

          <div style={{ borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>UQC Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Description</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', background: formData.id === u.id ? '#f5f3ff' : '#fff', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #000000', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{u.uqcCode}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 600 }}>{u.description}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ background: u.isActive ? '#dcfce7' : '#fee2e2', color: u.isActive ? '#166534' : '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>
                        {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span onClick={() => handleEdit(u)} style={{ color: 'var(--primary-color-end, #2563eb)', cursor: 'pointer', fontWeight: 600, marginRight: '10px' }}>Edit</span>
                      <span onClick={() => handleSwitch(u)} style={{ color: (u.isActive ? '#b45309' : '#15803d'), cursor: 'pointer', fontWeight: 600 }}>{u.isActive ? 'Switch off' : 'Switch on'}</span>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>
                      No UQC records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
