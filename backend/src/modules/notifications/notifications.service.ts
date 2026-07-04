import type {
  Notification,
  NotificationKind,
  NotificationList,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';

/**
 * The app currently has a single principal (the bootstrap admin, id `admin`),
 * so every generated notification is addressed to it. When real DB-backed users
 * arrive, the recipient becomes the affected user's id instead.
 */
const DEFAULT_RECIPIENT = 'admin';

/** How many notifications the feed returns (newest first). */
const FEED_LIMIT = 30;

interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body?: string;
  projectId?: string | null;
  /** Recipient id; defaults to the sole admin principal. */
  userId?: string;
}

function toDto(n: {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  projectId: string | null;
  read: boolean;
  createdAt: Date;
}): Notification {
  return {
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    projectId: n.projectId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

export const notificationsService = {
  /**
   * Record a notification. Best-effort by design: a failure here must never
   * break the user action that triggered it, so errors are swallowed.
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: input.userId ?? DEFAULT_RECIPIENT,
          kind: input.kind,
          title: input.title,
          body: input.body ?? '',
          projectId: input.projectId ?? null,
        },
      });
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
};
