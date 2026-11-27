import { Router } from 'express';
import { requireAdmin } from '../../../middlewares/auth.middleware.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { handleRoute } from '../shared/handleRoute.js';
import {
  changes,
  create,
  downloadFile,
  ensureAmendmentTable,
  getOne,
  getSettings,
  listCodes,
  listOfJob,
  listRegister,
  makeFile,
  markSubmitted,
  recordReply,
  saveSettings,
  sendFile,
  signFile,
  update,
  voidOne,
} from './beAmendment.controller.js';
import { settingsBodySchema } from './beAmendment.validation.js';

const router = Router();

// a failure answers the error's own status (utils/beAmendment.js sets it) and its list of problems, when it has one
const failure = (error) => ({ success: false, error: error.message, errors: error.errors });
const amendmentRoute = (controller) => handleRoute(controller, { useErrorStatus: true, errorBody: failure });

router.use(amendmentRoute(ensureAmendmentTable));

router.get('/codes', listCodes);
router.get('/settings', amendmentRoute(getSettings));
router.put(
  '/settings',
  requireAdmin,
  validate({ body: settingsBodySchema }, { errorBody: (message) => ({ success: false, error: message }) }),
  amendmentRoute(saveSettings),
);
router.get('/', amendmentRoute(listRegister));
router.get('/by-job/:jobId', amendmentRoute(listOfJob));
router.get('/:id', amendmentRoute(getOne));
router.post('/', amendmentRoute(create));
router.put('/:id', amendmentRoute(update));
router.get('/:id/changes', amendmentRoute(changes));
router.post('/:id/file', amendmentRoute(makeFile));
router.get('/:id/file', amendmentRoute(downloadFile));
router.post('/:id/sign', amendmentRoute(signFile));
router.post('/:id/send', amendmentRoute(sendFile));
router.post('/:id/submitted', amendmentRoute(markSubmitted));
router.post('/:id/reply', amendmentRoute(recordReply));
router.post('/:id/void', amendmentRoute(voidOne));

export default router;
