/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Import Routes
import authRoutes from './routes/auth.routes.js';
import assetRoutes from './routes/asset.routes.js';
import issueRoutes from './routes/issue.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import docsRoutes from './routes/docs.routes.js';
import healthRoutes from './routes/health.routes.js';

const app = express();

// ============================================================
// Security Middleware
// ============================================================

// Helmet sets secure HTTP response headers (XSS, clickjacking, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Vite inlines scripts
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://images.unsplash.com"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
    },
  },
  crossOriginEmbedderPolicy: false, // allow Cloudinary images in iframes
}));

// CORS — allowlist from environment (comma-separated origins)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no Origin header) and allowlisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: Origin '${origin}' not allowed`));
  },
  credentials: true,              // allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compress all responses (gzip/deflate) — reduces payload by ~70%
app.use(compression());

// ============================================================
// Rate Limiting
// ============================================================

// Auth endpoints — strict: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// General API — 300 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// Uploads — strict: 5 file uploads per 15 minutes per IP
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload attempts. Please try again in 15 minutes.' },
});

// Apply rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/upload', uploadLimiter);
app.use('/api', apiLimiter);

// ============================================================
// Body Parsing
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ============================================================
// Routes
// ============================================================

// Health check (no auth, no rate limit — for ALB/PM2/Nginx health probes)
app.use('/health', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/docs', docsRoutes);

// Compatibility fallback for raw /api/technicians in existing frontend calls
import { getTechnicians } from './controllers/auth.controller.js';
import { authenticate } from './middlewares/auth.middleware.js';
app.get('/api/technicians', authenticate, getTechnicians);

// ============================================================
// Global Error Handler
// ============================================================
// eslint-disable-next-line no-unused-vars
// Global standardized error handler
app.use((err, req, res, next) => {
  // Log full error stack in development, concise in production
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', err);
  } else {
    console.error('[Error]', err.message);
  }

  // Map known error types to status codes and messages
  let status = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  // Specific handling for known cases
  if (err.name === 'ValidationError') status = 400;
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') status = 401;
  if (err.name && err.name.includes('CastError')) status = 400;
  if (err.code === 11000) status = 409; // duplicate key

  // Do not expose stack trace to client
  const clientMessage = process.env.NODE_ENV === 'production'
    ? message
    : err.message;

  res.status(status).json({
    success: false,
    message: clientMessage,
    errorCode: err.errorCode || null,
    data: null,
  });
});

export default app;
