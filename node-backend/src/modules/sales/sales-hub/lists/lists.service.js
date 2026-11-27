import { ForbiddenError, NotFoundError, BadRequestError } from '../../../../core/http/index.js';
import {
  q,
  x,
  now,
  ensure,
  clean,
  upper,
  numOrNull,
  CUSTOMER_STATUS,
  CUSTOMER_TYPES,
  SEGMENTS,
  SERVICES,
  VOLUME_UNITS,
  INCOTERMS,
  CONTAINER_TYPES,
  SP_ROLES,
  TURNOVER,
  CREDIT_TERMS,
  LOOKUP_KINDS,
} from '../../../../utils/common/salesHub.js';
import { queryOrEmpty } from '../../shared/salesHelpers.js';

const ONLY_MANAGERS_CHANGE_LISTS = 'Only a sales manager or admin can change the lists';

function groupLookupsByKind(rows) {
  const lookups = {};
  for (const row of rows) (lookups[row.kind] = lookups[row.kind] || []).push(row);
  return lookups;
}

const viewerSummary = (salesViewer) =>
  salesViewer.me ? { id: salesViewer.me.id, name: salesViewer.me.name, role: salesViewer.me.role } : null;

/** Every fixed and editable list the sales screens use, plus who is looking. */
export async function getSalesMeta(salesViewer) {
  const lookupRows = await q(
    'SELECT id, kind, value, sortOrder, isActive FROM SalesLookups ORDER BY kind, sortOrder, value',
  );
  const persons = await q(
    'SELECT id, code, name, role, reportingToId, branchCodes, isActive, userId FROM SalesPersons ORDER BY isActive DESC, name',
  );
  const branches = await queryOrEmpty(
    "SELECT branchCode code, branchName name FROM CompanyBranches WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, branchCode",
  );
  const countries = await queryOrEmpty('SELECT code, name FROM Countries ORDER BY name');
  const currencies = await queryOrEmpty('SELECT currencyCode code FROM Currencies ORDER BY currencyCode');
  return {
    success: true,
    statuses: CUSTOMER_STATUS,
    customerTypes: CUSTOMER_TYPES,
    segments: SEGMENTS,
    services: SERVICES,
    volumeUnits: VOLUME_UNITS,
    incoterms: INCOTERMS,
    containerTypes: CONTAINER_TYPES,
    roles: SP_ROLES,
    turnover: TURNOVER,
    creditTerms: CREDIT_TERMS,
    lookupKinds: Object.keys(LOOKUP_KINDS),
    lookups: groupLookupsByKind(lookupRows),
    persons,
    branches,
    countries,
    currencies: currencies.map((currency) => currency.code),
    me: viewerSummary(salesViewer),
    isAdmin: salesViewer.isAdmin,
    canManage: salesViewer.canManage,
  };
}

function assertCanChangeLists(salesViewer) {
  if (!salesViewer.canManage) throw new ForbiddenError(ONLY_MANAGERS_CHANGE_LISTS);
}

/** Adds a value to one of the editable lists (industries, sources, competitors, lost reasons, departments, commodities). */
export async function addLookupValue(salesViewer, body) {
  await ensure();
  assertCanChangeLists(salesViewer);
  const kind = upper(body.kind);
  const value = clean(body.value);
  if (!LOOKUP_KINDS[kind]) throw new BadRequestError('Unknown list ' + kind);
  if (!value) throw new BadRequestError('Type the value');
  const [duplicate] = await q('SELECT id FROM SalesLookups WHERE kind = ? AND upper(value) = ?', [
    kind,
    value.toUpperCase(),
  ]);
  if (duplicate) throw new BadRequestError(`"${value}" is already in the list`);
  const lastSortOrder = (await q('SELECT max(sortOrder) m FROM SalesLookups WHERE kind = ?', [kind]))[0].m || 0;
  await x('INSERT INTO SalesLookups (kind, value, sortOrder, isActive, createdAt, updatedAt) VALUES (?,?,?,1,?,?)', [
    kind,
    value,
    lastSortOrder + 1,
    now(),
    now(),
  ]);
  return { success: true };
}

export async function updateLookupValue(salesViewer, lookupId, body) {
  await ensure();
  assertCanChangeLists(salesViewer);
  const [lookup] = await q('SELECT * FROM SalesLookups WHERE id = ?', [lookupId]);
  if (!lookup) throw new NotFoundError('Not found');
  const value = body.value !== undefined ? clean(body.value) : lookup.value;
  if (!value) throw new BadRequestError('Type the value');
  const isActive = body.isActive === undefined ? lookup.isActive : body.isActive ? 1 : 0;
  await x('UPDATE SalesLookups SET value = ?, isActive = ?, sortOrder = ?, updatedAt = ? WHERE id = ?', [
    value,
    isActive,
    numOrNull(body.sortOrder) ?? lookup.sortOrder,
    now(),
    lookup.id,
  ]);
  return { success: true };
}
