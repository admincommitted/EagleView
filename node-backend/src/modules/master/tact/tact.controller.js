import * as tactService from './tact.service.js';

/** GET of one flat TACT / IATA table (the whole table). */
const listTable = (tableName) => async (req, res) => {
  res.json(await tactService.listTable(tableName));
};

export const listCountryRules = listTable('country-rules');
export const listCarrierRules = listTable('carrier-rules');
export const listEquipmentRules = listTable('equipment');
export const listDgr = listTable('dgr');
export const listSurcharges = listTable('surcharges');
export const listExchangeRates = listTable('exchange-rates');
export const listShcConflicts = listTable('shc-conflicts');
export const listProportionalRates = listTable('proportional-rates');

export async function listRateSectors(req, res) {
  res.json(await tactService.listRateSectors());
}

export async function uploadCsv(req, res) {
  res.json(await tactService.uploadCsv(req.file, req.params.type, req.query.mode));
}

export async function quoteRate(req, res) {
  res.json(await tactService.quoteRate(req.query));
}
