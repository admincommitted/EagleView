// 10-Nov-2026: "Register Shipment" from the job list (click UN-REGISTERED in the Docket No column).
// Same as the button on the job screen (DocketFromJob): choose / change the branch, OK -> docket no made and the
// shipment entered in Shipment Registration (POST /api/shipments/from-job). onDone(docket) updates the list row.
import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';

export const docketPath = (division, docketNo) => '/freight/shipment/' + String(division || 'AI').toLowerCase() + '?docket=' + encodeURIComponent(docketNo);

export default function DocketRegisterModal({ side = 'Import', job, onClose, onDone, onOpen }) {
  const [branches, setBranches] = useState([]); const [branch, setBranch] = useState(job.branchCode || '');
  const [busy, setBusy] = useState(false); const [box, setBox] = useState(null);
  useEffect(() => {
    fetch('/api/shipments/meta').then(r => r.json()).then(m => { setBranches(m.branches || []); if (!job.branchCode && m.branches && m.branches[0]) setBranch(m.branches[0].code); }).catch(() => null);
  }, []); // eslint-disable-line
  const make = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/shipments/from-job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side, jobId: job.id, jobNo: job.jobNo, branchCode: branch }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      setBox({ ok: true, t: j.message, d: j }); if (onDone) onDone(j);
    } catch (e) { setBox({ bad: true, t: 'Docket not generated: ' + e.message }); }
    setBusy(false);
  };
  const air = /^A/i.test(String(job.shipmentMode || job.modeOfTransport || ''));
  const btn = { padding: '6px 14px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', fontSize: 12 };
  return (
    <div onClick={() => !busy && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Register shipment" style={{ background: '#fff', borderRadius: 10, width: 420, maxWidth: '100%', padding: '16px 20px', boxShadow: '0 20px 50px rgba(0,0,0,.25)', textAlign: box ? 'center' : 'left' }}>
        {!box ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Register Shipment</div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>
              Make the freight docket of {side === 'Export' ? 'shipping bill' : 'BE'} job <b>{job.jobNo}</b>{job.importer ? <> ({job.importer})</> : null} - Shipment Registration, {side} {air ? 'Air' : 'Sea'}.
            </div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Branch</label>
            <select value={branch} onChange={e => setBranch(e.target.value)} style={{ width: '100%', height: 30, border: '1px solid #94a3b8', borderRadius: 5, padding: '0 6px', margin: '3px 0 14px' }}>
              {!branches.some(b => b.code === branch) && branch && <option value={branch}>{branch}</option>}
              {branches.map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} disabled={busy} style={btn}>Cancel</button>
              <button type="button" onClick={make} disabled={busy} style={{ ...btn, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, padding: '6px 18px' }}>{busy ? 'Registering...' : 'Ok'}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={{ cursor: 'pointer', color: '#64748b' }} onClick={onClose}><X size={16} /></span></div>
            {box.ok && <CheckCircle2 size={38} color="#16a34a" />}
            <div style={{ fontSize: 13, fontWeight: 700, color: box.bad ? '#b91c1c' : '#0f172a', margin: '8px 0' }}>{box.t}</div>
            {box.d && <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.5px', color: '#1d4ed8', margin: '6px 0 14px' }}>{box.d.docketNo}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {box.d && <button type="button" onClick={() => { try { navigator.clipboard.writeText(box.d.docketNo); } catch (e) { /* ignore */ } }} style={{ ...btn, background: '#fff', display: 'inline-flex', gap: 5, alignItems: 'center' }}><Copy size={13} /> Copy</button>}
              {box.d && onOpen && <button type="button" onClick={() => onOpen(box.d)} style={{ ...btn, border: 'none', background: '#1d4ed8', color: '#fff', display: 'inline-flex', gap: 5, alignItems: 'center' }}><ExternalLink size={13} /> Open Docket</button>}
              <button type="button" onClick={onClose} style={{ ...btn, fontWeight: 700 }}>OK</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
