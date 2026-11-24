import React, { useState, useEffect } from 'react';
import { Save, Search, RefreshCw, FileBadge, AlertTriangle } from 'lucide-react';
import switchRow from './switchRow';
import ModernDatePicker from '../common/ModernDatePicker';

const dmy = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(8, 10) + '-' + String(v).slice(5, 7) + '-' + String(v).slice(0, 4) : (v || '')); // dates are shown DD-MM-YYYY
export default function LicenseMasterForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [licenseData, setLicenseData] = useState([]);
  
  const initialForm = { id: '', licenseNumber: '', partyName: '', licenseType: 'EPCG', validUpTo: '', isActive: true };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchLicenses();
  }, []);

  const fetchLicenses = async () => {
    try {
      const res = await fetch('/api/masters/licenses?all=1');
      const data = await res.json();
      setLicenseData(Array.isArray(data) ? data : []); // an error answer is not a list (it crashed the screen)
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if(!formData.licenseNumber || !formData.partyName) return alert('Please fill the required fields (*)');
    if(!formData.validUpTo) return alert('Valid up to date is required');
    try {
      const url = formData.id ? `/api/masters/licenses/${formData.id}` : '/api/masters/licenses';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(initialForm);
        fetchLicenses();
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
    const done = await switchRow('licenses', row, 'license ' + (row.licenseNo || row.licenseNumber || ''));
    if (done) { if (formData && String(formData.id) === String(row.id)) setFormData(initialForm); fetchLicenses(); }
  };

  const filteredData = licenseData.filter(l => 
    l.licenseNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.partyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#059669" /> SEARCH LICENSE ({filteredData.length})
          </h3>
          <input type="text" className="input-field" placeholder="Search License No or Party..." style={{ width: '100%' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredData.map(l => {
              const isExpired = l.validUpTo && new Date(l.validUpTo) < new Date();
              return (
              <li 
                key={l.id} 
                onClick={() => handleEdit(l)} 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border-color, #cbd5e1)', 
                  cursor: 'pointer', 
                  background: formData.id === l.id ? 'linear-gradient(90deg, #ecfdf5 0%, var(--bg-panel, #ffffff) 100%)' : 'transparent', 
                  borderLeft: formData.id === l.id ? '4px solid #059669' : '4px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { if(formData.id !== l.id) e.currentTarget.style.background = 'var(--bg-app, var(--bg-app, #f8fafc))' }}
                onMouseLeave={(e) => { if(formData.id !== l.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: formData.id === l.id ? 700 : 700, color: 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>
                    {l.licenseNumber}
                  </div>
                  <div style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase' }}>
                    {l.partyName}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px' }}>{l.licenseType}</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, background: isExpired ? '#fee2e2' : '#dcfce7', color: isExpired ? '#991b1b' : '#166534', padding: '2px 6px', borderRadius: '4px' }}>EXP: {dmy(l.validUpTo) || 'N/A'}</span>
                  </div>
                </div>
              </li>
            )})}
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
            <h3 style={{ margin: 0, color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span style={{ width: '8px', height: '18px', background: 'linear-gradient(to bottom, #10b981, #059669)', borderRadius: '4px' }}></span>
                <FileBadge size={20} color="#059669" /> IMPORTER LICENSE MASTER
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSave} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#059669', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <Save size={16} /> SAVE (CTRL+S)
              </button>
              <button onClick={() => setFormData(initialForm)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <RefreshCw size={16} /> CLEAR
              </button>
            </div>
          </div>

          <div style={{ padding: '12px', background: '#eff6ff', border: '1px solid #000000', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '11px', color: '#1e3a8a', lineHeight: '1.5' }}>
            <span style={{ fontWeight: 700, color: 'var(--primary-color-end, #1d4ed8)', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={14} /> LICENSE VALIDITY:</span> EXPIRED LICENSES ARE SHOWN IN RED IN THE LIST BELOW. NO REMINDER MAIL IS SENT FROM HERE - CHECK THE VALID TILL DATE BEFORE USING A LICENSE.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem', background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>License Number *</label>
              <input type="text" className="input-field" placeholder="e.g. 0510008432" style={{ border: '1px solid #000000', boxShadow: '0 0 0 1px rgba(16,185,129,0.1)', textTransform: 'uppercase' }} value={formData.licenseNumber} onChange={e => setFormData({...formData, licenseNumber: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Importer Name *</label>
              <input type="text" className="input-field" placeholder="Select or Type Importer Name" style={{ border: '1px solid #000000', boxShadow: '0 0 0 1px rgba(16,185,129,0.1)', textTransform: 'uppercase' }} value={formData.partyName} onChange={e => setFormData({...formData, partyName: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>License Type *</label>
              <select className="input-field" value={formData.licenseType} onChange={e => setFormData({...formData, licenseType: e.target.value})} style={{ borderColor: '#10b981' }}>
                <option value="EPCG">EPCG</option>
                <option value="DEEC">DEEC</option>
                <option value="ADVANCE AUTHORISATION">ADVANCE AUTHORISATION</option>
                <option value="STPI">STPI</option>
                <option value="EOU">EOU</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Valid Up To *</label>
                <ModernDatePicker className="input-field" style={{ borderColor: '#10b981' }} value={String(formData.validUpTo || '').slice(0, 10)} onChange={e => setFormData({...formData, validUpTo: e.target.value})} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0, fontWeight: 600, color: '#334155' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: '#10b981' }} checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> Is Active
                </label>
              </div>
            </div>
          </div>

          <div style={{ borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>License No</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Importer Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Valid Till</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((l) => {
                  const isExpired = l.validUpTo && new Date(l.validUpTo) < new Date();
                  return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', background: formData.id === l.id ? '#ecfdf5' : '#fff', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#e0f2fe', color: 'var(--primary-text, #0369a1)', border: '1px solid #000000', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{l.licenseNumber}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 600 }}>{l.partyName}</td>
                    <td style={{ padding: '12px 16px', color: isExpired ? '#ef4444' : '#059669', fontWeight: 600 }}>{dmy(l.validUpTo)} {isExpired ? '(EXPIRED)' : ''}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ background: l.isActive ? '#dcfce7' : '#fee2e2', color: l.isActive ? '#166534' : '#991b1b', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 700 }}>
                        {l.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span onClick={() => handleEdit(l)} style={{ color: 'var(--primary-color-end, #2563eb)', cursor: 'pointer', fontWeight: 600, marginRight: '10px' }}>Edit</span>
                      <span onClick={() => handleSwitch(l)} style={{ color: (l.isActive ? '#b45309' : '#15803d'), cursor: 'pointer', fontWeight: 600 }}>{l.isActive ? 'Switch off' : 'Switch on'}</span>
                    </td>
                  </tr>
                )})}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>
                      No License records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div style={{ marginTop: '1rem', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', textAlign: 'left' }}>
            * LICENSE TRACKING RELIES ON ACCURATE EXPIRY DATES FOR PROACTIVE OPERATIONS MANAGEMENT.
          </div>
        </div>
      </div>
    </div>
  );
}
