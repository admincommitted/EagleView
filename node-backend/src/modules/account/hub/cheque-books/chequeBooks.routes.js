import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { changeChequeLeaf, getChequeBooks, getChequeLeaves } from './chequeBooks.controller.js';

const router = Router();

router.get('/cheque-books', handleHubRoute(getChequeBooks));
router.get('/cheque-books/:id/leaves', handleHubRoute(getChequeLeaves));
router.post('/cheque-books/:id/leaves/:no', handleHubRoute(changeChequeLeaf));

export default router;
