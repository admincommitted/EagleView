import { ApiResponse } from '../../../core/http/index.js';
import * as ulipService from './ulip.service.js';

export const fetchDgftIec = async (req, res) => {
  ApiResponse.send(res, await ulipService.fetchDgftIec(req.body));
};

export const testLogin = async (req, res) => {
  ApiResponse.send(res, await ulipService.testUlipLogin(req.body));
};

export const listApis = async (req, res) => {
  ApiResponse.send(res, await ulipService.listApis());
};

export const createApi = async (req, res) => {
  ApiResponse.send(res, await ulipService.createApi(req.body));
};

export const updateApi = async (req, res) => {
  ApiResponse.send(res, await ulipService.updateApi(req.params.id, req.body));
};

export const deleteApi = async (req, res) => {
  ApiResponse.send(res, await ulipService.deleteApi(req.params.id));
};

export const testApi = async (req, res) => {
  ApiResponse.send(res, await ulipService.testApi(req.params.id, req.body && req.body.params));
};

export const callApi = async (req, res) => {
  const params = (req.body && req.body.params) || req.body || {};
  const { status, body } = await ulipService.callApiByCode(req.params.apiCode, params);
  ApiResponse.send(res, body, status);
};
