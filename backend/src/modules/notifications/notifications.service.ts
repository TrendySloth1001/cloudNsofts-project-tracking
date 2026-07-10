import {
  NOTIFICATION_PREF_KINDS,
  type Notification,
  type NotificationKind,
  type NotificationList,
  type NotificationPreferences,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { env } from '../../infra/env';
import { realtime } from '../../infra/realtime';

/** How many notifications the feed returns (newest first). */
const FEED_LIMIT = 30;

/** Who should receive a notification. Resolved to recipient user ids, minus the
 *  actor. `project` = everyone on the project; `channel` = a channel's members;
 *  `users` = explicit ids. */
type Audience =
  | { scope: 'project'; projectId: string }
  | { scope: 'channel'; channelId: string }
  | { scope: 'users'; userIds: string[] };

interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body?: string;
  projectId?: string | null;
  /** Relative app path to open on click; defaults to the project page. */
  link?: string | null;
  audience: Audience;
  /** The actor's email — they are not notified of their own action. */
  excludeEmail?: string | null;
}

type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  projectId: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date;
  userId: string;
};

function toDto(n: NotificationRow): Notification {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    projectId: n.projectId,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

/** Map member/client emails to recipient AuthUser ids. Emails with a `users`
 *  row resolve to that id; the env admin (which may have no row) resolves to
 *  the `admin` principal. */
async function emailsToUserIds(emails: string[]): Promise<string[]> {
  const lower = [...new Set(emails.map((e) => e.toLowerCase()))];
  if (lower.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { email: { in: lower } },
    select: { id: true },
  });
  const ids = new Set(users.map((u) => u.id));
  if (lower.includes(env.ADMIN_EMAIL.toLowerCase())) ids.add('admin');
  return [...ids];
}

/** Resolve an audience to recipient user ids, excluding the actor. */
async function resolveRecipients(
  audience: Audience,
  excludeEmail?: string | null,
): Promise<string[]> {
  if (audience.scope === 'users') return audience.userIds;

  let emails: string[];
  if (audience.scope === 'project') {
    const [members, clients] = await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId: audience.projectId },
        select: { email: true },
      }),
      prisma.projectClient.findMany({
        where: { projectId: audience.projectId },
        select: { email: true },
      }),
    ]);
    emails = [...members, ...clients].map((r) => r.email);
  } else {
    const rows = await prisma.channelMember.findMany({
      where: { channelId: audience.channelId },
      select: { email: true },
    });
    emails = rows.map((r) => r.email);
  }

  if (excludeEmail) {
    const drop = excludeEmail.toLowerCase();
    emails = emails.filter((e) => e.toLowerCase() !== drop);
  }
  return emailsToUserIds(emails);
}

/** Drop recipients who have muted this kind (absence of a row = enabled). */
async function filterByPreference(
  userIds: string[],
  kind: NotificationKind,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const muted = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, kind, enabled: false },
    select: { userId: true },
  });
  const mutedSet = new Set(muted.map((m) => m.userId));
  return userIds.filter((id) => !mutedSet.has(id));
}

export const notificationsService = {
  /**
   * Fan a notification out to everyone the audience resolves to (minus the
   * actor and anyone who muted the kind), persist one row per recipient, and
   * push it live to each connected recipient. Best-effort: a failure here must
   * never break the user action that triggered it.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      const resolved = await resolveRecipients(
        input.audience,
        input.excludeEmail,
      );
      const recipients = await filterByPreference(resolved, input.kind);
      if (recipients.length === 0) return;

      const link =
        input.link ??
        (input.projectId ? `/projects/${input.projectId}` : null);

      const rows = await Promise.all(
        recipients.map((userId) =>
          prisma.notification.create({
            data: {
              userId,
              kind: input.kind,
              title: input.title,
              body: input.body ?? '',
              projectId: input.projectId ?? null,
              link,
            },
          }),
        ),
      );

      // Push each new row to its recipient with their updated unread tally, so
      // bells update live without a refetch.
      const counts = await prisma.notification.groupBy({
        by: ['userId'],
        where: { userId: { in: recipients }, read: false },
        _count: { _all: true },
      });
      const unreadByUser = new Map(
        counts.map((c) => [c.userId, c._count._all]),
      );
      for (const row of rows) {
        realtime.emitNotification(row.userId, {
          notification: toDto(row),
          unread: unreadByUser.get(row.userId) ?? 0,
        });
      }
    } catch (err) {
      console.error('[notifications] failed to create notification', err);
    }
  },

  /** The recipient's feed (newest first) plus their unread tally. */
  async list(userId: string): Promise<NotificationList> {
    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: FEED_LIMIT,
      }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { items: rows.map(toDto), unread };
  },

  async markRead(userId: string, id: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  },

  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  },

  /** A recipient's per-kind delivery preferences (absence = enabled). */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const rows = await prisma.notificationPreference.findMany({
      where: { userId },
    });
    const byKind = new Map(rows.map((r) => [r.kind, r.enabled]));
    return {
      items: NOTIFICATION_PREF_KINDS.map((kind) => ({
        kind,
        enabled: byKind.get(kind) ?? true,
      })),
    };
  },

  /** Enable or mute a kind for a recipient. */
  async setPreference(
    userId: string,
    kind: NotificationKind,
    enabled: boolean,
  ): Promise<NotificationPreferences> {
    await prisma.notificationPreference.upsert({
      where: { userId_kind: { userId, kind } },
      create: { userId, kind, enabled },
      update: { enabled },
    });
    return this.getPreferences(userId);
  },
};
