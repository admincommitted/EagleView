import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, FileText, FolderOpen, Loader2, ShieldCheck, ShieldX, Trash2 } from 'lucide-react';
import { Badge, Button, DataTable, Field, FileButton, Modal, SelectBox } from '@/components/ui';
import { askDelete } from './switchRow';
import { mastersFormApi } from './masterKit/masterRecordsApi';

const DOCUMENT_TYPES = ['PAN CARD', 'GST CERTIFICATE', 'AADHAR CARD', 'IEC CERTIFICATE', 'AD CODE LETTER', 'INCORPORATION CERTIFICATE', 'CANCELLED CHEQUE', 'BOARD RESOLUTION', 'OTHER'];

function DocumentStatus({ status }) {
  if (status === 'APPROVED') return <Badge variant="success"><ShieldCheck /> APPROVED</Badge>;
  if (status === 'REJECTED') return <Badge variant="danger"><ShieldX /> REJECTED</Badge>;
  if (!status || status === 'PENDING') return <Badge variant="warning"><Clock /> PENDING</Badge>;
  return null;
}

export default function KYCVaultModal({ party, onClose }) {
  const [docs, setDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [docType, setDocType] = useState('PAN CARD');

  const fetchDocs = useCallback(async () => {
    try {
      const list = await mastersFormApi.partyKycDocs(party.id);
      setDocs(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error(error);
    }
  }, [party.id]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadFiles = async (files) => {
    if (!files.length) return;
    setIsUploading(true);
    const formData = new FormData();
    files.forEach((file) => formData.append('docs', file));
    formData.append('documentType', docType);
    try {
      await mastersFormApi.uploadPartyKycDocs(party.id, formData);
      fetchDocs();
    } catch {
      toast.error('Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDoc = async (docId) => {
    if (!(await askDelete('Delete this document?'))) return;
    try {
      await mastersFormApi.deletePartyKycDoc(docId);
      fetchDocs();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const columns = [
    {
      key: 'originalName', header: 'FILE NAME', className: 'tw:max-w-[260px] tw:truncate',
      cell: (doc) => (
        <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="tw:inline-flex tw:items-center tw:gap-1 tw:font-bold tw:text-primary tw:no-underline">
          <FileText className="tw:size-3.5 tw:shrink-0" /> {doc.originalName}
        </a>
      ),
    },
    { key: 'documentType', header: 'DOCUMENT TYPE', cell: (doc) => <Badge variant="info">{doc.documentType || 'OTHER'}</Badge> },
    { key: 'docStatus', header: 'STATUS', cell: (doc) => <DocumentStatus status={doc.docStatus} /> },
    { key: 'createdAt', header: 'DATE', className: 'tw:text-muted-foreground', cell: (doc) => new Date(doc.createdAt).toLocaleDateString('en-GB') },
    {
      key: 'action', header: 'ACTION', align: 'right',
      cell: (doc) => <Button variant="destructive" size="sm" onClick={() => deleteDoc(doc.id)}><Trash2 /> Delete</Button>,
    },
  ];

  return (
    <Modal open onClose={onClose} width="max(60vw, 360px)" title={`KYC Document Vault (${party.name})`} bodyClassName="tw:min-h-[40vh] tw:gap-4">
      <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:md:flex-row">
        <Field label="Select Document Type" required layout="col" className="tw:flex-1">
          <SelectBox options={DOCUMENT_TYPES} value={docType} onValueChange={setDocType} />
        </Field>
        <FileButton multiple onFiles={uploadFiles} disabled={isUploading} variant="outline" size="block"
          className="tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-1 tw:border-2 tw:border-dashed tw:border-primary/40 tw:bg-primary/5 tw:py-4 tw:text-center">
          <span className="tw:flex tw:items-center tw:gap-2 tw:font-semibold tw:text-head">
            {isUploading ? <><Loader2 className="tw:animate-spin" /> Uploading...</> : <><FolderOpen /> Click to Browse &amp; Upload Files</>}
          </span>
          <span className="tw:text-[11px] tw:text-muted-foreground">Uploading as: {docType}</span>
        </FileButton>
      </div>

      <DataTable columns={columns} rows={docs} emptyText="No KYC documents found for this party."
        containerClassName="tw:max-h-[240px] tw:rounded-lg tw:border tw:border-border" />
    </Modal>
  );
}
