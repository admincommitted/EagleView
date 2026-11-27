import { startAutoSync } from '../utils/customs/cbicExchangeRates.js';

// rates change on the 1st / 3rd Thursday; the first check runs 1 minute after start
const EXCHANGE_RATE_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** CBIC customs exchange rates from ICEGATE into the Currency master. Off with setting cbic_exrate_auto = 0. */
export function startExchangeRateSyncJob() {
  startAutoSync(EXCHANGE_RATE_SYNC_INTERVAL_MS);
}
