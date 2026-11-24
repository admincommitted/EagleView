import React, { useState, useEffect } from 'react';
import { Save, Trash2, RefreshCw, Plus, Search, HelpCircle } from 'lucide-react';
import { askDelete } from './switchRow';

export default function StatusMasterForm() {
  const [statuses, setStatuses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const initialForm = {
    code: '',
    description: '',
    macroBucket: 'DRAFT',
    colorCode: '#e2e8f0',
    textColor: '#1e293b',
    module: 'IMPORT',
    sequence: 0,
    disables: '',
    enables: '',
    bubbleStyle: 'LEFT_BORDER'
  };

  const [formData, setFormData] = useState(initialForm);
  // 28-Oct-2026: code of the status picked from the list (null = new status); a new status with a code that
  // already exists is refused instead of overwriting that status
  const [editingCode, setEditingCode] = useState(null);

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/status-master');
      if (!res.ok) throw new Error('Failed to fetch statuses');
      const data = await res.json();
      setStatuses(data.data || []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.code) {
      alert("Code is required");
      return;
    }
    if (!/^[A-Z0-9_]{2,40}$/.test(formData.code.trim().toUpperCase())) return alert('Code: 2-40 letters, digits or _ (e.g. EXAM_SCHEDULED)');
    try {
      setLoading(true);
      const res = await fetch(editingCode ? `/api/status-master/${encodeURIComponent(editingCode)}` : '/api/status-master', {
        method: editingCode ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: formData.code.trim().toUpperCase(),
          mode: editingCode ? 'update' : 'create',
          description: formData.description,
          macroBucket: formData.macroBucket,
          colorCode: formData.colorCode,
          textColor: formData.textColor,
          module: formData.module,
          sequence: formData.sequence || 0,
          disables: formData.disables || '',
          enables: formData.enables || '',
          bubbleStyle: formData.bubbleStyle || 'LEFT_BORDER'
        })
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.message || 'Failed to save status');
      await fetchStatuses();
      setEditingCode(out.data ? out.data.code : formData.code.trim().toUpperCase());
      alert('Saved successfully!');
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.code) return;
    if (!(await askDelete(`Are you sure you want to delete status ${formData.code}?`))) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/status-master/${encodeURIComponent(formData.code)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete status');
      await fetchStatuses();
      setFormData(initialForm);
      setEditingCode(null);
      alert('Deleted successfully!');
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: name === 'code' ? value.toUpperCase() : value
      };
      if (name === 'module') {
        updated.macroBucket = 'DRAFT';
      }
      return updated;
    });
  };

  const clearForm = () => { setFormData(initialForm); setEditingCode(null); };

  const filteredStatuses = statuses.filter(s => 
    s.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '100%' }}>
      {/* Left Sidebar */}
      <div className="glass-panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden', backgroundColor: 'var(--bg-panel, #ffffff)', borderRight: '1px solid var(--border-color, #e2e8f0)', zIndex: 10 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main, #0f172a)' }}>
            <Search size={16} color="#3b82f6" /> STATUS LIST
          </h3>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Search..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && statuses.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>Loading...</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {filteredStatuses.map(status => (
                <li 
                  key={status.code} 
                  onClick={() => { setFormData({ ...initialForm, ...status, disables: status.disables || '', enables: status.enables || '' }); setEditingCode(status.code); }}
                  style={{ 
                    padding: '12px 16px', 
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: formData.code === status.code ? '#f0f9ff' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{status.code}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{status.module}</span>
                    <span style={{
                      backgroundColor: status.colorCode || '#e2e8f0',
                      color: status.textColor || '#1e293b',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {status.macroBucket}
                    </span>
                  </div>
                </li>
              ))}
              {filteredStatuses.length === 0 && !loading && (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>No statuses found.</div>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', paddingBottom: '100px' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              {editingCode ? 'Edit Status' : 'Create New Status'}
            </h2>
            <button onClick={clearForm} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', border: 'none', color: '#475569', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>
              <Plus size={14} /> New
            </button>
          </div>

          <div style={{ background: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: '12px 16px', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#1e40af', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={16} /> Smart Logic Rules
            </h4>
            <div style={{ fontSize: '12px', color: '#334155', display: 'grid', gap: '6px' }}>
              <div><strong>Order Sequence:</strong> Define the display order in the timeline dropdown (e.g. 10, 20).</div>
              <div><strong>Disables Statuses:</strong> Comma-separated codes to HIDE once this status is reached (e.g. <code>DUTY PENDING</code>).</div>
              <div><strong>Enables Statuses:</strong> Comma-separated exceptions to SHOW once this status is reached (e.g. <code>INTEREST PENDING</code>).</div>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px', borderRadius: '4px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top Grid: Basic Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Code <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="code" className="input-field" value={formData.code} onChange={handleChange} readOnly={!!editingCode} title={editingCode ? 'Code cannot be changed - jobs use it. Use New for another status.' : ''} placeholder="e.g. EXAM_SCHEDULED" style={{ width: '100%', background: editingCode ? 'var(--bg-input, #f1f5f9)' : undefined }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Module</label>
                <select name="module" className="input-field" value={formData.module} onChange={handleChange} style={{ width: '100%' }}>
                  <option value="IMPORT">IMPORT</option>
                  <option value="EXPORT">EXPORT</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Macro Bucket</label>
                <select name="macroBucket" className="input-field" value={formData.macroBucket} onChange={handleChange} style={{ width: '100%' }}>
                  {formData.module === 'EXPORT' ? (
                    <>
                      <option value="DRAFT">DRAFT</option>
                      <option value="TD_DONE">TD_DONE</option>
                      <option value="XRAY_DONE">XRAY_DONE</option>
                      <option value="LEO">LEO</option>
                    </>
                  ) : (
                    <>
                      <option value="DRAFT">DRAFT</option>
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="QUERY_RAISED">QUERY_RAISED</option>
                      <option value="OOC">OOC</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Description</label>
                <input type="text" name="description" className="input-field" value={formData.description} onChange={handleChange} placeholder="Brief description..." style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Order Sequence</label>
                <input name="sequence" type="number" value={formData.sequence || ''} onChange={handleChange} className="input-field" placeholder="e.g. 10" style={{ width: '100%' }} />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Bubble Design</label>
                <select name="bubbleStyle" className="input-field" value={formData.bubbleStyle || 'LEFT_BORDER'} onChange={handleChange} style={{ width: '100%' }}>
                  <option value="LEFT_BORDER">Classic (Left Border)</option>
                  <option value="SOLID">Solid Background</option>
                  <option value="OUTLINE">Minimal Outline</option>
                  <option value="GLOW">Neon Glow</option>
                  <option value="DASHED">Dashed Outline</option>
                  <option value="GRADIENT">Gradient Fill</option>
                  <option value="BOTTOM_BORDER">Bottom Border</option>
                  <option value="SOFT_SHADOW">Soft Shadow Card</option>
                  <option value="PILL">Pill Shape</option>
                  <option value="GLASSMORPHISM">Frosted Glass</option>
                  <option value="MATERIAL_ACCENT">Material Accent</option>
                  <option value="NEUMORPHISM">3D Raised</option>
                  <option value="FOLDED_RIBBON">Folded Ribbon</option>
                  <option value="HOLLOW_NEON">Dark Hollow Neon</option>
                </select>
              </div>
            </div>

            {/* Colors and Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Background Color</label>
                  <input type="color" name="colorCode" value={formData.colorCode || '#ffffff'} onChange={handleChange} style={{ width: '100%', height: '36px', padding: '0', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>Text Color</label>
                  <input type="color" name="textColor" value={formData.textColor || '#000000'} onChange={handleChange} style={{ width: '100%', height: '36px', padding: '0', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '1px dashed #cbd5e1', paddingLeft: '1.5rem', width: '100%' }}>
                
                {/* 1. Dashboard Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Dashboard Preview</div>
                  <div style={{
                    background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Job #12345</div>
                      <span style={{
                        backgroundColor: formData.colorCode || '#e2e8f0',
                        color: formData.textColor || '#1e293b',
                        padding: '2px 6px', borderRadius: '12px', fontSize: '9px', fontWeight: 'bold'
                      }}>
                        {formData.code || 'STATUS_CODE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Timeline Bubble Preview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Timeline Bubble Preview</div>
                  
                  {(() => {
                    const styleType = formData.bubbleStyle || 'LEFT_BORDER';
                    let dynStyle = {
                      background: formData.colorCode || '#e0f2fe',
                      padding: '8px 12px', borderRadius: '8px', borderBottomLeftRadius: '2px',
                      border: '1px solid', borderColor: `${formData.textColor || '#334155'}30`,
                      borderLeft: `4px solid ${formData.textColor || '#0284c7'}`,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      alignSelf: 'flex-start', width: '90%', position: 'relative'
                    };
                    let textC = formData.textColor || '#0f172a';
                    
                    if (styleType === 'SOLID') {
                      dynStyle.background = formData.colorCode || '#3b82f6';
                      dynStyle.borderLeft = 'none'; dynStyle.border = 'none';
                      textC = formData.textColor || '#ffffff';
                    } else if (styleType === 'OUTLINE') {
                      dynStyle.background = 'transparent';
                      dynStyle.borderLeft = 'none'; dynStyle.border = `2px solid ${formData.colorCode || '#3b82f6'}`;
                      textC = formData.textColor || '#0f172a';
                    } else if (styleType === 'GLOW') {
                      dynStyle.background = formData.colorCode || '#000000';
                      dynStyle.borderLeft = 'none'; dynStyle.border = 'none';
                      dynStyle.boxShadow = `0 0 10px ${formData.textColor || '#38bdf8'}`;
                      textC = formData.textColor || '#ffffff';
                    } else if (styleType === 'DASHED') {
                      dynStyle.background = 'transparent';
                      dynStyle.borderLeft = 'none'; dynStyle.border = `2px dashed ${formData.colorCode || '#3b82f6'}`;
                      textC = formData.textColor || '#0f172a';
                    } else if (styleType === 'GRADIENT') {
                      dynStyle.background = `linear-gradient(135deg, ${formData.colorCode || '#3b82f6'}, ${formData.colorCode || '#3b82f6'}80)`;
                      dynStyle.borderLeft = 'none'; dynStyle.border = 'none';
                      textC = formData.textColor || '#ffffff';
                    } else if (styleType === 'BOTTOM_BORDER') {
                      dynStyle.background = 'white';
                      dynStyle.borderLeft = 'none'; dynStyle.border = 'none';
                      dynStyle.borderBottom = `4px solid ${formData.colorCode || '#3b82f6'}`;
                      textC = formData.textColor || '#0f172a';
                    } else if (styleType === 'SOFT_SHADOW') {
                      dynStyle.background = 'white';
                      dynStyle.borderLeft = `4px solid ${formData.colorCode || '#3b82f6'}`; dynStyle.border = 'none';
                      dynStyle.boxShadow = `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)`;
                      textC = formData.textColor || '#0f172a';
                    } else if (styleType === 'PILL') {
                      dynStyle.background = formData.colorCode || '#e0f2fe';
                      dynStyle.borderLeft = 'none'; dynStyle.border = `1px solid ${formData.textColor || '#3b82f6'}30`;
                      dynStyle.borderRadius = '30px';
                      textC = formData.textColor || '#0f172a';
                    } else if (styleType === 'GLASSMORPHISM') {
                      dynStyle.background = `${formData.colorCode || '#ffffff'}80`;
                      dynStyle.backdropFilter = 'blur(10px)';
                      dynStyle.borderLeft = 'none'; dynStyle.border = `1px solid ${formData.colorCode || '#ffffff'}40`;
                      dynStyle.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.1)';
                      textC = formData.textColor || '#0f172a';
                    } else if (styleType === 'MATERIAL_ACCENT') {
                      dynStyle.background = '#f8fafc';
                      dynStyle.borderLeft = `6px solid ${formData.colorCode || '#3b82f6'}`; dynStyle.borderTop = 'none'; dynStyle.borderRight = 'none'; dynStyle.borderBottom = 'none';
                      dynStyle.borderRadius = '4px';
                      dynStyle.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                      textC = formData.textColor || '#0f172a';
                    } else if (styleType === 'NEUMORPHISM') {
                      dynStyle.background = '#f1f5f9';
                      dynStyle.borderLeft = 'none'; dynStyle.border = 'none';
                      dynStyle.borderRadius = '12px';
                      dynStyle.boxShadow = '5px 5px 10px #d9dddf, -5px -5px 10px #ffffff';
                      textC = formData.textColor || '#334155';
                    } else if (styleType === 'FOLDED_RIBBON') {
                      dynStyle.background = formData.colorCode || '#3b82f6';
                      dynStyle.borderLeft = 'none'; dynStyle.border = 'none';
                      dynStyle.borderTopLeftRadius = '0px'; dynStyle.borderBottomLeftRadius = '0px';
                      dynStyle.borderTopRightRadius = '8px'; dynStyle.borderBottomRightRadius = '8px';
                      dynStyle.boxShadow = '-4px 4px 0px rgba(0,0,0,0.1)';
                      textC = formData.textColor || '#ffffff';
                    } else if (styleType === 'HOLLOW_NEON') {
                      dynStyle.background = '#0f172a';
                      dynStyle.borderLeft = 'none'; dynStyle.border = `1px solid ${formData.textColor || '#38bdf8'}`;
                      dynStyle.boxShadow = `inset 0 0 8px ${formData.textColor || '#38bdf8'}40, 0 0 8px ${formData.textColor || '#38bdf8'}40`;
                      textC = formData.textColor || '#38bdf8';
                    }

                    return (
                      <div style={dynStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', alignItems: 'baseline', gap: '8px' }}>
                          <strong style={{ fontSize: '0.65rem', color: textC, textTransform: 'uppercase' }}>ADMIN</strong>
                          <span style={{ 
                            fontSize: '0.60rem', 
                            color: styleType === 'SOLID' || styleType === 'GLOW' || styleType === 'GRADIENT' || styleType === 'FOLDED_RIBBON' ? '#ffffff' : (formData.colorCode || '#0284c7'), 
                            background: styleType === 'SOLID' || styleType === 'GLOW' || styleType === 'GRADIENT' || styleType === 'FOLDED_RIBBON' ? 'rgba(255,255,255,0.25)' : `${formData.colorCode || '#0284c7'}15`, 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            fontWeight: 'bold',
                            letterSpacing: '0.3px'
                          }}>10:30 AM</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: textC, fontWeight: '600' }}>
                          {formData.code || 'STATUS_CODE'}
                        </div>
                      </div>
                    );
                  })()}

                </div>

              </div>
            </div>

            {/* Smart Logic Lists */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }}></div>
                  DISABLES (Hide these)
                </label>
                <div style={{ border: '1px solid #fca5a5', borderRadius: '6px', padding: '10px', height: '160px', overflowY: 'auto', background: '#fef2f2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignContent: 'start' }}>
                  {statuses.filter(s => s.module === formData.module && s.code !== formData.code).sort((a,b) => (a.sequence||0) - (b.sequence||0)).map(s => {
                    const isChecked = (formData.disables || '').split(',').map(x=>x.trim()).includes(s.code);
                    return (
                      <label key={s.code} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: '#7f1d1d', background: 'white', padding: '4px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>
                        <input type="checkbox" checked={isChecked} onChange={(e) => {
                            let arr = (formData.disables || '').split(',').map(x=>x.trim()).filter(Boolean);
                            if (e.target.checked) arr.push(s.code);
                            else arr = arr.filter(x => x !== s.code);
                            setFormData({...formData, disables: arr.join(', ')});
                        }} style={{ cursor: 'pointer' }} />
                        {s.code}
                      </label>
                    );
                  })}
                  {statuses.filter(s => s.module === formData.module && s.code !== formData.code).length === 0 && <span style={{fontSize:'11px', color:'#991b1b', gridColumn: 'span 2'}}>No other statuses available</span>}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></div>
                  ENABLES (Show Exceptions)
                </label>
                <div style={{ border: '1px solid #86efac', borderRadius: '6px', padding: '10px', height: '160px', overflowY: 'auto', background: '#f0fdf4', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', alignContent: 'start' }}>
                  {statuses.filter(s => s.module === formData.module && s.code !== formData.code).sort((a,b) => (a.sequence||0) - (b.sequence||0)).map(s => {
                    const isChecked = (formData.enables || '').split(',').map(x=>x.trim()).includes(s.code);
                    return (
                      <label key={s.code} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer', color: '#14532d', background: 'white', padding: '4px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                        <input type="checkbox" checked={isChecked} onChange={(e) => {
                            let arr = (formData.enables || '').split(',').map(x=>x.trim()).filter(Boolean);
                            if (e.target.checked) arr.push(s.code);
                            else arr = arr.filter(x => x !== s.code);
                            setFormData({...formData, enables: arr.join(', ')});
                        }} style={{ cursor: 'pointer' }} />
                        {s.code}
                      </label>
                    );
                  })}
                  {statuses.filter(s => s.module === formData.module && s.code !== formData.code).length === 0 && <span style={{fontSize:'11px', color:'#166534', gridColumn: 'span 2'}}>No other statuses available</span>}
                </div>
              </div>

            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="btn btn-primary" 
              style={{ background: '#0284c7', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
            >
              <Save size={16} /> {loading ? 'Saving...' : 'Save Status'}
            </button>
            
            {editingCode && (
              <button 
                onClick={handleDelete} 
                disabled={loading}
                className="btn btn-danger" 
                style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}

            <button 
              onClick={fetchStatuses} 
              disabled={loading}
              className="btn btn-secondary" 
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, marginLeft: 'auto' }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh List
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
