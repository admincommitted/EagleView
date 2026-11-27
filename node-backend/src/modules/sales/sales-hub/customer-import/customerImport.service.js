import { BadRequestError, ForbiddenError } from '../../../../core/http/index.js';
import {
  q,
  x,
  now,
  today,
  ensure,
  debtorGroupIds,
  groupInfo,
  isReimbLedger,
  panOf,
  baseName,
  nameKey,
  clean,
  upper,
  numOrNull,
  GSTIN_RE,
  EMAIL_RE,
} from '../../../../utils/common/salesHub.js';
import {
  addYears,
  financialYearStart,
  inTransaction,
  personHasNameKey,
  queryOrEmpty,
} from '../../shared/salesHelpers.js';
import { forgetBilledActivity } from '../customers/customerActivity.js';

const MIN_BASE_NAME_LENGTH = 4;
const KEY_ACCOUNT_BILLED_INR = 2500000;
const KEY_ACCOUNT_BILLS = 50;
const REGULAR_BILLS = 6;
const MAX_SAMPLE = 25;
const ALWAYS_SAMPLE_FIRST = 10;
const MOBILE_RE = /^\+?[0-9 -]{10,15}$/;

const isClosedInIcaffe = (ledger) => /^\s*XX/i.test(ledger.name || '') || /XX\s*$/i.test(ledger.name || '');

async function billedDebtorLedgers(since, groupIds) {
  return q(
    `SELECT d.ledgerId id, count(DISTINCT v.id) bills, max(v.date) last, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) amt,
      (SELECT v2.branchCode FROM Vouchers v2 JOIN VoucherDetails d2 ON d2.voucherId = v2.id WHERE d2.ledgerId = d.ledgerId AND v2.date >= ?
        GROUP BY v2.branchCode ORDER BY count(*) DESC LIMIT 1) branch
    FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
    WHERE t.baseType = 'Sales' AND v.date >= ? AND coalesce(v.status, '') <> 'Rejected'
      AND d.ledgerId IN (SELECT id FROM AccountLedgers WHERE groupId IN (${groupIds.join(',')}))
    GROUP BY d.ledgerId`,
    [since, since],
  );
}

async function loadBilledLedgers(since, groupIds) {
  const billed = await billedDebtorLedgers(since, groupIds);
  const groupNames = new Map(
    (await q(`SELECT id, name FROM AccountGroups WHERE id IN (${groupIds.join(',')})`)).map((group) => [
      group.id,
      group.name,
    ]),
  );
  const ledgers = new Map();
  for (const bill of billed) {
    const [ledger] = await q(
      `SELECT id, name, groupId, gstin, pan, partyId, address, state, pinCode, country, email, phone, contactPerson,
        creditDays, dealingBranch FROM AccountLedgers WHERE id = ?`,
      [bill.id],
    );
    if (!ledger) continue;
    const group = groupNames.get(ledger.groupId) || '';
    ledgers.set(ledger.id, {
      ...ledger,
      bills: bill.bills,
      last: String(bill.last).slice(0, 10),
      amt: bill.amt || 0,
      branch: bill.branch,
      group,
      gi: groupInfo(group),
      reimb: isReimbLedger(ledger.name, group),
      pan: panOf(ledger.gstin, ledger.pan),
      base: baseName(ledger.name),
    });
  }
  return ledgers;
}

