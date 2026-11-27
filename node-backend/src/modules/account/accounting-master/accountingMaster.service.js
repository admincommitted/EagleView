import { Op } from 'sequelize';
import {
  CostCategory,
  CostCentre,
  Currency,
  TdsNature,
  Voucher,
  VoucherDetail,
  VoucherType,
} from '../../../models/index.js';

const DEFAULT_VOUCHER_TYPES = [
  'Contra',
  'Payment',
  'Receipt',
  'Journal',
  'Sales',
  'Purchase',
  'Credit Note',
  'Debit Note',
  'Memo',
  'Reversing Journal',
  'Sales Order',
  'Purchase Order',
  'Delivery Note',
  'Receipt Note',
  'Physical Stock',
  'Stock Journal',
  'Material In',
  'Material Out',
  'Job Work In Order',
  'Job Work Out Order',
].map((name) => ({ name, baseType: name, isBuiltIn: true }));

const DEFAULT_COST_CATEGORY = {
  name: 'Primary Cost Category',
  allocateRevenue: true,
  allocateNonRevenue: false,
  isBuiltIn: true,
};
const APRIL = 3;

const round2 = (value) => Math.round(value * 100) / 100;

/** Create / list / update / delete of one simple master table. */
const masterCrud = (Model) => ({
  list: async () => ({ success: true, data: await Model.findAll() }),
  create: async (values) => ({ success: true, data: await Model.create(values) }),
  update: async (id, values) => {
    await Model.update(values, { where: { id } });
    return { success: true };
  },
  remove: async (id) => {
    await Model.destroy({ where: { id } });
    return { success: true };
  },
});

export const voucherTypes = masterCrud(VoucherType);
export const costCategories = masterCrud(CostCategory);
export const costCentres = masterCrud(CostCentre);
export const currencies = masterCrud(Currency);
export const tdsNatures = masterCrud(TdsNature);

export async function seedAccountingMasters() {
  if ((await VoucherType.count()) === 0) await VoucherType.bulkCreate(DEFAULT_VOUCHER_TYPES);
  if ((await CostCategory.count()) === 0) await CostCategory.create(DEFAULT_COST_CATEGORY);
  return { message: 'Accounting Masters seeded successfully!' };
}

const buildCentreTree = (items, parentId = null) =>
  items
    .filter((item) => item.parentId === parentId)
    .map((item) => ({ ...item.dataValues, children: buildCentreTree(items, item.id) }));

export async function allAccountingMasters() {
  const voucherTypeRows = await VoucherType.findAll();
  const categories = await CostCategory.findAll();
  const centres = await CostCentre.findAll();
  return {
    success: true,
    data: {
      voucherTypes: voucherTypeRows,
      costCategories: categories,
      costCentresTree: buildCentreTree(centres),
      costCentresFlat: centres,
    },
  };
}

// the period defaults to the financial year (from 1st April) up to `to`
function reportPeriod(query) {
  const to = query.to || new Date().toISOString().slice(0, 10);
  const toDate = new Date(to);
  const fyStartYear = toDate.getMonth() < APRIL ? toDate.getFullYear() - 1 : toDate.getFullYear();
  return { from: query.from || fyStartYear + '-04-01', to };
}

// Dr on a cost centre is spend against it, Cr is a credit back to it
function amountsByCentre(lines) {
  const byCentre = new Map();
  for (const line of lines) {
    const amount = (parseFloat(line.amount) || 0) * (line.dc === 'Dr' ? 1 : -1);
    byCentre.set(line.costCentreId, (byCentre.get(line.costCentreId) || 0) + amount);
  }
  return byCentre;
}

function centreTreeWithAmounts(centres, byCentre) {
  const childrenOf = (id) => centres.filter((centre) => centre.parentId === id);
  // a centre's own amount plus everything under it
  const totalOf = (centre) =>
    round2((byCentre.get(centre.id) || 0) + childrenOf(centre.id).reduce((sum, child) => sum + totalOf(child), 0));
  const nodeOf = (centre) => ({
    id: 'cc' + centre.id,
    centreId: centre.id,
    name: centre.name,
    type: 'centre',
    amount: totalOf(centre),
    children: childrenOf(centre.id).map(nodeOf),
  });
  return nodeOf;
}

const categoryNode = ({ id, categoryId, name }, children) => ({
  id,
  categoryId,
  name,
  type: 'category',
  amount: round2(children.reduce((sum, child) => sum + child.amount, 0)),
  children,
});

function costCentreNote(centreCount, untaggedLines) {
  if (!centreCount) {
    return 'No cost centres exist yet. Add a category and a centre, then tag voucher lines with them on Voucher Entry.';
  }
  return (
    'Amounts are the voucher lines tagged to each centre. ' +
    untaggedLines +
    ' line(s) in this period carry no cost centre, so they are not in any figure above.'
  );
}

export async function costCentreReport(query) {
  const { from, to } = reportPeriod(query);
  const [categories, centres] = await Promise.all([CostCategory.findAll(), CostCentre.findAll()]);
  const vouchers = await Voucher.findAll({ where: { date: { [Op.between]: [from, to] } }, attributes: ['id'] });
  const voucherIds = vouchers.map((voucher) => voucher.id);
  const lines = voucherIds.length
    ? await VoucherDetail.findAll({ where: { voucherId: { [Op.in]: voucherIds }, costCentreId: { [Op.ne]: null } } })
    : [];
  const nodeOf = centreTreeWithAmounts(centres, amountsByCentre(lines));

  const data = categories.map((category) => {
    const roots = centres.filter((centre) => centre.categoryId === category.id && !centre.parentId);
    return categoryNode({ id: 'cat' + category.id, categoryId: category.id, name: category.name }, roots.map(nodeOf));
  });
  const looseCentres = centres.filter((centre) => !centre.categoryId && !centre.parentId);
  if (looseCentres.length) {
    data.push(categoryNode({ id: 'cat0', categoryId: null, name: 'Not in any category' }, looseCentres.map(nodeOf)));
  }
  // money on vouchers that nobody tagged - the gap between this report and the books
  const untaggedLines = voucherIds.length
    ? await VoucherDetail.count({ where: { voucherId: { [Op.in]: voucherIds }, costCentreId: null } })
    : 0;
  return {
    success: true,
    from,
    to,
    data,
    counts: {
      categories: categories.length,
      centres: centres.length,
      taggedLines: lines.length,
      untaggedLines,
    },
    note: costCentreNote(centres.length, untaggedLines),
  };
}
