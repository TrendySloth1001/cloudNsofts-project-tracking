'use client';

import { io, type Socket } from 'socket.io-client';
import { config } from '@/lib/config';

/**
 * A single Socket.IO connection shared across the app, created lazily and
 * reference-counted: it connects only when the first conversation view opens
 * and disconnects shortly after the last one closes. Idle users (the common
 * case) hold no connection at all.
 */
let socket: Socket | null = null;
let refCount = 0;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

/** Grace period before closing, so quick channel switches (and React
 *  StrictMode's mount/unmount/mount) don't thrash the connection. */
const GRACE_MS = 8_000;

function ensureSocket(): Socket {
  if (!socket) {
    socket = io(config.apiUrl, {
      autoConnect: false,
      // WebSocket only — no HTTP long-poll handshake.
      transports: ['websocket'],
      // Send the session cookies on the WS upgrade so the server authenticates
      // the handshake from the httpOnly access cookie (no token in JS).
      withCredentials: true,
    });
  }
  return socket;
}

/** Acquire the shared socket, connecting on first use. */
export function acquireSocket(): Socket {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  refCount += 1;
  const s = ensureSocket();
  if (!s.connected) s.connect();
  return s;
}

/** Release the socket; the connection is dropped once the last consumer
 *  leaves and the grace period elapses. */
export function releaseSocket(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    socket?.disconnect();
    socket = null;
    closeTimer = null;
  }, GRACE_MS);
}
