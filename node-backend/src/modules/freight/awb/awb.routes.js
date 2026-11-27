import { Router } from 'express';
import awbRecordRoutes from './awb-record/awbRecord.routes.js';
import dashboardRoutes from './dashboard/dashboard.routes.js';
import eDocsRoutes from './e-docs/eDocs.routes.js';
import ediMessagesRoutes from './edi-messages/ediMessages.routes.js';
import extraDocsRoutes from './extra-docs/extraDocs.routes.js';
import houseAwbRoutes from './house-awb/houseAwb.routes.js';
import printDocumentsRoutes from './print-documents/printDocuments.routes.js';
import templatesRoutes from './templates/templates.routes.js';
import trackingRoutes from './tracking/tracking.routes.js';

/**
 * /api/awb. The EDI router comes before every router with two-part paths, so its `/:id/xfwb`, `/:id/send-xfwb` ...
 * routes are matched first (e.g. GET /search/xfwb is the XFWB download of id "search"). The tracking routes come
 * before it; no other two routes of different routers can match the same request.
 */
const router = Router();

router.use(trackingRoutes);
router.use(ediMessagesRoutes);
router.use(awbRecordRoutes);
router.use(houseAwbRoutes);
router.use(printDocumentsRoutes);
router.use(dashboardRoutes);
router.use(templatesRoutes);
router.use(extraDocsRoutes);
router.use(eDocsRoutes);

export default router;
