import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { withFixedErrorStatus } from '../fixedErrorStatus.js';
import * as notificationsController from './notifications.controller.js';
import { sendNotificationSchema, whatsappStatusSchema } from './notifications.validation.js';

/** Bell icon notifications: the user's own ones and the broadcasts sent to all users. */
const router = Router();
const SERVER_ERROR = 500;
const failureBody = (message) => ({ success: false, error: message });
const checked = (schema) => validate({ body: schema }, { errorBody: failureBody });
const handle = (controller) => withFixedErrorStatus(controller, SERVER_ERROR, (error) => failureBody(error.message));

router.use(notificationsController.ensureTokenUser);

router.get('/', handle(notificationsController.listNotifications));
// registered before /:id so "read-all" / "clear-read" are not taken as an id
router.put('/read-all', handle(notificationsController.markAllRead));
router.delete('/clear-read', handle(notificationsController.clearRead));
router.put('/:id/read', handle(notificationsController.markRead));
router.delete('/:id', handle(notificationsController.removeNotification));

router.post('/test', handle(notificationsController.sendTestNotification));
router.post('/send', checked(sendNotificationSchema), handle(notificationsController.sendNotification));
router.post('/whatsapp', checked(whatsappStatusSchema), handle(notificationsController.sendWhatsappStatus));

export default router;
