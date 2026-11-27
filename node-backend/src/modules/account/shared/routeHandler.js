import { ApiError } from '../../../core/http/index.js';

const messageBody = (error) => ({ error: error.message });
const statusFromError = (error) => Number(error.status) || 0;

/**
 * Wraps an async accounts controller and answers its errors exactly as the old accounts routes did in their own
 * try / catch, so the screens keep getting the same status codes and bodies:
 *   - an ApiError answers its own status and body;
 *   - any other error answers `status` with `errorBody(error)` (default { error: message }).
 * `useErrorStatus` keeps the old `res.status(e.status || 500)` answers: an error that carries a status (the
 * 400 errors of numberSeries / ledgerGuard / the GST invoice checks) answers with it.
 * The core error handler is not used here because it answers database unique / validation errors with 409 / 400,
 * where these routes always answered `status`.
 */
export const handleRoute =
  (controller, { status = 500, useErrorStatus = false, errorBody = messageBody } = {}) =>
  async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      if (res.headersSent) return next(error);
      if (error instanceof ApiError) return res.status(error.statusCode).json(error.toBody());
      const answerStatus = useErrorStatus ? statusFromError(error) || status : status;
      return res.status(answerStatus).json(errorBody(error));
    }
  };

/** The old `{ success: false, error: message }` answer of the newer accounts screens. */
export const successFalseBody = (error) => ({ success: false, error: error.message });

/** Name of the user who made the request, as most accounts screens store it. */
export const userNameOf = (req) => (req.user && (req.user.fullName || req.user.username)) || null;
