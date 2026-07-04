/**
 * Runtime configuration — the single source of truth for environment-driven
 * values on the client. Nothing reads `process.env` directly outside this file.
 */
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
} as const;
