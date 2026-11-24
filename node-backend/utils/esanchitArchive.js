// e-Sanchit PDFs kept with the job (14-Nov-2026)
// The screens file a PDF under uploads/esanchit_archive/<job no>/ the moment it is attached / signed. A job that is not
// saved yet has no number, so its PDFs went to "draft" (or "job-<id>", or "misc" when no job was sent) and stayed there:
// the job's Files window (which looks in the job no folder) did not show them. On save, once the job no is known,
// relinkJob() moves such PDFs into the job's own folder and points the document rows (fileUrl) there.
// Only the temporary folders are touched: a row copied from another job ("Add by job no") keeps that job's PDF.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'uploads', 'esanchit_archive');
const URL_RX = /^\/uploads\/esanchit_archive\/([^/]+)\/([^/?#]+)$/;
const TEMP = /^(draft|misc|job-\d+)$/;
// same rule as routes/icegate.js (folder name from the job no)
const safeName = (s, dflt) => { const v = String(s || '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60); return !v || /^[._-]+$/.test(v) ? dflt : v; };
const safeFile = (f) => /^[A-Za-z0-9._-]+$/.test(f) && !/^\.+$/.test(f);

function relinkList(list, key) {
  const asText = typeof list === 'string';
  let arr = list;
  if (asText) { try { arr = JSON.parse(list); } catch (e) { return { list, moved: 0 }; } }
  if (!Array.isArray(arr)) return { list, moved: 0 };
  let moved = 0, changed = false;
  for (const d of arr) {
    if (!d || typeof d !== 'object' || !d.fileUrl) continue;
    const m = URL_RX.exec(String(d.fileUrl));
    if (!m || !TEMP.test(m[1]) || m[1] === key || !safeFile(m[2])) continue;
    const src = path.join(ROOT, m[1], m[2]); const dstDir = path.join(ROOT, key); const dst = path.join(dstDir, m[2]);
    try {
      if (fs.existsSync(src) && !fs.existsSync(dst)) { fs.mkdirSync(dstDir, { recursive: true }); fs.renameSync(src, dst); moved++; }
      if (fs.existsSync(dst)) { d.fileUrl = '/uploads/esanchit_archive/' + key + '/' + m[2]; changed = true; }
    } catch (e) { console.warn('[e-Sanchit archive] could not move ' + m[2] + ': ' + e.message); }
  }
  return { list: changed ? (asText ? JSON.stringify(arr) : arr) : list, moved };
}

// payload = the job as the screen sends it; jobLists = job-level row lists, itemLists = row lists on each item
function relinkJob(payload, jobNo, { jobLists = [], itemLists = [] } = {}) {
  const key = safeName(jobNo, '');
  if (!payload || !key || TEMP.test(key)) return 0;
  let moved = 0;
  for (const k of jobLists) if (payload[k]) { const r = relinkList(payload[k], key); payload[k] = r.list; moved += r.moved; }
  for (const inv of (Array.isArray(payload.invoices) ? payload.invoices : [])) {
    for (const it of (inv && Array.isArray(inv.items) ? inv.items : [])) {
      for (const k of itemLists) if (it && it[k]) { const r = relinkList(it[k], key); it[k] = r.list; moved += r.moved; }
    }
  }
  return moved;
}

// an old link (draft / misc / job-<id>) to a PDF that was moved on save: find the file in the job folders
// (file names carry the time they were filed, so the name is unique)
function findMoved(file) {
  if (!safeFile(file)) return null;
  try {
    for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const p = path.join(ROOT, dir.name, file);
      if (fs.existsSync(p)) return p;
    }
  } catch (e) { /* no archive yet */ }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// PDFs signed in EagleView Signer (the DSC tool on the user's PC) - 16-Nov-2026
// The tool lists the attached, not yet signed e-Sanchit PDFs, signs them on the PC and sends the signed PDF back. The
// signed copy is filed next to the original and noted in <job folder>/_signed.json { original file: {file, signer, by,
// at} }. The job's own rows are not rewritten there (the job may be open in a screen and saved later); instead every
// read and every save of the job points the row at the signed copy (applySigned) - so a screen opened before the
// signing cannot undo it on save.
const SIGNED_JSON = '_signed.json';
const signedCache = new Map(); // dir -> { mtime, map }
function signedMap(dir) {
  const f = path.join(ROOT, dir, SIGNED_JSON);
  let st; try { st = fs.statSync(f); } catch (e) { signedCache.delete(dir); return null; }
  const c = signedCache.get(dir);
  if (c && c.mtime === st.mtimeMs) return c.map;
  let map = {}; try { map = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (e) { map = {}; }
  signedCache.set(dir, { mtime: st.mtimeMs, map });
  return map;
}
function signedOf(fileUrl) {
  const m = URL_RX.exec(String(fileUrl || ''));
  if (!m) return null;
  const map = signedMap(m[1]);
  const hit = map && map[m[2]];
  return hit && hit.file ? { ...hit, dir: m[1], url: '/uploads/esanchit_archive/' + m[1] + '/' + hit.file } : null;
}
function noteSigned(fileUrl, signedFile, info) {
  const m = URL_RX.exec(String(fileUrl || ''));
  if (!m) throw new Error('Not an e-Sanchit archive file: ' + fileUrl);
  const f = path.join(ROOT, m[1], SIGNED_JSON);
  let map = {}; try { map = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (e) { map = {}; }
  map[m[2]] = { file: signedFile, ...info };
  fs.writeFileSync(f + '.tmp', JSON.stringify(map, null, 1)); fs.renameSync(f + '.tmp', f);
  signedCache.delete(m[1]);
}
// ---------------------------------------------------------------------------------------------------------------------
// IRN / DRN given by ICEGATE e-Sanchit for a signed PDF uploaded from EagleView Signer - 16-Nov-2026
// Kept the same way as the signatures: <job folder>/_irn.json { uploaded file: {irn, drn, by, at, icegateId, portalName} }
// and put on the job's row at every read and save (applySigned), so an open screen saved later keeps it.
const IRN_JSON = '_irn.json';
const irnCache = new Map();
function irnMap(dir) {
  const f = path.join(ROOT, dir, IRN_JSON);
  let st; try { st = fs.statSync(f); } catch (e) { irnCache.delete(dir); return null; }
  const c = irnCache.get(dir);
  if (c && c.mtime === st.mtimeMs) return c.map;
  let map = {}; try { map = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (e) { map = {}; }
  irnCache.set(dir, { mtime: st.mtimeMs, map });
  return map;
}
function irnOf(fileUrl) {
  const m = URL_RX.exec(String(fileUrl || ''));
  if (!m) return null;
  const map = irnMap(m[1]);
  const hit = map && map[m[2]];
  return hit && /^\d{16}$/.test(String(hit.irn || '')) ? { ...hit, dir: m[1], file: m[2] } : null;
}
function noteIrn(fileUrl, info) {
  const m = URL_RX.exec(String(fileUrl || ''));
  if (!m) throw new Error('Not an e-Sanchit archive file: ' + fileUrl);
  const f = path.join(ROOT, m[1], IRN_JSON);
  let map = {}; try { map = JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (e) { map = {}; }
  map[m[2]] = { ...info };
  fs.writeFileSync(f + '.tmp', JSON.stringify(map, null, 1)); fs.renameSync(f + '.tmp', f);
  irnCache.delete(m[1]);
}
// every IRN noted in the archive (for the "already used" check)
function irnUsed(irn) {
  try {
    for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const map = irnMap(dir.name) || {};
      for (const [file, v] of Object.entries(map)) if (v && v.irn === irn) return { dir: dir.name, file };
    }
  } catch (e) { /* no archive */ }
  return null;
}

function applyList(list) {
  const asText = typeof list === 'string';
  let arr = list;
  if (asText) { try { arr = JSON.parse(list); } catch (e) { return list; } }
  if (!Array.isArray(arr)) return list;
  let changed = false;
  for (const d of arr) {
    if (!d || typeof d !== 'object' || !d.fileUrl || /^\d{16}$/.test(String(d.irn || ''))) continue;
    if (!d.signedOnly) {
      const s = signedOf(d.fileUrl);
      if (s) { d.fileUrl = s.url; d.fileName = s.file; d.signedOnly = true; d.signedBy = s.signer || ''; d.signedAt = s.at || ''; changed = true; }
    }
    const n = irnOf(d.fileUrl);
    if (n) {
      d.irn = n.irn; if (!d.drn && /^\d{16}$/.test(String(n.drn || ''))) d.drn = n.drn;
      d.uploadedAt = n.at || ''; d.uploadedBy = n.by || ''; if (n.icegateId) d.uploadedIcegateId = n.icegateId;
      changed = true;
    }
  }
  return changed ? (asText ? JSON.stringify(arr) : arr) : list;
}
function applySigned(payload, { jobLists = [], itemLists = [] } = {}) {
  if (!payload) return payload;
  for (const k of jobLists) if (payload[k]) payload[k] = applyList(payload[k]);
  for (const inv of (Array.isArray(payload.invoices) ? payload.invoices : [])) {
    for (const it of (inv && Array.isArray(inv.items) ? inv.items : [])) {
      for (const k of itemLists) if (it && it[k]) it[k] = applyList(it[k]);
    }
  }
  return payload;
}

// ---------------------------------------------------------------------------------------------------------------------
// Documents added to a job from EagleView Signer (17-Nov-2026). The tool writes the row straight into the job's list;
// <job folder>/_added.json keeps it until a job screen has shown it, so a screen opened BEFORE the tool added the
// document cannot drop it when it saves (import refuses such a save anyway - _loadedAt - export has no such check).
//   read:  the row is on the job -> noted as shown; not on the job -> put back (shown)
//   save:  row in the saved list -> note done; row missing and never shown -> put back; missing after it was shown ->
//          the user removed it on the screen -> note done
const ADDED_JSON = '_added.json';
function readAdded(dir) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, dir, ADDED_JSON), 'utf8')) || {}; } catch (e) { return {}; } }
function writeAdded(dir, map) {
  const f = path.join(ROOT, dir, ADDED_JSON);
  if (!Object.keys(map).length) { try { fs.unlinkSync(f); } catch (e) { /* none */ } return; }
  fs.writeFileSync(f + '.tmp', JSON.stringify(map, null, 1)); fs.renameSync(f + '.tmp', f);
}
function noteAdded(fileUrl, row, by) {
  const m = URL_RX.exec(String(fileUrl || '')); if (!m) return;
  const map = readAdded(m[1]); map[m[2]] = { row, by, at: new Date().toISOString(), shown: false }; writeAdded(m[1], map);
}
function mergeAdded(payload, listKey, mode) {
  if (!payload || !payload.jobNo) return payload;
  if (mode !== 'read' && !(listKey in payload)) return payload;   // a save without this list keeps the job's own
  const dir = safeName(payload.jobNo, '');
  if (!dir || !fs.existsSync(path.join(ROOT, dir, ADDED_JSON))) return payload;
  const map = readAdded(dir); const names = Object.keys(map);
  if (!names.length) return payload;
  const asText = typeof payload[listKey] === 'string';
  let list = payload[listKey];
  if (asText) { try { list = JSON.parse(list); } catch (e) { return payload; } }
  if (!Array.isArray(list)) list = [];
  const stem = (u) => path.basename(String(u || '')).replace(/(_signed)?\.pdf$/i, '');
  const have = new Set(list.filter(d => d && d.fileUrl).map(d => stem(d.fileUrl)));
  let changed = false, noteChanged = false;
  for (const name of names) {
    const n = map[name]; const present = have.has(stem(name));
    if (mode === 'read') {
      if (!present) { list.push({ ...n.row }); changed = true; }
      if (!n.shown) { n.shown = true; noteChanged = true; }
    } else if (present) { delete map[name]; noteChanged = true; }
    else if (n.shown) { delete map[name]; noteChanged = true; }        // removed by the user on the screen
    else { list.push({ ...n.row }); changed = true; }                   // that screen never had it: keep it
  }
  if (noteChanged) { try { writeAdded(dir, map); } catch (e) { /* read only */ } }
  if (changed) payload[listKey] = asText ? JSON.stringify(list) : list;
  return payload;
}

module.exports = { relinkJob, relinkList, findMoved, safeName, ROOT, URL_RX, safeFile, signedOf, noteSigned, applySigned, applyList, irnOf, noteIrn, irnUsed, noteAdded, mergeAdded };
