import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../../shared/http/http-error';
import { authService, isPlatformAdmin } from './auth.service';

/** HTTP methods a read-only token is allowed to use. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects the request with 401 unless it carries a valid bearer token — either
 * a short-lived JWT (browser sessions) or a Personal Access Token (`cnsofts_pat_…`,
 * used by coding agents). Both resolve to the same `req.authUser` principal, so
 * every downstream RBAC check treats an agent exactly like the user it acts as.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(HttpError.unauthorized('Authentication required'));
    return;
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
