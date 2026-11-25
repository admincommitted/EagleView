export const toNumber = (value) => {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
};

export const isInr = (currency) => String(currency).toUpperCase() === 'INR';

// Lines whose currency has no exchange rate are left out of the totals and named in `missing`.
export function quoteTotals(lines) {
  let buy = 0;
  let sell = 0;
  const missing = [];
  lines.forEach((line) => {
    const roe = toNumber(line.roe) || (isInr(line.currency) ? 1 : 0);
    if (!roe && String(line.head || '').trim()) missing.push(line.currency);
    buy += toNumber(line.buyRate) * toNumber(line.qty) * roe;
    sell += toNumber(line.sellRate) * toNumber(line.qty) * roe;
  });
  return { buy, sell, margin: sell - buy, pct: sell > 0 ? ((sell - buy) / sell) * 100 : 0, missing: [...new Set(missing)] };
}
