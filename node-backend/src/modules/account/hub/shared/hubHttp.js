import { z } from 'zod';
import { ApiError } from '../../../../core/http/index.js';

/** An expected failure answered as { error: message, ...extraBody } - the shape every accounts-hub route uses. */
export const hubError = (statusCode, message, extraBody = {}) =>
  new ApiError(statusCode, message, {
    body: { error: message, ...extraBody },
  });
export const badRequest = (message) => hubError(400, message);
export const forbidden = (message) => hubError(403, message);
export const notFound = (message) => hubError(404, message);

/**
 * Runs a controller with the accounts-hub answer for failures:
 *   - an ApiError (expected failure) -> its status and body
 *   - `onError(res, error)` when the route answers failures in its own way (an empty list, a friendlier message)
 *   - anything else -> 500 { error: message }; with `useErrorStatus` the error's own `status` is kept (400 checks)
 * A local handler (not asyncHandler) because these routes answer a duplicate-key error as 500 / their own text, not 409.
 */
export function handleHubRoute(controller, { useErrorStatus = false, onError } = {}) {
  return async (req, res) => {
    try {
      await controller(req, res);
    } catch (error) {
      if (error instanceof ApiError) return res.status(error.statusCode).json(error.toBody());
      if (onError) return onError(res, error);
      return res.status((useErrorStatus && error.status) || 500).json({ error: error.message });
    }
  };
}

/** The user name written on records (created by, held by ...). */
export const userNameOf = (req) =>
  (req.user && (req.user.fullName || req.user.name || req.user.username)) || req.headers['x-user-name'] || '';

/** validate() option: a failed check answers 400 { error: message }, as the old routes did. */
export const OLD_ERROR_SHAPE = { errorBody: (message) => ({ error: message }) };

/**
 * A schema that runs a route's checks in their original order and reports the first one that fails.
 * `findProblem(input)` returns the message of the first failed check, or nothing when all pass.
 */
export const checkedInput = (findProblem) =>
  z.any().superRefine((input, context) => {
    const message = findProblem(input ?? {});
    if (message) context.addIssue({ code: 'custom', message });
  });
