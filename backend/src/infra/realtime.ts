import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import {
  WS_EVENTS,
  channelRoomSchema,
  type AuthUser,
  type ChannelJoinAck,
  type Message,
  type MessageCreatedEvent,
  type MessageDeletedEvent,
} from '@cnsofts/shared';
import { env } from './env';
import { prisma } from './prisma';
import { authService } from '../modules/auth/auth.service';
import { canAccessProject } from '../modules/auth/access';

let io: SocketIOServer | null = null;

const roomKey = (channelId: string): string => `channel:${channelId}`;

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
  });

  // Reject any socket without a valid bearer token in the connect handshake.
  io.use((socket, next) => {
    try {
      const token = (socket.handshake.auth?.token ?? '') as string;
      if (!token) throw new Error('missing token');
      socket.data.user = authService.verify(token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    socket.on(
      WS_EVENTS.joinChannel,
      async (payload: unknown, ack?: (res: ChannelJoinAck) => void) => {
        try {
          const user = socket.data.user as AuthUser;
          const { projectId, channelId } = channelRoomSchema.parse(payload);
          // Same authorization as REST: project access + channel membership.
          if (!(await canAccessProject(user, projectId))) {
            ack?.({ ok: false, error: 'Channel not found' });
            return;
          }
          const channel = await prisma.channel.findFirst({
            where: { id: channelId, projectId },
            select: { id: true },
          });
          const isMember =
            user.role === 'ADMIN' ||
            (await prisma.channelMember.count({
              where: { channelId, email: user.email },
            })) > 0;
          if (!channel || !isMember) {
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
};
