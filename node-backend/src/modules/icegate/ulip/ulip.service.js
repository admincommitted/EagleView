import axios from 'axios';
import {
  ApiError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
} from '../../../core/http/index.js';
import * as settingsStore from '../../../utils/common/settingsStore.js';
import { httpsAgent } from '../../../utils/integrations/tls.js';

const DEFAULT_ULIP_URL = 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0';
const TOKEN_LIFETIME_MS = 55 * 60 * 1000;
const API_CALL_TIMEOUT_MS = 60000;
const TEST_MESSAGE_LENGTH = 480;
const API_CALL_FAILED_STATUS = 502;
const CREDENTIALS_NOT_SET = 'ULIP user / password not set in Settings > ULIP Integration';
const API_FIELDS = [
  'apiCode',
  'apiName',
  'category',
  'method',
  'path',
  'requestTemplate',
  'description',
  'isActive',
  'sortOrder',
];
const TEXT_FIELDS = ['apiCode', 'apiName', 'category', 'method', 'path'];
const HTTP_METHODS = ['GET', 'POST', 'PUT'];
const PLACEHOLDER_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

let cachedToken = null;
let tokenExpiresAt = 0;

// the ULIP APIs are rows of table UlipApi (Settings > ULIP Integration)
const UlipApi = () => settingsStore.models.UlipApi;

async function ulipBaseUrl() {
  return String((await settingsStore.get('ULIP_BASE_URL')) || DEFAULT_ULIP_URL).replace(/\/+$/, '');
}

const statusOf = (error) => error.statusCode || error.status;

async function loginToUlip() {
  const loginUrl = (await ulipBaseUrl()) + '/user/login';
  const credentials = await settingsStore.getMany(['ULIP_USERNAME', 'ULIP_PASSWORD']);
  if (!credentials.ULIP_USERNAME || !credentials.ULIP_PASSWORD) throw new Error(CREDENTIALS_NOT_SET);
  const response = await axios.post(
    loginUrl,
    { username: credentials.ULIP_USERNAME, password: credentials.ULIP_PASSWORD },
    { httpsAgent },
  );
  if (!(response.data && response.data.response && response.data.response.id))
    throw new Error('Invalid response from ULIP Login');
  return response.data.response.id;
}

/** The ULIP token (Settings > ULIP), reused for 55 minutes. */
async function getUlipToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  try {
    cachedToken = await loginToUlip();
    tokenExpiresAt = Date.now() + TOKEN_LIFETIME_MS;
    return cachedToken;
  } catch (error) {
    console.error('ULIP Login Error:', error.response?.data || error.message);
    const reason = error.response?.data?.message || error.response?.data?.error || error.message;
    throw new Error(
      /not set in Settings/.test(error.message) ? error.message : 'Failed to authenticate with ULIP: ' + reason,
    );
  }
}

const jsonHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
});

async function readDgftIec(iec) {
  const token = await getUlipToken();
  const response = await axios.post(
    (await ulipBaseUrl()) + '/DGFT/01',
    { iecnumber: iec.toUpperCase() },
    {
      headers: jsonHeaders(token),
      httpsAgent,
    },
  );
  if (response.data && response.data.response && response.data.response.length > 0) {
    return { success: true, data: response.data.response[0].response };
  }
  return { success: false, error: 'No data found for this IEC' };
}

/** POST /dgft/iec { iec }: the IEC details from DGFT through ULIP (DGFT/01). */
export async function fetchDgftIec({ iec }) {
  try {
    return await readDgftIec(iec);
  } catch (error) {
    console.error('ULIP DGFT Error:', error.response?.data || error.message);
    throw new InternalServerError('Error fetching data from ULIP API', {
      body: { success: false, error: 'Error fetching data from ULIP API' },
    });
  }
}

async function tryUlipLogin(request) {
  const { username } = request;
  let { password } = request;
  // the saved password is not sent back to the screen: empty / *** = use the saved one
  if (!password || String(password).startsWith('***')) password = await settingsStore.get('ULIP_PASSWORD');
  if (!username || !password) throw new BadRequestError('Username and Password required');
  const response = await axios.post((await ulipBaseUrl()) + '/user/login', { username, password }, { httpsAgent });
  if (response.data && response.data.response && response.data.response.id)
    return { success: true, message: 'Login successful!' };
  return { success: false, error: 'Invalid credentials or response from ULIP' };
}

