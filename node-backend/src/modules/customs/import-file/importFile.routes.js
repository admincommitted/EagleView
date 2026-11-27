import express, { Router } from 'express';
import { memoryUpload } from '../../../middlewares/upload.middleware.js';
import { handleRoute } from '../shared/handleRoute.js';
import { detect, extractItems, parseBe, parseSb } from './importFile.controller.js';

const MAX_FILE_SIZE_MB = 5;

const router = Router();
// memory storage: only the text of the file is needed
const upload = memoryUpload({ maxFileSizeMb: MAX_FILE_SIZE_MB });

const logBeError = (error) => console.error('[IMPORT-FILE] BE error:', error.message);
const logSbError = (error) => console.error('[IMPORT-FILE] SB error:', error.message);

router.post('/be', upload.single('file'), handleRoute(parseBe, { status: 400, onError: logBeError }));
router.post('/sb', upload.single('file'), handleRoute(parseSb, { status: 400, onError: logSbError }));
router.post('/detect', express.json(), handleRoute(detect, { status: 400 }));
router.post('/extract-pdf-items', upload.single('file'), handleRoute(extractItems));

export default router;
