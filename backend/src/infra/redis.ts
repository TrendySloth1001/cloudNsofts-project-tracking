import Redis from 'ioredis';
import { env } from './env';

/**
 * Redis wiring. Optional: when `REDIS_URL` is unset the app runs single-node
 * with in-memory fallbacks (rate limit, idempotency) and in-process Socket.IO
 * fanout. When set, these become shared across instances so the backend scales
 * horizontally.
 *
 * `createRedis()` mints a fresh connection (the Socket.IO adapter needs its own
 * dedicated pub/sub pair). `redis` is a shared command client for the rate
 * limiter and idempotency store.
 */
export function createRedis(): Redis {
  const client = new Redis(env.REDIS_URL as string, {
    // Keep retrying rather than crashing the process if Redis blips.
    maxRetriesPerRequest: null,
  });
  // Without an 'error' listener, ioredis errors would crash the process.
  client.on('error', (err) => {
    console.error('[redis] connection error:', err.message);
  });
  return client;
}

export const redis: Redis | null = env.REDIS_URL ? createRedis() : null;
