import { Router } from 'express';
import { companyMasterErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import { createCha, deleteCha, listChas, resetDefaultCha, updateCha } from './cha.controller.js';

const router = Router();

router.get('/cha-master', routeHandler(listChas, companyMasterErrorAnswer));
router.post('/cha-master', routeHandler(createCha, companyMasterErrorAnswer));
router.put('/cha-master/reset-default', resetDefaultCha);
router.put('/cha-master/:id', routeHandler(updateCha, companyMasterErrorAnswer));
router.delete('/cha-master/:id', routeHandler(deleteCha, companyMasterErrorAnswer));

export default router;
