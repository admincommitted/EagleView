import { Op } from 'sequelize';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { AccountLedger, CreditFollowUp, CreditPolicy } from '../../../models/index.js';
import { buckets15, buckets30, openItems } from '../../../utils/common/openItems.js';

const DAY_MS = 86400000;
const PROMISE_WINDOW_DAYS = 7;
const FOLLOW_UP_LIMIT = 100;
const FOLLOW_UP_CHANNELS = ['CALL', 'EMAIL', 'VISIT', 'WHATSAPP', 'SYSTEM'];
const MAX_REF_LENGTH = 80;
const MAX_REMINDER_DAYS = 365;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MATCH_TOLERANCE = 1;

const round2 = (value) => Math.round((value || 0) * 100) / 100;
const todayIso = () => new Date().toISOString().slice(0, 10);
const sumPending = (items) => round2(items.reduce((sum, item) => sum + item.pending, 0));
const failure = (ErrorClass, message) => new ErrorClass(message, { body: { success: false, error: message } });
const ledgerNotFound = (message = 'Ledger not found') => failure(NotFoundError, message);

// risk is derived, never guessed: it is stated with the reason so nobody has to wonder
function riskOf({ overLimit, b60, b90, total }) {
  if (overLimit) return { risk: 'High', why: 'Outstanding is over the credit limit' };
  if (b90 > 0) return { risk: 'High', why: 'Money outstanding beyond 60 days' };
  if (b60 > 0) return { risk: 'Medium', why: 'Money outstanding 31-60 days' };
  if (total > 0) return { risk: 'Low', why: 'Nothing older than 30 days' };
  return { risk: 'None', why: 'Nothing outstanding' };
}

function itemsByLedger(items) {
  const byLedger = new Map();
  for (const item of items) {
    if (!byLedger.has(item.ledgerId)) byLedger.set(item.ledgerId, []);
    byLedger.get(item.ledgerId).push(item);
  }
  return byLedger;
}

const policyView = (policy) =>
  policy
    ? {
        autoSendLedger: policy.autoSendLedger,
        autoSendDays: policy.autoSendDays,
        overdueReminders: policy.overdueReminders,
        reminderAfterDays: policy.reminderAfterDays,
        autoHoldDelivery: policy.autoHoldDelivery,
      }
    : null;

function clientView(ledger, bills, policy, promises) {
  const total = sumPending(bills);
  const buckets = buckets15(bills);
  const creditLimit = round2(parseFloat(ledger.creditLimit) || 0);
  const overLimit = creditLimit > 0 && total > creditLimit;
  const { risk, why } = riskOf({ overLimit, b60: buckets.b60, b90: buckets.b90, total });
  const ledgerPromises = promises.filter((promise) => promise.ledgerId === ledger.id);
  return {
    id: ledger.id,
    ledgerId: ledger.id,
    name: ledger.name,
    totalOut: total,
    buckets,
    creditLimit,
    creditDays: parseInt(ledger.creditDays, 10) || 0,
    utilisationPct: creditLimit > 0 ? Math.round((total / creditLimit) * 1000) / 10 : null,
    overLimit,
    risk,
    riskWhy: why,
    phone: ledger.phone || '',
    email: ledger.email || '',
    contactPerson: ledger.contactPerson || '',
    gstin: ledger.gstin || '',
    billCount: bills.length,
    oldestOverdueDays: Math.max(0, ...bills.map((item) => item.overdueDays)),
    nextPromise: ledgerPromises.length
      ? { date: ledgerPromises[0].promiseDate, amount: round2(parseFloat(ledgerPromises[0].promiseAmount) || 0) }
      : null,
    policy: policyView(policy),
  };
}

// open promises to pay, from the follow-up log - this is what "expected" means here
const openPromises = () =>
  CreditFollowUp.findAll({
    where: { promiseDate: { [Op.ne]: null }, promiseMet: { [Op.or]: [null, false] } },
    order: [['promiseDate', 'ASC']],
  });

