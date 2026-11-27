import fs from 'node:fs';
import path from 'node:path';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import * as esanchitArchive from '../../../utils/customs/esanchitArchive.js';
import {
  assertDivisionRight,
  assertMayHandlePdf,
  divisionAccess,
  selectRows,
  signerUserName,
} from './signerAccess.service.js';

export const ARCHIVE_URL_PREFIX = '/uploads/esanchit_archive/';
const TWO_MB = 2 * 1024 * 1024;
const DOCUMENT_NAMES_TTL_MS = 10 * 60 * 1000;
const SIGNER_NAME_LENGTH = 200;
const PDF_HEAD_BYTES = 1024;
const OPEN_AMENDMENT_STATUSES = ['Draft', 'Ready', 'Rejected'];
const BE_AMENDMENT_RIGHT_DETAIL = ' - BE amendments are import';
const SIGNED_ENVELOPE_PATTERN = /^[A-Za-z0-9+/=]{200,}$/;
const DAY_MS = 86400000;
const NUMBER_DATE_FUTURE_DAYS = 2;
const NUMBER_DATE_PAST_DAYS = 400;

export const parseJson = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const isIrn = (value) => /^\d{16}$/.test(String(value || '').trim());

/** The SQLite text of "now" the other EagleView screens write. */
export const sqliteNow = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');

/** The time the PDF was attached: archive names are <code>_<irn>_<ms>_<name>. */
export function attachedAt(fileUrl) {
  const match = /\/\d*[A-Z0-9]*_[^_/]*_(\d{13})_/i.exec(String(fileUrl || ''));
  return match ? new Date(+match[1]).toISOString() : null;
}

let documentNamesCache = { at: 0, map: {} };

/** e-Sanchit document code -> description (master ESanchits), read again every 10 minutes. */
export async function documentNames() {
  if (Date.now() - documentNamesCache.at < DOCUMENT_NAMES_TTL_MS) return documentNamesCache.map;
  const map = {};
  try {
    for (const row of await selectRows('SELECT documentCode, description FROM ESanchits'))
      map[String(row.documentCode)] = row.description || '';
  } catch {
    // no master yet
  }
  documentNamesCache = { at: Date.now(), map };
  return map;
}

const IMPORT_JOBS_WITH_PDFS_SQL =
  "SELECT id, jobNo, nameOfImporter, branchCode, extendedData FROM ImportJobs WHERE extendedData LIKE '%esanchit_archive%'";
const IMPORT_JOBS_WITH_PDFS_AND_BE_SQL =
  "SELECT id, jobNo, beNo, beDate, nameOfImporter, branchCode, extendedData FROM ImportJobs WHERE extendedData LIKE '%esanchit_archive%'";
const IMPORT_ITEMS_WITH_PDFS_SQL = `SELECT i.importJobId AS jobId, i.invSrNo, i.itemSrNo, i.extendedData, j.jobNo, j.nameOfImporter, j.branchCode
        FROM ImportItems i JOIN ImportJobs j ON j.id = i.importJobId WHERE i.extendedData LIKE '%esanchit_archive%'`;
const EXPORT_JOBS_WITH_PDFS_SQL =
  "SELECT id, jobNo, shipperName, eSanchitList FROM ExportJobs WHERE eSanchitList LIKE '%esanchit_archive%'";
const EXPORT_ITEMS_WITH_PDFS_SQL = `SELECT i.exportJobId AS jobId, i.invSr, i.itemSr, i.eSanchitList, j.jobNo, j.shipperName
        FROM ExportItems i JOIN ExportJobs j ON j.id = i.exportJobId WHERE i.eSanchitList LIKE '%esanchit_archive%'`;
const UNSIGNED_AMENDMENTS_SQL = `SELECT id, amendNo, parentJobNo, beNo, beDate, fileName, codes, status, fileMadeAt FROM BeAmendments
          WHERE fileText IS NOT NULL AND (signedFileB64 IS NULL OR signedFileB64 = '') AND status IN ('Ready', 'Rejected') ORDER BY id DESC`;

