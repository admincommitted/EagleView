import { BadRequestError, ConflictError, ForbiddenError } from '../../../../core/http/index.js';
import { q, x, today, clean, upper, numOrNull, EMAIL_RE } from '../../../../utils/common/salesHub.js';
import { sendMail } from '../../../../utils/integrations/mailer.js';
import { htmlToPdf } from '../../../account/gst-invoice/gstInvoice.service.js';
import { addDays, inTransaction, queryOrEmpty } from '../../shared/salesHelpers.js';
import { ensureDealTables } from '../shared/dealTables.js';
import {
  CLOSED_ENQUIRY_STATUSES,
  DEFAULT_TERMS,
  assertCanSeeDeal,
  dbNow,
  dealWhere,
  modeOfService,
  nextDealNumber,
  serviceLabel,
  whereClause,
} from '../shared/dealsShared.js';
import { saveQuotationLines } from './quotationPricing.js';

const QUOTATION_NOT_FOUND = 'Quotation not found';
const VALID_FOR_DAYS = 15;
const DEFAULT_LIST_LIMIT = 500;
const MAX_LIST_LIMIT = 3000;
const COPY_CANDIDATES_LIMIT = 40;
const ADDRESS_SEPARATORS = /[;,\s]+/;
// columns a revision does not copy from the quotation it revises
const COLUMNS_NOT_COPIED_TO_REVISION = [
  'id',
  'quoteNo',
  'status',
  'revision',
  'parentId',
  'rootNo',
  'sentAt',
  'sentTo',
  'decidedAt',
  'rejectReason',
  'wonAt',
  'lostTo',
  'lostRate',
  'docketNo',
  'jobNo',
  'createdAt',
  'updatedAt',
  'date',
  'validUntil',
  'createdByName',
  'updatedBy',
];
const CHARGE_COLUMNS_NOT_COPIED = ['id', 'quotationId', 'createdAt', 'updatedAt'];

const statusText = (status) => String(status).toLowerCase();
const fromBodyOrBase = (bodyValue, baseValue) => bodyValue ?? baseValue ?? null;

async function loadQuotation(quotationId) {
  return (await q('SELECT * FROM Quotations WHERE id = ?', [quotationId]))[0];
}

/** The quotation head from the form, falling back to what the enquiry / the quotation being changed already has. */
function quoteHead(body, base) {
  const head = {
    date: clean(body.date) || base.date || today(),
    validUntil: clean(body.validUntil) || base.validUntil,
    contactId: fromBodyOrBase(numOrNull(body.contactId), base.contactId),
    contactPerson: fromBodyOrBase(clean(body.contactPerson), base.contactPerson),
    email: fromBodyOrBase(clean(body.email), base.email),
    salesPersonId: fromBodyOrBase(numOrNull(body.salesPersonId), base.salesPersonId),
    serviceType: upper(body.serviceType) || base.serviceType,
    origin: upper(body.origin) || base.origin,
    destination: upper(body.destination) || base.destination,
    incoterms: fromBodyOrBase(upper(body.incoterms), base.incoterms),
    commodity: fromBodyOrBase(clean(body.commodity), base.commodity),
    quoteCurrency: upper(body.quoteCurrency) || base.quoteCurrency || 'INR',
    pkgs: fromBodyOrBase(numOrNull(body.pkgs), base.pkgs),
    grossWt: fromBodyOrBase(numOrNull(body.grossWt), base.grossWt),
    chargeableWt: fromBodyOrBase(numOrNull(body.chargeableWt), base.chargeableWt),
    cbm: fromBodyOrBase(numOrNull(body.cbm), base.cbm),
    containers: fromBodyOrBase(upper(body.containers), base.containers),
    cargoValue: fromBodyOrBase(numOrNull(body.cargoValue), base.cargoValue),
    cargoCurrency: fromBodyOrBase(upper(body.cargoCurrency), base.cargoCurrency),
    carrier: fromBodyOrBase(clean(body.carrier), base.carrier),
    routing: fromBodyOrBase(clean(body.routing), base.routing),
    transitTime: fromBodyOrBase(clean(body.transitTime), base.transitTime),
    frequency: fromBodyOrBase(clean(body.frequency), base.frequency),
    terms: body.terms !== undefined ? clean(body.terms) : (base.terms ?? DEFAULT_TERMS),
    remarks: body.remarks !== undefined ? clean(body.remarks) : (base.remarks ?? null),
  };
  head.mode = modeOfService(head.serviceType);
  if (!head.validUntil) head.validUntil = addDays(head.date, VALID_FOR_DAYS);
  if (head.validUntil < head.date) throw new BadRequestError('"Valid until" is before the quotation date');
  if (head.email && !EMAIL_RE.test(head.email)) throw new BadRequestError(`E-mail "${head.email}" is not valid`);
  return head;
}

