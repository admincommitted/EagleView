import { Router } from 'express';
import { handleRoute } from '../shared/routeHandler.js';
import { addInvoice, getInvoices } from './invoice.controller.js';

const router = Router();

router.post('/', handleRoute(addInvoice));
router.get('/', handleRoute(getInvoices));

export default router;
