import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../core/http/index.js';
import { JobTimeline } from '../../../models/index.js';
import { loadPerms } from '../../../middlewares/permissions.middleware.js';
import { effective } from '../../../utils/common/moduleCatalog.js';
import * as esanchitArchive from '../../../utils/customs/esanchitArchive.js';

const MODULE_NAMES = { import: 'Import', export: 'Export' };
const RIGHT_NAMES = { Import: 'Bill of Entry (Import)', Export: 'Shipping Bill (Export)' };
const OTHER_FOLDER = '_other';
const REMOVED_FOLDER = '_removed';
const OTHER_JSON = '_other.json';
const ESANCHIT_URL_PREFIX = '/uploads/esanchit_archive/';
const RECENTLY_ATTACHED_MS = 2 * 3600 * 1000;
const MAX_NAME_LENGTH = 120;
const MAX_REMARKS_LENGTH = 200;
const MAX_LOG_LENGTH = 4000;
const IRN_RX = /^\d{16}$/;
// <code>_<irn>_<ms>_<name>: the name every e-Sanchit PDF is filed under
const ESANCHIT_NAME_RX = /^([A-Za-z0-9]+)_([^_]*)_(\d{13})_/;
// office files only - nothing a browser would run (html / svg / js are never taken)
const OFFICE_FILE_RX = /\.(pdf|jpe?g|png|gif|bmp|tiff?|xlsx?|xlsm|csv|docx?|txt|rtf|odt|ods|zip|rar|7z|eml|msg)$/i;
export const DOC_TYPES = [
  'Invoice',
  'Packing List',
  'Airway Bill / Bill of Lading',
  'Certificate of Origin',
  'Insurance',
  'Purchase Order',
  'Delivery Order',
  'Duty Challan / Payment',
  'Out of Charge',
  'Gate Pass',
  'Licence / Permission',
  'Letter / Mail',
  'Photo',
  'Other',
];

const select = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

export const isJobFilesModule = (moduleName) => Object.hasOwn(MODULE_NAMES, String(moduleName || '').toLowerCase());

const parsedJson = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const readJsonFile = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    return {};
  }
};
const md5Of = (file) => {
  try {
    return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return '';
  }
};
// one name for the PDF as attached and all its signed copies
const stemOf = (fileName) => String(fileName).replace(/(_signed)*\.pdf$/i, '');

async function rightsOf(user, moduleName) {
  const currentUser = user || {};
  if (String(currentUser.role || '').toLowerCase() === 'admin') return { view: true, edit: true };
  let permissions = null;
  try {
    permissions = await loadPerms(currentUser.id);
  } catch {
    permissions = {};
  }
  // no rights saved yet = unrestricted, as everywhere in EagleView
  if (!permissions) return { view: true, edit: true };
  const right = effective(permissions, RIGHT_NAMES[moduleName]) || {};
  return { view: !!right.canView, edit: !!(right.canEdit || right.canCreate) };
}

const findJobRow = async (moduleName, jobId) =>
  moduleName === 'Import'
    ? (await select('SELECT id, jobNo, extendedData AS list FROM ImportJobs WHERE id = ?', [jobId]))[0]
    : (await select('SELECT id, jobNo, eSanchitList AS list FROM ExportJobs WHERE id = ?', [jobId]))[0];

/** The job and its folder in the e-Sanchit archive, after the view / edit right of the user is checked. */
export async function openJobFolder(moduleParam, jobId, user, need) {
  const moduleName = MODULE_NAMES[String(moduleParam || '').toLowerCase()];
  const rights = await rightsOf(user, moduleName);
  if (!rights.view || (need === 'edit' && !rights.edit)) {
    throw new ForbiddenError(
      `No ${need === 'edit' ? 'edit' : 'view'} right for ${RIGHT_NAMES[moduleName]} - ask the admin (User Management)`,
    );
  }
  const job = await findJobRow(moduleName, jobId);
  if (!job || !job.jobNo || job.jobNo === 'DRAFT') throw new NotFoundError('Job not found (save the job first)');
  return { moduleName, job, dir: esanchitArchive.safeName(job.jobNo, 'misc'), canEdit: rights.edit };
}

