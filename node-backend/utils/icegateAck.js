// ICEGATE acknowledgement of a filed BE (JSON filing), 29-Oct-2026.
// fileSubmit's "SUCCESS" only means ICEGATE took the file. The real answer of ICES - BE number and date, or the error
// list - comes from POST <baseUrl>/jsonfiling/v1.0/api/outbound/getAck { senderId, uniqueId } (API contract v1.4 §5).
// The reply is either JSON, or multipart: a `meta` JSON part (status text) + a file part CHCAI02_ACK_<date>.json.
// Status texts (contract): "File validation in progress", "Pending for system validation", "Acknowledgment generation
// in progress" = ask again later; "Digital Signature (DSC) validation failed", "File rejected during System validation"
// = rejected; "Acknowledgment has been generated with response code" = read the ack file. The ack file's exact layout
// is not published, so the BE no / date / errors are picked by key names and the full text is kept on the job.
const axios = require('axios');
const ImportJob = require('../models/ImportJob');
const ExportJob = require('../models/ExportJob');
const { httpsAgent } = require('./tls');

// ---- multipart reply -> { meta: object|null, parts: [{ name, filename, text }] }
function parseMultipart(buf, contentType) {
    const m = /boundary="?([^";]+)"?/i.exec(contentType || '');
    if (!m) return null;
    const boundary = '--' + m[1];
    const text = buf.toString('utf8');
    const parts = [];
    for (const raw of text.split(boundary)) {
        const chunk = raw.replace(/^\r\n/, '');
        if (!chunk || chunk.startsWith('--')) continue;
        const sep = chunk.indexOf('\r\n\r\n'); if (sep < 0) continue;
        const head = chunk.slice(0, sep); const body = chunk.slice(sep + 4).replace(/\r\n$/, '');
        const name = (/name="([^"]*)"/i.exec(head) || [])[1] || '';
        const filename = (/filename="([^"]*)"/i.exec(head) || [])[1] || '';
        parts.push({ name, filename, text: body });
    }
    let meta = null;
    const mp = parts.find(p => /^meta$/i.test(p.name)) || parts.find(p => !p.filename);
    if (mp) { try { meta = JSON.parse(mp.text); } catch (e) { meta = { status: mp.text.trim() }; } }
    return { meta, parts };
}

async function fetchAck(cfg, token, uniqueId, senderId) {
    const url = `${cfg.baseUrl}/jsonfiling/v1.0/api/outbound/getAck`;
    const res = await axios.post(url, { uniqueId, senderId: senderId || cfg.loginId },
        { headers: { 'Content-Type': 'application/json', token }, httpsAgent, timeout: 30000, validateStatus: null, responseType: 'arraybuffer' });
    const ctype = String(res.headers['content-type'] || '');
    const buf = Buffer.from(res.data || []);
    let meta = null, ack = null, ackText = '';
    if (/multipart/i.test(ctype)) {
        const mp = parseMultipart(buf, ctype) || { meta: null, parts: [] };
        meta = mp.meta;
        const fp = mp.parts.find(p => p.filename) || null;
        if (fp) { ackText = fp.text; try { ack = JSON.parse(fp.text); } catch (e) { ack = null; } }
    } else {
        ackText = buf.toString('utf8');
        try { const j = JSON.parse(ackText); if (j && (j.ack || j.acknowledgement || j.data)) { meta = j; ack = j.ack || j.acknowledgement || j.data; } else { meta = j; ack = j; } } catch (e) { meta = { status: ackText.slice(0, 300) }; }
    }
    return { httpStatus: res.status, meta, ack, ackText: ackText.slice(0, 200000) };
}

