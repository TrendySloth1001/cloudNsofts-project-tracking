/**
 * Auth is cookie-based: the access + refresh tokens live in httpOnly cookies the
 * browser manages and JS cannot read (so XSS can't steal them). The only value
 * the client reads is the non-httpOnly CSRF token, which it echoes back in the
 * `X-CSRF-Token` header on mutating requests (double-submit CSRF).
 */
const CSRF_COOKIE = 'cnsofts_csrf';

/** Read the CSRF token from `document.cookie` (SSR-safe → null on the server). */
export function readCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === CSRF_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}
