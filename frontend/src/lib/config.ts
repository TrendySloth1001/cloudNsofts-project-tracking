/**
 * Runtime configuration — the single source of truth for environment-driven
 * values on the client. Nothing reads `process.env` directly outside this file.
 */
function resolveApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit) return explicit;
  // No explicit override: in the browser, talk to the same origin that served
  // the app (in production nginx proxies /api and /socket.io to the backend).
  // This keeps prod correct even when the build-time env var is missing, so a
  // forgotten NEXT_PUBLIC_API_URL can't point the client at localhost. SSR and
  // build have no `window`; there the local backend is the right target.
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:4000';
}

export const config = {
  apiUrl: resolveApiUrl(),
} as const;
