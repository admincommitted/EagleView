// One BE amendment: details, what changed against the filed BE, codes, and the file -
// make, download unsigned / signed, sign on the DSC token, send to ICEGATE by mail, ICEGATE reply, void.
// Used by the Job Entry amendment window and the Customs > BE Amendments register. 10-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { askText } from '../common/askConfirm'; // EagleView input window, 20-Nov-2026
import { api, downloadFile, STATUS_STYLE, dmy, ymd, MODE_LABEL } from './beAmendApi';

const ACT = { A: 'Changed', S: 'Added', D: 'Deleted' };
const lbl = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '3px' };
const inp = { width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', background: '#fff' };
const btn = (kind) => ({
  padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap',
  ...(kind === 'primary' ? { background: '#0f766e', color: '#fff', border: '1px solid #0f766e' }
    : kind === 'blue' ? { background: '#1d4ed8', color: '#fff', border: '1px solid #1d4ed8' }
    : kind === 'danger' ? { background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5' }
    : { background: '#fff', color: '#334155', border: '1px solid #cbd5e1' }),
});
const section = { border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', marginBottom: '10px', background: '#fff' };
const h4 = { margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: '#0f172a' };

export function StatusChip({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.Draft;
  return <span style={{ padding: '1px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.fg, border: '1px solid ' + s.bd, textDecoration: status === 'Void' ? 'line-through' : 'none' }}>{status}</span>;
}

export default function AmendmentDetail({ id, onChanged, onOpenJob, currentJobId }) {
  const [a, setA] = React.useState(null);
  const [codes, setCodes] = React.useState([]);
  const [ch, setCh] = React.useState(null);
  const [profiles, setProfiles] = React.useState([]);
  const [form, setForm] = React.useState({ reqLetterNo: '', reqLetterDate: '', reason: '', codes: [], icegateProfileId: '' });
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [ack, setAck] = React.useState('');
  const [err, setErr] = React.useState('');

  const load = React.useCallback(async () => {
    setErr('');
    try {
      const [d, c, s] = await Promise.all([api('/' + id), api('/' + id + '/changes'), api('/settings')]);
      setA(d.data); setCh(c); setProfiles(s.profiles || []);
      setForm({ reqLetterNo: d.data.reqLetterNo || '', reqLetterDate: ymd(d.data.reqLetterDate), reason: d.data.reason || '', codes: d.data.codes || [], icegateProfileId: d.data.icegateProfileId || ((s.profiles || [])[0] || {}).id || '' });
      setDirty(false);
    } catch (e) { setErr(e.message); }
  }, [id]);
  React.useEffect(() => { api('/codes').then(d => setCodes(d.data || [])).catch(() => {}); }, []);
  React.useEffect(() => { if (id) load(); }, [id, load]);

  if (err && !a) return <div style={{ padding: '12px', color: '#991b1b', fontSize: '12px' }}>{err}</div>;
  if (!a) return <div style={{ padding: '12px', color: '#94a3b8', fontSize: '12px' }}>Loading amendment…</div>;

  // 14-Nov-2026: a Rejected amendment is corrected and made again (it could only be sent again unchanged before)
  const open = ['Draft', 'Ready', 'Rejected'].includes(a.status);
  const canSend = ['Ready', 'Rejected'].includes(a.status);
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };
  const toggle = (c) => set('codes', form.codes.includes(c) ? form.codes.filter(x => x !== c) : [...form.codes, c]);
  const suggested = (ch && ch.suggested) || [];
  const done = (d, msg) => { if (d && d.data) setA(d.data); if (msg) toast.success(msg); if (onChanged) onChanged(d && d.data); };
  const run = async (key, fn) => { setBusy(key); setErr(''); try { await fn(); } catch (e) { setErr(e.message); toast.error(e.message); } finally { setBusy(''); } };

  const save = () => run('save', async () => {
    const d = await api('/' + id, { method: 'PUT', body: form });
    setDirty(false); done(d, 'Amendment ' + a.amendNo + ' saved');
  });
  const makeFile = () => run('file', async () => {
    if (!form.codes.length) throw new Error('Tick what is amended (codes) first');
    if (dirty) await api('/' + id, { method: 'PUT', body: form });
    const d = await api('/' + id + '/file', { method: 'POST', body: { icegateProfileId: form.icegateProfileId || null } });
    setDirty(false); done(d, `File ${d.fileName} made (${d.lines} lines)`);
    if (d.unconfirmedCodes && d.unconfirmedCodes.length) toast(`${d.unconfirmedCodes.join(', ')}: not yet seen in an iCAFFE amendment - check the ICEGATE reply`, { icon: 'ℹ️', duration: 7000 });
  });
  const dl = (kind) => run('dl' + kind, async () => { const n = await downloadFile(id, kind); toast.success(n + ' downloaded'); });
  const sign = () => run('sign', async () => {
    if (!pin) throw new Error('Enter the DSC token PIN');
    const d = await api('/' + id + '/sign', { method: 'POST', body: { pin } });
    setPin(''); done(d, 'Signed' + (d.signer ? ' by ' + d.signer : ''));
  });
  const send = () => run('send', async () => {
    if (!window.confirm(`Send the signed file ${a.fileName}.sig to ICEGATE by mail now?`)) return;
    const d = await api('/' + id + '/send', { method: 'POST' });
    done(d, 'Sent to ' + d.to);
  });
  const markSubmitted = (mode) => run('sub', async () => {
    if (!window.confirm(`Mark amendment ${a.amendNo} as uploaded on ICEGATE (${mode === 'DOWNLOAD_UNSIGNED' ? 'unsigned' : 'signed'} file)?`)) return;
    const d = await api('/' + id + '/submitted', { method: 'POST', body: { mode } });
    done(d, 'Marked as submitted');
  });
  const reply = (status) => run('reply', async () => {
    const d = await api('/' + id + '/reply', { method: 'POST', body: { status, text: ack } });
    setAck(''); done(d, 'ICEGATE reply saved: ' + status);
  });
  const voidIt = () => run('void', async () => {
    const why = await askText({ title: 'Void amendment ' + a.amendNo, message: `Void amendment ${a.amendNo}? Its number stays used.`, label: 'Reason', okLabel: 'Void the amendment' });
    if (!why || !why.trim()) return;
    const d = await api('/' + id + '/void', { method: 'POST', body: { reason: why.trim() } });
    done(d, 'Amendment ' + a.amendNo + ' voided');
  });

  const changes = (ch && ch.changes) || [];
  const isCurrent = currentJobId && Number(currentJobId) === Number(a.amendedJobId);
  return (
    <div style={{ fontSize: '12px', color: '#0f172a' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px', fontVariantNumeric: 'tabular-nums' }}>{a.amendNo}</div>
        <StatusChip status={a.status} />
        <div style={{ color: '#475569' }}>dt {dmy(a.amendDate)} · BE <b>{a.beNo}</b> dt {dmy(a.beDate)} · BE job <b>{a.parentJobNo}</b> · {a.branchCode}/{a.division}</div>
      </div>
      {onOpenJob && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {a.amendedJobId && !isCurrent && <button type="button" style={btn()} onClick={() => onOpenJob(a.amendedJobId)}>Open amended job</button>}
          <button type="button" style={btn()} onClick={() => onOpenJob(a.importJobId)}>Open BE job {a.parentJobNo}</button>
        </div>
      )}

      <div style={section}>
        <div style={h4}>Request</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
          <div><label style={lbl}>Request letter no</label><input style={inp} disabled={!open} value={form.reqLetterNo} onChange={e => set('reqLetterNo', e.target.value)} maxLength={30} /></div>
          <div><label style={lbl}>Request letter date</label><input style={inp} disabled={!open} type="date" value={form.reqLetterDate} onChange={e => set('reqLetterDate', e.target.value)} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Reason</label><input style={inp} disabled={!open} value={form.reason} onChange={e => set('reason', e.target.value)} maxLength={120} /></div>
        </div>
      </div>

      <div style={section}>
        <div style={{ ...h4, display: 'flex', alignItems: 'center', gap: '8px' }}>
          What changed against the filed BE
          <span style={{ fontWeight: 400, color: '#64748b' }}>{ch && ch.base ? (ch.base.from === 'amendment' ? `(after the last amendment, job ${ch.base.jobNo || ''})` : ch.base.from === 'filed' ? '(as filed)' : `(job ${ch.base.jobNo || ''})`) : ''}</span>
          <button type="button" style={{ ...btn(), marginLeft: 'auto', padding: '2px 8px', fontSize: '11px' }} onClick={load}>Refresh</button>
        </div>
        {!changes.length && <div style={{ color: '#64748b' }}>No change yet. Edit the amended job (Header / Invoices / Items), save it, then press Refresh.</div>}
        {changes.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
              <th style={{ padding: '4px 6px', width: '70px' }}>Part</th><th style={{ padding: '4px 6px', width: '90px' }}>Row</th><th style={{ padding: '4px 6px', width: '64px' }}></th><th style={{ padding: '4px 6px' }}>Field: was → now</th>
            </tr></thead>
            <tbody>{changes.map((c, i) => (
              <tr key={i} style={{ borderTop: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                <td style={{ padding: '4px 6px', fontWeight: 600 }}>{c.table}</td>
                <td style={{ padding: '4px 6px' }}>{c.key}</td>
                <td style={{ padding: '4px 6px', color: c.act === 'D' ? '#b91c1c' : c.act === 'S' ? '#166534' : '#1d4ed8', fontWeight: 600 }}>{ACT[c.act] || c.act}</td>
                <td style={{ padding: '4px 6px' }}>{(c.fields || []).map((f, k) => (
                  <div key={k}><span style={{ color: '#64748b' }}>{f.field}:</span> <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{String(f.was ?? '') || '—'}</span> → <b>{String(f.now ?? '') || '—'}</b></div>
                ))}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div style={section}>
        <div style={{ ...h4, display: 'flex', alignItems: 'center', gap: '8px' }}>
          Amendment codes
          {open && suggested.length > 0 && suggested.join() !== form.codes.join() && <button type="button" style={{ ...btn(), marginLeft: 'auto', padding: '2px 8px', fontSize: '11px' }} onClick={() => set('codes', suggested)}>Use suggested ({suggested.join(', ')})</button>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '2px 12px' }}>
          {codes.map(c => (
            <label key={c.code} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', cursor: open ? 'pointer' : 'default', color: form.codes.includes(c.code) ? '#0f172a' : '#475569' }}>
              <input type="checkbox" disabled={!open} checked={form.codes.includes(c.code)} onChange={() => toggle(c.code)} />
              <b style={{ minWidth: '70px', flex: 'none' }}>{c.code}</b><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.label}>{c.label}</span>
              {suggested.includes(c.code) && <span style={{ fontSize: '10px', color: '#0f766e', fontWeight: 700 }}>suggested</span>}
              {!c.seenInIcaffe && form.codes.includes(c.code) && <span title="Not yet seen in an iCAFFE amendment - check the ICEGATE reply" style={{ fontSize: '10px', color: '#b45309' }}>check reply</span>}
            </label>
          ))}
        </div>
      </div>

      <div style={section}>
        <div style={h4}>File for ICEGATE</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '8px' }}>
          <div style={{ minWidth: '180px' }}><label style={lbl} title="Sender of the amendment file">ICEGATE ID</label>
            <select style={inp} disabled={!open} value={form.icegateProfileId} onChange={e => set('icegateProfileId', e.target.value)}>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.loginId}{p.profileName && p.profileName !== p.loginId ? ' - ' + p.profileName : ''}</option>)}
              {!profiles.length && <option value="">No ICEGATE user set up</option>}
            </select>
          </div>
          {open && <button type="button" style={btn()} disabled={!!busy || !dirty} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save'}</button>}
          {open && <button type="button" style={btn('primary')} disabled={!!busy} onClick={makeFile}>{busy === 'file' ? 'Making…' : a.hasFile ? 'Make file again' : 'Make file'}</button>}
        </div>
        {a.hasFile && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ marginBottom: '8px' }}>
              <b>{a.fileName}</b> · made {a.fileMadeAt ? new Date(a.fileMadeAt).toLocaleString('en-GB') : ''} by {a.fileMadeBy || ''} · codes {(a.fileCodes || []).join(', ')}
              {a.hasSigned && <span style={{ color: '#166534' }}> · signed {new Date(a.signedAt).toLocaleString('en-GB')}{a.signer ? ' (' + a.signer + ')' : ''}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', background: '#fff' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>Unsigned</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" style={btn()} disabled={!!busy} onClick={() => dl('unsigned')}>Download {a.fileName}</button>
                  {canSend && <button type="button" style={btn()} disabled={!!busy} onClick={() => markSubmitted('DOWNLOAD_UNSIGNED')}>Uploaded on ICEGATE</button>}
                </div>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', background: '#fff' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>Signed (DSC)</div>
                {canSend && (
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input style={{ ...inp, width: '110px' }} type="password" autoComplete="off" placeholder="Token PIN" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sign(); }} />
                    <button type="button" style={btn('primary')} disabled={!!busy} onClick={sign}>{busy === 'sign' ? 'Signing…' : a.hasSigned ? 'Sign again' : 'Sign'}</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" style={btn()} disabled={!!busy || !a.hasSigned} onClick={() => dl('signed')}>Download {a.fileName}.sig</button>
                  {canSend && a.hasSigned && <button type="button" style={btn()} disabled={!!busy} onClick={() => markSubmitted('DOWNLOAD')}>Uploaded on ICEGATE</button>}
                </div>
              </div>
              <div style={{ border: '1px solid #bfdbfe', borderRadius: '6px', padding: '8px', background: '#eff6ff' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>Direct to ICEGATE</div>
                <div style={{ color: '#475569', marginBottom: '6px' }}>Mails the signed file to the ICEGATE address in Settings.</div>
                <button type="button" style={btn('blue')} disabled={!!busy || !canSend || !a.hasSigned} onClick={send}>{busy === 'send' ? 'Sending…' : 'Send to ICEGATE'}</button>
              </div>
            </div>
          </div>
        )}
        {!a.hasFile && a.fileMadeAt && <div style={{ color: '#b45309', marginTop: '6px' }}>Details changed after the file was made - make the file again.</div>}
      </div>

      {['Submitted', 'Accepted', 'Rejected'].includes(a.status) && (
        <div style={section}>
          <div style={h4}>ICEGATE</div>
          <div style={{ marginBottom: '6px' }}>{MODE_LABEL[a.transferMode] || a.transferMode} · {a.submittedAt ? new Date(a.submittedAt).toLocaleString('en-GB') : ''} by {a.submittedBy || ''}{a.mailTo ? ' · to ' + a.mailTo : ''}</div>
          {a.ackStatus && <div style={{ marginBottom: '6px' }}>Reply: <StatusChip status={a.ackStatus} /> {a.ackText}</div>}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <input style={{ ...inp, flex: 1, minWidth: '180px' }} placeholder="ICEGATE reply / remarks" value={ack} onChange={e => setAck(e.target.value)} />
            <button type="button" style={btn()} disabled={!!busy} onClick={() => reply('Accepted')}>Accepted</button>
            <button type="button" style={btn('danger')} disabled={!!busy} onClick={() => reply('Rejected')}>Rejected</button>
          </div>
        </div>
      )}

      {a.status === 'Rejected' && <div style={{ padding: '8px', background: '#fff7ed', color: '#9a3412', borderRadius: '6px', marginBottom: '10px' }}>ICEGATE rejected this amendment. Correct the amended job (it is open again), make the file again and send it.</div>}
      {['Submitted', 'Accepted'].includes(a.status) && <div style={{ padding: '8px', background: '#f1f5f9', color: '#334155', borderRadius: '6px', marginBottom: '10px' }}>The amended job is locked now that this amendment was {a.status === 'Accepted' ? 'accepted' : 'sent'}. {a.status === 'Accepted' ? 'For more changes make a new amendment.' : 'If ICEGATE rejects it, mark it Rejected to change it again.'}</div>}
      {err && <div style={{ padding: '8px', background: '#fef2f2', color: '#991b1b', borderRadius: '6px', marginBottom: '10px' }}>{err}</div>}
      {a.remarks && <div style={{ color: '#64748b', marginBottom: '8px' }}>{a.remarks}</div>}
      {open && <div style={{ textAlign: 'right' }}><button type="button" style={btn('danger')} disabled={!!busy} onClick={voidIt}>Void amendment</button></div>}
    </div>
  );
}
