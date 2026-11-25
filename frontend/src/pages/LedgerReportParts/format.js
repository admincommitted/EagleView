export const formatAmount = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export const formatInr = (value) => Number(value || 0).toLocaleString('en-IN');

export const formatRupees = (value) => `₹ ${formatInr(value)}`;

export const formatRupeesWhole = (value) => `₹ ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export const dayFirst = (ymd, fallback = '') => (ymd ? ymd.split('-').reverse().join('-') : fallback);

export const periodText = (from, to) => `${dayFirst(from)} to ${dayFirst(to)}`;

export const todayIso = () => new Date().toISOString().slice(0, 10);

// Indian financial year: 1 April to 31 March
const financialYear = () => {
  const today = new Date();
  return today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
};

export const financialYearStart = () => `${financialYear()}-04-01`;

export const financialYearEnd = () => `${financialYear() + 1}-03-31`;

export const monthStartIso = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
};
