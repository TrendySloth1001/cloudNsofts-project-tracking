import {
  createApiTokenSchema,
  loginSchema,
  signupSchema,
  updateApiTokenSchema,
  updateProfileSchema,
} from '@cnsofts/shared';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { requireUser } from './access';
import { authService } from './auth.service';

export const authController = {
  login: asyncHandler(async (req, res) => {
    const input = validate(loginSchema, req.body);
    res.json(await authService.login(input));
  }),

  signup: asyncHandler(async (req, res) => {
    const input = validate(signupSchema, req.body);
    res.status(201).json(await authService.signup(input));
  }),

  // Runs behind `requireAuth`, so the principal (JWT or PAT) is already resolved.
  me: asyncHandler(async (req, res) => {
    res.json({ user: await authService.getProfile(requireUser(req)) });
  }),

  updateMe: asyncHandler(async (req, res) => {
    const input = validate(updateProfileSchema, req.body);
    res.json({
      user: await authService.updateProfile(requireUser(req), input),
    });
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

  updateToken: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    const input = validate(updateApiTokenSchema, req.body);
    res.json(await authService.updateApiToken(user, req.params.id, input));
  }),

  rotateToken: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.status(201).json(await authService.rotateApiToken(user, req.params.id));
  }),

  revokeToken: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    await authService.revokeApiToken(user, req.params.id);
    res.status(204).end();
  }),

  agentActivity: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.json({ activity: await authService.getAgentActivity(user) });
  }),
};
