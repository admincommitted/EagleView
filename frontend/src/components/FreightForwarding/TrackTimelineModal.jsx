import React, { useEffect, useState, useCallback } from 'react';
import { X, ExternalLink, Plus, Trash2, RefreshCw } from 'lucide-react';

// Full status history of one AWB / HAWB, with "add milestone by hand" (29-Oct-2026).
// Data: GET /api/awb/tracking/events, POST /api/awb/tracking/event, DELETE /api/awb/tracking/event/:id
const CODES = [['RCS', 'Received by airline'], ['FOH', 'Freight on hand'], ['FMA', 'Accepted (FMA)'], ['FNA', 'Rejected (FNA)'], ['DEP', 'Departed'], ['TFD', 'Transferred'], ['ARR', 'Arrived'], ['RCF', 'Received at destination'], ['NFD', 'Consignee notified'], ['DLV', 'Delivered']];
const COLOR = { FNA: '#dc2626', FMA: '#2563eb', RCS: '#059669', FOH: '#059669', DEP: '#7c3aed', TFD: '#7c3aed', ARR: '#0891b2', RCF: '#0891b2', NFD: '#0891b2', DLV: '#15803d' };
const fmt = (v) => { const d = new Date(v); return isNaN(d) ? String(v || '-') : d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const nowLocal = () => { const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
const inp = { padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', width: '100%', boxSizing: 'border-box' };
const lab = { fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '2px', display: 'block' };

export default function TrackTimelineModal({ awbNumber, hawbNumber, onClose, onChanged, onOpenAwb }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ code: 'RCS', eventAt: nowLocal(), station: '', flight: '', pieces: '', weight: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ awbNumber, ...(hawbNumber ? { hawbNumber } : {}) });
      const r = await fetch(`/api/awb/tracking/events?${qs}`);
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Could not load');
      setD(j); setErr('');
    } catch (e) { setErr(e.message); }
  }, [awbNumber, hawbNumber]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);

  const add = async () => {
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/awb/tracking/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ awbNumber, hawbNumber: hawbNumber || undefined, ...form, eventAt: new Date(form.eventAt).toISOString() }) });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Could not save');
      setMsg(`${form.code} saved${j.event && j.event.notified ? ' · ' + j.event.notified : ''}`);
      setForm((f) => ({ ...f, station: '', flight: '', pieces: '', weight: '', note: '' }));
      await load(); if (onChanged) onChanged();
    } catch (e) { setMsg('Error: ' + e.message); } finally { setSaving(false); }
  };
  const remove = async (ev) => {
    if (!window.confirm(`Remove ${ev.code} of ${fmt(ev.eventAt)} (entered by ${ev.user || 'hand'})?`)) return;
    const r = await fetch(`/api/awb/tracking/event/${ev.id}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? `${ev.code} removed` : 'Error: ' + (j.error || 'could not remove'));
    await load(); if (onChanged) onChanged();
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-label="Shipment history" style={{ background: '#fff', borderRadius: '8px', width: 'min(920px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '15px' }}>{hawbNumber ? `HAWB ${hawbNumber}` : `AWB ${awbNumber}`}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{hawbNumber ? `MAWB ${awbNumber} · ` : ''}{d && d.airline ? `${d.airline.name} (${d.airline.prefix})` : ''}</div>
          </div>
          {d && d.airlineTrackingUrl && <a href={d.airlineTrackingUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2563eb', fontWeight: 700 }}>Airline tracking <ExternalLink size={13} /></a>}
          {onOpenAwb && <button onClick={onOpenAwb} style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Open AWB</button>}
          <button onClick={load} title="Reload" style={{ border: 'none', background: 'none', cursor: 'pointer' }}><RefreshCw size={16} /></button>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '12px 16px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(240px, 2fr)', gap: '16px' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase' }}>Status history</div>
            {err && <div style={{ color: '#dc2626', fontSize: '12px' }}>{err}</div>}
            {!d && !err && <div style={{ fontSize: '12px', color: '#64748b' }}>Loading...</div>}
            {d && !d.events.length && <div style={{ fontSize: '12px', color: '#64748b' }}>No status received yet. FSUs from the airline appear here; you can also add one by hand.</div>}
            {d && d.events.map((ev, i) => (
              <div key={ev.id} style={{ display: 'flex', gap: '10px', position: 'relative', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: COLOR[ev.code] || '#64748b', marginTop: '3px' }} />
                  {i < d.events.length - 1 && <div style={{ flex: 1, width: '2px', background: '#e2e8f0' }} />}
                </div>
                <div style={{ flex: 1, fontSize: '12px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <b style={{ color: COLOR[ev.code] || '#0f172a' }}>{ev.code}</b><span>{ev.name}</span>
                    <span style={{ color: '#64748b' }}>{fmt(ev.eventAt)}</span>
                    {ev.scope === 'MAWB' && hawbNumber && <span style={{ fontSize: '10px', background: '#eef2ff', color: '#4338ca', padding: '0 5px', borderRadius: '6px' }}>MAWB</span>}
                    <span style={{ fontSize: '10px', background: ev.source === 'MANUAL' ? '#fef3c7' : '#ecfdf5', color: ev.source === 'MANUAL' ? '#b45309' : '#047857', padding: '0 5px', borderRadius: '6px' }}>{ev.source === 'MANUAL' ? `BY HAND · ${ev.user || ''}` : 'AIRLINE FSU'}</span>
                    {ev.source === 'MANUAL' && <button onClick={() => remove(ev)} title="Remove this milestone" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}><Trash2 size={12} /></button>}
                  </div>
                  <div style={{ color: '#475569' }}>{[ev.station && `Station ${ev.station}`, ev.flight && `Flight ${ev.flight}`, ev.pieces != null && `${ev.pieces} pcs`, ev.weight != null && `${ev.weight} kg`].filter(Boolean).join(' · ')}</div>
                  {ev.note && <div style={{ color: '#64748b', fontStyle: 'italic' }}>{ev.note}</div>}
                  {ev.notified && <div style={{ color: /FAILED|ERROR/.test(ev.notified) ? '#dc2626' : '#059669', fontSize: '10px' }}>Customer update: {ev.notified}</div>}
                </div>
              </div>
            ))}
            {d && d.logs && d.logs.length > 0 && (
              <details style={{ marginTop: '8px' }}>
                <summary style={{ fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>AWB log ({d.logs.length})</summary>
                {d.logs.map((l, i) => <div key={i} style={{ fontSize: '11px', color: '#475569', padding: '2px 0' }}>{fmt(l.at)} · {l.action} · {l.user} · {l.details}</div>)}
              </details>
            )}
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', alignSelf: 'start' }}>
            <div style={{ fontWeight: 800, fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={13} /> Add milestone by hand</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={lab}>Milestone</label>
                <select value={form.code} onChange={set('code')} style={inp}>{CODES.map(([c, n]) => <option key={c} value={c}>{c} - {n}</option>)}</select></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lab}>Date &amp; time</label><input type="datetime-local" value={form.eventAt} max={nowLocal()} onChange={set('eventAt')} style={inp} /></div>
              <div><label style={lab}>Station</label><input value={form.station} maxLength={3} placeholder="DEL" onChange={(e) => setForm((f) => ({ ...f, station: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))} style={inp} /></div>
              <div><label style={lab}>Flight</label><input value={form.flight} maxLength={10} placeholder="EK511" onChange={(e) => setForm((f) => ({ ...f, flight: e.target.value.toUpperCase() }))} style={inp} /></div>
              <div><label style={lab}>Pieces</label><input value={form.pieces} inputMode="numeric" onChange={(e) => setForm((f) => ({ ...f, pieces: e.target.value.replace(/\D/g, '') }))} style={inp} /></div>
              <div><label style={lab}>Weight kg</label><input value={form.weight} inputMode="decimal" onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value.replace(/[^\d.]/g, '') }))} style={inp} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lab}>Note</label><input value={form.note} maxLength={300} placeholder="e.g. confirmed by airline on phone" onChange={set('note')} style={inp} /></div>
            </div>
            <button onClick={add} disabled={saving || !form.eventAt} style={{ marginTop: '10px', width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save milestone'}</button>
            {msg && <div style={{ marginTop: '6px', fontSize: '11px', color: msg.startsWith('Error') ? '#dc2626' : '#059669' }}>{msg}</div>}
            <div style={{ marginTop: '6px', fontSize: '10px', color: '#64748b' }}>Only milestones entered by hand can be removed. Airline FSUs stay.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
