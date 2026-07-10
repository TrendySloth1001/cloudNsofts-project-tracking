import { Prisma } from '@prisma/client';
import type {
  AddChannelMemberInput,
  AuthUser,
  Channel,
  ChannelMember,
  ChannelOverview,
  ChannelVisibility,
  ChannelWaitQuery,
  ChannelWaitResult,
  ConversationSearchResult,
  CreateChannelInput,
  ListMessagesQuery,
  Message,
  MessageAttachment,
  PostMessageInput,
  ProjectRole,
  ScheduledMessage,
  ScheduledMessageStatus,
  ScheduleMessageInput,
  SearchConversationsQuery,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';
import { realtime } from '../../infra/realtime';
import { pulseChannel, waitForChannelPulse } from '../../infra/channel-events';
import { notificationsService } from '../notifications/notifications.service';

/** Truncate a body to a token-cheap preview for search/overview payloads. */
function snippet(body: string, max = 240): string {
  const s = body.trim();
  return s.length <= max ? s : `${s.slice(0, max).trimEnd()}…`;
}

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

type AttachmentIds = {
  attachedTaskId: string | null;
  attachedFeatureId: string | null;
  attachedMilestoneId: string | null;
};

/** Resolve the attachment (at most one id set) from a row's columns. */
function attachmentOf(ids: AttachmentIds): MessageAttachment | null {
  if (ids.attachedTaskId) return { kind: 'task', id: ids.attachedTaskId };
  if (ids.attachedFeatureId)
    return { kind: 'feature', id: ids.attachedFeatureId };
  if (ids.attachedMilestoneId)
    return { kind: 'milestone', id: ids.attachedMilestoneId };
  return null;
}

/** The message columns for an attachment (at most one id set). */
function attachmentColumns(
  attachment: MessageAttachment | null | undefined,
): AttachmentIds {
  return {
    attachedTaskId: attachment?.kind === 'task' ? attachment.id : null,
    attachedFeatureId: attachment?.kind === 'feature' ? attachment.id : null,
    attachedMilestoneId:
      attachment?.kind === 'milestone' ? attachment.id : null,
  };
}

/** Verify the attachment target exists in the project; throws 400 if not. */
async function assertAttachmentExists(
  projectId: string,
  attachment: MessageAttachment,
): Promise<void> {
  const exists =
    attachment.kind === 'task'
      ? await prisma.task.count({ where: { id: attachment.id, projectId } })
      : attachment.kind === 'feature'
        ? await prisma.feature.count({ where: { id: attachment.id, projectId } })
        : await prisma.milestone.count({
            where: { id: attachment.id, projectId },
          });
  if (exists === 0) {
    throw HttpError.badRequest(`That ${attachment.kind} doesn't exist`);
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
  attachedMilestoneId: string | null;
  createdAt: Date;
}): Message {
  return {
    id: m.id,
    author: m.author,
    authorEmail: m.authorEmail,
    agentName: m.agentName ?? null,
    body: m.body,
    attachment: attachmentOf(m),
    createdAt: m.createdAt.toISOString(),
  };
}

function toScheduledMessage(row: {
  id: string;
  channelId: string;
  author: string;
  agentName: string | null;
  body: string;
  attachedTaskId: string | null;
  attachedFeatureId: string | null;
  attachedMilestoneId: string | null;
  scheduledFor: Date;
  status: string;
  createdAt: Date;
}): ScheduledMessage {
  return {
    id: row.id,
    channelId: row.channelId,
    author: row.author,
    agentName: row.agentName ?? null,
    body: row.body,
    attachment: attachmentOf(row),
    scheduledFor: row.scheduledFor.toISOString(),
    status: row.status as ScheduledMessageStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

function toChannel(c: {
  id: string;
  name: string;
  description: string;
  visibility: ChannelVisibility;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
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
    resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : null,
    resolvedBy: c.resolvedBy,
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

  /** Fetch a single full message (untruncated) by id, access-checked. */
  async getMessage(
    projectId: string,
    channelId: string,
    messageId: string,
    user: AuthUser,
  ): Promise<Message> {
    await ensureChannelAccess(projectId, channelId, user);
    const m = await prisma.message.findFirst({
      where: { id: messageId, channelId },
    });
    if (!m) throw HttpError.notFound('Message not found');
    return toMessage(m);
  },

  /** Cheap channel orientation: counts, participants, span, last few previews. */
  async getChannelOverview(
    projectId: string,
    channelId: string,
    user: AuthUser,
  ): Promise<ChannelOverview> {
    await ensureChannelAccess(projectId, channelId, user);
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, projectId },
      select: { name: true },
    });
    const [count, span, recent, authors] = await Promise.all([
      prisma.message.count({ where: { channelId } }),
      prisma.message.aggregate({
        where: { channelId },
        _min: { createdAt: true },
        _max: { createdAt: true },
      }),
      prisma.message.findMany({
        where: { channelId },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      prisma.message.findMany({
        where: { channelId },
        distinct: ['author'],
        select: { author: true },
        take: 50,
      }),
    ]);
    return {
      channelId,
      name: channel?.name ?? '',
      messageCount: count,
      participants: authors.map((a) => a.author),
      firstMessageAt: span._min.createdAt?.toISOString() ?? null,
      lastMessageAt: span._max.createdAt?.toISOString() ?? null,
      recent: recent.reverse().map((m) => ({
        id: m.id,
        author: m.author,
        agentName: m.agentName ?? null,
        snippet: snippet(m.body),
        createdAt: m.createdAt.toISOString(),
      })),
    };
  },

  /**
   * Full-text search across a project's conversations — channel messages (only
   * ones the caller can see) and, for non-client roles, task threads. Ranked by
   * relevance then recency; returns truncated snippets so an agent finds context
   * without ingesting whole threads.
   */
  async searchConversations(
    projectId: string,
    query: SearchConversationsQuery,
    user: AuthUser,
    projectRole: ProjectRole | null,
  ): Promise<ConversationSearchResult[]> {
    const { q, channelId, limit } = query;

    // Resolve the channels the caller may read (a single one if requested).
    let channelIds: string[];
    if (channelId) {
      await ensureChannelAccess(projectId, channelId, user);
      channelIds = [channelId];
    } else if (user.role === 'ADMIN') {
      const rows = await prisma.channel.findMany({
        where: { projectId },
        select: { id: true },
      });
      channelIds = rows.map((r) => r.id);
    } else {
      const rows = await prisma.channelMember.findMany({
        where: { email: user.email, channel: { projectId } },
        select: { channelId: true },
      });
      channelIds = rows.map((r) => r.channelId);
    }

    interface Ranked {
      id: string;
      author: string;
      agentName: string | null;
      body: string;
      createdAt: Date;
      channelId: string | null;
      channelName: string | null;
      taskId: string | null;
      taskTitle: string | null;
      rank: number;
    }

    const messageRows =
      channelIds.length > 0
        ? await prisma.$queryRaw<Ranked[]>(Prisma.sql`
            SELECT m.id, m.author, m."agentName", m.body, m."createdAt",
                   m."channelId", c.name AS "channelName",
                   NULL AS "taskId", NULL AS "taskTitle",
                   ts_rank(to_tsvector('english', m.body),
                           plainto_tsquery('english', ${q})) AS rank
            FROM messages m
            JOIN channels c ON c.id = m."channelId"
            WHERE m."channelId" IN (${Prisma.join(channelIds)})
              AND to_tsvector('english', m.body) @@ plainto_tsquery('english', ${q})
            ORDER BY rank DESC, m."createdAt" DESC
            LIMIT ${limit}
          `)
        : [];

    // Task threads are internal — never surfaced to client-role callers, and
    // only when searching the whole project (not a single channel).
    const includeThreads = projectRole !== 'client' && !channelId;
    const eventRows = includeThreads
      ? await prisma.$queryRaw<Ranked[]>(Prisma.sql`
          SELECT e.id, e.author, e."agentName", e.body, e."createdAt",
                 NULL AS "channelId", NULL AS "channelName",
                 e."taskId", t.title AS "taskTitle",
                 ts_rank(to_tsvector('english', e.body),
                         plainto_tsquery('english', ${q})) AS rank
          FROM task_events e
          JOIN tasks t ON t.id = e."taskId"
          WHERE t."projectId" = ${projectId}
            AND to_tsvector('english', e.body) @@ plainto_tsquery('english', ${q})
          ORDER BY rank DESC, e."createdAt" DESC
          LIMIT ${limit}
        `)
      : [];

    return [...messageRows, ...eventRows]
      .sort((a, b) => Number(b.rank) - Number(a.rank))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        kind: r.channelId ? ('message' as const) : ('task_event' as const),
        snippet: snippet(r.body),
        author: r.author,
        agentName: r.agentName ?? null,
        createdAt: r.createdAt.toISOString(),
        channelId: r.channelId,
        channelName: r.channelName,
        taskId: r.taskId,
        taskTitle: r.taskTitle,
      }));
  },

  async postMessage(
    projectId: string,
    channelId: string,
    user: AuthUser,
    input: PostMessageInput,
    agentName: string | null = null,
  ): Promise<Message> {
    await ensureChannelAccess(projectId, channelId, user);

    // A shared task/feature/checkpoint must belong to this project.
    const attachment = input.attachment;
    if (attachment) await assertAttachmentExists(projectId, attachment);

    const created = await prisma.message.create({
      data: {
        channelId,
        author: user.name,
        authorEmail: user.email,
        agentName,
        body: input.body,
        ...attachmentColumns(attachment),
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
      link: `/projects/${projectId}?tab=discussion`,
      audience: { scope: 'channel', channelId },
      excludeEmail: user.email,
    });
    const message = toMessage(created);
    realtime.emitMessageCreated(projectId, channelId, message);
    // Wake any agent parked on this channel in `wait_for_reply`.
    pulseChannel(channelId);
    return message;
  },

  /**
   * Mark the conversation resolved (someone is satisfied) or reopen it. A
   * resolve newer than an agent's last message ends its `wait_for_reply` loop.
   */
  async resolveChannel(
    projectId: string,
    channelId: string,
    user: AuthUser,
    resolved: boolean,
  ): Promise<Channel> {
    await ensureChannelAccess(projectId, channelId, user);
    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: {
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? user.name : null,
      },
      include: channelInclude,
    });
    pulseChannel(channelId);
    return toChannel(updated);
  },

  /**
   * Long-poll: block until someone (not the calling agent) posts a reply, the
   * conversation is resolved, or `timeoutMs` elapses. The agent re-arms with
   * the returned `cursor` to keep the back-and-forth going.
   */
  async waitForReply(
    projectId: string,
    channelId: string,
    user: AuthUser,
    agentName: string | null,
    query: ChannelWaitQuery,
  ): Promise<ChannelWaitResult> {
    await ensureChannelAccess(projectId, channelId, user);

    // Establish the cursor: the given message, or the newest one right now so
    // we only surface activity that happens AFTER the wait begins.
    let cursor: string | null = null;
    let cursorAt: Date;
    if (query.after) {
      const at = await prisma.message.findFirst({
        where: { id: query.after, channelId },
        select: { createdAt: true },
      });
      cursor = query.after;
      cursorAt = at?.createdAt ?? new Date(0);
    } else {
      const newest = await prisma.message.findFirst({
        where: { channelId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true },
      });
      cursor = newest?.id ?? null;
      cursorAt = newest?.createdAt ?? new Date();
    }

    const deadline = Date.now() + query.timeoutMs;
    for (;;) {
      const hit = await this.checkChannelActivity(
        channelId,
        cursorAt,
        user,
        agentName,
        query.ignoreResolved,
      );
      if (hit) return hit;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return { status: 'timeout', messages: [], resolvedBy: null, cursor };
      }
      // Woken instantly by a local pulse, else polled every ≤2.5s.
      await waitForChannelPulse(channelId, Math.min(remaining, 2500));
    }
  },

  /** One check for reply/resolve after `cursorAt`; null if nothing yet. */
  async checkChannelActivity(
    channelId: string,
    cursorAt: Date,
    user: AuthUser,
    agentName: string | null,
    ignoreResolved = false,
  ): Promise<ChannelWaitResult | null> {
    // A resolve newer than the agent's last message ends the loop — unless the
    // caller is a persistent responder that only wants new replies.
    const channel = ignoreResolved
      ? null
      : await prisma.channel.findUnique({
          where: { id: channelId },
          select: { resolvedAt: true, resolvedBy: true },
        });
    if (channel?.resolvedAt && channel.resolvedAt > cursorAt) {
      return {
        status: 'resolved',
        messages: [],
        resolvedBy: channel.resolvedBy,
        cursor: null,
      };
    }
    // Messages after the cursor, minus the agent's own posts. Filtering in JS
    // avoids SQL three-valued-logic pitfalls: a `NOT (email=x AND agentName=y)`
    // wrongly drops human replies whose agentName is NULL.
    const rows = await prisma.message.findMany({
      where: { channelId, createdAt: { gt: cursorAt } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });
    const replies = rows.filter(
      (m) =>
        !(m.authorEmail === user.email && (m.agentName ?? null) === agentName),
    );
    if (replies.length === 0) return null;
    return {
      status: 'reply',
      messages: replies.map(toMessage),
      resolvedBy: null,
      cursor: replies[replies.length - 1].id,
    };
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

  /* ----------------------- Scheduled (send-later) --------------------- */

  /** Queue a message to be posted to a channel at a future time. */
  async createScheduledMessage(
    projectId: string,
    channelId: string,
    user: AuthUser,
    input: ScheduleMessageInput,
    agentName: string | null = null,
  ): Promise<ScheduledMessage> {
    await ensureChannelAccess(projectId, channelId, user);
    const attachment = input.attachment;
    if (attachment) await assertAttachmentExists(projectId, attachment);
    const row = await prisma.scheduledMessage.create({
      data: {
        channelId,
        author: user.name,
        authorEmail: user.email,
        agentName,
        body: input.body,
        ...attachmentColumns(attachment),
        scheduledFor: new Date(input.scheduledFor),
      },
    });
    return toScheduledMessage(row);
  },

  /** List a channel's still-pending scheduled messages (soonest first). */
  async listScheduledMessages(
    projectId: string,
    channelId: string,
    user: AuthUser,
  ): Promise<ScheduledMessage[]> {
    await ensureChannelAccess(projectId, channelId, user);
    const rows = await prisma.scheduledMessage.findMany({
      where: { channelId, status: 'pending' },
      orderBy: { scheduledFor: 'asc' },
    });
    return rows.map(toScheduledMessage);
  },

  /** Cancel a pending scheduled message (author or admin only). */
  async cancelScheduledMessage(
    projectId: string,
    channelId: string,
    scheduledId: string,
    user: AuthUser,
  ): Promise<void> {
    await ensureChannelAccess(projectId, channelId, user);
    const row = await prisma.scheduledMessage.findFirst({
      where: { id: scheduledId, channelId },
      select: { authorEmail: true, status: true },
    });
    if (!row) throw HttpError.notFound('Scheduled message not found');
    const isOwn = !!row.authorEmail && row.authorEmail === user.email;
    if (user.role !== 'ADMIN' && !isOwn) {
      throw HttpError.forbidden('You can only cancel your own scheduled messages');
    }
    if (row.status !== 'pending') {
      throw HttpError.badRequest('That message has already been sent');
    }
    await prisma.scheduledMessage.update({
      where: { id: scheduledId },
      data: { status: 'canceled' },
    });
  },

  /**
   * Post any scheduled messages that are now due. Rows are claimed atomically
   * (UPDATE … RETURNING) so with multiple instances each message sends exactly
   * once. Sent through the normal post path (attachment validation, realtime,
   * notifications). Returns how many were sent.
   */
  async dispatchDueScheduledMessages(): Promise<number> {
    const claimed = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      UPDATE scheduled_messages
      SET status = 'sending'
      WHERE status = 'pending' AND "scheduledFor" <= now()
      RETURNING id
    `);
    let sent = 0;
    for (const { id } of claimed) {
      const row = await prisma.scheduledMessage.findUnique({
        where: { id },
        include: { channel: { select: { projectId: true } } },
      });
      if (!row) continue;
      try {
        // Act as an admin principal carrying the original author's identity so
        // the post succeeds and is attributed to whoever scheduled it.
        const principal: AuthUser = {
          id: 'scheduler',
          email: row.authorEmail ?? '',
          name: row.author,
          role: 'ADMIN',
        };
        const attachment = attachmentOf(row);
        const message = await this.postMessage(
          row.channel.projectId,
          row.channelId,
          principal,
          { body: row.body, attachment },
          row.agentName,
        );
        await prisma.scheduledMessage.update({
          where: { id },
          data: { status: 'sent', sentMessageId: message.id },
        });
        sent += 1;
      } catch {
        await prisma.scheduledMessage.update({
          where: { id },
          data: { status: 'failed' },
        });
      }
    }
    return sent;
  },
};
