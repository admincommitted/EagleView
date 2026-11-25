import { useState } from 'react';
import toast from 'react-hot-toast';
import { askText } from '../../common/askConfirm';

const FILED_STATUSES = ['Filed', 'Accepted', 'Amended'];

// A BE that went to ICEGATE is locked so saves do not overwrite the filed data. "Unlock for amendment" (the reason
// goes to the job log) opens it again until the next filing.
export function useFiledLock(jobData) {
  const [amendMode, setAmendMode] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const isFiled = FILED_STATUSES.includes(String(jobData.icegateStatus || ''));
  const isFiledLocked = isFiled && !jobData.amendUnlockedAt && !amendMode;

  const unlockForAmendment = async () => {
    const reason = await askText({
      title: 'Unlock for amendment',
      message: `This BE was ${jobData.icegateStatus} on ICEGATE (${jobData.icegateUniqueId || ''}).\nUnlock it for an amendment? The copy sent to ICEGATE stays on the job.`,
      label: 'Reason (goes to the job log)',
      required: false,
      okLabel: 'Unlock',
    });
    if (reason === null) return;
    setAmendReason(String(reason).trim());
    setAmendMode(true);
    toast('Unlocked for amendment - changes are saved with Save / Modify; file the amendment from Reports & Submission', { icon: '🔓', duration: 6000 });
  };

  const endAmendMode = () => {
    setAmendMode(false);
    setAmendReason('');
  };

  return { isFiled, isFiledLocked, amendMode, amendReason, unlockForAmendment, endAmendMode };
}
