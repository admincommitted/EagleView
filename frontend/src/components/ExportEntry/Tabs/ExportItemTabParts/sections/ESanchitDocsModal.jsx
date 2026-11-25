import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Edit2, FileUp, Plus, Save, Search, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { asList } from '@/utils/asList';
import { downloadPdf, shortPdfName } from '@/utils/downloadPdf';
import { localSigner, signPdf } from '@/utils/dscSigner';
import { errorMessage } from '@/services/axiosInstance';
import askConfirm from '@/components/common/askConfirm';
import { Button, Checkbox, DataTable, DateInput, Field, FileButton, Input, Label, Modal, SelectBox } from '@/components/ui';
import { exportEntryApi } from '../../../exportEntryApi';
import { answerOf } from '../answerOf';

const EMPTY = {
  irn: '', drn: '', refNo: '', docCode: '', docName: '', fileName: '', fileType: 'PDF', docFor: 'Item',
  issuerCode: '', issuerName: '', issuerAddress1: '', issuerAddress2: '', issuerCity: '', issuerPin: '',
  beneficiaryCode: '', beneficiaryName: '', beneficiaryAddress1: '', beneficiaryAddress2: '', beneficiaryCity: '', beneficiaryPin: '',
  placeOfIssue: '', issueDate: '', expiryDate: '', icegateDifferent: false, icegateId: '',
};
const DOC_FOR_OPTIONS = [{ value: 'Item', label: 'This item' }, { value: 'Invoice', label: 'Its invoice' }, { value: 'SB', label: 'Whole SB' }];
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_MASTER_OPTIONS = 80;
const JOB_LIST_LIMIT = 2000;
const IRN_PATTERN = /^\d{16}$/;
const BOX = 'tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:p-2.5';

const newDocId = (index = '') => `doc-${Date.now()}-${index}${Math.random().toString(36).slice(2, 6)}`;
const ymd = (value) => {
  const text = String(value || '').trim();
  const parts = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(text);
  return parts ? `${parts[1]}-${parts[2]}-${parts[3]}` : text;
};

