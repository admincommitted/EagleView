import toast from 'react-hot-toast';
import askConfirm, { askText } from '../../../../common/askConfirm';
import { jobEntryApi } from '@/components/JobEntry/jobEntryApi';
import { errorMessage } from '@/services/axiosInstance';
import { downloadItemWorkbook } from '../../jobExcel';
import responseBody from './responseBody';
import { deepCopy, nextItemSr } from './useItemList';

const TEMPLATE_SKIP_KEYS = new Set(['id', 'importInvoiceId', 'importJobId', 'createdAt', 'updatedAt', 'invSrNo', 'invNo', 'itemSrNo', 'itemNo', '_whBalanceQty', '_whOriginalQty']);
const COPY_SKIP_KEYS = ['id', 'importInvoiceId', 'importJobId', 'jobId', 'createdAt', 'updatedAt', 'extendedData', 'additionalData'];
const COPY_TOAST = 'copy-job';
const AI_TOAST = 'ai-parse';

// Items in and out of the job: the item template master (Masters > Item Template), another job, a PDF read by the
// AI extractor, and the Excel template / sample downloads
export default function useItemTransfers(grid) {
  const { items, setItems, selectedRowId, setSelectedRowId, selectedItem, jobData, invoices } = grid;

  const invoiceNoAt = (invSrNo) => (invoices[parseInt(invSrNo, 10) - 1] || {}).invNo || '';

  const saveItemTemplate = async () => {
    if (!selectedRowId || !selectedItem || !selectedItem.id) { toast('Select the item to save as a template.'); return; }
    const templateName = await askText({
      title: 'Save as item template',
      message: 'Item ' + (selectedItem.itemSrNo || '') + ' is kept in Masters > Item Template and can be added to any job.',
      label: 'Template name (RITC / description helps)',
      value: String(selectedItem.desc || selectedItem.ritc || '').slice(0, 40),
      okLabel: 'Save template',
    }) || '';
    if (!templateName) return;
    const payload = Object.fromEntries(Object.entries(selectedItem).filter(([key, value]) => !TEMPLATE_SKIP_KEYS.has(key) && value !== undefined && value !== null && value !== ''));
    try {
      await jobEntryApi.saveItemTemplate({ templateName, jobType: 'BE', jsonPayload: JSON.stringify(payload) });
      toast.success('Saved as item template "' + templateName + '"');
    } catch (error) {
      toast.error('Could not save the template: ' + errorMessage(error));
    }
  };

  // brings a saved template into the grid as a new item of the selected item's invoice
  const addItemFromTemplate = async () => {
    const targetInvoice = String((selectedItem && selectedItem.invSrNo) || '1');
    try {
      const response = await jobEntryApi.itemTemplates();
      const templates = (Array.isArray(response) ? response : (response && response.data) || []).filter((template) => !template.jobType || template.jobType === 'BE');
      if (!templates.length) { toast('No item template saved yet - open an item and press "Add to Template".'); return; }
      const picked = await askText({
        title: 'Use item template',
        message: 'The template is added as a new item of invoice ' + targetInvoice + '.',
        label: 'Item template (' + templates.length + ')',
        choices: templates.map((template, index) => ({ value: String(index + 1), label: (index + 1) + '. ' + template.templateName })),
        okLabel: 'Add the item',
      }) || '';
      if (!picked) return;
      const template = /^\d+$/.test(picked) ? templates[parseInt(picked, 10) - 1] : templates.find((entry) => String(entry.templateName).toLowerCase() === picked.toLowerCase());
      if (!template) { toast.error('No template with that number / name'); return; }
      let templateItem = {};
      try {
        templateItem = JSON.parse(template.jsonPayload || '{}');
      } catch {
        templateItem = {};
      }
      const itemSrNo = nextItemSr(items, targetInvoice);
      const row = { ...templateItem, id: Date.now(), invSrNo: targetInvoice, invNo: invoiceNoAt(targetInvoice), itemSrNo, itemNo: itemSrNo };
      setItems([...items, row]);
      setSelectedRowId(row.id);
      toast.success('Item template "' + template.templateName + '" added as item ' + itemSrNo + ' of invoice ' + targetInvoice + ' - check it and Save');
    } catch (error) {
      toast.error('Could not read the templates: ' + errorMessage(error));
    }
  };

  // the other job comes back with invoices[].items; the copies go into the selected item's invoice
  const handleCopyFromOtherJob = async () => {
    const jobNo = await askText({ title: 'Copy items from another job', label: 'Job No', placeholder: 'e.g. NDL/AI/200005 or 8564', okLabel: 'Find the job' }) || '';
    if (!jobNo) return;
    toast.loading('Fetching items from job...', { id: COPY_TOAST });
    try {
      const found = await responseBody(jobEntryApi.searchJobs(jobNo));
      const job = (found.data || []).find((entry) => String(entry.jobNo || '').toUpperCase() === jobNo.toUpperCase());
      if (!job) { toast.error('Job ' + jobNo + ' not found', { id: COPY_TOAST }); return; }
      if (jobData?.id && String(job.id) === String(jobData.id)) { toast.error('That is this same job', { id: COPY_TOAST }); return; }
      const sourceJob = await responseBody(jobEntryApi.job(job.id));
      const sourceItems = (sourceJob.data?.invoices || []).flatMap((invoice, invoiceIndex) => (invoice.items || []).map((item) => ({ ...item, invSrNo: String(item.invSrNo || invoiceIndex + 1) })));
      if (!sourceItems.length) { toast.error('No items found in that job.', { id: COPY_TOAST }); return; }
      const targetInvoice = selectedItem?.invSrNo || '1';
      const confirmed = await askConfirm({ title: 'Copy items', message: `Copy ${sourceItems.length} item(s) from job ${jobNo} into invoice ${targetInvoice} of this job?`, okLabel: `Copy ${sourceItems.length} item(s)`, cancelLabel: 'Do not copy' });
      if (!confirmed) { toast.dismiss(COPY_TOAST); return; }
      const nextItems = [...items];
      sourceItems.forEach((item, index) => {
        const copy = deepCopy(item);
        COPY_SKIP_KEYS.forEach((key) => delete copy[key]);
        copy.id = Date.now() + index;
        copy.invSrNo = String(targetInvoice);
        copy.invNo = invoiceNoAt(targetInvoice);
        copy.itemSrNo = nextItemSr(nextItems, targetInvoice);
        copy.itemNo = copy.itemSrNo;
        nextItems.push(copy);
      });
      setItems(nextItems);
      toast.success(`${sourceItems.length} item(s) copied`, { id: COPY_TOAST });
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch job items.', { id: COPY_TOAST });
    }
  };

  // Upload PDF (AI): new items get the invoice / item Sr No and the description / price in the boxes the screen uses
  const handleAiPdf = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const partyId = jobData?.importerId || jobData?._importerId;
    if (partyId) formData.append('partyId', partyId);
    formData.append('formType', 'import');
    toast.loading('AI is reading the PDF...', { id: AI_TOAST });
    try {
      const response = await responseBody(jobEntryApi.extractPdfItems(formData));
      if (!(response.success && response.items && response.items.length)) { toast.error(response.error || "AI couldn't find items in this PDF.", { id: AI_TOAST }); return; }
      const targetInvoice = selectedItem?.invSrNo || '1';
      const nextItems = [...items];
      response.items.forEach((extracted, index) => {
        const qty = extracted.quantity ?? '';
        const price = extracted.unitPrice ?? '';
        const ritc = String(extracted.hsCode || '').replace(/\D/g, '');
        const unit = String(extracted.unit || '').toUpperCase();
        const lineValue = parseFloat(qty) * parseFloat(price);
        const itemSrNo = nextItemSr(nextItems, targetInvoice);
        nextItems.push({
          id: Date.now() + index, invSrNo: String(targetInvoice), invNo: invoiceNoAt(targetInvoice), itemSrNo, itemNo: itemSrNo,
          desc: extracted.description || '', productDescription: extracted.description || '', ritc, hsCode: ritc, cth: ritc, ceth: 'NOEXCISE',
          qty: String(qty), quantity: String(qty), unit, uqc: unit, price: String(price), unitPrice: String(price),
          value: String(lineValue > 0 ? +lineValue.toFixed(2) : (extracted.assessableValue || extracted.lineTotal || '')),
          swsRate: '10', swsFlag: 'A', foc: 'N',
        });
      });
      setItems(nextItems);
      toast.success(`AI extracted ${response.items.length} items into invoice ${targetInvoice} - please check them`, { id: AI_TOAST });
    } catch (error) {
      toast.error('AI Extractor failed: ' + error.message, { id: AI_TOAST });
    }
  };

  // an ex-bond job (BE type X) gets the WH Bal / Left columns of its Items grid in the file
  const exBond = String(jobData?.autoField_51 || jobData?.beType || '').toUpperCase() === 'X';
  const handleDownloadSample = () => downloadItemWorkbook(true, { exBond });
  const handleDownloadTemplate = () => downloadItemWorkbook(false, { exBond });

  return { saveItemTemplate, useItemTemplate: addItemFromTemplate, handleCopyFromOtherJob, handleAiPdf, handleDownloadSample, handleDownloadTemplate };
}
