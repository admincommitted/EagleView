import { ApiResponse } from '../../../core/http/index.js';
import { fetchIecDetails, refreshCaptcha, startIecSession } from './dgftIec.service.js';

export const startSession = async (req, res) => {
  ApiResponse.send(res, await startIecSession());
};

export const refreshSessionCaptcha = async (req, res) => {
  ApiResponse.send(res, await refreshCaptcha(req.body));
};

export const fetchIec = async (req, res) => {
  ApiResponse.send(res, await fetchIecDetails(req.body));
};