/** Puts the ledgers of one customer together: same PAN, or the same name without the account suffixes (union-find). */
function groupLedgersByCustomer(ledgers) {
  const parent = new Map([...ledgers.keys()].map((id) => [id, id]));
  const rootOf = (id) => {
    let current = id;
    while (parent.get(current) !== current) {
      parent.set(current, parent.get(parent.get(current)));
      current = parent.get(current);
    }
    return current;
  };
  const join = (a, b) => {
    const rootA = rootOf(a);
    const rootB = rootOf(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };
  const firstByPan = new Map();
  const firstByBaseName = new Map();
  for (const ledger of ledgers.values()) {
    if (ledger.pan) {
      if (firstByPan.has(ledger.pan)) join(ledger.id, firstByPan.get(ledger.pan));
      else firstByPan.set(ledger.pan, ledger.id);
    }
    if (ledger.base && ledger.base.length >= MIN_BASE_NAME_LENGTH) {
      if (firstByBaseName.has(ledger.base)) join(ledger.id, firstByBaseName.get(ledger.base));
      else firstByBaseName.set(ledger.base, ledger.id);
    }
  }
  const clusters = new Map();
  for (const ledger of ledgers.values()) {
    const root = rootOf(ledger.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(ledger);
  }
  return clusters;
}

async function ledgerOwners() {
  const owners = new Map();
  for (const row of await q('SELECT id, ledgerId FROM SalesCustomers WHERE ledgerId IS NOT NULL'))
    owners.set(row.ledgerId, row.id);
  for (const row of await q('SELECT customerId, ledgerId FROM SalesCustomerLedgers'))
    owners.set(row.ledgerId, row.customerId);
  return owners;
}

async function activePersonMatcher() {
  const persons = await q('SELECT id, name, aliases FROM SalesPersons WHERE coalesce(isActive, 1) = 1');
  return (name) => {
    const key = nameKey(name);
    return key ? persons.find((person) => personHasNameKey(person, key)) || null : null;
  };
}

function newImportCounts() {
  return {
    made: 0,
    linked: 0,
    withKam: 0,
    kamFromGroup: 0,
    kamFromDockets: 0,
    blocked: 0,
    onHold: 0,
    multiLedger: 0,
    unmatchedNames: new Map(),
  };
}

const countUnmatchedName = (counts, name) =>
  counts.unmatchedNames.set(name, (counts.unmatchedNames.get(name) || 0) + 1);

// main ledger: a service one, not closed in iCAFFE ("XX...XX" names), billed most
function mainLedgerOf(ledgers, serviceLedgers) {
  return (serviceLedgers.length ? serviceLedgers : ledgers)
    .slice()
    .sort((a, b) => isClosedInIcaffe(a) - isClosedInIcaffe(b) || b.bills - a.bills || b.amt - a.amt)[0];
}

// new ledgers of a customer already here are linked to it
async function linkNewLedgers(customerId, ledgers, context, transaction) {
  for (const ledger of ledgers) {
    if (context.owners.has(ledger.id)) continue;
    context.counts.linked++;
    if (!context.dryRun) {
      await x(
        'INSERT INTO SalesCustomerLedgers (customerId, ledgerId, kind, createdBy, createdAt) VALUES (?,?,?,?,?)',
        [customerId, ledger.id, ledger.reimb ? 'REIMB' : 'OTHER', context.user, now()],
        transaction,
      );
    }
    context.owners.set(ledger.id, customerId);
  }
}

async function topDocketMarketingPerson(mainLedger, since, transaction) {
  const upperName = String(mainLedger.name || '')
    .trim()
    .toUpperCase();
  const partyCondition = mainLedger.partyId ? 'mainPartyId = ? OR ' : '';
  const rows = await queryOrEmpty(
    `SELECT marketingPerson n, count(*) c FROM Shipments
      WHERE trim(coalesce(marketingPerson, '')) <> '' AND docketDate >= ?
        AND (${partyCondition}upper(trim(billingParty)) = ? OR upper(trim(mainParty)) = ?)
      GROUP BY upper(trim(marketingPerson)) ORDER BY c DESC LIMIT 1`,
    [since, ...(mainLedger.partyId ? [mainLedger.partyId] : []), upperName, upperName],
    transaction,
  );
  return rows[0];
}

// KAM: the person a debtor group is named after, else the iCAFFE marketing person on most dockets
async function findKam(mainLedger, ledgers, context, transaction) {
  for (const ledger of [mainLedger, ...ledgers]) {
    if (!ledger.gi.person) continue;
    const person = context.matchPerson(ledger.gi.person);
    if (person) return { kam: person, kamFrom: 'debtor group ' + ledger.group };
    countUnmatchedName(context.counts, ledger.gi.person);
  }
  const marketing = await topDocketMarketingPerson(mainLedger, context.since, transaction);
  if (marketing) {
    const person = context.matchPerson(marketing.n);
    if (person) return { kam: person, kamFrom: 'iCAFFE marketing person on its dockets' };
    countUnmatchedName(context.counts, marketing.n);
  }
  return { kam: null, kamFrom: '' };
}

function validGstinOf(mainLedger, ledgers) {
  if (mainLedger.gstin && GSTIN_RE.test(String(mainLedger.gstin).toUpperCase()))
    return String(mainLedger.gstin).toUpperCase();
  return (
    ledgers.map((ledger) => String(ledger.gstin || '').toUpperCase()).find((gstin) => GSTIN_RE.test(gstin)) || null
  );
}

function mostBilledBranch(ledgers) {
  const billsByBranch = new Map();
  ledgers.forEach((ledger) => {
    const branch = upper(ledger.branch || ledger.dealingBranch);
    if (branch) billsByBranch.set(branch, (billsByBranch.get(branch) || 0) + ledger.bills);
  });
  return [...billsByBranch.entries()].sort((a, b) => b[1] - a[1]).map((entry) => entry[0])[0] || null;
}

// the customer's name without iCAFFE's ledger marks ("XX...XX" closed, "-DR" / "_DR" debtor copy)
const customerNameOf = (mainLedger) =>
  String(mainLedger.name)
    .trim()
    .replace(/^XX+\s*/i, '')
    .replace(/\s*XX+$/i, '')
    .replace(/\s*[-_]\s*DR\.?$/i, '')
    .trim() || String(mainLedger.name).trim();

// key: Rs 25 lakh+ billed or 50+ bills in the period
function segmentOf(serviceBilled, serviceBills) {
  if (serviceBilled >= KEY_ACCOUNT_BILLED_INR || serviceBills >= KEY_ACCOUNT_BILLS) return 'KEY';
  return serviceBills >= REGULAR_BILLS ? 'REGULAR' : 'OCCASIONAL';
}

function importRemarks(ledgers, serviceBills, since, kam, kamFrom) {
  const lastBill = ledgers
    .map((ledger) => ledger.last)
    .sort()
    .pop();
  const ledgerNote = ledgers.length > 1 ? `; ${ledgers.length} ledgers` : '';
  const kamNote = kam ? `; KAM from ${kamFrom}` : '';
  return `Loaded from the books: ${serviceBills} bills since ${since}, last ${lastBill}${ledgerNote}${kamNote}`;
}

function buildCustomerRow({ ledgers, serviceLedgers, mainLedger, kam, kamFrom, status, since }) {
  const serviceBilled = serviceLedgers.reduce((sum, ledger) => sum + ledger.amt, 0);
  const serviceBills = (serviceLedgers.length ? serviceLedgers : ledgers).reduce(
    (sum, ledger) => sum + ledger.bills,
    0,
  );
  const services = [...new Set(ledgers.map((ledger) => ledger.gi.service).filter(Boolean))];
  const gstin = validGstinOf(mainLedger, ledgers);
  const row = {
    ledgerId: mainLedger.id,
    partyId: mainLedger.partyId || null,
    name: customerNameOf(mainLedger),
    status,
    customerType: ledgers.map((ledger) => ledger.gi.customerType).find(Boolean) || null,
    segment: segmentOf(serviceBilled, serviceBills),
    source: 'Existing customer',
    kamId: kam ? kam.id : null,
    branchCode: mostBilledBranch(ledgers),
    services: services.length ? services.join(',') : null,
    address: clean(mainLedger.address),
    state: clean(mainLedger.state),
    country: upper(mainLedger.country) || 'IN',
    pinCode: clean(mainLedger.pinCode),
    gstin,
    pan: mainLedger.pan || (gstin ? gstin.slice(2, 12) : null),
    email: clean(mainLedger.email),
    phone: clean(mainLedger.phone),
    creditTerm: mainLedger.creditDays ? 'CREDIT' : null,
    creditDaysAsked: numOrNull(mainLedger.creditDays),
    remarks: importRemarks(ledgers, serviceBills, since, kam, kamFrom),
  };
  return { row, serviceBilled, serviceBills };
}

function countNewCustomer(counts, { kam, kamFrom, status, ledgers }) {
  counts.made++;
  if (kam) {
    counts.withKam++;
    if (kamFrom.startsWith('debtor')) counts.kamFromGroup++;
    else counts.kamFromDockets++;
  }
  if (status === 'BLOCKED') counts.blocked++;
  if (status === 'ON_HOLD') counts.onHold++;
  if (ledgers.length > 1) counts.multiLedger++;
}

function addSample(sample, { row, ledgers, kam, status, serviceBilled, serviceBills }) {
  if (sample.length >= MAX_SAMPLE || !(ledgers.length > 1 || kam || sample.length < ALWAYS_SAMPLE_FIRST)) return;
  sample.push({
    name: row.name,
    ledgers: ledgers.map((ledger) => `${ledger.name}${ledger.reimb ? ' [duty/DO]' : ''}`),
    billed: Math.round(serviceBilled),
    bills: serviceBills,
    segment: row.segment,
    status,
    kam: kam ? kam.name : '',
    branch: row.branchCode,
  });
}

async function insertImportedContact(customerId, ledgers, mainLedger, transaction) {
  const contactLedger = ledgers.find((ledger) => clean(ledger.contactPerson) || clean(ledger.email)) || mainLedger;
  const phoneIsMobile = MOBILE_RE.test(String(contactLedger.phone || ''));
  if (!clean(contactLedger.contactPerson) && !clean(contactLedger.email) && !phoneIsMobile) return;
  await x(
    `INSERT INTO SalesContacts (customerId, name, email, mobile, isPrimary, sendQuotes, isActive, remarks, createdAt, updatedAt)
      VALUES (?,?,?,?,1,1,1,?,?,?)`,
    [
      customerId,
      clean(contactLedger.contactPerson) || 'Accounts',
      EMAIL_RE.test(String(contactLedger.email || '').trim()) ? clean(contactLedger.email) : null,
      phoneIsMobile ? clean(contactLedger.phone) : null,
      'From the accounts ledger',
      now(),
      now(),
    ],
    transaction,
  );
}

async function insertImportedCustomer({ row, ledgers, mainLedger, kam, kamFrom }, context, transaction) {
  const columns = Object.keys(row);
  await x(
    `INSERT INTO SalesCustomers (${columns.join(', ')}, createdBy, updatedBy, createdAt, updatedAt)
      VALUES (${columns.map(() => '?').join(', ')}, ?, ?, ?, ?)`,
    [...columns.map((column) => row[column]), context.user, context.user, now(), now()],
    transaction,
  );
  const customerId = (await q('SELECT id FROM SalesCustomers WHERE ledgerId = ?', [mainLedger.id], transaction))[0].id;
  for (const ledger of ledgers) {
    context.owners.set(ledger.id, customerId);
    if (ledger.id === mainLedger.id) continue;
    await x(
      'INSERT INTO SalesCustomerLedgers (customerId, ledgerId, kind, createdBy, createdAt) VALUES (?,?,?,?,?)',
      [customerId, ledger.id, ledger.reimb ? 'REIMB' : 'OTHER', context.user, now()],
      transaction,
    );
  }
  if (kam) {
    await x(
      "INSERT INTO SalesAssignments (customerId, salesPersonId, role, fromDate, reason, changedBy, createdAt) VALUES (?,?, 'KAM', ?, ?, ?, ?)",
      [customerId, kam.id, today(), 'Loaded from the books (' + kamFrom + ')', context.user, now()],
      transaction,
    );
  }
  await insertImportedContact(customerId, ledgers, mainLedger, transaction);
}

async function importCluster(ledgers, context, transaction) {
  const serviceLedgers = ledgers.filter((ledger) => !ledger.reimb);
  const mainLedger = mainLedgerOf(ledgers, serviceLedgers);
  const existingCustomerId = ledgers.map((ledger) => context.owners.get(ledger.id)).find(Boolean);
  if (existingCustomerId) {
    await linkNewLedgers(existingCustomerId, ledgers, context, transaction);
    return;
  }
  const { kam, kamFrom } = await findKam(mainLedger, ledgers, context, transaction);
  const status = ledgers.map((ledger) => ledger.gi.status).find(Boolean) || 'ACTIVE';
  const customer = {
    ledgers,
    mainLedger,
    kam,
    kamFrom,
    status,
    ...buildCustomerRow({ ledgers, serviceLedgers, mainLedger, kam, kamFrom, status, since: context.since }),
  };
  countNewCustomer(context.counts, customer);
  addSample(context.sample, customer);
  if (context.dryRun) return;
  await insertImportedCustomer(customer, context, transaction);
}

/**
 * Load customers from the books: every debtor ledger billed since a date gets a sales profile. A customer's ledgers are
 * put together (same PAN, or the same name without the account suffixes), so "X PVT LTD" and
 * "X PVT LTD (IMPORT DUTY ACCOUNT)" / "-DUTY A/C" / "- DO" are one customer: the main ledger is the service one billed
 * most, the duty / DO / direct-party ones are linked as reimbursement accounts.
 * From the iCAFFE debtor group: the KAM (group named after a sales person here), Blocked (CASE / Blocked Recoveries),
 * On hold (Disputed / W-KYC), Overseas agent, Courier. Else the KAM is the sales person whose iCAFFE name is on most of
 * its dockets. Branch = the branch it is billed from most. Existing profiles are not changed; a new ledger of an
 * existing customer is linked to it.
 */
export async function loadCustomersFromBooks(salesViewer, body) {
  await ensure();
  if (!salesViewer.isAdmin && !salesViewer.canManage) {
    throw new ForbiddenError('Only a sales manager or admin can load customers');
  }
  const since = clean(body.since) || addYears(financialYearStart(), -1);
  const dryRun = body.dryRun === true || body.dryRun === '1';
  const groupIds = [...(await debtorGroupIds())];
  if (!groupIds.length) throw new BadRequestError('No Sundry Debtors group in the accounts');
  const ledgers = await loadBilledLedgers(since, groupIds);
  const clusters = groupLedgersByCustomer(ledgers);
  const context = {
    since,
    dryRun,
    user: salesViewer.user,
    counts: newImportCounts(),
    sample: [],
    owners: await ledgerOwners(),
    matchPerson: await activePersonMatcher(),
  };
  const importAll = async (transaction) => {
    for (const clusterLedgers of clusters.values()) await importCluster(clusterLedgers, context, transaction);
  };
  if (dryRun) await importAll();
  else await inTransaction(importAll);
  forgetBilledActivity();
  const { unmatchedNames, ...counts } = context.counts;
  return {
    success: true,
    dryRun,
    since,
    ledgersBilled: ledgers.size,
    customers: clusters.size,
    ...counts,
    unmatchedNames: [...unmatchedNames.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, customers: count })),
    sample: context.sample,
  };
}
