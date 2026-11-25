import { ClipboardList, Clock, Copy, Download, Edit2, Eye, FileCheck, FileText, FolderOpen, MessageSquare, Trash2, UploadCloud } from 'lucide-react';
import { finalDocUrl, jobState, UNREGISTERED_DOCKET } from './jobList';

const openInNewTab = (url) => window.open(url, '_blank', 'noopener');

const finalDocItem = (job, label, docType, available) => ({
  label,
  icon: FileCheck,
  disabled: !available,
  note: available ? '' : 'not yet',
  onSelect: () => openInNewTab(finalDocUrl(job, docType)),
});

export function jobRowMenu(job, { runAction, showDocuments, showLogs, registerDocket, openDocket }) {
  const { isLocked, isVoid } = jobState(job);
  const lockedTitle = isLocked ? 'Locked job' : undefined;
  const action = (name) => () => runAction(name, job);

  return [
    { heading: `Job ${job.jobNo || ''}` },
    { label: 'Open job', icon: Edit2, onSelect: action('edit'), disabled: isLocked, title: lockedTitle },
    { label: 'Documents (e-Sanchit + files)', icon: FolderOpen, onSelect: () => showDocuments(job) },
    { label: 'Duplicate job', icon: Copy, onSelect: action('duplicate'), disabled: isLocked, title: lockedTitle },
    { label: 'View logs', icon: Clock, onSelect: () => showLogs(job) },
    { label: 'Timeline / chat', icon: MessageSquare, onSelect: action('timeline') },
    { separator: true },
    { heading: 'BE files - without opening the job' },
    { label: 'Preview JSON', icon: Eye, onSelect: action('list-preview') },
    { label: 'Download BE File (CACHI01 JSON)', icon: Download, onSelect: action('list-json') },
    { label: 'Download BE Flat File (.be)', icon: Download, onSelect: action('list-flat') },
    { label: 'BE Amendment', icon: FileText, onSelect: action('list-amend') },
    { separator: true },
    { heading: 'Opens the job and starts' },
    { label: 'Send to ICEGATE', icon: UploadCloud, tone: 'success', onSelect: action('open-send'), disabled: isLocked || isVoid, title: isVoid ? 'Void job' : lockedTitle },
    { label: 'AI PDF Extract (supplier invoice)', icon: UploadCloud, tone: 'accent', onSelect: action('open-ai'), disabled: isLocked, title: lockedTitle },
    { separator: true },
    job.docketNo === UNREGISTERED_DOCKET
      ? { label: 'Register shipment (make docket)', icon: ClipboardList, onSelect: () => registerDocket(job), disabled: isVoid }
      : { label: `Open docket ${job.docketNo}`, icon: ClipboardList, onSelect: () => openDocket(job) },
    finalDocItem(job, 'First copy', 'FIRST_COPY', job.hasFirstCopy),
    finalDocItem(job, 'OOC copy', 'OOC_COPY', job.hasOocCopy),
    finalDocItem(job, 'Gate pass', 'GATEPASS', job.hasGatepass),
    { separator: true },
    { label: 'Delete job', icon: Trash2, tone: 'danger', onSelect: action('delete'), disabled: isLocked, title: lockedTitle },
  ];
}