// 18-Nov-2026: ICES answers errors as a bare code on the item ({ ErrorCode: "317", invoiceSerialNumber, itemSerialNumber }).
// Meanings of the codes seen so far (ICES BE fresh-filing error list); an unknown code is shown as the code alone.
const ICES_ERR = {
    '309': 'Unit price cannot be null, negative or zero', '310': 'Unit price cannot be null, negative or zero', '311': 'UQC wrong (use the UQC of the CTH)',
    '315': 'Invalid RITC or RITC cannot be null', '316': 'Invalid CTH or CTH cannot be null',
    '317': 'Invalid CETH or CETH cannot be null (NOEXCISE except chapters 22 / 24 / 27; a Chapter 98 heading is not a CETH)',
};
// ICES dates come as DDMMYYYY ("18112026"); the file dates as YYYYMMDD
const isYmd8 = (s) => /^\d{8}$/.test(s) && +s.slice(0, 4) >= 1900 && +s.slice(0, 4) <= 2100 && +s.slice(4, 6) >= 1 && +s.slice(4, 6) <= 12 && +s.slice(6, 8) >= 1 && +s.slice(6, 8) <= 31;
const dmyText = (s) => { const t = String(s || '').trim(); if (/^\d{8}$/.test(t)) return isYmd8(t) ? `${t.slice(6, 8)}/${t.slice(4, 6)}/${t.slice(0, 4)}` : `${t.slice(0, 2)}/${t.slice(2, 4)}/${t.slice(4, 8)}`; return t; };

// walk any JSON and pull out what a CHA needs
function interpretAck(meta, ack, httpStatus) {
    const out = { state: 'unknown', beNo: '', beDate: '', sbNo: '', sbDate: '', errors: [], message: '' };
    // 17-Nov-2026: production getAck answers plain JSON { responseDesc: "DSC Verification Failed", uniqueId, senderId } -
    // responseDesc was not read, so a rejection showed as "No answer yet"
    const metaStatus = String((meta && (meta.status || meta.message || meta.ackStatus || meta.fileStatus || meta.responseDesc || meta.responseMessage || meta.statusDesc || meta.errorMessage)) || '').trim();
    out.message = metaStatus;
    if (httpStatus && httpStatus >= 400 && !ack) { out.state = 'error'; out.message = out.message || `ICEGATE answered HTTP ${httpStatus}`; return out; }
    // asked with another ICEGATE ID / bad token: ICEGATE did not answer about the file at all - not a rejection
    if (/authori[sz]ation failed|not allowed for provided sender|unauthori[sz]ed|invalid token|token (has )?expired/i.test(metaStatus)) { out.state = 'error'; return out; }
    if (/in progress|pending/i.test(metaStatus)) out.state = 'pending';
    else if (/rejected|failed|invalid/i.test(metaStatus)) out.state = 'rejected';
    const seen = new Set();
    const walk = (v, path) => {
        if (!v || typeof v !== 'object' || seen.has(v)) return; seen.add(v);
        if (Array.isArray(v)) { v.forEach((x, i) => walk(x, path + '[' + i + ']')); return; }
        // an error row { errorCode, errorDesc } (any spelling) counts once
        const ek = Object.keys(v); const codeK = ek.find(k => /^(error|err)[_ ]?code$|^code$/i.test(k)); const descK = ek.find(k => /^(error|err)[_ ]?(desc|description|message|msg|text)$/i.test(k));
        if (codeK || descK) {
            const code = String(v[codeK] ?? '').trim(); let text = String(v[descK] ?? '').trim();
            const ok = /^(0+|000|success|submitted)$/i.test(code) || /^submitted$/i.test(text);
            if (!ok && (code || text)) {
                if (!text && ICES_ERR[code]) text = ICES_ERR[code];
                if (!text && code) text = 'ICES error code ' + code;
                // where: invoice / item serial of the error row
                const inv = String(v.invoiceSerialNumber ?? v.invSrNo ?? '').trim(), itm = String(v.itemSerialNumber ?? v.itemSrNo ?? '').trim();
                const at = [inv && inv !== '0' ? 'Invoice ' + inv : '', itm && itm !== '0' ? 'Item ' + itm : ''].filter(Boolean).join(' ');
                out.errors.push({ code, text: at ? text + ' (' + at + ')' : text });
            }
        }
        for (const [k, val] of Object.entries(v)) {
            const key = k.toLowerCase();
            if (k === codeK || k === descK) continue;
            if (val != null && typeof val !== 'object') {
                const s = String(val).trim();
                if (!out.beNo && /^(be|boe|billofentry)[_ ]?(number|no|num)$/.test(key) && /^\d{6,8}$/.test(s)) out.beNo = s;
                if (!out.beDate && /^(be|boe|billofentry)[_ ]?date$/.test(key) && s) out.beDate = s;
                // Shipping Bill acknowledgement (17-Nov-2026), as the job list's SB Track reads it
                const kk = key.replace(/[^a-z]/g, '');
                if (!out.sbNo && /^(sbno|sbnumber|shippingbillno|shippingbillnumber)$/.test(kk) && /^\d{5,10}$/.test(s)) out.sbNo = s;
                if (!out.sbDate && /^(sbdate|shippingbilldate)$/.test(kk) && s) out.sbDate = s;
                if (/^errors?$|^remarks?$|^errorlist$/.test(key) && s && !/^(0+|000|success)$/i.test(s)) out.errors.push({ code: '', text: s });
                if (/^(response|resp|ack)[_ ]?(code|status)$/.test(key) && s) { out.responseCode = s; }
            } else if (val && typeof val === 'object') {
                walk(val, path + '.' + k);
            }
        }
    };
    walk(ack, 'ack');
    // rows like [{ errorCode, errorDesc }] inside arrays
    const dedupe = []; const seenE = new Set();
    for (const e of out.errors) { const k = (e.code || '') + '|' + e.text; if (!seenE.has(k)) { seenE.add(k); dedupe.push(e); } }
    out.errors = dedupe;
    if (out.state === 'rejected' && !out.errors.length && metaStatus) out.errors.push({ code: '', text: metaStatus });
    if (out.beNo || out.sbNo) out.state = 'accepted';
    else if (out.errors.length && out.state !== 'pending') out.state = 'rejected';
    else if (out.state === 'unknown' && ack) out.state = /generated/i.test(metaStatus) ? 'rejected' : 'unknown';
    if (!out.message) out.message = out.state === 'accepted' ? (out.beNo ? `BE No ${out.beNo} dated ${dmyText(out.beDate)}` : `SB No ${out.sbNo} dated ${dmyText(out.sbDate)}`) : out.errors.length ? `${out.errors.length} error(s)` : 'No answer yet';
    return out;
}

