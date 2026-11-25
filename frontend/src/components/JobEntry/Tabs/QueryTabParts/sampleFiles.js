import toast from 'react-hot-toast';
import { blobErrorMessage, downloadBlob } from '@/lib/download';
import { jobEntryApi } from '../../jobEntryApi';
import { downloadInvoiceSample } from '../InvoiceGridTabParts/invoiceExcel';
import { downloadItemCsv, downloadJobWorkbook } from '../jobExcel';

const makeOnServer = (kind, fileName) => async () => downloadBlob(await jobEntryApi.sampleFile(kind), fileName);

export const SAMPLE_FILES = [
  { key: 'invoice', label: 'Invoice Excel (invoices sheet only)', usedBy: '3. Invoices > Read Excel', create: downloadInvoiceSample },
  { key: 'job', label: 'Job Excel - invoices + items + containers + SW + e-Sanchit docs (sample)', usedBy: "3. Invoices > Read Excel or 4. Items > Read File (the other ERP's ImportExcel .xls also works)", create: () => downloadJobWorkbook(true) },
  { key: 'jobtpl', label: 'Job Excel - blank template', usedBy: '3. Invoices > Read Excel or 4. Items > Read File', create: () => downloadJobWorkbook(false) },
  { key: 'itemcsv', label: 'Item CSV', usedBy: '4. Items > Read File', create: downloadItemCsv },
  { key: 'json', label: 'BE JSON (ICEGATE CACHI01)', usedBy: 'Read XML / file upload', create: makeOnServer('json', 'Sample_BE_CACHI01.json') },
  { key: 'xml', label: 'BE XML', usedBy: 'Read XML', create: makeOnServer('xml', 'Sample_BE_CACHI01.xml') },
  { key: 'flat', label: 'BE Flat File (.be, ICES 1.5)', usedBy: 'Read Flat File', create: makeOnServer('flat', 'SAMPLE01.be') },
];

export async function downloadSampleFile(sample) {
  try {
    await sample.create();
  } catch (error) {
    toast.error(`Could not create the sample: ${await blobErrorMessage(error)}`);
  }
}
