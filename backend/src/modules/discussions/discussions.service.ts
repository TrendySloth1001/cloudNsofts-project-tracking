import type {
  AddChannelMemberInput,
  AuthUser,
  Channel,
  ChannelMember,
  ChannelVisibility,
  CreateChannelInput,
  ListMessagesQuery,
  Message,
  PostMessageInput,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';
import { realtime } from '../../infra/realtime';
import { notificationsService } from '../notifications/notifications.service';

async function ensureProject(projectId: string): Promise<void> {
  if ((await prisma.project.count({ where: { id: projectId } })) === 0) {
    throw HttpError.notFound('Project not found');
  }
}

/** True if the user may see/enter a channel: admins bypass; everyone else must
 *  be an explicit member (matched by login email). */
async function hasChannelAccess(
  channelId: string,
  user: AuthUser,
): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  return (
    (await prisma.channelMember.count({
      where: { channelId, email: user.email },
    })) > 0
  );
}

/** 404 unless the channel exists, belongs to the project, and the user is a
 *  member (or admin). Not-a-member reads as not-found so nothing is leaked. */
async function ensureChannelAccess(
  projectId: string,
  channelId: string,
  user: AuthUser,
): Promise<void> {
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, projectId },
    select: { id: true },
  });
  if (!channel) throw HttpError.notFound('Channel not found');
  if (!(await hasChannelAccess(channelId, user))) {
    throw HttpError.notFound('Channel not found');
  }
}

function toMessage(m: {
  id: string;
  author: string;
  authorEmail: string | null;
  agentName: string | null;
  body: string;
  attachedTaskId: string | null;
  attachedFeatureId: string | null;
  createdAt: Date;
}): Message {
  return {
    id: m.id,
    author: m.author,
    authorEmail: m.authorEmail,
    agentName: m.agentName ?? null,
    body: m.body,
    attachment: m.attachedTaskId
      ? { kind: 'task', id: m.attachedTaskId }
      : m.attachedFeatureId
        ? { kind: 'feature', id: m.attachedFeatureId }
        : null,
    createdAt: m.createdAt.toISOString(),
  };
}

function toChannel(c: {
  id: string;
  name: string;
  description: string;
  visibility: ChannelVisibility;
  createdAt: Date;
  _count: { messages: number; members: number };
}): Channel {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    visibility: c.visibility,
    messageCount: c._count.messages,
    memberCount: c._count.members,
    createdAt: c.createdAt.toISOString(),
  };
}

function toChannelMember(m: {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}): ChannelMember {
  return {
    id: m.id,
    email: m.email,
    name: m.name,
    createdAt: m.createdAt.toISOString(),
  };
}

const channelInclude = {
  _count: { select: { messages: true, members: true } },
} as const;