const archivePathOf = (fileUrl) =>
  path.join(esanchitArchive.ROOT, ...String(fileUrl).replace(ARCHIVE_URL_PREFIX, '').split('/'));

const fileSize = (file) => {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
};

const itemLabel = (invoiceSrNo, itemSrNo) => `Item ${invoiceSrNo || ''}/${itemSrNo || ''}`;
const importItemDocFor = (item) => (item.invSrNo || item.itemSrNo ? itemLabel(item.invSrNo, item.itemSrNo) : 'Item');

function queueDocFor(row, base) {
  if (row.docFor === 'INVOICE') return 'Invoice ' + (row.invSrNo || '');
  if (row.docFor === 'ITEM' && (row.invSrNo || row.itemSrNo)) return itemLabel(row.invSrNo, row.itemSrNo);
  return base.docFor || (row.docFor === 'ITEM' ? 'Item' : 'BE');
}

function isWaitingForSignature(row) {
  if (!row || typeof row !== 'object' || !row.fileUrl || row.signedOnly || isIrn(row.irn)) return false;
  const fileUrl = String(row.fileUrl);
  if (!esanchitArchive.URL_RX.test(fileUrl) || !/\.pdf$/i.test(fileUrl)) return false;
  if (/_signed\.pdf$/i.test(fileUrl) || /^signed_/i.test(String(row.fileName || ''))) return false;
  return !esanchitArchive.signedOf(row.fileUrl);
}

/** The e-Sanchit rows of a job / item whose PDF is in the archive and not signed yet. */
function rowsWaitingForSignature(list, base) {
  const waiting = [];
  (Array.isArray(list) ? list : []).forEach((row) => {
    if (!isWaitingForSignature(row)) return;
    const file = archivePathOf(row.fileUrl);
    if (!fs.existsSync(file)) return;
    waiting.push({
      ...base,
      kind: 'ESANCHIT_PDF',
      key: row.fileUrl,
      fileUrl: row.fileUrl,
      fileName: row.fileName || path.basename(row.fileUrl),
      docCode: row.docCode || '',
      docFor: queueDocFor(row, base),
      issuer: row.issuerName || '',
      size: fileSize(file),
      attachedAt: attachedAt(row.fileUrl),
    });
  });
  return waiting;
}

const importJobBase = (job) => ({
  module: 'Import',
  jobId: job.id,
  jobNo: job.jobNo,
  party: job.nameOfImporter || '',
  branch: job.branchCode || '',
});
const importItemBase = (item) => ({
  module: 'Import',
  jobId: item.jobId,
  jobNo: item.jobNo,
  party: item.nameOfImporter || '',
  branch: item.branchCode || '',
});

async function importPdfsWaiting(access) {
  const waiting = [];
  for (const job of access.import ? await selectRows(IMPORT_JOBS_WITH_PDFS_SQL) : []) {
    const extended = parseJson(job.extendedData, {});
    waiting.push(...rowsWaitingForSignature(parseJson(extended.esanchitDocs, []), importJobBase(job)));
  }
  for (const item of access.import ? await selectRows(IMPORT_ITEMS_WITH_PDFS_SQL) : []) {
    const extended = parseJson(item.extendedData, {});
    waiting.push(
      ...rowsWaitingForSignature(parseJson(extended.docsData, []), {
        ...importItemBase(item),
        docFor: importItemDocFor(item),
      }),
    );
  }
  return waiting;
}

async function exportPdfsWaiting(access) {
  const waiting = [];
  for (const job of access.export ? await selectRows(EXPORT_JOBS_WITH_PDFS_SQL) : []) {
    const base = { module: 'Export', jobId: job.id, jobNo: job.jobNo, party: job.shipperName || '', docFor: 'SB' };
    waiting.push(...rowsWaitingForSignature(parseJson(job.eSanchitList, []), base));
  }
  for (const item of access.export ? await selectRows(EXPORT_ITEMS_WITH_PDFS_SQL) : []) {
    const base = {
      module: 'Export',
      jobId: item.jobId,
      jobNo: item.jobNo,
      party: item.shipperName || '',
      docFor: itemLabel(item.invSr, item.itemSr),
    };
    waiting.push(...rowsWaitingForSignature(parseJson(item.eSanchitList, []), base));
  }
  return waiting;
}

