import { Router } from 'express';
import { memoryUpload } from '../../../../middlewares/upload.middleware.js';
import { handleHubRoute } from '../shared/hubHttp.js';
import { readBill } from './ocrBill.controller.js';

const MAX_BILL_SIZE_MB = 10;

const router = Router();
const billUpload = memoryUpload({ maxFileSizeMb: MAX_BILL_SIZE_MB });

router.post('/ocr-bill', billUpload.single('file'), handleHubRoute(readBill));

export default router;
