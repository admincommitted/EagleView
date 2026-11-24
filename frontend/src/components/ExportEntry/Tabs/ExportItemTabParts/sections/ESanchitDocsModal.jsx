// e-Sanchit supporting documents of an item / its invoice / the whole SB. Rewritten 29-Oct-2026.
//
// Before, a row had only file name, doc code, IRN, DRN: the issuing party, beneficiary, place / date of issue and
// expiry that ICEGATE needs (errors 822 / 827 when missing) could not be entered, "Doc For" was ignored when the SB
// was built (every row was sent at item level) and documents could not be copied from another job or to other items.
//
// Each row: srNo, irn, drn, refNo, docCode, fileName / file (PDF to sign and upload), fileType, docFor (Item | Invoice |
// SB), issuer* and beneficiary* (code, name, address 1-2, city, pin), placeOfIssue, issueDate, expiryDate,
// icegateId (only when the document was uploaded with another ICEGATE id). SB-level rows are kept on the job
// (exportData.eSanchitList), item / invoice rows on the item.
import React, { useEffect, useMemo, useState } from 'react';
import { asList } from '../../../../../utils/asList';
import { Copy, Download, Edit2, FileUp, Plus, Save, Trash2, Upload, X, Search } from 'lucide-react';
import { downloadPdf, shortPdfName } from '../../../../../utils/downloadPdf';
import { localSigner, signPdf } from '../../../../../utils/dscSigner';
import toast from 'react-hot-toast';
import BodyPortal from '../../../../common/BodyPortal';

const EMPTY = { irn: '', drn: '', refNo: '', docCode: '', docName: '', fileName: '', fileType: 'PDF', docFor: 'Item',
  issuerCode: '', issuerName: '', issuerAddress1: '', issuerAddress2: '', issuerCity: '', issuerPin: '',
  beneficiaryCode: '', beneficiaryName: '', beneficiaryAddress1: '', beneficiaryAddress2: '', beneficiaryCity: '', beneficiaryPin: '',
  placeOfIssue: '', issueDate: '', expiryDate: '', icegateDifferent: false, icegateId: '' };

