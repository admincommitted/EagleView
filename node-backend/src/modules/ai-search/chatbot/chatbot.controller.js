import { ApiResponse } from '../../../core/http/index.js';
import { chatHistory, clearChatHistory, sendChatMessage } from './chatbot.service.js';

/** Answer of an unexpected failure, as the old routes' catch blocks: { success: false, error }. */
export const failureBody = (error) => ({ success: false, error: error.message });

export const getHistory = async (req, res) => {
  ApiResponse.send(res, await chatHistory(req.user, req.query));
};

export const postMessage = async (req, res) => {
  ApiResponse.send(res, await sendChatMessage(req.user, req.body));
};

export const deleteHistory = async (req, res) => {
  ApiResponse.send(res, await clearChatHistory(req.user));
};
