/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';

const router = express.Router();

const startTime = Date.now();

/**
 * GET /health
 * Health check endpoint for AWS ALB, PM2, Nginx, and Docker HEALTHCHECK.
 * Returns 200 if the server is running.
 */
router.get('/', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.status(200).json({
    status: 'ok',
    service: 'MaintainIQ API',
    version: process.env.npm_package_version || '1.4.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: `${uptime}s`,
    timestamp: new Date().toISOString(),
  });
});

export default router;
