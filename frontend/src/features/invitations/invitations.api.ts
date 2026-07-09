import {
  apiPaths,
  type CreateInvitationInput,
  type Invitation,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Data-access for invitations — both the invitee side (my pending invites,
 *  accept/decline) and the manager side (invite/list/cancel per project). */
export const invitationsApi = {
  /* ----- Invitee ----- */
  listMine: () =>
    apiClient.get<{ invitations: Invitation[] }>(apiPaths.invitations.mine()),
  accept: (id: string) =>
    apiClient.post<{ invitation: Invitation }>(
      apiPaths.invitations.accept(id),
      {},
    ),
  decline: (id: string) =>
    apiClient.post<{ invitation: Invitation }>(
      apiPaths.invitations.decline(id),
      {},
    ),

  /* ----- Manager / admin (project-scoped) ----- */
  listForProject: (projectId: string) =>
    apiClient.get<{ invitations: Invitation[] }>(
      apiPaths.projects.invitations(projectId),
    ),
  create: (projectId: string, input: CreateInvitationInput) =>
    apiClient.post<Invitation>(apiPaths.projects.invitations(projectId), input),
  cancel: (projectId: string, inviteId: string) =>
    apiClient.delete<void>(apiPaths.projects.invitation(projectId, inviteId)),
};
