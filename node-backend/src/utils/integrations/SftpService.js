/**
 * Uploads XFWB/XFHL XML to Descartes myVan (GLN) via SFTP (FTP-over-SSH).
 * Ref: myVan_SFTP_faq.pdf — Descartes Systems Group
 *
 * Connection: sftp://ftp.myvan.descartes.com:22
 * Auth:       SSH Public Key (registered with Descartes) or Password
 * Retry:      Exponential backoff as per FAQ Q12
 * Errors:     SSH_FX_FILE_ALREADY_EXISTS(11) = duplicate, do NOT retry
 *
 * Compliance:
 *  FAQ Q23 — Max 4 concurrent sessions; do not poll > once per 5 min
 *  FAQ Q24 — readyTimeout = 300s minimum
 *  FAQ Q28 — Approved ciphers only (chacha20-poly1305 preferred)
 *  FAQ Q29 — Approved KEX only (no SHA1)
 *  FAQ Q30 — Approved MACs only (no MD5/SHA1)
 *  FAQ Q32 — File size ≤ 1 MB (default quota)
 *  FAQ Q4/Q7 — Verify Descartes server host key fingerprint
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import ssh2 from 'ssh2';
import * as settingsStore from '../common/settingsStore.js';

const { Client } = ssh2;

// SFTP error codes (FAQ Q9, Q24, Q25)
const SFTP_ERRORS = {
  11: 'DUPLICATE — File already received by myVan. Do NOT retry.',
  15: 'QUOTA_EXCEEDED — File size exceeds policy limit (default 1 MB).',
  4: 'FAILURE — Error processing document.',
  28: 'FILE_CORRUPT — Image file is invalid or not G4 TIFF.',
};

// codes that must NEVER be retried
const PERMANENT_CODES = new Set([11, 15, 4, 28]);

// SHA-256 fingerprints of the Descartes SFTP server public keys (myVan_SFTP_faq.pdf Q4, Q7)
const DESCARTES_HOST_FINGERPRINTS = {
  'wwwtest.myvan.descartes.com': '5/EES6hJV79LynBLAif+423eRh9la0k1SptzqFlMiOA=',
  'ftp.myvan.descartes.com': '8ZiX8uV0j/8mCMhYw4wcEHO6729tVPMpYVwsADbT1t0=',
};

const DEFAULT_PROD_HOST = 'ftp.myvan.descartes.com';
const DEFAULT_TEST_HOST = 'wwwtest.myvan.descartes.com';
const DEFAULT_PORT = '22';
const READY_TIMEOUT_MS = 300000; // FAQ Q24: minimum 300 s
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // FAQ Q32: 1 MB default quota
const RETRY_DELAYS_MS = [60000, 120000, 480000]; // FAQ Q12: 1 min, 2 min, 8 min

// FAQ Q23: Descartes blocks the IP above 4 concurrent sessions and asks for at least 5 min between polls
const sessionState = {
  active: 0,
  lastUploadAt: null,
  MAX_SESSIONS: 4,
  MIN_POLL_GAP: 5 * 60 * 1000,
};

function acquireSession() {
  if (sessionState.active >= sessionState.MAX_SESSIONS) {
    throw new Error(
      `[SFTP] Rate limit: ${sessionState.MAX_SESSIONS} concurrent sessions already active. ` +
        'Descartes will block your IP if exceeded (FAQ Q23).',
    );
  }
  const now = Date.now();
  // event-driven uploads are exempt from the poll gap (FAQ Q23), so a short gap only warns
  if (sessionState.lastUploadAt && now - sessionState.lastUploadAt < sessionState.MIN_POLL_GAP) {
    const secondsSinceLast = Math.round((now - sessionState.lastUploadAt) / 1000);
    console.warn(
      `[SFTP] Warning: last upload was ${secondsSinceLast}s ago. Descartes recommends ≥5 min between polls (FAQ Q23).`,
    );
  }
  sessionState.active++;
  sessionState.lastUploadAt = now;
}

function releaseSession() {
  if (sessionState.active > 0) sessionState.active--;
}

function checkFileSize(content, fileName) {
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `[SFTP] File too large: ${fileName} is ${(sizeBytes / 1024).toFixed(1)} KB ` +
        `(Descartes limit: 1 MB). Split into smaller files (FAQ Q32).`,
    );
  }
  return sizeBytes;
}

const activeHostOf = (settings, activeEnv) =>
  activeEnv === 'test'
    ? settings['sftp_test_host'] || DEFAULT_TEST_HOST
    : settings['sftp_prod_host'] || settings['sftp_host'] || DEFAULT_PROD_HOST;

function configFromEnvOnly() {
  return {
    host: process.env.SFTP_HOST || DEFAULT_PROD_HOST,
    port: parseInt(process.env.SFTP_PORT || DEFAULT_PORT),
    username: process.env.SFTP_USERNAME || '',
    password: process.env.SFTP_PASSWORD || '',
    privateKey: process.env.SFTP_PRIVATE_KEY || '',
    passphrase: process.env.SFTP_PASSPHRASE || '',
    privateKeyPath: process.env.SFTP_PRIVATE_KEY_PATH || '',
    readyTimeout: READY_TIMEOUT_MS,
    activeEnv: 'production',
  };
}

// settings from table SftpConfig, .env as fallback (and as the whole config if the table cannot be read)
async function getConfig() {
  try {
    const settings = await settingsStore.getAll();
    const activeEnv = settings['sftp_active_env'] || 'production';
    return {
      host: activeHostOf(settings, activeEnv),
      port: parseInt(settings['sftp_port'] || process.env.SFTP_PORT || DEFAULT_PORT),
      username: settings['sftp_username'] || process.env.SFTP_USERNAME || '',
      password: settings['sftp_password'] || process.env.SFTP_PASSWORD || '',
      privateKey: settings['sftp_private_key'] || process.env.SFTP_PRIVATE_KEY || '',
      passphrase: settings['sftp_passphrase'] || process.env.SFTP_PASSPHRASE || '',
      privateKeyPath: process.env.SFTP_PRIVATE_KEY_PATH || '',
      readyTimeout: READY_TIMEOUT_MS,
      activeEnv,
    };
  } catch {
    return configFromEnvOnly();
  }
}

// missing settings are permanent errors: retrying cannot help
function checkConfigComplete(config) {
  if (!config.username) {
    throw Object.assign(new Error('SFTP username not configured. Set it in Settings → Network/SFTP.'), {
      isPermanent: true,
    });
  }
  if (!config.privateKey && !config.privateKeyPath && !config.password) {
    throw Object.assign(
      new Error('SFTP authentication not configured. Set SSH Key or Password in Settings → Network/SFTP.'),
      { isPermanent: true },
    );
  }
}

function loadPrivateKey(config) {
  if (config.privateKey || !config.privateKeyPath) return config.privateKey;
  try {
    return fs.readFileSync(config.privateKeyPath, 'utf8');
  } catch {
    console.warn('[SFTP] Could not read private key from path:', config.privateKeyPath);
    return config.privateKey;
  }
}

// compares the server's public key fingerprint with the known Descartes fingerprints (FAQ Q4, Q7)
const hostVerifierFor = (host) => (hostKey, callback) => {
  const expectedFingerprint = DESCARTES_HOST_FINGERPRINTS[host];
  if (!expectedFingerprint) {
    console.warn(`[SFTP] Warning: no known fingerprint for host "${host}". Allowing connection.`);
    return callback(true);
  }
  const actualFingerprint = crypto.createHash('sha256').update(hostKey).digest('base64');
  if (actualFingerprint === expectedFingerprint) {
    console.log(`[SFTP] ✅ Host key verified for ${host}`);
    callback(true);
    return;
  }
  const errorMessage =
    `[SFTP] ❌ HOST KEY MISMATCH for ${host}!\n` +
    `  Expected: ${expectedFingerprint}\n` +
    `  Got:      ${actualFingerprint}\n` +
    '  Possible man-in-the-middle attack — connection refused. ' +
    '  Check Descartes website for updated fingerprints (FAQ Q7).';
  console.error(errorMessage);
  callback(false);
};

// FAQ Q28 ciphers, Q29 KEX (no SHA1), Q30 MACs (no MD5/SHA1)
const APPROVED_ALGORITHMS = {
  cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes192-ctr', 'aes128-ctr'],
  kex: ['diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521'],
  hmac: [
    'hmac-sha2-256',
    'hmac-sha2-512', // ripemd160 is not implemented by the ssh2 library
  ],
};

function buildConnectOptions(config, privateKey) {
  const connectOptions = {
    host: config.host,
    port: config.port,
    username: config.username,
    readyTimeout: config.readyTimeout,
    hostVerifier: hostVerifierFor(config.host),
    algorithms: APPROVED_ALGORITHMS,
  };
  // a private key takes priority over the password
  if (privateKey) {
    connectOptions.privateKey = privateKey;
    if (config.passphrase) connectOptions.passphrase = config.passphrase;
  } else {
    connectOptions.password = config.password;
  }
  return connectOptions;
}

function writeErrorOf(writeError) {
  const code = writeError.code;
  const known = SFTP_ERRORS[code];
  const message = known ? `SFTP Error ${code}: ${known}` : writeError.message;
  console.error(`[SFTP] ❌ Write error: ${message}`);
  const error = new Error(message);
  error.isPermanent = PERMANENT_CODES.has(code);
  return error;
}

/**
 * Core upload function.
 * @param {string} xmlContent — XML string
 * @param {string} fileName   — Remote filename e.g. "999-12345678_XFWB.xml"
 * @param {string} docType    — "xfwb" | "xfhl" | "xfzb"
 */
