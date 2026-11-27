import * as freightOpsService from './freightOps.service.js';

export async function dashboard(req, res) {
  res.json(await freightOpsService.buildDashboard(req.query));
}

export async function recordEvent(req, res) {
  res.json(await freightOpsService.recordEvent(req.body || {}, req.user));
}

export async function listEvents(req, res) {
  res.json(await freightOpsService.listEvents(req.query));
}

export async function deleteEvent(req, res) {
  res.json(await freightOpsService.deleteEvent(req.params.id));
}
