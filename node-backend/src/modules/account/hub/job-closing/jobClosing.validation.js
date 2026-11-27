import { checkedInput } from '../shared/hubHttp.js';

export const closeJobBody = checkedInput((body) => (String(body.jobNo || '').trim() ? null : 'Job no missing'));
