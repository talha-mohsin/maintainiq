/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// This module must be the first import in server.js.
// Because it is a leaf module (no imports), ESM evaluates it before
// any other module's top-level code — ensuring process.env is populated
// before GoogleGenAI, Redis, and MongoDB clients are initialised.
import dotenv from 'dotenv';
dotenv.config();
