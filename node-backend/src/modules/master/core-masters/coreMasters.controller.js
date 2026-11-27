import { partyCacheReady } from '../party/party.service.js';
import * as coreMastersService from './coreMasters.service.js';

const GZIP_ACCEPTED = /\bgzip\b/;

const categoryOf = (req) => req.params.category.toLowerCase();

/** The cached full party list, gzip-compressed when the browser accepts it; ?compact=1 is the slim copy. */
function sendFullPartyList(req, res, partyList) {
  const compact = req.query.compact === '1';
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Cache-Control', 'no-store');
  if (GZIP_ACCEPTED.test(String(req.headers['accept-encoding'] || ''))) {
    res.set('Content-Encoding', 'gzip');
    res.set('Vary', 'Accept-Encoding');
    return res.send(compact ? partyList.cgz : partyList.gz);
  }
  return res.send(compact ? partyList.cjson : partyList.json);
}

export async function listCategory(req, res) {
  const category = categoryOf(req);
  if (category === 'specialhandlingcodes') return res.json(coreMastersService.SPH_CODES);
  const Model = await coreMastersService.modelOfCategory(category);
  if (coreMastersService.wantsFullPartyList(category, req.query))
    return sendFullPartyList(req, res, await partyCacheReady());
  return res.json(await coreMastersService.findCategoryRows(category, Model, req.query));
}

export async function seedMasters(req, res) {
  res.json(await coreMastersService.seedMasters());
}

export async function createCategoryItem(req, res) {
  res.status(201).json(await coreMastersService.createCategoryItem(categoryOf(req), req.body));
}

export async function updateCategoryItem(req, res) {
  res.json(await coreMastersService.updateCategoryItem(categoryOf(req), req.params.id, req.body));
}

export async function deleteCategoryItem(req, res) {
  await coreMastersService.deleteCategoryItem(categoryOf(req), req.params.id);
  res.json({ message: 'Deleted successfully' });
}
