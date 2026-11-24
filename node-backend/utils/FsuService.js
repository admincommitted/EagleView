/**
 * FsuService.js
 * FSU (Freight Status Update) Auto-Tracking Service
 * 
 * How it works:
 * 1. Every 5 minutes, connects to Descartes myVan SFTP server
 * 2. Downloads any new FSU XML files from the download directory
 * 3. Parses IATA FSU messages (XFSU XML format)
 * 4. Updates AwbTracking milestones (FNA/RCS/DEP/ARR/RCF/NFD/DLV)
 * 5. Deletes file from server after processing (myVan auto-deletes on download anyway)
 *
 * Ref: myVan_SFTP_faq.pdf Q26, Q27 - Download directory virtual structure
 * SFTP download dir: /sender_id/xml.785 (for XFSU)
 */

const Client      = require('ssh2').Client;
const fs          = require('fs');
const path        = require('path');
const AwbTracking = require('../models/AwbTracking');

// Use DB config from SftpService (reads AppSetting group:'sftp')
const { getConfig: getSftpConfig } = require('./SftpService');

// ── Live SFTP Connection Status ───────────────────────────────────────────────
// Updated after every FSU poll. Exposed via /api/settings/sftp-status
const sftpStatus = {
  connected:       false,
  lastConnectedAt: null,   // ISO string of last successful connection
  lastCheckedAt:   null,   // ISO string of last poll attempt
  lastError:       null,   // last error message if any
  host:            null,
  env:             null,
};

function getSftpStatus() { return { ...sftpStatus }; }


// FSU milestone codes → AwbTracking column map
const MILESTONE_MAP = {
  'FNA': 'fna',  // Freight Not Available
  'FMA': 'fma',  // Freight Manifested
  'FOH': 'foh',  // Freight on Hand
  'RCS': 'rcs',  // Received from Shipper
  'DEP': 'dep',  // Departed
  'ARR': 'arr',  // Arrived
  'TFD': 'tfd',  // Transferred
  'RCF': 'rcf',  // Received at destination
  'NFD': 'nfd',  // Notified Consignee
  'DLV': 'dlv',  // Delivered
};

// Status priority (higher = more advanced)
const STATUS_ORDER = ['PENDING', 'BOOKED', 'RECEIVED', 'DEPARTED', 'ARRIVED', 'DELIVERED', 'FINISHED'];
const CODE_TO_STATUS = {
  'RCS': 'RECEIVED',
  'DEP': 'DEPARTED',
  'ARR': 'ARRIVED',
  'RCF': 'ARRIVED',
  'NFD': 'ARRIVED',
  'DLV': 'DELIVERED',
};

/**
 * Parse XFSU XML string → array of milestone updates
 * XFSU is IATA e-freight XML for FSU (Freight Status Update)
 * 29-Oct-2026: also reads station, flight, pieces and weight of each event (kept in the event history), the
 * <ram:ReasonCode> form of the status code, and the Cargo-IMP text lines (RCS/30JAN0930/BOM/T5K120,
 * DEP/EK511/30JAN/DEL/T5K120) with a real date instead of "30JAN".
 */
