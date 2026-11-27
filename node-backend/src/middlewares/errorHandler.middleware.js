import { ZodError } from 'zod';
import { ApiError } from '../core/http/HttpError.js';

const UNIQUE_ERROR = 'SequelizeUniqueConstraintError';
const SEQUELIZE_VALIDATION_ERROR = 'SequelizeValidationError';

const zodIssues = (error) => error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));

const duplicateMessage = (error) => {
  const fields = (error.errors || []).map((item) => item.path).filter(Boolean);
  return fields.length ? `${fields.join(', ')} already exists` : 'This record already exists';
};

function answerFor(error) {
  if (error instanceof ApiError) return { status: error.statusCode, body: error.toBody() };
  if (error instanceof ZodError)
    return { status: 400, body: { success: false, error: 'Some fields are not valid', errors: zodIssues(error) } };
  if (error.name === UNIQUE_ERROR) return { status: 409, body: { success: false, error: duplicateMessage(error) } };
  if (error.name === SEQUELIZE_VALIDATION_ERROR) {
    return {
      status: 400,
      body: { success: false, error: (error.errors || []).map((item) => item.message).join('; ') || error.message },
    };
  }
  const status = Number(error.statusCode || error.status) || 500;
  // a route's own catch answered { error: err.message }; scrubInternalErrors hides internal texts
  if (error.thrownInRoute) return { status, body: error.responseBody || { error: error.message || 'Server error' } };
  return { status, body: middlewareErrorBody(error, status) };
}

const serverErrorReference = () => Date.now().toString(36).toUpperCase();

// errors from Express itself or a middleware (body too large, bad JSON, upload limits)
function middlewareErrorBody(error, status) {
  if (status >= 500)
    return {
      success: false,
      error: `Server error (ref ${error.reference}). Please try again; if it repeats, tell the admin this reference.`,
    };
  if (status === 413) return { success: false, error: 'The data sent is too large.' };
  return { success: false, error: (error.expose !== false && error.message) || 'Bad request' };
}

/** The last middleware: every error thrown in a route ends here and becomes one JSON answer. */
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  error.reference = serverErrorReference();
  const { status, body } = answerFor(error);
  if (status >= 500)
    console.error(
      `[API ${error.reference}] ${req.method} ${String(req.originalUrl || '').split('?')[0]} ->`,
      error.stack || error.message || error,
    );
  return res.status(status).json(body);
}

/** Any /api path no router answered. */
export function apiNotFound(req, res) {
  res.status(404).json({
    success: false,
    error: `API not found: ${req.method} ${req.originalUrl.split('?')[0]}. If it was just added, restart the backend.`,
  });
}
