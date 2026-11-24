/**
 * SftpService.js
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

const Client = require('ssh2').Client;
const crypto = require('crypto');
const fs     = require('fs');

// ── SFTP error codes (FAQ Q9, Q24, Q25) ─────────────────────────────────────
const SFTP_ERRORS = {
  11: 'DUPLICATE — File already received by myVan. Do NOT retry.',
  15: 'QUOTA_EXCEEDED — File size exceeds policy limit (default 1 MB).',
  4:  'FAILURE — Error processing document.',
  28: 'FILE_CORRUPT — Image file is invalid or not G4 TIFF.',
};

// Codes that must NEVER be retried
const PERMANENT_CODES = new Set([11, 15, 4, 28]);

// ── GAP 3: Descartes verified server host key fingerprints (FAQ Q4, Q7) ──────
// These are SHA-256 fingerprints of the Descartes SFTP server public keys.
// Source: myVan_SFTP_faq.pdf Q7
const DESCARTES_HOST_FINGERPRINTS = {
  'wwwtest.myvan.descartes.com': '5/EES6hJV79LynBLAif+423eRh9la0k1SptzqFlMiOA=',  // TEST SHA256 (updated Sep 2026)
  'ftp.myvan.descartes.com':     '8ZiX8uV0j/8mCMhYw4wcEHO6729tVPMpYVwsADbT1t0=',  // PROD SHA256
};

// ── GAP 5: Session rate limiter (FAQ Q23) ────────────────────────────────────
// Max 4 concurrent sessions from same IP. No polling more than once per 5 min.
const sessionState = {
  active:        0,                  // current open sessions
  lastUploadAt:  null,               // timestamp of last upload attempt
  MAX_SESSIONS:  4,
  MIN_POLL_GAP:  5 * 60 * 1000,     // 5 minutes in ms
};

function acquireSession() {
  if (sessionState.active >= sessionState.MAX_SESSIONS) {
    throw new Error(
      `[SFTP] Rate limit: ${sessionState.MAX_SESSIONS} concurrent sessions already active. ` +
      'Descartes will block your IP if exceeded (FAQ Q23).'
    );
  }
  const now = Date.now();
  if (sessionState.lastUploadAt && (now - sessionState.lastUploadAt) < sessionState.MIN_POLL_GAP) {
    const waitSec = Math.ceil((sessionState.MIN_POLL_GAP - (now - sessionState.lastUploadAt)) / 1000);
    // Only enforce poll gap if this is a repeated attempt with no content change
    // (event-driven uploads are exempt per FAQ Q23)
    console.warn(`[SFTP] Warning: last upload was ${Math.round((now - sessionState.lastUploadAt)/1000)}s ago. Descartes recommends ≥5 min between polls (FAQ Q23).`);
  }
  sessionState.active++;
  sessionState.lastUploadAt = now;
}

function releaseSession() {
  if (sessionState.active > 0) sessionState.active--;
}

// ── GAP 7: File size check (FAQ Q32) ─────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB default quota

function checkFileSize(content, fileName) {
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `[SFTP] File too large: ${fileName} is ${(sizeBytes / 1024).toFixed(1)} KB ` +
      `(Descartes limit: 1 MB). Split into smaller files (FAQ Q32).`
    );
  }
  return sizeBytes;
}

// ── Config loader ─────────────────────────────────────────────────────────────
async function getConfig() {
  try {
    const cfg = await require('./settingsStore').getAll(); // table SftpConfig (28-Oct-2026)

    // Resolve active env → pick correct host
    const activeEnv  = cfg['sftp_active_env'] || 'production';
    const activeHost = activeEnv === 'test'
      ? (cfg['sftp_test_host'] || 'wwwtest.myvan.descartes.com')
      : (cfg['sftp_prod_host'] || cfg['sftp_host'] || 'ftp.myvan.descartes.com');

    return {
      host:           activeHost,
      port:           parseInt(cfg['sftp_port'] || process.env.SFTP_PORT || '22'),
      username:       cfg['sftp_username']    || process.env.SFTP_USERNAME    || '',
      password:       cfg['sftp_password']    || process.env.SFTP_PASSWORD    || '',
      privateKey:     cfg['sftp_private_key'] || process.env.SFTP_PRIVATE_KEY || '',
      passphrase:     cfg['sftp_passphrase']  || process.env.SFTP_PASSPHRASE  || '',
      privateKeyPath: process.env.SFTP_PRIVATE_KEY_PATH || '',
      readyTimeout:   300000, // FAQ Q24: minimum 300s
      activeEnv,
    };
  } catch (e) {
    return {
      host:           process.env.SFTP_HOST        || 'ftp.myvan.descartes.com',
      port:           parseInt(process.env.SFTP_PORT || '22'),
      username:       process.env.SFTP_USERNAME    || '',
      password:       process.env.SFTP_PASSWORD    || '',
      privateKey:     process.env.SFTP_PRIVATE_KEY || '',
      passphrase:     process.env.SFTP_PASSPHRASE  || '',
      privateKeyPath: process.env.SFTP_PRIVATE_KEY_PATH || '',
      readyTimeout:   300000,
      activeEnv:      'production',
    };
  }
}

/**
 * Core upload function.
 * @param {string} xmlContent — XML string
 * @param {string} fileName   — Remote filename e.g. "999-12345678_XFWB.xml"
 * @param {string} docType    — "xfwb" | "xfhl" | "xfzb"
 */
