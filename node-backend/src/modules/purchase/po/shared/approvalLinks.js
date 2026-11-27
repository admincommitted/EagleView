import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BACKEND_ROOT } from '../../../../config/env.js';
import { JWT_SECRET } from '../../../../middlewares/auth.middleware.js';
import { AppSetting } from '../../../../models/index.js';
import { get as getSetting, models as settingsModels } from '../../../../utils/common/settingsStore.js';

/**
 * Approve / Reject / Hold links in the approval e-mail and WhatsApp. The director opens them without logging in, so
 * each link carries a signature of the PO, the action, the expiry and the "by" name; a guessed or edited link is refused.
 */

const LINK_VALID_DAYS = 14;
const ONE_DAY_SECONDS = 86400;
const SIGNATURE_LENGTH = 32;
// links sent before links had an expiry are taken until this date
export const LEGACY_LINKS_VALID_UNTIL = Date.parse('2026-12-01T00:00:00+05:30');
const FALLBACK_DIRECTOR_EMAIL = 'hr1@committedgroup.com';
const FRONTEND_DEV_PORT = 5173;
const DEFAULT_BACKEND_PORT = 5001;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_URL_RE = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;
const FIELD_TUNNEL_URL_RE = /^https:\/\/[a-z0-9.-]+$/i;
const FIELD_PUBLIC_URL_FILE = path.join(BACKEND_ROOT, 'FIELD_PUBLIC_URL.txt');

export function actionSignature(poId, action, expiresAt, signedBy) {
  const signedText = expiresAt ? `po:${poId}:${action}:${expiresAt}:${signedBy || ''}` : `po:${poId}:${action}`;
  return crypto.createHmac('sha256', JWT_SECRET).update(signedText).digest('hex').slice(0, SIGNATURE_LENGTH);
}

export function actionLink(base, poId, action, signedBy) {
  const expiresAt = Math.floor(Date.now() / 1000) + LINK_VALID_DAYS * ONE_DAY_SECONDS;
  const signature = actionSignature(poId, action, expiresAt, signedBy);
  return `${base}/api/po/${poId}/action?action=${action}&by=${encodeURIComponent(signedBy)}&exp=${expiresAt}&sig=${signature}`;
}

export function signatureMatches(given, expected) {
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function appSetting(key) {
  try {
    const row = await AppSetting.findOne({ where: { key } });
    return row && row.value ? String(row.value).trim() : '';
  } catch {
    return '';
  }
}

async function purchaseWhatsappNumber() {
  try {
    const numbers = settingsModels.WhatsappModuleNumber;
    const rows = numbers ? await numbers.findAll() : [];
    const row =
      rows.find((entry) => /purchase/i.test(entry.moduleName || '')) ||
      rows.find((entry) => /director/i.test(entry.moduleName || ''));
    return row ? row.phoneNumber : null;
  } catch {
    return null;
  }
}

/** The director's WhatsApp: App Setting PO_DIRECTOR_PHONE, else DIRECTOR_PHONE in .env, else the "Purchase" number in Settings > WhatsApp. */
export async function directorPhone() {
  const setting = await appSetting('PO_DIRECTOR_PHONE');
  if (setting) return setting;
  if (process.env.DIRECTOR_PHONE) return process.env.DIRECTOR_PHONE;
  return purchaseWhatsappNumber();
}

/** The director's e-mail: App Setting PO_DIRECTOR_EMAIL (one or more), else DIRECTOR_EMAIL in .env, else the old address. */
export async function directorEmail() {
  const setting = await appSetting('PO_DIRECTOR_EMAIL');
  const addresses = String(setting || process.env.DIRECTOR_EMAIL || FALLBACK_DIRECTOR_EMAIL)
    .split(/[,;]/)
    .map((address) => address.trim())
    .filter((address) => EMAIL_RE.test(address));
  return addresses.length ? addresses.join(', ') : FALLBACK_DIRECTOR_EMAIL;
}

/** This PC's network address when the request came to localhost, so the links work on other devices. */
export function networkAddressOf(hostname) {
  let address = hostname;
  if (address !== 'localhost' && address !== '127.0.0.1') return address;
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const networkInterface of interfaces[name]) {
      if (networkInterface.family === 'IPv4' && !networkInterface.internal) address = networkInterface.address;
    }
  }
  return address;
}

export const frontendOriginOf = (requestOrigin, networkAddress) =>
  requestOrigin || `http://${networkAddress}:${FRONTEND_DEV_PORT}`;

async function publicAppUrl() {
  try {
    const url = await getSetting('app_public_url');
    if (PUBLIC_URL_RE.test(String(url || '').replace(/\/+$/, ''))) return String(url).replace(/\/+$/, '');
  } catch {
    return null;
  }
  return null;
}

// the internet address while start_field_internet.bat runs, so the director can approve from his phone on mobile data
function fieldTunnelUrl() {
  try {
    const url = fs.readFileSync(FIELD_PUBLIC_URL_FILE, 'utf8').trim();
    return FIELD_TUNNEL_URL_RE.test(url) ? url : null;
  } catch {
    return null;
  }
}

/**
 * Where the links point: App Setting PO_APPROVAL_LINK_BASE, else EagleView's public address (Settings > Security),
 * else the field tunnel address, else this PC's network address with the port this server really listens on.
 */
export async function approvalLinkBase(localPort, networkAddress) {
  const setting = (await appSetting('PO_APPROVAL_LINK_BASE')).replace(/\/+$/, '');
  if (/^https?:\/\//.test(setting)) return setting;
  const publicUrl = await publicAppUrl();
  if (publicUrl) return publicUrl;
  const tunnelUrl = fieldTunnelUrl();
  if (tunnelUrl) return tunnelUrl;
  const port = localPort || process.env.PORT || DEFAULT_BACKEND_PORT;
  return 'http://' + networkAddress + ':' + port;
}
