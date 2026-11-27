import * as currencyService from './currency.service.js';

const userNameOf = (user) => (user && (user.username || user.name)) || 'Admin';

/** Only an explicit false / 0 / '0' switches the auto-sync off. */
const enabledFlagOf = (body) => !(body && (body.enabled === false || body.enabled === 0 || body.enabled === '0'));

export async function syncLiveRates(req, res) {
  res.json(await currencyService.syncLiveRates());
}

export async function cbicStatus(req, res) {
  res.json(await currencyService.cbicStatus());
}

export async function ratesInForce(req, res) {
  res.json(await currencyService.ratesInForce(req.query.date));
}

export async function rateHistory(req, res) {
  res.json(await currencyService.rateHistory(req.query.code));
}

export async function syncCbicRates(req, res) {
  const force = !!(req.body && req.body.force);
  res.json(await currencyService.syncCbicRates({ force, user: userNameOf(req.user) }));
}

export async function setCbicAutoSync(req, res) {
  res.json(await currencyService.setCbicAutoSync(enabledFlagOf(req.body)));
}
