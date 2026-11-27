import { checkedInput } from '../shared/hubHttp.js';

export const createGroupBody = checkedInput((body) => (String(body.name || '').trim() ? null : 'Enter the group name'));
