// Certificate checks for outgoing HTTPS / IMAP (ICEGATE, ULIP, e-mail) are ON by default.
// If one of those servers fails the check (for example a missing intermediate certificate), either
//   - put that CA in a .pem file and start Node with NODE_EXTRA_CA_CERTS=<path>   (preferred), or
//   - set ALLOW_INSECURE_TLS=true in node-backend/.env to switch the check off.
// Run `node tools/check_tls.js` to test the servers first.
import https from 'node:https';
import '../../config/env.js';

const insecure =
  String(process.env.ALLOW_INSECURE_TLS || '')
    .trim()
    .toLowerCase() === 'true';
if (insecure) console.warn('[TLS] ALLOW_INSECURE_TLS=true - certificate checks are OFF for ICEGATE / ULIP / IMAP.');

const rejectUnauthorized = !insecure;
const httpsAgent = new https.Agent({ rejectUnauthorized });

export { rejectUnauthorized, httpsAgent };
