import imaps from 'imap-simple';
import { IcegateProfile } from '../../../models/index.js';
import { BadRequestError } from '../../../core/http/index.js';
import { rejectUnauthorized as tlsStrict } from '../../../utils/integrations/tls.js';

const DEFAULT_IMAP_HOST = 'imap.gmail.com';
const DEFAULT_IMAP_PORT = 993;
const IMAP_AUTH_TIMEOUT_MS = 5000;

/** The screen shows a saved app password masked; the saved one is then used. */
async function resolveAppPassword({ imapAppPassword, id }) {
  if (!(imapAppPassword && String(imapAppPassword).startsWith('****') && id)) return imapAppPassword;
  const profile = await IcegateProfile.findByPk(id).catch(() => null);
  return profile ? profile.imapAppPassword : '';
}

const imapConnectionSettings = ({ imapEmail, imapHost, imapPort }, password) => ({
  imap: {
    user: imapEmail,
    password,
    host: imapHost || DEFAULT_IMAP_HOST,
    port: imapPort || DEFAULT_IMAP_PORT,
    tls: true,
    authTimeout: IMAP_AUTH_TIMEOUT_MS,
    tlsOptions: { rejectUnauthorized: tlsStrict },
  },
});

/** The first folder of the profile's list; ALL is not a folder, so INBOX is opened to test the login. */
function folderToTest(imapFolder) {
  const firstFolder = (imapFolder || 'INBOX').split(',')[0].trim();
  return firstFolder.toUpperCase() === 'ALL' ? 'INBOX' : firstFolder;
}

/** POST /test-imap: logs in to the mailbox the ICEGATE OTP mails arrive in and opens its folder. */
export async function testImapConnection(request) {
  const { imapEmail, imapFolder } = request;
  const password = await resolveAppPassword(request);
  if (!imapEmail || !password) {
    throw new BadRequestError('Email and App Password are required.', {
      body: { success: false, message: 'Email and App Password are required.' },
    });
  }
  try {
    const connection = await imaps.connect(imapConnectionSettings(request, password));
    connection.on('error', (error) => {
      console.error('IMAP Connection error handled gracefully:', error.message);
    });
    await connection.openBox(folderToTest(imapFolder));
    connection.end();
    return { success: true, message: 'Connection Successful!' };
  } catch (error) {
    console.error('IMAP Test Error:', error);
    return { success: false, message: 'Connection Failed: ' + error.message };
  }
}
