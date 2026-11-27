import { Op } from 'sequelize';
import { sequelize } from '../../../../config/database.js';
import {
  Airwaybill,
  AWBDocument,
  AwbDimension,
  AwbExtraDoc,
  AwbLog,
  AwbOci,
  AwbOtherCharge,
  AwbRateLine,
  AwbStock,
  AwbTracking,
  HawbStock,
  HouseAWB,
  SpecialHandlingCode,
} from '../../../../models/index.js';
import { fyFor } from '../../../../utils/awb/awbBranch.js';
import { mainFields, validateAwb, writeChildren } from '../../../../utils/awb/awbSave.js';
import { liveHousesOf } from '../../../../utils/awb/XmlPayloadGenerator.js';
import { awbNotFound, badRequest, conflict } from '../shared/awbErrors.js';
import {
  AWB_DIGITS,
  awbTypesOf,
  checkDigitOf,
  dashedAwbNo,
  findLiveRecordWithNumber,
  liveStatus,
  normaliseAwbNo,
  userNameOf,
} from '../shared/awbNumbers.js';
import { carrierWarning, releaseStock, stockWarning } from '../shared/awbStockChecks.js';
import { logUnexpectedError } from '../shared/errorLog.js';
import {
  findLiveMaster,
  flownInfo,
  isSentToAirline,
  markMasterAmended,
  recalculateMawbTotals,
} from '../shared/masterAwb.js';

const CHILD_MODELS = { SpecialHandlingCode, AwbRateLine, AwbOtherCharge, AwbOci, AwbDimension, AwbExtraDoc };
const COPIED_CHILD_MODELS = [SpecialHandlingCode, AwbRateLine, AwbOtherCharge, AwbOci, AwbDimension, AwbExtraDoc];
const FLIGHT_FIELDS = ['flightNumber1', 'flightDate1', 'flightNumber2', 'flightDate2', 'flightNumber3', 'flightDate3'];
const MAX_REASON_LENGTH = 300;
const MAX_LOG_DETAIL = 250;
const FREE_STOCK_CANDIDATES = 50;
const MAX_SERIAL_STEPS = 200;

const modelOfType = (type) => (type === 'HAWB' ? HouseAWB : Airwaybill);
const recordLabel = (type) => (type === 'HAWB' ? 'HAWB' : 'AWB');
const isConfirmed = (flag) => flag === true || flag === 'true';
const reasonFrom = (body, key) =>
  String((body && body[key]) || '')
    .trim()
    .slice(0, MAX_REASON_LENGTH);

const fieldErrors = (errors) => badRequest({ error: errors.join('\n'), errors });

/** The operator is asked before an AWB number outside the stock or of another airline is saved. */
async function assertStockAndCarrierConfirmed(body, type, awbNumber) {
  if (!isConfirmed(body._stockOk)) {
    const warning = await stockWarning(type, awbNumber);
    if (warning) throw conflict({ stockWarning: true, okFlag: '_stockOk', error: warning });
  }
  await assertCarrierConfirmed(body, type, awbNumber);
}

async function assertCarrierConfirmed(body, type, awbNumber) {
  if (isConfirmed(body._carrierOk)) return;
  const warning = await carrierWarning(type, awbNumber, body.formData);
  if (warning) throw conflict({ okFlag: '_carrierOk', error: warning });
}

/** A house goes only on a live master; on a master already sent to the airline, only before departure. */
async function checkMasterTakesNewHouse(masterAwbNumber) {
  const sameNumberMaster = await Airwaybill.findOne({ where: { awbNumber: masterAwbNumber }, order: [['id', 'DESC']] });
  const onlyVoidMaster =
    sameNumberMaster &&
    sameNumberMaster.status === 'VOID' &&
    !(await findLiveRecordWithNumber(Airwaybill, masterAwbNumber, 'MAWB'));
  if (onlyVoidMaster) throw conflict({ error: `MAWB ${masterAwbNumber} is VOID - link the HAWB to a live MAWB` });

  const master = await findLiveMaster(masterAwbNumber);
  if (master && isSentToAirline(master)) {
    const flown = await flownInfo(master.awbNumber);
    if (flown)
      throw conflict({
        flown: true,
        error: `MAWB ${master.awbNumber} has ${flown} - a house cannot be added to it now.`,
      });
  }
  return master;
}

