/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import {
  getIssues,
  triageIssueAI,
  createIssue,
  updateIssue,
  resolveIssue,
  generateAIDraftSummary,
  getIssueAIInsights
} from '../controllers/issue.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Publicly accessible report & AI Triage endpoints (triggered from Public QR Scan View)
router.post('/triage', triageIssueAI);
router.post('/', createIssue);

// Protected routes (for logged-in technicians & admins)
router.get('/', authenticate, getIssues);
router.post('/ai-draft-summary', authenticate, generateAIDraftSummary);
router.get('/:id/ai-insights', authenticate, getIssueAIInsights);
router.put('/:id', authenticate, updateIssue);
router.post('/:id/resolve', authenticate, resolveIssue);

export default router;
