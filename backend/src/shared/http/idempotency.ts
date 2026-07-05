import type { NextFunction, Request, Response } from 'express';
import { redis } from '../../infra/redis';

/**
 * Idempotency for unsafe (POST) requests. A client that might retry — e.g. a
 * coding agent after a network blip — sends a stable `Idempotency-Key` header;
 * the first successful response is cached and replayed for any repeat with the
 * same key, so the operation isn't performed twice (no duplicate task/message).
 *
 * Uses Redis when `REDIS_URL` is set (shared across instances); otherwise an
 * in-memory map per node. Concurrent in-flight duplicates aren't locked — this
 * targets the retry-after-response case, which is the common one.
 */
interface Cached {
  status: number;
  body: unknown;
}

const TTL_MS = 10 * 60 * 1000;
const TTL_SEC = TTL_MS / 1000;
const memStore = new Map<string, { value: string; expiresAt: number }>();

function memGet(key: string, now: number): string | null {
  const hit = memStore.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    memStore.delete(key);
    return null;
  }
  return hit.value;
}

function memSet(key: string, value: string, now: number): void {
  if (memStore.size > 5000) {
    for (const [k, v] of memStore) if (v.expiresAt <= now) memStore.delete(k);
  }
  memStore.set(key, { value, expiresAt: now + TTL_MS });
}

async function readCache(key: string, now: number): Promise<string | null> {
  if (redis) return redis.get(key);
  return memGet(key, now);
}

function writeCache(key: string, value: string, now: number): void {
  if (redis) void redis.set(key, value, 'EX', TTL_SEC);
  else memSet(key, value, now);
}

export function idempotency(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const key = req.header('Idempotency-Key');
  if (!key || req.method !== 'POST') {
    next();
    return;
  }

  const [, token] = (req.headers.authorization ?? '').split(' ');
  const actor = token || req.ip || 'anon';
  const cacheKey = `idem:${actor}:${req.originalUrl}:${key}`;
  const now = Date.now();

  void (async () => {
    const cached = await readCache(cacheKey, now);
    if (cached) {
      const { status, body } = JSON.parse(cached) as Cached;
      res.setHeader('Idempotent-Replay', 'true');
      res.status(status).json(body);
      return;
    }

    // Capture the first successful response body for future replays.
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        writeCache(
          cacheKey,
          JSON.stringify({ status: res.statusCode, body }),
          now,
        );
      }
      return originalJson(body);
    }) as Response['json'];

    next();
  })().catch(next);
}
