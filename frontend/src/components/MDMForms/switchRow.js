// Switches a master row off / on instead of deleting it: the row stays in the master as inactive, so nothing that
// points at it breaks, and it can be switched on again.
//   const done = await switchRow('bonds', row, 'bond code WA');   // true = changed
import askConfirm from '../common/askConfirm';
import { errorMessage } from '@/services/axiosInstance';
import { masterRecordsApi } from './masterKit/masterRecordsApi';

const isOn = (row) => row.isActive === true || row.isActive === 1;

const showNotChanged = (message) => askConfirm({ title: 'Not changed', message, okLabel: 'OK', cancelLabel: 'Close', tone: 'danger' });

export default async function switchRow(resource, row, what) {
  if (!row?.id) return false;
  const switchingOn = !isOn(row);
  if (!switchingOn) {
    const confirmed = await askConfirm({
      title: 'Switch off this row?',
      message: String(what || 'This row').trim(),
      note: 'It is not deleted. It stays in this master as inactive and can be switched on again.',
      okLabel: 'Switch off',
      cancelLabel: 'Keep it on',
    });
    if (!confirmed) return false;
  }
  try {
    await masterRecordsApi.setActive(resource, row.id, switchingOn);
    return true;
  } catch (error) {
    await showNotChanged(errorMessage(error));
    return false;
  }
}

//   if (!(await askDelete('Delete this vessel?'))) return;     // a real delete: red button, "cannot be undone"
//   if (!(await askYes('Fetch the rates?'))) return;           // any other question
export const askDelete = (message) => askConfirm({
  title: 'Delete for ever?', message, note: 'This cannot be undone. The row is removed from the master.', okLabel: 'Delete', cancelLabel: 'Keep it', tone: 'danger',
});
export const askYes = (message, okLabel) => askConfirm({ title: 'Please confirm', message, okLabel: okLabel || 'Go ahead', cancelLabel: 'Cancel' });
export { askConfirm };
