import askConfirm from '@/components/common/askConfirm';
import { countItemsOfInvoice, headerTotals, itemsAfterInvoiceDelete, repricedItems } from '../invoiceRules';

// the invoices of the job; the SB Header's FOB and invoice value follow them, and so do the items
export default function useInvoiceList({ exportData, setExportData, items, setItems, remapItemRows }) {
  const invoices = exportData.invoices || [];

  const setInvoices = (nextInvoices) => {
    setExportData((previous) => {
      const updated = typeof nextInvoices === 'function' ? nextInvoices(previous.invoices || []) : nextInvoices;
      return { ...previous, invoices: updated, ...headerTotals(updated) };
    });
  };

  const repriceItems = (invoiceList) => {
    if (!setItems) return;
    setItems((previous) => repricedItems(previous, invoiceList));
  };

  const removeInvoices = (ids, deleteItems) => {
    const goneSerials = invoices.map((invoice, index) => (ids.includes(invoice.id) ? index + 1 : null)).filter(Boolean);
    setInvoices(invoices.filter((invoice) => !ids.includes(invoice.id)));
    if (!setItems) return;
    const nextItems = itemsAfterInvoiceDelete(items || [], goneSerials, deleteItems);
    setItems(nextItems);
    remapItemRows?.(items, nextItems, goneSerials);
  };

  // asks before deleting and, when the invoices have items, whether the items go too. Resolves true = deleted
  const askDelete = async (ids, label) => {
    const itemCount = invoices.reduce((sum, invoice, index) => sum + (ids.includes(invoice.id) ? countItemsOfInvoice(items || [], index + 1) : 0), 0);
    if (!(await askConfirm({ title: 'Delete invoice', message: `Delete ${label}?`, okLabel: 'Delete', cancelLabel: 'Keep', tone: 'danger' }))) return false;
    const deleteItems = itemCount > 0 && await askConfirm({
      title: 'Items of the invoice',
      message: `${itemCount} item(s) belong to ${label}.`,
      note: 'Delete the items: they are deleted with the invoice.\nKeep them: they move to invoice 1.',
      okLabel: 'Delete the items',
      cancelLabel: 'Keep them',
    });
    removeInvoices(ids, deleteItems);
    return true;
  };

  return { invoices, setInvoices, repriceItems, askDelete, items };
}