const amendmentQueueRow = (amendment) => ({
  kind: 'BE_AMEND',
  key: 'amend:' + amendment.id,
  id: amendment.id,
  module: 'BE amendment',
  jobNo: amendment.parentJobNo || '',
  amendNo: amendment.amendNo,
  beNo: amendment.beNo || '',
  beDate: amendment.beDate || '',
  fileName: (amendment.fileName || String(amendment.amendNo)) + '',
  codes: parseJson(amendment.codes, []),
  status: amendment.status,
  fileMadeAt: amendment.fileMadeAt,
});

async function amendmentsWaiting(access) {
  if (!access.import) return [];
  try {
    return (await selectRows(UNSIGNED_AMENDMENTS_SQL)).map(amendmentQueueRow);
  } catch {
    return [];
  }
}

// the same PDF can sit on a job row and an item row (copied): it is listed once
function onePerKey(rows) {
  const seen = new Set();
  return rows.filter((row) => (seen.has(row.key) ? false : seen.add(row.key)));
}

/** GET /queue: e-Sanchit PDFs on jobs not signed yet, and BE amendment files made and not signed. */
export async function listSigningQueue(user) {
  const access = await divisionAccess(user);
  const waiting = [...(await importPdfsWaiting(access)), ...(await exportPdfsWaiting(access))];
  const esanchit = onePerKey(waiting);
  const amendments = await amendmentsWaiting(access);
  esanchit.sort((a, b) => String(b.attachedAt || '').localeCompare(String(a.attachedAt || '')));
  return { success: true, user: signerUserName(user), at: new Date().toISOString(), access, esanchit, amendments };
}

/** The archive folder / file an EagleView e-Sanchit PDF url points at, or a 400 for anything else. */
function archivedPdfOf(fileUrl) {
  const match = esanchitArchive.URL_RX.exec(fileUrl);
  if (!match || !esanchitArchive.safeFile(match[2]))
    throw new BadRequestError('Not an e-Sanchit PDF of EagleView: ' + fileUrl);
  return { folder: match[1], file: match[2] };
}

const hasPdfHead = (buffer) => buffer.slice(0, PDF_HEAD_BYTES).indexOf('%PDF') >= 0;

/** POST /esanchit: the signed copy of one archived PDF, filed next to it and noted in _signed.json. */
export async function saveSignedPdf(user, formFields, uploadedFile) {
  const fileUrl = String((formFields || {}).fileUrl || '');
  const { folder, file } = archivedPdfOf(fileUrl);
  const folderPath = path.join(esanchitArchive.ROOT, folder);
  if (!fs.existsSync(path.join(folderPath, file)))
    throw new NotFoundError('The original PDF is no longer there: ' + file);
  await assertMayHandlePdf(user, folder, file);
  if (!uploadedFile || !uploadedFile.buffer || !hasPdfHead(uploadedFile.buffer))
    throw new BadRequestError('No signed PDF received');
  const alreadySigned = esanchitArchive.signedOf(fileUrl);
  if (alreadySigned) {
    throw new ConflictError('This PDF was already signed', {
      body: { success: false, error: 'This PDF was already signed', ...alreadySigned },
    });
  }

  const signedFile = file.replace(/\.pdf$/i, '') + '_signed.pdf';
  fs.writeFileSync(path.join(folderPath, signedFile), uploadedFile.buffer);
  const info = {
    signer: String((formFields || {}).signer || '').slice(0, SIGNER_NAME_LENGTH),
    by: signerUserName(user),
    at: new Date().toISOString(),
    size: uploadedFile.buffer.length,
  };
  esanchitArchive.noteSigned(fileUrl, signedFile, info);
  console.log(`[signer] ${folder}/${file} signed by ${info.signer || '?'} (EagleView user ${info.by})`);
  return {
    success: true,
    fileUrl: ARCHIVE_URL_PREFIX + folder + '/' + signedFile,
    fileName: signedFile,
    ...info,
    over2mb: uploadedFile.buffer.length > TWO_MB,
  };
}

