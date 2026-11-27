import { headers, isOfficeIp, limiter, originAllowed, trustProxySetting } from '../utils/security/webSecurity.js';

/** Security headers on every answer (no framing by other sites, no MIME guessing, HSTS on HTTPS ...). */
export const securityHeaders = headers;

/** The value for app.set('trust proxy', ...): which proxies may name the real client (X-Forwarded-For). */
export { trustProxySetting };

/** cors() options: only EagleView's own addresses (LAN, localhost, the configured public URL) may call the API. */
export const corsOptions = {
  origin: (origin, callback) => callback(null, originAllowed(origin)),
};

/** Applies a middleware only to callers outside the office (office / LAN addresses skip it). */
const outsideOfficeOnly = (middleware) => (req, res, next) =>
  isOfficeIp(req.ip) ? next() : middleware(req, res, next);

/** Per-IP request limit (429 when over) for callers outside the office. */
export const officeOnlyLimiter = (name, max, windowMs, message) =>
  outsideOfficeOnly(limiter(name, max, windowMs, message));

// texts that come from SQL / code / the file system and must not reach the browser
const INTERNAL_ERR =
  /SQLITE_|Sequelize|no such (table|column)|syntax error|near "|ECONN|ENOENT|EACCES|EPERM|ETIMEDOUT|Cannot read propert|is not a function|is not defined|of undefined|of null|\.js:\d+|\bat \w+ \(|Unexpected token|\bER_[A-Z]|constraint failed/i;
const SCRUBBED_FIELDS = ['error', 'message', 'details'];

const scrubbedMessage = (reference) =>
  `Server error (ref ${reference}). Please try again; if it repeats, tell the admin this reference.`;

function scrubBody(req, body) {
  let scrubbed = body;
  for (const field of SCRUBBED_FIELDS) {
    if (typeof scrubbed[field] === 'string' && INTERNAL_ERR.test(scrubbed[field])) {
      const reference = Date.now().toString(36).toUpperCase();
      console.error(`[API ${reference}] ${req.method} ${req.originalUrl.split('?')[0]} -> ${scrubbed[field]}`);
      scrubbed = { ...scrubbed, [field]: scrubbedMessage(reference) };
    }
  }
  return scrubbed;
}

/**
 * A server error (500+) whose text is an internal one goes to the browser as a short message with a reference;
 * the full text stays in the server log under that reference.
 */
export function scrubInternalErrors(req, res, next) {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === 'object') return sendJson(scrubBody(req, body));
    return sendJson(body);
  };
  next();
}
