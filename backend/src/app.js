/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import cookieParser from 'cookie-parser';

// Import Routes
import authRoutes from './routes/auth.routes.js';
import assetRoutes from './routes/asset.routes.js';
import issueRoutes from './routes/issue.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import docsRoutes from './routes/docs.routes.js';

const app = express();

// Global Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Mount Modular API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/docs', docsRoutes);

// Compatibility fallback for raw /api/technicians in existing frontend calls
// (since some frontend calls fetch /api/technicians directly instead of /api/auth/technicians)
import { getTechnicians } from './controllers/auth.controller.js';
import { authenticate } from './middlewares/auth.middleware.js';
app.get('/api/technicians', authenticate, getTechnicians);

export default app;
