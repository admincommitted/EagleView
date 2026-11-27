import { Op } from 'sequelize';
import { Airwaybill, AwbLog, AwbRateLine, AwbTracking, AwbTrackingEvent } from '../../../../models/index.js';
import { ediReadyErrors } from '../../../../utils/awb/awbSave.js';
import { houseKg, liveHousesOf } from '../../../../utils/awb/XmlPayloadGenerator.js';
import { AWB_DIGITS, awbNumberVariants, dashedAwbNo, liveStatus } from './awbNumbers.js';

/**
 * An AWB sent to the airline (XFWB / XFHL) is TRANSMITTED; a change after that is an AMENDMENT (send again).
 * Once the shipment has departed (tracking DEP / ARR / DLV) nothing is changed here - the correction goes to the
 * airline as a CCA.
 */
const SENT_STATUSES = ['TRANSMITTED', 'AMENDED'];
const FLOWN_TRACKING_STATUSES = ['DEPARTED', 'ARRIVED', 'DELIVERED', 'FINISHED'];
const FLOWN_EVENT_CODES = ['DEP', 'ARR', 'RCF', 'NFD', 'DLV'];
const MAX_LOG_DETAIL = 250;
const MASTER_WEIGHT_TOLERANCE_KG = 0.5;
const WEIGHT_EQUAL_TOLERANCE = 0.0005;

export const isSentToAirline = (record) =>
  !!record && SENT_STATUSES.includes(String(record.status || '').toUpperCase());

/** The live master AWB of this number (newest first). */
export async function findLiveMaster(number) {
  if (!number) return null;
  return Airwaybill.findOne({
    where: { awbNumber: { [Op.in]: awbNumberVariants(number) }, status: liveStatus() },
    order: [['id', 'DESC']],
  });
}

const dateTimeText = (value) =>
  String(value || '')
    .slice(0, 16)
    .replace('T', ' ');

/** "departed (12-11-2026 ...)" when the airline / we recorded the flight leaving (or later), else ''. */
export async function flownInfo(masterNumber) {
  if (!masterNumber) return '';
  const variants = awbNumberVariants(masterNumber);
  const tracking = await AwbTracking.findOne({ where: { awbNumber: { [Op.in]: variants }, hawbNumber: null } }).catch(
    () => null,
  );
  if (tracking) {
    const status = String(tracking.status || '').toUpperCase();
    const hasFlown = tracking.dep || tracking.arr || tracking.dlv || FLOWN_TRACKING_STATUSES.includes(status);
    if (hasFlown) return `departed${tracking.dep ? ' (' + dateTimeText(tracking.dep) + ')' : ''}`;
  }
  const event = await AwbTrackingEvent.findOne({
    where: { awbNumber: { [Op.in]: variants }, code: { [Op.in]: FLOWN_EVENT_CODES } },
    order: [['eventAt', 'ASC']],
  }).catch(() => null);
  return event ? `departed (${event.code} ${dateTimeText(event.eventAt)})` : '';
}

/** A transmitted master whose houses changed: its XFHL must be sent again. */
export async function markMasterAmended(master, reason, user) {
  if (!master || String(master.status || '').toUpperCase() !== 'TRANSMITTED') return false;
  await master.update({ status: 'AMENDED', modifiedBy: user });
  await AwbLog.create({
    awbNumber: master.awbNumber,
    action: 'FHL_RESEND_NEEDED',
    user,
    details: reason.slice(0, MAX_LOG_DETAIL),
  }).catch(() => {});
  return true;
}

