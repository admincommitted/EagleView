import axios from 'axios';
import FormData from 'form-data';
import { AppSetting, IcegateProfile } from '../../../models/index.js';
import { ApiError, BadRequestError, InternalServerError } from '../../../core/http/index.js';
import { httpsAgent as icegateAgent } from '../../../utils/integrations/tls.js';
import { logIcegate } from '../../../utils/customs/icegateLog.js';
import { attachDigSign, isCmsSignature, signJsonWithDsc } from './dscSigner.service.js';

const DEFAULT_ICEGATE_URL = 'https://cisapi.icegate.gov.in';
const AUTH_TIMEOUT_MS = 30000;
const ACK_TIMEOUT_MS = 30000;
const FILE_SUBMIT_TIMEOUT_MS = 60000;
const TOKEN_RENEW_MARGIN_MS = 2 * 60 * 1000;
const DEFAULT_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const LOGGED_ANSWER_LENGTH = 1000;
const LOGGED_ACK_LENGTH = 200;
const MISSING_CERTIFICATE_WARNING =
  'The signer did not return the certificate, so digSign.startCertificate is empty' +
  ' - update local_signer/app.py on the signing machine';

// one ICEGATE token per API key, reused until two minutes before it runs out
const tokenCacheByApiKey = {};

const profileConfig = (profile) => ({
  loginId: profile.loginId,
  password: profile.password,
  apiKey: profile.apiKey,
  baseUrl: profile.baseUrl || DEFAULT_ICEGATE_URL,
});

async function configFromSettings() {
  const settings = await AppSetting.findAll({ where: { group: 'icegate' } });
  const values = {};
  settings.forEach((setting) => {
    values[setting.key] = setting.value;
  });
  return {
    loginId: values.icegate_login_id || process.env.ICEGATE_LOGIN_ID || '',
    password: values.icegate_password || process.env.ICEGATE_PASSWORD || '',
    apiKey: values.icegate_api_key || process.env.ICEGATE_API_KEY || '',
    baseUrl: values.icegate_base_url || process.env.ICEGATE_BASE_URL || DEFAULT_ICEGATE_URL,
  };
}

/** ICEGATE login of the chosen profile, else the default profile, else Settings > ICEGATE / .env. */
export async function getIcegateConfig(profileId = null) {
  if (profileId) {
    const profile = await IcegateProfile.findByPk(profileId);
    if (!profile) throw new Error('Selected ICEGATE Profile not found.');
    return profileConfig(profile);
  }
  const defaultProfile = await IcegateProfile.findOne({ where: { isDefault: true } });
  if (defaultProfile) return profileConfig(defaultProfile);
  return configFromSettings();
}

const tokenStillValid = (cached) =>
  cached &&
  cached.token &&
  cached.expiresAt &&
  new Date() < new Date(new Date(cached.expiresAt).getTime() - TOKEN_RENEW_MARGIN_MS);

/** ICEGATE API Contract v1.4: the body is {"key": "<API_KEY>"} - no login / password, no X-Api-Key header. */
export async function getAuthToken(config) {
  const cacheKey = config.apiKey;
  const cached = tokenCacheByApiKey[cacheKey];
  if (tokenStillValid(cached)) return cached;

  const url = `${config.baseUrl}/authentication/v1.0/api/authenticate`;
  const response = await axios.post(
    url,
    { key: config.apiKey },
    {
      headers: { 'Content-Type': 'application/json' },
      httpsAgent: icegateAgent,
      timeout: AUTH_TIMEOUT_MS,
    },
  );

  const answer = response.data;
  console.log(`[ICEGATE] auth response for ${config.loginId}:`, JSON.stringify(answer));

  const tokenData = {
    token: answer.accessToken || answer.token || '',
    expiresAt: answer.tokenExpiresIn || new Date(Date.now() + DEFAULT_TOKEN_LIFETIME_MS).toISOString(),
    status: answer.status || 'Authenticated',
    message: answer.message || '',
  };
  tokenCacheByApiKey[cacheKey] = tokenData;
  return tokenData;
}

const forgetToken = (apiKey) => {
  delete tokenCacheByApiKey[apiKey];
};

/** Rethrows the expected failures (ApiError) unchanged, so a catch-all only handles the unexpected ones. */
export function rethrowApiError(error) {
  if (error instanceof ApiError) throw error;
}

/** The text ICEGATE gave in an error answer, else the error itself. */
export const icegateErrorMessage = (error) =>
  error.response?.data?.message || error.response?.data?.error || error.message;

/**
 * Did ICEGATE take the file? Production answers {"message": "Your file has been accepted and is being processed.",
 * uniqueId ...}. Taken = HTTP 2xx and SUCCESS / ACCEPTED, or a unique ID, or an "accepted / being processed" message,
 * and no failure status - a file wrongly read as not taken would be sent again and filed twice.
 */
