// e-Sanchit supporting documents of the whole job (tab "Supporting Docs") or of one item (Items tab > Supporting Docs):
// entry form on top, the list below, PDF attach + DSC sign & upload to e-Sanchit (gives the IRN), copy of another
// job's documents by job no.
// Row shape (saved as-is on the job in esanchitDocs and, for item rows, on the item in docsData):
//   irn, drn, docCode, docName, fileName, fileType, docFor HEADER | INVOICE | ITEM, invSrNo, itemSrNo,
//   issuerCode, issuerName, issuerAddr1, issuerAddr2, issuerCity, issuerPin,
//   beneCode, beneName, beneAddr1, beneAddr2, beneCity, benePin, placeOfIssue, issueDate, expiryDate, isDiffId, icegateId
// `itemCtx` = { invSr, itemSr } puts the panel in item mode: "Doc. for" = this item / its invoice / BE, serials filled
// from the item, no mandatory-docs line.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Download, Edit2, FileUp, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Checkbox, ComboInput, DataTable, DateInput, Field, FileButton, Input, Label, SelectBox } from '@/components/ui';
import { downloadPdf, shortPdfName } from '../../utils/downloadPdf';
import { localSigner, signPdf } from '../../utils/dscSigner';
import askConfirm from '../common/askConfirm';
import { useJobContext } from './JobContext';
import { jobEntryApi } from './jobEntryApi';

export const EMPTY_DOC = { irn: '', drn: '', docCode: '', docName: '', fileName: '', fileType: 'PDF', docFor: 'HEADER', invSrNo: '', itemSrNo: '',
  issuerCode: '', issuerName: '', issuerAddr1: '', issuerAddr2: '', issuerCity: '', issuerPin: '',
  beneCode: '', beneName: '', beneAddr1: '', beneAddr2: '', beneCity: '', benePin: '',
  placeOfIssue: '', issueDate: '', expiryDate: '', isDiffId: false, icegateId: '', isApplicable: false };