/** Branch picked in the top bar; financial year from the AWB's own date (else the year sent, else the top bar's). */
async function fillBranchAndYear(payload, context) {
  if (!payload.branchId) payload.branchId = await context.resolveSaveBranchId();
  const yearOfDate = await fyFor(payload.executedDate);
  if (yearOfDate) {
    payload.financialYearId = yearOfDate;
    return;
  }
  if (!payload.financialYearId) {
    const yearFromHeader = parseInt(context.yearHeader, 10);
    if (yearFromHeader) payload.financialYearId = yearFromHeader;
  }
}

/** The same AWB / HAWB number must not be saved twice (void ones can be reused). */
async function assertNumberIsFree(type, awbNumber) {
  const bare = String(awbNumber || '').replace(/[^A-Za-z0-9]/g, '');
  const dashed = type === 'HAWB' || bare.length !== AWB_DIGITS ? awbNumber : dashedAwbNo(bare);
  const duplicate =
    awbNumber &&
    (await modelOfType(type).findOne({
      where: { awbNumber: { [Op.in]: [awbNumber, bare, dashed] }, status: liveStatus() },
    }));
  if (duplicate) {
    throw conflict({
      error: `${recordLabel(type)} ${awbNumber} already exists (id ${duplicate.id}). Open it and update instead.`,
      existingId: duplicate.id,
    });
  }
}

/** e-documents uploaded before the first save (kept under the screen's temporary id) now belong to this AWB. */
async function attachUploadedDocuments(docTempId, awbId, type, transaction) {
  if (!docTempId) return;
  await AWBDocument.update(
    { awbId, awbType: type },
    { where: { tempId: String(docTempId), awbId: null }, transaction },
  );
}

/** Main record + SPH + rate lines + charges + OCI + dimensions are saved together or not at all. */
async function saveNewRecordWithChildren(type, payload, body) {
  const transaction = await sequelize.transaction();
  try {
    const record = await modelOfType(type).create(payload, { transaction });
    await writeChildren(CHILD_MODELS, record.id, type, body, transaction, false);
    await attachUploadedDocuments(body.docTempId, record.id, type, transaction);
    await transaction.commit();
    return record;
  } catch (saveError) {
    await transaction.rollback().catch(() => {});
    throw saveError;
  }
}

/** The Track Shipments screen shows a new AWB at once. */
async function createTrackingRowFor(type, payload, awbNumber) {
  try {
    const trackedAwbNumber = type === 'HAWB' ? payload.masterAwbNumber || awbNumber : awbNumber;
    const trackedHawbNumber = type === 'HAWB' ? awbNumber : null;
    await AwbTracking.findOrCreate({
      where: { awbNumber: trackedAwbNumber, hawbNumber: trackedHawbNumber },
      defaults: {
        awbNumber: trackedAwbNumber,
        hawbNumber: trackedHawbNumber,
        documentType: type === 'HAWB' ? 'HOUSE' : payload.type === 'MAWB' ? 'MASTER' : 'AIR WAYBILL',
        saved: true,
        submittedToAirline: false,
        origin: payload.origin || '',
        destination: payload.destination || '',
        departureDate: payload.flightDate1 || '',
        status: 'PENDING',
      },
    });
  } catch (trackingError) {
    console.warn('[Tracking] Could not create tracking record:', trackingError.message);
  }
}

async function markNumberUsedInStock(type, awbNumber) {
  try {
    const stockNumber = awbNumber.replace(/[^a-zA-Z0-9]/g, '');
    if (type === 'HAWB') await HawbStock.update({ status: 'USED' }, { where: { fullHawbNumber: stockNumber } });
    else await AwbStock.update({ status: 'USED' }, { where: { fullAwbNumber: stockNumber } });
  } catch (stockError) {
    console.error('Failed to update stock status', stockError);
  }
}

