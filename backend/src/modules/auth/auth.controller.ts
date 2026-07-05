import { createApiTokenSchema, loginSchema } from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { requireUser } from './access';
import { authService } from './auth.service';

export const authController = {
  login: asyncHandler(async (req, res) => {
    const input = validate(loginSchema, req.body);
    res.json(await authService.login(input));
  }),

  // Runs behind `requireAuth`, so the principal (JWT or PAT) is already resolved.
  me: asyncHandler(async (req, res) => {
    res.json({ user: requireUser(req) });
  }),

  /* --------------------------- Access tokens ---------------------------- */

  createToken: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const input = validate(createApiTokenSchema, req.body);
    res.status(201).json(await authService.createApiToken(user, input));
  }),

  listTokens: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.json({ tokens: await authService.listApiTokens(user) });
  }),

  revokeToken: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    await authService.revokeApiToken(user, req.params.id);
    res.status(204).end();
  }),
};
