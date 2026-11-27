import { ApiResponse } from '../../../../core/http/index.js';
import { viewer as loadSalesViewer } from '../../../../utils/common/salesHub.js';
import * as listsService from './lists.service.js';

export async function getSalesMeta(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await listsService.getSalesMeta(salesViewer));
}

export async function addLookupValue(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await listsService.addLookupValue(salesViewer, req.body));
}

export async function updateLookupValue(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await listsService.updateLookupValue(salesViewer, req.params.id, req.body));
}
