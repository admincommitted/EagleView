// ICEGATE events in the job's log (job list > Log, Timeline drawer): file sent / not sent, the reply of ICES, a signed
// file made for checking. Without these, a BE that ICEGATE took and then rejected (DSC Verification Failed) would
// leave no trace on the job.
import { JobTimeline } from '../../models/index.js';

const MAX_EVENT_TYPE_LENGTH = 30;
const MAX_MESSAGE_LENGTH = 4000;

const who = (req) => (req && req.user && (req.user.username || req.user.name || req.user.email)) || '';

async function logIcegate(module, jobId, eventType, message, author) {
  if (!jobId) return;
  try {
    await JobTimeline.create({
      jobId: String(jobId),
      module,
      eventType: String(eventType).slice(0, MAX_EVENT_TYPE_LENGTH),
      message: String(message || '').slice(0, MAX_MESSAGE_LENGTH),
      author: author || 'ICEGATE',
    });
  } catch (e) {
    console.warn('[ICEGATE log]', e.message);
  }
}

export { logIcegate, who };
