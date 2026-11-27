// ICEGATE acknowledgement of a filed BE / SB (JSON filing).
// fileSubmit's "SUCCESS" only means ICEGATE took the file. The real answer of ICES - BE number and date, or the error
// list - comes from POST <baseUrl>/jsonfiling/v1.0/api/outbound/getAck { senderId, uniqueId } (API contract v1.4 §5).
// The reply is either JSON, or multipart: a `meta` JSON part (status text) + a file part CHCAI02_ACK_<date>.json.
// Status texts (contract): "File validation in progress", "Pending for system validation", "Acknowledgment generation
// in progress" = ask again later; "Digital Signature (DSC) validation failed", "File rejected during System validation"
// = rejected; "Acknowledgment has been generated with response code" = read the ack file. The ack file's exact layout
// is not published, so the BE no / date / errors are picked by key names and the full text is kept on the job.
//
// The ICEGATE config / token helpers are passed in by the caller ({ getIcegateConfig, getAuthToken } of the ICEGATE
// filing service), so this file does not depend on the filing module.
import axios from 'axios';
import { Op } from '../../config/database.js';
import { ExportJob, IcegateProfile, ImportJob } from '../../models/index.js';
import { httpsAgent } from '../integrations/tls.js';
import { logIcegate } from './icegateLog.js';
import { rank } from './exportStage.js';

const ACK_TIMEOUT_MS = 30000;
const MAX_ACK_TEXT = 200000;
const MAX_SB_ACK_TEXT = 20000;
const MAX_LOGGED_ERRORS = 10;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const FIRST_POLL_DELAY_MS = 90 * 1000;
const POLL_LOOKBACK_MS = 3 * 24 * 3600 * 1000;
const POLL_BATCH_SIZE = 25;
const AUTO_CHECK_AUTHOR = 'ICEGATE (auto check)';
const UNIQUE_ID_PATTERN = /^[A-Za-z0-9]{10,40}$/;

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
    const separator = chunk.indexOf('\r\n\r\n');
    if (separator < 0) continue;
    const head = chunk.slice(0, separator);
    const body = chunk.slice(separator + 4).replace(/\r\n$/, '');
    const name = (/name="([^"]*)"/i.exec(head) || [])[1] || '';
    const filename = (/filename="([^"]*)"/i.exec(head) || [])[1] || '';
    parts.push({ name, filename, text: body });
  }
  let meta = null;
  const metaPart = parts.find((p) => /^meta$/i.test(p.name)) || parts.find((p) => !p.filename);
  if (metaPart) {
    try {
      meta = JSON.parse(metaPart.text);
    } catch {
      meta = { status: metaPart.text.trim() };
    }
  }
  return { meta, parts };
}

async function fetchAck(cfg, token, uniqueId, senderId) {
  const url = `${cfg.baseUrl}/jsonfiling/v1.0/api/outbound/getAck`;
  const res = await axios.post(
    url,
    { uniqueId, senderId: senderId || cfg.loginId },
    {
      headers: { 'Content-Type': 'application/json', token },
      httpsAgent,
      timeout: ACK_TIMEOUT_MS,
      validateStatus: null,
      responseType: 'arraybuffer',
    },
  );
  const contentType = String(res.headers['content-type'] || '');
  const buf = Buffer.from(res.data || []);
  let meta = null,
    ack = null,
    ackText = '';
  if (/multipart/i.test(contentType)) {
    const multipart = parseMultipart(buf, contentType) || { meta: null, parts: [] };
    meta = multipart.meta;
    const filePart = multipart.parts.find((p) => p.filename) || null;
    if (filePart) {
      ackText = filePart.text;
      try {
        ack = JSON.parse(filePart.text);
      } catch {
        ack = null;
      }
    }
  } else {
    ackText = buf.toString('utf8');
    try {
      const json = JSON.parse(ackText);
      if (json && (json.ack || json.acknowledgement || json.data)) {
        meta = json;
        ack = json.ack || json.acknowledgement || json.data;
      } else {
        meta = json;
        ack = json;
      }
    } catch {
      meta = { status: ackText.slice(0, 300) };
    }
  }
  return { httpStatus: res.status, meta, ack, ackText: ackText.slice(0, MAX_ACK_TEXT) };
}

