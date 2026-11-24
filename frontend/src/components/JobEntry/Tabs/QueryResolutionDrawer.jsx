// Query Resolution drawer (Job Query / Export Query) - rebuilt 30-Oct-2026
// Before this the drawer showed a FIXED made-up query ("Please provide the updated Country of Origin Certificate ...
// Officer: ACC_MUM_001 | Time: 10 mins ago") for every job, a drop zone that uploaded nothing and a "Submit Reply to
// ICEGATE" button with no handler. Nothing on it was real.
// Now it shows what the job actually has: the ICEGATE status / unique id and the last acknowledgement (its message and
// error lines), plus the job's own remarks. The reply is saved to the job timeline (a real record the team sees) and
// can be copied for the ICEGATE portal - ICES has no API that accepts a query reply, so no button pretends to send one.
import React, { useEffect, useState } from 'react';
import { X, Save, Copy, Paperclip, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const auth = () => { const t = localStorage.getItem('token'); return t ? { Authorization: 'Bearer ' + t } : {}; };
const txt = (v) => (v === null || v === undefined ? '' : String(v));

// pulls the readable lines out of whatever the ICEGATE acknowledgement held
function ackLines(ack) {
  if (!ack) return [];
  const out = [];
  const walk = (v, key) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) return v.forEach(x => walk(x, key));
    if (typeof v === 'object') return Object.entries(v).forEach(([k, x]) => walk(x, k));
    const s = txt(v).trim();
    if (!s || s === 'null') return;
    if (/message|error|status|remark|reason|description|desc/i.test(txt(key))) out.push((/error/i.test(txt(key)) ? '⚠ ' : '') + s);
  };
  walk(ack.meta || ack, '');
  return [...new Set(out)].slice(0, 30);
}

