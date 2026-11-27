// Post To GSTN: the e-invoice IRP API (NIC e-invoice API 1.03 / 1.04). Credentials are entered on E-Invoice Settings
// and kept in the settings store; the password and client secret never go back to the browser. The base URL is the
// NIC sandbox / production API or a GSP giving the same API.
import crypto from 'node:crypto';
import { getMany, setMany } from '../../../../utils/common/settingsStore.js';
import { eInvoiceJson } from '../shared/eInvoiceJson.js';
import { badRequest, ensureInvoiceTables, runSql, selectRows, statusOf, todayIso } from '../shared/invoiceDb.js';
import { fromIcaffe } from '../shared/invoiceKinds.js';
import { ourGst } from '../shared/ourCompany.js';

const EINV_KEYS = [
  'einv_base_url',
  'einv_client_id',
  'einv_client_secret',
  'einv_username',
  'einv_password',
  'einv_gstin',
  'einv_public_key',
];
const EINV_SECRET_KEYS = new Set(['einv_client_secret', 'einv_password']);
const SETTING_KEY_OF_FIELD = {
  baseUrl: 'einv_base_url',
  clientId: 'einv_client_id',
  clientSecret: 'einv_client_secret',
  username: 'einv_username',
  password: 'einv_password',
  gstin: 'einv_gstin',
  publicKey: 'einv_public_key',
};
const SANDBOX_URL = 'https://einv-apisandbox.nic.in';
const IRP_TIMEOUT_MS = 45000;
const TOKEN_REFRESH_MARGIN_MS = 60000;
const DEFAULT_TOKEN_LIFE_MS = 5 * 3600 * 1000;
const IST_OFFSET = '+05:30';
const DUPLICATE_IRN_CODE = '2150';
// errors after which the next invoices of a batch would fail the same way
const STOP_BATCH_ERROR = /not set up|login failed|reach the IRP/i;

const einvSettings = () => getMany(EINV_KEYS);

const isApiSetUp = (settings) =>
  !!(
    settings.einv_client_id &&
    settings.einv_client_secret &&
    settings.einv_username &&
    settings.einv_password &&
    settings.einv_public_key
  );

export async function eInvoiceSettings() {
  const settings = await einvSettings();
  return {
    baseUrl: settings.einv_base_url || SANDBOX_URL,
    clientId: settings.einv_client_id || '',
    username: settings.einv_username || '',
    gstin: settings.einv_gstin || '',
    clientSecretSet: !!settings.einv_client_secret,
    passwordSet: !!settings.einv_password,
    publicKeySet: /BEGIN PUBLIC KEY/.test(settings.einv_public_key || ''),
    ready: isApiSetUp(settings),
  };
}

// { base, token, sek, until } of the logged-in IRP session
let irpSession = null;

function checkSettingValue(key, value) {
  if (key === 'einv_public_key' && !/-----BEGIN PUBLIC KEY-----/.test(value)) {
    throw badRequest('Public key: paste the PEM text from NIC (-----BEGIN PUBLIC KEY----- ...)');
  }
  if (key === 'einv_base_url' && value && !/^https:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(value)) {
    throw badRequest('Base URL should start with https://');
  }
  if (key === 'einv_gstin' && value && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(value))
    throw badRequest('GSTIN should be 15 characters');
}

export async function saveEInvoiceSettings(body) {
  const fields = body || {};
  const changes = {};
  for (const [field, key] of Object.entries(SETTING_KEY_OF_FIELD)) {
    if (fields[field] === undefined) continue;
    const value = String(fields[field] || '').trim();
    if (EINV_SECRET_KEYS.has(key) && (!value || value.startsWith('***'))) continue; // keep the saved secret
    if (key === 'einv_public_key' && !value) continue;
    checkSettingValue(key, value);
    changes[key] = value;
  }
  await setMany(changes);
  irpSession = null;
  return { ok: true };
}

const aes = (key, buffer, decrypt) => {
  const cipher = (decrypt ? crypto.createDecipheriv : crypto.createCipheriv)('aes-256-ecb', key, null);
  return Buffer.concat([cipher.update(buffer), cipher.final()]);
};

const irpErrorText = (reply) =>
  ((reply && reply.ErrorDetails) || []).map((detail) => detail.ErrorCode + ': ' + detail.ErrorMessage).join('; ') ||
  (reply && (reply.error || reply.message)) ||
  'no reason given';

/** One HTTP call to the IRP, with a 45-second limit; the reply must be JSON. */
async function callIrp(url, options, base) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IRP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw badRequest('IRP replied ' + response.status + ': ' + text.slice(0, 200));
    }
  } catch (error) {
    if (error.name === 'AbortError') throw badRequest('IRP did not reply in 45 seconds');
    throw statusOf(error) ? error : badRequest('Could not reach the IRP (' + base + '): ' + error.message);
  } finally {
    clearTimeout(timer);
  }
}

const tokenExpiry = (expiry) =>
  expiry ? new Date(String(expiry).replace(' ', 'T') + IST_OFFSET).getTime() : Date.now() + DEFAULT_TOKEN_LIFE_MS;

