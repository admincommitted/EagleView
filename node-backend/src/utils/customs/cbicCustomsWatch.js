// New customs / trade updates by e-mail, with the PDF. Sources, each switchable in Settings > Email > Customs and
// trade updates:
//   cbic            CBIC portal, Customs latest updates (notifications, circulars, instructions) - every 10 minutes
//                   GET /api/cbic-notification-msts/fetchUpdatesByTaxId/1000002 -> newest 4
//                   GET /api/<cbic-notification-msts|cbic-circular-msts|cbic-instruction-msts>/download/<id>/ENG -> {data: base64 PDF}
//   cbic_circulars  CBIC portal, the full list of customs circulars - every hour (so a circular is not missed when more
//                   than 4 updates come out between two checks)
//                   GET /api/cbic-circular-msts/fetchAllCircularsByTaxId/1000002 -> [{id, circularNo, circularName, circularDt, ...}]
//   cbic_exrate     CBIC customs exchange rates published on ICEGATE (cbicExchangeRates.js) - every 10 minutes. A new
//                   notification, or changed rates in one of the newest two, is mailed with the new rates next to the
//                   ones they replace; the rates go into the rate history at once.
//   icegate_adv     www.icegate.gov.in advisories, 13 category pages (/advisories/<category>) - every hour. A new advisory
//                   or a new version of one is mailed; the PDF is taken from the advisory's page (pdf.js viewer "file=").
//   icegate_news    the "Latest Updates" ticker on the ICEGATE home page - every hour (a PDF is attached when the item links one)
//   dgft            www.dgft.gov.in/CP/?opt=notification | public-notice | trade-notice | circular - every hour
//   page:<id>       pages added by the user (e.g. a Custom House public notice page): every PDF link that appears on the
//                   page is mailed - every hour
// Rules for every source:
//   * the first time a source (or one page of it) is read, what is there is only noted - no mail flood;
//   * an entry is marked as seen only after its mail went out, so a failed mail is tried again at the next check;
//   * when one page suddenly shows more than DIGEST_OVER new entries (site changed its layout), one summary mail with
//     the links is sent instead of one mail each;
//   * the PDFs are also kept in uploads/cbic_customs (CBIC) and uploads/trade_updates/<source> (the others).
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import tls from 'node:tls';
import { UPLOADS_DIR } from '../../config/env.js';
import { CurrencyRateHistory } from '../../models/index.js';
import * as settingsStore from '../common/settingsStore.js';
import { sendMail } from '../integrations/mailer.js';
import * as exchangeRates from './cbicExchangeRates.js';

const BASE = process.env.CBIC_TAXINFO_URL || 'https://taxinformation.cbic.gov.in';
const ICEGATE = (process.env.ICEGATE_WWW_URL || 'https://www.icegate.gov.in').replace(/\/+$/, '');
const DGFT = process.env.DGFT_WATCH_URL || 'https://www.dgft.gov.in/CP/';
const CUSTOMS = 1000002;
const TIMEOUT = 30000;
const TLS_PROBE_TIMEOUT_MS = 15000;
const MAX_BYTES = 25 * 1024 * 1024;
const ATTACH_MAX = 15 * 1024 * 1024;
const DIGEST_OVER = 8;
const TICK_MS = 10 * 60 * 1000; // CBIC latest updates
const HOURLY_MS = 60 * 60 * 1000; // the other sources
const FIRST_CHECK_DELAY_MS = 2 * 60 * 1000;
const RUN_EARLY_MARGIN_MS = 60000;
const MAX_REDIRECTS = 5;
const MAX_ISSUER_DOWNLOADS = 3;
const MAX_SEEN_KEYS = 1500;
const MAX_CIRCULARS = 30;
const MAX_DGFT_ROWS = 30;
const MAX_PAGE_PDF_LINKS = 80;
const MAX_SUBJECT_LENGTH = 240;
const IST_OFFSET_MS = 330 * 60000;
const KEEP_DIR = path.join(UPLOADS_DIR, 'cbic_customs');
const KEEP_OTHER = path.join(UPLOADS_DIR, 'trade_updates');
const DEFAULT_TO = 'admin@committedcargo.com, impops@committedcargo.com';
const K = {
  to: 'CBIC_WATCH_TO',
  on: 'CBIC_WATCH_ON',
  seen: 'CBIC_WATCH_SEEN',
  last: 'CBIC_WATCH_LAST',
  off: 'WATCH_SOURCES_OFF',
  seeded: 'WATCH_SEEDED',
  state: 'WATCH_STATE',
  pages: 'WATCH_PAGES',
};
const ICEGATE_CATS = [
  'electronic-filing',
  'e-payment',
  'enquiries',
  'igcr',
  "integrate-with-icegate-on-api's",
  'registration',
  'reassessment-and-customs-refund',
  'scmtr',
  'sez',
  'swift',
  'warehouse-related-modules',
  'webforms',
  'others',
];
const ICEGATE_CAT_NAME = {
  'e-payment': 'E-Payment',
  igcr: 'IGCR',
  "integrate-with-icegate-on-api's": "Integrate with ICEGATE on API's",
  scmtr: 'SCMTR',
  sez: 'SEZ',
  swift: 'SWIFT',
};
const DGFT_OPTS = [
  ['notification', 'Notification'],
  ['public-notice', 'Public Notice'],
  ['trade-notice', 'Trade Notice'],
  ['circular', 'Circular'],
];

// ---- HTTPS with the full certificate check ----
// The CBIC server sends only its own certificate, not the intermediate CA certificate between it and the root. Browsers
// fetch that intermediate themselves (from the "CA Issuers" address written in the certificate); Node does not, so it
// says UNABLE_TO_VERIFY_LEAF_SIGNATURE. Here the same is done as in a browser: the server's certificate is read once,
// the missing intermediate(s) are downloaded from the CA Issuers address, and the connection is made again with the
// normal, full check (Node's root list + those intermediates). The check is never switched off. Used for every site.
let ROOTS = tls.rootCertificates;
let extraCa = []; // intermediates learnt from the CA Issuers address (PEM)
const CHAIN_ERRORS = [
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_GET_ISSUER_CERT',
];
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

