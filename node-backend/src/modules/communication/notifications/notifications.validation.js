import { z } from 'zod';
import { TYPES } from '../../../utils/common/notificationHelper.js';

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MOBILE_DIGITS = 10;

const addProblem = (ctx, message) => ctx.addIssue({ code: 'custom', message });

/** Broadcast screen: { targetUserId ('all' or a user id), title, message, type, link } */
export const sendNotificationSchema = z.any().superRefine((body, ctx) => {
  const { title, message, type } = body || {};
  if (!String(title || '').trim() || !String(message || '').trim())
    return addProblem(ctx, 'Title and message are required');
  if (String(title).length > MAX_TITLE_LENGTH || String(message).length > MAX_MESSAGE_LENGTH) {
    return addProblem(ctx, 'Title max 200, message max 2000 characters');
  }
  if (type && !TYPES.includes(type)) addProblem(ctx, 'Type must be ' + TYPES.join(' / '));
});

/** { mobileNumber, partyName, refNo, statusText } - a shipment status on WhatsApp */
export const whatsappStatusSchema = z.any().superRefine((body, ctx) => {
  const { mobileNumber, statusText } = body || {};
  if (!mobileNumber || String(mobileNumber).replace(/\D/g, '').length < MIN_MOBILE_DIGITS) {
    return addProblem(ctx, 'A valid mobile number is required');
  }
  if (!statusText) addProblem(ctx, 'statusText is required');
});
