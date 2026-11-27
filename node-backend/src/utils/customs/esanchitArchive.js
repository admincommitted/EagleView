// e-Sanchit PDFs kept with the job.
// The screens file a PDF under uploads/esanchit_archive/<job no>/ the moment it is attached / signed. A job that is not
// saved yet has no number, so its PDFs go to "draft" (or "job-<id>", or "misc" when no job was sent), where the job's
// Files window (which looks in the job no folder) does not see them. On save, once the job no is known, relinkJob()
// moves such PDFs into the job's own folder and points the document rows (fileUrl) there.
// Only the temporary folders are touched: a row copied from another job ("Add by job no") keeps that job's PDF.
import fs from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from '../../config/env.js';

const ROOT = path.join(UPLOADS_DIR, 'esanchit_archive');
const URL_RX = /^\/uploads\/esanchit_archive\/([^/]+)\/([^/?#]+)$/;
const TEMP = /^(draft|misc|job-\d+)$/;
const ARCHIVE_URL_PREFIX = '/uploads/esanchit_archive/';
const MAX_FOLDER_NAME_LENGTH = 60;
const IRN_PATTERN = /^\d{16}$/;

// same rule as the ICEGATE filing routes use for the folder name from the job no
const safeName = (s, fallback) => {
  const name = String(s || '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_FOLDER_NAME_LENGTH);
  return !name || /^[._-]+$/.test(name) ? fallback : name;
};
const safeFile = (f) => /^[A-Za-z0-9._-]+$/.test(f) && !/^\.+$/.test(f);

// a row list may come as a JSON string or as an array; returns { rows, asText } or null when it is not a list
function parseRowList(list) {
  const asText = typeof list === 'string';
  let rows = list;
  if (asText) {
    try {
      rows = JSON.parse(list);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(rows)) return null;
  return { rows, asText };
}

// writes a JSON note file through a temp file, so a reader never sees half a file
function writeJsonAtomically(file, data) {
  fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 1));
  fs.renameSync(file + '.tmp', file);
}
const readJsonMap = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
};

function relinkList(list, key) {
  const parsed = parseRowList(list);
  if (!parsed) return { list, moved: 0 };
  const { rows, asText } = parsed;
  let moved = 0,
    changed = false;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !row.fileUrl) continue;
    const m = URL_RX.exec(String(row.fileUrl));
    if (!m || !TEMP.test(m[1]) || m[1] === key || !safeFile(m[2])) continue;
    const source = path.join(ROOT, m[1], m[2]);
    const targetDir = path.join(ROOT, key);
    const target = path.join(targetDir, m[2]);
    try {
      if (fs.existsSync(source) && !fs.existsSync(target)) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.renameSync(source, target);
        moved++;
      }
      if (fs.existsSync(target)) {
        row.fileUrl = ARCHIVE_URL_PREFIX + key + '/' + m[2];
        changed = true;
      }
    } catch (e) {
      console.warn('[e-Sanchit archive] could not move ' + m[2] + ': ' + e.message);
    }
  }
  return { list: changed ? (asText ? JSON.stringify(rows) : rows) : list, moved };
}

// calls fn(list) for every job-level list and every item-level list of the payload, storing what it returns
function forEachDocumentList(payload, { jobLists = [], itemLists = [] }, fn) {
  for (const k of jobLists) if (payload[k]) payload[k] = fn(payload[k]);
  for (const inv of Array.isArray(payload.invoices) ? payload.invoices : []) {
    for (const item of inv && Array.isArray(inv.items) ? inv.items : []) {
      for (const k of itemLists) if (item && item[k]) item[k] = fn(item[k]);
    }
  }
}

// payload = the job as the screen sends it; jobLists = job-level row lists, itemLists = row lists on each item
function relinkJob(payload, jobNo, { jobLists = [], itemLists = [] } = {}) {
  const key = safeName(jobNo, '');
  if (!payload || !key || TEMP.test(key)) return 0;
  let moved = 0;
  forEachDocumentList(payload, { jobLists, itemLists }, (list) => {
    const result = relinkList(list, key);
    moved += result.moved;
    return result.list;
  });
  return moved;
}