// ICES answers errors as a bare code on the item ({ ErrorCode: "317", invoiceSerialNumber, itemSerialNumber }).
// Meanings of the codes seen so far (ICES BE fresh-filing error list); an unknown code is shown as the code alone.
const ICES_ERR = {
  309: 'Unit price cannot be null, negative or zero',
  310: 'Unit price cannot be null, negative or zero',
  311: 'UQC wrong (use the UQC of the CTH)',
  315: 'Invalid RITC or RITC cannot be null',
  316: 'Invalid CTH or CTH cannot be null',
  317: 'Invalid CETH or CETH cannot be null (NOEXCISE except chapters 22 / 24 / 27; a Chapter 98 heading is not a CETH)',
};

// ICES dates come as DDMMYYYY ("18112026"); the file dates as YYYYMMDD
const isYmd8 = (s) =>
  /^\d{8}$/.test(s) &&
  +s.slice(0, 4) >= 1900 &&
  +s.slice(0, 4) <= 2100 &&
  +s.slice(4, 6) >= 1 &&
  +s.slice(4, 6) <= 12 &&
  +s.slice(6, 8) >= 1 &&
  +s.slice(6, 8) <= 31;
const dmyText = (s) => {
  const t = String(s || '').trim();
  if (/^\d{8}$/.test(t))
    return isYmd8(t)
      ? `${t.slice(6, 8)}/${t.slice(4, 6)}/${t.slice(0, 4)}`
      : `${t.slice(0, 2)}/${t.slice(2, 4)}/${t.slice(4, 8)}`;
  return t;
};

// production getAck answers plain JSON { responseDesc: "DSC Verification Failed", uniqueId, senderId }, other replies
// use other key names for the status text
const metaStatusOf = (meta) =>
  String(
    (meta &&
      (meta.status ||
        meta.message ||
        meta.ackStatus ||
        meta.fileStatus ||
        meta.responseDesc ||
        meta.responseMessage ||
        meta.statusDesc ||
        meta.errorMessage)) ||
      '',
  ).trim();

// an error row { errorCode, errorDesc } (any spelling) counts once; returns the keys it used
function collectErrorRow(row, out) {
  const keys = Object.keys(row);
  const codeKey = keys.find((k) => /^(error|err)[_ ]?code$|^code$/i.test(k));
  const descKey = keys.find((k) => /^(error|err)[_ ]?(desc|description|message|msg|text)$/i.test(k));
  if (codeKey || descKey) {
    const code = String(row[codeKey] ?? '').trim();
    let text = String(row[descKey] ?? '').trim();
    const isSuccess = /^(0+|000|success|submitted)$/i.test(code) || /^submitted$/i.test(text);
    if (!isSuccess && (code || text)) {
      if (!text && ICES_ERR[code]) text = ICES_ERR[code];
      if (!text && code) text = 'ICES error code ' + code;
      // where: invoice / item serial of the error row
      const invoiceNo = String(row.invoiceSerialNumber ?? row.invSrNo ?? '').trim();
      const itemNo = String(row.itemSerialNumber ?? row.itemSrNo ?? '').trim();
      const at = [
        invoiceNo && invoiceNo !== '0' ? 'Invoice ' + invoiceNo : '',
        itemNo && itemNo !== '0' ? 'Item ' + itemNo : '',
      ]
        .filter(Boolean)
        .join(' ');
      out.errors.push({ code, text: at ? text + ' (' + at + ')' : text });
    }
  }
  return { codeKey, descKey };
}

// a plain value of the ack: BE / SB number and date, error texts, response code
function collectValue(key, value, out) {
  const lowerKey = key.toLowerCase();
  const s = String(value).trim();
  if (!out.beNo && /^(be|boe|billofentry)[_ ]?(number|no|num)$/.test(lowerKey) && /^\d{6,8}$/.test(s)) out.beNo = s;
  if (!out.beDate && /^(be|boe|billofentry)[_ ]?date$/.test(lowerKey) && s) out.beDate = s;
  // Shipping Bill acknowledgement, as the job list's SB Track reads it
  const lettersOnly = lowerKey.replace(/[^a-z]/g, '');
  if (!out.sbNo && /^(sbno|sbnumber|shippingbillno|shippingbillnumber)$/.test(lettersOnly) && /^\d{5,10}$/.test(s))
    out.sbNo = s;
  if (!out.sbDate && /^(sbdate|shippingbilldate)$/.test(lettersOnly) && s) out.sbDate = s;
  if (/^errors?$|^remarks?$|^errorlist$/.test(lowerKey) && s && !/^(0+|000|success)$/i.test(s))
    out.errors.push({ code: '', text: s });
  if (/^(response|resp|ack)[_ ]?(code|status)$/.test(lowerKey) && s) {
    out.responseCode = s;
  }
}