function rawGet(url, { ca, timeout = TIMEOUT, accept = 'application/json, text/plain, */*', hops = 0 } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const lib = target.protocol === 'http:' ? http : https;
    const opts = {
      method: 'GET',
      headers: { Accept: accept, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EagleView' },
      timeout,
    };
    if (lib === https && ca) opts.ca = ca;
    const req = lib.request(target, opts, (res) => {
      if (REDIRECT_STATUSES.includes(res.statusCode) && res.headers.location && hops < MAX_REDIRECTS) {
        res.resume();
        return resolve(rawGet(new URL(res.headers.location, target).href, { ca, timeout, accept, hops: hops + 1 }));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy(Object.assign(new Error('answer larger than 25 MB'), { code: 'TOO_BIG' }));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () =>
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks),
          type: String(res.headers['content-type'] || ''),
        }),
      );
    });
    req.on('timeout', () =>
      req.destroy(Object.assign(new Error(`did not answer within ${timeout / 1000} s`), { code: 'TIMEOUT' })),
    );
    req.on('error', reject);
    req.end();
  });
}

// the certificate the server shows (read only to learn where its issuer can be downloaded; nothing is sent)
function serverCert(host, port = 443) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate(true);
      socket.end();
      resolve(cert);
    });
    socket.setTimeout(TLS_PROBE_TIMEOUT_MS, () => socket.destroy(new Error('no TLS answer')));
    socket.on('error', reject);
  });
}

const caIssuerUrl = (infoAccess) => {
  if (!infoAccess) return '';
  if (typeof infoAccess === 'object') return (infoAccess['CA Issuers - URI'] || [])[0] || '';
  const m = /CA Issuers - URI:(\S+)/.exec(String(infoAccess));
  return m ? m[1] : '';
};

const learnt = new Set();
async function learnChain(host, port) {
  const rootSubjects = new Set(
    ROOTS.map((pem) => {
      try {
        return new crypto.X509Certificate(pem).subject;
      } catch {
        return '';
      }
    }),
  );
  const leaf = await serverCert(host, port);
  let url = caIssuerUrl(leaf.infoAccess);
  const downloaded = [];
  for (let i = 0; i < MAX_ISSUER_DOWNLOADS && url; i++) {
    const r = await rawGet(url, { timeout: TLS_PROBE_TIMEOUT_MS });
    if (r.status !== 200 || !r.body.length) throw new Error(`could not download the issuer certificate from ${url}`);
    const cert = new crypto.X509Certificate(r.body); // DER or PEM
    downloaded.push(cert.toString());
    if (rootSubjects.has(cert.issuer) || cert.issuer === cert.subject) break; // reached a trusted root
    url = caIssuerUrl(cert.infoAccess);
  }
  if (!downloaded.length) throw new Error('the certificate has no CA Issuers address');
  extraCa = [...new Set([...extraCa, ...downloaded])];
  learnt.add(host + ':' + port);
  console.log(
    `[Trade updates] ${host}: ${downloaded.length} intermediate certificate(s) added from the CA Issuers address`,
  );
}

const siteName = (url) => {
  try {
    const host = new URL(url).host;
    return url.startsWith(BASE) ? 'CBIC portal' : host;
  } catch {
    return 'the site';
  }
};

// GET a URL (any site) with the certificate help above. Returns { body: Buffer, type }.
async function fetchUrl(url, { accept } = {}) {
  const once = () => rawGet(url, { ca: extraCa.length ? [...ROOTS, ...extraCa] : undefined, accept });
  let r;
  try {
    try {
      r = await once();
    } catch (e) {
      const target = new URL(url);
      const key = target.hostname + ':' + (target.port || 443);
      if (!CHAIN_ERRORS.includes(e.code) || learnt.has(key)) throw e;
      await learnChain(target.hostname, target.port || 443);
      r = await once();
    }
  } catch (e) {
    if (e.code === 'TIMEOUT') throw new Error(`${siteName(url)} did not answer within ${TIMEOUT / 1000} s`);
    if (e.code === 'TOO_BIG') throw new Error(`${siteName(url)}: file larger than 25 MB`);
    throw new Error(siteName(url) + ' not reachable from this server (' + (e.code || e.message) + ')');
  }
  if (r.status < 200 || r.status >= 300) throw new Error(`${siteName(url)} answered HTTP ${r.status}`);
  return r;
}

async function getJson(apiPath) {
  const r = await fetchUrl(BASE + apiPath);
  try {
    return JSON.parse(r.body.toString('utf8'));
  } catch {
    throw new Error('CBIC portal answered something that is not JSON');
  }
}
const getHtml = async (url) =>
  (await fetchUrl(url, { accept: 'text/html,application/xhtml+xml,*/*;q=0.8' })).body.toString('utf8');
const isPdf = (buf) => !!buf && buf.length > 5 && buf.slice(0, 1024).toString('latin1').includes('%PDF-');
async function getPdf(url) {
  const r = await fetchUrl(url, { accept: 'application/pdf,*/*' });
  if (!isPdf(r.body)) throw new Error('the link did not give a PDF');
  return r.body;
}

// ---- small HTML helpers (the pages are plain server-rendered HTML) ----
const ENT = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};
const decode = (s) =>
  String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      return String.fromCodePoint(isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10));
    }
    return ENT[entity.toLowerCase()] != null ? ENT[entity.toLowerCase()] : match;
  });
