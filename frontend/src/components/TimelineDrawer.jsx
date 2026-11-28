import { X } from 'lucide-react';
import askConfirm from './common/askConfirm';
import { Button } from '@/components/ui';
import { useTimeline } from './TimelineDrawerParts/useTimeline';
import { offeredStatuses } from './TimelineDrawerParts/timelineStatuses';
import { loggedInUserName } from './TimelineDrawerParts/timelineFormat';
import { turnaroundOf } from './TimelineDrawerParts/turnaround';
import TurnaroundBanner from './TimelineDrawerParts/TurnaroundBanner';
import TimelineJobSummary from './TimelineDrawerParts/TimelineJobSummary';
import TimelineEntry from './TimelineDrawerParts/TimelineEntry';
import RemarkComposer from './TimelineDrawerParts/RemarkComposer';

function EmptyTimeline({ hasJob }) {
  if (hasJob) return <p className="tw:mt-5 tw:text-center tw:text-[13px] tw:text-muted-foreground">No timeline logs found.</p>;
  return (
    <p className="tw:mt-5 tw:text-center tw:text-[13px] tw:leading-normal tw:text-muted-foreground tw:normal-case">
      No job selected.<br />
      <span className="tw:text-xs">The timeline is kept per saved job: save this job (Job Header &gt; Save) or open one from 1. Job Query, then open Timeline Log again.</span>
    </p>
  );
}

// Timeline & Logs of a job (IMPORT / EXPORT): turnaround time, job summary, remarks and statuses.
export default function TimelineDrawer({ isOpen, onClose, jobId, module = 'IMPORT' }) {
  const { logs, jobInfo, statusRows, chaNames, isSaving, addEntry, deleteEntry } = useTimeline({ isOpen, jobId, module });
  if (!isOpen) return null;

  const userName = loggedInUserName();
  const statuses = offeredStatuses(statusRows, logs, module);
  const turnaround = turnaroundOf(logs, jobInfo, module);

  const confirmDelete = async (log) => {
    if (await askConfirm({ title: 'Delete this remark?', message: log.message, okLabel: 'Delete', cancelLabel: 'Keep it', tone: 'danger' })) deleteEntry(log);
  };

  return (
    <div className="tw:fixed tw:inset-x-0 tw:top-[76px] tw:bottom-[80px] tw:z-[999999] tw:flex tw:flex-col tw:border-l tw:border-border tw:bg-page tw:md:left-auto tw:md:w-[350px]">
      <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-border tw:bg-card tw:p-4">
        <h3 className="tw:m-0 tw:text-base tw:font-semibold tw:text-foreground">Timeline & Logs</h3>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X className="tw:size-5" /></Button>
      </div>
      {turnaround && <TurnaroundBanner turnaround={turnaround} />}
      {jobInfo && <TimelineJobSummary jobInfo={jobInfo} module={module} chaNames={chaNames} />}

      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-3 tw:overflow-y-auto tw:p-4">
        {(!jobId || logs.length === 0) && <EmptyTimeline hasJob={!!jobId} />}
        {logs.map((log, index) => (
          <TimelineEntry key={log.id || index} log={log} statusRows={statusRows} userName={userName} onDelete={confirmDelete} />
        ))}
      </div>

      <RemarkComposer statuses={statuses} disabled={!jobId} isSaving={isSaving} onAdd={({ text, isStatus }) => addEntry({ text, isStatus, author: userName })} />
    </div>
  );
}