function walkAck(ack, out) {
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach((x) => walk(x));
      return;
    }
    const { codeKey, descKey } = collectErrorRow(node, out);
    for (const [k, val] of Object.entries(node)) {
      if (k === codeKey || k === descKey) continue;
      if (val != null && typeof val !== 'object') collectValue(k, val, out);
      else if (val && typeof val === 'object') walk(val);
    }
  };
  walk(ack);
}

const dedupeErrors = (errors) => {
  const unique = [];
  const seen = new Set();
  for (const e of errors) {
    const key = (e.code || '') + '|' + e.text;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(e);
    }
  }
  return unique;
};

// walk any JSON and pull out what a CHA needs
function interpretAck(meta, ack, httpStatus) {
  const out = { state: 'unknown', beNo: '', beDate: '', sbNo: '', sbDate: '', errors: [], message: '' };
  const metaStatus = metaStatusOf(meta);
  out.message = metaStatus;
  if (httpStatus && httpStatus >= 400 && !ack) {
    out.state = 'error';
    out.message = out.message || `ICEGATE answered HTTP ${httpStatus}`;
    return out;
  }
  // asked with another ICEGATE ID / bad token: ICEGATE did not answer about the file at all - not a rejection
  if (
    /authori[sz]ation failed|not allowed for provided sender|unauthori[sz]ed|invalid token|token (has )?expired/i.test(
      metaStatus,
    )
  ) {
    out.state = 'error';
    return out;
  }
  if (/in progress|pending/i.test(metaStatus)) out.state = 'pending';
  else if (/rejected|failed|invalid/i.test(metaStatus)) out.state = 'rejected';
  walkAck(ack, out);
  out.errors = dedupeErrors(out.errors);
  if (out.state === 'rejected' && !out.errors.length && metaStatus) out.errors.push({ code: '', text: metaStatus });
  if (out.beNo || out.sbNo) out.state = 'accepted';
  else if (out.errors.length && out.state !== 'pending') out.state = 'rejected';
  else if (out.state === 'unknown' && ack) out.state = /generated/i.test(metaStatus) ? 'rejected' : 'unknown';
  if (!out.message) {
    if (out.state === 'accepted')
      out.message = out.beNo
        ? `BE No ${out.beNo} dated ${dmyText(out.beDate)}`
        : `SB No ${out.sbNo} dated ${dmyText(out.sbDate)}`;
    else out.message = out.errors.length ? `${out.errors.length} error(s)` : 'No answer yet';
  }
  return out;
}

// an 8-digit date is YYYYMMDD only when it reads as one; otherwise it is the ICES DDMMYYYY ("18112026")
const ymdOf = (s) => {
  const t = String(s || '').trim();
  if (/^\d{8}$/.test(t) && !isYmd8(t)) return `${t.slice(4, 8)}-${t.slice(2, 4)}-${t.slice(0, 2)}`;
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(t);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

// blank, or not a real yyyy-mm-dd date (month 01-12, day 01-31, year 1990 on)
const badDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || '').trim());
  return !m || +m[1] < 1990 || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31;
};

// The ICEGATE ID a file went out with: getAck must be asked with that ID - asked with another one ICEGATE answers
// "Authorization failed, request not allowed for provided sender ID".
function senderOf(job, uid) {
  if (job.icegateUniqueId && job.icegateUniqueId === uid && job.filedJson) {
    try {
      const sender = String(((JSON.parse(job.filedJson) || {}).headerField || {}).senderID || '').trim();
      if (sender) return sender;
    } catch {
      /* not JSON */
    }
  }
  try {
    const prev = job.icegateAck ? JSON.parse(job.icegateAck) : null;
    if (prev && prev.uniqueId === uid && prev.senderId) return String(prev.senderId);
  } catch {
    /* none */
  }
  return '';
}

const STATE_TEXT = {
  accepted: 'ACCEPTED',
  rejected: 'REJECTED',
  pending: 'PENDING',
  error: 'COULD NOT ASK',
  unknown: 'ANSWER RECEIVED',
};

