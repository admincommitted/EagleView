export const MS_PER_DAY = 86400000;
export const GST_SLABS = [0, 5, 12, 18, 28];

export const toNumber = (value) => {
  const number = Number(value);
  return isFinite(number) ? number : 0;
};

export const round2 = (value) => Math.round(toNumber(value) * 100) / 100;

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const nowIso = () => new Date().toISOString();

export const dayBefore = (isoDate) => {
  const day = new Date(isoDate + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
};

export const addDaysIso = (isoDate, days) => {
  const day = new Date(isoDate + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
};

export const daysBetween = (from, to) =>
  Math.floor((new Date(to + 'T00:00:00Z') - new Date(String(from).slice(0, 10) + 'T00:00:00Z')) / MS_PER_DAY);

/** A signed balance as Dr / Cr columns (positive = Dr). */
export const splitDrCr = (balance) => ({
  dr: balance > 0 ? round2(balance) : 0,
  cr: balance < 0 ? round2(-balance) : 0,
});

/** The value of `candidates` nearest to `target`; on a tie the one found first (starting from `start`) stays. */
export const nearestOf = (candidates, target, start) =>
  candidates.reduce(
    (best, candidate) => (Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best),
    start,
  );

/** The twelve months of a financial year from its start date: { key: 'YYYY-MM', date } in order. */
export function yearMonths(startDate) {
  const months = [];
  const day = new Date(startDate + 'T00:00:00Z');
  for (let index = 0; index < 12; index++) {
    months.push({ key: day.toISOString().slice(0, 7), date: new Date(day) });
    day.setUTCMonth(day.getUTCMonth() + 1);
  }
  return months;
}
