/**
 * Wraps an async controller so a thrown error (or rejected promise) reaches errorHandler.middleware.js.
 *
 * `errorBody` keeps the old answer shape of a route for UNEXPECTED errors (not ApiError): most old routes answered
 * res.status(500).json({ error: err.message }), which is the default; give errorBody when a route answered otherwise:
 *   asyncHandler(listPorts, { errorBody: (error) => ({ success: false, message: error.message }) })
 */
export const asyncHandler =
  (controller, { errorBody } = {}) =>
  async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      const routeError = error instanceof Error ? error : new Error(String(error));
      routeError.thrownInRoute = true;
      if (errorBody && !routeError.isOperational) routeError.responseBody = errorBody(routeError);
      next(routeError);
    }
  };
