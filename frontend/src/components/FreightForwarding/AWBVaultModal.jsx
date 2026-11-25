import { useEffect, useState } from 'react';
import { FolderOpen, Trash2, X, Zap } from 'lucide-react';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, DataTable, Field, FileButton, Modal, SelectBox } from '@/components/ui';
import { askConfirm } from '../common/askConfirm';
import { freightApi } from './freightApi';
import ExtractedPreview from './AWBVaultModalParts/ExtractedPreview';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.gif,.bmp,.doc,.docx,.xls,.xlsx,.csv,.txt,.msg,.eml';

const DOCUMENT_TYPES = [
  { value: 'COMMERCIAL INVOICE', label: 'COMMERCIAL INVOICE' },
  { value: 'PACKING LIST', label: 'PACKING LIST' },
  { value: 'CERTIFICATE OF ORIGIN', label: 'CERTIFICATE OF ORIGIN' },
  { value: 'LETTER OF CREDIT', label: 'LETTER OF CREDIT' },
  { value: 'SHIPPERS DECLARATION', label: 'SHIPPERS DECLARATION (DGD)' },
  { value: 'PHYTO CERTIFICATE', label: 'PHYTO CERTIFICATE' },
  { value: 'MSDS', label: 'MSDS (MATERIAL SAFETY)' },
  { value: 'OTHER', label: 'OTHER / MISC' },
];

const pouchLabel = (awbNumber) => {
  const number = String(awbNumber || '');
  if (/^\d{11}$/.test(number)) return `(AWB: ${number.slice(0, 3)}-${number.slice(3)})`;
  if (/^HAWB /.test(number)) return `(${number})`;
  return '(Draft AWB)';
};

const documentColumns = ({ extractingId, onExtract, onDelete }) => [
  {
    key: 'originalName',
    header: 'FILE NAME',
    className: 'tw:max-w-[260px] tw:truncate tw:font-bold',
    cell: (doc) => <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="tw:text-primary tw:no-underline">{doc.originalName}</a>,
  },
  { key: 'documentType', header: 'DOCUMENT TYPE', cell: (doc) => <Badge variant="info">{doc.documentType || 'OTHER'}</Badge> },
  { key: 'createdAt', header: 'DATE', cell: (doc) => new Date(doc.createdAt).toLocaleDateString('en-GB') },
  {
    key: 'actions',
    header: 'ACTION',
    align: 'right',
    cell: (doc) => (
      <span className="tw:flex tw:justify-end tw:gap-2">
        <Button size="sm" variant="success" disabled={extractingId === doc.id} onClick={() => onExtract(doc.id)}>
          {extractingId === doc.id ? 'EXTRACTING...' : <><Zap /> Auto-Fill</>}
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(doc.id)}><Trash2 /> Delete</Button>
      </span>
    ),
  },
];

export default function AWBVaultModal({ awbId, awbType, tempAwbId, awbNumber, onClose, onAutoFill, onRequestAddParty }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0].value);

  const loadDocs = async () => {
    try {
      setDocs(await freightApi.awbDocs(tempAwbId, awbId, awbType));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { loadDocs(); }, [awbId, tempAwbId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (files) => {
    if (!files.length) return;
    const tooBig = files.find((file) => file.size > MAX_FILE_BYTES);
    if (tooBig) {
      setErrorText(`${tooBig.name} is larger than 15 MB.`);
      return;
    }
    const formData = new FormData();
    files.forEach((file) => formData.append('docs', file));
    formData.append('documentType', docType);
    if (awbId) formData.append('awbId', awbId);
    if (awbType) formData.append('awbType', awbType);

    setUploading(true);
    try {
      await freightApi.uploadAwbDocs(tempAwbId, formData);
      setErrorText('');
      loadDocs();
    } catch (error) {
      setErrorText(`Upload Error: ${errorMessage(error)}`);
    } finally {
      setUploading(false);
    }
  };

  const extract = async (docId) => {
    setExtractingId(docId);
    try {
      const result = await freightApi.extractAwbDoc(docId);
      if (result.success && onAutoFill) setPreview({ data: result.data, mdmStatus: result.mdmStatus || null });
      else if (!result.success) setErrorText(`Could not read this document: ${result.error || result.message || 'no data found'}`);
    } catch (error) {
      setErrorText(`Failed to extract data: ${errorMessage(error)}`);
    } finally {
      setExtractingId(null);
    }
  };

  const remove = async (docId) => {
    const confirmed = await askConfirm({
      title: 'Delete Document',
      message: 'Are you sure you want to permanently delete this document? This action cannot be undone.',
      okLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await freightApi.deleteAwbDoc(docId);
      loadDocs();
    } catch (error) {
      setErrorText(`Failed to delete document: ${errorMessage(error)}`);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        width="max(60vw, 640px)"
        title={<span className="tw:flex tw:items-center tw:gap-2"><FolderOpen className="tw:size-4.5" /> Digital Pouch {pouchLabel(awbNumber)}</span>}
        bodyClassName="tw:min-h-[40vh] tw:gap-4 tw:normal-case"
      >
        {errorText && (
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:bg-destructive/10 tw:p-3 tw:text-[13px] tw:font-medium tw:text-destructive">
            <span>{errorText}</span>
            <Button variant="ghost" size="icon-sm" className="tw:text-destructive" aria-label="Hide the message" onClick={() => setErrorText('')}><X /></Button>
          </div>
        )}

        <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:md:flex-row">
          <Field label="Select Document Type" layout="col" className="tw:flex-1">
            <SelectBox value={docType} onValueChange={setDocType} options={DOCUMENT_TYPES} />
          </Field>
          <FileButton
            accept={ACCEPTED_FILES}
            multiple
            onFiles={upload}
            disabled={uploading}
            size="block"
            className="tw:flex-[2] tw:flex-col tw:items-center tw:justify-center tw:gap-1 tw:border-2 tw:border-dashed tw:border-muted-foreground/50 tw:bg-page tw:text-center"
          >
            <span className="tw:text-sm tw:font-bold tw:text-foreground">{uploading ? 'Uploading...' : 'Click to Browse & Upload Files'}</span>
            <span className="tw:text-[11px] tw:text-muted-foreground">Uploading as: {docType} · PDF, pictures, Word, Excel, CSV, text, e-mail · up to 15 MB, 10 files</span>
          </FileButton>
        </div>

        <DataTable
          columns={documentColumns({ extractingId, onExtract: extract, onDelete: remove })}
          rows={docs}
          emptyText="No E-Docs found in this Pouch."
          containerClassName="tw:max-h-[240px] tw:rounded-lg tw:border tw:border-border"
        />
      </Modal>

      {preview && (
        <ExtractedPreview
          data={preview.data}
          mdmStatus={preview.mdmStatus}
          onRequestAddParty={onRequestAddParty}
          onCancel={() => setPreview(null)}
          onApply={() => { onAutoFill(preview.data); setPreview(null); }}
        />
      )}
    </>
  );
}