// the Unique ID to ask about: the one typed on the reply window, else the job's own
function resolveUniqueId(job, uniqueId) {
  const typed = String(uniqueId || '').trim();
  const uid = typed || String(job.icegateUniqueId || '').trim();
  if (!uid) throw new Error('This job has no ICEGATE Unique ID - type the Unique ID from the ICEGATE mail / reply');
  if (!UNIQUE_ID_PATTERN.test(uid)) throw new Error('"' + uid + '" is not an ICEGATE Unique ID');
  const newId = uid !== String(job.icegateUniqueId || '');
  if (newId && job.icegateUniqueId && /accepted/i.test(String(job.icegateStatus || ''))) {
    throw new Error(`This job already has Unique ID ${job.icegateUniqueId}, accepted by ICES - it is not replaced`);
  }
  return { uid, newId };
}

// the ICEGATE config to ask with: the chosen profile, else the profile of the ICEGATE ID the file went out with
async function resolveConfig(helpers, profileId, sender) {
  if (profileId) return helpers.getIcegateConfig(profileId);
  let profile = null;
  if (sender) {
    try {
      profile = await IcegateProfile.findOne({ where: { loginId: sender } });
    } catch {
      profile = null;
    }
  }
  return helpers.getIcegateConfig(profile ? profile.id : null);
}

// the job log gets a line when the answer changes (the 10-minute check does not repeat the same one)
const answerChanged = (prev, uid, interp) => {
  const prevInterp = prev && prev.interp;
  return (
    !prevInterp ||
    prev.uniqueId !== uid ||
    prevInterp.state !== interp.state ||
    prevInterp.message !== interp.message ||
    (prevInterp.errors || []).length !== interp.errors.length
  );
};

function replyLogText(uid, cfg, interp, numberText) {
  const errors = interp.errors
    .filter((e) => e.text !== interp.message)
    .slice(0, MAX_LOGGED_ERRORS)
    .map((e) => (e.code ? e.code + ': ' : '') + e.text);
  return `ICEGATE reply for Unique ID ${uid} (asked as ${cfg.loginId}): ${STATE_TEXT[interp.state] || interp.state} - ${interp.message || '-'}${numberText}${errors.length ? ' | Errors: ' + errors.join('; ') : ''}`;
}

const keepsFiledStatus = (status) => /^(Filed|Amended|Accepted)$/.test(String(status || ''));

// check one job: fetch, store, update status / BE no. `helpers` = { getIcegateConfig, getAuthToken }.
// opts.uniqueId: a Unique ID typed on the reply window for a job that has none - kept on the job only when ICEGATE
// knows it. opts.profileId: ask as this ICEGATE ID.
async function checkJobAck(job, helpers, { profileId, uniqueId, author } = {}) {
  const { uid, newId } = resolveUniqueId(job, uniqueId);
  const cfg = await resolveConfig(helpers, profileId, profileId ? '' : senderOf(job, uid));
  const tokenResult = await helpers.getAuthToken(cfg);
  const reply = await fetchAck(cfg, tokenResult.token, uid, cfg.loginId);
  const interp = interpretAck(reply.meta, reply.ack, reply.httpStatus);
  let prev = null;
  try {
    prev = job.icegateAck ? JSON.parse(job.icegateAck) : null;
  } catch {
    prev = null;
  }
  const stored = {
    at: new Date().toISOString(),
    uniqueId: uid,
    senderId: cfg.loginId,
    httpStatus: reply.httpStatus,
    meta: reply.meta,
    interp,
    ackText: reply.ackText,
  };
  // a typed Unique ID that ICEGATE does not answer for (wrong ID / wrong ICEGATE ID) is not written on the job
  if (newId && interp.state === 'error')
    return { ...interp, stored, uniqueId: uid, senderId: cfg.loginId, saved: false };
  const update = { icegateAck: JSON.stringify(stored), icegateAckAt: new Date() };
  if (newId) update.icegateUniqueId = uid;
  if (interp.state === 'pending' && !keepsFiledStatus(job.icegateStatus)) update.icegateStatus = 'Filed';
  if (interp.state === 'accepted') {
    update.icegateStatus = 'Accepted';
    // older rows may still carry BE no / date in extendedData; the ack only fills what is blank - a number typed
    // by the operator is never overwritten
    let extended = {};
    try {
      extended = job.extendedData ? JSON.parse(job.extendedData) : {};
    } catch {
      extended = {};
    }
    const had = { beNo: job.beNo || extended.beNo, beDate: job.beDate || extended.beDate };
    if (!had.beNo && interp.beNo) update.beNo = interp.beNo;
    // a BE date that is not a real yyyy-mm-dd is put right from the answer, for the same BE No; a real date typed
    // by the operator is still kept
    const sameBe = !had.beNo || String(had.beNo).trim() === String(interp.beNo || '').trim();
    if (sameBe && badDate(had.beDate) && interp.beDate && ymdOf(interp.beDate)) update.beDate = ymdOf(interp.beDate);
  } else if (interp.state === 'rejected') update.icegateStatus = 'Rejected';
  await ImportJob.update(update, { where: { id: job.id } });
  if (answerChanged(prev, uid, interp)) {
    const beText = interp.beNo ? ` - BE No ${interp.beNo}${interp.beDate ? ' dt ' + dmyText(interp.beDate) : ''}` : '';
    await logIcegate(
      'IMPORT',
      job.id,
      'ICEGATE_REPLY',
      replyLogText(uid, cfg, interp, beText),
      author || AUTO_CHECK_AUTHOR,
    );
  }
  return { ...interp, stored, uniqueId: uid, senderId: cfg.loginId, saved: true };
}

