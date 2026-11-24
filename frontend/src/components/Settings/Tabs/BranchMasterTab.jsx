import React, { useState, useEffect } from 'react';
import { Save, Building2, MapPin, Hash, Plus, Trash2, Edit2, CheckCircle, Phone, Mail, Receipt, Globe } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const GSTIN_RX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const STATE_NAME = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
  '09': 'Uttar Pradesh', '10': 'Bihar', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh' };

export default function BranchMasterTab() {
  const [branchList, setBranchList] = useState([]);
  
  const [toastMsg, setToastMsg] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newBranch, setNewBranch] = useState({ branchCode: '', branchName: '', address: '', status: 'Active', isDefault: false, gstin: '', phone: '', email: '', website: '' });

  useEffect(() => {
    fetchBranches();
      window.dispatchEvent(new Event('globalContextUpdated'));
  }, []);

  const fetchBranches = async () => {
    try {
      const res = await axios.get('/api/masters/company-branches');
      if (res.data.success) {
        setBranchList(res.data.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!newBranch.branchCode || !newBranch.branchName) return toast.error('Fill all the required fields (*)');
    
    try {
      if (editingId) {
                await axios.put(`/api/masters/company-branches/${editingId}`, newBranch);
      } else {
                await axios.post('/api/masters/company-branches', newBranch);
      }
      fetchBranches();
      window.dispatchEvent(new Event('globalContextUpdated'));
      setIsAdding(false);
      setToastMsg('Branch saved successfully!'); setTimeout(() => setToastMsg(''), 3000);
      setEditingId(null);
      setNewBranch({ branchCode: '', branchName: '', address: '', status: 'Active', isDefault: false, gstin: '', phone: '', email: '', website: '' });
    } catch(e) {
      toast.error('Not saved: ' + ((e.response && e.response.data && (e.response.data.error || e.response.data.message)) || e.message));
    }
  };

  const handleEdit = (branch) => {
    setNewBranch({ ...branch });
    setEditingId(branch.id);
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this branch?')) return;
    try {
      await axios.delete(`/api/masters/company-branches/${id}`);
      fetchBranches();
      window.dispatchEvent(new Event('globalContextUpdated'));
    } catch(e) { toast.error('Not deleted: ' + ((e.response && e.response.data && (e.response.data.error || e.response.data.message)) || e.message)); }
  };

  return (
    <div style={{ background: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--border-color, #e2e8f0)', minHeight: '500px' }}>
      
      
      {toastMsg && (
        <div style={{ padding: '12px', marginBottom: '16px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', border: '1px solid #000000', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ✓ {toastMsg}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main, var(--text-main, #1e293b))', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={22} color="#3b82f6" />
            Branch Master Configuration
          </h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '0.875rem' }}>Create and manage company branches.</p>
        </div>
        
        {!isAdding && (
          <button 
            onClick={() => { setIsAdding(true); setEditingId(null); setNewBranch({ branchCode: '', branchName: '', address: '', status: 'Active', isDefault: false, gstin: '', phone: '', email: '', website: '' }); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--primary-color-start, #0ea5e9)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Plus size={18} /> ADD NEW BRANCH
          </button>
        )}
      </div>

      {isAdding && (
        <div style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main, var(--text-main, #0f172a))' }}>{editingId ? 'Edit Branch' : 'Create New Branch'}</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '6px' }}>BRANCH CODE *</label>
              <input type="text" value={newBranch.branchCode} onChange={e => setNewBranch({...newBranch, branchCode: e.target.value.toUpperCase()})} placeholder="e.g. MUM" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', textTransform: 'uppercase' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '6px' }}>BRANCH NAME *</label>
              <input type="text" value={newBranch.branchName} onChange={e => setNewBranch({...newBranch, branchName: e.target.value.toUpperCase()})} placeholder="e.g. MUMBAI (HEAD OFFICE)" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', textTransform: 'uppercase' }} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '6px' }}>ADDRESS</label>
              <input type="text" value={newBranch.address || ''} onChange={e => setNewBranch({...newBranch, address: e.target.value})} placeholder="Branch Address" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '6px' }}>STATUS</label>
              <select value={newBranch.status || 'Active'} onChange={e => setNewBranch({...newBranch, status: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', backgroundColor: '#fff' }}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          {/* 07-Nov-2026: branch-wise GST registration and contact details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '6px' }}>GST NO. (GSTIN)</label>
              <input type="text" maxLength={15} value={newBranch.gstin || ''} onChange={e => setNewBranch({ ...newBranch, gstin: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="e.g. 07AAACC1234D1Z5" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid ' + (newBranch.gstin && !GSTIN_RX.test(newBranch.gstin) ? '#dc2626' : 'var(--border-color, #cbd5e1)'), textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.04em' }} />
              <div style={{ fontSize: '11px', marginTop: '4px', color: newBranch.gstin && !GSTIN_RX.test(newBranch.gstin) ? '#dc2626' : 'var(--text-muted, #64748b)' }}>
                {newBranch.gstin && !GSTIN_RX.test(newBranch.gstin) ? 'GSTIN must be 15 characters' : (newBranch.gstin ? 'GST state ' + (STATE_NAME[newBranch.gstin.slice(0, 2)] || newBranch.gstin.slice(0, 2)) : 'Branch GST registration, printed on its invoices')}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '6px' }}>TELEPHONE</label>
              <input type="text" value={newBranch.phone || ''} onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })} placeholder="e.g. +91 11 4567 8900" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)' }} />
              <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted, #64748b)' }}>Several numbers: comma separated</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '6px' }}>E-MAIL</label>
              <input type="text" value={newBranch.email || ''} onChange={e => setNewBranch({ ...newBranch, email: e.target.value })} placeholder="e.g. delhi@company.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)' }} />
              <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted, #64748b)' }}>Several addresses: comma separated</div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)', marginBottom: '6px' }}>WEBSITE</label>
              <input type="text" value={newBranch.website || ''} onChange={e => setNewBranch({ ...newBranch, website: e.target.value.trim() })} placeholder="e.g. www.company.com" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', textTransform: 'none' }} />
              <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted, #64748b)' }}>Printed with the branch address</div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={newBranch.isDefault || false} onChange={e => setNewBranch({...newBranch, isDefault: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #0f172a))' }}>Set as Default Branch (Shows in Top Navigation)</span>
              </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} style={{ padding: '10px 16px', backgroundColor: '#fff', color: 'var(--text-muted, var(--text-muted, #64748b))', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>CANCEL</button>
            <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              <Save size={18} /> {editingId ? 'UPDATE' : 'SAVE'} BRANCH
            </button>
          </div>
        </div>
      )}

      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #cbd5e1)' }}>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>CODE</th>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>BRANCH NAME</th>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>ADDRESS</th>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, #475569)', fontWeight: 'bold' }}>GST NO.</th>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, #475569)', fontWeight: 'bold' }}>CONTACT</th>
              <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>STATUS</th>
              <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {branchList.map((branch) => (
              <tr key={branch.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #0f172a))' }}>{branch.branchCode}</td>
                <td style={{ padding: '12px', color: '#334155', fontWeight: 600 }}>{branch.branchName}</td>
                <td style={{ padding: '12px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{branch.address}</td>
                <td style={{ padding: '12px', fontFamily: 'monospace', color: branch.gstin ? 'var(--text-main, #0f172a)' : '#94a3b8', whiteSpace: 'nowrap' }}>{branch.gstin || 'Not set'}{branch.stateCode ? <div style={{ fontFamily: 'inherit', fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>{branch.stateCode}</div> : null}</td>
                <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                  {branch.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Phone size={12} />{branch.phone}</div>}
                  {branch.email && <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Mail size={12} />{branch.email}</div>}
                  {branch.website && <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Globe size={12} />{branch.website}</div>}
                  {!branch.phone && !branch.email && !branch.website && <span style={{ color: '#94a3b8' }}>Not set</span>}
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: branch.status === 'Active' ? '#dcfce7' : '#fee2e2', color: branch.status === 'Active' ? '#166534' : '#991b1b' }}>
                    {branch.status}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={() => handleEdit(branch)} style={{ padding: '6px', backgroundColor: '#f0f9ff', color: 'var(--primary-text, #0284c7)', border: '1px solid #000000', borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(branch.id)} style={{ padding: '6px', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {branchList.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No branches found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
