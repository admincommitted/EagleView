import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { onlyNumericParam, salesErrorBody } from '../../shared/salesHelpers.js';
import { addLookupValue, getSalesMeta, updateLookupValue } from './lists.controller.js';

const router = Router();
const handle = (controller) => asyncHandler(controller, { errorBody: salesErrorBody });

router.param('id', onlyNumericParam);

router.get('/meta', handle(getSalesMeta));
router.post('/lookups', handle(addLookupValue));
router.put('/lookups/:id', handle(updateLookupValue));

export default router;
