// Date helpers of the import and export penalty calculators.

// a job date as YYYY-MM-DD (also from dd-mm-yyyy / yyyymmdd); '' when it is not a date
export const toYmd = (value) => {
  const text = String(value || '').trim();
  let match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(text);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return '';
};

const DAY_MS = 1000 * 60 * 60 * 24;
export const daysBetween = (start, end) => {
  if (!start || !end) return 0;
  const difference = new Date(end) - new Date(start);
  return difference < 0 ? 0 : Math.ceil(difference / DAY_MS);
};

export const isAfter = (later, earlier) => new Date(later) > new Date(earlier);
