import { start as startCustomsWatch } from '../utils/customs/cbicCustomsWatch.js';

/**
 * New CBIC customs notifications / circulars mailed with the PDF (Settings > Email > CBIC customs updates).
 * cbicCustomsWatch sets its own timing: first check 2 minutes after start, then every 10 minutes per source.
 */
export function startCustomsWatchJob() {
  startCustomsWatch();
}
