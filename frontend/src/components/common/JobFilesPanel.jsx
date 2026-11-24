// Files part of the job list's "Documents" window (Import and Export). 18-Nov-2026
// - e-Sanchit PDFs: one line per document. The PDF as attached and its DSC-signed copy were two (or, for a PDF that was
//   signed already, four) lines that looked like the same file; now the signed copy is the link and the other copy is a
//   small link on the same line. A PDF that no document row uses (filed again by an Update, row removed) can be removed.
// - Other documents: any shipment document uploaded by hand (PDF, picture, Excel, Word, mail ...), with a type and a
//   remark; can be removed. Removed files are moved to a _removed folder on the server, not erased.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Upload, Paperclip } from 'lucide-react';

const kb = (n) => (n ? (n / 1024 < 1024 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB') : '');
const when = (d) => { try { return d ? new Date(d).toLocaleString() : ''; } catch (e) { return ''; } };
const head = { fontWeight: 700, color: 'var(--primary-text, #0369a1)', margin: '12px 0 6px', display: 'flex', alignItems: 'center', gap: '10px' };
const row = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', padding: '5px 0', borderBottom: '1px solid var(--border-color, #f1f5f9)' };
const muted = { color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' };
const link = { color: '#2563eb', wordBreak: 'break-all' };
const btn = { display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 10px', borderRadius: '5px', border: '1px solid var(--primary-color-start, #0ea5e9)', background: 'var(--primary-color-start, #0ea5e9)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' };
const ghost = { ...btn, background: '#fff', color: '#334155', border: '1px solid #cbd5e1' };
const bin = { background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px', display: 'inline-flex' };
const inp = { height: '26px', border: '1px solid #94a3b8', borderRadius: '4px', padding: '0 6px', fontSize: '11px', background: '#fff', color: '#0f172a' };

export default function JobFilesPanel({ module, jobId, finals = [] }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState(null);   // { file, docType, remarks } while the upload form is open
  const fileRef = useRef(null);
  const base = `/api/job-files/${module === 'Export' ? 'export' : 'import'}/${jobId}`;

  const load = useCallback(async () => {
    setErr('');
    try {
      const j = await window.fetch(base).then(r => r.json());
      if (!j || !j.success) throw new Error((j && j.error) || 'Could not read the files');
      setData(j);
    } catch (e) { setErr(e.message); setData({ esanchit: [], other: [], docTypes: [], canEdit: false }); }
  }, [base]);
  useEffect(() => { if (jobId) load(); }, [jobId, load]);

  const remove = async (kind, file, label) => {
    if (!window.confirm(`Remove ${label} from this job?\n\nThe file is moved to the job's _removed folder on the server (it can be brought back by the admin).`)) return;
    setBusy(kind + file);
    try {
      const j = await window.fetch(`${base}?kind=${kind}&file=${encodeURIComponent(file)}`, { method: 'DELETE' }).then(r => r.json());
      if (!j || !j.success) throw new Error((j && j.error) || 'Could not remove the file');
      toast.success('Removed: ' + label);
      await load();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };
  const send = async () => {
    if (!form || !form.file) { toast.error('Choose a file'); return; }
    setBusy('upload');
    try {
      const fd = new FormData();
      fd.append('docType', form.docType || 'Other'); fd.append('remarks', form.remarks || ''); fd.append('file', form.file);
      const j = await window.fetch(base + '/other', { method: 'POST', body: fd }).then(r => r.json());
      if (!j || !j.success) throw new Error((j && j.error) || 'Upload failed');
      toast.success('Uploaded: ' + form.file.name);
      setForm(null); if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  };

  if (!data) return <div style={{ ...muted, marginTop: '10px' }}>Loading the files...</div>;
  const canEdit = !!data.canEdit;
  // 18-Nov-2026: the PDFs of the documents are already in the e-Sanchit table above - here only the extra ones
  const es = (data.esanchit || []).filter(g => !g.inUse);
  const other = data.other || [];
  return (
    <div>
      {err && <div style={{ color: '#b91c1c', margin: '8px 0' }}>{err}</div>}

      {es.length > 0 && <div style={head}>Extra e-Sanchit PDFs - not on any document ({es.length})</div>}
      {es.map(g => (
        <div key={g.key} style={row}>
          <div style={{ minWidth: 0 }}>
            <a href={g.main.fileUrl} target="_blank" rel="noreferrer" style={link}>{g.main.fileName}</a>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              {g.docCode && <span>Doc {g.docCode}</span>}
              {g.main.signed ? <span style={{ color: '#15803d', fontWeight: 600 }}>Signed{g.main.signer ? ' - ' + g.main.signer : ''}</span> : <span>Not signed</span>}
              {g.irn && <span style={{ color: '#15803d' }}>IRN {g.irn}</span>}
              {g.sameAs && <span style={{ color: '#b45309', fontWeight: 600 }}>Same file as {g.sameAs}</span>}
            </div>
          </div>
          <span style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {kb(g.main.size)}{g.main.savedAt ? ' - ' + when(g.main.savedAt) : ''}
            {canEdit && <button type="button" style={bin} disabled={!!busy} title="Remove this PDF (not used by any document)" onClick={() => remove('esanchit', g.main.fileName, g.main.fileName)}><Trash2 size={14} /></button>}
          </span>
        </div>))}

      {finals.length > 0 && (<>
        <div style={head}>Final copies ({finals.length})</div>
        {finals.map((f, i) => (
          <div key={i} style={row}><a href={f.fileUrl} target="_blank" rel="noreferrer" style={link}>{f.fileName}</a><span style={muted}>final copy</span></div>))}
      </>)}

      <div style={head}>
        <span>Other documents ({other.length})</span>
        {canEdit && !form && <button type="button" style={btn} onClick={() => setForm({ file: null, docType: 'Other', remarks: '' })}><Upload size={13} /> Upload document</button>}
      </div>
      {form && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid #94a3b8', borderRadius: '6px', background: '#f8fafc', marginBottom: '6px' }}>
          <input ref={fileRef} type="file" style={{ fontSize: '11px', maxWidth: '260px' }}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.tif,.tiff,.xls,.xlsx,.xlsm,.csv,.doc,.docx,.txt,.rtf,.odt,.ods,.zip,.rar,.7z,.eml,.msg"
            onChange={e => setForm(f => ({ ...f, file: (e.target.files && e.target.files[0]) || null }))} />
          <select style={inp} value={form.docType} onChange={e => setForm(f => ({ ...f, docType: e.target.value }))}>
            {(data.docTypes || ['Other']).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input style={{ ...inp, flex: '1 1 160px', textTransform: 'none' }} maxLength={200} placeholder="Remarks (optional)" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
          <button type="button" style={btn} disabled={busy === 'upload'} onClick={send}><Paperclip size={13} /> {busy === 'upload' ? 'Uploading...' : 'Upload'}</button>
          <button type="button" style={ghost} disabled={busy === 'upload'} onClick={() => setForm(null)}>Cancel</button>
          <span style={{ width: '100%', fontSize: '10.5px', color: '#64748b' }}>PDF, picture, Excel, Word, CSV, text, ZIP or mail (.eml / .msg), up to 25 MB. These are kept with the job only - they are not sent to ICEGATE.</span>
        </div>)}
      {other.length ? other.map(f => (
        <div key={f.fileName} style={row}>
          <div style={{ minWidth: 0 }}>
            <a href={f.fileUrl} target="_blank" rel="noreferrer" style={link}>{f.name}</a>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              {f.docType && <span style={{ fontWeight: 600, color: '#334155' }}>{f.docType}</span>}
              {f.remarks && <span>{f.remarks}</span>}
              {f.by && <span>by {f.by}</span>}
            </div>
          </div>
          <span style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            {kb(f.size)}{f.savedAt ? ' - ' + when(f.savedAt) : ''}
            {canEdit && <button type="button" style={bin} disabled={!!busy} title="Remove this document" onClick={() => remove('other', f.fileName, f.name)}><Trash2 size={14} /></button>}
          </span>
        </div>)) : !form && <div style={muted}>None yet.</div>}
    </div>
  );
}
