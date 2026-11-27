import { z } from 'zod';

const MAX_PAGES = 20;
const MAX_SWITCHED_OFF_SOURCES = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE_ID_PATTERN = /^[a-z_]+$|^page:[0-9a-f]{10}$/;
const PAGE_LINE_PATTERN = /^(.*\|\s*)?https?:\/\/[^\s|]+$/i;

const splitRecipients = (to) =>
  String(to || '')
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
const splitPageLines = (pages) =>
  String(pages || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** The first problem, checked in the order: recipients, switched-off sources, own pages. */
function watchSettingsProblem(body) {
  if (body.to !== undefined) {
    const recipients = splitRecipients(body.to);
    const invalid = recipients.filter((recipient) => !EMAIL_PATTERN.test(recipient));
    if (invalid.length) return 'Not an e-mail id: ' + invalid.join(', ');
    if (!recipients.length) return 'Enter at least one e-mail id';
  }
  if (body.off !== undefined && !Array.isArray(body.off)) return 'off must be a list';
  if (body.pages !== undefined) {
    const lines = splitPageLines(body.pages);
    if (lines.length > MAX_PAGES) return 'At most 20 pages';
    const invalid = lines.filter((line) => !PAGE_LINE_PATTERN.test(line));
    if (invalid.length) return 'Not a page address (http:// or https://): ' + invalid[0].slice(0, 80);
  }
  return null;
}

/** Only the sent fields, in the form they are stored: "a, b" recipients, '1'/'0', a JSON list, one page per line. */
function watchSettingsValues(body) {
  const values = {};
  if (body.to !== undefined) values.to = splitRecipients(body.to).join(', ');
  if (body.on !== undefined) values.on = body.on ? '1' : '0';
  if (body.off !== undefined) {
    const sourceIds = body.off
      .map(String)
      .filter((id) => SOURCE_ID_PATTERN.test(id))
      .slice(0, MAX_SWITCHED_OFF_SOURCES);
    values.off = JSON.stringify(sourceIds);
  }
  if (body.pages !== undefined) values.pages = splitPageLines(body.pages).join('\n');
  return values;
}

/** { to, on, off: [source ids switched off], pages: "Name | https://..." per line } */
export const watchSettingsSchema = z
  .any()
  .superRefine((body, ctx) => {
    const problem = watchSettingsProblem(body || {});
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  })
  .transform((body) => watchSettingsValues(body || {}));
