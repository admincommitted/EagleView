import React, { useState, useEffect } from 'react';
import { Save, FileText, Search, Briefcase, RefreshCw } from 'lucide-react';
import switchRow from './switchRow';

export default function ShippingLineMasterForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [lineData, setLineData] = useState([]);
  
  const initialForm = { id: '', code: '', name: '', isActive: true };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchLines();
  }, []);

  const fetchLines = async () => {
    try {
      const res = await fetch('/api/masters/shippinglines?all=1'); // switched-off lines too, so they can be switched on again
      const data = await res.json();
      setLineData(Array.isArray(data) ? data : []); // an error answer is not a list (it crashed the screen)
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if(!formData.code || !formData.name) return alert('Please fill the required fields (*)');
    try {
      const url = formData.id ? `/api/masters/shippinglines/${formData.id}` : '/api/masters/shippinglines';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(initialForm);
        fetchLines();
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
    const done = await switchRow('shippinglines', row, 'shipping line ' + (row.lineCode || row.code || '') + ' ' + (row.lineName || row.name || ''));
    if (done) { if (formData && String(formData.id) === String(row.id)) setFormData(initialForm); fetchLines(); }
  };

  const filteredData = lineData.filter(b => 
    b.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#0d9488" /> SEARCH SHIPPING LINE ({filteredData.length})
          </h3>
          <input type="text" className="input-field" placeholder="Search Code or Desc..." style={{ width: '100%' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredData.map(b => (
              <li 
                key={b.id} 
                onClick={() => handleEdit(b)} 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border-color, #cbd5e1)', 
                  cursor: 'pointer', 
                  background: formData.id === b.id ? 'linear-gradient(90deg, #f0fdfa 0%, var(--bg-panel, #ffffff) 100%)' : 'transparent', 
                  borderLeft: formData.id === b.id ? '4px solid #0d9488' : '4px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { if(formData.id !== b.id) e.currentTarget.style.background = 'var(--bg-app, var(--bg-app, #f8fafc))' }}
                onMouseLeave={(e) => { if(formData.id !== b.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', 
                  background: formData.id === b.id ? 'linear-gradient(135deg, #0d9488, #0f766e)' : 'linear-gradient(135deg, var(--border-color, #e2e8f0), var(--border-color, #cbd5e1))', 
                  color: formData.id === b.id ? '#fff' : 'var(--text-muted, var(--text-muted, #64748b))', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  boxShadow: formData.id === b.id ? '0 2px 4px rgba(13,148,136,0.3)' : 'none'
                }}>
                  <Briefcase size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: formData.id === b.id ? 700 : 600, color: formData.id === b.id ? '#115e59' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>
                    {b.code}
                  </div>
                  <div style={{ color: formData.id === b.id ? '#0d9488' : 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px', marginTop: '2px', fontWeight: 700 }}>
                    {b.name}
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
            <h3 style={{ margin: 0, color: '#134e4a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span style={{ width: '8px', height: '18px', background: 'linear-gradient(to bottom, #0d9488, #0f766e)', borderRadius: '4px' }}></span>
                <Briefcase size={20} color="#0f766e" /> ADD/EDIT SHIPPING LINE MASTER
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
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Line Code *</label>
              <input type="text" className="input-field" placeholder="e.g. SPL/56" style={{ border: '1px solid #000000', boxShadow: '0 0 0 1px rgba(13,148,136,0.1)', textTransform: 'uppercase' }} value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Shipping Line Name *</label>
              <input type="text" className="input-field" placeholder="e.g. MAERSK LINE INDIA PVT LTD" style={{ border: '1px solid #000000', boxShadow: '0 0 0 1px rgba(13,148,136,0.1)' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0, fontWeight: 600, color: '#334155' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: '#0d9488' }} checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> Is Active
              </label>
            </div>
          </div>

          <div style={{ borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Line Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', background: formData.id === b.id ? '#f0fdfa' : '#fff', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#ccfbf1', color: '#0f766e', border: '1px solid #000000', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{b.code}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ background: b.isActive ? '#dcfce7' : '#fee2e2', color: b.isActive ? '#166534' : '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>
                        {b.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span onClick={() => handleEdit(b)} style={{ color: 'var(--primary-color-end, #2563eb)', cursor: 'pointer', fontWeight: 600, marginRight: '10px' }}>Edit</span>
                      <span onClick={() => handleSwitch(b)} style={{ color: (b.isActive ? '#b45309' : '#15803d'), cursor: 'pointer', fontWeight: 600 }}>{b.isActive ? 'Switch off' : 'Switch on'}</span>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>
                      No shipping lines found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '1rem', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', textAlign: 'left' }}>
            * SHIPPING LINE CODES (SPL/...) AS USED IN ICEGATE EXPORT SEA. LOADED FROM ICAFFE 04-NOV-2026.
          </div>
        </div>
      </div>
    </div>
  );
}
