// e-Sanchit supporting documents panel - one component for tab 5 "Supporting Docs" (whole job) and the item popup
// (Items tab > Supporting Docs), 29-Oct-2026. Entry form on top, the list below with edit / copy / remove on each row,
// PDF attach + DSC sign & upload to e-Sanchit (gives the IRN), copy of another job's documents by job no.
// Row shape (saved as-is on the job in esanchitDocs and, for item rows, on the item in docsData):
//   irn, drn, docCode, docName, fileName, fileType, docFor HEADER | INVOICE | ITEM, invSrNo, itemSrNo,
//   issuerCode, issuerName, issuerAddr1, issuerAddr2, issuerCity, issuerPin,
//   beneCode, beneName, beneAddr1, beneAddr2, beneCity, benePin, placeOfIssue, issueDate, expiryDate, isDiffId, icegateId
// `itemCtx` = { invSr, itemSr } puts the panel in item mode: "Doc. for" = this item / its invoice / BE, serials filled
// from the item, no mandatory-docs line.
import React, { useEffect, useMemo, useState } from 'react';
import { getMaster } from '../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import { Copy, Download, Edit2, FileUp, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { downloadPdf, shortPdfName } from '../../utils/downloadPdf';
import { localSigner, signPdf } from '../../utils/dscSigner';
import toast from 'react-hot-toast';
import askConfirm from '../common/askConfirm'; // 22-Nov-2026: EagleView question window in place of the browser's OK / Cancel box
import ModernDatePicker from '../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box (same YYYY-MM-DD value)

export const EMPTY_DOC = { irn: '', drn: '', docCode: '', docName: '', fileName: '', fileType: 'PDF', docFor: 'HEADER', invSrNo: '', itemSrNo: '',
  issuerCode: '', issuerName: '', issuerAddr1: '', issuerAddr2: '', issuerCity: '', issuerPin: '',
  beneCode: '', beneName: '', beneAddr1: '', beneAddr2: '', beneCity: '', benePin: '',
  placeOfIssue: '', issueDate: '', expiryDate: '', isDiffId: false, icegateId: '', isApplicable: false };

