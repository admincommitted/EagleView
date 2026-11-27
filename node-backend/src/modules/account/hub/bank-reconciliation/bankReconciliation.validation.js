import { checkedInput } from '../shared/hubHttp.js';

export const bankReconciliationQuery = checkedInput((query) =>
  Number(query.ledgerId) ? null : 'Choose the bank account',
);
