import { ApiResponse } from '../../../../core/http/index.js';
import { loadDealViewer } from '../shared/dealTables.js';
import * as enquiriesService from './enquiries.service.js';

export async function listEnquiries(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await enquiriesService.listEnquiries(salesViewer, req.query));
}

export async function getEnquiry(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await enquiriesService.getEnquiry(salesViewer, req.params.eid));
}

export async function createEnquiry(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await enquiriesService.createEnquiry(salesViewer, req.body));
}

export async function updateEnquiry(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await enquiriesService.updateEnquiry(salesViewer, req.params.eid, req.body));
}

export async function setEnquiryStatus(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await enquiriesService.setEnquiryStatus(salesViewer, req.params.eid, req.body));
}

export async function deleteEnquiry(req, res) {
  const salesViewer = await loadDealViewer(req);
  ApiResponse.send(res, await enquiriesService.deleteEnquiry(salesViewer, req.params.eid));
}
