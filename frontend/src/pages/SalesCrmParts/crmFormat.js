export const money = (amount) => `₹ ${(Number(amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const moneyWithPaise = (amount) => `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export const dmy = (ymd) => (ymd ? ymd.split('-').reverse().join('-') : '');

export const LEAD_STATUSES = [
  { value: 'NEW', label: 'New' },
  { value: 'QUOTED', label: 'Quoted' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
];

export const LEAD_BADGE = { NEW: 'info', QUOTED: 'warning', WON: 'success', LOST: 'danger' };
export const LEAD_EDGE = { NEW: 'tw:border-l-primary', QUOTED: 'tw:border-l-warning', WON: 'tw:border-l-success' };
export const QUOTE_BADGE = { DRAFT: 'neutral', SENT: 'info', APPROVED: 'warning', REJECTED: 'danger', CONVERTED: 'success' };
