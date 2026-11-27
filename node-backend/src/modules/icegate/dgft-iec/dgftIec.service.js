import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { LOGS_DIR } from '../../../config/env.js';
import { ApiError, BadRequestError } from '../../../core/http/index.js';
import { httpsAgent } from '../../../utils/integrations/tls.js';
import { parseResult } from './dgftIec.parser.js';

// Party Master > "Fetch from DGFT": the public "View Any IEC" page of dgft.gov.in. The DGFT captcha is shown on the
// EagleView screen and typed by the user; nothing is solved here. One DGFT request set per button click.
const DGFT_URL = process.env.DGFT_CP_URL || 'https://www.dgft.gov.in/CP/';
const VIEW_IEC_PAGE = DGFT_URL + '?opt=view-any-ice';
const DGFT_ORIGIN = DGFT_URL.replace(/^(https?:\/\/[^/]+).*$/, '$1');
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const DGFT_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 5;
const SESSION_TTL_MS = 5 * 60 * 1000;
const SESSION_ID_BYTES = 12;
const LAST_ANSWER_FILE = path.join(LOGS_DIR, 'dgft_iec_last.html');
const SAMPLE_LENGTH = 300;
const ADDRESS_KEY_LENGTH = 25;
const MIN_FIRM_NAME_LENGTH = 3;
const SESSION_EXPIRED = 'DGFT session expired. Open the window again.';
const WRONG_CAPTCHA = 'Wrong captcha. Type the new captcha.';
const DGFT_FAILURE_STATUS = 502;
const SESSION_GONE_STATUS = 410;

// sessionId -> { jar: { cookie name: value }, csrf, at }
const sessions = new Map();

function dropExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions) if (now - session.at > SESSION_TTL_MS) sessions.delete(sessionId);
}

function keepCookies(session, response) {
  for (const cookie of response.headers['set-cookie'] || []) {
    const pair = cookie.split(';')[0];
    const equalsAt = pair.indexOf('=');
    if (equalsAt > 0) session.jar[pair.slice(0, equalsAt).trim()] = pair.slice(equalsAt + 1).trim();
  }
}

const cookieHeader = (session) =>
  Object.entries(session.jar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

async function requestDgft(session, method, url, { data, accept, binary } = {}) {
  const response = await axios({
    method,
    url,
    data,
    httpsAgent,
    timeout: DGFT_TIMEOUT_MS,
    maxRedirects: MAX_REDIRECTS,
    responseType: binary ? 'arraybuffer' : 'text',
    validateStatus: () => true,
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Referer: VIEW_IEC_PAGE,
      Origin: DGFT_ORIGIN,
      Accept: accept || 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9',
      ...(Object.keys(session.jar).length ? { Cookie: cookieHeader(session) } : {}),
      ...(method === 'post'
        ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }
        : {}),
    },
  });
  keepCookies(session, response);
  if (response.status >= 400) throw new Error(`DGFT site answered HTTP ${response.status}`);
  return response;
}

async function captchaPicture(session) {
  const response = await requestDgft(session, 'get', DGFT_URL + 'SimpleCaptcha?' + Date.now(), {
    accept: 'image/*',
    binary: true,
  });
  const type = String(response.headers['content-type'] || 'image/png').split(';')[0];
  if (!type.startsWith('image/')) throw new Error('DGFT did not send a captcha picture');
  return `data:${type};base64,${Buffer.from(response.data).toString('base64')}`;
}

const dgftFailure = (message, status = DGFT_FAILURE_STATUS) => new ApiError(status, message);
const errorText = (error) => error.message || String(error);

function csrfTokenOf(pageHtml) {
  const html = String(pageHtml);
  const match =
    html.match(/<meta[^>]+name=["']_csrf["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']_csrf["']/i);
  return match ? match[1] : '';
}

/** POST /iec/start: opens a DGFT session and gets the captcha picture. */
export async function startIecSession() {
  dropExpiredSessions();
  try {
    const session = { jar: {}, csrf: '', at: Date.now() };
    const page = await requestDgft(session, 'get', VIEW_IEC_PAGE);
    session.csrf = csrfTokenOf(page.data);
    const captcha = await captchaPicture(session);
    const sessionId = crypto.randomBytes(SESSION_ID_BYTES).toString('hex');
    sessions.set(sessionId, session);
    return { success: true, sessionId, captcha };
  } catch (error) {
    throw dgftFailure('Could not open the DGFT site: ' + errorText(error));
  }
}

function openSession(sessionId) {
  dropExpiredSessions();
  const session = sessions.get(String(sessionId || ''));
  if (!session) throw dgftFailure(SESSION_EXPIRED, SESSION_GONE_STATUS);
  return session;
}

/** POST /iec/captcha-refresh: a new captcha picture for the open session. */
export async function refreshCaptcha(request) {
  const session = openSession((request || {}).sessionId);
  try {
    session.at = Date.now();
    return { success: true, captcha: await captchaPicture(session) };
  } catch (error) {
    throw dgftFailure(errorText(error));
  }
}