const isoDay = (value) => {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(value || '').trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
};
export const newDocId = () => `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// rows saved by the older item popup (refNo, issuerAddress, beneficiaryName, issueLocation, date, docFor BE / ITEM) or
// by the tab -> one shape
export function normDoc(doc, index = 0) {
  const source = doc || {};
  const irnInIcegateId = !source.irn && /^\d{10,}$/.test(String(source.icegateId || '')) ? String(source.icegateId) : '';
  const level = String(source.docFor || 'HEADER').toUpperCase();
  return {
    ...EMPTY_DOC, ...source, id: source.id || `doc-${index}-${Math.random().toString(36).slice(2, 6)}`,
    irn: source.irn || irnInIcegateId, drn: source.drn || source.refNo || '', docCode: String(source.docCode || ''),
    fileName: source.fileName || source.docName || '', docName: source.docName || '',
    issuerAddr1: source.issuerAddr1 || source.issuerAddress || source.issuerAddress1 || '', issuerAddr2: source.issuerAddr2 || source.issuerAddress2 || '',
    beneCode: source.beneCode || source.beneficiaryCode || '', beneName: source.beneName || source.beneficiaryName || '',
    beneAddr1: source.beneAddr1 || source.beneficiaryAddress1 || '', beneAddr2: source.beneAddr2 || source.beneficiaryAddress2 || '',
    beneCity: source.beneCity || source.beneficiaryCity || '', benePin: source.benePin || source.beneficiaryPin || '',
    placeOfIssue: source.placeOfIssue || source.issueLocation || '', issueDate: isoDay(source.issueDate || source.date), expiryDate: isoDay(source.expiryDate),
    icegateId: irnInIcegateId ? '' : (source.icegateId || ''), isDiffId: !!source.isDiffId, fileType: String(source.fileType || 'PDF').toUpperCase(),
    docFor: level === 'BE' || level === 'HEADER' ? 'HEADER' : level === 'INVOICE' ? 'INVOICE' : 'ITEM',
  };
}

// what ICEGATE expects with every BE (UN/EDIFACT 1001 document codes used by e-Sanchit)
function expectedDocs(mode) {
  const transport = {
    AIR: { codes: ['740000'], label: '740000 Air waybill' },
    LAND: { codes: ['705000', '740000', '730000'], label: 'Transport document (705000 Bill of lading / 730000 Road consignment note)' },
  }[mode] || { codes: ['705000'], label: '705000 Bill of lading' };
  return [
    transport,
    { codes: ['380000', '331000'], label: '380000 Commercial invoice (or 331000 invoice-cum-packing list)' },
    { codes: ['271000', '331000'], label: '271000 Packing list (or 331000)' },
  ];
}

// ICEGATE checks of one document (SUPPORTINGDOCS)
export function checkDoc(row, hasFile) {
  const problems = [];
  if (!row.docCode) problems.push('Doc. type code');
  if (row.irn && !/^\d{16}$/.test(row.irn)) problems.push('IRN must be 16 digits');
  if (!row.irn && !hasFile) problems.push('IRN (or a PDF to upload)');
  if (!row.issuerName) problems.push('Issuing party name');
  if (!row.beneName) problems.push('Beneficiary name');
  if (!row.placeOfIssue) problems.push('Place of issue');
  if (!row.issueDate) problems.push('Issue date');
  if (row.issueDate && new Date(row.issueDate) > new Date()) problems.push('Issue date is in the future');
  if (row.expiryDate && row.issueDate && row.expiryDate < row.issueDate) problems.push('Expiry before issue date');
  if (row.docFor === 'INVOICE' && !row.invSrNo) problems.push('Invoice');
  if (row.docFor === 'ITEM' && (!row.invSrNo || !row.itemSrNo)) problems.push('Invoice and item sr no');
  if (row.isDiffId && !row.icegateId) problems.push('ICEGATE id (marked different)');
  return problems;
}

// City of the supplier: address 3 as a rule; when it holds only the country (or nothing), the last word before the
// comma of address 2 ("UNIT 111 ATLANTA, GA" -> ATLANTA); else blank for the operator.
const cleanPart = (text) => String(text == null ? '' : text).replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim().toUpperCase();
export function supplierCity(address2, address3, ...countries) {
  const city = cleanPart(address3);
  const countryNames = countries.map(cleanPart).filter(Boolean);
  if (city && !countryNames.includes(city)) return city.slice(0, 35);
  const match = /([A-Z][A-Z .'-]{2,})\s*,[^,]*$/i.exec(String(address2 || ''));
  const lastWord = match ? match[1].trim().split(/\s+/).pop() : '';
  return /^[A-Z]{3,}$/i.test(lastWord) && !countryNames.includes(lastWord.toUpperCase()) ? lastWord.toUpperCase() : '';
}

// a HAWB / HBL is issued on the HAWB date, a MAWB / BL / waybill on the MAWB date (not the invoice date)
const HOUSE_DOCS = /^(703000|714000)$/;
const MASTER_DOCS = /^(700000|704000|705000|709000|710000|711000|740000|741000)$/;
export function transportDate(code, jobData) {
  const docCode = String(code || '');
  if (!HOUSE_DOCS.test(docCode) && !MASTER_DOCS.test(docCode)) return '';
  let igmRows = jobData?._igmRows;
  if (typeof igmRows === 'string') {
    try { igmRows = JSON.parse(igmRows); } catch { igmRows = []; }
  }
  const datedRow = (Array.isArray(igmRows) ? igmRows : []).find((row) => row && (row.hawbDate || row.mawbDate)) || {};
  const dayOf = (value) => { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || '')); return match ? match[0] : ''; };
  const house = dayOf(jobData?.hawbDate) || dayOf(datedRow.hawbDate);
  const master = dayOf(jobData?.mawbDate) || dayOf(datedRow.mawbDate);
  return HOUSE_DOCS.test(docCode) ? (house || master) : (master || house);
}

// invoice (380000), packing list (271000), COO (861xxx) and invoice-cum-packing list (331000) are issued by the supplier
const SUPPLIER_ISSUED_DOCS = /^(380000|271000|861\d{3}|331000)$/;
const BOX = 'tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-2.5 tw:py-2';
const DOC_FOR_COLOUR = { HEADER: 'tw:text-primary', INVOICE: 'tw:text-success' };
const DOC_FOR_BACKGROUND = { HEADER: 'tw:bg-primary/5', INVOICE: 'tw:bg-success/5' };
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const NEXT_DOCUMENT_RESET = { irn: '', drn: '', docCode: '', docName: '', fileName: '', _file: undefined, fileUrl: undefined, archivedName: undefined, signedOnly: false };
const SIGNER_TONE = { ok: 'tw:text-success', warn: 'tw:text-warning', bad: 'tw:text-destructive', checking: 'tw:text-muted-foreground' };

const forText = (row) => (row.docFor === 'INVOICE' ? `Inv ${row.invSrNo}` : row.docFor === 'ITEM' ? `Item ${row.invSrNo}/${row.itemSrNo}` : 'BE');

/** EagleView Signer on this PC first (PIN asked in the tool); else the Local Signer the server knows of. */
function useSignerStatus() {
  const [localTool, setLocalTool] = useState(undefined); // undefined = checking, null = not on this PC
  const [serverSigner, setServerSigner] = useState(null); // null = checking, false = not running

  const checkSigner = useCallback(async () => {
    setServerSigner(null);
    setLocalTool(undefined);
    const toolStatus = await localSigner(true);
    setLocalTool(toolStatus);
    if (toolStatus) return;
    try {
      const status = await jobEntryApi.signerStatus();
      setServerSigner(status?.success ? status : false);
    } catch {
      setServerSigner(false);
    }
  }, []);

  useEffect(() => { checkSigner(); }, [checkSigner]);
  return { localTool, serverSigner, checkSigner };
}

function signerView(localTool, serverSigner) {
  if (localTool) {
    const certificate = localTool.certificate || {};
    const noDriver = localTool.dll_found === false;
    const noToken = !noDriver && localTool.token_present === false;
    return {
      tone: noDriver || noToken ? 'warn' : 'ok',
      text: noDriver ? '● EagleView Signer - token driver not found'
        : noToken ? '● EagleView Signer - plug in the DSC token'
          : '● EagleView Signer ready - ' + (certificate.name || (localTool.token_labels || []).join(', ') || 'token'),
      tip: 'EagleView Signer on this PC' + (certificate.valid_to ? ' - certificate valid to ' + certificate.valid_to : '') + '. The PIN is asked in its own window. Press to check again.',
    };
  }
  if (serverSigner === false) {
    return {
      tone: 'bad',
      text: '● DSC Signer app not running (run START_SIGNER.bat)',
      tip: 'Run START_SIGNER.bat (in the EDI_AUTOMATION project folder) or START_EDI.bat - the Local Signer listens on port 5050 - and plug in the DSC USB token',
    };
  }
  if (!serverSigner) {
    return {
      tone: 'checking',
      text: '● checking DSC Signer...',
      tip: 'Run START_SIGNER.bat (in the EDI_AUTOMATION project folder) or START_EDI.bat - the Local Signer listens on port 5050 - and plug in the DSC USB token',
    };
  }
  const noDriver = serverSigner.dll_found === false;
  const noToken = !noDriver && serverSigner.token_present === false;
  const tokenNames = Array.isArray(serverSigner.token_labels) && serverSigner.token_labels.length ? ' - ' + serverSigner.token_labels.join(', ') : '';
  return {
    tone: noDriver || noToken ? 'warn' : 'ok',
    text: noDriver ? '● DSC Signer running - token driver not found' : noToken ? '● Token driver found - plug in the DSC token' : '● DSC Signer ready' + tokenNames,
    tip: noDriver ? 'Signer running but no DSC token driver found - install the driver of your token (ePass, ProxKey, mToken, SafeNet ...), then press the status to check again'
      : noToken ? 'Token driver found (' + (serverSigner.dll_path || '') + ') but no token is plugged in - plug in the DSC USB token, then press the status to check again'
        : 'Token driver: ' + (serverSigner.dll_path || ''),
  };
}

/** A text box bound to one key of the document form. */
function DocInput({ form, name, onFieldChange, upper, digits, ...props }) {
  const change = (text) => onFieldChange(name, upper ? text.toUpperCase() : digits ? text.replace(/\D/g, '') : text);
  return <Input value={form[name] || ''} onChange={(event) => change(event.target.value)} {...props} />;
}

function PartyBox({ prefix, title, fillLabel, onFill, form, onFieldChange }) {
  const box = (suffix, props) => <DocInput form={form} name={prefix + suffix} onFieldChange={onFieldChange} upper {...props} />;
  return (
    <div className={cn(BOX, 'tw:flex tw:flex-col tw:gap-1.5')}>
      <div className="tw:flex tw:items-center tw:justify-between">
        <strong className="tw:text-entry tw:text-foreground">{title}</strong>
        <Button size="sm" variant="secondary" onClick={onFill}>{fillLabel}</Button>
      </div>
      <Field label="Name" required labelWidth="64px">
        {box('Name', { maxLength: 70, className: 'tw:bg-success/5' })}
        {box('Code', { maxLength: 17, placeholder: 'Code', className: 'tw:w-[110px] tw:flex-none' })}
      </Field>
      <Field label="Address 1" labelWidth="64px">{box('Addr1', { maxLength: 70 })}</Field>
      <Field label="Address 2" labelWidth="64px">{box('Addr2', { maxLength: 70 })}</Field>
      <div className="tw:flex tw:flex-wrap tw:gap-x-3 tw:gap-y-1.5">
        <Field label="City" labelWidth="64px" className="tw:flex-1">{box('City', { maxLength: 35 })}</Field>
        <Field label="Pin">{box('Pin', { maxLength: 10, upper: false, className: 'tw:w-[90px]' })}</Field>
      </div>
    </div>
  );
}

function RowActions({ row, onEdit, onCopy, onRemove }) {
  return (
    <div className="tw:flex tw:gap-1">
      <Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit" onClick={() => onEdit(row)}><Edit2 /></Button>
      <Button variant="ghost" size="icon-sm" title="Copy" aria-label="Copy" className="tw:text-primary" onClick={() => onCopy(row)}><Copy /></Button>
      <Button variant="ghost" size="icon-sm" title="Remove" aria-label="Remove" className="tw:text-destructive" onClick={() => onRemove(row)}><Trash2 /></Button>
      {row.fileUrl && (
        <Button variant="ghost" size="icon-sm" aria-label="Download PDF" className="tw:text-success" onClick={() => downloadPdf(row)}
          title={'Download ' + shortPdfName(row) + (row.signedOnly ? ' - upload it on e-Sanchit' : '')}><Download /></Button>
      )}
    </div>
  );
}

function documentColumns({ check, fileOf, onEdit, onCopy, onRemove }) {
  const clipped = (text) => <span title={text}>{text}</span>;
  return [
    { key: 'actions', header: '', cell: (row) => <RowActions row={row} onEdit={onEdit} onCopy={onCopy} onRemove={onRemove} /> },
    { key: 'sr', header: 'Sr', cell: (row, index) => index + 1 },
    {
      key: 'docFor',
      header: 'For',
      cell: (row) => (
        <span className={cn('tw:font-semibold', DOC_FOR_COLOUR[row.docFor])} title={row.docFor === 'ITEM' ? 'Kept on the item' : 'Kept once on the job (shared by all its items)'}>
          {forText(row)}
        </span>
      ),
    },
    {
      key: 'irn',
      header: 'IRN',
      cell: (row) => (
        <span className={cn('tw:font-bold', row.irn ? 'tw:text-success' : 'tw:text-destructive')}>
          {row.irn || (fileOf[row.id] ? 'to upload' : row.signedOnly ? 'signed - enter IRN' : '-')}
        </span>
      ),
    },
    { key: 'drn', header: 'DRN' },
    { key: 'docCode', header: 'Doc code', cell: (row) => <span title={row.docName}>{row.docCode}</span> },
    {
      key: 'fileName',
      header: 'File',
      className: 'tw:max-w-[140px] tw:truncate',
      cell: (row) => (row.fileUrl
        ? <a href={row.fileUrl} target="_blank" rel="noreferrer" title="Signed PDF (download / upload on e-Sanchit)">{row.fileName}</a>
        : clipped(row.fileName)),
    },
    { key: 'issuerName', header: 'Issuing party', className: 'tw:max-w-[160px] tw:truncate', cell: (row) => clipped(row.issuerName) },
    { key: 'beneName', header: 'Beneficiary', className: 'tw:max-w-[160px] tw:truncate', cell: (row) => clipped(row.beneName) },
    { key: 'placeOfIssue', header: 'Place' },
    { key: 'issueDate', header: 'Issue', cell: (row) => isoDay(row.issueDate) },
    { key: 'expiryDate', header: 'Expiry', cell: (row) => isoDay(row.expiryDate) },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => {
        const problems = check(row);
        return (
          <span title={problems.join(', ')} className={cn('tw:font-semibold', problems.length ? 'tw:text-warning' : 'tw:text-success')}>
            {problems.length ? `⚠ ${problems.length} missing` : 'OK'}
          </span>
        );
      },
    },
  ];
}

function MandatoryDocs({ mode, rows }) {
  const has = (codes) => rows.some((row) => codes.includes(String(row.docCode)));
  return (
    <>
      <strong>Mandatory docs ({mode}):</strong>
      {expectedDocs(mode).map((expected) => (
        <span key={expected.label} className={has(expected.codes) ? 'tw:text-success' : 'tw:text-destructive'}>
          {has(expected.codes) ? '✓' : '✗'} {expected.label}
        </span>
      ))}
    </>
  );
}

function ItemSteps() {
  return (
    <span className="tw:text-muted-foreground">
      1) attach the PDF + fill the form → <b>Add</b> (PDF is kept with the job) &nbsp;2) <b>Sign</b> → DSC token PIN → signed PDF kept with
      the job &nbsp;3) upload the signed PDF on e-Sanchit (icegate.gov.in) → type the 16-digit <b>IRN</b> in the row (Edit) → OK
    </span>
  );
}

export default function EsanchitDocsPanel({ rows: rawRows, setRows, jobData, itemCtx, otherIrns, title, compact }) {
  const rows = useMemo(() => (Array.isArray(rawRows) ? rawRows : []).map((doc, index) => normDoc(doc, index)), [rawRows]);
  const item = itemCtx || null;
  const countries = useJobContext()?.masters?.countries || [];
  const importer = useMemo(() => ({
    beneName: jobData?.autoField_4 || jobData?.nameOfImporter || '', beneAddr1: jobData?.autoField_6 || '', beneAddr2: jobData?.autoField_7 || '',
    beneCity: jobData?.autoField_8 || '', benePin: jobData?.autoField_10 || '',
  }), [jobData]);
  const freshForm = () => ({ ...EMPTY_DOC, ...importer, docFor: item ? 'ITEM' : 'HEADER' });

  const [form, setForm] = useState(freshForm);
  const [editId, setEditId] = useState(null);
  const [masters, setMasters] = useState([]);
  const [codeQuery, setCodeQuery] = useState('');
  const [defaultIcegateId, setDefaultIcegateId] = useState('');
  const [jobRef, setJobRef] = useState('');
  const [pin, setPin] = useState('');
  const [askPin, setAskPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileOf, setFileOf] = useState({}); // row id -> File waiting for upload (not saved with the job)
  const { localTool, serverSigner, checkSigner } = useSignerStatus();

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const invoices = jobData?.invoices || [];
  const mode = String(jobData?.shipmentMode || 'SEA').toUpperCase();

  const countryName = (code) => {
    const text = String(code || '').trim();
    if (!text) return '';
    const country = countries.find((entry) => String(entry.code || '').toUpperCase() === text.toUpperCase());
    return (country ? String(country.name) : text).toUpperCase();
  };

  // Issuing party of an invoice / packing list / COO = the supplier of the item's invoice (as in every filed BE);
  // place of issue = the supplier's country name (filed BEs carry JAPAN / UNITED KINGDOM / IND).
  const supplierParty = (document) => {
    const jobInvoices = Array.isArray(jobData?.invoices) ? jobData.invoices : [];
    const invoice = (item?.invSr ? jobInvoices[parseInt(item.invSr, 10) - 1] : null)
      || (document.docFor === 'INVOICE' && document.invSrNo ? jobInvoices[parseInt(document.invSrNo, 10) - 1] : null)
      || jobInvoices[0];
    if (!invoice) return null;
    const country = countryName(invoice.supplierCountry || invoice.supplierCountryName);
    return {
      issuerName: String(invoice.supplierName || '').toUpperCase(),
      issuerAddr1: String(invoice.supplierAddress1 || '').toUpperCase(),
      issuerAddr2: String(invoice.supplierAddress2 || '').toUpperCase(),
      issuerCity: supplierCity(invoice.supplierAddress2, invoice.supplierAddress3, invoice.supplierCountryName, invoice.supplierCountry, country),
      issuerPin: String(invoice.supplierPin || ''),
      placeOfIssue: country,
    };
  };
  const withSupplier = (current, supplier) => ({ ...current, ...supplier, placeOfIssue: current.placeOfIssue || supplier.placeOfIssue });
  const fillSupplier = () => {
    const supplier = supplierParty(form);
    if (!supplier?.issuerName) { toast.error('No supplier on this invoice (3. Invoices)'); return; }
    setForm((current) => withSupplier(current, supplier));
  };
  // another doc code: supplier papers get the supplier as issuing party, HAWB / MAWB papers the HAWB / MAWB date, when
  // still empty
  const withCodeDefaults = (next, previousCode) => {
    const code = String(next.docCode || '');
    if (code === String(previousCode || '')) return next;
    let filled = next;
    const supplier = SUPPLIER_ISSUED_DOCS.test(code) && !filled.issuerName ? supplierParty(filled) : null;
    if (supplier?.issuerName) filled = withSupplier(filled, supplier);
    const issueDate = transportDate(code, jobData);
    if (issueDate && !filled.issueDate) filled = { ...filled, issueDate };
    return filled;
  };

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const list = await jobEntryApi.esanchitMasters();
        setMasters(Array.isArray(list) ? list : []);
      } catch {
        setMasters([]);
      }
    };
    const loadDefaultIcegateId = async () => {
      try {
        const answer = await jobEntryApi.icegateProfiles();
        if (answer.success && answer.data?.length) {
          const profile = answer.data.find((entry) => entry.isDefault) || answer.data[0];
          setDefaultIcegateId(profile.loginId || '');
        }
      } catch {
        setDefaultIcegateId('');
      }
    };
    loadMasters();
    loadDefaultIcegateId();
  }, []);

  // another job loaded: the beneficiary of the next document is its importer
  useEffect(() => {
    if (!editId) setForm((current) => (current.beneName ? current : { ...current, ...importer }));
  }, [importer, editId]);

  // inactive master rows (the old 7-digit codes) are not offered
  const query = codeQuery.toLowerCase();
  const masterList = masters
    .filter((master) => master.isActive !== false && master.isActive !== 0)
    .filter((master) => !codeQuery || String(master.documentCode).includes(codeQuery) || String(master.description || '').toLowerCase().includes(query))
    .slice(0, 80);
  const codeOptions = [
    ...(form.docCode && !masterList.some((master) => String(master.documentCode) === String(form.docCode))
      ? [{ value: String(form.docCode), label: `${form.docCode} ${form.docName ? '- ' + form.docName : ''}` }] : []),
    ...masterList.map((master) => ({ value: String(master.documentCode), label: `${master.documentCode} - ${master.description}` })),
  ];
  const placeOptions = [{ value: 'IND', label: 'India' }, ...countries.slice(0, 300).map((country) => ({ value: String(country.name || '').toUpperCase(), label: country.code }))];
  const docForOptions = item
    ? [{ value: 'ITEM', label: `This item (${item.invSr}/${item.itemSr})` }, { value: 'INVOICE', label: `Its invoice (${item.invSr})` }, { value: 'HEADER', label: 'BE (all)' }]
    : [{ value: 'HEADER', label: 'BE (all invoices)' }, { value: 'INVOICE', label: 'Invoice' }, { value: 'ITEM', label: 'Item' }];
  const invoiceOptions = invoices.map((invoice, index) => ({ value: String(index + 1), label: `${index + 1} - ${invoice.invNo || invoice.invoiceNo || ''}` }));

  const pickDocCode = (code, docNameWhenUnknown) => {
    const master = masters.find((entry) => String(entry.documentCode) === code);
    setForm((current) => withCodeDefaults({ ...current, docCode: code, docName: master ? master.description : docNameWhenUnknown(current) }, current.docCode));
  };

  // serials of a row: in item mode from the item; in the tab from the form
  const withSerials = (row) => {
    const level = row.docFor || 'HEADER';
    if (item) return { ...row, invSrNo: level === 'HEADER' ? '' : String(item.invSr || ''), itemSrNo: level === 'ITEM' ? String(item.itemSr || '') : '' };
    return { ...row, invSrNo: level === 'HEADER' ? '' : row.invSrNo, itemSrNo: level === 'ITEM' ? row.itemSrNo : '' };
  };
  const check = (row) => checkDoc(row, !!fileOf[row.id]);

  // An attached PDF is kept with the job at once (uploads/esanchit_archive/<job no>/...) so the document is there for
  // later even when it is never signed / uploaded; the row keeps its link (fileUrl) in the job record.
  const jobKey = () => String(jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : (jobData?.id ? 'job-' + jobData.id : 'draft'));
  const keepPdfWithJob = async (file, row) => {
    try {
      const formData = new FormData();
      formData.append('jobNo', jobKey());
      formData.append('docCode', row.docCode || '');
      formData.append('irn', row.irn || '');
      formData.append('pdf', file);
      const answer = await jobEntryApi.keepEsanchitPdf(formData);
      if (answer?.success) return { fileUrl: answer.fileUrl, archivedName: answer.fileName };
      toast.error('PDF could not be kept with the job: ' + (answer?.error || 'no answer'));
    } catch (error) {
      toast.error('PDF could not be kept with the job: ' + errorMessage(error));
    }
    return {};
  };

  const addOrUpdate = async () => {
    const candidate = withSerials({ ...form, irn: String(form.irn || '').replace(/\s/g, ''), docCode: String(form.docCode || '').trim(), id: editId || newDocId() });
    const problems = checkDoc(candidate, !!(form._file || fileOf[candidate.id]));
    if (problems.length) { toast.error('Missing / wrong: ' + problems.join(', ')); return; }
    if (candidate.irn && rows.some((row) => row.irn === candidate.irn && row.id !== editId)) { toast.error('IRN ' + candidate.irn + ' is already in the list'); return; }
    if (candidate.irn && otherIrns?.includes(candidate.irn)) { toast.error('IRN ' + candidate.irn + ' is already on the job (another invoice / item)'); return; }
    const { _file: attachedFile, ...document } = candidate;
    // only a newly attached PDF is filed, not the same PDF again on Update
    if (attachedFile && attachedFile !== fileOf[document.id]) {
      setFileOf((current) => ({ ...current, [document.id]: attachedFile }));
      Object.assign(document, await keepPdfWithJob(attachedFile, document), { signedOnly: false });
    }
    if (editId) {
      setRows(rows.map((row) => (row.id === editId ? document : row)));
      toast.success('Document updated');
    } else {
      setRows([...rows, { ...document, srNo: rows.length + 1 }]);
      toast.success('Document added');
    }
    // next document: parties, place and dates usually repeat; document details start empty
    setForm({ ...form, ...NEXT_DOCUMENT_RESET });
    setEditId(null);
  };
  const editRow = (row) => {
    setForm((current) => withCodeDefaults({ ...row, _file: fileOf[row.id] }, current.docCode));
    setEditId(row.id);
  };
  const copyRow = (row) => {
    setForm((current) => withCodeDefaults({ ...row, ...NEXT_DOCUMENT_RESET, docCode: row.docCode, docName: row.docName }, current.docCode));
    setEditId(null);
    toast('Copied to the form - enter the IRN of the new document and click Add', { icon: 'ℹ️' });
  };
  const cancelEdit = () => { setEditId(null); setForm(freshForm()); };
  const removeRow = async (row) => {
    const remove = await askConfirm({ title: 'Remove this document?', message: `${row.irn || row.fileName || row.docCode}`, okLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger' });
    if (!remove) return;
    setRows(rows.filter((other) => other.id !== row.id));
    if (editId === row.id) cancelEdit();
  };

  const attachPdf = ([file]) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { toast.error('e-Sanchit takes PDF files only'); return; }
    if (file.size > MAX_PDF_BYTES) { toast.error('File is larger than 20 MB'); return; }
    setForm((current) => ({ ...current, _file: file, fileName: file.name, fileType: 'PDF' }));
  };

  // documents (with IRN) of another import job, by its job no. In item mode they come in at this item's level.
  const addByJobRef = async () => {
    const jobNo = jobRef.trim().toUpperCase();
    if (!jobNo) { toast.error('Enter the job no to copy documents from'); return; }
    try {
      const list = await jobEntryApi.listJobs({ limit: 5000 });
      const found = (list.data || list || []).find((job) => String(job.jobNo || '').toUpperCase() === jobNo);
      if (!found) { toast.error('Job ' + jobNo + ' not found'); return; }
      const savedJob = await jobEntryApi.job(found.id);
      let docs = (savedJob.data || {}).esanchitDocs;
      if (typeof docs === 'string') {
        try { docs = JSON.parse(docs); } catch { docs = []; }
      }
      const knownIrns = new Set([...rows.map((row) => row.irn), ...(otherIrns || [])]);
      const added = (Array.isArray(docs) ? docs : []).map(normDoc).filter((doc) => doc.irn && !knownIrns.has(doc.irn))
        .map((doc, index) => withSerials({ ...doc, id: newDocId(), srNo: rows.length + index + 1, docFor: item ? (doc.docFor === 'HEADER' ? 'HEADER' : 'ITEM') : doc.docFor }));
      if (!added.length) { toast('No new document with an IRN in job ' + jobNo, { icon: 'ℹ️' }); return; }
      setRows([...rows, ...added]);
      toast.success(added.length + ' document(s) added from job ' + jobNo);
      setJobRef('');
    } catch (error) {
      toast.error('Could not read job ' + jobNo + ': ' + errorMessage(error));
    }
  };

  // sign with the DSC signer and upload to e-Sanchit the PDFs that have no IRN yet
  const pending = rows.filter((row) => !row.irn && fileOf[row.id]);
  const uploadPending = async () => {
    if (!pending.length) { toast.error('No PDF waiting for upload'); return; }
    setBusy(true);
    let received = 0;
    let signedOnly = 0;
    const nextRows = [...rows];
    const files = { ...fileOf };
    try {
      for (let index = 0; index < nextRows.length; index++) {
        const doc = nextRows[index];
        const file = files[doc.id];
        if (doc.irn || !file) continue;
        if (!doc.docCode) { toast.error(doc.fileName + ': doc. type code missing'); continue; }
        let signature;
        try {
          signature = await signPdf(file, localTool ? '' : pin, 'e-Sanchit document ' + doc.docCode + (jobKey() ? ' - job ' + jobKey() : ''));
        } catch (error) {
          if (error.cancelled) { toast('Signing cancelled in EagleView Signer.', { icon: 'ℹ️' }); break; }
          throw error;
        }
        const signedFile = new File([signature.blob], 'signed_' + file.name, { type: 'application/pdf' });
        // text fields before the file: the server files the PDF under the job no
        const formData = new FormData();
        formData.append('jobNo', jobKey());
        formData.append('documentCode', doc.docCode);
        formData.append('irn', doc.irn || '');
        formData.append('profileId', 1);
        formData.append('pdf', signedFile);
        let answer;
        try {
          answer = await jobEntryApi.uploadEsanchitPdf(formData);
        } catch (error) {
          answer = { error: errorMessage(error) };
        }
        if (answer.success && /^\d{16}$/.test(String(answer.irn || ''))) {
          nextRows[index] = { ...doc, irn: answer.irn, drn: doc.drn || answer.drn || '', fileName: signedFile.name, fileUrl: answer.fileUrl };
          delete files[doc.id];
          received++;
        } else if (answer.signedOnly) {
          // signed but not uploaded (portal upload not automated): the user uploads it on the portal and types the IRN
          nextRows[index] = { ...doc, fileName: signedFile.name, fileUrl: answer.fileUrl, signedOnly: true };
          delete files[doc.id];
          signedOnly++;
        } else {
          toast.error('Upload of ' + doc.fileName + ' failed: ' + (answer.error || 'no answer'));
        }
      }
      setRows(nextRows);
      setFileOf(files);
      if (received) toast.success(received + ' IRN(s) received');
      if (signedOnly) toast(signedOnly + ' PDF(s) signed with the DSC and saved. Upload them on the e-Sanchit portal and enter the 16-digit IRN here (Edit the row).', { duration: 10000, icon: '✍️' });
      if (received || signedOnly) { setAskPin(false); setPin(''); }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const signer = signerView(localTool, serverSigner);
  const panelClass = compact ? 'tw:rounded-lg tw:border tw:border-border tw:bg-background' : 'glass-panel';
  const columns = documentColumns({ check, fileOf, onEdit: editRow, onCopy: copyRow, onRemove: removeRow });
  const showInvoice = !item && (form.docFor === 'INVOICE' || form.docFor === 'ITEM');

  return (
    <div className={cn('tw:flex tw:flex-col tw:gap-2', !compact && 'tw:min-h-full')}>
      <div className={cn(panelClass, 'tw:grid tw:gap-2 tw:px-2.5 tw:py-2')}>
        <div className="tw:flex tw:items-center tw:justify-between">
          <h3 className="tw:m-0 tw:text-[13px] tw:font-bold tw:uppercase tw:text-foreground">{title || 'Supporting Documents (e-Sanchit)'}</h3>
          {editId && <span className="tw:text-[11px] tw:font-semibold tw:text-warning">Editing a document - click Update or Cancel</span>}
        </div>

        <div className={cn(BOX, 'tw:flex tw:flex-wrap tw:items-center tw:gap-x-3 tw:gap-y-1.5')}>
          <Field label="IRN">
            <DocInput form={form} name="irn" onFieldChange={setField} maxLength={16} digits placeholder="16 digits" className="tw:w-[150px] tw:bg-warning/10" />
          </Field>
          <Field label="DRN">
            <DocInput form={form} name="drn" onFieldChange={setField} maxLength={35} placeholder="Doc ref no" className="tw:w-[150px] tw:bg-warning/10" />
          </Field>
          <Field label="Doc. Type Code" required className="tw:w-full tw:md:w-auto tw:md:min-w-[360px] tw:md:flex-[2]">
            <Input
              value={form.docCode || ''}
              maxLength={6}
              placeholder="Code"
              className="tw:w-[72px] tw:flex-none tw:bg-primary/5"
              onChange={(event) => pickDocCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''), (current) => current.docName)}
            />
            <SelectBox
              value={form.docCode || ''}
              options={codeOptions}
              placeholder="-- from e-Sanchit master --"
              clearable
              clearLabel="-- from e-Sanchit master --"
              className="tw:min-w-0 tw:flex-1"
              onValueChange={(code) => pickDocCode(code, () => '')}
            />
            <Input leftIcon={Search} title="filter the master list" placeholder="filter" value={codeQuery} onChange={(event) => setCodeQuery(event.target.value)} className="tw:w-[90px]" />
          </Field>
          <Field label="File" className="tw:w-full tw:md:w-auto tw:md:min-w-[240px] tw:md:flex-1">
            <DocInput form={form} name="fileName" onFieldChange={setField} maxLength={100} placeholder="File name" />
            <FileButton accept=".pdf" onFiles={attachPdf} title="Attach a PDF to sign and upload to e-Sanchit"><FileUp /> PDF</FileButton>
          </Field>
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:lg:grid-cols-2">
          <PartyBox prefix="issuer" title="Issuing party" fillLabel="Supplier" onFill={fillSupplier} form={form} onFieldChange={setField} />
          <PartyBox prefix="bene" title="Beneficiary party" fillLabel="Importer" onFill={() => setForm((current) => ({ ...current, ...importer }))} form={form} onFieldChange={setField} />
        </div>

        <div className={cn(BOX, 'tw:flex tw:flex-wrap tw:items-center tw:gap-x-2.5 tw:gap-y-1.5')}>
          <Field label="Place of issue" required>
            <ComboInput
              value={form.placeOfIssue || ''}
              options={placeOptions}
              upper
              maxLength={35}
              placeholder="country / IND"
              title="Country of the issuing party (filed BEs: JAPAN, UNITED KINGDOM, IND)"
              className="tw:w-[150px] tw:flex-none"
              onValueChange={(text) => setField('placeOfIssue', text)}
            />
          </Field>
          <Field label="Issue date" required>
            <DateInput value={form.issueDate || ''} onValueChange={(day) => setField('issueDate', day)} wrapperClassName="tw:w-[140px]" />
          </Field>
          <Field label="Expiry date">
            <DateInput value={form.expiryDate || ''} onValueChange={(day) => setField('expiryDate', day)} wrapperClassName="tw:w-[140px]" />
          </Field>
          <Label className="tw:cursor-pointer tw:font-semibold" title={defaultIcegateId ? 'Default ICEGATE id ' + defaultIcegateId : ''}>
            <Checkbox
              checked={!!form.isDiffId}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, isDiffId: !!checked, icegateId: checked ? current.icegateId : '' }))}
            />
            ICEGATE id different?
          </Label>
          {form.isDiffId && <DocInput form={form} name="icegateId" onFieldChange={setField} maxLength={25} upper placeholder="ICEGATE ID" className="tw:w-[130px]" />}
          <Field label="File type">
            <SelectBox value={form.fileType || 'PDF'} options={['PDF']} onValueChange={(type) => setField('fileType', type)} className="tw:w-[70px]" />
          </Field>
          <Field label="Doc. for">
            <SelectBox value={form.docFor || 'HEADER'} options={docForOptions} onValueChange={(level) => setField('docFor', level)}
              className={cn('tw:w-[150px]', DOC_FOR_BACKGROUND[form.docFor || 'HEADER'])} />
          </Field>
          {showInvoice && (
            <Field label="Invoice">
              <SelectBox value={form.invSrNo || ''} options={invoiceOptions} placeholder="Select" clearable clearLabel="Select"
                onValueChange={(serial) => setField('invSrNo', serial)} className="tw:w-[160px]" />
            </Field>
          )}
          {!item && form.docFor === 'ITEM' && (
            <Field label="Item sr no">
              <DocInput form={form} name="itemSrNo" onFieldChange={setField} digits className="tw:w-[60px]" />
            </Field>
          )}
          <span className="tw:flex-1" />
          <Button variant={editId ? 'default' : 'success'} onClick={addOrUpdate}>{editId ? <><Save /> Update</> : <><Plus /> Add</>}</Button>
          {editId && <Button variant="secondary" onClick={cancelEdit}><X /> Cancel</Button>}
          <span className="tw:h-[22px] tw:w-px tw:bg-input" />
          <Field label="Job ref. no">
            <Input placeholder="other job no" value={jobRef} onChange={(event) => setJobRef(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') addByJobRef(); }} className="tw:w-[130px]" />
          </Field>
          <Button variant="default" onClick={addByJobRef} title="Copy the documents (with IRN) of another import job"><Plus /> Add by job ref. no</Button>
        </div>
      </div>

      <div className={cn(panelClass, 'tw:overflow-hidden')}>
        <DataTable
          columns={columns}
          rows={rows}
          rowClassName={(row) => editId === row.id && 'tw:bg-warning/10 tw:even:bg-warning/10'}
          emptyText="No document yet - fill the form above and click Add"
          containerClassName={compact ? 'tw:max-h-[180px]' : 'tw:max-h-[38vh]'}
        />
      </div>

      <div className={cn(panelClass, 'tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2.5 tw:px-2.5 tw:py-1.5')}>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:text-[11px] tw:text-foreground">
          {item ? <ItemSteps /> : <MandatoryDocs mode={mode} rows={rows} />}
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          {askPin ? (
            <>
              <Label htmlFor="esanchit-dsc-pin" className="tw:font-semibold tw:text-primary">DSC token PIN</Label>
              <Input id="esanchit-dsc-pin" type="password" value={pin} onChange={(event) => setPin(event.target.value)} autoFocus className="tw:w-[110px]" />
              <Button variant="default" disabled={busy || !pin} onClick={uploadPending}><Upload /> {busy ? 'Signing...' : 'Sign with DSC'}</Button>
              <Button variant="secondary" onClick={() => setAskPin(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button variant="link" size="sm" className={cn('tw:text-[10px] tw:font-normal', SIGNER_TONE[signer.tone])} title={signer.tip} onClick={checkSigner}>{signer.text}</Button>
              <Button
                variant="default"
                disabled={!pending.length || busy}
                onClick={() => (localTool ? uploadPending() : setAskPin(true))}
                title="Sign the attached PDFs with your DSC token (EagleView Signer on this PC asks the PIN in its own window; else the Local Signer app, port 5050); the signed PDF is kept with the job"
              >
                <Upload /> {busy ? 'Signing - see EagleView Signer...' : 'Sign ' + pending.length + ' PDF(s)'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
