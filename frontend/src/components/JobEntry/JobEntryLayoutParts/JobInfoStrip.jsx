import { Badge, Button, badgeVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import DocketFromJob from '../../DocketFromJob';
import { beTypeLabel, transportModeLabel } from './jobCodes';
import { filingStatusClass, filingStatusText, icegateJobNumber, icegateReplyButton } from './jobStatus';

const WRAPPING_BADGE = 'tw:h-auto tw:max-w-full tw:flex-wrap tw:whitespace-normal tw:md:whitespace-nowrap';

function StripDivider() {
  return <span className="tw:text-border">|</span>;
}

function StripValue({ label, title, valueClassName, children }) {
  return (
    <span title={title}>
      {label}: <strong className={cn('tw:text-foreground', valueClassName)}>{children}</strong>
    </span>
  );
}

function FiledLockBadge({ jobData, filedLock }) {
  if (!filedLock.isFiled) return null;
  if (filedLock.isFiledLocked) {
    return (
      <Badge variant="warning" className={WRAPPING_BADGE}>
        🔒 LOCKED{jobData.filedAt ? ` - sent ${new Date(jobData.filedAt).toLocaleString('en-GB')}` : ''}
        <Button variant="warning" size="sm" onClick={filedLock.unlockForAmendment}>Unlock for amendment</Button>
      </Badge>
    );
  }
  return (
    <Badge variant="danger" className={WRAPPING_BADGE} title={jobData.amendUnlockedBy ? `Unlocked by ${jobData.amendUnlockedBy}` : ''}>
      🔓 AMENDMENT MODE - the filed copy is kept; file the amendment when done
    </Badge>
  );
}

function AmendedJobBadge({ jobData, onOpenAmendment, onOpenJob }) {
  if (!jobData._amendmentId) return null;
  return (
    <Badge variant="info" className={WRAPPING_BADGE}>
      AMENDMENT {jobData._amendNo} of BE job {jobData._amendOfJobNo} - changes here do not touch the filed job
      <Button size="sm" onClick={onOpenAmendment}>Changes & file</Button>
      {jobData._amendOfJobId && <Button size="sm" onClick={() => onOpenJob(jobData._amendOfJobId)}>Back to BE job</Button>}
    </Badge>
  );
}

// The job line above the tabs: job no, docket, BE type, mode, filing status, lock / amendment and the ICEGATE reply.
export default function JobInfoStrip({ jobData, beType, transportMode, icegateResult, filedLock, onOpenAmendment, onOpenJob, onShowAck }) {
  const icegateJobNo = icegateJobNumber(jobData);
  const replyButton = icegateReplyButton(jobData, icegateResult);
  return (
    <div className="job-strip tw:mt-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-[10px] tw:font-medium tw:text-muted-foreground">
      <StripValue label="JOB">{jobData.jobNo || ''}</StripValue>
      {icegateJobNo && <StripValue label="ICEGATE JOB NO" title="Job no. in ICEGATE mails and replies; search the job list by it too">{icegateJobNo}</StripValue>}
      <DocketFromJob side="Import" job={jobData} />
      <StripDivider />
      <StripValue label="TYPE">{beTypeLabel(beType)}</StripValue>
      <StripDivider />
      <StripValue label="MODE" valueClassName="tw:text-primary">{transportModeLabel(transportMode)}</StripValue>
      <StripDivider />
      <StripValue label="STATUS" valueClassName={filingStatusClass(jobData, icegateResult)}>{filingStatusText(jobData, icegateResult)}</StripValue>
      <FiledLockBadge jobData={jobData} filedLock={filedLock} />
      <AmendedJobBadge jobData={jobData} onOpenAmendment={onOpenAmendment} onOpenJob={onOpenJob} />
      {replyButton && (
        <Button size="sm" className={cn(badgeVariants({ variant: replyButton.variant }), 'tw:h-auto tw:cursor-pointer')} title="Ask ICEGATE what ICES answered: BE No / Date or the error list" onClick={onShowAck}>
          {replyButton.label}
        </Button>
      )}
    </div>
  );
}
