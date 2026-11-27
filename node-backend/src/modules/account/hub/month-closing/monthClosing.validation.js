import { checkedInput } from '../shared/hubHttp.js';

const MONTH_FORMAT = /^\d{4}-\d{2}$/;

export const monthActionParams = checkedInput(({ ym, action }) => {
  if (!MONTH_FORMAT.test(ym)) return 'Month must be YYYY-MM';
  if (action !== 'close' && action !== 'open') return 'close or open';
  return null;
});
