// /api/be-amendments - BE amendment register, the iCAFFE way (10-Nov-2026). See utils/beAmendment.js.
//   GET    /codes                    amendment codes
//   GET    /                         register (status=open|submitted|all, q, branch, from, to, limit)
//   GET    /by-job/:jobId            amendments of one BE job (or of the BE behind an amended job)
//   GET    /settings                 ICEGATE mail address, number series of the amendments
//   PUT    /settings                 (admin) ICEGATE mail address
//   GET    /:id                      one amendment
//   POST   /                         new amendment: takes the next number and copies the BE job -> amended job
//   PUT    /:id                      request letter / codes / reason / ICEGATE user
//   GET    /:id/changes              what changed on the amended job (and the codes that follow)
//   POST   /:id/file                 make the .be file (kept on the amendment)
//   GET    /:id/file                 download: ?kind=unsigned (default) | signed
//   POST   /:id/sign                 sign the file with the DSC token (pin) -> signed file kept
//   POST   /:id/send                 send the signed file to ICEGATE by mail (Settings > Email SMTP)
//   POST   /:id/submitted            mark sent (after a manual upload on the ICEGATE portal)
//   POST   /:id/reply                ICEGATE reply: Accepted / Rejected + text
//   POST   /:id/void                 void (the amended job is voided too; the BE job is never touched)
const express = require('express');
const router = express.Router();
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');
const A = require('../utils/beAmendment');
const { requireAdmin } = require('../middleware/auth');

const q = (sql, p = [], t) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, transaction: t });
const x = (sql, p = [], t) => sequelize.query(sql, { replacements: p, transaction: t });
const who = (req) => (req.user && (req.user.username || req.user.email)) || '';
const now = () => new Date().toISOString();
// 14-Nov-2026: ImportJobs dates are read by Sequelize, which reads only 'YYYY-MM-DD HH:MM:SS.sss +00:00' (an ISO '...T...Z'
// came back as Invalid Date: the amended job had no created time)
const dbNow = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const fail = (res, e) => res.status(e.status || 500).json({ success: false, error: e.message, errors: e.errors });
// 14-Nov-2026: a Rejected amendment can be corrected again (codes, reason, file, void) - it was stuck before
const OPEN = ['Draft', 'Ready', 'Rejected'];

router.use(async (req, res, next) => { try { await A.ensure(); next(); } catch (e) { fail(res, e); } });

const row = async (id, t) => (await q('SELECT * FROM BeAmendments WHERE id = ?', [id], t))[0];
const pub = (r) => r && ({ ...r, codes: A.parseJ(r.codes, []), fileCodes: A.parseJ(r.fileCodes, []), fileText: undefined, signedFileB64: undefined, hasFile: !!r.fileText, hasSigned: !!r.signedFileB64 });
const mustBeOpen = (r) => { if (!r) throw Object.assign(new Error('Amendment not found'), { status: 404 }); if (!OPEN.includes(r.status)) throw Object.assign(new Error(`Amendment ${r.amendNo} is ${r.status} - it cannot be changed any more`), { status: 409 }); };

router.get('/codes', (req, res) => res.json({ success: true, data: A.CODES.map(c => ({ code: c.code, label: c.label, act: c.act, seenInIcaffe: A.SEEN_IN_ICAFFE.has(c.code) })) }));

router.get('/settings', async (req, res) => {
  try {
    const store = require('../utils/settingsStore');
    const st = await store.getMany(['ICEGATE_FILE_MAIL_TO', 'SMTP_USER']);
    const ns = require('../utils/numberSeries');
    const series = await q("SELECT branchCode, division, fyCode, format, nextNo, lastNo, lastDate, source FROM NumberSeries WHERE docType = 'BE_AMEND' AND coalesce(isActive, 1) = 1 ORDER BY branchCode, division, fyCode DESC");
    // 17-Nov-2026: + linkedChaCode, so the new-amendment window can pick the ID linked to the job's CHA
    const profiles = await q('SELECT id, profileName, loginId, isDefault, linkedChaCode FROM IcegateProfiles ORDER BY isDefault DESC, profileName')
      .catch(() => q('SELECT id, profileName, loginId, isDefault FROM IcegateProfiles ORDER BY isDefault DESC, profileName')).catch(() => []);
    res.json({ success: true, mailTo: st.ICEGATE_FILE_MAIL_TO || '', smtpUser: st.SMTP_USER || '', series, fy: ns.fyCodeOf(now()), profiles });
  } catch (e) { fail(res, e); }
});
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const to = String((req.body || {}).mailTo || '').trim();
    if (to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return res.status(400).json({ success: false, error: 'Not an e-mail address' });
    await require('../utils/settingsStore').setMany({ ICEGATE_FILE_MAIL_TO: to });
    res.json({ success: true, mailTo: to });
  } catch (e) { fail(res, e); }
});

