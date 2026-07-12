/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import './src/env.js'; // Must be first: loads dotenv before any other module runs
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  // Connect to MongoDB Atlas
  await connectDB();

  if (process.env.NODE_ENV !== 'production') {
    // Integrate Vite as a dev-server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.resolve(__dirname, '../frontend')
    });
    app.use(vite.middlewares);
  } else {
    // Production serving: look for the production frontend dist folder
    const distPath = path.resolve(__dirname, '../frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal Server Startup Error:', err);
});
