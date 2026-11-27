import { Op, QueryTypes } from 'sequelize';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { openingOn } from '../../../middlewares/branchScope.middleware.js';
import { AccountGroup, AccountLedger, Voucher, VoucherDetail, VoucherType } from '../../../models/index.js';
import { invoiceLinks } from '../../../utils/common/invoiceLinks.js';
import { buckets30, openItems } from '../../../utils/common/openItems.js';
import { q as readOnlyQuery } from '../../../utils/db/readDb.js';
import { vouchersInDayBook } from './voucher.service.js';

const round2 = (value) => Math.round(value * 100) / 100;
const todayIso = () => new Date().toISOString().slice(0, 10);
const ledgerNotFound = () => new NotFoundError('Ledger not found', { body: { error: 'Ledger not found' } });
const sideOf = (balance) => (balance >= 0 ? 'Dr' : 'Cr');

/** Sequelize date filter for an optional start / end date. */
function dateRange(startDate, endDate) {
  if (startDate && endDate) return { [Op.between]: [startDate, endDate] };
  if (startDate) return { [Op.gte]: startDate };
  if (endDate) return { [Op.lte]: endDate };
  return null;
}

// every voucher of the period is loaded with its lines and ledgers: an open range (all 3 lakh+ vouchers) ran the
// backend out of memory, so the Day Book always has a period, and at most a month of it
const DAY_BOOK_MAX_DAYS = 31;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const daysBetween = (fromDate, toDate) => Math.round((Date.parse(toDate) - Date.parse(fromDate)) / ONE_DAY_MS) + 1;

function dayBookPeriod(startDate, endDate) {
  const toDate = String(endDate || startDate || todayIso()).slice(0, 10);
  const fromDate = String(startDate || toDate).slice(0, 10);
  if (!ISO_DATE.test(fromDate) || !ISO_DATE.test(toDate)) {
    throw new BadRequestError('Give the dates as YYYY-MM-DD', { body: { error: 'Give the dates as YYYY-MM-DD' } });
  }
  if (fromDate > toDate) {
    throw new BadRequestError('The from date is after the to date', {
      body: { error: 'The from date is after the to date' },
    });
  }
  if (daysBetween(fromDate, toDate) > DAY_BOOK_MAX_DAYS) {
    const message = `Pick a period of ${DAY_BOOK_MAX_DAYS} days or less for the Day Book`;
    throw new BadRequestError(message, { body: { error: message } });
  }
  return { fromDate, toDate };
}

export async function dayBook({ startDate, endDate, voucherTypeId }) {
  const { fromDate, toDate } = dayBookPeriod(startDate, endDate);
  const where = { date: { [Op.between]: [fromDate, toDate] } };
  if (voucherTypeId) where.voucherTypeId = voucherTypeId;
  return vouchersInDayBook(where);
}

// the opening is company-wide: it counts under the default branch only (branch scope)
async function openingBalance(ledger, ledgerId, startDate) {
  const openingCounts = openingOn();
  const ledgerOpening = parseFloat(ledger.openingBalance || 0);
  let openingDr = openingCounts && ledger.balanceType === 'Dr' ? ledgerOpening : 0;
  let openingCr = openingCounts && ledger.balanceType === 'Cr' ? ledgerOpening : 0;
  if (startDate) {
    const pastLines = await VoucherDetail.findAll({
      where: { ledgerId },
      include: [{ model: Voucher, attributes: [], where: { date: { [Op.lt]: startDate } } }],
    });
    for (const line of pastLines) {
      if (line.dc === 'Dr') openingDr += parseFloat(line.amount);
      if (line.dc === 'Cr') openingCr += parseFloat(line.amount);
    }
  }
  return openingDr - openingCr;
}

