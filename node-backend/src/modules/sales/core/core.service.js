import { Op } from 'sequelize';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { AccountLedger, Currency, Lead, Quotation, QuotationCharge } from '../../../models/index.js';

const LEAD_STATUSES = ['NEW', 'QUOTED', 'WON', 'LOST'];
const QUOTE_STATUSES = ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED'];
const LIST_LIMIT = 500;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^[0-9+\-()\s]{6,20}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SERIAL_SUFFIX_RE = /\/(\d+)$/;
const TOTALS_TOLERANCE_INR = 0.02;
const LEAD_TEXT_FIELDS = [
  'clientName',
  'contactPerson',
  'designation',
  'email',
  'phone',
  'mode',
  'serviceType',
  'origin',
  'destination',
  'incoterms',
  'commodity',
  'containerType',
  'targetRate',
  'competitor',
  'remarks',
  'lostReason',
];
const QUOTE_TEXT_FIELDS = [
  'clientName',
  'contactPerson',
  'email',
  'origin',
  'destination',
  'mode',
  'commodity',
  'remarks',
  'rejectReason',
];

const round2 = (value) => Math.round((value || 0) * 100) / 100;
const todayUtc = () => new Date().toISOString().slice(0, 10);
const createdByOf = (user) => ({
  createdBy: (user && user.id) || null,
  createdByName: (user && (user.fullName || user.username)) || null,
});

const financialYearSuffix = () => {
  const now = new Date();
  const startYear = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
  return String(startYear % 100);
};

/** The next number in a series (ENQ/26/0001), from what is already stored - no counter to drift. */
async function nextSeriesNumber(model, field, prefix) {
  const yearSuffix = financialYearSuffix();
  const rows = await model.findAll({
    where: { [field]: { [Op.like]: prefix + '/' + yearSuffix + '/%' } },
    attributes: [field],
  });
  let highest = 0;
  rows.forEach((row) => {
    const match = SERIAL_SUFFIX_RE.exec(String(row[field] || ''));
    if (match) highest = Math.max(highest, parseInt(match[1], 10));
  });
  return prefix + '/' + yearSuffix + '/' + String(highest + 1).padStart(4, '0');
}

export const nextEnquiryNumber = () => nextSeriesNumber(Lead, 'enquiryNo', 'ENQ');
export const nextQuoteNumber = () => nextSeriesNumber(Quotation, 'quoteNo', 'QT');

/** The exchange rate on file for a currency - never a hardcoded guess. */
async function exchangeRateOf(code) {
  const currencyCode = String(code || 'INR').toUpperCase();
  if (currencyCode === 'INR') return { roe: 1, source: 'INR' };
  const currency = await Currency.findOne({ where: { currencyCode } });
  if (currency && parseFloat(currency.importRate) > 0)
    return { roe: parseFloat(currency.importRate), source: 'Currency master' };
  return { roe: null, source: 'not on file' };
}

const countByStatus = (statuses, rows) =>
  statuses.reduce(
    (counts, status) => ({
      ...counts,
      [status]: rows.filter((row) => row.status === status).length,
    }),
    {},
  );

function leadListWhere(query) {
  const where = {};
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.q) {
    const pattern = '%' + String(query.q) + '%';
    where[Op.or] = [
      { clientName: { [Op.like]: pattern } },
      { enquiryNo: { [Op.like]: pattern } },
      { contactPerson: { [Op.like]: pattern } },
      { origin: { [Op.like]: pattern } },
      { destination: { [Op.like]: pattern } },
      { commodity: { [Op.like]: pattern } },
    ];
  }
  return where;
}

function quotesByLead(quotes) {
  const byLead = new Map();
  quotes.forEach((quote) => {
    if (!quote.leadId) return;
    if (!byLead.has(quote.leadId)) byLead.set(quote.leadId, []);
    byLead.get(quote.leadId).push(quote);
  });
  return byLead;
}

