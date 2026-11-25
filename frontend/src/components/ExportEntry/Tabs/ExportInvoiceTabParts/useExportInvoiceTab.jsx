import { useExportContext } from '../../ExportContext';
import useInvoiceMasters from './hooks/useInvoiceMasters';
import useInvoiceList from './hooks/useInvoiceList';
import useInvoiceForm from './hooks/useInvoiceForm';
import useInvoiceCharges from './hooks/useInvoiceCharges';
import useInvoiceActions from './hooks/useInvoiceActions';

export default function useExportInvoiceTab() {
  const { exportData, setExportData, items, setItems, registerPendingEdits, remapItemRows } = useExportContext();
  const masters = useInvoiceMasters();
  const invoiceList = useInvoiceList({ exportData, setExportData, items, setItems, remapItemRows });
  const invoiceForm = useInvoiceForm({ exportData, registerPendingEdits });
  const charges = useInvoiceCharges({ ...invoiceForm, currencies: masters.currencies });
  const ctx = { exportData, ...masters, ...invoiceList, ...invoiceForm, ...charges };
  const actions = useInvoiceActions(ctx);
  return { ...ctx, ...actions };
}
