import toast from 'react-hot-toast';
import askConfirm, { askText } from '@/components/common/askConfirm';
import { useJobContext } from '../../../JobContext';
import { jobEntryApi } from '../../../jobEntryApi';
import { computeItemDuty } from '../../ItemGridTabParts/helpers';
import { copyWithoutIds, indexOfInvoiceNumber, invoiceNumberOf, invoiceSerialOf, isoFromDayFirst, remapItems, upperTrim } from './invoiceData';

const COPIED_ITEM_ID_STEP = 1000;

const dateOrderKey = (invoice) => `${isoFromDayFirst(String(invoice.invDate || invoice.invoiceDate || ''))}|${upperTrim(invoiceNumberOf(invoice))}`;

const igstDataOf = (item) => {
  if (typeof item.igstData !== 'string') return item.igstData;
  try {
    return JSON.parse(item.igstData);
  } catch {
    return null;
  }
};

const DUTY_TOTAL_FIELDS = [
  ['calculatedAssessableValue', 'av'], ['calculatedBCD', 'bcd'], ['calculatedSWS', 'sws'], ['calculatedIGST', 'igst'], ['calculatedTotalDuty', 'total'],
];

// arrange, copy from another job, re-calculate duty: actions over the whole invoice list
export default function useInvoiceListTools({ invoices, commitInvoices, addMissingRates }) {
  const { jobData, items } = useJobContext();

  // invoice-date order (then Invoice No); the items move with their invoices
  const handleArrangeSerial = async (event) => {
    event?.preventDefault();
    if (invoices.length < 2) { toast('Only one invoice - nothing to arrange'); return; }
    const sorted = [...invoices].sort((first, second) => dateOrderKey(first).localeCompare(dateOrderKey(second)));
    if (sorted.every((invoice, index) => invoice === invoices[index])) { toast('Invoices are already in date order'); return; }
    const confirmed = await askConfirm({
      title: 'Re-number the invoices in invoice-date order?',
      message: sorted.map((invoice, index) => `${index + 1}. ${invoiceNumberOf(invoice)}  ${invoice.invDate || ''}`).join('\n'),
      note: 'Their items move with them.',
      okLabel: 'Re-number',
      cancelLabel: 'Leave as they are',
    });
    if (!confirmed) return;
    commitInvoices(sorted, remapItems(items, invoices, sorted, { dropMissing: false }));
    toast.success('Invoice Sr No re-arranged');
  };

  // invoices whose Invoice No is not on this job yet; their items can come along
  const handleCopyFromOtherJob = async () => {
    const jobNo = await askText({
      title: 'Copy invoices from another job', label: 'Job No', placeholder: 'e.g. NDL/AI/200005 or 8564', okLabel: 'Find the job',
      note: 'Invoices whose Invoice No is already on this job are left out.',
    });
    if (!jobNo) return;
    try {
      const response = await jobEntryApi.jobByNumber(jobNo);
      const otherJob = response.success && response.data;
      const sourceInvoices = (otherJob && otherJob.invoices) || [];
      if (!sourceInvoices.length) { toast.error('No invoices found in that job.'); return; }
      if (jobData?.id && otherJob.id === jobData.id) { toast.error('That is this same job'); return; }
      const newToThisJob = sourceInvoices.filter((invoice) => indexOfInvoiceNumber(invoices, invoiceNumberOf(invoice)) === -1);
      const skipped = sourceInvoices.length - newToThisJob.length;
      if (!newToThisJob.length) { toast.error('All invoices of that job are already on this job (same Invoice No)'); return; }
      const itemCount = newToThisJob.reduce((sum, invoice) => sum + (invoice.items || []).length, 0);
      const withItems = itemCount > 0 && await askConfirm({
        title: 'Copy the items too?',
        message: `Copy ${newToThisJob.length} invoice(s) from job ${jobNo}${skipped ? ` (${skipped} skipped - Invoice No already here)` : ''}.`,
        note: `Copy the items: their ${itemCount} item(s) come along.\nInvoices only: the invoices are copied with no items.`,
        okLabel: 'Copy the items',
        cancelLabel: 'Invoices only',
      });
      const copiedAt = Date.now();
      const added = newToThisJob.map((invoice, position) => ({ ...copyWithoutIds(invoice), id: copiedAt + position }));
      const newInvoices = [...invoices, ...added];
      let newItems = null;
      if (withItems) {
        newItems = [...(items || [])];
        newToThisJob.forEach((invoice, invoicePosition) => (invoice.items || []).forEach((item, itemPosition) => newItems.push({
          ...copyWithoutIds(item),
          id: Date.now() + COPIED_ITEM_ID_STEP + invoicePosition * COPIED_ITEM_ID_STEP + itemPosition,
          invSrNo: String(invoices.length + invoicePosition + 1),
          invNo: invoiceNumberOf(invoice),
        })));
      }
      commitInvoices(newInvoices, newItems, { _exchangeRates: addMissingRates(newInvoices) });
      toast.success(`${added.length} invoice(s) copied${withItems ? ' with items' : ''}${skipped ? `, ${skipped} skipped` : ''}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch job invoices.');
    }
  };

  // per invoice (its items by Inv Sr No), on the assessable value in INR
  const handleRecalculateDutyAllInv = () => {
    const jobItems = items || [];
    if (!jobItems.length) { toast.error('No items found to recalculate duty.'); return; }
    let itemsWithoutRate = 0;
    const calculated = jobItems.map((item) => {
      const duty = computeItemDuty(item, invoices, jobData);
      if (!duty.rateFound) { itemsWithoutRate += 1; return { item }; }
      const igstData = igstDataOf(item);
      return {
        duty,
        item: {
          ...item, assessableValueInr: duty.av.toFixed(2), bcdAmount: duty.bcd.toFixed(2), swsAmount: duty.sws.toFixed(2),
          igstData: igstData ? { ...igstData, amount: duty.igst.toFixed(2) } : igstData, totalDuty: duty.total.toFixed(2),
        },
      };
    });
    const newInvoices = invoices.map((invoice, index) => {
      const dutiesOfInvoice = calculated.filter(({ item, duty }) => duty && invoiceSerialOf(item) === String(index + 1)).map(({ duty }) => duty);
      const totals = DUTY_TOTAL_FIELDS.map(([field, dutyKey]) => [field, dutiesOfInvoice.reduce((sum, duty) => sum + duty[dutyKey], 0).toFixed(2)]);
      return { ...invoice, ...Object.fromEntries(totals) };
    });
    commitInvoices(newInvoices, calculated.map(({ item }) => item));
    const totalDuty = newInvoices.reduce((sum, invoice) => sum + parseFloat(invoice.calculatedTotalDuty || 0), 0);
    if (itemsWithoutRate) toast.error(`${itemsWithoutRate} item(s) skipped: exchange rate missing ("Update Exchange Rate")`);
    toast.success(`Duty (estimate) for ${invoices.length} invoice(s): ₹${totalDuty.toFixed(2)}`);
  };

  return { handleArrangeSerial, handleCopyFromOtherJob, handleRecalculateDutyAllInv };
}
