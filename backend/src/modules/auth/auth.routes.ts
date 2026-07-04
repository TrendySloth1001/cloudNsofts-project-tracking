import { Router } from 'express';
import { authController } from './auth.controller';

export const authRoutes = Router();

authRoutes.post('/login', authController.login);
authRoutes.get('/me', authController.me);
