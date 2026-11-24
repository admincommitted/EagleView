import React, { useState, useEffect, useMemo } from 'react';
import { Save, AlertCircle, CheckCircle, Activity, Key, Plus, Pencil, Trash2, Play, X, Search, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

// Settings > ULIP Integration. 28-Oct-2026:
// - login (user / password / base URL) in table UlipConfig;
// - the ULIP APIs (30+) are added one by one in table UlipApi: after Save the API shows in the list below, where it
//   can be edited, switched on/off, tested with sample values, or deleted.
const EMPTY = { apiCode: '', apiName: '', category: '', method: 'POST', path: '', requestTemplate: '{\n  \n}', description: '', isActive: true, sortOrder: 0 };
const CATS = ['DGFT', 'VAHAN', 'SARATHI', 'FASTAG', 'ICEGATE', 'LDB', 'PCS', 'ACMES', 'ENC', 'FOIS', 'GST', 'DIGILOCKER', 'OTHER'];
const errOf = async (r) => { try { const d = await r.json(); return d.error || d.message || ('HTTP ' + r.status); } catch (e) { return 'HTTP ' + r.status; } };
const paramsOf = (tpl) => [...new Set((String(tpl || '').match(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g) || []).map(s => s.slice(1, -1)))];
const when = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? '' : x.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

function UlipApiManager() {
  const [list, setList] = useState([]);
  const [base, setBase] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [testRow, setTestRow] = useState(null);
  const [testParams, setTestParams] = useState({});
  const [testing, setTesting] = useState(false);
  const [testOut, setTestOut] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/ulip/apis');
      if (!r.ok) throw new Error(await errOf(r));
      const d = await r.json(); setList(d.data || []); setBase(d.baseUrl || '');
    } catch (e) { toast.error('Could not load ULIP APIs: ' + e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: k === 'apiCode' ? v.toUpperCase().replace(/\s/g, '') : v }));
  const reset = () => { setForm(EMPTY); setEditId(null); };
  const jsonErr = useMemo(() => {
    const t = String(form.requestTemplate || '').trim(); if (!t) return '';
    try { JSON.parse(t.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, 'X')); return ''; } catch (e) { return e.message; }
  }, [form.requestTemplate]);

  const save = async () => {
    if (!form.apiCode || !form.apiName || !form.path) return toast.error('API code, name and path are required');
    if (jsonErr) return toast.error('Request body is not valid JSON');
    setSaving(true);
    try {
      const r = await fetch(editId ? `/api/ulip/apis/${editId}` : '/api/ulip/apis', { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!r.ok) throw new Error(await errOf(r));
      toast.success(editId ? `${form.apiCode} updated` : `${form.apiCode} added`);
      reset(); await load();
    } catch (e) { toast.error('Not saved: ' + e.message); } finally { setSaving(false); }
  };
  const edit = (a) => { setEditId(a.id); setForm({ ...EMPTY, ...a, requestTemplate: a.requestTemplate || '', description: a.description || '', category: a.category || '' }); const f = document.getElementById('ulip-api-form'); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const del = async (a) => {
    if (!window.confirm(`Delete ULIP API ${a.apiCode}?`)) return;
    try { const r = await fetch(`/api/ulip/apis/${a.id}`, { method: 'DELETE' }); if (!r.ok) throw new Error(await errOf(r)); toast.success(`${a.apiCode} deleted`); if (editId === a.id) reset(); load(); }
    catch (e) { toast.error('Not deleted: ' + e.message); }
  };
  const toggle = async (a) => {
    try { const r = await fetch(`/api/ulip/apis/${a.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !a.isActive }) }); if (!r.ok) throw new Error(await errOf(r)); load(); }
    catch (e) { toast.error(e.message); }
  };
  const openTest = (a) => { setTestRow(a); setTestParams(Object.fromEntries((a.params || []).map(k => [k, '']))); setTestOut(null); };
  const runTest = async () => {
    setTesting(true); setTestOut(null);
    try {
      const r = await fetch(`/api/ulip/apis/${testRow.id}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ params: testParams }) });
      const d = await r.json().catch(() => ({}));
      setTestOut(d); if (d.success) toast.success(`${testRow.apiCode}: OK`); else toast.error(`${testRow.apiCode}: ${d.error || 'HTTP ' + (d.httpStatus || r.status)}`);
      load();
    } catch (e) { setTestOut({ success: false, error: e.message }); } finally { setTesting(false); }
  };

  const shown = list.filter(a => (!cat || a.category === cat) && (!q || `${a.apiCode} ${a.apiName} ${a.category || ''} ${a.path}`.toUpperCase().includes(q.toUpperCase())));
  const cats = [...new Set([...CATS, ...list.map(a => a.category).filter(Boolean)])];
  const inp = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '13px', background: 'var(--bg-input, #fff)', color: 'var(--text-main, #0f172a)', boxSizing: 'border-box' };
  const lbl = { fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', gap: '4px' };
  const th = { padding: '8px 10px', textAlign: 'left', fontSize: '11px', color: 'var(--text-muted, #475569)', borderBottom: '2px solid var(--border-color, #cbd5e1)', whiteSpace: 'nowrap' };
  const td = { padding: '8px 10px', fontSize: '12px', borderBottom: '1px solid var(--border-color, #e2e8f0)', verticalAlign: 'top' };
  const iconBtn = { border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div id="ulip-api-form" style={{ border: `1px solid ${editId ? '#f59e0b' : 'var(--border-color, #e2e8f0)'}`, borderRadius: '10px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main, #1e293b)' }}>{editId ? `Edit ULIP API: ${form.apiCode}` : 'Add ULIP API'}</h3>
          {editId && <button type="button" onClick={reset} style={iconBtn}><X size={14} /> &nbsp;Cancel edit</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
          <label style={lbl}>API code *<input style={inp} value={form.apiCode} maxLength={60} onChange={e => set('apiCode', e.target.value)} placeholder="e.g. VAHAN/01" /></label>
          <label style={{ ...lbl, gridColumn: 'span 2' }}>API name *<input style={inp} value={form.apiName} maxLength={150} onChange={e => set('apiName', e.target.value)} placeholder="e.g. Vehicle details" /></label>
          <label style={lbl}>Category
            <input style={inp} list="ulip-cats" value={form.category} onChange={e => set('category', e.target.value.toUpperCase())} placeholder="VAHAN" />
            <datalist id="ulip-cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label style={lbl}>Method<select style={inp} value={form.method} onChange={e => set('method', e.target.value)}><option>POST</option><option>GET</option><option>PUT</option></select></label>
          <label style={{ ...lbl, gridColumn: 'span 2' }}>Path *<input style={inp} value={form.path} onChange={e => set('path', e.target.value.trim())} placeholder="/VAHAN/01" />
            <span style={{ fontWeight: 400, textTransform: 'none' }}>Full URL: {(/^https:\/\//.test(form.path) ? '' : base) + (form.path || '')}</span></label>
          <label style={lbl}>Order<input style={inp} type="number" value={form.sortOrder} onChange={e => set('sortOrder', e.target.value)} /></label>
          <label style={{ ...lbl, flexDirection: 'row', alignItems: 'center', gap: '6px', marginTop: '18px' }}><input type="checkbox" checked={!!form.isActive} onChange={e => set('isActive', e.target.checked)} /> Active</label>
          <label style={{ ...lbl, gridColumn: '1 / -1' }}>Request body (JSON) - write a value to fill at run time as {'{name}'}, e.g. {'{"vehiclenumber": "{vehicleNo}"}'}
            <textarea style={{ ...inp, minHeight: '90px', fontFamily: 'monospace', borderColor: jsonErr ? '#ef4444' : undefined }} value={form.requestTemplate} onChange={e => set('requestTemplate', e.target.value)} />
            <span style={{ fontWeight: 400, textTransform: 'none', color: jsonErr ? '#ef4444' : undefined }}>{jsonErr ? 'Not valid JSON: ' + jsonErr : (paramsOf(form.requestTemplate).length ? 'Values asked at run time: ' + paramsOf(form.requestTemplate).join(', ') : 'No run-time values')}</span>
          </label>
          <label style={{ ...lbl, gridColumn: '1 / -1' }}>Description / notes<input style={inp} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What this API returns, where it is used" /></label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={reset} disabled={saving} style={{ ...iconBtn, padding: '8px 14px', fontWeight: 700 }}><RotateCcw size={14} /> &nbsp;CLEAR</button>
          <button type="button" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '6px', border: 'none', background: editId ? '#d97706' : '#2563eb', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            {editId ? <Save size={15} /> : <Plus size={15} />} {saving ? 'SAVING...' : editId ? 'UPDATE API' : 'SAVE API'}
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '10px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main, #1e293b)' }}>Saved ULIP APIs ({list.length}{shown.length !== list.length ? `, showing ${shown.length}` : ''})</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: '#94a3b8' }} /><input style={{ ...inp, width: '200px', paddingLeft: '28px' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search code / name / path" /></div>
            <select style={{ ...inp, width: '140px' }} value={cat} onChange={e => setCat(e.target.value)}><option value="">All categories</option>{[...new Set(list.map(a => a.category).filter(Boolean))].map(c => <option key={c}>{c}</option>)}</select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px', opacity: loading ? 0.5 : 1 }}>
            <thead><tr style={{ background: 'var(--bg-input, #f1f5f9)' }}>
              <th style={th}>#</th><th style={th}>CODE</th><th style={th}>NAME</th><th style={th}>CATEGORY</th><th style={th}>METHOD / PATH</th><th style={th}>VALUES</th><th style={th}>LAST TEST</th><th style={th}>ACTIVE</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {shown.map((a, i) => (
                <tr key={a.id} style={{ background: editId === a.id ? 'rgba(245,158,11,0.08)' : undefined, opacity: a.isActive ? 1 : 0.55 }}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{a.apiCode}</td>
                  <td style={td}>{a.apiName}{a.description && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{a.description}</div>}</td>
                  <td style={td}>{a.category || '-'}</td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px' }}>{a.method} {a.path}</td>
                  <td style={{ ...td, fontSize: '11px' }}>{(a.params || []).join(', ') || '-'}</td>
                  <td style={{ ...td, fontSize: '11px', whiteSpace: 'nowrap' }}>{a.lastTestAt ? <span style={{ color: a.lastTestOk ? '#16a34a' : '#dc2626' }}>{a.lastTestOk ? 'OK' : 'Failed'} · {when(a.lastTestAt)}<br /><span style={{ color: '#94a3b8' }}>{a.lastTestMessage}</span></span> : '-'}</td>
                  <td style={td}><input type="checkbox" checked={!!a.isActive} onChange={() => toggle(a)} title="Switch this API on / off" /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <button type="button" title="Test" onClick={() => openTest(a)} style={{ ...iconBtn, color: '#16a34a' }}><Play size={14} /></button>{' '}
                    <button type="button" title="Edit" onClick={() => edit(a)} style={{ ...iconBtn, color: '#d97706' }}><Pencil size={14} /></button>{' '}
                    <button type="button" title="Delete" onClick={() => del(a)} style={{ ...iconBtn, color: '#dc2626' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: '20px' }}>{list.length ? 'No API matches the search' : 'No ULIP API saved yet - add the first one above'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {testRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => !testing && setTestRow(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel, #fff)', borderRadius: '12px', padding: '20px', width: 'min(640px, 100%)', maxHeight: '85vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Test {testRow.apiCode} - {testRow.apiName}</h3>
              <button type="button" onClick={() => setTestRow(null)} disabled={testing} style={iconBtn}><X size={14} /></button>
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b', marginBottom: '10px' }}>{testRow.method} {(/^https:\/\//.test(testRow.path) ? '' : base) + testRow.path}</div>
            {(testRow.params || []).map(k => (
              <label key={k} style={{ ...lbl, marginBottom: '8px' }}>{k}<input style={inp} value={testParams[k] || ''} onChange={e => setTestParams(p => ({ ...p, [k]: e.target.value }))} /></label>
            ))}
            <button type="button" onClick={runTest} disabled={testing} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: testing ? 'wait' : 'pointer' }}><Play size={14} /> {testing ? 'CALLING ULIP...' : 'RUN TEST'}</button>
            {testOut && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: testOut.success ? '#16a34a' : '#dc2626' }}>{testOut.success ? 'Success' : 'Failed'}{testOut.httpStatus ? ` · HTTP ${testOut.httpStatus}` : ''}{testOut.ms ? ` · ${testOut.ms} ms` : ''}{testOut.error ? ` · ${testOut.error}` : ''}</div>
                {testOut.data !== undefined && <pre style={{ marginTop: '6px', background: '#0f172a', color: '#e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '11px', maxHeight: '320px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(testOut.data, null, 2)}</pre>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UlipSettingsTab() {
  const [settings, setSettings] = useState({ ULIP_USERNAME: '', ULIP_PASSWORD: '', ULIP_BASE_URL: '' });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettings({ ULIP_USERNAME: data.ULIP_USERNAME || '', ULIP_PASSWORD: data.ULIP_PASSWORD || '', ULIP_BASE_URL: data.ULIP_BASE_URL || '' });
    } catch (err) { toast.error('Failed to load ULIP Settings'); }
  };
  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    if (settings.ULIP_BASE_URL && !/^https:\/\/[^\s]+$/.test(settings.ULIP_BASE_URL)) return toast.error('Base URL must start with https://');
    setLoading(true);
    try {
      const res = await fetch('/api/settings/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
      const result = await res.json();
      if (res.ok) { toast.success('ULIP login saved'); fetchSettings(); }
      else toast.error(result.error || 'Failed to save settings');
    } catch (err) { toast.error('Network error saving settings'); }
    setLoading(false);
  };

  const handleTestConnection = async () => {
    if (!settings.ULIP_USERNAME) return toast.error('Username is required to test');
    setTesting(true); setTestResult(null);
    try {
      // a saved password is shown as *** - the backend then uses the saved one
      const res = await fetch('/api/ulip/test-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: settings.ULIP_USERNAME, password: settings.ULIP_PASSWORD === '***' ? '' : settings.ULIP_PASSWORD }) });
      const data = await res.json();
      if (data.success) { setTestResult({ success: true, message: data.message || 'Connection successful' }); toast.success('Connected to ULIP'); }
      else { setTestResult({ success: false, message: typeof data.error === 'string' ? data.error : JSON.stringify(data.error || 'Connection failed') }); toast.error('Failed to connect to ULIP'); }
    } catch (err) { setTestResult({ success: false, message: 'Network/Server Error' }); }
    setTesting(false);
  };

  const inp = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '13px', background: 'var(--bg-input, #fff)', color: 'var(--text-main, #0f172a)', boxSizing: 'border-box' };
  const lbl = { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted, #475569)', display: 'flex', flexDirection: 'column', gap: '6px' };

  return (
    <div style={{ background: 'var(--bg-panel, #ffffff)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color, #e2e8f0)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ padding: '14px 16px', background: 'linear-gradient(to right, #eff6ff, #dbeafe)', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 6px 0' }}><Activity size={22} /> ULIP API Integration</h2>
        <p style={{ fontSize: '12px', color: '#3b82f6', margin: 0 }}>ULIP login, then each ULIP API (DGFT, VAHAN, SARATHI, FASTag, ICEGATE, LDB ...) added one by one below.</p>
      </div>

      <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '10px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: 'var(--text-main, #1e293b)' }}>ULIP login</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          <label style={lbl}>ULIP API username<input style={inp} value={settings.ULIP_USERNAME} onChange={e => setSettings({ ...settings, ULIP_USERNAME: e.target.value })} placeholder="ULIP user" /></label>
          <label style={lbl}>ULIP API password
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Key size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
              <input type="password" style={{ ...inp, paddingLeft: '32px' }} value={settings.ULIP_PASSWORD} onChange={e => setSettings({ ...settings, ULIP_PASSWORD: e.target.value })} placeholder={settings.ULIP_PASSWORD === '***' ? 'Saved' : 'Enter password'} />
            </div>
          </label>
          <label style={lbl}>Base URL<input style={inp} value={settings.ULIP_BASE_URL} onChange={e => setSettings({ ...settings, ULIP_BASE_URL: e.target.value.trim() })} placeholder="https://www.ulip.dpiit.gov.in/ulip/v1.0.0" /></label>
        </div>
        {testResult && (
          <div style={{ marginTop: '12px', padding: '10px', borderRadius: '8px', backgroundColor: testResult.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: testResult.success ? '#15803d' : '#b91c1c' }}>
            {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {testResult.message}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={handleTestConnection} disabled={testing}>{testing ? 'Testing...' : 'Test Connection'}</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading}><Save size={16} /> {loading ? 'Saving...' : 'Save Login'}</button>
        </div>
      </div>

      <UlipApiManager />
    </div>
  );
}
