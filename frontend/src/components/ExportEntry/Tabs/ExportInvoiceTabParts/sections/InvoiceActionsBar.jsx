import { ArrowUpDown, Copy, FileText, Pencil, RefreshCw, RotateCcw, Save, X } from 'lucide-react';
import ActionButtonRow from './ActionButtonRow';

export default function InvoiceActionsBar({ ctx }) {
  const {
    selectedId, resetForm, saveInvoice, modifyInvoice, deleteInvoice, deleteAllInvoices, openOtherDetails, duplicateInvoice, arrangeSerials, updateExchangeRate,
  } = ctx;
  const buttons = [
    {
      label: 'Save', icon: Save, variant: 'success', onClick: saveInvoice,
      title: selectedId ? 'An invoice is open - Save updates it (as Modify). For a new invoice press Clear first.' : 'Add this invoice',
    },
    { label: 'Modify', icon: Pencil, variant: 'warning', onClick: modifyInvoice },
    { label: 'Delete', icon: X, variant: 'destructive', onClick: deleteInvoice },
    { label: 'Delete All Invoices', icon: X, variant: 'destructive', onClick: deleteAllInvoices },
    { label: 'Other Details', icon: FileText, onClick: openOtherDetails },
    { label: 'Clear', icon: RotateCcw, onClick: resetForm },
    { label: 'Duplicate Invoice', icon: Copy, variant: 'success', onClick: duplicateInvoice },
    { label: 'Arrange Invoice Serial No', icon: ArrowUpDown, onClick: arrangeSerials },
    { label: 'Update Exchange Rate', icon: RefreshCw, variant: 'warning', onClick: updateExchangeRate },
  ];
  return <ActionButtonRow buttons={buttons} className="tw:rounded-md tw:border tw:border-border" />;
}