function expectedThisWeek(promisesThisWeek, clients) {
  return round2(
    promisesThisWeek.reduce((sum, promise) => {
      const amount = parseFloat(promise.promiseAmount) || 0;
      if (amount) return sum + amount;
      // no amount promised: fall back to what that party actually owes
      const client = clients.find((row) => row.ledgerId === promise.ledgerId);
      return sum + (client ? client.totalOut : 0);
    }, 0),
  );
}

export async function ageingReport(query) {
  const asOn = query.asOn || todayIso();
  const type = query.type || 'receivable';
  const { items, ledgers, basis, note } = await openItems({ type, asOn });
  const byLedger = itemsByLedger(items);
  const policies = await CreditPolicy.findAll();
  const policiesByLedger = new Map(policies.map((policy) => [policy.ledgerId, policy]));
  const weekEnd = new Date(new Date(asOn).getTime() + PROMISE_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
  const promises = await openPromises();

  const clients = [];
  for (const ledger of ledgers) {
    const bills = byLedger.get(ledger.id) || [];
    if (!bills.length) continue; // nothing outstanding - not a credit case
    clients.push(clientView(ledger, bills, policiesByLedger.get(ledger.id), promises));
  }
  clients.sort((first, second) => second.totalOut - first.totalOut);

  const allBuckets = buckets30(items);
  const isThisWeek = (promise) => String(promise.promiseDate) >= asOn && String(promise.promiseDate) <= weekEnd;
  return {
    success: true,
    asOn,
    type,
    basis,
    note,
    clients,
    kpis: {
      totalOutstanding: sumPending(items),
      notDue: allBuckets.notDue,
      overdue1to30: allBuckets.days30,
      overdue31to60: allBuckets.days60,
      critical60plus: round2(allBuckets.days90 + allBuckets.over90),
      expectedThisWeek: expectedThisWeek(promises.filter(isThisWeek), clients),
      promisesCounted: promises.filter(isThisWeek).length,
      partiesOverLimit: clients.filter((client) => client.overLimit).length,
      partiesWithoutLimit: clients.filter((client) => !client.creditLimit).length,
    },
    noteExpected:
      'Expected this week is the sum of open Promise-to-Pay dates in the follow-up log between ' +
      asOn +
      ' and ' +
      weekEnd +
      '. With no promises logged it is zero - it is not a forecast.',
  };
}

export async function partyCreditDetails(ledgerIdParam, query) {
  const ledgerId = parseInt(ledgerIdParam, 10);
  const ledger = await AccountLedger.findByPk(ledgerId);
  if (!ledger) throw ledgerNotFound();
  const asOn = query.asOn || todayIso();
  const { items, basis } = await openItems({ type: query.type || 'receivable', asOn });
  const bills = items.filter((item) => item.ledgerId === ledgerId);
  const followUps = await CreditFollowUp.findAll({
    where: { ledgerId },
    order: [['createdAt', 'DESC']],
    limit: FOLLOW_UP_LIMIT,
  });
  const policy = await CreditPolicy.findOne({ where: { ledgerId } });
  return {
    success: true,
    asOn,
    basis,
    party: {
      id: ledger.id,
      name: ledger.name,
      phone: ledger.phone || '',
      email: ledger.email || '',
      contactPerson: ledger.contactPerson || '',
      gstin: ledger.gstin || '',
      address: ledger.address || '',
      creditLimit: round2(parseFloat(ledger.creditLimit) || 0),
      creditDays: parseInt(ledger.creditDays, 10) || 0,
    },
    bills,
    buckets: buckets15(bills),
    total: sumPending(bills),
    followUps,
    policy,
  };
}

function followUpValues(body) {
  const note = String(body.note || '').trim();
  if (!note) throw failure(BadRequestError, 'Write what was said - a follow-up with no note is no record');
  const channel = String(body.channel || 'CALL').toUpperCase();
  if (!FOLLOW_UP_CHANNELS.includes(channel)) {
    throw failure(BadRequestError, 'Channel must be CALL, EMAIL, VISIT, WHATSAPP or SYSTEM');
  }
  const promiseDate = body.promiseDate ? String(body.promiseDate).slice(0, 10) : null;
  if (promiseDate && !ISO_DATE.test(promiseDate)) throw failure(BadRequestError, 'Promise date must be a date');
  const promiseAmount = body.promiseAmount === '' || body.promiseAmount == null ? null : parseFloat(body.promiseAmount);
  if (promiseAmount != null && !Number.isFinite(promiseAmount))
    throw failure(BadRequestError, 'Promised amount must be a number');
  return { note, channel, promiseDate, promiseAmount };
}

export async function addFollowUp(body, user) {
  const followUp = body || {};
  const ledgerId = parseInt(followUp.ledgerId, 10);
  if (!(await AccountLedger.findByPk(ledgerId))) throw ledgerNotFound('Ledger ' + ledgerId + ' not found');
  const values = followUpValues(followUp);
  const row = await CreditFollowUp.create({
    ledgerId,
    ...values,
    refNo: followUp.refNo ? String(followUp.refNo).slice(0, MAX_REF_LENGTH) : null,
    createdBy: user.id,
    createdByName: user.name,
  });
  return { success: true, data: row };
}

// marks a promise kept or broken
export async function updateFollowUp(id, body) {
  const row = await CreditFollowUp.findByPk(id);
  if (!row) throw failure(NotFoundError, 'Follow-up not found');
  const values = {};
  if (body.promiseMet !== undefined) values.promiseMet = body.promiseMet === null ? null : !!body.promiseMet;
  if (body.note !== undefined && String(body.note).trim()) values.note = String(body.note).trim();
  await row.update(values);
  return { success: true, data: row };
}

function policyValues(ledgerId, body, updatedByName) {
  const values = { ledgerId };
  for (const key of ['autoSendLedger', 'overdueReminders', 'autoHoldDelivery']) {
    if (body[key] !== undefined) values[key] = !!body[key];
  }
  if (body.autoSendDays !== undefined) {
    const days = String(body.autoSendDays || '')
      .split(',')
      .map((day) => parseInt(day, 10))
      .filter((day) => day >= 1 && day <= 31);
    values.autoSendDays = days.length ? days.join(',') : null;
  }
  if (body.reminderAfterDays !== undefined) {
    const reminderDays = parseInt(body.reminderAfterDays, 10);
    if (!(reminderDays >= 0 && reminderDays <= MAX_REMINDER_DAYS)) {
      throw failure(BadRequestError, 'Reminder-after days must be between 0 and 365');
    }
    values.reminderAfterDays = reminderDays;
  }
  if (body.notes !== undefined) values.notes = body.notes ? String(body.notes) : null;
  values.updatedByName = updatedByName;
  return values;
}

export async function savePolicy(ledgerIdParam, body, updatedByName) {
  const ledgerId = parseInt(ledgerIdParam, 10);
  if (!(await AccountLedger.findByPk(ledgerId))) throw ledgerNotFound();
  const values = policyValues(ledgerId, body || {}, updatedByName);
  let row = await CreditPolicy.findOne({ where: { ledgerId } });
  if (row) await row.update(values);
  else row = await CreditPolicy.create(values);
  return { success: true, data: row };
}

const matchKey = (text) =>
  String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+/, '');
