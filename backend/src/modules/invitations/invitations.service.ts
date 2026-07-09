import { Prisma } from '@prisma/client';
import type {
  AuthUser,
  CreateInvitationInput,
  Invitation,
  InvitationStatus,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';

const withProject = { project: { select: { name: true } } } as const;

type InvitationWithProject = Prisma.InvitationGetPayload<{
  include: typeof withProject;
}>;

function toInvitation(row: InvitationWithProject): Invitation {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    email: row.email,
    role: row.role,
    invitedBy: row.invitedBy,
    status: row.status as InvitationStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

export const invitationsService = {
  /** Invite an email to a project. Idempotent per (project, email): re-inviting
   *  a declined/canceled address flips it back to pending. */
  async create(
    projectId: string,
    input: CreateInvitationInput,
    inviter: AuthUser,
  ): Promise<Invitation> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw HttpError.notFound('Project not found');

    const alreadyMember = await prisma.projectMember.findFirst({
      where: { projectId, email: input.email },
      select: { id: true },
    });
    if (alreadyMember) {
      throw HttpError.conflict('That person is already a member of this project.');
    }

    const row = await prisma.invitation.upsert({
      where: { projectId_email: { projectId, email: input.email } },
      update: {
        role: input.role,
        status: 'pending',
        invitedBy: inviter.name,
        invitedByEmail: inviter.email,
        respondedAt: null,
      },
      create: {
        projectId,
        email: input.email,
        role: input.role,
        invitedBy: inviter.name,
        invitedByEmail: inviter.email,
      },
      include: withProject,
    });
    return toInvitation(row);
  },

  /** Pending invitations for a project (for the team panel). */
  async listForProject(projectId: string): Promise<Invitation[]> {
    const rows = await prisma.invitation.findMany({
      where: { projectId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: withProject,
    });
    return rows.map(toInvitation);
  },

  async cancel(projectId: string, inviteId: string): Promise<void> {
    const row = await prisma.invitation.findFirst({
      where: { id: inviteId, projectId },
      select: { id: true },
    });
    if (!row) throw HttpError.notFound('Invitation not found');
    await prisma.invitation.delete({ where: { id: inviteId } });
  },

  /** The signed-in user's own pending invitations (matched by email). */
  async listMine(user: AuthUser): Promise<Invitation[]> {
    const rows = await prisma.invitation.findMany({
      where: { email: user.email, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      include: withProject,
    });
    return rows.map(toInvitation);
  },

  /** Accept an invitation addressed to the caller → become a project member. */
  async accept(inviteId: string, user: AuthUser): Promise<Invitation> {
    const row = await prisma.invitation.findUnique({
      where: { id: inviteId },
      include: withProject,
    });
    if (!row || row.email !== user.email) {
      throw HttpError.notFound('Invitation not found');
    }
    if (row.status !== 'pending') {
      throw HttpError.badRequest('This invitation is no longer pending.');
    }

    const already = await prisma.projectMember.findFirst({
      where: { projectId: row.projectId, email: user.email },
      select: { id: true },
    });
    if (!already) {
      await prisma.projectMember.create({
        data: {
          projectId: row.projectId,
          name: user.name,
          email: user.email,
          role: row.role,
        },
      });
    }

    const updated = await prisma.invitation.update({
      where: { id: inviteId },
      data: { status: 'accepted', respondedAt: new Date() },
      include: withProject,
    });
    return toInvitation(updated);
  },

  async decline(inviteId: string, user: AuthUser): Promise<Invitation> {
    const row = await prisma.invitation.findUnique({
      where: { id: inviteId },
      select: { id: true, email: true, status: true },
    });
    if (!row || row.email !== user.email) {
      throw HttpError.notFound('Invitation not found');
    }
    if (row.status !== 'pending') {
      throw HttpError.badRequest('This invitation is no longer pending.');
    }
    const updated = await prisma.invitation.update({
      where: { id: inviteId },
      data: { status: 'declined', respondedAt: new Date() },
      include: withProject,
    });
    return toInvitation(updated);
  },
};
