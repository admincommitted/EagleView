export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const inr = (amount) => (amount == null || amount === '' ? '' : Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 }));

export function crore(amount) {
  const value = Number(amount || 0);
  if (Math.abs(value) >= 1e7) return `${(value / 1e7).toFixed(2)} Cr`;
  if (Math.abs(value) >= 1e5) return `${(value / 1e5).toFixed(2)} L`;
  return inr(value);
}

export function dmy(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : (value || '');
}

export const monthName = (yearMonth) => MONTH_NAMES[Number(String(yearMonth).slice(5, 7)) - 1];

// [code, label] pairs from the meta lists as select options
export const pairOptions = (pairs = []) => pairs.map(([value, label]) => ({ value, label }));

export const labelsOf = (pairs = []) => Object.fromEntries(pairs.map(([value, label]) => [value, label]));

export const activePersons = (meta) => (meta.persons || []).filter((person) => person.isActive !== 0);

export const activeLookups = (meta, kind) => ((meta.lookups || {})[kind] || []).filter((lookup) => lookup.isActive);

export const lostReasons = (meta) => ((meta.lookups || {}).LOST_REASON || []).filter((reason) => reason.isActive !== 0).map((reason) => reason.value);
