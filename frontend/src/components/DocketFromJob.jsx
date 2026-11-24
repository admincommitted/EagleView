// 05-Nov-2026: "Generate Docket No" on the customs job screens (Import BE, Export SB), as on iCAFFE.
// Shows the docket already made for the job (click to open it), or a button that makes it - then a message box
// with the new docket no. Backend: POST /api/shipments/from-job, GET /api/shipments/by-job.
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ship, Plane, CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';

export default function DocketFromJob({ side, job }) {
  const nav = useNavigate();
  const jobNo = job && job.jobNo && !/^draft$/i.test(job.jobNo) ? job.jobNo : '';
  const [docket, setDocket] = useState(null); const [busy, setBusy] = useState(false); const [box, setBox] = useState(null);
  const [ask, setAsk] = useState(false); const [branches, setBranches] = useState([]); const [branch, setBranch] = useState('');
  useEffect(() => {
    setDocket(null); if (!jobNo) return;
    fetch('/api/shipments/by-job?jobNo=' + encodeURIComponent(jobNo)).then(r => (r.ok ? r.json() : null)).then(setDocket).catch(() => setDocket(null));
  }, [jobNo]);
  const open = (d) => nav('/freight/shipment/' + String(d.division).toLowerCase() + '?docket=' + encodeURIComponent(d.docketNo));
  // iCAFFE "Register Shipment" popup: OK / Change Branch / Cancel
  const start = () => {
    if (!jobNo) { setBox({ bad: true, t: 'Save the job first - the docket is made from the saved job.' }); return; }
    setBranch(job.branchCode || ''); setAsk(true);
    if (!branches.length) fetch('/api/shipments/meta').then(r => r.json()).then(m => { setBranches(m.branches || []); if (!job.branchCode && m.branches && m.branches[0]) setBranch(m.branches[0].code); }).catch(() => null);
  };
  const make = async () => {
    setAsk(false); setBusy(true);
    try {
      const r = await fetch('/api/shipments/from-job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side, jobId: job.id, jobNo, branchCode: branch }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
      setDocket(j); setBox({ ok: true, t: j.message, d: j });
    } catch (e) { setBox({ bad: true, t: 'Docket not generated: ' + e.message }); }
    setBusy(false);
  };
  const Icon = docket && /^A/.test(docket.division || '') ? Plane : Ship;
  const pill = { marginLeft: '6px', padding: '1px 8px', fontSize: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 };
  return (
    <>
      <span style={{ color: 'var(--border-color, #cbd5e1)' }}>|</span>
      {docket ? (
        <span onClick={() => open(docket)} title="Open the freight docket (Shipment Registration)" style={{ ...pill, background: '#ecfdf5', border: '1px solid #10b981', color: '#047857' }}>
          <Icon size={11} /> DOCKET: {docket.docketNo}{docket.currentStatus ? ' - ' + docket.currentStatus : ''}
        </span>
      ) : (
        <button type="button" onClick={start} disabled={busy} title={jobNo ? 'Make the freight docket of this job (Shipment Registration)' : 'Save the job first'}
          style={{ ...pill, background: jobNo ? '#eff6ff' : '#f1f5f9', border: '1px solid ' + (jobNo ? '#3b82f6' : '#cbd5e1'), color: jobNo ? '#1d4ed8' : '#64748b' }}>
          {busy ? 'Registering...' : '+ Register Shipment (Docket No)'}
        </button>
      )}
      {ask && (
        <div onClick={() => setAsk(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, minWidth: 380, padding: '16px 20px', boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Register Shipment</div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>Make the freight docket of {side === 'Export' ? 'shipping bill' : 'BE'} job <b>{jobNo}</b> (Shipment Registration, {side} {/^A/i.test(String(job.shipmentMode || job.modeOfTransport || '')) ? 'Air' : 'Sea'}).</div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Change Branch</label>
            <select value={branch} onChange={e => setBranch(e.target.value)} style={{ width: '100%', height: 30, border: '1px solid #94a3b8', borderRadius: 5, padding: '0 6px', margin: '3px 0 14px' }}>
              {!branches.some(b => b.code === branch) && branch && <option value={branch}>{branch}</option>}
              {branches.map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setAsk(false)} style={{ padding: '6px 14px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
              <button type="button" onClick={make} style={{ padding: '6px 18px', border: 'none', borderRadius: 6, background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Ok</button>
            </div>
          </div>
        </div>
      )}
      {box && (
        <div onClick={() => setBox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 10, minWidth: 380, maxWidth: 520, padding: '18px 20px', boxShadow: '0 20px 50px rgba(0,0,0,.25)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><span style={{ cursor: 'pointer', color: '#64748b' }} onClick={() => setBox(null)}><X size={16} /></span></div>
            {box.ok && <CheckCircle2 size={38} color="#16a34a" />}
            <div style={{ fontSize: 13, fontWeight: 700, color: box.bad ? '#b91c1c' : '#0f172a', margin: '8px 0' }}>{box.t}</div>
            {box.d && <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.5px', color: '#1d4ed8', margin: '6px 0 14px' }}>{box.d.docketNo}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {box.d && <button type="button" onClick={() => { try { navigator.clipboard.writeText(box.d.docketNo); } catch (e) { /* ignore */ } }} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, display: 'inline-flex', gap: 5, alignItems: 'center' }}><Copy size={13} /> Copy</button>}
              {box.d && <button type="button" onClick={() => { setBox(null); open(box.d); }} style={{ padding: '6px 12px', border: 'none', borderRadius: 6, background: '#1d4ed8', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'inline-flex', gap: 5, alignItems: 'center' }}><ExternalLink size={13} /> Open Docket</button>}
              <button type="button" onClick={() => setBox(null)} style={{ padding: '6px 16px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
