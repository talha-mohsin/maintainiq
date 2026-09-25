/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Runs before each test file's module registry is populated, so it must
 * set env vars before app.js (and anything it imports) is required —
 * JWT_SECRET in particular is read at module load time.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production';
delete process.env.MONGODB_URI; // force the in-memory DB fallback (see src/config/db.js)
delete process.env.REDIS_URL;   // force the in-memory cache fallback (see src/config/cache.js)
delete process.env.GEMINI_API_KEY; // force deterministic AI triage/insights fallbacks
