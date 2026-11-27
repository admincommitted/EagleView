import { z } from 'zod';

const AGENT_STATUSES = ['In Transit', 'Idle', 'Offline'];
const OFFICE_CODE_PATTERN = /^[A-Z0-9]{6,20}$/;

/** A body check that gives `message` when `isWrong(body)` is true. */
const rejects = (isWrong, message) =>
  z.any().superRefine((body, ctx) => {
    if (isWrong(body)) ctx.addIssue({ code: 'custom', message });
  });

/** { agentId, lat, lng, accuracy, speed, heading, battery, locationName } - a GPS ping from the field app */
export const locationSchema = rejects(
  ({ agentId, lat, lng }) => !agentId || lat === undefined || lng === undefined,
  'agentId, lat, lng required',
);

/** { pings: [{ agentId, lat, lng, timestamp, ... }] } - the offline queue of the field app */
export const bulkLocationSchema = rejects(
  ({ pings }) => !Array.isArray(pings) || pings.length === 0,
  'pings array required',
);

/** { agentId, task, location, priority, assignedBy } */
export const taskSchema = rejects(({ agentId, task }) => !agentId || !task, 'agentId and task are required');

export const agentStatusSchema = rejects(({ status }) => !AGENT_STATUSES.includes(status), 'Invalid status');

const officeCodeOf = (code) =>
  String(code || '')
    .trim()
    .toUpperCase();

function phoneAccessProblem(body) {
  if (body.code !== undefined) {
    const code = officeCodeOf(body.code);
    if (code && !OFFICE_CODE_PATTERN.test(code)) return 'Office code: 6 to 20 letters or digits.';
  }
  if (body.code === undefined && body.legacy === undefined) return 'Nothing to change';
  return null;
}

/** { code: the office code (empty = clear it), legacy: "old field app allowed" } */
export const phoneAccessSchema = z
  .any()
  .superRefine((body, ctx) => {
    const problem = phoneAccessProblem(body || {});
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  })
  .transform((body) => {
    const sent = body || {};
    const values = {};
    if (sent.code !== undefined) values.code = officeCodeOf(sent.code);
    if (sent.legacy !== undefined) values.legacy = sent.legacy ? 'on' : 'off';
    return values;
  });
