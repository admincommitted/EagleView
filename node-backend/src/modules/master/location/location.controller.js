import * as locationService from './location.service.js';

const ONE_DAY_CACHE = 'private, max-age=86400';

/** The browser keeps the foreign port list for a day; before the table is loaded the answer is an empty list. */
export async function foreignPorts(req, res) {
  let portsJson;
  try {
    portsJson = await locationService.foreignPortsList();
  } catch {
    return res.json([]);
  }
  return res.set('Cache-Control', ONE_DAY_CACHE).type('application/json').send(portsJson);
}

export async function countriesWithStates(req, res) {
  res.json(await locationService.countriesWithStates());
}

export async function locationStats(req, res) {
  res.json(await locationService.locationStats());
}

export async function nestedLocations(req, res) {
  res.json(await locationService.nestedLocations());
}

export async function listStates(req, res) {
  res.json(await locationService.listStates());
}

export async function listAirports(req, res) {
  res.json(await locationService.listAirports());
}

export async function listCities(req, res) {
  res.json(await locationService.listCities(req.query));
}

export async function createState(req, res) {
  res.status(201).json(await locationService.createState(req.body));
}

export async function updateState(req, res) {
  res.json(await locationService.updateState(req.params.id, req.body));
}

export async function deleteState(req, res) {
  const citiesDeleted = await locationService.deleteState(req.params.id);
  res.json({ success: true, citiesDeleted });
}

export async function createCity(req, res) {
  res.status(201).json(await locationService.createCity(req.body));
}

export async function updateCity(req, res) {
  res.json(await locationService.updateCity(req.params.id, req.body));
}

export async function deleteCity(req, res) {
  await locationService.deleteCity(req.params.id);
  res.json({ success: true });
}
