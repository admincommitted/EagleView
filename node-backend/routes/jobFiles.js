// Files kept with an import / export job - the "Documents" window of the job list. 18-Nov-2026
//   GET    /:module/:jobId                 e-Sanchit PDFs of the job folder, one line per document (the PDF as attached
//                                         and its signed copy together), and the other documents uploaded by hand
//   POST   /:module/:jobId/other           file + docType + remarks: a shipment document uploaded by hand (any office
//                                         file: PDF, picture, Excel, Word, mail ...), kept in <job folder>/_other/
//   DELETE /:module/:jobId?kind=&file=     takes a file off the list: it is moved to a _removed folder (not erased).
//                                         An e-Sanchit PDF that a document row of the job (or its signed copy / IRN /
//                                         a document added from EagleView Signer) still uses is refused.
// Why the window showed "the same PDF" twice or four times: every e-Sanchit document keeps the PDF as attached AND its
// DSC-signed copy (<name>_signed.pdf, noted in _signed.json); on 17-Nov a PDF that was signed already was filed with
// "_signed" in its name and signed again (<name>_signed_signed.pdf - fixed that day in signerQueue add-doc). Both files
// are needed (the row points at the original, every read shows the signed copy), so they are shown as one line now.
// A PDF filed again by an Update of the row, or left by a removed row, is not used by any row and can be removed.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const A = require('../utils/esanchitArchive');
const { effective } = require('../utils/moduleCatalog');

const router = express.Router();
const q = (sql, r = []) => sequelize.query(sql, { replacements: r, type: QueryTypes.SELECT });
const who = (req) => (req.user && (req.user.username || req.user.name || req.user.email)) || 'user';
const parse = (v, d) => { if (v == null || v === '') return d; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return d; } };
const MOD = { import: 'Import', export: 'Export' };
const RIGHT = { Import: 'Bill of Entry (Import)', Export: 'Shipping Bill (Export)' };
const OTHER = '_other';
const REMOVED = '_removed';
const OTHER_JSON = '_other.json';
// office files only - nothing a browser would run (html / svg / js are never taken)
const OK_EXT = /\.(pdf|jpe?g|png|gif|bmp|tiff?|xlsx?|xlsm|csv|docx?|txt|rtf|odt|ods|zip|rar|7z|eml|msg)$/i;
const DOC_TYPES = ['Invoice', 'Packing List', 'Airway Bill / Bill of Lading', 'Certificate of Origin', 'Insurance', 'Purchase Order',
  'Delivery Order', 'Duty Challan / Payment', 'Out of Charge', 'Gate Pass', 'Licence / Permission', 'Letter / Mail', 'Photo', 'Other'];

