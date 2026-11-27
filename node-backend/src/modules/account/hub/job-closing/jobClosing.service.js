import { VALID_VOUCHER, runSql, selectRows } from '../shared/hubQuery.service.js';
import { nowIso, round2, toNumber, todayIso } from '../shared/hubFormat.service.js';
import { loadGroupTree, natureGroupIds } from '../shared/groupTree.service.js';
import { ensureMasterTable } from '../shared/masterDefinitions.service.js';

// Job closing: income / expense / profit of every job no found on vouchers; closing locks the job for new vouchers.

/** Used before any voucher is saved: is this job closed? (false when it cannot be read) */
export async function isJobClosed(jobNo) {
  try {
    if (!jobNo) return false;
    await ensureMasterTable('jobclosing');
    const rows = await selectRows(
      'SELECT id FROM AccJobClosings WHERE upper(trim(jobNo)) = upper(trim(?)) AND coalesce(isActive, 1) = 1',
      [jobNo],
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

const emptyJob = (jobNo) => ({
  jobNo,
  income: 0,
  expense: 0,
  vouchers: new Set(),
  first: null,
  last: null,
  sales: 0,
  purchase: 0,
});

// Reads every voucher line that carries a job no (the whole history): one of the heavy reads of the accounts screens
async function jobTotals() {
  const groupTree = await loadGroupTree();
  const incomeGroups = natureGroupIds(groupTree, 'Income');
  const expenseGroups = natureGroupIds(groupTree, 'Expenses');
  const lines =
    await selectRows(`SELECT upper(trim(v.jobNo)) jobNo, v.date, v.id vid, t.baseType, d.dc, d.amount, l.groupId FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId
        JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId WHERE ${VALID_VOUCHER} AND coalesce(v.jobNo, '') <> ''`);
  const jobs = new Map();
  const jobOf = (jobNo) => {
    if (!jobs.has(jobNo)) jobs.set(jobNo, emptyJob(jobNo));
    return jobs.get(jobNo);
  };
  for (const line of lines) {
    const job = jobOf(line.jobNo);
    const signed = line.dc === 'Dr' ? toNumber(line.amount) : -toNumber(line.amount);
    if (incomeGroups.has(line.groupId)) job.income -= signed;
    if (expenseGroups.has(line.groupId)) job.expense += signed;
    job.vouchers.add(line.vid);
    if (!job.first || line.date < job.first) job.first = line.date;
    if (!job.last || line.date > job.last) job.last = line.date;
    if (line.baseType === 'Sales') job.sales = 1;
    if (line.baseType === 'Purchase') job.purchase = 1;
  }
  return { jobs, jobOf };
}

function jobRow(job, closing) {
  const income = round2(job.income);
  const expense = round2(job.expense);
  const profit = round2(income - expense);
  return {
    jobNo: job.jobNo,
    income,
    expense,
    profit,
    margin: income ? Math.round((profit / income) * 1000) / 10 : null,
    vouchers: job.vouchers.size,
    first: job.first,
    last: job.last,
    billed: !!job.sales,
    hasCost: !!job.purchase,
    status: closing ? 'CLOSED' : 'OPEN',
    closedOn: closing ? closing.closedOn : null,
    closedBy: closing ? closing.closedBy : '',
    remarks: closing ? closing.remarks : '',
    jobType: closing ? closing.jobType : '',
  };
}

/** Every job (and every closed one) with its figures and closing state, latest activity first. */
export async function listJobs(searchText) {
  await ensureMasterTable('jobclosing');
  const { jobs, jobOf } = await jobTotals();
  const closings = await selectRows('SELECT * FROM AccJobClosings WHERE coalesce(isActive, 1) = 1');
  const closingByJob = new Map(closings.map((row) => [String(row.jobNo).toUpperCase().trim(), row]));
  for (const jobNo of closingByJob.keys()) jobOf(jobNo);
  let rows = [...jobs.values()].map((job) => jobRow(job, closingByJob.get(job.jobNo)));
  const text = String(searchText || '')
    .trim()
    .toUpperCase();
  if (text) rows = rows.filter((row) => row.jobNo.includes(text));
  rows.sort(
    (first, second) =>
      String(second.last || '').localeCompare(String(first.last || '')) || first.jobNo.localeCompare(second.jobNo),
  );
  return rows;
}

/** Closes a job (a new closing row) or re-opens it (action "reopen"); earlier closings are kept inactive. */
export async function closeOrReopenJob(body, userName) {
  await ensureMasterTable('jobclosing');
  const jobNo = String(body.jobNo || '')
    .trim()
    .toUpperCase();
  const stamp = nowIso();
  await runSql('UPDATE AccJobClosings SET isActive = 0, updatedAt = ? WHERE upper(trim(jobNo)) = ?', [stamp, jobNo]);
  if (body.action === 'reopen') return;
  await runSql(
    'INSERT INTO AccJobClosings (jobNo, jobType, closedOn, closedBy, remarks, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,1,?,?)',
    [jobNo, body.jobType || null, todayIso(), userName || body.closedBy || null, body.remarks || null, stamp, stamp],
  );
}
