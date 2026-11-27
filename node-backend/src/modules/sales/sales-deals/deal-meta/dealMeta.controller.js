import { ApiResponse } from '../../../../core/http/index.js';
import { loadDealViewer } from '../shared/dealTables.js';
import * as dealMetaService from './dealMeta.service.js';

export async function getDealMeta(req, res) {
  ApiResponse.send(res, await dealMetaService.getDealMeta());
}

export async function getDealsSummary(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await dealMetaService.getDealsSummary(salesViewer, req.query));
}
