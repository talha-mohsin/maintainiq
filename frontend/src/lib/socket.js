/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Real-time Socket.IO client. Derives the socket origin from VITE_API_URL
 * (which points at .../api) by stripping the /api suffix; falls back to
 * same-origin for unified same-domain deployments.
 */
import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const SOCKET_ORIGIN = API_BASE.replace(/\/api\/?$/, '') || undefined;

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_ORIGIN, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