const findAmendment = async (columns, id) =>
  (await selectRows(`SELECT ${columns} FROM BeAmendments WHERE id = ?`, [id]))[0];

/** GET /amend/:id: the amendment's file (base64) to sign. */
export async function getAmendmentFileToSign(user, amendmentId) {
  await assertDivisionRight(user, 'Import', BE_AMENDMENT_RIGHT_DETAIL);
  const amendment = await findAmendment('id, amendNo, fileName, fileText, status, fileMadeAt', amendmentId);
  if (!amendment) throw new NotFoundError('Amendment not found');
  if (!amendment.fileText) throw new BadRequestError('Make the file first');
  if (!OPEN_AMENDMENT_STATUSES.includes(amendment.status))
    throw new ConflictError(`Amendment ${amendment.amendNo} is ${amendment.status}`);
  return {
    success: true,
    id: amendment.id,
    amendNo: amendment.amendNo,
    fileName: amendment.fileName,
    fileMadeAt: amendment.fileMadeAt,
    data_b64: Buffer.from(amendment.fileText, 'latin1').toString('base64'),
  };
}

function checkSignedEnvelope(amendment, signedB64) {
  if (!SIGNED_ENVELOPE_PATTERN.test(signedB64)) throw new BadRequestError('No signed file received');
  // the signed envelope must carry exactly this file
  if (Buffer.from(signedB64, 'base64').indexOf(Buffer.from(amendment.fileText, 'latin1')) < 0) {
    throw new BadRequestError('The signed file does not contain this amendment file');
  }
}

/** POST /amend/:id: the signed amendment file kept with the amendment (same rules as /api/be-amendments/:id/sign). */
export async function saveSignedAmendment(user, amendmentId, request) {
  await assertDivisionRight(user, 'Import', BE_AMENDMENT_RIGHT_DETAIL);
  const fields = request || {};
  const amendment = await findAmendment('id, amendNo, fileText, status, fileMadeAt', amendmentId);
  if (!amendment) throw new NotFoundError('Amendment not found');
  if (!OPEN_AMENDMENT_STATUSES.includes(amendment.status)) {
    throw new ConflictError(`Amendment ${amendment.amendNo} is ${amendment.status} - its file is not signed again`);
  }
  if (!amendment.fileText) throw new BadRequestError('Make the file first');
  if (fields.fileMadeAt && String(fields.fileMadeAt) !== String(amendment.fileMadeAt)) {
    throw new ConflictError(
      `The file of amendment ${amendment.amendNo} was made again after it was opened for signing` +
        ' - refresh the list and sign the new file',
    );
  }
  const signedB64 = String(fields.signed_b64 || '');
  checkSignedEnvelope(amendment, signedB64);

  const now = sqliteNow();
  const userName = signerUserName(user);
  await sequelize.query(
    'UPDATE BeAmendments SET signedFileB64 = ?, signedAt = ?, signer = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
    {
      replacements: [
        signedB64,
        now,
        String(fields.signer_cn || '').slice(0, SIGNER_NAME_LENGTH),
        userName,
        now,
        amendment.id,
      ],
    },
  );
  console.log(
    `[signer] BE amendment ${amendment.amendNo} signed by ${fields.signer_cn || '?'} (EagleView user ${userName})`,
  );
  return { success: true, amendNo: amendment.amendNo };
}

const firstFilled = (...values) => {
  for (const value of values) if (value != null && String(value).trim() !== '') return String(value).trim();
  return '';
};

