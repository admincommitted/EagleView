import { z } from 'zod';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const addProblem = (ctx, message) => ctx.addIssue({ code: 'custom', message });

/** { to, smtp } - smtp: the values on the screen, the saved ones fill what is empty */
export const testMailSchema = z.any().superRefine((body, ctx) => {
  const { to } = body;
  if (!to) return addProblem(ctx, 'Recipient email required');
  if (!EMAIL_PATTERN.test(String(to).trim())) addProblem(ctx, 'Recipient email is not valid');
});

export const sendMailSchema = z.any().superRefine((body, ctx) => {
  const { to, subject, html } = body || {};
  if (!to || !subject || !html) addProblem(ctx, 'to, subject and html are required');
});
