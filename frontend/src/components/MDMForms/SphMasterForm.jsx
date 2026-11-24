import React, { useState, useEffect } from 'react';
import { Save, Search, PlusCircle, Edit2, Tag, CheckCircle, XCircle } from 'lucide-react';

const CATEGORIES = ['ALL', 'LIVE CARGO', 'TEMPERATURE SENSITIVE', 'HAZARDOUS', 'PERISHABLE', 'PHARMACEUTICAL', 'HIGH VALUE', 'BATTERY', 'MEDICAL', 'FINANCIAL', 'COURIER', 'SPECIAL', 'ROUTING', 'DIMENSIONS', 'OTHER'];

export default function SphMasterForm() {
  const [codes, setCodes]   = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('ALL');
  const [toast, setToast]   = useState(null);

  const initialForm = { id: '', code: '', description: '', category: '', isActive: true };
  const [formData, setFormData] = useState(initialForm);
  const [isEditing, setIsEditing] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCodes = async () => {
    try {
      const res = await fetch('/api/masters/sph-master');
      const data = await res.json();
      setCodes(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleSave = async () => {
    if (!formData.code || !formData.description) {
      return showToast('Code and Description are mandatory!', 'error');
    }
    if (!/^[A-Za-z]{3}$/.test(String(formData.code).trim())) return showToast('SPH code must be 3 letters (e.g. PER, DGR)', 'error');
    try {
      const url = formData.id ? `/api/masters/sph-master/${formData.id}` : '/api/masters/sph-master';
      const method = formData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: String(formData.code).trim().toUpperCase(), description: String(formData.description).trim(), category: formData.category || '', isActive: formData.isActive !== false })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(formData.id ? 'SPH Code updated successfully!' : 'SPH Code added successfully!');
        setFormData(initialForm);
        setIsEditing(false);
        fetchCodes();
      } else {
        showToast(data.error || 'Failed to save', 'error');
      }
    } catch (err) { showToast('Network error: ' + err.message, 'error'); }
  };

  const handleEdit = (item) => {
    setFormData({ ...item });
    setIsEditing(true);
  };

  // 22-Nov-2026: no delete here - the ACTIVE / INACTIVE button of the row switches a code off and on

  const handleToggle = async (item) => {
    try {
      const res = await fetch(`/api/masters/sph-master/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || 'Update failed', 'error'); }
      fetchCodes();
    } catch (err) { showToast('Network error: ' + err.message, 'error'); }
  };

  const filtered = codes.filter(c => {
    const matchSearch = !search || String(c.code || '').includes(search.toUpperCase()) || String(c.description || '').toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'ALL' || c.category === filterCat;
    return matchSearch && matchCat;
  });

  const activeCount   = codes.filter(c => c.isActive).length;
  const inactiveCount = codes.length - activeCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 9999, padding: '10px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', background: toast.type === 'error' ? '#fee2e2' : '#dcfce7', color: toast.type === 'error' ? '#b91c1c' : '#166534', border: `1px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[
          { label: 'TOTAL CODES', val: codes.length, bg: '#eff6ff', color: 'var(--primary-color-start, #2563eb)' },
          { label: 'ACTIVE',      val: activeCount,   bg: '#dcfce7', color: '#15803d' },
          { label: 'INACTIVE',    val: inactiveCount, bg: '#fee2e2', color: '#b91c1c' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, padding: '8px 16px', borderRadius: '8px', minWidth: '100px' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden' }}>

        {/* Form Panel */}
        <div className="glass-panel" style={{ width: '340px', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ background: 'linear-gradient(90deg, var(--primary-color-start, #1e3a8a), var(--primary-color-end, #2563eb))', padding: '10px 16px', color: '#fff', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={14} /> {isEditing ? `EDITING: ${formData.code}` : 'ADD NEW SPH CODE'}
          </div>
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>CODE * <span style={{ color: '#94a3b8', fontWeight: 400 }}>(3–4 letters, e.g. AVI)</span></label>
              <input
                type="text" maxLength={4} className="input-field"
                style={{ textTransform: 'uppercase', fontWeight: 800, fontSize: '14px', letterSpacing: '1px', fontFamily: 'monospace' }}
                placeholder="E.G. AVI"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>DESCRIPTION *</label>
              <input
                type="text" className="input-field"
                style={{ textTransform: 'uppercase' }}
                placeholder="E.G. LIVE ANIMALS"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>CATEGORY</label>
              <select className="input-field" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                <option value="">SELECT CATEGORY</option>
                {CATEGORIES.filter(c => c !== 'ALL').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
              <label htmlFor="isActive" style={{ fontSize: '11px', fontWeight: 700 }}>ACTIVE (visible in dropdowns)</label>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
              {isEditing && (
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setFormData(initialForm); setIsEditing(false); }}>
                  CANCEL
                </button>
              )}
              <button className="btn btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={handleSave}>
                <Save size={14} /> {isEditing ? 'UPDATE CODE' : 'ADD CODE'}
              </button>
            </div>
          </div>
        </div>

        {/* List Panel */}
        <div className="glass-panel" style={{ flex: 1, padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search + Filter Bar */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
              <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input type="text" className="input-field" style={{ paddingLeft: '28px' }} placeholder="Search code or description..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field" style={{ width: '160px' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '3px 10px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-panel, #f8fafc)', zIndex: 1 }}>
                <tr>
                  {['CODE', 'DESCRIPTION', 'CATEGORY', 'STATUS', 'ACTIONS'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '10px', color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color, #e2e8f0)', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={item.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-input, #f8fafc)', borderBottom: '1px solid var(--border-color, #f1f5f9)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-input, #eff6ff)'}
                    onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--bg-input, #f8fafc)'}
                  >
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', background: 'var(--bg-input, #eff6ff)', color: 'var(--primary-color-start, #1d4ed8)', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--primary-color-end, #bfdbfe)' }}>
                        {item.code}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--text-main, #1e293b)' }}>{item.description}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {item.category ? (
                        <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, border: '1px solid #fcd34d' }}>
                          {item.category}
                        </span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={() => handleToggle(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700 }}
                        title={item.isActive ? 'Click to deactivate' : 'Click to activate'}>
                        {item.isActive
                          ? <><CheckCircle size={14} color="#16a34a" /> <span style={{ color: '#16a34a' }}>ACTIVE</span></>
                          : <><XCircle size={14} color="#dc2626" />    <span style={{ color: '#dc2626' }}>INACTIVE</span></>
                        }
                      </button>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleEdit(item)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Edit2 size={11} /> EDIT
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No SPH codes found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