function addListFilters(query, conditions, params, day) {
  if (query.status === 'EXPIRED') {
    conditions.push("e.status = 'SENT' AND e.validUntil < ?");
    params.push(day);
  } else if (query.status) {
    conditions.push('e.status = ?');
    params.push(upper(query.status));
  } else {
    conditions.push("e.status <> 'SUPERSEDED'");
  }
  if (query.spId) {
    conditions.push('e.salesPersonId = ?');
    params.push(Number(query.spId));
  }
  if (query.service) {
    conditions.push('e.serviceType = ?');
    params.push(upper(query.service));
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
    conditions.push(`(lower(e.quoteNo) LIKE ? OR lower(e.clientName) LIKE ? OR lower(coalesce(e.origin, '')) LIKE ?
        OR lower(coalesce(e.destination, '')) LIKE ? OR lower(coalesce(e.docketNo, '')) LIKE ?)`);
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
}

export async function listQuotations(salesViewer, query) {
  await ensureDealTables();
  const { w: conditions, p: params } = dealWhere(salesViewer, 'e');
  const day = today();
  addListFilters(query, conditions, params, day);
  const limit = Math.min(Number(query.limit) || DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
  const rows = await q(
    `SELECT e.id, e.quoteNo, e.revision, e.date, e.validUntil, e.leadId, l.enquiryNo, e.customerId, e.clientName,
        e.salesPersonId, sp.name salesPerson, e.serviceType, e.origin, e.destination, e.commodity, e.status, e.totalSellInr, e.totalBuyInr,
        e.marginInr, e.marginPct, e.sentAt, e.sentTo, e.docketNo, e.rejectReason
      FROM Quotations e LEFT JOIN Leads l ON l.id = e.leadId LEFT JOIN SalesPersons sp ON sp.id = e.salesPersonId ${whereClause(conditions)}
      ORDER BY e.date DESC, e.id DESC LIMIT ?`,
    [...params, limit],
  );
  const data = rows.map((row) => ({
    ...row,
    serviceLabel: serviceLabel(row.serviceType),
    expired: row.status === 'SENT' && row.validUntil && row.validUntil < day,
  }));
  return { success: true, data };
}

// the branch that quotes (its address / GSTIN go on the print when it has them)
async function quotingBranch(branchCode) {
  const [branch] = await queryOrEmpty(
    `SELECT branchCode, branchName, address, gstin, phone, email FROM CompanyBranches
      WHERE upper(branchCode) = upper(?) OR (? IS NULL AND isDefault = 1) ORDER BY isDefault DESC LIMIT 1`,
    [branchCode || '', branchCode || null],
  );
  return branch || null;
}

async function fullQuotation(quotationId) {
  const [head] = await q(
    `SELECT e.*, sp.name salesPerson, sp.mobile spMobile, sp.email spEmail, sp.designation spDesignation, l.enquiryNo,
        c.address custAddress, c.city custCity, c.state custState, c.gstin custGstin
      FROM Quotations e LEFT JOIN SalesPersons sp ON sp.id = e.salesPersonId LEFT JOIN Leads l ON l.id = e.leadId
      LEFT JOIN SalesCustomers c ON c.id = e.customerId WHERE e.id = ?`,
    [quotationId],
  );
  if (!head) return null;
  const lines = await q('SELECT * FROM QuotationCharges WHERE quotationId = ? ORDER BY sortOrder, id', [quotationId]);
  const revisions = head.rootNo
    ? await q('SELECT id, quoteNo, revision, status, date FROM Quotations WHERE rootNo = ? ORDER BY revision', [
        head.rootNo,
      ])
    : [];
  const branch = await quotingBranch(head.branchCode);
  return {
    ...head,
    serviceLabel: serviceLabel(head.serviceType),
    lines,
    revisions,
    branch,
    expired: head.status === 'SENT' && head.validUntil && head.validUntil < today(),
  };
}

export async function getQuotation(salesViewer, quotationId) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  return { success: true, data: await fullQuotation(quotationId) };
}

async function linesToCopy(salesViewer, copyFromId) {
  await assertCanSeeDeal(salesViewer, 'Quotations', copyFromId, 'Quotation to copy not found');
  const lines = await q('SELECT * FROM QuotationCharges WHERE quotationId = ? ORDER BY sortOrder, id', [copyFromId]);
  return lines.map((line) => ({ ...line, autoQty: true }));
}

/** A new quotation from an enquiry (optionally with the charges of another quotation). */
export async function createQuotation(salesViewer, body) {
  await ensureDealTables();
  const form = body || {};
  const enquiryId = numOrNull(form.enquiryId);
  if (!enquiryId) throw new BadRequestError('A quotation is made from an enquiry');
  await assertCanSeeDeal(salesViewer, 'Leads', enquiryId, 'Enquiry not found');
  const [enquiry] = await q('SELECT * FROM Leads WHERE id = ?', [enquiryId]);
  if (CLOSED_ENQUIRY_STATUSES.includes(enquiry.status)) {
    throw new BadRequestError(`Enquiry ${enquiry.enquiryNo} is ${statusText(enquiry.status)} - reopen it first`);
  }
  const lines = numOrNull(form.copyFromId) ? await linesToCopy(salesViewer, form.copyFromId) : form.lines || [];
  const head = quoteHead(form, enquiry);
  const quoteNo = await nextDealNumber('Quotations', 'quoteNo', 'QT');
  let id;
  await inTransaction(async (transaction) => {
    const columns = Object.keys(head);
    await x(
      `INSERT INTO Quotations (quoteNo, rootNo, revision, leadId, customerId, partyLedgerId, clientName, branchCode, status, ${columns.join(', ')},
          createdByName, updatedBy, createdAt, updatedAt)
        VALUES (?, ?, 0, ?, ?, ?, ?, ?, 'DRAFT', ${columns.map(() => '?').join(', ')}, ?, ?, ?, ?)`,
      [
        quoteNo,
        quoteNo,
        enquiry.id,
        enquiry.customerId,
        enquiry.partyLedgerId,
        enquiry.clientName,
        enquiry.branchCode,
        ...columns.map((column) => head[column]),
        salesViewer.user,
        salesViewer.user,
        dbNow(),
        dbNow(),
      ],
      transaction,
    );
    id = (await q('SELECT id FROM Quotations WHERE quoteNo = ?', [quoteNo], transaction))[0].id;
    await saveQuotationLines(id, head, lines, transaction);
    if (enquiry.status === 'OPEN') {
      await x("UPDATE Leads SET status = 'QUOTED', updatedAt = ? WHERE id = ?", [dbNow(), enquiry.id], transaction);
    }
  });
  return { success: true, id, quoteNo };
}

export async function updateQuotation(salesViewer, quotationId, body) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const quotation = await loadQuotation(quotationId);
  if (quotation.status !== 'DRAFT') {
    throw new BadRequestError(
      `Quotation ${quotation.quoteNo} is ${statusText(quotation.status)} - use Revise to change a quotation already sent`,
    );
  }
  const form = body || {};
  const head = quoteHead(form, quotation);
  if (head.salesPersonId && salesViewer.team && !salesViewer.team.has(head.salesPersonId)) {
    throw new ForbiddenError('You can give a quotation only to yourself or your team');
  }
  let totals;
  await inTransaction(async (transaction) => {
    const columns = Object.keys(head);
    await x(
      `UPDATE Quotations SET ${columns.map((column) => column + ' = ?').join(', ')}, updatedBy = ?, updatedAt = ? WHERE id = ?`,
      [...columns.map((column) => head[column]), salesViewer.user, dbNow(), quotation.id],
      transaction,
    );
    totals = await saveQuotationLines(quotation.id, head, form.lines || [], transaction);
  });
  return { success: true, ...totals };
}

