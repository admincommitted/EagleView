import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import {
  categoryWiseExpenses,
  createPurchaseOrder,
  decideFromPortal,
  deletePurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  monthWiseExpenses,
  publicActionHandler,
  receiveItem,
  resendApprovalRequest,
  searchItemHistory,
} from './po.controller.js';
import { quoteUpload } from './shared/quoteUpload.js';
import vendorsRoutes from './vendors/vendors.routes.js';

/** /api/po - vendors, purchase orders and their approval by the director. */
const router = Router();
const resendErrorBody = () => ({ success: false, message: 'Internal server error during resend' });

router.use('/vendors', vendorsRoutes);
router.get('/', asyncHandler(listPurchaseOrders));
router.post('/', quoteUpload.single('quote'), asyncHandler(createPurchaseOrder));
router.get('/dashboard/month-wise-expenses', asyncHandler(monthWiseExpenses));
router.get('/dashboard/category-wise-expenses', asyncHandler(categoryWiseExpenses));
router.put('/items/:id/receive', asyncHandler(receiveItem));
router.get('/item-history/search', asyncHandler(searchItemHistory));
router.get('/:id', asyncHandler(getPurchaseOrder));
router.delete('/:id', asyncHandler(deletePurchaseOrder));
router.get('/:id/action', publicActionHandler);
router.put('/:id/action', asyncHandler(decideFromPortal));
router.post('/:id/resend', asyncHandler(resendApprovalRequest, { errorBody: resendErrorBody }));

export default router;
