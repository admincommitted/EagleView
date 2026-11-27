import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { createVendor, deleteVendor, listVendors, updateVendor } from './vendors.controller.js';

/** /api/po/vendors - the Vendor Master screen. */
const router = Router();

router.get('/', asyncHandler(listVendors));
router.post('/', asyncHandler(createVendor));
router.put('/:id', asyncHandler(updateVendor));
router.delete('/:id', asyncHandler(deleteVendor));

export default router;
