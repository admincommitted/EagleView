// routes/dgftIec.js  (13-Nov-2026)
// Party Master > "Fetch from DGFT": reads the public "View Any IEC" page of dgft.gov.in.
// The DGFT captcha is shown on the EagleView screen and typed by the user; nothing is solved here.
//   POST /api/dgft/iec/start            -> { sessionId, captcha }   (opens a DGFT session, gets the captcha picture)
//   POST /api/dgft/iec/captcha-refresh  { sessionId }               -> { captcha }
//   POST /api/dgft/iec/fetch            { sessionId, iec, name, captcha } -> { details, branches, people }
// One DGFT request set per button click; no background or bulk fetching.
const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseDocument } = require('htmlparser2');
const DomUtils = require('domutils');
const { httpsAgent } = require('../utils/tls');

const BASE = process.env.DGFT_CP_URL || 'https://www.dgft.gov.in/CP/'; // the env value is only for an offline test
const PAGE = BASE + '?opt=view-any-ice';
const ORIGIN = BASE.replace(/^(https?:\/\/[^/]+).*$/, '$1');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const TTL = 5 * 60 * 1000;
const sessions = new Map(); // sessionId -> { jar: {name: value}, csrf, at }

const sweep = () => { const now = Date.now(); for (const [k, v] of sessions) if (now - v.at > TTL) sessions.delete(k); };

function keepCookies(s, res) {
  const sc = res.headers['set-cookie'] || [];
  for (const c of sc) { const kv = c.split(';')[0]; const i = kv.indexOf('='); if (i > 0) s.jar[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); }
}
const cookieHeader = (s) => Object.entries(s.jar).map(([k, v]) => `${k}=${v}`).join('; ');

