import * as preferencesService from './preferences.service.js';

const userIdOf = (req) => Number(req.user && req.user.id);

export async function getPreference(req, res) {
  res.json(await preferencesService.getPreference(userIdOf(req), req.params.key));
}

export async function savePreference(req, res) {
  res.json(await preferencesService.savePreference(userIdOf(req), req.params.key, req.body));
}
