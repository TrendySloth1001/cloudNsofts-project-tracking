import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralized, validated environment configuration — the single source of
 * truth for runtime config. Importing this module fails fast with a clear
 * message if a required variable (e.g. DATABASE_URL) is missing.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),

  // Invite-only app: a single bootstrap admin lives in env for now.
  ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  ADMIN_PASSWORD: z.string().min(1, 'ADMIN_PASSWORD is required'),
  // Secret used to sign auth tokens. Override with a strong value in production.
  AUTH_SECRET: z.string().min(16).default('dev-insecure-secret-change-me!!'),
  AUTH_TOKEN_TTL: z.string().default('7d'),

  // Optional Redis URL. When set, Socket.IO uses the Redis adapter so realtime
  // fans out across multiple backend instances (horizontal scale). Unset =
  // single-node in-memory fanout.
  REDIS_URL: z.string().url().optional(),

  // Per-token (or per-IP) API rate limit.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
export type Env = typeof env;