// ---- Shipping Bill (export job): the same as checkJobAck. ExportJob has no ack / filed-file columns, so the last
// answer and the ICEGATE ID the SB went out with are kept in additionalData (icegateAck, icegateSenderId).
const extraOf = (job) => {
  try {
    return JSON.parse(job.additionalData || '{}') || {};
  } catch {
    return {};
  }
};

// the SB No / date only fill what is blank (a number typed by the operator is never overwritten), as SB Track does
function applySbNumber(job, extra, interp, update) {
  if (!(job.sbNo || extra.sbNumber) && interp.sbNo) {
    update.sbNo = interp.sbNo;
    if (badDate(job.sbDate) && interp.sbDate) update.sbDate = ymdOf(interp.sbDate) || interp.sbDate;
  } else if (
    interp.sbNo &&
    String(job.sbNo || extra.sbNumber || '').trim() === interp.sbNo &&
    job.sbDate &&
    badDate(job.sbDate) &&
    ymdOf(interp.sbDate)
  ) {
    update.sbDate = ymdOf(interp.sbDate);
  }
}

async function checkSbAck(job, helpers, { profileId, uniqueId, author } = {}) {
  const extraBefore = extraOf(job);
  const { uid, newId } = resolveUniqueId(job, uniqueId);
  const prev = extraBefore.icegateAck && typeof extraBefore.icegateAck === 'object' ? extraBefore.icegateAck : null;
  const sender = profileId
    ? ''
    : (!newId && extraBefore.icegateSenderId) || (prev && prev.uniqueId === uid && prev.senderId) || '';
  const cfg = await resolveConfig(helpers, profileId, sender);
  const tokenResult = await helpers.getAuthToken(cfg);
  const reply = await fetchAck(cfg, tokenResult.token, uid, cfg.loginId);
  const interp = interpretAck(reply.meta, reply.ack, reply.httpStatus);
  const stored = {
    at: new Date().toISOString(),
    uniqueId: uid,
    senderId: cfg.loginId,
    httpStatus: reply.httpStatus,
    meta: reply.meta,
    interp,
    ackText: String(reply.ackText || '').slice(0, MAX_SB_ACK_TEXT),
  };
  if (newId && interp.state === 'error')
    return { ...interp, stored, uniqueId: uid, senderId: cfg.loginId, saved: false };
  const fresh = await ExportJob.findByPk(job.id); // re-read: additionalData may have changed meanwhile
  const extra = extraOf(fresh || job);
  extra.icegateAck = stored;
  if (newId || !extra.icegateSenderId) extra.icegateSenderId = cfg.loginId;
  const update = { additionalData: JSON.stringify(extra) };
  if (newId) update.icegateUniqueId = uid;
  if (interp.state === 'pending' && !keepsFiledStatus(job.icegateStatus)) update.icegateStatus = 'Filed';
  if (interp.state === 'accepted') {
    update.icegateStatus = 'Accepted';
    applySbNumber(job, extra, interp, update);
    try {
      if (rank(job.status) < rank('SUBMITTED')) update.status = 'SUBMITTED';
    } catch {
      /* stage helper failed */
    }
  } else if (interp.state === 'rejected') update.icegateStatus = 'Rejected';
  await ExportJob.update(update, { where: { id: job.id } });
  if (answerChanged(prev, uid, interp)) {
    const sbText = interp.sbNo ? ` - SB No ${interp.sbNo}${interp.sbDate ? ' dt ' + dmyText(interp.sbDate) : ''}` : '';
    await logIcegate(
      'EXPORT',
      job.id,
      'ICEGATE_REPLY',
      replyLogText(uid, cfg, interp, sbText),
      author || AUTO_CHECK_AUTHOR,
    );
  }
  return { ...interp, stored, uniqueId: uid, senderId: cfg.loginId, saved: true };
}

