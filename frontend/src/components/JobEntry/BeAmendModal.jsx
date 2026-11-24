// BE amendment window of the Job Entry - 10-Nov-2026 (the iCAFFE way; was a one-shot .be download since 29-Oct-2026).
// On a filed BE job: its amendments, and "New amendment" - takes the next amendment number (continues iCAFFE's
// series) and makes the amended job, a full copy of the BE job where the changes are made. The filed job is not touched.
// On an amended job: that amendment - what changed, codes, file (unsigned / signed / direct to ICEGATE).
import React from 'react';
import toast from 'react-hot-toast';
import askConfirm from '../common/askConfirm'; // 22-Nov-2026: EagleView question window in place of the browser's OK / Cancel box
import ModernDatePicker from '../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box (same YYYY-MM-DD value)
import { api, dmy, ymd } from '../BeAmendment/beAmendApi';
import AmendmentDetail, { StatusChip } from '../BeAmendment/AmendmentDetail';
import { defaultIcegateId, rememberIcegateId } from '../common/IcegateIdPickModal';

const lbl = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' };
const inp = { width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' };
const btn = (primary) => ({ padding: '7px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', ...(primary ? { background: '#0f766e', color: '#fff', border: '1px solid #0f766e' } : { background: '#fff', color: '#334155', border: '1px solid #cbd5e1' }) });

export default function BeAmendModal({ open, onClose, jobData, onOpenJob }) {
  const [list, setList] = React.useState(null);
  const [series, setSeries] = React.useState(null);
  const [codes, setCodes] = React.useState([]);
  const [showNew, setShowNew] = React.useState(false);
  const [f, setF] = React.useState({ beNo: '', beDate: '', reqLetterNo: '', reqLetterDate: '', reason: '', codes: [] });
  const [busy, setBusy] = React.useState(false);
  const [profileId, setProfileId] = React.useState(''); // ICEGATE ID of the amendment file (17-Nov-2026: was always the first / default one)
  const [err, setErr] = React.useState('');
  const jobId = jobData && jobData.id;
  const amendmentId = jobData && jobData._amendmentId ? Number(jobData._amendmentId) : null;

  const load = React.useCallback(async () => {
    if (!jobId) return;
    try {
      const [d, s] = await Promise.all([api('/by-job/' + jobId), api('/settings')]);
      setList(d); setSeries(s);
      setProfileId(defaultIcegateId((s && s.profiles) || [], jobData?.autoField_3 || jobData?.chaCode));
      setShowNew(!d.data.some(r => ['Draft', 'Ready'].includes(r.status)) && !amendmentId && d.data.length === 0);
    } catch (e) { setErr(e.message); }
  }, [jobId, amendmentId]);

  React.useEffect(() => {
    if (!open) return;
    setErr(''); setList(null);
    setF({ beNo: String(jobData?.beNo || jobData?.beNumber || ''), beDate: ymd(jobData?.beDate), reqLetterNo: '', reqLetterDate: new Date().toISOString().slice(0, 10), reason: '', codes: [] });
    api('/codes').then(d => setCodes(d.data || [])).catch(() => {});
    load();
  }, [open, jobId]); // eslint-disable-line

  if (!open) return null;
  const close = () => { if (!busy) onClose(); };
  const openJob = (id) => { onClose(); if (onOpenJob) onOpenJob(id); };

  const branch = String(jobData?.branchCode || '').toUpperCase();
  const s0 = series && (series.series || []).find(s => (!branch || s.branchCode === branch) && s.fyCode === series.fy) || (series && (series.series || [])[0]);
  const create = async () => {
    setErr('');
    const miss = [];
    if (!f.beNo.trim()) miss.push('BE No'); if (!f.beDate) miss.push('BE Date'); if (!f.reason.trim()) miss.push('Reason');
    if (miss.length) { setErr('Fill in: ' + miss.join(', ')); return; }
    if (!(await askConfirm({ title: 'Make the amended job?', message: `Amendment no ${s0 ? s0.nextNo : '(next)'} is taken for BE ${f.beNo}.`, okLabel: 'Make amended job', cancelLabel: 'Not now' }))) return;
    setBusy(true);
    try {
      if (profileId) rememberIcegateId(profileId);
      const d = await api('/', { method: 'POST', body: { importJobId: jobId, ...f, icegateProfileId: profileId || ((series && series.profiles) || [])[0]?.id || null } });
      toast.success(`Amendment ${d.data.amendNo} made - amended job ${d.amendedJobNo} opened. Make the changes there and save.`, { duration: 7000 });
      openJob(d.amendedJobId);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const rows = (list && list.data) || [];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div role="dialog" aria-label="BE amendment" style={{ background: '#f8fafc', borderRadius: '8px', width: '860px', maxWidth: '100%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px 8px 0 0' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>BE Amendment</h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {list && list.parent ? `BE job ${list.parent.jobNo} · BE ${list.parent.beNo || '-'} dt ${dmy(list.parent.beDate)}` : ''}
          </span>
          <a href="/be-amendments" onClick={(e) => { e.preventDefault(); onClose(); window.location.assign('/be-amendments'); }} style={{ marginLeft: 'auto', fontSize: '12px', color: '#1d4ed8' }}>Register</a>
          <button type="button" onClick={close} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: '20px', lineHeight: 1, cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '14px 16px' }}>
          {!jobId && <div style={{ fontSize: '12px', color: '#991b1b' }}>Save the job first.</div>}
          {err && <div style={{ padding: '8px', background: '#fef2f2', color: '#991b1b', borderRadius: '6px', marginBottom: '10px', fontSize: '12px' }}>{err}</div>}

          {amendmentId ? (
            <AmendmentDetail id={amendmentId} currentJobId={jobId} onOpenJob={openJob} onChanged={load} />
          ) : (
            <>
              {rows.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
                  <thead><tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Amend No</th><th style={{ padding: '6px 8px' }}>Date</th><th style={{ padding: '6px 8px' }}>Codes</th><th style={{ padding: '6px 8px' }}>Reason</th><th style={{ padding: '6px 8px' }}>Status</th><th />
                  </tr></thead>
                  <tbody>{rows.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 700 }}>{r.amendNo}</td>
                      <td style={{ padding: '6px 8px' }}>{dmy(r.amendDate)}</td>
                      <td style={{ padding: '6px 8px' }}>{(r.codes || []).join(', ') || '-'}</td>
                      <td style={{ padding: '6px 8px' }}>{r.reason}</td>
                      <td style={{ padding: '6px 8px' }}><StatusChip status={r.status} /></td>
                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.amendedJobId && r.status !== 'Void' && <button type="button" style={btn(false)} onClick={() => openJob(r.amendedJobId)}>Open amended job</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              {false && <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>No amendment for this BE yet.</div>}

              {!(showNew || (list && !rows.length)) ? (
                <button type="button" style={btn(true)} onClick={() => setShowNew(true)}>New amendment</button>
              ) : (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
                    <b style={{ fontSize: '13px' }}>New amendment</b>
                    <span style={{ fontSize: '12px', color: '#475569' }}>Number: <b style={{ fontSize: '15px', color: '#0f172a' }}>{s0 ? s0.nextNo : '…'}</b>{s0 ? ` (${s0.branchCode}/${s0.division}, FY ${s0.fyCode})` : ''}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                    <div><label style={lbl}>Filed BE No</label><input style={inp} value={f.beNo} maxLength={7} onChange={e => setF({ ...f, beNo: e.target.value.replace(/\D/g, '') })} /></div>
                    <div><label style={lbl}>BE Date</label><ModernDatePicker style={inp} value={f.beDate} onChange={e => setF({ ...f, beDate: e.target.value })} /></div>
                    <div><label style={lbl}>Request letter no</label><input style={inp} value={f.reqLetterNo} maxLength={30} onChange={e => setF({ ...f, reqLetterNo: e.target.value })} /></div>
                    <div><label style={lbl}>Request letter date</label><ModernDatePicker style={inp} value={f.reqLetterDate} onChange={e => setF({ ...f, reqLetterDate: e.target.value })} /></div>
                    <div><label style={lbl} title="Sender of the amendment file">ICEGATE ID</label>
                      <select style={inp} value={profileId} onChange={e => setProfileId(e.target.value)}>
                        {((series && series.profiles) || []).map(p => <option key={p.id} value={String(p.id)}>{p.loginId}{p.profileName && p.profileName !== p.loginId ? ' - ' + p.profileName : ''}</option>)}
                        {!((series && series.profiles) || []).length && <option value="">No ICEGATE ID set up</option>}
                      </select>
                    </div>
                  </div>
                  <label style={lbl}>Reason</label>
                  <input style={{ ...inp, marginBottom: '8px' }} value={f.reason} maxLength={120} placeholder="e.g. PRIOR TO FINAL" onChange={e => setF({ ...f, reason: e.target.value })} />
                  <label style={lbl}>Codes (can be ticked later, from the changes)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2px 12px', fontSize: '12px', marginBottom: '10px' }}>
                    {codes.map(c => (
                      <label key={c.code} style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={f.codes.includes(c.code)} onChange={() => setF({ ...f, codes: f.codes.includes(c.code) ? f.codes.filter(x => x !== c.code) : [...f.codes, c.code] })} />
                        <b style={{ minWidth: '70px', flex: 'none' }}>{c.code}</b><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.label}>{c.label}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>A copy of this job is made as the amended job. Make the changes there; the filed BE job stays as it is.</div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    {rows.length > 0 && <button type="button" style={btn(false)} disabled={busy} onClick={() => setShowNew(false)}>Cancel</button>}
                    <button type="button" style={btn(true)} disabled={busy || !jobId} onClick={create}>{busy ? 'Making…' : 'Make amendment'}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
