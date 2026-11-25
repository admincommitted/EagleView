import askConfirm from '../../common/askConfirm';

function jobOnScreenNote(exportData, items) {
  if (exportData.id) return `Job ${exportData.jobNo || ''} on the screen is not changed by this. Changes on it that are not saved are dropped.`;
  if (exportData.shipperName || exportData.consigneeName || (exportData.invoices || []).length || (items || []).length) return 'The job on the screen is not saved - it will be cleared.';
  return '';
}

// New Job, Read Flat File / Import from File and Create Job from Excel start a clean new job (a file read into the open
// job kept its id and job no, so Save Draft overwrote that job). They ask first when a job is on the screen.
export async function confirmClearScreen(question, exportData, items) {
  const note = jobOnScreenNote(exportData, items);
  if (!note) return true;
  return askConfirm({ title: question, message: note, okLabel: 'Yes, go ahead', cancelLabel: 'Keep the screen as it is' });
}
