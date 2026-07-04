import type {
  Channel,
  ChannelVisibility,
  CreateChannelInput,
  Message,
  PostMessageInput,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';

async function ensureProject(projectId: string): Promise<void> {
  if ((await prisma.project.count({ where: { id: projectId } })) === 0) {
    throw HttpError.notFound('Project not found');
  }
}

/** 404 unless the channel exists and belongs to the given project. */
async function ensureChannel(
  projectId: string,
  channelId: string,
): Promise<void> {
  if (
    (await prisma.channel.count({ where: { id: channelId, projectId } })) === 0
  ) {
    throw HttpError.notFound('Channel not found');
  }
}

function toMessage(m: {
  id: string;
  author: string;
  body: string;
  createdAt: Date;
}): Message {
  return {
    id: m.id,
    author: m.author,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

function toChannel(c: {
  id: string;
  name: string;
  description: string;
  visibility: ChannelVisibility;
  createdAt: Date;
  _count: { messages: number };
}): Channel {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    visibility: c.visibility,
    messageCount: c._count.messages,
    createdAt: c.createdAt.toISOString(),
  };
}

const channelInclude = { _count: { select: { messages: true } } } as const;

export const discussionsService = {
  async listChannels(projectId: string): Promise<Channel[]> {
    await ensureProject(projectId);
    const channels = await prisma.channel.findMany({
      where: { projectId },
      include: channelInclude,
      orderBy: [{ visibility: 'asc' }, { createdAt: 'asc' }],
    });
    return channels.map(toChannel);
  },

  async createChannel(
    projectId: string,
    input: CreateChannelInput,
  ): Promise<Channel> {
    await ensureProject(projectId);
    const created = await prisma.channel.create({
      data: {
        projectId,
        name: input.name,
        description: input.description,
        visibility: input.visibility,
      },
      include: channelInclude,
    });
    return toChannel(created);
  },

  async removeChannel(projectId: string, channelId: string): Promise<void> {
    await ensureChannel(projectId, channelId);
    await prisma.channel.delete({ where: { id: channelId } });
  },

  async listMessages(projectId: string, channelId: string): Promise<Message[]> {
    await ensureChannel(projectId, channelId);
    const messages = await prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(toMessage);
  },

  async postMessage(
    projectId: string,
    channelId: string,
    author: string,
    input: PostMessageInput,
  ): Promise<Message> {
    await ensureChannel(projectId, channelId);
    const created = await prisma.message.create({
      data: { channelId, author, body: input.body },
    });
    return toMessage(created);
  },
};