export async function ledgerStatement(ledgerId, { startDate, endDate }) {
  const ledger = await AccountLedger.findByPk(ledgerId);
  if (!ledger) throw ledgerNotFound();
  const netOpening = await openingBalance(ledger, ledgerId, startDate);
  const voucherWhere = {};
  const date = dateRange(startDate, endDate);
  if (date) voucherWhere.date = date;
  const transactions = await VoucherDetail.findAll({
    where: { ledgerId },
    include: [
      {
        model: Voucher,
        where: Object.keys(voucherWhere).length > 0 ? voucherWhere : undefined,
        include: [{ model: VoucherType, as: 'voucherType', attributes: ['name', 'baseType'] }],
      },
    ],
    order: [
      [{ model: Voucher }, 'date', 'ASC'],
      [{ model: Voucher }, 'createdAt', 'ASC'],
    ],
  });
  let runningBalance = netOpening;
  const rows = transactions.map((line) => {
    const amount = parseFloat(line.amount);
    if (line.dc === 'Dr') runningBalance += amount;
    if (line.dc === 'Cr') runningBalance -= amount;
    return {
      id: line.id,
      voucherId: line.voucherId,
      date: line.Voucher.date,
      voucherNumber: line.Voucher.voucherNumber,
      voucherType: line.Voucher.voucherType.name,
      narration: line.Voucher.narration,
      dc: line.dc,
      amount,
      runningBalance: Math.abs(runningBalance),
      runningBalanceType: sideOf(runningBalance),
    };
  });
  return {
    success: true,
    data: {
      ledger: { id: ledger.id, name: ledger.name },
      openingBalance: Math.abs(netOpening),
      openingBalanceType: sideOf(netOpening),
      transactions: rows,
      closingBalance: Math.abs(runningBalance),
      closingBalanceType: sideOf(runningBalance),
    },
  };
}

export async function bankReconciliation(ledgerId) {
  const ledger = await AccountLedger.findByPk(ledgerId);
  if (!ledger) throw ledgerNotFound();
  const transactions = await VoucherDetail.findAll({
    where: { ledgerId },
    include: [
      { model: Voucher, include: [{ model: VoucherType, as: 'voucherType', attributes: ['name', 'baseType'] }] },
    ],
    order: [[{ model: Voucher }, 'date', 'ASC']],
  });
  const rows = transactions.map((line) => ({
    id: line.id,
    voucherId: line.voucherId,
    date: line.Voucher.date,
    voucherNumber: line.Voucher.voucherNumber,
    voucherType: line.Voucher.voucherType.name,
    narration: line.Voucher.narration,
    dc: line.dc,
    amount: parseFloat(line.amount),
    clearanceDate: line.clearanceDate,
  }));
  return { success: true, data: { ledger, transactions: rows } };
}

/** Saves the bank clearance dates: updates = [{ id, clearanceDate }]. */
export async function reconcileBank(updates) {
  if (!updates || !Array.isArray(updates)) {
    throw new BadRequestError('Invalid updates format', { body: { error: 'Invalid updates format' } });
  }
  for (const update of updates) {
    if (update.id)
      await VoucherDetail.update({ clearanceDate: update.clearanceDate || null }, { where: { id: update.id } });
  }
  return { success: true };
}

const RETURN_VOUCHER_TYPES = { GSTR1: ['Sales'], GSTR2: ['Purchase'], GSTR3B: ['Sales', 'Purchase'] };

/** Only the Sales / Purchase vouchers a return needs, read in SQL with just the columns used. */
async function returnVouchers(baseTypes, startDate, endDate) {
  if (!baseTypes.length) return [];
  const typeList = baseTypes.map((type) => `'${type}'`).join(', ');
  const vouchers = await readOnlyQuery(
    `SELECT v.id, v.date, v.voucherNumber, v.narration, v.totalAmount, t.baseType FROM Vouchers v
      JOIN VoucherTypes t ON t.id = v.voucherTypeId
      WHERE v.date BETWEEN ? AND ? AND t.baseType IN (${typeList}) ORDER BY v.date, v.id`,
    [startDate, endDate],
  );
  const lines = await readOnlyQuery(
    `SELECT d.voucherId, d.amount, l.name lname, l.gstin, l.state FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      JOIN VoucherTypes t ON t.id = v.voucherTypeId LEFT JOIN AccountLedgers l ON l.id = d.ledgerId
      WHERE v.date BETWEEN ? AND ? AND t.baseType IN (${typeList}) ORDER BY d.voucherId, d.id`,
    [startDate, endDate],
  );
  const linesByVoucher = new Map();
  for (const line of lines) {
    if (!linesByVoucher.has(line.voucherId)) linesByVoucher.set(line.voucherId, []);
    linesByVoucher.get(line.voucherId).push({
      amount: line.amount,
      ledger: line.lname == null ? null : { name: line.lname, gstin: line.gstin, state: line.state },
    });
  }
  return vouchers.map((voucher) => ({
    ...voucher,
    voucherType: { baseType: voucher.baseType },
    details: linesByVoucher.get(voucher.id) || [],
  }));
}

