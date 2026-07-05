import type { Request } from 'express';
import { loginSchema } from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { HttpError } from '../../shared/http/http-error';
import { authService } from './auth.service';

/** Extract the `Authorization: Bearer <token>` value or throw 401. */
function getBearerToken(req: Request): string {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw HttpError.unauthorized('Missing bearer token');
  }
  return token;
}

export const authController = {
  login: asyncHandler(async (req, res) => {
    const input = validate(loginSchema, req.body);
    res.json(await authService.login(input));
  }),

  me: asyncHandler(async (req, res) => {
    const token = getBearerToken(req);
    res.json({ user: authService.verify(token) });
  }),
};
