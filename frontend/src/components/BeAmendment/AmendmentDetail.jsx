// One BE amendment: details, what changed against the filed BE, codes, and the file (make, download unsigned / signed,
// sign on the DSC token, send to ICEGATE by mail), the ICEGATE reply and void.
// Used by the Job Entry amendment window and the Customs > BE Amendments register.
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { dmy } from './beAmendApi';
import StatusChip from './StatusChip';
import useAmendment from './AmendmentDetailParts/useAmendment';
import RequestCard from './AmendmentDetailParts/RequestCard';
import ChangesCard from './AmendmentDetailParts/ChangesCard';
import CodesCard from './AmendmentDetailParts/CodesCard';
import FileCard from './AmendmentDetailParts/FileCard';
import IcegateReplyCard from './AmendmentDetailParts/IcegateReplyCard';

export { StatusChip };

const NOTICE_TONES = {
  warn: 'tw:bg-warning/10 tw:text-warning',
  muted: 'tw:bg-muted tw:text-foreground',
  error: 'tw:bg-destructive/10 tw:text-destructive',
};

function Notice({ tone, children }) {
  return <div className={cn('tw:rounded-md tw:p-2', NOTICE_TONES[tone])}>{children}</div>;
}

export default function AmendmentDetail({ id, onChanged, onOpenJob, currentJobId }) {
  const { amendment, codes, changeReport, profiles, form, dirty, busy, error, load, setField, toggleCode, actions } = useAmendment(id, onChanged);

  if (error && !amendment) return <div className="tw:p-3 tw:text-entry tw:text-destructive">{error}</div>;
  if (!amendment) return <div className="tw:p-3 tw:text-entry tw:text-muted-foreground">Loading amendment…</div>;

  // a Rejected amendment is corrected and made again
  const open = ['Draft', 'Ready', 'Rejected'].includes(amendment.status);
  const canSend = ['Ready', 'Rejected'].includes(amendment.status);
  const suggested = changeReport?.suggested || [];
  const isCurrentJob = currentJobId && Number(currentJobId) === Number(amendment.amendedJobId);
  const sent = ['Submitted', 'Accepted'].includes(amendment.status);
  const accepted = amendment.status === 'Accepted';

  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5 tw:text-entry tw:text-foreground">
      <div className="tw:flex tw:flex-wrap tw:items-baseline tw:gap-2.5">
        <div className="tw:text-[20px] tw:font-extrabold tw:tracking-wide tw:tabular-nums">{amendment.amendNo}</div>
        <StatusChip status={amendment.status} />
        <div className="tw:text-muted-foreground">
          dt {dmy(amendment.amendDate)} · BE <b>{amendment.beNo}</b> dt {dmy(amendment.beDate)} · BE job <b>{amendment.parentJobNo}</b> · {amendment.branchCode}/{amendment.division}
        </div>
      </div>
      {onOpenJob && (
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          {amendment.amendedJobId && !isCurrentJob && <Button onClick={() => onOpenJob(amendment.amendedJobId)}>Open amended job</Button>}
          <Button onClick={() => onOpenJob(amendment.importJobId)}>Open BE job {amendment.parentJobNo}</Button>
        </div>
      )}

      <RequestCard form={form} open={open} setField={setField} />
      <ChangesCard changeReport={changeReport} onRefresh={load} />
      <CodesCard codes={codes} form={form} open={open} suggested={suggested} onToggle={toggleCode} onUseSuggested={() => setField('codes', suggested)} />
      <FileCard amendment={amendment} form={form} profiles={profiles} open={open} canSend={canSend} busy={busy} dirty={dirty} setField={setField} actions={actions} />
      {['Submitted', 'Accepted', 'Rejected'].includes(amendment.status) && <IcegateReplyCard amendment={amendment} busy={busy} onReply={actions.saveReply} />}

      {amendment.status === 'Rejected' && (
        <Notice tone="warn">ICEGATE rejected this amendment. Correct the amended job (it is open again), make the file again and send it.</Notice>
      )}
      {sent && (
        <Notice tone="muted">
          The amended job is locked now that this amendment was {accepted ? 'accepted' : 'sent'}.{' '}
          {accepted ? 'For more changes make a new amendment.' : 'If ICEGATE rejects it, mark it Rejected to change it again.'}
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {amendment.remarks && <div className="tw:text-muted-foreground">{amendment.remarks}</div>}
      {open && (
        <div className="tw:flex tw:justify-end">
          <Button variant="destructive" disabled={Boolean(busy)} onClick={actions.voidAmendment}>Void amendment</Button>
        </div>
      )}
    </div>
  );
}