async function writeActivityLog(awbNumber, action, user, details) {
  try {
    await AwbLog.create({ awbNumber, action, user, details });
  } catch {
    /* the activity log never stops a save */
  }
}

/** POST /create - a new AWB / MAWB / HAWB with all its rows. */
export function createAwb(body, context) {
  return logUnexpectedError(
    (error) => console.error('Create AWB Error:', error),
    async () => {
      const { type, branchId, financialYearId } = body;
      const errors = validateAwb(body, type, true);
      if (errors.length) throw fieldErrors(errors);

      const awbNumber = normaliseAwbNo(body.awbNumber, type);
      const masterAwbNumber =
        type === 'HAWB' ? normaliseAwbNo(body.masterAwbNumber, 'MAWB') : body.masterAwbNumber || null;
      const sentMaster = type === 'HAWB' ? await checkMasterTakesNewHouse(masterAwbNumber) : null;

      const payload = {
        ...mainFields(body, null),
        branchId,
        financialYearId,
        awbNumber,
        masterAwbNumber: masterAwbNumber || null,
        type,
        createdBy: userNameOf(context.user),
      };
      await fillBranchAndYear(payload, context);
      await assertNumberIsFree(type, awbNumber);
      await assertStockAndCarrierConfirmed(body, type, awbNumber);

      const record = await saveNewRecordWithChildren(type, payload, body);
      if (type === 'HAWB' && masterAwbNumber) await recalculateMawbTotals(masterAwbNumber);
      await createTrackingRowFor(type, payload, awbNumber);
      await markNumberUsedInStock(type, awbNumber);
      if (type === 'HAWB' && sentMaster) {
        await markMasterAmended(sentMaster, `HAWB ${awbNumber} added`, userNameOf(context.user)).catch(() => {});
      }
      await writeActivityLog(
        awbNumber,
        'AWB_CREATED',
        context.user?.username || body.user || 'System',
        'AWB created via UI.',
      );
      return { success: true, awbId: record.id, awbNumber };
    },
  );
}

/** The forms an AWB number may be saved in: as typed, letters and digits only, dashed. */
function searchNumbersOf(rawNumber) {
  const raw = String(rawNumber || '').trim();
  const bare = raw.replace(/[^A-Za-z0-9]/g, '');
  return [...new Set([raw, bare, /^\d{11}$/.test(bare) ? dashedAwbNo(bare) : raw])];
}

async function extraDocumentsOf(record) {
  const kind = record.constructor === HouseAWB ? 'HAWB' : 'AWB';
  const extraDocs = {};
  const rows = await AwbExtraDoc.findAll({ where: { awbId: record.id, awbType: awbTypesOf(kind) } });
  for (const row of rows) {
    try {
      extraDocs[row.docType] = JSON.parse(row.data);
    } catch {
      /* a row that is not JSON is left out */
    }
  }
  return extraDocs;
}

/** GET /search/:awbNumber - a voided number can be used again: the live record opens, not the void one. */
export async function findAwbByNumber(rawNumber) {
  const awbNumber = { [Op.in]: searchNumbersOf(rawNumber) };
  const newestWithAll = (where) => ({ where, include: [{ all: true }], order: [['id', 'DESC']] });
  const liveWhere = { awbNumber, status: liveStatus() };
  const record =
    (await Airwaybill.findOne(newestWithAll(liveWhere))) ||
    (await HouseAWB.findOne(newestWithAll(liveWhere))) ||
    (await Airwaybill.findOne(newestWithAll({ awbNumber }))) ||
    (await HouseAWB.findOne(newestWithAll({ awbNumber })));
  if (!record) throw awbNotFound();
  const out = record.toJSON();
  out.extraDocs = await extraDocumentsOf(record);
  return out;
}

