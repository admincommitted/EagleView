import { BadRequestError, ForbiddenError } from '../../../../core/http/index.js';
import { q, x, today, clean, upper, numOrNull, SERVICES, EMAIL_RE } from '../../../../utils/common/salesHub.js';
import { ensureDealTables } from '../shared/dealTables.js';
import {
  CLOSED_ENQUIRY_STATUSES,
  assertCanSeeDeal,
  dbNow,
  dealWhere,
  modeOfService,
  nextDealNumber,
  serviceLabel,
  whereClause,
} from '../shared/dealsShared.js';

const ENQUIRY_NOT_FOUND = 'Enquiry not found';
const CONTAINERS_RE = /^(\d+\s*[Xx×*]\s*[0-9A-Z]{2,5})(\s*[,+]\s*\d+\s*[Xx×*]\s*[0-9A-Z]{2,5})*$/;
const NON_NEGATIVE_FIELDS = ['pkgs', 'grossWt', 'chargeableWt', 'cbm', 'cargoValue'];
const DEFAULT_LIST_LIMIT = 500;
const MAX_LIST_LIMIT = 3000;

function readEnquiryFields(body) {
  return {
    date: clean(body.date) || today(),
    customerId: numOrNull(body.customerId),
    contactId: numOrNull(body.contactId),
    salesPersonId: numOrNull(body.salesPersonId),
    branchCode: upper(body.branchCode),
    receivedVia: clean(body.receivedVia),
    priority: upper(body.priority) || 'NORMAL',
    serviceType: upper(body.serviceType),
    origin: upper(body.origin),
    destination: upper(body.destination),
    incoterms: upper(body.incoterms),
    readinessDate: clean(body.readinessDate),
    quoteBy: clean(body.quoteBy),
    commodity: clean(body.commodity),
    hsCode: clean(body.hsCode),
    pkgs: numOrNull(body.pkgs),
    grossWt: numOrNull(body.grossWt),
    chargeableWt: numOrNull(body.chargeableWt),
    cbm: numOrNull(body.cbm),
    containers: upper(body.containers),
    isDg: body.isDg ? 1 : 0,
    isTemp: body.isTemp ? 1 : 0,
    cargoValue: numOrNull(body.cargoValue),
    cargoCurrency: upper(body.cargoCurrency),
    frequency: clean(body.frequency),
    pickupAt: clean(body.pickupAt),
    deliveryAt: clean(body.deliveryAt),
    targetRate: clean(body.targetRate),
    competitor: clean(body.competitor),
    remarks: clean(body.remarks),
    contactPerson: clean(body.contactPerson),
    designation: clean(body.designation),
    email: clean(body.email),
    phone: clean(body.phone),
  };
}

async function loadQuotableCustomer(customerId) {
  if (!customerId) throw new BadRequestError('Pick the customer or prospect (or add a new prospect)');
  const [customer] = await q('SELECT id, name, kamId, branchCode, ledgerId, status FROM SalesCustomers WHERE id = ?', [
    customerId,
  ]);
  if (!customer) throw new BadRequestError('Customer not found');
  if (customer.status === 'BLOCKED') {
    throw new BadRequestError(
      `${customer.name} is Blocked in Sales - do not quote. Change its status first if this is cleared.`,
    );
  }
  return customer;
}

function assertRouteAndCargo(fields) {
  if (!fields.serviceType || !SERVICES.some((service) => service[0] === fields.serviceType))
    throw new BadRequestError('Pick the service');
  fields.mode = modeOfService(fields.serviceType);
  if (!/^CUSTOMS|WAREHOUSE|INSURANCE/.test(fields.serviceType) && (!fields.origin || !fields.destination)) {
    throw new BadRequestError('Give the origin and the destination');
  }
  if (fields.serviceType.startsWith('CUSTOMS') && !fields.origin)
    throw new BadRequestError('Give the port / place of clearance (origin)');
  if (fields.serviceType.endsWith('_FCL') && !fields.containers)
    throw new BadRequestError('Give the containers, e.g. 2x40HC');
  if (fields.containers && !CONTAINERS_RE.test(fields.containers)) {
    throw new BadRequestError('Containers as count x type, e.g. 2x40HC, 1x20GP');
  }
  if (fields.email && !EMAIL_RE.test(fields.email)) throw new BadRequestError(`E-mail "${fields.email}" is not valid`);
  for (const key of NON_NEGATIVE_FIELDS)
    if (fields[key] != null && fields[key] < 0) throw new BadRequestError(key + ' cannot be negative');
  if (fields.grossWt && fields.chargeableWt && fields.chargeableWt < fields.grossWt && fields.mode === 'AIR') {
    throw new BadRequestError('Chargeable weight cannot be less than the gross weight');
  }
  if (fields.quoteBy && fields.quoteBy < fields.date)
    throw new BadRequestError('"Quote by" is before the enquiry date');
}

