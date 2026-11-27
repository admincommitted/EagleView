import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { tdsNatureBody } from './tdsSchedule.validation.js';
import {
  addStandardSections,
  addTdsNature,
  changeTdsNature,
  getTdsSchedule,
  removeTdsNature,
} from './tdsSchedule.controller.js';

const router = Router();

// a second nature of payment with the same name breaks the UNIQUE index: answered as a 400 with a plain message
const DUPLICATE_AS_BAD_REQUEST = {
  onError: (res, error) => {
    const isDuplicate = /UNIQUE/.test(error.message);
    res
      .status(error.status || (isDuplicate ? 400 : 500))
      .json({ error: isDuplicate ? 'This nature of payment already exists' : error.message });
  },
};

router.get('/tds-schedule', handleHubRoute(getTdsSchedule));
router.post(
  '/tds-schedule',
  validate({ body: tdsNatureBody }, OLD_ERROR_SHAPE),
  handleHubRoute(addTdsNature, DUPLICATE_AS_BAD_REQUEST),
);
router.put(
  '/tds-schedule/:id',
  validate({ body: tdsNatureBody }, OLD_ERROR_SHAPE),
  handleHubRoute(changeTdsNature, DUPLICATE_AS_BAD_REQUEST),
);
router.delete('/tds-schedule/:id', handleHubRoute(removeTdsNature));
router.post('/tds-schedule/standard', handleHubRoute(addStandardSections));

export default router;
