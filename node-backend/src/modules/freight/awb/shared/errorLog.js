import { ApiError } from '../../../../core/http/index.js';

/**
 * Runs `work`; an unexpected failure (not an answer the route gives on purpose) is written to the console by `logError`
 * and passed on, so the error handler still sends the 500 answer.
 */
export async function logUnexpectedError(logError, work) {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof ApiError)) logError(error);
    throw error;
  }
}