async function copiedColumns(table, excluded, transaction) {
  return (await q(`PRAGMA table_info(${table})`, [], transaction))
    .map((column) => column.name)
    .filter((column) => !excluded.includes(column));
}

async function insertRevision(original, quoteNo, revision, rootNo, salesViewer, transaction) {
  const columns = await copiedColumns('Quotations', COLUMNS_NOT_COPIED_TO_REVISION, transaction);
  await x(
    `INSERT INTO Quotations (quoteNo, status, revision, parentId, rootNo, date, validUntil, createdByName, updatedBy, createdAt, updatedAt,
        ${columns.join(', ')})
      SELECT ?, 'DRAFT', ?, id, ?, ?, ?, ?, ?, ?, ?, ${columns.join(', ')} FROM Quotations WHERE id = ?`,
    [
      quoteNo,
      revision,
      rootNo,
      today(),
      addDays(today(), VALID_FOR_DAYS),
      salesViewer.user,
      salesViewer.user,
      dbNow(),
      dbNow(),
      original.id,
    ],
    transaction,
  );
  const id = (await q('SELECT id FROM Quotations WHERE quoteNo = ?', [quoteNo], transaction))[0].id;
  const chargeColumns = await copiedColumns('QuotationCharges', CHARGE_COLUMNS_NOT_COPIED, transaction);
  await x(
    `INSERT INTO QuotationCharges (quotationId, createdAt, updatedAt, ${chargeColumns.join(', ')})
      SELECT ?, ?, ?, ${chargeColumns.join(', ')} FROM QuotationCharges WHERE quotationId = ?`,
    [id, dbNow(), dbNow(), original.id],
    transaction,
  );
  return id;
}

