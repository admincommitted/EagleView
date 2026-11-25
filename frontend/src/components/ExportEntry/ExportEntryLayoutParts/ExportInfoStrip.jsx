import { Button, badgeVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import DocketFromJob from '../../DocketFromJob';
import { filingStatusClass, filingStatusText } from '../../JobEntry/JobEntryLayoutParts/jobStatus';

const isRejected = (exportData) => /rejected/i.test(exportData.icegateStatus || '');
const isAccepted = (exportData) => /accepted/i.test(exportData.icegateStatus || '');

// The ICEGATE reply (status, errors, SB No) is on every saved job; a job with no Unique ID takes it from the ICEGATE mail.
function icegateReplyButton(exportData) {
  if (!(exportData.id || exportData.icegateUniqueId)) return null;
  const sbNo = exportData.sbNo || exportData.sbNumber;
  if (isRejected(exportData)) return { label: 'REJECTED - WHY?', variant: 'danger' };
  if (isAccepted(exportData)) return { label: sbNo ? `SB ${sbNo}` : 'ICEGATE REPLY', variant: 'success' };
  return { label: 'ICEGATE REPLY', variant: 'info' };
}

function StripDivider() {
  return <span className="tw:text-border">|</span>;
}

function StripValue({ label, valueClassName, children }) {
  return <span>{label}: <strong className={cn('tw:text-foreground', valueClassName)}>{children}</strong></span>;
}

// The job line above the tabs: job no (or the one the next save gets), docket, mode, filing status and the ICEGATE reply.
export default function ExportInfoStrip({ exportData, predictedJobNo, icegateResult, onShowReply }) {
  const isSavedJobNo = exportData.jobNo && exportData.jobNo !== 'DRAFT';
  const replyButton = icegateReplyButton(exportData);
  return (
    <div className="job-strip tw:mt-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-[10px] tw:font-medium tw:text-muted-foreground">
      <StripValue label="JOB">{isSavedJobNo ? exportData.jobNo : (predictedJobNo || 'NEW')}</StripValue>
      <DocketFromJob side="Export" job={exportData} />
      <StripDivider />
      <StripValue label="MODE" valueClassName="tw:text-primary">{exportData.shipmentMode || exportData.ShipmentMode || '---'}</StripValue>
      <StripDivider />
      <StripValue label="STATUS" valueClassName={filingStatusClass(exportData, icegateResult)}>{filingStatusText(exportData, icegateResult)}</StripValue>
      {replyButton && (
        <Button size="sm" className={cn(badgeVariants({ variant: replyButton.variant }), 'tw:ml-1.5 tw:h-auto tw:cursor-pointer')} title="Ask ICEGATE what ICES answered: SB No / Date or the error list" onClick={onShowReply}>
          {replyButton.label}
        </Button>
      )}
    </div>
  );
}
