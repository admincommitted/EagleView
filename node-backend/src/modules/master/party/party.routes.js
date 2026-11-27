import { Router } from 'express';
import { routeHandler } from '../shared/errorAnswers.js';
import { activateParty, findParties, searchParties } from './party.controller.js';

const router = Router();

router.get('/parties/search', routeHandler(searchParties));
router.get('/parties/find', routeHandler(findParties));
router.post('/parties/:id/activate', routeHandler(activateParty));

export default router;
