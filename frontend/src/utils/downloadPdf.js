// One-click download of a PDF kept with a job (e-Sanchit window), saved under a short name such as
// "signed_invoice.pdf" instead of the long archive name (380000_noirn_1794626543410_signed_invoice.pdf).
// /uploads needs a login: the token header and the edi_token cookie (set at login) go with this same-site request.
import toast from 'react-hot-toast';
import axiosInstance from '@/services/axiosInstance';
import { downloadBlob } from '@/lib/download';

export const shortPdfName = (row) => {
  let name = String(row?.fileName || '').trim();
  if (!name && row?.fileUrl) name = String(row.fileUrl).split('/').pop().replace(/^[^_]*_[^_]*_\d+_/, ''); // drop code_irn_time_
  name = name.replace(/[\\/:*?"<>|]+/g, '_');
  if (!name) name = `${row?.docCode || 'document'}.pdf`;
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
};

export async function downloadPdf(row) {
  if (!row?.fileUrl) { toast.error('No PDF kept for this document'); return; }
  try {
    // the file is outside /api; a 401 here only means the file link needs a new login, so it is not a log-out
    const response = await axiosInstance.get(row.fileUrl, { baseURL: '', responseType: 'blob', validateStatus: () => true });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(response.status === 401 ? 'login expired - log in again' : `HTTP ${response.status}`);
    }
    downloadBlob(response.data, shortPdfName(row));
  } catch (error) {
    toast.error(`PDF could not be downloaded: ${error.message}`);
  }
}
