import { Router } from 'express';
import { asyncHandler } from '../../../../core/http/index.js';
import { readExtraDocument, saveExtraDocument } from './extraDocs.controller.js';

const router = Router();

router.get('/extra/:type/:id/:docType', asyncHandler(readExtraDocument));
router.put('/extra/:type/:id/:docType', asyncHandler(saveExtraDocument));

export default router;
