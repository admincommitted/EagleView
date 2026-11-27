import { checkedInput } from '../shared/hubHttp.js';

export const paymentHoldBody = checkedInput((body) => {
  const hold = Number(body.hold) ? 1 : 0;
  return hold && !String(body.reason || '').trim() ? 'Give the reason for holding the payment' : null;
});

export const vendorBillsQuery = checkedInput((query) => (Number(query.ledgerId) ? null : 'ledgerId is required'));
