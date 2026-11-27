// Web security settings for EagleView when it is reachable from the internet.
//   originAllowed(origin)  - which web sites may call the API / socket from a browser (CORS).
//                            Allowed: no Origin (same site, tools, phones), localhost / 127.x / office LAN addresses
//                            (10.x, 172.16-31.x, 192.168.x) on any port, and the public address(es) in the setting
//                            "app_public_url" (Settings) or APP_PUBLIC_URL / FRONTEND_URL / CORS_EXTRA_ORIGINS in .env.
//   headers                - security headers on every answer (no framing by other sites, no MIME guessing,
//                            HSTS on HTTPS, no referrer to other sites, no camera / mic / geolocation for pages).
//   publicBase(req)        - the address used in e-mailed links (password reset): only a configured one, or the
//                            request's own host when that is a local / LAN host - never a host a stranger can send.
//   isOfficeIp(ip)         - LAN / localhost or the office IPs in setting "office_ips" / OFFICE_IPS (comma list).
//   limiter(name, max, ms) - simple per-IP request limit (in memory).
import net from 'node:net';
import { getMany } from '../common/settingsStore.js';

const SETTINGS_CACHE_MS = 60000;
const MAX_TRACKED_IPS = 10000;
const HSTS_MAX_AGE_SECONDS = 15552000; // 180 days
const DEFAULT_LIMIT_MESSAGE = 'Too many requests - wait a minute and try again.';

let cache = null;

const splitList = (value) =>
  String(value || '')
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const originOf = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol + '//' + parsed.host;
  } catch {
    return '';
  }
};

async function refreshSettingsCache() {
  try {
    const settings = await getMany(['app_public_url', 'office_ips']);
    cache = {
      at: Date.now(),
      publicUrls: splitList(settings.app_public_url),
      officeIps: splitList(settings.office_ips),
    };
  } catch {
    /* keep the last values */
  }
}

function settingsNow() {
  if (cache && Date.now() - cache.at < SETTINGS_CACHE_MS) return cache;
  const previous = cache || { at: 0, publicUrls: [], officeIps: [] };
  cache = { ...previous, at: Date.now() };
  // refreshed in the background; the first calls use .env only
  refreshSettingsCache();
  return cache;
}

const clearCache = () => {
  cache = null;
  settingsNow();
};

function configuredOrigins() {
  const fromEnv = [process.env.APP_PUBLIC_URL, process.env.FRONTEND_URL, ...splitList(process.env.CORS_EXTRA_ORIGINS)];
  return [...fromEnv, ...settingsNow().publicUrls].map(originOf).filter(Boolean);
}

function isPrivateIpv4(host) {
  const [first, second] = host.split('.').map(Number);
  return (
    first === 127 ||
    first === 10 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 169 && second === 254)
  );
}

function isPrivateHost(host) {
  const hostname = String(host || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1') return true;
  if (net.isIPv4(hostname)) return isPrivateIpv4(hostname);
  if (net.isIPv6(hostname)) return /^(fc|fd|fe80)/.test(hostname);
  return false;
}

function originAllowed(origin) {
  if (!origin) return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (isPrivateHost(url.hostname)) return true;
  return configuredOrigins().includes(url.protocol + '//' + url.host);
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
  if (req.secure) res.setHeader('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`);
  res.removeHeader('X-Powered-By');
  next();
}

function publicBase(req) {
  const configured = configuredOrigins();
  if (configured.length) return configured[0];
  const host = String((req.get && req.get('host')) || '');
  const hostname = host.replace(/:\d+$/, '');
  if (isPrivateHost(hostname)) return `${req.protocol}://${host}`;
  return null; // a public host nobody configured: do not trust it for e-mailed links
}

function normIp(ip) {
  return String(ip || '').replace(/^::ffff:/, '');
}

function isOfficeIp(ip) {
  const address = normIp(ip);
  if (isPrivateHost(address)) return true;
  const officeIps = [...splitList(process.env.OFFICE_IPS), ...settingsNow().officeIps];
  return officeIps.includes(address);
}

function forgetExpiredHits(hits, now, windowMs) {
  for (const [ip, hit] of hits) if (now - hit.first > windowMs) hits.delete(ip);
}

// per-IP limit: limiter('auth', 60, 60000) -> middleware; 429 when over
function limiter(name, max, windowMs, message) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = normIp(req.ip || (req.socket && req.socket.remoteAddress));
    const now = Date.now();
    let hit = hits.get(ip);
    if (!hit || now - hit.first > windowMs) {
      hit = { n: 0, first: now };
      hits.set(ip, hit);
    }
    hit.n += 1;
    if (hits.size > MAX_TRACKED_IPS) forgetExpiredHits(hits, now, windowMs);
    if (hit.n > max) {
      res.setHeader('Retry-After', String(Math.ceil((hit.first + windowMs - now) / 1000)));
      return res.status(429).json({ success: false, error: message || DEFAULT_LIMIT_MESSAGE });
    }
    next();
  };
}

// "trust proxy": which proxies in front of EagleView may say who the real client is (X-Forwarded-For).
// Default: only this computer (a reverse proxy such as Caddy / IIS on the same PC). TRUST_PROXY in .env for others
// (e.g. the Sophos firewall's LAN address).
function trustProxySetting() {
  const value = String(process.env.TRUST_PROXY || '').trim();
  if (!value) return 'loopback';
  if (/^(true|false)$/i.test(value)) return /^true$/i.test(value);
  return value
    .split(',')
    .map((proxy) => proxy.trim())
    .filter(Boolean);
}

export { originAllowed, headers, publicBase, isOfficeIp, limiter, trustProxySetting, clearCache, normIp };
