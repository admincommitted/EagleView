import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { errorOnlyBody } from '../../shared/orderedChecks.js';
import { findHouseByNumber, linkHouseToMaster, listLinkedHouses, unlinkHouse } from './houseAwb.controller.js';
import { findHouseQuerySchema } from './houseAwb.validation.js';

const router = Router();

router.get('/linked-hawbs/:masterAwbNumber', asyncHandler(listLinkedHouses));
router.get('/hawb', validate({ query: findHouseQuerySchema }, errorOnlyBody), asyncHandler(findHouseByNumber));
router.patch('/hawb/:id/link', asyncHandler(linkHouseToMaster));
router.post('/hawb/:id/unlink', asyncHandler(unlinkHouse));

export default router;