export async function listLeads(query) {
  const leads = await Lead.findAll({
    where: leadListWhere(query),
    order: [
      ['date', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: LIST_LIMIT,
  });
  const quotes = await Quotation.findAll({ attributes: ['id', 'quoteNo', 'leadId', 'status', 'totalSellInr'] });
  const byLead = quotesByLead(quotes);
  return {
    success: true,
    data: leads.map((lead) => ({
      ...lead.toJSON(),
      quotes: (byLead.get(lead.id) || []).map((quote) => ({
        id: quote.id,
        quoteNo: quote.quoteNo,
        status: quote.status,
        value: round2(parseFloat(quote.totalSellInr) || 0),
      })),
    })),
    counts: countByStatus(LEAD_STATUSES, leads),
    nextEnquiryNo: await nextEnquiryNumber(),
  };
}

const numberOrNull = (value) => {
  if (value === '' || value == null) return null;
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : NaN;
};

async function leadProblems(body, date, weight, volume) {
  const problems = [];
  if (!String(body.clientName || '').trim()) problems.push('Client name is required');
  if (body.email && !EMAIL_RE.test(String(body.email))) problems.push('Email is not valid');
  if (body.phone && !PHONE_RE.test(String(body.phone))) problems.push('Phone number looks wrong');
  if (body.partyLedgerId && !(await AccountLedger.findByPk(body.partyLedgerId)))
    problems.push('That customer ledger does not exist');
  if (!ISO_DATE_RE.test(date)) problems.push('Date is not valid');
  if (Number.isNaN(weight)) problems.push('Weight must be a number');
  if (Number.isNaN(volume)) problems.push('Volume must be a number');
  return problems;
}

const throwIfProblems = (problems) => {
  if (problems.length) throw new BadRequestError(problems.join('; '), { errors: problems });
};

export async function createLead(body, user) {
  const form = body || {};
  const date = String(form.date || todayUtc()).slice(0, 10);
  const weight = numberOrNull(form.weight);
  const volume = numberOrNull(form.volume);
  throwIfProblems(await leadProblems(form, date, weight, volume));
  const lead = await Lead.create({
    enquiryNo: String(form.enquiryNo || '').trim() || (await nextEnquiryNumber()),
    date,
    partyLedgerId: form.partyLedgerId || null,
    clientName: String(form.clientName).trim(),
    contactPerson: form.contactPerson || null,
    designation: form.designation || null,
    email: form.email || null,
    phone: form.phone || null,
    mode: form.mode || null,
    serviceType: form.serviceType || null,
    origin: form.origin || null,
    destination: form.destination || null,
    incoterms: form.incoterms || null,
    commodity: form.commodity || null,
    readinessDate: form.readinessDate ? String(form.readinessDate).slice(0, 10) : null,
    containerType: form.containerType || null,
    weight,
    volume,
    targetRate: form.targetRate || null,
    competitor: form.competitor || null,
    remarks: form.remarks || null,
    status: 'NEW',
    ...createdByOf(user),
  });
  return { success: true, data: lead };
}

function assertLeadStatusChange(form, lead) {
  if (form.status === undefined) return;
  const status = String(form.status).toUpperCase();
  if (!LEAD_STATUSES.includes(status)) throw new BadRequestError('Status must be one of ' + LEAD_STATUSES.join(', '));
  if (status === 'LOST' && !String(form.lostReason || lead.lostReason || '').trim()) {
    throw new BadRequestError('Say why the lead was lost - that is the only part of it worth keeping');
  }
}

const blankToNull = (value) => (value === '' ? null : value);

function leadChanges(form) {
  const changes = {};
  LEAD_TEXT_FIELDS.forEach((key) => {
    if (form[key] !== undefined) changes[key] = blankToNull(form[key]);
  });
  if (form.status !== undefined) changes.status = String(form.status).toUpperCase();
  if (form.weight !== undefined) changes.weight = form.weight === '' ? null : parseFloat(form.weight);
  if (form.volume !== undefined) changes.volume = form.volume === '' ? null : parseFloat(form.volume);
  if (form.readinessDate !== undefined)
    changes.readinessDate = form.readinessDate ? String(form.readinessDate).slice(0, 10) : null;
  return changes;
}

export async function updateLead(leadId, body) {
  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new NotFoundError('Lead not found');
  const form = body || {};
  assertLeadStatusChange(form, lead);
  await lead.update(leadChanges(form));
  return { success: true, data: lead };
}

/** Totals of the charge lines in INR (each line at its own rate of exchange). */
function chargeTotals(lines) {
  let buy = 0;
  let sell = 0;
  lines.forEach((line) => {
    const qty = parseFloat(line.qty) || 0;
    const roe = parseFloat(line.roe) || 1;
    buy += (parseFloat(line.buyRate) || 0) * qty * roe;
    sell += (parseFloat(line.sellRate) || 0) * qty * roe;
  });
  return { buy: round2(buy), sell: round2(sell) };
}

function quoteListWhere(query) {
  const where = {};
  if (query.status) where.status = String(query.status).toUpperCase();
  if (query.leadId) where.leadId = parseInt(query.leadId, 10);
  return where;
}

async function chargesByQuote(quoteIds) {
  const charges = quoteIds.length
    ? await QuotationCharge.findAll({
        where: { quotationId: { [Op.in]: quoteIds } },
        order: [
          ['sortOrder', 'ASC'],
          ['id', 'ASC'],
        ],
      })
    : [];
  const byQuote = new Map();
  charges.forEach((charge) => {
    if (!byQuote.has(charge.quotationId)) byQuote.set(charge.quotationId, []);
    byQuote.get(charge.quotationId).push(charge);
  });
  return byQuote;
}

function quoteWithFigures(quote, lines) {
  const lineTotals = chargeTotals(lines);
  const sell = round2(parseFloat(quote.totalSellInr) || 0);
  const buy = parseFloat(quote.totalBuyInr) || 0;
  return {
    ...quote.toJSON(),
    charges: lines,
    totalBuyInr: round2(buy),
    totalSellInr: sell,
    marginInr: round2(sell - buy),
    marginPct: sell > 0 ? Math.round(((sell - buy) / sell) * 1000) / 10 : null,
    // the stored totals must agree with the lines; if they do not, say so rather than hide it
    totalsMatchLines: Math.abs(lineTotals.sell - sell) < TOTALS_TOLERANCE_INR,
    expired: quote.validUntil ? String(quote.validUntil) < todayUtc() : false,
  };
}

export async function listQuotes(query) {
  const quotes = await Quotation.findAll({
    where: quoteListWhere(query),
    order: [
      ['date', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: LIST_LIMIT,
  });
  const byQuote = await chargesByQuote(quotes.map((quote) => quote.id));
  return {
    success: true,
    data: quotes.map((quote) => quoteWithFigures(quote, byQuote.get(quote.id) || [])),
    counts: countByStatus(QUOTE_STATUSES, quotes),
    nextQuoteNo: await nextQuoteNumber(),
  };
}

/** The rates on file, so the quote form converts with real numbers. */
export async function listRates() {
  const currencies = await Currency.findAll({ order: [['currencyCode', 'ASC']] });
  return {
    success: true,
    data: currencies.map((currency) => ({
      code: currency.currencyCode,
      name: currency.currencyName,
      roe: parseFloat(currency.importRate) || null,
      effectiveDate: currency.effectiveDate,
    })),
    note: currencies.length
      ? 'Rates are the import rates on the Currency master.'
      : 'No currency is on file, so only INR can be quoted. Add currencies and their rates in Accounting Masters.',
  };
}

// the rate comes from the master unless the user typed one for this line
async function lineExchangeRate(line, currencyCode) {
  const typed = parseFloat(line.roe);
  if (Number.isFinite(typed) && typed > 0) return typed;
  const rate = await exchangeRateOf(currencyCode);
  if (rate.roe == null) {
    throw new Error(
      'No exchange rate on file for ' +
        currencyCode +
        ' - add it in Accounting Masters, or type the rate on the line. A quote must not be priced off a guessed rate.',
    );
  }
  return rate.roe;
}

async function saveCharges(quotationId, charges) {
  await QuotationCharge.destroy({ where: { quotationId } });
  const saved = [];
  let sortOrder = 0;
  for (const charge of charges || []) {
    const head = String(charge.head || '').trim();
    if (!head) continue;
    const currency = String(charge.currency || 'INR').toUpperCase();
    const roe = await lineExchangeRate(charge, currency);
    saved.push(
      await QuotationCharge.create({
        quotationId,
        head,
        buyRate: parseFloat(charge.buyRate) || 0,
        sellRate: parseFloat(charge.sellRate) || 0,
        currency,
        roe,
        qty: parseFloat(charge.qty) || 1,
        basis: charge.basis ? String(charge.basis).slice(0, 40) : null,
        remarks: charge.remarks ? String(charge.remarks).slice(0, 200) : null,
        sortOrder: sortOrder++,
      }),
    );
  }
  return saved;
}

async function quoteProblems(form, date) {
  const problems = [];
  if (!String(form.clientName || '').trim()) problems.push('Client name is required');
  if (!Array.isArray(form.charges) || !form.charges.filter((charge) => String(charge.head || '').trim()).length) {
    problems.push('A quotation needs at least one charge line');
  }
  if (form.validUntil && String(form.validUntil).slice(0, 10) < date)
    problems.push('Valid-until is before the quote date');
  if (form.leadId && !(await Lead.findByPk(form.leadId))) problems.push('That lead does not exist');
  return problems;
}

async function markLeadQuoted(leadId) {
  if (!leadId) return;
  const lead = await Lead.findByPk(leadId);
  if (lead && lead.status === 'NEW') await lead.update({ status: 'QUOTED' });
}

export async function createQuote(body, user) {
  const form = body || {};
  const date = String(form.date || todayUtc()).slice(0, 10);
  throwIfProblems(await quoteProblems(form, date));
  const quote = await Quotation.create({
    quoteNo: String(form.quoteNo || '').trim() || (await nextQuoteNumber()),
    leadId: form.leadId || null,
    date,
    validUntil: form.validUntil ? String(form.validUntil).slice(0, 10) : null,
    partyLedgerId: form.partyLedgerId || null,
    clientName: String(form.clientName).trim(),
    contactPerson: form.contactPerson || null,
    email: form.email || null,
    origin: form.origin || null,
    destination: form.destination || null,
    mode: form.mode || null,
    commodity: form.commodity || null,
    remarks: form.remarks || null,
    status: 'DRAFT',
    ...createdByOf(user),
  });
  let lines;
  try {
    lines = await saveCharges(quote.id, form.charges);
  } catch (error) {
    await quote.destroy();
    throw new BadRequestError(error.message);
  }
  const totals = chargeTotals(lines);
  await quote.update({ totalBuyInr: totals.buy, totalSellInr: totals.sell });
  await markLeadQuoted(quote.leadId);
  return { success: true, data: { ...quote.toJSON(), charges: lines, marginInr: round2(totals.sell - totals.buy) } };
}

function assertQuoteStatusChange(form, quote) {
  if (form.status === undefined) return;
  const status = String(form.status).toUpperCase();
  if (!QUOTE_STATUSES.includes(status)) throw new BadRequestError('Status must be one of ' + QUOTE_STATUSES.join(', '));
  if (status === 'REJECTED' && !String(form.rejectReason || quote.rejectReason || '').trim()) {
    throw new BadRequestError('Record why it was rejected');
  }
  if (quote.status === 'CONVERTED' && status !== 'CONVERTED') {
    throw new BadRequestError('This quote is already a job - its status cannot be moved back');
  }
}

function quoteChanges(form) {
  const changes = {};
  QUOTE_TEXT_FIELDS.forEach((key) => {
    if (form[key] !== undefined) changes[key] = blankToNull(form[key]);
  });
  if (form.validUntil !== undefined) changes.validUntil = form.validUntil ? String(form.validUntil).slice(0, 10) : null;
  if (form.status !== undefined) {
    changes.status = String(form.status).toUpperCase();
    if (['APPROVED', 'REJECTED'].includes(changes.status)) changes.decidedAt = new Date();
  }
  return changes;
}

// an approved quote decides the lead
async function applyDecisionToLead(leadId, changes) {
  if (!leadId || !changes.status) return;
  const lead = await Lead.findByPk(leadId);
  if (!lead) return;
  if (changes.status === 'APPROVED' && lead.status !== 'WON') await lead.update({ status: 'WON' });
  if (changes.status === 'REJECTED' && lead.status === 'QUOTED') {
    await lead.update({ status: 'LOST', lostReason: changes.rejectReason || 'Quotation rejected' });
  }
}

export async function updateQuote(quoteId, body) {
  const quote = await Quotation.findByPk(quoteId);
  if (!quote) throw new NotFoundError('Quotation not found');
  const form = body || {};
  assertQuoteStatusChange(form, quote);
  const changes = quoteChanges(form);
  await quote.update(changes);
  if (Array.isArray(form.charges)) {
    let lines;
    try {
      lines = await saveCharges(quote.id, form.charges);
    } catch (error) {
      throw new BadRequestError(error.message);
    }
    const totals = chargeTotals(lines);
    await quote.update({ totalBuyInr: totals.buy, totalSellInr: totals.sell });
  }
  await applyDecisionToLead(quote.leadId, changes);
  const charges = await QuotationCharge.findAll({ where: { quotationId: quote.id }, order: [['sortOrder', 'ASC']] });
  return { success: true, data: { ...quote.toJSON(), charges } };
}

/** Records that the quotation went out, and to whom (the mail itself goes through /api/email/send). */
export async function recordQuoteSent(quoteId, body) {
  const quote = await Quotation.findByPk(quoteId);
  if (!quote) throw new NotFoundError('Quotation not found');
  const sentTo = String((body && body.to) || quote.email || '').trim();
  if (!sentTo) throw new BadRequestError('No email address for this client - add one on the quote or the lead');
  await quote.update({ status: quote.status === 'DRAFT' ? 'SENT' : quote.status, sentAt: new Date(), sentTo });
  return {
    success: true,
    data: quote,
    note: 'Recorded as sent to ' + sentTo + '. The mail itself goes through /api/email/send.',
  };
}

/** Turns an approved quotation into a job. */
export async function convertQuoteToJob(quoteId, body) {
  const quote = await Quotation.findByPk(quoteId);
  if (!quote) throw new NotFoundError('Quotation not found');
  if (quote.status === 'CONVERTED') throw new BadRequestError('Already converted to job ' + quote.jobNo);
  if (quote.status !== 'APPROVED') {
    throw new BadRequestError('Only an approved quotation can become a job - this one is ' + quote.status);
  }
  const jobNo = String((body && body.jobNo) || '').trim();
  if (!jobNo) throw new BadRequestError('Give the job number this quote becomes, so the two can be matched later');
  await quote.update({ status: 'CONVERTED', jobNo });
  if (quote.leadId) {
    const lead = await Lead.findByPk(quote.leadId);
    if (lead) await lead.update({ status: 'WON' });
  }
  return { success: true, data: quote };
}

export async function deleteQuote(quoteId) {
  const quote = await Quotation.findByPk(quoteId);
  if (!quote) throw new NotFoundError('Quotation not found');
  if (quote.status === 'CONVERTED')
    throw new BadRequestError('This quote is already job ' + quote.jobNo + ' - it cannot be deleted');
  await QuotationCharge.destroy({ where: { quotationId: quote.id } });
  await quote.destroy();
  return { success: true };
}
