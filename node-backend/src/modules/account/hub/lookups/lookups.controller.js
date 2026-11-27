import {
  listCostCentreChoices,
  listFinancialYearChoices,
  listGroupChoices,
  listLedgerChoices,
  listSacChoices,
  listTdsNatureChoices,
} from './lookups.service.js';

export async function ledgerChoices(req, res) {
  res.json(await listLedgerChoices());
}

export async function groupChoices(req, res) {
  res.json(await listGroupChoices());
}

export async function tdsNatureChoices(req, res) {
  res.json(await listTdsNatureChoices());
}

export async function costCentreChoices(req, res) {
  res.json(await listCostCentreChoices());
}

export async function sacChoices(req, res) {
  res.json(await listSacChoices());
}

export async function financialYearChoices(req, res) {
  res.json(await listFinancialYearChoices());
}
