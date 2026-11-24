// Settings > Number Series (iCAFFE). 05-Nov-2026.
// Every document number - bank / cash / journal vouchers, GST invoices of each kind, dockets - comes from here, in iCAFFE's
// format, per branch + division + financial year (a new year starts at 1, as iCAFFE does). Backend: /api/number-series.
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Hash, Save, Plus, RotateCcw, Info } from 'lucide-react';

const cell = { padding: '6px 8px', borderBottom: '1px solid var(--border-color, #e2e8f0)', fontSize: 12.5, verticalAlign: 'middle' };
const inp = { height: 28, border: '1px solid #cbd5e1', borderRadius: 5, padding: '0 6px', fontSize: 12.5, width: '100%', boxSizing: 'border-box' };
const btn = (bg, fg = '#fff') => ({ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', border: 'none', borderRadius: 6, background: bg, color: fg, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' });
const DIV_NAMES = { AE: 'Export Air', AI: 'Import Air', SE: 'Export Sea', SI: 'Import Sea', '': 'All' };

export default function NumberSeriesTab() {
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState({}); const [branch, setBranch] = useState(''); const [div, setDiv] = useState('');
  const [add, setAdd] = useState(null);
  const load = () => axios.get('/api/number-series').then(r => { setD(r.data); setEdit({}); if (!branch && r.data.branches[0]) setBranch(r.data.branches[0].branchCode); }).catch(e => setErr((e.response && e.response.data && e.response.data.error) || e.message));
  useEffect(() => { load(); }, []);
  const rows = useMemo(() => (d ? d.rows.filter(r => (!branch || r.branchCode === branch) && (!div || r.division === div)) : []), [d, branch, div]);
  const save = async (r) => {
    setErr(''); setMsg('');
    try { await axios.put('/api/number-series/' + r.id, { ...r, ...edit[r.id] }); setMsg('Saved ' + r.label + ' ' + r.branchCode + ' ' + r.division); load(); }
    catch (e) { setErr((e.response && e.response.data && e.response.data.error) || e.message); }
  };
  const create = async () => {
    setErr(''); setMsg('');
    try { await axios.post('/api/number-series', add); setAdd(null); setMsg('Series added'); load(); }
    catch (e) { setErr((e.response && e.response.data && e.response.data.error) || e.message); }
  };
  const E = (r, k) => (edit[r.id] && edit[r.id][k] !== undefined ? edit[r.id][k] : r[k]);
  const setE = (r, k, v) => setEdit(o => ({ ...o, [r.id]: { ...(o[r.id] || {}), [k]: v } }));
  if (!d) return <div style={{ padding: 20, color: err ? '#b91c1c' : '#64748b' }}>{err || 'Loading...'}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Hash size={20} color="#0369a1" />
        <div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Number Series (iCAFFE)</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Voucher, invoice and docket numbers as iCAFFE gives them - per branch, division and year ({d.fy}). The number is given on Save; a new financial year starts at 1.</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={{ ...inp, width: 200 }} value={branch} onChange={e => setBranch(e.target.value)}><option value="">All branches</option>{d.branches.map(b => <option key={b.branchCode} value={b.branchCode}>{b.branchCode} - {b.branchName}{b.icaffeCode ? ' (iCAFFE ' + b.icaffeCode + ')' : ''}</option>)}</select>
        <select style={{ ...inp, width: 170 }} value={div} onChange={e => setDiv(e.target.value)}><option value="">All divisions</option>{d.divisions.map(x => <option key={x} value={x}>{x} - {DIV_NAMES[x]}</option>)}</select>
        <button type="button" style={btn('#0369a1')} onClick={() => setAdd({ docType: d.docs[0].id, branchCode: branch || (d.branches[0] || {}).branchCode || '', division: div || 'AE', fyCode: d.fy, format: '', pad: 0, nextNo: 1 })}><Plus size={14} /> Add series</button>
        <button type="button" style={btn('#e2e8f0', '#0f172a')} onClick={load}><RotateCcw size={14} /> Reload</button>
        {msg && <span style={{ color: '#047857', fontWeight: 700, fontSize: 12.5 }}>{msg}</span>}
        {err && <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: 12.5 }}>{err}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: '#475569', display: 'flex', gap: 6, alignItems: 'center' }}><Info size={13} /> Format tags: {'{N}'} the number, {'{YY}'} year the FY starts (26), {'{FY}'} 2627, {'{DIV}'} AE / AI / SE / SI. Digits = zero padding of {'{N}'} (iCAFFE invoices use 7).</div>
      {add && (
        <div style={{ border: '1px solid #bae6fd', background: '#f0f9ff', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '2.4fr 1fr 1fr 0.8fr 1.6fr 0.6fr 0.9fr auto', gap: 8, alignItems: 'end' }}>
          <label style={{ fontSize: 11, fontWeight: 700 }}>Document<select style={inp} value={add.docType} onChange={e => setAdd({ ...add, docType: e.target.value })}>{d.docs.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          <label style={{ fontSize: 11, fontWeight: 700 }}>Branch<select style={inp} value={add.branchCode} onChange={e => setAdd({ ...add, branchCode: e.target.value })}>{d.branches.map(b => <option key={b.branchCode} value={b.branchCode}>{b.branchCode}</option>)}</select></label>
          <label style={{ fontSize: 11, fontWeight: 700 }}>Division<select style={inp} value={add.division} onChange={e => setAdd({ ...add, division: e.target.value })}><option value="">All (shared)</option>{d.divisions.map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          <label style={{ fontSize: 11, fontWeight: 700 }}>Year<input style={inp} value={add.fyCode} onChange={e => setAdd({ ...add, fyCode: e.target.value })} /></label>
          <label style={{ fontSize: 11, fontWeight: 700 }}>Format<input style={inp} value={add.format} placeholder="BA/NDL/AE/{N}" onChange={e => setAdd({ ...add, format: e.target.value.toUpperCase().replace(/\{(n|yy|fy|div)\}/gi, m => m.toUpperCase()) })} /></label>
          <label style={{ fontSize: 11, fontWeight: 700 }}>Digits<input style={inp} value={add.pad} onChange={e => setAdd({ ...add, pad: e.target.value })} /></label>
          <label style={{ fontSize: 11, fontWeight: 700 }}>Next No<input style={inp} value={add.nextNo} onChange={e => setAdd({ ...add, nextNo: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 6 }}><button type="button" style={btn('#16a34a')} onClick={create}><Save size={14} /> Add</button><button type="button" style={btn('#e2e8f0', '#0f172a')} onClick={() => setAdd(null)}>Cancel</button></div>
        </div>
      )}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead><tr style={{ background: '#f8fafc' }}>{['Document', 'Branch', 'Division', 'Year', 'Format', 'Digits', 'Next No', 'Next number', 'Last given', 'Source', 'Active', ''].map(hd => <th key={hd} style={{ ...cell, textAlign: 'left', fontSize: 11.5, color: '#475569' }}>{hd}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={12} style={{ ...cell, color: '#64748b', padding: 16 }}>No series for this branch / division. Without a series the old EagleView numbering is used; add the iCAFFE series here.</td></tr>}
            {rows.map(r => {
              const changed = !!edit[r.id];
              return (
                <tr key={r.id} style={{ background: r.fyCode === d.fy ? '#fff' : '#f8fafc', opacity: r.isActive ? 1 : 0.55 }}>
                  <td style={{ ...cell, fontWeight: 700 }}>{r.label}</td>
                  <td style={cell}>{r.branchCode}</td><td style={cell}>{r.division ? r.division + ' - ' + DIV_NAMES[r.division] : 'All (one counter)'}</td><td style={cell}>{r.fyCode}</td>
                  <td style={cell}><input style={{ ...inp, width: 170 }} value={E(r, 'format')} onChange={e => setE(r, 'format', e.target.value)} /></td>
                  <td style={cell}><input style={{ ...inp, width: 50 }} value={E(r, 'pad')} onChange={e => setE(r, 'pad', e.target.value)} /></td>
                  <td style={cell}><input style={{ ...inp, width: 90 }} value={E(r, 'nextNo')} onChange={e => setE(r, 'nextNo', e.target.value)} /></td>
                  <td style={{ ...cell, fontFamily: 'monospace', color: '#0369a1', fontWeight: 700 }}>{r.next || r.sample}</td>
                  <td style={{ ...cell, fontSize: 11.5 }}>{r.lastNo || ''}{r.lastDate ? <div style={{ color: '#64748b' }}>{r.lastDate}</div> : null}</td>
                  <td style={{ ...cell, fontSize: 11, color: '#64748b' }}>{r.source || ''}</td>
                  <td style={cell}><input type="checkbox" checked={!!Number(E(r, 'isActive'))} onChange={e => setE(r, 'isActive', e.target.checked ? 1 : 0)} /></td>
                  <td style={cell}><button type="button" disabled={!changed} style={{ ...btn(changed ? '#16a34a' : '#cbd5e1'), height: 26 }} onClick={() => save(r)}><Save size={13} /> Save</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
