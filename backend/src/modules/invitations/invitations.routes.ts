import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { requireProjectAbility } from '../auth/access';
import { invitationsController } from './invitations.controller';

/**
 * Project-scoped invitation management (create / list / cancel). Mounted under
 * `/:id/invitations` on the projects router; `mergeParams` exposes the parent
 * `:id`. Auth + project access are inherited; managing the roster needs the
 * `canManageTeam` ability.
 */
export const projectInvitationsRoutes = Router({ mergeParams: true });
const canManageTeam = requireProjectAbility('canManageTeam');

projectInvitationsRoutes.get('/', canManageTeam, invitationsController.listForProject);
projectInvitationsRoutes.post('/', canManageTeam, invitationsController.create);
projectInvitationsRoutes.delete(
  '/:inviteId',
  canManageTeam,
  invitationsController.cancel,
);

/**
 * The signed-in user's own pending invitations. Mounted at `/api/invitations`;
 * every route just needs authentication (the service checks the invite is
 * addressed to the caller's email).
 */
export const invitationsRoutes = Router();
invitationsRoutes.use(requireAuth);

invitationsRoutes.get('/', invitationsController.listMine);
invitationsRoutes.post('/:id/accept', invitationsController.accept);
invitationsRoutes.post('/:id/decline', invitationsController.decline);
