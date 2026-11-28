import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Edit, Link as LinkIcon, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Checkbox, DataTable, DateInput, Field, FileButton, Input, Label, Section, SelectBox } from '@/components/ui';
import { useExportContext } from '../ExportContext';
import { signPdf } from '../../../utils/dscSigner';
import { serverReply } from '../../JobEntry/JobEntryLayoutParts/serverReply';
import { exportEntryApi } from '../exportEntryApi';

const blankDoc = (srNo) => ({
  id: Date.now(), srNo, irn: '', drn: '', docCode: '', fileName: '',
  issuerCode: '', issuerName: '', issuerAddr1: '', issuerAddr2: '', issuerCity: '', issuerPin: '',
  beneCode: '', beneName: '', beneAddr1: '', beneAddr2: '', beneCity: '', benePin: '',
  placeOfIssue: '', issueDate: '', expiryDate: '',
  isDiffId: false, isApplicable: false, fileType: 'PDF', docFor: 'ITEM',
});

const CORE_FIELDS = [
  { key: 'srNo', label: 'SR. NO' },
  { key: 'irn', label: 'IRN NUMBER', allowText: true },
  { key: 'drn', label: 'DRN NUMBER', allowText: true },
  { key: 'docCode', label: 'DOC. CODE', highlight: true },
  { key: 'fileName', label: 'FILE NAME', allowText: true },
];

const PARTY_ROWS = [
  { columns: 'tw:sm:grid-cols-[1fr_2.5fr]', fields: [['Code', 'CODE'], ['Name', 'NAME']] },
  { columns: 'tw:sm:grid-cols-2', fields: [['Addr1', 'ADDRESS 1'], ['Addr2', 'ADDRESS 2']] },
  { columns: 'tw:sm:grid-cols-[2fr_1fr]', fields: [['City', 'CITY'], ['Pin', 'PIN CODE']] },
];

const PARTIES = [
  { prefix: 'issuer', title: 'DOC ISSUING PARTY', className: 'tw:border-warning/30 tw:bg-warning/5', badgeClassName: 'tw:bg-warning' },
  { prefix: 'bene', title: 'BENEFICIARY PARTY', className: 'tw:border-primary/30', badgeClassName: 'tw:bg-primary' },
];

const LABEL_CLASS = 'tw:text-[10px] tw:font-bold tw:tracking-wide tw:text-muted-foreground';

function DocTextField({ label, value, onValueChange, highlight, allowText, className }) {
  return (
    <Field label={label} layout="col" className={className} labelClassName={cn(LABEL_CLASS, highlight && 'tw:text-primary')}>
      <Input
        data-allow-text={allowText || undefined}
        value={value ?? ''}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn('tw:h-8 tw:rounded-md tw:px-3', highlight && 'tw:border-primary/50 tw:bg-primary/5')}
      />
    </Field>
  );
}

function DocDateField({ label, value, onValueChange }) {
  return (
    <Field label={label} layout="col" className="tw:w-full tw:sm:w-40" labelClassName={LABEL_CLASS}>
      <DateInput value={value} onValueChange={onValueChange} className="tw:h-8 tw:rounded-md" />
    </Field>
  );
}

function PartyCard({ party, doc, setField }) {
  return (
    <div className={cn('tw:relative tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:p-4 tw:pt-5', party.className)}>
      <span className={cn('tw:absolute tw:-top-2.5 tw:left-4 tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-bold tw:tracking-wide tw:text-white', party.badgeClassName)}>
        {party.title}
      </span>
      {PARTY_ROWS.map((row) => (
        <div key={row.fields[0][0]} className={cn('tw:grid tw:grid-cols-1 tw:gap-4', row.columns)}>
          {row.fields.map(([suffix, label]) => {
            const key = `${party.prefix}${suffix}`;
            return <DocTextField key={key} label={label} value={doc[key]} onValueChange={setField(key)} allowText={suffix !== 'Pin'} />;
          })}
        </div>
      ))}
    </div>
  );
}

function useDefaultIcegateId() {
  const [defaultIcegateId, setDefaultIcegateId] = useState('');
  useEffect(() => {
    const load = async () => {
      try {
        const reply = await exportEntryApi.itemIcegateProfiles();
        if (reply.success && reply.data?.length > 0) setDefaultIcegateId((reply.data.find((profile) => profile.isDefault) || reply.data[0]).loginId);
      } catch (error) {
        console.log(error);
      }
    };
    load();
  }, []);
  return defaultIcegateId;
}

