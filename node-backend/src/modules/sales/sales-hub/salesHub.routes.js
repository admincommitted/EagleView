import { Router } from 'express';
import customerImportRoutes from './customer-import/customerImport.routes.js';
import customersRoutes from './customers/customers.routes.js';
import listsRoutes from './lists/lists.routes.js';
import personsRoutes from './persons/persons.routes.js';

/**
 * /api/sales-hub: sales persons (master + iCAFFE "marketing person" names), the customer's sales profile (prospect /
 * customer, KAM and secondary sales persons with history, industry, segment, source, services, potential, competitors,
 * credit asked), contacts, lanes, editable lists, and the customer's figures from the books / dockets.
 * Enquiries and quotations (modules/sales/sales-deals) are mounted on the same prefix right after this router.
 */
const router = Router();

router.use(listsRoutes);
router.use(personsRoutes);
router.use(customersRoutes);
router.use(customerImportRoutes);

export default router;
