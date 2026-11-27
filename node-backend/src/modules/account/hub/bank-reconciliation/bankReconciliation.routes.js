import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { bankReconciliationQuery } from './bankReconciliation.validation.js';
import { getBankReconciliation } from './bankReconciliation.controller.js';

const router = Router();

router.get(
  '/brs',
  validate({ query: bankReconciliationQuery }, OLD_ERROR_SHAPE),
  handleHubRoute(getBankReconciliation),
);

export default router;
