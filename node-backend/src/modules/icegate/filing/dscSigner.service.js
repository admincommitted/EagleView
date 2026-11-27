import axios from 'axios';
import FormData from 'form-data';
import { AppSetting } from '../../../models/index.js';
import { ApiError, BadRequestError } from '../../../core/http/index.js';

// The Local Signer (local_signer/app.py, PKCS#11 hardware token) signs every ICEGATE file and e-Sanchit PDF. Its URL is
// one setting (icegate_dsc_signer_url, or DSC_SIGNER_URL), so a signer on another machine or port can be used.
const SIGNER_URL_SETTING = 'icegate_dsc_signer_url';
const DEFAULT_SIGNER_URL = 'http://localhost:5050';
const SIGN_JSON_TIMEOUT_MS = 30000;
const SIGNER_STATUS_TIMEOUT_MS = 12000;
const SIGN_PDF_TIMEOUT_MS = 60000;
const PDF_MAGIC = '%PDF-';
// 424, not 500: a 500 carrying "ECONNREFUSED" is replaced by "Server error (ref ...)" before it reaches the screen
const SIGNER_UNREACHABLE_STATUS = 424;

/** A signing failure; userMessage is what the operator is told, httpStatus the answer status. */
class DscSigningError extends Error {
  constructor(message, userMessage, httpStatus) {
    super(message);
    this.name = 'DscSigningError';
    this.userMessage = userMessage;
    this.httpStatus = httpStatus;
  }
}

const withoutTrailingSlashes = (url) => url.replace(/\/+$/, '');

async function getSignerUrl() {
  try {
    const row = await AppSetting.findOne({ where: { key: SIGNER_URL_SETTING } });
    if (row && String(row.value || '').trim()) return withoutTrailingSlashes(String(row.value).trim());
  } catch {
    // no settings table yet: the environment / default is used
  }
  return withoutTrailingSlashes(String(process.env.DSC_SIGNER_URL || DEFAULT_SIGNER_URL).trim());
}

function signerFailureMessage(signerUrl, signerAnswered, detail) {
  if (signerAnswered) {
    return (
      'DSC signing failed at ' +
      signerUrl +
      ': ' +
      detail +
      ' (check that the token is plugged in, the PIN is right and the token drivers are installed)'
    );
  }
  return (
    'DSC Signer not reachable at ' +
    signerUrl +
    '. Start the Local Signer app and insert the DSC token' +
    ' (a signer on another machine or port is set in Settings > ICEGATE > DSC signer URL). Details: ' +
    detail
  );
}

/**
 * Signs the JSON text and returns the parts the ICEGATE digSign block wants. A signer that does not send its
 * certificate (older local_signer/app.py) gives an empty certificateB64; the caller says so in its answer.
 */
export async function signJsonWithDsc(jsonText, pin) {
  const signerUrl = await getSignerUrl();
  let signerAnswer;
  try {
    const response = await axios.post(
      signerUrl + '/sign-json',
      { json_data: jsonText, pin },
      { timeout: SIGN_JSON_TIMEOUT_MS },
    );
    signerAnswer = response.data || {};
  } catch (error) {
    const signerAnswered = !!error.response;
    const detail = error.response?.data?.error ? error.response.data.error : error.message;
    throw new DscSigningError(
      detail,
      signerFailureMessage(signerUrl, signerAnswered, detail),
      signerAnswered ? 400 : SIGNER_UNREACHABLE_STATUS,
    );
  }
  if (!signerAnswer.success) {
    const reason = signerAnswer.error || 'Unknown error';
    throw new DscSigningError(reason, 'DSC signing failed: ' + reason, 400);
  }
  return {
    signatureB64: signerAnswer.signature_b64 || '',
    signerCn: signerAnswer.signer_cn || '',
    certificateB64: signerAnswer.certificate_b64 || '',
    signerVersion: String(signerAnswer.signer_version || '1'),
    signerUrl,
  };
}

/**
 * The signed file in the layout ICEGATE's own signer utility writes: the text that was signed with its closing "}"
 * replaced by the digSign block.
 */
export function attachDigSign(jsonText, signature) {
  const body = String(jsonText).replace(/\n\}\s*$/, '');
  return (
    body +
    '\n,\n"digSign":\n{\n"startSignature":' +
    JSON.stringify(signature.signatureB64 || '') +
    ',\n"startCertificate":' +
    JSON.stringify(signature.certificateB64 || '') +
    ',\n"signerVersion":' +
    JSON.stringify(signature.signerVersion || '1.0') +
    '\n}\n}'
  );
}

/** signerVersion 1 = a PKCS#7 (CMS) signature sent as its own .p7s part; the ICEGATE format (1.0) lives in digSign only. */
export function isCmsSignature(signature) {
  return !!signature && String(signature.signerVersion || '') === '1';
}

/** Is the signer running, and does it see the token drivers? */
export async function getSignerStatus() {
  const signerUrl = await getSignerUrl();
  try {
    const response = await axios.get(signerUrl + '/status', { timeout: SIGNER_STATUS_TIMEOUT_MS });
    return { success: true, signerUrl, ...response.data };
  } catch (error) {
    return { success: false, signerUrl, status: 'not running', dll_found: false, error: error.message };
  }
}

const isPdf = (buffer) => buffer.slice(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC;

function signerErrorDetail(error) {
  let detail = error.message;
  if (error.response && error.response.data) {
    try {
      detail = JSON.parse(Buffer.from(error.response.data).toString('utf8')).error || detail;
    } catch {
      // the signer's answer is not JSON
    }
  }
  return detail;
}

function notPdfDetail(signedBuffer) {
  let detail = 'the signer did not answer with a PDF';
  try {
    detail = JSON.parse(signedBuffer.toString('utf8')).error || detail;
  } catch {
    // not JSON either
  }
  return detail;
}

async function postPdfToSigner(signerUrl, pdfBuffer, originalName, pin) {
  const form = new FormData();
  form.append('pdf', pdfBuffer, { filename: originalName || 'document.pdf', contentType: 'application/pdf' });
  form.append('pin', pin);
  return axios.post(signerUrl + '/sign-pdf', form, {
    headers: form.getHeaders(),
    responseType: 'arraybuffer',
    timeout: SIGN_PDF_TIMEOUT_MS,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
}

/** Signs one document PDF with the DSC token through the Local Signer and returns the signed PDF. */
export async function signPdfDocument(uploadedFile, pinValue) {
  if (!uploadedFile || !uploadedFile.buffer || !uploadedFile.buffer.length)
    throw new BadRequestError('PDF file is required');
  if (!isPdf(uploadedFile.buffer)) throw new BadRequestError('The file is not a PDF (header check failed)');
  const pin = String(pinValue || '').trim();
  if (!pin) throw new BadRequestError('DSC token PIN is required');

  const signerUrl = await getSignerUrl();
  let response;
  try {
    response = await postPdfToSigner(signerUrl, uploadedFile.buffer, uploadedFile.originalname, pin);
  } catch (error) {
    const signerAnswered = !!error.response;
    throw new ApiError(
      signerAnswered ? 400 : 500,
      signerFailureMessage(signerUrl, signerAnswered, signerErrorDetail(error)),
    );
  }
  const signedPdf = Buffer.from(response.data);
  if (!isPdf(signedPdf)) throw new BadRequestError('DSC signing failed: ' + notPdfDetail(signedPdf));
  return signedPdf;
}
