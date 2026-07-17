import { Router } from 'express';
import { authRateLimiter } from '../../shared/http/rate-limit';
import { authController } from './auth.controller';
import { requireAuth } from './auth.middleware';

export const authRoutes = Router();

// Brute-force gate: the unauthenticated credential endpoints get a strict
// per-IP limiter (failed attempts only) in front of the controllers. The OAuth
// routes are left out — they return redirects (which the "skip successful"
// filter would miscount) and are already guarded by the anti-CSRF state cookie.
authRoutes.post('/login', authRateLimiter, authController.login);
authRoutes.post('/signup', authRateLimiter, authController.signup);

// Session lifecycle (cookie-based; no bearer required — the refresh cookie is
// the credential). Refresh rotates the tokens; logout revokes the session.
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/logout', authController.logout);

// Device login (browser auth for a local coding agent). start/token are
// unauthenticated (the device code is the secret) but rate-limited; lookup and
// approve run as the signed-in browser user.
authRoutes.post('/device/start', authRateLimiter, authController.deviceStart);
authRoutes.get('/device/lookup', requireAuth, authController.deviceLookup);
authRoutes.post('/device/approve', requireAuth, authController.deviceApprove);
authRoutes.post('/device/token', authController.deviceToken);

// Google OAuth (public redirect flow).
authRoutes.get('/google', authController.googleStart);
authRoutes.get('/google/callback', authController.googleCallback);

authRoutes.get('/me', requireAuth, authController.me);
authRoutes.patch('/me', requireAuth, authController.updateMe);

// Personal Access Tokens for coding agents — managed by the authed owner.
authRoutes.post('/tokens', requireAuth, authController.createToken);
authRoutes.get('/tokens', requireAuth, authController.listTokens);
// Retire the PAT that authenticates this call (before the `:id` routes so
// "revoke-current" isn't parsed as a token id).
authRoutes.post(
  '/tokens/revoke-current',
  requireAuth,
  authController.revokeCurrentToken,
);
authRoutes.patch('/tokens/:id', requireAuth, authController.updateToken);
authRoutes.post('/tokens/:id/rotate', requireAuth, authController.rotateToken);
authRoutes.post('/tokens/:id/verify', requireAuth, authController.verifyToken);
authRoutes.delete('/tokens/:id', requireAuth, authController.revokeToken);

// Recent actions performed by the owner's agents (attributed via agentName).
authRoutes.get('/agent-activity', requireAuth, authController.agentActivity);
