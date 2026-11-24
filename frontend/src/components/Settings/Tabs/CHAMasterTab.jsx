import React, { useState, useEffect } from 'react';
import { Save, Building, Plus, Trash2, Edit2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function CHAMasterTab() {
  const [chaList, setChaList] = useState([]);
  
  const [toastMsg, setToastMsg] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newCha, setNewCha] = useState({ chaCode: '', chaLicense: '', chaName: '', chaAddress: '', chaCity: '', chaPin: '', chaGstin: '', chaPhone: '', chaEmail: '', isDefault: false });

  useEffect(() => {
    fetchCHAs();
  }, []);

  const fetchCHAs = async () => {
    try {
      const res = await axios.get('/api/masters/cha-master');
      if (res.data.success) setChaList(res.data.data);
    } catch (e) { console.error(e); }
  };

  const handleAdd = async () => {
    if (!newCha.chaCode || !newCha.chaName) return toast.error('Fill all the required fields (*)');
    try {
      if (editingId) {
        await axios.put(`/api/masters/cha-master/${editingId}`, newCha);
      } else {
        await axios.post('/api/masters/cha-master', newCha);
      }
      fetchCHAs();
      setIsAdding(false);
      setToastMsg('CHA Profile saved successfully!'); setTimeout(() => setToastMsg(''), 3000);
      setEditingId(null);
      setNewCha({ chaCode: '', chaLicense: '', chaName: '', chaAddress: '', chaCity: '', chaPin: '', chaGstin: '', chaPhone: '', chaEmail: '', isDefault: false });
    } catch(e) { toast.error('Not saved: ' + ((e.response && e.response.data && (e.response.data.error || e.response.data.message)) || e.message)); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this CHA?')) return;
    try {
      await axios.delete(`/api/masters/cha-master/${id}`);
      fetchCHAs();
    } catch(e) { toast.error('Not deleted: ' + ((e.response && e.response.data && (e.response.data.error || e.response.data.message)) || e.message)); }
  };

  return (
    <div style={{ background: 'var(--bg-panel, #ffffff)', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--border-color, #e2e8f0)', minHeight: '500px' }}>
      
      {toastMsg && (
        <div style={{ padding: '12px', marginBottom: '16px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', border: '1px solid #000000', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ✓ {toastMsg}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={22} color="var(--primary-color-start, #0ea5e9)" />
            CHA Master Database
          </h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted, #64748b)', fontSize: '0.875rem' }}>Manage Custom House Agents profiles and licenses.</p>
        </div>
        {!isAdding && (
          <button onClick={() => { setIsAdding(true); setEditingId(null); setNewCha({ chaCode: '', chaLicense: '', chaName: '', chaAddress: '', chaCity: '', chaPin: '', chaGstin: '', chaPhone: '', chaEmail: '', isDefault: false }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--primary-color-start, #0ea5e9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            <Plus size={18} /> ADD NEW CHA
          </button>
        )}
      </div>

      {isAdding && (
        <div style={{ background: 'var(--bg-app, #f8fafc)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main, #0f172a)' }}>{editingId ? 'Edit CHA' : 'Create New CHA Profile'}</h4>

          {/* Row 1: Code, License, Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>CHA CODE *</label>
              <input type="text" value={newCha.chaCode} onChange={e => setNewCha({...newCha, chaCode: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>LICENSE NO.</label>
              <input type="text" value={newCha.chaLicense} onChange={e => setNewCha({...newCha, chaLicense: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>CHA NAME *</label>
              <input type="text" value={newCha.chaName} onChange={e => setNewCha({...newCha, chaName: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Row 2: Address, City, PIN */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>REGISTERED ADDRESS</label>
              <input type="text" value={newCha.chaAddress} onChange={e => setNewCha({...newCha, chaAddress: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>CITY</label>
              <input type="text" value={newCha.chaCity || ''} onChange={e => setNewCha({...newCha, chaCity: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>PIN CODE</label>
              <input type="text" value={newCha.chaPin || ''} onChange={e => setNewCha({...newCha, chaPin: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Row 3: GSTIN, Phone, Email */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>GSTIN</label>
              <input type="text" value={newCha.chaGstin || ''} onChange={e => setNewCha({...newCha, chaGstin: e.target.value.toUpperCase()})} placeholder="15-digit GSTIN" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'monospace' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>PHONE</label>
              <input type="text" value={newCha.chaPhone || ''} onChange={e => setNewCha({...newCha, chaPhone: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '4px' }}>EMAIL</label>
              <input type="email" value={newCha.chaEmail || ''} onChange={e => setNewCha({...newCha, chaEmail: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={newCha.isDefault || false} onChange={e => setNewCha({...newCha, isDefault: e.target.checked})} style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)' }}>Set as Default CHA</span>
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} style={{ padding: '10px 16px', backgroundColor: '#fff', color: 'var(--text-muted, #64748b)', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>CANCEL</button>
              <button onClick={handleAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--primary-color-start, #0ea5e9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                <Save size={18} /> {editingId ? 'UPDATE' : 'SAVE'} CHA
              </button>
            </div>
          </div>
        </div>
      )}



      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #cbd5e1)' }}>
            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>CODE</th>
            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>NAME & LICENSE</th>
            <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>ADDRESS</th>
            <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {chaList.map((cha) => (
            <tr key={cha.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', backgroundColor: cha.isDefault ? '#f0f9ff' : 'transparent' }}>
              <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                {cha.chaCode}
                {cha.isDefault && <div style={{ fontSize: '10px', color: 'var(--primary-text, #0284c7)', marginTop: '2px' }}>DEFAULT</div>}
              </td>
              <td style={{ padding: '12px' }}>
                <div style={{ color: '#334155', fontWeight: 600 }}>{cha.chaName}</div>
                <div style={{ color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '11px', marginTop: '2px' }}>LIC: {cha.chaLicense}</div>
              </td>
              <td style={{ padding: '12px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{cha.chaAddress}</td>
              <td style={{ padding: '12px', textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button onClick={() => { setNewCha({...cha}); setEditingId(cha.id); setIsAdding(true); }} style={{ padding: '6px', backgroundColor: '#f0f9ff', color: 'var(--primary-text, #0284c7)', border: '1px solid #000000', borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(cha.id)} style={{ padding: '6px', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
          {chaList.length === 0 && (
            <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No CHA profiles found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
