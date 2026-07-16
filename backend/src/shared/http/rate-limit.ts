import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../../infra/env';
import { redis } from '../../infra/redis';

/**
 * API rate limiter. Keyed on the bearer token when present (so each Personal
 * Access Token / session gets its own budget — a runaway agent can't starve
 * everyone else), otherwise on the client IP. Uses a shared Redis store when
 * `REDIS_URL` is set (correct across instances); otherwise in-memory per node.
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: redis
    ? new RedisStore({
        prefix: 'rl:',
        // Guarded by the `redis ?` above; the closure loses the narrowing.
        sendCommand: (...args: string[]) =>
          redis!.call(args[0], ...args.slice(1)) as Promise<number>,
      })
    : undefined,
  // The health check is polled by load balancers — never rate-limit it.
  skip: (req) => req.path === '/health',
  keyGenerator: (req) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme === 'Bearer' && token) return `tok:${token}`;
    return ipKeyGenerator(req.ip ?? '0.0.0.0');
  },
  handler: (_req, res) => {
    res
      .status(429)
      .json({ error: { message: 'Too many requests — please slow down.' } });
  },
});

/**
 * Strict per-IP limiter for the unauthenticated auth endpoints (login, signup,
 * OAuth start/callback). A brute-force / credential-stuffing gate on top of the
 * global limiter. `skipSuccessfulRequests` means only FAILED attempts (non-2xx)
 * count, so a legitimate user logging in repeatedly is never blocked while a
 * password-guesser is cut off after {@link env.AUTH_RATE_LIMIT_MAX} misses.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: redis
    ? new RedisStore({
        prefix: 'rl:auth:',
        sendCommand: (...args: string[]) =>
          redis!.call(args[0], ...args.slice(1)) as Promise<number>,
      })
    : undefined,
  // Always key on the client IP (these requests carry no bearer token).
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '0.0.0.0'),
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many attempts — please wait a few minutes and try again.',
      },
    });
  },
});
