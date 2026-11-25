export const ymName = (yearMonth) => new Date(yearMonth + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export const IB_TYPES = [['bank', 'Bank Transfer'], ['journal', 'Journal'], ['cash', 'Cash Transfer']];
export const IB_TYPE_OPTIONS = IB_TYPES.map(([value, label]) => ({ value, label }));
export const ibTone = (status) => (status === 'Accepted' ? 'ok' : status === 'Returned' ? 'bad' : 'warn');
export const BRANCH_ACCOUNT = /^BRANCH A\/C - /i;
export const BANK_LEDGERS = 'ledgers-in?groups=Bank Accounts,Bank OD A/c';
export const CASH_LEDGERS = 'ledgers-in?groups=Cash-in-Hand';
