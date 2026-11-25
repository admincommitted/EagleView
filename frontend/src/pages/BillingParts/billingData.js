/** Masters are read even when the server answers with an error status (the screen then shows what is missing). */
export const EVEN_ON_ERROR = { validateStatus: (status) => status !== 401 };

/** Some voucher services answer 200 with { success: false, error }; that is treated like an HTTP error. */
export function refusedUnlessOk(body) {
  if (body?.success === false) throw new Error(body.error || 'Request refused');
  return body;
}

export const todayYmd = () => new Date().toISOString().split('T')[0];
export const displayDate = (ymd) => String(ymd || '').split('-').reverse().join('-');
export const newDraftKey = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const wait = (milliseconds) => new Promise((resolve) => { setTimeout(resolve, milliseconds); });

export function amountOf(value) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

export const inr = (amount) => amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
export const roundPaise = (amount) => Math.round(amount * 100) / 100;

/** The chart-of-accounts tree flattened to its ledgers; each ledger carries the name of the group it sits in. */
export function ledgersFromTree(body) {
  const tree = body?.data || body?.tree || (Array.isArray(body) ? body : []);
  const ledgers = [];
  const walk = (nodes, groupName) => (nodes || []).forEach((node) => {
    if (node.type === 'ledger') ledgers.push({ ...node, group: node.groupName || groupName || '' });
    if (node.children) walk(node.children, node.type === 'group' ? node.name : groupName);
  });
  walk(tree, '');
  return ledgers;
}

export const ledgerId = (ledger) => ledger.id;
export const ledgerName = (ledger) => ledger.name;

export const sortedByName =(ledgers) => [...ledgers].sort((first, second) => String(first.name).localeCompare(String(second.name)));

export const ledgerIdNamed = (ledgers, pattern) => ledgers.find((ledger) => pattern.test(String(ledger.name || '')))?.id;

export const voucherTypesFrom = (mastersBody) => mastersBody?.data?.voucherTypes || [];

export const voucherTypeFor = (voucherTypes, baseType) => voucherTypes.find((type) => String(type.baseType) === baseType) || null;

export function currencyRows(body) {
  if (Array.isArray(body)) return body;
  return Array.isArray(body?.data) ? body.data : [];
}

export const foreignCurrencyCodes = (currencies) =>
  currencies.map((currency) => currency.code || currency.currencyCode).filter((code) => code !== 'INR');

export const GST_RATE_OPTIONS = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
];

export const TDS_RATE_OPTIONS = [
  { value: '0', label: 'No TDS' },
  { value: '1', label: '1% (194C)' },
  { value: '2', label: '2% (194C)' },
  { value: '10', label: '10% (194J/I)' },
];

export const ATTACHMENT_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv,.txt';
export const BANK_ADVICE_TYPES = '.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.csv,.txt,.xlsx,.xls';
