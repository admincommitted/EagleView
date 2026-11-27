import {
  allAccountingMasters,
  costCategories,
  costCentreReport,
  costCentres,
  currencies,
  seedAccountingMasters,
  tdsNatures,
  voucherTypes,
} from './accountingMaster.service.js';

export async function seedMasters(req, res) {
  res.json(await seedAccountingMasters());
}

export async function getAllMasters(req, res) {
  res.json(await allAccountingMasters());
}

export async function getCostCentreReport(req, res) {
  res.json(await costCentreReport(req.query));
}

/** The list / add / change / remove handlers of one simple master. */
const crudHandlers = (crud) => ({
  list: async (req, res) => res.json(await crud.list()),
  add: async (req, res) => res.json(await crud.create(req.body)),
  change: async (req, res) => res.json(await crud.update(req.params.id, req.body)),
  remove: async (req, res) => res.json(await crud.remove(req.params.id)),
});

export const voucherTypeHandlers = crudHandlers(voucherTypes);
export const costCategoryHandlers = crudHandlers(costCategories);
export const costCentreHandlers = crudHandlers(costCentres);
export const currencyHandlers = crudHandlers(currencies);
export const tdsNatureHandlers = crudHandlers(tdsNatures);
