import { Router } from 'express';
import { discussionsController } from './discussions.controller';

// Mounted under `/:id/channels` on the projects router; `mergeParams` exposes
// the parent `:id` (projectId). Auth is inherited from the projects router.
export const discussionsRoutes = Router({ mergeParams: true });

discussionsRoutes.get('/', discussionsController.listChannels);
discussionsRoutes.post('/', discussionsController.createChannel);
discussionsRoutes.delete('/:channelId', discussionsController.removeChannel);
discussionsRoutes.get('/:channelId/messages', discussionsController.listMessages);
discussionsRoutes.post(
  '/:channelId/messages',
  discussionsController.postMessage,
);
