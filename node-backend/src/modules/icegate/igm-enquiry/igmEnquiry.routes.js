import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { fetchAirIgm, fetchSeaIgm } from './igmEnquiry.controller.js';
import { airIgmSchema, failureBody, seaIgmSchema } from './igmEnquiry.validation.js';

// Import job > IGM Details > "Fetch from ICEGATE": reads ICEGATE's public IGM enquiries
const router = Router();

router.post('/air-igm', validate({ body: airIgmSchema }, { errorBody: failureBody }), asyncHandler(fetchAirIgm));
router.post('/sea-igm', validate({ body: seaIgmSchema }, { errorBody: failureBody }), asyncHandler(fetchSeaIgm));

export default router;
