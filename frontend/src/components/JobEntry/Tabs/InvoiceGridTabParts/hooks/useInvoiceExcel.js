import toast from 'react-hot-toast';
import askConfirm from '@/components/common/askConfirm';
import { useJobContext } from '../../../JobContext';
import { downloadInvoiceSample, fillRatesFromTariff, mergeJobWorkbook, readJobWorkbook, recalcDuty } from '../../jobExcel';

const MAX_NOTES_SHOWN = 8;
const NOTES_TOAST_MS = 9000;

// highest Item Sr No per Inv Sr No, so items read from the file continue the numbering
const lastItemSerials = (items) => {
  const lastSerials = {};
  items.forEach((item) => {
    const invoiceSerial = String(item.invSrNo || '1');
    lastSerials[invoiceSerial] = Math.max(lastSerials[invoiceSerial] || 0, parseInt(item.itemSrNo, 10) || 0);
  });
  return lastSerials;
};

const isEmptyRead = (read) => !read.invoices.length && !read.items.length && !read.containers.length && !read.jobDocs.length && !read.itemsOnJob;

const notesText = (notes) => notes.slice(0, MAX_NOTES_SHOWN).join('\n') + (notes.length > MAX_NOTES_SHOWN ? `\n...and ${notes.length - MAX_NOTES_SHOWN} more` : '');

// the whole job workbook (Invoices, Items, Containers, SW sheets, supporting docs, SVB / licence / anti-dumping),
// our template or the other ERP's export; invoice rows are matched on Invoice No (updated) or added
export default function useInvoiceExcel({ invoices, commitInvoices, addMissingRates }) {
  const { jobData, setJobData, items, esanchitDocs, setEsanchitDocs } = useJobContext();
  const jobItems = items || [];

  const readWorkbook = async (file) => {
    const read = readJobWorkbook(await file.arrayBuffer(), invoices, lastItemSerials(jobItems), jobItems);
    if (isEmptyRead(read)) { toast.error('No invoice rows found (sheet "Invoices", column "Invoice No")'); return; }
    const replaceItems = read.items.length > 0 && jobItems.length > 0 && await askConfirm({
      title: 'The job already has items',
      message: `The file also has ${read.items.length} item(s) and this job already has ${jobItems.length}.`,
      okLabel: 'Replace with the file\'s items',
      cancelLabel: 'Add the file\'s items after them',
    });
    const merged = mergeJobWorkbook(read, { invoices, items: jobItems, jobData, esanchitDocs, replaceItems });
    if (read.jobDocs.length && setEsanchitDocs) setEsanchitDocs(merged.esanchitDocs);
    const rates = addMissingRates(merged.invoices);
    const notes = [...merged.notes];
    const jobPatch = { ...merged.jobDataPatch };
    let newItems = read.items.length ? merged.items : null;
    if (newItems) {
      // blank BCD / IGST rates come from the Tariff master, then the duty amounts and totals as the Item tab's Re-Calculate
      const tariff = await fillRatesFromTariff(newItems);
      const duty = recalcDuty(tariff.items, merged.invoices, { ...jobData, ...jobPatch, _exchangeRates: rates });
      newItems = duty.items;
      Object.assign(jobPatch, duty.totals);
      if (tariff.notFound.length) notes.push(`RITC not in Tariff master (type the BCD / IGST rate): ${tariff.notFound.join(', ')}`);
      if (duty.noRate) notes.push(`${duty.noRate} item(s): exchange rate missing for the invoice currency - use "Update Exchange Rate" then Re-Calculate`);
      else notes.push(`Duty estimate ₹${duty.duty.toFixed(2)} on CIF ₹${duty.cif.toFixed(2)}${tariff.filled ? ` (rates from Tariff master for ${tariff.filled} item(s))` : ''}`);
    }
    if (Object.keys(jobPatch).length) setJobData((previous) => ({ ...previous, ...jobPatch }));
    // SW rows for the job's own items (no item rows in the file) are not re-rated or re-calculated
    commitInvoices(merged.invoices, newItems || (read.itemsOnJob ? merged.items : null), {
      ...jobPatch, _exchangeRates: rates, ...(read.jobDocs.length ? { esanchitDocs: merged.esanchitDocs } : {}),
    });
    toast.success(merged.summary);
    if (notes.length) toast(notesText(notes), { duration: NOTES_TOAST_MS });
  };

  const handleReadExcel = async (event) => {
    const file = event.target.files[0];
    event.target.value = null;
    if (!file) return;
    try {
      await readWorkbook(file);
    } catch (error) {
      toast.error(`Error reading Excel: ${error.message}`);
    }
  };

  return { handleReadExcel, handleDownloadSample: downloadInvoiceSample };
}