async function uploadToMyVan(xmlContent, fileName, _docType = 'xfwb') {
  const config = await getConfig();
  checkConfigComplete(config);

  const fileSizeBytes = checkFileSize(xmlContent, fileName);
  const envLabel = config.activeEnv.toUpperCase();
  console.log(`[SFTP] Uploading ${fileName} (${(fileSizeBytes / 1024).toFixed(1)} KB) to ${config.host} [${envLabel}]`);

  acquireSession();
  const privateKey = loadPrivateKey(config);

  return new Promise((resolve, reject) => {
    const connection = new Client();
    const xmlBuffer = Buffer.from(xmlContent, 'utf8');

    const finish = (error, result) => {
      releaseSession();
      connection.end();
      if (error) reject(error);
      else resolve(result);
    };

    connection.on('ready', () => {
      connection.sftp((sftpError, sftp) => {
        if (sftpError) return finish(sftpError);

        const writeStream = sftp.createWriteStream('/' + fileName);
        writeStream.on('close', () => {
          console.log(`[SFTP] ✅ Uploaded: ${fileName}`);
          finish(null, {
            success: true,
            message: `Successfully uploaded ${fileName} to myVan [${envLabel}].`,
            fileName,
            host: config.host,
            env: config.activeEnv,
            sizeKB: (fileSizeBytes / 1024).toFixed(1),
          });
        });
        writeStream.on('error', (writeError) => finish(writeErrorOf(writeError)));

        writeStream.write(xmlBuffer);
        writeStream.end();
      });
    });

    connection.on('error', (connectionError) => {
      console.error('[SFTP] Connection error:', connectionError.message);
      finish(connectionError);
    });

    connection.connect(buildConnectOptions(config, privateKey));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Upload with exponential retry (FAQ Q12).
 * Permanent errors (codes 11, 15, 4, 28 and missing settings) are NOT retried.
 */
async function uploadWithRetry(xmlContent, fileName, docType = 'xfwb', maxRetries = 3) {
  // no point queuing a file that is too large
  checkFileSize(xmlContent, fileName);

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
        console.log(`[SFTP] Retry ${attempt}/${maxRetries} after ${delay / 1000}s...`);
        await wait(delay);
      }
      return await uploadToMyVan(xmlContent, fileName, docType);
    } catch (err) {
      lastError = err;
      if (err.isPermanent) {
        console.error('[SFTP] Permanent error — not retrying:', err.message);
        throw err;
      }
      console.warn(`[SFTP] Attempt ${attempt + 1} failed:`, err.message);
    }
  }
  throw lastError;
}

/** SFTP config status for the Settings screen. */
async function getSftpConfigStatus() {
  const config = await getConfig();
  return {
    host: config.host,
    port: config.port,
    username: config.username || '(not set)',
    hasPrivateKey: !!(config.privateKey || config.privateKeyPath),
    hasPassword: !!config.password,
    configured: !!(config.username && (config.privateKey || config.privateKeyPath || config.password)),
    activeEnv: config.activeEnv,
    activeSessions: sessionState.active,
  };
}

export { uploadWithRetry, getSftpConfigStatus, getConfig };
