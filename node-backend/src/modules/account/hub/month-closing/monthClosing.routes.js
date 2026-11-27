import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { monthActionParams } from './monthClosing.validation.js';
import { changeMonthState, listMonths } from './monthClosing.controller.js';

const router = Router();

router.get('/months', handleHubRoute(listMonths));
router.post(
  '/months/:ym/:action',
  validate({ params: monthActionParams }, OLD_ERROR_SHAPE),
  handleHubRoute(changeMonthState),
);

export default router;