// rows saved by older screens / read from an ICEGATE file -> one shape
export function normDoc(d, i = 0) {
  const g = (d && d._icegate) || {};
  const ymd = (v) => { const s = String(v || '').trim(); const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(s); return m ? `${m[1]}-${m[2]}-${m[3]}` : s; };
  return {
    ...EMPTY, ...d, _icegate: undefined, // all its values are now in the row's own fields (edits must be sent)
    id: d.id || `doc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    irn: d.irn || g.imageReferenceNumber || '', drn: d.drn || '', refNo: d.refNo || g.documentReferenceNo || '',
    docCode: d.docCode || g.documentTypeCode || '', docFor: d.docFor || (g.itemSerialNumber && +g.itemSerialNumber ? 'Item' : g.invoiceSerialNumber && +g.invoiceSerialNumber ? 'Invoice' : (d._icegate ? 'SB' : 'Item')),
    issuerCode: d.issuerCode || g.documentIssuingPartyCode || '', issuerName: d.issuerName || d.issuingParty || g.documentIssuingPartyName || '',
    issuerAddress1: d.issuerAddress1 || d.issuerAddress || g.documentIssuingPartyNameAddress1 || '', issuerAddress2: d.issuerAddress2 || g.documentIssuingPartyNameAddress2 || '',
    issuerCity: d.issuerCity || g.documentIssuingPartyNameCity || '', issuerPin: d.issuerPin || g.documentIssuingPartyNamePin || '',
    beneficiaryCode: d.beneficiaryCode || g.documentBeneficiaryPartyCode || '', beneficiaryName: d.beneficiaryName || d.beneficiaryParty || g.documentBeneficiaryPartyName || '',
    beneficiaryAddress1: d.beneficiaryAddress1 || g.documentBeneficiaryPartyNameAddress1 || '', beneficiaryAddress2: d.beneficiaryAddress2 || g.documentBeneficiaryPartyNameAddress2 || '',
    beneficiaryCity: d.beneficiaryCity || g.documentBeneficiaryPartyNameCity || '', beneficiaryPin: d.beneficiaryPin || g.documentBeneficiaryPartyNamePin || '',
    placeOfIssue: d.placeOfIssue || g.placeOfIssue || '', issueDate: ymd(d.issueDate || d.date || g.documentIssueDate), expiryDate: ymd(d.expiryDate || g.documentExpiryDate),
    fileType: String(d.fileType || g.fileType || 'PDF').toUpperCase(), icegateId: d.icegateId || g.icegateId || '', icegateDifferent: !!(d.icegateDifferent || (d.icegateId && !/^\d{10,}$/.test(d.icegateId))),
  };
}

const inp = { height: '28px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff', width: '100%', boxSizing: 'border-box' };
const lab = { fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.3px' };
const box = { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', background: '#f8fafc', display: 'grid', gap: '8px' };
const btn = (bg, c = '#fff') => ({ height: '30px', padding: '0 12px', border: 'none', borderRadius: '6px', background: bg, color: c, fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' });

export default function ESanchitDocsModal({ open, onClose, onSave, itemRows, exportData, setExportData, items, setItems, itemLabel, esanchitMasters, icegateProfiles, defaultIcegateId, selectedIcegateProfile, setSelectedIcegateProfile }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [jobRef, setJobRef] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [pin, setPin] = useState('');
  const [askPin, setAskPin] = useState(false);
  // 16-Nov-2026: EagleView Signer on this PC - the PIN is asked in its own window, not here
  const [tool, setTool] = useState(undefined);
  useEffect(() => { localSigner().then(setTool); }, []);
  const [busy, setBusy] = useState(false);

  const exporter = useMemo(() => ({ beneficiaryName: exportData?.shipperName || '', beneficiaryCode: exportData?.shipperIec || '', beneficiaryAddress1: exportData?.shipperAddress1 || '',
    beneficiaryAddress2: exportData?.shipperAddress2 || '', beneficiaryCity: exportData?.shipperCity || '', beneficiaryPin: exportData?.shipperPin || '' }), [exportData]);
  const fresh = () => ({ ...EMPTY, ...exporter, placeOfIssue: exportData?.shipperCity || '' });

  // item / invoice rows of this item + SB-level rows of the job
  useEffect(() => {
    if (!open) return;
    const own = asList(itemRows).map(normDoc);
    const sb = asList(exportData?.eSanchitList).map((d, i) => ({ ...normDoc(d, i), docFor: 'SB' }));
    setRows([...own.filter(r => r.docFor !== 'SB'), ...sb]);
    setForm(fresh()); setEditId(null); setAskPin(false); setPin('');
  }, [open]);

  if (!open) return null;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const masters = (esanchitMasters || []).filter(m => !codeQuery || String(m.documentCode).includes(codeQuery) || String(m.description || '').toLowerCase().includes(codeQuery.toLowerCase())).slice(0, 80);

  // ICEGATE checks of one document (SUPPORTINGDOCS: IRN, doc code, issuing party name, place and date of issue, beneficiary name, file type)
  const check = (r) => {
    const e = [];
    if (!r.docCode) e.push('Doc. code');
    if (r.irn && !/^\d{16}$/.test(r.irn)) e.push('IRN must be 16 digits');
    if (!r.irn && !r.file) e.push(r.signedOnly ? 'IRN (upload the signed PDF on e-Sanchit and enter its IRN)' : 'IRN (or a PDF to upload)');
    if (!r.issuerName) e.push('Issuing party name');
    if (!r.beneficiaryName) e.push('Beneficiary name');
    if (!r.placeOfIssue) e.push('Place of issue');
    if (!r.issueDate) e.push('Issue date');
    if (r.issueDate && new Date(r.issueDate) > new Date()) e.push('Issue date is in the future');
    if (r.expiryDate && r.issueDate && r.expiryDate < r.issueDate) e.push('Expiry date is before the issue date');
    if (r.icegateDifferent && !r.icegateId) e.push('ICEGATE id (marked different)');
    return e;
  };
  // 14-Nov-2026: as on Import - an attached PDF is kept with the job at once (uploads/esanchit_archive/<job no>/...), and the
  // row keeps its link (fileUrl). Before, the PDF lived only in the browser: it was gone after Save + reopen unless it
  // already had an IRN. A job not saved yet files under "draft"; the server moves it to the job no folder on Save.
  const jobKey = () => String(exportData?.jobNo && exportData.jobNo !== 'DRAFT' ? exportData.jobNo : (exportData?.id ? 'job-' + exportData.id : 'draft'));
  const archive = async (file, r) => {
    try {
      const fd = new FormData(); fd.append('jobNo', jobKey()); fd.append('docCode', r.docCode || ''); fd.append('irn', r.irn || ''); fd.append('pdf', file);
      const j = await fetch('/api/icegate/esanchit-archive', { method: 'POST', body: fd }).then(x => x.json());
      if (j && j.success) return { fileUrl: j.fileUrl };
      toast.error('PDF could not be kept with the job: ' + ((j && j.error) || 'no answer'));
    } catch (e) { toast.error('PDF could not be kept with the job: ' + e.message); }
    return {};
  };
  const addOrUpdate = async () => {
    const r = { ...form, irn: String(form.irn || '').replace(/\s/g, ''), docCode: String(form.docCode || '').trim() };
    const errs = check(r);
    if (errs.length) { toast.error('Missing / wrong: ' + errs.join(', ')); return; }
    if (r.irn && rows.some(x => x.irn === r.irn && x.id !== editId)) { toast.error('IRN ' + r.irn + ' is already in the list'); return; }
    const before = editId ? rows.find(x => x.id === editId) : null;
    if (r.file && (!before || before.file !== r.file)) { const a = await archive(r.file, r); if (a.fileUrl) { r.fileUrl = a.fileUrl; r.signedOnly = false; } }
    if (editId) { setRows(rows.map(x => x.id === editId ? { ...r, id: editId } : x)); toast.success('Document updated'); }
    else { setRows([...rows, { ...r, id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }]); toast.success('Document added'); }
    // next document: issuer, beneficiary, place and dates stay (usually the same), document details are emptied
    setForm({ ...r, id: undefined, irn: '', drn: '', refNo: '', docCode: '', docName: '', file: undefined, fileName: '', fileUrl: undefined, signedOnly: false }); setEditId(null);
  };
  const edit = (r) => { setForm({ ...r }); setEditId(r.id); };
  const copyRow = (r) => { setForm({ ...r, irn: '', drn: '', file: undefined, fileName: '', fileUrl: undefined, signedOnly: false }); setEditId(null); toast('Copied to the form - enter the IRN of the new document and click Add', { icon: 'ℹ️' }); };
  const remove = (r) => { if (window.confirm(`Remove document ${r.irn || r.fileName || r.docCode}?`)) { setRows(rows.filter(x => x.id !== r.id)); if (editId === r.id) { setEditId(null); setForm(fresh()); } } };

  const attach = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = null; if (!f) return;
    if (!/\.pdf$/i.test(f.name)) { toast.error('e-Sanchit takes PDF files only'); return; }
    if (f.size > 20 * 1024 * 1024) { toast.error('File is larger than 20 MB'); return; }
    setForm(fm => ({ ...fm, file: f, fileName: f.name, fileType: 'PDF' }));
  };

  // documents of another job (by its job no): rows with an IRN are added here
  const addByJobRef = async () => {
    const no = jobRef.trim().toUpperCase();
    if (!no) { toast.error('Enter the job no to copy documents from'); return; }
    try {
      const list = await fetch('/api/export-jobs?limit=2000').then(r => r.json());
      const hit = (list.data || []).find(j => String(j.jobNo || '').toUpperCase() === no);
      if (!hit) { toast.error('Job ' + no + ' not found'); return; }
      const full = await fetch('/api/export-jobs/' + hit.id).then(r => r.json());
      const job = full.data || {};
      const found = [...asList(job.eSanchitList).map(d => ({ ...normDoc(d), docFor: 'SB' })),
        ...(job.invoices || []).flatMap(inv => (inv.items || []).flatMap(it => asList(it.eSanchitList).map(d => normDoc(d))))]
        .filter(d => d.irn && !rows.some(x => x.irn === d.irn));
      const uniq = found.filter((d, i) => found.findIndex(x => x.irn === d.irn) === i).map((d, i) => ({ ...d, id: `doc-${Date.now()}-${i}` }));
      if (!uniq.length) { toast('No new document with an IRN in job ' + no, { icon: 'ℹ️' }); return; }
      setRows([...rows, ...uniq]); toast.success(uniq.length + ' document(s) added from job ' + no);
    } catch (err) { toast.error('Could not read job ' + no + ': ' + err.message); }
  };

  // item-level rows of this item to every other item of the job
  const copyToAllItems = () => {
    const mine = rows.filter(r => r.docFor !== 'SB' && r.irn);
    if (!mine.length) { toast.error('No item / invoice document with an IRN to copy'); return; }
    if (!items || !items.length) { toast.error('No other items'); return; }
    if (!window.confirm(`Copy ${mine.length} document(s) to all ${items.length} item(s) of the job?`)) return;
    setItems(items.map(it => {
      const have = asList(it.eSanchitList).map(normDoc);
      const add = mine.filter(r => !have.some(h => h.irn === r.irn)).map(r => ({ ...r, id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, file: undefined }));
      return add.length ? { ...it, eSanchitList: [...have, ...add], suppDocs: 'Y' } : it;
    }));
    toast.success('Documents copied to the items');
  };

  // sign (local DSC signer) and upload the PDFs that have no IRN yet
  const uploadPending = async () => {
    const pending = rows.filter(r => !r.irn && r.file);
    if (!pending.length) { toast.error('No PDF waiting for upload'); return; }
    setBusy(true);
    let ok = 0, signedOnly = 0; const next = [...rows];
    try {
      for (let i = 0; i < next.length; i++) {
        const d = next[i]; if (d.irn || !d.file) continue;
        let sg;
        try { sg = await signPdf(d.file, tool ? '' : pin, 'e-Sanchit document ' + d.docCode + (jobKey() ? ' - job ' + jobKey() : '')); }
        catch (err) { if (err.cancelled) { toast('Signing cancelled in EagleView Signer.', { icon: 'ℹ️' }); break; } throw err; }
        const signed = new File([sg.blob], 'signed_' + d.fileName, { type: 'application/pdf' });
        // 14-Nov-2026: the text fields go before the file (the server files the PDF under the job no; without it the
        // signed PDF went to the "misc" folder and was not linked to the row)
        const uf = new FormData(); uf.append('jobNo', jobKey()); uf.append('documentCode', d.docCode); uf.append('irn', d.irn || ''); uf.append('profileId', selectedIcegateProfile || ''); uf.append('pdf', signed);
        const ur = await fetch('/api/icegate/upload-esanchit', { method: 'POST', body: uf }).then(r => r.json());
        if (ur.success && /^\d{16}$/.test(String(ur.irn || ''))) { next[i] = { ...d, irn: ur.irn, drn: d.drn || ur.drn || '', file: undefined, fileName: signed.name, fileUrl: ur.fileUrl || d.fileUrl, signedOnly: false }; ok++; }
        // signed with the DSC and saved, not uploaded (the e-Sanchit portal upload is done by hand): the row keeps the
        // signed PDF; the operator uploads it on the portal and types the IRN. Before, this showed "Upload ... failed".
        else if (ur.signedOnly) { next[i] = { ...d, file: undefined, fileName: signed.name, fileUrl: ur.fileUrl || d.fileUrl, signedOnly: true }; signedOnly++; }
        else toast.error('Upload of ' + d.fileName + ' failed: ' + (ur.error || 'no answer'));
      }
      setRows(next);
      if (ok) toast.success(ok + ' IRN(s) received');
      if (signedOnly) toast(signedOnly + ' PDF(s) signed with the DSC and saved with the job. Upload them on the e-Sanchit portal and enter the 16-digit IRN here (Edit the row).', { duration: 10000, icon: '✍️' });
      if (ok || signedOnly) { setAskPin(false); setPin(''); }
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const save = () => {
    const bad = rows.map(r => ({ r, e: check(r) })).filter(x => x.e.length);
    if (bad.length && !window.confirm(`${bad.length} document(s) are incomplete (${bad[0].e.join(', ')}).\nICEGATE rejects incomplete documents. Save anyway?`)) return;
    const sbRows = rows.filter(r => r.docFor === 'SB').map(r => ({ ...r, file: undefined }));
    setExportData(prev => ({ ...prev, eSanchitList: sbRows }));
    onSave(rows.filter(r => r.docFor !== 'SB').map(r => ({ ...r, file: r.irn ? undefined : r.file })));
  };

  const F = (label, k, extra = {}) => (
    <label style={{ display: 'grid', gap: '3px' }}><span style={lab}>{label}</span>
      <input style={{ ...inp, ...(extra.style || {}) }} value={form[k] || ''} maxLength={extra.max} type={extra.type || 'text'} placeholder={extra.ph || ''}
        onChange={e => set(k, extra.upper ? e.target.value.toUpperCase() : e.target.value)} /></label>);
  const party = (p, title) => (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{title}</strong>
        <button type="button" style={btn('#e0f2fe', '#0369a1')} onClick={() => setForm(f => ({ ...f, [p + 'Name']: exporter.beneficiaryName, [p + 'Code']: exporter.beneficiaryCode, [p + 'Address1']: exporter.beneficiaryAddress1, [p + 'Address2']: exporter.beneficiaryAddress2, [p + 'City']: exporter.beneficiaryCity, [p + 'Pin']: exporter.beneficiaryPin }))}>Same as exporter</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>{F('Code', p + 'Code', { max: 17, upper: true })}{F('Name *', p + 'Name', { max: 70, upper: true })}</div>
      {F('Address 1', p + 'Address1', { max: 70, upper: true })}{F('Address 2', p + 'Address2', { max: 70, upper: true })}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>{F('City', p + 'City', { max: 35, upper: true })}{F('Pin', p + 'Pin', { max: 10 })}</div>
    </div>);
  const pending = rows.filter(r => !r.irn && r.file).length;

  return (
    // rendered on <body>: inside the Items panel the window was placed and cut by the panel (went off the screen). 29-Oct-2026
    <BodyPortal>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: '1180px', maxHeight: 'calc(100vh - 24px)', background: '#fff', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,.25)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>e-Sanchit Supporting Documents</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{itemLabel} · Job {exportData?.jobNo || 'not saved'} · Exporter {exportData?.shipperName || '-'}</div>
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '14px 18px', overflowY: 'auto', display: 'grid', gap: '12px', flex: '1 1 auto', minHeight: 0, alignContent: 'start' }}>
          {/* document */}
          <div style={{ ...box, gridTemplateColumns: '1.2fr 1.2fr 1fr 2fr 1.4fr', alignItems: 'end' }}>
            {F('IRN (16 digits)', 'irn', { max: 16, ph: 'from e-Sanchit' })}
            {F('DRN', 'drn', { max: 35 })}
            {F('Doc. Ref. No.', 'refNo', { max: 35, upper: true, ph: 'e.g. invoice no' })}
            <label style={{ display: 'grid', gap: '3px' }}><span style={lab}>Doc. Code *</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input style={{ ...inp, width: '90px' }} value={form.docCode || ''} maxLength={6} onChange={e => set('docCode', e.target.value.replace(/\D/g, ''))} placeholder="CODE" />
                <select style={{ ...inp }} value={form.docCode || ''} onChange={e => { const m = (esanchitMasters || []).find(x => String(x.documentCode) === e.target.value); setForm(f => ({ ...f, docCode: e.target.value, docName: m ? m.description : '' })); }}>
                  <option value="">-- choose from master --</option>
                  {form.docCode && !masters.some(m => String(m.documentCode) === String(form.docCode)) && <option value={form.docCode}>{form.docCode} {form.docName ? '- ' + form.docName : ''}</option>}
                  {masters.map(m => <option key={m.id || m.documentCode} value={m.documentCode}>{m.documentCode} - {m.description}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Search size={11} color="#94a3b8" /><input style={{ ...inp, height: '22px', fontSize: '10px' }} placeholder="filter doc codes" value={codeQuery} onChange={e => setCodeQuery(e.target.value)} /></div>
            </label>
            <label style={{ display: 'grid', gap: '3px' }}><span style={lab}>PDF file</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input type="file" id="esanchitPdf" accept=".pdf" style={{ display: 'none' }} onChange={attach} />
                <button type="button" style={btn('#eef2ff', '#4338ca')} onClick={() => document.getElementById('esanchitPdf').click()}><FileUp size={13} /> Attach</button>
                <span style={{ fontSize: '10px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }} title={form.fileName}>{form.fileName || 'no file'}</span>
              </div>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {party('issuer', 'Document issued by')}
            {party('beneficiary', 'Beneficiary (in whose name)')}
          </div>

          <div style={{ ...box, gridTemplateColumns: '1.4fr 1fr 1fr .8fr 1.1fr 1.6fr', alignItems: 'end' }}>
            {F('Place of issue *', 'placeOfIssue', { max: 35, upper: true })}
            {F('Issue date *', 'issueDate', { type: 'date' })}
            {F('Expiry date', 'expiryDate', { type: 'date' })}
            <label style={{ display: 'grid', gap: '3px' }}><span style={lab}>File type</span>
              <select style={inp} value={form.fileType || 'PDF'} onChange={e => set('fileType', e.target.value)}><option>PDF</option></select></label>
            <label style={{ display: 'grid', gap: '3px' }}><span style={lab}>Document for</span>
              <select style={inp} value={form.docFor} onChange={e => set('docFor', e.target.value)}>
                <option value="Item">This item</option><option value="Invoice">Its invoice</option><option value="SB">Whole SB</option>
              </select></label>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                <input type="checkbox" checked={!!form.icegateDifferent} onChange={e => setForm(f => ({ ...f, icegateDifferent: e.target.checked, icegateId: e.target.checked ? f.icegateId : '' }))} />
                Uploaded with another ICEGATE id {defaultIcegateId ? <span style={{ color: '#94a3b8', fontWeight: 400 }}>(default {defaultIcegateId})</span> : null}
              </label>
              {form.icegateDifferent && <input style={inp} placeholder="ICEGATE ID" value={form.icegateId || ''} maxLength={25} onChange={e => set('icegateId', e.target.value.toUpperCase())} />}
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#b45309' }}>A statement-level document (whole shipping bill) must use "Whole SB". Fields marked * are needed by ICEGATE.</div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" style={btn('#16a34a')} onClick={addOrUpdate}>{editId ? <><Save size={13} /> Update document</> : <><Plus size={13} /> Add document</>}</button>
            {editId && <button type="button" style={btn('#f1f5f9', '#334155')} onClick={() => { setEditId(null); setForm(fresh()); }}>Cancel edit</button>}
            <span style={{ width: '1px', height: '22px', background: '#e2e8f0' }} />
            <input style={{ ...inp, width: '170px' }} placeholder="Job no to copy from" value={jobRef} onChange={e => setJobRef(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addByJobRef(); }} />
            <button type="button" style={btn('#0284c7')} onClick={addByJobRef}><Plus size={13} /> Add by job no</button>
            <button type="button" style={btn('#7c3aed')} onClick={copyToAllItems} title="Copy this item's documents (with IRN) to every item of the job"><Copy size={13} /> Copy to all items</button>
          </div>

          {/* list */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'auto', maxHeight: '230px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
              <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                <tr>{['', 'Sr', 'For', 'IRN', 'DRN', 'Ref. No', 'Doc Code', 'File', 'Issued by', 'Beneficiary', 'Place', 'Issue', 'Expiry', 'Status'].map(h => <th key={h} style={{ padding: '7px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={14} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No document yet - fill the form above and click Add document</td></tr>}
                {rows.map((r, i) => {
                  const e = check(r);
                  return (
                    <tr key={r.id} style={{ background: editId === r.id ? '#fefce8' : i % 2 ? '#fcfcfd' : '#fff', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '5px 8px', display: 'flex', gap: '8px' }}>
                        <Edit2 size={13} style={{ cursor: 'pointer', color: '#0f172a' }} onClick={() => edit(r)} />
                        <Copy size={13} style={{ cursor: 'pointer', color: '#2563eb' }} onClick={() => copyRow(r)} />
                        <Trash2 size={13} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => remove(r)} />
                        {r.fileUrl && <span title={'Download ' + shortPdfName(r) + (r.signedOnly ? ' - upload it on e-Sanchit' : '')} style={{ display: 'inline-flex' }}><Download size={13} style={{ cursor: 'pointer', color: '#15803d' }} aria-label="Download PDF" onClick={() => downloadPdf(r)} /></span>}
                      </td>
                      <td style={{ padding: '5px 8px' }}>{i + 1}</td>
                      <td style={{ padding: '5px 8px' }}>{r.docFor === 'SB' ? 'SB' : r.docFor === 'Invoice' ? 'Invoice' : 'Item'}</td>
                      <td style={{ padding: '5px 8px', fontWeight: 700, color: r.irn ? '#15803d' : '#b91c1c' }}>{r.irn || (r.file ? 'to sign' : r.signedOnly ? 'signed - enter IRN' : '-')}</td>
                      <td style={{ padding: '5px 8px' }}>{r.drn}</td>
                      <td style={{ padding: '5px 8px' }}>{r.refNo}</td>
                      <td style={{ padding: '5px 8px' }} title={r.docName}>{r.docCode}</td>
                      <td style={{ padding: '5px 8px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.fileName}>{r.fileUrl ? <a href={r.fileUrl} target="_blank" rel="noreferrer" title={'Open ' + (r.fileName || 'PDF')}>{r.fileName || 'PDF'}</a> : r.fileName}</td>
                      <td style={{ padding: '5px 8px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.issuerName}>{r.issuerName}</td>
                      <td style={{ padding: '5px 8px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.beneficiaryName}>{r.beneficiaryName}</td>
                      <td style={{ padding: '5px 8px' }}>{r.placeOfIssue}</td>
                      <td style={{ padding: '5px 8px' }}>{r.issueDate}</td>
                      <td style={{ padding: '5px 8px' }}>{r.expiryDate}</td>
                      <td style={{ padding: '5px 8px', color: e.length ? '#b45309' : '#15803d', fontWeight: 600 }} title={e.join(', ')}>{e.length ? '⚠ ' + e.length + ' missing' : 'OK'}</td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: '12px 18px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {askPin ? (
              <>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#6d28d9' }}>DSC token PIN</span>
                <input type="password" style={{ ...inp, width: '110px' }} value={pin} onChange={e => setPin(e.target.value)} autoFocus />
                {(icegateProfiles || []).length > 1 && (
                  <select style={{ ...inp, width: '170px' }} value={selectedIcegateProfile || ''} onChange={e => setSelectedIcegateProfile(e.target.value)}>
                    {icegateProfiles.map(p => <option key={p.id} value={p.id}>{p.loginId} ({p.profileName})</option>)}
                  </select>)}
                <button type="button" disabled={busy || !pin} style={{ ...btn(busy || !pin ? '#a5b4fc' : '#4f46e5') }} onClick={uploadPending}><Upload size={13} /> {busy ? 'Signing...' : 'Sign with DSC'}</button>
                <button type="button" style={btn('#f1f5f9', '#334155')} onClick={() => setAskPin(false)}>Cancel</button>
              </>
            ) : (
              <button type="button" disabled={!pending || busy} style={btn(pending && !busy ? '#4f46e5' : '#cbd5e1')} onClick={() => (tool ? uploadPending() : setAskPin(true))} title={tool ? "Sign with the DSC token of this PC - EagleView Signer asks the PIN in its own window; the signed PDF is kept with the job. Then upload it on the e-Sanchit portal and enter the IRN" : "Sign the attached PDFs with your DSC token (Local Signer, port 5050); the signed PDF is kept with the job. Then upload it on the e-Sanchit portal and enter the IRN"}><Upload size={13} /> {busy ? 'Signing - see EagleView Signer...' : 'Sign ' + pending + ' PDF(s)'}</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={btn('#fff', '#334155')} onClick={onClose}>Cancel</button>
            <button type="button" style={btn('#16a34a')} onClick={save}><Save size={13} /> OK - keep {rows.length} document(s)</button>
          </div>
        </div>
      </div>
    </div>
    </BodyPortal>
  );
}