const text = (html) =>
  decode(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
const hrefs = (html) => {
  const out = [];
  const re = /href\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = re.exec(html))) out.push(decode(m[2] != null ? m[2] : m[3]).trim());
  return out;
};
const absUrl = (href, base) => {
  try {
    return new URL(href, base).href;
  } catch {
    return '';
  }
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (d, m, y) =>
  +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31 ? `${String(+d).padStart(2, '0')}-${MON[+m - 1]}-${y}` : '';
function niceDate(s) {
  s = String(s || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return dmy(m[3], m[2], m[1]);
  m = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(s);
  if (m) return dmy(m[1], m[2], m[3]);
  m = /(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{4})/.exec(s);
  if (m) return `${m[1].padStart(2, '0')}-${m[2][0].toUpperCase()}${m[2].slice(1, 3).toLowerCase()}-${m[3]}`;
  return '';
}
const today = () => {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return dmy(d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear());
};
const hash = (s, n = 16) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, n);
const fileBase = (u) => {
  try {
    return decodeURIComponent(new URL(u).pathname.split('/').pop() || '');
  } catch {
    return '';
  }
};
const isPdfLink = (url) => /\.pdf(\?|#|$)/i.test(url);

// ---- the sources ----
// Each source returns parts: [{ id, label, items: [...] } | { id, label, error }]. Items, newest first:
//   { key, number, title, type, category, date, view, pdfUrl?, pdf?: async () => Buffer, file }

// the portal gives a short name for display ("... India Pvt. Lt...") and the full one - the longer one is used
const fullName = (...names) =>
  names
    .map((n) =>
      String(n || '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .sort(
      (a, b) => b.replace(/\.{3}$/, '').length - a.replace(/\.{3}$/, '').length || (a.endsWith('...') ? 1 : -1),
    )[0] || '';

const cbicViewFolder = (updateType) => {
  if (/circular/i.test(updateType || '')) return 'Circulars';
  if (/instruction/i.test(updateType || '')) return 'Instructions';
  return 'Notifications';
};

// CBIC latest updates (the list the card shows)
async function latest() {
  const list = await getJson(`/api/cbic-notification-msts/fetchUpdatesByTaxId/${CUSTOMS}`);
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && x.id)
    .map((x) => ({
      id: Number(x.id),
      number: String(x.notificationNo || '').trim(),
      title: fullName(x.notificationName, x.notificationNameToBeDisplay),
      type: String(x.updateType || 'Notification').trim(),
      category: String(x.updateCategory || '').trim(),
      date: String(x.updatedDate || '').trim(),
      view: `${BASE}/view-pdf/${x.id}/ENG/${cbicViewFolder(x.updateType)}`,
    }));
}

// the PDF of one CBIC entry (Buffer) - tried on the resource of its type first, then the others
async function pdfOf(item) {
  const order = /circular/i.test(item.type)
    ? ['cbic-circular-msts', 'cbic-notification-msts', 'cbic-instruction-msts']
    : /instruction/i.test(item.type)
      ? ['cbic-instruction-msts', 'cbic-circular-msts', 'cbic-notification-msts']
      : ['cbic-notification-msts', 'cbic-circular-msts', 'cbic-instruction-msts'];
  let lastError = null;
  for (const resource of order) {
    try {
      const json = await getJson(`/api/${resource}/download/${item.id}/ENG`);
      const buf = json && json.data ? Buffer.from(String(json.data), 'base64') : null;
      if (isPdf(buf)) return buf;
      lastError = new Error('no PDF in the answer');
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error('PDF not found');
}
const cbicFile = (item) =>
  (item.number || 'CBIC-' + item.id).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '.pdf';
const cbicItem = (it) => ({ ...it, key: String(it.id), pdf: () => pdfOf(it), file: cbicFile(it) });

async function srcCbic() {
  const items = (await latest()).map(cbicItem);
  if (!items.length) throw new Error('the CBIC portal gave an empty list');
  return [{ id: 'cbic', label: 'CBIC latest updates', items }];
}

async function srcCbicCirculars() {
  const json = await getJson(`/api/cbic-circular-msts/fetchAllCircularsByTaxId/${CUSTOMS}`);
  const all = Array.isArray(json) ? json : json && Array.isArray(json.data) ? json.data : [];
  const list = all.filter(
    (x) => x && x.id && String(x.isActive || 'Y').toUpperCase() !== 'N' && !/hindi/i.test(x.contentLanguage || ''),
  );
  if (!list.length) throw new Error('the CBIC portal gave an empty circular list');
  const circularDay = (x) => String(x.circularDt || x.issueDt || x.createdDt || '');
  list.sort((a, b) => circularDay(b).localeCompare(circularDay(a)) || Number(b.id) - Number(a.id));
  const items = list.slice(0, MAX_CIRCULARS).map((x) => {
    const no = String(x.circularNo || '').trim();
    return cbicItem({
      id: Number(x.id),
      number: no ? (/customs/i.test(no) ? no : `${no}-Customs`) : '',
      title: String(x.circularName || '').trim(),
      type: 'Circular',
      category: String(x.circularCategory || '').trim(),
      date: niceDate(circularDay(x)),
      view: `${BASE}/view-pdf/${x.id}/ENG/Circulars`,
    });
  });
  return [{ id: 'cbic_circulars', label: 'CBIC circulars', items }];
}

const icegateCatName = (c) =>
  ICEGATE_CAT_NAME[c] ||
  c
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');

function parseIcegateAdvisories(html, cat) {
  const items = [];
  for (const row of html.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const cell = (name) => {
      const m = new RegExp(`<td[^>]*class="[^"]*views-field-${name}[^"]*"[^>]*>([\\s\\S]*?)</td>`, 'i').exec(row);
      return m ? m[1] : null;
    };
    const titleCell = cell('title');
    if (titleCell == null) continue;
    const href = hrefs(titleCell)[0];
    if (!href) continue;
    const view = absUrl(href, ICEGATE + '/');
    const version = text(cell('field-version') || '');
    const name = text(titleCell);
    items.push({
      key: new URL(view).pathname + '|' + version,
      number: '',
      title: name + (version ? ` (version ${version})` : ''),
      type: 'Advisory',
      category: icegateCatName(cat),
      date: niceDate(text(cell('field-advisory-date') || '')),
      view,
      pdf: () => icegateAdvisoryPdf(view),
      file: safeName(name + (version ? ' v' + version : '')),
    });
  }
  return items;
}

// the PDF shown on an advisory page: <iframe class="pdf" src="/themes/.../viewer.html?file=<url of the PDF>&...">
async function icegateAdvisoryPdf(view) {
  const html = await getHtml(view);
  let url = '';
  const m = /[?&]file=([^&"'\s>]+)/i.exec(html);
  if (m) {
    try {
      url = decodeURIComponent(decode(m[1]));
    } catch {
      url = decode(m[1]);
    }
  }
  if (!url) url = hrefs(html).find((h) => isPdfLink(h)) || '';
  if (!url) throw new Error('no PDF on the advisory page');
  return getPdf(absUrl(url, view));
}

async function srcIcegateAdv() {
  const parts = [];
  for (const cat of ICEGATE_CATS) {
    const id = 'icegate_adv:' + cat,
      label = 'ICEGATE advisories - ' + icegateCatName(cat);
    try {
      const html = await getHtml(`${ICEGATE}/advisories/${cat}`);
      const items = parseIcegateAdvisories(html, cat);
      // an empty category still shows the (empty) list; a page without it means the layout changed
      const listOnPage = items.length || /views-empty|views-table|class="view-content/.test(html);
      parts.push(listOnPage ? { id, label, items } : { id, label, error: 'no advisory list found on the page' });
    } catch (e) {
      parts.push({ id, label, error: e.message });
    }
  }
  return parts;
}

function parseIcegateNews(html) {
  const marquee =
    /<marquee[\s\S]*?<\/marquee>/i.exec(html) ||
    /class="marqueeContainer"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i.exec(html);
  if (!marquee) return null;
  const items = [];
  const re = /<div[^>]*>((?:(?!<\/?div)[\s\S])*?)<\/div>/gi;
  let m;
  while ((m = re.exec(marquee[0]))) {
    const inner = m[1];
    const itemText = text(inner);
    const pdfUrl =
      hrefs(inner)
        .map((h) => absUrl(h, ICEGATE + '/'))
        .find((h) => isPdfLink(h)) || '';
    if (!itemText && !pdfUrl) continue;
    const onlyLinkWords = !itemText || /^(click here|here|download|view)$/i.test(itemText);
    const title = onlyLinkWords && pdfUrl ? fileBase(pdfUrl).replace(/\.pdf$/i, '') : itemText;
    items.push({
      key: 'n:' + hash(itemText.toLowerCase() + '|' + pdfUrl),
      number: '',
      title: title.slice(0, 400),
      type: 'Latest update',
      category: '',
      date: today(),
      dateLabel: 'First seen',
      view: pdfUrl || ICEGATE + '/',
      pdfUrl,
      file: pdfUrl ? fileBase(pdfUrl) : '',
    });
  }
  return items;
}

async function srcIcegateNews() {
  const items = parseIcegateNews(await getHtml(ICEGATE + '/'));
  if (items == null) throw new Error('the Latest Updates ticker was not found on the ICEGATE home page');
  return [{ id: 'icegate_news', label: 'ICEGATE latest updates', items, emptyOk: true }];
}

function parseDgft(html, opt, type, pageUrl) {
  const tbody = /<tbody[\s\S]*?<\/tbody>/i.exec(html);
  if (!tbody) return [];
  const items = [];
  for (const row of tbody[0].match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const cells = (row.match(/<td[\s\S]*?<\/td>/gi) || []).map(text);
    if (cells.length < 5 || !cells[1]) continue;
    const date = niceDate(cells[4]) || niceDate(cells[5] || '');
    const pdfUrl =
      hrefs(row)
        .map((h) => absUrl(h.trim(), pageUrl))
        .find((h) => isPdfLink(h) || /content\.dgft\.gov\.in/i.test(h)) || '';
    items.push({
      key: `${opt}|${cells[1]}|${date}`,
      number: cells[1],
      title: cells[3] || cells.slice(2).sort((a, b) => b.length - a.length)[0] || '',
      type,
      category: '',
      date,
      view: pdfUrl || pageUrl,
      pdfUrl,
      file: pdfUrl ? fileBase(pdfUrl) : '',
    });
    if (items.length >= MAX_DGFT_ROWS) break;
  }
  return items;
}

async function srcDgft() {
  const parts = [];
  for (const [opt, type] of DGFT_OPTS) {
    const id = 'dgft:' + opt,
      label = 'DGFT ' + type.toLowerCase() + 's';
    const url = `${DGFT}${DGFT.includes('?') ? '&' : '?'}opt=${opt}`;
    try {
      const items = parseDgft(await getHtml(url), opt, type, url);
      parts.push(items.length ? { id, label, items } : { id, label, error: 'no rows found on the DGFT page' });
    } catch (e) {
      parts.push({ id, label, error: e.message });
    }
  }
  return parts;
}

// pages added by the user: "Name | https://..." or just the address, one per line
function parsePagesSetting(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(.*?)\s*\|\s*(https?:\/\/\S+)$/i.exec(line);
      const url = m ? m[2] : line;
      const name =
        m && m[1]
          ? m[1]
          : (() => {
              try {
                return new URL(url).host;
              } catch {
                return url;
              }
            })();
      return { id: 'page:' + hash(url, 10), name: name.slice(0, 60), url };
    })
    .filter((p) => /^https?:\/\/[^\s]+$/i.test(p.url));
}

const docType = (t) =>
  /public\s*notice/i.test(t)
    ? 'Public Notice'
    : /standing\s*order/i.test(t)
      ? 'Standing Order'
      : /trade\s*notice/i.test(t)
        ? 'Trade Notice'
        : /facility\s*notice/i.test(t)
          ? 'Facility Notice'
          : /circular/i.test(t)
            ? 'Circular'
            : /notification/i.test(t)
              ? 'Notification'
              : 'Document';

// the text of the table row / list item a link is in (the link itself often only says "Download")
function textAroundLink(html, linkIndex) {
  const startTr = html.lastIndexOf('<tr', linkIndex),
    startLi = html.lastIndexOf('<li', linkIndex);
  const start = Math.max(startTr, startLi);
  let around = '';
  if (start >= 0 && linkIndex - start < 4000) {
    const close = start === startTr ? '</tr>' : '</li>';
    const end = html.indexOf(close, linkIndex);
    if (end > 0 && end - start < 8000) around = text(html.slice(start, end));
  }
  // drop the serial number in front and the link words at the end ("1 PN 06/2026 ... Download")
  return around
    .replace(/^\d{1,4}\.?\s+/, '')
    .replace(/(\s+(download|view|click here|english|hindi|pdf|\(\d+(\.\d+)?\s*[km]b\)))+$/i, '')
    .trim();
}

function parsePdfLinks(html, pageUrl) {
  const items = [];
  const keys = new Set();
  const re = /<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = absUrl(decode(m[2] != null ? m[2] : m[3]).trim(), pageUrl);
    if (!url || !isPdfLink(url) || keys.has(url)) continue;
    keys.add(url);
    const around = textAroundLink(html, m.index);
    const own = text(m[4]);
    const title = (around.length > own.length + 3 ? around : own) || fileBase(url);
    const ownDate = niceDate(title) || niceDate(fileBase(url));
    items.push({
      key: url,
      number: '',
      title: title.slice(0, 400),
      type: docType(title + ' ' + url),
      category: '',
      date: ownDate || today(),
      dateLabel: ownDate ? '' : 'First seen',
      view: url,
      pdfUrl: url,
      file: fileBase(url),
    });
    if (items.length >= MAX_PAGE_PDF_LINKS) break;
  }
  return items;
}

async function srcPage(page) {
  const items = parsePdfLinks(await getHtml(page.url), page.url);
  return [{ id: page.id, label: page.name, items, emptyOk: true }];
}

// ---- CBIC customs exchange rates ----
// The two newest notifications on ICEGATE (list + rates, cbicExchangeRates.js). The key is the number plus a hash of
// the rates, so a notification whose rates are changed later (revised) is mailed again.
const XR_FIRST = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AED', 'SGD', 'CHF', 'AUD', 'CAD'];
const xrHash = (rates) =>
  hash(
    (rates || [])
      .map(
        (r) =>
          `${r.code}:${Number(r.units) || 1}:${Number(r.importRate).toFixed(4)}:${Number(r.exportRate).toFixed(4)}`,
      )
      .sort()
      .join(','),
    10,
  );
const xrItem = (notn, published, prev) => ({
  key: notn.number + '|' + xrHash(notn.rates),
  number: notn.number,
  title: `customs exchange rates in force from ${niceDate(notn.effective)}`,
  type: 'Exchange Rate Notification',
  category: '',
  date: niceDate(published || notn.effective),
  view: ICEGATE + '/',
  notn,
  published,
  prev,
});

async function srcExRate() {
  const list = await exchangeRates.listNotifications(); // newest first
  if (!list.length) throw new Error('ICEGATE gave no exchange-rate notification');
  const items = [];
  for (let i = 0; i < Math.min(2, list.length); i++) {
    items.push(xrItem(await exchangeRates.getNotification(list[i].number), list[i].published, list[i + 1] || null));
  }
  return [{ id: 'cbic_exrate', label: 'CBIC exchange rates', items }];
}

// the rates a notification replaces: for a revised one the rates EagleView had for it, else the previous notification
async function ratesBefore(item, notn, revised) {
  if (revised) {
    try {
      const rows = await CurrencyRateHistory.findAll({ where: { notificationNo: 'CBIC ' + notn.number }, raw: true });
      if (rows.length) {
        const rates = rows.map((r) => ({
          code: r.currencyCode,
          units: Number(r.units) || 1,
          importRate: Number(r.importRate) * (Number(r.units) || 1),
          exportRate: Number(r.exportRate) * (Number(r.units) || 1),
        }));
        return { before: rates, beforeLabel: `the earlier rates of notification ${notn.number}` };
      }
    } catch {
      /* history not there yet */
    }
  }
  if (item.prev) {
    try {
      const previous = await exchangeRates.getNotification(item.prev.number);
      return {
        before: previous.rates,
        beforeLabel: `notification ${previous.number} (in force from ${niceDate(previous.effective)})`,
      };
    } catch {
      /* ICEGATE busy - mail without the old rates */
    }
  }
  return { before: null, beforeLabel: '' };
}

// the rates go in the history now; a revised notification that is in force today is put in the Currency master at
// once (the 10-minute switch only looks at the notification number). Returns the sentence for the mail, or ''.
async function keepRatesInHistory(notn, revised) {
  try {
    const stored = await exchangeRates.storeNotification(notn, 'ICEGATE (mail check)');
    if (revised && stored.changed) {
      const inForce = await exchangeRates.notificationInForce();
      if (inForce && inForce.number === notn.number) {
        await exchangeRates.promote({ force: true, user: 'Auto (revised rates)' });
        return 'The revised rates are in force today, so EagleView has put them in the Currency master already.';
      }
    }
  } catch (e) {
    console.warn('[Trade updates] exchange rates not kept in the history:', e.message);
  }
  return '';
}

const twoDecimals = (v) => (v == null || isNaN(v) ? '' : Number(v).toFixed(2));

// the mail: the new rates next to the ones they replace
async function mailExRate(item, to, { test = false, src, seen = null } = {}) {
  const notn = item.notn;
  const revised = !test && !!seen && [...seen].some((k) => String(k).startsWith(notn.number + '|'));
  const { before, beforeLabel } = await ratesBefore(item, notn, revised);
  const applied = test ? '' : await keepRatesInHistory(notn, revised);
  const oldByCode = new Map((before || []).map((r) => [r.code, r]));
  const displayOrder = (code) => {
    const i = XR_FIRST.indexOf(code);
    return i < 0 ? 100 : i;
  };
  const rates = [...notn.rates].sort(
    (a, b) => displayOrder(a.code) - displayOrder(b.code) || a.code.localeCompare(b.code),
  );
  const diff = (now, old) => {
    if (old == null || isNaN(old)) return before ? 'new' : '';
    const d = +(now - old).toFixed(4);
    return d === 0 ? '-' : (d > 0 ? '&#9650; +' : '&#9660; ') + d.toFixed(2);
  };
  let changed = 0;
  const rows = rates
    .map((r) => {
      const old = oldByCode.get(r.code);
      const isChanged =
        before &&
        (!old || Math.abs(old.importRate - r.importRate) > 1e-6 || Math.abs(old.exportRate - r.exportRate) > 1e-6);
      if (isChanged) changed++;
      const td = (v, align = 'right') =>
        `<td style="padding:3px 10px;border-bottom:1px solid #eee;text-align:${align}">${v}</td>`;
      return (
        `<tr style="${isChanged ? 'font-weight:bold' : ''}">${td(esc(r.code) + ' <span style="font-weight:normal;color:#777">' + esc(r.name || '') + '</span>', 'left')}${td(Number(r.units) || 1)}` +
        `${td(twoDecimals(r.importRate))}${before ? td(old ? twoDecimals(old.importRate) : '') + td(diff(r.importRate, old && old.importRate)) : ''}${td(twoDecimals(r.exportRate))}${before ? td(old ? twoDecimals(old.exportRate) : '') + td(diff(r.exportRate, old && old.exportRate)) : ''}</tr>`
      );
    })
    .join('');
  const gone = before ? before.filter((o) => !notn.rates.some((r) => r.code === o.code)).map((o) => o.code) : [];
  const th = (t) => `<th style="padding:4px 10px;text-align:right;background:#f1f5f9">${t}</th>`;
  const head = `<tr><th style="padding:4px 10px;text-align:left;background:#f1f5f9">Currency</th>${th('Units')}${th('Import')}${before ? th('Import before') + th('Change') : ''}${th('Export')}${before ? th('Export before') + th('Change') : ''}</tr>`;
  const usd = notn.rates.find((r) => r.code === 'USD');
  const html = `<p>${test ? '<b>Test mail</b> - these are the newest rates now. ' : ''}${revised ? '<b>CBIC has changed the rates of an exchange-rate notification already published</b> (revised):' : 'CBIC has published new customs exchange rates on ICEGATE:'}</p>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
<tr><td style="padding:3px 12px 3px 0;color:#555">Notification</td><td><b>${esc(notn.number)}</b></td></tr>
${item.published ? `<tr><td style="padding:3px 12px 3px 0;color:#555">Published</td><td>${esc(niceDate(item.published))}</td></tr>` : ''}
<tr><td style="padding:3px 12px 3px 0;color:#555">In force from</td><td><b>${esc(niceDate(notn.effective))}</b></td></tr>
${before ? `<tr><td style="padding:3px 12px 3px 0;color:#555">Compared with</td><td>${esc(beforeLabel)} - ${changed} of ${notn.rates.length} currencies changed${gone.length ? '; no longer listed: ' + esc(gone.join(', ')) : ''}</td></tr>` : ''}
</table>
<p style="font-size:13px">Rates in rupees per unit shown (JPY / KRW per 100). Import rates go in the Bill of Entry, export rates in the Shipping Bill. ${applied || `EagleView keeps these rates and switches its Currency master to them by itself at midnight on ${esc(niceDate(notn.effective))}; a BE / SB takes the rates in force on its job date.`}</p>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">${head}${rows}</table>
${FOOT(src)}`;
  const subject = `${test ? '[TEST] ' : ''}CBIC Exchange Rates: notification ${notn.number}${revised ? ' REVISED' : ''}, in force from ${niceDate(notn.effective)}${usd ? ` - USD ${twoDecimals(usd.importRate)} / ${twoDecimals(usd.exportRate)}` : ''}`;
  await sendMail({ from: '"EagleView - CBIC exchange rates"', to: to.join(', '), subject, html, attachments: [] });
  return { number: notn.number + (revised ? ' (revised)' : ''), pdf: false, pdfError: '', changed, revised };
}

function sourceList(s) {
  const list = [
    {
      id: 'cbic',
      label: 'CBIC customs - latest notifications, circulars, instructions',
      site: BASE,
      prefix: 'CBIC Customs',
      group: 'cbic',
      every: TICK_MS,
      run: srcCbic,
    },
    {
      id: 'cbic_circulars',
      label: 'CBIC customs - full list of circulars',
      site: BASE,
      prefix: 'CBIC Customs',
      group: 'cbic',
      every: HOURLY_MS,
      run: srcCbicCirculars,
    },
    {
      id: 'cbic_exrate',
      label: 'CBIC customs exchange rates (on ICEGATE) - a new notification or changed rates',
      site: exchangeRates.BASE,
      prefix: 'CBIC Exchange Rates',
      group: 'cbic_exrate',
      every: TICK_MS,
      run: srcExRate,
    },
    {
      id: 'icegate_adv',
      label: 'ICEGATE advisories (all 13 categories)',
      site: ICEGATE,
      prefix: 'ICEGATE',
      group: 'icegate_adv',
      every: HOURLY_MS,
      run: srcIcegateAdv,
    },
    {
      id: 'icegate_news',
      label: 'ICEGATE home page - Latest Updates',
      site: ICEGATE,
      prefix: 'ICEGATE',
      group: 'icegate_news',
      every: HOURLY_MS,
      run: srcIcegateNews,
    },
    {
      id: 'dgft',
      label: 'DGFT notifications, public notices, trade notices, circulars',
      site: DGFT.replace(/\/CP\/?.*$/, ''),
      prefix: 'DGFT',
      group: 'dgft',
      every: HOURLY_MS,
      run: srcDgft,
    },
  ];
  for (const page of parsePagesSetting(s.pages)) {
    list.push({
      id: page.id,
      label: page.name,
      site: page.url,
      prefix: page.name,
      group: page.id,
      every: HOURLY_MS,
      custom: true,
      run: () => srcPage(page),
    });
  }
  return list;
}

// ---- settings ----
const seenKey = (group) =>
  group === 'cbic' ? K.seen : 'WATCH_SEEN_' + group.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
const parse = (v, fallback) => {
  try {
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

async function settings() {
  const s = await settingsStore.getMany([K.to, K.on, K.seen, K.last, K.off, K.seeded, K.state, K.pages]);
  const seen = parse(s[K.seen], null);
  return {
    to: s[K.to] != null && String(s[K.to]).trim() !== '' ? String(s[K.to]) : DEFAULT_TO,
    on: String(s[K.on] == null ? '1' : s[K.on]) !== '0',
    seen: Array.isArray(seen) ? seen : null,
    last: parse(s[K.last], null),
    off: parse(s[K.off], []),
    seeded: parse(s[K.seeded], []),
    state: parse(s[K.state], {}),
    pages: String(s[K.pages] || ''),
  };
}

const recipients = (to) =>
  String(to || '')
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
const esc = (t) =>
  String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const safeName = (s) =>
  String(s || '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

// ---- mails ----
const FOOT = (src) =>
  `<p style="color:#777;font-size:12px">Sent by EagleView from ${esc(src.label)} (${esc(src.site)}). Recipients and sources are set in EagleView: Settings &gt; Email &gt; Customs and trade updates.</p>`;
const DEFAULT_SOURCE = {
  id: 'cbic',
  label: 'CBIC Tax Information Portal (Customs - Latest Updates)',
  site: BASE,
  prefix: 'CBIC Customs',
  group: 'cbic',
};

async function downloadItemPdf(item, src) {
  try {
    if (item.pdf) return { pdf: await item.pdf(), pdfError: '' };
    if (item.pdfUrl) return { pdf: await getPdf(item.pdfUrl), pdfError: '' };
    if (item.id && src.group === 'cbic') return { pdf: await pdfOf(item), pdfError: '' };
  } catch (e) {
    return { pdf: null, pdfError: e.message };
  }
  return { pdf: null, pdfError: '' };
}

function keepPdfCopy(pdf, src, fileName) {
  try {
    const dir = src.group === 'cbic' ? KEEP_DIR : path.join(KEEP_OTHER, safeName(src.group.replace(':', '_')));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), pdf);
  } catch {
    /* keeping a copy is optional */
  }
}

function pdfSentence(item, src, pdf, attach, pdfError) {
  if (attach) return 'The PDF is attached.';
  if (pdf) return `The PDF is ${(pdf.length / 1048576).toFixed(1)} MB, too big to attach - open it from the link.`;
  if (item.pdf || item.pdfUrl || src.group === 'cbic') return `The PDF could not be downloaded (${esc(pdfError)}).`;
  return 'No PDF is linked to this entry.';
}

async function mailOne(item, to, { test = false, src = null, seen = null } = {}) {
  src = src || DEFAULT_SOURCE;
  if (src.group === 'cbic_exrate') return mailExRate(item, to, { test, src, seen }); // a rate table, no PDF
  const { pdf, pdfError } = await downloadItemPdf(item, src);
  let name =
    safeName(item.file || (src.group === 'cbic' ? cbicFile(item) : '')) ||
    safeName((item.number || item.title || 'document').slice(0, 60)) ||
    'document';
  if (!/\.pdf$/i.test(name)) name += '.pdf';
  if (pdf) keepPdfCopy(pdf, src, name);
  const attach = pdf && pdf.length <= ATTACH_MAX;
  const row = (k, v) =>
    v
      ? `<tr><td style="padding:4px 12px 4px 0;color:#555;vertical-align:top">${k}</td><td style="padding:4px 0">${v}</td></tr>`
      : '';
  const what =
    src.group === 'cbic'
      ? `CBIC has published a new customs ${esc(item.type.toLowerCase())}:`
      : `New on ${esc(src.label)}:`;
  const html = `<p>${test ? '<b>Test mail</b> - this is the newest entry now. ' : ''}${what}</p>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">
${row('Number', item.number ? '<b>' + esc(item.number) + '</b>' : '')}${row(item.dateLabel || 'Date', esc(item.date))}${row('Type', esc(item.type) + (item.category ? ' - ' + esc(item.category) : ''))}${row('Subject', esc(item.title))}
</table>
<p>${pdfSentence(item, src, pdf, attach, pdfError)} Link: <a href="${esc(item.view)}">${esc(item.view)}</a></p>
${FOOT(src)}`;
  const documentDate = item.date && !item.dateLabel ? item.date : ''; // a "first seen" day is not the document's date
  // an ICEGATE advisory names its category in the subject ("ICEGATE Advisory - Integrate with ICEGATE on API's")
  const kind = item.type + (src.group === 'icegate_adv' && item.category ? ' - ' + item.category : '');
  const dateSuffix = documentDate ? ' (' + documentDate + ')' : '';
  const subject = (
    `${test ? '[TEST] ' : ''}${src.prefix} ${kind}` +
    (item.number ? `: ${item.number}${dateSuffix} - ` : `${dateSuffix}: `) +
    item.title
  )
    .replace(/\s+/g, ' ')
    .slice(0, MAX_SUBJECT_LENGTH);
  await sendMail({
    from: `"EagleView - ${src.group === 'cbic' ? 'CBIC' : src.prefix.replace(/"/g, '')} updates"`,
    to: to.join(', '),
    subject,
    html,
    attachments: attach ? [{ filename: name, content: pdf, contentType: 'application/pdf' }] : [],
  });
  return { number: item.number || item.title.slice(0, 60), pdf: !!attach, pdfError };
}

async function mailDigest(src, part, items, to) {
  const rows = items
    .map(
      (i) =>
        `<tr><td style="padding:3px 10px 3px 0">${esc(i.date)}</td><td style="padding:3px 10px 3px 0">${esc(i.type)}</td><td style="padding:3px 0"><a href="${esc(i.view)}">${esc([i.number, i.title].filter(Boolean).join(' - '))}</a></td></tr>`,
    )
    .join('\n');
  const html = `<p>${items.length} new entries were found at once on <b>${esc(part.label)}</b>. To avoid ${items.length} separate mails they are listed here (no PDFs attached) - open each from its link. If they are old ones, the site has probably changed its page.</p>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">${rows}</table>${FOOT(src)}`;
  await sendMail({
    from: `"EagleView - ${src.prefix.replace(/"/g, '')} updates"`,
    to: to.join(', '),
    subject: `${src.prefix}: ${items.length} new entries on ${part.label}`.slice(0, MAX_SUBJECT_LENGTH),
    html,
    attachments: [],
  });
}

// ---- the check ----
const newestSummary = (item) =>
  item
    ? {
        number: item.number,
        title: item.title.slice(0, 160),
        date: item.date,
        dateLabel: item.dateLabel || '',
        view: item.view,
      }
    : null;

// "dd-Mon-yyyy" -> ms, 0 when not a date
const dayMs = (d) => {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{4})/.exec(String(d || ''));
  return m ? new Date(`${m[2]} ${m[1]}, ${m[3]}`).getTime() || 0 : 0;
};

// mails the new entries of one page of a source; `run` collects what was sent / failed for the check result
async function mailNewEntries(src, part, seen, to, run) {
  const fresh = part.items.filter((i) => !seen.has(i.key)).reverse(); // oldest first
  if (!fresh.length) return;
  if (!to.length) {
    run.errors.push({ source: part.label, error: 'no e-mail id in Settings > Email > Customs and trade updates' });
    return;
  }
  if (fresh.length > DIGEST_OVER) {
    try {
      await mailDigest(src, part, fresh, to);
      fresh.forEach((i) => seen.add(i.key));
      run.sent.push(`${part.label}: ${fresh.length} new (one summary mail)`);
    } catch (e) {
      run.failed.push({ number: part.label + ' summary', error: e.message });
    }
    return;
  }
  for (const item of fresh) {
    const label = src.group === 'cbic' ? item.number : `${src.prefix} ${item.number || item.title.slice(0, 50)}`;
    try {
      const r = await mailOne(item, to, { src, seen });
      run.sent.push(label + (r.revised ? ' (revised)' : ''));
      seen.add(item.key);
      console.log(
        `[Trade updates] ${label} mailed to ${to.join(', ')}${r.pdf ? ' with the PDF' : ' (no PDF' + (r.pdfError ? ': ' + r.pdfError : '') + ')'}`,
      );
    } catch (e) {
      run.failed.push({ number: label, error: e.message });
      console.warn(`[Trade updates] ${label}: mail failed - ${e.message}`);
    }
  }
}

// the card line of a source after its parts were read: ok / error, and the newest entry of all its pages by date
function finishSourceState(sourceState, partCount) {
  if (!sourceState.parts) {
    sourceState.ok = false;
    sourceState.error = sourceState.partErrors[0] || 'nothing read';
  } else if (sourceState.partErrors.length) {
    sourceState.ok = false;
    sourceState.error = `${sourceState.partErrors.length} of ${partCount} pages not read - ${sourceState.partErrors[0]}`;
  }
  delete sourceState.partErrors;
  if (sourceState.pages.length > 1) {
    const best = sourceState.pages
      .filter((p) => p.newest)
      .sort((a, b) => dayMs(b.newest.date) - dayMs(a.newest.date))[0];
    if (best) sourceState.newest = best.newest;
  }
  if (sourceState.pages.length < 2) delete sourceState.pages;
}

let running = false;
const lastRun = {}; // source id -> ms of its last run (this process)

async function checkNow({ by = 'Auto', auto = false } = {}) {
  if (running) return { busy: true };
  running = true;
  const at = new Date().toISOString();
  try {
    const s = await settings();
    const to = recipients(s.to);
    const off = new Set(Array.isArray(s.off) ? s.off : []);
    const seeded = new Set(Array.isArray(s.seeded) ? s.seeded : []);
    if (Array.isArray(s.seen)) seeded.add('cbic'); // older installs kept only the CBIC seen list: CBIC is already noted
    const state = s.state && typeof s.state === 'object' ? s.state : {};
    const seenByGroup = {}; // group -> Set of seen keys
    const seenOf = async (group) => {
      if (!seenByGroup[group]) {
        if (group === 'cbic') seenByGroup[group] = new Set((s.seen || []).map(String));
        else {
          const stored = (await settingsStore.getMany([seenKey(group)]))[seenKey(group)];
          seenByGroup[group] = new Set(parse(stored, []).map(String));
        }
      }
      return seenByGroup[group];
    };
    const run = { sent: [], failed: [], errors: [] };
    const seededNow = [];
    let cbicItems = [],
      first = false,
      anyRun = false;
    for (const src of sourceList(s)) {
      if (off.has(src.id)) continue;
      if (auto && lastRun[src.id] && Date.now() - lastRun[src.id] < src.every - RUN_EARLY_MARGIN_MS) continue;
      lastRun[src.id] = Date.now();
      anyRun = true;
      // pages = one line per page of the source (ICEGATE's 13 advisory categories, DGFT's 4 lists), so the card
      // shows each page - e.g. "Integrate with ICEGATE on API's" - with its count and newest entry
      const sourceState = { at, ok: true, error: '', count: 0, newest: null, parts: 0, partErrors: [], pages: [] };
      let parts;
      try {
        parts = await src.run();
      } catch (e) {
        parts = [{ id: src.id, label: src.label, error: e.message }];
      }
      const seen = await seenOf(src.group);
      for (const part of parts) {
        if (part.error) {
          sourceState.partErrors.push(part.label + ': ' + part.error);
          run.errors.push({ source: part.label, error: part.error });
          sourceState.pages.push({ label: part.label, error: part.error });
          continue;
        }
        sourceState.parts++;
        sourceState.count += part.items.length;
        sourceState.pages.push({ label: part.label, count: part.items.length, newest: newestSummary(part.items[0]) });
        if (!sourceState.newest && part.items[0]) sourceState.newest = newestSummary(part.items[0]);
        if (src.id === 'cbic') cbicItems = part.items;
        if (!seeded.has(part.id)) {
          // first look at this page: note, no mail
          part.items.forEach((i) => seen.add(i.key));
          seeded.add(part.id);
          seededNow.push(part.label);
          if (part.id === 'cbic') first = true;
          continue;
        }
        await mailNewEntries(src, part, seen, to, run);
      }
      finishSourceState(sourceState, parts.length);
      state[src.id] = sourceState;
    }
    if (!anyRun) return { at, by, skipped: true };
    const save = { [K.seeded]: JSON.stringify([...seeded]), [K.state]: JSON.stringify(state) };
    for (const [group, set] of Object.entries(seenByGroup))
      save[seenKey(group)] = JSON.stringify([...set].slice(-MAX_SEEN_KEYS));
    const last = {
      at,
      by,
      ok: !run.failed.length && !run.errors.length,
      first,
      seeded: seededNow,
      newest: cbicItems[0] ? `${cbicItems[0].number} (${cbicItems[0].date})` : (s.last && s.last.newest) || '',
      sent: run.sent,
      failed: run.failed,
      errors: run.errors,
    };
    save[K.last] = JSON.stringify(last);
    await settingsStore.setMany(save);
    return { ...last, items: cbicItems };
  } catch (e) {
    const last = { at, by, ok: false, error: e.message };
    try {
      await settingsStore.setMany({ [K.last]: JSON.stringify(last) });
    } catch {
      /* db busy */
    }
    console.warn('[Trade updates]', e.message);
    return last;
  } finally {
    running = false;
  }
}

// a test mail with the newest CBIC entry, to check the SMTP and the recipients (or, with source 'cbic_exrate', the
// newest exchange-rate notification compared with the one before)
async function sendTest(source) {
  const s = await settings();
  const to = recipients(s.to);
  if (!to.length) throw new Error('Enter at least one e-mail id');
  if (source === 'cbic_exrate') {
    const src = sourceList(s).find((x) => x.id === 'cbic_exrate');
    const [part] = await srcExRate();
    const r = await mailExRate(part.items[0], to, { test: true, src });
    return { ...r, to };
  }
  const items = await latest();
  if (!items.length) throw new Error('the CBIC portal gave an empty list');
  const r = await mailOne(cbicItem(items[0]), to, { test: true });
  return { ...r, to };
}

async function status() {
  const s = await settings();
  const off = new Set(Array.isArray(s.off) ? s.off : []);
  const sources = sourceList(s).map((x) => ({
    id: x.id,
    label: x.label,
    site: x.site,
    custom: !!x.custom,
    on: !off.has(x.id),
    every: x.every === TICK_MS ? '10 minutes' : '1 hour',
    state: (s.state || {})[x.id] || null,
  }));
  return {
    to: s.to,
    on: s.on,
    last: s.last,
    seenCount: Array.isArray(s.seen) ? s.seen.length : 0,
    every: '10 minutes (CBIC latest, exchange rates), 1 hour (others)',
    source: BASE,
    sources,
    pages: s.pages,
  };
}

let timer = null;
function start() {
  const run = async () => {
    try {
      if ((await settings()).on) await checkNow({ auto: true });
    } catch (e) {
      console.warn('[Trade updates]', e.message);
    }
  };
  const firstRun = setTimeout(run, FIRST_CHECK_DELAY_MS);
  if (firstRun.unref) firstRun.unref();
  timer = setInterval(run, TICK_MS);
  if (timer.unref) timer.unref();
  return timer;
}

// hooks for the test scripts
const _test = {
  xrHash,
  srcExRate,
  mailExRate,
  setRoots: (roots) => {
    ROOTS = roots;
    extraCa = [];
    learnt.clear();
  },
  parseIcegateAdvisories,
  parseIcegateNews,
  parseDgft,
  parsePdfLinks,
  niceDate,
  resetRuns: () => {
    for (const k of Object.keys(lastRun)) delete lastRun[k];
  },
  ageRuns: (ms) => {
    for (const k of Object.keys(lastRun)) lastRun[k] -= ms;
  },
};

export { latest, checkNow, sendTest, status, start, settings, recipients, K };
