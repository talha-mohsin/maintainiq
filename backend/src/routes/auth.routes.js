/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { register, createUser, login, logout, me, getTechnicians } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/role.middleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validateBody, schemas } from '../middlewares/validateBody.js';

const router = express.Router();

// Public self-registration — always creates a Technician account (see
// auth.controller.js). Rate-limited alongside /login in app.js.
router.post('/register', validateBody(schemas.register), asyncHandler(register));

// Auth routes with validation
router.post('/login', validateBody(schemas.login), asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(me));
router.get('/technicians', authenticate, asyncHandler(getTechnicians));

// Admin-only: provision an Admin or Technician account directly.
router.post('/users', authenticate, authorize(['Admin']), validateBody(schemas.createUser), asyncHandler(createUser));

export default router;