async function rights(req, mod) {
  const u = req.user || {};
  if (String(u.role || '').toLowerCase() === 'admin') return { view: true, edit: true };
  let perms = null;
  try { perms = await require('../middleware/permissions').loadPerms(u.id); } catch (e) { perms = {}; }
  if (!perms) return { view: true, edit: true };   // no rights saved yet = unrestricted, as everywhere in EagleView
  const p = effective(perms, RIGHT[mod]) || {};
  return { view: !!p.canView, edit: !!(p.canEdit || p.canCreate) };
}
async function loadJob(req, res, need) {
  const mod = MOD[String(req.params.module || '').toLowerCase()];
  if (!mod) { res.status(400).json({ success: false, error: 'Module must be import or export' }); return null; }
  const r = await rights(req, mod);
  if (!r.view || (need === 'edit' && !r.edit)) { res.status(403).json({ success: false, error: `No ${need === 'edit' ? 'edit' : 'view'} right for ${RIGHT[mod]} - ask the admin (User Management)` }); return null; }
  const job = mod === 'Import'
    ? (await q('SELECT id, jobNo, extendedData AS list FROM ImportJobs WHERE id = ?', [req.params.jobId]))[0]
    : (await q('SELECT id, jobNo, eSanchitList AS list FROM ExportJobs WHERE id = ?', [req.params.jobId]))[0];
  if (!job || !job.jobNo || job.jobNo === 'DRAFT') { res.status(404).json({ success: false, error: 'Job not found (save the job first)' }); return null; }
  return { mod, job, dir: A.safeName(job.jobNo, 'misc'), canEdit: r.edit };
}
// every PDF a document row of the job (BE / SB level and items) points at
async function rowFiles(mod, job) {
  const lists = [];
  if (mod === 'Import') {
    lists.push(parse(parse(job.list, {}).esanchitDocs, []));
    // items hang on the invoice (importJobId is empty on some item rows)
    for (const it of await q('SELECT extendedData FROM ImportItems WHERE importJobId = ? OR importInvoiceId IN (SELECT id FROM ImportInvoices WHERE importJobId = ?)', [job.id, job.id])) lists.push(parse(parse(it.extendedData, {}).docsData, []));
  } else {
    lists.push(parse(job.list, []));
    // export items carry no exportJobId - they hang on the invoice
    for (const it of await q('SELECT eSanchitList FROM ExportItems WHERE exportJobId = ? OR exportInvoiceId IN (SELECT id FROM ExportInvoices WHERE exportJobId = ?)', [job.id, job.id])) lists.push(parse(it.eSanchitList, []));
  }
  const used = [];
  for (const l of lists) for (const d of (Array.isArray(l) ? l : [])) {
    if (!d || typeof d !== 'object') continue;
    for (const k of ['fileUrl', '_raw', 'origUrl', 'originalUrl']) if (d[k] && typeof d[k] === 'string') used.push({ url: d[k], code: d.docCode || '', irn: d.irn || '' });
  }
  return used;
}
// one name for the PDF as attached and all its signed copies: <code>_<irn>_<ms>_<name>
const stem = (f) => String(f).replace(/(_signed)*\.pdf$/i, '');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) || {}; } catch (e) { return {}; } };
const md5 = (f) => { try { return crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex'); } catch (e) { return ''; } };

function esanchitGroups(dir, used) {
  const root = path.join(A.ROOT, dir);
  let names = [];
  try { names = fs.readdirSync(root).filter(f => /\.pdf$/i.test(f) && A.safeFile(f) && fs.statSync(path.join(root, f)).isFile()); } catch (e) { names = []; }
  const signed = readJson(path.join(root, '_signed.json'));
  const irn = readJson(path.join(root, '_irn.json'));
  const added = readJson(path.join(root, '_added.json'));
  const usedStems = new Map();
  for (const u of used) { const m = A.URL_RX.exec(String(u.url)); if (m && m[1] === dir) usedStems.set(stem(m[2]), u); }
  for (const k of [...Object.keys(irn), ...Object.keys(added)]) if (!usedStems.has(stem(k))) usedStems.set(stem(k), { code: '', irn: (irn[k] && irn[k].irn) || '' });
  const signedFiles = new Set(Object.values(signed).map(v => v && v.file).filter(Boolean));
  const groups = new Map();
  for (const f of names) {
    const st = fs.statSync(path.join(root, f));
    const s = stem(f);
    if (!groups.has(s)) groups.set(s, { key: s, files: [] });
    const isSigned = signedFiles.has(f) || /_signed\.pdf$/i.test(f) && !signed[f];
    groups.get(s).files.push({ fileName: f, fileUrl: '/uploads/esanchit_archive/' + dir + '/' + f, size: st.size, savedAt: st.mtime,
      signed: isSigned, signer: (Object.values(signed).find(v => v && v.file === f) || {}).signer || '', hash: md5(path.join(root, f)) });
  }
  const out = [];
  for (const g of groups.values()) {
    // the copy to open: the newest signed one, else the PDF as attached
    g.files.sort((a, b) => (b.signed - a.signed) || (b.fileName.length - a.fileName.length));
    const u = usedStems.get(g.key);
    const m = /^([A-Za-z0-9]+)_([^_]*)_(\d{13})_/.exec(g.key);
    out.push({ key: g.key, docCode: (u && u.code) || (m ? m[1] : ''), irn: (u && /^\d{16}$/.test(String(u.irn || '')) ? u.irn : ''),
      attachedAt: m ? new Date(+m[3]).toISOString() : null, inUse: !!u, main: g.files[0], others: g.files.slice(1) });
  }
  // the same PDF filed more than once (an Update re-filed it): note which line it repeats
  const firstByHash = new Map();
  out.sort((a, b) => String(a.attachedAt || '').localeCompare(String(b.attachedAt || '')));
  for (const g of out) {
    const h = g.main.hash;
    if (h && firstByHash.has(h)) g.sameAs = firstByHash.get(h); else if (h) firstByHash.set(h, g.main.fileName);
  }
  return out;
}
function otherFiles(dir) {
  const root = path.join(A.ROOT, dir, OTHER);
  const meta = readJson(path.join(root, OTHER_JSON));
  let names = [];
  try { names = fs.readdirSync(root).filter(f => OK_EXT.test(f) && A.safeFile(f) && fs.statSync(path.join(root, f)).isFile()); } catch (e) { names = []; }
  return names.map(f => { const st = fs.statSync(path.join(root, f)); const m = meta[f] || {};
    return { fileName: f, name: m.name || f.replace(/^\d{13}_/, ''), docType: m.docType || '', remarks: m.remarks || '', by: m.by || '', savedAt: m.at || st.mtime,
      size: st.size, fileUrl: '/uploads/esanchit_archive/' + dir + '/' + OTHER + '/' + f }; })
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}
async function log(mod, jobId, msg, by) {
  try { await require('../models/JobTimeline').create({ jobId: String(jobId), module: mod.toUpperCase(), eventType: 'DOCUMENT', message: String(msg).slice(0, 4000), author: by }); }
  catch (e) { console.warn('[job files log]', e.message); }
}

router.get('/:module/:jobId', async (req, res) => {
  try {
    const x = await loadJob(req, res, 'view'); if (!x) return;
    res.json({ success: true, jobNo: x.job.jobNo, canEdit: x.canEdit, docTypes: DOC_TYPES,
      esanchit: esanchitGroups(x.dir, await rowFiles(x.mod, x.job)), other: otherFiles(x.dir) });
  } catch (e) { console.error('[job files]', e); res.status(500).json({ success: false, error: e.message }); }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
router.post('/:module/:jobId/other', (req, res, next) => upload.single('file')(req, res, (err) => err
  ? res.status(400).json({ success: false, error: /too large/i.test(err.message) ? 'The file is bigger than 25 MB' : err.message }) : next()), async (req, res) => {
  try {
    const x = await loadJob(req, res, 'edit'); if (!x) return;
    if (!req.file || !req.file.buffer || !req.file.buffer.length) return res.status(400).json({ success: false, error: 'Choose a file' });
    const orig = path.basename(String(req.file.originalname || 'document'));
    if (!OK_EXT.test(orig)) return res.status(400).json({ success: false, error: 'This kind of file is not taken - PDF, picture, Excel, Word, CSV, text, ZIP or mail (.eml / .msg)' });
    const ext = orig.slice(orig.lastIndexOf('.')).toLowerCase();
    const base = A.safeName(orig.slice(0, orig.lastIndexOf('.')), 'document');
    const b = req.body || {};
    const docType = DOC_TYPES.includes(String(b.docType || '')) ? String(b.docType) : 'Other';
    const root = path.join(A.ROOT, x.dir, OTHER);
    fs.mkdirSync(root, { recursive: true });
    const file = `${Date.now()}_${base}${ext}`;
    fs.writeFileSync(path.join(root, file), req.file.buffer);
    const metaFile = path.join(root, OTHER_JSON);
    const meta = readJson(metaFile);
    meta[file] = { name: orig.slice(0, 120), docType, remarks: String(b.remarks || '').slice(0, 200), by: who(req), at: new Date().toISOString(), size: req.file.buffer.length };
    fs.writeFileSync(metaFile + '.tmp', JSON.stringify(meta, null, 1)); fs.renameSync(metaFile + '.tmp', metaFile);
    await log(x.mod, x.job.id, `Document uploaded: ${docType} - ${orig}${meta[file].remarks ? ' (' + meta[file].remarks + ')' : ''}`, who(req));
    res.json({ success: true, file: otherFiles(x.dir).find(f => f.fileName === file) });
  } catch (e) { console.error('[job files upload]', e); res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:module/:jobId', async (req, res) => {
  try {
    const x = await loadJob(req, res, 'edit'); if (!x) return;
    const kind = String(req.query.kind || '');
    const file = String(req.query.file || '');
    if (!A.safeFile(file) || file.startsWith('_')) return res.status(400).json({ success: false, error: 'Wrong file name' });
    let src, dstDir, label;
    if (kind === 'other') {
      src = path.join(A.ROOT, x.dir, OTHER, file); dstDir = path.join(A.ROOT, x.dir, OTHER, REMOVED);
      const meta = readJson(path.join(A.ROOT, x.dir, OTHER, OTHER_JSON)); label = (meta[file] && ((meta[file].docType ? meta[file].docType + ' - ' : '') + meta[file].name)) || file;
    } else if (kind === 'esanchit') {
      if (!/\.pdf$/i.test(file)) return res.status(400).json({ success: false, error: 'Wrong file name' });
      const g = esanchitGroups(x.dir, await rowFiles(x.mod, x.job)).find(e => e.key === stem(file));
      if (!g) return res.status(404).json({ success: false, error: 'File not found: ' + file });
      // a PDF attached in the last 2 hours may be on a job screen that is open and not saved yet
      const age = Date.now() - Math.max(...[g.main, ...g.others].map(f => new Date(f.savedAt).getTime() || 0));
      if (!g.inUse && age < 2 * 3600 * 1000) return res.status(409).json({ success: false, error: 'This PDF was attached less than 2 hours ago - it may be on a job screen that is not saved yet. Try again later, or save the job first.' });
      if (g.inUse) return res.status(409).json({ success: false, error: `This PDF is used by the e-Sanchit document ${g.docCode || ''}${g.irn ? ' (IRN ' + g.irn + ')' : ''} of the job - remove that document in Supporting Docs first` });
      src = path.join(A.ROOT, x.dir, file); dstDir = path.join(A.ROOT, x.dir, REMOVED); label = file;
      // the PDF as attached and its signed copies go together
      const all = [g.main, ...g.others].map(f => f.fileName);
      fs.mkdirSync(dstDir, { recursive: true });
      for (const f of all) { const s = path.join(A.ROOT, x.dir, f); if (fs.existsSync(s)) fs.renameSync(s, path.join(dstDir, Date.now() + '_' + f)); }
      await log(x.mod, x.job.id, `e-Sanchit PDF taken off the job (not used by any document row): ${all.join(', ')} - kept in ${x.dir}\\${REMOVED}`, who(req));
      return res.json({ success: true, removed: all });
    } else return res.status(400).json({ success: false, error: 'kind must be other or esanchit' });
    if (!fs.existsSync(src)) return res.status(404).json({ success: false, error: 'File not found: ' + file });
    fs.mkdirSync(dstDir, { recursive: true });
    fs.renameSync(src, path.join(dstDir, Date.now() + '_' + file));
    await log(x.mod, x.job.id, `Document removed: ${label} - kept in ${x.dir}\\${OTHER}\\${REMOVED}`, who(req));
    res.json({ success: true, removed: [file] });
  } catch (e) { console.error('[job files delete]', e); res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
module.exports.DOC_TYPES = DOC_TYPES;
