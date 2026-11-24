import React, { useState, useEffect } from 'react';
import { Search, Save, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import switchRow, { askDelete } from './switchRow';

export default function IataAgentMasterForm() {
  const [activeTab, setActiveTab] = useState('iata');
  const [agents, setAgents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const initialForm = {
    id: '', name: '', iataCode: '', tdsRate: '', tdsRemarks: '', panNumber: '', isDefault: false,
    commission: '', commissionType: 'PERCENT',
    branches: []
  };
  
  const initialBranch = {
    id: '', defaultAddress: false, contactPerson: '', branchName: '', address1: '', address2: '', city: '',
    state: '', country: '', pinCode: '', gstState: '', gstNo: '', fax: '', phone: '', mobile: '',
    website: '', email1: '', email2: '', gstExempted: false
  };

  const [formData, setFormData] = useState(initialForm);
  const [branchForm, setBranchForm] = useState(initialBranch);
  const [editBranchIndex, setEditBranchIndex] = useState(-1);

  const [uiModal, setUiModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  const customAlert = (msg) => {
    let title = 'INFORMATION';
    let type = 'success';
    if(msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('please')) {
        title = 'ERROR';
        type = 'error';
    } else if (msg.toLowerCase().includes('success')) {
        title = 'SUCCESS';
        type = 'success';
    }
    setUiModal({ isOpen: true, title, message: String(msg ?? ''), type });
    setTimeout(() => setUiModal({ isOpen: false, title: '', message: '', type: 'success' }), 3000);
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/masters/iataagents?all=1');
      const data = await res.json();
      const parsedData = (Array.isArray(data) ? data : []).map(a => {
        try { a.branches = JSON.parse(a.branches); } catch(e) { a.branches = []; }
        if (!a.branches) a.branches = [];
        return a;
      });
      setAgents(parsedData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBranchChange = (field, value) => {
    setBranchForm(prev => ({ ...prev, [field]: value }));
  };

  const addBranch = () => {
    if (!branchForm.branchName || !branchForm.address1) {
      return customAlert("Branch Name and Address 1 are mandatory to add an address!");
    }
    const newBranches = [...formData.branches];
    if (editBranchIndex >= 0) {
      newBranches[editBranchIndex] = { ...branchForm };
    } else {
      newBranches.push({ ...branchForm, id: Date.now() });
    }
    setFormData({ ...formData, branches: newBranches });
    setBranchForm({ ...initialBranch });
    setEditBranchIndex(-1);
  };

  const deleteBranch = (idx) => {
    const newBranches = formData.branches.filter((_, i) => i !== idx);
    setFormData({ ...formData, branches: newBranches });
  };

  const handleSave = async () => {
    if (!formData.name) {
      return customAlert('Agent Name is mandatory!');
    }
    // 28-Oct-2026: IATA code (7 digits, or 11 with the CASS / branch part), PAN and TDS rate checked; same code twice blocked
    const code = String(formData.iataCode || '').trim().toUpperCase();
    const digits = code.replace(/[\s/-]/g, '');
    if (code && !/^\d{7}(\d{1,4})?$/.test(digits)) return customAlert('ERROR: IATA code must be 7 digits (or 7 + CASS / branch digits, e.g. 1434567/0012)');
    const pan = String(formData.panNumber || '').trim().toUpperCase();
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return customAlert('ERROR: PAN must be like ABCDE1234F');
    if (formData.tdsRate !== '' && formData.tdsRate != null && (isNaN(Number(formData.tdsRate)) || Number(formData.tdsRate) < 0 || Number(formData.tdsRate) > 100)) return customAlert('ERROR: TDS rate must be a number 0 - 100');
    if (code && (agents || []).some(a => a.id !== formData.id && String(a.iataCode || '').replace(/[\s/-]/g, '').toUpperCase() === digits)) return customAlert('ERROR: Duplicate - another agent already has this IATA code');

    const { createdAt, updatedAt, ...rest } = formData;
    const payload = { ...rest, name: String(formData.name).trim().toUpperCase(), iataCode: code, panNumber: pan, branches: JSON.stringify(formData.branches || []) };
    if (!payload.id) delete payload.id;
    const method = formData.id ? 'PUT' : 'POST';
    const url = payload.id ? `/api/masters/iataagents/${payload.id}` : '/api/masters/iataagents';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        customAlert(`SUCCESS: Agent ${payload.id ? 'Updated' : 'Saved'}!`);
        fetchAgents();
        if(!payload.id) {
          setFormData({ ...initialForm });
          setBranchForm({ ...initialBranch });
        }
      } else {
        customAlert("ERROR: " + (data.error || "Failed to save"));
      }
    } catch (err) {
      customAlert("NETWORK ERROR: Could not reach the server.");
    }
  };

  // 22-Nov-2026: an agent is switched off (kept as inactive, off the AWB screens' lists) instead of deleted
  const isOn = (r) => !(r.isActive === false || r.isActive === 0);
  const handleSwitch = async () => {
    if (!formData.id) return customAlert('Please select an Agent first.');
    const on = isOn(formData);
    if (await switchRow('iataagents', { ...formData, isActive: on }, 'IATA agent ' + (formData.name || ''))) { setFormData(prev => ({ ...prev, isActive: !on })); fetchAgents(); }
  };

  const handleDelete = async () => {
    if (!formData.id) return customAlert('Please select an Agent to delete.');
    if (!(await askDelete('Are you sure you want to delete this agent?'))) return;
    
    try {
      const res = await fetch(`/api/masters/iataagents/${formData.id}`, { method: 'DELETE' });
      if (res.ok) {
        customAlert("SUCCESS: Agent deleted.");
        setFormData({ ...initialForm });
        setBranchForm({ ...initialBranch });
        fetchAgents();
      } else {
        customAlert("ERROR: Failed to delete.");
      }
    } catch (err) {
      customAlert("NETWORK ERROR");
    }
  };

  const filteredAgents = agents.filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(a).some(val => val && String(val).toLowerCase().includes(term));
  });

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Left Sidebar */}
      <div style={{ width: '300px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)', zIndex: 10 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={16} color="#3b82f6" /> SEARCH IATA AGENT
          </h3>
          <input type="text" className="input-field" placeholder="ENTER NAME/CODE..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '8px', fontSize: '11px', textTransform: 'uppercase' }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredAgents.map(a => {
              const isSelected = formData.id === a.id;
              return (
                <li key={a.id} onClick={() => { setFormData(a); setBranchForm({...initialBranch}); setEditBranchIndex(-1); }} style={{ 
                  padding: '12px 16px', borderBottom: '1px solid var(--border-color, #cbd5e1)', cursor: 'pointer',
                  background: isSelected ? '#eff6ff' : 'transparent',
                  borderLeft: isSelected ? '4px solid #3b82f6' : '4px solid transparent',
                  boxShadow: isSelected ? '0 2px 6px rgba(59,130,246,0.15)' : 'none'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: isSelected ? 'var(--primary-color-end, #1d4ed8)' : 'var(--text-main, var(--text-main, #0f172a))' }}>{a.name}{a.isActive === false || a.isActive === 0 ? <span style={{ marginLeft: '8px', background: '#fee2e2', color: '#991b1b', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700 }}>INACTIVE</span> : null}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '4px', fontWeight: 600 }}>CODE: {a.iataCode || 'N/A'}</div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', overflow: 'hidden' }}>
        
        {/* Header Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color, #cbd5e1)', background: '#fff', padding: '0 1rem', paddingTop: '0.5rem', gap: '1rem' }}>
          <div onClick={() => setActiveTab('iata')} style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'iata' ? 'var(--primary-text, #0369a1)' : 'var(--text-muted, var(--text-muted, #64748b))', borderBottom: activeTab === 'iata' ? '3px solid #0ea5e9' : '3px solid transparent' }}>
            IATA AGENT & BRANCHES
          </div>
        </div>

        {/* Scrollable Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* Main Info */}
          <div className="glass-panel" style={{ padding: '0', border: '1px solid var(--border-color, #cbd5e1)' }}>
            <div style={{ background: '#f0f9ff', padding: '6px 12px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: 'var(--primary-text, #0369a1)', fontWeight: 'bold', fontSize: '11px' }}>IATA DETAILS</div>
            <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '100px 1fr 100px 1fr', gap: '8px', alignItems: 'center', fontSize: '11px' }}>
              
              <label style={{ fontWeight: 600 }}>NAME *</label>
              <input type="text" className="input-field" style={{ borderColor: formData.name ? 'var(--border-color, var(--border-color, #cbd5e1))' : '#ef4444', textTransform: 'uppercase' }} value={formData.name || ''} onChange={e => handleInputChange('name', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>IATA CODE</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={formData.iataCode || ''} onChange={e => handleInputChange('iataCode', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>TDS RATE</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={formData.tdsRate || ''} onChange={e => handleInputChange('tdsRate', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>TDS REMARKS</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={formData.tdsRemarks || ''} onChange={e => handleInputChange('tdsRemarks', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>PAN NUMBER</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={formData.panNumber || ''} onChange={e => handleInputChange('panNumber', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>COMMISSION %</label>
              <input type="number" className="input-field" style={{ textTransform: 'uppercase' }} placeholder="E.G. 5.00" value={formData.commission || ''} onChange={e => handleInputChange('commission', e.target.value)} step="0.01" min="0" max="100" />
              
              <label style={{ fontWeight: 600 }}>COMM. TYPE</label>
              <select className="input-field" value={formData.commissionType || 'PERCENT'} onChange={e => handleInputChange('commissionType', e.target.value)}>
                <option value="PERCENT">PERCENT (%)</option>
                <option value="FLAT">FLAT RATE (₹)</option>
                <option value="NIL">NIL / NA</option>
              </select>

              
              <div style={{ gridColumn: 'span 4', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <input type="checkbox" checked={formData.isDefault || false} onChange={e => handleInputChange('isDefault', e.target.checked)} />
                <label style={{ fontWeight: 'bold', color: 'var(--text-main, var(--text-main, #0f172a))' }}>SET AS DEFAULT IATA AGENT</label>
              </div>
            </div>
          </div>

          {/* Branch Entry */}
          <div className="glass-panel" style={{ padding: '0', border: '1px solid var(--border-color, #cbd5e1)' }}>
            <div style={{ background: '#f0f9ff', padding: '6px 12px', borderBottom: '1px solid var(--border-color, #cbd5e1)', color: 'var(--primary-text, #0369a1)', fontWeight: 'bold', fontSize: '11px', display: 'flex', justifyContent: 'space-between' }}>
              <span>ADD / EDIT BRANCH ADDRESS</span>
              <span>
                <button onClick={addBranch} className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '10px', height: '22px', display: 'flex', alignItems: 'center', gap: '4px' }}><PlusCircle size={12}/> {editBranchIndex >= 0 ? 'UPDATE BRANCH' : 'ADD BRANCH'}</button>
              </span>
            </div>
            <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '100px 1fr 100px 1fr 100px 1fr', gap: '8px', alignItems: 'center', fontSize: '11px' }}>
              
              <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={branchForm.defaultAddress || false} onChange={e => handleBranchChange('defaultAddress', e.target.checked)} />
                <label style={{ fontWeight: 600 }}>DEFAULT ADDRESS</label>
              </div>
              
              <label style={{ fontWeight: 600 }}>CONTACT PERSON</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={branchForm.contactPerson || ''} onChange={e => handleBranchChange('contactPerson', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>BRANCH NAME *</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase', borderColor: branchForm.branchName ? 'var(--border-color, var(--border-color, #cbd5e1))' : '#ef4444' }} value={branchForm.branchName || ''} onChange={e => handleBranchChange('branchName', e.target.value.toUpperCase())} />

              <label style={{ fontWeight: 600 }}>ADDRESS 1 *</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase', borderColor: branchForm.address1 ? 'var(--border-color, var(--border-color, #cbd5e1))' : '#ef4444' }} value={branchForm.address1 || ''} onChange={e => handleBranchChange('address1', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>ADDRESS 2</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase', gridColumn: 'span 3' }} value={branchForm.address2 || ''} onChange={e => handleBranchChange('address2', e.target.value.toUpperCase())} />

              <label style={{ fontWeight: 600 }}>CITY</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={branchForm.city || ''} onChange={e => handleBranchChange('city', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>STATE</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={branchForm.state || ''} onChange={e => handleBranchChange('state', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>COUNTRY</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={branchForm.country || ''} onChange={e => handleBranchChange('country', e.target.value.toUpperCase())} />

              <label style={{ fontWeight: 600 }}>PIN CODE</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={branchForm.pinCode || ''} onChange={e => handleBranchChange('pinCode', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>GST STATE</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={branchForm.gstState || ''} onChange={e => handleBranchChange('gstState', e.target.value.toUpperCase())} />
              
              <label style={{ fontWeight: 600 }}>GST NO</label>
              <input type="text" className="input-field" style={{ textTransform: 'uppercase' }} value={branchForm.gstNo || ''} onChange={e => handleBranchChange('gstNo', e.target.value.toUpperCase())} />

              <label style={{ fontWeight: 600 }}>PHONE</label>
              <input type="text" className="input-field" value={branchForm.phone || ''} onChange={e => handleBranchChange('phone', e.target.value)} />
              
              <label style={{ fontWeight: 600 }}>MOBILE</label>
              <input type="text" className="input-field" value={branchForm.mobile || ''} onChange={e => handleBranchChange('mobile', e.target.value)} />
              
              <label style={{ fontWeight: 600 }}>FAX</label>
              <input type="text" className="input-field" value={branchForm.fax || ''} onChange={e => handleBranchChange('fax', e.target.value)} />

              <label style={{ fontWeight: 600 }}>EMAIL 1</label>
              <input type="text" className="input-field" value={branchForm.email1 || ''} onChange={e => handleBranchChange('email1', e.target.value.toLowerCase())} />
              
              <label style={{ fontWeight: 600 }}>EMAIL 2</label>
              <input type="text" className="input-field" value={branchForm.email2 || ''} onChange={e => handleBranchChange('email2', e.target.value.toLowerCase())} />

              <label style={{ fontWeight: 600 }}>WEBSITE</label>
              <input type="text" className="input-field" value={branchForm.website || ''} onChange={e => handleBranchChange('website', e.target.value.toLowerCase())} />

              <div style={{ gridColumn: 'span 6', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <label style={{ fontWeight: 600 }}>GST EXEMPTED</label>
                <input type="checkbox" checked={branchForm.gstExempted || false} onChange={e => handleBranchChange('gstExempted', e.target.checked)} />
              </div>
            </div>
            
            {/* Branches Grid */}
            <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border-color, #cbd5e1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff' }}>
                <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid var(--bg-input, #f1f5f9)' }}>ACTION</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid var(--bg-input, #f1f5f9)' }}>BRANCH NAME</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid var(--bg-input, #f1f5f9)' }}>CONTACT PERSON</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid var(--bg-input, #f1f5f9)' }}>ADDRESS</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>PHONE / EMAIL</th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.branches || []).map((b, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                      <td style={{ padding: '6px 12px', borderRight: '1px solid var(--bg-input, #f1f5f9)', whiteSpace: 'nowrap' }}>
                        <button onClick={() => { setBranchForm(b); setEditBranchIndex(idx); }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', marginRight: '8px' }}><Edit2 size={14}/></button>
                        <button onClick={() => deleteBranch(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14}/></button>
                      </td>
                      <td style={{ padding: '6px 12px', borderRight: '1px solid var(--bg-input, #f1f5f9)', fontWeight: 'bold' }}>{b.branchName} {b.defaultAddress ? <span style={{ background: '#dbeafe', color: 'var(--primary-color-end, #1d4ed8)', padding: '2px 6px', borderRadius: '10px', fontSize: '9px', marginLeft: '4px' }}>DEFAULT</span> : ''}</td>
                      <td style={{ padding: '6px 12px', borderRight: '1px solid var(--bg-input, #f1f5f9)' }}>{b.contactPerson}</td>
                      <td style={{ padding: '6px 12px', borderRight: '1px solid var(--bg-input, #f1f5f9)' }}>{b.address1}, {b.city}</td>
                      <td style={{ padding: '6px 12px' }}>{b.phone || b.mobile} / {b.email1}</td>
                    </tr>
                  ))}
                  {(!formData.branches || formData.branches.length === 0) && (
                    <tr>
                      <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No branches added yet. Add a branch above.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
          
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '0.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border-color)', background: '#f0f9ff' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', padding: '4px 12px', background: '#e0f2fe', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#334155', fontWeight: 600 }}>Entered By</span><span style={{fontWeight: 'bold'}}>ADMIN</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#334155', fontWeight: 600 }}>Entered Date</span><span style={{fontWeight: 'bold'}}>{new Date().toISOString().split('T')[0]}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#334155', fontWeight: 600 }}>Modified By</span><span style={{fontWeight: 'bold'}}>ADMIN</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#334155', fontWeight: 600 }}>Modified Date</span><span style={{fontWeight: 'bold'}}>{new Date().toISOString().split('T')[0]}</span></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
            <button className="btn" onClick={handleSave} style={{ padding: '0.3rem 1.5rem', fontSize: '11px', fontWeight: 'bold', background: '#10b981', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }}><Save size={14}/> Save / Modify</button>
            <button className="btn" onClick={handleSwitch} title="The agent is not deleted: switched off, it stays in this master and is left out of the AWB screens' lists" style={{ padding: '0.3rem 1.5rem', fontSize: '11px', fontWeight: 'bold', background: isOn(formData) ? '#d97706' : '#15803d', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }}>{isOn(formData) ? 'Switch off' : 'Switch on'}</button>
            <button className="btn" onClick={() => { setFormData({...initialForm}); setBranchForm({...initialBranch}); setEditBranchIndex(-1); }} style={{ padding: '0.3rem 1.5rem', fontSize: '11px', fontWeight: 'bold', background: '#3b82f6', color: 'var(--bg-panel, var(--bg-panel, #ffffff))', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '4px', cursor: 'pointer' }}>Clear</button>
          </div>
        </div>

      </div>

      {uiModal.isOpen && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '1.5rem', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center' }}>
            <h3 style={{ color: uiModal.type === 'error' ? '#ef4444' : '#22c55e', margin: '0 0 1rem 0' }}>{uiModal.title}</h3>
            <p style={{ margin: '0 0 1.5rem 0', color: '#334155', fontWeight: 500 }}>{uiModal.message}</p>
          </div>
        </div>
      )}

    </div>
  );
}
