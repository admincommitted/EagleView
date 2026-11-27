import { openingOn } from '../../../../../middlewares/branchScope.middleware.js';
import { lookAlikes } from '../../../../../utils/common/ledgerGuard.js';
import { VALID_VOUCHER, selectRows } from '../../shared/hubQuery.service.js';
import { dayBefore, round2, splitDrCr, toNumber, todayIso, yearMonths } from '../../shared/hubFormat.service.js';
import { loadGroupTree } from '../../shared/groupTree.service.js';
import { NO_MOVEMENT, ledgerMovements, signedOpening } from '../../shared/ledgerMovements.service.js';
import { findFinancialYear } from '../../shared/financialYear.service.js';

const byGroupThenName = (nameKey) => (first, second) =>
  first.group.localeCompare(second.group) || first[nameKey].localeCompare(second[nameKey]);

// List Of Account: every ledger with its group path and closing balance
export async function listOfAccounts(params) {
  const { path } = await loadGroupTree();
  const ledgers = await selectRows('SELECT * FROM AccountLedgers ORDER BY name');
  const movements = await ledgerMovements(null, params.asOn || todayIso());
  const rows = ledgers
    .map((ledger) => {
      const movement = movements.get(ledger.id) || NO_MOVEMENT;
      const closing = splitDrCr(signedOpening(ledger) + movement.dr - movement.cr);
      return {
        _l: ledger.id,
        group: path(ledger.groupId).join(' > '),
        ledger: ledger.name,
        gstin: ledger.gstin || '',
        pan: ledger.pan || '',
        opening: openingOn() ? round2(ledger.openingBalance) : 0,
        openingType: ledger.balanceType,
        closingDr: closing.dr,
        closingCr: closing.cr,
      };
    })
    .sort(byGroupThenName('ledger'));
  return {
    columns: [
      ['group', 'Group'],
      ['ledger', 'Account'],
      ['gstin', 'GSTIN'],
      ['pan', 'PAN'],
      ['opening', 'Opening', 'money'],
      ['openingType', 'Dr/Cr'],
      ['closingDr', 'Closing Dr', 'money'],
      ['closingCr', 'Closing Cr', 'money'],
    ],
    rows,
    totals: ['closingDr', 'closingCr'],
  };
}

// Monthly Ledger Summary: opening, Dr, Cr and closing of one ledger month by month
export async function monthlyLedger(params) {
  if (!params.ledgerId) return { columns: [['month', 'Month']], rows: [], note: 'Select a ledger' };
  const year = await findFinancialYear(params.fyId);
  const ledger = (await selectRows('SELECT * FROM AccountLedgers WHERE id = ?', [params.ledgerId]))[0];
  if (!ledger) return { columns: [['month', 'Month']], rows: [], note: 'Ledger not found' };
  const before = (await ledgerMovements(null, dayBefore(year.startDate))).get(ledger.id) || NO_MOVEMENT;
  const monthTotals = await selectRows(
    `SELECT substr(v.date, 1, 7) m, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr
        FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${VALID_VOUCHER} AND d.ledgerId = ? AND v.date >= ? AND v.date <= ? GROUP BY 1`,
    [ledger.id, year.startDate, year.endDate],
  );
  const totalsByMonth = new Map(monthTotals.map((row) => [row.m, row]));
  let balance = signedOpening(ledger) + before.dr - before.cr;
  const rows = yearMonths(year.startDate).map(({ key, date }) => {
    const month = totalsByMonth.get(key) || { dr: 0, cr: 0 };
    const opening = splitDrCr(balance);
    balance += toNumber(month.dr) - toNumber(month.cr);
    const closing = splitDrCr(balance);
    return {
      month: date.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      openingDr: opening.dr,
      openingCr: opening.cr,
      debit: round2(month.dr),
      credit: round2(month.cr),
      closingDr: closing.dr,
      closingCr: closing.cr,
    };
  });
  return {
    title: ledger.name,
    columns: [
      ['month', 'Month'],
      ['openingDr', 'Opening Dr', 'money'],
      ['openingCr', 'Opening Cr', 'money'],
      ['debit', 'Debit', 'money'],
      ['credit', 'Credit', 'money'],
      ['closingDr', 'Closing Dr', 'money'],
      ['closingCr', 'Closing Cr', 'money'],
    ],
    rows,
    totals: ['debit', 'credit'],
  };
}

const exactGroupIds = (groups, name) =>
  groups.filter((group) => group.name.toLowerCase().trim() === name).map((group) => group.id);

function partyGroupRoots(groups, type) {
  if (type === 'creditors') return exactGroupIds(groups, 'sundry creditors');
  if (type === 'debtors') return exactGroupIds(groups, 'sundry debtors');
  return [...exactGroupIds(groups, 'sundry debtors'), ...exactGroupIds(groups, 'sundry creditors')];
}