/** yyyy-mm-dd of an ISO / dd-mm-yyyy / other date text ('' when it is not a date). */
export function isoDay(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return iso[0];
  const dayFirst = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`;
  const date = new Date(text);
  return isNaN(date) ? '' : date.toISOString().slice(0, 10);
}

const hasSignedName = (row) =>
  /_signed\.pdf$/i.test(String(row.fileUrl || '')) || /^signed_/i.test(path.basename(String(row.fileUrl || '')));

/** The name a PDF gets on the e-Sanchit portal: <job>_<code>_<7 digits of its time>, unique within the job. */
function portalNameOf(jobNo, docCode, fileUrl, usedNames) {
  const baseName = path.basename(String(fileUrl));
  const attachedTime = (/_(\d{13})_/.exec(baseName) || [])[1];
  const clean = (text) =>
    String(text || '')
      .replace(/[^A-Za-z0-9-]+/g, '_')
      .replace(/^_+|_+$/g, '');
  const name = [
    clean(jobNo).slice(0, 20) || 'JOB',
    clean(docCode).slice(0, 6) || 'DOC',
    attachedTime ? attachedTime.slice(-7) : String(Date.now()).slice(-7),
  ].join('_');
  let candidate = name;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) candidate = name + '_' + counter++;
  usedNames.add(candidate.toLowerCase());
  return candidate + '.pdf';
}

function uploadDocFor(row, base) {
  if (row.docFor === 'INVOICE') return 'Invoice ' + (row.invSrNo || '');
  if ((row.docFor === 'ITEM' || row.docFor === 'Item') && (row.invSrNo || row.itemSrNo))
    return itemLabel(row.invSrNo, row.itemSrNo);
  return base.docFor || 'Item';
}

const issuerOf = (row, icegate) => ({
  code: firstFilled(row.issuerCode, icegate.documentIssuingPartyCode),
  name: firstFilled(row.issuerName, row.issuingParty, icegate.documentIssuingPartyName),
  addr1: firstFilled(row.issuerAddr1, row.issuerAddress1, row.issuerAddress, icegate.documentIssuingPartyNameAddress1),
  addr2: firstFilled(row.issuerAddr2, row.issuerAddress2, icegate.documentIssuingPartyNameAddress2),
  city: firstFilled(row.issuerCity, icegate.documentIssuingPartyNameCity),
  pin: firstFilled(row.issuerPin, icegate.documentIssuingPartyNamePin),
});

const beneficiaryOf = (row, icegate) => ({
  code: firstFilled(row.beneCode, row.beneficiaryCode, icegate.documentBeneficiaryPartyCode),
  name: firstFilled(row.beneName, row.beneficiaryName, row.beneficiaryParty, icegate.documentBeneficiaryPartyName),
  addr1: firstFilled(row.beneAddr1, row.beneficiaryAddress1, icegate.documentBeneficiaryPartyNameAddress1),
  addr2: firstFilled(row.beneAddr2, row.beneficiaryAddress2, icegate.documentBeneficiaryPartyNameAddress2),
  city: firstFilled(row.beneCity, row.beneficiaryCity, icegate.documentBeneficiaryPartyNameCity),
  pin: firstFilled(row.benePin, row.beneficiaryPin, icegate.documentBeneficiaryPartyNamePin),
});

function missingUploadDetails(document) {
  const missing = [];
  if (!document.docCode) missing.push('document code');
  if (!document.issuer.name) missing.push('issuing party name');
  if (!document.placeOfIssue) missing.push('place of issue');
  if (!document.issueDate) missing.push('issue date');
  if (!document.bene.name) missing.push('beneficiary name');
  if (document.otherId && !document.icegateId) missing.push('ICEGATE ID (marked different)');
  return missing;
}

/**
 * The signed copy of a row's PDF: the one noted in _signed.json first (a PDF that came already signed has "_signed"
 * in its own name too, and its copy noted at signing is the one the tool and the job screen point at), else a row
 * that itself points at a signed file.
 */
function signedCopyOf(row) {
  const noted = esanchitArchive.signedOf(String(row.fileUrl));
  if (noted)
    return { url: noted.url, signer: noted.signer || row.signedBy || '', signedAt: noted.at || row.signedAt || '' };
  if (!hasSignedName(row)) return null;
  return { url: String(row.fileUrl), signer: row.signedBy || '', signedAt: row.signedAt || '' };
}

function uploadDocumentOf(row, base, names) {
  if (!row || typeof row !== 'object' || !row.fileUrl || isIrn(row.irn)) return null;
  if (!esanchitArchive.URL_RX.test(String(row.fileUrl)) || !/\.pdf$/i.test(String(row.fileUrl))) return null;
  const signed = signedCopyOf(row);
  if (!signed || esanchitArchive.irnOf(signed.url)) return null;
  const match = esanchitArchive.URL_RX.exec(signed.url);
  if (!match || !esanchitArchive.safeFile(match[2])) return null;
  let size;
  try {
    size = fs.statSync(path.join(esanchitArchive.ROOT, match[1], match[2])).size;
  } catch {
    return null;
  }
  const icegate = row._icegate || {};
  const differentId = !!(row.isDiffId || row.icegateDifferent);
  const document = {
    key: signed.url,
    fileUrl: signed.url,
    fileName: match[2],
    size,
    signer: signed.signer,
    signedAt: signed.signedAt,
    docCode: firstFilled(row.docCode),
    docName: firstFilled(row.docName, names[firstFilled(row.docCode)]),
    docFor: uploadDocFor(row, base),
    issuer: issuerOf(row, icegate),
    bene: beneficiaryOf(row, icegate),
    placeOfIssue: firstFilled(row.placeOfIssue, row.issueLocation, icegate.placeOfIssue),
    issueDate: isoDay(firstFilled(row.issueDate, row.date, icegate.documentIssueDate)),
    expiryDate: isoDay(firstFilled(row.expiryDate, icegate.documentExpiryDate)),
    otherId: differentId,
    icegateId: differentId ? firstFilled(row.icegateId) : '',
  };
  document.missing = missingUploadDetails(document);
  if (size > TWO_MB) document.tooBig = true;
  return document;
}

/** The signed e-Sanchit PDFs of a job / item row that have no IRN yet, with the details ICEGATE asks for. */
function rowsToUpload(list, base, names, uploads) {
  (Array.isArray(list) ? list : []).forEach((row) => {
    const document = uploadDocumentOf(row, base, names);
    if (document) uploads.push({ ...base, doc: document });
  });
}

async function collectSignedDocuments(access, names) {
  const uploads = [];
  for (const job of access.import ? await selectRows(IMPORT_JOBS_WITH_PDFS_AND_BE_SQL) : []) {
    const extended = parseJson(job.extendedData, {});
    rowsToUpload(parseJson(extended.esanchitDocs, []), { ...importJobBase(job), docFor: 'BE' }, names, uploads);
  }
  for (const item of access.import ? await selectRows(IMPORT_ITEMS_WITH_PDFS_SQL) : []) {
    const extended = parseJson(item.extendedData, {});
    rowsToUpload(
      parseJson(extended.docsData, []),
      { ...importItemBase(item), docFor: importItemDocFor(item) },
      names,
      uploads,
    );
  }
  for (const job of access.export ? await selectRows(EXPORT_JOBS_WITH_PDFS_SQL) : []) {
    const base = {
      module: 'Export',
      jobId: job.id,
      jobNo: job.jobNo,
      party: job.shipperName || '',
      branch: '',
      docFor: 'SB',
    };
    rowsToUpload(parseJson(job.eSanchitList, []), base, names, uploads);
  }
  for (const item of access.export ? await selectRows(EXPORT_ITEMS_WITH_PDFS_SQL) : []) {
    const base = {
      module: 'Export',
      jobId: item.jobId,
      jobNo: item.jobNo,
      party: item.shipperName || '',
      branch: '',
      docFor: itemLabel(item.invSr, item.itemSr),
    };
    rowsToUpload(parseJson(item.eSanchitList, []), base, names, uploads);
  }
  return uploads;
}

function groupByJob(uploads) {
  const jobs = new Map();
  const seen = new Set();
  for (const upload of uploads) {
    if (seen.has(upload.doc.key)) continue;
    seen.add(upload.doc.key);
    const jobKey = upload.module + ':' + upload.jobId;
    if (!jobs.has(jobKey)) {
      jobs.set(jobKey, {
        key: jobKey,
        module: upload.module,
        jobId: upload.jobId,
        jobNo: upload.jobNo,
        party: upload.party,
        branch: upload.branch,
        docs: [],
        used: new Set(),
      });
    }
    jobs.get(jobKey).docs.push(upload.doc);
  }
  return [...jobs.values()];
}

function finishJob(job) {
  job.docs.sort((a, b) => String(attachedAt(a.fileUrl) || '').localeCompare(String(attachedAt(b.fileUrl) || '')));
  job.docs.forEach((document) => {
    document.portalName = portalNameOf(job.jobNo, document.docCode, document.fileUrl, job.used);
  });
  delete job.used;
  job.latest = job.docs.reduce(
    (latest, document) => (String(document.signedAt || '') > latest ? String(document.signedAt || '') : latest),
    '',
  );
  return job;
}

/**
 * GET /upload-queue: signed e-Sanchit PDFs without an IRN, per job. EagleView Signer opens ICEGATE e-Sanchit in its
 * own window (the user logs in himself), puts a job's PDFs in, fills each document's details, and the user submits.
 */
export async function listUploadQueue(user) {
  const access = await divisionAccess(user);
  const names = await documentNames();
  const uploads = await collectSignedDocuments(access, names);
  const jobs = groupByJob(uploads)
    .map(finishJob)
    .sort((a, b) => b.latest.localeCompare(a.latest));
  return { success: true, user: signerUserName(user), at: new Date().toISOString(), access, jobs };
}

/** A 16-digit e-Sanchit number starts with the date it was given (YYYYMMDD): recent, not in the future. */
function numberDateIsPlausible(number) {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(number);
  if (!match) return false;
  const day = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${day}T00:00:00Z`);
  if (isNaN(date) || date.toISOString().slice(0, 10) !== day) return false;
  return (
    date.getTime() <= Date.now() + NUMBER_DATE_FUTURE_DAYS * DAY_MS &&
    date.getTime() >= Date.now() - NUMBER_DATE_PAST_DAYS * DAY_MS
  );
}

