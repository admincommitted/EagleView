import { Router } from 'express';
import { handleRoute } from '../shared/routeHandler.js';
import {
  addGroup,
  addLedger,
  changeGroup,
  changeLedger,
  getAccountTree,
  removeGroup,
  removeLedger,
  seedDefaultGroups,
} from './accountList.controller.js';

const router = Router();
const BAD_REQUEST = { status: 400 };

router.post('/seed', handleRoute(seedDefaultGroups));
router.get('/tree', handleRoute(getAccountTree));
router.post('/groups', handleRoute(addGroup, BAD_REQUEST));
router.post('/ledgers', handleRoute(addLedger, BAD_REQUEST));
router.put('/groups/:id', handleRoute(changeGroup, BAD_REQUEST));
router.delete('/groups/:id', handleRoute(removeGroup, BAD_REQUEST));
router.put('/ledgers/:id', handleRoute(changeLedger, BAD_REQUEST));
router.delete('/ledgers/:id', handleRoute(removeLedger, BAD_REQUEST));

export default router;
