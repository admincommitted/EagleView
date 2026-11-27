import { ApiError, ApiResponse } from '../../../core/http/index.js';
import * as poService from './po.service.js';

const HTTP_SERVER_ERROR = 500;

/** What the approval links / e-mails need to know about the request that triggered them. */
const requestInfoOf = (req) => ({
  hostname: req.hostname,
  origin: req.headers.origin,
  localPort: req.socket && req.socket.localPort,
});

export async function listPurchaseOrders(req, res) {
  ApiResponse.send(res, await poService.listPurchaseOrders());
}

export async function createPurchaseOrder(req, res) {
  ApiResponse.send(res, await poService.createPurchaseOrder(req.body, req.file, requestInfoOf(req)));
}

export async function monthWiseExpenses(req, res) {
  ApiResponse.send(res, await poService.monthWiseExpenses(req.query.year));
}

export async function categoryWiseExpenses(req, res) {
  ApiResponse.send(res, await poService.categoryWiseExpenses(req.query.year));
}

export async function receiveItem(req, res) {
  ApiResponse.send(res, await poService.receiveItem(req.params.id));
}

export async function searchItemHistory(req, res) {
  ApiResponse.send(res, await poService.searchItemHistory(req.query.q));
}

export async function getPurchaseOrder(req, res) {
  ApiResponse.send(res, await poService.getPurchaseOrder(req.params.id));
}

export async function deletePurchaseOrder(req, res) {
  ApiResponse.send(res, await poService.deletePurchaseOrder(req.params.id));
}

/**
 * GET /api/po/:id/action - the signed Approve / Reject / Hold link from the e-mail / WhatsApp. app.js mounts it
 * before the login check (the director opens it without logging in); it answers plain text / HTML.
 */
export async function publicActionHandler(req, res) {
  try {
    res.send(await poService.applyLinkAction(req.params.id, req.query));
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.statusCode).send(error.message);
    console.error(error);
    return res.status(HTTP_SERVER_ERROR).send('Server Error');
  }
}

export async function decideFromPortal(req, res) {
  const approver = {
    role: String((req.user && req.user.role) || '').toLowerCase(),
    actorName: (req.user && (req.user.username || req.user.email)) || 'USER',
  };
  ApiResponse.send(res, await poService.decideFromPortal(req.params.id, req.body, approver));
}

export async function resendApprovalRequest(req, res) {
  ApiResponse.send(res, await poService.resendApprovalRequest(req.params.id, requestInfoOf(req)));
}
