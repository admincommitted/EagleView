import React, { useState, useEffect } from 'react';
import { Save, PlusCircle, Settings, FileText, Search, Plus, Trash2 } from 'lucide-react';
import { askDelete } from './switchRow';

export default function HsnRitcMasterForm() {
  const [tariffs, setTariffs] = useState([]);
  const [search, setSearch] = useState('');
  
  // Selection state
  const [selectedTariff, setSelectedTariff] = useState(null); // 'new' or object

  // Form states
  const initialHeaderForm = { id: '', hsnCode: '', dutyType: 'STANDARD', description: '', isGstApplicable: true };
  const [headerForm, setHeaderForm] = useState(initialHeaderForm);
  
  // Components for the currently selected tariff
  const [components, setComponents] = useState([]);
  
  // New Component row state
  const initialComponentRow = { dutyCategory: 'BCD', calculationFlag: 'ADVALOREM', rate: '', amount: '', uqc: '' };
  const [newComponentRow, setNewComponentRow] = useState(initialComponentRow);

  // search on the server (a full tariff has ~12,000 lines; all of them were loaded on every change). 28-Oct-2026
  useEffect(() => {
    const t = setTimeout(() => fetchTariffs(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchTariffs = async () => {
    try {
      const res = await fetch('/api/masters/tariffheaders/all?limit=300' + (search.trim() ? '&q=' + encodeURIComponent(search.trim()) : ''));
      const data = await res.json();
      if (!Array.isArray(data)) { alert('Could not load tariff: ' + (data.error || res.status)); return; }
      setTariffs(data);
      // Re-sync selected tariff components if it was selected
      if(selectedTariff && selectedTariff !== 'new') {
        const updated = data.find(t => t.id === selectedTariff.id);
        if(updated) {
            setSelectedTariff(updated);
            setHeaderForm(updated);
            setComponents(updated.components || []);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectNew = () => {
    setSelectedTariff('new');
    setHeaderForm(initialHeaderForm);
    setComponents([]);
  };

  const handleSelectExisting = (item) => {
    setSelectedTariff(item);
    setHeaderForm(item);
    setComponents(item.components || []);
  };

  const handleSaveHeader = async () => {
    const hsn = String(headerForm.hsnCode || '').replace(/\s/g, '');
    if(!/^\d{8}$/.test(hsn)) return alert('HSN / CTH must be 8 digits');
    try {
      const url = headerForm.id ? `/api/masters/tariffheaders/${headerForm.id}` : '/api/masters/tariffheaders';
      const method = headerForm.id ? 'PUT' : 'POST';
      const { components: _c, ...body } = { ...headerForm, hsnCode: hsn };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if(!res.ok) { const err = await res.json().catch(() => ({})); return alert('Not saved: ' + (err.error || ('HTTP ' + res.status))); }
      if(res.ok) {
        const saved = await res.json();
        if(selectedTariff === 'new') {
            setSelectedTariff(saved); // It now has an ID
            setHeaderForm(saved);
        }
        await fetchTariffs();
        
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleAddComponent = async () => {
    if(!selectedTariff || selectedTariff === 'new' || !headerForm.id) {
        return;
    }
    if(!newComponentRow.dutyCategory || !newComponentRow.calculationFlag) return;
    
    try {
      const payload = { ...newComponentRow, tariffHeaderId: headerForm.id };
      // parse numbers safely
      if (payload.rate === '') payload.rate = 0;
      if (payload.amount === '') payload.amount = 0;

      const res = await fetch('/api/masters/tariffcomponents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(res.ok) {
        setNewComponentRow(initialComponentRow);
        fetchTariffs(); // this re-fetches everything and updates the list
      } else { const err = await res.json().catch(() => ({})); alert('Duty line not added: ' + (err.error || ('HTTP ' + res.status))); }
    } catch(e) {
      alert('Duty line not added: ' + e.message);
    }
  };

  const handleDeleteComponent = async (compId) => {
    if (!(await askDelete('Delete this duty line?'))) return;
    try {
      const res = await fetch(`/api/masters/tariffcomponents/${compId}`, {
        method: 'DELETE'
      });
      if(res.ok) fetchTariffs(); else alert('Not deleted (HTTP ' + res.status + ')');
    } catch(e) {
      alert('Not deleted: ' + e.message);
    }
  };

  // delete the whole tariff line with its duty lines (there was no way to). 28-Oct-2026
  const handleDeleteHeader = async () => {
    if (!headerForm.id) return;
    if (!(await askDelete(`Delete HSN ${headerForm.hsnCode} and all its duty lines?`))) return;
    const res = await fetch(`/api/masters/tariffheaders/${headerForm.id}`, { method: 'DELETE' });
    if (!res.ok) return alert('Not deleted (HTTP ' + res.status + ')');
    setSelectedTariff(null); setHeaderForm(initialHeaderForm); setComponents([]);
    fetchTariffs();
  };

  const filteredData = tariffs; // filtered on the server (HSN or description)

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Sidebar Navigation */}
      <div className="glass-panel" style={{ width: '280px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', boxShadow: '1px 0 4px rgba(0,0,0,0.02)' }}>
        <div style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '16px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <h3 style={{ color: 'var(--primary-text, #0369a1)', margin: 0, fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}>
            <Search size={14} /> Search Tariff / HSN <span style={{ background: '#0284c7', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', marginLeft: 'auto' }}>{filteredData.length}</span>
          </h3>
        </div>
        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
          <input type="text" className="input-field"  placeholder="Search HSN code or description..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', marginBottom: '12px', fontSize: '12px' }} />
          <button onClick={handleSelectNew} className="btn" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: '#fff', border: '1px dashed #94a3b8', color: 'var(--text-muted, var(--text-muted, #475569))', fontSize: '12px', fontWeight: 600, padding: '8px' }}>
            <PlusCircle size={14} /> CREATE NEW TARIFF
          </button>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-input, var(--bg-input, #f1f5f9))' }}>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>HSN CODE</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)' }}>DUTY TYPE</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 100).map((t) => (
                <tr 
                  key={t.id} 
                  onClick={() => handleSelectExisting(t)}
                  style={{ 
                    cursor: 'pointer',
                    background: (selectedTariff && selectedTariff !== 'new' && selectedTariff.id === t.id) ? '#eff6ff' : '#fff',
                    borderLeft: (selectedTariff && selectedTariff !== 'new' && selectedTariff.id === t.id) ? '3px solid #3b82f6' : '3px solid transparent',
                    borderBottom: '1px solid var(--border-color, #cbd5e1)'
                  }}
                >
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))' }}>{t.hsnCode}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{t.dutyType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingBottom: '1rem' }}>
        
        {/* Header Form (Parent) */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div style={{ background: '#f0f9ff', padding: '0.75rem 1rem', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--primary-text, #0369a1)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '13px', fontWeight: 700 }}>
              <FileText size={16} /> TARIFF MASTER
            </h3>
          </div>
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 2fr 1fr', gap: '1rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>HSN CODE *</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. 01012100" 
                  style={{ borderColor: '#ef4444' }}
                  value={headerForm.hsnCode}
                  onChange={e => setHeaderForm({...headerForm, hsnCode: e.target.value})}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>DUTY TYPE</label>
                <select className="input-field" value={headerForm.dutyType} onChange={e => setHeaderForm({...headerForm, dutyType: e.target.value})}>
                  <option value="STANDARD">STANDARD</option>
                  <option value="PREFERENTIAL">PREFERENTIAL</option>
                  <option value="EXEMPT">EXEMPT</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #475569))', marginBottom: '4px' }}>DESCRIPTION</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Commodity Description"
                  value={headerForm.description || ''}
                  onChange={e => setHeaderForm({...headerForm, description: e.target.value})}
                />
              </div>
              <div style={{ paddingBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', cursor: 'pointer', margin: 0, fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))' }}>
                  <input 
                    type="checkbox" 
                    style={{ width: '16px', height: '16px' }}
                    checked={headerForm.isGstApplicable}
                    onChange={e => setHeaderForm({...headerForm, isGstApplicable: e.target.checked})}
                  /> 
                  IS GST APPLICABLE
                </label>
              </div>
            </div>
          </div>
          <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>
              * UNIFIES CTH (BCD) AND CETH (CVD) INTO A SINGLE ENTITY.
            </div>
            {headerForm.id && <button onClick={handleDeleteHeader} className="btn" style={{ background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', padding: '6px 12px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer', marginRight: '8px' }}><Trash2 size={14}/> DELETE</button>}
            <button onClick={handleSaveHeader} className="btn" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 600, fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
              <Save size={16}/> SAVE TARIFF HEADER
            </button>
          </div>
        </div>

        {/* Dynamic Duties Grid (Child) */}
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column', opacity: (!selectedTariff || selectedTariff === 'new') ? 0.6 : 1, pointerEvents: (!selectedTariff || selectedTariff === 'new') ? 'none' : 'auto' }}>
          <div style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: 'var(--text-muted, var(--text-muted, #475569))', margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
              <Settings size={16} /> DUTY RATES OF THIS TARIFF
            </h3>
          </div>
          
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
            
            {/* Add New Duty Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1.5rem', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', padding: '0.75rem', borderRadius: '6px', border: '1px dashed var(--border-color, #cbd5e1)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>DUTY CATEGORY *</label>
                <select className="input-field" value={newComponentRow.dutyCategory} onChange={e => setNewComponentRow({...newComponentRow, dutyCategory: e.target.value})} style={{ borderColor: '#ef4444', fontSize: '11px' }}>
                  <option value="BCD">BCD (Basic Customs Duty)</option>
                  <option value="IGST">IGST (Integrated GST)</option>
                  <option value="SWS">SWS (Social Welfare Surcharge)</option>
                  <option value="AIDC">AIDC (Agri Infra & Dev Cess)</option>
                  <option value="COMP_CESS">COMP_CESS (GST Compensation Cess)</option>
                  <option value="ADD">ADD (Anti-Dumping Duty)</option>
                  <option value="SAFEGUARD">SAFEGUARD (Safeguard Duty)</option>
                  <option value="NCCD">NCCD (National Calamity Contingent Duty)</option>
                  <option value="HEALTH_CESS">HEALTH_CESS (Health Cess)</option>
                  <option value="INFRA_CESS">INFRA_CESS (Infrastructure Cess)</option>
                  <option value="RIC">RIC (Road & Infra Cess)</option>
                  <option value="CVD">CVD (Countervailing Duty)</option>
                  <option value="SAD">SAD (Special Additional Duty)</option>
                  <option value="EXCISE">EXCISE (Central Excise Duty)</option>
                  <option value="PROTECTIVE">PROTECTIVE (Protective Duty)</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>CALCULATION FLAG *</label>
                <select className="input-field" value={newComponentRow.calculationFlag} onChange={e => setNewComponentRow({...newComponentRow, calculationFlag: e.target.value})} style={{ borderColor: '#ef4444' }}>
                  <option value="ADVALOREM">ADVALOREM</option>
                  <option value="SPECIFIC">SPECIFIC</option>
                  <option value="BLANK">BLANK</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>RATE (%)</label>
                <input type="number" step="0.01" className="input-field" placeholder="0.00" value={newComponentRow.rate} onChange={e => setNewComponentRow({...newComponentRow, rate: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>AMOUNT (RS)</label>
                <input type="number" step="0.01" className="input-field" placeholder="0.00" value={newComponentRow.amount} onChange={e => setNewComponentRow({...newComponentRow, amount: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, var(--text-muted, #64748b))', marginBottom: '4px' }}>UQC</label>
                <input type="text" className="input-field" placeholder="E.G. KGS" value={newComponentRow.uqc} onChange={e => setNewComponentRow({...newComponentRow, uqc: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <button onClick={handleAddComponent} className="btn" style={{ padding: '6px 12px', height: '32px', background: '#fff', border: '1px solid var(--border-color, #cbd5e1)', color: 'var(--text-muted, var(--text-muted, #475569))', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>+ ADD ROW</button>
              </div>
            </div>

            {/* Child Data Grid */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '6px', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
                <thead style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>DUTY CATEGORY</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>FLAG</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>RATE (%)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>AMOUNT (RS)</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>UQC</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted, var(--text-muted, #475569))', borderBottom: '2px solid var(--border-color, #e2e8f0)', fontWeight: 700, fontSize: '11px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {components.length > 0 ? (
                    components.map((dtl) => (
                      <tr key={dtl.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)', background: '#fff' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-main, var(--text-main, #0f172a))' }}>{dtl.dutyCategory}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text-muted, var(--text-muted, #475569))' }}>{dtl.calculationFlag}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--primary-text, #0369a1)', fontWeight: 600 }}>{dtl.rate > 0 ? `${dtl.rate}%` : '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--primary-text, #0369a1)', fontWeight: 600 }}>{dtl.amount > 0 ? `₹${dtl.amount}` : '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted, var(--text-muted, #64748b))' }}>{dtl.uqc || '-'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <span onClick={() => handleDeleteComponent(dtl.id)} style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}>Remove</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontWeight: 500, fontSize: '12px' }}>
                        {(!selectedTariff || selectedTariff === 'new') ? 'PLEASE SELECT OR CREATE A TARIFF HEADER FIRST.' : 'NO DUTY COMPONENTS ADDED YET.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
