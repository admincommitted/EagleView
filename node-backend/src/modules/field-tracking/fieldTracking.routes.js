import { Router } from 'express';
import { asyncHandler } from '../../core/http/index.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate as requireLogin } from '../../middlewares/auth.middleware.js';
import { guard as phoneGuard } from '../../sockets/fieldAuth.js';
import * as fieldTrackingController from './fieldTracking.controller.js';
import {
  agentStatusSchema,
  bulkLocationSchema,
  locationSchema,
  phoneAccessSchema,
  taskSchema,
} from './fieldTracking.validation.js';

/**
 * Mounted before the /api login check. Office screens send the EagleView login; phones register with the office code
 * and send their own device token (fieldAuth.guard checks it, a token writes only for its own agent).
 */
const router = Router();
const failureBody = (message) => ({ success: false, error: message });
const checked = (schema) => validate({ body: schema }, { errorBody: failureBody });
const handle = (controller) => asyncHandler(controller, { errorBody: (error) => failureBody(error.message) });

const MAX_PINGS_PER_CALL = 200;

// the agent ids a call writes for, for the phone guard
const bodyAgentId = (req) => [req.body && req.body.agentId];
const bulkPingAgentIds = (req) =>
  Array.isArray(req.body && req.body.pings)
    ? req.body.pings.slice(0, MAX_PINGS_PER_CALL).map((ping) => ping && ping.agentId)
    : [];
const pathAgentId = (req) => [req.params.id];

router.get('/agents', handle(fieldTrackingController.listAgents));
router.get('/public-url', requireLogin, fieldTrackingController.readPublicUrl);
router.get('/agents/:id', requireLogin, handle(fieldTrackingController.getAgent));
router.post('/agents', handle(fieldTrackingController.addAgent));

router.post(
  '/location',
  phoneGuard(bodyAgentId),
  checked(locationSchema),
  handle(fieldTrackingController.recordLocation),
);
router.post(
  '/location/bulk',
  phoneGuard(bulkPingAgentIds),
  checked(bulkLocationSchema),
  handle(fieldTrackingController.recordLocations),
);

router.post('/device/register', fieldTrackingController.registerDevice);
router.get('/device/settings', requireLogin, handle(fieldTrackingController.phoneAccessSettings));
router.put(
  '/device/settings',
  requireLogin,
  fieldTrackingController.requirePhoneAccessAdmin,
  checked(phoneAccessSchema),
  handle(fieldTrackingController.savePhoneAccess),
);
router.post(
  '/agents/:id/disconnect',
  requireLogin,
  fieldTrackingController.requirePhoneAccessAdmin,
  handle(fieldTrackingController.disconnectPhone),
);

router.get('/health', fieldTrackingController.health);

router.get('/history/:agentId', requireLogin, handle(fieldTrackingController.locationHistory));
router.post('/task', phoneGuard(bodyAgentId), checked(taskSchema), handle(fieldTrackingController.assignTask));
router.patch(
  '/agents/:id/status',
  phoneGuard(pathAgentId),
  checked(agentStatusSchema),
  handle(fieldTrackingController.setAgentStatus),
);
router.patch('/agents/:id/task-complete', phoneGuard(pathAgentId), handle(fieldTrackingController.completeTask));
router.delete('/agents/:id', requireLogin, handle(fieldTrackingController.deactivateAgent));
router.post('/siren', requireLogin, handle(fieldTrackingController.triggerSiren));
router.get('/stats', phoneGuard(null), handle(fieldTrackingController.agentStats));

router.get('/report/summary', requireLogin, handle(fieldTrackingController.dailySummary));
router.get('/report/:agentId', requireLogin, handle(fieldTrackingController.agentDayReport));

export default router;
