// EagleView Signer (the DSC tool on each user's PC) - what is waiting to be signed, and the signed files back.
// 16-Nov-2026. Mounted at /api/icegate/signer (rights: "E-Sanchit", as the other e-Sanchit sign / upload calls).
//   GET  /queue                 e-Sanchit PDFs attached to import / export jobs and not signed yet + BE amendment
//                               files made and not signed
//   POST /esanchit              { fileUrl, signer } + pdf: the signed copy of one archived PDF -> filed next to it,
//                               noted in _signed.json (utils/esanchitArchive applySigned shows it on the job)
//   GET  /amend/:id             the amendment's file (base64) to sign
//   POST /amend/:id             { signed_b64, signer_cn, fileMadeAt } -> kept as the amendment's signed file
//   GET  /upload-queue          signed e-Sanchit PDFs without an IRN, per job, with the details ICEGATE asks for
//   GET  /jobs?module=&q=       17-Nov-2026: jobs to add a document to (search), with the beneficiary from the job
//   GET  /doc-codes             e-Sanchit document codes (master)
//   POST /add-doc               { module, jobId, row (JSON) } + pdf: the PDF kept with the job and its row added to the
//                               job's e-Sanchit list (BE / SB level), as if attached on the job screen
//   GET  /job-docs?module=&jobId=  17-Nov-2026: the job's BE / SB level e-Sanchit rows (signed / IRN / DRN) for the
//                               tool's "Job folder" page
//   17-Nov-2026: everything here only for the user's divisions (access(): Import / Export rights in User Management)
//   POST /irn                   { fileUrl, irn, drn, icegateId, portalName } -> IRN given by ICEGATE e-Sanchit, noted in
//                               _irn.json and put on the job row at every read / save (utils/esanchitArchive)
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');
const A = require('../utils/esanchitArchive');
const { effective } = require('../utils/moduleCatalog');

// 17-Nov-2026: each user sees and handles only the division he has rights for in EagleView (User Management):
// Import = "Bill of Entry (Import)" view right (import e-Sanchit PDFs and BE amendments), Export = "Shipping Bill
// (Export)" view right. Admin, and a user with no rights saved yet (unrestricted, as everywhere in EagleView): both.
async function access(req) {
  const u = req.user || {};
  if (String(u.role || '').toLowerCase() === 'admin') return { import: true, export: true };
  let perms = null;
  try { perms = await require('../middleware/permissions').loadPerms(u.id); } catch (e) { perms = {}; }
  if (!perms) return { import: true, export: true };
  const can = (k) => { const p = effective(perms, k); return !!(p && p.canView); };
  return { import: can('Bill of Entry (Import)'), export: can('Shipping Bill (Export)') };
}
const NO_RIGHT = { Import: 'You have no rights for Import (Bill of Entry) in EagleView', Export: 'You have no rights for Export (Shipping Bill) in EagleView' };
// which division an archived e-Sanchit PDF belongs to (the job / item row that has it, or its signed copy)
async function divisionOf(dir, file) {
  const stem = String(file).replace(/(_signed)?\.pdf$/i, '');
  const like = `%esanchit_archive/${dir}/${stem}%`;
  const one = async (sql) => { try { return (await q(sql, [like])).length > 0; } catch (e) { return false; } };
  if (await one('SELECT 1 FROM ImportJobs WHERE extendedData LIKE ? LIMIT 1') || await one('SELECT 1 FROM ImportItems WHERE extendedData LIKE ? LIMIT 1')) return 'Import';
  if (await one('SELECT 1 FROM ExportJobs WHERE eSanchitList LIKE ? LIMIT 1') || await one('SELECT 1 FROM ExportItems WHERE eSanchitList LIKE ? LIMIT 1')) return 'Export';
  return '';
}
// refuse (and answer) when the user may not handle this PDF; returns true when refused
async function refuseFile(req, res, dir, file) {
  const acc = await access(req);
  if (acc.import && acc.export) return false;
  const div = await divisionOf(dir, file);
  if (!div) { res.status(404).json({ success: false, error: 'This PDF is not on any job: ' + file }); return true; }
  if (!acc[div.toLowerCase()]) { res.status(403).json({ success: false, error: NO_RIGHT[div] + ' - this PDF is on an ' + div.toLowerCase() + ' job' }); return true; }
  return false;
}

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });
const q = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const who = (req) => (req.user && (req.user.username || req.user.email)) || 'user';
const parse = (v, d) => { if (v == null || v === '') return d; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return d; } };
const isIrn = (v) => /^\d{16}$/.test(String(v || '').trim());

// time the PDF was attached: archive names are <code>_<irn>_<ms>_<name>
function filedAt(fileUrl) {
  const m = /\/\d*[A-Z0-9]*_[^_/]*_(\d{13})_/i.exec(String(fileUrl || ''));
  return m ? new Date(+m[1]).toISOString() : null;
}
function pendingRows(list, base) {
  const out = [];
  (Array.isArray(list) ? list : []).forEach((d, i) => {
    if (!d || typeof d !== 'object' || !d.fileUrl || d.signedOnly || isIrn(d.irn)) return;
    if (!A.URL_RX.test(String(d.fileUrl))) return;
    if (!/\.pdf$/i.test(String(d.fileUrl))) return;
    if (/_signed\.pdf$/i.test(String(d.fileUrl)) || /^signed_/i.test(String(d.fileName || ''))) return;
    if (A.signedOf(d.fileUrl)) return;
    const file = path.join(A.ROOT, ...String(d.fileUrl).replace('/uploads/esanchit_archive/', '').split('/'));
    if (!fs.existsSync(file)) return;
    out.push({
      ...base, kind: 'ESANCHIT_PDF', key: d.fileUrl, fileUrl: d.fileUrl,
      fileName: d.fileName || path.basename(d.fileUrl), docCode: d.docCode || '',
      docFor: d.docFor === 'INVOICE' ? 'Invoice ' + (d.invSrNo || '') : d.docFor === 'ITEM' && (d.invSrNo || d.itemSrNo) ? `Item ${d.invSrNo || ''}/${d.itemSrNo || ''}` : (base.docFor || (d.docFor === 'ITEM' ? 'Item' : 'BE')),
      issuer: d.issuerName || '', size: (() => { try { return fs.statSync(file).size; } catch (e) { return 0; } })(),
      attachedAt: filedAt(d.fileUrl),
    });
  });
  return out;
}

