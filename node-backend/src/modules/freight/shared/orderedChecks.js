import { z } from 'zod';

/**
 * A Zod schema that keeps every field as sent and runs the route's checks one after the other, so the first problem
 * (and its message) is the same one the screens always got. `findProblem(value)` returns the message, or '' / null.
 */
export const orderedChecks = (findProblem) =>
  z.looseObject({}).superRefine((value, context) => {
    const message = findProblem(value);
    if (message) context.addIssue({ code: 'custom', message });
  });

/** validate() option: the { error } answer the screens read. */
export const errorOnlyBody = { errorBody: (message) => ({ error: message }) };

/** validate() option: the { success: false, error } answer the screens read. */
export const failureBody = { errorBody: (message) => ({ success: false, error: message }) };
