import { userNameOf } from '../shared/routeHandler.js';
import {
  addFollowUp,
  ageingReport,
  matchCustomerLedger,
  partyCreditDetails,
  savePolicy,
  updateFollowUp,
} from './creditControl.service.js';

export async function getAgeing(req, res) {
  res.json(await ageingReport(req.query));
}

export async function getPartyCredit(req, res) {
  res.json(await partyCreditDetails(req.params.ledgerId, req.query));
}

export async function createFollowUp(req, res) {
  const user = { id: (req.user && req.user.id) || null, name: userNameOf(req) };
  res.json(await addFollowUp(req.body, user));
}

export async function changeFollowUp(req, res) {
  res.json(await updateFollowUp(req.params.id, req.body));
}

export async function changePolicy(req, res) {
  res.json(await savePolicy(req.params.ledgerId, req.body, userNameOf(req)));
}

export async function matchLedger(req, res) {
  res.json(await matchCustomerLedger(req.body));
}
