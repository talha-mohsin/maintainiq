/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { validateBody, schemas } from '../middlewares/validateBody.js';
import {
  getIssues,
  triageIssueAI,
  createIssue,
  updateIssue,
  deleteIssue,
  resolveIssue,
  generateAIDraftSummary,
  getIssueAIInsights
} from '../controllers/issue.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Publicly accessible report & AI Triage endpoints (triggered from Public QR Scan View)
// Publicly accessible report & AI Triage endpoints (triggered from Public QR Scan View)
router.post('/triage', asyncHandler(triageIssueAI));
router.post('/', validateBody(schemas.issueCreate), asyncHandler(createIssue));

// Protected routes (for logged-in technicians & admins)
router.get('/', authenticate, asyncHandler(getIssues));
router.post('/ai-draft-summary', authenticate, asyncHandler(generateAIDraftSummary));
router.get('/:id/ai-insights', authenticate, asyncHandler(getIssueAIInsights));
router.put('/:id', authenticate, asyncHandler(updateIssue));
router.delete('/:id', authenticate, asyncHandler(deleteIssue));
router.post('/:id/resolve', authenticate, asyncHandler(resolveIssue));

export default router;
