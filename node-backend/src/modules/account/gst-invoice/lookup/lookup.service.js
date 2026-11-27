import * as numberSeries from '../../../../utils/common/numberSeries.js';
import {
  ensureInvoiceTables,
  parseJsonList,
  round2,
  selectRows,
  statusOf,
  todayIso,
  toNumber,
} from '../shared/invoiceDb.js';
import { KINDS, REASONS, VOID } from '../shared/invoiceKinds.js';
import { invoiceNumberFor } from '../shared/invoiceNumbering.js';
import { ourGst, indianStates } from '../shared/ourCompany.js';
import { findPartyLedger } from '../shared/partyLedger.js';

const MIN_SEARCH_LENGTH = 2;
const PARTY_TYPE_FILTERS = {
  importer: '(p.isConsignee = 1 OR p.isShipper = 1)',
  shipper: 'p.isShipper = 1',
  subagent: 'p.isSubAgent = 1',
  overseas: 'p.isOverseasAgent = 1',
};
const TWO_ACCOUNTS = -1;

export async function invoiceMeta() {
  await ensureInvoiceTables();
  const [our, states, currencies, branches] = await Promise.all([
    ourGst(),
    indianStates(),
    selectRows(
      'SELECT currencyCode code, currencyName name, importRate, exportRate FROM Currencies ORDER BY standard DESC, currencyCode',
    ).catch(() => []),
    selectRows(
      "SELECT branchCode code, branchName name, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') = 'Active' ORDER BY isDefault DESC, branchCode",
    ).catch(() => []),
  ]);
  return {
    kinds: Object.entries(KINDS).map(([id, kind]) => ({ id, ...kind })),
    reasons: REASONS,
    our,
    states,
    currencies,
    branches,
  };
}

const findMasterParties = (filter, text) =>
  selectRows(
    `SELECT p.id, p.name, p.partyType, p.email FROM Parties p WHERE ${filter} AND coalesce(p.blackList, 0) = 0 AND p.name LIKE ?
    ORDER BY (p.name LIKE ?) DESC, p.name LIMIT 25`,
    ['%' + text + '%', text + '%'],
  ).catch(() => []);

const findPartyBranches = (partyIds) =>
  partyIds.length
    ? selectRows(
        `SELECT id, partyId, branchName, address1, address2, city, state, country, pinCode, gstin, email1, sez, gstExempted, isDefault
      FROM PartyBranches WHERE partyId IN (${partyIds.join(',')}) AND coalesce(disabled, 0) = 0 ORDER BY isDefault DESC, id`,
      ).catch(() => [])
    : [];

// debtor / creditor style ledgers by name: not duties, bank or cash
const findDebtorLedgers = (text) =>
  selectRows(
    `SELECT l.id, l.name, l.gstin, l.state, l.address, l.email FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId
    WHERE l.name LIKE ? AND coalesce(l.isActive, 1) = 1 AND coalesce(g.nature, 'Assets') IN ('Assets', 'Liabilities')
    AND lower(coalesce(g.name, '')) NOT LIKE '%duties%' AND lower(coalesce(g.name, '')) NOT LIKE '%bank%'
    AND lower(coalesce(g.name, '')) NOT LIKE '%cash%' ORDER BY l.name LIMIT 10`,
    ['%' + text + '%'],
  ).catch(() => []);

const sameName = (first, second) => String(first).trim().toUpperCase() === String(second).trim().toUpperCase();

/** Each party's account: linked by party id or same name; two accounts for one party give null (the user picks). */
async function accountsOfParties(parties, partyIds) {
  const accounts = new Map();
  if (!parties.length) return accounts;
  const ledgers = await selectRows(
    `SELECT id, name, partyId FROM AccountLedgers WHERE coalesce(isActive, 1) = 1
      AND (partyId IN (${partyIds.length ? partyIds.join(',') : 0}) OR upper(trim(name)) IN (${parties.map(() => '?').join(',')}))`,
    parties.map((party) => String(party.name).trim().toUpperCase()),
  ).catch(() => []);
  for (const ledger of ledgers) {
    for (const party of parties) {
      if (ledger.partyId !== party.id && !sameName(ledger.name, party.name)) continue;
      if (accounts.has(party.id) && accounts.get(party.id) !== ledger.id) accounts.set(party.id, TWO_ACCOUNTS);
      else accounts.set(party.id, ledger.id);
    }
  }
  for (const [partyId, ledgerId] of accounts) if (ledgerId === TWO_ACCOUNTS) accounts.set(partyId, null);
  return accounts;
}

