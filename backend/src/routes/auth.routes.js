/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { login, logout, me, getTechnicians } from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.get('/technicians', authenticate, getTechnicians);

export default router;
