'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon, IconButton, type IconName } from '@/components/ui';
import { cx } from '@/lib/cx';
import styles from './notification-button.module.css';

interface NotificationItem {
  id: string;
  icon: IconName;
  title: string;
  text: string;
  time: string;
  read: boolean;
}

// Placeholder data — swap for a notifications API later.
const INITIAL: NotificationItem[] = [
  {
    id: '1',
    icon: 'user',
    title: 'New member joined',
    text: 'Jane Cooper accepted your invite.',
    time: '2m ago',
    read: false,
  },
  {
    id: '2',
    icon: 'checkCircle',
    title: 'Task completed',
    text: '“Design homepage” was marked done.',
    time: '1h ago',
    read: false,
  },
  {
    id: '3',
    icon: 'calendar',
    title: 'Upcoming deadline',
    text: '“Mobile App v2” is due Friday.',
    time: 'Yesterday',
    read: true,
  },
];

export function NotificationButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(INITIAL);
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }
  function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <span className={styles.trigger}>
        <IconButton
          icon="bell"
          label="Notifications"
          variant={open ? 'subtle' : 'ghost'}
          onClick={() => setOpen((v) => !v)}
        />
        {unread > 0 && <span className={styles.badge}>{unread}</span>}
      </span>

      {open && (
        <div className={styles.panel} role="dialog" aria-label="Notifications">
          <div className={styles.header}>
            <span className={styles.headerTitle}>Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                className={styles.markRead}
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <Icon name="checkCircle" size={24} />
              </span>
              <p className={styles.emptyTitle}>You&apos;re all caught up</p>
              <p className={styles.emptyText}>
                New notifications will show up here.
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={cx(styles.item, !n.read && styles.itemUnread)}
                  onClick={() => markRead(n.id)}
                >
                  <span className={styles.itemIcon}>
                    <Icon name={n.icon} size={17} />
                  </span>
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitle}>{n.title}</span>
                    <span className={styles.itemText}>{n.text}</span>
                    <span className={styles.itemTime}>{n.time}</span>
                  </span>
                  {!n.read && <span className={styles.unreadDot} />}
                </button>
              ))}
            </div>
          )}

          <div className={styles.footer}>
            <button type="button" className={styles.viewAll}>
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
