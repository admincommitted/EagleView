import { BadRequestError, ConflictError, NotFoundError } from '../../../../core/http/index.js';
import { Airwaybill, AwbLog, AwbTracking, HouseAWB } from '../../../../models/index.js';
import { ediReadyErrors } from '../../../../utils/awb/awbSave.js';
import { downloadAndProcessFsu } from '../../../../utils/awb/FsuService.js';
import IataPayloadGenerator from '../../../../utils/awb/IataPayloadGenerator.js';
import { awbSchema } from '../../../../utils/awb/iataValidation.js';
import {
  generateXffm,
  generateXfhl,
  generateXfwb,
  generateXfzb,
  liveHousesOf,
} from '../../../../utils/awb/XmlPayloadGenerator.js';
import { getSftpConfigStatus, uploadWithRetry } from '../../../../utils/integrations/SftpService.js';
import { ourCompany } from '../shared/companyHeader.js';
import { logUnexpectedError } from '../shared/errorLog.js';
import { consolErrors } from '../shared/masterAwb.js';

const awbNotFound = () => new NotFoundError('AWB not found', { body: { error: 'AWB not found' } });

function voidCannotBeSent(awb) {
  const message = `${awb.awbNumber} is VOID - it cannot be sent`;
  return new ConflictError(message, { body: { success: false, error: message } });
}

function notReadyForEdi(errors) {
  const message = 'Not ready for EDI: ' + errors.join('; ');
  return new BadRequestError(message, { body: { success: false, error: message, errors } });
}

function noLiveHouse(awb) {
  const message = `No live HAWB is linked to ${awb.awbNumber}`;
  return new BadRequestError(message, { body: { success: false, error: message } });
}

function assertCanBeSent(awb, readyType) {
  if (awb.status === 'VOID') throw voidCannotBeSent(awb);
  const ready = ediReadyErrors(awb, readyType);
  if (ready.length) throw notReadyForEdi(ready);
}

/** The houses are the content of the FHL / FZB: every live house must be ready and fit inside the master. */
async function liveHousesReadyToSend(master) {
  const houses = await liveHousesOf(master, true);
  if (!houses.length) throw noLiveHouse(master);
  const problems = consolErrors(master, houses);
  if (problems.length) throw notReadyForEdi(problems);
  return houses;
}

/** Unexpected SFTP / generation failures are written to the console with the message name, then answered. */
const withSftpErrorLog = (label, send) =>
  logUnexpectedError((error) => console.error(`[SFTP] ${label} error:`, error.message), send);

const transmittedAnswer = (message, fileName, awb) => ({
  success: true,
  message,
  fileName,
  awbNumber: awb.awbNumber,
  transmittedAt: new Date().toISOString(),
});

export async function generateFwbText(awbId) {
  return { success: true, payload: await IataPayloadGenerator.generateFwb(awbId) };
}

export async function generateFhlText(awbId) {
  return { success: true, payload: await IataPayloadGenerator.generateFhl(awbId) };
}

/** XFWB with our address in the forwarder block. */
export const buildXfwb = (awbId) => generateXfwb(awbId, { companyOf: ourCompany });

export const buildXfhl = (awbId) => generateXfhl(awbId);

export const sftpStatus = () => getSftpConfigStatus();

export async function pollFsuNow() {
  return { success: true, ...(await downloadAndProcessFsu()) };
}

/** A sent FWB shows as submitted on the dashboard; a resent FWB clears the old rejection (FNA). */
async function markFwbSubmitted(awb) {
  try {
    const [tracking] = await AwbTracking.findOrCreate({
      where: { awbNumber: awb.awbNumber, hawbNumber: null },
      defaults: {
        awbNumber: awb.awbNumber,
        hawbNumber: null,
        documentType: awb.type === 'MAWB' ? 'MASTER' : 'AIR WAYBILL',
        saved: true,
        origin: awb.origin || '',
        destination: awb.destination || '',
        departureDate: awb.flightDate1 || '',
        status: 'PENDING',
      },
    });
    await tracking.update({ submittedToAirline: true, saved: true, ...(tracking.fna ? { fna: null } : {}) });
  } catch (error) {
    console.warn('[Tracking] submit flag:', error.message);
  }
}

/** XFWB to Descartes myVan by SFTP; the AWB becomes TRANSMITTED. */
export function sendXfwb(awbId, body) {
  return withSftpErrorLog('send-xfwb', async () => {
    const awb = await Airwaybill.findByPk(awbId);
    if (!awb) throw awbNotFound();
    assertCanBeSent(awb, 'AWB');

    const xml = await buildXfwb(awbId);
    const fileName = `${awb.awbNumber || 'UNKNOWN'}_XFWB.xml`; // the dash stays: "020-12345678_XFWB.xml" per IATA naming
    const result = await uploadWithRetry(xml, fileName, 'xfwb');

    await awb.update({ status: 'TRANSMITTED' });
    await markFwbSubmitted(awb);
    try {
      await AwbLog.create({
        awbNumber: awb.awbNumber,
        action: 'FWB_TRANSMITTED',
        user: body.user || 'System',
        details: 'FWB (XFWB) transmitted via SFTP',
      });
    } catch {
      /* the log never stops a sent message */
    }
    return transmittedAnswer(result.message, fileName, awb);
  });
}

async function findAwbOrHouse(awbId) {
  const master = await Airwaybill.findByPk(awbId);
  if (master) return { awb: master, modelType: 'MAWB' };
  return { awb: await HouseAWB.findByPk(awbId), modelType: 'HAWB' };
}

