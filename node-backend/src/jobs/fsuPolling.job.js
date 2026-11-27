import { startFsuPolling } from '../utils/awb/FsuService.js';

// Descartes allows one FSU download every 5 minutes at most
const FSU_POLL_INTERVAL_MS = 5 * 60 * 1000;

/** Air cargo status (FSU) messages from the Descartes SFTP, every 5 minutes. */
export function startFsuPollingJob() {
  startFsuPolling(FSU_POLL_INTERVAL_MS);
}
