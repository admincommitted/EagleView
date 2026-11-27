import { getAuthToken, getIcegateConfig } from '../modules/icegate/filing/filing.service.js';
import { startAckPolling } from '../utils/customs/icegateAck.js';

// jobs filed through the ICEGATE API are checked for 3 days after filing
const ICEGATE_ACK_POLL_INTERVAL_MS = 10 * 60 * 1000;

/** ICEGATE acknowledgements of BEs / Shipping Bills filed through the API. */
export function startIcegateAckJob() {
  startAckPolling({ getIcegateConfig, getAuthToken }, ICEGATE_ACK_POLL_INTERVAL_MS);
}
