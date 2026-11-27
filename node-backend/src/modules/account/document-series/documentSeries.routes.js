import { Router } from 'express';
import { requireAdmin } from '../../../middlewares/auth.middleware.js';
import { handleRoute, successFalseBody } from '../shared/routeHandler.js';
import {
  addDocumentSeries,
  changeDocumentSeries,
  listDocumentSeries,
  removeDocumentSeries,
  takeDocumentNumber,
} from './documentSeries.controller.js';

const router = Router();
const handle = (controller) => handleRoute(controller, { errorBody: successFalseBody });

router.get('/', handle(listDocumentSeries));
router.post('/', requireAdmin, handle(addDocumentSeries));
router.put('/:id', requireAdmin, handle(changeDocumentSeries));
router.delete('/:id', requireAdmin, handle(removeDocumentSeries));
router.post('/take', handle(takeDocumentNumber));

export default router;