async function applyContact(fields, customerId) {
  if (!fields.contactId) return;
  const [contact] = await q(
    'SELECT name, designation, email, mobile, phone FROM SalesContacts WHERE id = ? AND customerId = ?',
    [fields.contactId, customerId],
  );
  if (!contact) throw new BadRequestError('That contact is not of this customer');
  fields.contactPerson = contact.name;
  fields.designation = fields.designation || contact.designation;
  fields.email = fields.email || contact.email;
  fields.phone = fields.phone || contact.mobile || contact.phone;
}

/** The enquiry's columns from the form, checked; the customer's name, ledger, KAM and branch fill what is not given. */
async function enquiryFields(body, salesViewer) {
  const fields = readEnquiryFields(body);
  const customer = await loadQuotableCustomer(fields.customerId);
  fields.clientName = customer.name;
  fields.partyLedgerId = customer.ledgerId || null;
  assertRouteAndCargo(fields);
  await applyContact(fields, customer.id);
  if (!fields.salesPersonId) fields.salesPersonId = customer.kamId || (salesViewer.me && salesViewer.me.id) || null;
  if (salesViewer.team && fields.salesPersonId && !salesViewer.team.has(fields.salesPersonId)) {
    throw new ForbiddenError('You can give an enquiry only to yourself or your team');
  }
  if (!fields.branchCode)
    fields.branchCode = customer.branchCode || (salesViewer.branches && salesViewer.branches[0]) || null;
  fields.weight = fields.chargeableWt || fields.grossWt;
  fields.volume = fields.cbm;
  fields.containerType = fields.containers;
  return fields;
}

function addListFilters(query, conditions, params) {
  if (query.status) {
    conditions.push('e.status = ?');
    params.push(upper(query.status));
  }
  if (query.spId) {
    conditions.push('e.salesPersonId = ?');
    params.push(Number(query.spId));
  }
  if (query.service) {
    conditions.push('e.serviceType = ?');
    params.push(upper(query.service));
  }
  if (query.customerId) {
    conditions.push('e.customerId = ?');
    params.push(Number(query.customerId));
  }
  if (query.from) {
    conditions.push('e.date >= ?');
    params.push(query.from);
  }
  if (query.to) {
    conditions.push('e.date <= ?');
    params.push(query.to);
  }
  if (clean(query.q)) {
    const pattern = '%' + clean(query.q).toLowerCase() + '%';
    conditions.push(`(lower(e.enquiryNo) LIKE ? OR lower(e.clientName) LIKE ? OR lower(coalesce(e.origin, '')) LIKE ?
        OR lower(coalesce(e.destination, '')) LIKE ? OR lower(coalesce(e.commodity, '')) LIKE ?)`);
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
}

function withLastQuote(row, day) {
  const [quoteNo, status, sell, marginPct] = String(row.lastQuote || '').split('|');
  return {
    ...row,
    serviceLabel: serviceLabel(row.serviceType),
    late: row.status === 'OPEN' && row.quoteBy && row.quoteBy < day,
    lastQuoteNo: quoteNo || null,
    lastQuoteStatus: status || null,
    lastQuoteSell: sell ? Number(sell) : null,
    lastQuoteMarginPct: marginPct ? Number(marginPct) : null,
  };
}

export async function listEnquiries(salesViewer, query) {
  await ensureDealTables();
  const { w: conditions, p: params } = dealWhere(salesViewer, 'e');
  addListFilters(query, conditions, params);
  const limit = Math.min(Number(query.limit) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const rows = await q(
    `SELECT e.id, e.enquiryNo, e.date, e.customerId, e.clientName, e.contactPerson, e.salesPersonId, sp.name salesPerson,
        e.branchCode, e.serviceType, e.origin, e.destination, e.commodity, e.pkgs, e.grossWt, e.chargeableWt, e.cbm, e.containers,
        e.quoteBy, e.priority, e.status, e.lostReason, e.receivedVia,
        (SELECT count(*) FROM Quotations z WHERE z.leadId = e.id) quotes,
        (SELECT z.quoteNo || '|' || z.status || '|' || coalesce(z.totalSellInr, 0) || '|' || coalesce(z.marginPct, '') FROM Quotations z
          WHERE z.leadId = e.id AND z.status <> 'SUPERSEDED' ORDER BY z.id DESC LIMIT 1) lastQuote
      FROM Leads e LEFT JOIN SalesPersons sp ON sp.id = e.salesPersonId ${whereClause(conditions)}
      ORDER BY e.date DESC, e.id DESC LIMIT ?`,
    [...params, limit],
  );
  const day = today();
  return { success: true, data: rows.map((row) => withLastQuote(row, day)) };
}

export async function getEnquiry(salesViewer, enquiryId) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Leads', enquiryId, ENQUIRY_NOT_FOUND);
  const [enquiry] = await q(
    'SELECT e.*, sp.name salesPerson FROM Leads e LEFT JOIN SalesPersons sp ON sp.id = e.salesPersonId WHERE e.id = ?',
    [enquiryId],
  );
  const quotes = await q(
    `SELECT id, quoteNo, date, validUntil, status, revision, totalSellInr, totalBuyInr, marginInr, marginPct, docketNo
      FROM Quotations WHERE leadId = ? ORDER BY id DESC`,
    [enquiry.id],
  );
  return { success: true, data: { ...enquiry, serviceLabel: serviceLabel(enquiry.serviceType), quotes } };
}

export async function createEnquiry(salesViewer, body) {
  await ensureDealTables();
  const fields = await enquiryFields(body || {}, salesViewer);
  const enquiryNo = await nextDealNumber('Leads', 'enquiryNo', 'ENQ');
  const columns = Object.keys(fields);
  await x(
    `INSERT INTO Leads (enquiryNo, status, ${columns.join(', ')}, createdByName, updatedBy, createdAt, updatedAt)
      VALUES (?, 'OPEN', ${columns.map(() => '?').join(', ')}, ?, ?, ?, ?)`,
    [enquiryNo, ...columns.map((column) => fields[column]), salesViewer.user, salesViewer.user, dbNow(), dbNow()],
  );
  const id = (await q('SELECT id FROM Leads WHERE enquiryNo = ?', [enquiryNo]))[0].id;
  return { success: true, id, enquiryNo };
}

export async function updateEnquiry(salesViewer, enquiryId, body) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Leads', enquiryId, ENQUIRY_NOT_FOUND);
  const [enquiry] = await q('SELECT * FROM Leads WHERE id = ?', [enquiryId]);
  if (CLOSED_ENQUIRY_STATUSES.includes(enquiry.status)) {
    throw new BadRequestError(
      `Enquiry ${enquiry.enquiryNo} is ${enquiry.status.toLowerCase()} - reopen it to change it`,
    );
  }
  const fields = await enquiryFields(body || {}, salesViewer);
  const columns = Object.keys(fields);
  await x(
    `UPDATE Leads SET ${columns.map((column) => column + ' = ?').join(', ')}, updatedBy = ?, updatedAt = ? WHERE id = ?`,
    [...columns.map((column) => fields[column]), salesViewer.user, dbNow(), enquiry.id],
  );
  return { success: true };
}

