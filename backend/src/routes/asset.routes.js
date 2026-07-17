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
  getAssetAIInsights,
} from '../controllers/asset.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validateBody, schemas } from '../middlewares/validateBody.js';

const router = express.Router();

// Public route for QR code scanning
router.get('/public/:code', getAssetPublic);

// Protected routes
router.get('/', authenticate, asyncHandler(getAssets));
router.get('/:id', authenticate, asyncHandler(getAssetById));
router.get('/:id/history', authenticate, asyncHandler(getAssetHistory));
router.get('/:id/ai-insights', authenticate, asyncHandler(getAssetAIInsights));

// Admin-only routes
router.post('/', authenticate, authorize(['Admin']), validateBody(schemas.assetCreate), asyncHandler(createAsset));
router.put('/:id', authenticate, authorize(['Admin']), validateBody(schemas.assetUpdate), asyncHandler(updateAsset));
router.delete('/:id', authenticate, authorize(['Admin']), asyncHandler(deleteAsset));

export default router;
