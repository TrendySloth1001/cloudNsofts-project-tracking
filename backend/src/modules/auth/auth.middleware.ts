import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../../shared/http/http-error';
import { authService, isPlatformAdmin } from './auth.service';
import { COOKIE_ACCESS, COOKIE_CSRF, readCookie } from './cookies';

/** HTTP methods a read-only token is allowed to use. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects the request with 401 unless it carries a valid credential — a browser
 * session (the httpOnly access-JWT cookie) OR a bearer token in the
 * `Authorization` header (a short-lived JWT, or a Personal Access Token
 * `cnsofts_pat_…` used by coding agents / the MCP). All resolve to the same
 * `req.authUser` principal, so every downstream RBAC check treats an agent
 * exactly like the user it acts as.
 *
 * Cookie-authenticated *mutations* additionally require a matching CSRF token
 * (double-submit: the `X-CSRF-Token` header must equal the readable CSRF
 * cookie). Bearer requests skip CSRF — an attacker's site can't set the
 * `Authorization` header cross-origin, and PATs never ride in cookies.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization ?? '';
  const [scheme, headerToken] = header.split(' ');
  const hasBearer = scheme === 'Bearer' && !!headerToken;
  const cookieToken = hasBearer
    ? null
    : readCookie(req.headers.cookie, COOKIE_ACCESS);
  const token = hasBearer ? headerToken : cookieToken;

  if (!token) {
    next(HttpError.unauthorized('Authentication required'));
    return;
  }

  // CSRF gate for cookie-based mutating requests (double-submit token).
  if (cookieToken && !SAFE_METHODS.has(req.method)) {
    const headerCsrf = req.get('x-csrf-token');
    const cookieCsrf = readCookie(req.headers.cookie, COOKIE_CSRF);
    if (!headerCsrf || !cookieCsrf || headerCsrf !== cookieCsrf) {
      next(HttpError.forbidden('Invalid or missing CSRF token.'));
      return;
    }
  }

  if (authService.isApiToken(token)) {
    authService
      .verifyApiToken(token)
      .then(({ user, tokenName, scope, projectIds, canDelete }) => {
        // Read-only tokens may only make safe (non-mutating) requests.
        if (scope === 'read_only' && !SAFE_METHODS.has(req.method)) {
          throw HttpError.forbidden(
            'This token is read-only and cannot make changes.',
          );
        }
        // Destructive ops require the token to opt into delete access.
        if (req.method === 'DELETE' && !canDelete) {
          throw HttpError.forbidden(
            'This token is not allowed to delete. Generate one with delete access.',
          );
        }
        req.authUser = user;
        // Attribute agent-performed writes to the token's name ("via <agent>").
        req.agentName = tokenName;
        req.tokenScope = { scope, projectIds, canDelete };
        next();
      })
      .catch(next);
    return;
  }

  try {
    req.authUser = authService.verify(token);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Restricts a route to the single platform super-admin (env `ADMIN_EMAIL`).
 * Must run after `requireAuth` so `req.authUser` is set. Everyone else — even a
 * per-project admin — gets 403.
 */
export function requirePlatformAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.authUser || !isPlatformAdmin(req.authUser)) {
    next(HttpError.forbidden('Platform administrator access required'));
    return;
  }
  next();
}
