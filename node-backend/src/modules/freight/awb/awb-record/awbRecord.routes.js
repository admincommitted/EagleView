import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import {
  createAwb,
  duplicateAwb,
  findAwbByNumber,
  listActivityLog,
  updateAwb,
  voidAwb,
} from './awbRecord.controller.js';

const router = Router();

router.post('/create', asyncHandler(createAwb));
router.get('/search/:awbNumber', asyncHandler(findAwbByNumber));
router.put('/update/:id', asyncHandler(updateAwb));
router.put('/void/:id', asyncHandler(voidAwb));
router.post('/duplicate/:id', asyncHandler(duplicateAwb));
router.get('/logs/:awbNumber', asyncHandler(listActivityLog));

export default router;
