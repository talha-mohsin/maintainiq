/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import {
  getAssets,
  getAssetById,
  getAssetPublic,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetHistory,
  getAssetAIInsights
} from '../controllers/asset.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';

const router = express.Router();

// Public route for QR code scanning
router.get('/public/:code', getAssetPublic);

// Protected routes
router.get('/', authenticate, getAssets);
router.get('/:id', authenticate, getAssetById);
router.get('/:id/history', authenticate, getAssetHistory);
router.get('/:id/ai-insights', authenticate, getAssetAIInsights);

// Admin-only routes
router.post('/', authenticate, authorize(['Admin']), createAsset);
router.put('/:id', authenticate, authorize(['Admin']), updateAsset);
router.delete('/:id', authenticate, authorize(['Admin']), deleteAsset);

export default router;
