import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../../shared/http/http-error';
import { authService } from './auth.service';

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
      .then(({ user, tokenName }) => {
        req.authUser = user;
        // Attribute agent-performed writes to the token's name ("via <agent>").
        req.agentName = tokenName;
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
