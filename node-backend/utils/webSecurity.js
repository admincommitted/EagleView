// Web security settings for EagleView when it is reachable from the internet (14-Nov-2026).
//   originAllowed(origin)  - which web sites may call the API / socket from a browser (CORS). Before: every site.
//                            Allowed: no Origin (same site, tools, phones), localhost / 127.x / office LAN addresses
//                            (10.x, 172.16-31.x, 192.168.x) on any port, and the public address(es) in the setting
//                            "app_public_url" (Settings) or APP_PUBLIC_URL / FRONTEND_URL / CORS_EXTRA_ORIGINS in .env.
//   headers                - security headers on every answer (no framing by other sites, no MIME guessing,
//                            HSTS on HTTPS, no referrer to other sites, no camera / mic / geolocation for pages).
//   publicBase(req)        - the address used in e-mailed links (password reset): only a configured one, or the
//                            request's own host when that is a local / LAN host - never a host a stranger can send.
//   isOfficeIp(ip)         - LAN / localhost or the office IPs in setting "office_ips" / OFFICE_IPS (comma list).
//   limiter(name, max, ms) - simple per-IP request limit (in memory).
const net = require('net');

let cache = null;
function settingsNow() {
  if (cache && Date.now() - cache.at < 60000) return cache;
  const next = cache || { at: 0, publicUrls: [], officeIps: [] };
  cache = { ...next, at: Date.now() };
  // refresh in the background; first calls use .env only
  require('./settingsStore').getMany(['app_public_url', 'office_ips']).then((s) => {
    cache = { at: Date.now(), publicUrls: splitList(s.app_public_url), officeIps: splitList(s.office_ips) };
  }).catch(() => {});
  return cache;
}
const clearCache = () => { cache = null; settingsNow(); };
const splitList = (v) => String(v || '').split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
const originOf = (u) => { try { const x = new URL(u); return x.protocol + '//' + x.host; } catch (e) { return ''; } };

function configuredOrigins() {
  const env = [process.env.APP_PUBLIC_URL, process.env.FRONTEND_URL, ...splitList(process.env.CORS_EXTRA_ORIGINS)];
  return [...env, ...settingsNow().publicUrls].map(originOf).filter(Boolean);
}

function isPrivateHost(host) {
  const h = String(host || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!h) return false;
  if (h === 'localhost' || h.endsWith('.localhost') || h === '::1') return true;
  if (net.isIPv4(h)) {
    const [a, b] = h.split('.').map(Number);
    return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  if (net.isIPv6(h)) return /^(fc|fd|fe80)/.test(h);
  return false;
}

function originAllowed(origin) {
  if (!origin) return true;
  let u; try { u = new URL(origin); } catch (e) { return false; }
  if (isPrivateHost(u.hostname)) return true;
  return configuredOrigins().includes(u.protocol + '//' + u.host);
}

function headers(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self), payment=()');
  // frame-ancestors only: a full content policy would need every script / font / map host listed and could break screens
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'; base-uri 'self'; object-src 'none'");
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}

function publicBase(req) {
  const conf = configuredOrigins();
  if (conf.length) return conf[0];
  const host = String((req.get && req.get('host')) || '');
  const hostname = host.replace(/:\d+$/, '');
  if (isPrivateHost(hostname)) return `${req.protocol}://${host}`;
  return null; // a public host nobody configured: do not trust it for e-mailed links
}

function normIp(ip) { return String(ip || '').replace(/^::ffff:/, ''); }
function isOfficeIp(ip) {
  const v = normIp(ip);
  if (isPrivateHost(v)) return true;
  const list = [...splitList(process.env.OFFICE_IPS), ...settingsNow().officeIps];
  return list.includes(v);
}

// per-IP limit: limiter('auth', 60, 60000) -> middleware; 429 when over
function limiter(name, max, windowMs, message) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = normIp(req.ip || (req.socket && req.socket.remoteAddress));
    const now = Date.now(); let h = hits.get(ip);
    if (!h || now - h.first > windowMs) { h = { n: 0, first: now }; hits.set(ip, h); }
    h.n += 1;
    if (hits.size > 10000) for (const [k, v] of hits) if (now - v.first > windowMs) hits.delete(k);
    if (h.n > max) {
      res.setHeader('Retry-After', String(Math.ceil((h.first + windowMs - now) / 1000)));
      return res.status(429).json({ success: false, error: message || 'Too many requests - wait a minute and try again.' });
    }
    next();
  };
}

// "trust proxy": which proxies in front of EagleView may say who the real client is (X-Forwarded-For).
// Default: only this computer (a reverse proxy such as Caddy / IIS on the same PC). TRUST_PROXY in .env for others
// (e.g. the Sophos firewall's LAN address).
function trustProxySetting() {
  const v = String(process.env.TRUST_PROXY || '').trim();
  if (!v) return 'loopback';
  if (/^(true|false)$/i.test(v)) return /^true$/i.test(v);
  return v.split(',').map(x => x.trim()).filter(Boolean);
}

module.exports = { originAllowed, headers, publicBase, isOfficeIp, isPrivateHost, limiter, trustProxySetting, clearCache, normIp };