async function reopenEnquiry(enquiry, salesViewer) {
  const openQuotes = (
    await q("SELECT count(*) n FROM Quotations WHERE leadId = ? AND status IN ('DRAFT', 'SENT')", [enquiry.id])
  )[0].n;
  await x(
    'UPDATE Leads SET status = ?, lostReason = NULL, lostTo = NULL, closedAt = NULL, updatedBy = ?, updatedAt = ? WHERE id = ?',
    [openQuotes ? 'QUOTED' : 'OPEN', salesViewer.user, dbNow(), enquiry.id],
  );
}

// a lost / dropped enquiry takes its open quotations with it
async function closeEnquiry(enquiry, status, body, salesViewer) {
  const reason = clean(body.reason);
  if (!reason) throw new BadRequestError('Give the reason');
  await x(
    'UPDATE Leads SET status = ?, lostReason = ?, lostTo = ?, closedAt = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
    [status, reason, clean(body.lostTo), today(), salesViewer.user, dbNow(), enquiry.id],
  );
  await x(
    `UPDATE Quotations SET status = 'LOST', rejectReason = ?, lostTo = ?, decidedAt = ?, updatedAt = ?
      WHERE leadId = ? AND status IN ('DRAFT', 'SENT')`,
    [reason, clean(body.lostTo), dbNow(), dbNow(), enquiry.id],
  );
}

/** Close (lost / dropped) or reopen an enquiry. */
export async function setEnquiryStatus(salesViewer, enquiryId, body) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Leads', enquiryId, ENQUIRY_NOT_FOUND);
  const [enquiry] = await q('SELECT * FROM Leads WHERE id = ?', [enquiryId]);
  const status = upper(body.status);
  if (status === 'OPEN') await reopenEnquiry(enquiry, salesViewer);
  else if (status === 'LOST' || status === 'DROPPED') await closeEnquiry(enquiry, status, body, salesViewer);
  else throw new BadRequestError('Status must be OPEN, LOST or DROPPED');
  return { success: true };
}

export async function deleteEnquiry(salesViewer, enquiryId) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Leads', enquiryId, ENQUIRY_NOT_FOUND);
  const quoteCount = (await q('SELECT count(*) n FROM Quotations WHERE leadId = ?', [enquiryId]))[0].n;
  if (quoteCount)
    throw new BadRequestError('This enquiry has quotations - mark it Lost / Dropped instead of deleting it');
  await x('DELETE FROM Leads WHERE id = ?', [enquiryId]);
  return { success: true };
}
