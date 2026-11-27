import fs from 'node:fs';
import path from 'node:path';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import * as esanchitArchive from '../../../utils/customs/esanchitArchive.js';
import { assertDivisionRight, selectRows, signerUserName } from './signerAccess.service.js';
import { ARCHIVE_URL_PREFIX, documentNames, isIrn, isoDay, parseJson, sqliteNow } from './signerQueue.service.js';

const TWO_MB = 2 * 1024 * 1024;
const SEARCH_TEXT_LENGTH = 40;
const DOCUMENT_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const IMPORT_DOC_FOR = ['HEADER', 'INVOICE', 'ITEM'];
const SR_NO_LENGTH = 4;
const ADDED_VIA = 'EagleView Signer';
const PDF_MAGIC = '%PDF-';

/** "Export" or (anything else) "Import". */
const divisionOf = (value) => (String(value || '') === 'Export' ? 'Export' : 'Import');

/** Upper case, trimmed, cut to the ICEGATE field length. */
const upperField = (value, length) =>
  String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .slice(0, length);

/** yyyy-mm-dd, or '' for anything that is not a date. */
const isoDayOnly = (value) => {
  const day = isoDay(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
};

const cleanAddressPart = (text) =>
  String(text == null ? '' : text)
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
    .trim()
    .toUpperCase();

/**
 * City of the supplier. Address 3 is the city as a rule ("UNNA", "KOWLOON,"); when it holds only the country or
 * nothing, the city is the last word before the comma of address 2 ("UNIT 111 ATLANTA, GA"), else blank.
 */
function supplierCity(address2, address3, ...countries) {
  const thirdLine = cleanAddressPart(address3);
  const countryNames = countries.map(cleanAddressPart).filter(Boolean);
  if (thirdLine && !countryNames.includes(thirdLine)) return thirdLine.slice(0, 35);
  const match = /([A-Z][A-Z .'-]{2,})\s*,[^,]*$/i.exec(String(address2 || ''));
  const lastWord = match ? match[1].trim().split(/\s+/).pop() : '';
  return /^[A-Z]{3,}$/i.test(lastWord) && !countryNames.includes(lastWord.toUpperCase()) ? lastWord.toUpperCase() : '';
}

/** The date of the HAWB / MAWB of an import job (columns, else the first IGM row). */
function transportDates(job) {
  let igmRows;
  try {
    igmRows = JSON.parse(job._igmRows || '[]') || [];
  } catch {
    igmRows = [];
  }
  const firstWithDate =
    (Array.isArray(igmRows) ? igmRows : []).find((row) => row && (row.hawbDate || row.mawbDate)) || {};
  return {
    house: isoDayOnly(job.hawbDate) || isoDayOnly(firstWithDate.hawbDate),
    master: isoDayOnly(job.mawbDate) || isoDayOnly(firstWithDate.mawbDate),
  };
}

const likePattern = (text) => '%' + text.replace(/[%_]/g, (character) => '\\' + character) + '%';

async function findImportJobs(text, pattern) {
  const textFilter = text
    ? "AND (jobNo LIKE ? ESCAPE '\\' OR nameOfImporter LIKE ? ESCAPE '\\' OR beNo LIKE ? ESCAPE '\\' OR beNumber LIKE ? ESCAPE '\\')"
    : '';
  const jobs = await selectRows(
    `SELECT id, jobNo, nameOfImporter, iecCode, address1, address2, autoField_6, autoField_7, autoField_8, autoField_10, branchCode, beNo, beNumber, beDate, status, hawbDate, mawbDate, _igmRows
          FROM ImportJobs WHERE jobNo IS NOT NULL AND jobNo <> 'DRAFT' ${textFilter}
          ORDER BY id DESC LIMIT 25`,
    text ? [pattern, pattern, pattern, pattern] : [],
  );
  return jobs.map((job) => ({
    module: 'Import',
    jobId: job.id,
    jobNo: job.jobNo,
    party: job.nameOfImporter || '',
    branch: job.branchCode || '',
    no: job.beNo || job.beNumber || '',
    date: job.beDate || '',
    status: job.status || '',
    bene: {
      code: upperField(job.iecCode, 15),
      name: upperField(job.nameOfImporter, 70),
      addr1: upperField(job.autoField_6 || job.address1, 70),
      addr2: upperField(job.autoField_7 || job.address2, 70),
      city: upperField(job.autoField_8, 35),
      pin: upperField(job.autoField_10, 10),
    },
    place: '',
    docDates: transportDates(job),
  }));
}

async function findExportJobs(text, pattern) {
  const textFilter = text
    ? "AND (jobNo LIKE ? ESCAPE '\\' OR shipperName LIKE ? ESCAPE '\\' OR sbNo LIKE ? ESCAPE '\\')"
    : '';
  const jobs = await selectRows(
    `SELECT id, jobNo, shipperName, shipperIec, shipperAddress1, shipperAddress2, shipperCity, shipperPin, branchCode, sbNo, sbDate, status
          FROM ExportJobs WHERE jobNo IS NOT NULL AND jobNo <> 'DRAFT' ${textFilter}
          ORDER BY id DESC LIMIT 25`,
    text ? [pattern, pattern, pattern] : [],
  );
  return jobs.map((job) => ({
    module: 'Export',
    jobId: job.id,
    jobNo: job.jobNo,
    party: job.shipperName || '',
    branch: job.branchCode || '',
    no: job.sbNo || '',
    date: job.sbDate || '',
    status: job.status || '',
    bene: {
      code: upperField(job.shipperIec, 15),
      name: upperField(job.shipperName, 70),
      addr1: upperField(job.shipperAddress1, 70),
      addr2: upperField(job.shipperAddress2, 70),
      city: upperField(job.shipperCity, 35),
      pin: upperField(job.shipperPin, 10),
    },
    place: upperField(job.shipperCity, 35),
  }));
}

async function countryNamesByCode() {
  const names = {};
  try {
    for (const country of await selectRows('SELECT code, name FROM Countries'))
      names[String(country.code || '').toUpperCase()] = String(country.name || '').toUpperCase();
  } catch {
    return {};
  }
  return names;
}

function groupInvoicesByJob(invoices) {
  const byJob = {};
  for (const invoice of invoices) (byJob[invoice.jobId] = byJob[invoice.jobId] || []).push(invoice);
  return byJob;
}

/** Import: each invoice's supplier is an issuing party; place of issue = his country, issue date = invoice date. */
async function addImportIssuers(jobs, jobIds, placeholders) {
  const countries = await countryNamesByCode();
  const countryName = (value) => {
    const code = String(value || '')
      .trim()
      .toUpperCase();
    return countries[code] || code;
  };
  const invoicesByJob = groupInvoicesByJob(
    await selectRows(
      `SELECT importJobId AS jobId, id, invSrNo, invoiceNo, invoiceDate, supplierName, supplierAddress1, supplierAddress2, supplierAddress3, supplierPin, supplierCountry, supplierCountryName
            FROM ImportInvoices WHERE importJobId IN (${placeholders}) ORDER BY importJobId, id`,
      jobIds,
    ),
  );
  jobs.forEach((job) => {
    job.issuers = (invoicesByJob[job.jobId] || [])
      .filter((invoice) => String(invoice.supplierName || '').trim())
      .map((invoice, index) => {
        const supplierCountry = countryName(invoice.supplierCountryName || invoice.supplierCountry);
        return {
          label: `Invoice ${invoice.invSrNo || index + 1}${invoice.invoiceNo ? ' - ' + invoice.invoiceNo : ''}`,
          name: upperField(invoice.supplierName, 70),
          addr1: upperField(invoice.supplierAddress1, 70),
          addr2: upperField(invoice.supplierAddress2, 70),
          city: supplierCity(
            invoice.supplierAddress2,
            invoice.supplierAddress3,
            invoice.supplierCountryName,
            invoice.supplierCountry,
            supplierCountry,
          ),
          pin: upperField(invoice.supplierPin, 10),
          place: upperField(supplierCountry, 35),
          date: isoDayOnly(invoice.invoiceDate),
        };
      });
  });
}

/** Export: the exporter himself issues the documents (place = his city), one entry per invoice. */
async function addExportIssuers(jobs, jobIds, placeholders) {
  const invoicesByJob = groupInvoicesByJob(
    await selectRows(
      `SELECT exportJobId AS jobId, id, invoiceNo, invoiceDate FROM ExportInvoices WHERE exportJobId IN (${placeholders}) ORDER BY exportJobId, id`,
      jobIds,
    ),
  );
  jobs.forEach((job) => {
    const exporter = job.bene;
    const invoices = invoicesByJob[job.jobId] || [];
    job.issuers = (invoices.length ? invoices : [{}]).map((invoice, index) => ({
      label: invoices.length
        ? `Exporter - invoice ${index + 1}${invoice.invoiceNo ? ' ' + invoice.invoiceNo : ''}`
        : 'Exporter',
      name: exporter.name,
      code: exporter.code,
      addr1: exporter.addr1,
      addr2: exporter.addr2,
      city: exporter.city,
      pin: exporter.pin,
      place: job.place,
      date: isoDayOnly(invoice.invoiceDate),
    }));
  });
}

/** GET /jobs?module=&q=: jobs to add a document to, with the beneficiary and issuing parties from the job. */
export async function searchJobs(user, query) {
  const division = divisionOf(query.module);
  await assertDivisionRight(user, division);
  const text = String(query.q || '')
    .trim()
    .slice(0, SEARCH_TEXT_LENGTH);
  const pattern = likePattern(text);
  const jobs = division === 'Import' ? await findImportJobs(text, pattern) : await findExportJobs(text, pattern);
  if (jobs.length) {
    const jobIds = jobs.map((job) => job.jobId);
    const placeholders = jobIds.map(() => '?').join(',');
    if (division === 'Import') await addImportIssuers(jobs, jobIds, placeholders);
    else await addExportIssuers(jobs, jobIds, placeholders);
  }
  return { success: true, module: division, jobs };
}

/** GET /doc-codes: the e-Sanchit document codes of the master. */
export async function listDocumentCodes() {
  const names = await documentNames();
  return {
    success: true,
    codes: Object.entries(names)
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}

async function checkedDocumentCode(row) {
  const code = String(row.docCode || '')
    .trim()
    .toUpperCase();
  if (!DOCUMENT_CODE_PATTERN.test(code)) throw new BadRequestError('Choose the document code (6 characters)');
  const names = await documentNames();
  if (Object.keys(names).length && !names[code])
    throw new BadRequestError(`Document code ${code} is not in the e-Sanchit master`);
  return { code, names };
}

/** Import documents are for the BE, an invoice or an item; export documents for the SB. */
function importDocumentTarget(row) {
  const requested = String(row.docFor || '').toUpperCase();
  const docFor = IMPORT_DOC_FOR.includes(requested) ? String(row.docFor).toUpperCase() : 'HEADER';
  const invSrNo =
    docFor === 'HEADER'
      ? ''
      : String(row.invSrNo || '')
          .replace(/\D/g, '')
          .slice(0, SR_NO_LENGTH);
  const itemSrNo =
    docFor === 'ITEM'
      ? String(row.itemSrNo || '')
          .replace(/\D/g, '')
          .slice(0, SR_NO_LENGTH)
      : '';
  if (docFor !== 'HEADER' && !invSrNo) throw new BadRequestError('Choose the invoice the document is for');
  if (docFor === 'ITEM' && !itemSrNo) throw new BadRequestError('Type the item sr no the document is for');
  return { docFor, invSrNo, itemSrNo };
}

async function findJobForDocument(division, jobId) {
  const table = division === 'Import' ? 'ImportJobs' : 'ExportJobs';
  const listColumn = division === 'Import' ? 'extendedData' : 'eSanchitList';
  const job = (await selectRows(`SELECT id, jobNo, ${listColumn} AS list FROM ${table} WHERE id = ?`, [jobId]))[0];
  if (!job || !job.jobNo || job.jobNo === 'DRAFT') throw new NotFoundError('Job not found');
  return job;
}

/** The PDF next to the job's other e-Sanchit PDFs: <code>_noirn_<time>_<name>.pdf ("signed" names are for signed copies). */
function storeDocumentPdf(job, code, uploadedFile) {
  const folder = esanchitArchive.safeName(job.jobNo, 'misc');
  const originalName = path
    .basename(String(uploadedFile.originalname || 'document.pdf'))
    .replace(/\.pdf$/i, '')
    .replace(/([_ -]+signed)+$/i, '')
    .replace(/^(signed[_ -]+)+/i, '');
  const file = `${code}_noirn_${Date.now()}_${esanchitArchive.safeName(originalName, 'document')}.pdf`;
  fs.mkdirSync(path.join(esanchitArchive.ROOT, folder), { recursive: true });
  fs.writeFileSync(path.join(esanchitArchive.ROOT, folder, file), uploadedFile.buffer);
  return { file, fileUrl: ARCHIVE_URL_PREFIX + folder + '/' + file };
}

function commonDocumentFields(row, details, userName) {
  const issuer = row.issuer || {};
  return {
    irn: details.irn,
    drn: details.drn,
    docCode: details.code,
    docName: details.names[details.code] || String(row.docName || '').slice(0, 120),
    fileName: details.file,
    fileUrl: details.fileUrl,
    fileType: 'PDF',
    issuerCode: upperField(issuer.code, 15),
    issuerName: upperField(issuer.name, 70),
    issuerCity: upperField(issuer.city, 35),
    issuerPin: upperField(issuer.pin, 10),
    placeOfIssue: upperField(row.placeOfIssue, 35),
    issueDate: isoDayOnly(row.issueDate),
    expiryDate: isoDayOnly(row.expiryDate),
    icegateId: row.otherId ? upperField(row.icegateId, 25) : '',
    addedBy: userName,
    addedAt: new Date().toISOString(),
    addedVia: ADDED_VIA,
  };
}

function importDocumentRow(row, common, target) {
  const issuer = row.issuer || {};
  const beneficiary = row.bene || {};
  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...common,
    docFor: target.docFor,
    invSrNo: target.invSrNo,
    itemSrNo: target.itemSrNo,
    issuerAddr1: upperField(issuer.addr1, 70),
    issuerAddr2: upperField(issuer.addr2, 70),
    beneCode: upperField(beneficiary.code, 15),
    beneName: upperField(beneficiary.name, 70),
    beneAddr1: upperField(beneficiary.addr1, 70),
    beneAddr2: upperField(beneficiary.addr2, 70),
    beneCity: upperField(beneficiary.city, 35),
    benePin: upperField(beneficiary.pin, 10),
    isDiffId: !!row.otherId,
    isApplicable: false,
  };
}

function exportDocumentRow(row, common) {
  const issuer = row.issuer || {};
  const beneficiary = row.bene || {};
  return {
    ...common,
    refNo: upperField(row.refNo, 35),
    docFor: 'SB',
    issuerAddress1: upperField(issuer.addr1, 70),
    issuerAddress2: upperField(issuer.addr2, 70),
    beneficiaryCode: upperField(beneficiary.code, 15),
    beneficiaryName: upperField(beneficiary.name, 70),
    beneficiaryAddress1: upperField(beneficiary.addr1, 70),
    beneficiaryAddress2: upperField(beneficiary.addr2, 70),
    beneficiaryCity: upperField(beneficiary.city, 35),
    beneficiaryPin: upperField(beneficiary.pin, 10),
    icegateDifferent: !!row.otherId,
  };
}

async function appendToImportJob(job, documentRow, userName) {
  const extended = parseJson(job.list, {}) || {};
  const savedAsText = typeof extended.esanchitDocs === 'string';
  const list = parseJson(extended.esanchitDocs, []) || [];
  list.push(documentRow);
  extended.esanchitDocs = savedAsText ? JSON.stringify(list) : list;
  await sequelize.query('UPDATE ImportJobs SET extendedData = ?, updatedAt = ?, updatedBy = ? WHERE id = ?', {
    replacements: [JSON.stringify(extended), sqliteNow(), userName, job.id],
  });
}

async function appendToExportJob(job, documentRow) {
  const list = parseJson(job.list, []) || [];
  list.push(documentRow);
  await sequelize.query('UPDATE ExportJobs SET eSanchitList = ?, updatedAt = ? WHERE id = ?', {
    replacements: [JSON.stringify(list), sqliteNow(), job.id],
  });
}

const isUploadedPdf = (uploadedFile) =>
  uploadedFile &&
  uploadedFile.buffer &&
  uploadedFile.buffer.slice(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC;

/**
 * POST /add-doc: a PDF picked in EagleView Signer is kept with the job and its row is added to the job's e-Sanchit
 * list (import: BE level esanchitDocs, export: SB level eSanchitList), as if attached on the job screen.
 */
export async function addDocumentToJob(user, formFields, uploadedFile) {
  const fields = formFields || {};
  const division = divisionOf(fields.module);
  await assertDivisionRight(user, division);
  if (!isUploadedPdf(uploadedFile)) throw new BadRequestError('Choose a PDF file (e-Sanchit takes PDF only)');
  const row = parseJson(fields.row, {}) || {};
  const { code, names } = await checkedDocumentCode(row);
  // a document already on e-Sanchit comes with its IRN / DRN
  const irn = String(row.irn || '').replace(/\s+/g, '');
  if (irn && !/^\d{16}$/.test(irn)) throw new BadRequestError('IRN must be 16 digits (or empty)');
  const drn = String(row.drn || '')
    .trim()
    .toUpperCase()
    .slice(0, 35);
  const target = division === 'Import' ? importDocumentTarget(row) : { docFor: 'HEADER', invSrNo: '', itemSrNo: '' };

  const job = await findJobForDocument(division, fields.jobId);
  const { file, fileUrl } = storeDocumentPdf(job, code, uploadedFile);
  const userName = signerUserName(user);
  const common = commonDocumentFields(row, { irn, drn, code, names, file, fileUrl }, userName);
  const documentRow = division === 'Import' ? importDocumentRow(row, common, target) : exportDocumentRow(row, common);
  if (division === 'Import') await appendToImportJob(job, documentRow, userName);
  else await appendToExportJob(job, documentRow);
  // a job screen opened before this cannot drop the row (esanchitArchive mergeAdded)
  esanchitArchive.noteAdded(fileUrl, documentRow, userName);
  console.log(
    `[signer] ${division} job ${job.jobNo}: e-Sanchit document ${code} added from EagleView Signer (${file}, user ${userName})`,
  );
  return {
    success: true,
    module: division,
    jobNo: job.jobNo,
    fileUrl,
    fileName: file,
    docCode: code,
    irn,
    docFor: target.docFor,
    size: uploadedFile.buffer.length,
    over2mb: uploadedFile.buffer.length > TWO_MB,
  };
}

function eSanchitRowsOf(division, jobRow) {
  const list =
    division === 'Import' ? parseJson((parseJson(jobRow.list, {}) || {}).esanchitDocs, []) : parseJson(jobRow.list, []);
  // the row's own file is kept (_raw): the tool matches its folder PDFs by that original
  const withOriginal = Array.isArray(list)
    ? list.map((row) => (row && typeof row === 'object' ? { ...row, _raw: row.fileUrl } : row))
    : [];
  return esanchitArchive.applyList(withOriginal);
}

function jobDocumentOf(row) {
  const url = String(row.fileUrl);
  const signedJustNow = row.signedOnly && row._raw && String(row._raw) !== url;
  const signed =
    signedJustNow ||
    (!esanchitArchive.signedOf(url) && (/_signed\.pdf$/i.test(url) || /^signed_/i.test(path.basename(url))));
  return {
    fileUrl: url,
    origUrl: signedJustNow ? String(row._raw) : signed ? url.replace(/_signed\.pdf$/i, '.pdf') : url,
    fileName: path.basename(url),
    docCode: row.docCode || '',
    irn: isIrn(row.irn) ? String(row.irn) : '',
    drn: isIrn(row.drn) ? String(row.drn) : '',
    signed,
    signer: row.signedBy || '',
    addedVia: row.addedVia || '',
  };
}

/** GET /job-docs?module=&jobId=: the job's BE / SB level e-Sanchit rows as the job screen shows them. */
export async function listJobDocuments(user, query) {
  const division = divisionOf(query.module);
  await assertDivisionRight(user, division);
  const sql =
    division === 'Import'
      ? 'SELECT id, jobNo, extendedData AS list FROM ImportJobs WHERE id = ?'
      : 'SELECT id, jobNo, eSanchitList AS list FROM ExportJobs WHERE id = ?';
  const jobRow = (await selectRows(sql, [query.jobId]))[0];
  if (!jobRow) throw new NotFoundError('Job not found');
  const rows = eSanchitRowsOf(division, jobRow);
  const docs = (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === 'object' && row.fileUrl)
    .map(jobDocumentOf);
  return { success: true, module: division, jobId: jobRow.id, jobNo: jobRow.jobNo, docs };
}
