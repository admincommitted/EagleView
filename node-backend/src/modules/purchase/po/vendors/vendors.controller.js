import { ApiResponse } from '../../../../core/http/index.js';
import * as vendorsService from './vendors.service.js';

export async function listVendors(req, res) {
  ApiResponse.send(res, await vendorsService.listVendors());
}

export async function createVendor(req, res) {
  ApiResponse.send(res, await vendorsService.createVendor(req.body));
}

export async function updateVendor(req, res) {
  ApiResponse.send(res, await vendorsService.updateVendor(req.params.id, req.body));
}

export async function deleteVendor(req, res) {
  ApiResponse.send(res, await vendorsService.deleteVendor(req.params.id));
}
