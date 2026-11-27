import { z } from 'zod';

/** POST /dutynotifs/bulk-upload: an array of rows */
export const bulkUploadSchema = z.array(z.unknown(), { error: 'Expected array of data' });

export const dutyNotificationErrorBody = (message) => ({ error: message });
