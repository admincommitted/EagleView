const successFalseError = (error) => ({ success: false, error: error.message });

/**
 * Wraps an async customs controller.
 *
 * Expected failures (ApiError thrown by a service) go to the global error handler with their own status and body.
 * Any other error is answered here exactly as the customs screens have always received it: `status` (500 unless
 * given) with `errorBody(error)`. `useErrorStatus` answers with the error's own `status` when it has one (utils such
 * as beAmendment.js throw errors carrying `status`). The global handler is not used for these on purpose: it maps
 * Sequelize unique / validation errors to 409 / 400, while these routes always answered them with `status`.
 */
export function handleRoute(
  controller,
  { status = 500, errorBody = successFalseError, useErrorStatus = false, onError } = {},
) {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      if (error.isOperational || res.headersSent) return next(error);
      if (onError) onError(error);
      const answerStatus = useErrorStatus ? error.status || status : status;
      return res.status(answerStatus).json(errorBody(error));
    }
  };
}

export const errorOnly = (error) => ({ error: error.message });
export const successFalseMessage = (error) => ({ success: false, message: error.message });
