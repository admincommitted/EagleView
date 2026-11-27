import { Router } from 'express';
import { recordErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import {
  createTariffComponent,
  createTariffHeader,
  deleteTariffComponent,
  deleteTariffHeader,
  listTariffHeaders,
  updateTariffComponent,
  updateTariffHeader,
} from './tariffHeader.controller.js';

const router = Router();

router.get('/tariffheaders/all', routeHandler(listTariffHeaders));
router.post('/tariffheaders', routeHandler(createTariffHeader, recordErrorAnswer()));
router.put('/tariffheaders/:id', routeHandler(updateTariffHeader, recordErrorAnswer()));
router.delete('/tariffheaders/:id', routeHandler(deleteTariffHeader));
router.post('/tariffcomponents', routeHandler(createTariffComponent, recordErrorAnswer()));
router.put('/tariffcomponents/:id', routeHandler(updateTariffComponent, recordErrorAnswer()));
router.delete('/tariffcomponents/:id', routeHandler(deleteTariffComponent));

export default router;
