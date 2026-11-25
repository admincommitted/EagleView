import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { jobEntryApi } from '../jobEntryApi';
import { serverReply } from './serverReply';
import { pickFile } from './pickFile';
import { extractedInvoiceNo, invoiceFromExtract, isInvoiceOnJob } from './aiInvoice';

// "AI PDF Extract": a supplier invoice PDF is read by AI and ADDED to the job as a new invoice with its items.
export function useAiInvoiceExtract({ jobData, setJobData, setItems }) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  // the dialog may be opened right after a job is opened from the list: the invoices are read when the file is chosen
  const latestJob = useRef(jobData);
  latestJob.current = jobData;

  const readInvoicePdf = async (file) => {
    setIsAiLoading(true);
    const formData = new FormData();
    formData.append('pdf', file);
    try {
      const reply = await serverReply(jobEntryApi.extractInvoicePdf(formData));
      if (!reply.success || !reply.data) {
        toast.error(`AI Extraction Failed: ${reply.error}`, { duration: 5000 });
        return;
      }
      const invoices = latestJob.current.invoices || [];
      const invoiceNo = extractedInvoiceNo(reply.data);
      if (isInvoiceOnJob(invoices, invoiceNo)) {
        toast.error(`Invoice ${invoiceNo} is already on this job - nothing added`, { duration: 6000 });
        return;
      }
      const invSrNo = String(invoices.length + 1);
      const { invoice, items } = invoiceFromExtract(reply.data, invSrNo);
      setJobData((job) => ({ ...job, invoices: [...(job.invoices || []), invoice] }));
      if (items.length) setItems((current) => [...(current || []), ...items]);
      toast.success(`AI read invoice ${invoiceNo || '(no number)'}: ${items.length} item(s) added as invoice ${invSrNo}. Check them in 3. Invoices / 4. Items.`, { duration: 6000 });
    } catch (error) {
      toast.error(`Error calling AI API: ${errorMessage(error)}`, { duration: 5000 });
    } finally {
      setIsAiLoading(false);
    }
  };

  const chooseInvoicePdf = async () => {
    const file = await pickFile('.pdf,application/pdf');
    if (file) readInvoicePdf(file);
  };

  return { isAiLoading, chooseInvoicePdf };
}
