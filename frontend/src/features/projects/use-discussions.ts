'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Channel, Message } from '@cnsofts/shared';
import { discussionsApi } from './discussions.api';

const POLL_MS = 4000;

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

/** Messages for the open channel. Polls every few seconds and supports an
 *  optimistic append so a just-sent message shows immediately. */
export function useChannelMessages(projectId: string, channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (showLoading: boolean) => {
      if (!channelId) return;
      if (showLoading) setLoading(true);
      try {
        const data = await discussionsApi.listMessages(projectId, channelId);
        setMessages((prev) => {
          const last = data[data.length - 1]?.id;
          const prevLast = prev[prev.length - 1]?.id;
          if (prev.length === data.length && last === prevLast) return prev;
          return data;
        });
      } catch {
        // transient error — keep what we have and let the next poll retry
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [projectId, channelId],
  );

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    setMessages([]);
    void load(true);
    const timer = setInterval(() => void load(false), POLL_MS);
    return () => clearInterval(timer);
  }, [channelId, load]);

  const append = useCallback((message: Message) => {
    setMessages((prev) =>
      prev.some((m) => m.id === message.id) ? prev : [...prev, message],
    );
  }, []);

  return { messages, loading, append };
}
