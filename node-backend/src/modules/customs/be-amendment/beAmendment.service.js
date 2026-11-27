import axios from 'axios';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { ApiError, BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import { AppSetting, JobTimeline } from '../../../models/index.js';
import * as beAmendment from '../../../utils/customs/beAmendment.js';
import * as settingsStore from '../../../utils/common/settingsStore.js';
import * as numberSeries from '../../../utils/common/numberSeries.js';
import { sendMail } from '../../../utils/integrations/mailer.js';

// a Rejected amendment can still be corrected (codes, reason, file, void)
const OPEN_STATUSES = ['Draft', 'Ready', 'Rejected'];
const SENDABLE_STATUSES = ['Ready', 'Rejected'];
const SENT_STATUSES = ['Submitted', 'Accepted', 'Rejected'];
const REPLY_STATUSES = ['Accepted', 'Rejected'];
const MAX_REGISTER_LIMIT = 2000;
const DEFAULT_REGISTER_LIMIT = 200;
const SHOWN_CHANGED_FIELDS = 30;
const SIGNER_TIMEOUT_MS = 30000;
const DEFAULT_SIGNER_URL = 'http://localhost:5050';
const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// a change of these after the file was made means the file must be made again
const FILE_FIELDS = ['codes', 'reason', 'reqLetterNo', 'icegateProfileId'];

const select = (sql, replacements = [], transaction) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
const execute = (sql, replacements = [], transaction) => sequelize.query(sql, { replacements, transaction });
const nowIso = () => new Date().toISOString();
// ImportJobs dates are read by Sequelize, which reads only 'YYYY-MM-DD HH:MM:SS.sss +00:00' (an ISO '...T...Z' comes
// back as Invalid Date)
const nowForSequelize = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const quoted = (column) => `"${column}"`;

export const isEmailOrBlank = (mailTo) => {
  const address = String(mailTo || '').trim();
  return !address || EMAIL_RX.test(address);
};

export const ensureAmendmentStore = () => beAmendment.ensure();

const findAmendment = async (id, transaction) =>
  (await select('SELECT * FROM BeAmendments WHERE id = ?', [id], transaction))[0];

/** An amendment as the screens read it: lists parsed, the file texts left out (only whether they exist). */
const publicAmendment = (row) =>
  row && {
    ...row,
    codes: beAmendment.parseJ(row.codes, []),
    fileCodes: beAmendment.parseJ(row.fileCodes, []),
    fileText: undefined,
    signedFileB64: undefined,
    hasFile: !!row.fileText,
    hasSigned: !!row.signedFileB64,
  };

const reloadPublic = async (id) => publicAmendment(await findAmendment(id));

async function findAmendmentOrFail(id) {
  const row = await findAmendment(id);
  if (!row) throw new NotFoundError('Amendment not found');
  return row;
}

function checkIsOpen(row) {
  if (!row) throw new NotFoundError('Amendment not found');
  if (!OPEN_STATUSES.includes(row.status)) {
    throw new ConflictError(`Amendment ${row.amendNo} is ${row.status} - it cannot be changed any more`);
  }
}

function checkHasFile(row) {
  if (!row.fileText) throw new BadRequestError('Make the file first');
}

const allowedCodes = (codes) =>
  (Array.isArray(codes) ? codes : [])
    .map((code) => String(code).toUpperCase())
    .filter((code) => beAmendment.CODE[code]);

export const amendmentCodes = () =>
  beAmendment.CODES.map((code) => ({
    code: code.code,
    label: code.label,
    act: code.act,
    seenInIcaffe: beAmendment.SEEN_IN_ICAFFE.has(code.code),
  }));

// the ICEGATE profile linked to the job's CHA is offered first in the new-amendment window (older tables have no
// linkedChaCode)
const icegateProfiles = () =>
  select(
    'SELECT id, profileName, loginId, isDefault, linkedChaCode FROM IcegateProfiles ORDER BY isDefault DESC, profileName',
  )
    .catch(() =>
      select('SELECT id, profileName, loginId, isDefault FROM IcegateProfiles ORDER BY isDefault DESC, profileName'),
    )
    .catch(() => []);

/** ICEGATE mail address and the number series of the amendments. */
export async function getAmendmentSettings() {
  const settings = await settingsStore.getMany(['ICEGATE_FILE_MAIL_TO', 'SMTP_USER']);
  const series = await select(
    "SELECT branchCode, division, fyCode, format, nextNo, lastNo, lastDate, source FROM NumberSeries WHERE docType = 'BE_AMEND' AND coalesce(isActive, 1) = 1 ORDER BY branchCode, division, fyCode DESC",
  );
  const profiles = await icegateProfiles();
  return {
    success: true,
    mailTo: settings.ICEGATE_FILE_MAIL_TO || '',
    smtpUser: settings.SMTP_USER || '',
    series,
    fy: numberSeries.fyCodeOf(nowIso()),
    profiles,
  };
}

export async function saveAmendmentMailTo(mailTo) {
  const address = String(mailTo || '').trim();
  await settingsStore.setMany({ ICEGATE_FILE_MAIL_TO: address });
  return address;
}

const REGISTER_STATUS_FILTERS = {
  open: "a.status IN ('Draft', 'Ready')",
  submitted: "a.status IN ('Submitted', 'Accepted', 'Rejected')",
  void: "a.status = 'Void'",
};
const SEARCHED_REGISTER_COLUMNS = [
  'lower(a.amendNo)',
  "lower(coalesce(a.beNo, ''))",
  "lower(coalesce(a.parentJobNo, ''))",
  "lower(coalesce(j.nameOfImporter, j.autoField_4, ''))",
  "lower(coalesce(a.codes, ''))",
  "lower(coalesce(a.reqLetterNo, ''))",
  "lower(coalesce(a.reason, ''))",
];

function registerFilter(query) {
  const where = [];
  const replacements = [];
  const status = String(query.status || 'open').toLowerCase();
  if (Object.hasOwn(REGISTER_STATUS_FILTERS, status)) where.push(REGISTER_STATUS_FILTERS[status]);
  else if (status !== 'all') where.push("a.status <> 'Void'");
  if (query.branch) {
    where.push('a.branchCode = ?');
    replacements.push(String(query.branch).toUpperCase());
  }
  if (query.from) {
    where.push('a.amendDate >= ?');
    replacements.push(beAmendment.ymd(query.from));
  }
  if (query.to) {
    where.push('a.amendDate <= ?');
    replacements.push(beAmendment.ymd(query.to));
  }
  if (String(query.q || '').trim()) {
    const like = `%${String(query.q).trim().toLowerCase()}%`;
    where.push(`(${SEARCHED_REGISTER_COLUMNS.map((column) => `${column} LIKE ?`).join(' OR ')})`);
    replacements.push(...SEARCHED_REGISTER_COLUMNS.map(() => like));
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', replacements };
}

/** The register: status=open|submitted|void|all, q, branch, from, to, limit. */
export async function listAmendments(query) {
  const filter = registerFilter(query);
  const limit = Math.min(MAX_REGISTER_LIMIT, Math.max(1, Number(query.limit) || DEFAULT_REGISTER_LIMIT));
  const rows = await select(
    `SELECT a.*, coalesce(j.nameOfImporter, j.autoField_4, '') importer, j.mawbNo mawbNo, j.hawbNo hawbNo FROM BeAmendments a LEFT JOIN ImportJobs j ON j.id = a.importJobId
      ${filter.sql} ORDER BY a.amendDate DESC, a.id DESC LIMIT ${limit}`,
    filter.replacements,
  );
  const statusCounts = await select('SELECT status, count(*) n FROM BeAmendments GROUP BY status');
  return {
    success: true,
    data: rows.map(publicAmendment),
    counts: Object.fromEntries(statusCounts.map((row) => [row.status, row.n])),
  };
}

/** Amendments of one BE job (or of the BE behind an amended job). */
export async function listAmendmentsOfJob(jobId) {
  const job = await beAmendment.loadJob(jobId);
  if (!job) throw new NotFoundError('Job not found');
  const parentId = job._amendOfJobId || job.id;
  const rows = await select('SELECT * FROM BeAmendments WHERE importJobId = ? ORDER BY amendDate DESC, id DESC', [
    parentId,
  ]);
  const parent = parentId === job.id ? job : await beAmendment.loadJob(parentId);
  return {
    success: true,
    parent: parent && {
      id: parent.id,
      jobNo: parent.jobNo,
      beNo: parent.beNo || parent.beNumber || '',
      beDate: parent.beDate || '',
      icegateStatus: parent.icegateStatus || '',
    },
    current: job._amendmentId ? Number(job._amendmentId) : null,
    data: rows.map(publicAmendment),
  };
}

export async function getAmendment(id) {
  return publicAmendment(await findAmendmentOrFail(id));
}

// asked from an amended job: the amendment belongs to its BE job
async function loadParentBeJob(importJobId, transaction) {
  const job = await beAmendment.loadJob(importJobId, transaction);
  if (!job) throw new NotFoundError('BE job not found');
  const parent = beAmendment.isCopy(job) ? await beAmendment.loadJob(job._amendOfJobId, transaction) : job;
  if (!parent) throw new NotFoundError('BE job of this amended job not found');
  return parent;
}

function readNewAmendment(body, parent) {
  const beNo = String(body.beNo || parent.beNo || parent.beNumber || '').replace(/\D/g, '');
  const beDate = beAmendment.ymd(body.beDate || parent.beDate);
  const missing = [];
  if (!beNo) missing.push('BE No of the filed BE');
  if (!beDate) missing.push('BE Date');
  if (!String(body.reason || '').trim()) missing.push('Reason');
  const codes = allowedCodes(body.codes);
  if (missing.length) throw new BadRequestError(`Fill in: ${missing.join(', ')}`);
  return { beNo, beDate, codes };
}

async function takeAmendmentNumber(parent, transaction) {
  const branchCode = String(parent.branchCode || (await numberSeries.defaultBranch(transaction)) || '').toUpperCase();
  const division = beAmendment.divisionOf(parent);
  const amendDate = beAmendment.today();
  const amendNo = await numberSeries.take('BE_AMEND', { branchCode, division, date: amendDate }, transaction);
  return { branchCode, division, amendDate, amendNo, fyCode: numberSeries.fyCodeOf(amendDate) };
}

// copied from the BE as it stands now: the last amendment of this BE that was sent (its amended job), else the BE job -
// the same base the changes are read against, so a new amendment shows only its own changes
async function lastSentAmendment(parentId, transaction) {
  const rows = await select(
    `SELECT amendedJobId, amendNo FROM BeAmendments WHERE importJobId = ? AND status IN ('Submitted', 'Accepted') AND amendedJobId IS NOT NULL
      AND amendedJobId IN (SELECT id FROM ImportJobs) ORDER BY amendDate DESC, id DESC LIMIT 1`,
    [parentId],
    transaction,
  );
  return rows[0];
}

const lastInsertId = async (transaction) => (await select('SELECT last_insert_rowid() id', [], transaction))[0].id;
const copiedColumns = async (table, transaction) =>
  (await select(`PRAGMA table_info(${table})`, [], transaction))
    .map((column) => column.name)
    .filter((name) => name !== 'id');

async function insertAmendmentRow({ parent, number, newAmendment, body, by, at }, transaction) {
  await execute(
    `INSERT INTO BeAmendments (importJobId, parentJobNo, amendNo, amendDate, branchCode, division, fyCode, beNo, beDate, reqLetterNo, reqLetterDate, codes, reason, status, icegateProfileId, source, createdBy, updatedBy, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      parent.id,
      parent.jobNo,
      number.amendNo,
      number.amendDate,
      number.branchCode,
      number.division,
      number.fyCode,
      newAmendment.beNo,
      newAmendment.beDate,
      String(body.reqLetterNo || '').trim(),
      beAmendment.ymd(body.reqLetterDate) || null,
      JSON.stringify(newAmendment.codes),
      String(body.reason || '')
        .trim()
        .toUpperCase(),
      'Draft',
      body.icegateProfileId || null,
      'EagleView',
      by,
      by,
      at,
      at,
    ],
    transaction,
  );
  return lastInsertId(transaction);
}

// the amended job: a full copy of the BE job (header, invoices with items, containers), row for row in SQL so that
// every column and extendedData is carried over as stored
async function copyBeJob(
  { sourceJobId, copyJobNo, amendmentId, parent, number, newAmendment, by, stampedAt },
  transaction,
) {
  const jobColumns = await copiedColumns('ImportJobs', transaction);
  const invoiceColumns = await copiedColumns('ImportInvoices', transaction);
  const itemColumns = await copiedColumns('ImportItems', transaction);
  const containerColumns = await copiedColumns('ImportContainers', transaction);
  const sourceExtendedData =
    beAmendment.parseJ(
      (await select('SELECT extendedData FROM ImportJobs WHERE id = ?', [sourceJobId], transaction))[0].extendedData,
      {},
    ) || {};

  await execute(
    `INSERT INTO ImportJobs (${jobColumns.map(quoted).join(', ')}) SELECT ${jobColumns.map((column) => (column === 'jobNo' ? '?' : quoted(column))).join(', ')} FROM ImportJobs WHERE id = ?`,
    [copyJobNo, sourceJobId],
    transaction,
  );
  const copyJobId = await lastInsertId(transaction);
  const copyValues = {
    jobNo: copyJobNo,
    jobDate: number.amendDate,
    status: 'AMENDMENT',
    isAmended: 1,
    icegateStatus: null,
    icegateUniqueId: null,
    icegateAck: null,
    icegateAckAt: null,
    filedJson: null,
    filedAt: null,
    filedFileName: null,
    filedSigner: null,
    icegateJobNo: null,
    amendUnlockedAt: stampedAt,
    amendUnlockedBy: by,
    beNo: newAmendment.beNo,
    beDate: newAmendment.beDate,
    createdBy: by,
    updatedBy: by,
    createdAt: stampedAt,
    updatedAt: stampedAt,
    extendedData: JSON.stringify({
      ...sourceExtendedData,
      _amendmentId: amendmentId,
      _amendOfJobId: parent.id,
      _amendOfJobNo: parent.jobNo,
      _amendNo: number.amendNo,
      _amendDate: number.amendDate,
    }),
  };
  const setColumns = Object.keys(copyValues).filter((key) => jobColumns.includes(key));
  await execute(
    `UPDATE ImportJobs SET ${setColumns.map((key) => `${quoted(key)} = ?`).join(', ')} WHERE id = ?`,
    [...setColumns.map((key) => copyValues[key]), copyJobId],
    transaction,
  );

  const invoiceCopyColumns = invoiceColumns.filter((column) => column !== 'importJobId');
  const itemCopyColumns = itemColumns.filter((column) => column !== 'importInvoiceId');
  for (const invoice of await select(
    'SELECT id FROM ImportInvoices WHERE importJobId = ? ORDER BY id',
    [sourceJobId],
    transaction,
  )) {
    await execute(
      `INSERT INTO ImportInvoices (importJobId, ${invoiceCopyColumns.map(quoted).join(', ')}) SELECT ?, ${invoiceCopyColumns.map(quoted).join(', ')} FROM ImportInvoices WHERE id = ?`,
      [copyJobId, invoice.id],
      transaction,
    );
    const copyInvoiceId = await lastInsertId(transaction);
    await execute(
      `INSERT INTO ImportItems (importInvoiceId, ${itemCopyColumns.map(quoted).join(', ')}) SELECT ?, ${itemCopyColumns.map(quoted).join(', ')} FROM ImportItems WHERE importInvoiceId = ? ORDER BY id`,
      [copyInvoiceId, invoice.id],
      transaction,
    );
  }
  const containerCopyColumns = containerColumns.filter((column) => column !== 'importJobId');
  await execute(
    `INSERT INTO ImportContainers (importJobId, ${containerCopyColumns.map(quoted).join(', ')}) SELECT ?, ${containerCopyColumns.map(quoted).join(', ')} FROM ImportContainers WHERE importJobId = ? ORDER BY id`,
    [copyJobId, sourceJobId],
    transaction,
  );
  return copyJobId;
}

async function noteAmendmentInTimeline(
  { parent, number, copyJobNo, sourceAmendment, newAmendment, body, by },
  transaction,
) {
  const copiedFrom = sourceAmendment ? `, copied from amendment ${sourceAmendment.amendNo}` : '';
  try {
    await JobTimeline.create(
      {
        module: 'IMPORT',
        jobId: String(parent.id),
        eventType: 'AMENDMENT',
        message:
          `Amendment ${number.amendNo} (amended job ${copyJobNo}${copiedFrom}) made: ${newAmendment.codes.join(', ') || 'codes not chosen yet'}` +
          ` - ${String(body.reason || '').trim()}`,
        author: by,
      },
      { transaction },
    );
  } catch {
    // the timeline is optional
  }
}

/** New amendment: takes the next number and copies the BE job to the amended job, in one transaction. */
export async function createAmendment(body, by) {
  const transaction = await sequelize.transaction();
  try {
    const parent = await loadParentBeJob(body.importJobId, transaction);
    const newAmendment = readNewAmendment(body, parent);
    const number = await takeAmendmentNumber(parent, transaction);
    const at = nowIso();
    const stampedAt = nowForSequelize();
    const sourceAmendment = await lastSentAmendment(parent.id, transaction);
    const sourceJobId = sourceAmendment ? sourceAmendment.amendedJobId : parent.id;
    const amendmentId = await insertAmendmentRow({ parent, number, newAmendment, body, by, at }, transaction);
    const copyJobNo = `AMD/${number.branchCode}/${number.division}/${number.amendNo}`;
    const copyJobId = await copyBeJob(
      {
        sourceJobId,
        copyJobNo,
        amendmentId,
        parent,
        number,
        newAmendment,
        by,
        stampedAt,
      },
      transaction,
    );
    await execute('UPDATE BeAmendments SET amendedJobId = ? WHERE id = ?', [copyJobId, amendmentId], transaction);
    await noteAmendmentInTimeline({ parent, number, copyJobNo, sourceAmendment, newAmendment, body, by }, transaction);
    await transaction.commit();
    return { success: true, data: await reloadPublic(amendmentId), amendedJobId: copyJobId, amendedJobNo: copyJobNo };
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
}

/** Request letter / codes / reason / ICEGATE user / remarks; a change after the file was made needs a new file. */
export async function updateAmendment(id, body, by) {
  const row = await findAmendment(id);
  checkIsOpen(row);
  const set = [];
  const replacements = [];
  const put = (column, value) => {
    set.push(`${column} = ?`);
    replacements.push(value);
  };
  if ('reqLetterNo' in body) put('reqLetterNo', String(body.reqLetterNo || '').trim());
  if ('reqLetterDate' in body) put('reqLetterDate', beAmendment.ymd(body.reqLetterDate) || null);
  if ('reason' in body)
    put(
      'reason',
      String(body.reason || '')
        .trim()
        .toUpperCase(),
    );
  if ('codes' in body) put('codes', JSON.stringify(allowedCodes(body.codes)));
  if ('icegateProfileId' in body) put('icegateProfileId', body.icegateProfileId || null);
  if ('remarks' in body) put('remarks', String(body.remarks || ''));
  if (!set.length) return publicAmendment(row);
  if (FILE_FIELDS.some((field) => field in body) && row.fileText)
    set.push("fileText = NULL, signedFileB64 = NULL, status = 'Draft'");
  put('updatedBy', by);
  put('updatedAt', nowIso());
  await execute(`UPDATE BeAmendments SET ${set.join(', ')} WHERE id = ?`, [...replacements, row.id]);
  return reloadPublic(row.id);
}

/** What changed on the amended job (and the codes that follow). */
export async function amendmentChanges(id) {
  const row = await findAmendmentOrFail(id);
  const found = await beAmendment.changesFor(row, { profileId: row.icegateProfileId });
  return {
    success: true,
    base: found.base,
    changes: found.changes.map((change) => ({
      table: change.table,
      key: change.key,
      act: change.act,
      fields: change.fields.slice(0, SHOWN_CHANGED_FIELDS),
    })),
    suggested: found.suggested,
    chosen: beAmendment.parseJ(row.codes, []),
  };
}

/** Makes the .be file (kept on the amendment); a signed copy of an earlier file is dropped. */
export async function makeAmendmentFile(id, body, by) {
  const row = await findAmendment(id);
  checkIsOpen(row);
  if (body.icegateProfileId !== undefined) {
    await execute('UPDATE BeAmendments SET icegateProfileId = ? WHERE id = ?', [body.icegateProfileId || null, row.id]);
    row.icegateProfileId = body.icegateProfileId || null;
  }
  const file = await beAmendment.makeFile(row, { profileId: row.icegateProfileId, include: body.include });
  await execute(
    `UPDATE BeAmendments SET fileName = ?, fileText = ?, fileMadeAt = ?, fileMadeBy = ?, fileCodes = ?, signedFileB64 = NULL, signedAt = NULL, signer = NULL, status = 'Ready', updatedBy = ?, updatedAt = ? WHERE id = ?`,
    [file.fileName, file.text, nowIso(), by, JSON.stringify(file.codes), by, nowIso(), row.id],
  );
  return {
    success: true,
    fileName: file.fileName,
    lines: file.text.split('\r\n').length - 1,
    unconfirmedCodes: file.unconfirmedCodes,
    base: file.base,
    data: await reloadPublic(row.id),
  };
}

/** The file to download: kind=unsigned (default) or signed. */
export async function amendmentFileDownload(id, kind) {
  const row = await findAmendmentOrFail(id);
  const signed = String(kind || '') === 'signed';
  checkHasFile(row);
  if (signed && !row.signedFileB64) throw new BadRequestError('Sign the file first (DSC token)');
  return {
    fileName: signed ? `${row.fileName}.sig` : row.fileName,
    content: signed ? Buffer.from(row.signedFileB64, 'base64') : Buffer.from(row.fileText, 'latin1'),
  };
}

// the one DSC signer URL setting (as the ICEGATE filing uses): icegate_dsc_signer_url, else DSC_SIGNER_URL, else localhost
async function dscSignerUrl() {
  let url = '';
  try {
    const setting = await AppSetting.findOne({ where: { key: 'icegate_dsc_signer_url' } });
    url = setting && String(setting.value || '').trim();
  } catch {
    // no settings table
  }
  return String(url || process.env.DSC_SIGNER_URL || DEFAULT_SIGNER_URL)
    .trim()
    .replace(/\/+$/, '');
}

function signerFailure(error, signerUrl) {
  const answered = !!error.response;
  const detail = (error.response && error.response.data && error.response.data.error) || error.message;
  if (!answered) {
    return new ApiError(
      502,
      `DSC Signer not reachable at ${signerUrl} - start the Local Signer (START_SIGNER.bat) and insert the token. ${detail}`,
    );
  }
  const olderSigner =
    error.response.status === 404
      ? ' (the Local Signer is an older copy without /sign-file - copy the new local_signer/app.py and restart it)'
      : '';
  return new BadRequestError(`DSC signing failed: ${detail}${olderSigner}`);
}

async function signWithLocalSigner(fileText, pin) {
  const signerUrl = await dscSignerUrl();
  try {
    const answer = await axios.post(
      `${signerUrl}/sign-file`,
      {
        data_b64: Buffer.from(fileText, 'latin1').toString('base64'),
        pin,
      },
      { timeout: SIGNER_TIMEOUT_MS },
    );
    return answer.data || {};
  } catch (error) {
    throw signerFailure(error, signerUrl);
  }
}

/** Signs the file on the DSC token (Local Signer POST /sign-file: an attached PKCS#7 / CMS file). */
export async function signAmendmentFile(id, pin, by) {
  const row = await findAmendmentOrFail(id);
  checkHasFile(row);
  if (!OPEN_STATUSES.includes(row.status))
    throw new ConflictError(`Amendment ${row.amendNo} is ${row.status} - its file is not signed again`);
  if (!pin) throw new BadRequestError('Enter the DSC token PIN');
  const signed = await signWithLocalSigner(row.fileText, pin);
  if (!signed.success || !signed.signed_b64)
    throw new BadRequestError(`DSC signing failed: ${signed.error || 'no signed file returned'}`);
  await execute(
    'UPDATE BeAmendments SET signedFileB64 = ?, signedAt = ?, signer = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
    [signed.signed_b64, nowIso(), signed.signer_cn || '', by, nowIso(), row.id],
  );
  return { success: true, signer: signed.signer_cn || '', data: await reloadPublic(row.id) };
}

/** Sends the signed file to ICEGATE by mail (as iCAFFE's "File Mail to ICE Gate"), from the Settings > Email account. */
export async function sendAmendmentFile(id, by) {
  const row = await findAmendmentOrFail(id);
  if (!SENDABLE_STATUSES.includes(row.status)) throw new ConflictError(`Amendment ${row.amendNo} is ${row.status}`);
  if (!row.signedFileB64)
    throw new BadRequestError('Sign the file first: ICEGATE takes only a DSC-signed file by mail');
  const mailTo = String((await settingsStore.get('ICEGATE_FILE_MAIL_TO', '')) || '').trim();
  if (!mailTo) throw new BadRequestError('Set the ICEGATE mail address first (BE Amendments > Settings)');
  const info = await sendMail({
    to: mailTo,
    subject: `${row.fileName} ${row.beNo || ''}`.trim(),
    text: `BE amendment ${row.amendNo} (BE ${row.beNo} dt ${row.beDate}) - ${beAmendment.parseJ(row.codes, []).join(', ')}`,
    attachments: [{ filename: `${row.fileName}.sig`, content: Buffer.from(row.signedFileB64, 'base64') }],
  });
  await execute(
    "UPDATE BeAmendments SET status = 'Submitted', transferMode = 'MAIL', submittedAt = ?, submittedBy = ?, mailTo = ?, mailMessageId = ?, updatedBy = ?, updatedAt = ? WHERE id = ?",
    [nowIso(), by, mailTo, (info && info.messageId) || '', by, nowIso(), row.id],
  );
  return { success: true, to: mailTo, data: await reloadPublic(row.id) };
}

/** Marked sent after a manual upload on the ICEGATE portal. */
export async function markAmendmentSubmitted(id, mode, by) {
  const row = await findAmendmentOrFail(id);
  checkHasFile(row);
  if (!SENDABLE_STATUSES.includes(row.status)) throw new ConflictError(`Amendment ${row.amendNo} is ${row.status}`);
  const transferMode =
    String(mode || 'DOWNLOAD').toUpperCase() === 'DOWNLOAD_UNSIGNED' ? 'DOWNLOAD_UNSIGNED' : 'DOWNLOAD';
  await execute(
    "UPDATE BeAmendments SET status = 'Submitted', transferMode = ?, submittedAt = ?, submittedBy = ?, updatedBy = ?, updatedAt = ? WHERE id = ?",
    [transferMode, nowIso(), by, by, nowIso(), row.id],
  );
  return reloadPublic(row.id);
}

/** ICEGATE reply: Accepted / Rejected + text. */
export async function recordIcegateReply(id, { status, text }, by) {
  const row = await findAmendmentOrFail(id);
  const replyStatus = String(status || '');
  if (!REPLY_STATUSES.includes(replyStatus)) throw new BadRequestError('Status is Accepted or Rejected');
  if (!SENT_STATUSES.includes(row.status)) throw new ConflictError('Only a sent amendment gets an ICEGATE reply');
  await execute(
    'UPDATE BeAmendments SET status = ?, ackStatus = ?, ackText = ?, ackAt = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
    [replyStatus, replyStatus, String(text || ''), nowIso(), by, nowIso(), row.id],
  );
  return reloadPublic(row.id);
}

/** Void: the amended job is voided too; the BE job is never touched. */
export async function voidAmendment(id, reason, by) {
  const row = await findAmendment(id);
  checkIsOpen(row);
  const why = String(reason || '').trim();
  if (!why) throw new BadRequestError('Give the reason for voiding');
  await execute("UPDATE BeAmendments SET status = 'Void', remarks = ?, updatedBy = ?, updatedAt = ? WHERE id = ?", [
    `Void: ${why}`,
    by,
    nowIso(),
    row.id,
  ]);
  if (row.amendedJobId) {
    await execute("UPDATE ImportJobs SET status = 'VOID', updatedBy = ?, updatedAt = ? WHERE id = ?", [
      by,
      nowForSequelize(),
      row.amendedJobId,
    ]);
  }
  return reloadPublic(row.id);
}
