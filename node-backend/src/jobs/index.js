import { env } from '../config/env.js';
import { startExchangeRateSyncJob } from './cbicExchangeRates.job.js';
import { startCustomsWatchJob } from './cbicCustomsWatch.job.js';
import { startDbMaintenanceJob } from './dbMaintenance.job.js';
import { runEmailListener } from './emailListener.job.js';
import { startFsuPollingJob } from './fsuPolling.job.js';
import { startIcegateAckJob } from './icegateAck.job.js';
import { startOfflineAgentAlertJob } from './offlineAgents.job.js';
import { startWhatsappSchedulerJob } from './whatsappScheduler.job.js';

export { prepareDatabase } from './prepareDatabase.js';
export { restartEmailListeners, runEmailListener } from './emailListener.job.js';

/**
 * Starts the timers and listeners of the backend. Call once, after the server listens.
 * The SQLite housekeeping always runs; everything else is off with DISABLE_JOBS=1 (a copy of the backend that must
 * not poll ICEGATE, send mail or WhatsApp).
 */
export function startBackgroundJobs({ app }) {
  startDbMaintenanceJob();
  if (env.jobsDisabled) {
    console.log('[Jobs] off (DISABLE_JOBS=1)');
    return;
  }
  startOfflineAgentAlertJob(app);
  startFsuPollingJob();
  runEmailListener();
  startWhatsappSchedulerJob();
  startExchangeRateSyncJob();
  startCustomsWatchJob();
  startIcegateAckJob();
}
