import * as dutyNotificationService from './dutyNotification.service.js';

const DELETED = { message: 'Deleted' };

export async function notificationDetails(req, res) {
  res.json(await dutyNotificationService.notificationDetails(req.params.id));
}

export async function listNotifications(req, res) {
  res.json(await dutyNotificationService.listNotifications(req.query));
}

export async function bulkUploadNotifications(req, res) {
  res.json(await dutyNotificationService.bulkUploadNotifications(req.validated.body));
}

export async function createNotification(req, res) {
  res.status(201).json(await dutyNotificationService.createNotification(req.body));
}

export async function updateNotification(req, res) {
  res.json(await dutyNotificationService.updateNotification(req.params.id, req.body));
}

export async function deleteNotification(req, res) {
  await dutyNotificationService.deleteNotification(req.params.id);
  res.json(DELETED);
}

export async function createNotificationDetail(req, res) {
  res.status(201).json(await dutyNotificationService.createNotificationDetail(req.body));
}

export async function updateNotificationDetail(req, res) {
  res.json(await dutyNotificationService.updateNotificationDetail(req.params.id, req.body));
}

export async function deleteNotificationDetail(req, res) {
  await dutyNotificationService.deleteNotificationDetail(req.params.id);
  res.json(DELETED);
}