// register
router.get('/', async (req, res) => {
  try {
    const p = req.query || {}; const where = []; const args = [];
    const st = String(p.status || 'open').toLowerCase();
    if (st === 'open') where.push("a.status IN ('Draft', 'Ready')");
    else if (st === 'submitted') where.push("a.status IN ('Submitted', 'Accepted', 'Rejected')");
    else if (st === 'void') where.push("a.status = 'Void'");
    else if (st !== 'all') where.push("a.status <> 'Void'");
    if (p.branch) { where.push('a.branchCode = ?'); args.push(String(p.branch).toUpperCase()); }
    if (p.from) { where.push('a.amendDate >= ?'); args.push(A.ymd(p.from)); }
    if (p.to) { where.push('a.amendDate <= ?'); args.push(A.ymd(p.to)); }
    if (String(p.q || '').trim()) {
      const t = '%' + String(p.q).trim().toLowerCase() + '%';
      where.push("(lower(a.amendNo) LIKE ? OR lower(coalesce(a.beNo, '')) LIKE ? OR lower(coalesce(a.parentJobNo, '')) LIKE ? OR lower(coalesce(j.nameOfImporter, j.autoField_4, '')) LIKE ? OR lower(coalesce(a.codes, '')) LIKE ? OR lower(coalesce(a.reqLetterNo, '')) LIKE ? OR lower(coalesce(a.reason, '')) LIKE ?)");
      args.push(t, t, t, t, t, t, t);
    }
    const limit = Math.min(2000, Math.max(1, Number(p.limit) || 200));
    const rows = await q(`SELECT a.*, coalesce(j.nameOfImporter, j.autoField_4, '') importer, j.mawbNo mawbNo, j.hawbNo hawbNo FROM BeAmendments a LEFT JOIN ImportJobs j ON j.id = a.importJobId
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.amendDate DESC, a.id DESC LIMIT ${limit}`, args);
    const counts = Object.fromEntries((await q('SELECT status, count(*) n FROM BeAmendments GROUP BY status')).map(r => [r.status, r.n]));
    res.json({ success: true, data: rows.map(pub), counts });
  } catch (e) { fail(res, e); }
});

router.get('/by-job/:jobId', async (req, res) => {
  try {
    const job = await A.loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    const parentId = job._amendOfJobId || job.id;
    const rows = await q('SELECT * FROM BeAmendments WHERE importJobId = ? ORDER BY amendDate DESC, id DESC', [parentId]);
    const parent = parentId === job.id ? job : await A.loadJob(parentId);
    res.json({ success: true, parent: parent && { id: parent.id, jobNo: parent.jobNo, beNo: parent.beNo || parent.beNumber || '', beDate: parent.beDate || '', icegateStatus: parent.icegateStatus || '' },
      current: job._amendmentId ? Number(job._amendmentId) : null, data: rows.map(pub) });
  } catch (e) { fail(res, e); }
});

