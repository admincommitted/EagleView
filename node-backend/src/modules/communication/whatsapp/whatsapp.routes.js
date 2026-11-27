import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { requireAdmin } from '../../../middlewares/auth.middleware.js';
import { withFixedErrorStatus } from '../fixedErrorStatus.js';
import * as whatsappController from './whatsapp.controller.js';
import {
  internalMessageSchema,
  moduleNumberSchema,
  statusMessageSchema,
  testNumberSchema,
} from './whatsapp.validation.js';

/** Connecting WhatsApp (the QR / link stream), tests and queue control are for an admin only. */
const router = Router();
const SERVER_ERROR = 500;
const checked = (schema) => validate({ body: schema }, { errorBody: (message) => ({ error: message }) });
// these answer an error with its own status (a wrong number is 400)
const withOwnStatus = (controller) =>
  asyncHandler(controller, {
    errorBody: (error) => ({ success: false, error: error.message }),
  });
// these answer every error with 500
const with500 = (controller) => withFixedErrorStatus(controller, SERVER_ERROR, (error) => ({ error: error.message }));

router.get('/state', whatsappController.connectionState);
router.post('/api-test', requireAdmin, checked(testNumberSchema), withOwnStatus(whatsappController.sendApiTest));
router.get('/events', requireAdmin, whatsappController.streamEvents);
router.post('/connect', requireAdmin, with500(whatsappController.connect));
router.post('/disconnect', requireAdmin, with500(whatsappController.disconnect));
router.post('/test', requireAdmin, checked(testNumberSchema), with500(whatsappController.sendTestMessage));
router.post('/send-internal', checked(internalMessageSchema), withOwnStatus(whatsappController.sendInternalMessage));

router.get('/queue-stats', with500(whatsappController.queueStats));
router.post('/flush-queue', requireAdmin, with500(whatsappController.flushQueue));
router.post('/restart-scheduler', requireAdmin, with500(whatsappController.restartScheduler));
router.post('/send-status', checked(statusMessageSchema), withOwnStatus(whatsappController.sendStatusMessage));

router.get('/module-numbers', with500(whatsappController.listModuleNumbers));
router.post('/module-numbers', requireAdmin, checked(moduleNumberSchema), with500(whatsappController.saveModuleNumber));
router.delete('/module-numbers/:moduleName', requireAdmin, with500(whatsappController.removeModuleNumber));

export default router;
