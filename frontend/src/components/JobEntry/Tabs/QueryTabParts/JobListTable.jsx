import { ClipboardList, Clock, Copy, Edit2, Edit3, FileSpreadsheet, Folder, FolderOpen, Link, Lock, MapPin, MessageSquare, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button, DataTable } from '@/components/ui';
import { finalDocUrl, jobState, UNREGISTERED_DOCKET } from './jobList';

const STATUS_ROW_CLASS = {
  locked: 'tw:bg-destructive/10 tw:even:bg-destructive/10 tw:text-destructive',
  void: 'tw:bg-warning/10 tw:even:bg-warning/10 tw:text-warning tw:line-through tw:decoration-destructive',
  filed: 'tw:bg-success/10 tw:even:bg-success/10 tw:text-success',
};

const rowStatusClass = (job) => {
  const { isLocked, isVoid, hasBe } = jobState(job);
  if (isLocked) return STATUS_ROW_CLASS.locked;
  if (isVoid) return STATUS_ROW_CLASS.void;
  return hasBe ? STATUS_ROW_CLASS.filed : undefined;
};

function IconAction({ icon: Icon, title, onClick, disabled, className }) {
  return (
    <Button variant="ghost" size="icon-sm" title={disabled ? 'Locked job' : title} disabled={disabled} onClick={onClick} className={className}>
      <Icon />
    </Button>
  );
}

const FINAL_DOCS = [
  { letter: 'F', docType: 'FIRST_COPY', flag: 'hasFirstCopy', name: 'First copy', className: 'tw:border-primary/40 tw:bg-primary/10 tw:text-primary' },
  { letter: 'O', docType: 'OOC_COPY', flag: 'hasOocCopy', name: 'OOC copy', className: 'tw:border-success/40 tw:bg-success/10 tw:text-success' },
  { letter: 'G', docType: 'GATEPASS', flag: 'hasGatepass', name: 'Gate pass', className: 'tw:border-warning/40 tw:bg-warning/10 tw:text-warning' },
];

function FinalDocChips({ job }) {
  return (
    <div className="tw:flex tw:justify-center tw:gap-1">
      {FINAL_DOCS.map((doc) => job[doc.flag]
        ? (
          <Button key={doc.letter} asChild size="icon-sm" className={doc.className} title={`${doc.name} downloaded`}>
            <a href={finalDocUrl(job, doc.docType)} target="_blank" rel="noreferrer">{doc.letter}</a>
          </Button>
        )
        : (
          <Button key={doc.letter} size="icon-sm" variant="ghost" className="tw:text-muted-foreground/50" title={`${doc.name} not available`}
            onClick={() => toast.error(`${doc.name} not available`)}>{doc.letter}</Button>
        ))}
    </div>
  );
}

function DocketCell({ job, onRegister, onOpen }) {
  if (job.docketNo !== UNREGISTERED_DOCKET) {
    return <Button variant="link" size="sm" className="tw:text-current" title="Open the docket in Shipment Registration" onClick={() => onOpen(job)}>{job.docketNo}</Button>;
  }
  if (jobState(job).isVoid) return job.docketNo;
  return (
    <Button variant="link" size="sm" title="Click to register the shipment: makes the docket no and the entry in Shipment Registration" onClick={() => onRegister(job)}>
      {UNREGISTERED_DOCKET}
    </Button>
  );
}

const beTrackMessage = (job) => {
  if (job.icegateUniqueId) return `ICEGATE: ${job.icegateStatus || 'SENT'} | Unique ID ${job.icegateUniqueId}`;
  return job.beNo ? `BE No ${job.beNo}` : 'Not filed on ICEGATE yet';
};

