import { randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { env } from '../../infra/env';
import type { SessionTokens } from './auth.service';

/**
 * Cookie-based browser sessions. Three cookies:
 *  - `cnsofts_at`  — the short-lived access JWT (httpOnly, so XSS can't read it).
 *  - `cnsofts_rt`  — the refresh token, path-scoped to `/api/auth` so it's only
 *                    ever sent to the refresh/logout endpoints (httpOnly).
 *  - `cnsofts_csrf`— a CSRF token, readable by JS: the SPA echoes it back in the
 *                    `X-CSRF-Token` header on mutating requests (double-submit).
 *
 * All are `SameSite=Lax` (cross-site requests don't carry them — the CSRF gate)
 * and `Secure` in production. PAT/Bearer clients (the MCP) are unaffected.
 */
export const COOKIE_ACCESS = 'cnsofts_at';
export const COOKIE_REFRESH = 'cnsofts_rt';
export const COOKIE_CSRF = 'cnsofts_csrf';

/** Only the auth endpoints ever need the refresh token, so scope it there. */
const REFRESH_PATH = '/api/auth';
const DAY_MS = 24 * 60 * 60 * 1000;

const isProd = (): boolean => env.NODE_ENV === 'production';
const maxAgeMs = (): number => env.REFRESH_TOKEN_TTL_DAYS * DAY_MS;

function base(httpOnly: boolean, path = '/'): CookieOptions {
  return {
    httpOnly,
    secure: isProd(),
    sameSite: 'lax',
    path,
    maxAge: maxAgeMs(),
  };
}

/** A fresh CSRF token (opaque random). */
export function newCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Write the access + refresh + CSRF cookies for a session. */
export function setSessionCookies(
  res: Response,
  tokens: SessionTokens,
  csrfToken: string,
): void {
  res.cookie(COOKIE_ACCESS, tokens.accessToken, base(true));
  res.cookie(COOKIE_REFRESH, tokens.refreshToken, base(true, REFRESH_PATH));
  res.cookie(COOKIE_CSRF, csrfToken, base(false));
}

/** Clear all three session cookies (logout / failed refresh). */
export function clearSessionCookies(res: Response): void {
  res.clearCookie(COOKIE_ACCESS, { path: '/' });
  res.clearCookie(COOKIE_REFRESH, { path: REFRESH_PATH });
  res.clearCookie(COOKIE_CSRF, { path: '/' });
}

/** Read one cookie value from a raw Cookie header (no cookie-parser dependency). */
export function readCookie(
  header: string | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}
