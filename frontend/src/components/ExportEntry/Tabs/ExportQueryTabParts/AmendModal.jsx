import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Field, Modal, SelectBox, Textarea } from '@/components/ui';
import { exportEntryApi } from '../../exportEntryApi';

const AMENDMENT_TYPES = [
  { value: 'General', label: 'SB details (header)' },
  { value: 'Invoice', label: 'Invoice' },
  { value: 'Item', label: 'Item' },
  { value: 'ShortShip', label: 'Short shipment' },
  { value: 'Other', label: 'Other' },
];

// Amend: only a filed SB; the reason goes to the job timeline and the job opens for the change.
// Kept mounted while closed so the type and an unsent reason stay for the next opening.
export default function AmendModal({ job, onClose, onAmend }) {
  const [amendmentType, setAmendmentType] = useState('General');
  const [reason, setReason] = useState('');

  const submit = async () => {
    const amendReason = reason.trim();
    if (!amendReason) { toast.error('Enter the reason for the amendment'); return; }
    try {
      await exportEntryApi.queryAddTimelineEntry({ jobId: job.id, module: 'EXPORT', eventType: 'REMARK', message: `AMENDMENT (${amendmentType}): ${amendReason}` });
    } catch {
      // the remark is not essential
    }
    onClose();
    onAmend(job.id, { amendmentType, amendReason, jobNo: job.jobNo });
    setReason('');
  };

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="default" onClick={submit}>Open for amendment</Button>
    </>
  );

  return (
    <Modal open={Boolean(job)} title={`Amend Shipping Bill - ${job?.jobNo || ''}`} width={440} onClose={onClose} footer={footer}>
      <Field label="What changes" layout="col">
        <SelectBox className="tw:w-full" options={AMENDMENT_TYPES} value={amendmentType} onValueChange={setAmendmentType} />
      </Field>
      <Field label="Reason" layout="col">
        <Textarea rows={3} maxLength={200} placeholder="e.g. Gross weight corrected as per airline" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="tw:rounded-sm tw:border tw:border-warning/40 tw:bg-warning/10 tw:px-2 tw:py-1.5 tw:text-[11px] tw:text-warning">
        The job opens for the change; "Send to ICEGATE" then sends it as an amendment. ICEGATE's advisory says JSON filing of amendments is still being built, so check the acknowledgement - file it on the ICEGATE portal if it is not accepted.
      </div>
    </Modal>
  );
}