/** A new revision (R1, R2 …) of a sent quotation; the old one is kept as "Revised". */
export async function reviseQuotation(salesViewer, quotationId) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const original = await loadQuotation(quotationId);
  if (!['SENT', 'LOST'].includes(original.status)) {
    throw new BadRequestError(
      original.status === 'DRAFT'
        ? 'A draft is changed directly - no revision needed'
        : `Quotation ${original.quoteNo} is ${statusText(original.status)}`,
    );
  }
  const rootNo = original.rootNo || original.quoteNo;
  const revision =
    ((
      await q('SELECT max(coalesce(revision, 0)) m FROM Quotations WHERE rootNo = ? OR quoteNo = ?', [rootNo, rootNo])
    )[0].m || 0) + 1;
  const quoteNo = `${rootNo}-R${revision}`;
  let id;
  await inTransaction(async (transaction) => {
    id = await insertRevision(original, quoteNo, revision, rootNo, salesViewer, transaction);
    await x(
      "UPDATE Quotations SET status = 'SUPERSEDED', updatedAt = ? WHERE id = ?",
      [dbNow(), original.id],
      transaction,
    );
    if (original.leadId) {
      await x(
        "UPDATE Leads SET status = 'QUOTED', lostReason = NULL, closedAt = NULL, updatedAt = ? WHERE id = ? AND status IN ('OPEN', 'QUOTED', 'LOST')",
        [dbNow(), original.leadId],
        transaction,
      );
    }
  });
  return { success: true, id, quoteNo };
}