function taxKindOf(ledgerName) {
  const name = String(ledgerName || '').toUpperCase();
  if (/\bIGST\b/.test(name)) return 'igst';
  if (/\bCGST\b/.test(name)) return 'cgst';
  if (/\bSGST\b|\bUTGST\b/.test(name)) return 'sgst';
  if (/\bCESS\b/.test(name)) return 'cess';
  return null;
}

// the tax is what sits on a CGST / SGST / IGST / Cess ledger of the voucher; the rest is the taxable value
function taxSplit(voucher) {
  const split = {
    taxable: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: parseFloat(voucher.totalAmount) || 0,
  };
  let taxSeen = 0;
  for (const line of voucher.details || []) {
    const amount = parseFloat(line.amount) || 0;
    const kind = taxKindOf(line.ledger && line.ledger.name);
    if (kind) {
      split[kind] += amount;
      taxSeen += amount;
    }
  }
  split.taxable = Math.round((split.total - taxSeen) * 100) / 100;
  return split;
}

// the party line of a sales / purchase voucher is the one on a ledger that carries a GSTIN
function partyOf(voucher) {
  const line = (voucher.details || []).find((detail) => detail.ledger && detail.ledger.gstin);
  return line
    ? { name: line.ledger.name, gstin: line.ledger.gstin, state: line.ledger.state || '' }
    : { name: '', gstin: '', state: '' };
}

const returnRows = (vouchers, baseType) =>
  vouchers
    .filter((voucher) => voucher.voucherType && voucher.voucherType.baseType === baseType)
    .map((voucher) => {
      const party = partyOf(voucher);
      return {
        id: voucher.id,
        date: voucher.date,
        voucherNumber: voucher.voucherNumber,
        narration: voucher.narration || '',
        partyName: party.name,
        gstin: party.gstin,
        placeOfSupply: party.state,
        ...taxSplit(voucher),
      };
    });

const returnTotals = (rows) =>
  rows.reduce(
    (sum, row) => ({
      taxable: sum.taxable + row.taxable,
      cgst: sum.cgst + row.cgst,
      sgst: sum.sgst + row.sgst,
      igst: sum.igst + row.igst,
      cess: sum.cess + row.cess,
      total: sum.total + row.total,
    }),
    {
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      total: 0,
    },
  );

const hasNoTaxLine = (row) => !(row.cgst || row.sgst || row.igst);

const registerAnswer = (rows) => ({
  success: true,
  data: rows,
  totals: returnTotals(rows),
  withoutGstin: rows.filter((row) => !row.gstin).length,
});

/** GSTR-1 (sales), GSTR-2 (purchases) or the GSTR-3B summary, from the tax lines of the vouchers themselves. */
export async function gstReturns({ startDate, endDate, type }) {
  const vouchers = await returnVouchers(RETURN_VOUCHER_TYPES[type] || [], startDate, endDate);
  if (type === 'GSTR1') return registerAnswer(returnRows(vouchers, 'Sales'));
  if (type === 'GSTR2') return registerAnswer(returnRows(vouchers, 'Purchase'));
  if (type !== 'GSTR3B') return { success: true, data: [] };
  const sales = returnRows(vouchers, 'Sales');
  const purchases = returnRows(vouchers, 'Purchase');
  return {
    success: true,
    data: {
      outwardSupplies: returnTotals(sales),
      itcAvailable: returnTotals(purchases),
      counts: { sales: sales.length, purchases: purchases.length },
      // a voucher with no CGST / SGST / IGST line at all - the figures cannot include tax that was never posted
      salesWithoutTaxLine: sales.filter(hasNoTaxLine).length,
      purchasesWithoutTaxLine: purchases.filter(hasNoTaxLine).length,
    },
  };
}

