import { ForbiddenError } from '../../../../core/http/index.js';
import { fyWhere, where as branchWhereOf } from '../../../../utils/awb/awbBranch.js';
import { userNameOf } from '../shared/awbNumbers.js';
import * as trackingService from './tracking.service.js';

const isAdmin = (req) => String(req.user?.role || '').toLowerCase() === 'admin';

export async function listTrackedShipments(req, res) {
  const scope = { branchWhere: await branchWhereOf(req), yearWhere: await fyWhere(req) };
  res.json(await trackingService.listTrackedShipments(req.query, scope));
}

export async function listTrackingEvents(req, res) {
  res.json(await trackingService.trackingEventsOf(req.query));
}

export async function addManualEvent(req, res) {
  res.json(await trackingService.addManualEvent(req.body || {}, userNameOf(req.user)));
}

export async function removeManualEvent(req, res) {
  res.json(await trackingService.removeManualEvent(req.params.id, userNameOf(req.user)));
}

export async function readNotifySettings(req, res) {
  res.json(await trackingService.readNotifySettings(isAdmin(req)));
}

export async function updateNotifySettings(req, res) {
  if (!isAdmin(req)) {
    const message = 'Only an admin can change customer updates';
    throw new ForbiddenError(message, { body: { error: message } });
  }
  res.json(await trackingService.updateNotifySettings(req.body || {}, userNameOf(req.user)));
}

export async function createTrackingRow(req, res) {
  res.json(await trackingService.createTrackingRow(req.body));
}

export async function updateTrackingMilestones(req, res) {
  res.json(await trackingService.updateTrackingMilestones(req.params.id, req.body));
}