export const discussionsService = {
  async listChannels(projectId: string, user: AuthUser): Promise<Channel[]> {
    await ensureProject(projectId);
    const channels = await prisma.channel.findMany({
      where: {
        projectId,
        // Non-admins only see channels they belong to.
        ...(user.role === 'ADMIN'
          ? {}
          : { members: { some: { email: user.email } } }),
      },
      include: channelInclude,
      orderBy: [{ visibility: 'asc' }, { createdAt: 'asc' }],
    });
    return channels.map(toChannel);
  },

  async createChannel(
    projectId: string,
    input: CreateChannelInput,
    user: AuthUser,
  ): Promise<Channel> {
    await ensureProject(projectId);
    const created = await prisma.channel.create({
      data: {
        projectId,
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        // The creator is the channel's first member.
        members: { create: { email: user.email, name: user.name } },
      },
      include: channelInclude,
    });
    return toChannel(created);
  },

  async removeChannel(
    projectId: string,
    channelId: string,
    user: AuthUser,
  ): Promise<void> {
    await ensureChannelAccess(projectId, channelId, user);
    await prisma.channel.delete({ where: { id: channelId } });
  },

  /* ------------------------------ Members ------------------------------- */
  async listMembers(
    projectId: string,
    channelId: string,
    user: AuthUser,
  ): Promise<ChannelMember[]> {
    await ensureChannelAccess(projectId, channelId, user);
    const members = await prisma.channelMember.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
    });
    return members.map(toChannelMember);
  },

  async addMember(
    projectId: string,
    channelId: string,
    input: AddChannelMemberInput,
    user: AuthUser,
  ): Promise<ChannelMember> {
    await ensureChannelAccess(projectId, channelId, user);
    const member = await prisma.channelMember.upsert({
      where: { channelId_email: { channelId, email: input.email } },
      update: { name: input.name },
      create: { channelId, email: input.email, name: input.name },
    });
    return toChannelMember(member);
  },

  async removeMember(
    projectId: string,
    channelId: string,
    memberId: string,
    user: AuthUser,
  ): Promise<void> {
    await ensureChannelAccess(projectId, channelId, user);
    await prisma.channelMember.deleteMany({
      where: { id: memberId, channelId },
    });
  },

  /* ------------------------------ Messages ------------------------------ */
  /**
   * A page of a channel's history, always returned oldest→newest for display.
   * No cursor → the newest `limit`; `after` → newer than it; `before` → older.
   */
  async listMessages(
    projectId: string,
    channelId: string,
    query: ListMessagesQuery,
    user: AuthUser,
  ): Promise<Message[]> {
    await ensureChannelAccess(projectId, channelId, user);
    const { before, after, limit } = query;

    if (after) {
      const rows = await prisma.message.findMany({
        where: { channelId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        cursor: { id: after },
        skip: 1,
        take: limit,
      });
      return rows.map(toMessage);
    }

    const rows = await prisma.message.findMany({
      where: { channelId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
      take: limit,
    });
    return rows.reverse().map(toMessage);
  },

  async postMessage(
    projectId: string,
    channelId: string,
    user: AuthUser,
    input: PostMessageInput,
    agentName: string | null = null,
  ): Promise<Message> {
    await ensureChannelAccess(projectId, channelId, user);

    // A shared task/feature must belong to this project.
    const attachment = input.attachment;
    if (attachment) {
      const exists =
        attachment.kind === 'task'
          ? await prisma.task.count({
              where: { id: attachment.id, projectId },
            })
          : await prisma.feature.count({
              where: { id: attachment.id, projectId },
            });
      if (exists === 0) {
        throw HttpError.badRequest(`That ${attachment.kind} doesn't exist`);
      }
    }

    const created = await prisma.message.create({
      data: {
        channelId,
        author: user.name,
        authorEmail: user.email,
        agentName,
        body: input.body,
        attachedTaskId:
          attachment?.kind === 'task' ? attachment.id : null,
        attachedFeatureId:
          attachment?.kind === 'feature' ? attachment.id : null,
      },
    });
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { name: true },
    });
    // Sharing a task links the conversation back into its activity thread.
    if (attachment?.kind === 'task') {
      await prisma.taskEvent.create({
        data: {
          taskId: attachment.id,
          kind: 'activity',
          author: user.name,
          agentName,
          body: `shared this in #${channel?.name ?? 'a channel'}`,
        },
      });
    }
    void notificationsService.notify({
      kind: 'message_posted',
      title: 'New message',
      body: `${user.name} posted in #${channel?.name ?? 'a channel'}`,
      projectId,
    });
    const message = toMessage(created);
    realtime.emitMessageCreated(projectId, channelId, message);
    return message;
  },

  async removeMessage(
    projectId: string,
    channelId: string,
    messageId: string,
    user: AuthUser,
  ): Promise<void> {
    await ensureChannelAccess(projectId, channelId, user);
    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId },
      select: { authorEmail: true },
    });
    if (!message) throw HttpError.notFound('Message not found');
    // Admins may remove anyone's message; others only their own.
    const isOwn = !!message.authorEmail && message.authorEmail === user.email;
    if (user.role !== 'ADMIN' && !isOwn) {
      throw HttpError.forbidden('You can only delete your own messages');
    }
    await prisma.message.delete({ where: { id: messageId } });
    realtime.emitMessageDeleted(projectId, channelId, messageId);
  },
};
