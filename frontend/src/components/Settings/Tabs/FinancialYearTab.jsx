import React, { useState, useEffect } from 'react';
import { Save, Calendar, Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function FinancialYearTab() {
  const [fyList, setFyList] = useState([]);
  
  const [toastMsg, setToastMsg] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [newFy, setNewFy] = useState({ code: '', name: '', startDate: '', endDate: '', isActive: false, isClosed: false });

  useEffect(() => {
    fetchFYs();
      window.dispatchEvent(new Event('globalContextUpdated'));
  }, []);

  const fetchFYs = async () => {
    try {
      const res = await axios.get('/api/masters/financial-years');
      if (res.data.success) {
        setFyList(res.data.data);
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    if (!newFy.code || !newFy.name || !newFy.startDate || !newFy.endDate) return toast.error('Fill all the required fields (*)');
    
    try {
      if (editingId) {
        await axios.put(`/api/masters/financial-years/${editingId}`, newFy);
      } else {
        await axios.post('/api/masters/financial-years', newFy);
      }
      fetchFYs();
      window.dispatchEvent(new Event('globalContextUpdated'));
      setIsAdding(false);
      setToastMsg('Financial Year saved successfully!'); setTimeout(() => setToastMsg(''), 3000);
      setEditingId(null);
      setNewFy({ code: '', name: '', startDate: '', endDate: '', yearType: 'FINANCIAL', isActive: true, isDefault: false, isClosed: false });
    } catch(e) { toast.error('Not saved: ' + ((e.response && e.response.data && (e.response.data.error || e.response.data.message)) || e.message)); }
  };

  const handleEdit = (fy) => {
    setNewFy({ ...fy });
    setEditingId(fy.id);
    setIsAdding(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this financial year?')) return;
    try {
      await axios.delete(`/api/masters/financial-years/${id}`);
      fetchFYs();
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
            <Calendar size={22} color="#10b981" />
            Financial Year Setup
          </h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '0.875rem' }}>Manage accounting periods and active financial year.</p>
        </div>
        
        {!isAdding && (
          <button 
            onClick={() => { setIsAdding(true); setEditingId(null); setNewFy({ code: '', name: '', startDate: '', endDate: '', yearType: 'FINANCIAL', isActive: true, isDefault: false, isClosed: false }); }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            <Plus size={18} /> CREATE NEW FY
          </button>
        )}
      </div>

      {isAdding && (
        <div style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main, var(--text-main, #0f172a))' }}>{editingId ? 'Edit Financial Year' : 'Create Financial Year'}</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '6px' }}>FY CODE *</label>
              <input type="text" value={newFy.code} onChange={e => setNewFy({...newFy, code: e.target.value.toUpperCase()})} placeholder="e.g. 26-27" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', textTransform: 'uppercase' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '6px' }}>YEAR TYPE *</label>
              <select value={newFy.yearType} onChange={e => {
                const type = e.target.value;
                const currentYear = new Date().getFullYear();
                let sDate = '';
                let eDate = '';
                let newCode = '';
                let newName = '';
                
                if (type === 'FINANCIAL') {
                  sDate = `${currentYear}-04-01`;
                  eDate = `${currentYear + 1}-03-31`;
                  newCode = `${currentYear.toString().slice(-2)}-${(currentYear + 1).toString().slice(-2)}`;
                  newName = `FY ${currentYear}-${currentYear + 1}`;
                } else {
                  sDate = `${currentYear}-01-01`;
                  eDate = `${currentYear}-12-31`;
                  newCode = `${currentYear}`;
                  newName = `CY ${currentYear}`;
                }
                
                setNewFy({...newFy, yearType: type, startDate: sDate, endDate: eDate, code: newCode, name: newName });
              }} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', backgroundColor: '#fff' }}>
                <option value="FINANCIAL">Financial Year (Apr-Mar)</option>
                <option value="CALENDAR">Calendar Year (Jan-Dec)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '6px' }}>YEAR NAME *</label>
              <input type="text" value={newFy.name} onChange={e => setNewFy({...newFy, name: e.target.value})} placeholder="e.g. FY 2026-2027" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)' }} />
            </div>
          </div>
          
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '6px' }}>STATUS</label>
              <select value={newFy.isActive ? 'Active' : 'Inactive'} onChange={e => setNewFy({...newFy, isActive: e.target.value === 'Active'})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', backgroundColor: '#fff' }}>
                <option value="Active">Active (Unlocked)</option>
                <option value="Inactive">Inactive (Locked)</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ padding: '10px', backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', borderRadius: '6px', color: 'var(--text-muted, var(--text-muted, #64748b))', fontSize: '12px', fontWeight: '500' }}>
                <span style={{ color: 'var(--primary-color-start, #0ea5e9)', fontWeight: 'bold' }}>Auto-Generated Period:</span> {newFy.startDate ? `${newFy.startDate} to ${newFy.endDate}` : 'Select Year Type to auto-fill periods'}
              </div>
            </div>
          </div>
          
          <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={newFy.isDefault || false} onChange={e => setNewFy({...newFy, isDefault: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #0f172a))' }}>Set as Default Year (Shows in Top Navigation)</span>
              </label>
          </div>
          
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
              <AlertCircle size={14} /> 
              Setting a new Default Year will override the current default.
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} style={{ padding: '10px 16px', backgroundColor: '#fff', color: 'var(--text-muted, var(--text-muted, #64748b))', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>CANCEL</button>
              <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                <Save size={18} /> {editingId ? 'UPDATE' : 'SAVE'} FY
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-input, var(--bg-input, #f1f5f9))', borderBottom: '2px solid var(--border-color, #cbd5e1)' }}>
              <th style={{ width: '40px' }}></th>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>CODE</th>
              <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>FY NAME</th>
              <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>PERIOD</th>
              <th style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>STATUS</th>
              <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', fontWeight: 'bold' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {fyList.map((fy) => (
              <React.Fragment key={fy.id}>
              <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', backgroundColor: fy.isDefault ? '#f0f9ff' : 'transparent' }}>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <button onClick={() => setExpandedRow(expandedRow === fy.id ? null : fy.id)} style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#3b82f6', fontWeight: 'bold' }}>
                    {expandedRow === fy.id ? '▼' : '▶'}
                  </button>
                </td>
                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                  {fy.code}
                  {fy.isDefault && <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', backgroundColor: 'var(--primary-color-start, #0ea5e9)', color: '#fff' }}>DEFAULT</span>}
                </td>
                <td style={{ padding: '12px', color: '#334155', fontWeight: 600 }}>{fy.name}</td>
                <td style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{fy.startDate} to {fy.endDate}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: fy.isActive ? '#dcfce7' : '#fee2e2', color: fy.isActive ? '#166534' : '#991b1b' }}>
                    {fy.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={() => handleEdit(fy)} style={{ padding: '6px', backgroundColor: '#f0f9ff', color: 'var(--primary-text, #0284c7)', border: '1px solid #000000', borderRadius: '4px', cursor: 'pointer' }}><Edit2 size={14} /></button>
                    {!fy.isActive && (
                      <button onClick={() => handleDelete(fy.id)} style={{ padding: '6px', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    )}
                  </div>
                </td>
              </tr>
              {expandedRow === fy.id && (
                <tr style={{ backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
                  <td colSpan="6" style={{ padding: '20px' }}>
                    <div style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead style={{ backgroundColor: 'var(--primary-bg-light, #e0f2fe)' }}>
                          <tr>
                            <th style={{ padding: '10px', textAlign: 'left' }}>PERIOD</th>
                            <th style={{ padding: '10px', textAlign: 'left' }}>MONTH</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>START DATE</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>END DATE</th>
                            <th style={{ padding: '10px', textAlign: 'center' }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fy.periods && fy.periods.length > 0 ? fy.periods.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                              <td style={{ padding: '10px', fontWeight: 'bold' }}>Period {p.periodNo}</td>
                              <td style={{ padding: '10px' }}>{p.periodName}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>{p.startDate}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>{p.endDate}</td>
                              <td style={{ padding: '10px', textAlign: 'center' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: p.isClosed ? '#fee2e2' : '#dcfce7', color: p.isClosed ? '#991b1b' : '#166534' }}>
                                  {p.isClosed ? 'CLOSED (LOCKED)' : 'OPEN'}
                                </span>
                              </td>
                            </tr>
                          )) : (
                            <tr><td colSpan="5" style={{ padding: '10px', textAlign: 'center' }}>No periods generated.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            {fyList.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No financial years found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
