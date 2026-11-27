import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { errorOnlyBody } from '../../shared/orderedChecks.js';
import { deleteTemplate, listTemplates, saveTemplate } from './templates.controller.js';
import { saveTemplateBodySchema, templateNameParamsSchema, templateTypeParamsSchema } from './templates.validation.js';

const router = Router();

router.get(
  '/templates/:type',
  validate({ params: templateTypeParamsSchema }, errorOnlyBody),
  asyncHandler(listTemplates),
);
router.put(
  '/templates/:type/:name',
  validate({ params: templateNameParamsSchema, body: saveTemplateBodySchema }, errorOnlyBody),
  asyncHandler(saveTemplate),
);
router.delete('/templates/:type/:name', asyncHandler(deleteTemplate));

export default router;
