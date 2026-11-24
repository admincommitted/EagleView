// Field Tracking > Phone access (14-Nov-2026): the office code a phone needs to register, "old field app allowed",
// and which phones use the new app (own device token) or the old one. Admin changes; others only see.
import React from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, X, RefreshCw } from 'lucide-react';
import { apiFetch } from '../helpers';

const dt = (v) => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const newCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; const r = crypto.getRandomValues(new Uint32Array(8)); for (const n of r) s += A[n % A.length]; return s; };
const btn = (bg, fg, bd) => ({ padding: '6px 12px', background: bg, color: fg, border: '1px solid ' + (bd || bg), borderRadius: '6px', fontWeight: 600, fontSize: '12px', cursor: 'pointer' });

export default function PhoneAccessModal({ onClose }) {
  const [d, setD] = React.useState(null);
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(() => apiFetch('/device/settings').then(r => { setD(r.data); setCode(r.data.code || ''); }).catch(e => toast.error(e.message)), []);
  React.useEffect(() => { load(); }, [load]);
  const save = async (body, msg) => {
    setBusy(true);
    try { await apiFetch('/device/settings', { method: 'PUT', body: JSON.stringify(body) }); toast.success(msg); await load(); }
    catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const disconnect = async (a) => {
    if (!window.confirm(`Disconnect ${a.name}'s phone? It must register again with the office code.`)) return;
    try { await apiFetch(`/agents/${encodeURIComponent(a.id)}/disconnect`, { method: 'POST' }); toast.success('Phone disconnected'); load(); } catch (e) { toast.error(e.message); }
  };
  const admin = d && d.isAdmin;
  const oldCount = d ? d.agents.filter(a => !a.phoneSecure).length : 0;
  return createPortal(
    <div role="dialog" aria-label="Phone access" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '10px', width: 720, maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
          <ShieldCheck size={18} color="#2563eb" /><h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>Phone access</h3>
          <button type="button" aria-label="Refresh" onClick={load} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><RefreshCw size={15} /></button>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>
        {!d ? <div style={{ padding: '20px', fontSize: '12px', color: '#64748b' }}>Loading…</div> : (
          <div style={{ overflow: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12.5px', color: '#334155' }}>
            <section>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Office code</div>
              <div style={{ color: '#64748b', marginBottom: '8px' }}>A field boy opens the new field app, enters his mobile number and this code once. His phone then gets its own key and can send only his location and tasks.</div>
              {admin ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input aria-label="Office code" value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))} placeholder="6-20 letters / digits"
                    style={{ padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace', letterSpacing: '1px', width: '220px' }} />
                  <button type="button" style={btn('#fff', '#334155', '#cbd5e1')} onClick={() => setCode(newCode())}>New random code</button>
                  <button type="button" disabled={busy || code.length < 6} style={btn('#2563eb', '#fff')} onClick={() => save({ code }, 'Office code saved')}>Save code</button>
                  {d.codeSet && <span style={{ color: '#64748b' }}>Changing it does not disconnect phones already registered.</span>}
                </div>
              ) : <div>{d.codeSet ? 'Set (ask the admin for it).' : <b style={{ color: '#b91c1c' }}>Not set yet - ask the admin.</b>}</div>}
            </section>
            <section style={{ background: d.legacy ? '#fffbeb' : '#f0fdf4', border: '1px solid ' + (d.legacy ? '#fde68a' : '#bbf7d0'), borderRadius: '8px', padding: '10px 12px' }}>
              <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: admin ? 'pointer' : 'default' }}>
                <input type="checkbox" checked={!!d.legacy} disabled={!admin || busy} onChange={e => save({ legacy: e.target.checked }, e.target.checked ? 'Old field app allowed' : 'Old field app stopped')} style={{ marginTop: '2px' }} />
                <span><b>Allow the old field app</b> (no office code)<br />
                  <span style={{ color: '#64748b' }}>Keep this on until every field boy has the new app ({oldCount} of {d.agents.length} not registered yet). While on, old phones keep working but get no one's location or phone number; turn it off after the switch.</span></span>
              </label>
            </section>
            <section>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>Phones</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Field staff', 'Mobile', 'App', 'Old app last used', ''].map(h => <th key={h} style={{ textAlign: 'left', fontSize: '11px', color: '#64748b', padding: '6px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
                <tbody>{d.agents.map(a => (
                  <tr key={a.id}>
                    <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9' }}><b>{a.name}</b> <span style={{ color: '#94a3b8' }}>{a.id}</span></td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9' }}>{a.phone}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9' }}>{a.phoneSecure
                      ? <span style={{ color: '#15803d', fontWeight: 700 }}>New app (registered {dt(a.deviceIssuedAt)})</span>
                      : <span style={{ color: '#b45309', fontWeight: 700 }}>Old app / not registered</span>}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>{dt(a.lastLegacyAt) || '-'}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{admin && a.phoneSecure && <button type="button" style={btn('#fff', '#b91c1c', '#fca5a5')} onClick={() => disconnect(a)}>Disconnect phone</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </div>, document.body);
}
