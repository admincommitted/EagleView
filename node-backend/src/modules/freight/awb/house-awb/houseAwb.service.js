import { Airwaybill, AwbLog, AwbTracking, HouseAWB } from '../../../../models/index.js';
import { awbNoError } from '../../../../utils/awb/awbSave.js';
import { liveHousesOf } from '../../../../utils/awb/XmlPayloadGenerator.js';
import { badRequest, conflict, notFound } from '../shared/awbErrors.js';
import { findLiveRecordWithNumber, userNameOf } from '../shared/awbNumbers.js';
import { logUnexpectedError } from '../shared/errorLog.js';
import {
  findLiveMaster,
  flownInfo,
  isSentToAirline,
  markMasterAmended,
  recalculateMawbTotals,
} from '../shared/masterAwb.js';

const houseNotFound = () => notFound({ error: 'HAWB not found' });
const digitsOf = (value) => String(value || '').replace(/\D/g, '');

/** Live HAWBs of this MAWB, number with or without the dash. */
export async function linkedHouses(masterAwbNumber) {
  if (!masterAwbNumber) throw badRequest({ error: 'masterAwbNumber is required' });
  return liveHousesOf({ awbNumber: masterAwbNumber }, false);
}

/** The live house of that number first, newest first (an old VOID one only when no live one exists). */
export async function findHouseByNumber(awbNumber) {
  const houses = await HouseAWB.findAll({
    where: { awbNumber: String(awbNumber).trim().toUpperCase() },
    order: [['id', 'DESC']],
  });
  const house = houses.find((row) => String(row.status || '').toUpperCase() !== 'VOID') || houses[0];
  if (!house) throw houseNotFound();
  return house;
}

/** A house put on / taken off a sent master: before departure the master becomes AMENDED; after departure refused. */
async function assertMastersNotFlown(masters) {
  for (const master of masters) {
    if (!master || !isSentToAirline(master)) continue;
    const flown = await flownInfo(master.awbNumber);
    if (flown)
      throw conflict({
        flown: true,
        error: `MAWB ${master.awbNumber} has ${flown} - its houses cannot be changed now.`,
      });
  }
}

async function assertMasterCanTakeHouse(masterAwbNumber) {
  const numberError = awbNoError(masterAwbNumber, 'MAWB');
  if (numberError) throw badRequest({ error: numberError });
  if (!(await findLiveRecordWithNumber(Airwaybill, masterAwbNumber, 'MAWB'))) {
    throw notFound({ error: `MAWB ${masterAwbNumber} is not saved (or is VOID)` });
  }
}

async function moveHouseTracking(house, oldMaster, masterAwbNumber) {
  if (oldMaster && masterAwbNumber && oldMaster !== masterAwbNumber) {
    await AwbTracking.update(
      { awbNumber: masterAwbNumber },
      { where: { awbNumber: oldMaster, hawbNumber: house.awbNumber } },
    ).catch(() => {});
  }
}

/** PATCH /hawb/:id/link { masterAwbNumber, masterAwbId } - link or unlink a HAWB to a master AWB. */
export function linkHouseToMaster(houseId, body, user) {
  return logUnexpectedError(
    (error) => console.error('HAWB link error:', error),
    async () => {
      const { masterAwbNumber, masterAwbId } = body;
      const house = await HouseAWB.findByPk(houseId);
      if (!house) throw houseNotFound();
      if (house.status === 'VOID') throw conflict({ error: `HAWB ${house.awbNumber} is VOID` });
      if (masterAwbNumber) await assertMasterCanTakeHouse(masterAwbNumber);

      const oldMaster = house.masterAwbNumber;
      const moving = digitsOf(oldMaster) !== digitsOf(masterAwbNumber);
      const sameMasterId = masterAwbId == null || String(house.masterAwbId || '') === String(masterAwbId);
      if (!moving && sameMasterId) {
        // nothing to do (the MAWB save sends every house)
        return { success: true, message: 'Already on this master', unchanged: true, hawb: house };
      }

      const userName = userNameOf(user);
      const newMaster = masterAwbNumber ? await findLiveMaster(masterAwbNumber) : null;
      const previousMaster = moving && oldMaster ? await findLiveMaster(oldMaster) : null;
      await assertMastersNotFlown([newMaster, previousMaster]);

      await house.update({ masterAwbNumber: masterAwbNumber || null, masterAwbId: masterAwbId || null });
      await moveHouseTracking(house, oldMaster, masterAwbNumber);
      if (oldMaster) await recalculateMawbTotals(oldMaster);
      if (masterAwbNumber) await recalculateMawbTotals(masterAwbNumber);
      if (newMaster && moving)
        await markMasterAmended(newMaster, `HAWB ${house.awbNumber} put on the master`, userName);
      if (previousMaster) {
        await markMasterAmended(
          previousMaster,
          `HAWB ${house.awbNumber} moved to ${masterAwbNumber || 'no master'}`,
          userName,
        );
      }
      if (moving) {
        await AwbLog.create({
          awbNumber: house.awbNumber,
          action: 'HAWB_LINKED',
          user: userName,
          details: `${oldMaster || '-'} -> ${masterAwbNumber || '-'}`,
        }).catch(() => {});
      }
      return { success: true, message: masterAwbNumber ? `Linked to ${masterAwbNumber}` : 'Unlinked', hawb: house };
    },
  );
}

/** POST /hawb/:id/unlink - take a house off its master. */
export async function unlinkHouse(houseId, body, user) {
  const house = await HouseAWB.findByPk(houseId);
  if (!house) throw houseNotFound();
  const master = house.masterAwbNumber;
  const expectedMaster = body && body.masterAwbNumber;
  if (expectedMaster && master && digitsOf(expectedMaster) !== digitsOf(master)) {
    throw conflict({ error: `HAWB is linked to ${master}, not ${expectedMaster}` });
  }
  const liveMaster = await findLiveMaster(master);
  await assertMastersNotFlown([liveMaster]);

  const userName = userNameOf(user);
  await house.update({ masterAwbNumber: null, masterAwbId: null, modifiedBy: userName });
  if (master) await recalculateMawbTotals(master);
  if (liveMaster) await markMasterAmended(liveMaster, `HAWB ${house.awbNumber} taken off the master`, userName);
  await AwbLog.create({
    awbNumber: house.awbNumber,
    action: 'HAWB_UNLINKED',
    user: userName,
    details: `Removed from master ${master || '-'}`,
  }).catch(() => {});
  return { success: true };
}
