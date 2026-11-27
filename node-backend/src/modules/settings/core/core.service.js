import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Client as SshClient } from 'ssh2';
import { ASSETS_DIR } from '../../../config/env.js';
import * as settingsStore from '../../../utils/common/settingsStore.js';
import { clearCache as clearWebSecurityCache } from '../../../utils/security/webSecurity.js';
import { getSftpStatus } from '../../../utils/awb/FsuService.js';
import { ApiError, BadRequestError } from '../../../core/http/index.js';

const MINUTE_MS = 60 * 1000;
const SFTP_TEST_TIMEOUT_MS = 60 * 1000;
const SFTP_STATUS_STALE_MS = 15 * MINUTE_MS;
const EINVOICE_TEST_TIMEOUT_MS = 12 * 1000;
const EINVOICE_LOG_MAX_LENGTH = 500;
const BAD_GATEWAY = 502;
const MASKED_SECRET = '***';
const DEFAULT_TEST_HOST = 'ftptest.myvan.descartes.com';
const DEFAULT_PROD_HOST = 'ftp.myvan.descartes.com';
const SSH_KEY_BITS = 4096;
const DEFAULT_LOGO_FILE = path.join(ASSETS_DIR, 'company_logo.jpg');

// ---- Settings key / value store --------------------------------------------------------------------------------
export function getPublicSettings() {
  return settingsStore.getPublic();
}

export async function saveSetting(key, value) {
  await settingsStore.setMany({ [key]: value });
}

/** The public address / office IPs are used at once. */
export async function saveSettings(settings) {
  await settingsStore.setMany(settings);
  clearWebSecurityCache();
}

// ---- Descartes SFTP -------------------------------------------------------------------------------------------
// Same algorithms as FsuService.js: chacha20-poly1305 causes ECONNRESET on Descartes.
const DESCARTES_ALGORITHMS = {
  cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes192-ctr', 'aes128-ctr'],
  kex: ['diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384'],
  hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
};

const isMaskedKey = (key) => !key || key === MASKED_SECRET || key === 'undefined';

/**
 * The screen may override host / port / username; the private key and password come from the database when the
 * screen sends them masked or empty (the browser never holds the stored secrets).
 */
function sftpTestSettings(body, stored) {
  const environment = body.env || stored.sftp_active_env || 'test';
  const activeHost =
    environment === 'test'
      ? stored.sftp_test_host || stored.sftp_host || DEFAULT_TEST_HOST
      : stored.sftp_prod_host || stored.sftp_host || DEFAULT_PROD_HOST;
  const password = !body.password || body.password === MASKED_SECRET ? stored.sftp_password || '' : body.password;
  return {
    environment,
    host: body.host || activeHost,
    port: parseInt(body.port || stored.sftp_port || '22'),
    username: body.username || stored.sftp_username || '',
    passphrase: body.passphrase || stored.sftp_passphrase || '',
    privateKey: isMaskedKey(body.privateKey) ? stored.sftp_private_key || '' : body.privateKey,
    password,
  };
}

function sshConnectOptions({ host, port, username, privateKey, passphrase, password }) {
  const options = { host, port, username, readyTimeout: SFTP_TEST_TIMEOUT_MS, algorithms: DESCARTES_ALGORITHMS };
  if (privateKey) {
    options.privateKey = privateKey;
    if (passphrase) options.passphrase = passphrase;
  } else {
    options.password = password;
  }
  return options;
}

/** Answers with the first outcome of the connection: ready or error. */
function tryConnect(connection) {
  const { host, port, environment } = connection;
  return new Promise((resolve) => {
    const client = new SshClient();
    client.on('ready', () => {
      client.end();
      resolve({ success: true, message: `Connected to ${host}:${port} successfully! [${environment.toUpperCase()}]` });
    });
    client.on('error', (error) => resolve({ success: false, message: `Connection failed: ${error.message}` }));
    client.connect(sshConnectOptions(connection));
  });
}

export async function testSftpConnection(body) {
  const stored = await settingsStore.getAll();
  const connection = sftpTestSettings(body, stored);
  if (!connection.username) {
    return { success: false, message: 'Username not configured. Enter SFTP username in Settings.' };
  }
  if (!connection.privateKey && !connection.password) {
    return { success: false, message: 'No SSH key found in database. Please generate an SSH key first.' };
  }
  return tryConnect(connection);
}

export async function exportPrivateKey() {
  const privateKey = await settingsStore.get('sftp_private_key');
  if (!privateKey) return { success: false, message: 'Private key not found in DB. Please generate SSH key first.' };
  return { success: true, privateKey, message: 'Private key successfully exported.' };
}

