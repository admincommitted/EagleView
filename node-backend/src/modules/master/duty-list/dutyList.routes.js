import { Router } from 'express';
import { routeHandler } from '../shared/errorAnswers.js';
import { addRow, listCounts, listRows, setRowActive, updateRow } from './dutyList.controller.js';

/**
 * /api/tariff/dutylists (mounted inside tariff.routes.js). Reads are open to every logged-in user and writes need the
 * "Customs & Compliance" module (the /api/tariff permission rule).
 */
const router = Router();

router.get('/', routeHandler(listCounts));
router.get('/:kind', routeHandler(listRows));
router.post('/:kind', routeHandler(addRow));
router.put('/:kind/:id/active', routeHandler(setRowActive));
router.put('/:kind/:id', routeHandler(updateRow));

export default router;
