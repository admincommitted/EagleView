import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { salesErrorBody } from '../../shared/salesHelpers.js';
import { getDealMeta, getDealsSummary } from './dealMeta.controller.js';

const router = Router();
const handle = (controller) => asyncHandler(controller, { errorBody: salesErrorBody });

router.get('/deal-meta', handle(getDealMeta));
router.get('/deals/summary', handle(getDealsSummary));

export default router;