export async function deleteQuotation(salesViewer, quotationId) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const quotation = await loadQuotation(quotationId);
  if (quotation.status !== 'DRAFT')
    throw new BadRequestError('Only a draft can be deleted - a sent quotation is kept (mark it Lost)');
  await inTransaction(async (transaction) => {
    await x('DELETE FROM QuotationCharges WHERE quotationId = ?', [quotation.id], transaction);
    await x('DELETE FROM Quotations WHERE id = ?', [quotation.id], transaction);
    // a deleted revision gives the last one back
    if (quotation.parentId) {
      await x(
        "UPDATE Quotations SET status = 'SENT', updatedAt = ? WHERE id = ? AND status = 'SUPERSEDED'",
        [dbNow(), quotation.parentId],
        transaction,
      );
    }
    if (quotation.leadId) {
      const openQuotes = (
        await q(
          "SELECT count(*) n FROM Quotations WHERE leadId = ? AND status IN ('DRAFT', 'SENT')",
          [quotation.leadId],
          transaction,
        )
      )[0].n;
      if (!openQuotes) {
        await x(
          "UPDATE Leads SET status = 'OPEN', updatedAt = ? WHERE id = ? AND status = 'QUOTED'",
          [dbNow(), quotation.leadId],
          transaction,
        );
      }
    }
  });
  return { success: true };
}

function assertCanBeSent(quotation) {
  if (!['DRAFT', 'SENT'].includes(quotation.status)) {
    throw new BadRequestError(`Quotation ${quotation.quoteNo} is ${statusText(quotation.status)}`);
  }
  if (!(Number(quotation.totalSellInr) > 0)) throw new BadRequestError('The quotation has no charges');
}

async function markSent(quotation, sentTo, salesViewer) {
  assertCanBeSent(quotation);
  await x('UPDATE Quotations SET status = ?, sentAt = ?, sentTo = ?, updatedBy = ?, updatedAt = ? WHERE id = ?', [
    'SENT',
    dbNow(),
    sentTo || quotation.sentTo || null,
    salesViewer.user,
    dbNow(),
    quotation.id,
  ]);
  if (quotation.leadId) {
    await x("UPDATE Leads SET status = 'QUOTED', updatedAt = ? WHERE id = ? AND status = 'OPEN'", [
      dbNow(),
      quotation.leadId,
    ]);
  }
}

export async function markQuotationSent(salesViewer, quotationId, body) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const quotation = await loadQuotation(quotationId);
  await markSent(quotation, clean(body.to), salesViewer);
  return { success: true };
}

const pdfFileName = (quoteNo) => String(quoteNo).replace(/[\\/]+/g, '-') + '.pdf';

/** The quotation print (HTML from the screen) as a PDF file. */
export async function quotationPdf(salesViewer, quotationId, body) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const [quotation] = await q('SELECT quoteNo FROM Quotations WHERE id = ?', [quotationId]);
  if (!body.html) throw new BadRequestError('Quotation print is missing');
  const pdf = await htmlToPdf(body.html);
  return { pdf, fileName: pdfFileName(quotation.quoteNo) };
}

const addressList = (value) =>
  String(value || '')
    .split(ADDRESS_SEPARATORS)
    .filter(Boolean);

const escapeHtml = (text) =>
  String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function readMailForm(form) {
  const to = addressList(form.to);
  if (!to.length || to.some((address) => !EMAIL_RE.test(address)))
    throw new BadRequestError('Give a valid e-mail address (To)');
  const cc = addressList(form.cc);
  if (cc.some((address) => !EMAIL_RE.test(address))) throw new BadRequestError('A Cc address is not valid');
  if (!form.html) throw new BadRequestError('Quotation print is missing');
  return { to, cc };
}