// an old link (draft / misc / job-<id>) to a PDF that was moved on save: find the file in the job folders
// (file names carry the time they were filed, so the name is unique)
function findMoved(file) {
  if (!safeFile(file)) return null;
  try {
    for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const candidate = path.join(ROOT, dir.name, file);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    /* no archive yet */
  }
  return null;
}

// A per-folder JSON note (signatures, IRNs), read once and kept until the file changes (mtime).
function createNoteCache(noteFileName) {
  const cache = new Map(); // dir -> { mtime, map }
  const read = (dir) => {
    const file = path.join(ROOT, dir, noteFileName);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      cache.delete(dir);
      return null;
    }
    const cached = cache.get(dir);
    if (cached && cached.mtime === stat.mtimeMs) return cached.map;
    const map = readJsonMap(file);
    cache.set(dir, { mtime: stat.mtimeMs, map });
    return map;
  };
  const write = (fileUrl, buildEntry) => {
    const m = URL_RX.exec(String(fileUrl || ''));
    if (!m) throw new Error('Not an e-Sanchit archive file: ' + fileUrl);
    const file = path.join(ROOT, m[1], noteFileName);
    const map = readJsonMap(file);
    map[m[2]] = buildEntry();
    writeJsonAtomically(file, map);
    cache.delete(m[1]);
  };
  return { read, write };
}

// PDFs signed in EagleView Signer (the DSC tool on the user's PC)
// The tool lists the attached, not yet signed e-Sanchit PDFs, signs them on the PC and sends the signed PDF back. The
// signed copy is filed next to the original and noted in <job folder>/_signed.json { original file: {file, signer, by,
// at} }. The job's own rows are not rewritten there (the job may be open in a screen and saved later); instead every
// read and every save of the job points the row at the signed copy (applySigned) - so a screen opened before the
// signing cannot undo it on save.
const signedNotes = createNoteCache('_signed.json');

function signedOf(fileUrl) {
  const m = URL_RX.exec(String(fileUrl || ''));
  if (!m) return null;
  const map = signedNotes.read(m[1]);
  const hit = map && map[m[2]];
  return hit && hit.file ? { ...hit, dir: m[1], url: ARCHIVE_URL_PREFIX + m[1] + '/' + hit.file } : null;
}

function noteSigned(fileUrl, signedFile, info) {
  signedNotes.write(fileUrl, () => ({ file: signedFile, ...info }));
}

// IRN / DRN given by ICEGATE e-Sanchit for a signed PDF uploaded from EagleView Signer.
// Kept the same way as the signatures: <job folder>/_irn.json { uploaded file: {irn, drn, by, at, icegateId, portalName} }
// and put on the job's row at every read and save (applySigned), so an open screen saved later keeps it.
const irnNotes = createNoteCache('_irn.json');

function irnOf(fileUrl) {
  const m = URL_RX.exec(String(fileUrl || ''));
  if (!m) return null;
  const map = irnNotes.read(m[1]);
  const hit = map && map[m[2]];
  return hit && IRN_PATTERN.test(String(hit.irn || '')) ? { ...hit, dir: m[1], file: m[2] } : null;
}

function noteIrn(fileUrl, info) {
  irnNotes.write(fileUrl, () => ({ ...info }));
}

// every IRN noted in the archive (for the "already used" check)
function irnUsed(irn) {
  try {
    for (const dir of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const map = irnNotes.read(dir.name) || {};
      for (const [file, entry] of Object.entries(map)) if (entry && entry.irn === irn) return { dir: dir.name, file };
    }
  } catch {
    /* no archive */
  }
  return null;
}

