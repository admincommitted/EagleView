// FSU (Freight Status Update) auto-tracking:
// 1. every 5 minutes, connects to the Descartes myVan SFTP server
// 2. downloads any new FSU files from the download directory
// 3. parses IATA FSU messages (XFSU XML, or Cargo-IMP text lines)
// 4. records each milestone (FNA/FMA/FOH/RCS/DEP/ARR/TFD/RCF/NFD/DLV) through awbTrackingEvents
// 5. deletes the file from the server after processing (myVan auto-deletes on download anyway)
// Ref: myVan_SFTP_faq.pdf Q26, Q27 - download directory virtual structure; XFSU dir: /sender_id/xml.785
import fs from 'node:fs';
import ssh2 from 'ssh2';
import { getConfig as getSftpConfig } from '../integrations/SftpService.js';
import { recordEvent } from './awbTrackingEvents.js';

const { Client } = ssh2;

const DAY_MS = 86400000;
// a "30JAN" date more than this far ahead belongs to last year (a January file read in December)
const FUTURE_DATE_LIMIT_MS = 40 * DAY_MS;
// Descartes FAQ Q23: poll at most once per 5 minutes
const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;

const SSH_ALGORITHMS = {
  cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr', 'aes192-ctr', 'aes128-ctr'],
  kex: ['diffie-hellman-group-exchange-sha256', 'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384'],
  hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
};

// live SFTP connection status, updated after every FSU poll (shown in Settings and the AWB dashboard)
const sftpStatus = {
  connected: false,
  lastConnectedAt: null,
  lastCheckedAt: null,
  lastError: null,
  host: null,
  env: null,
};

function getSftpStatus() {
  return { ...sftpStatus };
}

// FSU milestone code -> AwbTracking column
const MILESTONE_MAP = {
  FNA: 'fna', // Freight Not Available
  FMA: 'fma', // Freight Manifested
  FOH: 'foh', // Freight on Hand
  RCS: 'rcs', // Received from Shipper
  DEP: 'dep', // Departed
  ARR: 'arr', // Arrived
  TFD: 'tfd', // Transferred
  RCF: 'rcf', // Received at destination
  NFD: 'nfd', // Notified Consignee
  DLV: 'dlv', // Delivered
};

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

