/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import './src/env.js'; // Must be first: loads dotenv before any other module runs
import app from './src/app.js';
import { connectDB } from './src/config/db.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Connect to MongoDB Atlas
  await connectDB();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MaintainIQ API listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal Server Startup Error:', err);
  process.exit(1);
});
