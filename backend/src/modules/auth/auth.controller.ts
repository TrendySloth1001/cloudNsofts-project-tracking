import type { Request } from 'express';
import {
  createApiTokenSchema,
  loginSchema,
  signupSchema,
  updateApiTokenSchema,
  updateProfileSchema,
} from '@cnsofts/shared';
import { env } from '../../infra/env';
import { asyncHandler } from '../../shared/http/async-handler';
import { validate } from '../../shared/http/validate';
import { requireUser } from './access';
import { authService } from './auth.service';
import {
  consentUrl,
  fetchGoogleUser,
  googleEnabled,
  newState,
} from './google';

/** Cookie holding the anti-CSRF state during the Google round-trip. */
const OAUTH_STATE_COOKIE = 'g_oauth_state';
const OAUTH_COOKIE_PATH = '/api/auth';

/** Read one cookie value from the raw Cookie header (no cookie-parser dep). */
function readCookie(header: string | undefined, name: string): string | null {
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

/** This server's public callback URL, derived from the (proxied) request so it
 *  matches whatever origin the browser used — must equal the URI registered in
 *  Google Cloud Console. */
function callbackUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  const host = req.get('host');
  return `${proto}://${host}/api/auth/google/callback`;
}

export const authController = {
  login: asyncHandler(async (req, res) => {
    const input = validate(loginSchema, req.body);
    res.json(await authService.login(input));
  }),

  signup: asyncHandler(async (req, res) => {
    const input = validate(signupSchema, req.body);
    res.status(201).json(await authService.signup(input));
  }),

  /* ----------------------------- Google OAuth ---------------------------- */

  // Kick off the flow: set an anti-CSRF state cookie and redirect to Google.
  googleStart: asyncHandler(async (req, res) => {
    if (!googleEnabled()) {
      res.redirect(`${env.CORS_ORIGIN}/login?error=oauth_unavailable`);
      return;
    }
    const state = newState();
    res.cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: OAUTH_COOKIE_PATH,
    });
    res.redirect(consentUrl(callbackUrl(req), state));
  }),

  // Google redirects back here with `code` + `state`. Verify, sign in, and hand
  // the JWT to the SPA via a URL fragment (never sent to servers or logged).
  googleCallback: asyncHandler(async (req, res) => {
    const loginError = (code: string): void =>
      res.redirect(`${env.CORS_ORIGIN}/login?error=${code}`);

    if (!googleEnabled()) return loginError('oauth_unavailable');

    const code = req.query.code;
    const state = req.query.state;
    const expected = readCookie(req.headers.cookie, OAUTH_STATE_COOKIE);
    res.clearCookie(OAUTH_STATE_COOKIE, { path: OAUTH_COOKIE_PATH });

    if (
      typeof code !== 'string' ||
      typeof state !== 'string' ||
      !expected ||
      state !== expected
    ) {
      return loginError('oauth_failed');
    }

    try {
      const gUser = await fetchGoogleUser(code, callbackUrl(req));
      if (!gUser.verified) return loginError('oauth_unverified');
      const { token } = await authService.loginWithGoogle(
        gUser.email,
        gUser.name,
      );
      res.redirect(
        `${env.CORS_ORIGIN}/oauth#token=${encodeURIComponent(token)}`,
      );
    } catch {
      loginError('oauth_failed');
    }
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

  verifyToken: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.json(await authService.verifyOwnedToken(user, req.params.id));
  }),

  agentActivity: asyncHandler(async (req, res) => {
    const user = requireUser(req);
    res.json({ activity: await authService.getAgentActivity(user) });
  }),
};
