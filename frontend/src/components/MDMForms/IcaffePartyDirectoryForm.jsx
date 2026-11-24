// 04-Nov-2026: iCAFFE Party Directory - exporters, consignees, sub agents, overseas agents, shipping lines, IATA agents
// and banks read from iCAFFE. Search here; "Add to Party Master" copies the party (with its addresses / AD codes) into
// the Party master so the job screens can use it.
import React, { useEffect, useRef, useState } from 'react';
import { Search, Database, UserPlus, CheckCircle2 } from 'lucide-react';

const TYPES = [
  ['', 'All types'], ['EXPORTER', 'Exporter / Importer'], ['CONSIGNEE', 'Consignee / Supplier'], ['SUBAGENT', 'Sub Agent'],
  ['OVERSEAS_AGENT', 'Overseas Agent'], ['SHIPLINE', 'Shipline'], ['IATA_AGENT', 'IATA Agent'], ['BANK', 'Bank BRO']
];
const LABEL = Object.fromEntries(TYPES);
// IATA agents are kept in the IATA Agent Master (Masters > IATA Agent Master), not in the Party master
const IMPORTABLE = ['EXPORTER', 'CONSIGNEE', 'SUBAGENT', 'OVERSEAS_AGENT', 'SHIPLINE'];
const th = { padding: '8px 10px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #475569)', textTransform: 'uppercase', borderBottom: '2px solid var(--border-color, #e2e8f0)' };
const td = { padding: '7px 10px', fontSize: '12px', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-main, #0f172a)', verticalAlign: 'top' };

export default function IcaffePartyDirectoryForm() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const timer = useRef(null);

  useEffect(() => { fetch('/api/icaffe-parties/stats').then(r => r.json()).then(setStats).catch(() => setStats(null)); }, []);

  const search = (text, t) => {
    setBusy(true);
    fetch(`/api/icaffe-parties?q=${encodeURIComponent(text)}&type=${t}&limit=100`)
      .then(r => r.json()).then(d => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([])).finally(() => setBusy(false));
  };
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q.trim(), type), q.trim().length ? 300 : 0);
    return () => clearTimeout(timer.current);
  }, [q, type]);

  const addToMaster = async (r) => {
    setMsg('');
    const res = await fetch(`/api/icaffe-parties/${r.id}/import`, { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg('Not added: ' + (d.error || 'HTTP ' + res.status)); return; }
    setMsg((d.created ? 'Added to Party Master: ' : 'Already in Party Master, linked: ') + d.name);
    const upd = { ...r, importedPartyId: d.partyId };
    setRows(list => list.map(x => (x.id === r.id ? upd : x)));
    if (sel && sel.id === r.id) setSel(upd);
  };

  const total = stats && stats.types ? stats.types.reduce((s, t) => s + t.n, 0) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#134e4a', textTransform: 'uppercase' }}>
          <Database size={18} color="#0f766e" /> iCAFFE Party Directory
        </h3>
        {stats && stats.loaded === false && <div style={{ fontSize: 12, color: '#b45309' }}>Not loaded yet - run load_icaffe_parties.bat.</div>}
        {stats && stats.types && stats.types.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, marginBottom: 10 }}>
            <span style={{ fontWeight: 700 }}>{total.toLocaleString('en-IN')} parties:</span>
            {stats.types.map(t => (
              <span key={t.partyType} style={{ background: 'var(--bg-input, #f1f5f9)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 10, padding: '1px 8px' }}>
                {LABEL[t.partyType] || t.partyType} {Number(t.n).toLocaleString('en-IN')}{t.imported ? ` (${t.imported} in Party Master)` : ''}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#64748b' }} />
            <input className="input-field" style={{ width: '100%', paddingLeft: 28 }} placeholder="Name, iCAFFE code, IEC, PAN or GSTIN" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="input-field" value={type} onChange={e => setType(e.target.value)} style={{ width: 180 }}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {busy && <span style={{ fontSize: 11, color: '#64748b' }}>Searching...</span>}
        </div>
        {msg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: msg.startsWith('Not') ? '#b91c1c' : '#15803d' }}>{msg}</div>}
      </div>

      <div style={{ display: 'flex', gap: '1rem', flex: 1, minHeight: 0, flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ flex: '2 1 480px', overflow: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Code</th><th style={th}>Name</th><th style={th}>Type</th><th style={th}>IEC / GSTIN</th><th style={th}>City</th><th style={th}></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} onClick={() => setSel(r)} style={{ cursor: 'pointer', background: sel && sel.id === r.id ? 'rgba(13,148,136,0.08)' : 'transparent' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>{r.code}</td>
                  <td style={td}>{r.name}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{LABEL[r.partyType] || r.partyType}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.iec || r.gstin || ''}</td>
                  <td style={td}>{[r.city, r.state].filter(Boolean).join(', ')}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {IMPORTABLE.includes(r.partyType) && (r.importedPartyId
                      ? <span style={{ color: '#15803d', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}><CheckCircle2 size={13} /> In Party Master</span>
                      : <button type="button" className="btn" onClick={e => { e.stopPropagation(); addToMaster(r); }} style={{ fontSize: 11, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#0d9488', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}><UserPlus size={12} /> Add to Party Master</button>)}
                  </td>
                </tr>
              ))}
              {!rows.length && !busy && <tr><td colSpan="6" style={{ ...td, textAlign: 'center', color: '#64748b', padding: 24 }}>{q ? 'No match.' : 'Type a name to search.'}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="glass-panel" style={{ flex: '1 1 300px', overflow: 'auto', padding: '1rem', fontSize: 12 }}>
          {!sel ? <div style={{ color: '#64748b' }}>Select a party to see its addresses.</div> : (
            <>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{sel.name}</div>
              <div style={{ color: '#64748b', marginBottom: 8 }}>{sel.code} - {LABEL[sel.partyType] || sel.partyType}</div>
              {sel.iec && <div><b>IEC:</b> {sel.iec}</div>}
              {sel.pan && <div><b>PAN:</b> {sel.pan}</div>}
              {sel.classType && <div><b>Class:</b> {sel.classType}</div>}
              {(sel.addresses || []).map((a, i) => (
                <div key={i} style={{ marginTop: 8, padding: 8, border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 6 }}>
                  <div style={{ fontWeight: 600 }}>{a.branchName || 'Address ' + (i + 1)}{a.isDefault ? ' (default)' : ''}</div>
                  <div>{[a.address1, a.address2].filter(Boolean).join(', ')}</div>
                  <div>{[a.city, a.state, a.pinCode, a.country].filter(Boolean).join(', ')}</div>
                  {a.gstin && <div>GSTIN: {a.gstin}</div>}
                  {(a.phone || a.mobile) && <div>Phone: {[a.phone, a.mobile].filter(Boolean).join(' / ')}</div>}
                  {a.email1 && <div>Email: {a.email1}</div>}
                  {a.contactPerson && <div>Contact: {a.contactPerson}</div>}
                </div>
              ))}
              {(sel.adCodes || []).length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700 }}>AD codes</div>
                  {sel.adCodes.map((c, i) => <div key={i}>{c.adCode} {c.bankName ? '- ' + c.bankName : ''} {c.port ? '(' + c.port + ')' : ''}</div>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
