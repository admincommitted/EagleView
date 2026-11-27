import { Router } from 'express';
import { requireAdmin } from '../../../middlewares/auth.middleware.js';
import { handleRoute } from '../shared/routeHandler.js';
import { addSeries, changeSeries, listSeries, peekNumber, saveBranchCodes } from './numberSeries.controller.js';

const router = Router();

router.get('/', handleRoute(listSeries));
router.get('/peek', handleRoute(peekNumber));
router.post('/', requireAdmin, handleRoute(addSeries));
router.put('/:id', requireAdmin, handleRoute(changeSeries));
router.post('/branch', requireAdmin, handleRoute(saveBranchCodes));

export default router;