/** POST /test-login { username, password }: logs in to ULIP with the typed (or saved) credentials. */
export async function testUlipLogin(request) {
  try {
    return await tryUlipLogin(request);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = error.response?.data?.response || error.message || 'Failed to authenticate with ULIP';
    throw new InternalServerError(message, { body: { success: false, error: message } });
  }
}

const placeholdersOf = (template) => [
  ...new Set((String(template || '').match(PLACEHOLDER_PATTERN) || []).map((name) => name.slice(1, -1))),
];

function normalizeApiFields(input) {
  const values = {};
  for (const field of API_FIELDS) if (input[field] !== undefined) values[field] = input[field];
  TEXT_FIELDS.forEach((field) => {
    if (values[field] !== undefined) values[field] = String(values[field] == null ? '' : values[field]).trim();
  });
  if (values.apiCode !== undefined) values.apiCode = values.apiCode.toUpperCase().replace(/\s+/g, '');
  if (values.category) values.category = values.category.toUpperCase();
  if (values.method !== undefined) values.method = (values.method || 'POST').toUpperCase();
  if (values.isActive !== undefined) values.isActive = !!values.isActive;
  if (values.sortOrder !== undefined) values.sortOrder = parseInt(values.sortOrder, 10) || 0;
  return values;
}

function apiFieldProblems(values, isNew) {
  const problems = [];
  if ((isNew || values.apiCode !== undefined) && !/^[A-Z0-9][A-Z0-9_/.-]{1,59}$/.test(values.apiCode || '')) {
    problems.push('API code: letters / numbers / _ - . / (e.g. VAHAN/01)');
  }
  if ((isNew || values.apiName !== undefined) && !values.apiName) problems.push('API name is required');
  if (
    (isNew || values.path !== undefined) &&
    !(/^\/[^\s]*$/.test(values.path || '') || /^https:\/\/[^\s]+$/.test(values.path || ''))
  ) {
    problems.push('Path must start with / (e.g. /VAHAN/01) or be a full https:// URL');
  }
  if (values.method !== undefined && !HTTP_METHODS.includes(values.method))
    problems.push('Method must be GET, POST or PUT');
  if (values.requestTemplate) {
    // placeholders are replaced by text, so the JSON is tested with a dummy value
    try {
      JSON.parse(String(values.requestTemplate).replace(PLACEHOLDER_PATTERN, 'X'));
    } catch (error) {
      problems.push('Request body is not valid JSON: ' + error.message);
    }
  }
  return problems;
}

/** The API fields of the screen, cleaned and checked. */
function apiValues(input, isNew) {
  const values = normalizeApiFields(input);
  const problems = apiFieldProblems(values, isNew);
  if (problems.length) throw new BadRequestError(problems.join('; '));
  return values;
}

const apiAnswer = (row) => ({ ...row.toJSON(), params: placeholdersOf(row.requestTemplate) });

/** The answer of the API list screen for a failure: a duplicate code is 409, a wrong field 400, else 500. */
function apiListError(error) {
  if (error.name === 'SequelizeUniqueConstraintError') return new ConflictError('This API code already exists');
  return new ApiError(statusOf(error) || 500, error.message);
}

async function withApiListErrors(work) {
  try {
    return await work();
  } catch (error) {
    throw apiListError(error);
  }
}

async function findApi(id) {
  await settingsStore.ready();
  const row = await UlipApi().findByPk(id);
  if (!row) throw new NotFoundError('API not found');
  return row;
}

/** GET /apis */
export const listApis = () =>
  withApiListErrors(async () => {
    await settingsStore.ready();
    const rows = await UlipApi().findAll({
      order: [
        ['sortOrder', 'ASC'],
        ['category', 'ASC'],
        ['apiCode', 'ASC'],
      ],
    });
    return { success: true, baseUrl: await ulipBaseUrl(), data: rows.map(apiAnswer) };
  });

/** POST /apis */
export const createApi = (input) =>
  withApiListErrors(async () => {
    await settingsStore.ready();
    const row = await UlipApi().create(apiValues(input || {}, true));
    return { success: true, data: apiAnswer(row) };
  });

