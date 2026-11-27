import { Op } from 'sequelize';

export const AWB_DIGITS = 11;

/** Status condition for a live (not voided) AWB / HAWB row. */
export const liveStatus = () => ({ [Op.or]: [{ [Op.ne]: 'VOID' }, null] });

/** Only letters and digits, upper case: "176-1234 5675" -> "17612345675". */
export const bareAwbNo = (number) =>
  String(number || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

/** "17612345675" -> "176-12345675". */
export const dashedAwbNo = (bare) => `${bare.slice(0, 3)}-${bare.slice(3)}`;

/** AWB / MAWB / direct AWB rows share the AWB tables; HAWB rows have their own type. */
export const awbTypesOf = (type) => (String(type).toUpperCase() === 'HAWB' ? ['HAWB'] : ['AWB', 'MAWB']);

/** AWB number written the way the screens send it (176-12345675); HAWB numbers stay as typed. */
export function normaliseAwbNo(number, type) {
  const bare = String(number || '').replace(/[^A-Za-z0-9]/g, '');
  const isAirlineNumber = String(type).toUpperCase() !== 'HAWB' && /^\d{11}$/.test(bare);
  return isAirlineNumber ? dashedAwbNo(bare) : String(number || '').trim();
}

/** The number as typed, digits only and dashed: the forms an AWB number is saved in. */
export function awbNumberVariants(number) {
  const digits = String(number || '').replace(/\D/g, '');
  const dashed = digits.length === AWB_DIGITS ? dashedAwbNo(digits) : '';
  return [...new Set([String(number || ''), digits, dashed].filter(Boolean))];
}

/** IATA check digit: the 7-digit serial modulo 7. */
export const checkDigitOf = (serial7) => Number(serial7) % 7;

/** A live record of this model already using the number (with or without the dash), except the record `exceptId`. */
export async function findLiveRecordWithNumber(Model, number, type, exceptId) {
  const bare = String(number || '').replace(/[^A-Za-z0-9]/g, '');
  const where = {
    awbNumber: { [Op.in]: [...new Set([number, bare, normaliseAwbNo(number, type)])] },
    status: liveStatus(),
  };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  return Model.findOne({ where });
}

export const userNameOf = (user) => user?.username || 'System';
