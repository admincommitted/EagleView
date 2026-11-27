import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { validate } from '../../../middlewares/validate.middleware.js';
import { requireAdmin } from '../../../middlewares/auth.middleware.js';
import * as managementController from './management.controller.js';
import { createUserSchema, updateUserSchema } from './management.validation.js';

const router = Router();
const errorOnly = { errorBody: (message) => ({ error: message }) };
const internalError = { errorBody: () => ({ error: 'Internal server error' }) };

router.get('/modules', managementController.listModules);
router.get(
  '/my-permissions',
  asyncHandler(managementController.myPermissions, {
    errorBody: (error) => ({ success: false, error: error.message }),
  }),
);

router.get('/', requireAdmin, asyncHandler(managementController.listUsers, internalError));
router.post(
  '/',
  requireAdmin,
  validate({ body: createUserSchema }, errorOnly),
  asyncHandler(managementController.createUser, internalError),
);
router.put(
  '/:id',
  requireAdmin,
  validate({ body: updateUserSchema }, errorOnly),
  asyncHandler(managementController.updateUser, internalError),
);

export default router;
