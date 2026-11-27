import { orderedChecks } from '../shared/orderedChecks.js';

/** POST /drawback { fob, qty, tariffItem } */
export const drawbackBodySchema = orderedChecks((body) => (body.tariffItem ? '' : 'tariffItem is required'));
