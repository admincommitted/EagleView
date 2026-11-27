import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../../core/http/index.js';
import {
  q,
  x,
  now,
  today,
  ensure,
  customerWhere,
  debtorGroupIds,
  nameKey,
  clean,
  upper,
  numOrNull,
  listOf,
} from '../../../../utils/common/salesHub.js';
import { financialYearStart, inTransaction } from '../../shared/salesHelpers.js';
import {
  activityFlag,
  billedActivityByLedger,
  customerFigures,
  ledgersByCustomer,
  sumActivity,
} from './customerActivity.js';
import { contactRows, laneRows, validateCustomerForm } from './customerForm.js';

const DEFAULT_LIST_LIMIT = 300;
const MAX_LIST_LIMIT = 5000;
const LEDGER_PICK_LIMIT = 50;
const COMPANY_WORDS_RE = /\b(PVT|PRIVATE|LTD|LIMITED|LLP|INC|CO|COMPANY|THE)\b/g;
const CUSTOMER_CHILD_TABLES = ['SalesContacts', 'SalesLanes', 'SalesAssignments', 'SalesCustomerLedgers'];

const whereClause = (conditions) => (conditions.length ? 'WHERE ' + conditions.join(' AND ') : '');

function addListFilters(query, conditions, params) {
  if (query.status) {
    conditions.push('c.status = ?');
    params.push(upper(query.status));
  }
  if (query.kamId) {
    if (query.kamId === 'none') {
      conditions.push('c.kamId IS NULL');
    } else {
      conditions.push("(c.kamId = ? OR (',' || coalesce(c.secondaryIds, '') || ',') LIKE ?)");
      params.push(Number(query.kamId), `%,${Number(query.kamId)},%`);
    }
  }
  if (query.industry) {
    conditions.push('c.industry = ?');
    params.push(query.industry);
  }
  if (query.segment) {
    conditions.push('c.segment = ?');
    params.push(upper(query.segment));
  }
  if (query.customerType) {
    conditions.push('c.customerType = ?');
    params.push(upper(query.customerType));
  }
  if (query.branch) {
    conditions.push('upper(c.branchCode) = ?');
    params.push(upper(query.branch));
  }
  if (query.service) {
    conditions.push("(',' || coalesce(c.services, '') || ',') LIKE ?");
    params.push(`%,${upper(query.service)},%`);
  }
  if (query.reviewDue === '1') {
    conditions.push('c.nextReviewDate IS NOT NULL AND c.nextReviewDate <= ?');
    params.push(today());
  }
  if (clean(query.q)) {
    const pattern = '%' + clean(query.q).toLowerCase() + '%';
    conditions.push(`(lower(c.name) LIKE ? OR lower(coalesce(c.gstin, '')) LIKE ? OR lower(coalesce(c.city, '')) LIKE ?
        OR lower(coalesce(c.email, '')) LIKE ? OR lower(coalesce(c.phone, '')) LIKE ?
        OR c.id IN (SELECT customerId FROM SalesContacts WHERE lower(name) LIKE ? OR lower(coalesce(email, '')) LIKE ? OR coalesce(mobile, '') LIKE ?))`);
    params.push(pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern);
  }
}

function sortCustomerRows(rows, sort) {
  if (sort === 'billed') rows.sort((a, b) => b.billedCy - a.billedCy);
  else if (sort === 'lastBill') rows.sort((a, b) => String(b.lastBill || '').localeCompare(String(a.lastBill || '')));
  else if (sort === 'potential') rows.sort((a, b) => (b.potentialRevenue || 0) - (a.potentialRevenue || 0));
}

function countByStatus(rows) {
  const counts = {};
  rows.forEach((row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
  });
  return counts;
}

