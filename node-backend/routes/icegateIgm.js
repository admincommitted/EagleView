// routes/icegateIgm.js  (14-Nov-2026)
// Import job > IGM Details > "Fetch from ICEGATE" (air below; sea further down): reads ICEGATE's public enquiries (no login, no captcha),
// the same calls the ICEGATE 2.0 site makes on its public Air IGM / Air Console enquiry pages.
//   POST /api/icegate-enquiry/air-igm  { location: 'INDEL4', mawb: '09830724665', hawb: 'ABC123' (optional) }
//     1. enquiryatices/AirIgmEnq                    { location, mawbNumber }      -> IGM lines of the MAWB
//     2. publicEnquiries/airIgmFlightDetailsPublic  { igmNo, igmDate, location }  -> flight / inward date (max 3 IGMs)
//     3. publicEnquiries/public-air-consol-master   { locationCode, masterBlNumber } -> console files
//     4. publicEnquiries/public-air-consol-house    { locationCode, masterBlNumber, fileName } -> houses (max 3 files)
// One set of calls per button click; nothing is sent to ICEGATE, only read. The raw answers are kept in logs/icegate_igm_last.json.
const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { httpsAgent } = require('../utils/tls');

const BASE = (process.env.ICEGATE_ENQ_URL || 'https://foservices.icegate.gov.in/enquiry/').replace(/\/?$/, '/'); // env only for an offline test
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

