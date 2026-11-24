import React, { useState, useEffect, useCallback } from 'react';
import { Save, Settings2, Plane, Ship, Truck, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useGlobalContext } from '../../../GlobalContext';

// Settings > Sequence Config. 28-Oct-2026 rework:
// - rows and preview come from the backend (/api/masters/job-sequences/status): the preview is the job no the next
//   job will really get (numbers already used are skipped), with the last job no given for that prefix;
// - prefix / start number are checked before saving; the backend also refuses a start number whose job no is already
//   used (duplicate job numbers);
// - export jobs now use the AIR / SEA EXPORT rows (before, the backend ignored them and used NDL/AE/26/);
// - LAND IMPORT / LAND EXPORT rows; {BR} {FY} {YY} tokens in the prefix;
// - unsaved changes are shown, Reset puts back the saved values, errors are shown (they were only in the console).
const MODES = [
  { id: 'AIR IMPORT', icon: Plane, short: 'AI' },
  { id: 'SEA IMPORT', icon: Ship, short: 'SI' },
  { id: 'LAND IMPORT', icon: Truck, short: 'LI' },
  { id: 'AIR EXPORT', icon: Plane, short: 'AE' },
  { id: 'SEA EXPORT', icon: Ship, short: 'SE' },
  { id: 'LAND EXPORT', icon: Truck, short: 'LE' },
];
const PREFIX_OK = /^[A-Za-z0-9/\-_.{}]+$/;

