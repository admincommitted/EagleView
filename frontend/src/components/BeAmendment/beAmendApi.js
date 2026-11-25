// BE amendment (iCAFFE way): calls to /be-amendments.
import axiosInstance from '@/services/axiosInstance';
import { blobErrorMessage, downloadBlob } from '@/lib/download';

// resolves the server's answer; throws an Error with the server's message on an error status or { success: false }
export async function api(path, { method = 'GET', body, headers } = {}) {
  let response;
  try {
    response = await axiosInstance.request({ url: '/be-amendments' + path, method, data: body, headers });
  } catch (error) {
    if (!error.response) throw error;
    throw new Error(error.response.data?.error || 'Server answered ' + error.response.status);
  }
  const answer = response.data;
  if (answer?.success === false) throw new Error(answer.error || 'Server answered ' + response.status);
  return answer;
}

// kind: 'unsigned' | 'signed'
export async function downloadFile(id, kind) {
  let response;
  try {
    response = await axiosInstance.get(`/be-amendments/${id}/file`, { params: { kind: kind === 'signed' ? 'signed' : 'unsigned' }, responseType: 'blob' });
  } catch (error) {
    if (!error.response) throw error;
    const message = await blobErrorMessage(error);
    throw new Error(message === error.message ? 'Could not download' : message);
  }
  const disposition = response.headers['content-disposition'] || '';
  const name = (/filename="([^"]+)"/.exec(disposition) || [])[1] || 'amendment.be';
  downloadBlob(response.data, name);
  return name;
}

export const STATUS_STYLE = {
  Draft: { bg: '#f1f5f9', fg: '#475569', bd: '#cbd5e1' },
  Ready: { bg: '#e0f2fe', fg: '#075985', bd: '#7dd3fc' },
  Submitted: { bg: '#fef3c7', fg: '#92400e', bd: '#fcd34d' },
  Accepted: { bg: '#dcfce7', fg: '#166534', bd: '#86efac' },
  Rejected: { bg: '#fee2e2', fg: '#991b1b', bd: '#fca5a5' },
  Void: { bg: '#f8fafc', fg: '#94a3b8', bd: '#e2e8f0' },
};

export const dmy = (value) => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : (value || '');
};
export const ymd = (value) => {
  const text = String(value || '').trim();
  const isoParts = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (isoParts) return `${isoParts[1]}-${isoParts[2]}-${isoParts[3]}`;
  const dayFirst = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return dayFirst ? `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}` : '';
};
export const MODE_LABEL = { MAIL: 'Sent to ICEGATE by mail', DOWNLOAD: 'Signed file uploaded on ICEGATE', DOWNLOAD_UNSIGNED: 'Unsigned file uploaded on ICEGATE' };

export const beAmendApi = {
  list: (filters) => api('/?' + new URLSearchParams(filters).toString()),
  settings: () => api('/settings'),
  saveMailTo: (mailTo) => api('/settings', { method: 'PUT', body: { mailTo } }),
  codes: () => api('/codes'),
  amendment: (id) => api(`/${id}`),
  changes: (id) => api(`/${id}/changes`),
  save: (id, form) => api(`/${id}`, { method: 'PUT', body: form }),
  makeFile: (id, icegateProfileId) => api(`/${id}/file`, { method: 'POST', body: { icegateProfileId } }),
  sign: (id, pin) => api(`/${id}/sign`, { method: 'POST', body: { pin } }),
  send: (id) => api(`/${id}/send`, { method: 'POST' }),
  markSubmitted: (id, mode) => api(`/${id}/submitted`, { method: 'POST', body: { mode } }),
  saveReply: (id, status, text) => api(`/${id}/reply`, { method: 'POST', body: { status, text } }),
  voidAmendment: (id, reason) => api(`/${id}/void`, { method: 'POST', body: { reason } }),
};
