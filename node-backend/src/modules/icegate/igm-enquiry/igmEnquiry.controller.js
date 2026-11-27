import { ApiResponse } from '../../../core/http/index.js';
import { readAirIgm, readSeaIgm } from './igmEnquiry.service.js';

export const fetchAirIgm = async (req, res) => {
  ApiResponse.send(res, await readAirIgm(req.validated.body));
};

export const fetchSeaIgm = async (req, res) => {
  ApiResponse.send(res, await readSeaIgm(req.validated.body));
};
