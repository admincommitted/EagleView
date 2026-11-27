import { ApiResponse } from '../../../../core/http/index.js';
import { viewer as loadSalesViewer } from '../../../../utils/common/salesHub.js';
import { build as buildSalesDashboard } from '../../../../utils/common/salesDashboard.js';
import * as customersService from './customers.service.js';

export async function listCustomers(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await customersService.listCustomers(salesViewer, req.query));
}

export async function getCustomer(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await customersService.getCustomer(salesViewer, req.params.id));
}

export async function createCustomer(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await customersService.createCustomer(salesViewer, req.body));
}

export async function updateCustomer(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await customersService.updateCustomer(salesViewer, req.params.id, req.body));
}

export async function deleteCustomer(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await customersService.deleteCustomer(salesViewer, req.params.id));
}

export async function listDebtorLedgers(req, res) {
  ApiResponse.send(res, await customersService.listDebtorLedgers(req.query));
}

/** The dashboard of the logged-in sales person (a manager: his team; admin: all, or any person picked). */
export async function getSalesDashboard(req, res) {
  await customersService.ensureSalesTables();
  ApiResponse.send(res, await buildSalesDashboard(req));
}

export async function kamOfLedger(req, res) {
  ApiResponse.send(res, await customersService.kamOfLedger(req.params.id));
}