/** The customers the viewer may see, with their billed figures from the books. */
export async function listCustomers(salesViewer, query) {
  await ensure();
  const { w: conditions, p: params } = customerWhere(salesViewer);
  addListFilters(query, conditions, params);
  const rows = await q(
    `SELECT c.id, c.ledgerId, c.name, c.status, c.customerType, c.industry, c.segment, c.kamId, c.secondaryIds,
        c.branchCode, c.services, c.city, c.state, c.country, c.gstin, c.potentialRevenue, c.nextReviewDate, c.updatedAt, k.name kamName,
        (SELECT count(*) FROM SalesContacts s WHERE s.customerId = c.id AND coalesce(s.isActive, 1) = 1) contacts,
        (SELECT count(*) FROM SalesLanes l WHERE l.customerId = c.id AND coalesce(l.isActive, 1) = 1) lanes
      FROM SalesCustomers c LEFT JOIN SalesPersons k ON k.id = c.kamId ${whereClause(conditions)} ORDER BY c.name`,
    params,
  );
  const activity = await billedActivityByLedger();
  const ledgers = await ledgersByCustomer(rows.map((row) => row.id));
  let data = rows.map((row) => {
    const customerLedgers = ledgers.get(row.id);
    const totals = sumActivity(customerLedgers, activity);
    return {
      ...row,
      ...totals,
      ledgers: (customerLedgers || []).length,
      activity: customerLedgers ? activityFlag(totals.lastBill) : 'NONE',
    };
  });
  if (query.activity) data = data.filter((row) => row.activity === upper(query.activity));
  sortCustomerRows(data, query.sort || 'name');
  const counts = countByStatus(data);
  const limit = Math.min(Number(query.limit) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  return { success: true, total: data.length, counts, data: data.slice(0, limit), fy: financialYearStart() };
}

async function viewerCanSeeCustomer(salesViewer, customerId) {
  const { w: conditions, p: params } = customerWhere(salesViewer);
  const extra = conditions.length ? ' AND ' + conditions.join(' AND ') : '';
  return !!(await q(`SELECT c.id FROM SalesCustomers c WHERE c.id = ?${extra}`, [customerId, ...params]))[0];
}

export async function getCustomer(salesViewer, customerId) {
  await ensure();
  const [customer] = await q(
    'SELECT c.*, k.name kamName FROM SalesCustomers c LEFT JOIN SalesPersons k ON k.id = c.kamId WHERE c.id = ?',
    [customerId],
  );
  if (!customer || !(await viewerCanSeeCustomer(salesViewer, customer.id)))
    throw new NotFoundError('Customer not found');
  const contacts = await q(
    'SELECT * FROM SalesContacts WHERE customerId = ? ORDER BY isPrimary DESC, coalesce(isActive, 1) DESC, name',
    [customer.id],
  );
  const lanes = await q(
    'SELECT * FROM SalesLanes WHERE customerId = ? ORDER BY coalesce(isActive, 1) DESC, service, origin, destination',
    [customer.id],
  );
  const history = await q(
    `SELECT a.*, p.name personName FROM SalesAssignments a LEFT JOIN SalesPersons p ON p.id = a.salesPersonId
      WHERE a.customerId = ? ORDER BY a.fromDate DESC, a.id DESC`,
    [customer.id],
  );
  const ledger = customer.ledgerId
    ? (
        await q(
          `SELECT l.id, l.name, l.gstin, l.pan, l.creditDays, l.creditLimit, l.isBlacklisted, l.blacklistReason, l.dealingBranch,
          l.partyId, l.isActive, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE l.id = ?`,
          [customer.ledgerId],
        )
      )[0]
    : null;
  const ledgers = await q(
    `SELECT cl.id, cl.ledgerId, cl.kind, l.name, l.gstin, g.name groupName
      FROM SalesCustomerLedgers cl JOIN AccountLedgers l ON l.id = cl.ledgerId
      LEFT JOIN AccountGroups g ON g.id = l.groupId WHERE cl.customerId = ? ORDER BY cl.kind, l.name`,
    [customer.id],
  );
  const figures = await customerFigures(customer, ledger, ledgers);
  return { success: true, data: { ...customer, contacts, lanes, history, ledger, ledgers, figures } };
}

const companyNameKey = (name) => nameKey(name).replace(COMPANY_WORDS_RE, '').replace(/\s+/g, ' ').trim();

async function assertLedgerIsFree(ledgerId, customerId) {
  const otherId = customerId || 0;
  const [profile] = await q('SELECT id, name FROM SalesCustomers WHERE ledgerId = ? AND id <> ?', [ledgerId, otherId]);
  if (profile) throw new BadRequestError(`This ledger already has a sales profile: ${profile.name}`);
  const [linked] = await q(
    `SELECT c.name FROM SalesCustomerLedgers cl JOIN SalesCustomers c ON c.id = cl.customerId
      WHERE cl.ledgerId = ? AND cl.customerId <> ?`,
    [ledgerId, otherId],
  );
  if (linked) throw new BadRequestError(`This ledger is already linked to the customer ${linked.name}`);
}

/** A customer that looks like this one (same GSTIN or almost the same name) - the screen asks before saving it. */
async function duplicateWarning(fields, customerId) {
  const otherId = customerId || 0;
  if (fields.ledgerId) await assertLedgerIsFree(fields.ledgerId, customerId);
  if (fields.gstin) {
    const [sameGstin] = await q('SELECT id, name FROM SalesCustomers WHERE gstin = ? AND id <> ?', [
      fields.gstin,
      otherId,
    ]);
    if (sameGstin) return `GSTIN ${fields.gstin} is already on ${sameGstin.name}`;
  }
  const key = companyNameKey(fields.name);
  if (key) {
    const others = await q('SELECT id, name FROM SalesCustomers WHERE id <> ?', [otherId]);
    const sameName = others.find((row) => companyNameKey(row.name) === key);
    if (sameName) return `A customer with almost the same name exists: ${sameName.name}`;
  }
  return '';
}

const duplicateConflict = (warning) =>
  new ConflictError(warning, { body: { success: false, duplicate: true, error: warning } });

function readLinkedLedgers(list) {
  return (Array.isArray(list) ? list : [])
    .map((ledger) => ({
      ledgerId: numOrNull(ledger.ledgerId),
      kind: upper(ledger.kind) === 'REIMB' ? 'REIMB' : 'OTHER',
    }))
    .filter((ledger) => ledger.ledgerId);
}

async function assertLinkedLedgersAreFree(customerId, ledgers, transaction) {
  const mainLedgerId = (await q('SELECT ledgerId FROM SalesCustomers WHERE id = ?', [customerId], transaction))[0]
    .ledgerId;
  const seen = new Set();
  for (const ledger of ledgers) {
    if (ledger.ledgerId === mainLedgerId) {
      throw new BadRequestError("The main ledger is already the customer's ledger - do not add it again");
    }
    if (seen.has(ledger.ledgerId)) throw new BadRequestError('A ledger is listed twice');
    seen.add(ledger.ledgerId);
    if (!(await q('SELECT id FROM AccountLedgers WHERE id = ?', [ledger.ledgerId], transaction))[0]) {
      throw new BadRequestError('Ledger ' + ledger.ledgerId + ' not found');
    }
    const [owner] = await q(
      `SELECT c.name FROM SalesCustomers c WHERE c.ledgerId = ? AND c.id <> ?
        UNION SELECT c.name FROM SalesCustomerLedgers cl JOIN SalesCustomers c ON c.id = cl.customerId WHERE cl.ledgerId = ? AND cl.customerId <> ?`,
      [ledger.ledgerId, customerId, ledger.ledgerId, customerId],
      transaction,
    );
    if (owner) throw new BadRequestError('That ledger already belongs to the customer ' + owner.name);
  }
}

async function replaceLinkedLedgers(customerId, list, transaction) {
  const ledgers = readLinkedLedgers(list);
  await assertLinkedLedgersAreFree(customerId, ledgers, transaction);
  await x('DELETE FROM SalesCustomerLedgers WHERE customerId = ?', [customerId], transaction);
  for (const ledger of ledgers) {
    await x(
      'INSERT INTO SalesCustomerLedgers (customerId, ledgerId, kind, createdAt) VALUES (?,?,?,?)',
      [customerId, ledger.ledgerId, ledger.kind, now()],
      transaction,
    );
  }
}

async function replaceChildRows(table, customerId, rows, transaction) {
  await x(`DELETE FROM ${table} WHERE customerId = ?`, [customerId], transaction);
  for (const row of rows) {
    const columns = Object.keys(row);
    await x(
      `INSERT INTO ${table} (customerId, ${columns.join(', ')}, createdAt, updatedAt) VALUES (?, ${columns.map(() => '?').join(', ')}, ?, ?)`,
      [customerId, ...columns.map((column) => row[column]), now(), now()],
      transaction,
    );
  }
}

/** Linked ledgers, contacts and lanes - each replaced only when the form sent it. */
async function saveCustomerChildren(customerId, body, transaction) {
  if (body.ledgers !== undefined) await replaceLinkedLedgers(customerId, body.ledgers, transaction);
  if (body.contacts !== undefined)
    await replaceChildRows('SalesContacts', customerId, contactRows(body.contacts).out, transaction);
  if (body.lanes !== undefined) await replaceChildRows('SalesLanes', customerId, laneRows(body.lanes).out, transaction);
}

async function recordKamChange(customerId, oldKamId, newKamId, reason, changedBy, transaction) {
  if ((oldKamId || null) === (newKamId || null)) return;
  await x(
    "UPDATE SalesAssignments SET toDate = ? WHERE customerId = ? AND role = 'KAM' AND toDate IS NULL",
    [today(), customerId],
    transaction,
  );
  if (!newKamId) return;
  await x(
    `INSERT INTO SalesAssignments (customerId, salesPersonId, role, fromDate, toDate, reason, changedBy, createdAt)
      VALUES (?,?, 'KAM', ?, NULL, ?, ?, ?)`,
    [customerId, newKamId, today(), reason || (oldKamId ? 'KAM changed' : 'KAM given'), changedBy, now()],
    transaction,
  );
}

async function isActiveSalesPerson(personId) {
  return !!(await q('SELECT id FROM SalesPersons WHERE id = ? AND coalesce(isActive, 1) = 1', [personId]))[0];
}

async function partyOfLedger(ledgerId) {
  const [ledger] = await q('SELECT partyId FROM AccountLedgers WHERE id = ?', [ledgerId]);
  if (!ledger) throw new BadRequestError('Ledger not found');
  return ledger.partyId;
}

function applyViewerDefaults(form, salesViewer) {
  // a sales person's new customer is his own
  if (salesViewer.team && !form.kamId) form.kamId = salesViewer.me.id;
  if (!form.branchCode) {
    form.branchCode =
      (salesViewer.branches && salesViewer.branches[0]) ||
      (salesViewer.me && listOf(salesViewer.me.branchCodes)[0]) ||
      null;
  }
}

export async function createCustomer(salesViewer, body) {
  await ensure();
  const form = { ...body };
  applyViewerDefaults(form, salesViewer);
  const fields = validateCustomerForm(form);
  if (salesViewer.team && fields.kamId && !salesViewer.team.has(fields.kamId)) {
    throw new ForbiddenError('You can give a customer only to yourself or your team');
  }
  if (fields.kamId && !(await isActiveSalesPerson(fields.kamId))) {
    throw new BadRequestError('The KAM picked is not an active sales person');
  }
  const warning = await duplicateWarning(fields);
  if (warning && !form.allowDuplicate) throw duplicateConflict(warning);
  if (fields.ledgerId) {
    const partyId = await partyOfLedger(fields.ledgerId);
    if (!fields.partyId) fields.partyId = partyId || null;
  }
  if (!fields.firstContactDate) fields.firstContactDate = today();
  let customerId;
  await inTransaction(async (transaction) => {
    const columns = Object.keys(fields);
    await x(
      `INSERT INTO SalesCustomers (${columns.join(', ')}, createdBy, updatedBy, createdAt, updatedAt)
        VALUES (${columns.map(() => '?').join(', ')}, ?, ?, ?, ?)`,
      [...columns.map((column) => fields[column]), salesViewer.user, salesViewer.user, now(), now()],
      transaction,
    );
    customerId = (await q('SELECT max(id) id FROM SalesCustomers', [], transaction))[0].id;
    await recordKamChange(customerId, null, fields.kamId, 'New customer', salesViewer.user, transaction);
    await saveCustomerChildren(customerId, form, transaction);
  });
  return { success: true, id: customerId };
}

async function assertKamChangeAllowed(salesViewer, fields, current, body) {
  const kamChanged = fields.kamId !== current.kamId;
  if (kamChanged && !salesViewer.canManage)
    throw new ForbiddenError('Only a sales manager or admin can change the KAM');
  if (fields.kamId && kamChanged && !(await isActiveSalesPerson(fields.kamId))) {
    throw new BadRequestError('The KAM picked is not an active sales person');
  }
  if (kamChanged && !clean(body.kamReason) && current.kamId)
    throw new BadRequestError('Give the reason the KAM is changed');
}

export async function updateCustomer(salesViewer, customerId, body) {
  await ensure();
  const [current] = await q('SELECT * FROM SalesCustomers WHERE id = ?', [customerId]);
  if (!current || !(await viewerCanSeeCustomer(salesViewer, current.id))) throw new NotFoundError('Customer not found');
  const fields = validateCustomerForm({ ...current, ...body }, current);
  await assertKamChangeAllowed(salesViewer, fields, current, body);
  const warning = await duplicateWarning(fields, current.id);
  if (warning && !body.allowDuplicate) throw duplicateConflict(warning);
  if (fields.ledgerId && fields.ledgerId !== current.ledgerId) {
    const partyId = await partyOfLedger(fields.ledgerId);
    fields.partyId = fields.partyId || partyId || null;
  }
  await inTransaction(async (transaction) => {
    const columns = Object.keys(fields);
    await x(
      `UPDATE SalesCustomers SET ${columns.map((column) => column + ' = ?').join(', ')}, updatedBy = ?, updatedAt = ? WHERE id = ?`,
      [...columns.map((column) => fields[column]), salesViewer.user, now(), current.id],
      transaction,
    );
    await recordKamChange(
      current.id,
      current.kamId,
      fields.kamId,
      clean(body.kamReason),
      salesViewer.user,
      transaction,
    );
    await saveCustomerChildren(current.id, body, transaction);
  });
  return { success: true, id: current.id };
}

/** A prospect that never did business can be removed; anything else is marked Lost / Blocked instead. */
export async function deleteCustomer(salesViewer, customerId) {
  await ensure();
  if (!salesViewer.canManage) throw new ForbiddenError('Only a sales manager or admin can delete');
  const [customer] = await q('SELECT * FROM SalesCustomers WHERE id = ?', [customerId]);
  if (!customer) throw new NotFoundError('Not found');
  if (customer.status !== 'PROSPECT' || customer.ledgerId) {
    throw new BadRequestError('Only a prospect without a ledger can be deleted - mark this one Lost or Blocked');
  }
  await inTransaction(async (transaction) => {
    for (const table of CUSTOMER_CHILD_TABLES)
      await x(`DELETE FROM ${table} WHERE customerId = ?`, [customer.id], transaction);
    await x('DELETE FROM SalesCustomers WHERE id = ?', [customer.id], transaction);
  });
  return { success: true };
}

/** Debtor ledgers for linking / picking (only those without a profile, unless `all=1` or it is the `keep` one). */
export async function listDebtorLedgers(query) {
  await ensure();
  const groupIds = [...(await debtorGroupIds())];
  if (!groupIds.length) return { success: true, data: [] };
  const pattern =
    '%' +
    String(query.q || '')
      .trim()
      .toLowerCase() +
    '%';
  const rows = await q(
    `SELECT l.id, l.name, l.gstin, l.pan, l.state, l.address, l.pinCode, l.country, l.email, l.phone, l.contactPerson,
        l.dealingBranch, l.creditDays, l.creditLimit, l.partyId,
        coalesce((SELECT id FROM SalesCustomers c WHERE c.ledgerId = l.id), (SELECT customerId FROM SalesCustomerLedgers cl WHERE cl.ledgerId = l.id)) profileId,
        (SELECT g.name FROM AccountGroups g WHERE g.id = l.groupId) groupName
      FROM AccountLedgers l WHERE l.groupId IN (${groupIds.join(',')}) AND coalesce(l.isActive, 1) = 1
        AND (lower(l.name) LIKE ? OR lower(coalesce(l.gstin, '')) LIKE ?)
      ORDER BY l.name LIMIT ${LEDGER_PICK_LIMIT}`,
    [pattern, pattern],
  );
  const data =
    query.all === '1'
      ? rows
      : rows.filter((row) => !row.profileId || String(row.profileId) === String(query.keep || ''));
  return { success: true, data };
}

/** The sales profile and KAM of an accounts ledger (null when it has none). */
export async function kamOfLedger(ledgerId) {
  await ensure();
  const [row] = await q(
    'SELECT c.id, c.kamId, p.name FROM SalesCustomers c LEFT JOIN SalesPersons p ON p.id = c.kamId WHERE c.ledgerId = ?',
    [ledgerId],
  );
  return { success: true, data: row || null };
}

export { ensure as ensureSalesTables };
