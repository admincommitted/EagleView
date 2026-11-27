import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../../../core/http/index.js';
import {
  q,
  x,
  now,
  today,
  ensure,
  clean,
  upper,
  numOrNull,
  listOf,
  csv,
  nameKey,
  personByName,
  debtorGroupIds,
  groupInfo,
  SP_ROLES,
  EMAIL_RE,
} from '../../../../utils/common/salesHub.js';
import { inTransaction, personHasNameKey, queryOrEmpty } from '../../shared/salesHelpers.js';

const MOBILE_RE = /^\+?[0-9 -]{10,15}$/;
const PERSON_CODE_RE = /^SP(\d+)$/;
const MAX_REPORTING_DEPTH = 50;
const MARKETING_PERSON_COLUMNS = ['marketingPerson1', 'marketingPerson2', 'marketingPerson3'];

function assertCanManage(salesViewer, message) {
  if (!salesViewer.canManage) throw new ForbiddenError(message);
}

async function customerCountsByKam() {
  const rows = await q(
    "SELECT kamId, count(*) n, sum(CASE WHEN status = 'PROSPECT' THEN 1 ELSE 0 END) prospects FROM SalesCustomers GROUP BY kamId",
  );
  return new Map(rows.map((row) => [row.kamId, row]));
}

export async function listSalesPersons() {
  await ensure();
  const rows = await q(`SELECT p.*, r.name reportingToName, u.username loginName, u.email loginEmail
      FROM SalesPersons p LEFT JOIN SalesPersons r ON r.id = p.reportingToId
      LEFT JOIN Users u ON u.id = p.userId ORDER BY coalesce(p.isActive, 1) DESC, p.name`);
  const counts = await customerCountsByKam();
  const data = rows.map((row) => {
    const personCounts = counts.get(row.id) || {};
    return { ...row, customers: personCounts.n || 0, prospects: personCounts.prospects || 0 };
  });
  return { success: true, data };
}

/** Active logins a sales person can be linked to. */
export async function listLoginUsers() {
  const data = await q(`SELECT id, username, fullName, email, contactNumber, designation, department, branch FROM Users
      WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY coalesce(fullName, username)`);
  return { success: true, data };
}

const isSwitchedOff = (value) => value === false || value === 0 || value === '0';

function readPersonFields(body) {
  const fields = {
    name: clean(body.name),
    code: upper(body.code),
    userId: numOrNull(body.userId),
    mobile: clean(body.mobile),
    phone: clean(body.phone),
    email: clean(body.email),
    whatsapp: clean(body.whatsapp),
    designation: clean(body.designation),
    role: upper(body.role) || 'EXECUTIVE',
    reportingToId: numOrNull(body.reportingToId),
    branchCodes: csv(listOf(body.branchCodes).map((code) => code.toUpperCase())),
    services: csv(body.services),
    aliases: csv(body.aliases),
    joinDate: clean(body.joinDate),
    leaveDate: clean(body.leaveDate),
    isActive: isSwitchedOff(body.isActive) ? 0 : 1,
    remarks: clean(body.remarks),
  };
  if (!fields.name) throw new BadRequestError('Name is required');
  if (!SP_ROLES.some((role) => role[0] === fields.role)) {
    throw new BadRequestError('Role must be one of ' + SP_ROLES.map((role) => role[1]).join(', '));
  }
  if (fields.email && !EMAIL_RE.test(fields.email)) throw new BadRequestError(`E-mail "${fields.email}" is not valid`);
  for (const key of ['mobile', 'whatsapp']) {
    if (fields[key] && !MOBILE_RE.test(fields[key])) {
      throw new BadRequestError(`${key === 'mobile' ? 'Mobile' : 'WhatsApp'} "${fields[key]}" must be 10 to 15 digits`);
    }
  }
  if (fields.joinDate && fields.leaveDate && fields.leaveDate < fields.joinDate) {
    throw new BadRequestError('Leaving date is before the joining date');
  }
  if (fields.leaveDate && fields.leaveDate <= today()) fields.isActive = 0;
  return fields;
}

