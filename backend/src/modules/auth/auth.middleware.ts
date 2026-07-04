import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../../shared/http/http-error';
import { authService } from './auth.service';

/** Rejects the request with 401 unless it carries a valid bearer token. */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw HttpError.unauthorized('Authentication required');
    }
    authService.verify(token);
    next();
  } catch (err) {
    next(err);
  }
}
