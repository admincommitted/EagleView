import { useState } from 'react';
import askConfirm from '@/components/common/askConfirm';
import useUnsavedEdits from '../../ExportInvoiceTabParts/hooks/useUnsavedEdits';
import { BLANK_ITEM_FORM } from '../itemForm';

// the item in the form (selectedRowId = the item of the list it was opened from, null for a new item)
export default function useItemForm({ registerPendingEdits }) {
  const [formData, setFormData] = useState(BLANK_ITEM_FORM);
  const [selectedRowId, setSelectedRowId] = useState(null);
  const handleFormChange = (field, value) => setFormData((previous) => ({ ...previous, [field]: value }));

  const edits = useUnsavedEdits({
    current: formData,
    area: 'items',
    registerPendingEdits,
    describe: (form) => (selectedRowId != null
      ? `Item ${form.itemSr || ''} of invoice ${form.invSr || 1} has changes that were not put in with MODIFY - they are not part of the SB yet.`
      : 'A new item is typed in the Items form but was not added with SAVE - it is not part of the SB yet.'),
  });

  const keepInBase = (patch) => {
    if (edits.baseRef.current) edits.baseRef.current = { ...edits.baseRef.current, ...patch };
  };

  // asks before the changes in the form are dropped. Resolves true = go ahead
  const leaveFormOk = async (what) => {
    if (!edits.isEdited()) return true;
    const action = selectedRowId != null ? 'MODIFY' : 'SAVE';
    return askConfirm({
      title: 'Changes not put in',
      message: selectedRowId != null
        ? `Item ${formData.itemSr || ''} of invoice ${formData.invSr || 1} has changes that were not put in with MODIFY.`
        : 'The new item in the form was not added with SAVE.',
      note: `Drop the changes: ${what} - what was typed here is lost.\nStay here: press ${action} first.`,
      okLabel: 'Drop the changes',
      cancelLabel: 'Stay here',
    });
  };

  return {
    formData, setFormData, handleFormChange, selectedRowId, setSelectedRowId,
    markFormTouched: edits.markTouched, formEdited: edits.isEdited, clearFormEdits: edits.clearEdits, keepInBase, leaveFormOk,
  };
}