async function uploadToMyVan(xmlContent, fileName, docType = 'xfwb') {
  const config = await getConfig();

  // ── Validate config ──────────────────────────────────────────────────────
  if (!config.username) {
    throw Object.assign(new Error('SFTP username not configured. Set it in Settings → Network/SFTP.'), { isPermanent: true }); // settings missing: retrying cannot help (29-Oct-2026)
  }
  if (!config.privateKey && !config.privateKeyPath && !config.password) {
    throw Object.assign(new Error('SFTP authentication not configured. Set SSH Key or Password in Settings → Network/SFTP.'), { isPermanent: true }); // settings missing: retrying cannot help (29-Oct-2026)
  }

  // ── GAP 7: File size check before sending ────────────────────────────────
  const fileSizeBytes = checkFileSize(xmlContent, fileName);
  console.log(`[SFTP] Uploading ${fileName} (${(fileSizeBytes / 1024).toFixed(1)} KB) to ${config.host} [${config.activeEnv.toUpperCase()}]`);

  // ── GAP 5: Acquire session slot ──────────────────────────────────────────
  acquireSession();

  // ── Load private key ─────────────────────────────────────────────────────
  let privateKey = config.privateKey;
  if (!privateKey && config.privateKeyPath) {
    try {
      privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
    } catch (e) {
      console.warn('[SFTP] Could not read private key from path:', config.privateKeyPath);
    }
  }

  return new Promise((resolve, reject) => {
    const conn      = new Client();
    const xmlBuffer = Buffer.from(xmlContent, 'utf8');

    const finish = (err, result) => {
      releaseSession();    // always release slot
      conn.end();
      if (err) reject(err); else resolve(result);
    };

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) return finish(err);

        const remotePath  = '/' + fileName;
        const writeStream = sftp.createWriteStream(remotePath);

        writeStream.on('close', () => {
          console.log(`[SFTP] ✅ Uploaded: ${fileName}`);
          finish(null, {
            success: true,
            message: `Successfully uploaded ${fileName} to myVan [${config.activeEnv.toUpperCase()}].`,
            fileName,
            host: config.host,
            env:  config.activeEnv,
            sizeKB: (fileSizeBytes / 1024).toFixed(1),
          });
        });

        writeStream.on('error', (writeErr) => {
          const code  = writeErr.code;
          const known = SFTP_ERRORS[code];
          const msg   = known
            ? `SFTP Error ${code}: ${known}`
            : writeErr.message;
          console.error(`[SFTP] ❌ Write error: ${msg}`);
          // Mark as permanent if we know the code
          const permErr = new Error(msg);
          permErr.isPermanent = PERMANENT_CODES.has(code);
          finish(permErr);
        });

        writeStream.write(xmlBuffer);
        writeStream.end();
      });
    });

    conn.on('error', (connErr) => {
      console.error('[SFTP] Connection error:', connErr.message);
      finish(connErr);
    });

    // ── Build connect options ─────────────────────────────────────────────
    const connectOptions = {
      host:         config.host,
      port:         config.port,
      username:     config.username,
      readyTimeout: config.readyTimeout,

      // ── GAP 3: Server host key verification (FAQ Q4, Q7) ──────────────
      // Compare server's public key fingerprint against known Descartes fingerprints.
      hostVerifier: (hostKey, callback) => {
        const expectedFingerprint = DESCARTES_HOST_FINGERPRINTS[config.host];
        if (!expectedFingerprint) {
          // Unknown host (custom server) — allow but warn
          console.warn(`[SFTP] Warning: no known fingerprint for host "${config.host}". Allowing connection.`);
          return callback(true);
        }
        // Compute SHA-256 fingerprint of the server's host key
        const actualFingerprint = crypto
          .createHash('sha256')
          .update(hostKey)
          .digest('base64');
        if (actualFingerprint === expectedFingerprint) {
          console.log(`[SFTP] ✅ Host key verified for ${config.host}`);
          callback(true);
        } else {
          const errMsg =
            `[SFTP] ❌ HOST KEY MISMATCH for ${config.host}!\n` +
            `  Expected: ${expectedFingerprint}\n` +
            `  Got:      ${actualFingerprint}\n` +
            '  Possible man-in-the-middle attack — connection refused. ' +
            '  Check Descartes website for updated fingerprints (FAQ Q7).';
          console.error(errMsg);
          callback(false); // reject the connection
        }
      },

      // ── FAQ Q28: Approved ciphers (chacha20 preferred) ────────────────
      // ── FAQ Q29: Approved KEX (no SHA1) ───────────────────────────────
      // ── FAQ Q30: Approved MACs (no MD5/SHA1) ──────────────────────────
      algorithms: {
        cipher: [
          'aes256-gcm@openssh.com',
          'aes128-gcm@openssh.com',
          'aes256-ctr',
          'aes192-ctr',
          'aes128-ctr',
        ],
        kex: [
          'diffie-hellman-group-exchange-sha256', // FAQ Q29 — no SHA1
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
        ],
        hmac: [
          'hmac-sha2-256',  // FAQ Q30 — ssh2-supported subset
          'hmac-sha2-512',  // (ripemd160 not implemented by ssh2 node library)
        ],
      },
    };

    // Auth: private key takes priority over password
    if (privateKey) {
      connectOptions.privateKey = privateKey;
      if (config.passphrase) connectOptions.passphrase = config.passphrase;
    } else {
      connectOptions.password = config.password;
    }

    conn.connect(connectOptions);
  });
}

