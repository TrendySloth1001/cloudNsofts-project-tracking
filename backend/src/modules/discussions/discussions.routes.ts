import { Router } from 'express';
import { requireProjectAbility } from '../auth/access';
import { discussionsController } from './discussions.controller';

// Mounted under `/:id/channels` on the projects router; `mergeParams` exposes
// the parent `:id` (projectId). Auth + project-access (which resolves
// `req.projectRole`) are inherited from the projects router.
export const discussionsRoutes = Router({ mergeParams: true });

// Creating/deleting channels and managing rosters: managers + admins.
const canManageChannels = requireProjectAbility('canManageChannels');

discussionsRoutes.get('/', discussionsController.listChannels);
discussionsRoutes.post('/', canManageChannels, discussionsController.createChannel);
discussionsRoutes.delete(
  '/:channelId',
  canManageChannels,
  discussionsController.removeChannel,
);

// Channel membership. Any member can view the roster; managers/admins add/remove.
discussionsRoutes.get(
  '/:channelId/members',
  discussionsController.listMembers,
);
discussionsRoutes.post(
  '/:channelId/members',
  canManageChannels,
  discussionsController.addMember,
);
discussionsRoutes.delete(
  '/:channelId/members/:memberId',
  canManageChannels,
  discussionsController.removeMember,
);

// Cheap channel orientation for agents (counts, participants, recent previews).
discussionsRoutes.get(
  '/:channelId/overview',
  discussionsController.channelOverview,
);

discussionsRoutes.get('/:channelId/messages', discussionsController.listMessages);
// A single full (untruncated) message by id.
discussionsRoutes.get(
  '/:channelId/messages/:messageId',
  discussionsController.getMessage,
);
// Any channel member can post; access is enforced by membership in the service.
discussionsRoutes.post(
  '/:channelId/messages',
  discussionsController.postMessage,
);

// Scheduled (send-later) messages — any channel member; cancel is author/admin.
discussionsRoutes.get(
  '/:channelId/scheduled',
  discussionsController.listScheduled,
);
discussionsRoutes.post(
  '/:channelId/scheduled',
  discussionsController.scheduleMessage,
);
discussionsRoutes.delete(
  '/:channelId/scheduled/:scheduledId',
  discussionsController.cancelScheduled,
);
// Delete a message — the service allows the author or an admin.
discussionsRoutes.delete(
  '/:channelId/messages/:messageId',
  discussionsController.removeMessage,
);
