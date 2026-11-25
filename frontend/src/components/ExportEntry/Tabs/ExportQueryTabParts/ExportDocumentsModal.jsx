import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import JobFilesPanel from '../../../common/JobFilesPanel';
import { errorMessage } from '@/services/axiosInstance';
import { toDisplayDate } from '@/lib/dates';
import { Button, CardTitle, DataTable, Modal } from '@/components/ui';
import { exportEntryApi } from '../../exportEntryApi';
import { sbNoOf } from './exportJobList';

const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const documentRow = (level, doc) => {
  const icegate = doc._icegate || {};
  return {
    level,
    docCode: doc.docCode || icegate.documentTypeCode || '',
    docName: doc.docName || '',
    irn: doc.irn || icegate.imageReferenceNumber || '',
    fileName: doc.fileName || icegate.fileType || '',
    fileUrl: doc.fileUrl || '',
    issuerName: doc.issuerName || doc.issuingParty || icegate.documentIssuingPartyName || '',
    issueDate: doc.issueDate || icegate.documentIssueDate || '',
  };
};

const itemsOf = (savedJob) => {
  const items = asList(savedJob.items);
  if (items.length) return items;
  return asList(savedJob.invoices).flatMap((invoice, index) => asList(invoice.items).map((item) => ({ ...item, invSr: item.invSr || index + 1 })));
};

function esanchitRows(savedJob) {
  const rows = [];
  const seen = new Set();
  const add = (level, doc) => {
    if (!doc) return;
    const row = documentRow(level, doc);
    const key = `${level}|${row.irn}|${row.docCode}|${doc.fileName || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };
  asList(savedJob.eSanchitList).forEach((doc) => add('SB', doc));
  itemsOf(savedJob).forEach((item) => {
    const level = `Item ${item.invSr || 1}/${item.itemSr || item.itemNo || ''}`;
    [...asList(item.eSanchitList), ...asList(item.suppDocs), ...asList(item.supportDocs)].forEach((doc) => add(level, doc));
  });
  return rows;
}

async function archiveFilesOf(archiveKey) {
  try {
    const archive = await exportEntryApi.queryEsanchitArchive(archiveKey);
    return archive?.data || [];
  } catch {
    return [];
  }
}

async function keptFiles(job) {
  const archiveKeys = [...new Set([job.jobNo, `job-${job.id}`].filter(Boolean))];
  const archives = [];
  for (const key of archiveKeys) archives.push(...(await archiveFilesOf(key)));
  const finals = (job.finalDocs || [])
    .filter((doc) => doc?.fileUrl)
    .map((doc) => ({ fileName: `${doc.docType || 'FINAL'} - ${String(doc.fileUrl).split('/').pop()}`, fileUrl: doc.fileUrl, final: true }));
  const files = [...archives, ...finals];
  return files.filter((file, index) => files.findIndex((other) => other.fileUrl === file.fileUrl) === index);
}

const DOCUMENT_COLUMNS = [
  { key: 'level', header: 'Level', className: 'tw:font-semibold' },
  { key: 'docCode', header: 'Doc code', cell: (doc) => <span title={doc.docName}>{doc.docCode}{doc.docName && ` - ${String(doc.docName).slice(0, 30)}`}</span> },
  { key: 'irn', header: 'IRN', cell: (doc) => <span className={doc.irn ? 'tw:font-mono tw:text-success' : 'tw:font-mono tw:text-destructive'}>{doc.irn || 'no IRN'}</span> },
  { key: 'issuerName', header: 'Issued by' },
  { key: 'issueDate', header: 'Issue date', cell: (doc) => (doc.issueDate ? toDisplayDate(String(doc.issueDate).slice(0, 10)) : '') },
  {
    key: 'file',
    header: 'PDF',
    cell: (doc) => (doc.fileUrl
      ? <Button asChild variant="link" size="sm"><a href={doc.fileUrl} target="_blank" rel="noreferrer" title={doc.fileName || doc.fileUrl}>{/_signed\.pdf$/i.test(String(doc.fileUrl)) ? 'Signed PDF' : 'PDF'}</a></Button>
      : <span className="tw:text-muted-foreground">{doc.fileName ? 'not kept' : '-'}</span>),
  },
];

export default function ExportDocumentsModal({ job, onClose }) {
  const [documents, setDocuments] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const answer = await exportEntryApi.exportJobById(job.id);
        setDocuments({ rows: esanchitRows(answer?.data || {}), files: await keptFiles(job) });
      } catch (error) {
        toast.error(`Could not load the documents: ${errorMessage(error)}`);
        setDocuments({ rows: [], files: [] });
      }
    };
    load();
  }, [job]);

  const sbNo = sbNoOf(job);
  return (
    <Modal open title={`Documents - Job ${job.jobNo}${sbNo ? ` / SB ${sbNo}` : ''}`} width={900} onClose={onClose}>
      {!documents ? <Loader2 className="tw:mx-auto tw:size-5 tw:animate-spin tw:text-primary" /> : (
        <>
          <CardTitle>e-Sanchit documents ({documents.rows.length})</CardTitle>
          <DataTable columns={DOCUMENT_COLUMNS} rows={documents.rows} rowKey={(_, index) => index}
            emptyText="No e-Sanchit document on this job (3. Items > e-Sanchit / Supporting Docs)." containerClassName="tw:max-h-64" />
          <JobFilesPanel module="Export" jobId={job.id} finals={documents.files.filter((file) => file.final)} />
        </>
      )}
    </Modal>
  );
}