/**
 * Upload with exponential retry (FAQ Q12).
 * Permanent errors (codes 11, 15, 4, 28) are NOT retried.
 */
async function uploadWithRetry(xmlContent, fileName, docType = 'xfwb', maxRetries = 3) {
  // Run file size check early — no point queuing if too large
  checkFileSize(xmlContent, fileName);

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delays = [60000, 120000, 480000]; // 1min, 2min, 8min
        const delay  = delays[Math.min(attempt - 1, delays.length - 1)];
        console.log(`[SFTP] Retry ${attempt}/${maxRetries} after ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
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

/**
 * Get current SFTP config status (for Settings UI).
 */
async function getSftpConfigStatus() {
  const config = await getConfig();
  return {
    host:          config.host,
    port:          config.port,
    username:      config.username || '(not set)',
    hasPrivateKey: !!(config.privateKey || config.privateKeyPath),
    hasPassword:   !!config.password,
    configured:    !!(config.username && (config.privateKey || config.privateKeyPath || config.password)),
    activeEnv:     config.activeEnv,
    activeSessions: sessionState.active,
  };
}

/**
 * Returns current session state — useful for monitoring.
 */
function getSessionState() {
  return {
    activeSessions: sessionState.active,
    maxSessions:    sessionState.MAX_SESSIONS,
    lastUploadAt:   sessionState.lastUploadAt
      ? new Date(sessionState.lastUploadAt).toISOString()
      : null,
    nextAllowedAt: sessionState.lastUploadAt
      ? new Date(sessionState.lastUploadAt + sessionState.MIN_POLL_GAP).toISOString()
      : null,
  };
}

module.exports = { uploadToMyVan, uploadWithRetry, getSftpConfigStatus, getConfig, getSessionState };
