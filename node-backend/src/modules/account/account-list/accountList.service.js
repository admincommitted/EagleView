import { sequelize } from '../../../config/database.js';
import { AccountGroup, AccountLedger, VoucherDetail } from '../../../models/index.js';

// the standard Tally primary groups
const PRIMARY_GROUPS = [
  { name: 'Fixed Assets', nature: 'Assets', isBuiltIn: true },
  { name: 'Investments', nature: 'Assets', isBuiltIn: true },
  { name: 'Current Assets', nature: 'Assets', isBuiltIn: true },
  { name: 'Miscellaneous Expenses (AS)', nature: 'Assets', isBuiltIn: true },
  { name: 'Capital Account', nature: 'Liabilities', isBuiltIn: true },
  { name: 'Loans (Liability)', nature: 'Liabilities', isBuiltIn: true },
  { name: 'Current Liabilities', nature: 'Liabilities', isBuiltIn: true },
  { name: 'Suspense A/c', nature: 'Liabilities', isBuiltIn: true },
  { name: 'Branch / Divisions', nature: 'Liabilities', isBuiltIn: true },
  { name: 'Sales Accounts', nature: 'Income', isBuiltIn: true },
  { name: 'Direct Incomes', nature: 'Income', isBuiltIn: true },
  { name: 'Indirect Incomes', nature: 'Income', isBuiltIn: true },
  { name: 'Purchase Accounts', nature: 'Expenses', isBuiltIn: true },
  { name: 'Direct Expenses', nature: 'Expenses', isBuiltIn: true },
  { name: 'Indirect Expenses', nature: 'Expenses', isBuiltIn: true },
];

// the Tally sub-groups, by the primary group they sit under
const SUB_GROUPS = [
  {
    parent: 'Current Assets',
    nature: 'Assets',
    names: [
      'Stock-in-Hand',
      'Deposits (Asset)',
      'Loans & Advances (Asset)',
      'Sundry Debtors',
      'Cash-in-Hand',
      'Bank Accounts',
    ],
  },
  { parent: 'Current Liabilities', nature: 'Liabilities', names: ['Duties & Taxes', 'Provisions', 'Sundry Creditors'] },
  { parent: 'Capital Account', nature: 'Liabilities', names: ['Reserves & Surplus'] },
  { parent: 'Loans (Liability)', nature: 'Liabilities', names: ['Bank OD A/c', 'Secured Loans', 'Unsecured Loans'] },
];

async function subGroupRows() {
  const rows = [];
  for (const { parent, nature, names } of SUB_GROUPS) {
    const parentGroup = await AccountGroup.findOne({ where: { name: parent } });
    if (!parentGroup) continue;
    for (const name of names) rows.push({ name, parentId: parentGroup.id, nature, isBuiltIn: true });
  }
  return rows;
}

export async function seedGroups() {
  const count = await AccountGroup.count();
  if (count > 0) return { message: 'Groups already seeded.' };
  await AccountGroup.bulkCreate(PRIMARY_GROUPS);
  await AccountGroup.bulkCreate(await subGroupRows());
  return { message: 'Tally Standard Groups seeded successfully!' };
}

async function voucherSumsByLedger() {
  const sums = await VoucherDetail.findAll({
    attributes: ['ledgerId', 'dc', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
    group: ['ledgerId', 'dc'],
    raw: true,
  });
  const sumsByLedger = {};
  for (const sum of sums) {
    if (!sumsByLedger[sum.ledgerId]) sumsByLedger[sum.ledgerId] = { dr: 0, cr: 0 };
    if (sum.dc === 'Dr') sumsByLedger[sum.ledgerId].dr += parseFloat(sum.total || 0);
    if (sum.dc === 'Cr') sumsByLedger[sum.ledgerId].cr += parseFloat(sum.total || 0);
  }
  return sumsByLedger;
}

function attachCurrentBalance(ledger, sums) {
  const opening = parseFloat(ledger.openingBalance || 0);
  let drTotal = ledger.balanceType === 'Dr' ? opening : 0;
  let crTotal = ledger.balanceType === 'Cr' ? opening : 0;
  if (sums) {
    drTotal += sums.dr;
    crTotal += sums.cr;
  }
  const net = drTotal - crTotal;
  ledger.dataValues.currentBalance = Math.abs(net);
  ledger.dataValues.currentBalanceType = net >= 0 ? 'Dr' : 'Cr';
}

function buildTree(groups, ledgers, parentId = null) {
  return groups
    .filter((group) => group.parentId === parentId)
    .map((group) => ({
      ...group.dataValues,
      type: 'group',
      children: [
        ...buildTree(groups, ledgers, group.id),
        ...ledgers
          .filter((ledger) => ledger.groupId === group.id)
          .map((ledger) => ({ ...ledger.dataValues, type: 'ledger' })),
      ],
    }));
}

/** Groups and ledgers as one tree, every ledger with its live balance (opening + voucher lines). */
export async function accountTree() {
  const groups = await AccountGroup.findAll();
  const ledgers = await AccountLedger.findAll();
  const sumsByLedger = await voucherSumsByLedger();
  for (const ledger of ledgers) attachCurrentBalance(ledger, sumsByLedger[ledger.id]);
  return { success: true, data: buildTree(groups, ledgers, null) };
}

export async function createGroup(values) {
  return { success: true, data: await AccountGroup.create(values) };
}

export async function createLedger(values) {
  return { success: true, data: await AccountLedger.create(values) };
}

export async function updateGroup(id, values) {
  await AccountGroup.update(values, { where: { id } });
  return { success: true };
}

export async function deleteGroup(id) {
  await AccountGroup.destroy({ where: { id } });
  return { success: true };
}

export async function updateLedger(id, values) {
  await AccountLedger.update(values, { where: { id } });
  return { success: true };
}

export async function deleteLedger(id) {
  await AccountLedger.destroy({ where: { id } });
  return { success: true };
}