/**
 * An AWB already sent to the airline (status TRANSMITTED) is changed only as an AMENDMENT with a reason (status
 * AMENDED = send XFWB / XFHL again); a HAWB change on a sent master makes the master AMENDED. Once the shipment has
 * departed nothing is changed here - the correction goes to the airline as a CCA.
 */
async function amendmentReasonFor({ type, awb, sentMaster, sentSelf, viaMaster }, body) {
  if (!sentSelf && !viaMaster) return '';

  const masterNumber = type === 'HAWB' ? sentMaster.awbNumber : awb.awbNumber;
  const flown = await flownInfo(masterNumber);
  if (flown) {
    const recordName = type === 'HAWB' ? 'MAWB ' + masterNumber : awb.awbNumber;
    throw conflict({
      flown: true,
      error: `${recordName} has ${flown} - it cannot be changed here any more. Send the correction to the airline as a CCA (DOCS > CCA).`,
    });
  }
  const reason = reasonFrom(body, '_amendReason');
  if (!reason) {
    const error = sentSelf
      ? `${awb.awbNumber} has already been sent to the airline. The change will be saved as an amendment and XFWB${type !== 'HAWB' ? ' / XFHL' : ''} must be sent again.`
      : `The XFWB / XFHL of MAWB ${masterNumber} has already been sent. This HAWB change will be saved as an amendment and the XFHL of the MAWB must be sent again.`;
    throw conflict({ needReason: true, reasonFlag: '_amendReason', error });
  }
  return reason;
}

/** The AWB / HAWB number changed on the screen; null when it stays. */
async function changedNumberOf(type, awb, Model, body) {
  if (!body.awbNumber || body.awbNumber === 'DRAFT') return null;
  const wanted = normaliseAwbNo(body.awbNumber, type);
  if (wanted === awb.awbNumber) return null;
  if (type !== 'HAWB') {
    const digits = wanted.replace(/\D/g, '');
    if (!/^\d{11}$/.test(digits)) throw badRequest({ error: 'AWB number must be 11 digits (3 + 8)' });
    const expectedCheckDigit = checkDigitOf(digits.slice(3, 10));
    if (expectedCheckDigit !== Number(digits[10])) {
      throw badRequest({
        error: `AWB check digit is wrong: for ${digits.slice(3, 10)} it must be ${expectedCheckDigit}`,
      });
    }
  }
  const clash = await findLiveRecordWithNumber(Model, wanted, type, awb.id);
  if (clash) throw conflict({ error: `${recordLabel(type)} ${wanted} already exists (id ${clash.id})` });
  return wanted;
}

/** Houses and tracking rows follow a new master number; a house's tracking row follows its new number. */
async function renumberRecord(type, awb, newNumber, user, transaction) {
  const oldNumber = awb.awbNumber;
  await awb.update({ awbNumber: newNumber }, { transaction });
  if (type !== 'HAWB') {
    await HouseAWB.update({ masterAwbNumber: newNumber }, { where: { masterAwbNumber: oldNumber }, transaction });
    await AwbTracking.update({ awbNumber: newNumber }, { where: { awbNumber: oldNumber }, transaction });
  } else {
    await AwbTracking.update({ hawbNumber: newNumber }, { where: { hawbNumber: oldNumber }, transaction });
  }
  await AwbLog.create(
    {
      awbNumber: newNumber,
      action: 'AWB_NUMBER_CHANGED',
      user,
      details: `Number changed from ${oldNumber} to ${newNumber}`,
    },
    { transaction },
  ).catch(() => {});
}

