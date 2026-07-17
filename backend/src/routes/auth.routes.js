/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { login, logout, me, getTechnicians } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validateBody, schemas } from '../middlewares/validateBody.js';

const router = express.Router();

// Auth routes with validation
router.post('/login', validateBody(schemas.login), asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(me));
router.get('/technicians', authenticate, asyncHandler(getTechnicians));

export default router;