// every PDF a document row of the job (BE / SB level and items) points at
async function filesUsedByRows({ moduleName, job }) {
  const lists = [];
  if (moduleName === 'Import') {
    lists.push(parsedJson(parsedJson(job.list, {}).esanchitDocs, []));
    // items hang on the invoice (importJobId is empty on some item rows)
    const items = await select(
      'SELECT extendedData FROM ImportItems WHERE importJobId = ? OR importInvoiceId IN (SELECT id FROM ImportInvoices WHERE importJobId = ?)',
      [job.id, job.id],
    );
    for (const item of items) lists.push(parsedJson(parsedJson(item.extendedData, {}).docsData, []));
  } else {
    lists.push(parsedJson(job.list, []));
    // export items carry no exportJobId - they hang on the invoice
    const items = await select(
      'SELECT eSanchitList FROM ExportItems WHERE exportJobId = ? OR exportInvoiceId IN (SELECT id FROM ExportInvoices WHERE exportJobId = ?)',
      [job.id, job.id],
    );
    for (const item of items) lists.push(parsedJson(item.eSanchitList, []));
  }
  const used = [];
  for (const list of lists) {
    for (const doc of Array.isArray(list) ? list : []) {
      if (!doc || typeof doc !== 'object') continue;
      for (const key of ['fileUrl', '_raw', 'origUrl', 'originalUrl']) {
        if (doc[key] && typeof doc[key] === 'string')
          used.push({ url: doc[key], code: doc.docCode || '', irn: doc.irn || '' });
      }
    }
  }
  return used;
}

function pdfNamesIn(root) {
  try {
    return fs
      .readdirSync(root)
      .filter(
        (file) => /\.pdf$/i.test(file) && esanchitArchive.safeFile(file) && fs.statSync(path.join(root, file)).isFile(),
      );
  } catch {
    return [];
  }
}

// the stems in use: by a document row, or noted with an IRN / added from EagleView Signer
function usedStemsOf(dir, used, irnNotes, addedNotes) {
  const usedStems = new Map();
  for (const usage of used) {
    const match = esanchitArchive.URL_RX.exec(String(usage.url));
    if (match && match[1] === dir) usedStems.set(stemOf(match[2]), usage);
  }
  for (const file of [...Object.keys(irnNotes), ...Object.keys(addedNotes)]) {
    if (!usedStems.has(stemOf(file)))
      usedStems.set(stemOf(file), { code: '', irn: (irnNotes[file] && irnNotes[file].irn) || '' });
  }
  return usedStems;
}

function groupFilesByStem(root, dir, names, signedNotes) {
  const signedFiles = new Set(
    Object.values(signedNotes)
      .map((note) => note && note.file)
      .filter(Boolean),
  );
  const groups = new Map();
  for (const fileName of names) {
    const stat = fs.statSync(path.join(root, fileName));
    const stem = stemOf(fileName);
    if (!groups.has(stem)) groups.set(stem, { key: stem, files: [] });
    const isSigned = signedFiles.has(fileName) || (/_signed\.pdf$/i.test(fileName) && !signedNotes[fileName]);
    groups.get(stem).files.push({
      fileName,
      fileUrl: `${ESANCHIT_URL_PREFIX}${dir}/${fileName}`,
      size: stat.size,
      savedAt: stat.mtime,
      signed: isSigned,
      signer: (Object.values(signedNotes).find((note) => note && note.file === fileName) || {}).signer || '',
      hash: md5Of(path.join(root, fileName)),
    });
  }
  return groups;
}

function documentLine(group, usedStems) {
  // the copy to open: the newest signed one, else the PDF as attached
  group.files.sort((a, b) => b.signed - a.signed || b.fileName.length - a.fileName.length);
  const usage = usedStems.get(group.key);
  const nameParts = ESANCHIT_NAME_RX.exec(group.key);
  return {
    key: group.key,
    docCode: (usage && usage.code) || (nameParts ? nameParts[1] : ''),
    irn: usage && IRN_RX.test(String(usage.irn || '')) ? usage.irn : '',
    attachedAt: nameParts ? new Date(+nameParts[3]).toISOString() : null,
    inUse: !!usage,
    main: group.files[0],
    others: group.files.slice(1),
  };
}

// the same PDF filed more than once (an Update re-filed it): note which line it repeats
function markRepeatedPdfs(lines) {
  const firstByHash = new Map();
  lines.sort((a, b) => String(a.attachedAt || '').localeCompare(String(b.attachedAt || '')));
  for (const line of lines) {
    const { hash } = line.main;
    if (hash && firstByHash.has(hash)) line.sameAs = firstByHash.get(hash);
    else if (hash) firstByHash.set(hash, line.main.fileName);
  }
  return lines;
}

