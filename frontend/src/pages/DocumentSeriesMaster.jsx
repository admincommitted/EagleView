import React, { useEffect, useState } from 'react';
import { Settings, Plus, Save, Edit3, Trash2, CheckCircle, RefreshCcw, Eye, Info, X } from 'lucide-react';
import toast from 'react-hot-toast';

/*
 * Document Series & Numbering Master (API /api/document-series, table DocumentSeries).
 * 28-Oct-2026: the old screen showed sample rows kept only in the browser - Save, Edit, Delete and the branch
 * filter did nothing, and the branch / FY lists were fixed text. Now the rules are saved, branches and years come
 * from the Company Branch and Financial Year masters, and the preview uses the same logic as the server.
 * Job numbers are not set here: they come from Settings > Sequence Config.
 */
const TAGS = ['{BRANCH}', '{DEPT}', '{FY}', '{YY}', '{MM}', '{DD}'];
const DEPT_CODE = { 'ALL': 'GEN', 'Air Export': 'AE', 'Air Import': 'AI', 'Sea Export': 'SE', 'Sea Import': 'SI', 'Customs': 'CUS', 'Accounts': 'ACC', 'HR': 'HR' };
const EMPTY = { id: null, docType: '', branchCode: 'ALL', dept: 'ALL', fyCode: '', format: '{BRANCH}/{DEPT}/INV/{FY}/', pad: 4, nextNumber: 1, isActive: true };

function preview(f, num, date = new Date()) {
    const prefix = String(f.format || '').replace(/\{(BRANCH|DEPT|FY|YY|MM|DD)\}/g, (m, t) => ({
        BRANCH: f.branchCode && f.branchCode !== 'ALL' ? f.branchCode : 'HO',
        DEPT: DEPT_CODE[f.dept] || 'GEN',
        FY: f.fyCode || 'FY',
        YY: String(date.getFullYear()).slice(2), MM: String(date.getMonth() + 1).padStart(2, '0'), DD: String(date.getDate()).padStart(2, '0'),
    })[t]);
    const n = parseInt(num, 10);
    return prefix + String(Number.isFinite(n) ? n : 1).padStart(parseInt(f.pad, 10) || 1, '0');
}

