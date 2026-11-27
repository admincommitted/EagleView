import { VALID_VOUCHER, runSql, selectRows } from '../shared/hubQuery.service.js';
import { daysBetween, nowIso, round2, toNumber, todayIso } from '../shared/hubFormat.service.js';
import { loadGroupTree } from '../shared/groupTree.service.js';
import { ensureTdsChallansTable } from '../shared/hubTables.service.js';
import { findFinancialYear } from '../shared/financialYear.service.js';

// TDS payable: deducted per month and section (Cr on TDS ledgers under Duties & Taxes) against the challans paid

const PAID_TOLERANCE = 0.5;
const SECTION_IN_TEXT = /\b19[0-9][A-Z]*\b/i;

/** TDS of a month is due on the 7th of the next month; March's on 30 April. */
const tdsDueDate = (month) => {
  const [year, monthNo] = month.split('-').map(Number);
  if (monthNo === 3) return year + '-04-30';
  return new Date(Date.UTC(year, monthNo, 7)).toISOString().slice(0, 10);
};

const TDS_LINE_COLUMNS =
  'd.voucherId, d.dc, d.amount, d.remarks, l.id ledgerId, l.name ledgerName, l.groupId, v.date, v.voucherNumber, v.jobNo, t.name typeName';
const TDS_LINE_JOINS =
  'FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId JOIN AccountLedgers l ON l.id = d.ledgerId';

// with the party and its TDS section; without them when TdsNatures cannot be read
async function tdsLedgerLines(from, to) {
  try {
    return await selectRows(
      `SELECT ${TDS_LINE_COLUMNS},
      (SELECT l2.name FROM VoucherDetails d2 JOIN AccountLedgers l2 ON l2.id = d2.ledgerId WHERE d2.voucherId = v.id AND lower(l2.name) NOT LIKE '%tds%' AND d2.dc = 'Cr' ORDER BY d2.amount DESC LIMIT 1) party,
      (SELECT n.section FROM VoucherDetails d3 JOIN AccountLedgers l3 ON l3.id = d3.ledgerId JOIN TdsNatures n ON n.id = l3.tdsNatureId WHERE d3.voucherId = v.id LIMIT 1) partySection
      ${TDS_LINE_JOINS}
      WHERE ${VALID_VOUCHER} AND lower(l.name) LIKE '%tds%' AND lower(l.name) NOT LIKE '%receivable%' AND v.date >= ? AND v.date <= ? ORDER BY v.date`,
      [from, to],
    );
  } catch {
    return selectRows(
      `SELECT ${TDS_LINE_COLUMNS}, NULL party, NULL partySection
      ${TDS_LINE_JOINS}
      WHERE ${VALID_VOUCHER} AND lower(l.name) LIKE '%tds%' AND v.date >= ? AND v.date <= ?`,
      [from, to],
    );
  }
}

// the section from the line's remarks, the TDS ledger's name, or the party's TDS nature
const sectionOf = (line) =>
  (String(line.remarks || '').match(SECTION_IN_TEXT) || String(line.ledgerName).match(SECTION_IN_TEXT) || [])[0] ||
  line.partySection ||
  'OTHER';

/** TDS ledger lines (under Duties & Taxes / Current Liabilities) of the period with month and section. */
async function tdsLines(from, to) {
  const { groups, descendants } = await loadGroupTree();
  const taxGroups = descendants(
    groups.filter((group) => /duties\s*&\s*taxes|current liabilities/i.test(group.name)).map((group) => group.id),
  );
  const lines = await tdsLedgerLines(from, to);
  return lines
    .filter((line) => taxGroups.has(line.groupId))
    .map((line) => ({
      ...line,
      month: String(line.date).slice(0, 7),
      section: String(sectionOf(line)).toUpperCase(),
      amount: round2(line.amount),
    }));
}

function monthSectionTotals(lines, challans) {
  const totals = new Map();
  const totalOf = (month, section) => {
    const key = month + '|' + section;
    if (!totals.has(key))
      totals.set(key, {
        month,
        section,
        deducted: 0,
        adjusted: 0,
        entries: 0,
        parties: new Set(),
        challans: [],
        paid: 0,
        interest: 0,
      });
    return totals.get(key);
  };
  for (const line of lines) {
    const total = totalOf(line.month, line.section);
    if (line.dc === 'Cr') {
      total.deducted = round2(total.deducted + line.amount);
      total.entries++;
      if (line.party) total.parties.add(line.party);
    } else total.adjusted = round2(total.adjusted + line.amount);
  }
  for (const challan of challans) {
    const total = totalOf(challan.month, String(challan.section || 'OTHER').toUpperCase());
    total.challans.push(challan);
    total.paid = round2(total.paid + toNumber(challan.amount));
    total.interest = round2(total.interest + toNumber(challan.interest));
  }
  return [...totals.values()];
}

function withDueState(total, today) {
  const net = round2(total.deducted - total.adjusted);
  const balance = round2(net - total.paid);
  const dueDate = tdsDueDate(total.month);
  let status = 'DUE';
  if (balance <= PAID_TOLERANCE) status = 'PAID';
  else if (today > dueDate) status = 'OVERDUE';
  return {
    ...total,
    parties: total.parties.size,
    net,
    balance,
    dueDate,
    status,
    daysLate: status === 'OVERDUE' ? daysBetween(dueDate, today) : 0,
  };
}

/** Month x section: deducted, adjusted, net, challans paid, balance and due state for the year. */
export async function tdsPayableSummary(requestedYearId) {
  await ensureTdsChallansTable();
  const year = await findFinancialYear(requestedYearId);
  const lines = await tdsLines(year.startDate, year.endDate);
  const challans = await selectRows('SELECT * FROM AccTdsChallans WHERE month >= ? AND month <= ? ORDER BY paidOn', [
    year.startDate.slice(0, 7),
    year.endDate.slice(0, 7),
  ]);
  const today = todayIso();
  const rows = monthSectionTotals(lines, challans)
    .map((total) => withDueState(total, today))
    .sort((first, second) => second.month.localeCompare(first.month) || first.section.localeCompare(second.section));
  return {
    fy: { name: year.name || year.code, startDate: year.startDate, endDate: year.endDate },
    rows,
    totals: {
      deducted: round2(rows.reduce((sum, row) => sum + row.net, 0)),
      paid: round2(rows.reduce((sum, row) => sum + row.paid, 0)),
      balance: round2(rows.reduce((sum, row) => sum + Math.max(0, row.balance), 0)),
      overdue: rows.filter((row) => row.status === 'OVERDUE').length,
    },
  };
}

/** The TDS lines of one month (YYYY-MM), of one section when given. */
export async function tdsMonthDetail(month, section) {
  const lines = await tdsLines(month + '-01', month + '-31');
  return lines.filter((line) => !section || line.section === String(section).toUpperCase());
}

export async function addTdsChallan(body, userName) {
  await ensureTdsChallansTable();
  const stamp = nowIso();
  await runSql(
    'INSERT INTO AccTdsChallans (month, section, challanNo, bsrCode, paidOn, amount, interest, remarks, byUser, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [
      body.month,
      String(body.section || 'OTHER').toUpperCase(),
      String(body.challanNo).trim(),
      body.bsrCode || null,
      body.paidOn,
      Number(body.amount),
      Number(body.interest) || 0,
      body.remarks || null,
      userName,
      stamp,
      stamp,
    ],
  );
}

export async function deleteTdsChallan(id) {
  await ensureTdsChallansTable();
  await runSql('DELETE FROM AccTdsChallans WHERE id = ?', [id]);
}
