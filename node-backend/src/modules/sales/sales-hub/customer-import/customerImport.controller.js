import { ApiResponse } from '../../../../core/http/index.js';
import { viewer as loadSalesViewer } from '../../../../utils/common/salesHub.js';
import * as customerImportService from './customerImport.service.js';

export async function loadCustomersFromBooks(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await customerImportService.loadCustomersFromBooks(salesViewer, req.body));
}
