import { Router } from 'express';
import { validate } from '../../../middlewares/validate.middleware.js';
import { routeHandler } from '../shared/errorAnswers.js';
import { createSph, deleteSph, listSpecialHandlingCodes, listSphMaster, updateSph } from './sph.controller.js';
import { createSphSchema, sphErrorBody } from './sph.validation.js';

const router = Router();

router.get('/sph-master', routeHandler(listSphMaster));
router.get('/specialhandlingcodes', routeHandler(listSpecialHandlingCodes));
router.post('/sph-master', validate({ body: createSphSchema }, { errorBody: sphErrorBody }), routeHandler(createSph));
router.put('/sph-master/:id', routeHandler(updateSph));
router.delete('/sph-master/:id', routeHandler(deleteSph));

export default router;
