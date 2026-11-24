// ICEGATE events in the job's log (job list > Log, Timeline drawer): file sent / not sent, the reply of ICES, a signed
// file made for checking. 17-Nov-2026 - before this the log showed only "created / last saved", so a BE that ICEGATE
// took and then rejected (DSC Verification Failed) left no trace on the job at all.
const who = (req) => (req && req.user && (req.user.username || req.user.name || req.user.email)) || '';

async function logIcegate(module, jobId, eventType, message, author) {
  if (!jobId) return;
  try {
    const JobTimeline = require('../models/JobTimeline');
    await JobTimeline.create({ jobId: String(jobId), module, eventType: String(eventType).slice(0, 30), message: String(message || '').slice(0, 4000), author: author || 'ICEGATE' });
  } catch (e) { console.warn('[ICEGATE log]', e.message); }
}

module.exports = { logIcegate, who };
