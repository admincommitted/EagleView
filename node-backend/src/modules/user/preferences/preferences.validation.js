import { z } from 'zod';

const PREFERENCE_KEY = /^[a-z0-9_.-]{1,60}$/i;

export const preferenceKeyParams = z.looseObject({
  key: z.string().regex(PREFERENCE_KEY, 'Bad key'),
});
