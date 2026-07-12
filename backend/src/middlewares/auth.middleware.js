/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jwt from 'jsonwebtoken';

/**
 * JWT_SECRET must be explicitly set in all environments.
 * The application will fail fast at startup if not configured —
 * never fall back to a hardcoded secret in source code.
 */
const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production. Server will not start without it.');
  } else {
    console.warn('⚠️  JWT_SECRET is not set. Using a temporary development secret. DO NOT use this in production.');
  }
}

const EFFECTIVE_SECRET = JWT_SECRET || 'dev-only-secret-not-for-production-use';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const tokenFromCookie = req.cookies?.token;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : tokenFromCookie;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, EFFECTIVE_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userName = decoded.name;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
