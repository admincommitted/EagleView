// ICEGATE reply (acknowledgement) of a BE filed through the API, 29-Oct-2026. "Sent to ICEGATE" only means the file
// was taken; this window asks ICEGATE (getAck) what ICES answered: BE No / Date, or the error list, or still pending.
// The server also asks on its own every 10 minutes for 3 days after filing.
// 17-Nov-2026: asks with the ICEGATE ID the BE was sent with (another ID gets "Authorization failed"); "Ask as" picks
// another one. A job with no Unique ID (sent before the "accepted shown as failed" fix) takes the Unique ID from the
// ICEGATE mail - it is kept on the job when ICEGATE answers for it. Every new answer also goes to the job log.
import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';

const COLOR = { accepted: '#15803d', rejected: '#b91c1c', pending: '#b45309', error: '#b91c1c', unknown: '#475569' };
const LABEL = { accepted: 'ACCEPTED BY ICES', rejected: 'REJECTED BY ICEGATE', pending: 'STILL PENDING AT ICEGATE', error: 'COULD NOT ASK ICEGATE', unknown: 'ANSWER RECEIVED - read it below' };

// kind 'SB': the same window for a Shipping Bill (export job, /api/icegate/sb-ack), 17-Nov-2026
export default function IcegateAckModal({ open, onClose, jobId, uniqueId, onResult, kind = 'BE' }) {
  const K = kind === 'SB' ? 'SB' : 'BE';
  const EP = '/api/icegate/' + (K === 'SB' ? 'sb-ack' : 'be-ack');
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState(null); // { state, message, beNo, beDate, errors, ackText, at }
  const [showRaw, setShowRaw] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [askAs, setAskAs] = useState('');       // '' = the ICEGATE ID the BE was sent with
  const [typedId, setTypedId] = useState('');   // Unique ID from the ICEGATE mail, for a job that has none
  const uid = uniqueId || (r && r.uniqueId) || '';

  const load = async () => {
    if (!jobId) return;
    try {
      const d = await fetch(EP + '/' + jobId).then(x => x.json());
      if (d.success && d.ack && d.ack.interp) setR({ ...d.ack.interp, ackText: d.ack.ackText, at: d.ack.at, senderId: d.ack.senderId, uniqueId: d.ack.uniqueId, beNoJob: K === 'SB' ? d.sbNo : d.beNo, beDateJob: K === 'SB' ? d.sbDate : d.beDate, icegateStatus: d.icegateStatus });
    } catch (e) { /* nothing stored yet */ }
  };
  const ask = async () => {
    if (!jobId) { toast.error('Save the job first'); return; }
    const typed = typedId.trim();
    if (!uid && !typed) { toast.error('Type the Unique ID from the ICEGATE mail'); return; }
    setBusy(true);
    try {
      const d = await fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId, profileId: askAs || undefined, uniqueId: uid ? undefined : typed }) }).then(x => x.json());
      if (!d.success) { toast.error(d.error || 'ICEGATE did not answer'); setBusy(false); return; }
      setR({ ...d, at: new Date().toISOString(), beNoJob: d.job && (K === 'SB' ? d.job.sbNo : d.job.beNo), beDateJob: d.job && (K === 'SB' ? d.job.sbDate : d.job.beDate), icegateStatus: d.job && d.job.icegateStatus, uniqueId: d.saved === false ? '' : d.uniqueId });
      if (d.saved === false) { toast.error('ICEGATE did not answer for this Unique ID with this ICEGATE ID - it was not kept on the job. Check the ID, or pick the ICEGATE ID the ' + K + ' was sent with.', { duration: 9000 }); return; }
      if (onResult) onResult(d);
      if (d.state === 'error') toast.error('Could not ask ICEGATE: ' + (d.message || 'no answer'));
      else if (d.state === 'accepted') toast.success(`${K} ${d.beNo || d.sbNo || d.job?.beNo || d.job?.sbNo || ''} accepted by ICES`);
      else if (d.state === 'rejected') toast.error(`ICEGATE rejected the ${K}: ${d.errors.length} error(s)`);
      else toast(d.message || 'No final answer yet - try again in a few minutes', { icon: '⏳' });
    } catch (e) { toast.error('Could not ask ICEGATE: ' + e.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { if (open) { setR(null); setShowRaw(false); setTypedId(''); load(); } }, [open, jobId]); // eslint-disable-line
  useEffect(() => {
    if (!open || profiles.length) return;
    fetch('/api/icegate-profiles').then(x => x.json()).then(j => { if (j && j.success) setProfiles(j.data || []); }).catch(() => {});
  }, [open]); // eslint-disable-line
  if (!open) return null;
  const st = r ? r.state : null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-label="ICEGATE reply" style={{ background: '#fff', borderRadius: '8px', width: '640px', maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <div><strong style={{ fontSize: '15px', color: '#0f172a' }}>ICEGATE reply (acknowledgement)</strong><div style={{ fontSize: '11px', color: '#64748b' }}>Unique ID {uid || '-'}{r && r.senderId ? ` · asked as ${r.senderId}` : ''}{r && r.at ? ` · last asked ${new Date(r.at).toLocaleString('en-GB')}` : ''}</div></div>
          <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div style={{ padding: '14px 16px', overflowY: 'auto', display: 'grid', gap: '10px' }}>
          {!uid && (
            <div style={{ fontSize: '12px', color: '#92400e', background: '#fffbeb', padding: '8px 10px', borderRadius: '6px', display: 'grid', gap: '6px' }}>
              <div>No ICEGATE Unique ID on this job. If the {K} was sent to ICEGATE, type the Unique ID from the ICEGATE mail (for example 120823330511717112026{K === 'SB' ? 'CACHE01' : 'CACHI01'}) and pick the ICEGATE ID it was sent with. A {K} filed by file upload has no Unique ID - read the ICEGATE mail / portal.</div>
              <input value={typedId} onChange={e => setTypedId(e.target.value.replace(/\s+/g, ''))} placeholder="Unique ID from the ICEGATE mail" aria-label="Unique ID" style={{ height: '30px', padding: '0 8px', border: '1px solid #fcd34d', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }} />
            </div>
          )}
          <label style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Ask as
            <select value={askAs} onChange={e => setAskAs(e.target.value)} style={{ height: '28px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '0 6px', flex: 1 }}>
              <option value="">{uid ? 'The ICEGATE ID the ' + K + ' was sent with' : 'Default ICEGATE ID'}</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.loginId}{p.profileName ? ' - ' + p.profileName : ''}</option>)}
            </select>
          </label>
          {r && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', background: '#f8fafc' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: COLOR[st] || '#475569' }}>{LABEL[st] || st}</div>
              {r.message && <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>{r.message}</div>}
              {(r.beNo || r.sbNo || r.beNoJob) && <div style={{ fontSize: '13px', marginTop: '6px' }}>{K} No <strong>{r.beNo || r.sbNo || r.beNoJob}</strong>{(r.beDate || r.sbDate || r.beDateJob) ? <> · {K} Date <strong>{r.beDate || r.sbDate || r.beDateJob}</strong></> : null}{(r.beNo || r.sbNo) ? <span style={{ fontSize: '11px', color: '#64748b' }}> (put in the job)</span> : null}</div>}
              {r.errors && r.errors.some(e => e.text !== r.message || e.code) && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '8px' }}>
                  <thead><tr style={{ background: '#fee2e2' }}><th style={{ textAlign: 'left', padding: '4px 8px', width: '80px' }}>Code</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Error</th></tr></thead>
                  <tbody>{r.errors.map((e, i) => <tr key={i}><td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{e.code || e.key || ''}</td><td style={{ padding: '4px 8px', borderBottom: '1px solid #f1f5f9' }}>{e.text}</td></tr>)}</tbody>
                </table>
              )}
              {r.ackText && (
                <div style={{ marginTop: '8px' }}>
                  <button type="button" onClick={() => setShowRaw(v => !v)} style={{ fontSize: '11px', background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', padding: 0 }}>{showRaw ? 'Hide' : 'Show'} the full answer from ICEGATE</button>
                  {showRaw && <pre style={{ fontSize: '10px', background: '#0f172a', color: '#e2e8f0', padding: '8px', borderRadius: '6px', maxHeight: '240px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{(() => { try { return JSON.stringify(JSON.parse(r.ackText), null, 2); } catch (e) { return r.ackText; } })()}</pre>}
                </div>
              )}
            </div>
          )}
          {!r && uid && <div style={{ fontSize: '12px', color: '#64748b' }}>No answer stored yet. Click "Ask ICEGATE now" - ICES usually answers within a few minutes of filing.</div>}
          <div style={{ fontSize: '11px', color: '#64748b' }}>Pending states ("validation in progress", "acknowledgment generation in progress") mean ask again later. "DSC validation failed" or "rejected during system validation" mean the file itself was refused - fix and send again. A rejection with error codes: correct the job and send a fresh {K}.</div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" onClick={onClose} style={{ height: '30px', padding: '0 14px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Close</button>
          <button type="button" onClick={ask} disabled={busy || (!uid && !typedId.trim())} style={{ height: '30px', padding: '0 16px', background: busy || (!uid && !typedId.trim()) ? '#94a3b8' : '#0284c7', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><RefreshCw size={13} className={busy ? 'spin' : ''} /> {busy ? 'Asking ICEGATE…' : 'Ask ICEGATE now'}</button>
        </div>
      </div>
    </div>
  );
}
