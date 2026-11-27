import { ApiError } from '../../core/http/index.js';

/**
 * Wraps a controller whose route answers every unexpected error with one fixed status, also when the WhatsApp / mail
 * helpers put their own status (400) on the error. Expected failures (ApiError) keep their own status and body.
 *   router.post('/test', withFixedErrorStatus(sendTest, 500, (error) => ({ error: error.message })))
 */
export const withFixedErrorStatus = (controller, status, bodyOf) => async (req, res, next) => {
  try {
    await controller(req, res, next);
  } catch (error) {
    next(error.isOperational ? error : new ApiError(status, error.message, { body: bodyOf(error) }));
  }
};