async function call(pathPart, body) {
  const r = await axios.post(BASE + pathPart, body, {
    httpsAgent, timeout: 30000, validateStatus: () => true,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/plain, */*', 'User-Agent': UA,
      Origin: 'https://foservices.icegate.gov.in', Referer: 'https://foservices.icegate.gov.in/' },
  });
  if (r.status >= 400) { const t = errText(r.data); const e = new Error(t ? 'ICEGATE says: ' + t : 'ICEGATE answered HTTP ' + r.status); e.body = r.data; throw e; }
  return r.data;
}
// 14-Nov-2026: ICEGATE's own message ("No record found" ...) from an error answer, so the user sees why
function errText(d) {
  if (d === undefined || d === null) return '';
  if (typeof d === 'string') { const t = d.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > 200 ? t.slice(0, 200) + '...' : t; }
  if (typeof d !== 'object' || Array.isArray(d)) return '';
  for (const k of ['errors', 'errorMessage', 'message', 'error', 'errorDesc', 'msg', 'text', 'status']) {
    const v = d[k];
    if (typeof v === 'string' && v.trim() && !/^(ok|success|200)$/i.test(v.trim())) return v.trim().slice(0, 200);
    if (Array.isArray(v) && v.length) return v.map(x => (typeof x === 'string' ? x : (x && (x.message || x.errorMessage || x.error)) || '')).filter(Boolean).join('; ').slice(0, 200);
  }
  return '';
}
// an answer that is not a list but carries a message (HTTP 200 with an error inside) is reported, not read as "nothing found"
const noteEmpty = (d, label, errors) => { if (!list(d).length) { const t = errText(d); if (t) errors.push(label + ': ICEGATE says: ' + t); } };
const list = (d) => {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  for (const k of ['response', 'data', 'result', 'results', 'list', 'content']) { if (Array.isArray(d[k])) return d[k]; if (d[k] && typeof d[k] === 'object') { const x = list(d[k]); if (x.length) return x; } }
  return [];
};
const pick = (o, ...ks) => { for (const k of ks) { if (o && o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '') return o[k]; } return ''; };
const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
// ICEGATE dates come as epoch ms, ISO, dd-mm-yyyy, dd/mm/yyyy or dd-MMM-yyyy -> yyyy-mm-dd ('' when unknown)
function isoDate(v) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'number' || /^\d{12,13}$/.test(String(v))) { const d = new Date(Number(v)); return isNaN(d) ? '' : new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10); }
  const t = String(v).trim();
  // 14-Nov-2026: a time with Z / +0000 is UTC - India date is 5:30 later ("2026-11-09T18:30:00Z" is 10-Nov in India)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i.test(t)) { const d = new Date(t.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')); if (!isNaN(d)) return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10); }
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(t); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]*(\d{2,4})/.exec(t); if (m && MON[m[2].toUpperCase()]) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${String(MON[m[2].toUpperCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
}
const up = (v) => String(v == null ? '' : v).trim().toUpperCase();
const clean = (v) => up(v).replace(/[^A-Z0-9]/g, '');

router.post('/air-igm', async (req, res) => {
  const location = clean((req.body || {}).location);
  const mawb = clean((req.body || {}).mawb);
  const hawb = clean((req.body || {}).hawb);
  if (!/^[A-Z0-9]{6}$/.test(location)) return res.status(400).json({ success: false, error: 'Port / location code must be 6 characters, like INDEL4.' });
  if (!mawb || mawb.length > 20) return res.status(400).json({ success: false, error: 'Enter the MAWB number (letters / digits, up to 20).' });
  const raw = { at: new Date().toISOString(), location, mawb, hawb, calls: [] };
  const errors = [];
  const note = (name, body, data, err) => raw.calls.push({ name, body, data: data === undefined ? null : data, error: err ? (err.message || String(err)) : undefined, errorBody: err && err.body });

  // 1. IGM lines of the MAWB
  let igmRows = [];
  try { const d = await call('enquiryatices/AirIgmEnq', { location, mawbNumber: mawb }); note('AirIgmEnq', { location, mawbNumber: mawb }, d); igmRows = list(d); noteEmpty(d, 'IGM enquiry', errors); }
  catch (e) { note('AirIgmEnq', { location, mawbNumber: mawb }, undefined, e); errors.push('IGM enquiry: ' + e.message); }

  // 2. flight / inward date for each IGM (at most 3)
  const flights = {};
  const igms = [];
  for (const r of igmRows) { const no = up(pick(r, 'igmRotation', 'igmNo', 'igmNumber', 'igmRtn')); const dt = pick(r, 'igmDate'); const loc = up(pick(r, 'customer_Site', 'custSite', 'locationCode', 'location')) || location; if (no && !igms.find(x => x.no === no)) igms.push({ no, dt, loc }); }
  for (const g of igms.slice(0, 3)) {
    const body = { igmNo: g.no, igmDate: g.dt, location: g.loc, isLoggedIn: false };
    try { const d = await call('publicEnquiries/airIgmFlightDetailsPublic', body); note('airIgmFlightDetailsPublic', body, d); flights[g.no] = list(d)[0] || (d && !Array.isArray(d) ? d : null); }
    catch (e) { note('airIgmFlightDetailsPublic', body, undefined, e); errors.push('Flight details of IGM ' + g.no + ': ' + e.message); }
  }

  // 3 + 4. console (houses of the MAWB)
  let consolRows = [], houses = [];
  try { const b = { locationCode: location, masterBlNumber: mawb }; const d = await call('publicEnquiries/public-air-consol-master', b); note('public-air-consol-master', b, d); consolRows = list(d); noteEmpty(d, 'Console enquiry', errors); }
  catch (e) { note('public-air-consol-master', { locationCode: location, masterBlNumber: mawb }, undefined, e); errors.push('Console enquiry: ' + e.message); }
  const files = [...new Set(consolRows.map(r => pick(r, 'fileName')).filter(Boolean))].slice(0, 3);
  for (const f of files) {
    const b = { locationCode: location, masterBlNumber: mawb, fileName: f, internalFlag: true };
    try { const d = await call('publicEnquiries/public-air-consol-house', b); note('public-air-consol-house', b, d); houses = houses.concat(list(d).map(h => ({ ...h, _file: f }))); }
    catch (e) { note('public-air-consol-house', b, undefined, e); errors.push('Houses of file ' + f + ': ' + e.message); }
  }

  try { const dir = path.join(__dirname, '..', 'logs'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'icegate_igm_last.json'), JSON.stringify(raw, null, 1)); } catch (_) { /* debug copy only */ }

  // rows the screen can pick from
  const flightOf = (no) => flights[no] || {};
  const lineOf = (no) => { const r = igmRows.find(x => up(pick(x, 'igmRotation', 'igmNo', 'igmNumber')) === no); return r ? String(pick(r, 'lineNo', 'lineNumber')) : ''; };
  const masters = igmRows.map(r => {
    const no = up(pick(r, 'igmRotation', 'igmNo', 'igmNumber', 'igmRtn')); const f = flightOf(no);
    return { kind: 'MAWB', igmNo: no, igmDate: isoDate(pick(r, 'igmDate')), lineNo: String(pick(r, 'lineNo', 'lineNumber')), subLineNo: '', mawbNo: up(pick(r, 'mawbNo', 'mawbNumber')) || mawb, hawbNo: '',
      portOrg: up(pick(r, 'portOrg', 'portOfOrigin')), portDest: up(pick(r, 'portDest')), totalPkg: String(pick(r, 'totalPackage', 'totalPackages', 'noOfPackages')), grossWt: String(pick(r, 'grossWeight', 'grossWt')),
      flightNo: up(pick(f, 'flightNo', 'flightNumber')), flightDate: isoDate(pick(f, 'flightDate')), inwardDate: isoDate(pick(f, 'inwardDate', 'inwardDateTime')), segregation: String(pick(r, 'segregationTime')) };
  });
  const houseRows = houses.map(h => {
    const no = up(pick(h, 'igmRtn', 'igmRotation', 'igmNo')); const f = flightOf(no);
    return { kind: 'HAWB', igmNo: no, igmDate: isoDate(pick(h, 'igmDate')), lineNo: lineOf(no), subLineNo: String(pick(h, 'subLineNumber', 'subLineNo')), mawbNo: up(pick(h, 'mawbNumber', 'mawbNo')) || mawb, hawbNo: up(pick(h, 'hawbNumber', 'hawbNo')),
      portOrg: '', portDest: '', totalPkg: String(pick(h, 'totalPackage', 'totalPackages')), grossWt: String(pick(h, 'grossWeight', 'grossWt')), status: String(pick(h, 'status')), remarks: String(pick(h, 'remarks')),
      flightNo: up(pick(h, 'flightNumber', 'flightNo')) || up(pick(f, 'flightNo', 'flightNumber')), flightDate: isoDate(pick(h, 'flightDate')) || isoDate(pick(f, 'flightDate')), inwardDate: isoDate(pick(f, 'inwardDate', 'inwardDateTime')) };
  });
  const matched = hawb ? houseRows.filter(h => clean(h.hawbNo) === hawb) : [];
  const rows = [...(hawb ? matched : []), ...masters, ...houseRows.filter(h => !matched.includes(h))];
  if (!rows.length) return res.json({ success: false, error: errors.length ? 'ICEGATE could not be read: ' + errors.join('; ') : `ICEGATE has no IGM for MAWB ${mawb} at ${location} yet.`, errors });
  res.json({ success: true, location, mawb, hawb, hawbFound: hawb ? matched.length > 0 : null, rows, errors });
});