function applyList(list) {
  const parsed = parseRowList(list);
  if (!parsed) return list;
  const { rows, asText } = parsed;
  let changed = false;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !row.fileUrl || IRN_PATTERN.test(String(row.irn || ''))) continue;
    if (!row.signedOnly) {
      const signed = signedOf(row.fileUrl);
      if (signed) {
        row.fileUrl = signed.url;
        row.fileName = signed.file;
        row.signedOnly = true;
        row.signedBy = signed.signer || '';
        row.signedAt = signed.at || '';
        changed = true;
      }
    }
    const irnNote = irnOf(row.fileUrl);
    if (irnNote) {
      row.irn = irnNote.irn;
      if (!row.drn && IRN_PATTERN.test(String(irnNote.drn || ''))) row.drn = irnNote.drn;
      row.uploadedAt = irnNote.at || '';
      row.uploadedBy = irnNote.by || '';
      if (irnNote.icegateId) row.uploadedIcegateId = irnNote.icegateId;
      changed = true;
    }
  }
  return changed ? (asText ? JSON.stringify(rows) : rows) : list;
}

function applySigned(payload, { jobLists = [], itemLists = [] } = {}) {
  if (!payload) return payload;
  forEachDocumentList(payload, { jobLists, itemLists }, applyList);
  return payload;
}

// Documents added to a job from EagleView Signer. The tool writes the row straight into the job's list;
// <job folder>/_added.json keeps it until a job screen has shown it, so a screen opened BEFORE the tool added the
// document cannot drop it when it saves (import refuses such a save anyway - _loadedAt - export has no such check).
//   read:  the row is on the job -> noted as shown; not on the job -> put back (shown)
//   save:  row in the saved list -> note done; row missing and never shown -> put back; missing after it was shown ->
//          the user removed it on the screen -> note done
const ADDED_JSON = '_added.json';

const readAdded = (dir) => readJsonMap(path.join(ROOT, dir, ADDED_JSON));

function writeAdded(dir, map) {
  const file = path.join(ROOT, dir, ADDED_JSON);
  if (!Object.keys(map).length) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* none */
    }
    return;
  }
  writeJsonAtomically(file, map);
}

function noteAdded(fileUrl, row, by) {
  const m = URL_RX.exec(String(fileUrl || ''));
  if (!m) return;
  const map = readAdded(m[1]);
  map[m[2]] = { row, by, at: new Date().toISOString(), shown: false };
  writeAdded(m[1], map);
}

const fileStem = (url) => path.basename(String(url || '')).replace(/(_signed)?\.pdf$/i, '');

function mergeAdded(payload, listKey, mode) {
  if (!payload || !payload.jobNo) return payload;
  if (mode !== 'read' && !(listKey in payload)) return payload; // a save without this list keeps the job's own
  const dir = safeName(payload.jobNo, '');
  if (!dir || !fs.existsSync(path.join(ROOT, dir, ADDED_JSON))) return payload;
  const map = readAdded(dir);
  const names = Object.keys(map);
  if (!names.length) return payload;
  const asText = typeof payload[listKey] === 'string';
  let list = payload[listKey];
  if (asText) {
    try {
      list = JSON.parse(list);
    } catch {
      return payload;
    }
  }
  if (!Array.isArray(list)) list = [];
  const onJob = new Set(list.filter((d) => d && d.fileUrl).map((d) => fileStem(d.fileUrl)));
  let listChanged = false,
    noteChanged = false;
  for (const name of names) {
    const note = map[name];
    const present = onJob.has(fileStem(name));
    if (mode === 'read') {
      if (!present) {
        list.push({ ...note.row });
        listChanged = true;
      }
      if (!note.shown) {
        note.shown = true;
        noteChanged = true;
      }
    } else if (present) {
      delete map[name];
      noteChanged = true;
    } else if (note.shown) {
      delete map[name];
      noteChanged = true; // removed by the user on the screen
    } else {
      list.push({ ...note.row });
      listChanged = true; // that screen never had it: keep it
    }
  }
  if (noteChanged) {
    try {
      writeAdded(dir, map);
    } catch {
      /* read only */
    }
  }
  if (listChanged) payload[listKey] = asText ? JSON.stringify(list) : list;
  return payload;
}

export {
  relinkJob,
  findMoved,
  safeName,
  ROOT,
  URL_RX,
  safeFile,
  signedOf,
  noteSigned,
  applySigned,
  applyList,
  irnOf,
  noteIrn,
  irnUsed,
  noteAdded,
  mergeAdded,
};
