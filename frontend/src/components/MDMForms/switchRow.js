// Switch a master row off / on instead of deleting it (22-Nov-2026).
// The row stays in the master as INACTIVE and can be switched on again; nothing that points at it is broken.
//   const done = await switchRow('bonds', row, 'bond code WA');   // true = changed
import askConfirm from '../common/askConfirm';

export default async function switchRow(slug, row, what) {
  if (!row || !row.id) return false;
  const on = !(row.isActive === true || row.isActive === 1);
  if (!on) {
    const go = await askConfirm({ title: 'Switch off this row?', message: String(what || 'This row').trim(), note: 'It is not deleted. It stays in this master as inactive and can be switched on again.', okLabel: 'Switch off', cancelLabel: 'Keep it on' });
    if (!go) return false;
  }
  try {
    const res = await fetch(`/api/masters/${slug}/${row.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: on }) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); await askConfirm({ title: 'Not changed', message: err.error || err.message || ('HTTP ' + res.status), okLabel: 'OK', cancelLabel: 'Close', tone: 'danger' }); return false; }
    return true;
  } catch (e) { await askConfirm({ title: 'Not changed', message: e.message, okLabel: 'OK', cancelLabel: 'Close', tone: 'danger' }); return false; }
}

// The program's own question window in place of the browser's "localhost says ... OK / Cancel" box (22-Nov-2026).
//   if (!(await askDelete('Delete this vessel?'))) return;     // for a real delete: red button, "cannot be undone"
//   if (!(await askYes('Fetch the rates?'))) return;           // any other question
export const askDelete = (message) => askConfirm({ title: 'Delete for ever?', message, note: 'This cannot be undone. The row is removed from the master.', okLabel: 'Delete', cancelLabel: 'Keep it', tone: 'danger' });
export const askYes = (message, okLabel) => askConfirm({ title: 'Please confirm', message, okLabel: okLabel || 'Go ahead', cancelLabel: 'Cancel' });
export { askConfirm };