// ---------------- Sea (14-Nov-2026) ----------------
// ICEGATE has two public sea IGM enquiries; both are read and merged:
//  old : enquiryatices/SeaIgmEnq {location, masterBlNo} -> BL / HBL lines (igmNo, igmDate, lineNo, subLineNo, packageCode ...)
//        publicEnquiries/SeaIgmMorePublicDetails {masterBlNo, location, igmNo, igmDate} -> more (inward date)
//  SAM : publicEnquiries/getSamIgmBLDate {siteId, blNo, repEvent:'SAM'} -> { blDate: [...] }
//        publicEnquiries/SeaIgmEnq-public {siteId, repEvent, blNo, blDate:'DD-MMM-YY'} -> rotations (rotationNumber, rotationDate, inwDate, uniqueId, lineNo)
//        publicEnquiries/SeaIgmMorePublicDetailsNew {uniqueId, lineNo} -> lines (lineNo, slineNo, mblNo, mblDt, hblNo, hblDt, grossWt, uqc, totPckt, pcktType)
const MONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const ddMmmYy = (v) => { const iso = isoDate(v); if (!iso) return String(v || '').toUpperCase(); const [y, mo, d] = iso.split('-'); return `${d}-${MONS[+mo - 1]}-${y.slice(2)}`; };

