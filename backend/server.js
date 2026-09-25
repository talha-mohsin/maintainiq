/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import './src/env.js'; // Must be first: loads dotenv before any other module runs
import http from 'http';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { initSocket } from './src/socket.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Connect to MongoDB Atlas
  await connectDB();

  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`MaintainIQ API listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
