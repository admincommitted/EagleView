import { Router } from 'express';
import { validate } from '../../../../middlewares/validate.middleware.js';
import { OLD_ERROR_SHAPE, handleHubRoute } from '../shared/hubHttp.js';
import { createGroupBody } from './groups.validation.js';
import { addGroup, changeGroup, getGroupTree, removeGroup } from './groups.controller.js';

const router = Router();

router.get('/groups-tree', handleHubRoute(getGroupTree));
router.post('/groups', validate({ body: createGroupBody }, OLD_ERROR_SHAPE), handleHubRoute(addGroup));
router.put('/groups/:id', handleHubRoute(changeGroup));
router.delete('/groups/:id', handleHubRoute(removeGroup));

export default router;
