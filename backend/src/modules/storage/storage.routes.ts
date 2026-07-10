import { Router } from 'express';
import { requireAuth, requirePlatformAdmin } from '../auth/auth.middleware';
import { storageController } from './storage.controller';

// Platform-super-admin only: reconcile stored images against the content that
// references them, and reclaim orphans.
export const storageRoutes = Router();

storageRoutes.use(requireAuth, requirePlatformAdmin);

storageRoutes.get('/audit', storageController.audit);
storageRoutes.post('/audit/purge', storageController.auditPurge);
