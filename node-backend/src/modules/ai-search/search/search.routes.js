import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { awbQueryFailure, globalSearchFailure, searchAwbs, searchEverything } from './search.controller.js';

const router = Router();

router.get('/global-search', asyncHandler(searchEverything, { errorBody: globalSearchFailure }));
router.get('/awb-query', asyncHandler(searchAwbs, { errorBody: awbQueryFailure }));

export default router;