/** Every field the screen sent is saved as sent (even empty), with all child rows, in one transaction. */
async function saveRecordChanges({ type, awb, body, newNumber, masterAwbNumber, context }) {
  const transaction = await sequelize.transaction();
  try {
    if (newNumber) await renumberRecord(type, awb, newNumber, userNameOf(context.user), transaction);
    const fields = mainFields(body, awb.get({ plain: true }));
    const yearOfDate = await fyFor(fields.executedDate || awb.executedDate);
    await awb.update(
      {
        ...fields,
        branchId: body.branchId || awb.branchId || (await context.resolveSaveBranchId()),
        financialYearId: yearOfDate || body.financialYearId || awb.financialYearId,
        masterAwbNumber: masterAwbNumber !== undefined ? masterAwbNumber : awb.masterAwbNumber,
        modifiedBy: userNameOf(context.user),
      },
      { transaction },
    );
    await writeChildren(CHILD_MODELS, awb.id, type, body, transaction, true, awb.type);
    await attachUploadedDocuments(body.docTempId, awb.id, type, transaction);
    await transaction.commit();
  } catch (saveError) {
    await transaction.rollback();
    throw saveError;
  }
}

/** Master totals are recomputed only after the house is saved. */
async function refreshMastersOfHouse(awb, oldMasterAwbNumber, masterAwbNumber) {
  if (masterAwbNumber && oldMasterAwbNumber && oldMasterAwbNumber !== masterAwbNumber) {
    await AwbTracking.update(
      { awbNumber: masterAwbNumber },
      { where: { awbNumber: oldMasterAwbNumber, hawbNumber: awb.awbNumber } },
    ).catch(() => {});
  }
  if (oldMasterAwbNumber && oldMasterAwbNumber !== masterAwbNumber) await recalculateMawbTotals(oldMasterAwbNumber);
  if (masterAwbNumber) await recalculateMawbTotals(masterAwbNumber);
}

/** After an amendment: what must be sent to the airline again. */
async function recordAmendment({ type, awb, sentMaster, sentSelf, viaMaster }, amendReason, userName) {
  let resend = '';
  if (sentSelf) {
    await awb.update({ status: 'AMENDED', modifiedBy: userName }).catch(() => {});
    resend = type === 'HAWB' ? 'XFHL of the MAWB' : 'XFWB (and XFHL if it has houses)';
  }
  if (viaMaster) {
    await markMasterAmended(sentMaster, `HAWB ${awb.awbNumber} changed: ${amendReason}`, userName);
    resend = resend || `XFHL of MAWB ${sentMaster.awbNumber}`;
  }
  await AwbLog.create({
    awbNumber: awb.awbNumber,
    action: 'AWB_AMENDED',
    user: userName,
    details: `After sending to the airline: ${amendReason}`.slice(0, MAX_LOG_DETAIL),
  }).catch(() => {});
  return resend;
}

/** PUT /update/:id */
export function updateAwb(awbId, body, context) {
  return logUnexpectedError(
    (error) => console.error(error),
    async () => {
      const { type } = body;
      const Model = modelOfType(type);
      const awb = await Model.findByPk(awbId);
      if (!awb) throw awbNotFound();
      if (awb.status === 'VOID') throw conflict({ error: `${awb.awbNumber} is VOID and cannot be changed` });

      const userName = userNameOf(context.user);
      const sentMaster = type === 'HAWB' ? await findLiveMaster(body.masterAwbNumber || awb.masterAwbNumber) : null;
      const sending = {
        type,
        awb,
        sentMaster,
        sentSelf: isSentToAirline(awb),
        viaMaster: !!sentMaster && isSentToAirline(sentMaster),
      };
      const amendReason = await amendmentReasonFor(sending, body);

      const errors = validateAwb(body, type, false, awb);
      if (errors.length) throw fieldErrors(errors);
      const numberForCarrierCheck = body.awbNumber && body.awbNumber !== 'DRAFT' ? body.awbNumber : awb.awbNumber;
      await assertCarrierConfirmed(body, type, numberForCarrierCheck);

      // the saved fields and the child rows read the normalised master number
      if (type === 'HAWB' && body.masterAwbNumber) body.masterAwbNumber = normaliseAwbNo(body.masterAwbNumber, 'MAWB');
      const { masterAwbNumber } = body;
      const oldMasterAwbNumber = awb.masterAwbNumber;
      const newNumber = await changedNumberOf(type, awb, Model, body);

      await saveRecordChanges({ type, awb, body, newNumber, masterAwbNumber, context });
      if (type === 'HAWB') await refreshMastersOfHouse(awb, oldMasterAwbNumber, masterAwbNumber);

      const resend = amendReason ? await recordAmendment(sending, amendReason, userName) : '';
      await writeActivityLog(
        awb.awbNumber,
        'AWB_UPDATED',
        context.user?.username || body.user || 'System',
        'AWB updated via UI.',
      );
      return {
        success: true,
        message: amendReason ? `AWB amended - send the ${resend} again` : 'AWB Updated',
        amended: !!amendReason,
        resend,
      };
    },
  );
}

