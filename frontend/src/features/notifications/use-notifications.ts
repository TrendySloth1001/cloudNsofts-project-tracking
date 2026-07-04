'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Notification } from '@cnsofts/shared';
import { notificationsApi } from './notifications.api';

/** How often the feed is refreshed while the app is open. */
const POLL_MS = 20_000;

export interface UseNotifications {
  items: Notification[];
  unread: number;
  loading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/**
 * Polls the notification feed and exposes optimistic read actions. The unread
 * count comes from the server (it can exceed the shown items), so read actions
 * adjust it locally and the next poll reconciles.
 */
export function useNotifications(): UseNotifications {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const itemsRef = useRef<Notification[]>([]);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      if (!alive.current) return;
      itemsRef.current = data.items;
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // Keep the last good state on a transient failure.
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load]);

  const markRead = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((n) => n.id === id);
      if (!target || target.read) return;
      const next = itemsRef.current.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      itemsRef.current = next;
      setItems(next);
      setUnread((u) => Math.max(0, u - 1));
      notificationsApi.markRead(id).catch(() => void load());
    },
    [load],
  );

  const markAllRead = useCallback(() => {
    const next = itemsRef.current.map((n) => ({ ...n, read: true }));
    itemsRef.current = next;
    setItems(next);
    setUnread(0);
    notificationsApi.markAllRead().catch(() => void load());
  }, [load]);

  return { items, unread, loading, markRead, markAllRead };
}
