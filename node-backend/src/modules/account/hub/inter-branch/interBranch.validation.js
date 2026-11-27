import { checkedInput } from '../shared/hubHttp.js';
import { TRANSFER_TYPES } from './interBranch.service.js';

export const raiseTransferBody = checkedInput((body) => {
  if (!TRANSFER_TYPES[String(body.type || '')]) return 'Choose Bank Transfer, Journal or Cash Transfer';
  const fromBranch = String(body.fromBranch || '')
    .trim()
    .toUpperCase();
  const toBranch = String(body.toBranch || '')
    .trim()
    .toUpperCase();
  if (!fromBranch || !toBranch) return 'Choose both branches';
  if (fromBranch === toBranch) return 'From and to branch cannot be the same';
  if (!String(body.date || '').slice(0, 10)) return 'Enter the date';
  return null;
});
