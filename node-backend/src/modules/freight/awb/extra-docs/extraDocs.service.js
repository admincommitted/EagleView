import { ApiError } from '../../../../core/http/index.js';
import { Airwaybill, AwbExtraDoc, HouseAWB } from '../../../../models/index.js';
import { badRequest, notFound } from '../shared/awbErrors.js';
import { awbTypesOf } from '../shared/awbNumbers.js';

const MAX_DOCUMENT_TEXT = 200000;
const MAX_DOC_TYPE_LENGTH = 30;

function parsedData(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

/**
 * One extra document (DG declaration, SLI ...) of a saved AWB. The windows save straight away when the AWB is already
 * saved; for a new AWB they are sent with the AWB save as extraDocs.
 */
export async function readExtraDocument(type, awbId, docType) {
  const row = await AwbExtraDoc.findOne({
    where: { awbId, awbType: awbTypesOf(type), docType: String(docType).toUpperCase() },
  });
  return {
    success: true,
    data: parsedData(row),
    updatedAt: row ? row.updatedAt : null,
    updatedBy: row ? row.updatedBy : null,
  };
}

/** `body.data` replaces the document; data null removes it. */
export async function saveExtraDocument(typeParam, awbId, docTypeParam, body, user) {
  const type = String(typeParam).toUpperCase();
  const Model = type === 'HAWB' ? HouseAWB : Airwaybill;
  if (!(await Model.findByPk(awbId))) throw notFound({ error: 'AWB not found - save the AWB first' });
  const docType = String(docTypeParam)
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, MAX_DOC_TYPE_LENGTH);
  if (!docType) throw badRequest({ error: 'Bad document type' });
  const text = JSON.stringify(body && 'data' in body ? body.data : null);
  if (text.length > MAX_DOCUMENT_TEXT) {
    throw new ApiError(413, 'Document too large', { body: { error: 'Document too large' } });
  }
  await AwbExtraDoc.destroy({ where: { awbId, awbType: awbTypesOf(type), docType } });
  if (text !== 'null') {
    await AwbExtraDoc.create({
      awbId,
      awbType: type === 'HAWB' ? 'HAWB' : type,
      docType,
      data: text,
      updatedBy: user?.username || null,
    });
  }
  return { success: true };
}