const ledgerOption = (ledger) => ({
  source: 'ledger',
  ledgerId: ledger.id,
  name: ledger.name,
  branches: [
    {
      id: null,
      label: 'Ledger',
      address: ledger.address || '',
      gstin: ledger.gstin || '',
      state: ledger.state || '',
      email: ledger.email || '',
    },
  ],
});

const branchOption = (branch, party) => ({
  id: branch.id,
  label: branch.branchName || 'Branch',
  address: [branch.address1, branch.address2, branch.city, branch.pinCode].filter(Boolean).join(', '),
  gstin: branch.gstin || '',
  state: branch.state || '',
  country: branch.country || '',
  email: branch.email1 || party.email || '',
  sez: !!branch.sez,
  exempt: !!branch.gstExempted,
});

const partyOption = (party, accounts, branches) => ({
  source: 'party',
  partyId: party.id,
  ledgerId: accounts.get(party.id) || null,
  hasAccount: accounts.has(party.id),
  twoAccounts: accounts.has(party.id) && !accounts.get(party.id),
  name: party.name,
  partyType: party.partyType,
  branches: branches.filter((branch) => branch.partyId === party.id).map((branch) => branchOption(branch, party)),
});

/** Party search: the Party master (with its GST branches) and the debtor ledgers already in accounts. */
export async function searchParties({ q: searchText, type }) {
  await ensureInvoiceTables();
  const text = String(searchText || '').trim();
  if (text.length < MIN_SEARCH_LENGTH) return [];
  const parties = await findMasterParties(PARTY_TYPE_FILTERS[type] || '1 = 1', text);
  const partyIds = parties.map((party) => party.id);
  const branches = await findPartyBranches(partyIds);
  const ledgers = await findDebtorLedgers(text);
  const accounts = await accountsOfParties(parties, partyIds);
  return [...ledgers.map(ledgerOption), ...parties.map((party) => partyOption(party, accounts, branches))];
}

/** iCAFFE GetPartyAccountByID: the party's account, or null ("Party Account not created !"). */
export async function partyAccount(query) {
  await ensureInvoiceTables();
  const ledgerId = await findPartyLedger(null, {
    ledgerId: Number(query.ledgerId) || null,
    partyId: Number(query.partyId) || null,
    partyName: query.name || '',
    gstin: query.gstin || '',
  });
  if (!ledgerId) return null;
  return (
    await selectRows(
      'SELECT l.id ledgerId, l.name, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.id = ?',
      [ledgerId],
    )
  )[0];
}

const directionOfDivision = (division) => (/^A?I|SI/.test(division) ? 'Import' : 'Export');

/** Docket / house no -> the job and the party on it: freight dockets first, then customs export / import jobs. */
export async function jobDetails({ no: jobNoText, by }) {
  const jobNo = String(jobNoText || '')
    .trim()
    .toUpperCase();
  if (!jobNo) return null;
  const byHawb = by === 'hawb';
  const shipment = (
    await selectRows(
      `SELECT docketNo jobNo, docketDate jobDate, mawbNo, hawbNo, ediJobNo sbBe, branchCode, division, mainParty party, billingParty,
      billingAddress FROM Shipments WHERE upper(trim(${byHawb ? 'hawbNo' : 'docketNo'})) = ? AND coalesce(stage, '') <> 'Cancelled' LIMIT 1`,
      [jobNo],
    ).catch(() => [])
  )[0];
  if (shipment) {
    return {
      ...shipment,
      dir: directionOfDivision(shipment.division),
      mode: /^A/.test(shipment.division) ? 'AIR' : 'SEA',
      party: shipment.billingParty || shipment.party,
      jobDate: String(shipment.jobDate || '').slice(0, 10),
    };
  }
  const exportJobs = await selectRows(
    `SELECT jobNo, jobDate, mawbNo, hawbNo, coalesce(sbNo, sbNumber) sbBe, branchCode, shipmentMode mode, shipperName party, 'Export' dir
      FROM ExportJobs WHERE upper(trim(${byHawb ? 'hawbNo' : 'jobNo'})) = ? LIMIT 1`,
    [jobNo],
  ).catch(() => []);
  const importJobs = exportJobs.length
    ? []
    : await selectRows(
        `SELECT jobNo, jobDate, coalesce(mawbNo, mawbblNo) mawbNo, coalesce(hawbNo, hawbhblNo) hawbNo, coalesce(beNo, beNumber) sbBe, branchCode,
      shipmentMode mode, nameOfImporter party, 'Import' dir FROM ImportJobs
      WHERE upper(trim(${byHawb ? 'coalesce(hawbNo, hawbhblNo)' : 'jobNo'})) = ? LIMIT 1`,
        [jobNo],
      ).catch(() => []);
  const job = exportJobs[0] || importJobs[0];
  if (!job) return null;
  return { ...job, jobDate: job.jobDate ? String(job.jobDate).slice(0, 10) : '' };
}