const amountOf = (value) => {
  const parsed = parseFloat(String(value == null ? '' : value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const sumOf = (rows, key) => round2(rows.reduce((sum, row) => sum + (row[key] || 0), 0));

function statementRowRefAndAmount(row) {
  const ref = String(row.ref || row.reference || row.invoice || row.docNo || row.particulars || '').trim();
  // in a customer's ledger OUR invoice is a credit to them; either column is accepted
  const amount =
    row.amount != null
      ? Math.abs(amountOf(row.amount))
      : Math.abs(amountOf(row.credit)) || Math.abs(amountOf(row.debit));
  return { ref, amount };
}

function findOurBill(ourBills, refKey, amount, tolerance) {
  const byReference = refKey
    ? ourBills.find((bill) => !bill.used && (matchKey(bill.refNo) === refKey || matchKey(bill.billNo) === refKey))
    : null;
  if (byReference) return { bill: byReference, matchedOn: 'reference' };
  if (amount) {
    const byAmount = ourBills.find((bill) => !bill.used && Math.abs(bill.pending - amount) <= tolerance);
    if (byAmount) return { bill: byAmount, matchedOn: 'amount' };
  }
  return { bill: null, matchedOn: '' };
}

const varianceHint = (difference) =>
  difference > 0
    ? 'They show less - TDS deducted, a credit note we have not booked, or a part payment'
    : 'They show more - a payment we have booked that they have not, or a double entry';

function matchStatement(rows, ourBills, tolerance) {
  const matched = [];
  const variances = [];
  const theirsOnly = [];
  rows.forEach((row, index) => {
    const { ref, amount } = statementRowRefAndAmount(row);
    if (!ref && !amount) return; // a blank or heading row
    const { bill, matchedOn } = findOurBill(ourBills, matchKey(ref), amount, tolerance);
    if (!bill) {
      theirsOnly.push({ line: index + 1, ref, amount: round2(amount), date: row.date || '' });
      return;
    }
    bill.used = true;
    const difference = round2(bill.pending - amount);
    const pair = { ref: bill.refNo, billNo: bill.billNo, date: bill.date, ours: bill.pending, theirs: round2(amount) };
    if (Math.abs(difference) <= tolerance) matched.push({ ...pair, matchedOn });
    else variances.push({ ...pair, diff: difference, matchedOn, hint: varianceHint(difference) });
  });
  return { matched, variances, theirsOnly };
}

/**
 * Matches a customer's own ledger (rows read from their Excel / CSV by the browser) with our open items:
 * on the bill reference first, then on the amount within the tolerance. Unpaired rows are listed, never dropped.
 */
export async function matchCustomerLedger(body) {
  const request = body || {};
  const ledgerId = parseInt(request.ledgerId, 10);
  const ledger = await AccountLedger.findByPk(ledgerId);
  if (!ledger) throw ledgerNotFound();
  const rows = Array.isArray(request.rows) ? request.rows : [];
  if (!rows.length) {
    throw failure(
      BadRequestError,
      'No rows came through. The file needs a column with the invoice / reference number and a column with the amount.',
    );
  }
  const tolerance = Math.max(0, parseFloat(request.tolerance != null ? request.tolerance : DEFAULT_MATCH_TOLERANCE));
  const { items } = await openItems({ type: 'receivable', asOn: request.asOn || todayIso() });
  const ourBills = items.filter((item) => item.ledgerId === ledgerId).map((item) => ({ ...item, used: false }));

  const { matched, variances, theirsOnly } = matchStatement(rows, ourBills, tolerance);
  const oursOnly = ourBills
    .filter((bill) => !bill.used)
    .map((bill) => ({
      ref: bill.refNo,
      billNo: bill.billNo,
      date: bill.date,
      ours: bill.pending,
      overdueDays: bill.overdueDays,
    }));
  return {
    success: true,
    party: ledger.name,
    ledgerId,
    matched,
    variances,
    oursOnly,
    theirsOnly,
    totals: {
      ourBooks: sumOf(ourBills, 'pending'),
      theirLedger: round2(sumOf(matched, 'theirs') + sumOf(variances, 'theirs') + sumOf(theirsOnly, 'amount')),
      matchedValue: sumOf(matched, 'ours'),
      varianceValue: sumOf(variances, 'diff'),
      inOurBooksOnly: sumOf(oursOnly, 'ours'),
      inTheirLedgerOnly: sumOf(theirsOnly, 'amount'),
    },
    counts: {
      rowsRead: rows.length,
      matched: matched.length,
      variances: variances.length,
      oursOnly: oursOnly.length,
      theirsOnly: theirsOnly.length,
    },
    note:
      'Matched on reference first, then on amount within ' +
      tolerance +
      ' rupee(s). Rows we could not pair are listed as-is, not dropped. ' +
      'Open items are FIFO because no receipt in this database carries a bill-wise reference.',
  };
}
