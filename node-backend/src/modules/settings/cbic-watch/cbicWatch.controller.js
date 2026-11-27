import * as cbicWatchService from './cbicWatch.service.js';

const userNameOf = (req) => (req.user && (req.user.username || req.user.email)) || 'user';

export async function watchStatus(req, res) {
  res.json(await cbicWatchService.watchStatus());
}

export async function latestEntries(req, res) {
  res.json(await cbicWatchService.latestEntries());
}

export async function saveWatchSettings(req, res) {
  res.json(await cbicWatchService.saveWatchSettings(req.validated.body));
}

export async function checkNow(req, res) {
  res.json(await cbicWatchService.checkNow(userNameOf(req)));
}

export async function sendTestMail(req, res) {
  res.json(await cbicWatchService.sendTestMail((req.body || {}).source));
}