/** Problems of a consol: every house must be ready for EDI and the houses must fit inside the master. */
export function consolErrors(master, houses) {
  const errors = [];
  let housePieces = 0;
  let houseWeight = 0;
  for (const house of houses) {
    for (const error of ediReadyErrors(house, 'HAWB')) errors.push(`HAWB ${house.awbNumber}: ${error}`);
    housePieces += parseInt(house.totalPieces, 10) || 0;
    houseWeight += houseKg(house); // pounds converted (needs the rate lines: liveHousesOf(.., true))
  }
  const masterPieces = parseInt(master.totalPieces, 10) || 0;
  const masterWeight = parseFloat(master.grossWeight) || 0;
  if (masterPieces && housePieces > masterPieces) {
    errors.push(`Houses have ${housePieces} pieces, more than the master's ${masterPieces}`);
  }
  if (masterWeight && houseWeight > masterWeight + MASTER_WEIGHT_TOLERANCE_KG) {
    errors.push(`Houses weigh ${houseWeight.toFixed(1)} kg, more than the master's ${masterWeight.toFixed(1)} kg`);
  }
  return errors;
}

const sumPieces = (rows) => rows.reduce((sum, row) => sum + (parseInt(row.pieces, 10) || 0), 0);
const sumGrossWeight = (rows) => rows.reduce((sum, row) => sum + (parseFloat(row.grossWeight) || 0), 0);
const ownRateLinesOf = (master) => AwbRateLine.findAll({ where: { awbId: master.id, awbType: ['AWB', 'MAWB'] } });

async function findLiveMasterForTotals(masterAwbNumber) {
  const digits = String(masterAwbNumber).replace(/\D/g, '');
  const dashed = digits.length === AWB_DIGITS ? dashedAwbNo(digits) : masterAwbNumber;
  return Airwaybill.findOne({
    where: { awbNumber: [...new Set([masterAwbNumber, dashed, digits])], status: liveStatus() },
    order: [['id', 'DESC']],
  });
}

/**
 * The master keeps ITS OWN pieces / weight when its rate lines have them (that is what goes to the airline in the
 * FWB). The house sum is used only for a master without weights; a difference is shown by VALIDATE EDI and stops the
 * FHL / FZB. With no live house left the master goes back to its own rate lines.
 */
export async function recalculateMawbTotals(masterAwbNumber) {
  if (!masterAwbNumber) return;
  try {
    const master = await findLiveMasterForTotals(masterAwbNumber);
    if (!master) return;
    const houses = await liveHousesOf(master, true);

    if (houses.length) {
      const ownLines = await ownRateLinesOf(master);
      const ownPieces = sumPieces(ownLines);
      const ownWeight = sumGrossWeight(ownLines);
      if (ownPieces > 0 && ownWeight > 0) {
        const piecesDiffer = Number(master.totalPieces) !== ownPieces;
        const weightDiffers = Math.abs((parseFloat(master.grossWeight) || 0) - ownWeight) > WEIGHT_EQUAL_TOLERANCE;
        if (piecesDiffer || weightDiffers)
          await master.update({ totalPieces: ownPieces, grossWeight: +ownWeight.toFixed(3) });
        return;
      }
    }

    if (houses.length === 0) {
      const lines = await ownRateLinesOf(master);
      const pieces = sumPieces(lines);
      const weight = sumGrossWeight(lines);
      if (pieces || weight) {
        await master.update({
          totalPieces: pieces || master.totalPieces,
          grossWeight: +(weight || master.grossWeight).toFixed(3),
        });
      }
      return;
    }

    let totalPieces = 0;
    let totalGrossWeight = 0;
    let totalVolume = 0;
    for (const house of houses) {
      totalPieces += parseInt(house.totalPieces, 10) || 0;
      totalGrossWeight += houseKg(house); // houses in pounds converted to kg
      totalVolume += parseFloat(house.totalVolume) || 0;
    }
    await master.update({
      totalPieces,
      grossWeight: +totalGrossWeight.toFixed(3),
      totalVolume: +totalVolume.toFixed(4),
    });
    console.log(
      `[Auto-Calc] MAWB ${masterAwbNumber} updated: ${totalPieces} PCS, ${totalGrossWeight} KG, ${totalVolume} CBM`,
    );
  } catch (error) {
    console.error('[Auto-Calc Error]', error.message);
  }
}
