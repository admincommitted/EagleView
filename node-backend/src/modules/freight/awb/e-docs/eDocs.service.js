import fs from 'node:fs';
import path from 'node:path';
import { Op } from 'sequelize';
import { BACKEND_ROOT } from '../../../../config/env.js';
import { Airport, AWBDocument, Party } from '../../../../models/index.js';
import { extractAwbDataFromFile } from '../../../../utils/integrations/geminiExtractor.js';
import { notFound } from '../shared/awbErrors.js';
import { logUnexpectedError } from '../shared/errorLog.js';

const MIN_ADDRESS_COMPARE_LENGTH = 5;
const MAX_AWB_TYPE_LENGTH = 10;

const isRealId = (value) => value && value !== 'undefined' && value !== 'null';
const logError = (error) => console.error(error);

/** e-documents of the AWB screens (the "pouch"): before the first save they are kept under the screen's temporary id. */
export function saveUploadedDocuments(tempId, body, files) {
  return logUnexpectedError(logError, async () => {
    const { documentType, awbId, awbType } = body;
    const documents = [];
    if (!files) return { success: true, documents };
    for (const file of files) {
      documents.push(
        await AWBDocument.create({
          tempId: tempId !== 'null' ? tempId : null,
          awbId: isRealId(awbId) ? awbId : null,
          awbType: awbType ? String(awbType).toUpperCase().slice(0, MAX_AWB_TYPE_LENGTH) : null,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          filePath: `/uploads/awb/${file.filename}`,
          documentType: documentType || 'OTHER',
        }),
      );
    }
    return { success: true, documents };
  });
}

/** The extracted address matches the master's street + city (short texts always count as a match). */
function addressMatches(extracted, savedStreet, savedCity) {
  if (!extracted) return true;
  const saved = ((savedStreet || '') + ' ' + (savedCity || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
  const read = extracted.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (saved.length < MIN_ADDRESS_COMPARE_LENGTH || read.length < MIN_ADDRESS_COMPARE_LENGTH) return true;
  return read.includes(saved) || saved.includes(read);
}

const PARTY_ROLES = [
  { key: 'shipper', flag: 'isShipper', status: ['shipperExists', 'shipperAddressMatch', 'dbShipperAddress'] },
  { key: 'consignee', flag: 'isConsignee', status: ['consigneeExists', 'consigneeAddressMatch', 'dbConsigneeAddress'] },
  { key: 'buyer', flag: 'isBuyer', status: ['buyerExists', 'buyerAddressMatch', 'dbBuyerAddress'] },
];

/** Is each party read from the document in the party master, and is its address the same there? */
async function partyMasterStatus(extracted) {
  const status = {
    shipperExists: false,
    shipperAddressMatch: false,
    dbShipperAddress: '',
    consigneeExists: false,
    consigneeAddressMatch: false,
    dbConsigneeAddress: '',
    buyerExists: false,
    buyerAddressMatch: false,
    dbBuyerAddress: '',
  };
  for (const {
    key,
    flag,
    status: [existsKey, matchKey, addressKey],
  } of PARTY_ROLES) {
    const name = extracted[key + 'Name'];
    if (!name) continue;
    const party = await Party.findOne({ where: { name, [flag]: true } });
    if (!party) continue;
    status[existsKey] = true;
    status[addressKey] = `${party.street || ''}, ${party.city || ''}`;
    status[matchKey] = addressMatches(extracted[key + 'Address'], party.street, party.city);
  }
  return status;
}

/** A destination read as an airport name becomes its code from the airport master. */
async function destinationAsAirportCode(extracted) {
  if (!extracted.destination || extracted.destination.length <= 3) return;
  const airport = await Airport.findOne({ where: { name: { [Op.like]: `%${extracted.destination}%` } } });
  if (airport) extracted.destination = airport.code;
}

/** AI reading of an uploaded document into AWB fields, checked against the party and airport masters. */
export function extractDocumentData(documentId) {
  return logUnexpectedError(logError, async () => {
    const document = await AWBDocument.findByPk(documentId);
    if (!document) throw notFound({ error: 'Document not found' });
    const absolutePath = path.join(BACKEND_ROOT, document.filePath);
    const extracted = await extractAwbDataFromFile(absolutePath, document.mimeType);
    const mdmStatus = await partyMasterStatus(extracted);
    await destinationAsAirportCode(extracted);
    return { success: true, data: extracted, mdmStatus };
  });
}

/**
 * Documents of a saved AWB, by its id and type (AWB / MAWB rows and HAWB rows share id numbers; old rows have no
 * type) - else the documents of the screen's temporary id.
 */
export async function listDocuments(tempId, { awbId, awbType }) {
  if (!isRealId(awbId)) return AWBDocument.findAll({ where: { tempId } });
  const type = String(awbType || '').toUpperCase();
  const types = type === 'HAWB' ? ['HAWB'] : type ? ['AWB', 'MAWB'] : null;
  const where = types ? { awbId, [Op.or]: [{ awbType: types }, { awbType: null }] } : { awbId };
  return AWBDocument.findAll({ where });
}

/** Removes the file and its row; false when the row does not exist. */
export async function deleteDocument(documentId) {
  const document = await AWBDocument.findByPk(documentId);
  if (!document) return false;
  const filePath = path.join(BACKEND_ROOT, document.filePath);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await document.destroy();
  return true;
}
