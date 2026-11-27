import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import { DutyNotifDetail, DutyNotifHeader } from '../../../models/index.js';
import { cleanBody } from '../shared/cleanBody.js';

const DEFAULT_NOTIFICATION_TYPE = 'CUSTOM';
const ISO_DAY_START = /^(\d{4})-(\d{2})-(\d{2})/;
const DAY_MONTH_YEAR = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

const failed = (ErrorClass, message) => new ErrorClass(message, { body: { error: message } });

/** yyyy-mm-dd or dd/mm/yyyy -> yyyy-mm-dd; anything else null */
function dayOf(value) {
  const text = String(value || '').trim();
  let match = ISO_DAY_START.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = DAY_MONTH_YEAR.exec(text);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return null;
}

/** One notification's serial rows (with 200,000+ serial rows the screen loads them per notification). */
export const notificationDetails = (headerId) =>
  DutyNotifDetail.findAll({ where: { headerId }, order: [['id', 'ASC']] });

/** ?lite: the headers only, with a detail count; otherwise every header with its serial rows. */
export async function listNotifications({ lite }) {
  if (lite) {
    const rows = await sequelize.query(
      'SELECT h.*, (SELECT count(*) FROM DutyNotifDetails d WHERE d.headerId = h.id) AS detailCount ' +
        'FROM DutyNotifHeaders h ORDER BY h.type, h.notifNo',
      { type: QueryTypes.SELECT },
    );
    return rows.map((row) => ({ ...row, isActive: row.isActive === 1 || row.isActive === true }));
  }
  return DutyNotifHeader.findAll({ include: [{ model: DutyNotifDetail, as: 'details' }] });
}

async function headerOfUploadRow(item, notifNo, transaction) {
  const type = (item.type || DEFAULT_NOTIFICATION_TYPE).toUpperCase();
  // a notification no. is unique per type (IGST 001/2017 and ADD 001/2017 differ)
  const [header] = await DutyNotifHeader.findOrCreate({
    where: { notifNo, type },
    defaults: { type, effectiveDate: dayOf(item.headerDate), isActive: true },
    transaction,
  });
  return header;
}

async function refreshHeaderFromUploadRow(header, item, transaction) {
  const changes = {};
  if (item.type) changes.type = String(item.type).toUpperCase();
  if (dayOf(item.headerDate)) changes.effectiveDate = dayOf(item.headerDate);
  if (Object.keys(changes).length) await header.update(changes, { transaction });
}

const detailValuesOf = (item) => ({
  tariffHead: String(item.tariffHead || '').trim(),
  specificSeries: item.specificSeries || '',
  dutyRate: parseFloat(item.dutyRate) || 0,
  itemDescription: item.itemDescription || '',
  conditionNo: item.conditionNo || '',
  effectiveDate: dayOf(item.detailDate),
});

/**
 * POST /dutynotifs/bulk-upload [{ notifNo, type, headerDate, serialNo, ... }]: a serial no already in the notification
 * is updated (the same file uploaded twice does not double the rows); the header's type / date are updated too.
 */
export async function bulkUploadNotifications(items) {
  const seenHeaders = new Set();
  let created = 0;
  let updated = 0;
  await sequelize.transaction(async (transaction) => {
    for (const item of items) {
      const notifNo = String(item.notifNo || '').trim();
      if (!notifNo) continue;
      const header = await headerOfUploadRow(item, notifNo, transaction);
      if (!seenHeaders.has(header.id)) {
        seenHeaders.add(header.id);
        await refreshHeaderFromUploadRow(header, item, transaction);
      }
      const serialNo = String(item.serialNo || '').trim();
      if (!serialNo) continue;
      const values = detailValuesOf(item);
      const existing = await DutyNotifDetail.findOne({ where: { headerId: header.id, serialNo }, transaction });
      if (existing) {
        await existing.update(values, { transaction });
        updated++;
      } else {
        await DutyNotifDetail.create({ ...values, serialNo, headerId: header.id }, { transaction });
        created++;
      }
    }
  });
  return { message: 'Bulk upload successful', headers: seenHeaders.size, created, updated };
}

export const createNotification = (body) => DutyNotifHeader.create(cleanBody(DutyNotifHeader, body));

export async function updateNotification(id, body) {
  await DutyNotifHeader.update(cleanBody(DutyNotifHeader, body), { where: { id } });
  const notification = await DutyNotifHeader.findByPk(id);
  if (!notification) throw failed(NotFoundError, 'Notification not found');
  return notification;
}

/** A notification goes with its serial numbers. */
export async function deleteNotification(id) {
  await sequelize.transaction(async (transaction) => {
    await DutyNotifDetail.destroy({ where: { headerId: id }, transaction });
    await DutyNotifHeader.destroy({ where: { id }, transaction });
  });
}

export async function createNotificationDetail(body) {
  const detail = cleanBody(DutyNotifDetail, body);
  if (!detail.headerId) throw failed(BadRequestError, 'Choose the notification first');
  if (!String(detail.serialNo || '').trim()) throw failed(BadRequestError, 'Serial no is required');
  const duplicate = await DutyNotifDetail.findOne({
    where: { headerId: detail.headerId, serialNo: String(detail.serialNo).trim() },
  });
  if (duplicate) throw failed(ConflictError, `Serial no ${detail.serialNo} already exists in this notification`);
  return DutyNotifDetail.create(detail);
}

export async function updateNotificationDetail(id, body) {
  await DutyNotifDetail.update(cleanBody(DutyNotifDetail, body), { where: { id } });
  const detail = await DutyNotifDetail.findByPk(id);
  if (!detail) throw failed(NotFoundError, 'Serial no not found');
  return detail;
}

export const deleteNotificationDetail = (id) => DutyNotifDetail.destroy({ where: { id } });
