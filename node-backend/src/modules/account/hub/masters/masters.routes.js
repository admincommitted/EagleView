import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { createRow, deleteRow, getMasterMeta, listMasters, listRows, updateRow } from './masters.controller.js';

const router = Router();

router.get('/masters', handleHubRoute(listMasters));
router.get('/masters/:kind/meta', handleHubRoute(getMasterMeta));
router.get('/masters/:kind', handleHubRoute(listRows));
router.post('/masters/:kind', handleHubRoute(createRow, { useErrorStatus: true }));
router.put('/masters/:kind/:id', handleHubRoute(updateRow, { useErrorStatus: true }));
router.delete('/masters/:kind/:id', handleHubRoute(deleteRow));

export default router;
