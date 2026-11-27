import { ApiResponse } from '../../../core/http/index.js';
import * as managementService from './management.service.js';

export function listModules(req, res) {
  res.json(managementService.listModules());
}

export async function myPermissions(req, res) {
  res.json(await managementService.myPermissions(req.user));
}

export async function listUsers(req, res) {
  res.json(await managementService.listUsers());
}

export async function createUser(req, res) {
  ApiResponse.send(res, await managementService.createUser(req.validated.body), 201);
}

export async function updateUser(req, res) {
  res.json(await managementService.updateUser(req.params.id, req.validated.body, req.user.id));
}
