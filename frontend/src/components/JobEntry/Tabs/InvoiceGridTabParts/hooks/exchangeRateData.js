const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const twoDigits = (number) => String(number).padStart(2, '0');

// the day in India: a master date comes back as UTC ("2026-11-17T18:30:00.000Z" is 18-Nov in IST), so it is read
// as a local date, never cut at 10 characters
export const localDay = (value) => {
  if (!value) return '';
  const text = String(value).trim();
  if (ISO_DAY.test(text)) return text;
  const date = value instanceof Date ? value : new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
};

// a CBIC rate is dated the notification's effective date held in the Currency master; today only when it has none
export const masterRateDate = (master) => {
  const day = master?.effectiveDate ? localDay(master.effectiveDate) : '';
  return ISO_DAY.test(day) ? day : localDay(new Date());
};

export const displayDay = (isoDay) => isoDay.split('-').reverse().join('-');

export const exchangeRateRows = (job) => {
  const saved = job._exchangeRates;
  if (typeof saved !== 'string') return Array.isArray(saved) ? saved : [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const rateText = (row) => `${row.currencyCode} ${row.rate}${row.unitInRs !== 1 ? `/${row.unitInRs}` : ''}`;