// 18-Nov-2026: an ICES date "18112026" (DDMMYYYY) became 1811-20-26 - an 8-digit date is YYYYMMDD only when it reads as one
const ymdOf = (s) => { const t = String(s || '').trim(); if (/^\d{8}$/.test(t) && !isYmd8(t)) return `${t.slice(4, 8)}-${t.slice(2, 4)}-${t.slice(0, 2)}`; let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(t); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };

// blank, or not a real yyyy-mm-dd date (month 01-12, day 01-31, year 1990 on)
const badDate = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || '').trim()); return !m || +m[1] < 1990 || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31; };

// The ICEGATE ID a file went out with: getAck must be asked with that ID - asked with another one ICEGATE answers
// "Authorization failed, request not allowed for provided sender ID". 17-Nov-2026: it always asked with the default
// profile, so a BE sent as SHERSINGHDANU could never get its reply.
function senderOf(job, uid) {
    if (job.icegateUniqueId && job.icegateUniqueId === uid && job.filedJson) {
        try { const s = String(((JSON.parse(job.filedJson) || {}).headerField || {}).senderID || '').trim(); if (s) return s; } catch (e) { /* not JSON */ }
    }
    try { const prev = job.icegateAck ? JSON.parse(job.icegateAck) : null; if (prev && prev.uniqueId === uid && prev.senderId) return String(prev.senderId); } catch (e) { /* none */ }
    return '';
}

const STATE_TEXT = { accepted: 'ACCEPTED', rejected: 'REJECTED', pending: 'PENDING', error: 'COULD NOT ASK', unknown: 'ANSWER RECEIVED' };