/** Derives the OpenSSH public key from the stored private key. */
export async function exportPublicKey() {
  const privateKey = await settingsStore.get('sftp_private_key');
  if (!privateKey) {
    return { success: false, message: 'Private key not found in database. Please generate an SSH key first.' };
  }
  const publicKeyPem = crypto
    .createPublicKey(crypto.createPrivateKey(privateKey))
    .export({ type: 'spki', format: 'pem' });
  return {
    success: true,
    publicKey: convertPemToOpenSsh(publicKeyPem, 'edi-automation'),
    message: 'Public key derived from stored private key.',
  };
}

/** RSA 4096-bit as recommended by the Descartes FAQ (Q3); the private key in PKCS1 (BEGIN RSA PRIVATE KEY). */
export async function generateSshKey(saveToDb) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: SSH_KEY_BITS,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  const sshPublicKey = convertPemToOpenSsh(publicKey, 'edi-automation-descartes');
  if (saveToDb) {
    await settingsStore.setMany({ sftp_private_key: privateKey });
    await (await settingsStore.row('SftpConfig')).update({ publicKey: sshPublicKey });
  }
  return {
    success: true,
    publicKey: sshPublicKey,
    privateKeyPem: privateKey,
    savedToDb: !!saveToDb,
    message: 'SSH key pair generated! Copy the Public Key and email it to Descartes (Dejin).',
  };
}

/** An SSH string field: 4-byte big-endian length + bytes. */
function encodeSshString(text) {
  const data = Buffer.from(text, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, data]);
}

/**
 * An SSH MPInteger (RFC 4251 section 5). JWK gives integers as minimum-length unsigned big-endian; SSH needs a
 * leading 0x00 byte when the high bit is set, so the number stays positive in two's complement. Without it a 4096-bit
 * modulus (high bit always set) would be read as negative and rejected by any SSH server.
 */
function encodeSshMpInt(base64Url) {
  const raw = Buffer.from(base64Url, 'base64');
  const padded = raw[0] >= 0x80 ? Buffer.concat([Buffer.alloc(1), raw]) : raw;
  const length = Buffer.alloc(4);
  length.writeUInt32BE(padded.length);
  return Buffer.concat([length, padded]);
}

/** RSA PEM public key -> OpenSSH wire format "ssh-rsa AAAA... comment". */
function convertPemToOpenSsh(pemPublicKey, comment = 'edi-automation') {
  const jwk = crypto.createPublicKey(pemPublicKey).export({ format: 'jwk' });
  const wireBytes = Buffer.concat([encodeSshString('ssh-rsa'), encodeSshMpInt(jwk.e), encodeSshMpInt(jwk.n)]);
  return `ssh-rsa ${wireBytes.toString('base64')}${comment ? ' ' + comment : ''}`;
}

/** Live Descartes SFTP status: "connected" only when the last connection is at most 15 minutes old. */
export function sftpConnectionStatus() {
  try {
    const status = getSftpStatus();
    const stale = status.lastConnectedAt
      ? Date.now() - new Date(status.lastConnectedAt).getTime() > SFTP_STATUS_STALE_MS
      : true;
    return {
      connected: status.connected && !stale,
      lastConnectedAt: status.lastConnectedAt,
      lastCheckedAt: status.lastCheckedAt,
      lastError: status.lastError,
      host: status.host,
      env: status.env,
      stale,
    };
  } catch (error) {
    return { connected: false, lastError: error.message };
  }
}

// ---- Company profile ---------------------------------------------------------------------------------------------
/** The logo the GST invoice prints when none is uploaded. */
export function defaultCompanyLogo() {
  const exists = fs.existsSync(DEFAULT_LOGO_FILE);
  const dataUrl = exists ? 'data:image/jpeg;base64,' + fs.readFileSync(DEFAULT_LOGO_FILE).toString('base64') : '';
  return { success: true, dataUrl };
}

/** The e-invoice API password is never sent to the browser - only whether one is saved. */
function companyAnswer(profileRow) {
  const profile = profileRow.toJSON();
  profile.hasEinvoicePass = !!profile.einvoicePass;
  delete profile.einvoicePass;
  return { success: true, data: profile };
}

export async function getCompanyProfile() {
  return companyAnswer(await settingsStore.row('CompanyProfile'));
}

export async function updateCompanyProfile(values) {
  const profileRow = await settingsStore.row('CompanyProfile');
  await profileRow.update(values);
  return companyAnswer(profileRow);
}

