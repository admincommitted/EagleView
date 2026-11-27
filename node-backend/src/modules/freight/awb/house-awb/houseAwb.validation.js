import { orderedChecks } from '../../shared/orderedChecks.js';

/** GET /hawb?awbNumber=H123 */
export const findHouseQuerySchema = orderedChecks((query) => (query.awbNumber ? '' : 'awbNumber is required'));