/** Voiding an AWB sent to the airline: not after departure; before it, only with a reason. */
async function voidReasonFor({ type, awb, sentMaster, sentSelf, viaMaster }, body) {
  if (!sentSelf && !viaMaster) return '';
  const masterNumber = type === 'HAWB' ? sentMaster.awbNumber : awb.awbNumber;
  const flown = await flownInfo(masterNumber);
  if (flown) {
    const recordName = type === 'HAWB' ? 'MAWB ' + masterNumber : awb.awbNumber;
    throw conflict({ flown: true, error: `${recordName} has ${flown} - it cannot be voided now.` });
  }
  const reason = reasonFrom(body, '_voidReason');
  if (!reason) {
    const error = sentSelf
      ? `${awb.awbNumber} has already been sent to the airline. Voiding it here does not cancel it with the airline - tell the airline too. Its number will not go back to the AWB stock.`
      : `The XFHL of MAWB ${masterNumber} has already been sent. After voiding this HAWB the XFHL must be sent again.`;
    throw conflict({ needReason: true, reasonFlag: '_voidReason', error });
  }
  return reason;
}

/** A master with live houses cannot be voided (the houses would point to a dead master). */
async function assertMasterHasNoLiveHouse(awb) {
  const liveHouseCount = (await liveHousesOf(awb, false)).length;
  if (liveHouseCount) {
    throw conflict({ error: `${liveHouseCount} HAWB(s) are linked to ${awb.awbNumber}. Unlink or void them first.` });
  }
}

async function markTrackingVoid(type, awb) {
  try {
    const trackingWhere =
      type === 'HAWB'
        ? { hawbNumber: awb.awbNumber, ...(awb.masterAwbNumber ? { awbNumber: awb.masterAwbNumber } : {}) }
        : { awbNumber: awb.awbNumber, hawbNumber: null };
    await AwbTracking.update({ status: 'VOID' }, { where: trackingWhere });
  } catch (error) {
    console.warn('[AWB void] tracking:', error.message);
  }
}

/**
 * PUT /void/:id. The number goes back to AVAILABLE in the stock and its tracking row stops showing as pending - except
 * for an AWB already sent to the airline (the airline has the number). A HAWB of a sent master: the master's FHL must
 * be sent again.
 */
export async function voidAwb(awbId, body, user) {
  const type = String(body.type || 'MAWB').toUpperCase();
  const Model = modelOfType(type);
  const awb = await Model.findByPk(awbId);
  if (!awb) throw awbNotFound();
  if (awb.status === 'VOID') return { success: true, message: 'AWB already VOID' };

  const userName = userNameOf(user);
  const sentMaster = type === 'HAWB' ? await findLiveMaster(awb.masterAwbNumber) : null;
  const sending = {
    type,
    awb,
    sentMaster,
    sentSelf: isSentToAirline(awb),
    viaMaster: !!sentMaster && isSentToAirline(sentMaster),
  };
  const voidReason = await voidReasonFor(sending, body);
  if (type !== 'HAWB') await assertMasterHasNoLiveHouse(awb);

  await awb.update({ status: 'VOID', modifiedBy: userName });
  if (type === 'HAWB' && awb.masterAwbNumber) await recalculateMawbTotals(awb.masterAwbNumber);
  if (voidReason) {
    await AwbLog.create({
      awbNumber: awb.awbNumber,
      action: 'AWB_VOIDED_AFTER_SEND',
      user: userName,
      details: voidReason.slice(0, MAX_LOG_DETAIL),
    }).catch(() => {});
    if (sending.viaMaster) await markMasterAmended(sentMaster, `HAWB ${awb.awbNumber} voided: ${voidReason}`, userName);
  }
  if (!sending.sentSelf) await releaseStock(type, awb.awbNumber, Model);
  await markTrackingVoid(type, awb);
  await writeActivityLog(awb.awbNumber, 'AWB_VOIDED', user?.username || body.user || 'System', 'AWB was voided.');
  return { success: true, message: 'AWB Voided' };
}

