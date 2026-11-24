import React, { useState, useEffect } from 'react';
import { Save, Plus, Settings } from "lucide-react";

export default function CethMasterForm() {
  const [headers, setHeaders] = useState([]);
  const [selectedHeaderId, setSelectedHeaderId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Header form state
  const [headerForm, setHeaderForm] = useState({ id: null, hsnCode: '', dutyType: 'CUSTOMS', description: '', isGstApplicable: true });
  
  // Detail form state (Duty components)
  const [detailForm, setDetailForm] = useState({ dutyCategory: 'CVD', calculationFlag: 'Advalorem', rate: '', amount: '', uqc: '' });

  const fetchHeaders = async () => {
    try {
      const res = await fetch('/api/masters/tariffheaders/all');
      const data = await res.json();
      setHeaders(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHeaders();
  }, []);

  const handleSelectHeader = (h) => {
    setSelectedHeaderId(h.id);
    setHeaderForm({
      id: h.id,
      hsnCode: h.hsnCode,
      dutyType: h.dutyType || 'CUSTOMS',
      description: h.description || '',
      isGstApplicable: h.isGstApplicable
    });
  };

  const handleNewHeader = () => {
    setSelectedHeaderId('new');
    setHeaderForm({ id: null, hsnCode: '', dutyType: 'CUSTOMS', description: '', isGstApplicable: true });
  };

  const handleSaveHeader = async () => {
    if (!headerForm.hsnCode) {
      alert("CETH/HSN Code is required");
      return;
    }
    try {
      const url = headerForm.id ? `/api/masters/tariffheaders/${headerForm.id}` : '/api/masters/tariffheaders';
      const method = headerForm.id ? 'PUT' : 'POST';
      const payload = { ...headerForm };
      if (!payload.id) delete payload.id;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const saved = await res.json();
        alert("Header saved!");
        await fetchHeaders();
        setSelectedHeaderId(saved.id);
        setHeaderForm(saved);
      } else {
        alert("Failed to save header");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDetail = async () => {
    if (!selectedHeaderId || selectedHeaderId === 'new') {
      alert("Please save the header first!");
      return;
    }
    if (!detailForm.dutyCategory || !detailForm.calculationFlag) {
      alert("Duty Type and Flag are required");
      return;
    }
    try {
      const payload = { ...detailForm, tariffHeaderId: selectedHeaderId };
      const res = await fetch('/api/masters/tariffcomponents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setDetailForm({ dutyCategory: 'CVD', calculationFlag: 'Advalorem', rate: '', amount: '', uqc: '' });
        fetchHeaders();
      } else {
        alert("Failed to add component");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDetail = async (compId) => {
    try {
      const res = await fetch(`/api/masters/tariffcomponents/${compId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHeaders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredHeaders = headers.filter(h => h.hsnCode?.includes(searchTerm));
  const currentHeader = headers.find(h => h.id === selectedHeaderId);
  const currentComponents = currentHeader ? currentHeader.components : [];

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Left Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', backgroundColor: 'var(--bg-panel, var(--bg-panel, #ffffff))', borderRight: '1px solid var(--border-color, #e2e8f0)', zIndex: 10 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '12px' }} onClick={handleNewHeader}>
            <Plus size={16} /> New CETH Entry
          </button>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search CETH..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredHeaders.map(h => (
              <li 
                key={h.id} 
                onClick={() => handleSelectHeader(h)}
                style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', cursor: 'pointer', backgroundColor: selectedHeaderId === h.id ? '#eff6ff' : 'transparent', borderLeft: selectedHeaderId === h.id ? '4px solid #3b82f6' : '4px solid transparent' }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main, var(--text-main, #1e293b))' }}>{h.hsnCode}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted, var(--text-muted, #64748b))', marginTop: '4px' }}>GST: {h.isGstApplicable ? 'Yes' : 'No'} | Duties: {h.components?.length || 0}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* Right Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
          
          {/* Header Form */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', flexShrink: 0 }}>
            <div style={{ background: 'var(--bg-app, var(--bg-app, #f8fafc))', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              <h3 style={{ color: 'var(--text-main, var(--text-main, #1e293b))', margin: 0, fontSize: '14px' }}>CETH Header Details</h3>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '1rem', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>CETH Number *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 01012100" 
                    style={{ borderColor: '#ef4444' }} 
                    value={headerForm.hsnCode}
                    onChange={(e) => setHeaderForm({...headerForm, hsnCode: e.target.value})}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingBottom: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '12px', cursor: 'pointer', margin: 0, fontWeight: 600, color: 'var(--text-main)' }}>
                    <input 
                      type="checkbox" 
                      checked={headerForm.isGstApplicable}
                      onChange={(e) => setHeaderForm({...headerForm, isGstApplicable: e.target.checked})}
                    /> 
                    Is GST Applicable
                  </label>
                </div>
              </div>
            </div>
            
            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-app, var(--bg-app, #f8fafc))' }}>
              <button className="btn btn-primary" onClick={handleSaveHeader} style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                <Save size={16}/> Save CETH Header
              </button>
            </div>
          </div>

          {/* Dynamic Duties Grid */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', flex: 1, display: 'flex', flexDirection: 'column', opacity: (selectedHeaderId && selectedHeaderId !== 'new') ? 1 : 0.5, pointerEvents: (selectedHeaderId && selectedHeaderId !== 'new') ? 'auto' : 'none' }}>
            <div style={{ background: '#f0f9ff', padding: '0.75rem 1rem', borderBottom: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--primary-text, #0369a1)', margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={16} /> Dynamic Duty Components (Tariff Components)
              </h3>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'end', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.015)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Duty Type *</label>
                  <select className="input-field" value={detailForm.dutyCategory} onChange={e => setDetailForm({...detailForm, dutyCategory: e.target.value})}>
                    <option>CVD</option>
                    <option>HEALTH_CESS</option>
                    <option>NCD</option>
                    <option>INFRA_CESS</option>
                    <option>GREEN_CESS</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Flag *</label>
                  <select className="input-field" value={detailForm.calculationFlag} onChange={e => setDetailForm({...detailForm, calculationFlag: e.target.value})}>
                    <option>Advalorem</option>
                    <option>Specific</option>
                    <option>Blank</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Rate (%)</label>
                  <input type="number" step="0.01" className="input-field" value={detailForm.rate} onChange={e => setDetailForm({...detailForm, rate: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Amount (Rs)</label>
                  <input type="number" step="0.01" className="input-field" value={detailForm.amount} onChange={e => setDetailForm({...detailForm, amount: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>UQC</label>
                  <input type="text" className="input-field" value={detailForm.uqc} onChange={e => setDetailForm({...detailForm, uqc: e.target.value})} placeholder="e.g. KGS" />
                </div>
                <div>
                  <button className="btn btn-secondary" onClick={handleAddDetail} style={{ padding: '0.35rem 1rem', height: '28px' }}>+ Add Row</button>
                </div>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid #000000', borderRadius: '6px', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  <thead style={{ background: '#fffbeb' }}>
                    <tr>
                      <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--primary-text, #0369a1)' }}>Duty Type</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--primary-text, #0369a1)' }}>Flag</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary-text, #0369a1)' }}>Rate (%)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary-text, #0369a1)' }}>Amount (Rs)</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--primary-text, #0369a1)' }}>UQC</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--primary-text, #0369a1)' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentComponents.length > 0 ? (
                      currentComponents.map((dtl) => (
                        <tr key={dtl.id} style={{ borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 600 }}>{dtl.dutyCategory}</td>
                          <td style={{ padding: '0.5rem' }}>{dtl.calculationFlag}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{dtl.rate || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{dtl.amount || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>{dtl.uqc || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <span onClick={() => handleDeleteDetail(dtl.id)} style={{ color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>Remove</span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No duty components added yet.
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
    </div>
  );
}
