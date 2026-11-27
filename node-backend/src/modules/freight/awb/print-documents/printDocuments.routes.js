import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { errorOnlyBody } from '../../shared/orderedChecks.js';
import { consolManifest, documentData, generateAwbPdf } from './printDocuments.controller.js';
import { manifestParamsSchema } from './printDocuments.validation.js';

const router = Router();

router.get(
  '/manifest/:masterAwbNumber',
  validate({ params: manifestParamsSchema }, errorOnlyBody),
  asyncHandler(consolManifest),
);
router.get('/doc-data/:type/:id', asyncHandler(documentData));
router.post('/generate-pdf', asyncHandler(generateAwbPdf));

export default router;