router.post('/sea-igm', async (req, res) => {
  const location = clean((req.body || {}).location);
  const bl = clean((req.body || {}).bl);
  const hbl = clean((req.body || {}).hbl);
  if (!/^[A-Z0-9]{6}$/.test(location)) return res.status(400).json({ success: false, error: 'Port / location code must be 6 characters, like INNSA1.' });
  if (!bl || bl.length > 20) return res.status(400).json({ success: false, error: 'Enter the BL number (letters / digits, up to 20).' });
  const raw = { at: new Date().toISOString(), mode: 'SEA', location, bl, hbl, calls: [] };
  const errors = [];
  const note = (name, body, data, err) => raw.calls.push({ name, body, data: data === undefined ? null : data, error: err ? (err.message || String(err)) : undefined, errorBody: err && err.body });
  const rows = [];
  const lineRow = (o) => ({ kind: o.hblNo ? 'HBL' : 'BL', igmNo: '', igmDate: '', inwardDate: '', lineNo: '', subLineNo: '', blNo: bl, blDate: '', hblNo: '', hblDate: '', totalPkg: '', pkgCode: '', grossWt: '', wtUnit: '', vessel: '', source: '', ...o });

  // old enquiry
  let old = [];
  try { const b = { location, masterBlNo: bl }; const d = await call('enquiryatices/SeaIgmEnq', b); note('SeaIgmEnq', b, d); old = list(d); noteEmpty(d, 'Sea IGM enquiry', errors); }
  catch (e) { note('SeaIgmEnq', { location, masterBlNo: bl }, undefined, e); errors.push('Sea IGM enquiry: ' + e.message); }
  const moreOld = {};
  const igmsOld = [];
  for (const r of old) { const no = up(pick(r, 'igmNo', 'igmNumber', 'rotationNumber')); const dt = pick(r, 'igmDate'); if (no && !igmsOld.find(x => x.no === no)) igmsOld.push({ no, dt }); }
  for (const g of igmsOld.slice(0, 3)) {
    const b = { masterBlNo: bl, location, igmNo: g.no, igmDate: g.dt };
    try { const d = await call('publicEnquiries/SeaIgmMorePublicDetails', b); note('SeaIgmMorePublicDetails', b, d); moreOld[g.no] = list(d)[0] || (d && !Array.isArray(d) ? d : {}); }
    catch (e) { note('SeaIgmMorePublicDetails', b, undefined, e); errors.push('More details of IGM ' + g.no + ': ' + e.message); }
  }
  for (const r of old) {
    const no = up(pick(r, 'igmNo', 'igmNumber', 'rotationNumber')); const mo = moreOld[no] || {};
    rows.push(lineRow({ source: 'IGM', igmNo: no, igmDate: isoDate(pick(r, 'igmDate')), inwardDate: isoDate(pick(r, 'inwardDate', 'inwDate', 'inwardDt') || pick(mo, 'inwardDate', 'inwDate', 'inwardDt', 'inwardDateTime')),
      lineNo: String(pick(r, 'lineNo', 'lineNumber')), subLineNo: String(pick(r, 'subLineNo', 'slineNo', 'subLineNumber')), blNo: up(pick(r, 'blNo', 'mblNo')) || bl, blDate: isoDate(pick(r, 'blDate', 'mblDt')),
      hblNo: up(pick(r, 'houseBlNo', 'hblNo')), hblDate: isoDate(pick(r, 'houseBlDate', 'hblDt')), totalPkg: String(pick(r, 'totalPackage', 'totPckt')), pkgCode: up(pick(r, 'packageCode', 'pcktType')),
      grossWt: String(pick(r, 'grossWeight', 'grossWt')), wtUnit: up(pick(r, 'unitOfWeight', 'uqc')), vessel: up(pick(mo, 'vesselName', 'vesselCode')) }));
  }

  // SAM enquiry
  let blDates = [];
  try { const b = { siteId: location, blNo: bl, repEvent: 'SAM' }; const d = await call('publicEnquiries/getSamIgmBLDate', b); note('getSamIgmBLDate', b, d); blDates = (d && Array.isArray(d.blDate) ? d.blDate : list(d)).map(String); if (!blDates.length) { const t = errText(d); if (t) errors.push('SAM BL dates: ICEGATE says: ' + t); } }
  catch (e) { note('getSamIgmBLDate', { siteId: location, blNo: bl, repEvent: 'SAM' }, undefined, e); errors.push('SAM BL dates: ' + e.message); }
  for (const bd of blDates.slice(0, 3)) {
    let rots = [];
    const b = { siteId: location, repEvent: 'SAM', blNo: bl, blDate: ddMmmYy(bd) };
    try { const d = await call('publicEnquiries/SeaIgmEnq-public', b); note('SeaIgmEnq-public', b, d); rots = list(d); noteEmpty(d, 'SAM IGM of BL date ' + bd, errors); }
    catch (e) { note('SeaIgmEnq-public', b, undefined, e); errors.push('SAM IGM of BL date ' + bd + ': ' + e.message); }
    for (const rt of rots.slice(0, 5)) {
      const uid = pick(rt, 'uniqueId'); const ln = pick(rt, 'lineNo');
      let lines = [];
      if (uid !== '') {
        const b2 = { uniqueId: uid, lineNo: ln };
        try { const d = await call('publicEnquiries/SeaIgmMorePublicDetailsNew', b2); note('SeaIgmMorePublicDetailsNew', b2, d); lines = list(d); }
        catch (e) { note('SeaIgmMorePublicDetailsNew', b2, undefined, e); errors.push('SAM lines: ' + e.message); }
      }
      const base = { source: 'SAM', igmNo: up(pick(rt, 'rotationNumber', 'igmNo')), igmDate: isoDate(pick(rt, 'rotationDate', 'igmDate')), inwardDate: isoDate(pick(rt, 'inwDate', 'inwardDate')),
        vessel: [up(pick(rt, 'vesselCode', 'vesselName')), up(pick(rt, 'voyageNumber'))].filter(Boolean).join(' / '), blDate: isoDate(bd) };
      if (!lines.length) rows.push(lineRow({ ...base, lineNo: String(ln) }));
      for (const l of lines) rows.push(lineRow({ ...base, lineNo: String(pick(l, 'lineNo') || ln), subLineNo: String(pick(l, 'slineNo', 'subLineNo')), blNo: up(pick(l, 'mblNo', 'blNo')) || bl, blDate: isoDate(pick(l, 'mblDt', 'blDate')) || base.blDate,
        hblNo: up(pick(l, 'hblNo', 'houseBlNo')), hblDate: isoDate(pick(l, 'hblDt', 'houseBlDate')), totalPkg: String(pick(l, 'totPckt', 'totalPackage')), pkgCode: up(pick(l, 'pcktType', 'packageCode')),
        grossWt: String(pick(l, 'grossWt', 'grossWeight')), wtUnit: up(pick(l, 'uqc', 'unitOfWeight')) }));
    }
  }

  try { const dir = path.join(__dirname, '..', 'logs'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'icegate_igm_last.json'), JSON.stringify(raw, null, 1)); } catch (_) { /* debug copy only */ }
  const matched = hbl ? rows.filter(r => clean(r.hblNo) === hbl) : [];
  const ordered = [...matched, ...rows.filter(r => !matched.includes(r))];
  if (!ordered.length) return res.json({ success: false, error: errors.length ? 'ICEGATE could not be read: ' + errors.join('; ') : `ICEGATE has no IGM for BL ${bl} at ${location} yet.`, errors });
  res.json({ success: true, location, bl, hbl, hblFound: hbl ? matched.length > 0 : null, rows: ordered, errors });
});

router._isoDate = isoDate; // used by the offline test
module.exports = router;
