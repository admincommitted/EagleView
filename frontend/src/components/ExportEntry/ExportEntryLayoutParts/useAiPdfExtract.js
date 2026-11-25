import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import askConfirm from '../../common/askConfirm';
import { pickFile } from '../../JobEntry/JobEntryLayoutParts/pickFile';
import { serverReply } from '../../JobEntry/JobEntryLayoutParts/serverReply';
import { exportEntryApi } from '../exportEntryApi';
import { invoiceFromExtract } from './aiExportInvoice';

// fired by "Import PDF" in the Items tab
const OPEN_AI_PDF_EVENT = 'export-open-ai-pdf';

// "AI PDF Extract": the invoice PDF is read with the export prompt and REPLACES the invoices and items of the job
// (asked first when the job has some).
export function useAiPdfExtract({ exportData, items, setExportData, setItems }) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  // the dialog may be opened right after a job is opened from the list: the job is read when the file is chosen
  const latestJob = useRef({ exportData, items });
  latestJob.current = { exportData, items };

  const readInvoicePdf = async (file) => {
    const { exportData: job, items: jobItems } = latestJob.current;
    if ((job.invoices || []).length || (jobItems || []).length) {
      const replace = await askConfirm({ title: 'Replace invoices and items?', message: 'Replace the invoices and items of this job with the ones read from the PDF?', okLabel: 'Replace them', cancelLabel: 'Keep them' });
      if (!replace) return;
    }
    setIsAiLoading(true);
    const toastId = toast.loading('Reading the PDF with AI...');
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('module', 'EXPORT');
    try {
      const reply = await serverReply(exportEntryApi.extractInvoicePdf(formData));
      if (!reply.success || !reply.data) {
        toast.error(`AI could not read the PDF: ${reply.error || 'no data'}`, { id: toastId });
        return;
      }
      const { invoice, items: newItems, buyerName } = invoiceFromExtract(reply.data);
      setExportData((current) => ({ ...current, invoices: [invoice], ...(buyerName && !current.consigneeName ? { consigneeName: buyerName } : {}) }));
      setItems(newItems);
      toast.success(`Read from PDF: invoice ${invoice.no || '(no number)'} with ${newItems.length} item(s) - check the Invoices and Items tabs (rate, scheme, end use)`, { id: toastId, duration: 7000 });
    } catch (error) {
      toast.error(`AI service not reached: ${errorMessage(error)}`, { id: toastId });
    } finally {
      setIsAiLoading(false);
    }
  };

  const chooseInvoicePdf = async () => {
    const file = await pickFile('application/pdf');
    if (file) readInvoicePdf(file);
  };

  const latestChoose = useRef(chooseInvoicePdf);
  latestChoose.current = chooseInvoicePdf;
  useEffect(() => {
    const open = () => latestChoose.current();
    window.addEventListener(OPEN_AI_PDF_EVENT, open);
    return () => window.removeEventListener(OPEN_AI_PDF_EVENT, open);
  }, []);

  return { isAiLoading, chooseInvoicePdf };
}
