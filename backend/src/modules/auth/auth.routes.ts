import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from './auth.middleware';

export const authRoutes = Router();

authRoutes.post('/login', authController.login);
authRoutes.post('/signup', authController.signup);
authRoutes.get('/me', requireAuth, authController.me);
authRoutes.patch('/me', requireAuth, authController.updateMe);

// Personal Access Tokens for coding agents — managed by the authed owner.
authRoutes.post('/tokens', requireAuth, authController.createToken);
authRoutes.get('/tokens', requireAuth, authController.listTokens);
authRoutes.patch('/tokens/:id', requireAuth, authController.updateToken);
authRoutes.post('/tokens/:id/rotate', requireAuth, authController.rotateToken);
authRoutes.delete('/tokens/:id', requireAuth, authController.revokeToken);

// Recent actions performed by the owner's agents (attributed via agentName).
authRoutes.get('/agent-activity', requireAuth, authController.agentActivity);
