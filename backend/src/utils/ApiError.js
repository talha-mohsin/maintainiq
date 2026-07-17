// backend/src/utils/ApiError.js

/**
 * Base class for API errors with status code and error code.
 */
class ApiError extends Error {
  constructor(message, statusCode = 500, errorCode = 'ERR_INTERNAL') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends ApiError {
  constructor(message = 'Invalid request data') {
    super(message, 400, 'ERR_VALIDATION');
  }
}

class AuthError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'ERR_AUTH');
  }
}

class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'ERR_FORBIDDEN');
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'ERR_NOT_FOUND');
  }
}

class ConflictError extends ApiError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'ERR_CONFLICT');
  }
}

class UnprocessableEntityError extends ApiError {
  constructor(message = 'Unprocessable entity') {
    super(message, 422, 'ERR_UNPROCESSABLE');
  }
}

export { ApiError, ValidationError, AuthError, ForbiddenError, NotFoundError, ConflictError, UnprocessableEntityError };
