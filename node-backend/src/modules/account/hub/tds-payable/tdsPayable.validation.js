import { checkedInput } from '../shared/hubHttp.js';

const MONTH_FORMAT = /^\d{4}-\d{2}$/;

export const monthDetailQuery = checkedInput((query) =>
  MONTH_FORMAT.test(String(query.month || '')) ? null : 'month missing',
);

export const challanBody = checkedInput((body) => {
  if (!MONTH_FORMAT.test(String(body.month || ''))) return 'Choose the month';
  if (!String(body.challanNo || '').trim()) return 'Enter the challan no (CIN serial)';
  if (!body.paidOn) return 'Enter the date paid';
  if (!(Number(body.amount) > 0)) return 'Enter the amount paid';
  return null;
});
