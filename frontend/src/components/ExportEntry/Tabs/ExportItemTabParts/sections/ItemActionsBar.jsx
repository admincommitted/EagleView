import { ArrowUpDown, CheckCircle, Copy, Edit2, RefreshCw, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ActionButtonRow from '../../ExportInvoiceTabParts/sections/ActionButtonRow';

export default function ItemActionsBar({ ctx }) {
  const {
    editing, formData, saveItem, modifyItem, deleteItem, deleteMultipleItems, clearForm, arrangeSerials, duplicateItem, validateJob,
  } = ctx;
  const buttons = [
    {
      label: 'Save', icon: Save, variant: 'success', onClick: saveItem,
      title: editing ? 'An item is open: Save updates it (as Modify). For a new item press Add Item first.' : 'Add this item',
    },
    { label: 'Modify', icon: Edit2, variant: 'warning', onClick: modifyItem },
    { label: 'Delete', icon: X, variant: 'destructive', onClick: deleteItem },
    { label: 'Delete Multiple Item', icon: X, variant: 'destructive', onClick: deleteMultipleItems },
    { label: 'Clear', icon: RefreshCw, onClick: () => clearForm(formData.invSr) },
    { label: 'Arrange Item Serial No', icon: ArrowUpDown, onClick: arrangeSerials },
    { label: 'Duplicate Item', icon: Copy, variant: 'success', onClick: duplicateItem },
    { label: 'Validate Job', icon: CheckCircle, variant: 'warning', onClick: validateJob },
  ];
  return (
    <ActionButtonRow buttons={buttons} className="tw:sticky tw:bottom-0 tw:z-50 tw:border-t tw:border-border tw:bg-page">
      <span className={cn('tw:mr-1 tw:text-[11px] tw:font-bold', editing ? 'tw:text-warning' : 'tw:text-success')}>
        {editing ? `Editing item ${formData.itemSr || ''} - Save / Modify keep the changes (Add Item for a new one)` : 'New item - Save adds it'}
      </span>
    </ActionButtonRow>
  );
}
