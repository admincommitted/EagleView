import React, { useState, useEffect } from 'react';
import { Save, Copy, Search, Edit, Trash2 } from "lucide-react";
import switchRow, { askDelete } from './switchRow';

export default function ItemTemplateMasterForm() {
  const [dataList, setDataList] = useState([]);
  const [formData, setFormData] = useState({ id: null, templateName: '', jobType: 'BE', jsonPayload: '', createdBy: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/masters/itemtemplates?all=1');
      const data = await res.json();
      if (Array.isArray(data)) setDataList(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!formData.templateName) {
      alert("Template Name is required!");
      return;
    }
    if (String(formData.jsonPayload || '').trim()) { try { JSON.parse(formData.jsonPayload); } catch (e) { return alert('JSON Payload is not valid JSON: ' + e.message); } }
    try {
      const url = formData.id ? `/api/masters/itemtemplates/${formData.id}` : '/api/masters/itemtemplates';
      const method = formData.id ? 'PUT' : 'POST';
      const payload = { ...formData };
      if (!payload.id) delete payload.id;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Saved successfully!");
        setFormData({ id: null, templateName: '', jobType: 'BE', jsonPayload: '', createdBy: '' });
        fetchData();
      } else {
        const err = await res.json();
        alert("Error: " + JSON.stringify(err));
      }
    } catch (err) {
      console.error(err);
      alert("Network Error");
    }
  };

  // 22-Nov-2026: a row is switched off (kept as inactive, off the job screens' lists) instead of deleted
  const isOn = (r) => !(r.isActive === false || r.isActive === 0);
  const handleSwitch = async (row) => { if (await switchRow('itemtemplates', { ...row, isActive: isOn(row) }, 'template ' + (row.templateName || ''))) fetchData(); };

  const handleDelete = async (id) => {
    if (!(await askDelete("Are you sure you want to delete this template?"))) return;
    try {
      const res = await fetch(`/api/masters/itemtemplates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        alert("Failed to delete");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredData = dataList.filter(item => 
    item.templateName?.toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="SEARCH..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ marginBottom: '8px' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredData.map(item => (
              <li key={item.id} onClick={() => setFormData(item)} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', cursor: 'pointer', backgroundColor: formData.id === item.id ? '#eff6ff' : 'transparent', transition: 'background-color 0.2s', borderLeft: formData.id === item.id ? '4px solid #3b82f6' : '4px solid transparent' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>{item.templateName}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '4px' }}>{item.jobType}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
          <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--accent-color)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Copy size={18} /> {formData.id ? 'Edit' : 'Add'} Item Template
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Templates allow operators to auto-fill the item grid with a single click, saving time on repetitive entries.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Template Name</label>
                <input type="text" className="input-field" placeholder="e.g. Standard Garments Export" value={formData.templateName} onChange={e => setFormData({...formData, templateName: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Job Type</label>
                <select className="input-field" value={formData.jobType} onChange={e => setFormData({...formData, jobType: e.target.value})}>
                  <option value="BE">Bill of Entry (Import)</option>
                  <option value="SB">Shipping Bill (Export)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>JSON Payload</label>
                <textarea className="input-field" placeholder='{"items": [...]}' rows={5} style={{ fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }} value={formData.jsonPayload || ''} onChange={e => setFormData({...formData, jsonPayload: e.target.value})} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setFormData({ id: null, templateName: '', jobType: 'BE', jsonPayload: '', createdBy: '' })}>Clear</button>
              <button className="btn btn-primary" onClick={handleSave} style={{ background: 'linear-gradient(135deg, var(--accent-color), #059669)' }}><Save size={16}/> Save</button>
            </div>
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Item Templates Directory</h3>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600 }}>Template Name</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600 }}>Job Type</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', opacity: isOn(item) ? 1 : 0.6 }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.templateName}{item.isActive === false || item.isActive === 0 ? <span style={{ marginLeft: '8px', background: '#fee2e2', color: '#991b1b', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>INACTIVE</span> : null}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', background: 'rgba(0,0,0,0.05)', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                          {item.jobType}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button onClick={() => setFormData(item)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginRight: '8px' }}><Edit size={16}/></button>
                        <button onClick={() => handleSwitch(item)} style={{ background: 'none', border: 'none', color: isOn(item) ? '#b45309' : '#15803d', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>{isOn(item) ? 'Switch off' : 'Switch on'}</button>
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
