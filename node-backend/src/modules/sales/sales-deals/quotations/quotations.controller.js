import { ApiResponse } from '../../../../core/http/index.js';
import { loadDealViewer } from '../shared/dealTables.js';
import * as quotationsService from './quotations.service.js';

export async function listQuotations(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.listQuotations(salesViewer, req.query));
}

export async function getQuotation(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.getQuotation(salesViewer, req.params.qid));
}

export async function createQuotation(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.createQuotation(salesViewer, req.body));
}

export async function updateQuotation(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.updateQuotation(salesViewer, req.params.qid, req.body));
}

export async function reviseQuotation(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.reviseQuotation(salesViewer, req.params.qid));
}

export async function deleteQuotation(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.deleteQuotation(salesViewer, req.params.qid));
}

export async function markQuotationSent(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.markQuotationSent(salesViewer, req.params.qid, req.body));
}

export async function downloadQuotationPdf(req, res) {
  const salesViewer = await loadDealViewer(req);
  const { pdf, fileName } = await quotationsService.quotationPdf(salesViewer, req.params.qid, req.body);
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(pdf);
}

export async function mailQuotation(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.mailQuotation(salesViewer, req.params.qid, req.body));
}

export async function markQuotationWon(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.markQuotationWon(salesViewer, req.params.qid, req.body));
}

export async function markQuotationLost(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.markQuotationLost(salesViewer, req.params.qid, req.body));
}

export async function reopenQuotation(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.reopenQuotation(salesViewer, req.params.qid));
}

export async function quotationsToCopy(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await quotationsService.quotationsToCopy(salesViewer, req.query));
}
