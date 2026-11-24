import React, { useState, useEffect } from 'react';
import { askDelete } from './switchRow';

export default function IcegateCredentialsForm() {
  const [dataList, setDataList] = useState([]);
  const [formData, setFormData] = useState({ 
    id: null, 
    icegateId: '', icegatePassword: '', icegateApiKey: '', 
    senderEmail: '', senderPop: '', senderSmtp: '', 
    receiverEmail: '' 
  });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      const res = await fetch('/api/masters/systemconfigurations');
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
    if (!formData.icegateId || !formData.senderEmail) {
      alert("ICEGATE ID and Sender Email are required.");
      return;
    }
    try {
      const url = formData.id ? `/api/masters/systemconfigurations/${formData.id}` : '/api/masters/systemconfigurations';
      const method = formData.id ? 'PUT' : 'POST';
      const payload = { ...formData };
      if (!payload.id) delete payload.id;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("Configuration saved!");
        fetchData();
      } else {
        const err = await res.json();
        alert("Error saving: " + JSON.stringify(err));
      }
    } catch (err) {
      console.error(err);
      alert("Network Error");
    }
  };

  const handleDelete = async () => {
    if (!formData.id) return;
    if (!(await askDelete("Delete this configuration?"))) return;
    try {
      const res = await fetch(`/api/masters/systemconfigurations/${formData.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Deleted");
        setFormData({ id: null, icegateId: '', icegatePassword: '', icegateApiKey: '', senderEmail: '', senderPop: '', senderSmtp: '', receiverEmail: '' });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredData = dataList.filter(item => item.icegateId?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Left Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', zIndex: 10 }}>
        <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0' }}>SEARCH CONFIG</h3>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search ICEGATE ID..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredData.map(c => (
              <li 
                key={c.id} 
                onClick={() => setFormData(c)} 
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', cursor: 'pointer', backgroundColor: formData.id === c.id ? '#eff6ff' : 'transparent', borderLeft: formData.id === c.id ? '4px solid #3b82f6' : '4px solid transparent' }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>{c.icegateId}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '4px' }}>{c.senderEmail}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', flexShrink: 0 }}>
            <h3 style={{ color: 'var(--primary-text, #0369a1)', marginBottom: '1rem' }}>ICEGATE & RESOS Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '4px' }}>ICEGATE ID *</label>
                <input type="text" className="input-field" value={formData.icegateId} onChange={e => setFormData({...formData, icegateId: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '4px' }}>ICEGATE Password</label>
                <input type="password" className="input-field" value={formData.icegatePassword} onChange={e => setFormData({...formData, icegatePassword: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '4px' }}>API Key</label>
                <input type="text" className="input-field" value={formData.icegateApiKey} onChange={e => setFormData({...formData, icegateApiKey: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', flexShrink: 0 }}>
            <h3 style={{ color: 'var(--primary-text, #0369a1)', marginBottom: '1rem' }}>Sender Email Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '4px' }}>Sender Email (must be @eagleview360.com)</label>
                <input type="text" className="input-field" value={formData.senderEmail} onChange={e => setFormData({...formData, senderEmail: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '4px' }}>Receiver Email</label>
                <input type="text" className="input-field" value={formData.receiverEmail} onChange={e => setFormData({...formData, receiverEmail: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '4px' }}>POP Server</label>
                <input type="text" className="input-field" value={formData.senderPop} onChange={e => setFormData({...formData, senderPop: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#333', marginBottom: '4px' }}>SMTP Server</label>
                <input type="text" className="input-field" value={formData.senderSmtp} onChange={e => setFormData({...formData, senderSmtp: e.target.value})} />
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
            <button className="btn btn-primary" onClick={handleSave} style={{ background: '#3b82f6', borderColor: '#3b82f6', fontSize: '11px', padding: '0.4rem 1.5rem' }}>Save</button>
            <button className="btn btn-primary" onClick={handleDelete} style={{ background: '#ef4444', borderColor: '#ef4444', fontSize: '11px', padding: '0.4rem 1.5rem' }}>Delete</button>
            <button className="btn btn-secondary" onClick={() => setFormData({ id: null, icegateId: '', icegatePassword: '', icegateApiKey: '', senderEmail: '', senderPop: '', senderSmtp: '', receiverEmail: '' })} style={{ background: 'var(--text-muted, var(--text-muted, #64748b))', borderColor: 'var(--text-muted, var(--text-muted, #64748b))', color: '#fff', fontSize: '11px', padding: '0.4rem 1.5rem' }}>Clear</button>
          </div>
        </div>
      </div>
    </div>
  );
}