export function fileTaken(httpStatus, answer) {
  if (!answer || typeof answer !== 'object' || httpStatus < 200 || httpStatus >= 300) return false;
  const validationStatus = String(answer.validationStatus || '')
    .trim()
    .toUpperCase();
  const message = String(answer.message || '');
  if (/FAIL|ERROR|REJECT|INVALID/.test(validationStatus)) return false;
  if (validationStatus === 'SUCCESS' || validationStatus === 'ACCEPTED') return true;
  if (/not\s+(been\s+)?accepted|reject|fail|invalid|\berror\b/i.test(message)) return false;
  if (String(answer.errorMessage || '').trim() && !/accepted/i.test(message)) return false;
  return !!String(answer.uniqueId || '').trim() || /\baccepted\b|being processed/i.test(message);
}

/** API Contract v1.4: multipart/form-data, the token in a header named "token", the file in the "file" part. */
export async function sendFilingForm(config, tokenData, form) {
  return axios.post(`${config.baseUrl}/jsonfiling/v1.0/api/fileSubmit`, form, {
    headers: { ...form.getHeaders(), token: tokenData.token },
    httpsAgent: icegateAgent,
    timeout: FILE_SUBMIT_TIMEOUT_MS,
    validateStatus: null,
  });
}

/** The filing form: the (signed) JSON file, plus the detached PKCS#7 part for an old CMS signature only. */
export function buildFilingForm(fileName, fileText, signing) {
  const form = new FormData();
  form.append('file', Buffer.from(fileText, 'utf8'), { filename: fileName, contentType: 'application/json' });
  if (signing.signatureB64 && signing.attachP7s) {
    form.append('signature', Buffer.from(signing.signatureB64, 'base64'), {
      filename: fileName.replace('.json', '.p7s'),
      contentType: 'application/pkcs7-signature',
    });
  }
  return form;
}

export const loggedAnswer = (answer) => JSON.stringify(answer).substring(0, LOGGED_ANSWER_LENGTH);

/**
 * Signs the BE / SB JSON with the DSC token (no PIN = unsigned, which only the UAT server takes) and fills its
 * digSign block. A signing failure is noted on the job and answered with the signer's message.
 */
export async function signFilingFile(filingJson, jsonText, pin, { module, jobId, documentLabel, author }) {
  if (!pin) {
    console.warn('[ICEGATE] No token PIN provided – submitting unsigned (may be rejected in production).');
    return { fileText: jsonText, signatureB64: null, signerCn: '', attachP7s: true, signWarning: null };
  }
  let signature;
  try {
    signature = await signJsonWithDsc(jsonText, pin);
  } catch (signError) {
    console.error('[ICEGATE] Local signer error:', signError.message);
    const message = signError.userMessage || signError.message;
    await logIcegate(
      module,
      jobId,
      'ICEGATE_NOT_SENT',
      `${documentLabel} not sent to ICEGATE - the file could not be signed: ` + message,
      author,
    );
    throw new ApiError(signError.httpStatus || 500, message);
  }
  filingJson.digSign = {
    startSignature: signature.signatureB64,
    startCertificate: signature.certificateB64,
    signerVersion: signature.signerVersion,
  };
  console.log(
    '[ICEGATE] JSON signed via DSC token. Signer CN:',
    signature.signerCn,
    '| certificate:',
    signature.certificateB64 ? 'yes' : 'MISSING',
  );
  return {
    fileText: attachDigSign(jsonText, signature),
    signatureB64: signature.signatureB64,
    signerCn: signature.signerCn,
    attachP7s: isCmsSignature(signature),
    signWarning: signature.certificateB64 ? null : MISSING_CERTIFICATE_WARNING,
  };
}

/** Signs a BE / SB file for checking on ICEGATE's signer site; a signing failure answers with the signer's message. */
export async function signForChecking(jsonText, pin) {
  try {
    return await signJsonWithDsc(jsonText, pin);
  } catch (signError) {
    throw new ApiError(signError.httpStatus || 424, signError.userMessage || signError.message);
  }
}

