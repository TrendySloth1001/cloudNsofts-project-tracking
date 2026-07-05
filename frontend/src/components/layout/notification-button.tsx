'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NotificationKind } from '@cnsofts/shared';
import {
  Icon,
  IconButton,
  Spinner,
  type IconName,
  type IconTone,
} from '@/components/ui';
import { useNotifications } from '@/features/notifications/use-notifications';
import { relativeTime } from '@/features/notifications/relative-time';
import { cx } from '@/lib/cx';
import styles from './notification-button.module.css';

/** Each notification kind maps to a semantic icon + muted tone. */
const KIND_VISUAL: Record<NotificationKind, { icon: IconName; tone: IconTone }> =
  {
    task_created: { icon: 'tasks', tone: 'brand' },
    task_completed: { icon: 'checkCircle', tone: 'success' },
    comment_added: { icon: 'chat', tone: 'info' },
    message_posted: { icon: 'chat', tone: 'info' },
    member_added: { icon: 'user', tone: 'brand' },
    system: { icon: 'info', tone: 'neutral' },
  };

export function NotificationButton() {
  const router = useRouter();
  const { items, unread, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

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

  function openNotification(id: string, projectId: string | null) {
    markRead(id);
    setOpen(false);
    if (projectId) router.push(`/projects/${projectId}`);
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
        {unread > 0 && (
          <span
            className={styles.badge}
            aria-label={`${unread} unread notifications`}
          />
        )}
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

          {loading && items.length === 0 ? (
            <div className={styles.loading}>
              <Spinner size={22} />
            </div>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <Icon name="checkCircle" size={24} tone="success" />
              </span>
              <p className={styles.emptyTitle}>You&apos;re all caught up</p>
              <p className={styles.emptyText}>
                New activity across your projects will show up here.
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {items.map((n) => {
                const visual = KIND_VISUAL[n.kind];
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={cx(styles.item, !n.read && styles.itemUnread)}
                    onClick={() => openNotification(n.id, n.projectId)}
                  >
                    <span className={styles.itemIcon}>
                      <Icon name={visual.icon} size={17} tone={visual.tone} />
                    </span>
                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      {n.body && (
                        <span className={styles.itemText}>{n.body}</span>
                      )}
                      <span className={styles.itemTime}>
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && <span className={styles.unreadDot} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
