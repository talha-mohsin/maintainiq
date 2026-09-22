/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../utils/asyncHandler.js';
import { validateBody, schemas } from '../middlewares/validateBody.js';
import {
  getIssues,
  triageIssueAI,
  createIssue,
  updateIssue,
  deleteIssue,
  resolveIssue,
  reopenIssue,
  generateAIDraftSummary,
  getIssueAIInsights
} from '../controllers/issue.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize, authorizeIssueAccess } from '../middlewares/role.middleware.js';

const router = express.Router();

// ============================================================
// Dedicated rate limiters (Agent.md bonus: public reporting + AI endpoint)
// ============================================================

// AI Triage — calls an external LLM; strictly limited per IP.
const aiTriageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI triage requests. Please try again in 15 minutes.' },
});

// Public issue submission — unauthenticated, so it needs its own strict ceiling
// independent of the general API limiter.
const publicIssueLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many issue reports from this network. Please try again in 15 minutes.' },
});

// Publicly accessible report & AI Triage endpoints (triggered from Public QR Scan View)
router.post('/triage', aiTriageLimiter, asyncHandler(triageIssueAI));
router.post('/', publicIssueLimiter, validateBody(schemas.issueCreate), asyncHandler(createIssue));

// Protected routes (for logged-in technicians & admins)
router.get('/', authenticate, asyncHandler(getIssues));
router.post('/ai-draft-summary', authenticate, asyncHandler(generateAIDraftSummary));
router.get('/:id/ai-insights', authenticate, asyncHandler(getIssueAIInsights));

// A technician may only update/resolve an issue assigned to them; Admins may act on any issue.
router.put('/:id', authenticate, asyncHandler(authorizeIssueAccess()), asyncHandler(updateIssue));
router.post('/:id/resolve', authenticate, asyncHandler(authorizeIssueAccess()), asyncHandler(resolveIssue));

// Admin-only: deleting records and reopening a completed workflow are administrative actions.
router.delete('/:id', authenticate, authorize(['Admin']), asyncHandler(deleteIssue));
router.post('/:id/reopen', authenticate, authorize(['Admin']), asyncHandler(reopenIssue));

export default router;