// rows saved by older screens / read from an ICEGATE file -> one shape (the _icegate values go into the row's own fields)
function normDoc(doc, index = 0) {
  const icegate = doc?._icegate || {};
  const docForOf = () => {
    if (doc.docFor) return doc.docFor;
    if (icegate.itemSerialNumber && +icegate.itemSerialNumber) return 'Item';
    if (icegate.invoiceSerialNumber && +icegate.invoiceSerialNumber) return 'Invoice';
    return doc._icegate ? 'SB' : 'Item';
  };
  return {
    ...EMPTY, ...doc, _icegate: undefined,
    id: doc.id || `doc-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    irn: doc.irn || icegate.imageReferenceNumber || '', drn: doc.drn || '', refNo: doc.refNo || icegate.documentReferenceNo || '',
    docCode: doc.docCode || icegate.documentTypeCode || '', docFor: docForOf(),
    issuerCode: doc.issuerCode || icegate.documentIssuingPartyCode || '', issuerName: doc.issuerName || doc.issuingParty || icegate.documentIssuingPartyName || '',
    issuerAddress1: doc.issuerAddress1 || doc.issuerAddress || icegate.documentIssuingPartyNameAddress1 || '', issuerAddress2: doc.issuerAddress2 || icegate.documentIssuingPartyNameAddress2 || '',
    issuerCity: doc.issuerCity || icegate.documentIssuingPartyNameCity || '', issuerPin: doc.issuerPin || icegate.documentIssuingPartyNamePin || '',
    beneficiaryCode: doc.beneficiaryCode || icegate.documentBeneficiaryPartyCode || '', beneficiaryName: doc.beneficiaryName || doc.beneficiaryParty || icegate.documentBeneficiaryPartyName || '',
    beneficiaryAddress1: doc.beneficiaryAddress1 || icegate.documentBeneficiaryPartyNameAddress1 || '', beneficiaryAddress2: doc.beneficiaryAddress2 || icegate.documentBeneficiaryPartyNameAddress2 || '',
    beneficiaryCity: doc.beneficiaryCity || icegate.documentBeneficiaryPartyNameCity || '', beneficiaryPin: doc.beneficiaryPin || icegate.documentBeneficiaryPartyNamePin || '',
    placeOfIssue: doc.placeOfIssue || icegate.placeOfIssue || '', issueDate: ymd(doc.issueDate || doc.date || icegate.documentIssueDate), expiryDate: ymd(doc.expiryDate || icegate.documentExpiryDate),
    fileType: String(doc.fileType || icegate.fileType || 'PDF').toUpperCase(), icegateId: doc.icegateId || icegate.icegateId || '',
    icegateDifferent: !!(doc.icegateDifferent || (doc.icegateId && !/^\d{10,}$/.test(doc.icegateId))),
  };
}

// ICEGATE checks of one document (SUPPORTINGDOCS: IRN, doc code, issuing party, place and date of issue, beneficiary)
function missingOf(doc) {
  const missing = [];
  if (!doc.docCode) missing.push('Doc. code');
  if (doc.irn && !IRN_PATTERN.test(doc.irn)) missing.push('IRN must be 16 digits');
  if (!doc.irn && !doc.file) missing.push(doc.signedOnly ? 'IRN (upload the signed PDF on e-Sanchit and enter its IRN)' : 'IRN (or a PDF to upload)');
  if (!doc.issuerName) missing.push('Issuing party name');
  if (!doc.beneficiaryName) missing.push('Beneficiary name');
  if (!doc.placeOfIssue) missing.push('Place of issue');
  if (!doc.issueDate) missing.push('Issue date');
  if (doc.issueDate && new Date(doc.issueDate) > new Date()) missing.push('Issue date is in the future');
  if (doc.expiryDate && doc.issueDate && doc.expiryDate < doc.issueDate) missing.push('Expiry date is before the issue date');
  if (doc.icegateDifferent && !doc.icegateId) missing.push('ICEGATE id (marked different)');
  return missing;
}

function DocField({ label, name, form, onChange, max, upper, date, placeholder, className }) {
  return (
    <Field label={label} layout="col" className={className}>
      {date
        ? <DateInput value={form[name] || ''} onValueChange={(value) => onChange(name, value)} />
        : <Input data-allow-text="" maxLength={max} placeholder={placeholder} value={form[name] || ''} onChange={(event) => onChange(name, upper ? event.target.value.toUpperCase() : event.target.value)} />}
    </Field>
  );
}

function PartyBox({ prefix, title, form, onChange, onSameAsExporter }) {
  const box = (label, part, extra) => <DocField label={label} name={prefix + part} form={form} onChange={onChange} upper {...extra} />;
  return (
    <div className={BOX}>
      <div className="tw:flex tw:items-center tw:justify-between">
        <strong className="tw:text-entry tw:text-foreground">{title}</strong>
        <Button variant="secondary" onClick={onSameAsExporter}>Same as exporter</Button>
      </div>
      <div className="tw:grid tw:grid-cols-[1fr_2fr] tw:gap-2">{box('Code', 'Code', { max: 17 })}{box('Name *', 'Name', { max: 70 })}</div>
      {box('Address 1', 'Address1', { max: 70 })}
      {box('Address 2', 'Address2', { max: 70 })}
      <div className="tw:grid tw:grid-cols-[2fr_1fr] tw:gap-2">{box('City', 'City', { max: 35 })}<DocField label="Pin" name={`${prefix}Pin`} form={form} onChange={onChange} max={10} /></div>
    </div>
  );
}

/**
 * e-Sanchit supporting documents of an item / its invoice / the whole SB. SB-level rows are kept on the job
 * (exportData.eSanchitList), item / invoice rows on the item. An attached PDF is kept with the job at once
 * (uploads/esanchit_archive/<job no>/...); a job not saved yet files under "draft" and the server moves it on Save.
 */
export default function ESanchitDocsModal({
  open, onClose, onSave, itemRows, exportData, setExportData, items, setItems, itemLabel, esanchitMasters, icegateProfiles, defaultIcegateId,
  selectedIcegateProfile, setSelectedIcegateProfile,
}) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [jobRef, setJobRef] = useState('');
  const [codeQuery, setCodeQuery] = useState('');
  const [pin, setPin] = useState('');
  const [askPin, setAskPin] = useState(false);
  const [signerTool, setSignerTool] = useState(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const detectSigner = async () => {
      try {
        setSignerTool(await localSigner());
      } catch (error) {
        console.error('EagleView Signer check failed:', error);
      }
    };
    detectSigner();
  }, []);

  const exporter = useMemo(() => ({
    Name: exportData?.shipperName || '', Code: exportData?.shipperIec || '', Address1: exportData?.shipperAddress1 || '',
    Address2: exportData?.shipperAddress2 || '', City: exportData?.shipperCity || '', Pin: exportData?.shipperPin || '',
  }), [exportData]);
  const exporterAs = (prefix) => Object.fromEntries(Object.entries(exporter).map(([part, value]) => [prefix + part, value]));
  const freshForm = () => ({ ...EMPTY, ...exporterAs('beneficiary'), placeOfIssue: exportData?.shipperCity || '' });

  useEffect(() => {
    if (!open) return;
    const ownRows = asList(itemRows).map(normDoc);
    const sbRows = asList(exportData?.eSanchitList).map((doc, index) => ({ ...normDoc(doc, index), docFor: 'SB' }));
    setRows([...ownRows.filter((row) => row.docFor !== 'SB'), ...sbRows]);
    setForm(freshForm());
    setEditId(null);
    setAskPin(false);
    setPin('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const masters = (esanchitMasters || [])
    .filter((master) => !codeQuery || String(master.documentCode).includes(codeQuery) || String(master.description || '').toLowerCase().includes(codeQuery.toLowerCase()))
    .slice(0, MAX_MASTER_OPTIONS);
  const codeOptions = [
    ...(form.docCode && !masters.some((master) => String(master.documentCode) === String(form.docCode))
      ? [{ value: String(form.docCode), label: `${form.docCode} ${form.docName ? `- ${form.docName}` : ''}` }] : []),
    ...masters.map((master) => ({ value: String(master.documentCode), label: `${master.documentCode} - ${master.description}` })),
  ];
  const jobKey = () => String(exportData?.jobNo && exportData.jobNo !== 'DRAFT' ? exportData.jobNo : (exportData?.id ? `job-${exportData.id}` : 'draft'));
  const pendingCount = rows.filter((row) => !row.irn && row.file).length;

  const keepPdfWithJob = async (file, doc) => {
    try {
      const upload = new FormData();
      upload.append('jobNo', jobKey());
      upload.append('docCode', doc.docCode || '');
      upload.append('irn', doc.irn || '');
      upload.append('pdf', file);
      const answer = await answerOf(exportEntryApi.keepEsanchitPdf(upload));
      if (answer?.success) return { fileUrl: answer.fileUrl };
      toast.error(`PDF could not be kept with the job: ${answer?.error || 'no answer'}`);
    } catch (error) {
      toast.error(`PDF could not be kept with the job: ${errorMessage(error)}`);
    }
    return {};
  };

  // the next document keeps issuer, beneficiary, place and dates (usually the same); the document details are emptied
  const addOrUpdate = async () => {
    const doc = { ...form, irn: String(form.irn || '').replace(/\s/g, ''), docCode: String(form.docCode || '').trim() };
    const missing = missingOf(doc);
    if (missing.length) {
      toast.error(`Missing / wrong: ${missing.join(', ')}`);
      return;
    }
    if (doc.irn && rows.some((row) => row.irn === doc.irn && row.id !== editId)) {
      toast.error(`IRN ${doc.irn} is already in the list`);
      return;
    }
    const before = editId ? rows.find((row) => row.id === editId) : null;
    if (doc.file && (!before || before.file !== doc.file)) {
      const kept = await keepPdfWithJob(doc.file, doc);
      if (kept.fileUrl) {
        doc.fileUrl = kept.fileUrl;
        doc.signedOnly = false;
      }
    }
    if (editId) {
      setRows(rows.map((row) => (row.id === editId ? { ...doc, id: editId } : row)));
      toast.success('Document updated');
    } else {
      setRows([...rows, { ...doc, id: newDocId() }]);
      toast.success('Document added');
    }
    setForm({ ...doc, id: undefined, irn: '', drn: '', refNo: '', docCode: '', docName: '', file: undefined, fileName: '', fileUrl: undefined, signedOnly: false });
    setEditId(null);
  };

  const editRow = (row) => {
    setForm({ ...row });
    setEditId(row.id);
  };
  const copyRow = (row) => {
    setForm({ ...row, irn: '', drn: '', file: undefined, fileName: '', fileUrl: undefined, signedOnly: false });
    setEditId(null);
    toast('Copied to the form - enter the IRN of the new document and click Add', { icon: 'ℹ️' });
  };
  const removeRow = async (row) => {
    if (!(await askConfirm({ title: 'Remove document', message: `Remove document ${row.irn || row.fileName || row.docCode}?`, okLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger' }))) return;
    setRows((previous) => previous.filter((other) => other.id !== row.id));
    if (editId === row.id) {
      setEditId(null);
      setForm(freshForm());
    }
  };

  const attachPdf = ([file]) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      toast.error('e-Sanchit takes PDF files only');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error('File is larger than 20 MB');
      return;
    }
    setForm((previous) => ({ ...previous, file, fileName: file.name, fileType: 'PDF' }));
  };

  // documents with an IRN of another job (by its job no)
  const addByJobRef = async () => {
    const jobNo = jobRef.trim().toUpperCase();
    if (!jobNo) {
      toast.error('Enter the job no to copy documents from');
      return;
    }
    try {
      const list = await answerOf(exportEntryApi.exportJobList(JOB_LIST_LIMIT));
      const hit = (list?.data || []).find((job) => String(job.jobNo || '').toUpperCase() === jobNo);
      if (!hit) {
        toast.error(`Job ${jobNo} not found`);
        return;
      }
      const job = (await answerOf(exportEntryApi.exportJobById(hit.id)))?.data || {};
      const docs = [
        ...asList(job.eSanchitList).map((doc) => ({ ...normDoc(doc), docFor: 'SB' })),
        ...(job.invoices || []).flatMap((invoice) => (invoice.items || []).flatMap((item) => asList(item.eSanchitList).map((doc) => normDoc(doc)))),
      ].filter((doc) => doc.irn && !rows.some((row) => row.irn === doc.irn));
      const unique = docs.filter((doc, index) => docs.findIndex((other) => other.irn === doc.irn) === index).map((doc, index) => ({ ...doc, id: `doc-${Date.now()}-${index}` }));
      if (!unique.length) {
        toast(`No new document with an IRN in job ${jobNo}`, { icon: 'ℹ️' });
        return;
      }
      setRows([...rows, ...unique]);
      toast.success(`${unique.length} document(s) added from job ${jobNo}`);
    } catch (error) {
      toast.error(`Could not read job ${jobNo}: ${errorMessage(error)}`);
    }
  };

  const copyToAllItems = async () => {
    const ownWithIrn = rows.filter((row) => row.docFor !== 'SB' && row.irn);
    if (!ownWithIrn.length) {
      toast.error('No item / invoice document with an IRN to copy');
      return;
    }
    if (!items?.length) {
      toast.error('No other items');
      return;
    }
    if (!(await askConfirm({ title: 'Copy to all items', message: `Copy ${ownWithIrn.length} document(s) to all ${items.length} item(s) of the job?`, okLabel: 'Copy', cancelLabel: 'Do not copy' }))) return;
    setItems(items.map((item) => {
      const have = asList(item.eSanchitList).map(normDoc);
      const added = ownWithIrn.filter((row) => !have.some((doc) => doc.irn === row.irn)).map((row) => ({ ...row, id: newDocId(), file: undefined }));
      return added.length ? { ...item, eSanchitList: [...have, ...added], suppDocs: 'Y' } : item;
    }));
    toast.success('Documents copied to the items');
  };

  // signs (EagleView Signer on this PC, else the PIN typed here) and sends the PDFs that have no IRN yet. Without the
  // e-Sanchit portal upload the server keeps the signed PDF: the operator uploads it on the portal and types the IRN.
  const signPending = async () => {
    if (!pendingCount) {
      toast.error('No PDF waiting for upload');
      return;
    }
    setBusy(true);
    let uploaded = 0;
    let signedOnly = 0;
    const next = [...rows];
    try {
      for (let index = 0; index < next.length; index++) {
        const doc = next[index];
        if (doc.irn || !doc.file) continue;
        let signature;
        try {
          signature = await signPdf(doc.file, signerTool ? '' : pin, `e-Sanchit document ${doc.docCode}${jobKey() ? ` - job ${jobKey()}` : ''}`);
        } catch (error) {
          if (error.cancelled) {
            toast('Signing cancelled in EagleView Signer.', { icon: 'ℹ️' });
            break;
          }
          throw error;
        }
        const signed = new File([signature.blob], `signed_${doc.fileName}`, { type: 'application/pdf' });
        // the text fields go before the file: the server files the PDF under the job no
        const upload = new FormData();
        upload.append('jobNo', jobKey());
        upload.append('documentCode', doc.docCode);
        upload.append('irn', doc.irn || '');
        upload.append('profileId', selectedIcegateProfile || '');
        upload.append('pdf', signed);
        const answer = await answerOf(exportEntryApi.uploadEsanchitPdf(upload));
        if (answer.success && IRN_PATTERN.test(String(answer.irn || ''))) {
          next[index] = { ...doc, irn: answer.irn, drn: doc.drn || answer.drn || '', file: undefined, fileName: signed.name, fileUrl: answer.fileUrl || doc.fileUrl, signedOnly: false };
          uploaded++;
        } else if (answer.signedOnly) {
          next[index] = { ...doc, file: undefined, fileName: signed.name, fileUrl: answer.fileUrl || doc.fileUrl, signedOnly: true };
          signedOnly++;
        } else {
          toast.error(`Upload of ${doc.fileName} failed: ${answer.error || 'no answer'}`);
        }
      }
      setRows(next);
      if (uploaded) toast.success(`${uploaded} IRN(s) received`);
      if (signedOnly) toast(`${signedOnly} PDF(s) signed with the DSC and saved with the job. Upload them on the e-Sanchit portal and enter the 16-digit IRN here (Edit the row).`, { duration: 10000, icon: '✍️' });
      if (uploaded || signedOnly) {
        setAskPin(false);
        setPin('');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const incomplete = rows.map((row) => ({ row, missing: missingOf(row) })).filter((entry) => entry.missing.length);
    if (incomplete.length && !(await askConfirm({
      title: 'Incomplete documents',
      message: `${incomplete.length} document(s) are incomplete (${incomplete[0].missing.join(', ')}).`,
      note: 'ICEGATE rejects incomplete documents.',
      okLabel: 'Save anyway', cancelLabel: 'Go back', tone: 'warn',
    }))) return;
    setExportData((previous) => ({ ...previous, eSanchitList: rows.filter((row) => row.docFor === 'SB').map((row) => ({ ...row, file: undefined })) }));
    onSave(rows.filter((row) => row.docFor !== 'SB').map((row) => ({ ...row, file: row.irn ? undefined : row.file })));
  };

  const textColumn = (key, header, className) => ({ key, header, className: cn('tw:max-w-[150px] tw:truncate', className), cell: (row) => <span title={row[key]}>{row[key]}</span> });
  const columns = [
    {
      key: 'actions', header: '',
      cell: (row) => (
        <span className="tw:inline-flex tw:gap-0.5">
          <Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit document" onClick={() => editRow(row)}><Edit2 /></Button>
          <Button variant="ghost" size="icon-sm" className="tw:text-primary" title="Copy to the form" aria-label="Copy document" onClick={() => copyRow(row)}><Copy /></Button>
          <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove" aria-label="Remove document" onClick={() => removeRow(row)}><Trash2 /></Button>
          {row.fileUrl && (
            <Button variant="ghost" size="icon-sm" className="tw:text-success" aria-label="Download PDF"
              title={`Download ${shortPdfName(row)}${row.signedOnly ? ' - upload it on e-Sanchit' : ''}`} onClick={() => downloadPdf(row)}>
              <Download />
            </Button>
          )}
        </span>
      ),
    },
    { key: 'serial', header: 'Sr', cell: (row, index) => index + 1 },
    { key: 'docFor', header: 'For', cell: (row) => (row.docFor === 'SB' ? 'SB' : row.docFor === 'Invoice' ? 'Invoice' : 'Item') },
    {
      key: 'irn', header: 'IRN',
      cell: (row) => <b className={row.irn ? 'tw:text-success' : 'tw:text-destructive'}>{row.irn || (row.file ? 'to sign' : row.signedOnly ? 'signed - enter IRN' : '-')}</b>,
    },
    { key: 'drn', header: 'DRN' },
    { key: 'refNo', header: 'Ref. No' },
    { key: 'docCode', header: 'Doc Code', cell: (row) => <span title={row.docName}>{row.docCode}</span> },
    {
      key: 'file', header: 'File', className: 'tw:max-w-[140px] tw:truncate',
      cell: (row) => (row.fileUrl
        ? <a href={row.fileUrl} target="_blank" rel="noreferrer" title={`Open ${row.fileName || 'PDF'}`}>{row.fileName || 'PDF'}</a>
        : <span title={row.fileName}>{row.fileName}</span>),
    },
    textColumn('issuerName', 'Issued by'),
    textColumn('beneficiaryName', 'Beneficiary'),
    { key: 'placeOfIssue', header: 'Place' },
    { key: 'issueDate', header: 'Issue' },
    { key: 'expiryDate', header: 'Expiry' },
    {
      key: 'status', header: 'Status',
      cell: (row) => {
        const missing = missingOf(row);
        return <span className={cn('tw:font-semibold', missing.length ? 'tw:text-warning' : 'tw:text-success')} title={missing.join(', ')}>{missing.length ? `⚠ ${missing.length} missing` : 'OK'}</span>;
      },
    },
  ];

  const signButtonTitle = signerTool
    ? 'Sign with the DSC token of this PC - EagleView Signer asks the PIN in its own window; the signed PDF is kept with the job. Then upload it on the e-Sanchit portal and enter the IRN'
    : 'Sign the attached PDFs with your DSC token (Local Signer, port 5050); the signed PDF is kept with the job. Then upload it on the e-Sanchit portal and enter the IRN';
  const signControls = askPin ? (
    <>
      <Label className="tw:font-bold tw:text-primary">DSC token PIN</Label>
      <Input type="password" className="tw:w-[110px]" value={pin} onChange={(event) => setPin(event.target.value)} autoFocus />
      {(icegateProfiles || []).length > 1 && (
        <SelectBox className="tw:w-[170px]" options={icegateProfiles.map((profile) => ({ value: String(profile.id), label: `${profile.loginId} (${profile.profileName})` }))}
          value={selectedIcegateProfile} onValueChange={setSelectedIcegateProfile} />
      )}
      <Button variant="default" disabled={busy || !pin} onClick={signPending}><Upload /> {busy ? 'Signing...' : 'Sign with DSC'}</Button>
      <Button onClick={() => setAskPin(false)}>Cancel</Button>
    </>
  ) : (
    <Button variant="default" disabled={!pendingCount || busy} title={signButtonTitle} onClick={() => (signerTool ? signPending() : setAskPin(true))}>
      <Upload /> {busy ? 'Signing - see EagleView Signer...' : `Sign ${pendingCount} PDF(s)`}
    </Button>
  );

  return (
    <Modal
      open={open}
      title="e-Sanchit Supporting Documents"
      description={`${itemLabel} · Job ${exportData?.jobNo || 'not saved'} · Exporter ${exportData?.shipperName || '-'}`}
      width={1180}
      closeOnOutside={false}
      onClose={onClose}
      footer={(
        <>
          <div className="tw:mr-auto tw:flex tw:flex-wrap tw:items-center tw:gap-2">{signControls}</div>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="success" onClick={save}><Save /> OK - keep {rows.length} document(s)</Button>
        </>
      )}
    >
      <div className={cn(BOX, 'tw:grid-cols-1 tw:items-end tw:md:grid-cols-3 tw:lg:grid-cols-[1.2fr_1.2fr_1fr_2fr_1.4fr]')}>
        <DocField label="IRN (16 digits)" name="irn" form={form} onChange={setValue} max={16} placeholder="from e-Sanchit" />
        <DocField label="DRN" name="drn" form={form} onChange={setValue} max={35} />
        <DocField label="Doc. Ref. No." name="refNo" form={form} onChange={setValue} max={35} upper placeholder="e.g. invoice no" />
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          <Field label="Doc. Code *" layout="col">
            <Input className="tw:w-[90px] tw:flex-none" maxLength={6} placeholder="CODE" value={form.docCode || ''} onChange={(event) => setValue('docCode', event.target.value.replace(/\D/g, ''))} />
            <SelectBox clearable clearLabel="-- choose from master --" placeholder="-- choose from master --" options={codeOptions} value={form.docCode || ''}
              onValueChange={(code) => {
                const master = (esanchitMasters || []).find((row) => String(row.documentCode) === code);
                setForm((previous) => ({ ...previous, docCode: code, docName: master ? master.description : '' }));
              }} />
          </Field>
          <Input data-allow-text="" leftIcon={Search} className="tw:h-5 tw:text-[10px]" placeholder="filter doc codes" value={codeQuery} onChange={(event) => setCodeQuery(event.target.value)} />
        </div>
        <Field label="PDF file" layout="col">
          <FileButton variant="secondary" accept=".pdf" onFiles={attachPdf}><FileUp /> Attach</FileButton>
          <span className="tw:max-w-[130px] tw:truncate tw:text-[10px] tw:text-muted-foreground" title={form.fileName}>{form.fileName || 'no file'}</span>
        </Field>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-2">
        <PartyBox prefix="issuer" title="Document issued by" form={form} onChange={setValue} onSameAsExporter={() => setForm((previous) => ({ ...previous, ...exporterAs('issuer') }))} />
        <PartyBox prefix="beneficiary" title="Beneficiary (in whose name)" form={form} onChange={setValue} onSameAsExporter={() => setForm((previous) => ({ ...previous, ...exporterAs('beneficiary') }))} />
      </div>

      <div className={cn(BOX, 'tw:grid-cols-1 tw:items-end tw:sm:grid-cols-2 tw:lg:grid-cols-[1.4fr_1fr_1fr_.8fr_1.1fr_1.6fr]')}>
        <DocField label="Place of issue *" name="placeOfIssue" form={form} onChange={setValue} max={35} upper />
        <DocField label="Issue date *" name="issueDate" form={form} onChange={setValue} date />
        <DocField label="Expiry date" name="expiryDate" form={form} onChange={setValue} date />
        <Field label="File type" layout="col"><SelectBox options={['PDF']} value={form.fileType || 'PDF'} onValueChange={(type) => setValue('fileType', type)} /></Field>
        <Field label="Document for" layout="col"><SelectBox options={DOC_FOR_OPTIONS} value={form.docFor} onValueChange={(docFor) => setValue('docFor', docFor)} /></Field>
        <div className="tw:grid tw:gap-1">
          <Label className="tw:cursor-pointer tw:gap-1.5 tw:text-[11px] tw:font-semibold tw:whitespace-normal">
            <Checkbox checked={!!form.icegateDifferent}
              onCheckedChange={(checked) => setForm((previous) => ({ ...previous, icegateDifferent: checked === true, icegateId: checked === true ? previous.icegateId : '' }))} />
            Uploaded with another ICEGATE id {defaultIcegateId ? <span className="tw:font-normal tw:text-muted-foreground">(default {defaultIcegateId})</span> : null}
          </Label>
          {form.icegateDifferent && (
            <Input data-allow-text="" placeholder="ICEGATE ID" maxLength={25} value={form.icegateId || ''} onChange={(event) => setValue('icegateId', event.target.value.toUpperCase())} />
          )}
        </div>
      </div>
      <p className="tw:m-0 tw:text-[10px] tw:text-warning tw:normal-case">A statement-level document (whole shipping bill) must use "Whole SB". Fields marked * are needed by ICEGATE.</p>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Button variant="success" onClick={addOrUpdate}>{editId ? <><Save /> Update document</> : <><Plus /> Add document</>}</Button>
        {editId && <Button onClick={() => { setEditId(null); setForm(freshForm()); }}>Cancel edit</Button>}
        <span className="tw:h-[22px] tw:w-px tw:bg-border" />
        <Input data-allow-text="" className="tw:w-[170px]" placeholder="Job no to copy from" value={jobRef} onChange={(event) => setJobRef(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') addByJobRef(); }} />
        <Button variant="default" onClick={addByJobRef}><Plus /> Add by job no</Button>
        <Button variant="secondary" title="Copy this item's documents (with IRN) to every item of the job" onClick={copyToAllItems}><Copy /> Copy to all items</Button>
      </div>

      <DataTable columns={columns} rows={rows} selectedKey={editId} emptyText="No document yet - fill the form above and click Add document"
        containerClassName="tw:max-h-[230px] tw:rounded-lg tw:border tw:border-border" />
    </Modal>
  );
}