/**
 * Outstanding receivables / payables: the FIFO open items of utils/common/openItems.js (the same figures as Credit
 * Control), each with the GST invoice behind the bill when there is one.
 */
export async function outstanding({ type, asOn }) {
  const result = await openItems({ type, asOn });
  const links = await invoiceLinks(result.items.map((item) => item.voucherId));
  const data = result.items.map((item) => ({
    id: item.id,
    ledgerId: item.ledgerId,
    party: item.party,
    refNo: item.refNo,
    narration: item.narration,
    date: item.date,
    dueDate: item.dueDate,
    amount: item.amount,
    pending: item.pending,
    overdueDays: item.overdueDays,
    voucherId: item.voucherId || null,
    gst: links.get(Number(item.voucherId)) || null,
  }));
  const answer = {
    success: true,
    data,
    buckets: buckets30(result.items),
    asOn: result.asOn,
    basis: result.basis,
  };
  if (result.note) answer.note = result.note;
  return answer;
}

const CASH_GROUPS = ['Cash-in-Hand', 'Bank Accounts', 'Bank OD A/c', 'Bank OCC A/c'];
const INVEST_GROUPS = ['Fixed Assets', 'Investments'];
const FINANCE_GROUPS = ['Capital Account', 'Loans (Liability)', 'Secured Loans', 'Unsecured Loans', 'Bank OD A/c'];
const MAX_GROUP_DEPTH = 20;
const UNCLASSIFIED_ROW = 'Unclassified (no contra ledger on the voucher)';

/**
 * Each ledger's cash flag and activity from its group chain (own group up to the primary group):
 * Fixed Assets / Investments -> investing, Capital / any Loan group -> financing, everything else -> operating.
 */
async function ledgerCashInfo() {
  const groups = await AccountGroup.findAll();
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const groupChain = (groupId) => {
    const names = [];
    let group = groupsById.get(groupId);
    let depth = 0;
    while (group && depth++ < MAX_GROUP_DEPTH) {
      names.push(group.name);
      group = group.parentId ? groupsById.get(group.parentId) : null;
    }
    return names;
  };
  const ledgers = await AccountLedger.findAll();
  const info = new Map();
  for (const ledger of ledgers) {
    const chain = groupChain(ledger.groupId);
    const isCash = chain.some((name) => CASH_GROUPS.includes(name));
    let activity = 'operating';
    if (chain.some((name) => INVEST_GROUPS.includes(name))) activity = 'investing';
    else if (chain.some((name) => FINANCE_GROUPS.includes(name))) activity = 'financing';
    info.set(ledger.id, {
      name: ledger.name,
      isCash,
      activity,
      chain,
    });
  }
  return info;
}

/** The opening is summed in SQL; only the period's vouchers that touch a cash / bank ledger are read. */
async function cashVouchers(cashLedgerIds, from, to) {
  const cashIdList = cashLedgerIds.join(',') || '0';
  const select = (sql, replacements) => Voucher.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
  const openingRow =
    (
      await select(
        `SELECT sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE -d.amount END) m FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      WHERE d.ledgerId IN (${cashIdList}) AND substr(v.date, 1, 10) < ?`,
        [from],
      )
    )[0] || {};
  const lines = await select(
    `SELECT d.voucherId, d.ledgerId, d.dc, d.amount, v.date FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
      WHERE substr(v.date, 1, 10) >= ? AND substr(v.date, 1, 10) <= ?
      AND d.voucherId IN (SELECT voucherId FROM VoucherDetails WHERE ledgerId IN (${cashIdList}))
      ORDER BY v.date, v.id, d.id`,
    [from, to],
  );
  const vouchersById = new Map();
  for (const line of lines) {
    if (!vouchersById.has(line.voucherId)) vouchersById.set(line.voucherId, { date: line.date, details: [] });
    vouchersById.get(line.voucherId).details.push(line);
  }
  return { opening: parseFloat(openingRow.m) || 0, vouchers: [...vouchersById.values()] };
}