router.get('/queue', async (req, res) => {
  try {
    const acc = await access(req);
    const items = [];
    // import: BE-level rows (extendedData.esanchitDocs) and item rows (ImportItems.extendedData.docsData)
    for (const j of acc.import ? await q("SELECT id, jobNo, nameOfImporter, branchCode, extendedData FROM ImportJobs WHERE extendedData LIKE '%esanchit_archive%'") : []) {
      const ext = parse(j.extendedData, {});
      items.push(...pendingRows(parse(ext.esanchitDocs, []), { module: 'Import', jobId: j.id, jobNo: j.jobNo, party: j.nameOfImporter || '', branch: j.branchCode || '' }));
    }
    for (const it of acc.import ? await q(`SELECT i.importJobId AS jobId, i.invSrNo, i.itemSrNo, i.extendedData, j.jobNo, j.nameOfImporter, j.branchCode
        FROM ImportItems i JOIN ImportJobs j ON j.id = i.importJobId WHERE i.extendedData LIKE '%esanchit_archive%'`) : []) {
      const ext = parse(it.extendedData, {});
      items.push(...pendingRows(parse(ext.docsData, []), { module: 'Import', jobId: it.jobId, jobNo: it.jobNo, party: it.nameOfImporter || '', branch: it.branchCode || '', docFor: it.invSrNo || it.itemSrNo ? `Item ${it.invSrNo || ''}/${it.itemSrNo || ''}` : 'Item' }));
    }
    // export: job rows (ExportJobs.eSanchitList) and item rows (ExportItems.eSanchitList)
    for (const j of acc.export ? await q("SELECT id, jobNo, shipperName, eSanchitList FROM ExportJobs WHERE eSanchitList LIKE '%esanchit_archive%'") : []) {
      items.push(...pendingRows(parse(j.eSanchitList, []), { module: 'Export', jobId: j.id, jobNo: j.jobNo, party: j.shipperName || '', docFor: 'SB' }));
    }
    for (const it of acc.export ? await q(`SELECT i.exportJobId AS jobId, i.invSr, i.itemSr, i.eSanchitList, j.jobNo, j.shipperName
        FROM ExportItems i JOIN ExportJobs j ON j.id = i.exportJobId WHERE i.eSanchitList LIKE '%esanchit_archive%'`) : []) {
      items.push(...pendingRows(parse(it.eSanchitList, []), { module: 'Export', jobId: it.jobId, jobNo: it.jobNo, party: it.shipperName || '', docFor: `Item ${it.invSr || ''}/${it.itemSr || ''}` }));
    }
    // the same PDF can sit on a job row and an item row (copied): once
    const seen = new Set(); const esanchit = items.filter(x => (seen.has(x.key) ? false : seen.add(x.key)));
    // BE amendment files made and not signed
    let amend = [];
    if (acc.import) try {
      amend = (await q(`SELECT id, amendNo, parentJobNo, beNo, beDate, fileName, codes, status, fileMadeAt FROM BeAmendments
          WHERE fileText IS NOT NULL AND (signedFileB64 IS NULL OR signedFileB64 = '') AND status IN ('Ready', 'Rejected') ORDER BY id DESC`))
        .map(a => ({ kind: 'BE_AMEND', key: 'amend:' + a.id, id: a.id, module: 'BE amendment', jobNo: a.parentJobNo || '', amendNo: a.amendNo,
          beNo: a.beNo || '', beDate: a.beDate || '', fileName: (a.fileName || String(a.amendNo)) + '', codes: parse(a.codes, []), status: a.status, fileMadeAt: a.fileMadeAt }));
    } catch (e) { amend = []; }
    esanchit.sort((a, b) => String(b.attachedAt || '').localeCompare(String(a.attachedAt || '')));
    res.json({ success: true, user: who(req), at: new Date().toISOString(), access: acc, esanchit, amendments: amend });
  } catch (e) {
    console.error('[signer queue]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// the signed copy of an archived PDF
router.post('/esanchit', upload.single('pdf'), async (req, res) => {
  try {
    const fileUrl = String((req.body || {}).fileUrl || '');
    const m = A.URL_RX.exec(fileUrl);
    if (!m || !A.safeFile(m[2])) return res.status(400).json({ success: false, error: 'Not an e-Sanchit PDF of EagleView: ' + fileUrl });
    const dir = path.join(A.ROOT, m[1]);
    if (!fs.existsSync(path.join(dir, m[2]))) return res.status(404).json({ success: false, error: 'The original PDF is no longer there: ' + m[2] });
    if (await refuseFile(req, res, m[1], m[2])) return;
    if (!req.file || !req.file.buffer || req.file.buffer.slice(0, 1024).indexOf('%PDF') < 0) return res.status(400).json({ success: false, error: 'No signed PDF received' });
    if (A.signedOf(fileUrl)) return res.status(409).json({ success: false, error: 'This PDF was already signed', ...A.signedOf(fileUrl) });
    const signedFile = m[2].replace(/\.pdf$/i, '') + '_signed.pdf';
    fs.writeFileSync(path.join(dir, signedFile), req.file.buffer);
    const info = { signer: String((req.body || {}).signer || '').slice(0, 200), by: who(req), at: new Date().toISOString(), size: req.file.buffer.length };
    A.noteSigned(fileUrl, signedFile, info);
    console.log(`[signer] ${m[1]}/${m[2]} signed by ${info.signer || '?'} (EagleView user ${info.by})`);
    res.json({ success: true, fileUrl: '/uploads/esanchit_archive/' + m[1] + '/' + signedFile, fileName: signedFile, ...info,
      over2mb: req.file.buffer.length > 2 * 1024 * 1024 });
  } catch (e) {
    console.error('[signer esanchit]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// BE amendment file to sign, and its signature back (same rules as /api/be-amendments/:id/sign)
const OPEN = ['Draft', 'Ready', 'Rejected'];
router.get('/amend/:id', async (req, res) => {
  try {
    if (!(await access(req)).import) return res.status(403).json({ success: false, error: NO_RIGHT.Import + ' - BE amendments are import' });
    const r = (await q('SELECT id, amendNo, fileName, fileText, status, fileMadeAt FROM BeAmendments WHERE id = ?', [req.params.id]))[0];
    if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' });
    if (!r.fileText) return res.status(400).json({ success: false, error: 'Make the file first' });
    if (!OPEN.includes(r.status)) return res.status(409).json({ success: false, error: `Amendment ${r.amendNo} is ${r.status}` });
    res.json({ success: true, id: r.id, amendNo: r.amendNo, fileName: r.fileName, fileMadeAt: r.fileMadeAt, data_b64: Buffer.from(r.fileText, 'latin1').toString('base64') });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.post('/amend/:id', async (req, res) => {
  try {
    if (!(await access(req)).import) return res.status(403).json({ success: false, error: NO_RIGHT.Import + ' - BE amendments are import' });
    const b = req.body || {};
    const r = (await q('SELECT id, amendNo, fileText, status, fileMadeAt FROM BeAmendments WHERE id = ?', [req.params.id]))[0];
    if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' });
    if (!OPEN.includes(r.status)) return res.status(409).json({ success: false, error: `Amendment ${r.amendNo} is ${r.status} - its file is not signed again` });
    if (!r.fileText) return res.status(400).json({ success: false, error: 'Make the file first' });
    if (b.fileMadeAt && String(b.fileMadeAt) !== String(r.fileMadeAt)) return res.status(409).json({ success: false, error: `The file of amendment ${r.amendNo} was made again after it was opened for signing - refresh the list and sign the new file` });
    const sig = String(b.signed_b64 || '');
    if (!/^[A-Za-z0-9+/=]{200,}$/.test(sig)) return res.status(400).json({ success: false, error: 'No signed file received' });
    // the signed envelope must carry exactly this file
    if (Buffer.from(sig, 'base64').indexOf(Buffer.from(r.fileText, 'latin1')) < 0) return res.status(400).json({ success: false, error: 'The signed file does not contain this amendment file' });
    const now = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
    await sequelize.query('UPDATE BeAmendments SET signedFileB64 = ?, signedAt = ?, signer = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
      { replacements: [sig, now, String(b.signer_cn || '').slice(0, 200), who(req), now, r.id] });
    console.log(`[signer] BE amendment ${r.amendNo} signed by ${b.signer_cn || '?'} (EagleView user ${who(req)})`);
    res.json({ success: true, amendNo: r.amendNo });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ---------------------------------------------------------------------------------------------------------------------
// e-Sanchit upload from EagleView Signer (16-Nov-2026): the tool opens ICEGATE e-Sanchit in its own window (the user logs
// in himself), puts a job's signed PDFs in (5 per DRN), fills the details of each document, the user checks and presses
// Submit on ICEGATE, and the IRNs read from the ICEGATE page come back here.
const pick = (...v) => { for (const x of v) if (x != null && String(x).trim() !== '') return String(x).trim(); return ''; };
const ymdOf = (v) => { const t = String(v || '').trim(); if (!t) return ''; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t); if (m) return m[0];
  const n = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t); if (n) return `${n[3]}-${n[2].padStart(2, '0')}-${n[1].padStart(2, '0')}`; const d = new Date(t); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
const isSignedUrl = (d) => /_signed\.pdf$/i.test(String(d.fileUrl || '')) || /^signed_/i.test(path.basename(String(d.fileUrl || '')));
let docNames = { at: 0, map: {} };
async function docNameMap() {
  if (Date.now() - docNames.at < 10 * 60 * 1000) return docNames.map;
  const map = {};
  try { for (const r of await q('SELECT documentCode, description FROM ESanchits')) map[String(r.documentCode)] = r.description || ''; } catch (e) { /* no master */ }
  docNames = { at: Date.now(), map };
  return map;
}
function portalNameOf(jobNo, code, url, used) {
  const base = path.basename(String(url));
  const tail = (/_(\d{13})_/.exec(base) || [])[1];
  const clean = (t) => String(t || '').replace(/[^A-Za-z0-9-]+/g, '_').replace(/^_+|_+$/g, '');
  let name = [clean(jobNo).slice(0, 20) || 'JOB', clean(code).slice(0, 6) || 'DOC', tail ? tail.slice(-7) : String(Date.now()).slice(-7)].join('_');
  let n = name, i = 2; while (used.has(n.toLowerCase())) n = name + '_' + (i++);
  used.add(n.toLowerCase());
  return n + '.pdf';
}
function uploadRows(list, base, names, out) {
  (Array.isArray(list) ? list : []).forEach((d0) => {
    if (!d0 || typeof d0 !== 'object' || !d0.fileUrl || isIrn(d0.irn)) return;
    if (!A.URL_RX.test(String(d0.fileUrl)) || !/\.pdf$/i.test(String(d0.fileUrl))) return;
    // the signed copy (a row not saved since the tool signed it still points at the original)
    // 17-Nov-2026: the signed copy noted in _signed.json first - a PDF that came already signed (HAWB_signed.pdf) has
    // "_signed" in its own name too, and its copy noted at signing is the one the tool and the job screen point at
    let url = String(d0.fileUrl), signer = d0.signedBy || '', signedAt = d0.signedAt || '';
    const s0 = A.signedOf(url);
    if (s0) { url = s0.url; signer = s0.signer || signer; signedAt = s0.at || signedAt; } else if (!isSignedUrl(d0)) return;
    if (A.irnOf(url)) return;
    const m = A.URL_RX.exec(url); if (!m || !A.safeFile(m[2])) return;
    const file = path.join(A.ROOT, m[1], m[2]);
    let size = 0; try { size = fs.statSync(file).size; } catch (e) { return; }
    const g = d0._icegate || {};
    const doc = {
      key: url, fileUrl: url, fileName: m[2], size, signer, signedAt,
      docCode: pick(d0.docCode), docName: pick(d0.docName, names[pick(d0.docCode)]),
      docFor: d0.docFor === 'INVOICE' ? 'Invoice ' + (d0.invSrNo || '') : (d0.docFor === 'ITEM' || d0.docFor === 'Item') && (d0.invSrNo || d0.itemSrNo) ? `Item ${d0.invSrNo || ''}/${d0.itemSrNo || ''}` : (base.docFor || 'Item'),
      issuer: { code: pick(d0.issuerCode, g.documentIssuingPartyCode), name: pick(d0.issuerName, d0.issuingParty, g.documentIssuingPartyName),
        addr1: pick(d0.issuerAddr1, d0.issuerAddress1, d0.issuerAddress, g.documentIssuingPartyNameAddress1), addr2: pick(d0.issuerAddr2, d0.issuerAddress2, g.documentIssuingPartyNameAddress2),
        city: pick(d0.issuerCity, g.documentIssuingPartyNameCity), pin: pick(d0.issuerPin, g.documentIssuingPartyNamePin) },
      bene: { code: pick(d0.beneCode, d0.beneficiaryCode, g.documentBeneficiaryPartyCode), name: pick(d0.beneName, d0.beneficiaryName, d0.beneficiaryParty, g.documentBeneficiaryPartyName),
        addr1: pick(d0.beneAddr1, d0.beneficiaryAddress1, g.documentBeneficiaryPartyNameAddress1), addr2: pick(d0.beneAddr2, d0.beneficiaryAddress2, g.documentBeneficiaryPartyNameAddress2),
        city: pick(d0.beneCity, d0.beneficiaryCity, g.documentBeneficiaryPartyNameCity), pin: pick(d0.benePin, d0.beneficiaryPin, g.documentBeneficiaryPartyNamePin) },
      placeOfIssue: pick(d0.placeOfIssue, d0.issueLocation, g.placeOfIssue), issueDate: ymdOf(pick(d0.issueDate, d0.date, g.documentIssueDate)),
      expiryDate: ymdOf(pick(d0.expiryDate, g.documentExpiryDate)),
      otherId: !!(d0.isDiffId || d0.icegateDifferent), icegateId: (d0.isDiffId || d0.icegateDifferent) ? pick(d0.icegateId) : '',
    };
    const p = [];
    if (!doc.docCode) p.push('document code');
    if (!doc.issuer.name) p.push('issuing party name');
    if (!doc.placeOfIssue) p.push('place of issue');
    if (!doc.issueDate) p.push('issue date');
    if (!doc.bene.name) p.push('beneficiary name');
    if (doc.otherId && !doc.icegateId) p.push('ICEGATE ID (marked different)');
    doc.missing = p;
    if (size > 2 * 1024 * 1024) doc.tooBig = true;
    out.push({ ...base, doc });
  });
}

router.get('/upload-queue', async (req, res) => {
  try {
    const acc = await access(req);
    const names = await docNameMap();
    const rows = [];
    for (const j of acc.import ? await q("SELECT id, jobNo, beNo, beDate, nameOfImporter, branchCode, extendedData FROM ImportJobs WHERE extendedData LIKE '%esanchit_archive%'") : []) {
      const ext = parse(j.extendedData, {});
      uploadRows(parse(ext.esanchitDocs, []), { module: 'Import', jobId: j.id, jobNo: j.jobNo, party: j.nameOfImporter || '', branch: j.branchCode || '', docFor: 'BE' }, names, rows);
    }
    for (const it of acc.import ? await q(`SELECT i.importJobId AS jobId, i.invSrNo, i.itemSrNo, i.extendedData, j.jobNo, j.nameOfImporter, j.branchCode
        FROM ImportItems i JOIN ImportJobs j ON j.id = i.importJobId WHERE i.extendedData LIKE '%esanchit_archive%'`) : []) {
      const ext = parse(it.extendedData, {});
      uploadRows(parse(ext.docsData, []), { module: 'Import', jobId: it.jobId, jobNo: it.jobNo, party: it.nameOfImporter || '', branch: it.branchCode || '', docFor: it.invSrNo || it.itemSrNo ? `Item ${it.invSrNo || ''}/${it.itemSrNo || ''}` : 'Item' }, names, rows);
    }
    for (const j of acc.export ? await q("SELECT id, jobNo, shipperName, eSanchitList FROM ExportJobs WHERE eSanchitList LIKE '%esanchit_archive%'") : []) {
      uploadRows(parse(j.eSanchitList, []), { module: 'Export', jobId: j.id, jobNo: j.jobNo, party: j.shipperName || '', branch: '', docFor: 'SB' }, names, rows);
    }
    for (const it of acc.export ? await q(`SELECT i.exportJobId AS jobId, i.invSr, i.itemSr, i.eSanchitList, j.jobNo, j.shipperName
        FROM ExportItems i JOIN ExportJobs j ON j.id = i.exportJobId WHERE i.eSanchitList LIKE '%esanchit_archive%'`) : []) {
      uploadRows(parse(it.eSanchitList, []), { module: 'Export', jobId: it.jobId, jobNo: it.jobNo, party: it.shipperName || '', branch: '', docFor: `Item ${it.invSr || ''}/${it.itemSr || ''}` }, names, rows);
    }
    const jobs = new Map(); const seen = new Set();
    for (const r of rows) {
      if (seen.has(r.doc.key)) continue; seen.add(r.doc.key);
      const k = r.module + ':' + r.jobId;
      if (!jobs.has(k)) jobs.set(k, { key: k, module: r.module, jobId: r.jobId, jobNo: r.jobNo, party: r.party, branch: r.branch, docs: [], used: new Set() });
      jobs.get(k).docs.push(r.doc);
    }
    const out = [...jobs.values()].map(j => {
      j.docs.sort((a, b) => String(filedAt(a.fileUrl) || '').localeCompare(String(filedAt(b.fileUrl) || '')));
      j.docs.forEach(d => { d.portalName = portalNameOf(j.jobNo, d.docCode, d.fileUrl, j.used); });
      delete j.used;
      j.latest = j.docs.reduce((m, d) => (String(d.signedAt || '') > m ? String(d.signedAt || '') : m), '');
      return j;
    }).sort((a, b) => b.latest.localeCompare(a.latest));
    res.json({ success: true, user: who(req), at: new Date().toISOString(), access: acc, jobs: out });
  } catch (e) {
    console.error('[signer upload-queue]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// a 16-digit e-Sanchit number starts with the date it was given (YYYYMMDD)
function numDateOk(n) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(n); if (!m) return false;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  if (isNaN(d) || d.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}`) return false;
  return d.getTime() <= Date.now() + 2 * 86400000 && d.getTime() >= Date.now() - 400 * 86400000;
}
router.post('/irn', async (req, res) => {
  try {
    const b = req.body || {};
    const fileUrl = String(b.fileUrl || '');
    const irn = String(b.irn || '').replace(/\s/g, ''); const drn = String(b.drn || '').replace(/\s/g, '');
    const m = A.URL_RX.exec(fileUrl);
    if (!m || !A.safeFile(m[2])) return res.status(400).json({ success: false, error: 'Not an e-Sanchit PDF of EagleView: ' + fileUrl });
    if (!fs.existsSync(path.join(A.ROOT, m[1], m[2]))) return res.status(404).json({ success: false, error: 'The PDF is no longer there: ' + m[2] });
    if (await refuseFile(req, res, m[1], m[2])) return;
    if (!isIrn(irn) || !numDateOk(irn)) return res.status(400).json({ success: false, error: 'IRN should be the 16-digit number from e-Sanchit (it starts with the date, YYYYMMDD): ' + irn });
    if (drn && (!isIrn(drn) || !numDateOk(drn))) return res.status(400).json({ success: false, error: 'DRN should be 16 digits: ' + drn });
    const had = A.irnOf(fileUrl);
    if (had && had.irn === irn) return res.json({ success: true, already: true, irn, drn: had.drn || drn });
    if (had) return res.status(409).json({ success: false, error: `This PDF already has IRN ${had.irn}` });
    const used = A.irnUsed(irn);
    if (used) return res.status(409).json({ success: false, error: `IRN ${irn} is already noted for ${used.dir}/${used.file}` });
    const info = { irn, drn: isIrn(drn) ? drn : '', by: who(req), at: new Date().toISOString(),
      icegateId: String(b.icegateId || '').slice(0, 40), portalName: String(b.portalName || '').slice(0, 120), via: String(b.via || 'EagleView Signer').slice(0, 40) };
    A.noteIrn(fileUrl, info);
    console.log(`[signer] ${m[1]}/${m[2]} -> e-Sanchit IRN ${irn}${info.drn ? ' DRN ' + info.drn : ''} (EagleView user ${info.by})`);
    res.json({ success: true, irn, drn: info.drn, at: info.at });
  } catch (e) {
    console.error('[signer irn]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Add a document to a job from EagleView Signer (17-Nov-2026): the operator picks a PDF on his PC, finds the job, fills
// the document details; the PDF goes into the job's e-Sanchit archive folder and its row into the job's e-Sanchit list
// (import: BE level esanchitDocs, export: SB level eSanchitList). Then it is signed / uploaded like any other.
const up = (v, n) => String(v == null ? '' : v).trim().toUpperCase().slice(0, n);
const ymdOnly = (v) => { const t = ymdOf(v); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''; };
// 17-Nov-2026: city of the supplier. Address 3 is the city as a rule ("UNNA", "KOWLOON,"); when it holds only the country
// ("UNITED STATES") or nothing, the city is the last word before the comma of address 2 ("UNIT 111 ATLANTA, GA"), else blank
const cleanPart = (t) => String(t == null ? '' : t).replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '').trim().toUpperCase();
function supplierCity(a2, a3, ...countries) {
  const c3 = cleanPart(a3); const cs = countries.map(cleanPart).filter(Boolean);
  if (c3 && !cs.includes(c3)) return c3.slice(0, 35);
  const m = /([A-Z][A-Z .'-]{2,})\s*,[^,]*$/i.exec(String(a2 || ''));
  const w = m ? m[1].trim().split(/\s+/).pop() : '';
  return /^[A-Z]{3,}$/i.test(w) && !cs.includes(w.toUpperCase()) ? w.toUpperCase() : '';
}
// the date of the HAWB / MAWB of an import job (columns, else the first IGM row)
function transportDates(j) {
  let rows = []; try { rows = JSON.parse(j._igmRows || '[]') || []; } catch (e) { rows = []; }
  const r0 = (Array.isArray(rows) ? rows : []).find(r => r && (r.hawbDate || r.mawbDate)) || {};
  return { house: ymdOnly(j.hawbDate) || ymdOnly(r0.hawbDate), master: ymdOnly(j.mawbDate) || ymdOnly(r0.mawbDate) };
}
router.get('/jobs', async (req, res) => {
  try {
    const acc = await access(req);
    const mod = String(req.query.module || '') === 'Export' ? 'Export' : 'Import';
    if (!acc[mod.toLowerCase()]) return res.status(403).json({ success: false, error: NO_RIGHT[mod] });
    const text = String(req.query.q || '').trim().slice(0, 40);
    const like = '%' + text.replace(/[%_]/g, (c) => '\\' + c) + '%';
    let rows;
    if (mod === 'Import') {
      rows = (await q(`SELECT id, jobNo, nameOfImporter, iecCode, address1, address2, autoField_6, autoField_7, autoField_8, autoField_10, branchCode, beNo, beNumber, beDate, status, hawbDate, mawbDate, _igmRows
          FROM ImportJobs WHERE jobNo IS NOT NULL AND jobNo <> 'DRAFT' ${text ? "AND (jobNo LIKE ? ESCAPE '\\' OR nameOfImporter LIKE ? ESCAPE '\\' OR beNo LIKE ? ESCAPE '\\' OR beNumber LIKE ? ESCAPE '\\')" : ''}
          ORDER BY id DESC LIMIT 25`, text ? [like, like, like, like] : []))
        .map(j => ({ module: 'Import', jobId: j.id, jobNo: j.jobNo, party: j.nameOfImporter || '', branch: j.branchCode || '', no: j.beNo || j.beNumber || '', date: j.beDate || '', status: j.status || '',
          bene: { code: up(j.iecCode, 15), name: up(j.nameOfImporter, 70), addr1: up(j.autoField_6 || j.address1, 70), addr2: up(j.autoField_7 || j.address2, 70), city: up(j.autoField_8, 35), pin: up(j.autoField_10, 10) }, place: '',
          docDates: transportDates(j) }));
    } else {
      rows = (await q(`SELECT id, jobNo, shipperName, shipperIec, shipperAddress1, shipperAddress2, shipperCity, shipperPin, branchCode, sbNo, sbDate, status
          FROM ExportJobs WHERE jobNo IS NOT NULL AND jobNo <> 'DRAFT' ${text ? "AND (jobNo LIKE ? ESCAPE '\\' OR shipperName LIKE ? ESCAPE '\\' OR sbNo LIKE ? ESCAPE '\\')" : ''}
          ORDER BY id DESC LIMIT 25`, text ? [like, like, like] : []))
        .map(j => ({ module: 'Export', jobId: j.id, jobNo: j.jobNo, party: j.shipperName || '', branch: j.branchCode || '', no: j.sbNo || '', date: j.sbDate || '', status: j.status || '',
          bene: { code: up(j.shipperIec, 15), name: up(j.shipperName, 70), addr1: up(j.shipperAddress1, 70), addr2: up(j.shipperAddress2, 70), city: up(j.shipperCity, 35), pin: up(j.shipperPin, 10) }, place: up(j.shipperCity, 35) }));
    }
    // 17-Nov-2026: issuing party from the job, as the job screen's "Supplier" button: import = supplier of each invoice
    // (place of issue = his country), export = the exporter himself (place = his city); issue date = invoice date
    if (rows.length) {
      const ids = rows.map(r => r.jobId);
      const marks = ids.map(() => '?').join(',');
      let countries = {};
      try { for (const c of await q('SELECT code, name FROM Countries')) countries[String(c.code || '').toUpperCase()] = String(c.name || '').toUpperCase(); } catch (e) { countries = {}; }
      const country = (v) => { const t = String(v || '').trim().toUpperCase(); return countries[t] || t; };
      const invs = {};
      if (mod === 'Import') {
        for (const i of await q(`SELECT importJobId AS jobId, id, invSrNo, invoiceNo, invoiceDate, supplierName, supplierAddress1, supplierAddress2, supplierAddress3, supplierPin, supplierCountry, supplierCountryName
            FROM ImportInvoices WHERE importJobId IN (${marks}) ORDER BY importJobId, id`, ids)) (invs[i.jobId] = invs[i.jobId] || []).push(i);
        rows.forEach(r => {
          r.issuers = (invs[r.jobId] || []).filter(i => String(i.supplierName || '').trim()).map((i, n) => ({
            label: `Invoice ${i.invSrNo || n + 1}${i.invoiceNo ? ' - ' + i.invoiceNo : ''}`, name: up(i.supplierName, 70), addr1: up(i.supplierAddress1, 70), addr2: up(i.supplierAddress2, 70),
            city: supplierCity(i.supplierAddress2, i.supplierAddress3, i.supplierCountryName, i.supplierCountry, country(i.supplierCountryName || i.supplierCountry)), pin: up(i.supplierPin, 10), place: up(country(i.supplierCountryName || i.supplierCountry), 35), date: ymdOnly(i.invoiceDate) }));
        });
      } else {
        for (const i of await q(`SELECT exportJobId AS jobId, id, invoiceNo, invoiceDate FROM ExportInvoices WHERE exportJobId IN (${marks}) ORDER BY exportJobId, id`, ids)) (invs[i.jobId] = invs[i.jobId] || []).push(i);
        rows.forEach(r => {
          const b = r.bene; const list = invs[r.jobId] || [];
          r.issuers = (list.length ? list : [{}]).map((i, n) => ({ label: list.length ? `Exporter - invoice ${n + 1}${i.invoiceNo ? ' ' + i.invoiceNo : ''}` : 'Exporter',
            name: b.name, code: b.code, addr1: b.addr1, addr2: b.addr2, city: b.city, pin: b.pin, place: r.place, date: ymdOnly(i.invoiceDate) }));
        });
      }
    }
    res.json({ success: true, module: mod, jobs: rows });
  } catch (e) {
    console.error('[signer jobs]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});
router.get('/doc-codes', async (req, res) => {
  try {
    const map = await docNameMap();
    res.json({ success: true, codes: Object.entries(map).map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
router.post('/add-doc', upload.single('pdf'), async (req, res) => {
  try {
    const b = req.body || {};
    const mod = String(b.module || '') === 'Export' ? 'Export' : 'Import';
    const acc = await access(req);
    if (!acc[mod.toLowerCase()]) return res.status(403).json({ success: false, error: NO_RIGHT[mod] });
    if (!req.file || !req.file.buffer || req.file.buffer.slice(0, 5).toString('latin1') !== '%PDF-') return res.status(400).json({ success: false, error: 'Choose a PDF file (e-Sanchit takes PDF only)' });
    const r = parse(b.row, {}) || {};
    const code = String(r.docCode || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return res.status(400).json({ success: false, error: 'Choose the document code (6 characters)' });
    const names = await docNameMap();
    if (Object.keys(names).length && !names[code]) return res.status(400).json({ success: false, error: `Document code ${code} is not in the e-Sanchit master` });
    // 17-Nov-2026: the tool's form is now the job screen's e-Sanchit form - IRN / DRN (a document already on e-Sanchit),
    // Doc. for (import: BE / invoice / item) and Doc. Ref. No. (export) come with the row
    const irn = String(r.irn || '').replace(/\s+/g, '');
    if (irn && !/^\d{16}$/.test(irn)) return res.status(400).json({ success: false, error: 'IRN must be 16 digits (or empty)' });
    const drn = String(r.drn || '').trim().toUpperCase().slice(0, 35);
    let docFor = 'HEADER', invSrNo = '', itemSrNo = '';
    if (mod === 'Import') {
      docFor = ['HEADER', 'INVOICE', 'ITEM'].includes(String(r.docFor || '').toUpperCase()) ? String(r.docFor).toUpperCase() : 'HEADER';
      invSrNo = docFor === 'HEADER' ? '' : String(r.invSrNo || '').replace(/\D/g, '').slice(0, 4);
      itemSrNo = docFor === 'ITEM' ? String(r.itemSrNo || '').replace(/\D/g, '').slice(0, 4) : '';
      if (docFor !== 'HEADER' && !invSrNo) return res.status(400).json({ success: false, error: 'Choose the invoice the document is for' });
      if (docFor === 'ITEM' && !itemSrNo) return res.status(400).json({ success: false, error: 'Type the item sr no the document is for' });
    }
    const table = mod === 'Import' ? 'ImportJobs' : 'ExportJobs';
    const job = (await q(`SELECT id, jobNo, ${mod === 'Import' ? 'extendedData' : 'eSanchitList'} AS list FROM ${table} WHERE id = ?`, [b.jobId]))[0];
    if (!job || !job.jobNo || job.jobNo === 'DRAFT') return res.status(404).json({ success: false, error: 'Job not found' });
    // the PDF next to the job's other e-Sanchit PDFs: <code>_noirn_<time>_<name>.pdf
    const dir = A.safeName(job.jobNo, 'misc');
    // 17-Nov-2026: "_signed" / "signed_" taken off the name - the archive takes those names for the signed copy only
    const orig = A.safeName(path.basename(String(req.file.originalname || 'document.pdf')).replace(/\.pdf$/i, '')
      .replace(/([_ -]+signed)+$/i, '').replace(/^(signed[_ -]+)+/i, ''), 'document');
    const file = `${code}_noirn_${Date.now()}_${orig}.pdf`;
    fs.mkdirSync(path.join(A.ROOT, dir), { recursive: true });
    fs.writeFileSync(path.join(A.ROOT, dir, file), req.file.buffer);
    const fileUrl = '/uploads/esanchit_archive/' + dir + '/' + file;
    const is = r.issuer || {}, be = r.bene || {};
    const common = { irn, drn, docCode: code, docName: names[code] || String(r.docName || '').slice(0, 120), fileName: file, fileUrl, fileType: 'PDF',
      issuerCode: up(is.code, 15), issuerName: up(is.name, 70), issuerCity: up(is.city, 35), issuerPin: up(is.pin, 10),
      placeOfIssue: up(r.placeOfIssue, 35), issueDate: ymdOnly(r.issueDate), expiryDate: ymdOnly(r.expiryDate), icegateId: r.otherId ? up(r.icegateId, 25) : '',
      addedBy: who(req), addedAt: new Date().toISOString(), addedVia: 'EagleView Signer' };
    const row = mod === 'Import'
      ? { id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...common, docFor, invSrNo, itemSrNo, issuerAddr1: up(is.addr1, 70), issuerAddr2: up(is.addr2, 70),
          beneCode: up(be.code, 15), beneName: up(be.name, 70), beneAddr1: up(be.addr1, 70), beneAddr2: up(be.addr2, 70), beneCity: up(be.city, 35), benePin: up(be.pin, 10), isDiffId: !!r.otherId, isApplicable: false }
      : { ...common, refNo: up(r.refNo, 35), docFor: 'SB', issuerAddress1: up(is.addr1, 70), issuerAddress2: up(is.addr2, 70),
          beneficiaryCode: up(be.code, 15), beneficiaryName: up(be.name, 70), beneficiaryAddress1: up(be.addr1, 70), beneficiaryAddress2: up(be.addr2, 70), beneficiaryCity: up(be.city, 35), beneficiaryPin: up(be.pin, 10), icegateDifferent: !!r.otherId };
    const now = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
    if (mod === 'Import') {
      const ext = parse(job.list, {}) || {};
      const asText = typeof ext.esanchitDocs === 'string';
      const list = parse(ext.esanchitDocs, []) || [];
      list.push(row);
      ext.esanchitDocs = asText ? JSON.stringify(list) : list;
      await sequelize.query('UPDATE ImportJobs SET extendedData = ?, updatedAt = ?, updatedBy = ? WHERE id = ?', { replacements: [JSON.stringify(ext), now, who(req), job.id] });
    } else {
      const list = parse(job.list, []) || [];
      list.push(row);
      await sequelize.query('UPDATE ExportJobs SET eSanchitList = ?, updatedAt = ? WHERE id = ?', { replacements: [JSON.stringify(list), now, job.id] });
    }
    A.noteAdded(fileUrl, row, who(req));   // a job screen opened before this cannot drop it (utils/esanchitArchive mergeAdded)
    console.log(`[signer] ${mod} job ${job.jobNo}: e-Sanchit document ${code} added from EagleView Signer (${file}, user ${who(req)})`);
    res.json({ success: true, module: mod, jobNo: job.jobNo, fileUrl, fileName: file, docCode: code, irn, docFor, size: req.file.buffer.length,
      over2mb: req.file.buffer.length > 2 * 1024 * 1024 });
  } catch (e) {
    console.error('[signer add-doc]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// the job's BE / SB level e-Sanchit rows as the job screen shows them (signed copy, IRN / DRN) - for the tool's Job
// folder page, which matches them with the PDFs in D:\JOBS\<job no> (17-Nov-2026)
router.get('/job-docs', async (req, res) => {
  try {
    const mod = String(req.query.module || '') === 'Export' ? 'Export' : 'Import';
    if (!(await access(req))[mod.toLowerCase()]) return res.status(403).json({ success: false, error: NO_RIGHT[mod] });
    const row = (await q(mod === 'Import' ? 'SELECT id, jobNo, extendedData AS list FROM ImportJobs WHERE id = ?' : 'SELECT id, jobNo, eSanchitList AS list FROM ExportJobs WHERE id = ?', [req.query.jobId]))[0];
    if (!row) return res.status(404).json({ success: false, error: 'Job not found' });
    let list = mod === 'Import' ? parse((parse(row.list, {}) || {}).esanchitDocs, []) : parse(row.list, []);
    // 17-Nov-2026: the row's own file kept (_raw) - the tool matches its folder PDFs by that original
    list = A.applyList(Array.isArray(list) ? list.map(d => (d && typeof d === 'object' ? { ...d, _raw: d.fileUrl } : d)) : []);
    const docs = (Array.isArray(list) ? list : []).filter(d => d && typeof d === 'object' && d.fileUrl).map(d => {
      const url = String(d.fileUrl);
      const moved = d.signedOnly && d._raw && String(d._raw) !== url;            // signed copy put on the row just now
      const signed = moved || (!A.signedOf(url) && (/_signed\.pdf$/i.test(url) || /^signed_/i.test(path.basename(url))));
      return { fileUrl: url, origUrl: moved ? String(d._raw) : signed ? url.replace(/_signed\.pdf$/i, '.pdf') : url, fileName: path.basename(url), docCode: d.docCode || '', irn: isIrn(d.irn) ? String(d.irn) : '',
        drn: isIrn(d.drn) ? String(d.drn) : '', signed, signer: d.signedBy || '', addedVia: d.addedVia || '' };
    });
    res.json({ success: true, module: mod, jobId: row.id, jobNo: row.jobNo, docs });
  } catch (e) {
    console.error('[signer job-docs]', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
