import { QueryTypes } from 'sequelize';
import { Op, sequelize } from '../../config/database.js';
import { AccountGroup, CreditFollowUp, ExportJob, ImportJob } from '../../models/index.js';
import { q as readQuery } from '../../utils/db/readDb.js';
import { openItems } from '../../utils/common/openItems.js';

const TOP_CLIENTS = 10;
const TOP_LANES = 10;
const JOBS_SHOWN = 25;
const MAX_GROUP_DEPTH = 20;
const FOLLOW_UP_NOTE_LENGTH = 160;
const FIRST_FINANCIAL_MONTH = 3;
const LANE_ARROW = ' → ';

const round2 = (value) => Math.round(value * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

/** 1 April of the financial year the day falls in. */
const financialYearStart = (day) =>
  (new Date(day).getMonth() < FIRST_FINANCIAL_MONTH ? new Date(day).getFullYear() - 1 : new Date(day).getFullYear()) +
  '-04-01';

/** The first filled value among the row's keys (dynamic screen columns are read off the row itself). */
function firstFilledField(row, keys) {
  for (const key of keys) {
    const value = row[key] || (row.dataValues || {})[key];
    if (value) return String(value);
  }
  return '';
}

const MIS_VOUCHERS_SQL = `SELECT v.id, v.jobNo, v.totalAmount, t.baseType FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId
            WHERE v.date BETWEEN ? AND ? AND t.baseType IN ('Sales', 'Purchase')`;
// the party of a sales voucher: its largest Dr line
const SALES_PARTY_SQL = `SELECT voucherId, ledgerName FROM (SELECT d.voucherId, l.name ledgerName,
                row_number() OVER (PARTITION BY d.voucherId ORDER BY CAST(d.amount AS REAL) DESC, d.id) rn
              FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
              LEFT JOIN AccountLedgers l ON l.id = d.ledgerId
              WHERE v.date BETWEEN ? AND ? AND t.baseType = 'Sales' AND d.dc = 'Dr') x WHERE rn = 1`;

const voucherAmount = (voucher) => parseFloat(voucher.totalAmount) || 0;

function sumByKey(vouchers, keyOf) {
  const totals = new Map();
  vouchers.forEach((voucher) => {
    const key = keyOf(voucher);
    if (key) totals.set(key, (totals.get(key) || 0) + voucherAmount(voucher));
  });
  return totals;
}

const IMPORT_MODE_KEYS = ['shipmentMode', 'transportMode', 'modeOfTransport'];
const IMPORT_FROM_KEYS = ['portOfOrigin', 'portOfShipment', 'portOfLoading', 'autoField_22'];
const IMPORT_TO_KEYS = ['portCode', 'portName', 'customHouseCode', 'autoField_2'];
const EXPORT_FROM_KEYS = ['loadingPortCode', 'customsPortCode', 'portCode', 'loadingPortName'];
const EXPORT_TO_KEYS = ['destPortCode', 'discPortCode', 'PortOfDischarge', 'destPortName', 'discPortName'];

const laneOf = (job, fromKeys, toKeys) =>
  [firstFilledField(job, fromKeys), firstFilledField(job, toKeys)].filter(Boolean).join(LANE_ARROW);

/** Mode and lane of each booked job (the column names the models declare, with the screen's dynamic ones as fallbacks). */
async function modeAndLaneOfJobs(jobNumbers) {
  const importJobs = await ImportJob.findAll({ where: { jobNo: { [Op.in]: jobNumbers } } }).catch(() => []);
  const exportJobs = await ExportJob.findAll({ where: { jobNo: { [Op.in]: jobNumbers } } }).catch(() => []);
  const details = new Map();
  importJobs.forEach((job) =>
    details.set(job.jobNo, {
      mode: firstFilledField(job, IMPORT_MODE_KEYS),
      lane: laneOf(job, IMPORT_FROM_KEYS, IMPORT_TO_KEYS),
    }),
  );
  exportJobs.forEach((job) =>
    details.set(job.jobNo, {
      mode: firstFilledField(job, IMPORT_MODE_KEYS),
      lane: laneOf(job, EXPORT_FROM_KEYS, EXPORT_TO_KEYS),
    }),
  );
  return details;
}

async function jobProfits(revenueByJob, costByJob) {
  const jobNumbers = [...new Set([...costByJob.keys(), ...revenueByJob.keys()])];
  if (!jobNumbers.length) return [];
  const details = await modeAndLaneOfJobs(jobNumbers);
  return jobNumbers
    .map((jobNo) => {
      const revenue = revenueByJob.get(jobNo) || 0;
      const cost = costByJob.get(jobNo) || 0;
      const detail = details.get(jobNo) || { mode: '', lane: '' };
      return {
        jobNo,
        revenue: round2(revenue),
        cost: round2(cost),
        profit: round2(revenue - cost),
        mode: detail.mode,
        lane: detail.lane,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

/** Lanes, only from jobs that have both a lane and something booked. */
function laneProfits(jobRows) {
  const byLane = new Map();
  jobRows.forEach((job) => {
    if (!job.lane) return;
    const lane = byLane.get(job.lane) || { lane: job.lane, revenue: 0, cost: 0, jobs: 0 };
    lane.revenue += job.revenue;
    lane.cost += job.cost;
    lane.jobs += 1;
    byLane.set(job.lane, lane);
  });
  return [...byLane.values()]
    .map((lane) => ({ ...lane, profit: round2(lane.revenue - lane.cost) }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, TOP_LANES);
}

/**
 * GET /mis?from&to: the Director MIS from the books. Revenue = Sales vouchers, cost = Purchase vouchers; job-wise and
 * lane-wise profit only for jobs whose vouchers carry a job number. Added up in SQL on the read-only connection (a
 * year is 40,000+ vouchers).
 */
export async function directorMis(query) {
  const to = query.to || today();
  const from = query.from || new Date(new Date(to).getFullYear(), 0, 1).toISOString().slice(0, 10);

  const vouchers = await readQuery(MIS_VOUCHERS_SQL, [from, to]);
  const partyOfVoucher = new Map(
    (await readQuery(SALES_PARTY_SQL, [from, to])).map((row) => [row.voucherId, row.ledgerName]),
  );
  const sales = vouchers.filter((voucher) => voucher.baseType === 'Sales');
  const purchases = vouchers.filter((voucher) => voucher.baseType === 'Purchase');
  const revenue = sales.reduce((sum, voucher) => sum + voucherAmount(voucher), 0);
  const cost = purchases.reduce((sum, voucher) => sum + voucherAmount(voucher), 0);
  const profit = revenue - cost;

  const revenueByClient = sumByKey(sales, (voucher) => partyOfVoucher.get(voucher.id) || 'Unallocated');
  const costByJob = sumByKey(purchases, (voucher) => voucher.jobNo);
  const revenueByJob = sumByKey(sales, (voucher) => voucher.jobNo);
  const topClients = [...revenueByClient.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CLIENTS)
    .map(([name, clientRevenue]) => ({ name, revenue: round2(clientRevenue) }));
  const jobRows = await jobProfits(revenueByJob, costByJob);

  return {
    success: true,
    from,
    to,
    kpis: {
      revenue: round2(revenue),
      cost: round2(cost),
      profit: round2(profit),
      marginPct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
      salesVouchers: sales.length,
      purchaseVouchers: purchases.length,
    },
    topClients,
    jobs: jobRows.slice(0, JOBS_SHOWN),
    lanes: laneProfits(jobRows),
    unlinked: {
      salesWithoutJob: sales.filter((voucher) => !voucher.jobNo).length,
      purchasesWithoutJob: purchases.filter((voucher) => !voucher.jobNo).length,
    },
  };
}

const BILLED_JOBS_SQL =
  "SELECT DISTINCT v.jobNo FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE t.baseType = 'Sales' AND v.jobNo IS NOT NULL AND v.jobNo <> ''";
const CLIENT_KEYS = ['autoField_4', 'nameOfImporter', 'importerName', 'shipperName', 'exporterName', 'partyName'];
const REFERENCE_KEYS = ['hawbNo', 'mawbNo', 'blNo', 'beNo', 'sbNo'];
const DESTINATION_KEYS = ['portCode', 'customHouseCode', 'portOfDestination', 'autoField_2'];
const UNBILLED_NOTE =
  'A job counts as billed when a Sales voucher carries its job number. Jobs with no date are listed too (noDate) so nothing silently drops out of the range.';

/**
 * The job as an unbilled row, or null when it is billed or filtered out. A job whose date was never filled stays in
 * (flagged noDate): that is exactly the job most likely to be forgotten.
 */
function unbilledRow(job, kind, filters) {
  const jobNo = firstFilledField(job, ['jobNo']);
  if (!jobNo || filters.billed.has(jobNo)) return null;
  const date = firstFilledField(job, ['jobDate', 'date']);
  const day = String(date || '').slice(0, 10);
  if (date && !(day && day >= filters.from && day <= filters.to)) return null;
  const client = firstFilledField(job, CLIENT_KEYS);
  if (filters.party && !client.toLowerCase().includes(filters.party)) return null;
  const mode = firstFilledField(job, ['shipmentMode', 'transportMode']);
  if (filters.mode && !mode.toUpperCase().startsWith(filters.mode[0])) return null;
  return {
    id: jobNo,
    jobNo,
    kind,
    date,
    client,
    mode,
    noDate: !date,
    refNo: firstFilledField(job, REFERENCE_KEYS),
    dest: firstFilledField(job, DESTINATION_KEYS),
    weight: firstFilledField(job, ['grossWt', 'grossWeight']),
  };
}

/** GET /unbilled-jobs?from&to&party&mode: jobs no Sales voucher carries the job number of. */
export async function unbilledJobs(query) {
  const to = query.to || today();
  const from = query.from || '1900-01-01';
  const billedJobs = await sequelize.query(BILLED_JOBS_SQL, { type: QueryTypes.SELECT });
  const filters = {
    from,
    to,
    party: String(query.party || '')
      .trim()
      .toLowerCase(),
    mode: String(query.mode || '')
      .trim()
      .toUpperCase(),
    billed: new Set(billedJobs.map((voucher) => String(voucher.jobNo))),
  };
  const rows = [];
  (await ImportJob.findAll().catch(() => [])).forEach((job) => {
    const row = unbilledRow(job, 'IMPORT', filters);
    if (row) rows.push(row);
  });
  (await ExportJob.findAll().catch(() => [])).forEach((job) => {
    const row = unbilledRow(job, 'EXPORT', filters);
    if (row) rows.push(row);
  });
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { success: true, data: rows, from, to, undated: rows.filter((row) => row.noDate).length, note: UNBILLED_NOTE };
}

/** Direct cost vs overhead from the ledger's account group chain (not guessed from the head's name). */
function expenseKindResolver(groups) {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const chainOf = (groupId) => {
    const chain = [];
    let group = groupById.get(groupId);
    let depth = 0;
    while (group && depth++ < MAX_GROUP_DEPTH) {
      chain.push(group);
      group = group.parentId ? groupById.get(group.parentId) : null;
    }
    return chain;
  };
  return (groupId) => {
    const chain = chainOf(groupId);
    const names = chain.map((group) => group.name);
    // "Indirect Expenses" contains "direct Expense": the overhead test runs first and both match the whole group name
    if (names.some((name) => /^\s*indirect\s+expense/i.test(name))) return 'Admin (overhead)';
    if (names.some((name) => /^\s*(direct\s+expense|purchase\s+account)/i.test(name))) return 'Trade (direct cost)';
    const nature = chain.length ? chain[chain.length - 1].nature : '';
    if (nature === 'Expenses') return 'Expense (ungrouped)';
    return nature || 'Unclassified';
  };
}

const expenseLinesSql = (
  groupIds,
) => `SELECT v.id, v.date, v.voucherNumber, v.jobNo, v.refNo, t.name tname, t.baseType, d.amount, d.remarks, l.name lname, l.groupId
                FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN VoucherDetails d ON d.voucherId = v.id JOIN AccountLedgers l ON l.id = d.ledgerId
                WHERE v.date BETWEEN ? AND ? AND t.baseType IN ('Purchase', 'Payment', 'Journal') AND d.dc = 'Dr' AND l.groupId IN (${groupIds.join(',')})
                ORDER BY v.date DESC, v.id DESC, d.id`;
// the vendor of a voucher: its largest Cr line
const EXPENSE_VENDOR_SQL = `SELECT voucherId, lname FROM (SELECT d.voucherId, l.name lname,
                    row_number() OVER (PARTITION BY d.voucherId ORDER BY CAST(d.amount AS REAL) DESC, d.id) rn
                  FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId
                  WHERE v.date BETWEEN ? AND ? AND t.baseType IN ('Purchase', 'Payment', 'Journal') AND d.dc = 'Cr') x WHERE rn = 1`;
const EXPENSES_NOTE =
  'Direct cost vs overhead comes from each ledger’s account group (Direct Expenses / Purchase Accounts vs Indirect Expenses). ' +
  'A head sitting directly under no expense group shows as "Expense (ungrouped)" rather than being guessed at.';

async function expenseRows(from, to, groupIds, kindOf) {
  if (!groupIds.length) return [];
  const lines = await readQuery(expenseLinesSql(groupIds), [from, to]);
  const vendorOfVoucher = new Map(
    (await readQuery(EXPENSE_VENDOR_SQL, [from, to])).map((row) => [row.voucherId, row.lname]),
  );
  return lines.map((line) => ({
    date: String(line.date || '').slice(0, 10),
    vr: line.voucherNumber,
    voucherId: line.id,
    voucherKind: line.tname || line.baseType,
    vendor: vendorOfVoucher.get(line.id) || '',
    head: line.lname,
    amount: round2(parseFloat(line.amount) || 0),
    type: kindOf(line.groupId),
    jobNo: line.jobNo || '',
    refNo: line.refNo || '',
    remarks: line.remarks || '',
  }));
}

const sumOfAmounts = (rows) => round2(rows.reduce((sum, row) => sum + row.amount, 0));

/**
 * GET /expenses?from&to: the Expense & Purchase Register from the Purchase / Payment / Journal vouchers - only the Dr
 * lines on expense heads, read in SQL on the read-only connection.
 */
export async function expenseRegister(query) {
  const to = query.to || today();
  const from = query.from || financialYearStart(to);
  const groups = await AccountGroup.findAll();
  const kindOf = expenseKindResolver(groups);
  const expenseGroupIds = groups
    .filter((group) => /cost|overhead|Expense/i.test(kindOf(group.id)))
    .map((group) => Number(group.id))
    .filter(Number.isFinite);
  const rows = await expenseRows(from, to, expenseGroupIds, kindOf);

  const byHead = new Map();
  rows.forEach((row) => byHead.set(row.head, (byHead.get(row.head) || 0) + row.amount));
  return {
    success: true,
    from,
    to,
    data: rows,
    totals: {
      all: sumOfAmounts(rows),
      direct: sumOfAmounts(rows.filter((row) => /direct/i.test(row.type))),
      overhead: sumOfAmounts(rows.filter((row) => /overhead/i.test(row.type))),
      ungrouped: sumOfAmounts(rows.filter((row) => /ungrouped/i.test(row.type))),
    },
    byHead: [...byHead.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([head, amount]) => ({ head, amount: round2(amount) })),
    note: EXPENSES_NOTE,
  };
}

const BILLED_AND_COLLECTED_SQL = `SELECT d.ledgerId, l.name, CASE WHEN t.baseType = 'Sales' THEN 'B' ELSE 'R' END k, sum(d.amount) amt
            FROM Vouchers v JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN VoucherDetails d ON d.voucherId = v.id JOIN AccountLedgers l ON l.id = d.ledgerId
            WHERE v.date BETWEEN ? AND ? AND ((t.baseType = 'Sales' AND d.dc = 'Dr') OR (t.baseType IN ('Receipt', 'Contra') AND d.dc = 'Cr'))
            GROUP BY d.ledgerId, k`;
const NO_OVERDUE_YET = -99999;

const roundMoney = (value) => Math.round((value || 0) * 100) / 100;

function ageingBucket(days) {
  if (days == null) return '-';
  if (days <= 0) return 'Within terms';
  if (days <= 30) return '1-30 days';
  if (days <= 60) return '31-60 days';
  if (days <= 90) return '61-90 days';
  return '90+ days';
}

async function billedAndCollected(from, to, names) {
  const billed = new Map();
  const received = new Map();
  (await readQuery(BILLED_AND_COLLECTED_SQL, [from, to])).forEach((row) => {
    names.set(row.ledgerId, row.name);
    (row.k === 'B' ? billed : received).set(row.ledgerId, parseFloat(row.amt) || 0);
  });
  return { billed, received };
}

function pendingByParty(items, names) {
  const pending = new Map();
  const oldestOverdue = new Map();
  items.forEach((item) => {
    pending.set(item.ledgerId, (pending.get(item.ledgerId) || 0) + item.pending);
    oldestOverdue.set(item.ledgerId, Math.max(oldestOverdue.get(item.ledgerId) || NO_OVERDUE_YET, item.overdueDays));
    names.set(item.ledgerId, item.party);
  });
  return { pending, oldestOverdue };
}

async function lastFollowUpByParty() {
  const followUps = await CreditFollowUp.findAll({ order: [['createdAt', 'DESC']] });
  const latest = new Map();
  followUps.forEach((followUp) => {
    if (!latest.has(followUp.ledgerId)) latest.set(followUp.ledgerId, followUp);
  });
  return latest;
}

/**
 * GET /collection?from&to&asOn: client-wise billed (Sales) and collected (Receipt) in the period, and pending from the
 * same FIFO open-item calculation the Outstanding report uses, so the two screens cannot disagree.
 */
export async function collectionReport(query) {
  const asOn = query.asOn || today();
  const to = query.to || asOn;
  const from = query.from || financialYearStart(to);

  const { items, basis } = await openItems({ type: 'receivable', asOn });
  const names = new Map();
  const { billed, received } = await billedAndCollected(from, to, names);
  const { pending, oldestOverdue } = pendingByParty(items, names);
  const lastFollowUp = await lastFollowUpByParty();

  const ledgerIds = new Set([...billed.keys(), ...received.keys(), ...pending.keys()]);
  const data = [...ledgerIds]
    .map((ledgerId) => {
      const followUp = lastFollowUp.get(ledgerId);
      return {
        ledgerId,
        client: names.get(ledgerId) || '',
        billed: roundMoney(billed.get(ledgerId) || 0),
        collected: roundMoney(received.get(ledgerId) || 0),
        pending: roundMoney(pending.get(ledgerId) || 0),
        bucket: pending.has(ledgerId) ? ageingBucket(oldestOverdue.get(ledgerId)) : 'Cleared',
        oldestOverdueDays: pending.has(ledgerId) ? oldestOverdue.get(ledgerId) || 0 : null,
        lastFollowUp: followUp && followUp.createdAt ? new Date(followUp.createdAt).toISOString().slice(0, 10) : '',
        lastFollowUpNote: followUp ? String(followUp.note).slice(0, FOLLOW_UP_NOTE_LENGTH) : '',
        nextPromise: followUp && followUp.promiseDate && followUp.promiseMet !== true ? followUp.promiseDate : '',
      };
    })
    .filter((row) => row.billed || row.collected || row.pending)
    .sort((a, b) => b.pending - a.pending);

  return {
    success: true,
    from,
    to,
    asOn,
    data,
    basis,
    totals: {
      billed: roundMoney(data.reduce((sum, row) => sum + row.billed, 0)),
      collected: roundMoney(data.reduce((sum, row) => sum + row.collected, 0)),
      pending: roundMoney(data.reduce((sum, row) => sum + row.pending, 0)),
      clientsWithNoFollowUp: data.filter((row) => row.pending > 0 && !row.lastFollowUp).length,
    },
    note:
      'Billed and collected are the Sales and Receipt vouchers in the period. Pending is the open-item balance as on ' +
      asOn +
      ', which is a running balance and will not equal billed minus collected when the party owed money from before ' +
      from +
      '.',
  };
}
