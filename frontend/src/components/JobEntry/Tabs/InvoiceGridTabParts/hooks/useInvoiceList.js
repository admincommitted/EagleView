import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useGridFeatures } from '@/hooks/useGridFeatures';
import { useJobContext } from '../../../JobContext';
import { pastedInvoice, splitPastedInvoices } from './invoiceData';

const NO_INVOICES = [];
const SAVE_DELAY_MS = 50;

// pasteRates / duplicateInvoice are refs to the latest handlers of the rate and editing hooks (built after this one)
export default function useInvoiceList({ onSave, pasteRates, duplicateInvoice }) {
  const { jobData, setJobData, setItems } = useJobContext();

  const takePastedInvoices = (pastedInvoices, currentInvoices) => {
    const { accepted, duplicates } = splitPastedInvoices(pastedInvoices, currentInvoices);
    if (duplicates.length) toast.error(`Not pasted (already on this job): ${duplicates.join(', ')}`);
    if (accepted.length) {
      toast.success(`${accepted.length} invoice(s) pasted - check them and Save the job`);
      if (pasteRates.current) setTimeout(() => pasteRates.current([...currentInvoices, ...accepted]), 0);
    }
    return accepted;
  };

  const {
    data: invoices, setData: setInvoices, selectedRowId, setSelectedRowId, checkedIds, toggleCheck, checkAll,
  } = useGridFeatures({
    initialData: jobData.invoices?.length > 0 ? jobData.invoices : NO_INVOICES,
    onPasteRowMapping: pastedInvoice,
    onPasteRows: takePastedInvoices,
    onDuplicate: () => duplicateInvoice.current?.(),
  });

  // the invoice list last exchanged with jobData, so each side only takes the other's changes
  const syncedInvoices = useRef(invoices);

  // a loaded job or a save result: rows come back with new ids, the selection follows the Sr No
  useEffect(() => {
    if (!jobData.invoices || jobData.invoices === syncedInvoices.current) return;
    const selectedIndex = invoices.findIndex((invoice) => invoice.id === selectedRowId);
    setInvoices(jobData.invoices);
    syncedInvoices.current = jobData.invoices;
    if (selectedIndex !== -1) setSelectedRowId(jobData.invoices[selectedIndex] ? jobData.invoices[selectedIndex].id : null);
  }, [jobData.invoices, invoices, selectedRowId, setInvoices, setSelectedRowId]);

  useEffect(() => {
    if (invoices === syncedInvoices.current) return;
    setJobData((previous) => ({ ...previous, invoices }));
    syncedInvoices.current = invoices;
  }, [invoices, setJobData]);

  // extraFields: more job fields that go in the same save (rate rows, e-Sanchit docs read from a file ...)
  const commitInvoices = (newInvoices, newItems, extraFields) => {
    setInvoices(newInvoices);
    if (newItems && setItems) setItems(newItems);
    if (onSave) {
      setTimeout(() => onSave({ invoices: newInvoices, ...(newItems ? { items: newItems } : {}), ...extraFields, _notify: 'Invoice changes put in' }), SAVE_DELAY_MS);
    }
  };

  return { invoices, selectedRowId, setSelectedRowId, checkedIds, toggleCheck, checkAll, commitInvoices };
}
