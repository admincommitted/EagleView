import React, { useState, useEffect } from 'react';
import { Save, Search, Edit2, Trash2, Home, MapPin, Building2 } from "lucide-react";
import switchRow, { askDelete } from './switchRow';

export default function WarehouseMasterForm() {
  const [warehouses, setWarehouses] = useState([]);
  const [search, setSearch] = useState('');
  
  const initialForm = { id: '', warehouseCode: '', warehouseName: '', linkedPortCode: '', address: '', capacity: '', city: '', state: '', country: 'IN', phone: '', contactPerson: '' };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await fetch('/api/masters/warehouses?all=1');
      const data = await res.json();
      setWarehouses(Array.isArray(data) ? data : []); // an error answer is not a list (it crashed the screen)
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if(!formData.warehouseCode || !formData.warehouseName || !formData.linkedPortCode) {
      alert("Please fill all required fields (Code, Name, Linked Port).");
      return;
    }
    try {
      const url = formData.id ? `/api/masters/warehouses/${formData.id}` : '/api/masters/warehouses';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if(res.ok) {
        setFormData(initialForm);
        fetchWarehouses();
        alert(formData.id ? "Warehouse updated successfully!" : "New Warehouse added successfully!");
      } else {
        const errData = await res.json();
        alert("Failed to save: " + (errData.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Network error: Could not connect to server.");
    }
  };

  const handleEdit = (item) => {
    setFormData(item);
  };
  
  // 22-Nov-2026: a row is switched off (kept as inactive, off the job screens' lists) instead of deleted
  const isOn = (r) => !(r.isActive === false || r.isActive === 0);
  const handleSwitch = async (row) => { if (await switchRow('warehouses', { ...row, isActive: isOn(row) }, 'warehouse ' + (row.warehouseCode || '') + ' ' + (row.warehouseName || ''))) fetchWarehouses(); };

  const handleDelete = async (id) => {
    if (!(await askDelete('Delete this warehouse?'))) return;
    try {
      const res = await fetch(`/api/masters/warehouses/${id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json().catch(() => ({})); return alert('Not deleted: ' + (err.error || ('HTTP ' + res.status))); }
      if (formData && String(formData.id) === String(id)) setFormData(initialForm); fetchWarehouses();
    } catch (err) {
      alert('Not deleted: ' + err.message);
    }
  };

  const filteredData = warehouses.filter(w => 
    w.warehouseName?.toLowerCase().includes(search.toLowerCase()) || 
    w.warehouseCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Left Sidebar for Search & Select */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Search size={16} color="#3b82f6" /> SEARCH 
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', background: '#d1fae5', padding: '2px 8px', borderRadius: '10px', textTransform: 'none', border: '1px solid #a7f3d0' }}>
              {warehouses.length} items
            </span>
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
            {filteredData.map(w => (
              <li 
                key={w.id} 
                onClick={() => handleEdit(w)} 
                onMouseEnter={e => { if (formData.id !== w.id) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { if (formData.id !== w.id) e.currentTarget.style.background = 'transparent'; }}
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid var(--border-color, #cbd5e1)', 
                  cursor: 'pointer', 
                  background: formData.id === w.id ? 'linear-gradient(90deg, #eff6ff 0%, var(--bg-panel, #ffffff) 100%)' : 'transparent', 
                  borderLeft: formData.id === w.id ? '4px solid #3b82f6' : '4px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { if(formData.id !== w.id) e.currentTarget.style.background = 'var(--bg-app, var(--bg-app, #f8fafc))' }}
                onMouseLeave={(e) => { if(formData.id !== w.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '8px', 
                  background: formData.id === w.id ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, var(--border-color, #e2e8f0), var(--border-color, #cbd5e1))', 
                  color: formData.id === w.id ? '#fff' : 'var(--text-muted, var(--text-muted, #64748b))', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  boxShadow: formData.id === w.id ? '0 2px 4px rgba(245,158,11,0.3)' : 'none'
                }}>
                  <Home size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: formData.id === w.id ? 700 : 600, color: formData.id === w.id ? '#b45309' : 'var(--text-main, var(--text-main, #0f172a))', fontSize: '12px' }}>
                    {w.warehouseName}
                  </div>
                  <div style={{ color: formData.id === w.id ? '#f59e0b' : 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '10px', marginTop: '2px', fontWeight: 700 }}>
                    {w.warehouseCode}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

<div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Building2 size={18} /> Add Customs Warehouse
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Customs Warehouse Code</label>
            <input type="text" className="input-field" placeholder="8-digit code" maxLength={8} value={formData.warehouseCode || ""} onChange={e => setFormData({...formData, warehouseCode: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Warehouse Name</label>
            <input type="text" className="input-field" placeholder="Full registered name" value={formData.warehouseName || ""} onChange={e => setFormData({...formData, warehouseName: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Linked Port Code</label>
            <input type="text" className="input-field" placeholder="e.g. INNSA1" value={formData.linkedPortCode || ""} onChange={e => setFormData({...formData, linkedPortCode: e.target.value.toUpperCase()})} maxLength={6} style={{ textTransform: 'uppercase' }} />
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Address</label>
          <input type="text" className="input-field" placeholder="Complete address of the warehouse" value={formData.address || ""} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>City</label>
            <input type="text" className="input-field" placeholder="City" value={formData.city || ""} onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>State</label>
            <input type="text" className="input-field" placeholder="State" value={formData.state || ""} onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Country</label>
            <input type="text" className="input-field" maxLength={2} placeholder="IN" value={formData.country || "IN"} onChange={e => setFormData({...formData, country: e.target.value.toUpperCase()})} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Capacity (SQ.FT / CBM)</label>
            <input type="text" className="input-field" placeholder="e.g. 5000 SQ.FT" value={formData.capacity || ""} onChange={e => setFormData({...formData, capacity: e.target.value.toUpperCase()})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Phone</label>
            <input type="text" className="input-field" placeholder="Phone / Mobile" value={formData.phone || ""} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Contact Person</label>
            <input type="text" className="input-field" placeholder="Contact name" value={formData.contactPerson || ""} onChange={e => setFormData({...formData, contactPerson: e.target.value.toUpperCase()})} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setFormData(initialForm)}>Clear</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={16}/> Save (Ctrl+S)</button>
        </div>

      </div>
      <div className="glass-panel" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Warehouse Directory 
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '2px 10px', borderRadius: '12px', border: '1px solid #bae6fd' }}>Total: {filteredData.length}</span>
          </h3>
          <input type="text" className="input-field" placeholder="Search warehouse..." style={{ width: '200px' }} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead style={{ background: 'linear-gradient(90deg, var(--bg-app, #f8fafc), var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>
              <tr>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, resize: 'none' }}>Warehouse Code</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, resize: 'none' }}>Warehouse Name</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 600, resize: 'none' }}>Linked Port</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, resize: 'none' }}>Address</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, resize: 'none' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '0.75rem 1rem' }}>
        <span style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fcd34d', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>{item.warehouseCode}</span>
    </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: '#1e293b' }}>{item.warehouseName}{item.isActive === false || item.isActive === 0 ? <span style={{ marginLeft: '8px', background: '#fee2e2', color: '#991b1b', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>INACTIVE</span> : null}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                    <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{item.linkedPortCode}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#475569', fontSize: '12px' }}>{item.address || '-'}</td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => handleEdit(item)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#2563eb', fontSize: '12px', fontWeight: 600 }}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={() => handleSwitch(item)} style={{ background: isOn(item) ? '#fffbeb' : '#f0fdf4', border: '1px solid ' + (isOn(item) ? '#fde68a' : '#bbf7d0'), padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: isOn(item) ? '#b45309' : '#15803d', fontSize: '12px', fontWeight: 600 }}>
                        {isOn(item) ? 'Switch off' : 'Switch on'}
                      </button>
                    </div>
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
