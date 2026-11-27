import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { salesErrorBody } from '../../shared/salesHelpers.js';
import { loadCustomersFromBooks } from './customerImport.controller.js';

const router = Router();

router.post('/customers/load-from-books', asyncHandler(loadCustomersFromBooks, { errorBody: salesErrorBody }));

export default router;
