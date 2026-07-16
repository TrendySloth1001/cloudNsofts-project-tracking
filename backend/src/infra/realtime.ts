import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import {
  WS_EVENTS,
  channelRoomSchema,
  type AuthUser,
  type ChannelJoinAck,
  type Message,
  type MessageCreatedEvent,
  type MessageDeletedEvent,
  type NotificationCreatedEvent,
} from '@cnsofts/shared';
import { env } from './env';
import { prisma } from './prisma';
import { createRedis } from './redis';
import { authService } from '../modules/auth/auth.service';
import { canAccessProject } from '../modules/auth/access';
import { isPlatformAdmin } from '../modules/auth/platform-admin';
import { COOKIE_ACCESS, readCookie } from '../modules/auth/cookies';

let io: SocketIOServer | null = null;

const roomKey = (channelId: string): string => `channel:${channelId}`;
const userRoom = (userId: string): string => `user:${userId}`;

/**
 * Attach a Socket.IO server to the HTTP server. Every socket is authenticated
 * from the JWT in its handshake, and joins one room per channel — only while a
 * client is actually viewing that conversation. Idle users hold no room and,
 * on the client, no connection at all.
 */
export function initRealtime(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN },
    // WebSocket-only: skip the HTTP long-poll handshake (no sticky sessions).
    transports: ['websocket'],
    // Survive brief drops (mobile network blips, tab sleep): buffer events for
    // up to 2 minutes and replay them on reconnect, auto-restoring the socket's
    // rooms and data. This avoids a REST catch-up round-trip and a re-join on
    // every transient disconnect. `skipMiddlewares` trusts the recovered
    // session (already authenticated) so it doesn't re-verify on recovery.
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
  });

  // With REDIS_URL set, fan events out across instances via the Redis adapter,
  // so a message emitted on one backend reaches sockets held by another. Unset
  // = single-node in-memory fanout (fine for one instance).
  if (env.REDIS_URL) {
    const pubClient = createRedis();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
  }

  // Authenticate the connect handshake. Prefer the browser session (the access
  // JWT rides in the httpOnly cookie sent on the WS upgrade); fall back to an
  // explicit `auth.token` (bearer JWT) for non-cookie clients.
  io.use((socket, next) => {
    try {
      const token =
        readCookie(socket.handshake.headers.cookie, COOKIE_ACCESS) ??
        ((socket.handshake.auth?.token ?? '') as string);
      if (!token) throw new Error('missing token');
      socket.data.user = authService.verify(token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    // Every socket auto-joins its own user room, so notifications reach the
    // connected user wherever they are in the app — no explicit subscribe.
    const me = socket.data.user as AuthUser;
    void socket.join(userRoom(me.id));

    socket.on(
      WS_EVENTS.joinChannel,
      async (payload: unknown, ack?: (res: ChannelJoinAck) => void) => {
        try {
          const user = socket.data.user as AuthUser;
          const { projectId, channelId } = channelRoomSchema.parse(payload);
          // Same authorization as REST: project access + channel membership.
          // Run both lookups in parallel — the membership query is scoped to a
          // channel *in this project*, so a hit also proves the channel exists
          // and belongs here. Common (member) path is 2 round-trips, not 4.
          const [access, membership] = await Promise.all([
            canAccessProject(user, projectId),
            prisma.channelMember.findFirst({
              where: { channelId, email: user.email, channel: { projectId } },
              select: { channelId: true },
            }),
          ]);
          if (!access) {
            ack?.({ ok: false, error: 'Channel not found' });
            return;
          }
          // The platform admin may enter any channel; it just needs to exist in
          // this project (one extra lookup only on that rare path).
          let allowed = membership !== null;
          if (!allowed && isPlatformAdmin(user)) {
            allowed =
              (await prisma.channel.count({
                where: { id: channelId, projectId },
              })) > 0;
          }
          if (!allowed) {
            ack?.({ ok: false, error: 'Channel not found' });
            return;
          }
          await socket.join(roomKey(channelId));
          ack?.({ ok: true });
        } catch {
          ack?.({ ok: false, error: 'Invalid join request' });
        }
      },
    );

    socket.on(WS_EVENTS.leaveChannel, (payload: unknown) => {
      const parsed = channelRoomSchema.safeParse(payload);
      if (parsed.success) void socket.leave(roomKey(parsed.data.channelId));
    });
  });

  return io;
}

export const realtime = {
  /**
   * Fan a new message out to everyone currently in its channel room. No-op if
   * the realtime server isn't running (keeps REST fully functional on its own).
   */
  emitMessageCreated(
    projectId: string,
    channelId: string,
    message: Message,
  ): void {
    const event: MessageCreatedEvent = { projectId, channelId, message };
    io?.to(roomKey(channelId)).emit(WS_EVENTS.messageCreated, event);
  },

  /** Tell everyone in the channel's room that a message was removed. */
  emitMessageDeleted(
    projectId: string,
    channelId: string,
    messageId: string,
  ): void {
    const event: MessageDeletedEvent = { projectId, channelId, messageId };
    io?.to(roomKey(channelId)).emit(WS_EVENTS.messageDeleted, event);
  },

  /** Push a new notification to one recipient's user room (if connected). */
  emitNotification(userId: string, event: NotificationCreatedEvent): void {
    io?.to(userRoom(userId)).emit(WS_EVENTS.notificationCreated, event);
  },
};