function checkedSearch({ iec, name, captcha }) {
  const iecNo = String(iec || '')
    .trim()
    .toUpperCase();
  const firmName = String(name || '').trim();
  const captchaText = String(captcha || '').trim();
  if (!/^[A-Z0-9]{10}$/.test(iecNo)) throw new BadRequestError('IEC must be 10 characters.');
  if (firmName.length < MIN_FIRM_NAME_LENGTH)
    throw new BadRequestError('Enter at least the first 3 letters of the firm name.');
  if (!captchaText) throw new BadRequestError('Type the captcha shown in the picture.');
  return { iecNo, firmName, captchaText };
}

function saveLastAnswer(html) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.writeFileSync(LAST_ANSWER_FILE, html);
  } catch {
    // only a debug copy
  }
}

async function captchaOrEmpty(session) {
  try {
    return await captchaPicture(session);
  } catch {
    return '';
  }
}

/**
 * Sr No 0 = the registered (IEC) address. DGFT lists only the branches, so when no branch has code 0 / no code and no
 * branch has the same address, the IEC address is offered as Sr No 0 (GSTIN left blank, never guessed).
 */
function branchesWithRegisteredAddress(result) {
  const branches = [...result.branches];
  const addressKey = (value) =>
    String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, ADDRESS_KEY_LENGTH);
  const hasZero = branches.some((branch) => {
    const code = String(branch.branchCode || '').trim();
    return code === '' || /^0+$/.test(code);
  });
  const sameAddress = branches.some((branch) => addressKey(branch.address) === addressKey(result.details.Address));
  if (!hasZero && !sameAddress && result.details.Address && result.firmAddress && result.firmAddress.address1) {
    const { district, ...firmAddress } = result.firmAddress; // eslint-disable-line no-unused-vars
    branches.unshift({
      branchCode: '0',
      registered: true,
      gstin: '',
      gstinMasked: '',
      address: result.details.Address,
      ...firmAddress,
    });
  }
  return branches;
}

async function answerOfSearch(session, sessionId, iecNo, result) {
  const flag = String(result.hidden.crmCustResultSet || '').trim();
  if (flag === '1' || (/correct\s+captcha/i.test(result.text) && !Object.keys(result.details).length)) {
    return { success: false, wrongCaptcha: true, error: WRONG_CAPTCHA, captcha: await captchaOrEmpty(session) };
  }
  if (flag === '2') {
    return {
      success: false,
      error:
        'DGFT has no details for this IEC and firm name. Type only the first word of the firm name as DGFT has it' +
        ' (no dots or M/S), check the IEC, then try again with the new captcha.',
      captcha: await captchaOrEmpty(session),
    };
  }
  if (flag === '3')
    return {
      success: false,
      error: 'DGFT site returned an error. Try again in a minute.',
      captcha: await captchaOrEmpty(session),
    };
  if (!Object.keys(result.details).length && !result.branches.length) {
    return {
      success: false,
      error: 'DGFT answer could not be read. A copy was kept in node-backend/logs/dgft_iec_last.html.',
      sample: result.text.slice(0, SAMPLE_LENGTH),
      captcha: await captchaOrEmpty(session),
    };
  }
  sessions.delete(String(sessionId));
  return {
    success: true,
    iec: iecNo,
    details: result.details,
    firmAddress: result.firmAddress,
    branches: branchesWithRegisteredAddress(result),
    people: result.people,
  };
}

async function searchIec(session, sessionId, { iecNo, firmName, captchaText }) {
  const csrf = session.csrf ? '&_csrf=' + encodeURIComponent(session.csrf) : '';
  const captchaCheck = await requestDgft(
    session,
    'post',
    DGFT_URL +
      'webHP?requestType=ApplicationRH&actionVal=checkCaptcha&queryType=Select&screenId=114&captcha_val=' +
      encodeURIComponent(captchaText) +
      csrf,
    { data: '' },
  );
  if (/correct\s+captcha/i.test(String(captchaCheck.data))) {
    return { success: false, wrongCaptcha: true, error: WRONG_CAPTCHA, captcha: await captchaOrEmpty(session) };
  }
  const body = new URLSearchParams({ panNumber: iecNo, entityName: firmName, captcha_val: captchaText }).toString();
  const response = await requestDgft(
    session,
    'post',
    DGFT_URL + 'webHP?requestType=ApplicationRH&actionVal=viewAnonymousIEC&screenId=50001&appId=2' + csrf,
    { data: body },
  );
  const html = String(response.data || '');
  saveLastAnswer(html);
  return answerOfSearch(session, sessionId, iecNo, parseResult(html));
}

/** POST /iec/fetch { sessionId, iec, name, captcha }: the IEC details, branches and people from DGFT. */
export async function fetchIecDetails(request) {
  const fields = request || {};
  const session = openSession(fields.sessionId);
  const search = checkedSearch(fields);
  session.at = Date.now();
  try {
    return await searchIec(session, fields.sessionId, search);
  } catch (error) {
    throw dgftFailure('DGFT request failed: ' + errorText(error));
  }
}