/** E-mails the quotation PDF and marks it sent. */
export async function mailQuotation(salesViewer, quotationId, body) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const quotation = await loadQuotation(quotationId);
  const form = body || {};
  const { to, cc } = readMailForm(form);
  assertCanBeSent(quotation);
  const pdf = await htmlToPdf(form.html);
  await sendMail({
    to: to.join(', '),
    cc: cc.length ? cc.join(', ') : undefined,
    subject: clean(form.subject) || 'Quotation ' + quotation.quoteNo,
    text: form.body || '',
    html:
      '<div style="font-family:Arial,sans-serif;font-size:13px;white-space:pre-wrap">' +
      escapeHtml(form.body) +
      '</div>',
    attachments: [{ filename: pdfFileName(quotation.quoteNo), content: pdf, contentType: 'application/pdf' }],
  });
  await markSent(quotation, to.join(', '), salesViewer);
  return { success: true, to: to.join(', ') };
}

async function docketToLink(quotation, body) {
  const docketNo = upper(body.docketNo);
  if (!docketNo) return null;
  const [docket] = await q('SELECT id, docketNo, quotationNo, mainParty FROM Shipments WHERE upper(docketNo) = ?', [
    docketNo,
  ]);
  if (!docket) throw new BadRequestError(`Docket ${docketNo} not found (Freight > Shipment Registration)`);
  if (docket.quotationNo && upper(docket.quotationNo) !== upper(quotation.quoteNo) && !body.replace) {
    const message = `Docket ${docket.docketNo} already carries quotation / contract ${docket.quotationNo}`;
    throw new ConflictError(message, { body: { success: false, error: message, askReplace: true } });
  }
  return docket;
}

/** Won: the docket that carries the shipment gets the quotation no. (its Provisional Sheet then bills at these rates). */
export async function markQuotationWon(salesViewer, quotationId, body) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const quotation = await loadQuotation(quotationId);
  if (!['SENT', 'WON'].includes(quotation.status)) {
    throw new BadRequestError(
      quotation.status === 'DRAFT'
        ? 'Send the quotation first (or mark it sent)'
        : `Quotation ${quotation.quoteNo} is ${statusText(quotation.status)}`,
    );
  }
  const docket = await docketToLink(quotation, body);
  await inTransaction(async (transaction) => {
    await x(
      `UPDATE Quotations SET status = ?, wonAt = coalesce(wonAt, ?), decidedAt = ?, docketNo = coalesce(?, docketNo), updatedBy = ?, updatedAt = ?
        WHERE id = ?`,
      ['WON', today(), dbNow(), docket ? docket.docketNo : null, salesViewer.user, dbNow(), quotation.id],
      transaction,
    );
    if (docket) {
      await x('UPDATE Shipments SET quotationNo = ? WHERE id = ?', [quotation.quoteNo, docket.id], transaction);
      // a docket carries one quotation: another quotation that pointed to it lets it go
      await x(
        "UPDATE Quotations SET docketNo = NULL WHERE upper(coalesce(docketNo, '')) = ? AND id <> ?",
        [upper(docket.docketNo), quotation.id],
        transaction,
      );
    }
    if (quotation.leadId) {
      await x(
        "UPDATE Leads SET status = 'WON', closedAt = ?, updatedAt = ? WHERE id = ?",
        [today(), dbNow(), quotation.leadId],
        transaction,
      );
    }
  });
  return { success: true, docketNo: docket ? docket.docketNo : null };
}