async function dgft(s, method, url, { data, accept, binary } = {}) {
  const res = await axios({
    method, url, data, httpsAgent, timeout: 30000, maxRedirects: 5,
    responseType: binary ? 'arraybuffer' : 'text', validateStatus: () => true,
    headers: {
      'User-Agent': UA, Referer: PAGE, Origin: ORIGIN,
      Accept: accept || 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-IN,en;q=0.9',
      ...(Object.keys(s.jar).length ? { Cookie: cookieHeader(s) } : {}),
      ...(method === 'post' ? { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' } : {}),
    },
  });
  keepCookies(s, res);
  if (res.status >= 400) throw new Error(`DGFT site answered HTTP ${res.status}`);
  return res;
}

async function captchaPicture(s) {
  const r = await dgft(s, 'get', BASE + 'SimpleCaptcha?' + Date.now(), { accept: 'image/*', binary: true });
  const type = String(r.headers['content-type'] || 'image/png').split(';')[0];
  if (!/^image\//.test(type)) throw new Error('DGFT did not send a captcha picture');
  return `data:${type};base64,${Buffer.from(r.data).toString('base64')}`;
}

const fail = (res, e, code = 502) => res.status(code).json({ success: false, error: e.message || String(e) });

router.post('/iec/start', async (req, res) => {
  sweep();
  try {
    const s = { jar: {}, csrf: '', at: Date.now() };
    const page = await dgft(s, 'get', PAGE);
    const m = String(page.data).match(/<meta[^>]+name=["']_csrf["'][^>]*content=["']([^"']+)["']/i) || String(page.data).match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']_csrf["']/i);
    s.csrf = m ? m[1] : '';
    const captcha = await captchaPicture(s);
    const sessionId = crypto.randomBytes(12).toString('hex');
    sessions.set(sessionId, s);
    res.json({ success: true, sessionId, captcha });
  } catch (e) { fail(res, new Error('Could not open the DGFT site: ' + (e.message || e))); }
});

router.post('/iec/captcha-refresh', async (req, res) => {
  sweep();
  const s = sessions.get(String((req.body || {}).sessionId || ''));
  if (!s) return fail(res, new Error('DGFT session expired. Open the window again.'), 410);
  try { s.at = Date.now(); res.json({ success: true, captcha: await captchaPicture(s) }); } catch (e) { fail(res, e); }
});

// ---------- result parsing ----------
const LABELS = ['IEC Number', 'PAN Number', 'Date of Birth / Incorporation', 'IEC Issuance Date', 'IEC Status', 'DEL Status', 'IEC Cancelled Date',
  'IEC Suspended Date', 'File Number', 'File Date', 'DGFT RA Office', 'Nature of Concern / Firm', 'Category of Exporters', 'Firm Name', 'Address'];
const norm = (t) => String(t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const key = (t) => norm(t).replace(/[:*]+$/, '').trim().toLowerCase().replace(/\s*\/\s*/g, '/');
const LABEL_KEYS = new Map(LABELS.map(l => [key(l), l]));
const BLOCK = new Set(['p', 'div', 'td', 'th', 'tr', 'li', 'label', 'span', 'b', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'dt', 'dd', 'section', 'input']);

function tokens(node, out) {
  for (const c of node.children || []) {
    if (c.type === 'text') { const t = norm(c.data); if (t) out.push(t); }
    else if (c.type === 'tag' || c.type === 'script' || c.type === 'style') {
      if (c.name === 'script' || c.name === 'style' || c.name === 'table') continue; // tables are read separately
      if (BLOCK.has(c.name)) out.push('\u0001');
      tokens(c, out);
      if (BLOCK.has(c.name)) out.push('\u0001');
    }
  }
  return out;
}

function tableRows(t) {
  return DomUtils.findAll(e => e.name === 'tr', [t]).filter(tr => DomUtils.findAll(e => e.name === 'table', tr.children || []).length === 0)
    .map(tr => (tr.children || []).filter(c => c.name === 'td' || c.name === 'th').map(c => norm(DomUtils.textContent(c))));
}

const STATES = ['ANDAMAN AND NICOBAR ISLANDS', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHANDIGARH', 'CHHATTISGARH', 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU', 'DADRA AND NAGAR HAVELI', 'DAMAN AND DIU', 'DELHI', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JAMMU AND KASHMIR', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'LADAKH', 'LAKSHADWEEP', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'ORISSA', 'PUDUCHERRY', 'PONDICHERRY', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND', 'UTTARANCHAL', 'WEST BENGAL'];

// 14-Nov-2026: ICEGATE takes Address 1 = 35 and Address 2 = 35 (the BE / SB JSON cuts there), AWB EDI 35 per line too.
// The street parts are packed into 35 + 35 on whole words; whatever does not fit is returned as overflow (never dropped silently).
function packParts(parts, L = 35) {
  // whole comma-parts first ("NEHRU PLACE" stays together); only a part longer than a line is broken on words
  const lines = ['', '']; let li = 0; const rest = [];
  const put = (txt, sep) => { // true when it fitted on the current or the next line
    while (li < 2) { const cand = lines[li] ? lines[li] + sep + txt : txt; if (cand.length <= L) { lines[li] = cand; return true; } if (!lines[li]) return false; li += 1; }
    return false;
  };
  for (const part of (parts || []).map(x => String(x || '').trim()).filter(Boolean)) {
    if (li >= 2) { rest.push(part); continue; }
    if (put(part, ', ')) continue;
    // too long for one line: words, continuing on the current line
    const words = []; part.split(/\s+/).filter(Boolean).forEach(w => { for (let i = 0; i < w.length; i += L) words.push(w.slice(i, i + L)); });
    let first = true; const left = [];
    for (const w of words) { if (left.length || li >= 2 || !put(w, first ? ', ' : ' ')) left.push(w); first = false; }
    if (left.length) rest.push(left.join(' '));
  }
  const tidy = (t) => t.replace(/^[,\s]+|[,\s]+$/g, '');
  return { address1: tidy(lines[0]), address2: tidy(lines[1]), overflow: tidy(rest.join(', ')) };
}

function packWords(parts, L = 35) {
  const words = [];
  String((parts || []).filter(Boolean).join(', ')).split(/\s+/).filter(Boolean).forEach(w => { for (let i = 0; i < w.length; i += L) words.push(w.slice(i, i + L)); });
  const lines = ['', '']; let li = 0; const rest = [];
  for (const w of words) {
    while (li < 2) { const cand = lines[li] ? lines[li] + ' ' + w : w; if (cand.length <= L) { lines[li] = cand; break; } li += 1; }
    if (li >= 2) rest.push(w);
  }
  const tidy = (t) => t.replace(/^[,\s]+|[,\s]+$/g, '');
  return { address1: tidy(lines[0]), address2: tidy(lines[1]), overflow: tidy(rest.join(' ')) };
}
// both ways are tried; the one that leaves less text out wins, whole parts on a tie
function pack35(parts, L = 35) {
  const a = packParts(parts, L), b = packWords(parts, L);
  return b.overflow.length < a.overflow.length ? b : a;
}

// "PLOT 12, MIDC, ANDHERI EAST, MUMBAI, MAHARASHTRA, 400093" -> pieces for the branch form
function splitAddress(a, withDistrict = true) {
  const full = norm(a).toUpperCase();
  const pin = (full.match(/(?:^|\D)(\d{3}\s?\d{3})(?!\d)/g) || []).map(x => x.replace(/\D/g, '')).pop() || '';
  // the state written last wins ("DELHI MATHURA ROAD, FARIDABAD, HARYANA" is Haryana)
  let state = '', at = -1;
  for (const st of STATES) { const re = new RegExp('(^|[^A-Z])' + st.replace(/ /g, '\\s+') + '(?=[^A-Z]|$)', 'g'); let m; while ((m = re.exec(full))) { if (m.index > at) { at = m.index; state = st; } } }
  const parts = full.split(',').map(x => x.trim()).filter(Boolean);
  // DGFT writes "street, street, CITY, DISTRICT, STATE, PIN" - take the city before the district (13-Nov-2026, from a live answer)
  if (state) {
    const base = parts.map(x => (pin ? x.replace(new RegExp('\\b' + pin.slice(0, 3) + '\\s?' + pin.slice(3) + '\\b'), '') : x).replace(/\bINDIA\b/, '').replace(/^[\s-]+|[\s-]+$/g, '').trim()).filter(Boolean);
    const si = base.lastIndexOf(state);
    if (si >= 0) base.splice(si, 1);
    const n = base.length;
    if (n >= 2 && (base[n - 1] === state || base[n - 1] === 'NEW ' + state)) {
      const city = base[n - 1];
      return { ...pack35(base.slice(0, n - 1)), city, state, pinCode: pin };
    }
    if (withDistrict && n >= 4 && !/\d/.test(base[n - 1]) && !/\d/.test(base[n - 2]) && base[n - 2].length <= 40) {
      const city = base[n - 2];
      return { ...pack35(base.slice(0, n - 2)), city, district: base[n - 1], state, pinCode: pin };
    }
  }
  const clean = parts.map(p => {
    let q = p;
    if (pin) q = q.replace(new RegExp('\\b' + pin.slice(0, 3) + '\\s?' + pin.slice(3) + '\\b'), ' ');
    q = q.replace(/\bINDIA\b/, '').replace(/^[\s-]+|[\s-]+$/g, '').trim();
    return q === state ? '' : q; // only a part that is just the state name is dropped ("NORTH WEST DELHI" stays)
  }).filter(Boolean);
  let city = '';
  if (state === 'DELHI' || state === 'CHANDIGARH') { const u = parts.map(p => p.replace(/[-\d\s]+$/, '').trim()).find(p => p === state || p === 'NEW ' + state); if (u) city = u; }
  if (!city) for (let i = clean.length - 1; i >= 0; i--) { const p = clean[i].replace(/[-\d\s]+$/, '').trim(); if (p && p.length <= 40 && !/\d/.test(p)) { city = p; break; } }
  if (!city && state === 'DELHI') city = /NEW\s+DELHI/.test(full) ? 'NEW DELHI' : 'DELHI';
  // only the last part that is the city is taken out ("..., PITHAMPUR, DISTT. DHAR, PITHAMPUR, MP" keeps the first PITHAMPUR)
  let ci = -1; for (let i = clean.length - 1; i >= 0; i -= 1) { if (clean[i].replace(/[-\d\s]+$/, '').trim() === city) { ci = i; break; } }
  const street = clean.filter((p, i) => i !== ci);
  return { ...pack35(street), city, state, pinCode: pin };
}

function parseResult(html) {
  const doc = parseDocument(String(html || ''));
  const hidden = {};
  for (const i of DomUtils.findAll(e => e.name === 'input', doc.children)) { const id = i.attribs.id || i.attribs.name; if (id) hidden[id] = i.attribs.value || ''; }
  const tables = DomUtils.findAll(e => e.name === 'table', doc.children);
  const details = {}; const branches = []; const people = [];
  for (const t of tables) {
    const rows = tableRows(t).filter(r => r.some(Boolean)); if (!rows.length) continue;
    // header like "Branch Code | GSTIN | Branch Address" or "Branch Sr. No. | GSTIN | Address" (13-Nov-2026: the live page uses Sr. No.)
    const headIdx = rows.findIndex(r => r.length >= 2 && r.length <= 8 && r.some(c => /address/i.test(c)) && (r.some(c => /branch/i.test(c)) || r.some(c => /^gst/i.test(c))) && !r.some(c => /^name$|father|designation/i.test(c)));
    const peopleIdx = rows.findIndex(r => r.some(c => /^name$/i.test(c) || /father|designation|director/i.test(c)));
    if (headIdx >= 0) {
      const h = rows[headIdx].map(c => c.toLowerCase());
      const ci = (re) => h.findIndex(x => re.test(x));
      let iCode = ci(/branch\s*(code|sr|s\.?\s*no|no)/); if (iCode < 0) iCode = ci(/^(sr|s)\.?\s*no|code/); const iGst = ci(/gst/), iAddr = ci(/address/);
      for (const r of rows.slice(headIdx + 1)) {
        if (r.length < 2 || !r[iAddr >= 0 ? iAddr : r.length - 1]) continue;
        const addr = r[iAddr >= 0 ? iAddr : r.length - 1];
        const g = (iGst >= 0 ? r[iGst] : '').replace(/\s/g, '').toUpperCase();
        const full = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(g) ? g : '';
        branches.push({ branchCode: iCode >= 0 ? r[iCode] : '', gstin: full, gstinMasked: full ? '' : g, address: addr, ...splitAddress(addr, false) }); // branch addresses have no district part
      }
      continue;
    }
    if (peopleIdx >= 0) {
      const h = rows[peopleIdx];
      for (const r of rows.slice(peopleIdx + 1)) if (r.some(Boolean)) { const o = {}; h.forEach((k, i) => { if (k) o[k] = r[i] || ''; }); people.push(o); }
      continue;
    }
    for (const r of rows) for (let i = 0; i + 1 < r.length; i += 1) { const k = LABEL_KEYS.get(key(r[i])); if (k && !details[k] && r[i + 1] && !LABEL_KEYS.has(key(r[i + 1]))) details[k] = r[i + 1]; }
  }
  // labels written outside tables (div / label layout)
  const tk = tokens(doc, []).join('\u0002').split('\u0001').map(x => x.split('\u0002').map(norm).filter(Boolean).join(' ')).filter(Boolean);
  for (let i = 0; i < tk.length; i += 1) {
    let k = LABEL_KEYS.get(key(tk[i])); let v = '';
    if (k) { v = tk[i + 1] && !LABEL_KEYS.has(key(tk[i + 1])) ? tk[i + 1] : ''; }
    else { const m = tk[i].match(/^([^:]{3,40}):\s*(.+)$/); if (m && LABEL_KEYS.has(key(m[1]))) { k = LABEL_KEYS.get(key(m[1])); v = m[2]; } }
    if (k && v && !details[k]) details[k] = v;
  }
  const text = norm(DomUtils.textContent(doc));
  return { hidden, details, branches, people, text, firmAddress: details.Address ? splitAddress(details.Address) : null };
}

router.post('/iec/fetch', async (req, res) => {
  sweep();
  const { sessionId, iec, name, captcha } = req.body || {};
  const s = sessions.get(String(sessionId || ''));
  if (!s) return fail(res, new Error('DGFT session expired. Open the window again.'), 410);
  const iecNo = String(iec || '').trim().toUpperCase();
  const firm = String(name || '').trim();
  const cap = String(captcha || '').trim();
  if (!/^[A-Z0-9]{10}$/.test(iecNo)) return fail(res, new Error('IEC must be 10 characters.'), 400);
  if (firm.length < 3) return fail(res, new Error('Enter at least the first 3 letters of the firm name.'), 400);
  if (!cap) return fail(res, new Error('Type the captcha shown in the picture.'), 400);
  s.at = Date.now();
  const csrf = s.csrf ? '&_csrf=' + encodeURIComponent(s.csrf) : '';
  try {
    const chk = await dgft(s, 'post', BASE + 'webHP?requestType=ApplicationRH&actionVal=checkCaptcha&queryType=Select&screenId=114&captcha_val=' + encodeURIComponent(cap) + csrf, { data: '' });
    if (/correct\s+captcha/i.test(String(chk.data))) {
      let pic = ''; try { pic = await captchaPicture(s); } catch (_) { /* new picture is optional */ }
      return res.json({ success: false, wrongCaptcha: true, error: 'Wrong captcha. Type the new captcha.', captcha: pic });
    }
    const body = new URLSearchParams({ panNumber: iecNo, entityName: firm, captcha_val: cap }).toString();
    const r = await dgft(s, 'post', BASE + 'webHP?requestType=ApplicationRH&actionVal=viewAnonymousIEC&screenId=50001&appId=2' + csrf, { data: body });
    const html = String(r.data || '');
    try { const dir = path.join(__dirname, '..', 'logs'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'dgft_iec_last.html'), html); } catch (_) { /* debug copy only */ }
    const p = parseResult(html);
    const flag = String(p.hidden.crmCustResultSet || '').trim();
    const nextPic = async () => { try { return await captchaPicture(s); } catch (_) { return ''; } };
    if (flag === '1' || (/correct\s+captcha/i.test(p.text) && !Object.keys(p.details).length)) return res.json({ success: false, wrongCaptcha: true, error: 'Wrong captcha. Type the new captcha.', captcha: await nextPic() });
    if (flag === '2') return res.json({ success: false, error: 'DGFT has no details for this IEC and firm name. Type only the first word of the firm name as DGFT has it (no dots or M/S), check the IEC, then try again with the new captcha.', captcha: await nextPic() });
    if (flag === '3') return res.json({ success: false, error: 'DGFT site returned an error. Try again in a minute.', captcha: await nextPic() });
    if (!Object.keys(p.details).length && !p.branches.length) {
      return res.json({ success: false, error: 'DGFT answer could not be read. A copy was kept in node-backend/logs/dgft_iec_last.html.', sample: p.text.slice(0, 300), captcha: await nextPic() });
    }
    sessions.delete(String(sessionId));
    // 13-Nov-2026: Sr No 0 = the registered (IEC) address. DGFT lists only the branches, so when no branch has code 0 / no code
    // and no branch has the same address, the IEC address is offered as Sr No 0 (GSTIN left blank, never guessed).
    const branches = [...p.branches];
    const key = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25);
    const hasZero = branches.some(b => { const c = String(b.branchCode || '').trim(); return c === '' || /^0+$/.test(c); });
    const sameAddr = branches.some(b => key(b.address) === key(p.details.Address));
    if (!hasZero && !sameAddr && p.details.Address && p.firmAddress && p.firmAddress.address1) {
      const { district, ...fa } = p.firmAddress; // eslint-disable-line no-unused-vars
      branches.unshift({ branchCode: '0', registered: true, gstin: '', gstinMasked: '', address: p.details.Address, ...fa });
    }
    res.json({ success: true, iec: iecNo, details: p.details, firmAddress: p.firmAddress, branches, people: p.people });
  } catch (e) { fail(res, new Error('DGFT request failed: ' + (e.message || e))); }
});

router._parseResult = parseResult; // used by the offline test
router._splitAddress = splitAddress;
router._pack35 = pack35;
module.exports = router;
