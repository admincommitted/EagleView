import { statusOf } from '../shared/invoiceDb.js';
import {
  docketExpenses,
  invoiceMeta,
  jobDetails,
  nextInvoiceNumber,
  partyAccount,
  searchCharges,
  searchParties,
} from './lookup.service.js';

export async function getMeta(req, res) {
  res.json(await invoiceMeta());
}

export async function getParties(req, res) {
  res.json(await searchParties(req.query));
}

// a look-alike account answers 400 with the accounts to choose from
export async function getPartyAccount(req, res) {
  try {
    res.json(await partyAccount(req.query));
  } catch (error) {
    res.status(statusOf(error) || 500).json({ error: error.message, candidates: error.candidates || undefined });
  }
}

export async function getJob(req, res) {
  res.json(await jobDetails(req.query));
}

export async function getCharges(req, res) {
  res.json(await searchCharges(req.query.q));
}

export async function getExpenses(req, res) {
  res.json(await docketExpenses(req.query.jobNo));
}

export async function getNextInvoiceNumber(req, res) {
  res.json(await nextInvoiceNumber(req.query));
}