export default function DocumentSeriesMaster() {
    const [rows, setRows] = useState([]);
    const [docTypes, setDocTypes] = useState([]);
    const [depts, setDepts] = useState(Object.keys(DEPT_CODE));
    const [branches, setBranches] = useState([]);
    const [years, setYears] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState(EMPTY);
    const [branchFilter, setBranchFilter] = useState('');
    const [saving, setSaving] = useState(false);

    const load = async () => {
        try {
            const res = await fetch('/api/document-series');
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Could not load numbering rules');
            setRows(data.data || []);
            if (Array.isArray(data.docTypes)) setDocTypes(data.docTypes);
            if (Array.isArray(data.depts)) setDepts(data.depts);
        } catch (e) { toast.error(e.message); }
    };
    useEffect(() => {
        load();
        fetch('/api/masters/company-branches').then(r => r.json()).then(d => setBranches(((d && d.data) || []).filter(b => b.status !== 'Inactive'))).catch(() => {});
        fetch('/api/masters/financial-years').then(r => r.json()).then(d => {
            const list = ((d && d.data) || []).filter(y => y.isActive !== false && !y.isDeleted);
            setYears(list);
            const def = list.find(y => y.isDefault) || list[0];
            if (def) setFormData(prev => (prev.fyCode ? prev : { ...prev, fyCode: def.code }));
        }).catch(() => {});
    }, []);

    const set = (k, v) => setFormData(prev => ({ ...prev, [k]: v }));
    const startNew = () => { const def = years.find(y => y.isDefault) || years[0]; setFormData({ ...EMPTY, fyCode: def ? def.code : '' }); setIsEditing(true); };
    const startEdit = (r) => { setFormData({ ...EMPTY, ...r }); setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };

    const handleSave = async () => {
        if (!formData.docType || !formData.format) return toast.error('Document Type and Format are required!');
        if (!formData.fyCode) return toast.error('Choose a financial year');
        const pad = parseInt(formData.pad, 10), next = parseInt(formData.nextNumber, 10);
        if (!(pad >= 1 && pad <= 8)) return toast.error('Padding must be 1 - 8');
        if (!(next >= 1)) return toast.error('Next number must be 1 or more');
        const old = rows.find(r => r.id === formData.id);
        let allowBack = false;
        if (old && next < old.nextNumber) {
            if (!window.confirm(`Next number goes back from ${old.nextNumber} to ${next}. Numbers already given may repeat. Continue?`)) return;
            allowBack = true;
        }
        setSaving(true);
        try {
            const { id, createdAt, updatedAt, example, ...body } = formData;
            const res = await fetch(id ? `/api/document-series/${id}` : '/api/document-series', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, pad, nextNumber: next, allowBack }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Save failed');
            toast.success('Series rule saved successfully!');
            setIsEditing(false);
            load();
        } catch (e) { toast.error(e.message); } finally { setSaving(false); }
    };

    const handleDelete = async (r) => {
        if (!window.confirm(`Delete the ${r.docType} rule (${r.branchCode} / ${r.dept} / ${r.fyCode})?`)) return;
        try {
            const res = await fetch(`/api/document-series/${r.id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Delete failed');
            toast.success('Rule deleted');
            if (formData.id === r.id) setIsEditing(false);
            load();
        } catch (e) { toast.error(e.message); }
    };

    const inputStyle = { padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' };
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' };
    const thStyle = { padding: '12px', textAlign: 'left', fontSize: '12px', color: '#1e293b', borderBottom: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: '700', textTransform: 'uppercase' };
    const tdStyle = { padding: '12px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #f1f5f9' };
    const shown = rows.filter(r => !branchFilter || r.branchCode === branchFilter);

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#3b82f6', padding: '12px', borderRadius: '8px', color: '#fff' }}><Settings size={24} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '24px', color: '#0f172a', fontWeight: 'bold' }}>Document Series & Numbering Master</h2>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Numbering rules for invoices, vouchers and notes per branch, department and financial year. Job numbers: <a href="/settings?tab=sequence" style={{ color: '#2563eb' }}>Sequence Config</a>.</div>
                    </div>
                </div>
                <button onClick={() => (isEditing ? setIsEditing(false) : startNew())} style={{ padding: '10px 20px', background: isEditing ? '#64748b' : '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isEditing ? <><X size={18} /> Close</> : <><Plus size={18} /> New Series Rule</>}
                </button>
            </div>

            {isEditing && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#0f172a' }}>{formData.id ? 'Edit Series Rule' : 'New Series Rule'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                        <div>
                            <label style={labelStyle}>Document Type *</label>
                            <select style={inputStyle} value={formData.docType} onChange={e => set('docType', e.target.value)}>
                                <option value="">-- Select Doc Type --</option>
                                {docTypes.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Branch Scope</label>
                            <select style={inputStyle} value={formData.branchCode} onChange={e => set('branchCode', e.target.value)}>
                                <option value="ALL">ALL</option>
                                {branches.map(b => <option key={b.id} value={b.branchCode}>{b.branchCode} - {b.branchName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Department Scope</label>
                            <select style={inputStyle} value={formData.dept} onChange={e => set('dept', e.target.value)}>
                                {depts.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Financial Year *</label>
                            <select style={inputStyle} value={formData.fyCode} onChange={e => set('fyCode', e.target.value)}>
                                <option value="">-- Select --</option>
                                {years.map(y => <option key={y.id} value={y.code}>{y.name || y.code}{y.isClosed ? ' (closed)' : ''}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <div style={{ flex: '2 1 360px', background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#1e293b' }}>Format Builder (Prefix string)</h4>
                            <input type="text" value={formData.format} maxLength={60} onChange={e => set('format', e.target.value.toUpperCase().replace(/\s/g, ''))} style={{ ...inputStyle, fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '12px' }} />
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                                {TAGS.map(tag => (
                                    <button key={tag} onClick={() => set('format', (formData.format || '') + tag)} style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>+ {tag}</button>
                                ))}
                                <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', marginLeft: '8px' }}><Info size={12} style={{ marginRight: '4px' }} /> Click dynamic tags to insert them</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={labelStyle}>Number Padding (Length)</label>
                                    <input type="number" value={formData.pad} onChange={e => set('pad', e.target.value)} style={inputStyle} min="1" max="8" />
                                </div>
                                <div>
                                    <label style={labelStyle}>{formData.id ? 'Next Number' : 'Starting Sequence Number'}</label>
                                    <input type="number" value={formData.nextNumber} onChange={e => set('nextNumber', e.target.value)} style={inputStyle} min="1" />
                                </div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', fontSize: '13px' }}>
                                <input type="checkbox" checked={formData.isActive !== false} onChange={e => set('isActive', e.target.checked)} /> Active
                            </label>
                        </div>

                        <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ background: '#0f172a', padding: '24px', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.1 }}><Eye size={120} /></div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Live Series Preview</div>
                                <div style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '2px', color: '#38bdf8', wordBreak: 'break-all' }}>{preview(formData, formData.nextNumber)}</div>
                                <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '16px', display: 'flex', gap: '8px' }}>
                                    <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px' }}>Then: {preview(formData, (parseInt(formData.nextNumber, 10) || 1) + 1)}</span>
                                </div>
                            </div>
                            <button onClick={handleSave} disabled={saving} style={{ marginTop: '20px', width: '100%', padding: '12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}>
                                <Save size={18} /> {saving ? 'Saving...' : 'Save & Activate Rule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Numbering Rules ({shown.length})</h3>
                    <select style={{ ...inputStyle, width: '180px', padding: '6px 12px' }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                        <option value="">All branches</option>
                        <option value="ALL">ALL (any branch)</option>
                        {branches.map(b => <option key={b.id} value={b.branchCode}>{b.branchCode}</option>)}
                    </select>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Document Type</th>
                                <th style={thStyle}>Applicability (Branch / Dept)</th>
                                <th style={thStyle}>F.Y.</th>
                                <th style={thStyle}>Format Definition</th>
                                <th style={thStyle}>Next Number</th>
                                <th style={thStyle}>Next Document No.</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map(item => (
                                <tr key={item.id}>
                                    <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>{item.docType}</td>
                                    <td style={tdStyle}>
                                        <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', marginRight: '6px' }}>{item.branchCode}</span>
                                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{item.dept}</span>
                                    </td>
                                    <td style={tdStyle}>{item.fyCode}</td>
                                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#2563eb', fontSize: '12px' }}>{item.format}<br />Pad: {item.pad}</td>
                                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{item.nextNumber}</td>
                                    <td style={{ ...tdStyle, fontSize: '12px', color: '#059669', fontWeight: '700' }}>{item.example || preview(item, item.nextNumber)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }} title={item.isActive ? 'Active' : 'Inactive'}>
                                        {item.isActive ? <CheckCircle size={16} color="#10b981" /> : <RefreshCcw size={16} color="#94a3b8" />}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                        <button onClick={() => startEdit(item)} title="Edit" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginRight: '8px' }}><Edit3 size={16} /></button>
                                        <button onClick={() => handleDelete(item)} title="Delete" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                            {shown.length === 0 && <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>No numbering rules yet - click "New Series Rule".</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
