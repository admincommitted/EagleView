import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { recordErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import {
  bulkUploadNotifications,
  createNotification,
  createNotificationDetail,
  deleteNotification,
  deleteNotificationDetail,
  listNotifications,
  notificationDetails,
  updateNotification,
  updateNotificationDetail,
} from './dutyNotification.controller.js';
import { bulkUploadSchema, dutyNotificationErrorBody } from './dutyNotification.validation.js';

const router = Router();

router.get('/dutynotifs/:id/details', routeHandler(notificationDetails));
router.get('/dutynotifs/all', routeHandler(listNotifications));
router.post(
  '/dutynotifs/bulk-upload',
  validate({ body: bulkUploadSchema }, { errorBody: dutyNotificationErrorBody }),
  routeHandler(bulkUploadNotifications),
);
router.post('/dutynotifs', routeHandler(createNotification, recordErrorAnswer()));
router.put('/dutynotifs/:id', routeHandler(updateNotification, recordErrorAnswer()));
router.delete('/dutynotifs/:id', routeHandler(deleteNotification));
router.post('/dutynotifdetails', routeHandler(createNotificationDetail, recordErrorAnswer()));
router.put('/dutynotifdetails/:id', routeHandler(updateNotificationDetail, recordErrorAnswer()));
router.delete('/dutynotifdetails/:id', routeHandler(deleteNotificationDetail));

export default router;
