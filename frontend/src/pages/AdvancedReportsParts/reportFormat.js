export const dayFirst = (ymd) => String(ymd || '').split('-').reverse().join('-');

export const money = (amount) => `₹ ${(Number(amount) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const DASH = '—';