router.get('/:id', async (req, res) => {
  try { const r = await row(req.params.id); if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' }); res.json({ success: true, data: pub(r) }); }
  catch (e) { fail(res, e); }
});

// new amendment: number + copy of the BE job, in one transaction
router.post('/', async (req, res) => {
  const b = req.body || {};
  const t = await sequelize.transaction();
  try {
    let parent = await A.loadJob(b.importJobId, t);
    if (!parent) throw Object.assign(new Error('BE job not found'), { status: 404 });
    if (A.isCopy(parent)) parent = await A.loadJob(parent._amendOfJobId, t); // asked from an amended job: the amendment belongs to its BE job
    if (!parent) throw Object.assign(new Error('BE job of this amended job not found'), { status: 404 });
    const beNo = String(b.beNo || parent.beNo || parent.beNumber || '').replace(/\D/g, '');
    const beDate = A.ymd(b.beDate || parent.beDate);
    const errs = [];
    if (!beNo) errs.push('BE No of the filed BE');
    if (!beDate) errs.push('BE Date');
    if (!String(b.reason || '').trim()) errs.push('Reason');
    const codes = (Array.isArray(b.codes) ? b.codes : []).map(c => String(c).toUpperCase()).filter(c => A.CODE[c]);
    if (errs.length) throw Object.assign(new Error('Fill in: ' + errs.join(', ')), { status: 400 });
    const branchCode = String(parent.branchCode || (await require('../utils/numberSeries').defaultBranch(t)) || '').toUpperCase();
    const division = A.divisionOf(parent);
    const amendDate = A.today();
    const ns = require('../utils/numberSeries');
    const amendNo = await ns.take('BE_AMEND', { branchCode, division, date: amendDate }, t);
    const fyCode = ns.fyCodeOf(amendDate);
    const by = who(req); const ts = now(); const tsDb = dbNow();

    // the amended job: a full copy of the BE job (header, invoices with items, containers), row for row in SQL so that
    // every column and extendedData is carried over as stored
    const cols = async (tb) => (await q(`PRAGMA table_info(${tb})`, [], t)).map(c => c.name).filter(n => n !== 'id');
    const lastId = async () => (await q('SELECT last_insert_rowid() id', [], t))[0].id;
    const qn = (c) => '"' + c + '"';
    const jc = await cols('ImportJobs'), ic = await cols('ImportInvoices'), tc = await cols('ImportItems'), cc = await cols('ImportContainers');
    // copied from the BE as it stands now: the last amendment of this BE that was sent (its amended job), else the BE job -
    // the same base the changes are read against, so a new amendment shows only its own changes
    const srcRow = (await q(`SELECT amendedJobId, amendNo FROM BeAmendments WHERE importJobId = ? AND status IN ('Submitted', 'Accepted') AND amendedJobId IS NOT NULL
      AND amendedJobId IN (SELECT id FROM ImportJobs) ORDER BY amendDate DESC, id DESC LIMIT 1`, [parent.id], t))[0];
    const srcId = srcRow ? srcRow.amendedJobId : parent.id;
    const ext = A.parseJ((await q('SELECT extendedData FROM ImportJobs WHERE id = ?', [srcId], t))[0].extendedData, {}) || {};
    const ins = await x(`INSERT INTO BeAmendments (importJobId, parentJobNo, amendNo, amendDate, branchCode, division, fyCode, beNo, beDate, reqLetterNo, reqLetterDate, codes, reason, status, icegateProfileId, source, createdBy, updatedBy, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [parent.id, parent.jobNo, amendNo, amendDate, branchCode, division, fyCode, beNo, beDate, String(b.reqLetterNo || '').trim(), A.ymd(b.reqLetterDate) || null,
      JSON.stringify(codes), String(b.reason || '').trim().toUpperCase(), 'Draft', b.icegateProfileId || null, 'EagleView', by, by, ts, ts], t);
    const amendId = await lastId();
    const copyNo = `AMD/${branchCode}/${division}/${amendNo}`;
    await x(`INSERT INTO ImportJobs (${jc.map(qn).join(', ')}) SELECT ${jc.map(c => c === 'jobNo' ? '?' : qn(c)).join(', ')} FROM ImportJobs WHERE id = ?`, [copyNo, srcId], t);
    const nj = { id: await lastId() };
    const over = {
      jobNo: copyNo, jobDate: amendDate, status: 'AMENDMENT', isAmended: 1,
      icegateStatus: null, icegateUniqueId: null, icegateAck: null, icegateAckAt: null, filedJson: null, filedAt: null, filedFileName: null, filedSigner: null, icegateJobNo: null,
      amendUnlockedAt: tsDb, amendUnlockedBy: by, beNo, beDate, createdBy: by, updatedBy: by, createdAt: tsDb, updatedAt: tsDb,
      extendedData: JSON.stringify({ ...ext, _amendmentId: amendId, _amendOfJobId: parent.id, _amendOfJobNo: parent.jobNo, _amendNo: amendNo, _amendDate: amendDate }),
    };
    const oc = Object.keys(over).filter(k => jc.includes(k));
    await x(`UPDATE ImportJobs SET ${oc.map(k => qn(k) + ' = ?').join(', ')} WHERE id = ?`, [...oc.map(k => over[k]), nj.id], t);
    for (const inv of await q('SELECT id FROM ImportInvoices WHERE importJobId = ? ORDER BY id', [srcId], t)) {
      const icx = ic.filter(c => c !== 'importJobId');
      await x(`INSERT INTO ImportInvoices (importJobId, ${icx.map(qn).join(', ')}) SELECT ?, ${icx.map(qn).join(', ')} FROM ImportInvoices WHERE id = ?`, [nj.id, inv.id], t);
      const ni = await lastId(); const tcx = tc.filter(c => c !== 'importInvoiceId');
      await x(`INSERT INTO ImportItems (importInvoiceId, ${tcx.map(qn).join(', ')}) SELECT ?, ${tcx.map(qn).join(', ')} FROM ImportItems WHERE importInvoiceId = ? ORDER BY id`, [ni, inv.id], t);
    }
    const ccx = cc.filter(c => c !== 'importJobId');
    await x(`INSERT INTO ImportContainers (importJobId, ${ccx.map(qn).join(', ')}) SELECT ?, ${ccx.map(qn).join(', ')} FROM ImportContainers WHERE importJobId = ? ORDER BY id`, [nj.id, srcId], t);
    const copy = { jobNo: copyNo };
    await x('UPDATE BeAmendments SET amendedJobId = ? WHERE id = ?', [nj.id, amendId], t);
    try { await require('../models/JobTimeline').create({ module: 'IMPORT', jobId: String(parent.id), eventType: 'AMENDMENT', message: `Amendment ${amendNo} (amended job ${copy.jobNo}${srcRow ? ', copied from amendment ' + srcRow.amendNo : ''}) made: ${codes.join(', ') || 'codes not chosen yet'} - ${String(b.reason || '').trim()}`, author: by }, { transaction: t }); } catch (e) { /* timeline optional */ }
    await t.commit();
    res.json({ success: true, data: pub(await row(amendId)), amendedJobId: nj.id, amendedJobNo: copy.jobNo });
  } catch (e) { await t.rollback().catch(() => {}); fail(res, e); }
});

router.put('/:id', async (req, res) => {
  try {
    const r = await row(req.params.id); mustBeOpen(r);
    const b = req.body || {}; const set = []; const args = [];
    const put = (col, v) => { set.push(col + ' = ?'); args.push(v); };
    if ('reqLetterNo' in b) put('reqLetterNo', String(b.reqLetterNo || '').trim());
    if ('reqLetterDate' in b) put('reqLetterDate', A.ymd(b.reqLetterDate) || null);
    if ('reason' in b) put('reason', String(b.reason || '').trim().toUpperCase());
    if ('codes' in b) put('codes', JSON.stringify((Array.isArray(b.codes) ? b.codes : []).map(c => String(c).toUpperCase()).filter(c => A.CODE[c])));
    if ('icegateProfileId' in b) put('icegateProfileId', b.icegateProfileId || null);
    if ('remarks' in b) put('remarks', String(b.remarks || ''));
    if (!set.length) return res.json({ success: true, data: pub(r) });
    // a change after the file was made: the file must be made again
    if (['codes', 'reason', 'reqLetterNo', 'icegateProfileId'].some(k => k in b) && r.fileText) { set.push("fileText = NULL, signedFileB64 = NULL, status = 'Draft'"); }
    put('updatedBy', who(req)); put('updatedAt', now());
    await x(`UPDATE BeAmendments SET ${set.join(', ')} WHERE id = ?`, [...args, r.id]);
    res.json({ success: true, data: pub(await row(r.id)) });
  } catch (e) { fail(res, e); }
});

router.get('/:id/changes', async (req, res) => {
  try {
    const r = await row(req.params.id); if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' });
    const ch = await A.changesFor(r, { profileId: r.icegateProfileId });
    res.json({ success: true, base: ch.base, changes: ch.changes.map(c => ({ table: c.table, key: c.key, act: c.act, fields: c.fields.slice(0, 30) })), suggested: ch.suggested, chosen: A.parseJ(r.codes, []) });
  } catch (e) { fail(res, e); }
});

router.post('/:id/file', async (req, res) => {
  try {
    const r = await row(req.params.id); mustBeOpen(r);
    const b = req.body || {};
    if (b.icegateProfileId !== undefined) { await x('UPDATE BeAmendments SET icegateProfileId = ? WHERE id = ?', [b.icegateProfileId || null, r.id]); r.icegateProfileId = b.icegateProfileId || null; }
    const f = await A.makeFile(r, { profileId: r.icegateProfileId, include: b.include });
    await x(`UPDATE BeAmendments SET fileName = ?, fileText = ?, fileMadeAt = ?, fileMadeBy = ?, fileCodes = ?, signedFileB64 = NULL, signedAt = NULL, signer = NULL, status = 'Ready', updatedBy = ?, updatedAt = ? WHERE id = ?`,
      [f.fileName, f.text, now(), who(req), JSON.stringify(f.codes), who(req), now(), r.id]);
    res.json({ success: true, fileName: f.fileName, lines: f.text.split('\r\n').length - 1, unconfirmedCodes: f.unconfirmedCodes, base: f.base, data: pub(await row(r.id)) });
  } catch (e) { fail(res, e); }
});

router.get('/:id/file', async (req, res) => {
  try {
    const r = await row(req.params.id); if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' });
    const signed = String(req.query.kind || '') === 'signed';
    if (!r.fileText) return res.status(400).json({ success: false, error: 'Make the file first' });
    if (signed && !r.signedFileB64) return res.status(400).json({ success: false, error: 'Sign the file first (DSC token)' });
    const name = signed ? r.fileName + '.sig' : r.fileName;
    const body = signed ? Buffer.from(r.signedFileB64, 'base64') : Buffer.from(r.fileText, 'latin1');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(body);
  } catch (e) { fail(res, e); }
});

// sign the file on the DSC token (local signer, POST /sign-file - an attached PKCS#7 / CMS file)
router.post('/:id/sign', async (req, res) => {
  try {
    const r = await row(req.params.id); if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' });
    if (!r.fileText) return res.status(400).json({ success: false, error: 'Make the file first' });
    if (!OPEN.includes(r.status)) return res.status(409).json({ success: false, error: `Amendment ${r.amendNo} is ${r.status} - its file is not signed again` });
    const pin = String((req.body || {}).pin || '');
    if (!pin) return res.status(400).json({ success: false, error: 'Enter the DSC token PIN' });
    const axios = require('axios');
    // the one DSC signer URL setting (as routes/icegate.js getSignerUrl): icegate_dsc_signer_url, else DSC_SIGNER_URL, else localhost:5050
    let base = '';
    try { const r0 = await require('../models/AppSetting').findOne({ where: { key: 'icegate_dsc_signer_url' } }); base = r0 && String(r0.value || '').trim(); } catch (e) { /* no settings table */ }
    base = String(base || process.env.DSC_SIGNER_URL || 'http://localhost:5050').trim().replace(/\/+$/, '');
    let d;
    try { d = (await axios.post(base + '/sign-file', { data_b64: Buffer.from(r.fileText, 'latin1').toString('base64'), pin }, { timeout: 30000 })).data || {}; }
    catch (err) {
      const answered = !!err.response; const detail = (err.response && err.response.data && err.response.data.error) || err.message;
      return res.status(answered ? 400 : 502).json({ success: false, error: answered ? 'DSC signing failed: ' + detail + (err.response && err.response.status === 404 ? ' (the Local Signer is an older copy without /sign-file - copy the new local_signer/app.py and restart it)' : '') : 'DSC Signer not reachable at ' + base + ' - start the Local Signer (START_SIGNER.bat) and insert the token. ' + detail });
    }
    if (!d.success || !d.signed_b64) return res.status(400).json({ success: false, error: 'DSC signing failed: ' + (d.error || 'no signed file returned') });
    await x("UPDATE BeAmendments SET signedFileB64 = ?, signedAt = ?, signer = ?, updatedBy = ?, updatedAt = ? WHERE id = ?", [d.signed_b64, now(), d.signer_cn || '', who(req), now(), r.id]);
    res.json({ success: true, signer: d.signer_cn || '', data: pub(await row(r.id)) });
  } catch (e) { fail(res, e); }
});

// send to ICEGATE by mail (as iCAFFE's "File Mail to ICE Gate"): the signed file, from the Settings > Email account
router.post('/:id/send', async (req, res) => {
  try {
    const r = await row(req.params.id); if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' });
    if (!['Ready', 'Rejected'].includes(r.status)) return res.status(409).json({ success: false, error: `Amendment ${r.amendNo} is ${r.status}` });
    if (!r.signedFileB64) return res.status(400).json({ success: false, error: 'Sign the file first: ICEGATE takes only a DSC-signed file by mail' });
    const store = require('../utils/settingsStore');
    const to = String((await store.get('ICEGATE_FILE_MAIL_TO', '')) || '').trim();
    if (!to) return res.status(400).json({ success: false, error: 'Set the ICEGATE mail address first (BE Amendments > Settings)' });
    const info = await require('../utils/mailer').sendMail({
      to, subject: `${r.fileName} ${r.beNo || ''}`.trim(), text: `BE amendment ${r.amendNo} (BE ${r.beNo} dt ${r.beDate}) - ${A.parseJ(r.codes, []).join(', ')}`,
      attachments: [{ filename: r.fileName + '.sig', content: Buffer.from(r.signedFileB64, 'base64') }],
    });
    await x("UPDATE BeAmendments SET status = 'Submitted', transferMode = 'MAIL', submittedAt = ?, submittedBy = ?, mailTo = ?, mailMessageId = ?, updatedBy = ?, updatedAt = ? WHERE id = ?",
      [now(), who(req), to, (info && info.messageId) || '', who(req), now(), r.id]);
    res.json({ success: true, to, data: pub(await row(r.id)) });
  } catch (e) { fail(res, e); }
});

router.post('/:id/submitted', async (req, res) => {
  try {
    const r = await row(req.params.id); if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' });
    if (!r.fileText) return res.status(400).json({ success: false, error: 'Make the file first' });
    if (!['Ready', 'Rejected'].includes(r.status)) return res.status(409).json({ success: false, error: `Amendment ${r.amendNo} is ${r.status}` });
    const mode = String((req.body || {}).mode || 'DOWNLOAD').toUpperCase() === 'DOWNLOAD_UNSIGNED' ? 'DOWNLOAD_UNSIGNED' : 'DOWNLOAD';
    await x("UPDATE BeAmendments SET status = 'Submitted', transferMode = ?, submittedAt = ?, submittedBy = ?, updatedBy = ?, updatedAt = ? WHERE id = ?", [mode, now(), who(req), who(req), now(), r.id]);
    res.json({ success: true, data: pub(await row(r.id)) });
  } catch (e) { fail(res, e); }
});

router.post('/:id/reply', async (req, res) => {
  try {
    const r = await row(req.params.id); if (!r) return res.status(404).json({ success: false, error: 'Amendment not found' });
    const st = String((req.body || {}).status || ''); if (!['Accepted', 'Rejected'].includes(st)) return res.status(400).json({ success: false, error: 'Status is Accepted or Rejected' });
    if (!['Submitted', 'Accepted', 'Rejected'].includes(r.status)) return res.status(409).json({ success: false, error: 'Only a sent amendment gets an ICEGATE reply' });
    await x('UPDATE BeAmendments SET status = ?, ackStatus = ?, ackText = ?, ackAt = ?, updatedBy = ?, updatedAt = ? WHERE id = ?', [st, st, String((req.body || {}).text || ''), now(), who(req), now(), r.id]);
    res.json({ success: true, data: pub(await row(r.id)) });
  } catch (e) { fail(res, e); }
});

router.post('/:id/void', async (req, res) => {
  try {
    const r = await row(req.params.id); mustBeOpen(r);
    const why = String((req.body || {}).reason || '').trim();
    if (!why) return res.status(400).json({ success: false, error: 'Give the reason for voiding' });
    await x("UPDATE BeAmendments SET status = 'Void', remarks = ?, updatedBy = ?, updatedAt = ? WHERE id = ?", ['Void: ' + why, who(req), now(), r.id]);
    if (r.amendedJobId) await x("UPDATE ImportJobs SET status = 'VOID', updatedBy = ?, updatedAt = ? WHERE id = ?", [who(req), dbNow(), r.amendedJobId]);
    res.json({ success: true, data: pub(await row(r.id)) });
  } catch (e) { fail(res, e); }
});

module.exports = router;
