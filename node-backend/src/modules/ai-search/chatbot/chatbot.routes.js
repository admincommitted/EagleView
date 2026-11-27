import { Router } from 'express';
import { asyncHandler } from '../../../core/http/index.js';
import { deleteHistory, failureBody, getHistory, postMessage } from './chatbot.controller.js';

// EagleView AI chat (the robot at the bottom right): answers from the database and keeps each user's chat
const router = Router();

router.get('/history', asyncHandler(getHistory, { errorBody: failureBody }));
router.post('/message', asyncHandler(postMessage, { errorBody: failureBody }));
router.delete('/history', asyncHandler(deleteHistory, { errorBody: failureBody }));

export default router;
