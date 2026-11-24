import React, { useState, useEffect } from 'react';
import { Save, Search, RefreshCw, FileUp, Zap } from 'lucide-react';
import switchRow from './switchRow';

export default function ESanchitMasterForm() {
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState([]);
  
  const initialForm = { id: '', documentCode: '', description: '', documentType: 'MANDATORY', agency: 'CUSTOMS', isActive: true };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/masters/esanchits');
      const json = await res.json();
      setData(Array.isArray(json) ? json : []); // an error answer is not a list (it crashed the screen)
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if(!formData.documentCode || !formData.description) return alert('Please fill the required fields (*)');
    if(String(formData.documentCode).trim().length > 6) return alert('ICEGATE document type code is at most 6 characters (e.g. 380000)');
    try {
      const url = formData.id ? `/api/masters/esanchits/${formData.id}` : '/api/masters/esanchits';
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
    const done = await switchRow('esanchits', row, 'document code ' + (row.documentCode || ''));
    if (done) { if (formData && String(formData.id) === String(row.id)) setFormData(initialForm); fetchData(); }
  };

  // 03-Nov-2026: active codes first; inactive ones (the old 7-digit codes) at the end, marked INACTIVE
  const isOn = (i) => i.isActive !== false && i.isActive !== 0;
  const filteredData = data.filter(i => 
    i.documentCode?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((x, y) => (isOn(y) ? 1 : 0) - (isOn(x) ? 1 : 0) || String(x.documentCode).localeCompare(String(y.documentCode)));

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#e11d48" /> E-SANCHIT CODES
          </h3>
          {/* Count badges */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <span style={{ background: '#e11d48', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
              Total: {data.length}
            </span>
            {searchTerm && (
              <span style={{ background: '#0ea5e9', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                Found: {filteredData.length}
              </span>
            )}
          </div>
          <input type="text" className="input-field" placeholder="Search Code or Document..." style={{ width: '100%' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
                  background: formData.id === i.id ? 'linear-gradient(90deg, #fff1f2 0%, var(--bg-panel, #ffffff) 100%)' : 'transparent', 
                  borderLeft: formData.id === i.id ? '4px solid #e11d48' : '4px solid transparent',
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
                  background: formData.id === i.id ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'linear-gradient(135deg, var(--border-color, #e2e8f0), var(--border-color, #cbd5e1))', 
                  color: formData.id === i.id ? '#fff' : 'var(--text-muted, var(--text-muted, #64748b))', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  boxShadow: formData.id === i.id ? '0 2px 4px rgba(225,29,72,0.3)' : 'none'
                }}>
                  <FileUp size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: formData.id === i.id ? 700 : 600, color: formData.id === i.id ? '#881337' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>
                      {i.documentCode}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: isOn(i) ? '#e11d48' : '#64748b', background: isOn(i) ? '#ffe4e6' : '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                      {isOn(i) ? i.agency : 'INACTIVE'}
                    </div>
                  </div>
                  <div style={{ color: formData.id === i.id ? '#be123c' : 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px', marginTop: '4px', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
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
            <h3 style={{ margin: 0, color: '#881337', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span style={{ width: '8px', height: '18px', background: 'linear-gradient(to bottom, #e11d48, #be123c)', borderRadius: '4px' }}></span>
                <FileUp size={20} color="#be123c" /> ADD/EDIT E-SANCHIT DOCUMENT MASTER
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleSave} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e11d48', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <Save size={16} /> SAVE CODE (CTRL+S)
              </button>
              <button onClick={() => setFormData(initialForm)} className="btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <RefreshCw size={16} /> CLEAR
              </button>
            </div>
          </div>

          <div style={{ padding: '12px', background: '#fff1f2', border: '1px solid #ef4444', borderRadius: '6px', marginBottom: '1.5rem', fontSize: '11px', color: '#9f1239', lineHeight: '1.5' }}>
            <span style={{ fontWeight: 700, color: '#e11d48', display: 'flex', alignItems: 'center', gap: '4px' }}><Zap size={14} /> ICEGATE VALIDATION:</span> 
            THESE CODES ARE USED FOR SINGLE WINDOW (SWIFT) E-SANCHIT DOCUMENT UPLOADS. INCORRECT CODES WILL RESULT IN ICEGATE REJECTION DURING BILL OF ENTRY SUBMISSION.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem', background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Document Code *</label>
                <input type="text" className="input-field" placeholder="E.G. 380000" maxLength={6} style={{ border: '1px solid #e11d48', boxShadow: '0 0 0 1px rgba(225,29,72,0.1)', textTransform: 'uppercase', width: '100%' }} value={formData.documentCode} onChange={e => setFormData({...formData, documentCode: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Document Description *</label>
                <input type="text" className="input-field" placeholder="E.G. COMMERCIAL INVOICE" style={{ border: '1px solid #e11d48', boxShadow: '0 0 0 1px rgba(225,29,72,0.1)', textTransform: 'uppercase', width: '100%' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value.toUpperCase()})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Type</label>
                <select className="input-field" value={formData.documentType} onChange={e => setFormData({...formData, documentType: e.target.value})} style={{ width: '100%' }}>
                  <option value="MANDATORY">MANDATORY</option>
                  <option value="CONDITIONAL">CONDITIONAL</option>
                  <option value="OPTIONAL">OPTIONAL</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>PGA / Agency</label>
                <select className="input-field" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} style={{ width: '100%' }}>
                  <optgroup label="── Customs / Govt ──">
                    <option value="CUSTOMS">CUSTOMS</option>
                    <option value="DGFT">DGFT</option>
                  </optgroup>
                  <optgroup label="── Food / Agriculture ──">
                    <option value="FSSAI">FSSAI</option>
                    <option value="PQIS">PQIS (Plant Quarantine)</option>
                    <option value="AQCS">AQCS (Animal Quarantine)</option>
                    <option value="DADF">DADF (Veterinary)</option>
                    <option value="EIC">EIC (Fish / Marine)</option>
                    <option value="APEDA">APEDA</option>
                    <option value="SPICE BOARD">SPICE BOARD</option>
                    <option value="TEA BOARD">TEA BOARD</option>
                    <option value="COFFEE BOARD">COFFEE BOARD</option>
                    <option value="RUBBER BOARD">RUBBER BOARD</option>
                    <option value="TOBACCO BOARD">TOBACCO BOARD</option>
                  </optgroup>
                  <optgroup label="── Quality / Standards ──">
                    <option value="BIS">BIS</option>
                    <option value="EPC">EPC (Export Promotion Council)</option>
                    <option value="THIRD PARTY">THIRD PARTY</option>
                  </optgroup>
                  <optgroup label="── Pharma / Chemical ──">
                    <option value="CDSCO">CDSCO</option>
                    <option value="PESO">PESO</option>
                    <option value="NCB">NCB (Narcotics)</option>
                  </optgroup>
                  <optgroup label="── Gems / Special Sectors ──">
                    <option value="GJEPC">GJEPC</option>
                    <option value="ASI">ASI (Archaeology)</option>
                    <option value="MOEF">MOEF (Wildlife)</option>
                    <option value="MINDEF">MINDEF (Defence)</option>
                    <option value="TEXTILE MINISTRY">TEXTILE MINISTRY</option>
                  </optgroup>
                  <optgroup label="── Finance ──">
                    <option value="BANK">BANK</option>
                    <option value="INSURANCE">INSURANCE</option>
                  </optgroup>
                </select>
              </div>
              <div style={{ paddingBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0, fontWeight: 600, color: '#334155' }}>
                  <input type="checkbox" style={{ width: '18px', height: '18px', accentColor: '#e11d48' }} checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> IS ACTIVE
                </label>
              </div>
            </div>

          </div>

          <div style={{ borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {/* Table count header */}
            <div style={{ background: 'linear-gradient(90deg, #fff1f2, #ffe4e6)', padding: '8px 16px', borderBottom: '1px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#881337' }}>
                📋 E-SANCHIT DOCUMENT CODE LIST
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {searchTerm ? (
                  <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, background: '#e0f2fe', padding: '2px 10px', borderRadius: '8px' }}>
                    {filteredData.length} of {data.length} records
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: '#fff', fontWeight: 700, background: '#e11d48', padding: '2px 10px', borderRadius: '8px' }}>
                    Total: {data.length} codes
                  </span>
                )}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Document Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Type</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Agency</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 700, textTransform: 'uppercase', fontSize: '11px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((i) => (
                  <tr key={i.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', background: formData.id === i.id ? '#fff1f2' : '#fff', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#ffe4e6', color: '#be123c', border: '1px solid #ef4444', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{i.documentCode}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-main, var(--text-main, #0f172a))', fontWeight: 600, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.description}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))', fontWeight: 600 }}>{i.documentType}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 600 }}>{i.agency}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span onClick={() => handleEdit(i)} style={{ color: 'var(--primary-color-end, #2563eb)', cursor: 'pointer', fontWeight: 600, marginRight: '10px' }}>Edit</span>
                      <span onClick={() => handleSwitch(i)} style={{ color: (i.isActive ? '#b45309' : '#15803d'), cursor: 'pointer', fontWeight: 600 }}>{i.isActive ? 'Switch off' : 'Switch on'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
