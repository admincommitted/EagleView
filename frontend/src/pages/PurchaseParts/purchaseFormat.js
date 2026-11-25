export const CATEGORY_OPTIONS = ['IT Assets', 'Office Supplies', 'Warehouse Material', 'Vehicle Spares', 'General Admin'];

export const PO_STATUS_FILTERS = [
  { value: 'All', label: 'ALL STATUSES' },
  { value: 'Draft', label: 'DRAFT' },
  { value: 'Pending Approval', label: 'PENDING APPROVAL' },
  { value: 'Approved', label: 'APPROVED' },
  { value: 'Rejected', label: 'REJECTED' },
  { value: 'Hold', label: 'HOLD' },
];

const asNumber = (value) => Number(value) || 0;

export const rupees = (amount) => `₹${asNumber(amount).toFixed(2)}`;
export const rupeesGrouped = (amount) =>
  `₹${asNumber(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ukDate = (value) => new Date(value).toLocaleDateString('en-GB');
export const shortTime = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const localDateTime = (value) => new Date(value).toLocaleString();

export function lineAmounts(item) {
  const base = asNumber(item.quantity) * asNumber(item.unitPrice);
  const gst = base * (asNumber(item.gstRate) / 100);
  return { base, gst, total: base + gst };
}

export function itemsTotals(items) {
  return items.reduce((sum, item) => {
    const { gst, total } = lineAmounts(item);
    return { gst: sum.gst + gst, total: sum.total + total };
  }, { gst: 0, total: 0 });
}

/** The branch list answer comes as a plain array, { data } or { rows }. */
export const branchRows = (body) => (Array.isArray(body) ? body : body?.data || body?.rows || []);

/** A PO keeps its branch by name, so each name is offered once and only active branches are offered. */
export function poBranches(branches) {
  const seen = new Set();
  return branches.filter((branch) => {
    const name = String(branch.branchName || '').trim().toUpperCase();
    if (!name || (branch.status || 'Active') === 'Inactive' || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
}

/** When the decision was taken (an older PO has only updatedAt). */
export const actionTime = (po) => po.actionAt || po.updatedAt;

export const vendorName = (po) => po.Vendor?.vendorName || 'N/A';

export const blankItem = () => ({ itemName: '', quantity: 1, unitPrice: 0, gstRate: 0 });

export const PAGE_SIZES = [10, 25, 50, 100];

/** The items of approved POs that are not in stock yet, one row per item. */
export const pendingInwardRows = (approvedPOs) =>
  approvedPOs.flatMap((po) => (po.items || []).filter((item) => !item.isReceived).map((item) => ({ item, po })));
