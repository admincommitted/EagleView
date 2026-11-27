import * as mailer from '../../../utils/integrations/mailer.js';
import { TooManyRequestsError } from '../../../core/http/index.js';

const HOUR_MS = 60 * 60 * 1000;
const MAILS_PER_USER_PER_HOUR = 200;
const sentTimesByUser = new Map(); // user id -> times of the mails sent in the last hour

function testMailHtml() {
  const sentAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  return `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;">
          <h2 style="color:#1e3a5f;">✅ SMTP Test Successful</h2>
          <p>This is a test email from <strong>Committed Cargo ERP</strong>.</p>
          <p>Your email notification setup is working correctly.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
          <p style="color:#94a3b8;font-size:12px;">Sent at: ${sentAt} IST</p>
        </div>
      `;
}

/**
 * SMTP from Settings > Email (table EmailConfig); `smtp` holds the values on the screen, and a saved password the
 * screen shows empty is still used.
 */
export async function sendTestMail(to, smtp) {
  const config = await mailer.smtpConfig(smtp);
  await mailer.sendMail(
    {
      from: `"${config.fromName}" <${config.user}>`,
      to,
      subject: 'SMTP Test — Committed Cargo ERP',
      html: testMailHtml(),
    },
    smtp,
  );
  return { success: true, message: 'Test email sent to ' + to };
}

const recipientCount = (to) =>
  String(to)
    .split(/[,;]/)
    .filter((address) => address.trim()).length || 1;

/** Every recipient counts against the hourly limit of the sending user. */
function reserveSendQuota(userKey, count) {
  const now = Date.now();
  const recentTimes = (sentTimesByUser.get(userKey) || []).filter((time) => now - time < HOUR_MS);
  if (recentTimes.length + count > MAILS_PER_USER_PER_HOUR) {
    const message = `Mail limit reached (${MAILS_PER_USER_PER_HOUR} an hour per user). Try again later.`;
    throw new TooManyRequestsError(message, { body: { error: message } });
  }
  for (let index = 0; index < count; index++) recentTimes.push(now);
  sentTimesByUser.set(userKey, recentTimes);
}

/** The generic send keeps the company "From" from Settings > Email, is limited per user and is logged. */
export async function sendMail({ to, subject, html }, tokenUser) {
  const userKey = String((tokenUser && tokenUser.id) || '?');
  reserveSendQuota(userKey, recipientCount(to));
  await mailer.sendMail({ to, subject, html });
  const username = (tokenUser && tokenUser.username) || '';
  console.log(
    `[Email Send] user ${userKey} (${username}) to ${String(to).slice(0, 200)} - ${String(subject).slice(0, 120)}`,
  );
  return { success: true };
}
