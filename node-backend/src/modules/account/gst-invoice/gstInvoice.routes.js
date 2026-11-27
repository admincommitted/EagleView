import { Router } from 'express';
import bulkRoutes from './bulk/bulk.routes.js';
import eInvoiceRoutes from './e-invoice/eInvoice.routes.js';
import irpApiRoutes from './irp-api/irpApi.routes.js';
import lookupRoutes from './lookup/lookup.routes.js';
import printRoutes from './print/print.routes.js';
import provisionalSheetRoutes from './provisional-sheet/provisionalSheet.routes.js';
import salesInvoiceRoutes from './sales-invoice/salesInvoice.routes.js';
import sendingRoutes from './sending/sending.routes.js';

// GST Invoice (iCAFFE Operation > GST Invoice), mounted at /api/accounts-hub/gst-invoice.
// The topic routers keep the order the routes have always been matched in; every `/:id` only takes a number.
const router = Router();

router.use(lookupRoutes);
router.use(salesInvoiceRoutes);
router.use(bulkRoutes);
router.use(provisionalSheetRoutes);
router.use(sendingRoutes);
router.use(eInvoiceRoutes);
router.use(printRoutes);
router.use(irpApiRoutes);

export default router;
