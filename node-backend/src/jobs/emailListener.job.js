// Watches the IMAP mailbox of every ICEGATE profile (IMAP IDLE) and files the LEO copy / first copy / gate pass PDFs
// that arrive for a Shipping Bill under uploads/final_docs (ExportFinalDoc).
import fs from 'node:fs';
import path from 'node:path';
import imaps from 'imap-simple';
import mailparser from 'mailparser';
import { Op } from 'sequelize';
import { UPLOADS_DIR } from '../config/env.js';
import { ExportFinalDoc, IcegateProfile } from '../models/index.js';
import { rejectUnauthorized } from '../utils/integrations/tls.js';

const { simpleParser } = mailparser;

const FINAL_DOCS_DIR = path.join(UPLOADS_DIR, 'final_docs');
const FINAL_DOCS_URL = '/uploads/final_docs/';
const DEFAULT_IMAP_HOST = 'imap.gmail.com';
const DEFAULT_IMAP_PORT = 993;
const IMAP_AUTH_TIMEOUT_MS = 10000;
const KEEPALIVE_INTERVAL_MS = 10000;
const KEEPALIVE_IDLE_INTERVAL_MS = 300000;
const RECONNECT_DELAY_MS = 10000;
// mails already marked read elsewhere are still picked up
const LOOK_BACK_DAYS = 3;
const ALL_FOLDERS = ['INBOX', '[Gmail]/All Mail'];
const HEADER_FIELDS = 'HEADER.FIELDS (MESSAGE-ID SUBJECT)';
const SEEN_FLAG = '\\Seen';

const SB_NO_IN_SUBJECT = /(?:SB|S\/?B)\s*NO[:.\s]*(\d{7})/i;
const SEVEN_DIGITS = /(\d{7})/;

let activeConnections = [];

const isPdf = (attachment) =>
  attachment.contentType === 'application/pdf' || attachment.filename.toLowerCase().endsWith('.pdf');

const sbNoFromSubject = (subject) => {
  const match = subject.match(SB_NO_IN_SUBJECT) || subject.match(SEVEN_DIGITS);
  return match ? match[1] : null;
};

function documentTypeOf(subject, filename) {
  const text = `${subject} ${filename}`.toLowerCase();
  if (text.includes('leo')) return 'LEO_COPY';
  if (text.includes('first')) return 'FIRST_COPY';
  if (text.includes('gatepass') || text.includes('gate pass')) return 'GATEPASS';
  return 'OTHER';
}

async function saveFinalDocument({ attachment, filename, sbNo, docType, messageId }) {
  if (!fs.existsSync(FINAL_DOCS_DIR)) fs.mkdirSync(FINAL_DOCS_DIR, { recursive: true });
  const uniqueName = `${docType}_${sbNo}_${Date.now()}.pdf`;
  fs.writeFileSync(path.join(FINAL_DOCS_DIR, uniqueName), attachment.content);
  await ExportFinalDoc.create({ sbNo, docType, fileName: filename, fileUrl: FINAL_DOCS_URL + uniqueName, messageId });
  console.log(`[EmailListener] ✅ Real-Time Downloaded: ${docType} for SB ${sbNo}`);
}

// the SB number comes from the subject, else from the first PDF file name that has one
async function saveFinalDocuments(parsed, subject, messageId) {
  let sbNo = sbNoFromSubject(subject);
  for (const attachment of parsed.attachments) {
    if (!isPdf(attachment)) continue;
    const filename = attachment.filename || 'document.pdf';
    if (!sbNo) {
      const fileMatch = filename.match(SEVEN_DIGITS);
      if (fileMatch) sbNo = fileMatch[1];
    }
    if (!sbNo) continue;

    const docType = documentTypeOf(subject, filename);
    if (docType === 'OTHER') continue;

    const existingDoc = await ExportFinalDoc.findOne({ where: { sbNo, docType } });
    if (existingDoc) {
      console.log(`[EmailListener] Skipping duplicate ${docType} for SB: ${sbNo}`);
      continue;
    }
    await saveFinalDocument({ attachment, filename, sbNo, docType, messageId });
  }
}

async function processEmail(connection, message) {
  const fullBody = message.parts.find((part) => part.which === '');
  const uid = message.attributes.uid;
  try {
    const parsed = await simpleParser(fullBody.body);
    const { messageId } = parsed;
    const subject = parsed.subject || '';

    if (messageId && (await ExportFinalDoc.findOne({ where: { messageId } }))) {
      await connection.addFlags(uid, SEEN_FLAG);
      return;
    }
    if (!parsed.attachments || parsed.attachments.length === 0) {
      await connection.addFlags(uid, SEEN_FLAG);
      return;
    }
    await saveFinalDocuments(parsed, subject, messageId);
    await connection.addFlags(uid, SEEN_FLAG);
  } catch (error) {
    console.error('[EmailListener] Error parsing email UID', uid, error);
  }
}

