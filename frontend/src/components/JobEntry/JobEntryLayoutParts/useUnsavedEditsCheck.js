import { askUnsavedEdits } from '../../common/askConfirm';
import { useJobContext } from '../JobContext';

// Resolves true when the operator goes back to put the typed (not yet modified) rows in first.
export function useUnsavedEditsCheck() {
  const { pendingEditsMessage } = useJobContext();
  return async (what) => {
    const message = pendingEditsMessage();
    if (!message) return false;
    return !(await askUnsavedEdits(message, what, 'Go back to MODIFY'));
  };
}
