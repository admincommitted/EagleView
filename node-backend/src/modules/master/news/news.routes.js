import { Router } from 'express';
import { failedErrorAnswer, routeHandler } from '../shared/errorAnswers.js';
import { liveNews } from './news.controller.js';

const router = Router();

router.get('/live-news', routeHandler(liveNews, failedErrorAnswer));

export default router;
