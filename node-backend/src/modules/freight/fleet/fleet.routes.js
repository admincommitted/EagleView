import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import {
  createLorryReceipt,
  deleteLorryReceipt,
  formMasters,
  listLorryReceipts,
  nextLrNo,
  postDriverAdvance,
  updateLorryReceipt,
} from './fleet.controller.js';

const router = Router();

const failureAnswer = { errorBody: (error) => ({ success: false, error: error.message }) };

router.get('/lr', asyncHandler(listLorryReceipts, failureAnswer));
router.get('/lr/next-no', asyncHandler(nextLrNo, failureAnswer));
router.get('/masters', asyncHandler(formMasters, failureAnswer));
router.post('/lr', asyncHandler(createLorryReceipt, failureAnswer));
router.put('/lr/:id', asyncHandler(updateLorryReceipt, failureAnswer));
router.post('/lr/:id/post-advance', asyncHandler(postDriverAdvance, failureAnswer));
router.delete('/lr/:id', asyncHandler(deleteLorryReceipt, failureAnswer));

export default router;