function checkTypedAwbNumber(typedNumber, newNumber) {
  const digits = newNumber.replace(/\D/g, '');
  if (digits.length !== AWB_DIGITS) {
    throw badRequest({ error: `${typedNumber}: an AWB number has 11 digits (3 prefix + 8 serial)` });
  }
  const expectedCheckDigit = checkDigitOf(digits.slice(3, 10));
  if (expectedCheckDigit !== Number(digits[10])) {
    throw badRequest({ error: `${newNumber}: wrong check digit (should end in ${expectedCheckDigit})` });
  }
}

/** The next AVAILABLE number of this airline in the AWB stock, else the next serial with a valid check digit. */
async function nextFreeAwbNumber(Model, type, originalDigits) {
  const prefix = originalDigits.slice(0, 3);
  const freeStock = await AwbStock.findAll({
    where: { airlinePrefix: prefix, status: 'AVAILABLE' },
    order: [
      ['sequenceNumber', 'ASC'],
      ['id', 'ASC'],
    ],
    limit: FREE_STOCK_CANDIDATES,
  });
  for (const stock of freeStock) {
    const candidate = dashedAwbNo(stock.fullAwbNumber);
    if (!(await findLiveRecordWithNumber(Model, candidate, type))) return candidate;
  }
  let serial = Number(originalDigits.slice(3, 10));
  for (let step = 0; step < MAX_SERIAL_STEPS; step++) {
    serial += 1;
    const candidate = `${prefix}-${String(serial).padStart(7, '0')}${checkDigitOf(serial)}`;
    if (!(await findLiveRecordWithNumber(Model, candidate, type))) return candidate;
  }
  return '';
}

/** Without newAwbNumber an AWB gets the next free number; a HAWB needs newAwbNumber. The number must not be in use. */
async function numberForCopy(type, Model, original, body) {
  const typedNumber = body && body.newAwbNumber;
  const newNumber = typedNumber ? normaliseAwbNo(typedNumber, type) : '';
  if (newNumber && type !== 'HAWB') checkTypedAwbNumber(typedNumber, newNumber);
  if (newNumber) {
    if (await findLiveRecordWithNumber(Model, newNumber, type))
      throw conflict({ error: `${newNumber} already exists` });
    return newNumber;
  }
  if (type === 'HAWB') throw badRequest({ error: 'Give the new HAWB number (newAwbNumber)' });
  const originalDigits = String(original.awbNumber || '').replace(/\D/g, '');
  if (originalDigits.length !== AWB_DIGITS) throw badRequest({ error: 'Give the new AWB number (newAwbNumber)' });
  const freeNumber = await nextFreeAwbNumber(Model, type, originalDigits);
  if (!freeNumber) throw conflict({ error: 'No free AWB number found after this one' });
  return freeNumber;
}

const withoutRowKeys = (row) => {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = row.get({ plain: true });
  return rest;
};

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parsedFormData(formData) {
  if (typeof formData !== 'string') return formData;
  try {
    return JSON.parse(formData);
  } catch {
    return null;
  }
}

/**
 * A copy is a new shipment: executed today and no flight yet. A copied HAWB stays on the same master only when asked
 * (keepMaster) - otherwise its weight would be added to that master's totals without anyone choosing it - and then it
 * keeps the master's flights.
 */
