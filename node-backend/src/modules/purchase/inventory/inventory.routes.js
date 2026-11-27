import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import {
  createCategory,
  createGodown,
  createGroup,
  createStockItem,
  createUnitOfMeasure,
  listAllMasters,
} from './inventory.controller.js';

/** /api/inventory - inventory masters (groups, categories, units, godowns, stock items). */
const router = Router();

router.get('/all', asyncHandler(listAllMasters));
router.post('/groups', createGroup);
router.post('/categories', createCategory);
router.post('/uoms', createUnitOfMeasure);
router.post('/godowns', createGodown);
router.post('/items', createStockItem);

export default router;
