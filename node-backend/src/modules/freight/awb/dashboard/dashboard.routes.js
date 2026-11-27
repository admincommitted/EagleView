import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { dashboardInsights, listDashboardRows } from './dashboard.controller.js';

const router = Router();

const failureAnswer = { errorBody: (error) => ({ success: false, error: error.message }) };

router.get('/list', asyncHandler(listDashboardRows, failureAnswer));
router.get('/insights', asyncHandler(dashboardInsights, failureAnswer));

export default router;