export default function SequenceConfigTab() {
  const { activeYear } = useGlobalContext() || {};
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [saved, setSaved] = useState({});   // jobMode -> status row from the backend
  const [edit, setEdit] = useState({});     // jobMode -> { prefix, startNumber } as typed
  const [base, setBase] = useState({});     // the same as loaded (to see what was changed)
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverErr, setServerErr] = useState('');

  useEffect(() => {
    axios.get('/api/masters/company-branches').then(r => {
      const list = (r.data && r.data.data) || [];
      setBranches(list);
      if (list.length) setSelectedBranch((list.find(b => b.isDefault) || list[0]).branchCode);
    }).catch(e => toast.error('Could not load branches: ' + e.message));
  }, []);

  const load = useCallback(async () => {
    if (!selectedBranch) return;
    setLoading(true); setServerErr('');
    try {
      const r = await axios.get('/api/masters/job-sequences/status', { params: { branchCode: selectedBranch, financialYearId: activeYear && activeYear.id } });
      const map = {};
      (r.data.data || []).forEach(s => { map[s.jobMode] = s; });
      setSaved(map);
      const e = {};
      MODES.forEach(m => { const s = map[m.id] || {}; e[m.id] = { prefix: s.prefix || `${selectedBranch}-${m.short}-`, startNumber: String(s.startNumber || 1001) }; });
      setEdit(e); setBase(e);
    } catch (err) {
      toast.error('Could not load sequences: ' + ((err.response && err.response.data && err.response.data.message) || err.message));
    } finally { setLoading(false); }
  }, [selectedBranch, activeYear]);

  useEffect(() => { load(); }, [load]);

  const fyCode = (activeYear && (activeYear.code || activeYear.name)) || '';
  const yy = activeYear && activeYear.startDate ? String(activeYear.startDate).slice(2, 4) : String(new Date().getFullYear()).slice(2);
  const render = (prefix, n) => String(prefix || '').replace(/\{BR\}/gi, selectedBranch).replace(/\{FY\}/gi, fyCode).replace(/\{YY\}/gi, yy) + n;

  const rowError = (id) => {
    const r = edit[id] || {};
    const p = String(r.prefix || '').trim();
    const n = Number(r.startNumber);
    if (!p) return 'Prefix is empty';
    if (p.length > 20) return 'Max 20 characters';
    if (!PREFIX_OK.test(p)) return 'Only letters, numbers, / - _ . and {BR} {FY} {YY}';
    if (!Number.isInteger(n) || n < 1 || n > 99999999) return 'Start number: whole number 1 - 99999999';
    const same = MODES.find(m => m.id !== id && String((edit[m.id] || {}).prefix || '').trim().toUpperCase() === p.toUpperCase());
    if (same) return `Same prefix as ${same.id}`;
    return '';
  };
  const isDirty = (id) => {
    const b = base[id] || {}, e = edit[id] || {};
    return String(b.prefix) !== String(e.prefix).trim() || String(b.startNumber) !== String(e.startNumber).trim();
  };
  const dirtyCount = MODES.filter(m => isDirty(m.id)).length;
  const errCount = MODES.filter(m => rowError(m.id)).length;

  const handleChange = (id, field, value) => {
    if (field === 'startNumber') value = value.replace(/[^0-9]/g, '').slice(0, 8);
    if (field === 'prefix') value = value.toUpperCase().replace(/\s/g, '').replace(/\{(BR|FY|YY)\}/gi, (t) => t.toUpperCase());
    setEdit(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setServerErr('');
  };

  const handleSave = async () => {
    if (!selectedBranch) return toast.error('Select a branch first');
    if (errCount) return toast.error('Fix the rows marked in red first');
    setSaving(true); setServerErr('');
    try {
      const payload = MODES.map(m => ({ branchCode: selectedBranch, jobMode: m.id, prefix: String(edit[m.id].prefix).trim(), startNumber: parseInt(edit[m.id].startNumber, 10) }));
      await axios.post('/api/masters/job-sequences', payload, { params: { financialYearId: activeYear && activeYear.id } });
      toast.success(`Sequences saved for ${selectedBranch}`);
      await load();
    } catch (err) {
      const msg = (err.response && err.response.data && (err.response.data.message || err.response.data.error)) || err.message;
      setServerErr(msg); toast.error('Not saved: ' + msg);
    } finally { setSaving(false); }
  };

  const th = { padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted, #475569)', fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.03em' };
  const inp = (bad) => ({ padding: '8px', borderRadius: '6px', border: `1px solid ${bad ? '#ef4444' : 'var(--border-color, #cbd5e1)'}`, background: 'var(--bg-input, #fff)', color: 'var(--text-main, #0f172a)', fontFamily: 'inherit' });

  return (
    <div style={{ background: 'var(--bg-panel, #ffffff)', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--border-color, #e2e8f0)', minHeight: '500px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main, #1e293b)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={22} color="#8b5cf6" />
            Branch-Wise Sequence Config
          </h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted, #64748b)', fontSize: '0.875rem' }}>Job number = prefix + next number. The next number moves on by one with every new job.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-app, #f8fafc)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color, #e2e8f0)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted, #475569)' }}>SELECT BRANCH</span>
          <select value={selectedBranch} onChange={e => {
            if (dirtyCount && !window.confirm('Unsaved changes for ' + selectedBranch + ' will be lost. Change branch?')) return;
            setSelectedBranch(e.target.value);
          }} style={{ ...inp(false), fontWeight: 'bold' }}>
            {branches.map(b => <option key={b.id} value={b.branchCode}>{b.branchCode} - {b.branchName}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--text-muted, #475569)', background: 'var(--bg-app, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
        <span>Prefix tokens: <b>{'{BR}'}</b> branch ({selectedBranch || '-'}), <b>{'{FY}'}</b> financial year ({fyCode || '-'}), <b>{'{YY}'}</b> year ({yy}). E.g. <code>{'{BR}/AI/{YY}/'}</code> gives {render('{BR}/AI/{YY}/', 1001)}. A number already used as a job no is skipped, and cannot be saved as the start number.</span>
      </div>

      {!branches.length && <div style={{ padding: '16px', color: '#b45309', fontSize: '13px' }}>No branch found. Add one in Branch Master first.</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '760px', opacity: loading ? 0.5 : 1 }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-input, #f1f5f9)', borderBottom: '2px solid var(--border-color, #cbd5e1)' }}>
              <th style={th}>JOB MODE</th>
              <th style={th}>PREFIX</th>
              <th style={th}>NEXT NUMBER</th>
              <th style={th}>NEXT JOB NO</th>
              <th style={th}>LAST JOB NO</th>
            </tr>
          </thead>
          <tbody>
            {MODES.map(m => {
              const Icon = m.icon; const e = edit[m.id] || { prefix: '', startNumber: '' }; const s = saved[m.id] || {};
              const err = rowError(m.id); const dirty = isDirty(m.id);
              const next = dirty ? render(String(e.prefix).trim(), e.startNumber) : (s.nextJobNo || render(e.prefix, e.startNumber));
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', background: dirty ? 'rgba(139,92,246,0.05)' : 'transparent' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={16} color="var(--primary-color-start, #0ea5e9)" /> {m.id}
                      {!s.configured && <span title="Not saved yet: the default is used" style={{ fontSize: '9px', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '8px' }}>DEFAULT</span>}
                      {dirty && <span style={{ fontSize: '9px', background: '#ede9fe', color: '#6d28d9', padding: '1px 6px', borderRadius: '8px' }}>CHANGED</span>}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <input type="text" value={e.prefix} maxLength={20} onChange={ev => handleChange(m.id, 'prefix', ev.target.value)} style={{ ...inp(err && !/Start/.test(err)), width: '170px' }} />
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <input type="text" inputMode="numeric" value={e.startNumber} onChange={ev => handleChange(m.id, 'startNumber', ev.target.value)} style={{ ...inp(/Start/.test(err)), width: '110px' }} />
                    {s.configured && s.nextNumber > s.startNumber && !dirty && <div style={{ fontSize: '10px', color: '#b45309', marginTop: '3px' }}>{s.startNumber}..{s.nextNumber - 1} already used - skipped</div>}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: err ? '#ef4444' : 'var(--text-main, #0f172a)' }}>
                    {err ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600 }}><AlertTriangle size={13} /> {err}</span> : next}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted, #64748b)', fontSize: '12px' }}>{s.lastJobNo || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {serverErr && <div style={{ marginTop: '14px', padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '12px', display: 'flex', gap: '6px' }}><AlertTriangle size={15} style={{ flexShrink: 0 }} /> {serverErr}</div>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>{dirtyCount ? `${dirtyCount} row(s) changed - not saved` : MODES.some(m => !(saved[m.id] || {}).configured) ? 'DEFAULT rows are not saved yet' : 'All saved'}</span>
        <button type="button" onClick={load} disabled={loading || saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'transparent', color: 'var(--text-main, #334155)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          <RotateCcw size={16} /> RESET
        </button>
        <button type="button" onClick={handleSave} disabled={saving || loading || !selectedBranch} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: errCount ? '#a78bfa' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', fontWeight: 'bold' }}>
          <Save size={18} /> {saving ? 'SAVING...' : 'SAVE SEQUENCE CONFIG'}
        </button>
      </div>
    </div>
  );
}
