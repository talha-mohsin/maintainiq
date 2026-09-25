/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server } from 'socket.io';

let io = null;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error(`Socket.IO CORS policy: Origin '${origin}' not allowed`));
      },
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  console.log('🚀 Socket.IO real-time layer initialized.');
  return io;
}

/**
 * Broadcasts an event to every connected client. No-ops safely when
 * Socket.IO has not been initialized (e.g. under test/CLI scripts).
 */
export function emitEvent(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}
