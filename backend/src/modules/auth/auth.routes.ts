import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from './auth.middleware';

export const authRoutes = Router();

authRoutes.post('/login', authController.login);
authRoutes.get('/me', requireAuth, authController.me);

// Personal Access Tokens for coding agents — managed by the authed owner.
authRoutes.post('/tokens', requireAuth, authController.createToken);
authRoutes.get('/tokens', requireAuth, authController.listTokens);
authRoutes.delete('/tokens/:id', requireAuth, authController.revokeToken);