// Party Ledger Balance (iCAFFE "Party Ledger Balance - Group Wise"): Account Id, Account Name, closing Dr / Cr, by group
export async function partyBalance(params) {
  const { groups, descendants, path } = await loadGroupTree();
  const partyGroupIds = descendants(partyGroupRoots(groups, params.type));
  const ledgers = (await selectRows('SELECT * FROM AccountLedgers')).filter((ledger) =>
    partyGroupIds.has(ledger.groupId),
  );
  const movements = await ledgerMovements(null, params.asOn || todayIso());
  const rows = ledgers
    .map((ledger) => {
      const movement = movements.get(ledger.id) || NO_MOVEMENT;
      const closing = splitDrCr(signedOpening(ledger) + movement.dr - movement.cr);
      return {
        _l: ledger.id,
        group: path(ledger.groupId).slice(-1)[0] || '',
        accountId: ledger.accountCode || 'ACC/' + ledger.id,
        party: ledger.name,
        gstin: ledger.gstin || '',
        debit: closing.dr,
        credit: closing.cr,
      };
    })
    .filter((row) => params.all === '1' || row.debit || row.credit)
    .sort(byGroupThenName('party'));
  return {
    subtitle: 'Party Ledger Balance - Group Wise',
    groupBy: 'group',
    columns: [
      ['group', 'Group'],
      ['accountId', 'Account Id'],
      ['party', 'Account Name'],
      ['gstin', 'GSTIN'],
      ['debit', 'Debit', 'money', 'Closing Balance'],
      ['credit', 'Credit', 'money', 'Closing Balance'],
    ],
    rows,
    totals: ['debit', 'credit'],
  };
}

// Ledger Group-wise (iCAFFE "Consolidated Trial Balance")
export async function groupWise(params) {
  const { path, descendants } = await loadGroupTree();
  const { from, to } = params;
  const groupIds = params.groupId ? descendants([Number(params.groupId)]) : null;
  const ledgers = (await selectRows('SELECT * FROM AccountLedgers')).filter(
    (ledger) => !groupIds || groupIds.has(ledger.groupId),
  );
  const before = await ledgerMovements(null, dayBefore(from));
  const during = await ledgerMovements(from, to);
  const rows = ledgers
    .map((ledger) => {
      const earlier = before.get(ledger.id) || NO_MOVEMENT;
      const inPeriod = during.get(ledger.id) || NO_MOVEMENT;
      const openingBalance = signedOpening(ledger) + earlier.dr - earlier.cr;
      const opening = splitDrCr(openingBalance);
      const closing = splitDrCr(openingBalance + inPeriod.dr - inPeriod.cr);
      return {
        _l: ledger.id,
        group: path(ledger.groupId).slice(-1)[0] || '',
        ledger: ledger.name,
        openingDr: opening.dr,
        openingCr: opening.cr,
        debit: round2(inPeriod.dr),
        credit: round2(inPeriod.cr),
        closingDr: closing.dr,
        closingCr: closing.cr,
      };
    })
    .filter((row) => params.all === '1' || row.openingDr || row.openingCr || row.debit || row.credit)
    .sort(byGroupThenName('ledger'));
  return {
    subtitle: 'Consolidated Trial Balance',
    groupBy: 'group',
    columns: [
      ['group', 'Group'],
      ['ledger', 'Account Name'],
      ['openingDr', 'Debit', 'money', 'Opening Balance'],
      ['openingCr', 'Credit', 'money', 'Opening Balance'],
      ['debit', 'Debit', 'money', 'Transactions'],
      ['credit', 'Credit', 'money', 'Transactions'],
      ['closingDr', 'Debit', 'money', 'Closing Balance'],
      ['closingCr', 'Credit', 'money', 'Closing Balance'],
    ],
    rows,
    totals: ['openingDr', 'openingCr', 'debit', 'credit', 'closingDr', 'closingCr'],
  };
}

// Look-alike ledgers (same name but for spaces / dots, same GSTIN, one party on two accounts) - to clean up / merge
export async function ledgerLookalikes() {
  const lookAlikeGroups = await lookAlikes();
  const rows = [];
  for (const group of lookAlikeGroups) {
    for (const account of group.accounts) {
      rows.push({
        _l: account.id,
        check: group.check,
        value: group.value,
        ledger: account.name,
        gstin: account.gstin || '',
        group: account.groupName || '',
        icaffeId: account.icaffeId || '',
      });
    }
  }
  return {
    columns: [
      ['check', 'Check'],
      ['value', 'Same value'],
      ['ledger', 'Account'],
      ['gstin', 'GSTIN'],
      ['group', 'Group'],
      ['icaffeId', 'iCAFFE A/c'],
    ],
    rows,
    note: 'Accounts that can be mixed up. Merge the real duplicates (Masters > Merge Account) and correct wrong GSTINs; a voucher never picks one of these by itself - the account has to be chosen.',
  };
}
