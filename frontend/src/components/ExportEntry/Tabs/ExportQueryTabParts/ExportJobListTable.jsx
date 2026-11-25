import { ClipboardList, Clock, Copy, Edit2, Edit3, Folder, FolderOpen, Link, Lock, MessageSquare, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { toDisplayDate } from '@/lib/dates';
import { Button, DataTable } from '@/components/ui';
import { finalDocUrl, jobState, sbNoOf, STAGE_TEXT, UNREGISTERED_DOCKET } from './exportJobList';

const STATUS_ROW_CLASS = {
  locked: 'tw:bg-destructive/10 tw:even:bg-destructive/10 tw:text-destructive',
  void: 'tw:bg-warning/10 tw:even:bg-warning/10 tw:text-warning tw:line-through tw:decoration-destructive',
  filed: 'tw:bg-success/10 tw:even:bg-success/10 tw:text-success',
};

const rowStatusClass = (job) => {
  const { isLocked, isVoid, hasSb } = jobState(job);
  if (isVoid) return STATUS_ROW_CLASS.void;
  if (isLocked) return STATUS_ROW_CLASS.locked;
  return hasSb ? STATUS_ROW_CLASS.filed : undefined;
};

const stageClass = (job) => {
  const { isLocked, isVoid } = jobState(job);
  if (isVoid) return 'tw:text-warning';
  if (isLocked) return 'tw:text-success';
  return job.stage === 'DRAFT' ? 'tw:text-muted-foreground' : 'tw:text-primary';
};

const FINAL_DOCS = [
  { letter: 'F', docType: 'FIRST_COPY', flag: 'hasFirstCopy', title: 'First Copy Downloaded', className: 'tw:border-primary/40 tw:bg-primary/10 tw:text-primary' },
  { letter: 'L', docType: 'LEO_COPY', flag: 'hasLeoCopy', title: 'LEO Copy Downloaded', className: 'tw:border-success/40 tw:bg-success/10 tw:text-success' },
  { letter: 'G', docType: 'GATEPASS', flag: 'hasGatepass', title: 'Gatepass Downloaded', className: 'tw:border-warning/40 tw:bg-warning/10 tw:text-warning' },
];

function FinalDocChips({ job }) {
  return (
    <div className="tw:flex tw:justify-center tw:gap-1">
      {FINAL_DOCS.map((doc) => (job[doc.flag]
        ? (
          <Button key={doc.letter} asChild size="icon-sm" className={doc.className} title={doc.title}>
            <a href={finalDocUrl(job, doc.docType)} target="_blank" rel="noreferrer">{doc.letter}</a>
          </Button>
        )
        : <Button key={doc.letter} size="icon-sm" variant="ghost" disabled className="tw:text-muted-foreground/50">{doc.letter}</Button>))}
    </div>
  );
}

function IconAction({ icon: Icon, title, onClick, disabled, className }) {
  return (
    <Button variant="ghost" size="icon-sm" title={title} disabled={disabled} onClick={onClick} className={className}>
      <Icon />
    </Button>
  );
}

function DocketCell({ job, onRegister, onOpen }) {
  if (job.docketNo !== UNREGISTERED_DOCKET) {
    return <Button variant="link" size="sm" className="tw:text-current tw:underline" title="Open the docket in Shipment Registration" onClick={() => onOpen(job)}>{job.docketNo}</Button>;
  }
  if (jobState(job).isVoid) return job.docketNo;
  return (
    <Button variant="link" size="sm" title="Click to register the shipment: makes the docket no and the entry in Shipment Registration" onClick={() => onRegister(job)}>
      {UNREGISTERED_DOCKET}
    </Button>
  );
}

function amendJob(job, startAmend) {
  if (!jobState(job).isFiled) {
    toast.error(`Job ${job.jobNo} is not filed yet - change it with Edit; only a filed SB is amended.`);
    return;
  }
  startAmend(job);
}

function jobColumns({ runAction, showDocuments, showLogs, showTrack, startAmend, registerDocket, openDocket }) {
  const center = { align: 'center', width: 40 };
  const opens = (action, icon, title, className) => ({
    cell: (job) => <IconAction icon={icon} title={title} className={className} onClick={() => runAction(action, job.id)} />,
  });

  return [
    { key: 'docs', header: 'Docs', align: 'center', width: 80, cell: (job) => <FinalDocChips job={job} /> },
    { key: 'files', header: 'Files', title: 'e-Sanchit documents and PDFs kept with the job', ...center, cell: (job) => <IconAction icon={FolderOpen} title="Documents of this job (e-Sanchit + PDFs)" className="tw:text-success" onClick={() => showDocuments(job)} /> },
    // a job after LEO still opens (view / print / amend from there); only Delete is closed
    {
      key: 'edit', header: 'Edit', ...center,
      cell: (job) => <IconAction icon={Edit2} title={jobState(job).isLocked ? 'LEO given - opens the job (change it with Amend)' : 'Edit Job'} className="tw:text-primary" onClick={() => runAction('edit', job.id)} />,
    },
    { key: 'duplicate', header: 'Dup', title: 'Duplicate', ...center, ...opens('duplicate', Copy, 'Duplicate Job', 'tw:text-primary') },
    {
      key: 'delete', header: 'Del', title: 'Delete', ...center,
      cell: (job) => (jobState(job).isLocked
        ? <IconAction icon={Trash2} title="Locked Job (LEO given)" disabled className="tw:text-muted-foreground" />
        : <IconAction icon={Trash2} title="Delete Job" className="tw:text-destructive" onClick={() => runAction('delete', job.id, job)} />),
    },
    { key: 'log', header: 'Log', title: 'Audit Logs', ...center, cell: (job) => <IconAction icon={Clock} title="View Logs" className="tw:text-warning" onClick={() => showLogs(job)} /> },
    { key: 'chat', header: 'Chat', ...center, ...opens('timeline', MessageSquare, 'Timeline Log', 'tw:text-success') },
    { key: 'jobNo', header: 'Job No', cell: (job) => <span className="tw:flex tw:items-center tw:gap-1">{jobState(job).isLocked && <Lock className="tw:size-3" />}{job.jobNo}</span> },
    { key: 'jobDate', header: 'Job Date' },
    { key: 'docketNo', header: 'Docket No', className: 'tw:font-semibold', cell: (job) => <DocketCell job={job} onRegister={registerDocket} onOpen={openDocket} /> },
    { key: 'exporter', header: 'Exporter' },
    { key: 'consignee', header: 'Consignee' },
    { key: 'origin', header: 'Origin', className: 'tw:text-muted-foreground' },
    { key: 'destination', header: 'Destination', className: 'tw:text-muted-foreground' },
    { key: 'invNo', header: 'Inv No' },
    { key: 'invDt', header: 'Inv Dt', cell: (job) => toDisplayDate(job.invDt) },
    { key: 'containerNo', header: 'Container No' },
    { key: 'invValue', header: 'Inv Value', align: 'right' },
    { key: 'fobValue', header: 'Fob Value', align: 'right' },
    { key: 'dbkValue', header: 'Dbk Value', align: 'right' },
    { key: 'sbNo', header: 'SB No', cell: sbNoOf },
    { key: 'sbDate', header: 'SB Date', cell: (job) => toDisplayDate(job.sbDate || job.autoField_26) },
    {
      key: 'sbTrack', header: 'SB Track', align: 'center',
      cell: (job) => <IconAction icon={Link} title="SB Track: stage, SB No, ICEGATE acknowledgement" className={cn('tw:rounded-full', job.icegateUniqueId || job.sbNo ? 'tw:text-success' : 'tw:text-muted-foreground')} onClick={() => showTrack(job)} />,
    },
    { key: 'checklist', header: 'Print Checklist', align: 'center', ...opens('print_checklist', ClipboardList, 'Print Checklist', 'tw:text-primary') },
    {
      key: 'status', header: 'Status',
      cell: (job) => <span className={cn('tw:text-[10px] tw:font-bold', stageClass(job))}>{STAGE_TEXT[job.stage] || job.stage}{job.icegateStatus ? ` (${job.icegateStatus})` : ''}</span>,
    },
    { key: 'esanchit', header: 'eSanchit', align: 'center', ...opens('esanchit', Folder, 'eSanchit (Manage in Items Tab)', 'tw:text-primary') },
    { key: 'scheme', header: 'Scheme', align: 'center', ...opens('scheme', Link, 'Scheme', 'tw:rounded-full tw:text-success') },
    { key: 'licence', header: 'Lic', align: 'center', ...opens('scheme', Link, 'Lic', 'tw:rounded-full tw:text-success') },
    {
      key: 'amend', header: 'Amend', align: 'center',
      cell: (job) => <IconAction icon={Edit3} title="Amend Shipping Bill" className={job.sbNo || job.icegateStatus ? 'tw:text-primary' : 'tw:text-muted-foreground/60'} onClick={() => amendJob(job, startAmend)} />,
    },
    { key: 'enteredBy', header: 'Entered By', cell: (job) => job.enteredBy || '-' },
    { key: 'enteredAt', header: 'Entered Date', className: 'tw:text-[10px]', cell: (job) => (job.enteredAt ? new Date(job.enteredAt).toLocaleString() : '') },
  ];
}

export default function ExportJobListTable({ jobs, handlers, onRowMenu }) {
  return (
    <DataTable
      columns={jobColumns(handlers)}
      rows={jobs}
      rowClassName={rowStatusClass}
      onRowContextMenu={onRowMenu}
      emptyText="No jobs found"
      containerClassName="tw:h-full"
    />
  );
}
