import { CheckCircle, ClipboardList, Clock, Copy, Download, Edit2, Edit3, Eye, FileCheck, FileText, Folder, FolderOpen, MessageSquare, Trash2, UploadCloud } from 'lucide-react';
import { finalDocUrl, jobState, UNREGISTERED_DOCKET } from './exportJobList';

const OPENS_JOB_NOTE = 'The screen fills FOB INR, drawback, party values on opening - the file is made from the open job';

const finalDocItem = (job, label, docType, available) => ({
  label,
  icon: FileCheck,
  disabled: !available,
  note: available ? '' : 'not yet',
  onSelect: () => {
    const url = finalDocUrl(job, docType);
    if (url) window.open(url, '_blank', 'noopener');
  },
});

const docketItem = (job, { registerDocket, openDocket }, isVoid) => (job.docketNo === UNREGISTERED_DOCKET
  ? { label: 'Register shipment (make docket)', icon: ClipboardList, onSelect: () => registerDocket(job), disabled: isVoid }
  : { label: `Open docket ${job.docketNo || ''}`, icon: ClipboardList, onSelect: () => openDocket(job), disabled: !job.docketNo });

// right-click on a job = every action of the row icons and of the job's ACTIONS menu in one place
export function exportRowMenu(job, handlers) {
  const { runAction, showDocuments, showLogs, showTrack, startAmend } = handlers;
  const { isLocked, isVoid, isFiled } = jobState(job);
  const action = (name) => () => runAction(name, job.id, job);

  return [
    { heading: `Job ${job.jobNo || ''}` },
    { label: 'Open job', icon: Edit2, onSelect: action('edit') },
    { label: 'Documents (e-Sanchit + files)', icon: FolderOpen, onSelect: () => showDocuments(job) },
    { label: 'Duplicate job', icon: Copy, onSelect: action('duplicate') },
    { label: 'View logs', icon: Clock, onSelect: () => showLogs(job) },
    { label: 'Timeline / chat', icon: MessageSquare, onSelect: action('timeline') },
    { label: 'SB track (ICEGATE reply)', icon: CheckCircle, onSelect: () => showTrack(job) },
    { separator: true },
    { heading: 'Opens the job and starts' },
    { label: 'Preview JSON', icon: Eye, onSelect: action('open-preview'), title: OPENS_JOB_NOTE },
    { label: 'Download SB Flat File (.sb)', icon: Download, onSelect: action('open-flat'), title: OPENS_JOB_NOTE },
    {
      label: 'Send to ICEGATE', icon: UploadCloud, tone: 'success', onSelect: action('open-send'), disabled: isLocked || isVoid,
      title: isVoid ? 'Cancelled job' : isLocked ? 'LEO given - change it with Amend' : '',
    },
    { label: 'AI PDF Extract (invoice)', icon: UploadCloud, tone: 'accent', onSelect: action('open-ai'), disabled: isLocked, title: isLocked ? 'LEO given' : '' },
    { label: 'Amend Shipping Bill', icon: Edit3, onSelect: () => startAmend(job), disabled: !isFiled, title: isFiled ? '' : 'Not filed yet - change it with Open job' },
    { label: 'Print checklist', icon: ClipboardList, onSelect: action('print_checklist') },
    { label: 'e-Sanchit documents (Items tab)', icon: Folder, onSelect: action('esanchit') },
    { label: 'Scheme / licence', icon: FileText, onSelect: action('scheme') },
    { separator: true },
    docketItem(job, handlers, isVoid),
    finalDocItem(job, 'First copy', 'FIRST_COPY', job.hasFirstCopy),
    finalDocItem(job, 'LEO copy', 'LEO_COPY', job.hasLeoCopy),
    finalDocItem(job, 'Gate pass', 'GATEPASS', job.hasGatepass),
    { separator: true },
    { label: 'Delete job', icon: Trash2, tone: 'danger', onSelect: action('delete'), disabled: isLocked, title: isLocked ? 'Locked job (LEO given)' : '' },
  ];
}