// BE dates saved wrong from an ICES answer (an 8-digit DDMMYYYY read as YYYYMMDD) are put right from the answer kept
// on the job - same BE No only, and only when the saved date is not a real date. Runs with the reply check (90 s after
// the backend starts, then every 10 minutes); nothing to do = no write.
async function repairAckDates() {
  const rows = await ImportJob.findAll({
    where: { icegateAck: { [Op.ne]: null }, beDate: { [Op.ne]: null } },
    attributes: ['id', 'jobNo', 'beNo', 'beDate', 'icegateAck'],
  });
  let fixed = 0;
  for (const job of rows) {
    if (!badDate(job.beDate)) continue;
    let ack = null;
    try {
      ack = JSON.parse(job.icegateAck);
    } catch {
      continue;
    }
    const interp = ack && ack.interp;
    if (!interp || !interp.beNo || String(interp.beNo).trim() !== String(job.beNo || '').trim()) continue;
    const beDate = ymdOf(interp.beDate);
    if (!beDate || badDate(beDate)) continue;
    await ImportJob.update({ beDate }, { where: { id: job.id } });
    fixed++;
    try {
      await logIcegate(
        'IMPORT',
        job.id,
        'ICEGATE_REPLY',
        `BE date corrected to ${dmyText(interp.beDate)} from the ICEGATE reply (it was saved as "${job.beDate}") - BE No ${job.beNo}`,
        AUTO_CHECK_AUTHOR,
      );
    } catch {
      /* log only */
    }
    console.log(`[ICEGATE ack] job ${job.jobNo || job.id}: BE date ${job.beDate} -> ${beDate}`);
  }
  return fixed;
}

const awaitingAnswerWhere = (since) => ({
  icegateUniqueId: { [Op.ne]: null },
  icegateStatus: { [Op.in]: ['Filed', 'Amended'] },
  updatedAt: { [Op.gte]: since },
});

async function pollPendingAnswers(helpers) {
  try {
    await repairAckDates();
  } catch (e) {
    console.warn('[ICEGATE ack] date repair:', e.message);
  }
  try {
    const since = new Date(Date.now() - POLL_LOOKBACK_MS);
    const jobs = await ImportJob.findAll({ where: awaitingAnswerWhere(since), limit: POLL_BATCH_SIZE });
    for (const job of jobs) {
      try {
        const r = await checkJobAck(job, helpers);
        if (r.state !== 'pending') console.log(`[ICEGATE ack] job ${job.jobNo || job.id}: ${r.state} ${r.message}`);
      } catch (e) {
        console.warn(`[ICEGATE ack] job ${job.jobNo || job.id}:`, e.message);
      }
    }
    const shippingBills = await ExportJob.findAll({ where: awaitingAnswerWhere(since), limit: POLL_BATCH_SIZE });
    for (const job of shippingBills) {
      try {
        const r = await checkSbAck(job, helpers);
        if (r.state !== 'pending') console.log(`[ICEGATE ack] SB job ${job.jobNo || job.id}: ${r.state} ${r.message}`);
      } catch (e) {
        console.warn(`[ICEGATE ack] SB job ${job.jobNo || job.id}:`, e.message);
      }
    }
  } catch (e) {
    console.warn('[ICEGATE ack] poll:', e.message);
  }
}

// every 10 minutes: jobs filed through the API in the last 3 days with no final answer yet
let pollTimer = null;
function startAckPolling(helpers, everyMs = TEN_MINUTES_MS) {
  const run = () => pollPendingAnswers(helpers);
  setTimeout(run, FIRST_POLL_DELAY_MS);
  pollTimer = setInterval(run, everyMs);
  return pollTimer;
}

export { checkJobAck, checkSbAck, startAckPolling };
