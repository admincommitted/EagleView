// formatting and colours shared by the dashboard parts
// chart colours (recharts takes plain colours)
export const CHART = { income: '#0d9488', expense: '#e11d48', profit: 'var(--primary-color-end, #0369a1)', receipt: '#059669', payment: '#d97706', billed: '#6366f1', lastYear: '#94a3b8', grid: '#e2e8f0' };

// text colours used across the dashboard
export const TONE = {
  income: 'tw:text-teal-600',
  expense: 'tw:text-rose-600',
  good: 'tw:text-emerald-600',
  bad: 'tw:text-red-600',
  warn: 'tw:text-amber-700',
  receipt: 'tw:text-emerald-600',
  payment: 'tw:text-amber-600',
  brand: 'tw:text-head',
  text: 'tw:text-foreground',
  muted: 'tw:text-muted-foreground',
};

export const shortAmount = (value) => {
  const amount = Math.abs(Number(value) || 0);
  const text = amount >= 1e7 ? (amount / 1e7).toFixed(2) + ' Cr' : amount >= 1e5 ? (amount / 1e5).toFixed(2) + ' L' : amount >= 1e3 ? (amount / 1e3).toFixed(1) + ' K' : amount.toFixed(0);
  return (Number(value) < 0 ? '-' : '') + text;
};
export const monthName = (month) => new Date(month + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });
export const changeText = (value) => (value == null ? '-' : (value > 0 ? '+' : '') + value + '%');
export const percentText = (value) => (value == null ? '-' : value + '%');
export const marginTone = (value) => (value == null ? TONE.muted : value < 0 ? TONE.expense : value < 10 ? TONE.warn : TONE.good);

export const smallNote = 'tw:mt-2 tw:text-[10.5px] tw:text-muted-foreground';
export const subHeading = 'tw:mt-2.5 tw:mb-1 tw:text-[10px] tw:font-extrabold tw:tracking-wide tw:text-muted-foreground tw:uppercase';
export const linkText = 'tw:cursor-pointer tw:font-bold tw:text-primary';
export const THREE_COLUMNS = 'tw:grid tw:grid-cols-1 tw:items-stretch tw:gap-3 tw:md:grid-cols-2 tw:xl:grid-cols-[minmax(0,1.4fr)_minmax(240px,1fr)_minmax(240px,1fr)]';
