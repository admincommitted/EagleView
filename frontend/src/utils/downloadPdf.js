// 14-Nov-2026: one-click download of a PDF kept with a job (e-Sanchit window), saved under a short name such as
// "signed_invoice.pdf" instead of the long archive name (380000_noirn_1794626543410_signed_invoice.pdf).
// /uploads needs a login: the edi_token cookie (set at login) goes with this same-site request.
import toast from 'react-hot-toast';

export const shortPdfName = (row) => {
  let n = String((row && row.fileName) || '').trim();
  if (!n && row && row.fileUrl) n = String(row.fileUrl).split('/').pop().replace(/^[^_]*_[^_]*_\d+_/, ''); // drop code_irn_time_
  n = n.replace(/[\\/:*?"<>|]+/g, '_');
  if (!n) n = ((row && row.docCode) || 'document') + '.pdf';
  return /\.pdf$/i.test(n) ? n : n + '.pdf';
};

export async function downloadPdf(row) {
  if (!row || !row.fileUrl) { toast.error('No PDF kept for this document'); return; }
  try {
    const token = localStorage.getItem('token');
    const r = await fetch(row.fileUrl, { headers: token ? { Authorization: 'Bearer ' + token } : {}, credentials: 'same-origin' });
    if (!r.ok) throw new Error(r.status === 401 ? 'login expired - log in again' : 'HTTP ' + r.status);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = shortPdfName(row);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) { toast.error('PDF could not be downloaded: ' + e.message); }
}