const fileNamePart = (value) =>
  String(value || '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .slice(0, 40);

/** <BE|SB>_<job>_<ICEGATE ID>_SIGNED_NOT_SENT.json */
export const signedCheckFileName = (kind, jobPart, senderId) =>
  `${kind}_${fileNamePart(jobPart)}_${fileNamePart(senderId || 'ICEGATE')}_SIGNED_NOT_SENT.json`;

const credentialIsMasked = (value) => !value || String(value).startsWith('****');

async function configForLoginTest({ profileId, loginId, password, apiKey, baseUrl }) {
  if (!(loginId && apiKey)) return getIcegateConfig(profileId);
  const config = { loginId, password, apiKey, baseUrl: baseUrl || DEFAULT_ICEGATE_URL };
  // the screen shows saved secrets masked: those are taken from the saved profile
  const hasMaskedSecret = credentialIsMasked(config.password) || credentialIsMasked(config.apiKey);
  if (hasMaskedSecret && profileId && profileId !== 'new') {
    const savedConfig = await getIcegateConfig(profileId);
    if (credentialIsMasked(config.password)) config.password = savedConfig.password;
    if (credentialIsMasked(config.apiKey)) config.apiKey = savedConfig.apiKey;
  }
  return config;
}

/** POST /test-auth: logs in to ICEGATE afresh with the typed (or saved) credentials. */
export async function testIcegateLogin(request) {
  try {
    const config = await configForLoginTest(request);
    forgetToken(config.apiKey);
    if (!config.loginId || !config.password || !config.apiKey)
      throw new BadRequestError('ICEGATE credentials not configured.');
    const tokenData = await getAuthToken(config);
    return {
      success: true,
      status: tokenData.status,
      expiresAt: tokenData.expiresAt,
      message: 'Authentication successful',
    };
  } catch (error) {
    rethrowApiError(error);
    const errorBody = error.response?.data;
    const message = errorBody?.message || errorBody?.error || errorBody?.errorMessage || error.message;
    console.error('[ICEGATE] auth error status:', error.response?.status);
    console.error('[ICEGATE] auth error body:', JSON.stringify(errorBody));
    throw new InternalServerError(message, {
      body: { success: false, error: message, statusCode: error.response?.status, details: errorBody },
    });
  }
}

const jsonContentText = (jsonContent) =>
  typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent, null, 2);

async function submitPreparedFile({ jsonContent, fileName, profileId }) {
  const config = await getIcegateConfig(profileId);
  const tokenData = await getAuthToken(config);
  if (!jsonContent) throw new BadRequestError('jsonContent is required');

  const form = buildFilingForm(fileName || 'filing.json', jsonContentText(jsonContent), { signatureB64: null });
  const response = await sendFilingForm(config, tokenData, form);
  const answer = response.data;
  console.log('[ICEGATE] fileSubmit status:', response.status, '| response:', loggedAnswer(answer));

  if (!fileTaken(response.status, answer)) {
    const message = answer.errorMessage || answer.message || 'Filing failed';
    throw new BadRequestError(message, {
      body: { success: false, validationStatus: answer.validationStatus, error: message, details: answer },
    });
  }
  return {
    success: true,
    validationStatus: answer.validationStatus,
    message: answer.message,
    uniqueId: answer.uniqueId,
    errorMessage: answer.errorMessage,
  };
}

/** POST /file-submit: sends a BE / SB JSON file made elsewhere to ICEGATE as it is. */
export async function submitJsonFile(request) {
  try {
    return await submitPreparedFile(request);
  } catch (error) {
    rethrowApiError(error);
    const message = icegateErrorMessage(error);
    console.error('[ICEGATE] file-submit error:', message, error.response?.data);
    throw new InternalServerError(message, { body: { success: false, error: message, details: error.response?.data } });
  }
}

async function askAcknowledgement({ profileId, uniqueId, senderId }) {
  const config = await getIcegateConfig(profileId);
  const tokenData = await getAuthToken(config);
  if (!uniqueId) throw new BadRequestError('uniqueId is required');

  const response = await axios.post(
    `${config.baseUrl}/jsonfiling/v1.0/api/outbound/getAck`,
    { uniqueId, senderId: senderId || config.loginId },
    {
      headers: { 'Content-Type': 'application/json', token: tokenData.token },
      httpsAgent: icegateAgent,
      timeout: ACK_TIMEOUT_MS,
      validateStatus: null,
    },
  );
  console.log(
    '[ICEGATE] getAck status:',
    response.status,
    '| data:',
    JSON.stringify(response.data).substring(0, LOGGED_ACK_LENGTH),
  );
  return { success: true, data: response.data, status: response.status };
}

/** POST /get-ack (API Contract v1.4 section 5): the acknowledgement of a submitted file. */
export async function getAcknowledgement(request) {
  try {
    return await askAcknowledgement(request);
  } catch (error) {
    rethrowApiError(error);
    const message = error.response?.data?.message || error.message;
    throw new InternalServerError(message, { body: { success: false, error: message } });
  }
}

/** True when a getAck failure is a problem with the job (answered 400), not with reaching ICEGATE. */
export const isJobProblem = (error) =>
  !error.response && !/ECONN|ETIMEDOUT|ENOTFOUND/.test(String(error.code || error.message));

/** be-ack / sb-ack: an unexpected failure is answered as ICEGATE not reachable (502). */
export function icegateUnreachable(error) {
  rethrowApiError(error);
  const message = error.response?.data?.message || error.message;
  return new ApiError(502, 'Could not reach ICEGATE: ' + message);
}