/** GST charges of Accounts first (master: true), then the operations charge names not already among them. */
export async function searchCharges(searchText) {
  const pattern = '%' + String(searchText || '').trim() + '%';
  const gstCharges = await selectRows(
    'SELECT chargeName name, sacCode sac, gstRate, ledgerId, expenseLedgerId, coalesce(exempt, 0) exempt FROM AccGstCharges WHERE chargeName LIKE ? ORDER BY chargeName LIMIT 30',
    [pattern],
  ).catch(() => []);
  const operationCharges = await selectRows(
    `SELECT DISTINCT coalesce(chargeName, awbChargeName) name, sacCode sac, gstRate FROM Charges
      WHERE coalesce(chargeName, awbChargeName) LIKE ? AND coalesce(isActive, 1) = 1 LIMIT 30`,
    [pattern],
  ).catch(() => []);
  const seen = new Set(gstCharges.map((charge) => String(charge.name).toUpperCase()));
  return [
    ...gstCharges.map((charge) => ({ ...charge, master: true })),
    ...operationCharges
      .filter((charge) => charge.name && !seen.has(String(charge.name).toUpperCase()))
      .map((charge) => ({ ...charge, master: false })),
  ];
}

const isExpenseLine = (row) => row.nature === 'Expenses' || /expense|freight|charges/i.test(row.ledger);
// a purchase line of a receipted charge reads "Rec <charge> SAC ..."
const RECEIPTED_CHARGE = /^Rec\s+(.+?)\s+SAC/i;

async function billedByCharge(jobNo) {
  const billed = await selectRows(
    `SELECT linesJson FROM AccSalesInvoices WHERE upper(trim(jobNo)) = upper(?) AND coalesce(status, '') <> '${VOID}'`,
    [jobNo],
  ).catch(() => []);
  const done = new Map();
  for (const invoice of billed) {
    for (const line of parseJsonList(invoice.linesJson))
      done.set(line.charge, (done.get(line.charge) || 0) + toNumber(line.inrAmount));
  }
  return done;
}

/** Show Expense: the costs booked on the docket (purchase / payment / journal lines to expense ledgers), to bill them on. */
export async function docketExpenses(jobNoText) {
  const jobNo = String(jobNoText || '').trim();
  if (!jobNo) return [];
  const rows = await selectRows(
    `SELECT v.id vid, v.voucherNumber, v.date, t.baseType, v.refNo, d.amount, d.dc, d.remarks, l.name ledger, l.id ledgerId, g.nature
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      JOIN AccountLedgers l ON l.id = d.ledgerId LEFT JOIN AccountGroups g ON g.id = l.groupId
      WHERE upper(trim(v.jobNo)) = upper(?) AND coalesce(v.status, '') <> 'Rejected'
      AND t.baseType IN ('Purchase', 'Payment', 'Journal', 'Debit Note') ORDER BY v.date`,
    [jobNo],
  );
  const expenses = rows.filter(isExpenseLine);
  const billed = await billedByCharge(jobNo);
  return expenses.map((row) => {
    const receipted = String(row.remarks || '').match(RECEIPTED_CHARGE);
    const charge = (receipted ? receipted[1] : row.ledger).toUpperCase();
    return {
      voucherId: row.vid,
      voucherNumber: row.voucherNumber,
      date: row.date,
      baseType: row.baseType,
      billNo: row.refNo || '',
      ledger: row.ledger,
      charge,
      amount: round2((row.dc === 'Dr' ? 1 : -1) * toNumber(row.amount)),
      billed: round2(billed.get(charge) || 0),
    };
  });
}

/** The number the next invoice will get; a missing series answers its reason as a note. */
export async function nextInvoiceNumber(query) {
  try {
    await ensureInvoiceTables();
    if (!KINDS[query.kind]) return { no: '' };
    const division = numberSeries.divOf(query.division || query.jobNo);
    return { no: await invoiceNumberFor(query.kind, query.branch, query.date || todayIso(), null, division, false) };
  } catch (error) {
    if (statusOf(error) === 400) return { no: '', note: error.message };
    throw error;
  }
}