/** PUT /apis/:id */
export const updateApi = (id, input) =>
  withApiListErrors(async () => {
    const row = await findApi(id);
    await row.update(apiValues(input || {}, false));
    return { success: true, data: apiAnswer(row) };
  });

/** DELETE /apis/:id */
export const deleteApi = (id) =>
  withApiListErrors(async () => {
    const row = await findApi(id);
    await row.destroy();
    return { success: true };
  });

/** The request body of an API: its {placeholders} filled from params (JSON-escaped). */
function requestBodyOf(row, params) {
  const missing = placeholdersOf(row.requestTemplate).filter(
    (name) => params[name] == null || String(params[name]).trim() === '',
  );
  if (missing.length) throw new BadRequestError('Enter: ' + missing.join(', '));
  const bodyText = String(row.requestTemplate || '').replace(PLACEHOLDER_PATTERN, (match, name) =>
    JSON.stringify(String(params[name]).trim()).slice(1, -1),
  );
  return bodyText.trim() ? JSON.parse(bodyText) : undefined;
}

/** Runs one ULIP API and returns its HTTP status, time and answer. */
async function runApi(row, params = {}) {
  const body = requestBodyOf(row, params);
  const url = /^https:\/\//.test(row.path) ? row.path : (await ulipBaseUrl()) + row.path;
  const token = await getUlipToken();
  const startedAt = Date.now();
  const response = await axios({
    method: row.method || 'POST',
    url,
    data: row.method === 'GET' ? undefined : body,
    params: row.method === 'GET' ? body : undefined,
    headers: jsonHeaders(token),
    httpsAgent,
    timeout: API_CALL_TIMEOUT_MS,
    validateStatus: () => true,
  });
  return { status: response.status, ms: Date.now() - startedAt, data: response.data };
}

const isHttpSuccess = (status) => status >= 200 && status < 300;

const answerLooksFailed = (data) =>
  !!(data && /fail|error/i.test(String(data.code || data.message || '')) && !data.response);

async function noteFailedTest(row, error) {
  if (!row || statusOf(error) === 400) return;
  await row
    .update({
      lastTestAt: new Date(),
      lastTestOk: false,
      lastTestMessage: String(error.message).slice(0, TEST_MESSAGE_LENGTH),
    })
    .catch(() => {});
}

/** POST /apis/:id/test { params }: runs the API and notes the result on its row. */
export async function testApi(id, params) {
  let row;
  try {
    await settingsStore.ready();
    row = await UlipApi().findByPk(id);
    if (!row) throw new NotFoundError('API not found');
    const result = await runApi(row, params || {});
    const ok = isHttpSuccess(result.status) && !answerLooksFailed(result.data);
    await row.update({
      lastTestAt: new Date(),
      lastTestOk: ok,
      lastTestMessage: `HTTP ${result.status} in ${result.ms} ms`,
    });
    return { success: ok, httpStatus: result.status, ms: result.ms, data: result.data };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    await noteFailedTest(row, error);
    throw new ApiError(statusOf(error) || API_CALL_FAILED_STATUS, error.message);
  }
}

/** The API code of the url: it may contain "/", so it is sent as VAHAN~01 or URL-encoded. */
function apiCodeOf(rawCode) {
  const joined = Array.isArray(rawCode) ? rawCode.join('/') : String(rawCode || '');
  return decodeURIComponent(joined).replace(/~/g, '/').toUpperCase();
}

async function runApiByCode(rawCode, params) {
  await settingsStore.ready();
  const code = apiCodeOf(rawCode);
  const row = await UlipApi().findOne({ where: { apiCode: code } });
  if (!row) throw new NotFoundError(`ULIP API ${code} is not set up (Settings > ULIP Integration)`);
  if (!row.isActive) throw new BadRequestError(`ULIP API ${code} is switched off`);
  const result = await runApi(row, params);
  const succeeded = isHttpSuccess(result.status);
  return {
    status: succeeded ? 200 : API_CALL_FAILED_STATUS,
    body: { success: succeeded, httpStatus: result.status, data: result.data },
  };
}

/** POST /call/<apiCode> { params }: runs one ULIP API for another screen. */
export async function callApiByCode(rawCode, params) {
  try {
    return await runApiByCode(rawCode, params);
  } catch (error) {
    throw new ApiError(statusOf(error) || API_CALL_FAILED_STATUS, error.message);
  }
}