// check one job: fetch, store, update status / BE no. `helpers` = { getIcegateConfig, getAuthToken } from routes/icegate.js
// opts.uniqueId: a Unique ID typed on the reply window for a job that has none (sent before 17-Nov-2026, when an accepted
// file was shown as failed) - kept on the job only when ICEGATE knows it. opts.profileId: ask as this ICEGATE ID.
async function checkJobAck(job, helpers, { profileId, uniqueId, author } = {}) {
    const typed = String(uniqueId || '').trim();
    const uid = typed || String(job.icegateUniqueId || '').trim();
    if (!uid) throw new Error('This job has no ICEGATE Unique ID - type the Unique ID from the ICEGATE mail / reply');
    if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) throw new Error('"' + uid + '" is not an ICEGATE Unique ID');
    const newId = uid !== String(job.icegateUniqueId || '');
    if (newId && job.icegateUniqueId && /accepted/i.test(String(job.icegateStatus || ''))) throw new Error(`This job already has Unique ID ${job.icegateUniqueId}, accepted by ICES - it is not replaced`);
    let cfg;
    if (profileId) cfg = await helpers.getIcegateConfig(profileId);
    else {
        const sender = senderOf(job, uid);
        let prof = null;
        if (sender) { try { prof = await require('../models/IcegateProfile').findOne({ where: { loginId: sender } }); } catch (e) { prof = null; } }
        cfg = await helpers.getIcegateConfig(prof ? prof.id : null);
    }
    const tok = await helpers.getAuthToken(cfg);
    const r = await fetchAck(cfg, tok.token, uid, cfg.loginId);
    const interp = interpretAck(r.meta, r.ack, r.httpStatus);
    let prev = null; try { prev = job.icegateAck ? JSON.parse(job.icegateAck) : null; } catch (e) { prev = null; }
    const stored = { at: new Date().toISOString(), uniqueId: uid, senderId: cfg.loginId, httpStatus: r.httpStatus, meta: r.meta, interp, ackText: r.ackText };
    // a typed Unique ID that ICEGATE does not answer for (wrong ID / wrong ICEGATE ID) is not written on the job
    if (newId && interp.state === 'error') return { ...interp, stored, uniqueId: uid, senderId: cfg.loginId, saved: false };
    const upd = { icegateAck: JSON.stringify(stored), icegateAckAt: new Date() };
    if (newId) upd.icegateUniqueId = uid;
    if (interp.state === 'pending' && !/^(Filed|Amended|Accepted)$/.test(String(job.icegateStatus || ''))) upd.icegateStatus = 'Filed';
    if (interp.state === 'accepted') {
        upd.icegateStatus = 'Accepted';
        // BE no / date are columns since 30-Oct-2026 (older rows may still carry them in extendedData); the ack only
        // fills what is blank - a number typed by the operator is never overwritten
        let ext = {}; try { ext = job.extendedData ? JSON.parse(job.extendedData) : {}; } catch (e) { ext = {}; }
        const had = { beNo: job.beNo || ext.beNo, beDate: job.beDate || ext.beDate };
        if (!had.beNo && interp.beNo) upd.beNo = interp.beNo;
        // 18-Nov-2026: a BE date that is not a real yyyy-mm-dd (DEL-AI-1002 got "1811-20-26" from ICES' 18112026 before the
        // date fix) is put right from the answer, for the same BE No; a real date typed by the operator is still kept
        const sameBe = !had.beNo || String(had.beNo).trim() === String(interp.beNo || '').trim();
        if (sameBe && badDate(had.beDate) && interp.beDate && ymdOf(interp.beDate)) upd.beDate = ymdOf(interp.beDate);
    } else if (interp.state === 'rejected') upd.icegateStatus = 'Rejected';
    await ImportJob.update(upd, { where: { id: job.id } });
    // the job log gets a line when the answer changes (the 10-minute check does not repeat the same one)
    const pi = prev && prev.interp;
    if (!pi || prev.uniqueId !== uid || pi.state !== interp.state || pi.message !== interp.message || (pi.errors || []).length !== interp.errors.length) {
        const errs = interp.errors.filter(e => e.text !== interp.message).slice(0, 10).map(e => (e.code ? e.code + ': ' : '') + e.text);
        const beTxt = interp.beNo ? ` - BE No ${interp.beNo}${interp.beDate ? ' dt ' + dmyText(interp.beDate) : ''}` : '';
        await require('./icegateLog').logIcegate('IMPORT', job.id, 'ICEGATE_REPLY',
            `ICEGATE reply for Unique ID ${uid} (asked as ${cfg.loginId}): ${STATE_TEXT[interp.state] || interp.state} - ${interp.message || '-'}${beTxt}${errs.length ? ' | Errors: ' + errs.join('; ') : ''}`,
            author || 'ICEGATE (auto check)');
    }
    return { ...interp, stored, uniqueId: uid, senderId: cfg.loginId, saved: true };
}

