import { askUnsavedEdits } from '../../common/askConfirm';
import { useExportContext } from '../ExportContext';

// The Items / Invoices forms reach the job only on Save / Modify. Resolves true when the operator goes back to put the
// typed values in first.
export function useUnsavedEditsCheck() {
  const { pendingEditsMessage } = useExportContext();
  return async (what) => {
    const message = pendingEditsMessage();
    if (!message) return false;
    return !(await askUnsavedEdits(message, what, 'Go back to SAVE / MODIFY'));
  };
}
