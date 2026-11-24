
import React, { useState, useEffect } from 'react';
import { Save, Anchor, Search, Edit2, Trash2, Plane, Building } from "lucide-react";
import switchRow from './switchRow';

export default function PortMasterForm() {
  const [ports, setPorts] = useState([]);
  const [search, setSearch] = useState('');
  // 28-Oct-2026: Port Name, Country, Category, SEZ, CHA Name, Active were not linked to the form and Save / Clear
  // had no click handler, so nothing could be saved from this screen.
  const EMPTY_PORT = { id: '', portCode: '', portName: '', country: 'IN', category: 'AIR', isSez: false, chaCode: '', chaName: '', division: 'BOTH (IMP/EXP)', isActive: true };
  const [formData, setFormData] = useState(EMPTY_PORT);
  const [listSearch, setListSearch] = useState('');

  useEffect(() => {
    fetchPorts();
  }, []);

  const fetchPorts = async () => {
    try {
      const res = await fetch('/api/masters/ports?all=1'); // inactive ones too, so they can be re-activated
      const data = await res.json();
      setPorts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if(!formData.portCode || !formData.portName) return alert('Port code and port name are required');
    if(!/^[A-Z]{2}[A-Z0-9]{3,4}$/.test(String(formData.portCode).trim())) return alert('Port code: 2-letter country + location, e.g. INDEL4, INNSA1');
    try {
      const url = formData.id ? `/api/masters/ports/${formData.id}` : '/api/masters/ports';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(EMPTY_PORT);
        fetchPorts();
      } else { const err = await res.json().catch(() => ({})); alert('Not saved: ' + (err.error || ('HTTP ' + res.status))); }
    } catch (err) {
      alert('Not saved: ' + err.message);
    }
  };

  const handleEdit = (port) => {
    // old rows keep the country as "INDIA (IN)": take the code
    const m = /\(([A-Z]{2})\)/.exec(String(port.country || ''));
    setFormData({ ...EMPTY_PORT, ...port, country: m ? m[1] : (port.country || 'IN'), category: String(port.category || 'AIR').toUpperCase() });
  };
  
  // 22-Nov-2026: a row is switched off / on, not deleted (it stays in the master as inactive)
  const handleSwitch = async (row) => {
    const done = await switchRow('ports', row, 'port ' + (row.portCode || '') + ' ' + (row.portName || ''));
    if (done) { if (String(formData.id) === String(row.id)) setFormData(EMPTY_PORT); fetchPorts(); }
  };

  const q = (search || listSearch).toLowerCase();
  const filteredPorts = ports.filter(p => 
    p.portCode?.toLowerCase().includes(q) || 
    p.portName?.toLowerCase().includes(q) ||
    p.chaCode?.toLowerCase().includes(q)
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
            {filteredPorts.map(port => (<li 
              key={port.id} 
              onClick={() => handleEdit(port)} 
              style={{ 
                padding: '12px 16px', 
                borderBottom: '1px solid var(--border-color, #cbd5e1)', 
                cursor: 'pointer', 
                background: formData.id === port.id ? 'linear-gradient(90deg, #eff6ff 0%, var(--bg-panel, #ffffff) 100%)' : 'transparent', 
                borderLeft: formData.id === port.id ? '4px solid #3b82f6' : '4px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { if(formData.id !== port.id) e.currentTarget.style.background = 'var(--bg-app, var(--bg-app, #f8fafc))' }}
              onMouseLeave={(e) => { if(formData.id !== port.id) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ 
                width: '32px', height: '32px', borderRadius: '8px', 
                background: formData.id === port.id ? 'linear-gradient(135deg, #0284c7, #2563eb)' : 'linear-gradient(135deg, var(--border-color, #e2e8f0), var(--border-color, #cbd5e1))', 
                color: formData.id === port.id ? '#fff' : 'var(--text-muted, var(--text-muted, #64748b))', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontWeight: 700, fontSize: '10px', boxShadow: formData.id === port.id ? '0 2px 4px rgba(59,130,246,0.3)' : 'none'
              }}>
                {port.category === 'AIR' ? <Plane size={16} /> : port.category === 'SEA' ? <Anchor size={16} /> : <Building size={16} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: formData.id === port.id ? 700 : 600, color: formData.id === port.id ? '#1e40af' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>
                  {port.portName}
                </div>
                <div style={{ color: formData.id === port.id ? '#3b82f6' : 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px', marginTop: '2px', fontWeight: 700 }}>
                  {port.portCode} &bull; {port.category}
                </div>
              </div>
            </li>))}
          </ul>
        </div>
      </div>
      
      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}><span style={{ width: '8px', height: '18px', background: 'linear-gradient(to bottom, #0284c7, #38bdf8)', borderRadius: '4px' }}></span><Anchor size={18} color="var(--primary-text, #0284c7)" /> UNIFIED PORT & CHA REGISTRATION MASTER</h3>
        
        <div style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Core Port Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Port Code *</label>
              <input type="text" className="input-field" placeholder="e.g. INDEL4" value={formData.portCode} onChange={e => setFormData({...formData, portCode: e.target.value.toUpperCase()})} maxLength={6} style={{ textTransform: 'uppercase', borderColor: '#ef4444', fontWeight: 600 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Port Name *</label>
              <input type="text" className="input-field" placeholder="Full port name (e.g. ACC, New Delhi)" style={{ borderColor: '#ef4444' }} value={formData.portName || ''} onChange={e => setFormData({...formData, portName: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Country *</label>
              <select className="input-field" style={{ borderColor: '#ef4444' }} value={formData.country || 'IN'} onChange={e => setFormData({...formData, country: e.target.value})}>
                <option value="IN">India (IN)</option>
                <option value="AE">United Arab Emirates (AE)</option>
                <option value="US">United States (US)</option>
                <option value="GB">United Kingdom (GB)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Port Category *</label>
              <select className="input-field" style={{ borderColor: '#ef4444' }} value={formData.category || 'AIR'} onChange={e => setFormData({...formData, category: e.target.value})}>
                <option value="AIR">Air</option>
                <option value="SEA">Sea</option>
                <option value="ICD">ICD / CFS</option>
                <option value="LAND">Land</option>
                <option value="BORDER">Border</option>
                <option value="RAILWAYS">Railways</option>
                <option value="SEZ">SEZ</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', cursor: 'pointer', margin: 0, fontWeight: 600, color: 'var(--text-main)' }}>
                <input type="checkbox" checked={!!formData.isSez} onChange={e => setFormData({...formData, isSez: e.target.checked})} /> Is SEZ Port
              </label>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>CHA Registration & Operations</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>CHA Code</label>
              <input type="text" className="input-field" placeholder="e.g. 11/XXXX" value={formData.chaCode} onChange={e => setFormData({...formData, chaCode: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>CHA Name (Company)</label>
              <input type="text" className="input-field" placeholder="Official broker name" value={formData.chaName || ''} onChange={e => setFormData({...formData, chaName: e.target.value.toUpperCase()})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Division</label>
              <select className="input-field" value={formData.division} onChange={e => setFormData({...formData, division: e.target.value})}>
                <option value="BOTH (IMP/EXP)">Both (Imp/Exp)</option>
                <option value="IMPORT">Import Only</option>
                <option value="EXPORT">Export Only</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', cursor: 'pointer', margin: 0, fontWeight: 600, color: 'var(--text-main)' }}>
                <input type="checkbox" checked={formData.isActive !== false} onChange={e => setFormData({...formData, isActive: e.target.checked})} /> Is Active
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
             * The CHA code and name saved here go into the filing files for this port.
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => setFormData(EMPTY_PORT)}>Clear</button>
            <button className="btn btn-primary" onClick={handleSave} style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}><Save size={16}/> {formData.id ? 'Update Port' : 'Save Port'}</button>
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: 'var(--primary-text, #0369a1)', margin: 0 }}>Registered Ports</h3>
          <input type="text" className="input-field" placeholder="Search ports..." style={{ width: '200px' }} value={listSearch} onChange={e => setListSearch(e.target.value)} />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #000000', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)', position: 'sticky', top: 0 }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--primary-text, #0369a1)' }}>Port Code</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--primary-text, #0369a1)' }}>Port Name</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--primary-text, #0369a1)' }}>Category</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--primary-text, #0369a1)' }}>SEZ</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--primary-text, #0369a1)' }}>CHA Details</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--primary-text, #0369a1)' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPorts.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)' }} className="hover-row">
                  <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ 
                        background: '#f0fdf4', color: '#16a34a', border: '1px solid #000000', 
                        padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px'
                      }}>
                        {item.portCode}
                      </span>
                    </td>
                  <td style={{ padding: '0.75rem 1rem' }}>{item.portName}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <span style={{ padding: '3px 8px', background: '#e0f2fe', color: 'var(--primary-text, #0369a1)', borderRadius: '6px', fontSize: '10px', fontWeight: 700, border: '1px solid #000000' }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    {item.isSez ? <span style={{ color: '#059669', fontWeight: 600 }}>Yes</span> : <span style={{ color: 'var(--text-muted)' }}>No</span>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.chaCode || '-'}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{item.chaName || ''}</div>
                    </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}><span onClick={() => handleEdit(item)} style={{ color: "var(--primary-color-end, #2563eb)", cursor: "pointer", fontWeight: 600 }}>Edit</span> <span onClick={() => handleSwitch(item)} style={{ color: (item.isActive ? '#b45309' : '#15803d'), cursor: "pointer", fontWeight: 600 }}>{item.isActive ? 'Switch off' : 'Switch on'}</span></div>
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
