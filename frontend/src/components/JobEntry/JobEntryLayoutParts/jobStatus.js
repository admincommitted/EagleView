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