async function assertNoReportingLoop(reportingToId, personId) {
  if (personId && reportingToId === Number(personId))
    throw new BadRequestError('A sales person cannot report to himself');
  const persons = await q('SELECT id, reportingToId FROM SalesPersons');
  const managerOf = new Map(persons.map((person) => [person.id, person.reportingToId]));
  let current = reportingToId;
  for (let step = 0; step < MAX_REPORTING_DEPTH && current; step++) {
    if (personId && current === Number(personId)) throw new BadRequestError('This reporting line makes a loop');
    current = managerOf.get(current);
  }
}

// the same name / alias must not belong to two persons (iCAFFE names are matched by it)
async function assertNamesAreFree(fields, personId) {
  const others = await q('SELECT id, name, aliases FROM SalesPersons WHERE id <> ?', [personId || 0]);
  for (const name of [fields.name, ...listOf(fields.aliases)]) {
    const key = nameKey(name);
    const owner = others.find((person) => personHasNameKey(person, key));
    if (owner) throw new BadRequestError(`"${name}" is already the name / alias of ${owner.name}`);
  }
}

async function assertPersonIsUnique(fields, personId) {
  const otherId = personId || 0;
  if (
    (await q('SELECT id FROM SalesPersons WHERE upper(name) = ? AND id <> ?', [fields.name.toUpperCase(), otherId]))[0]
  ) {
    throw new BadRequestError(`A sales person named "${fields.name}" already exists`);
  }
  if (fields.code && (await q('SELECT id FROM SalesPersons WHERE code = ? AND id <> ?', [fields.code, otherId]))[0]) {
    throw new BadRequestError(`Code ${fields.code} is already used`);
  }
  if (
    fields.userId &&
    (await q('SELECT id, name FROM SalesPersons WHERE userId = ? AND id <> ?', [fields.userId, otherId]))[0]
  ) {
    throw new BadRequestError('That login is already linked to another sales person');
  }
  if (fields.reportingToId) await assertNoReportingLoop(fields.reportingToId, personId);
  await assertNamesAreFree(fields, personId);
}

async function nextPersonCode() {
  const rows = await q("SELECT code FROM SalesPersons WHERE code LIKE 'SP%'");
  let highest = 0;
  rows.forEach((row) => {
    const match = PERSON_CODE_RE.exec(row.code || '');
    if (match) highest = Math.max(highest, Number(match[1]));
  });
  return 'SP' + String(highest + 1).padStart(3, '0');
}

async function loginNameOf(userId) {
  const [user] = await q('SELECT username FROM Users WHERE id = ?', [userId]);
  if (!user) throw new BadRequestError('Login not found');
  return user.username;
}

export async function createSalesPerson(salesViewer, body) {
  await ensure();
  assertCanManage(salesViewer, 'Only a sales manager or admin can add sales persons');
  const fields = readPersonFields(body || {});
  if (!fields.code) fields.code = await nextPersonCode();
  await assertPersonIsUnique(fields);
  if (fields.userId) fields.username = await loginNameOf(fields.userId);
  const columns = Object.keys(fields);
  await x(
    `INSERT INTO SalesPersons (${columns.join(', ')}, createdBy, updatedBy, createdAt, updatedAt)
      VALUES (${columns.map(() => '?').join(', ')}, ?, ?, ?, ?)`,
    [...columns.map((column) => fields[column]), salesViewer.user, salesViewer.user, now(), now()],
  );
  const [row] = await q('SELECT * FROM SalesPersons WHERE code = ?', [fields.code]);
  return { success: true, data: row };
}

// a person who leaves while still KAM of customers: the screen asks to move them first
async function assertLeaverHasNoCustomers(current, body) {
  const openCustomers = (
    await q("SELECT count(*) n FROM SalesCustomers WHERE kamId = ? AND status NOT IN ('LOST', 'BLOCKED')", [current.id])
  )[0].n;
  if (!openCustomers || body.allowWithCustomers) return;
  const message = `${current.name} is still the KAM of ${openCustomers} customer(s) - move them to another sales person first`;
  throw new ConflictError(message, {
    body: { success: false, needsMove: true, customers: openCustomers, error: message },
  });
}

