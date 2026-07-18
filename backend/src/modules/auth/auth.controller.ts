import type { Request, Response } from 'express';
import type { AuthUser } from '@cnsofts/shared';
import {
  createApiTokenSchema,
  deviceApproveSchema,
  deviceStartSchema,
  deviceTokenSchema,
  DEVICE_POLL_INTERVAL_SECONDS,
  loginSchema,
  signupSchema,
  updateApiTokenSchema,
  updateProfileSchema,
  type DeviceStartResponse,
  type GrantableProject,
} from '@cnsofts/shared';
import { env } from '../../infra/env';
import { asyncHandler } from '../../shared/http/async-handler';
import { HttpError } from '../../shared/http/http-error';
import { validate } from '../../shared/http/validate';
import { requireUser } from './access';
import { authService } from './auth.service';
import {
  COOKIE_REFRESH,
  clearSessionCookies,
  newCsrfToken,
  readCookie,
  setSessionCookies,
} from './cookies';
import {
  consentUrl,
  fetchGoogleUser,
  googleEnabled,
  newState,
} from './google';

/** Cookie holding the anti-CSRF state during the Google round-trip. */
const OAUTH_STATE_COOKIE = 'g_oauth_state';
const OAUTH_COOKIE_PATH = '/api/auth';

/** Client fingerprint stored on a session for auditing. */
function sessionMeta(req: Request): { userAgent?: string; ip?: string } {
  return { userAgent: req.get('user-agent') ?? undefined, ip: req.ip };
}

/** Open a session for a just-authenticated user and set the auth cookies. */
async function establishSession(
  req: Request,
  res: Response,
  user: AuthUser,
): Promise<void> {
  const tokens = await authService.startSession(user, sessionMeta(req));
  setSessionCookies(res, tokens, newCsrfToken());
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
    const user = await authService.login(input);
    await establishSession(req, res, user);
    res.json({ user });
  }),

  signup: asyncHandler(async (req, res) => {
    const input = validate(signupSchema, req.body);
    const user = await authService.signup(input);
    await establishSession(req, res, user);
    res.status(201).json({ user });
  }),

  /** Exchange the refresh cookie for a new access token (+ rotated refresh).
   *  Clears the cookies and 401s if the refresh token is missing/invalid. */
  refresh: asyncHandler(async (req, res) => {
    const raw = readCookie(req.headers.cookie, COOKIE_REFRESH);
    const result = raw
      ? await authService.refreshSession(raw, sessionMeta(req))
      : null;
    if (!result) {
      clearSessionCookies(res);
      throw HttpError.unauthorized('Session expired — please sign in again.');
    }
    setSessionCookies(res, result.tokens, newCsrfToken());
    res.json({ user: result.user });
  }),

  /** Revoke the current session and clear its cookies. */
  logout: asyncHandler(async (req, res) => {
    const raw = readCookie(req.headers.cookie, COOKIE_REFRESH);
    if (raw) await authService.revokeSession(raw);
    clearSessionCookies(res);
    res.status(204).end();
  }),

  /* --------------------- Device login (browser auth) -------------------- */

  // CLI begins a login (no auth). Returns codes + the page to approve at.
  deviceStart: asyncHandler(async (req, res) => {
    const input = validate(deviceStartSchema, req.body ?? {});
    const { deviceCode, userCode, expiresIn } =
      await authService.startDevice(input);
    const verificationUri = `${env.CORS_ORIGIN}/connect`;
    const body: DeviceStartResponse = {
      deviceCode,
      userCode,
      verificationUri,
      verificationUriComplete: `${verificationUri}?code=${encodeURIComponent(userCode)}`,
      expiresIn,
      interval: DEVICE_POLL_INTERVAL_SECONDS,
    };
    res.status(201).json(body);
  }),

  // What the /connect page shows before the signed-in user approves.
  deviceLookup: asyncHandler(async (req, res) => {
    const userCode = String(req.query.code ?? '');
    res.json(await authService.lookupDevice(userCode));
  }),

  // Projects the signed-in user may scope the device token to.
  deviceProjects: asyncHandler(async (req, res) => {
    const projects = await authService.grantableProjects(requireUser(req));
    const body: GrantableProject[] = projects;
    res.json(body);
  }),

  // The signed-in user approves a pending device by its user code.
  deviceApprove: asyncHandler(async (req, res) => {
    const input = validate(deviceApproveSchema, req.body);
    await authService.approveDevice(input.userCode, requireUser(req), {
      scope: input.scope,
      projectIds: input.projectIds,
    });
    res.status(204).end();
  }),

  // CLI polls for the minted token (no auth — the device code is the secret).
  deviceToken: asyncHandler(async (req, res) => {
    const input = validate(deviceTokenSchema, req.body);
    res.json(await authService.pollDevice(input.deviceCode));
  }),

  // Revoke the PAT used to authenticate THIS request (a token retiring itself).
  revokeCurrentToken: asyncHandler(async (req, res) => {
    const [scheme, raw] = (req.headers.authorization ?? '').split(' ');
    if (scheme === 'Bearer' && raw && authService.isApiToken(raw)) {
      await authService.revokeApiTokenByRaw(raw);
    }
    res.status(204).end();
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

  // Google redirects back here with `code` + `state`. Verify, sign in, set the
  // session cookies, then redirect the SPA into the app (no token in the URL).
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
      const user = await authService.loginWithGoogle(gUser.email, gUser.name);
      await establishSession(req, res, user);
      res.redirect(`${env.CORS_ORIGIN}/oauth`);
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