function jobColumns({ runAction, showDocuments, showLogs, registerDocket, openDocket }) {
  const center = { align: 'center', width: 40 };
  const lockable = (icon, title, action, className) => ({
    cell: (job) => <IconAction icon={icon} title={title} className={className} disabled={jobState(job).isLocked} onClick={() => runAction(action, job)} />,
  });
  const opens = (icon, action, className, title) => ({
    cell: (job) => <IconAction icon={icon} title={title} className={className} onClick={() => runAction(action, job)} />,
  });

  return [
    { key: 'docs', header: 'Docs', align: 'center', width: 80, cell: (job) => <FinalDocChips job={job} /> },
    { key: 'files', header: 'Files', title: 'e-Sanchit documents and PDFs kept with the job', ...center, cell: (job) => <IconAction icon={FolderOpen} title="Documents of this job (e-Sanchit + PDFs)" className="tw:text-success" onClick={() => showDocuments(job)} /> },
    { key: 'edit', header: 'Edit', ...center, ...lockable(Edit2, 'Edit Job', 'edit', 'tw:text-primary') },
    { key: 'duplicate', header: 'Dup', title: 'Duplicate', ...center, ...lockable(Copy, 'Duplicate Job', 'duplicate', 'tw:text-primary') },
    { key: 'delete', header: 'Del', title: 'Delete', ...center, ...lockable(Trash2, 'Delete Job', 'delete', 'tw:text-destructive') },
    { key: 'log', header: 'Log', title: 'Audit Logs', ...center, cell: (job) => <IconAction icon={Clock} title="View Logs" className="tw:text-warning" onClick={() => showLogs(job)} /> },
    { key: 'chat', header: 'Chat', ...center, ...opens(MessageSquare, 'timeline', 'tw:text-success', 'Timeline Log') },
    { key: 'jobNo', header: 'Job No', cell: (job) => <span className="tw:flex tw:items-center tw:gap-1">{jobState(job).isLocked && <Lock className="tw:size-3" />}{job.jobNo}</span> },
    { key: 'jobDate', header: 'Job Date' },
    { key: 'docketNo', header: 'Docket No', className: 'tw:font-semibold', cell: (job) => <DocketCell job={job} onRegister={registerDocket} onOpen={openDocket} /> },
    { key: 'importer', header: 'Importer' },
    { key: 'supplier', header: 'Supplier' },
    { key: 'origin', header: 'Origin', className: 'tw:text-muted-foreground' },
    { key: 'destination', header: 'Destination', className: 'tw:text-muted-foreground' },
    { key: 'invNo', header: 'Inv No' },
    { key: 'invDt', header: 'Inv Dt' },
    { key: 'containerNo', header: 'Container No', cell: (job) => (job.containerNo === 'N/A' ? '' : job.containerNo) },
    { key: 'invValue', header: 'Inv Value', align: 'right' },
    { key: 'assessableValue', header: 'Ass. Value', align: 'right' },
    { key: 'dutyValue', header: 'Duty Value', align: 'right' },
    { key: 'beNo', header: 'BE No' },
    { key: 'beDate', header: 'BE Date' },
    { key: 'beTrack', header: 'BE Track', align: 'center', cell: (job) => <IconAction icon={Link} title="BE / ICEGATE status" className="tw:rounded-full tw:text-success" onClick={() => toast(beTrackMessage(job))} /> },
    { key: 'checklist', header: 'Print Checklist', align: 'center', ...opens(ClipboardList, 'open:reports', 'tw:text-muted-foreground', 'Print checklist') },
    { key: 'submissionStatus', header: 'Submission Status', className: 'tw:text-[10px]', cell: (job) => job.icegateStatus || job.status || 'DRAFT' },
    { key: 'submit', header: 'Submit Job', align: 'center', ...opens(ClipboardList, 'open:reports', 'tw:text-primary', 'Submit job') },
    { key: 'status', header: 'Status', align: 'center', ...opens(ClipboardList, 'open:reports', 'tw:text-primary', 'Status') },
    { key: 'excel', header: 'Excel', align: 'center', ...opens(FileSpreadsheet, 'open:reports', 'tw:text-success', 'Excel') },
    { key: 'esanchit', header: 'eSanchit', align: 'center', ...opens(Folder, 'open:esanchit', 'tw:text-primary', 'e-Sanchit documents') },
    { key: 'duty', header: 'Duty', align: 'center', ...opens(Link, 'open:items', 'tw:rounded-full tw:text-success', 'Duty') },
    { key: 'licence', header: 'Lic', align: 'center', ...opens(Edit3, 'open:items', 'tw:text-primary', 'Licence') },
    { key: 'amend', header: 'Amend', align: 'center', ...opens(Edit3, 'amend', 'tw:text-primary', 'BE amendment') },
    { key: 'track', header: 'Track...', align: 'center', ...opens(MapPin, 'timeline', 'tw:text-destructive', 'Track') },
    { key: 'lockedBy', header: 'Locked By' },
    { key: 'enteredBy', header: 'Entered By' },
    { key: 'enteredDate', header: 'Entered Date', className: 'tw:text-[10px]' },
  ];
}

export default function JobListTable({ jobs, handlers, onRowMenu, className }) {
  return (
    <DataTable
      columns={jobColumns(handlers)}
      rows={jobs}
      rowClassName={rowStatusClass}
      onRowContextMenu={onRowMenu}
      emptyText="No jobs found"
      containerClassName={cn('tw:h-full', className)}
    />
  );
}