export async function updateSalesPerson(salesViewer, personId, body) {
  await ensure();
  assertCanManage(salesViewer, 'Only a sales manager or admin can change sales persons');
  const [current] = await q('SELECT * FROM SalesPersons WHERE id = ?', [personId]);
  if (!current) throw new NotFoundError('Sales person not found');
  const fields = readPersonFields({ ...current, ...body });
  if (!fields.code) fields.code = current.code || (await nextPersonCode());
  await assertPersonIsUnique(fields, current.id);
  fields.username = null;
  if (fields.userId) fields.username = await loginNameOf(fields.userId);
  if (!fields.isActive && current.isActive !== 0) await assertLeaverHasNoCustomers(current, body);
  const columns = Object.keys(fields);
  await x(
    `UPDATE SalesPersons SET ${columns.map((column) => column + ' = ?').join(', ')}, updatedBy = ?, updatedAt = ? WHERE id = ?`,
    [...columns.map((column) => fields[column]), salesViewer.user, now(), current.id],
  );
  return { success: true, data: (await q('SELECT * FROM SalesPersons WHERE id = ?', [current.id]))[0] };
}

async function moveKamOfCustomer(customerId, toPersonId, fromDate, reason, changedBy, transaction) {
  await x(
    "UPDATE SalesAssignments SET toDate = ? WHERE customerId = ? AND role = 'KAM' AND toDate IS NULL",
    [fromDate, customerId],
    transaction,
  );
  await x(
    `INSERT INTO SalesAssignments (customerId, salesPersonId, role, fromDate, toDate, reason, changedBy, createdAt)
      VALUES (?,?, 'KAM', ?, NULL, ?, ?, ?)`,
    [customerId, toPersonId, fromDate, reason, changedBy, now()],
    transaction,
  );
  await x(
    'UPDATE SalesCustomers SET kamId = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
    [toPersonId, changedBy, now(), customerId],
    transaction,
  );
}

/** Moves all open customers of one sales person to another (leaving / re-allocation), keeping the KAM history. */
export async function moveCustomersToPerson(salesViewer, fromPersonId, body) {
  await ensure();
  assertCanManage(salesViewer, 'Only a sales manager or admin can move customers');
  const fromId = Number(fromPersonId);
  const toId = numOrNull(body.toId);
  if (!toId || toId === fromId) throw new BadRequestError('Pick the sales person who takes the customers');
  const [target] = await q('SELECT id, name, isActive FROM SalesPersons WHERE id = ?', [toId]);
  if (!target || target.isActive === 0) throw new BadRequestError('That sales person is not active');
  const reason = clean(body.reason) || 'Customers moved';
  const customerIds = (
    await q("SELECT id FROM SalesCustomers WHERE kamId = ? AND status NOT IN ('LOST', 'BLOCKED')", [fromId])
  ).map((row) => row.id);
  const fromDate = clean(body.fromDate) || today();
  await inTransaction(async (transaction) => {
    for (const customerId of customerIds) {
      await moveKamOfCustomer(customerId, toId, fromDate, reason, salesViewer.user, transaction);
    }
  });
  return { success: true, moved: customerIds.length, to: target.name };
}

// an iCAFFE name in capitals is saved as "Deepak Kumar"; the name as written stays as an alias
const displayNameOf = (name) =>
  name === name.toUpperCase() ? name.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()) : name;