// ---- Email (SMTP): the same EmailConfig row the Settings > Email tab writes through /bulk ----------------------
/** The stored SMTP password is never handed back to the browser - only whether one is set. */
function emailAnswer(emailRow) {
  const email = emailRow.toJSON();
  const hasPassword = !!email.smtpPass;
  delete email.smtpPass;
  return { success: true, data: { ...email, hasPassword } };
}

export async function getEmailSettings() {
  return emailAnswer(await settingsStore.row('EmailConfig'));
}

export async function updateEmailSettings(values) {
  const emailRow = await settingsStore.row('EmailConfig');
  await emailRow.update(values);
  return emailAnswer(emailRow);
}

// ---- E-invoice API connection test ------------------------------------------------------------------------------
// It never reports a success it did not get: no URL configured, an unreachable host and an HTTP error are three
// different answers. The outcome is kept on the company profile.
async function saveEinvoiceTestResult(profileRow, ok, message) {
  try {
    await profileRow.update({
      einvoiceLastTestAt: new Date(),
      einvoiceLastTestOk: ok,
      einvoiceLastTestMessage: String(message).slice(0, EINVOICE_LOG_MAX_LENGTH),
    });
  } catch {
    // the answer matters more than the log
  }
}

function einvoiceSettingsProblem(url, username) {
  if (!url) {
    return (
      'No e-invoice API URL is saved yet. Fill "E-Invoice API URL" with the endpoint your GSP gave you (for example ' +
      'https://<gsp-host>/eivital/v1.04/auth) and save, then test.'
    );
  }
  if (!/^https?:\/\//i.test(url)) return 'The e-invoice API URL must start with https:// - got "' + url + '"';
  if (!username) {
    return (
      'The e-invoice API username is empty, so there is nothing to authenticate with. The URL itself can still be ' +
      'reached - fill the username and password before filing.'
    );
  }
  return null;
}

async function readBodyStart(response) {
  try {
    return (await response.text()).slice(0, 300);
  } catch {
    return '';
  }
}

/**
 * A GSP auth endpoint answering 401/403/405 to a bare GET still proves the host is reachable and the path exists.
 * That is as far as a test can honestly go without sending the real credentials.
 */
function reachedMessage(status, elapsedMs, bodyStart) {
  const looksRight = status < 500;
  return (
    'Host answered HTTP ' +
    status +
    ' in ' +
    elapsedMs +
    ' ms' +
    (looksRight
      ? ' - the endpoint is reachable. A 401/403/405 here is normal: the real login is only sent when an invoice is filed.'
      : ' - the endpoint is reachable but returned a server error, so it is not ready to file against.') +
    (bodyStart ? ' Response starts: ' + bodyStart.replace(/\s+/g, ' ').slice(0, 160) : '')
  );
}

function unreachedMessage(error, url) {
  if (error.name === 'AbortError') {
    return (
      'No answer from ' +
      url +
      ' within 12 seconds. Check the URL, and whether this server is allowed out to that host.'
    );
  }
  return (
    'Could not reach ' + url + ' - ' + error.message + '. Check the URL, DNS, and the firewall / proxy on this server.'
  );
}

export async function testEinvoiceConnection(body) {
  const startedAt = Date.now();
  const profileRow = await settingsStore.row('CompanyProfile');
  const profile = profileRow.toJSON();
  const url = String((body && body.baseUrl) || profile.einvoiceBaseUrl || '').trim();
  const username = String((body && body.username) || profile.einvoiceUser || '').trim();

  const problem = einvoiceSettingsProblem(url, username);
  if (problem) {
    await saveEinvoiceTestResult(profileRow, false, problem);
    throw new BadRequestError(problem, { body: { success: false, configured: false, error: problem } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EINVOICE_TEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'EDI-Automation/settings-test' },
    });
    clearTimeout(timer);
    const elapsedMs = Date.now() - startedAt;
    const bodyStart = await readBodyStart(response);
    const looksRight = response.status < 500;
    const message = reachedMessage(response.status, elapsedMs, bodyStart);
    await saveEinvoiceTestResult(profileRow, looksRight, message);
    return {
      success: looksRight,
      configured: true,
      reachable: true,
      httpStatus: response.status,
      ms: elapsedMs,
      message,
      username,
      url,
      body: bodyStart || undefined,
    };
  } catch (error) {
    clearTimeout(timer);
    const elapsedMs = Date.now() - startedAt;
    const message = unreachedMessage(error, url);
    await saveEinvoiceTestResult(profileRow, false, message);
    throw new ApiError(BAD_GATEWAY, message, {
      body: { success: false, configured: true, reachable: false, ms: elapsedMs, error: message },
    });
  }
}
