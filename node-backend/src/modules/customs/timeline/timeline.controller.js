import { addTimelineEntry, deleteTimelineEntry, jobTimeline } from './timeline.service.js';

const whoIs = (req) => (req.user && (req.user.username || req.user.name)) || '';

export async function listTimeline(req, res) {
  res.json({ success: true, data: await jobTimeline(req.params.module, req.params.jobId) });
}

export async function addEntry(req, res) {
  const { jobId, module, eventType, message } = req.body || {};
  const author = whoIs(req) || req.body.author || 'User';
  res.status(201).json(await addTimelineEntry({ jobId, module, eventType, message, author }));
}

export async function deleteEntry(req, res) {
  await deleteTimelineEntry(req.params.id, req.user, whoIs(req));
  res.json({ success: true });
}