export async function markQuotationLost(salesViewer, quotationId, body) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const quotation = await loadQuotation(quotationId);
  if (!['SENT', 'DRAFT'].includes(quotation.status)) {
    throw new BadRequestError(`Quotation ${quotation.quoteNo} is ${statusText(quotation.status)}`);
  }
  const reason = clean(body.reason);
  if (!reason) throw new BadRequestError('Give the reason it was lost');
  await inTransaction(async (transaction) => {
    await x(
      'UPDATE Quotations SET status = ?, rejectReason = ?, lostTo = ?, lostRate = ?, decidedAt = ?, updatedBy = ?, updatedAt = ? WHERE id = ?',
      ['LOST', reason, clean(body.lostTo), clean(body.lostRate), dbNow(), salesViewer.user, dbNow(), quotation.id],
      transaction,
    );
    if (!quotation.leadId) return;
    const otherOpenQuotes = (
      await q(
        "SELECT count(*) n FROM Quotations WHERE leadId = ? AND status IN ('DRAFT', 'SENT') AND id <> ?",
        [quotation.leadId, quotation.id],
        transaction,
      )
    )[0].n;
    if (!otherOpenQuotes) {
      await x(
        "UPDATE Leads SET status = 'LOST', lostReason = ?, lostTo = ?, closedAt = ?, updatedAt = ? WHERE id = ?",
        [reason, clean(body.lostTo), today(), dbNow(), quotation.leadId],
        transaction,
      );
    }
  });
  return { success: true };
}

/** A won / lost quotation back to sent (wrong click); the docket's link to it is removed. */
export async function reopenQuotation(salesViewer, quotationId) {
  await ensureDealTables();
  await assertCanSeeDeal(salesViewer, 'Quotations', quotationId, QUOTATION_NOT_FOUND);
  const quotation = await loadQuotation(quotationId);
  if (!['WON', 'LOST'].includes(quotation.status))
    throw new BadRequestError('Only a won or lost quotation is reopened');
  await inTransaction(async (transaction) => {
    if (quotation.docketNo) {
      await x(
        "UPDATE Shipments SET quotationNo = NULL WHERE upper(docketNo) = ? AND upper(coalesce(quotationNo, '')) = ?",
        [upper(quotation.docketNo), upper(quotation.quoteNo)],
        transaction,
      );
    }
    await x(
      `UPDATE Quotations SET status = 'SENT', wonAt = NULL, docketNo = NULL, rejectReason = NULL, lostTo = NULL, lostRate = NULL,
        decidedAt = NULL, updatedAt = ? WHERE id = ?`,
      [dbNow(), quotation.id],
      transaction,
    );
    if (quotation.leadId) {
      await x(
        "UPDATE Leads SET status = 'QUOTED', lostReason = NULL, lostTo = NULL, closedAt = NULL, updatedAt = ? WHERE id = ?",
        [dbNow(), quotation.leadId],
        transaction,
      );
    }
  });
  return { success: true };
}

/** Other quotations to copy charges from: this customer's first, then the same service / lane. */
export async function quotationsToCopy(salesViewer, query) {
  await ensureDealTables();
  const { w: conditions, p: params } = dealWhere(salesViewer, 'e');
  const rows = await q(
    `SELECT e.id, e.quoteNo, e.date, e.clientName, e.serviceType, e.origin, e.destination, e.status, e.totalSellInr,
        (CASE WHEN e.customerId = ? THEN 2 ELSE 0 END) + (CASE WHEN e.serviceType = ? THEN 1 ELSE 0 END)
          + (CASE WHEN e.origin = ? AND e.destination = ? THEN 1 ELSE 0 END) score
      FROM Quotations e ${whereClause(conditions)} ORDER BY score DESC, e.id DESC LIMIT ${COPY_CANDIDATES_LIMIT}`,
    [
      numOrNull(query.customerId) || 0,
      upper(query.service) || '',
      upper(query.origin) || '',
      upper(query.destination) || '',
      ...params,
    ],
  );
  return { success: true, data: rows.map((row) => ({ ...row, serviceLabel: serviceLabel(row.serviceType) })) };
}