const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
function textDate(ddmmm, hhmm, now = new Date()) {
  const m = /^(\d{2})([A-Z]{3})$/.exec(ddmmm || '');
  if (!m || MONTHS[m[2]] === undefined) return null;
  let y = now.getFullYear();
  const hh = hhmm ? +hhmm.slice(0, 2) : 0, mi = hhmm ? +hhmm.slice(2, 4) : 0;
  // the text format gives the station's local time: kept as local time (no "Z"), read in the server's time zone
  let d = new Date(y, MONTHS[m[2]], +m[1], hh, mi);
  if (d - now > 40 * 86400000) d = new Date(y - 1, MONTHS[m[2]], +m[1], hh, mi); // Jan file read in Dec
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}
function eventDetails(seg) {
  const pick = (re) => { const m = re.exec(seg); return m ? m[1].trim() : null; };
  return {
    pieces: pick(/<ram:PieceQuantity[^>]*>(\d+)</),
    weight: pick(/<ram:GrossWeightMeasure[^>]*>([\d.]+)</),
    flight: pick(/<ram:(?:ID|FlightID)[^>]*>([A-Z0-9]{2}\s?\d{1,5}[A-Z]?)<\/ram:(?:ID|FlightID)>/),
    station: pick(/<ram:(?:OccurrenceLocation|OccurrenceArrivalLocation|OccurrenceDepartureLocation|ArrivalEvent|DepartureEvent)[\s\S]*?<ram:ID[^>]*>([A-Z]{3})<\/ram:ID>/) || pick(/<ram:ID[^>]*>([A-Z]{3})<\/ram:ID>/),
  };
}
function parseXfsu(xmlStr) {
  const updates = [];
  
  // Extract AWB number
  const awbMatch = xmlStr.match(/<ram:ID[^>]*>(\d{3}-?\d{8})<\/ram:ID>/) || xmlStr.match(/<ram:ID[^>]*>([\d-]+)<\/ram:ID>/);
  const awbNumber = awbMatch ? awbMatch[1].trim() : null;

  // Extract event code and timestamp (EventTypeCode, or ReasonCode inside ReportedStatus)
  if (awbNumber) {
    let eventMatches = [...xmlStr.matchAll(/<ram:EventTypeCode>(.*?)<\/ram:EventTypeCode>[\s\S]*?<ram:OccurrenceDateTime>(.*?)<\/ram:OccurrenceDateTime>/g)];
    if (!eventMatches.length) eventMatches = [...xmlStr.matchAll(/<ram:ReasonCode>(.*?)<\/ram:ReasonCode>[\s\S]*?<ram:OccurrenceDateTime>(.*?)<\/ram:OccurrenceDateTime>/g)];
    eventMatches.forEach((m, i) => {
      const code = (m[1] || '').trim().toUpperCase();
      const dt   = (m[2] || '').trim();
      if (!MILESTONE_MAP[code]) return;
      const end = i + 1 < eventMatches.length ? eventMatches[i + 1].index : xmlStr.length;
      updates.push({ awbNumber, code, dt, column: MILESTONE_MAP[code], ...eventDetails(xmlStr.slice(m.index, end)) });
    });
  }
  
  // Also try simple text FSU format (IATA Cargo-IMP), one status per line:
  // FSU/7  /  176-12345678DELDXB/T5K120  /  RCS/30JAN0930/DEL/T5K120  /  DEP/EK511/30JAN/DEL/T5K120
  if (updates.length === 0) {
    const awbTextMatch = xmlStr.match(/\b(\d{3}-\d{7,8})/);
    const textAwb = awbTextMatch ? awbTextMatch[1] : awbNumber;
    if (!textAwb) return updates;
    for (const line of String(xmlStr).split(/\r?\n/)) {
      const parts = line.trim().toUpperCase().split('/');
      const code = parts[0];
      if (!MILESTONE_MAP[code]) continue;
      let date = null, time = null, station = null, flight = null, pieces = null, weight = null;
      for (const p of parts.slice(1)) {
        let m;
        if ((m = /^(\d{2}[A-Z]{3})(\d{4})?$/.exec(p)) && MONTHS[p.slice(2, 5)] !== undefined) { date = m[1]; time = m[2] || time; }
        else if (/^\d{4}$/.test(p) && date) time = p;
        else if ((m = /^[A-Z]?(\d+)K([\d.]+)$/.exec(p))) { pieces = m[1]; weight = m[2]; }
        else if (/^[A-Z]{3}$/.test(p) && !station) station = p;
        else if (/^[A-Z0-9]{2}\d{1,5}[A-Z]?$/.test(p) && !flight) flight = p;
      }
      updates.push({ awbNumber: textAwb, code, dt: textDate(date, time) || new Date().toISOString(), column: MILESTONE_MAP[code], station, flight, pieces, weight });
    }
  }
  
  return updates;
}

/**
 * Apply FSU updates: each one goes to the event history and the tracking row (utils/awbTrackingEvents.js), which
 * also sends the customer updates when they are switched on. Returns the number of new events.
 */
async function applyFsuUpdates(updates) {
  const { recordEvent } = require('./awbTrackingEvents');
  let applied = 0;
  for (const upd of updates) {
    try {
      const r = await recordEvent({ awbNumber: upd.awbNumber, code: upd.code, eventAt: upd.dt, station: upd.station, flight: upd.flight, pieces: upd.pieces, weight: upd.weight, source: 'FSU' });
      if (!r.duplicate) { applied++; console.log(`[FSU] ✅ ${upd.awbNumber} → ${upd.code} at ${upd.dt}`); }
    } catch (err) {
      console.warn(`[FSU] ⚠️ Could not update ${upd.awbNumber} ${upd.code}:`, err.message);
    }
  }
  return applied;
}

/**
 * Download FSU files from myVan SFTP and process them
 */
