import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BadRequestError } from '../../../core/http/index.js';
import { Party, PartyItemMaster } from '../../../models/index.js';
import {
  detectFormat,
  parseFlatFileToBE,
  parseFlatFileToSB,
  parseJsonToBE,
  parseJsonToSB,
} from '../../../utils/customs/ErpFileParser.js';
import { extractItemsFromInvoicePdf } from '../../../utils/integrations/geminiExtractor.js';

const FLAT_FILE_HINT = 'Parsed as flat file (JSON parse failed)';
const GROUP_SEPARATOR = '\x1d';
const SB_FORMAT_LABELS = { FLAT_FILE_SB: 'flat file', CACHE01: 'ICEGATE JSON' };

/** The text to read: an uploaded file, else jsonText, else jsonData (object or text) of the body. */
function inputText(file, body) {
  if (file) return file.buffer.toString('utf8');
  if (body.jsonText) return body.jsonText;
  if (body.jsonData) return typeof body.jsonData === 'string' ? body.jsonData : JSON.stringify(body.jsonData);
  throw new Error('No input provided. Send file or jsonText in body.');
}

const fileTypeOf = (file, body) => body.fileType || file?.originalname?.toLowerCase() || 'json';

function parseJsonOrNull(text) {
  try {
    return { parsed: JSON.parse(text) };
  } catch {
    return null;
  }
}

/** Any BE file / JSON read into jobData + invoices + items. */
export function parseBeInput(file, body) {
  const text = inputText(file, body);
  const fileType = fileTypeOf(file, body);
  const isFlatFile = fileType.includes('.be') || fileType.includes('flat') || body.format === 'flat';
  let result;
  if (isFlatFile) {
    result = parseFlatFileToBE(text);
  } else {
    const json = parseJsonOrNull(text);
    if (!json) return { success: true, ...parseFlatFileToBE(text), hint: FLAT_FILE_HINT };
    result = parseJsonToBE(json.parsed);
  }
  const fieldCount = Object.keys(result.jobData).length;
  console.log(
    `[IMPORT-FILE] BE parse: ${result.detectedFormat}, ${fieldCount} fields, ${result.invoices.length} invoices, ${result.items.length} items`,
  );
  return { success: true, ...result, fieldCount, message: `${fieldCount} fields parsed from ${result.detectedFormat}` };
}

function sbSummaryMessage(result) {
  const counts = (result.summary && result.summary.counts) || {};
  const parts = [`${result.invoices.length} invoice(s)`, `${result.items.length} item(s)`];
  if (counts.drawback) parts.push(`${counts.drawback} drawback`);
  if (counts.swInfo) parts.push(`${counts.swInfo} SW info`);
  if (counts.documents) parts.push(`${counts.documents} document(s)`);
  const label = Object.hasOwn(SB_FORMAT_LABELS, result.detectedFormat)
    ? SB_FORMAT_LABELS[result.detectedFormat]
    : result.detectedFormat;
  return `Shipping bill read from ${label}: ${parts.join(', ')}`;
}

/** Any SB file / JSON read into exportData + invoices + items. */
export function parseSbInput(file, body) {
  const text = inputText(file, body);
  const fileType = fileTypeOf(file, body);
  const head = String(text).replace(/^﻿/, '').trimStart();
  // flat file: .sb name, format=flat, or the content itself (HREC line / ASCII 29 separators)
  const isFlatFile =
    fileType.includes('.sb') ||
    fileType.includes('flat') ||
    body.format === 'flat' ||
    head.startsWith('HREC') ||
    head.includes(GROUP_SEPARATOR);
  let result;
  if (isFlatFile) {
    result = parseFlatFileToSB(text);
  } else {
    const json = parseJsonOrNull(text);
    if (!json) return { success: true, ...parseFlatFileToSB(text), hint: FLAT_FILE_HINT };
    if (detectFormat(json.parsed || {}) === 'CACHI01') {
      throw new BadRequestError('This is a Bill of Entry JSON (CACHI01) - read it in Import (BE), not in Export');
    }
    result = parseJsonToSB(json.parsed);
  }
  const fieldCount = Object.keys(result.exportData).length;
  if (!fieldCount && !(result.items || []).length)
    throw new BadRequestError('No shipping bill data found in this file');
  console.log(
    `[IMPORT-FILE] SB parse: ${result.detectedFormat}, ${fieldCount} fields, ${result.invoices.length} invoices, ${result.items.length} items`,
  );
  return { success: true, ...result, fieldCount, message: sbSummaryMessage(result) };
}

/** Format of a JSON text only; text that is not JSON is a flat file. */
export function detectInputFormat(body) {
  const json = parseJsonOrNull(body.text || '');
  if (!json) return { format: 'FLAT_FILE', success: true };
  return { success: true, format: detectFormat(json.parsed) };
}

// the AI rules of the client for this form, and the client's item dictionary
async function clientExtractionHints(partyId, formType) {
  let clientRules = '';
  let clientDictionary = [];
  if (!partyId) return { clientRules, clientDictionary };
  const party = await Party.findByPk(partyId);
  if (party)
    clientRules = (formType === 'export' ? party.aiExportRules : party.aiImportRules) || party.aiExtractionRules || '';
  const items = await PartyItemMaster.findAll({ where: { partyId } });
  if (items && items.length > 0) clientDictionary = items.map((item) => item.toJSON());
  return { clientRules, clientDictionary };
}

// The upload's own name never becomes a path ("../../x" in it would write outside the temp folder): the temp file
// gets a random name with only the extension kept.
const SAFE_EXTENSION = /^\.[a-z0-9]{1,8}$/i;

function tempUploadPath(file) {
  const extension = path.extname(String(file.originalname || ''));
  return path.join(
    os.tmpdir(),
    `eagleview-upload-${crypto.randomUUID()}${SAFE_EXTENSION.test(extension) ? extension : '.pdf'}`,
  );
}

/** Invoice PDF items read by the AI extractor, with the client's rules and item dictionary. */
export async function extractPdfItems(file, body) {
  if (!file) throw new BadRequestError('No file uploaded', { body: { error: 'No file uploaded' } });
  const tempPath = tempUploadPath(file);
  fs.writeFileSync(tempPath, file.buffer);
  try {
    const { clientRules, clientDictionary } = await clientExtractionHints(body.partyId, body.formType || 'import');
    return await extractItemsFromInvoicePdf(tempPath, file.mimetype, clientRules, clientDictionary);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
}