// Signs the PDF (EagleView Signer on this PC first - it asks the PIN itself when none is typed - else the server signer)
// and uploads it to e-Sanchit; resolves { irn, fileName, fileUrl }.
async function signAndUpload(file, tokenPin, docCode) {
  let signedBlob;
  try {
    signedBlob = (await signPdf(file, tokenPin, `e-Sanchit document ${docCode || ''}`)).blob;
  } catch (signError) {
    throw new Error(signError.cancelled ? 'Signing cancelled in EagleView Signer.' : `PDF signing: ${signError.message}`);
  }
  const signedFile = new File([signedBlob], `signed_${file.name}`, { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('pdf', signedFile);
  formData.append('documentCode', docCode);
  formData.append('profileId', 1);
  const reply = await serverReply(exportEntryApi.uploadEsanchitPdf(formData));
  if (!reply.success) throw new Error(reply.error || 'Upload failed');
  return { irn: reply.irn, fileName: signedFile.name, fileUrl: reply.fileUrl };
}

function DocForm({ doc, setDoc, canClose, onClose, onSave, defaultIcegateId }) {
  const [uploadFile, setUploadFile] = useState(null);
  const [tokenPin, setTokenPin] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const setField = (key) => (value) => setDoc((current) => ({ ...current, [key]: value }));

  const uploadDocument = async () => {
    if (!doc.docCode) {
      toast.error('Please enter a Document Code first (e.g. 0010000).');
      return;
    }
    if (!uploadFile) {
      toast.error('Please select a file first.');
      return;
    }
    setIsUploading(true);
    try {
      const uploaded = await signAndUpload(uploadFile, tokenPin, doc.docCode);
      setDoc((current) => ({ ...current, ...uploaded }));
      toast.success(`Success! Generated IRN: ${uploaded.irn}`);
      setShowPinPrompt(false);
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="tw:mt-2 tw:flex tw:flex-[1.5] tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-primary/30 tw:bg-card">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border tw:px-5 tw:py-3">
        <div className="tw:flex tw:items-center tw:gap-2.5">
          <span className="tw:rounded-lg tw:bg-muted tw:p-1.5 tw:text-muted-foreground"><LinkIcon className="tw:size-4" /></span>
          <div>
            <h3 className="tw:m-0 tw:text-sm tw:font-bold tw:text-foreground">Supporting Document Configuration</h3>
            <span className="tw:text-[11px] tw:text-muted-foreground">Configure e-Sanchit properties and parties</span>
          </div>
        </div>
        {canClose && <Button variant="ghost" size="icon" className="tw:rounded-full" aria-label="Close" onClick={onClose}><X className="tw:size-4" /></Button>}
      </div>

      <div className="tw:flex tw:flex-col tw:gap-6 tw:overflow-y-auto tw:p-5">
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-5">
          {CORE_FIELDS.map((field) => (
            <DocTextField key={field.key} label={field.label} value={doc[field.key]} onValueChange={setField(field.key)} highlight={field.highlight} allowText={field.allowText} />
          ))}
        </div>

        <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:lg:grid-cols-2">
          {PARTIES.map((party) => <PartyCard key={party.prefix} party={party} doc={doc} setField={setField} />)}
        </div>

        <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:bg-muted tw:p-4 tw:lg:flex-row tw:lg:items-center tw:lg:gap-6">
          <DocTextField label="PLACE OF ISSUE" value={doc.placeOfIssue} onValueChange={setField('placeOfIssue')} allowText className="tw:w-full tw:sm:w-[200px]" />
          <DocDateField label="ISSUE DATE" value={doc.issueDate} onValueChange={setField('issueDate')} />
          <DocDateField label="EXPIRY DATE" value={doc.expiryDate} onValueChange={setField('expiryDate')} />
          <div className="tw:hidden tw:h-10 tw:w-px tw:bg-input tw:lg:block" />
          <div className="tw:flex tw:flex-col tw:gap-2">
            <Label className="tw:cursor-pointer tw:gap-2 tw:text-[11px] tw:font-semibold tw:whitespace-normal">
              <Checkbox checked={!!doc.isDiffId} onCheckedChange={(checked) => setField('isDiffId')(checked === true)} />
              IS ICEGATE ID DIFFERENT? {defaultIcegateId && <span className="tw:text-[10px] tw:text-muted-foreground">(Default: {defaultIcegateId})</span>}
            </Label>
            <Label className="tw:cursor-pointer tw:gap-2 tw:text-[11px] tw:font-semibold">
              <Checkbox checked={!!doc.isApplicable} onCheckedChange={(checked) => setField('isApplicable')(checked === true)} />
              IS APPLICABLE?
            </Label>
          </div>
          <div className="tw:flex tw:flex-wrap tw:gap-4 tw:lg:ml-auto">
            <Field label="FILE TYPE" layout="col" labelClassName={LABEL_CLASS}>
              <SelectBox className="tw:w-28" options={['PDF']} value={doc.fileType} onValueChange={setField('fileType')} />
            </Field>
            <Field label="DOC. FOR" layout="col" labelClassName={LABEL_CLASS}>
              <SelectBox className="tw:w-28" options={['ITEM', 'HEADER']} value={doc.docFor} onValueChange={setField('docFor')} />
            </Field>
          </div>
        </div>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-3 tw:border-t tw:border-border tw:px-5 tw:py-4 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          {showPinPrompt ? (
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-primary/30 tw:bg-background tw:px-3 tw:py-1.5">
              <span className="tw:text-xs tw:font-bold tw:text-primary">ENTER PIN:</span>
              <Input type="password" placeholder="••••••••" autoFocus className="tw:w-24 tw:text-center tw:tracking-widest" value={tokenPin} onChange={(event) => setTokenPin(event.target.value)} />
              <Button variant="default" disabled={isUploading} onClick={uploadDocument}>{isUploading ? 'PROCESSING...' : 'CONFIRM & UPLOAD'}</Button>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setShowPinPrompt(false)}><X /></Button>
            </div>
          ) : (
            <>
              <FileButton variant="default" size="lg" accept=".pdf" onFiles={(files) => { setUploadFile(files[0]); setShowPinPrompt(true); }}>
                <Upload className="tw:size-4" /> AUTO-SIGN & UPLOAD DOC
              </FileButton>
              <span className="tw:text-[11px] tw:text-muted-foreground">Upload PDF to auto-generate IRN</span>
            </>
          )}
        </div>
        <div className="tw:flex tw:gap-3">
          <Button size="lg" onClick={onClose}>CANCEL</Button>
          <Button variant="success" size="lg" onClick={onSave}><Save /> SAVE RECORD</Button>
        </div>
      </div>
    </div>
  );
}

export default function ExportDocsTab() {
  const defaultIcegateId = useDefaultIcegateId();
  const { docs, setDocs } = useExportContext();
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  const toggleCheck = (id) => setCheckedIds((ids) => (ids.includes(id) ? ids.filter((checkedId) => checkedId !== id) : [...ids, id]));
  const toggleAll = () => setCheckedIds((ids) => (docs.length > 0 && ids.length === docs.length ? [] : docs.map((doc) => doc.id)));
  const deleteSelected = () => {
    setDocs(docs.filter((doc) => !checkedIds.includes(doc.id)));
    setCheckedIds([]);
  };
  const duplicateRow = (id) => {
    const source = docs.find((doc) => doc.id === id);
    if (source) setDocs([...docs, { ...source, id: Date.now(), srNo: docs.length + 1 }]);
  };

  const openForm = (doc) => {
    setEditingDoc(doc);
    setIsFormOpen(true);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingDoc(null);
  };
  const saveDoc = () => {
    setDocs(docs.some((doc) => doc.id === editingDoc.id) ? docs.map((doc) => (doc.id === editingDoc.id ? editingDoc : doc)) : [...docs, editingDoc]);
    setIsFormOpen(false);
  };

  const columns = [
    {
      key: 'actions',
      header: 'Action',
      align: 'center',
      width: '60px',
      cell: (doc) => (
        <div className="tw:flex tw:justify-center tw:gap-1">
          <Button variant="ghost" size="icon-sm" title="Edit" className="tw:text-primary" onClick={(event) => { event.stopPropagation(); openForm({ ...doc }); }}><Edit /></Button>
          <Button variant="ghost" size="icon-sm" title="Duplicate" className="tw:text-success" onClick={(event) => { event.stopPropagation(); duplicateRow(doc.id); }}><Copy /></Button>
        </div>
      ),
    },
    { key: 'srNo', header: 'Sr No', align: 'center', width: '50px' },
    { key: 'docCode', header: 'Doc Code', width: '100px' },
    {
      key: 'irn',
      header: 'IRN Number',
      width: '180px',
      cell: (doc) => (
        <span className="tw:inline-flex tw:items-center tw:gap-2 tw:font-semibold tw:text-primary">
          {doc.irn}
          {doc.fileUrl && (
            <Button asChild variant="success" size="sm">
              <a href={doc.fileUrl} target="_blank" rel="noreferrer">👁 View PDF</a>
            </Button>
          )}
        </span>
      ),
    },
    { key: 'fileName', header: 'File Name', width: '180px' },
    { key: 'issuerName', header: 'Issuer Name', width: '120px' },
  ];

  return (
    <div className="tw:relative tw:flex tw:h-full tw:flex-col tw:gap-4">
      <div className="glass-panel tw:flex tw:flex-1 tw:flex-col tw:overflow-hidden tw:p-2">
        <Section
          title={<>Supporting Documents (e-Sanchit) {checkedIds.length > 0 && <span className="tw:ml-2.5 tw:text-success">({checkedIds.length} selected)</span>}</>}
          actions={(
            <>
              {checkedIds.length > 0 && <Button variant="destructive" onClick={deleteSelected}><Trash2 /> Delete Selected</Button>}
              <Button variant="default" onClick={() => openForm(blankDoc(docs.length + 1))}><Plus /> Add Document</Button>
            </>
          )}
          className="tw:min-h-0 tw:flex-1"
          bodyClassName="tw:min-h-0 tw:flex-1"
        >
          <DataTable
            columns={columns}
            rows={docs}
            selectedKey={selectedRowId}
            onRowClick={(doc) => setSelectedRowId(doc.id)}
            selection={{ keys: checkedIds, onToggle: toggleCheck, onToggleAll: toggleAll }}
            emptyText='No documents added. Click "Add Document" to start.'
          />
        </Section>
      </div>

      {editingDoc && (
        <DocForm
          doc={editingDoc}
          setDoc={setEditingDoc}
          canClose={isFormOpen}
          onClose={closeForm}
          onSave={saveDoc}
          defaultIcegateId={defaultIcegateId}
        />
      )}
    </div>
  );
}
