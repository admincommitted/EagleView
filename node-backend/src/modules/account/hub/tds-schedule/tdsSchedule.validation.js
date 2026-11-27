import { checkedInput } from '../shared/hubHttp.js';

const MAX_RATE = 100;

export const tdsNatureBody = checkedInput((body) => {
  if (
    !String(body.section || '')
      .trim()
      .toUpperCase()
  )
    return 'Enter the section, like 194C';
  if (!String(body.name || '').trim()) return 'Enter the nature of payment';
  const rate = Number(body.rate);
  if (!isFinite(rate) || rate < 0 || rate > MAX_RATE) return 'Enter the rate in %';
  return null;
});