const imapConfigOf = (profile) => ({
  imap: {
    user: profile.imapEmail,
    password: profile.imapAppPassword,
    host: profile.imapHost || DEFAULT_IMAP_HOST,
    port: profile.imapPort || DEFAULT_IMAP_PORT,
    tls: true,
    authTimeout: IMAP_AUTH_TIMEOUT_MS,
    tlsOptions: { rejectUnauthorized },
    keepalive: {
      interval: KEEPALIVE_INTERVAL_MS,
      idleInterval: KEEPALIVE_IDLE_INTERVAL_MS,
      forceNoop: true,
    },
  },
});

async function messageIdOfHeader(headerMessage) {
  const header = headerMessage.parts.find((part) => part.which === HEADER_FIELDS);
  if (!header || !header.body) return null;
  try {
    return (await simpleParser(header.body)).messageId;
  } catch {
    return null;
  }
}

async function startIdleListener(profile, targetFolder) {
  const config = imapConfigOf(profile);
  let connection;

  // headers first; only a mail not filed yet is fetched in full
  const fetchRecent = async () => {
    if (!connection || connection.imap.state !== 'authenticated') return;
    try {
      const since = new Date();
      since.setDate(since.getDate() - LOOK_BACK_DAYS);
      const headerMessages = await connection.search([['SINCE', since]], { bodies: [HEADER_FIELDS], markSeen: false });
      if (!headerMessages || headerMessages.length === 0) return;

      for (const headerMessage of headerMessages) {
        const uid = headerMessage.attributes.uid;
        const messageId = await messageIdOfHeader(headerMessage);
        if (messageId && (await ExportFinalDoc.findOne({ where: { messageId } }))) continue;

        const fullMessages = await connection.search([['UID', uid]], { bodies: [''], markSeen: false });
        if (fullMessages && fullMessages.length > 0) await processEmail(connection, fullMessages[0]);
      }
    } catch (error) {
      console.error(`[EmailListener] Search error in ${targetFolder}:`, error.message);
    }
  };

  const connectAndIdle = async () => {
    try {
      connection = await imaps.connect(config);
      activeConnections.push(connection);

      connection.imap.on('error', (error) => {
        console.error(`[EmailListener] Connection error on ${targetFolder}:`, error.message);
      });
      connection.on('error', (error) => {
        console.error(`[EmailListener] ImapSimple wrapper error on ${targetFolder}:`, error.message);
      });
      connection.imap.on('end', () => {
        console.log(`[EmailListener] Connection dropped for ${targetFolder}. Reconnecting in 10s...`);
        setTimeout(connectAndIdle, RECONNECT_DELAY_MS);
      });

      await connection.openBox(targetFolder);
      console.log(`[EmailListener] 📡 LIVE Watching ${targetFolder} for ${profile.imapEmail}`);

      await fetchRecent();

      connection.imap.on('mail', async () => {
        console.log(`[EmailListener] 🔔 PING: New mail arrived in ${targetFolder}!`);
        await fetchRecent();
      });
    } catch (error) {
      console.error(`[EmailListener] Failed to start IDLE for ${targetFolder}:`, error.message);
      setTimeout(connectAndIdle, RECONNECT_DELAY_MS);
    }
  };

  await connectAndIdle();
}

// imapFolder: ALL (inbox + Gmail's All Mail), a comma list, or one folder
function foldersOf(profile) {
  const folderSetting = (profile.imapFolder || 'INBOX').trim();
  if (folderSetting.toUpperCase() === 'ALL') return ALL_FOLDERS;
  if (folderSetting.includes(','))
    return folderSetting
      .split(',')
      .map((folder) => folder.trim())
      .filter((folder) => folder);
  return [folderSetting];
}

export async function runEmailListener() {
  console.log('[EmailListener] Starting Real-Time IMAP IDLE engine...');
  try {
    const profiles = await IcegateProfile.findAll({
      where: {
        imapEmail: { [Op.not]: null, [Op.ne]: '' },
        imapAppPassword: { [Op.not]: null, [Op.ne]: '' },
      },
    });

    if (profiles.length === 0) {
      console.log('[EmailListener] No profiles configured. Listener waiting.');
      return;
    }

    for (const profile of profiles) {
      for (const targetFolder of foldersOf(profile)) startIdleListener(profile, targetFolder);
    }
  } catch (error) {
    console.error('[EmailListener] General Error:', error.message);
  }
}

export async function restartEmailListeners() {
  console.log('[EmailListener] Restarting email listeners due to profile update...');
  for (const connection of activeConnections) {
    try {
      connection.end();
    } catch {
      // already closed
    }
  }
  activeConnections = [];
  await runEmailListener();
}