// cash movement of one voucher: Dr on a cash ledger brings cash in, Cr takes it out
const cashMovement = (voucher, info) =>
  (voucher.details || []).reduce((sum, line) => {
    const ledger = info.get(line.ledgerId);
    if (!ledger || !ledger.isCash) return sum;
    const amount = parseFloat(line.amount) || 0;
    return sum + (line.dc === 'Dr' ? amount : -amount);
  }, 0);

function classifyCashFlows(vouchers, info, from, to, openingFromSql) {
  let opening = openingFromSql;
  let unclassified = 0;
  const buckets = { operating: new Map(), investing: new Map(), financing: new Map() };
  const addRow = (activity, name, amount) => buckets[activity].set(name, (buckets[activity].get(name) || 0) + amount);
  for (const voucher of vouchers) {
    const day = String(voucher.date || '').slice(0, 10);
    const move = cashMovement(voucher, info);
    if (!move) continue; // a voucher that never touches cash is not a cash flow
    if (day < from) {
      opening += move;
      continue;
    }
    if (day > to) continue;
    // the cash movement is split across the non-cash lines of the same voucher, by their own share
    const others = (voucher.details || []).filter((line) => {
      const ledger = info.get(line.ledgerId);
      return ledger && !ledger.isCash;
    });
    const othersTotal = others.reduce((sum, line) => sum + Math.abs(parseFloat(line.amount) || 0), 0);
    if (!others.length || !othersTotal) {
      unclassified += move;
      addRow('operating', UNCLASSIFIED_ROW, move);
      continue;
    }
    let placed = 0;
    others.forEach((line, index) => {
      const ledger = info.get(line.ledgerId);
      const share =
        index === others.length - 1
          ? move - placed // the last line absorbs the rounding
          : Math.round(move * (Math.abs(parseFloat(line.amount) || 0) / othersTotal) * 100) / 100;
      placed += share;
      addRow(ledger.activity, ledger.name, share);
    });
  }
  return { opening, unclassified, buckets };
}

function cashFlowSection(buckets, key, label) {
  const children = [...buckets[key].entries()]
    .map(([name, amount]) => ({ id: key + '-' + name, name, amount: round2(amount) }))
    .filter((child) => child.amount !== 0)
    .sort((first, second) => Math.abs(second.amount) - Math.abs(first.amount));
  const amount = round2(children.reduce((sum, child) => sum + child.amount, 0));
  return {
    id: key,
    name: label,
    amount,
    type: amount < 0 ? 'outflow' : 'inflow',
    children,
  };
}

/**
 * Cash flow statement from the ledger: every voucher line that moves a Cash-in-Hand or Bank ledger is real cash, and
 * the other side of that voucher decides the activity. Opening + net must equal closing; the answer carries all three.
 */
