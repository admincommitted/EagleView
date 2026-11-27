import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { failureBody } from '../shared/orderedChecks.js';
import {
  deleteStock,
  generateAwbStock,
  generateHawbStock,
  listAwbStock,
  listHawbStock,
  reserveNextAwb,
  returnAwb,
  unallocateStock,
  verifyAwb,
  voidStock,
} from './stock.controller.js';
import {
  airlinePrefixParamsSchema,
  generateAwbStockSchema,
  generateHawbStockSchema,
  returnAwbBodySchema,
  stockIdsBodySchema,
  verifyAwbParamsSchema,
} from './stock.validation.js';

const router = Router();

const failureAnswer = { errorBody: (error) => ({ success: false, error: error.message }) };

router.post(
  '/generate',
  validate({ body: generateAwbStockSchema }, failureBody),
  asyncHandler(generateAwbStock, failureAnswer),
);
router.get(
  '/next/:prefix',
  validate({ params: airlinePrefixParamsSchema }, failureBody),
  asyncHandler(reserveNextAwb, failureAnswer),
);
router.get('/list', asyncHandler(listAwbStock));
router.get('/hawb/list', asyncHandler(listHawbStock));
router.post(
  '/hawb/generate',
  validate({ body: generateHawbStockSchema }, failureBody),
  asyncHandler(generateHawbStock, failureAnswer),
);
router.post(
  '/unallocate',
  validate({ body: stockIdsBodySchema }, failureBody),
  asyncHandler(unallocateStock, failureAnswer),
);
router.post('/void', validate({ body: stockIdsBodySchema }, failureBody), asyncHandler(voidStock, failureAnswer));
router.post('/delete', validate({ body: stockIdsBodySchema }, failureBody), asyncHandler(deleteStock, failureAnswer));
router.get(
  '/verify/:awb',
  validate({ params: verifyAwbParamsSchema }, failureBody),
  asyncHandler(verifyAwb, failureAnswer),
);
router.post('/return', validate({ body: returnAwbBodySchema }, failureBody), asyncHandler(returnAwb, failureAnswer));

export default router;