// ---- Shipping Bill (export job), 17-Nov-2026: the same as checkJobAck. ExportJob has no ack / filed-file columns, so
// the last answer and the ICEGATE ID the SB went out with are kept in additionalData (icegateAck, icegateSenderId).
const extraOf = (job) => { try { return JSON.parse(job.additionalData || '{}') || {}; } catch (e) { return {}; } };
async function checkSbAck(job, helpers, { profileId, uniqueId, author } = {}) {
    const ext = extraOf(job);
    const typed = String(uniqueId || '').trim();
    const uid = typed || String(job.icegateUniqueId || '').trim();
    if (!uid) throw new Error('This job has no ICEGATE Unique ID - type the Unique ID from the ICEGATE mail / reply');
    if (!/^[A-Za-z0-9]{10,40}$/.test(uid)) throw new Error('"' + uid + '" is not an ICEGATE Unique ID');
    const newId = uid !== String(job.icegateUniqueId || '');
    if (newId && job.icegateUniqueId && /accepted/i.test(String(job.icegateStatus || ''))) throw new Error(`This job already has Unique ID ${job.icegateUniqueId}, accepted by ICES - it is not replaced`);
    const prev = ext.icegateAck && typeof ext.icegateAck === 'object' ? ext.icegateAck : null;
    let cfg;
    if (profileId) cfg = await helpers.getIcegateConfig(profileId);
    else {
        const sender = (!newId && ext.icegateSenderId) || (prev && prev.uniqueId === uid && prev.senderId) || '';
        let prof = null;
        if (sender) { try { prof = await require('../models/IcegateProfile').findOne({ where: { loginId: sender } }); } catch (e) { prof = null; } }
        cfg = await helpers.getIcegateConfig(prof ? prof.id : null);
    }
    const tok = await helpers.getAuthToken(cfg);
    const r = await fetchAck(cfg, tok.token, uid, cfg.loginId);
    const interp = interpretAck(r.meta, r.ack, r.httpStatus);
    const stored = { at: new Date().toISOString(), uniqueId: uid, senderId: cfg.loginId, httpStatus: r.httpStatus, meta: r.meta, interp, ackText: String(r.ackText || '').slice(0, 20000) };
    if (newId && interp.state === 'error') return { ...interp, stored, uniqueId: uid, senderId: cfg.loginId, saved: false };
    const fresh = await ExportJob.findByPk(job.id);           // re-read: additionalData may have changed meanwhile
    const x = extraOf(fresh || job);
    x.icegateAck = stored;
    if (newId || !x.icegateSenderId) x.icegateSenderId = cfg.loginId;
    const upd = { additionalData: JSON.stringify(x) };
    if (newId) upd.icegateUniqueId = uid;
    if (interp.state === 'pending' && !/^(Filed|Amended|Accepted)$/.test(String(job.icegateStatus || ''))) upd.icegateStatus = 'Filed';
    if (interp.state === 'accepted') {
        upd.icegateStatus = 'Accepted';
        // the SB No / date only fill what is blank (a number typed by the operator is never overwritten), as SB Track
        if (!(job.sbNo || x.sbNumber) && interp.sbNo) { upd.sbNo = interp.sbNo; if (badDate(job.sbDate) && interp.sbDate) upd.sbDate = ymdOf(interp.sbDate) || interp.sbDate; }
        else if (interp.sbNo && String(job.sbNo || x.sbNumber || '').trim() === interp.sbNo && job.sbDate && badDate(job.sbDate) && ymdOf(interp.sbDate)) upd.sbDate = ymdOf(interp.sbDate);   // 18-Nov-2026
        try { const { rank } = require('./exportStage'); if (rank(job.status) < rank('SUBMITTED')) upd.status = 'SUBMITTED'; } catch (e) { /* stage helper missing */ }
    } else if (interp.state === 'rejected') upd.icegateStatus = 'Rejected';
    await ExportJob.update(upd, { where: { id: job.id } });
    const pi = prev && prev.interp;
    if (!pi || prev.uniqueId !== uid || pi.state !== interp.state || pi.message !== interp.message || (pi.errors || []).length !== interp.errors.length) {
        const errs = interp.errors.filter(e => e.text !== interp.message).slice(0, 10).map(e => (e.code ? e.code + ': ' : '') + e.text);
        const sbTxt = interp.sbNo ? ` - SB No ${interp.sbNo}${interp.sbDate ? ' dt ' + dmyText(interp.sbDate) : ''}` : '';
        await require('./icegateLog').logIcegate('EXPORT', job.id, 'ICEGATE_REPLY',
            `ICEGATE reply for Unique ID ${uid} (asked as ${cfg.loginId}): ${STATE_TEXT[interp.state] || interp.state} - ${interp.message || '-'}${sbTxt}${errs.length ? ' | Errors: ' + errs.join('; ') : ''}`,
            author || 'ICEGATE (auto check)');
    }
    return { ...interp, stored, uniqueId: uid, senderId: cfg.loginId, saved: true };
}