export async function cashFlow(query) {
  const to = query.to || todayIso();
  const from = query.from || new Date(new Date(to).getFullYear(), 0, 1).toISOString().slice(0, 10);
  const info = await ledgerCashInfo();
  const cashLedgerIds = [...info.entries()]
    .filter(([, ledger]) => ledger.isCash)
    .map(([id]) => Number(id))
    .filter(Number.isFinite);
  const { opening: sqlOpening, vouchers } = await cashVouchers(cashLedgerIds, from, to);
  const { opening, unclassified, buckets } = classifyCashFlows(vouchers, info, from, to, sqlOpening);
  const data = [
    cashFlowSection(buckets, 'operating', 'Operating Activities'),
    cashFlowSection(buckets, 'investing', 'Investing Activities'),
    cashFlowSection(buckets, 'financing', 'Financing Activities'),
  ];
  const net = round2(data.reduce((sum, section) => sum + section.amount, 0));
  const closing = round2(opening + net);
  const cashLedgers = [...info.values()].filter((ledger) => ledger.isCash).map((ledger) => ledger.name);
  return {
    success: true,
    from,
    to,
    data,
    net,
    opening: round2(opening),
    closing,
    check: {
      opening: round2(opening),
      net,
      closing,
      balances: Math.abs(round2(opening) + net - closing) < 0.01,
    },
    cashLedgers,
    unclassified: round2(unclassified),
    note: cashLedgers.length
      ? 'Built from every voucher line that moves ' + cashLedgers.length + ' cash / bank ledger(s).'
      : 'No ledger sits under Cash-in-Hand or Bank Accounts yet, so there is no cash to report. Create your bank and cash ledgers under those groups first.',
  };
}

/** The open bills of one party for the Bill-by-Bill Allocation grid (same open items as the Outstanding report). */
export async function pendingBills(query) {
  const ledgerId = parseInt(query.ledgerId, 10);
  const { items, basis, asOn } = await openItems({ type: query.type || 'receivable', asOn: query.asOn, ledgerId });
  const bills = items.filter((item) => item.ledgerId === ledgerId);
  const ledger = await AccountLedger.findByPk(ledgerId);
  const pendingOf = (rows) => Math.round(rows.reduce((sum, item) => sum + item.pending, 0) * 100) / 100;
  return {
    success: true,
    asOn,
    basis,
    ledger: ledger
      ? {
          id: ledger.id,
          name: ledger.name,
          creditDays: parseInt(ledger.creditDays, 10) || 0,
          creditLimit: parseFloat(ledger.creditLimit) || 0,
        }
      : null,
    balance: pendingOf(bills),
    balanceSide: String(query.type || 'receivable').toLowerCase() === 'payable' ? 'Cr' : 'Dr',
    // on-account lines (iCAFFE receipts not set against a bill) count in the balance but are not bills to settle
    onAccount: pendingOf(bills.filter((item) => item.onAccount)),
    bills: bills
      .filter((item) => !item.onAccount)
      .map((item) => ({
        voucherId: item.voucherId,
        refNo: item.refNo,
        billNo: item.billNo,
        jobNo: item.jobNo,
        date: item.date,
        dueDate: item.dueDate,
        amount: item.amount,
        pending: item.pending,
        overdueDays: item.overdueDays,
      })),
  };
}

function groupFamilyIds(groups, roots) {
  const ids = new Set(roots.map((group) => group.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const group of groups) {
      if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
        ids.add(group.id);
        grew = true;
      }
    }
  }
  return ids;
}

/** The real ledgers under the named groups (and every group nested below them), e.g. the bank dropdown. */
export async function ledgersByGroup(groupsQuery) {
  const wanted = String(groupsQuery || 'Bank Accounts,Cash-in-Hand')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const groups = await AccountGroup.findAll();
  const roots = groups.filter((group) => wanted.includes(String(group.name).toLowerCase()));
  if (!roots.length) {
    return { success: true, data: [], note: 'No group named ' + groupsQuery + ' in the chart of accounts yet.' };
  }
  const ids = groupFamilyIds(groups, roots);
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const ledgers = await AccountLedger.findAll({ where: { groupId: { [Op.in]: [...ids] } }, order: [['name', 'ASC']] });
  return {
    success: true,
    data: ledgers.map((ledger) => ({
      id: ledger.id,
      name: ledger.name,
      group: (groupsById.get(ledger.groupId) || {}).name || '',
      bankAccount: ledger.bankAccount || '',
      bankIfsc: ledger.bankIfsc || '',
      gstin: ledger.gstin || '',
      email: ledger.email || '',
      phone: ledger.phone || '',
      creditDays: parseInt(ledger.creditDays, 10) || 0,
      creditLimit: parseFloat(ledger.creditLimit) || 0,
    })),
  };
}
