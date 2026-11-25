import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import JobFilesPanel from '../../../common/JobFilesPanel';
import { errorMessage } from '@/services/axiosInstance';
import { Button, CardTitle, DataTable, Modal } from '@/components/ui';
import { jobEntryApi } from '../../jobEntryApi';

const asList = (value) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const documentRow = (level, doc) => ({
  level,
  docCode: doc.docCode,
  docName: doc.docName,
  irn: doc.irn,
  issuerName: doc.issuerName,
  issueDate: doc.issueDate || doc.date,
  fileName: doc.fileName,
  fileUrl: doc.fileUrl,
});

function esanchitRows(job) {
  const beLevel = (doc) => (String(doc.docFor || 'HEADER').toUpperCase() === 'HEADER' ? 'BE' : `Invoice ${doc.invSrNo || ''}`);
  const itemLevel = (doc, invoiceIndex, item) => {
    const level = String(doc.docFor || 'ITEM').toUpperCase();
    if (level === 'ITEM') return `Item ${invoiceIndex + 1}/${item.itemSrNo || item.itemNo || ''}`;
    return level === 'INVOICE' ? `Invoice ${invoiceIndex + 1}` : 'BE';
  };
  return [
    ...asList(job.esanchitDocs).map((doc) => documentRow(beLevel(doc), doc)),
    ...(job.invoices || []).flatMap((invoice, invoiceIndex) =>
      (invoice.items || []).flatMap((item) => asList(item.docsData).map((doc) => documentRow(itemLevel(doc, invoiceIndex, item), doc)))),
  ];
}

async function archiveFilesOf(archiveKey) {
  try {
    const archive = await jobEntryApi.esanchitArchive(archiveKey);
    return archive.data || [];
  } catch {
    return [];
  }
}

async function archivedFiles(listedJob, savedJob) {
  const archiveKeys = [...new Set([listedJob.jobNo, `job-${listedJob.id}`].filter(Boolean))];
  const archives = await Promise.all(archiveKeys.map(archiveFilesOf));
  const finals = asList(savedJob.finalDocs)
    .filter((doc) => doc?.fileUrl)
    .map((doc) => ({ fileName: `${doc.docType || 'FINAL'} - ${doc.fileName || doc.fileUrl.split('/').pop()}`, fileUrl: doc.fileUrl, final: true }));
  const files = [...archives.flat(), ...finals];
  return files.filter((file, index) => files.findIndex((other) => other.fileUrl === file.fileUrl) === index);
}

const DOCUMENT_COLUMNS = [
  { key: 'level', header: 'Level', className: 'tw:font-semibold' },
  { key: 'docCode', header: 'Doc code', cell: (doc) => <span title={doc.docName}>{doc.docCode}{doc.docName && ` - ${String(doc.docName).slice(0, 30)}`}</span> },
  { key: 'irn', header: 'IRN', cell: (doc) => <span className={doc.irn ? 'tw:font-mono tw:text-success' : 'tw:font-mono tw:text-destructive'}>{doc.irn || 'no IRN'}</span> },
  { key: 'issuerName', header: 'Issued by' },
  { key: 'issueDate', header: 'Issue date', cell: (doc) => String(doc.issueDate || '').slice(0, 10) },
  {
    key: 'file',
    header: 'PDF',
    cell: (doc) => doc.fileUrl
      ? <Button asChild variant="link" size="sm"><a href={doc.fileUrl} target="_blank" rel="noreferrer" title={doc.fileName || doc.fileUrl}>{/_signed\.pdf$/i.test(doc.fileUrl) ? 'Signed PDF' : 'PDF'}</a></Button>
      : <span className="tw:text-muted-foreground">{doc.fileName ? 'not kept' : '-'}</span>,
  },
];

export default function JobDocumentsModal({ job, onClose }) {
  const [documents, setDocuments] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: savedJob = {} } = await jobEntryApi.job(job.id);
        setDocuments({ rows: esanchitRows(savedJob), files: await archivedFiles(job, savedJob) });
      } catch (error) {
        toast.error(`Could not load the documents: ${errorMessage(error)}`);
        setDocuments({ rows: [], files: [] });
      }
    };
    load();
  }, [job]);

  return (
    <Modal open title={`Documents - Job ${job.jobNo}${job.beNo ? ` / BE ${job.beNo}` : ''}`} width={900} onClose={onClose}>
      {!documents ? <Loader2 className="tw:mx-auto tw:size-5 tw:animate-spin tw:text-primary" /> : (
        <>
          <CardTitle>e-Sanchit documents ({documents.rows.length})</CardTitle>
          <DataTable columns={DOCUMENT_COLUMNS} rows={documents.rows} rowKey={(_, index) => index}
            emptyText="No e-Sanchit document on this job (4. Items > Supporting Docs)." containerClassName="tw:max-h-64" />
          <JobFilesPanel module="Import" jobId={job.id} finals={documents.files.filter((file) => file.final)} />
        </>
      )}
    </Modal>
  );
}
