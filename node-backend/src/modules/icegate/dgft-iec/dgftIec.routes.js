import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { fetchIec, refreshSessionCaptcha, startSession } from './dgftIec.controller.js';

// Party Master > "Fetch from DGFT" (View Any IEC)
const router = Router();

router.post('/iec/start', asyncHandler(startSession));
router.post('/iec/captcha-refresh', asyncHandler(refreshSessionCaptcha));
router.post('/iec/fetch', asyncHandler(fetchIec));

export default router;
