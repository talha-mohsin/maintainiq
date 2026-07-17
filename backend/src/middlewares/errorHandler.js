// backend/src/middlewares/errorHandler.js

/**
 * Centralized error handling middleware.
 * Formats all error responses to the standard shape:
 * { success: false, message: string, errorCode: string|null, data: null }
 *
 * Stack traces are logged on the server. In production (NODE_ENV==='production')
 * they are never sent to the client.
 */

const isProduction = process.env.NODE_ENV === 'production';

function errorHandler(err, req, res, next) {
  // If response already sent, delegate to default handler
  if (res.headersSent) {
    return next(err);
  }

  // Default values
  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || 'ERR_INTERNAL';
  let message = err.message || 'An unexpected error occurred.';

  // Map known error types / codes to proper status and errorCode
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'ERR_VALIDATION';
    // err.message already descriptive
  }
  // Duplicate key error (Mongo)
  if (err.code && err.code === 11000) {
    statusCode = 409;
    errorCode = 'ERR_DUPLICATE';
    message = 'Resource already exists.';
  }
  // CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'ERR_BAD_ID';
    message = 'Invalid identifier provided.';
  }
  // JWT errors (from jsonwebtoken)
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'ERR_AUTH';
    message = 'Authentication token is invalid or expired.';
  }
  // Redis errors (ioredis)
  if (err.name === 'RedisError') {
    statusCode = 502;
    errorCode = 'ERR_REDIS';
    message = 'Cache service unavailable.';
  }
  // Cloudinary errors (any error whose name contains 'Cloudinary')
  if (err.name && err.name.includes('Cloudinary')) {
    statusCode = 502;
    errorCode = 'ERR_CLOUDINARY';
    message = 'File upload service error.';
  }
  // Gemini API failures (custom name)
  if (err.name === 'GeminiAPIError') {
    statusCode = 502;
    errorCode = 'ERR_GEMINI';
    message = 'AI service unavailable.';
  }
  // Network errors (axios timeout) – example detection
  if (err.isAxiosError && err.code === 'ECONNABORTED') {
    statusCode = 504;
    errorCode = 'ERR_TIMEOUT';
    message = 'Network timeout.';
  }

  // Log full stack trace for debugging (only server side)
  if (!isProduction) {
    console.error('[Error]', err);
  } else {
    // In production keep logs concise but still capture stack via logger if exists
    console.error('[Error]', err.message);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    data: null,
  });
}

module.exports = errorHandler;
