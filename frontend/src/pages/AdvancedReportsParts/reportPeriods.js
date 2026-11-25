// The Indian financial year starts on 1 April.
export const financialYearStart = () => {
  const today = new Date();
  const year = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
  return `${year}-04-01`;
};

const isoDay = (date) => date.toISOString().slice(0, 10);

export const todayIso = () => isoDay(new Date());

export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_year', label: 'This Financial Year' },
  { value: 'custom', label: 'Custom Range (use the dates)' },
];

const PERIOD_STARTS = {
  today: (today) => isoDay(today),
  this_week: (today) => {
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return isoDay(monday);
  },
  this_month: (today) => isoDay(new Date(today.getFullYear(), today.getMonth(), 1)),
  this_quarter: (today) => isoDay(new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)),
  this_year: () => financialYearStart(),
};

/** { from, to } for a period choice; null for "custom" (the dates stay as typed). */
export function periodRange(period) {
  const startOf = PERIOD_STARTS[period];
  if (!startOf) return null;
  const today = new Date();
  return { from: startOf(today), to: isoDay(today) };
}
