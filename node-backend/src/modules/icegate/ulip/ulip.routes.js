import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import * as ulip from './ulip.controller.js';
import { dgftIecSchema, failureBody } from './ulip.validation.js';

// ULIP (Settings > ULIP Integration): login test, the API list and running one API
const router = Router();

router.post(
  '/dgft/iec',
  validate({ body: dgftIecSchema }, { errorBody: failureBody }),
  asyncHandler(ulip.fetchDgftIec),
);
router.post('/test-login', asyncHandler(ulip.testLogin));
router.get('/apis', asyncHandler(ulip.listApis));
router.post('/apis', asyncHandler(ulip.createApi));
router.put('/apis/:id', asyncHandler(ulip.updateApi));
router.delete('/apis/:id', asyncHandler(ulip.deleteApi));
router.post('/apis/:id/test', asyncHandler(ulip.testApi));
router.post('/call/*apiCode', asyncHandler(ulip.callApi));

export default router;
