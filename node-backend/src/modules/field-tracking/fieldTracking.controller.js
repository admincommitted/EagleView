import { ApiResponse } from '../../core/http/index.js';
import { caller as fieldCaller } from '../../sockets/fieldAuth.js';
import * as fieldTrackingService from './fieldTracking.service.js';

const isAdmin = (req) => String((req.user && req.user.role) || '').toLowerCase() === 'admin';

/** The new field app: office code + mobile number (+ name for a new person) -> the phone's own device token. */
export { register as registerDevice } from '../../sockets/fieldAuth.js';

export function requirePhoneAccessAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  return res.status(403).json({ success: false, error: 'Only an admin can change phone access.' });
}

export async function listAgents(req, res) {
  res.json(await fieldTrackingService.listAgents(await fieldCaller(req)));
}

export function readPublicUrl(req, res) {
  res.json(fieldTrackingService.readPublicUrl());
}

export async function getAgent(req, res) {
  res.json(await fieldTrackingService.getAgent(req.params.id));
}

export async function addAgent(req, res) {
  const { isNew, answer } = await fieldTrackingService.addAgent(await fieldCaller(req), req.body, req.app);
  ApiResponse.send(res, answer, isNew ? 201 : 200);
}

export async function recordLocation(req, res) {
  res.json(await fieldTrackingService.recordLocation(req.field, req.body, req.app));
}

export async function recordLocations(req, res) {
  res.json(await fieldTrackingService.recordLocations(req.body.pings, req.app));
}

export async function phoneAccessSettings(req, res) {
  res.json(await fieldTrackingService.phoneAccessSettings(isAdmin(req)));
}

export async function savePhoneAccess(req, res) {
  res.json(await fieldTrackingService.savePhoneAccess(req.validated.body));
}

export async function disconnectPhone(req, res) {
  res.json(await fieldTrackingService.disconnectPhone(req.params.id));
}

/** Lets the field app (PWA) see that the server is reachable. */
export function health(req, res) {
  res.json({ ok: true, ts: Date.now() });
}

export async function locationHistory(req, res) {
  res.json(await fieldTrackingService.locationHistory(req.params.agentId, req.query.hours));
}

export async function assignTask(req, res) {
  res.json(await fieldTrackingService.assignTask(req.body, req.app));
}

export async function setAgentStatus(req, res) {
  res.json(await fieldTrackingService.setAgentStatus(req.params.id, req.body.status, req.app));
}

export async function completeTask(req, res) {
  res.json(await fieldTrackingService.completeTask(req.params.id, req.app));
}

export async function deactivateAgent(req, res) {
  res.json(await fieldTrackingService.deactivateAgent(req.params.id, req.app));
}

export async function triggerSiren(req, res) {
  res.json(await fieldTrackingService.triggerSiren(req.body, req.app));
}

export async function agentStats(req, res) {
  res.json(await fieldTrackingService.agentStats());
}

export async function dailySummary(req, res) {
  res.json(await fieldTrackingService.dailySummary(req.query.date));
}

export async function agentDayReport(req, res) {
  res.json(await fieldTrackingService.agentDayReport(req.params.agentId, req.query.date));
}
