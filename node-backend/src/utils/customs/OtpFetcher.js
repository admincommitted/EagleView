// Reads the ICEGATE login OTP from a Gmail inbox over IMAP.
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const GMAIL_IMAP = { host: 'imap.gmail.com', port: 993, secure: true };
const POLL_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const looksLikeIcegateOtpMail = (msg) => {
  const fromAddress = (msg.envelope.from[0]?.address || '').toLowerCase();
  const subject = (msg.envelope.subject || '').toLowerCase();
  return fromAddress.includes('icegate') || subject.includes('otp');
};

// a 6-digit code, preferably the one after "OTP" / "password" / "code"
const otpInText = (text) => {
  const match = text.match(/(?:OTP|password|code).*?(\d{6})\b/i) || text.match(/\b(\d{6})\b/);
  return match ? match[1] : null;
};

// one pass over the unseen mails; the mail the OTP came from is marked read so it is not used again
async function findOtpInUnseenMails(client) {
  const messages = client.fetch({ seen: false }, { source: true, envelope: true });
  for await (const msg of messages) {
    if (!looksLikeIcegateOtpMail(msg)) continue;
    const parsed = await simpleParser(msg.source);
    const otp = otpInText(parsed.text || parsed.html || '');
    if (!otp) continue;
    console.log(`[OTP Fetcher] Found OTP: ${otp}`);
    await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
    return otp;
  }
  return null;
}

async function waitForIcegateOtp(userEmail, appPassword, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const client = new ImapFlow({ ...GMAIL_IMAP, auth: { user: userEmail, pass: appPassword }, logger: false });

  console.log(`[OTP Fetcher] Connecting to Gmail IMAP for ${userEmail}...`);
  await client.connect();
  let otp = null;
  let elapsed = 0;

  console.log('[OTP Fetcher] Waiting for ICEGATE OTP email...');
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      while (elapsed < timeoutMs) {
        otp = await findOtpInUnseenMails(client);
        if (otp) break;
        await sleep(POLL_INTERVAL_MS);
        elapsed += POLL_INTERVAL_MS;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  if (!otp) {
    console.log('[OTP Fetcher] Timeout: No OTP email received within the expected time.');
  }
  return otp;
}

export { waitForIcegateOtp };
