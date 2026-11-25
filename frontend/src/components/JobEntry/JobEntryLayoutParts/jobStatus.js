// The job no ICEGATE names in its mails / replies: the number of the first filing, else the running number of the
// job no (DEL-AI-1002 -> 1002). null when it is the job no itself (iCAFFE jobs).
export function icegateJobNumber(jobData) {
  const jobNo = String(jobData.jobNo || '');
  const numberGroups = jobNo.match(/\d+/g) || [];
  const runningGroup = [...numberGroups].reverse().find((group) => group.length >= 3) || numberGroups[numberGroups.length - 1] || '0';
  const runningNumber = /^\d+$/.test(jobNo) ? parseInt(jobNo, 10) : parseInt(runningGroup, 10);
  const icegateNumber = parseInt(jobData.icegateJobNo, 10) || runningNumber;
  return !icegateNumber || String(icegateNumber) === jobNo ? null : icegateNumber;
}

const isRejected = (jobData) => /rejected/i.test(jobData.icegateStatus || '');
const isAccepted = (jobData) => /accepted/i.test(jobData.icegateStatus || '');

export function filingStatusText(jobData, icegateResult) {
  if (icegateResult) return `${icegateResult.message?.includes('mend') ? 'AMENDED' : 'FILED'} (${icegateResult.uniqueId})`;
  if (jobData.icegateStatus) return `${jobData.icegateStatus.toUpperCase()} (${jobData.icegateUniqueId || ''})`;
  return 'DRAFT';
}

export function filingStatusClass(jobData, icegateResult) {
  if (isRejected(jobData)) return 'tw:text-destructive';
  return icegateResult || jobData.icegateStatus ? 'tw:text-success' : 'tw:text-primary';
}

// The ICEGATE reply button is on every saved job: a job sent before its Unique ID was kept gets it typed in that window.
export function icegateReplyButton(jobData, icegateResult) {
  if (!(jobData.id || jobData.icegateUniqueId || icegateResult?.uniqueId)) return null;
  if (isRejected(jobData)) return { label: 'REJECTED - WHY?', variant: 'danger' };
  if (isAccepted(jobData)) return { label: jobData.beNo ? `BE ${jobData.beNo}` : 'ICEGATE REPLY', variant: 'success' };
  return { label: 'ICEGATE REPLY', variant: 'info' };
}
