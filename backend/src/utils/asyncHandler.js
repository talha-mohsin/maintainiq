// backend/src/utils/asyncHandler.js

/**
 * Wrap async Express route handlers and forward errors to next().
 * Usage: router.get('/', asyncHandler(async (req, res) => { ... }));
 */
export default function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

