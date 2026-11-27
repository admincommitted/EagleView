import { Router } from 'express';
import { routeHandler } from '../shared/errorAnswers.js';
import { directoryEntry, directoryStats, importIntoPartyMaster, searchDirectory } from './icaffeParty.controller.js';

/** /api/icaffe-parties */
const router = Router();

router.get('/stats', routeHandler(directoryStats));
router.get('/', routeHandler(searchDirectory));
router.get('/:id', routeHandler(directoryEntry));
router.post('/:id/import', routeHandler(importIntoPartyMaster));

export default router;
