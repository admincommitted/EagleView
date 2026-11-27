import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { handleRoute, successFalseMessage } from '../shared/handleRoute.js';
import {
  deleteJob,
  downloadSample,
  editDsrField,
  filedJson,
  getJob,
  getJobByJobNo,
  importFromFile,
  itemHistory,
  jobLogs,
  jobsByBeNo,
  listJobs,
  patchItems,
  pinSuggestions,
  saveJob,
  searchJobs,
} from './importJob.controller.js';
import { byBeQuerySchema, dsrFieldBodySchema, importFileBodySchema } from './importJob.validation.js';

const router = Router();

const successFalseError = (message) => ({ success: false, error: message });
const successFalseMessageText = (message) => ({ success: false, message });

router.post('/', asyncHandler(saveJob));
router.post('/:id/items-patch', handleRoute(patchItems, { useErrorStatus: true }));
router.get('/:id/filed-json', handleRoute(filedJson));
router.post(
  '/import-json-direct',
  validate({ body: importFileBodySchema }, { errorBody: successFalseError }),
  handleRoute(importFromFile, { status: 400 }),
);
router.get('/', handleRoute(listJobs));
router.delete('/:id', handleRoute(deleteJob));
router.get('/:id/logs', handleRoute(jobLogs));
router.put(
  '/:id/dsr',
  validate({ body: dsrFieldBodySchema }, { errorBody: successFalseMessageText }),
  handleRoute(editDsrField, { errorBody: successFalseMessage }),
);
router.get('/search', handleRoute(searchJobs));
router.get('/sample/:kind', handleRoute(downloadSample));
router.get('/pin-suggest', handleRoute(pinSuggestions));
router.get('/by-be', validate({ query: byBeQuerySchema }, { errorBody: successFalseError }), handleRoute(jobsByBeNo));
router.get('/item-history', handleRoute(itemHistory));
router.get('/:id', handleRoute(getJob));
router.get('/by-jobno/:jobNo', handleRoute(getJobByJobNo));

export default router;