function fieldsForCopy(original, type, body) {
  const {
    awbNumber: _awbNumber,
    status: _status,
    submittedToAirline: _submittedToAirline,
    transmissionStatus: _transmissionStatus,
    ...fields
  } = withoutRowKeys(original);
  const keepMaster = type === 'HAWB' && body && body.keepMaster;
  if (!keepMaster && type === 'HAWB') {
    if ('masterAwbNumber' in fields) fields.masterAwbNumber = null;
    if ('masterAwbId' in fields) fields.masterAwbId = null;
  }
  const today = localToday();
  if ('executedDate' in fields) fields.executedDate = today;
  if (!keepMaster) {
    for (const key of FLIGHT_FIELDS) if (key in fields) fields[key] = null;
  }
  let formData = parsedFormData(fields.formData);
  if (formData && typeof formData === 'object') {
    formData = { ...formData };
    if ('executedDate' in formData) formData.executedDate = today;
    if (!keepMaster) {
      for (const key of Object.keys(formData)) if (/^(flight|arrival)/i.test(key)) delete formData[key];
    }
    fields.formData = formData;
  }
  return fields;
}

async function copyRecordWithChildren({ type, Model, original, newNumber, body, user }) {
  const childTypes = awbTypesOf(type);
  return sequelize.transaction(async (transaction) => {
    const created = await Model.create(
      {
        ...fieldsForCopy(original, type, body),
        awbNumber: newNumber,
        status: 'ACTIVE',
        submittedToAirline: false,
        createdBy: userNameOf(user),
      },
      { transaction },
    );
    for (const ChildModel of COPIED_CHILD_MODELS) {
      const rows = await ChildModel.findAll({ where: { awbId: original.id, awbType: childTypes }, transaction });
      for (const row of rows) await ChildModel.create({ ...withoutRowKeys(row), awbId: created.id }, { transaction });
    }
    return created;
  });
}

/** The new number is USED in its stock (as a saved AWB is); the note says when it is not in the stock. */
async function useCopyNumberInStock(type, newNumber) {
  try {
    const stockNumber = newNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (type === 'HAWB') {
      await HawbStock.update({ status: 'USED' }, { where: { fullHawbNumber: stockNumber } });
      return '';
    }
    const [updatedRows] = await AwbStock.update({ status: 'USED' }, { where: { fullAwbNumber: stockNumber } });
    return updatedRows ? '' : ' (this number is not in the AWB stock - check it with the airline)';
  } catch {
    return ''; // the stock is optional
  }
}

/**
 * POST /duplicate/:id { type: 'AWB'|'MAWB'|'HAWB', newAwbNumber?, keepMaster? } - copies the record with ALL its rows
 * (SPH, OCI, dimensions, rate lines, charges, extra documents) in one transaction.
 */
export function duplicateAwb(awbId, type, body, user) {
  return logUnexpectedError(
    (error) => console.error('[DUPLICATE AWB]', error.message),
    async () => {
      const Model = modelOfType(type);
      const original = await Model.findByPk(awbId);
      if (!original) throw awbNotFound();
      const newNumber = await numberForCopy(type, Model, original, body);
      const copy = await copyRecordWithChildren({ type, Model, original, newNumber, body, user });
      if (type === 'HAWB' && copy.masterAwbNumber) await recalculateMawbTotals(copy.masterAwbNumber);
      const stockNote = await useCopyNumberInStock(type, newNumber);
      await AwbLog.create({
        awbNumber: newNumber,
        action: 'AWB_DUPLICATED',
        user: userNameOf(user),
        details: `Copied from ${original.awbNumber}`,
      }).catch(() => {});
      return {
        success: true,
        id: copy.id,
        newAwbNumber: newNumber,
        stockNote,
        message: `AWB duplicated as ${newNumber}${stockNote}`,
      };
    },
  );
}

/** GET /logs/:awbNumber - the activity log of one AWB, newest first. */
export async function activityLogOf(awbNumber) {
  return AwbLog.findAll({ where: { awbNumber }, order: [['createdAt', 'DESC']] });
}