// the login payload is RSA-encrypted with NIC's public key; the reply's SEK is AES-encrypted with our app key
async function logIn(settings, base, headers) {
  const appKey = crypto.randomBytes(32);
  const credentials = JSON.stringify({
    UserName: settings.einv_username,
    Password: settings.einv_password,
    AppKey: appKey.toString('base64'),
    ForceRefreshAccessToken: false,
  });
  const payload = Buffer.from(Buffer.from(credentials).toString('base64'));
  const data = crypto
    .publicEncrypt({ key: settings.einv_public_key, padding: crypto.constants.RSA_PKCS1_PADDING }, payload)
    .toString('base64');
  const reply = await callIrp(
    base + '/eivital/v1.04/auth',
    { method: 'POST', headers, body: JSON.stringify({ Data: data }) },
    base,
  );
  if (String(reply.Status) !== '1' || !reply.Data) throw badRequest('IRP login failed: ' + irpErrorText(reply));
  irpSession = {
    base,
    token: reply.Data.AuthToken,
    sek: aes(appKey, Buffer.from(reply.Data.Sek, 'base64'), true),
    until: tokenExpiry(reply.Data.TokenExpiry),
  };
}

/** A call to the IRP API with the session (logged in again when the token is near its end). */
export async function irpCall(path, { method = 'POST', body } = {}) {
  const settings = await einvSettings();
  if (!isApiSetUp(settings)) {
    throw badRequest(
      'E-Invoice API is not set up - open E-Invoice Settings (client id, secret, user, password, NIC public key)',
    );
  }
  const base = String(settings.einv_base_url || SANDBOX_URL).replace(/\/+$/, '');
  const gstin = settings.einv_gstin || (await ourGst()).gstin;
  const headers = {
    'Content-Type': 'application/json',
    client_id: settings.einv_client_id,
    client_secret: settings.einv_client_secret,
    Gstin: gstin,
  };
  if (!irpSession || irpSession.until < Date.now() + TOKEN_REFRESH_MARGIN_MS || irpSession.base !== base) {
    await logIn(settings, base, headers);
  }
  const options = { method, headers: { ...headers, user_name: settings.einv_username, AuthToken: irpSession.token } };
  if (body)
    options.body = JSON.stringify({ Data: aes(irpSession.sek, Buffer.from(JSON.stringify(body))).toString('base64') });
  const reply = await callIrp(base + path, options, base);
  if (String(reply.Status) !== '1') {
    return {
      ok: false,
      error: irpErrorText(reply),
      codes: (reply.ErrorDetails || []).map((detail) => String(detail.ErrorCode)),
      info: reply.InfoDtls,
    };
  }
  const data =
    typeof reply.Data === 'string'
      ? JSON.parse(aes(irpSession.sek, Buffer.from(reply.Data, 'base64'), true).toString('utf8'))
      : reply.Data;
  return { ok: true, data };
}

// a duplicate IRN was generated before (e.g. on the portal): it is fetched instead
async function generateIrn(payload) {
  const generated = await irpCall('/eicore/v1.03/Invoice', { body: payload });
  if (generated.ok || !generated.codes.includes(DUPLICATE_IRN_CODE)) return generated;
  const { Typ, No, Dt } = payload.DocDtls;
  const existing = await irpCall(
    `/eicore/v1.03/Invoice/irnbydocdetails?doctype=${Typ}&docnum=${encodeURIComponent(No)}&docdate=${Dt}`,
    { method: 'GET' },
  );
  return existing.ok ? existing : generated;
}

async function postOneInvoice(invoice, userName) {
  if (fromIcaffe(invoice))
    return { invoiceNo: invoice.invoiceNo, ok: false, error: 'loaded from iCAFFE - its e-invoice is with iCAFFE' };
  if (invoice.irn && invoice.irnStatus !== 'Cancelled') {
    return {
      invoiceNo: invoice.invoiceNo,
      ok: true,
      irn: invoice.irn,
      note: 'already has an IRN',
    };
  }
  if (invoice.irn && invoice.irnStatus === 'Cancelled') {
    return {
      invoiceNo: invoice.invoiceNo,
      ok: false,
      error: 'its IRN was cancelled - the IRP gives no new IRN to the same number; void it and make a new invoice',
    };
  }
  const payload = await eInvoiceJson(invoice, await ourGst());
  const result = await generateIrn(payload);
  if (!result.ok) return { invoiceNo: invoice.invoiceNo, ok: false, error: result.error };
  const irn = result.data;
  await runSql(
    "UPDATE AccSalesInvoices SET irn = ?, ackNo = ?, ackDate = ?, signedQr = ?, irnStatus = 'Generated', irnCancelReason = NULL, modifiedBy = ?, updatedAt = ? WHERE id = ?",
    [
      irn.Irn,
      String(irn.AckNo || ''),
      String(irn.AckDt || todayIso()).slice(0, 10),
      irn.SignedQRCode || null,
      userName || null,
      new Date().toISOString(),
      invoice.id,
    ],
  );
  return {
    invoiceNo: invoice.invoiceNo,
    ok: true,
    irn: irn.Irn,
    ackNo: irn.AckNo,
  };
}

/** Generates the IRN of each chosen invoice on the IRP; one result per invoice. */
export async function postToGstn(body, userName) {
  await ensureInvoiceTables();
  const requested = (body || {}).ids;
  const ids = (Array.isArray(requested) ? requested : []).map(Number).filter(Boolean);
  if (!ids.length) throw badRequest('Choose the invoices');
  const results = [];
  const invoices = await selectRows(`SELECT * FROM AccSalesInvoices WHERE id IN (${ids.join(',')}) ORDER BY date, id`);
  for (const invoice of invoices) {
    try {
      results.push(await postOneInvoice(invoice, userName));
    } catch (error) {
      results.push({ invoiceNo: invoice.invoiceNo, ok: false, error: error.message });
      if (STOP_BATCH_ERROR.test(error.message)) break;
    }
  }
  return { results };
}