// 18-Nov-2026: BE dates saved wrong from an ICES answer before the date fix ("1811-20-26" for 18112026, DEL-AI-1002) are
// put right from the answer kept on the job - same BE No only, and only when the saved date is not a real date.
// Runs with the reply check (90 s after the backend starts, then every 10 minutes); nothing to do = no write.
async function repairAckDates() {
    const { Op } = require('sequelize');
    const rows = await ImportJob.findAll({ where: { icegateAck: { [Op.ne]: null }, beDate: { [Op.ne]: null } }, attributes: ['id', 'jobNo', 'beNo', 'beDate', 'icegateAck'] });
    let fixed = 0;
    for (const j of rows) {
        if (!badDate(j.beDate)) continue;
        let a = null; try { a = JSON.parse(j.icegateAck); } catch (e) { continue; }
        const it = a && a.interp;
        if (!it || !it.beNo || String(it.beNo).trim() !== String(j.beNo || '').trim()) continue;
        const d = ymdOf(it.beDate);
        if (!d || badDate(d)) continue;
        await ImportJob.update({ beDate: d }, { where: { id: j.id } });
        fixed++;
        try { await require('./icegateLog').logIcegate('IMPORT', j.id, 'ICEGATE_REPLY', `BE date corrected to ${dmyText(it.beDate)} from the ICEGATE reply (it was saved as "${j.beDate}") - BE No ${j.beNo}`, 'ICEGATE (auto check)'); } catch (e) { /* log only */ }
        console.log(`[ICEGATE ack] job ${j.jobNo || j.id}: BE date ${j.beDate} -> ${d}`);
    }
    return fixed;
}

// every 10 minutes: jobs filed through the API in the last 3 days with no final answer yet
let timer = null;
function startAckPolling(helpers, everyMs = 10 * 60 * 1000) {
    const { Op } = require('sequelize');
    const run = async () => {
        try { await repairAckDates(); } catch (e) { console.warn('[ICEGATE ack] date repair:', e.message); }
        try {
            const since = new Date(Date.now() - 3 * 24 * 3600 * 1000);
            const jobs = await ImportJob.findAll({ where: { icegateUniqueId: { [Op.ne]: null }, icegateStatus: { [Op.in]: ['Filed', 'Amended'] }, updatedAt: { [Op.gte]: since } }, limit: 25 });
            for (const j of jobs) {
                try { const r = await checkJobAck(j, helpers); if (r.state !== 'pending') console.log(`[ICEGATE ack] job ${j.jobNo || j.id}: ${r.state} ${r.message}`); }
                catch (e) { console.warn(`[ICEGATE ack] job ${j.jobNo || j.id}:`, e.message); }
            }
            // Shipping Bills too (17-Nov-2026)
            const sbs = await ExportJob.findAll({ where: { icegateUniqueId: { [Op.ne]: null }, icegateStatus: { [Op.in]: ['Filed', 'Amended'] }, updatedAt: { [Op.gte]: since } }, limit: 25 });
            for (const j of sbs) {
                try { const r = await checkSbAck(j, helpers); if (r.state !== 'pending') console.log(`[ICEGATE ack] SB job ${j.jobNo || j.id}: ${r.state} ${r.message}`); }
                catch (e) { console.warn(`[ICEGATE ack] SB job ${j.jobNo || j.id}:`, e.message); }
            }
        } catch (e) { console.warn('[ICEGATE ack] poll:', e.message); }
    };
    setTimeout(run, 90 * 1000);
    timer = setInterval(run, everyMs);
    return timer;
}

module.exports = { fetchAck, interpretAck, parseMultipart, checkJobAck, checkSbAck, startAckPolling, repairAckDates };
