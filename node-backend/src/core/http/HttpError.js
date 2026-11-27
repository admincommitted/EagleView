/**
 * Errors a service or middleware throws; errorHandler.middleware.js turns them into the HTTP answer.
 *
 * The answer body is { success: false, error: message } unless `body` is given: pass `body` when the old route answered
 * in another shape (e.g. { error } without success, or { message }), so the frontend keeps getting exactly the same.
 *   throw new NotFoundError('Master category not found', { body: { error: 'Master category not found' } });
 */
export class ApiError extends Error {
  constructor(statusCode, message, { body, details, errors, code } = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.body = body;
    this.details = details;
    this.errors = errors;
    this.code = code;
    this.isOperational = true;
  }

  toBody() {
    if (this.body) return this.body;
    return {
      success: false,
      error: this.message,
      ...(this.details !== undefined && { details: this.details }),
      ...(this.errors !== undefined && { errors: this.errors }),
    };
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', options) {
    super(400, message, options);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Access denied. Please log in.', options) {
    super(401, message, options);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'You do not have the right to do this', options) {
    super(403, message, options);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found', options) {
    super(404, message, options);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Already exists', options) {
    super(409, message, options);
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Some fields are not valid', options) {
    super(400, message, options);
  }
}

export class TooManyRequestsError extends ApiError {
  constructor(message = 'Too many requests. Please wait and try again.', options) {
    super(429, message, options);
  }
}

export class InternalServerError extends ApiError {
  constructor(message = 'Server error', options) {
    super(500, message, options);
  }
}