/** XFHL (house list of a consol) to myVan; the record becomes TRANSMITTED and its tracking rows submitted. */
export function sendXfhl(awbId, body) {
  return withSftpErrorLog('send-xfhl', async () => {
    const { awb, modelType } = await findAwbOrHouse(awbId);
    if (!awb) throw awbNotFound();
    assertCanBeSent(awb, modelType === 'HAWB' ? 'HAWB' : 'MAWB');
    if (modelType === 'MAWB') await liveHousesReadyToSend(awb);

    const xml = await buildXfhl(awbId);
    const fileName = `${awb.awbNumber || 'UNKNOWN'}_XFHL.xml`; // the dash stays: "020-12345678_XFHL.xml" per IATA naming
    const result = await uploadWithRetry(xml, fileName, 'xfhl');

    await awb.update({ status: 'TRANSMITTED' });
    try {
      await AwbTracking.update(
        { submittedToAirline: true, status: 'TRANSMITTED' },
        { where: { awbNumber: awb.awbNumber } },
      );
    } catch {
      /* tracking is not needed to send */
    }
    try {
      await AwbLog.create({
        awbNumber: awb.awbNumber || 'UNKNOWN',
        action: 'FHL_TRANSMITTED',
        user: body?.user || 'SYSTEM',
        details: 'XFHL sent. File: ' + fileName + '. Type: ' + modelType,
      });
    } catch {
      /* the log never stops a sent message */
    }
    return transmittedAnswer(result.message, fileName, awb);
  });
}

/** One XFZB (house waybill) per live house of the master. The security status goes in the OCI rows. */
export function sendXfzb(awbId, body) {
  return withSftpErrorLog('send-xfzb', async () => {
    const awb = await Airwaybill.findByPk(awbId);
    if (!awb) throw awbNotFound();
    assertCanBeSent(awb, 'AWB');
    await liveHousesReadyToSend(awb);

    const houseDocuments = await generateXfzb(awbId);
    const masterDigits = (awb.awbNumber || 'UNKNOWN').replace(/\D/g, '');
    const files = [];
    for (const document of houseDocuments) {
      const fileName = `${masterDigits}_${document.fileHawb}_XFZB.xml`;
      await uploadWithRetry(document.xml, fileName, 'xfzb');
      files.push(fileName);
      try {
        await AwbLog.create({
          awbNumber: document.hawbNumber,
          action: 'FZB_TRANSMITTED',
          user: body.user || 'System',
          details: `FZB (XFZB) sent with master ${awb.awbNumber}`,
        });
      } catch {
        /* the log never stops a sent message */
      }
    }
    try {
      await AwbLog.create({
        awbNumber: awb.awbNumber,
        action: 'FZB_TRANSMITTED',
        user: body.user || 'System',
        details: `${files.length} house waybill(s) sent: ${houseDocuments.map((document) => document.hawbNumber).join(', ')}`,
      });
    } catch {
      /* the log never stops a sent message */
    }

    return {
      success: true,
      message: `${files.length} XFZB file(s) sent`,
      fileName: files.join(', '),
      files,
      awbNumber: awb.awbNumber,
      transmittedAt: new Date().toISOString(),
    };
  });
}

/** XFFM (cargo manifest) to myVan. */
export function sendXffm(awbId) {
  return withSftpErrorLog('send-xffm', async () => {
    const awb = await Airwaybill.findByPk(awbId);
    if (!awb) throw awbNotFound();
    const xml = await generateXffm(awbId);
    const fileName = `${(awb.awbNumber || 'UNKNOWN').replace('-', '')}_XFFM.xml`;
    const result = await uploadWithRetry(xml, fileName, 'xffm');
    return transmittedAnswer(result.message, fileName, awb);
  });
}

const ediMessageTypeOf = (type) => {
  if (type === 'MAWB') return 'XFWB';
  if (type === 'HAWB') return 'XFHL';
  return type;
};

function dryRunPayload({ awbNumber, type, formData }) {
  return {
    awbNumber: awbNumber || 'DRAFT',
    type: ediMessageTypeOf(type),
    origin: formData?.origin || formData?.dep || 'UNK',
    destination: formData?.destination || formData?.dest || 'UNK',
    totalPieces: parseInt(formData?.totalPieces, 10) || 1,
    grossWeight: parseFloat(formData?.grossWeight) || 0.1,
    shipperName: formData?.shipperName || 'UNKNOWN',
    consigneeName: formData?.consigneeName || 'UNKNOWN',
    shipperAddress: formData?.shipperAddress || 'UNKNOWN',
    consigneeAddress: formData?.consigneeAddress || 'UNKNOWN',
    shipperCity: formData?.shipperCity || 'UNKNOWN',
    consigneeCity: formData?.consigneeCity || 'UNKNOWN',
    currencyCode: formData?.currencyCode || 'USD',
    chargeCode: formData?.chargeCode || 'PP',
    totalVolume: parseFloat(formData?.totalVolume) || 0.0,
    shcList: formData?.shcList || [],
    dimLength: formData?.dimLength ? parseInt(formData.dimLength, 10) : undefined,
    dimWidth: formData?.dimWidth ? parseInt(formData.dimWidth, 10) : undefined,
    dimHeight: formData?.dimHeight ? parseInt(formData.dimHeight, 10) : undefined,
  };
}

/** VALIDATE EDI: the IATA rules on the screen fields, nothing saved. Returns the problems ([] when none). */
export function dryRunValidationErrors(body) {
  const result = awbSchema.safeParse(dryRunPayload(body));
  if (result.success) return [];
  const issues = result.error.issues || result.error.errors || [];
  return issues.map((issue) => `${(issue.path || []).join('.').toUpperCase()}: ${issue.message}`);
}
