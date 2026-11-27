import { checkedInput } from '../shared/hubHttp.js';

export const ledgerReportQuery = checkedInput((query) => (Number(query.ledgerId) ? null : 'Choose the account'));