/**
 * e-Sanchit PDFs of the job folder, one line per document: the PDF as attached and its DSC-signed copies
 * (<name>_signed.pdf, noted in _signed.json) belong together - the row points at the original, every read shows the
 * signed copy.
 */
function esanchitDocumentLines(dir, used) {
  const root = path.join(esanchitArchive.ROOT, dir);
  const names = pdfNamesIn(root);
  const signedNotes = readJsonFile(path.join(root, '_signed.json'));
  const irnNotes = readJsonFile(path.join(root, '_irn.json'));
  const addedNotes = readJsonFile(path.join(root, '_added.json'));
  const usedStems = usedStemsOf(dir, used, irnNotes, addedNotes);
  const groups = groupFilesByStem(root, dir, names, signedNotes);
  return markRepeatedPdfs([...groups.values()].map((group) => documentLine(group, usedStems)));
}

/** The other documents uploaded by hand, kept in <job folder>/_other/, newest first. */
function otherDocuments(dir) {
  const root = path.join(esanchitArchive.ROOT, dir, OTHER_FOLDER);
  const notes = readJsonFile(path.join(root, OTHER_JSON));
  let names = [];
  try {
    names = fs
      .readdirSync(root)
      .filter(
        (file) =>
          OFFICE_FILE_RX.test(file) && esanchitArchive.safeFile(file) && fs.statSync(path.join(root, file)).isFile(),
      );
  } catch {
    names = [];
  }
  return names
    .map((fileName) => {
      const stat = fs.statSync(path.join(root, fileName));
      const note = notes[fileName] || {};
      return {
        fileName,
        name: note.name || fileName.replace(/^\d{13}_/, ''),
        docType: note.docType || '',
        remarks: note.remarks || '',
        by: note.by || '',
        savedAt: note.at || stat.mtime,
        size: stat.size,
        fileUrl: `${ESANCHIT_URL_PREFIX}${dir}/${OTHER_FOLDER}/${fileName}`,
      };
    })
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

async function logDocumentEvent(moduleName, jobId, message, by) {
  try {
    await JobTimeline.create({
      jobId: String(jobId),
      module: moduleName.toUpperCase(),
      eventType: 'DOCUMENT',
      message: String(message).slice(0, MAX_LOG_LENGTH),
      author: by,
    });
  } catch (error) {
    console.warn('[job files log]', error.message);
  }
}

export async function listJobFiles(folder) {
  return {
    success: true,
    jobNo: folder.job.jobNo,
    canEdit: folder.canEdit,
    docTypes: DOC_TYPES,
    esanchit: esanchitDocumentLines(folder.dir, await filesUsedByRows(folder)),
    other: otherDocuments(folder.dir),
  };
}

function writeOtherNotes(notesFile, notes) {
  fs.writeFileSync(`${notesFile}.tmp`, JSON.stringify(notes, null, 1));
  fs.renameSync(`${notesFile}.tmp`, notesFile);
}

/** A shipment document uploaded by hand (PDF, picture, Excel, Word, mail ...), kept in <job folder>/_other/. */
export async function uploadOtherDocument(folder, file, body, by) {
  if (!file || !file.buffer || !file.buffer.length) throw new BadRequestError('Choose a file');
  const originalName = path.basename(String(file.originalname || 'document'));
  if (!OFFICE_FILE_RX.test(originalName)) {
    throw new BadRequestError(
      'This kind of file is not taken - PDF, picture, Excel, Word, CSV, text, ZIP or mail (.eml / .msg)',
    );
  }
  const extension = originalName.slice(originalName.lastIndexOf('.')).toLowerCase();
  const baseName = esanchitArchive.safeName(originalName.slice(0, originalName.lastIndexOf('.')), 'document');
  const fields = body || {};
  const docType = DOC_TYPES.includes(String(fields.docType || '')) ? String(fields.docType) : 'Other';
  const root = path.join(esanchitArchive.ROOT, folder.dir, OTHER_FOLDER);
  fs.mkdirSync(root, { recursive: true });
  const storedName = `${Date.now()}_${baseName}${extension}`;
  fs.writeFileSync(path.join(root, storedName), file.buffer);
  const notesFile = path.join(root, OTHER_JSON);
  const notes = readJsonFile(notesFile);
  notes[storedName] = {
    name: originalName.slice(0, MAX_NAME_LENGTH),
    docType,
    remarks: String(fields.remarks || '').slice(0, MAX_REMARKS_LENGTH),
    by,
    at: new Date().toISOString(),
    size: file.buffer.length,
  };
  writeOtherNotes(notesFile, notes);
  const remarks = notes[storedName].remarks ? ` (${notes[storedName].remarks})` : '';
  await logDocumentEvent(
    folder.moduleName,
    folder.job.id,
    `Document uploaded: ${docType} - ${originalName}${remarks}`,
    by,
  );
  return otherDocuments(folder.dir).find((document) => document.fileName === storedName);
}

const removedName = (fileName) => `${Date.now()}_${fileName}`;

// an e-Sanchit PDF still used by a document row of the job (or its signed copy / IRN / a Signer document) is refused
async function removeEsanchitPdf(folder, fileName, by) {
  if (!/\.pdf$/i.test(fileName)) throw new BadRequestError('Wrong file name');
  const line = esanchitDocumentLines(folder.dir, await filesUsedByRows(folder)).find(
    (entry) => entry.key === stemOf(fileName),
  );
  if (!line) throw new NotFoundError(`File not found: ${fileName}`);
  // a PDF attached in the last 2 hours may be on a job screen that is open and not saved yet
  const age =
    Date.now() - Math.max(...[line.main, ...line.others].map((entry) => new Date(entry.savedAt).getTime() || 0));
  if (!line.inUse && age < RECENTLY_ATTACHED_MS) {
    throw new ConflictError(
      'This PDF was attached less than 2 hours ago - it may be on a job screen that is not saved yet. Try again later, or save the job first.',
    );
  }
  if (line.inUse) {
    throw new ConflictError(
      `This PDF is used by the e-Sanchit document ${line.docCode || ''}${line.irn ? ` (IRN ${line.irn})` : ''} of the job` +
        ' - remove that document in Supporting Docs first',
    );
  }
  // the PDF as attached and its signed copies go together
  const removedDir = path.join(esanchitArchive.ROOT, folder.dir, REMOVED_FOLDER);
  const allFiles = [line.main, ...line.others].map((entry) => entry.fileName);
  fs.mkdirSync(removedDir, { recursive: true });
  for (const name of allFiles) {
    const source = path.join(esanchitArchive.ROOT, folder.dir, name);
    if (fs.existsSync(source)) fs.renameSync(source, path.join(removedDir, removedName(name)));
  }
  await logDocumentEvent(
    folder.moduleName,
    folder.job.id,
    `e-Sanchit PDF taken off the job (not used by any document row): ${allFiles.join(', ')} - kept in ${folder.dir}\\${REMOVED_FOLDER}`,
    by,
  );
  return allFiles;
}

async function removeOtherDocument(folder, fileName, by) {
  const otherRoot = path.join(esanchitArchive.ROOT, folder.dir, OTHER_FOLDER);
  const source = path.join(otherRoot, fileName);
  const removedDir = path.join(otherRoot, REMOVED_FOLDER);
  const notes = readJsonFile(path.join(otherRoot, OTHER_JSON));
  const note = notes[fileName];
  const label = (note && (note.docType ? `${note.docType} - ` : '') + note.name) || fileName;
  if (!fs.existsSync(source)) throw new NotFoundError(`File not found: ${fileName}`);
  fs.mkdirSync(removedDir, { recursive: true });
  fs.renameSync(source, path.join(removedDir, removedName(fileName)));
  await logDocumentEvent(
    folder.moduleName,
    folder.job.id,
    `Document removed: ${label} - kept in ${folder.dir}\\${OTHER_FOLDER}\\${REMOVED_FOLDER}`,
    by,
  );
  return [fileName];
}

/** Takes a file off the list: it is moved to a _removed folder, never erased. */
export async function removeJobFile(folder, { kind, file }, by) {
  const fileKind = String(kind || '');
  const fileName = String(file || '');
  if (!esanchitArchive.safeFile(fileName) || fileName.startsWith('_')) throw new BadRequestError('Wrong file name');
  if (fileKind === 'other') return removeOtherDocument(folder, fileName, by);
  if (fileKind === 'esanchit') return removeEsanchitPdf(folder, fileName, by);
  throw new BadRequestError('kind must be other or esanchit');
}