const withoutSpaces = (value) => String(value || '').replace(/\s/g, '');

function checkIrnAndDrn(irn, drn) {
  if (!isIrn(irn) || !numberDateIsPlausible(irn)) {
    throw new BadRequestError(
      'IRN should be the 16-digit number from e-Sanchit (it starts with the date, YYYYMMDD): ' + irn,
    );
  }
  if (drn && (!isIrn(drn) || !numberDateIsPlausible(drn))) throw new BadRequestError('DRN should be 16 digits: ' + drn);
}

/** POST /irn: the IRN ICEGATE e-Sanchit gave a signed PDF, noted in _irn.json (put on the job row at every read). */
export async function noteIrn(user, request) {
  const fields = request || {};
  const fileUrl = String(fields.fileUrl || '');
  const irn = withoutSpaces(fields.irn);
  const drn = withoutSpaces(fields.drn);
  const { folder, file } = archivedPdfOf(fileUrl);
  if (!fs.existsSync(path.join(esanchitArchive.ROOT, folder, file)))
    throw new NotFoundError('The PDF is no longer there: ' + file);
  await assertMayHandlePdf(user, folder, file);
  checkIrnAndDrn(irn, drn);

  const noted = esanchitArchive.irnOf(fileUrl);
  if (noted && noted.irn === irn) return { success: true, already: true, irn, drn: noted.drn || drn };
  if (noted) throw new ConflictError(`This PDF already has IRN ${noted.irn}`);
  const usedBy = esanchitArchive.irnUsed(irn);
  if (usedBy) throw new ConflictError(`IRN ${irn} is already noted for ${usedBy.dir}/${usedBy.file}`);

  const info = {
    irn,
    drn: isIrn(drn) ? drn : '',
    by: signerUserName(user),
    at: new Date().toISOString(),
    icegateId: String(fields.icegateId || '').slice(0, 40),
    portalName: String(fields.portalName || '').slice(0, 120),
    via: String(fields.via || 'EagleView Signer').slice(0, 40),
  };
  esanchitArchive.noteIrn(fileUrl, info);
  console.log(
    `[signer] ${folder}/${file} -> e-Sanchit IRN ${irn}${info.drn ? ' DRN ' + info.drn : ''} (EagleView user ${info.by})`,
  );
  return { success: true, irn, drn: info.drn, at: info.at };
}
