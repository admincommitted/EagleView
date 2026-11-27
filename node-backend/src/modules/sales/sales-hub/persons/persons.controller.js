import { ApiResponse } from '../../../../core/http/index.js';
import { viewer as loadSalesViewer } from '../../../../utils/common/salesHub.js';
import * as personsService from './persons.service.js';

export async function listSalesPersons(req, res) {
  ApiResponse.send(res, await personsService.listSalesPersons());
}

export async function listLoginUsers(req, res) {
  ApiResponse.send(res, await personsService.listLoginUsers());
}

export async function createSalesPerson(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await personsService.createSalesPerson(salesViewer, req.body));
}

export async function updateSalesPerson(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await personsService.updateSalesPerson(salesViewer, req.params.id, req.body));
}

export async function moveCustomersToPerson(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await personsService.moveCustomersToPerson(salesViewer, req.params.id, req.body));
}

export async function addPersonsFromNames(req, res) {
  const salesViewer = await loadSalesViewer(req);
  ApiResponse.send(res, await personsService.addPersonsFromNames(salesViewer, req.body));
}

export async function listUnmatchedNames(req, res) {
  ApiResponse.send(res, await personsService.listUnmatchedNames());
}
