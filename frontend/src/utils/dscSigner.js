// DSC signing from the browser.
// EagleView Signer (signer_tool, EagleViewSigner.exe) runs on each user's own PC at 127.0.0.1:5050 with that PC's DSC
// token. When it runs, PDFs are signed there and the token PIN is asked in the tool's own window - it never goes
// through the browser or the server. When it does not run, the server's Local Signer is used with the PIN typed in
// EagleView.
import axios from 'axios';
import axiosInstance from '@/services/axiosInstance';

const STATUS_CACHE_MS = 10000;
const STATUS_TIMEOUT_MS = 2500;

// the tool on this PC is not our API: no login / branch headers (they would make the browser ask the tool for
// CORS permission first) and never cached
const signerTool = axios.create({ baseURL: 'http://127.0.0.1:5050', adapter: 'fetch', fetchOptions: { cache: 'no-store' } });

let cache = { at: 0, status: undefined };

const blobJson = async (blob) => {
  try {
    return JSON.parse(await blob.text());
  } catch {
    return {};
  }
};

// status of the tool on this PC, or null when it does not run (cached 10 s)
export async function localSigner(force = false) {
  if (!force && cache.status !== undefined && Date.now() - cache.at < STATUS_CACHE_MS) return cache.status;
  let status = null;
  try {
    const { data } = await signerTool.get('/status', { timeout: STATUS_TIMEOUT_MS });
    status = data?.tool ? data : null;
  } catch {
    status = null;
  }
  cache = { at: Date.now(), status };
  return status;
}

// one-line text + colour for a signer status (tool or server signer)
export function signerLabel(status, viaTool) {
  if (status === undefined) return { text: '● checking DSC Signer...', color: '#64748b' };
  if (!status) return { text: '● DSC Signer app not running (start EagleView Signer)', color: '#b91c1c' };
  if (status.dll_found === false) return { text: '● DSC Signer running - token driver not found', color: '#b45309' };
  if (status.token_present === false) return { text: '● Plug in the DSC token', color: '#b45309' };
  const who = status.certificate?.name || (Array.isArray(status.token_labels) ? status.token_labels.join(', ') : '');
  return { text: (viaTool ? '● EagleView Signer ready' : '● DSC Signer ready') + (who ? ` - ${who}` : ''), color: '#15803d' };
}

async function signWithTool(file, pin, purpose) {
  const formData = new FormData();
  formData.append('pdf', file, file.name || 'document.pdf');
  if (pin) formData.append('pin', pin);
  if (purpose) formData.append('purpose', purpose);
  let response;
  try {
    response = await signerTool.post('/sign-pdf', formData, { responseType: 'blob', validateStatus: () => true });
  } catch {
    cache = { at: 0, status: undefined };
    throw new Error('EagleView Signer on this PC did not answer - is it still running?');
  }
  if (response.status < 200 || response.status >= 300) {
    const answer = await blobJson(response.data);
    const error = new Error(answer.error || `EagleView Signer: ${response.status}`);
    if (answer.cancelled) error.cancelled = true;
    throw error;
  }
  return { blob: response.data, signer: response.headers['x-signer-cn'] || '', via: 'tool' };
}

async function signWithServer(file, pin) {
  const formData = new FormData();
  formData.append('pdf', file);
  formData.append('pin', pin || '');
  const response = await axiosInstance.post('/icegate/sign-pdf', formData, { responseType: 'blob', validateStatus: (status) => status !== 401 });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`DSC signer (${file.name || 'PDF'}): ${await response.data.text()}`);
  }
  return { blob: response.data, signer: '', via: 'server' };
}

// sign one PDF: through the tool on this PC (PIN asked by the tool when pin is empty), else through the server signer.
// Returns { blob, signer, via }. A cancelled PIN window throws an Error with .cancelled = true.
export async function signPdf(file, pin, purpose) {
  const tool = await localSigner();
  return tool ? signWithTool(file, pin, purpose) : signWithServer(file, pin);
}
