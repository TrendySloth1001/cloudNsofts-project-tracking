import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { notificationsController } from './notifications.controller';

export const notificationsRoutes = Router();

// Every notifications route needs the authenticated recipient.
notificationsRoutes.use(requireAuth);

notificationsRoutes.get('/', notificationsController.list);
notificationsRoutes.get('/preferences', notificationsController.getPreferences);
notificationsRoutes.put(
  '/preferences',
  notificationsController.updatePreference,
);
notificationsRoutes.post('/read-all', notificationsController.markAllRead);
notificationsRoutes.post('/:id/read', notificationsController.markRead);