export default function QueryResolutionDrawer({ isOpen, onClose, job, module = 'IMPORT' }) {
  const [replyText, setReplyText] = useState('');
  const [ack, setAck] = useState(null);
  const [remarks, setRemarks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const jobId = job?.id;

  const load = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        module === 'IMPORT' ? fetch('/api/icegate/be-ack/' + jobId, { headers: auth() }) : Promise.resolve(null),
        fetch('/api/timeline/' + module + '/' + jobId, { headers: auth() }),
      ]);
      if (a && a.ok) { const d = await a.json(); if (d.success) setAck(d); }
      if (t && t.ok) { const d = await t.json(); setRemarks(Array.isArray(d.data) ? d.data : []); }
    } catch (e) { /* offline: the drawer still opens, it just shows nothing */ }
    setLoading(false);
  };
  useEffect(() => { if (isOpen) { setReplyText(''); setAck(null); setRemarks([]); load(); } }, [isOpen, jobId]); // eslint-disable-line

  if (!isOpen) return null;

  const status = txt(ack?.icegateStatus || job?.icegateStatus);
  const lines = ackLines(ack?.ack);
  const queryRemarks = remarks.filter(r => /QUERY|REMARK/i.test(txt(r.eventType)));

  const saveReply = async () => {
    const msg = replyText.trim();
    if (!msg) { toast.error('Type the reply first'); return; }
    if (!jobId) { toast.error('Open the job from the list first'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/timeline', { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
        body: JSON.stringify({ jobId: String(jobId), module, eventType: 'REMARK', message: 'Query reply: ' + msg }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) throw new Error(d.error || ('HTTP ' + r.status));
      toast.success('Saved to the job timeline');
      setReplyText(''); load();
    } catch (e) { toast.error('Could not save: ' + e.message); }
    setBusy(false);
  };
  const copyReply = async () => {
    const msg = replyText.trim(); if (!msg) { toast.error('Type the reply first'); return; }
    try { await navigator.clipboard.writeText(msg); toast.success('Reply copied - paste it in the ICEGATE query reply box'); }
    catch (e) { toast.error('Could not copy - select the text and copy it'); }
  };

  const card = { borderRadius: '8px', padding: '1rem', fontSize: '12px' };
  return (
    <>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 0, right: 0, width: '460px', height: '100vh', background: 'var(--bg-panel, #fff)', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', zIndex: 50, display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color, #cbd5e1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-bg-light, #f8fafc)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="#dc2626" /> Query Resolution
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <RefreshCw size={15} color="var(--text-muted, #64748b)" style={{ cursor: 'pointer' }} title="Reload" onClick={load} />
            <X size={20} color="var(--text-muted, #64748b)" style={{ cursor: 'pointer' }} onClick={onClose} />
          </div>
        </div>

        <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div style={{ ...card, background: 'var(--primary-bg-light, #f8fafc)', border: '1px solid var(--border-color, #cbd5e1)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main, #0f172a)', marginBottom: '6px' }}>
              Job {txt(job?.jobNo) || '-'}{job?.beNo ? ' | BE ' + job.beNo : ''}
            </div>
            <div style={{ color: 'var(--text-muted, #475569)' }}>
              ICEGATE status: <strong>{status || 'not filed through the API'}</strong>
              {ack?.uniqueId ? <> &nbsp;|&nbsp; Unique id: <strong>{ack.uniqueId}</strong></> : null}
              {ack?.at ? <> &nbsp;|&nbsp; last answer {new Date(ack.at).toLocaleString('en-GB')}</> : null}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Last ICEGATE answer</label>
            <div style={{ ...card, marginTop: '0.5rem', background: lines.length ? '#fef2f2' : 'var(--bg-panel, #fff)', border: '1px solid ' + (lines.length ? '#fecaca' : 'var(--border-color, #cbd5e1)'), color: lines.length ? '#7f1d1d' : 'var(--text-muted, #64748b)' }}>
              {loading ? 'Loading...' : lines.length ? <ul style={{ margin: 0, paddingLeft: '1.1rem', lineHeight: 1.5 }}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
                : 'No acknowledgement stored for this job. An assessment query raised by the officer comes by e-mail / on the ICEGATE portal, not through the filing API - record it below so the team can see it.'}
            </div>
          </div>

          {queryRemarks.length > 0 && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Job remarks</label>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {queryRemarks.slice(-8).map((r) => (
                  <div key={r.id} style={{ ...card, padding: '8px 10px', background: 'var(--bg-panel, #fff)', border: '1px solid var(--border-color, #cbd5e1)' }}>
                    <div style={{ color: 'var(--text-main, #0f172a)', whiteSpace: 'pre-wrap' }}>{txt(r.message)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)', marginTop: '3px' }}>{txt(r.author)} | {r.createdAt ? new Date(r.createdAt).toLocaleString('en-GB') : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Your reply / note</label>
            <textarea className="input-field" style={{ minHeight: '120px', resize: 'vertical', padding: '0.75rem' }}
              placeholder="What was asked and what is being answered - saved on the job and copied for the ICEGATE reply box"
              value={replyText} onChange={(e) => setReplyText(e.target.value)} />
          </div>

          <div style={{ ...card, background: 'var(--bg-panel, #fff)', border: '1px dashed var(--border-color, #cbd5e1)', color: 'var(--text-muted, #64748b)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <Paperclip size={16} style={{ marginTop: '1px', flexShrink: 0 }} />
            <span>Documents asked for in a query are uploaded as e-Sanchit documents (Job Entry &gt; e-Sanchit), so that their IRN goes with the BE. There is no separate upload here.</span>
          </div>

        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color, #cbd5e1)', background: 'var(--bg-panel, #fff)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-secondary" onClick={copyReply} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Copy size={14} /> Copy reply</button>
          <button className="btn btn-primary" onClick={saveReply} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', borderColor: '#15803d', opacity: busy ? 0.6 : 1 }}>
            <Save size={14} /> {busy ? 'Saving...' : 'Save to job'}
          </button>
        </div>
      </div>
    </>
  );
}