const ymd = (v) => { const s = String(v || '').trim(); const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
export const newDocId = () => `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// rows saved by the older item popup (refNo, issuerAddress, beneficiaryName, issueLocation, date, docFor BE / ITEM) or
// by the tab -> one shape
export function normDoc(d, i = 0) {
  d = d || {};
  const oldIrn = !d.irn && /^\d{10,}$/.test(String(d.icegateId || '')) ? String(d.icegateId) : '';
  const lvl = String(d.docFor || 'HEADER').toUpperCase();
  return {
    ...EMPTY_DOC, ...d, id: d.id || `doc-${i}-${Math.random().toString(36).slice(2, 6)}`,
    irn: d.irn || oldIrn, drn: d.drn || d.refNo || '', docCode: String(d.docCode || ''), fileName: d.fileName || d.docName || '', docName: d.docName || '',
    issuerAddr1: d.issuerAddr1 || d.issuerAddress || d.issuerAddress1 || '', issuerAddr2: d.issuerAddr2 || d.issuerAddress2 || '',
    beneCode: d.beneCode || d.beneficiaryCode || '', beneName: d.beneName || d.beneficiaryName || '', beneAddr1: d.beneAddr1 || d.beneficiaryAddress1 || '',
    beneAddr2: d.beneAddr2 || d.beneficiaryAddress2 || '', beneCity: d.beneCity || d.beneficiaryCity || '', benePin: d.benePin || d.beneficiaryPin || '',
    placeOfIssue: d.placeOfIssue || d.issueLocation || '', issueDate: ymd(d.issueDate || d.date), expiryDate: ymd(d.expiryDate),
    icegateId: oldIrn ? '' : (d.icegateId || ''), isDiffId: !!d.isDiffId, fileType: String(d.fileType || 'PDF').toUpperCase(),
    docFor: lvl === 'BE' || lvl === 'HEADER' ? 'HEADER' : lvl === 'INVOICE' ? 'INVOICE' : 'ITEM',
  };
}

// what ICEGATE expects with every BE (UN/EDIFACT 1001 document codes used by e-Sanchit)
const EXPECTED = (mode) => [
  mode === 'AIR' ? { codes: ['740000'], label: '740000 Air waybill' } : mode === 'LAND' ? { codes: ['705000', '740000', '730000'], label: 'Transport document (705000 Bill of lading / 730000 Road consignment note)' } : { codes: ['705000'], label: '705000 Bill of lading' },
  { codes: ['380000', '331000'], label: '380000 Commercial invoice (or 331000 invoice-cum-packing list)' },
  { codes: ['271000', '331000'], label: '271000 Packing list (or 331000)' },
];

const inp = { height: '26px', padding: '0 7px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: '#fff', width: '100%', boxSizing: 'border-box', minWidth: 0 };
const lab = { fontSize: '11px', fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' };
const box = { border: '1px solid #dbe4ee', borderRadius: '6px', padding: '8px 10px', background: '#f8fafc' };
const btn = (bg, c = '#fff') => ({ height: '28px', padding: '0 12px', border: 'none', borderRadius: '5px', background: bg, color: c, fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' });
const td = { padding: '4px 8px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' };

// ICEGATE checks of one document (SUPPORTINGDOCS)
export function checkDoc(r, hasFile) {
  const e = [];
  if (!r.docCode) e.push('Doc. type code');
  if (r.irn && !/^\d{16}$/.test(r.irn)) e.push('IRN must be 16 digits');
  if (!r.irn && !hasFile) e.push('IRN (or a PDF to upload)');
  if (!r.issuerName) e.push('Issuing party name');
  if (!r.beneName) e.push('Beneficiary name');
  if (!r.placeOfIssue) e.push('Place of issue');
  if (!r.issueDate) e.push('Issue date');
  if (r.issueDate && new Date(r.issueDate) > new Date()) e.push('Issue date is in the future');
  if (r.expiryDate && r.issueDate && r.expiryDate < r.issueDate) e.push('Expiry before issue date');
  if (r.docFor === 'INVOICE' && !r.invSrNo) e.push('Invoice');
  if (r.docFor === 'ITEM' && (!r.invSrNo || !r.itemSrNo)) e.push('Invoice and item sr no');
  if (r.isDiffId && !r.icegateId) e.push('ICEGATE id (marked different)');
  return e;
}

// 17-Nov-2026: city of the supplier - address 3 as a rule; when it holds only the country (or nothing), the last word
// before the comma of address 2 ("UNIT 111 ATLANTA, GA" -> ATLANTA); else blank for the operator (was: address 3 always)
const cleanPart = (t) => String(t == null ? '' : t).replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim().toUpperCase();
export function supplierCity(a2, a3, ...countries) {
  const c3 = cleanPart(a3); const cs = countries.map(cleanPart).filter(Boolean);
  if (c3 && !cs.includes(c3)) return c3.slice(0, 35);
  const m = /([A-Z][A-Z .'-]{2,})\s*,[^,]*$/i.exec(String(a2 || ''));
  const w = m ? m[1].trim().split(/\s+/).pop() : '';
  return /^[A-Z]{3,}$/i.test(w) && !cs.includes(w.toUpperCase()) ? w.toUpperCase() : '';
}
// 17-Nov-2026: a HAWB / HBL is issued on the HAWB date, a MAWB / BL / waybill on the MAWB date (not the invoice date)
const HOUSE_DOCS = /^(703000|714000)$/, MASTER_DOCS = /^(700000|704000|705000|709000|710000|711000|740000|741000)$/;
export function transportDate(code, jobData) {
  const c = String(code || '');
  if (!HOUSE_DOCS.test(c) && !MASTER_DOCS.test(c)) return '';
  let rows = jobData?._igmRows; if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch (e) { rows = []; } }
  const r0 = (Array.isArray(rows) ? rows : []).find(r => r && (r.hawbDate || r.mawbDate)) || {};
  const d = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? m[0] : ''; };
  const house = d(jobData?.hawbDate) || d(r0.hawbDate), master = d(jobData?.mawbDate) || d(r0.mawbDate);
  return HOUSE_DOCS.test(c) ? (house || master) : (master || house);
}

export default function EsanchitDocsPanel({ rows: rawRows, setRows, jobData, itemCtx, otherIrns, title, compact }) {
  const rows = useMemo(() => (Array.isArray(rawRows) ? rawRows : []).map((d, i) => normDoc(d, i)), [rawRows]);
  const item = itemCtx || null;
  const importer = useMemo(() => ({ beneName: jobData?.autoField_4 || jobData?.nameOfImporter || '', beneAddr1: jobData?.autoField_6 || '', beneAddr2: jobData?.autoField_7 || '', beneCity: jobData?.autoField_8 || '', benePin: jobData?.autoField_10 || '' }), [jobData]);
  const fresh = () => ({ ...EMPTY_DOC, ...importer, docFor: item ? 'ITEM' : 'HEADER' });
  // 29-Oct-2026: issuing party of an invoice / packing list / COO is the supplier of the item's invoice (as in every filed
  // BE); place of issue = the supplier's country name (filed BEs carry JAPAN / UNITED KINGDOM / IND). "Supplier" button +
  // automatic fill when the issuing party is still empty.
  const [countries, setCountries] = useState([]);
  const countryName = (c) => { const t = String(c || '').trim(); if (!t) return ''; const x = countries.find(k => String(k.code || '').toUpperCase() === t.toUpperCase()); return (x ? String(x.name) : t).toUpperCase(); };
  const supplierOf = () => {
    const invs = Array.isArray(jobData?.invoices) ? jobData.invoices : [];
    const inv = (item && item.invSr ? invs[parseInt(item.invSr, 10) - 1] : null) || (form.docFor === 'INVOICE' && form.invSrNo ? invs[parseInt(form.invSrNo, 10) - 1] : null) || invs[0] || null;
    if (!inv) return null;
    return { issuerName: String(inv.supplierName || '').toUpperCase(), issuerAddr1: String(inv.supplierAddress1 || '').toUpperCase(), issuerAddr2: String(inv.supplierAddress2 || '').toUpperCase(),
      issuerCity: supplierCity(inv.supplierAddress2, inv.supplierAddress3, inv.supplierCountryName, inv.supplierCountry, countryName(inv.supplierCountry || inv.supplierCountryName)), issuerPin: String(inv.supplierPin || ''), placeOfIssue: countryName(inv.supplierCountry || inv.supplierCountryName) };
  };
  const fillSupplier = () => { const s = supplierOf(); if (!s || !s.issuerName) { toast.error('No supplier on this invoice (3. Invoices)'); return; } setForm(f => ({ ...f, ...s, placeOfIssue: f.placeOfIssue || s.placeOfIssue })); };
  // DSC Local Signer reachable? Asked through the backend, which holds the signer URL setting (30-Oct-2026)
  const [signer, setSigner] = useState(null); // null = checking, false = not running, object = status
  const [form, setForm] = useState(fresh);
  const [editId, setEditId] = useState(null);
  const [masters, setMasters] = useState([]);
  const [codeQuery, setCodeQuery] = useState('');
  const [defaultIcegateId, setDefaultIcegateId] = useState('');
  const [jobRef, setJobRef] = useState('');
  const [pin, setPin] = useState('');
  const [askPin, setAskPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileOf, setFileOf] = useState({}); // row id -> File waiting for upload (not saved with the job)

  // asked again by pressing the status (after plugging in the token or installing its driver)
  // 16-Nov-2026: EagleView Signer on this PC first (PIN asked in the tool); else the server's signer as before
  const [tool, setTool] = useState(undefined); // undefined = checking, null = not on this PC, object = its status
  const checkSigner = () => {
    setSigner(null); setTool(undefined);
    localSigner(true).then(st => {
      setTool(st);
      if (!st) fetch('/api/icegate/signer-status').then(r => r.json()).then(j => setSigner(j && j.success ? j : false)).catch(() => setSigner(false));
    });
  };
  useEffect(() => {
    fetch('/api/masters/esanchits').then(r => r.json()).then(j => setMasters(Array.isArray(j) ? j : [])).catch(() => setMasters([]));
    getMaster('/api/masters/countries').then(j => setCountries(Array.isArray(j) ? j : (j && j.data) || [])).catch(() => setCountries([]));
    checkSigner();
    fetch('/api/icegate-profiles').then(r => r.json()).then(j => { if (j.success && j.data && j.data.length) { const def = j.data.find(p => p.isDefault) || j.data[0]; setDefaultIcegateId(def.loginId || ''); } }).catch(() => {});
  }, []);
  // a new job / another job loaded: beneficiary of the next document = its importer
  useEffect(() => { if (!editId) setForm(f => ({ ...f, ...(f.beneName ? {} : importer) })); }, [importer]); // eslint-disable-line

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  // doc code typed / picked: invoice (380000), packing list (271000), COO (861000, 861006) and other supplier papers get the
  // supplier as issuing party when it is still empty
  useEffect(() => {
    const code = String(form.docCode || '');
    if (!/^(380000|271000|861\d{3}|331000|705000|703000)$/.test(code) || form.issuerName) return;
    const s = supplierOf(); if (s && s.issuerName && !/^(705000|703000)$/.test(code)) setForm(f => f.issuerName ? f : ({ ...f, ...s, placeOfIssue: f.placeOfIssue || s.placeOfIssue }));
  }, [form.docCode]); // eslint-disable-line
  // 17-Nov-2026: HAWB / MAWB type document with no issue date yet: the HAWB / MAWB date of the job
  useEffect(() => {
    const t = transportDate(form.docCode, jobData);
    if (t && !form.issueDate) setForm(f => f.issueDate ? f : ({ ...f, issueDate: t }));
  }, [form.docCode]); // eslint-disable-line
  // 03-Nov-2026: inactive master rows (the old 7-digit codes) are not offered
  const masterList = masters.filter(m => m.isActive !== false && m.isActive !== 0).filter(m => !codeQuery || String(m.documentCode).includes(codeQuery) || String(m.description || '').toLowerCase().includes(codeQuery.toLowerCase())).slice(0, 80);
  const invoices = jobData?.invoices || [];
  const mode = String(jobData?.shipmentMode || 'SEA').toUpperCase();
  // serials of a row: in item mode from the item; in the tab from the form
  const withSerials = (r) => {
    const lvl = r.docFor || 'HEADER';
    if (item) return { ...r, invSrNo: lvl === 'HEADER' ? '' : String(item.invSr || ''), itemSrNo: lvl === 'ITEM' ? String(item.itemSr || '') : '' };
    return { ...r, invSrNo: lvl === 'HEADER' ? '' : r.invSrNo, itemSrNo: lvl === 'ITEM' ? r.itemSrNo : '' };
  };
  const check = (r) => checkDoc(r, !!fileOf[r.id]);

  // 29-Oct-2026: an attached PDF is kept with the job at once (uploads/esanchit_archive/<job no>/...) so the document is
  // there for later even when it is never signed / uploaded; the row keeps its link (fileUrl) in the job record
  const jobKey = () => String(jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : (jobData?.id ? 'job-' + jobData.id : 'draft'));
  const archive = async (file, r) => {
    try {
      const fd = new FormData(); fd.append('jobNo', jobKey()); fd.append('docCode', r.docCode || ''); fd.append('irn', r.irn || ''); fd.append('pdf', file);
      const j = await fetch('/api/icegate/esanchit-archive', { method: 'POST', body: fd }).then(x => x.json());
      if (j && j.success) return { fileUrl: j.fileUrl, archivedName: j.fileName };
      toast.error('PDF could not be kept with the job: ' + ((j && j.error) || 'no answer'));
    } catch (e) { toast.error('PDF could not be kept with the job: ' + e.message); }
    return {};
  };
  const addOrUpdate = async () => {
    const r = withSerials({ ...form, irn: String(form.irn || '').replace(/\s/g, ''), docCode: String(form.docCode || '').trim(), id: editId || newDocId() });
    const errs = checkDoc(r, !!(form._file || fileOf[r.id]));
    if (errs.length) { toast.error('Missing / wrong: ' + errs.join(', ')); return; }
    if (r.irn && rows.some(x => x.irn === r.irn && x.id !== editId)) { toast.error('IRN ' + r.irn + ' is already in the list'); return; }
    if (r.irn && otherIrns && otherIrns.includes(r.irn)) { toast.error('IRN ' + r.irn + ' is already on the job (another invoice / item)'); return; }
    const { _file, ...row } = r;
    // 14-Nov-2026: only a newly attached PDF is filed (Update of a row with the same PDF filed it again)
    if (_file && _file !== fileOf[row.id]) { setFileOf(m => ({ ...m, [row.id]: _file })); Object.assign(row, await archive(_file, row), { signedOnly: false }); }
    if (editId) { setRows(rows.map(x => x.id === editId ? row : x)); toast.success('Document updated'); }
    else { setRows([...rows, { ...row, srNo: rows.length + 1 }]); toast.success('Document added'); }
    // next document: parties, place and dates usually repeat; document details start empty
    setForm({ ...form, irn: '', drn: '', docCode: '', docName: '', fileName: '', _file: undefined, fileUrl: undefined, archivedName: undefined, signedOnly: false }); setEditId(null);
  };
  const edit = (r) => { setForm({ ...r, _file: fileOf[r.id] }); setEditId(r.id); };
  const copyRow = (r) => { setForm({ ...r, irn: '', drn: '', fileName: '', _file: undefined, fileUrl: undefined, archivedName: undefined, signedOnly: false }); setEditId(null); toast('Copied to the form - enter the IRN of the new document and click Add', { icon: 'ℹ️' }); };
  const remove = async (r) => { if (await askConfirm({ title: 'Remove this document?', message: `${r.irn || r.fileName || r.docCode}`, okLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger' })) { setRows(rows.filter(x => x.id !== r.id)); if (editId === r.id) { setEditId(null); setForm(fresh()); } } };
  const cancelEdit = () => { setEditId(null); setForm(fresh()); };

  const attach = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = null; if (!f) return;
    if (!/\.pdf$/i.test(f.name)) { toast.error('e-Sanchit takes PDF files only'); return; }
    if (f.size > 20 * 1024 * 1024) { toast.error('File is larger than 20 MB'); return; }
    setForm(fm => ({ ...fm, _file: f, fileName: f.name, fileType: 'PDF' }));
  };

  // documents (with IRN) of another import job, by its job no. In item mode they come in at this item's level.
  const addByJobRef = async () => {
    const no = jobRef.trim().toUpperCase();
    if (!no) { toast.error('Enter the job no to copy documents from'); return; }
    try {
      const list = await fetch('/api/import-jobs?limit=5000').then(r => r.json());
      const hit = (list.data || list || []).find(j => String(j.jobNo || '').toUpperCase() === no);
      if (!hit) { toast.error('Job ' + no + ' not found'); return; }
      const full = await fetch('/api/import-jobs/' + hit.id).then(r => r.json());
      let docs = (full.data || {}).esanchitDocs; if (typeof docs === 'string') { try { docs = JSON.parse(docs); } catch (e) { docs = []; } }
      const have = new Set([...rows.map(x => x.irn), ...(otherIrns || [])]);
      const add = (Array.isArray(docs) ? docs : []).map(normDoc).filter(d => d.irn && !have.has(d.irn))
        .map((d, i) => withSerials({ ...d, id: newDocId(), srNo: rows.length + i + 1, docFor: item ? (d.docFor === 'HEADER' ? 'HEADER' : 'ITEM') : d.docFor }));
      if (!add.length) { toast('No new document with an IRN in job ' + no, { icon: 'ℹ️' }); return; }
      setRows([...rows, ...add]); toast.success(add.length + ' document(s) added from job ' + no); setJobRef('');
    } catch (err) { toast.error('Could not read job ' + no + ': ' + err.message); }
  };

  // sign with the local DSC signer and upload to e-Sanchit the PDFs that have no IRN yet
  const pending = rows.filter(r => !r.irn && fileOf[r.id]);
  const uploadPending = async () => {
    if (!pending.length) { toast.error('No PDF waiting for upload'); return; }
    setBusy(true);
    let ok = 0, signedOnly = 0; const next = [...rows]; const files = { ...fileOf };
    try {
      for (let i = 0; i < next.length; i++) {
        const d = next[i]; const f = files[d.id]; if (d.irn || !f) continue;
        if (!d.docCode) { toast.error(d.fileName + ': doc. type code missing'); continue; }
        let sg;
        try { sg = await signPdf(f, tool ? '' : pin, 'e-Sanchit document ' + d.docCode + (jobKey() ? ' - job ' + jobKey() : '')); }
        catch (err) { if (err.cancelled) { toast('Signing cancelled in EagleView Signer.', { icon: 'ℹ️' }); break; } throw err; }
        const signed = new File([sg.blob], 'signed_' + f.name, { type: 'application/pdf' });
        // text fields before the file: the server files the PDF under the job no (29-Oct-2026)
        const uf = new FormData(); uf.append('jobNo', jobKey()); uf.append('documentCode', d.docCode); uf.append('irn', d.irn || ''); uf.append('profileId', 1); uf.append('pdf', signed);
        const ur = await fetch('/api/icegate/upload-esanchit', { method: 'POST', body: uf }).then(r => r.json());
        if (ur.success && /^\d{16}$/.test(String(ur.irn || ''))) { next[i] = { ...d, irn: ur.irn, drn: d.drn || ur.drn || '', fileName: signed.name, fileUrl: ur.fileUrl }; delete files[d.id]; ok++; }
        // 29-Oct-2026: signed but not uploaded to e-Sanchit (portal upload not automated): keep the signed PDF on the row,
        // the user uploads it on the portal and types the IRN - no invented IRN
        else if (ur.signedOnly) { next[i] = { ...d, fileName: signed.name, fileUrl: ur.fileUrl, signedOnly: true }; delete files[d.id]; signedOnly++; }
        else toast.error('Upload of ' + d.fileName + ' failed: ' + (ur.error || 'no answer'));
      }
      setRows(next); setFileOf(files);
      if (ok) toast.success(ok + ' IRN(s) received');
      if (signedOnly) toast(signedOnly + ' PDF(s) signed with the DSC and saved. Upload them on the e-Sanchit portal and enter the 16-digit IRN here (Edit the row).', { duration: 10000, icon: '✍️' });
      if (ok || signedOnly) { setAskPin(false); setPin(''); }
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const F = (k, extra = {}) => extra.type === 'date' ? (
    <ModernDatePicker style={{ ...inp, ...(extra.style || {}) }} value={form[k] || ''} title={extra.title} onChange={e => set(k, e.target.value)} />) : (
    <input style={{ ...inp, ...(extra.style || {}) }} value={form[k] || ''} maxLength={extra.max} type={extra.type || 'text'} placeholder={extra.ph || ''} title={extra.title} list={extra.list}
      onChange={e => set(k, extra.upper ? e.target.value.toUpperCase() : extra.digits ? e.target.value.replace(/\D/g, '') : e.target.value)} />);
  const L = (t) => <span style={lab}>{t}</span>;
  const party = (p, ttl, fill) => (
    <div style={{ ...box, display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr', gap: '5px 8px', alignItems: 'center' }}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '12px', color: '#0f172a' }}>{ttl}</strong>
        {fill && <button type="button" style={{ ...btn('#e0f2fe', '#0369a1'), height: '22px', padding: '0 8px', fontSize: '10px' }} onClick={fill.fn}>{fill.label}</button>}
      </div>
      {L('Name *')}<div style={{ gridColumn: '2 / -1', display: 'flex', gap: '6px' }}>{F(p + 'Name', { max: 70, upper: true, style: { background: '#f0fdf4' } })}{F(p + 'Code', { max: 17, upper: true, ph: 'Code', style: { width: '110px', flex: 'none' } })}</div>
      {L('Address 1')}<div style={{ gridColumn: '2 / -1' }}>{F(p + 'Addr1', { max: 70, upper: true })}</div>
      {L('Address 2')}<div style={{ gridColumn: '2 / -1' }}>{F(p + 'Addr2', { max: 70, upper: true })}</div>
      {L('City')}{F(p + 'City', { max: 35, upper: true })}{L('Pin')}{F(p + 'Pin', { max: 10, style: { width: '90px' } })}
    </div>);
  const have = (codes) => rows.some(r => codes.includes(String(r.docCode)));
  const forText = (r) => r.docFor === 'INVOICE' ? `Inv ${r.invSrNo}` : r.docFor === 'ITEM' ? `Item ${r.invSrNo}/${r.itemSrNo}` : 'BE';
  const panelCls = compact ? undefined : 'glass-panel';
  const panelSty = compact ? { border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' } : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: compact ? undefined : '100%' }}>
      {/* entry form */}
      <div className={panelCls} style={{ ...panelSty, padding: '8px 10px', display: 'grid', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--primary-text, #0f172a)', margin: 0, fontWeight: 'bold', textTransform: 'uppercase' }}>{title || 'Supporting Documents (e-Sanchit)'}</h3>
          {editId && <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>Editing a document - click Update or Cancel</span>}
        </div>
        {/* document */}
        <div style={{ ...box, display: 'grid', gridTemplateColumns: 'auto 150px auto 150px auto minmax(240px, 1fr) auto minmax(180px, 1fr)', gap: '6px 8px', alignItems: 'center' }}>
          {L('IRN')}{F('irn', { max: 16, digits: true, ph: '16 digits', style: { background: '#fefce8' } })}
          {L('DRN')}{F('drn', { max: 35, ph: 'Doc ref no', style: { background: '#fefce8' } })}
          {L('Doc. Type Code *')}
          <div style={{ display: 'flex', gap: '4px' }}>
            <input style={{ ...inp, width: '72px', flex: 'none', background: '#eff6ff' }} value={form.docCode || ''} maxLength={6} onChange={e => { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); /* 03-Nov-2026: codes can be alphanumeric, e.g. 022CO1 */ const m = masters.find(x => String(x.documentCode) === v); setForm(f => ({ ...f, docCode: v, docName: m ? m.description : f.docName })); }} placeholder="Code" />
            <select style={inp} value={form.docCode || ''} onChange={e => { const m = masters.find(x => String(x.documentCode) === e.target.value); setForm(f => ({ ...f, docCode: e.target.value, docName: m ? m.description : '' })); }}>
              <option value="">-- from e-Sanchit master --</option>
              {form.docCode && !masterList.some(m => String(m.documentCode) === String(form.docCode)) && <option value={form.docCode}>{form.docCode} {form.docName ? '- ' + form.docName : ''}</option>}
              {masterList.map(m => <option key={m.id || m.documentCode} value={m.documentCode}>{m.documentCode} - {m.description}</option>)}
            </select>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="filter the master list"><Search size={12} color="#94a3b8" /><input style={{ ...inp, width: '90px' }} placeholder="filter" value={codeQuery} onChange={e => setCodeQuery(e.target.value)} /></span>
          </div>
          {L('File')}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {F('fileName', { max: 100, ph: 'File name', style: { flex: 1 } })}
            <input type="file" id={item ? 'esanchitPdfItem' : 'esanchitPdfImport'} accept=".pdf" style={{ display: 'none' }} onChange={attach} />
            <button type="button" style={{ ...btn('#eef2ff', '#4338ca'), height: '26px', padding: '0 8px' }} onClick={() => document.getElementById(item ? 'esanchitPdfItem' : 'esanchitPdfImport').click()} title="Attach a PDF to sign and upload to e-Sanchit"><FileUp size={12} /> PDF</button>
          </div>
        </div>
        {/* parties */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {party('issuer', 'Issuing party', { label: 'Supplier', fn: fillSupplier })}
          {party('bene', 'Beneficiary party', { label: 'Importer', fn: () => setForm(f => ({ ...f, ...importer })) })}
        </div>
        {/* place, dates, level */}
        <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'center' }}>
          {L('Place of issue *')}{F('placeOfIssue', { max: 35, upper: true, style: { width: '150px' }, list: 'esanchit-places', ph: 'country / IND', title: 'Country of the issuing party (filed BEs: JAPAN, UNITED KINGDOM, IND)' })}
          <datalist id="esanchit-places"><option value="IND">India</option>{countries.slice(0, 300).map(c => <option key={c.code} value={String(c.name || '').toUpperCase()}>{c.code}</option>)}</datalist>
          {L('Issue date *')}{F('issueDate', { type: 'date', style: { width: '140px' } })}
          {L('Expiry date')}{F('expiryDate', { type: 'date', style: { width: '140px' } })}
          <label style={{ ...lab, display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} title={defaultIcegateId ? 'Default ICEGATE id ' + defaultIcegateId : ''}>
            <input type="checkbox" checked={!!form.isDiffId} onChange={e => setForm(f => ({ ...f, isDiffId: e.target.checked, icegateId: e.target.checked ? f.icegateId : '' }))} /> ICEGATE id different?
          </label>
          {form.isDiffId && F('icegateId', { max: 25, upper: true, ph: 'ICEGATE ID', style: { width: '130px' } })}
          {L('File type')}
          <select style={{ ...inp, width: '70px' }} value={form.fileType || 'PDF'} onChange={e => set('fileType', e.target.value)}><option>PDF</option></select>
          {L('Doc. for')}
          <select style={{ ...inp, width: '150px', background: form.docFor === 'HEADER' ? '#eff6ff' : form.docFor === 'INVOICE' ? '#f0fdf4' : '#fff' }} value={form.docFor || 'HEADER'} onChange={e => set('docFor', e.target.value)}>
            {item ? (<>
              <option value="ITEM">This item ({item.invSr}/{item.itemSr})</option><option value="INVOICE">Its invoice ({item.invSr})</option><option value="HEADER">BE (all)</option>
            </>) : (<>
              <option value="HEADER">BE (all invoices)</option><option value="INVOICE">Invoice</option><option value="ITEM">Item</option>
            </>)}
          </select>
          {!item && (form.docFor === 'INVOICE' || form.docFor === 'ITEM') && (<>
            {L('Invoice')}
            <select style={{ ...inp, width: '160px' }} value={form.invSrNo || ''} onChange={e => set('invSrNo', e.target.value)}>
              <option value="">Select</option>
              {invoices.map((iv, i) => <option key={i} value={String(i + 1)}>{i + 1} - {iv.invNo || iv.invoiceNo || ''}</option>)}
            </select>
          </>)}
          {!item && form.docFor === 'ITEM' && (<>{L('Item sr no')}{F('itemSrNo', { digits: true, style: { width: '60px' } })}</>)}
          <span style={{ flex: 1 }} />
          <button type="button" style={btn(editId ? '#0284c7' : '#16a34a')} onClick={addOrUpdate}>{editId ? <><Save size={13} /> Update</> : <><Plus size={13} /> Add</>}</button>
          {editId && <button type="button" style={btn('#f1f5f9', '#334155')} onClick={cancelEdit}><X size={13} /> Cancel</button>}
          <span style={{ width: '1px', height: '22px', background: '#cbd5e1' }} />
          {L('Job ref. no')}
          <input style={{ ...inp, width: '130px' }} placeholder="other job no" value={jobRef} onChange={e => setJobRef(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addByJobRef(); }} />
          <button type="button" style={btn('#0284c7')} onClick={addByJobRef} title="Copy the documents (with IRN) of another import job"><Plus size={13} /> Add by job ref. no</button>
        </div>
      </div>

      {/* list */}
      <div className={panelCls} style={{ ...panelSty, overflow: 'auto', maxHeight: compact ? '180px' : '38vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead style={{ background: 'var(--primary-bg-light, #f1f5f9)', position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>{['', 'Sr', 'For', 'IRN', 'DRN', 'Doc code', 'File', 'Issuing party', 'Beneficiary', 'Place', 'Issue', 'Expiry', 'Status'].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={13} style={{ padding: '14px', textAlign: 'center', color: '#94a3b8' }}>No document yet - fill the form above and click Add</td></tr>}
            {rows.map((r, i) => {
              const e = check(r);
              return (
                <tr key={r.id} style={{ background: editId === r.id ? '#fefce8' : i % 2 ? '#fcfcfd' : '#fff' }}>
                  <td style={{ ...td, display: 'flex', gap: '8px' }}>
                    <Edit2 size={13} style={{ cursor: 'pointer', color: '#0f172a' }} title="Edit" onClick={() => edit(r)} />
                    <Copy size={13} style={{ cursor: 'pointer', color: '#2563eb' }} title="Copy" onClick={() => copyRow(r)} />
                    <Trash2 size={13} style={{ cursor: 'pointer', color: '#ef4444' }} title="Remove" onClick={() => remove(r)} />
                    {r.fileUrl && <span title={'Download ' + shortPdfName(r) + (r.signedOnly ? ' - upload it on e-Sanchit' : '')} style={{ display: 'inline-flex' }}><Download size={13} style={{ cursor: 'pointer', color: '#15803d' }} aria-label="Download PDF" onClick={() => downloadPdf(r)} /></span>}
                  </td>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, fontWeight: 600, color: r.docFor === 'HEADER' ? '#1d4ed8' : r.docFor === 'INVOICE' ? '#15803d' : '#334155' }} title={r.docFor === 'ITEM' ? 'Kept on the item' : 'Kept once on the job (shared by all its items)'}>{forText(r)}</td>
                  <td style={{ ...td, fontWeight: 700, color: r.irn ? '#15803d' : '#b91c1c' }}>{r.irn || (fileOf[r.id] ? 'to upload' : r.signedOnly ? 'signed - enter IRN' : '-')}</td>
                  <td style={td}>{r.drn}</td>
                  <td style={td} title={r.docName}>{r.docCode}</td>
                  <td style={{ ...td, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.fileName}>{r.fileUrl ? <a href={r.fileUrl} target="_blank" rel="noreferrer" title="Signed PDF (download / upload on e-Sanchit)">{r.fileName}</a> : r.fileName}</td>
                  <td style={{ ...td, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.issuerName}>{r.issuerName}</td>
                  <td style={{ ...td, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.beneName}>{r.beneName}</td>
                  <td style={td}>{r.placeOfIssue}</td>
                  <td style={td}>{ymd(r.issueDate)}</td>
                  <td style={td}>{ymd(r.expiryDate)}</td>
                  <td style={{ ...td, color: e.length ? '#b45309' : '#15803d', fontWeight: 600 }} title={e.join(', ')}>{e.length ? '⚠ ' + e.length + ' missing' : 'OK'}</td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>

      {/* expected documents + upload */}
      <div className={panelCls} style={{ ...panelSty, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '11px', color: '#334155', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {item ? <span style={{ color: '#64748b' }}>1) attach the PDF + fill the form → <b>Add</b> (PDF is kept with the job) &nbsp;2) <b>Sign</b> → DSC token PIN → signed PDF kept with the job &nbsp;3) upload the signed PDF on e-Sanchit (icegate.gov.in) → type the 16-digit <b>IRN</b> in the row (Edit) → OK</span> : (<>
            <strong>Mandatory docs ({mode}):</strong>
            {EXPECTED(mode).map((x, i) => <span key={i} style={{ color: have(x.codes) ? '#15803d' : '#b91c1c' }}>{have(x.codes) ? '✓' : '✗'} {x.label}</span>)}
          </>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {askPin ? (<>
            <span style={{ ...lab, color: '#6d28d9' }}>DSC token PIN</span>
            <input type="password" style={{ ...inp, width: '110px' }} value={pin} onChange={e => setPin(e.target.value)} autoFocus />
            <button type="button" disabled={busy || !pin} style={btn(busy || !pin ? '#a5b4fc' : '#4f46e5')} onClick={uploadPending}><Upload size={13} /> {busy ? 'Signing...' : 'Sign with DSC'}</button>
            <button type="button" style={btn('#f1f5f9', '#334155')} onClick={() => setAskPin(false)}>Cancel</button>
          </>) : (<>
            {(() => {
              // 16-Nov-2026: three states once the signer runs - no driver / driver but no token / token plugged in (with its name)
              if (tool) {
                const c = tool.certificate || {};
                const tNoDriver = tool.dll_found === false, tNoToken = !tNoDriver && tool.token_present === false;
                const tText = tNoDriver ? '● EagleView Signer - token driver not found' : tNoToken ? '● EagleView Signer - plug in the DSC token' : '● EagleView Signer ready - ' + (c.name || (tool.token_labels || []).join(', ') || 'token');
                return <span role="button" tabIndex={0} onClick={checkSigner} onKeyDown={e => { if (e.key === 'Enter') checkSigner(); }} style={{ fontSize: '10px', color: tNoDriver || tNoToken ? '#b45309' : '#15803d', cursor: 'pointer' }}
                  title={'EagleView Signer on this PC' + (c.valid_to ? ' - certificate valid to ' + c.valid_to : '') + '. The PIN is asked in its own window. Press to check again.'}>{tText}</span>;
              }
              const noDriver = signer && signer.dll_found === false;
              const noToken = signer && signer.dll_found !== false && signer.token_present === false;
              const label = signer && Array.isArray(signer.token_labels) && signer.token_labels.length ? ' - ' + signer.token_labels.join(', ') : '';
              const color = signer ? (noDriver || noToken ? '#b45309' : '#15803d') : signer === false ? '#b91c1c' : '#64748b';
              const tip = signer
                ? (noDriver ? 'Signer running but no DSC token driver found - install the driver of your token (ePass, ProxKey, mToken, SafeNet ...), then press the status to check again'
                  : noToken ? 'Token driver found (' + (signer.dll_path || '') + ') but no token is plugged in - plug in the DSC USB token, then press the status to check again'
                  : 'Token driver: ' + (signer.dll_path || ''))
                : 'Run START_SIGNER.bat (in the EDI_AUTOMATION project folder) or START_EDI.bat - the Local Signer listens on port 5050 - and plug in the DSC USB token';
              const text = signer ? (noDriver ? '● DSC Signer running - token driver not found' : noToken ? '● Token driver found - plug in the DSC token' : '● DSC Signer ready' + label)
                : signer === false ? '● DSC Signer app not running (run START_SIGNER.bat)' : '● checking DSC Signer...';
              return <span role="button" tabIndex={0} onClick={checkSigner} onKeyDown={e => { if (e.key === 'Enter') checkSigner(); }} style={{ fontSize: '10px', color, cursor: 'pointer' }} title={tip}>{text}</span>;
            })()}
            <button type="button" disabled={!pending.length || busy} style={btn(pending.length && !busy ? '#4f46e5' : '#cbd5e1')} onClick={() => (tool ? uploadPending() : setAskPin(true))} title="Sign the attached PDFs with your DSC token (EagleView Signer on this PC asks the PIN in its own window; else the Local Signer app, port 5050); the signed PDF is kept with the job"><Upload size={13} /> {busy ? 'Signing - see EagleView Signer...' : 'Sign ' + pending.length + ' PDF(s)'}</button>
          </>)}
        </div>
      </div>
    </div>
  );
}