async function downloadAndProcessFsu() {
  const SFTP_CONFIG = await getSftpConfig();
    if (!SFTP_CONFIG.username) {
      console.log('[FSU] SFTP not configured — skipping FSU poll');
    return { processed: 0, skipped: true };
  }
  
  let privateKey = SFTP_CONFIG.privateKey;
  if (!privateKey && SFTP_CONFIG.privateKeyPath) {
    privateKey = fs.readFileSync(SFTP_CONFIG.privateKeyPath, 'utf8');
  }

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let processed = 0;
    
    conn.on('ready', () => {
      conn.sftp(async (err, sftp) => {
        if (err) { conn.end(); return reject(err); }
        
        // List files in download directory
        sftp.readdir('/', (listErr, list) => {
          if (listErr) { conn.end(); return resolve({ processed: 0, error: listErr.message }); }
          
          const fsuFiles = (list || []).filter(f => 
            f.filename.toLowerCase().includes('fsu') || 
            f.filename.toLowerCase().includes('.xml') ||
            f.filename.match(/\.(xml|txt|edi)$/i)
          );
          
          console.log(`[FSU] Found ${fsuFiles.length} files on myVan SFTP`);
          
          let pending = fsuFiles.length;
          if (pending === 0) { conn.end(); return resolve({ processed: 0 }); }
          
          for (const file of fsuFiles) {
            const chunks = [];
            const readStream = sftp.createReadStream('/' + file.filename);
            
            readStream.on('data', chunk => chunks.push(chunk));
            readStream.on('end', async () => {
              const content = Buffer.concat(chunks).toString('utf8');
              const updates = parseXfsu(content);
              const count   = await applyFsuUpdates(updates);
              processed += count;
              
              // File is auto-deleted by myVan after download (FAQ Q27)
              // But explicitly delete to be safe
              sftp.unlink('/' + file.filename, () => {});
              
              pending--;
              if (pending === 0) {
                conn.end();
                resolve({ processed });
              }
            });
            readStream.on('error', () => {
              pending--;
              if (pending === 0) { conn.end(); resolve({ processed }); }
            });
          }
        });
      });
    });

    conn.on('error', err => {
      sftpStatus.connected     = false;
      sftpStatus.lastError     = err.message;
      sftpStatus.lastCheckedAt = new Date().toISOString();
      resolve({ processed: 0, error: err.message });
    });

    conn.connect({
      host:         SFTP_CONFIG.host,
      port:         SFTP_CONFIG.port,
      username:     SFTP_CONFIG.username,
      privateKey,
      passphrase:   SFTP_CONFIG.passphrase || undefined,
      readyTimeout: SFTP_CONFIG.readyTimeout,
      algorithms: {
        cipher: ['aes256-gcm@openssh.com','aes128-gcm@openssh.com','aes256-ctr','aes192-ctr','aes128-ctr'],
        kex:    ['diffie-hellman-group-exchange-sha256','ecdh-sha2-nistp256','ecdh-sha2-nistp384'],
        hmac:   ['hmac-sha2-256','hmac-sha2-512'],
      },
    });

    // Mark status on ready (inside conn.on('ready') via a one-time hook)
    conn.once('ready', () => {
      sftpStatus.connected       = true;
      sftpStatus.lastConnectedAt = new Date().toISOString();
      sftpStatus.lastCheckedAt   = new Date().toISOString();
      sftpStatus.lastError       = null;
      sftpStatus.host            = SFTP_CONFIG.host;
      sftpStatus.env             = SFTP_CONFIG.activeEnv;
    });
  });
}

/**
 * Start FSU polling every 5 minutes (as per Descartes FAQ Q23 - max once per 5 min)
 */
let fsuPollingInterval = null;

function startFsuPolling(intervalMs = 5 * 60 * 1000) {
  if (fsuPollingInterval) return; // Already running
  
  console.log(`[FSU] Auto-tracking polling started (every ${intervalMs/60000} min)`);
  
  // Run immediately on start
  downloadAndProcessFsu()
    .then(r => console.log('[FSU] Initial poll:', r))
    .catch(e => console.warn('[FSU] Initial poll error:', e.message));
  
  fsuPollingInterval = setInterval(async () => {
    try {
      const result = await downloadAndProcessFsu();
      if (!result.skipped) console.log('[FSU] Poll result:', result);
    } catch (err) {
      console.warn('[FSU] Poll error:', err.message);
    }
  }, intervalMs);
  
  // Prevent interval from keeping process alive if server shuts down
  if (fsuPollingInterval.unref) fsuPollingInterval.unref();
}

function stopFsuPolling() {
  if (fsuPollingInterval) {
    clearInterval(fsuPollingInterval);
    fsuPollingInterval = null;
    console.log('[FSU] Polling stopped');
  }
}

module.exports = { startFsuPolling, stopFsuPolling, downloadAndProcessFsu, parseXfsu, applyFsuUpdates, getSftpStatus };
