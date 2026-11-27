import { ApiResponse } from '../../../core/http/index.js';
import * as assetsService from './assets.service.js';

const HTTP_CREATED = 201;

const uploadedFileUrl = (file) => (file ? '/uploads/assets/' + file.filename : undefined);

export async function listAssets(req, res) {
  ApiResponse.send(res, await assetsService.listAssets());
}

export async function listExpiringWarranties(req, res) {
  ApiResponse.send(res, await assetsService.listExpiringWarranties(req.query.days));
}

export async function createAsset(req, res) {
  ApiResponse.send(res, await assetsService.createAsset(req.body), HTTP_CREATED);
}

export async function updateAsset(req, res) {
  ApiResponse.send(res, await assetsService.updateAsset(req.params.id, req.body));
}

export async function discardAsset(req, res) {
  ApiResponse.send(res, await assetsService.discardAsset(req.params.id, req.body, uploadedFileUrl(req.file)));
}

export async function attachBill(req, res) {
  ApiResponse.send(res, await assetsService.attachAssetFile(req.params.id, 'billUrl', uploadedFileUrl(req.file)));
}

export async function attachPhoto(req, res) {
  ApiResponse.send(res, await assetsService.attachAssetFile(req.params.id, 'photoUrl', uploadedFileUrl(req.file)));
}
