import { Router } from 'express';
import dealMetaRoutes from './deal-meta/dealMeta.routes.js';
import enquiriesRoutes from './enquiries/enquiries.routes.js';
import quotationsRoutes from './quotations/quotations.routes.js';

/**
 * Enquiries (RFQ) and quotations. app.js mounts this router on /api/sales-hub right after the sales hub router, so the
 * same login rights and "who sees what" apply.
 *   Enquiry: customer / prospect, contact, sales person, service, origin > destination, cargo (pkgs, weights, CBM,
 *            containers, DG, temperature, value), dates (ready, quote by), status Open > Quoted > Won / Lost / Dropped.
 *   Quotation: from an enquiry; charges from Accounts > GST Charges with basis, buy and sell rate, minimum, currency and
 *            rate of exchange (Currency master), margin; validity, transit, carrier, terms; Draft > Sent > Won / Lost,
 *            Revise (R1, R2 ...), print, PDF, mail; Won links the docket (Shipments.quotationNo) so the Provisional Sheet
 *            bills at the quoted rates.
 */
const router = Router();

router.use(dealMetaRoutes);
router.use(enquiriesRoutes);
router.use(quotationsRoutes);

export default router;