/** Adds several iCAFFE names as sales persons at once; a name that already is a sales person is skipped. */
export async function addPersonsFromNames(salesViewer, body) {
  await ensure();
  assertCanManage(salesViewer, 'Only a sales manager or admin can add sales persons');
  const names = listOf(body.names)
    .map((name) => name.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!names.length) throw new BadRequestError('Pick the names to add');
  const added = [];
  const skipped = [];
  for (const writtenName of names) {
    if (await personByName(writtenName)) {
      skipped.push(writtenName);
      continue;
    }
    const name = displayNameOf(writtenName);
    const code = await nextPersonCode();
    await x(
      `INSERT INTO SalesPersons (code, name, role, branchCodes, aliases, isActive, remarks, createdBy, updatedBy, createdAt, updatedAt)
        VALUES (?, ?, 'EXECUTIVE', ?, ?, 1, ?, ?, ?, ?, ?)`,
      [
        code,
        name,
        csv(body.branchCodes) || null,
        name !== writtenName ? writtenName : null,
        'Added from the names in iCAFFE',
        salesViewer.user,
        salesViewer.user,
        now(),
        now(),
      ],
    );
    added.push(name);
  }
  return { success: true, added, skipped };
}

async function docketMarketingNames() {
  const rows = await queryOrEmpty(`SELECT marketingPerson n, count(*) c, max(docketDate) last FROM Shipments
      WHERE trim(coalesce(marketingPerson, '')) <> '' GROUP BY upper(trim(marketingPerson))`);
  return rows.map((row) => ({ name: row.n.trim(), dockets: row.c, parties: 0, last: row.last }));
}

async function partyMarketingNames() {
  const names = [];
  for (const column of MARKETING_PERSON_COLUMNS) {
    const rows = await queryOrEmpty(`SELECT ${column} n, count(*) c FROM Parties
        WHERE trim(coalesce(${column}, '')) <> '' GROUP BY upper(trim(${column}))`);
    rows.forEach((row) => names.push({ name: row.n.trim(), dockets: 0, parties: row.c, last: null }));
  }
  return names;
}

// iCAFFE debtor groups named after a sales person ("SUNDRY DEBTORS (DEEPAK KUMAR)")
async function debtorGroupPersonNames() {
  const groupIds = [...(await debtorGroupIds())];
  if (!groupIds.length) return [];
  const groups = await q(`SELECT g.id, g.name, (SELECT count(*) FROM AccountLedgers l WHERE l.groupId = g.id) n
      FROM AccountGroups g WHERE g.id IN (${groupIds.join(',')})`);
  const names = [];
  for (const group of groups) {
    const info = groupInfo(group.name);
    if (info.person)
      names.push({ name: info.person, dockets: 0, parties: 0, ledgers: group.n, group: group.name, last: null });
  }
  return names;
}

function mergeNameSources(sources, persons) {
  const byKey = new Map();
  for (const source of sources) {
    const key = nameKey(source.name);
    if (!key) continue;
    const match = persons.find((person) => personHasNameKey(person, key));
    const entry = byKey.get(key) || {
      name: source.name,
      dockets: 0,
      parties: 0,
      ledgers: 0,
      groups: [],
      last: null,
      matchedTo: match ? match.name : null,
      matchedId: match ? match.id : null,
    };
    entry.dockets += source.dockets;
    entry.parties += source.parties;
    entry.ledgers += source.ledgers || 0;
    if (source.group) entry.groups.push(source.group);
    if (source.last && (!entry.last || source.last > entry.last)) entry.last = source.last;
    byKey.set(key, entry);
  }
  return [...byKey.values()];
}

const unmatchedFirst = (a, b) =>
  (a.matchedTo ? 1 : 0) - (b.matchedTo ? 1 : 0) || b.dockets - a.dockets || a.name.localeCompare(b.name);

/** Names written in iCAFFE (docket marketing person, party marketing person 1-3, debtor groups) and who they match. */
export async function listUnmatchedNames() {
  await ensure();
  const sources = [
    ...(await docketMarketingNames()),
    ...(await partyMarketingNames()),
    ...(await debtorGroupPersonNames()),
  ];
  const persons = await q('SELECT id, name, aliases FROM SalesPersons');
  return { success: true, data: mergeNameSources(sources, persons).sort(unmatchedFirst) };
}
