import { Router } from 'express';
import { requireAdmin } from '../../../middlewares/auth.middleware.js';
import { failedErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import { createProfile, deleteProfile, listProfiles, updateProfile } from './icegateProfile.controller.js';

/** /api/icegate-profiles - writing profiles (keys, connections) is for an admin only. */
const router = Router();

router.get('/', routeHandler(listProfiles, failedErrorAnswer));
router.post('/', requireAdmin, routeHandler(createProfile, failedErrorAnswer));
router.put('/:id', requireAdmin, routeHandler(updateProfile, failedErrorAnswer));
router.delete('/:id', requireAdmin, routeHandler(deleteProfile, failedErrorAnswer));

export default router;
