import { ApiResponse } from '../../../core/http/index.js';
import * as contractsService from './contracts.service.js';

const HTTP_CREATED = 201;

const isAdmin = (req) => String((req.user && req.user.role) || '').toLowerCase() === 'admin';
const actorName = (req) => (req.user && (req.user.username || req.user.email)) || 'user';

export async function listGstCharges(req, res) {
  ApiResponse.send(res, { success: true, data: await contractsService.listGstCharges() });
}

export async function listContracts(req, res) {
  ApiResponse.send(res, await contractsService.listContracts(req.query));
}

export async function getContract(req, res) {
  ApiResponse.send(res, await contractsService.getContract(req.params.id));
}

export async function createContract(req, res) {
  ApiResponse.send(res, await contractsService.createContract(req.body, actorName(req)), HTTP_CREATED);
}

export async function updateContract(req, res) {
  ApiResponse.send(res, await contractsService.updateContract(req.params.id, req.body, { isAdmin: isAdmin(req) }));
}

export async function setContractStatus(req, res) {
  const access = { isAdmin: isAdmin(req), actorName: actorName(req) };
  ApiResponse.send(res, await contractsService.setContractStatus(req.params.id, req.body, access));
}

export async function deleteContract(req, res) {
  ApiResponse.send(res, await contractsService.deleteContract(req.params.id, { isAdmin: isAdmin(req) }));
}
