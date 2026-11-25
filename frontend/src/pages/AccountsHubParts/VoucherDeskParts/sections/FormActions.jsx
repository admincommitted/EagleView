import { Pencil, RotateCcw, Save, X } from 'lucide-react';
import { ActionBar, Btn } from '../../ui';

// Save / Save changes, the desk's Modify / Delete / Print (new vouchers only) and Clear / Cancel
export function FormActions({ editId, saving, onSave, onClear, actions, message, saveLabel = 'Save' }) {
  return (
    <ActionBar note={message}>
      <Btn kind="save" onClick={onSave} disabled={saving}>
        {editId ? <Pencil size={13} /> : <Save size={13} />} {saving ? 'Saving' : editId ? 'Save changes' : saveLabel}
      </Btn>
      {!editId && actions}
      <Btn kind="clear" onClick={onClear}>{editId ? <X size={13} /> : <RotateCcw size={13} />} {editId ? 'Cancel' : 'Clear'}</Btn>
    </ActionBar>
  );
}
