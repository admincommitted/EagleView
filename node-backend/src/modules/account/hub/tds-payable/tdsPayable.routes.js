import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { challanBody, monthDetailQuery } from './tdsPayable.validation.js';
import { addChallan, getTdsMonthDetail, getTdsPayable, removeChallan } from './tdsPayable.controller.js';

const router = Router();

router.get('/tds-payable', handleHubRoute(getTdsPayable));
router.get(
  '/tds-payable/detail',
  validate({ query: monthDetailQuery }, OLD_ERROR_SHAPE),
  handleHubRoute(getTdsMonthDetail),
);
router.post('/tds-challans', validate({ body: challanBody }, OLD_ERROR_SHAPE), handleHubRoute(addChallan));
router.delete('/tds-challans/:id', handleHubRoute(removeChallan));

export default router;
