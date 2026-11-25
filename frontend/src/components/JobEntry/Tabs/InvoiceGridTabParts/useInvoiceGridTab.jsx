import { useEffect, useRef } from 'react';
import { useJobContext } from '../../JobContext';
import useInvoiceList from './hooks/useInvoiceList';
import useInvoiceForm from './hooks/useInvoiceForm';
import useExchangeRates from './hooks/useExchangeRates';
import useCumulativeCharges from './hooks/useCumulativeCharges';
import useInvoiceEditing from './hooks/useInvoiceEditing';
import useInvoiceListTools from './hooks/useInvoiceListTools';
import useInvoiceExcel from './hooks/useInvoiceExcel';

export default function useInvoiceGridTab({ onSave }) {
  const { jobData, setJobData, masters, registerPendingEdits } = useJobContext();
  // the grid's paste (rate rows for pasted currencies) and Ctrl+D (the Duplicate prompt) call handlers built below it
  const pasteRates = useRef(null);
  const duplicateInvoice = useRef(null);

  const { commitInvoices, ...invoiceList } = useInvoiceList({ onSave, pasteRates, duplicateInvoice });
  const { invoices, selectedRowId, setSelectedRowId, checkedIds, toggleCheck } = invoiceList;
  const invoiceForm = useInvoiceForm({ invoices, selectedRowId });
  const { invoiceFormData, setInvoiceFormData } = invoiceForm;
  const { addMissingRates, ...exchangeRates } = useExchangeRates({ invoices, invoiceFormData, onSave });
  const cumulativeCharges = useCumulativeCharges({ invoices, commitInvoices });
  const editing = useInvoiceEditing({
    invoices, selectedRowId, setSelectedRowId, checkedIds, toggleCheck, invoiceFormData, setInvoiceFormData, commitInvoices, addMissingRates,
  });
  const listTools = useInvoiceListTools({ invoices, commitInvoices, addMissingRates });
  const excel = useInvoiceExcel({ invoices, commitInvoices, addMissingRates });

  useEffect(() => {
    pasteRates.current = addMissingRates;
    duplicateInvoice.current = editing.handleDuplicateInvoice;
  });

  return {
    jobData, setJobData, masters, registerPendingEdits,
    ...invoiceList, ...invoiceForm, ...exchangeRates, ...cumulativeCharges, ...editing, ...listTools, ...excel,
  };
}
