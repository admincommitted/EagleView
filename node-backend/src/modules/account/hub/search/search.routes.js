import { Router } from 'express';
import { handleHubRoute } from '../shared/hubHttp.js';
import { search } from './search.controller.js';

const router = Router();

router.get('/search', handleHubRoute(search));

export default router;
