'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  WS_EVENTS,
  type Notification,
  type NotificationCreatedEvent,
} from '@cnsofts/shared';
import { acquireSocket, releaseSocket } from '@/features/realtime/socket';
import { notificationsApi } from './notifications.api';

/** Fallback reconciliation poll; realtime delivers new items immediately. */
const POLL_MS = 60_000;

/** Cap the in-memory feed so a live burst can't grow it without bound. */
const MAX_ITEMS = 50;

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

    // Live delivery: the server pushes new notifications to our user room.
    // Acquiring the shared socket here keeps it connected app-wide (the bell
    // is always mounted), so notifications arrive without a refresh.
    const socket = acquireSocket();
    const onCreated = (event: NotificationCreatedEvent) => {
      if (!alive.current) return;
      const already = itemsRef.current.some(
        (n) => n.id === event.notification.id,
      );
      const next = already
        ? itemsRef.current
        : [event.notification, ...itemsRef.current].slice(0, MAX_ITEMS);
      itemsRef.current = next;
      setItems(next);
      setUnread(event.unread);
    };
    socket.on(WS_EVENTS.notificationCreated, onCreated);

    return () => {
      alive.current = false;
      clearInterval(id);
      socket.off(WS_EVENTS.notificationCreated, onCreated);
      releaseSocket();
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
