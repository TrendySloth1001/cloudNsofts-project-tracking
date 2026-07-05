'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WS_EVENTS,
  type Channel,
  type Message,
  type MessageCreatedEvent,
  type MessageDeletedEvent,
} from '@cnsofts/shared';
import { acquireSocket, releaseSocket } from '@/features/realtime/socket';
import { discussionsApi } from './discussions.api';

/** Newest-N page size for the initial history load and "load earlier". */
const PAGE_SIZE = 50;

/** Append messages we don't already have, preserving order. */
function mergeAppend(prev: Message[], incoming: Message[]): Message[] {
  const seen = new Set(prev.map((m) => m.id));
  const add = incoming.filter((m) => !seen.has(m.id));
  return add.length ? [...prev, ...add] : prev;
}

/** Channels for a project, with local upsert/remove so the UI stays in sync
 *  without a full refetch after mutations. */
export function useChannels(projectId: string) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setChannels(await discussionsApi.listChannels(projectId));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upsert = useCallback((channel: Channel) => {
    setChannels((prev) =>
      prev.some((c) => c.id === channel.id)
        ? prev.map((c) => (c.id === channel.id ? channel : c))
        : [...prev, channel],
    );
  }, []);

  const removeLocal = useCallback((channelId: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
  }, []);

  return { channels, loading, reload, upsert, removeLocal };
}

/**
 * Live messages for the open channel. Loads the newest page over REST, then
 * subscribes to real-time deltas over a WebSocket that connects only while the
 * channel is open (see `features/realtime/socket`). On (re)connect it re-joins
 * the channel room and fetches anything missed while disconnected, so the
 * socket is best-effort and REST remains the source of truth.
 */
export function useChannelMessages(projectId: string, channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Mirror of `messages` for use inside socket callbacks without re-subscribing.
  const messagesRef = useRef<Message[]>([]);

  const apply = useCallback((next: (prev: Message[]) => Message[]) => {
    setMessages((prev) => {
      const updated = next(prev);
      messagesRef.current = updated;
      return updated;
    });
  }, []);

  useEffect(() => {
    if (!channelId) {
      messagesRef.current = [];
      setMessages([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    messagesRef.current = [];
    setMessages([]);
    setHasMore(false);
    setLoading(true);

    // Initial history: the newest page, oldest→newest for display.
    discussionsApi
      .listMessages(projectId, channelId, { limit: PAGE_SIZE })
      .then((data) => {
        if (cancelled) return;
        messagesRef.current = data;
        setMessages(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const socket = acquireSocket();

    // Pull anything created after our newest known message (fills reconnect gaps).
    const catchUp = () => {
      const lastId = messagesRef.current[messagesRef.current.length - 1]?.id;
      if (!lastId) return;
      discussionsApi
        .listMessages(projectId, channelId, { after: lastId })
        .then((newer) => {
          if (!cancelled && newer.length) {
            apply((prev) => mergeAppend(prev, newer));
          }
        })
        .catch(() => {});
    };

    const join = () => {
      socket.emit(WS_EVENTS.joinChannel, { projectId, channelId });
      catchUp();
    };

    const onMessage = (evt: MessageCreatedEvent) => {
      if (cancelled || evt.channelId !== channelId) return;
      apply((prev) =>
        prev.some((m) => m.id === evt.message.id)
          ? prev
          : [...prev, evt.message],
      );
    };

    const onDeleted = (evt: MessageDeletedEvent) => {
      if (cancelled || evt.channelId !== channelId) return;
      apply((prev) => prev.filter((m) => m.id !== evt.messageId));
    };

    socket.on(WS_EVENTS.messageCreated, onMessage);
    socket.on(WS_EVENTS.messageDeleted, onDeleted);
    socket.on('connect', join);
    if (socket.connected) join();

    return () => {
      cancelled = true;
      socket.emit(WS_EVENTS.leaveChannel, { projectId, channelId });
      socket.off(WS_EVENTS.messageCreated, onMessage);
      socket.off(WS_EVENTS.messageDeleted, onDeleted);
      socket.off('connect', join);
      releaseSocket();
    };
  }, [projectId, channelId, apply]);

  /** Prepend the previous page of history (scroll-up / "load earlier"). */
  const loadOlder = useCallback(async () => {
    if (!channelId || loadingOlder) return;
    const firstId = messagesRef.current[0]?.id;
    if (!firstId) return;
    setLoadingOlder(true);
    try {
      const older = await discussionsApi.listMessages(projectId, channelId, {
        before: firstId,
        limit: PAGE_SIZE,
      });
      if (older.length) {
        apply((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const add = older.filter((m) => !seen.has(m.id));
          return add.length ? [...add, ...prev] : prev;
        });
      }
      setHasMore(older.length === PAGE_SIZE);
    } finally {
      setLoadingOlder(false);
    }
  }, [projectId, channelId, loadingOlder, apply]);

  /** Optimistically show a just-sent message; the WS echo dedupes by id. */
  const append = useCallback(
    (message: Message) => {
      apply((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
    },
    [apply],
  );

  /** Optimistically drop a message (the WS `message:deleted` reconciles). */
  const remove = useCallback(
    (messageId: string) => {
      apply((prev) => prev.filter((m) => m.id !== messageId));
    },
    [apply],
  );

  return {
    messages,
    loading,
    append,
    remove,
    loadOlder,
    hasMore,
    loadingOlder,
  };
}
