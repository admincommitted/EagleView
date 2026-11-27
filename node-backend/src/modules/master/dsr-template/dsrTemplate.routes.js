import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { failedMessageAnswer, routeHandler } from '../shared/errorAnswers.js';
import { deleteTemplate, listTemplates, saveTemplate } from './dsrTemplate.controller.js';
import { dsrTemplateErrorBody, saveTemplateSchema } from './dsrTemplate.validation.js';

/** /api/dsr-templates (Settings > DSR Template Master) */
const router = Router();

router.get('/', routeHandler(listTemplates, failedMessageAnswer));
router.post(
  '/',
  validate({ body: saveTemplateSchema }, { errorBody: dsrTemplateErrorBody }),
  routeHandler(saveTemplate, failedMessageAnswer),
);
router.delete('/:id', routeHandler(deleteTemplate, failedMessageAnswer));

export default router;