// "30JAN" + "0930" -> 2026-01-30T09:30:00. The text format gives the station's local time: it is kept as local time
// (no "Z") and read in the server's time zone.
function textDate(ddmmm, hhmm, now = new Date()) {
  const match = /^(\d{2})([A-Z]{3})$/.exec(ddmmm || '');
  if (!match || MONTHS[match[2]] === undefined) return null;
  const year = now.getFullYear();
  const hours = hhmm ? +hhmm.slice(0, 2) : 0;
  const minutes = hhmm ? +hhmm.slice(2, 4) : 0;
  let date = new Date(year, MONTHS[match[2]], +match[1], hours, minutes);
  if (date - now > FUTURE_DATE_LIMIT_MS) date = new Date(year - 1, MONTHS[match[2]], +match[1], hours, minutes);
  const pad = (x) => String(x).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

// station, flight, pieces and weight of one XFSU event (kept in the event history)
function eventDetails(segment) {
  const pick = (re) => {
    const match = re.exec(segment);
    return match ? match[1].trim() : null;
  };
  return {
    pieces: pick(/<ram:PieceQuantity[^>]*>(\d+)</),
    weight: pick(/<ram:GrossWeightMeasure[^>]*>([\d.]+)</),
    flight: pick(/<ram:(?:ID|FlightID)[^>]*>([A-Z0-9]{2}\s?\d{1,5}[A-Z]?)<\/ram:(?:ID|FlightID)>/),
    station:
      pick(
        /<ram:(?:OccurrenceLocation|OccurrenceArrivalLocation|OccurrenceDepartureLocation|ArrivalEvent|DepartureEvent)[\s\S]*?<ram:ID[^>]*>([A-Z]{3})<\/ram:ID>/,
      ) || pick(/<ram:ID[^>]*>([A-Z]{3})<\/ram:ID>/),
  };
}

// XFSU events: EventTypeCode, or the ReasonCode inside ReportedStatus
function parseXmlEvents(xmlStr, awbNumber) {
  const updates = [];
  let eventMatches = [
    ...xmlStr.matchAll(
      /<ram:EventTypeCode>(.*?)<\/ram:EventTypeCode>[\s\S]*?<ram:OccurrenceDateTime>(.*?)<\/ram:OccurrenceDateTime>/g,
    ),
  ];
  if (!eventMatches.length) {
    eventMatches = [
      ...xmlStr.matchAll(
        /<ram:ReasonCode>(.*?)<\/ram:ReasonCode>[\s\S]*?<ram:OccurrenceDateTime>(.*?)<\/ram:OccurrenceDateTime>/g,
      ),
    ];
  }
  eventMatches.forEach((match, index) => {
    const code = (match[1] || '').trim().toUpperCase();
    const dt = (match[2] || '').trim();
    if (!MILESTONE_MAP[code]) return;
    const end = index + 1 < eventMatches.length ? eventMatches[index + 1].index : xmlStr.length;
    updates.push({ awbNumber, code, dt, column: MILESTONE_MAP[code], ...eventDetails(xmlStr.slice(match.index, end)) });
  });
  return updates;
}

// one Cargo-IMP status line, e.g. RCS/30JAN0930/DEL/T5K120 or DEP/EK511/30JAN/DEL/T5K120
function parseTextLine(parts) {
  let date = null;
  let time = null;
  let station = null;
  let flight = null;
  let pieces = null;
  let weight = null;
  for (const part of parts.slice(1)) {
    let match;
    if ((match = /^(\d{2}[A-Z]{3})(\d{4})?$/.exec(part)) && MONTHS[part.slice(2, 5)] !== undefined) {
      date = match[1];
      time = match[2] || time;
    } else if (/^\d{4}$/.test(part) && date) {
      time = part;
    } else if ((match = /^[A-Z]?(\d+)K([\d.]+)$/.exec(part))) {
      pieces = match[1];
      weight = match[2];
    } else if (/^[A-Z]{3}$/.test(part) && !station) {
      station = part;
    } else if (/^[A-Z0-9]{2}\d{1,5}[A-Z]?$/.test(part) && !flight) {
      flight = part;
    }
  }
  return { date, time, station, flight, pieces, weight };
}

// IATA Cargo-IMP text FSU, one status per line:
// FSU/7  /  176-12345678DELDXB/T5K120  /  RCS/30JAN0930/DEL/T5K120  /  DEP/EK511/30JAN/DEL/T5K120
function parseTextEvents(text, awbNumber) {
  const updates = [];
  const awbTextMatch = text.match(/\b(\d{3}-\d{7,8})/);
  const textAwb = awbTextMatch ? awbTextMatch[1] : awbNumber;
  if (!textAwb) return updates;
  for (const line of String(text).split(/\r?\n/)) {
    const parts = line.trim().toUpperCase().split('/');
    const code = parts[0];
    if (!MILESTONE_MAP[code]) continue;
    const { date, time, station, flight, pieces, weight } = parseTextLine(parts);
    updates.push({
      awbNumber: textAwb,
      code,
      dt: textDate(date, time) || new Date().toISOString(),
      column: MILESTONE_MAP[code],
      station,
      flight,
      pieces,
      weight,
    });
  }
  return updates;
}

// XFSU XML (or Cargo-IMP text) -> list of milestone updates
function parseXfsu(xmlStr) {
  const awbMatch =
    xmlStr.match(/<ram:ID[^>]*>(\d{3}-?\d{8})<\/ram:ID>/) || xmlStr.match(/<ram:ID[^>]*>([\d-]+)<\/ram:ID>/);
  const awbNumber = awbMatch ? awbMatch[1].trim() : null;
  const updates = awbNumber ? parseXmlEvents(xmlStr, awbNumber) : [];
  if (updates.length === 0) return parseTextEvents(xmlStr, awbNumber);
  return updates;
}

// each update goes to the event history and the tracking row (awbTrackingEvents), which also sends the customer
// updates when they are switched on. Returns the number of new events.
async function applyFsuUpdates(updates) {
  let applied = 0;
  for (const update of updates) {
    try {
      const result = await recordEvent({
        awbNumber: update.awbNumber,
        code: update.code,
        eventAt: update.dt,
        station: update.station,
        flight: update.flight,
        pieces: update.pieces,
        weight: update.weight,
        source: 'FSU',
      });
      if (!result.duplicate) {
        applied++;
        console.log(`[FSU] ✅ ${update.awbNumber} → ${update.code} at ${update.dt}`);
      }
    } catch (err) {
      console.warn(`[FSU] ⚠️ Could not update ${update.awbNumber} ${update.code}:`, err.message);
    }
  }
  return applied;
}

const isFsuFile = (file) => {
  const name = file.filename.toLowerCase();
  return name.includes('fsu') || name.includes('.xml') || file.filename.match(/\.(xml|txt|edi)$/i);
};

function markConnected(config) {
  sftpStatus.connected = true;
  sftpStatus.lastConnectedAt = new Date().toISOString();
  sftpStatus.lastCheckedAt = new Date().toISOString();
  sftpStatus.lastError = null;
  sftpStatus.host = config.host;
  sftpStatus.env = config.activeEnv;
}

function markFailed(err) {
  sftpStatus.connected = false;
  sftpStatus.lastError = err.message;
  sftpStatus.lastCheckedAt = new Date().toISOString();
}

// reads every FSU file in the download directory, applies it and deletes it
function processFiles(conn, sftp, resolve) {
  sftp.readdir('/', (listErr, list) => {
    if (listErr) {
      conn.end();
      return resolve({ processed: 0, error: listErr.message });
    }

    const fsuFiles = (list || []).filter(isFsuFile);
    console.log(`[FSU] Found ${fsuFiles.length} files on myVan SFTP`);

    let processed = 0;
    let pending = fsuFiles.length;
    if (pending === 0) {
      conn.end();
      return resolve({ processed: 0 });
    }

    for (const file of fsuFiles) {
      const chunks = [];
      const readStream = sftp.createReadStream('/' + file.filename);

      readStream.on('data', (chunk) => chunks.push(chunk));
      readStream.on('end', async () => {
        const content = Buffer.concat(chunks).toString('utf8');
        processed += await applyFsuUpdates(parseXfsu(content));
        // myVan deletes a file once it is downloaded (FAQ Q27); deleted here as well to be safe
        sftp.unlink('/' + file.filename, () => {});
        pending--;
        if (pending === 0) {
          conn.end();
          resolve({ processed });
        }
      });
      readStream.on('error', () => {
        pending--;
        if (pending === 0) {
          conn.end();
          resolve({ processed });
        }
      });
    }
  });
}

// download FSU files from myVan SFTP and process them
async function downloadAndProcessFsu() {
  const config = await getSftpConfig();
  if (!config.username) {
    console.log('[FSU] SFTP not configured — skipping FSU poll');
    return { processed: 0, skipped: true };
  }

  let privateKey = config.privateKey;
  if (!privateKey && config.privateKeyPath) privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }
        processFiles(conn, sftp, resolve);
      });
    });

    conn.on('error', (err) => {
      markFailed(err);
      resolve({ processed: 0, error: err.message });
    });

    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey,
      passphrase: config.passphrase || undefined,
      readyTimeout: config.readyTimeout,
      algorithms: SSH_ALGORITHMS,
    });

    conn.once('ready', () => markConnected(config));
  });
}

let fsuPollingInterval = null;

async function runInitialPoll() {
  try {
    const result = await downloadAndProcessFsu();
    console.log('[FSU] Initial poll:', result);
  } catch (e) {
    console.warn('[FSU] Initial poll error:', e.message);
  }
}

async function runScheduledPoll() {
  try {
    const result = await downloadAndProcessFsu();
    if (!result.skipped) console.log('[FSU] Poll result:', result);
  } catch (err) {
    console.warn('[FSU] Poll error:', err.message);
  }
}

function startFsuPolling(intervalMs = DEFAULT_POLL_INTERVAL_MS) {
  if (fsuPollingInterval) return;

  console.log(`[FSU] Auto-tracking polling started (every ${intervalMs / 60000} min)`);
  runInitialPoll();
  fsuPollingInterval = setInterval(runScheduledPoll, intervalMs);
  // the poll must not keep the process alive when the server shuts down
  if (fsuPollingInterval.unref) fsuPollingInterval.unref();
}

export { startFsuPolling, downloadAndProcessFsu, getSftpStatus };
