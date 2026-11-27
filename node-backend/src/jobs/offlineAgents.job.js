import { Op } from 'sequelize';
import { FieldAgent } from '../models/index.js';
import { toField } from '../sockets/liveBus.js';

const OFFLINE_CHECK_INTERVAL_MS = 2 * 60 * 1000;
const OFFLINE_AFTER_MS = 5 * 60 * 1000;
const MINUTE_MS = 60000;
// an agent silent for a day or more is marked Offline without an alert
const ALERT_LIMIT_MINUTES = 24 * 60;
const OFFLINE_STATUS = 'Offline';

const minutesSince = (date) => Math.round((Date.now() - new Date(date).getTime()) / MINUTE_MS);

const findSilentAgents = () =>
  FieldAgent.findAll({
    where: {
      isActive: true,
      status: { [Op.ne]: OFFLINE_STATUS },
      lastSeen: { [Op.lt]: new Date(Date.now() - OFFLINE_AFTER_MS) },
    },
  });

// alert once and mark the agent Offline; the next location from the phone sets the status again
async function markSilentAgentsOffline(app) {
  try {
    const silentAgents = await findSilentAgents();
    const io = app.get('io');
    for (const agent of silentAgents) {
      const minutes = minutesSince(agent.lastSeen);
      if (io && minutes < ALERT_LIMIT_MINUTES) {
        toField(io, 'agent_offline_alert', {
          agentId: agent.id,
          agentName: agent.name,
          minutesSince: minutes,
          lastSeen: agent.lastSeen,
        });
      }
      await agent.update({ status: OFFLINE_STATUS }, { silent: true });
      if (io) toField(io, 'agent_status_updated', { agentId: agent.id, status: OFFLINE_STATUS });
    }
  } catch (error) {
    console.warn('[OfflineAlert]', error.message);
  }
}

/** Field agents whose phone has sent nothing for 5 minutes: alert the office and mark them Offline. */
export function startOfflineAgentAlertJob(app) {
  setInterval(() => markSilentAgentsOffline(app), OFFLINE_CHECK_INTERVAL_MS);
  console.log('[OfflineAlert] Monitoring started -- alerts every 2 min');
}
