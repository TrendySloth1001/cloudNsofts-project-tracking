'use client';

import { useEffect, useState } from 'react';
import {
  NOTIFICATION_KIND_DESCRIPTIONS,
  NOTIFICATION_KIND_LABELS,
  type NotificationKind,
  type NotificationPreference,
} from '@cnsofts/shared';
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
  Switch,
} from '@/components/ui';
import { notificationsApi } from '../notifications.api';
import styles from './notification-preferences.module.css';

/** Settings card: per-type notification delivery toggles (DB-backed). */
export function NotificationPreferencesCard() {
  const [items, setItems] = useState<NotificationPreference[] | null>(null);
  const [busy, setBusy] = useState<NotificationKind | null>(null);

  useEffect(() => {
    let alive = true;
    notificationsApi
      .getPreferences()
      .then((r) => alive && setItems(r.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  async function toggle(kind: NotificationKind, enabled: boolean) {
    // Optimistic — reflect immediately, reconcile from the server response.
    setItems(
      (prev) =>
        prev?.map((p) => (p.kind === kind ? { ...p, enabled } : p)) ?? prev,
    );
    setBusy(kind);
    try {
      const r = await notificationsApi.updatePreference({ kind, enabled });
      setItems(r.items);
    } catch {
      const r = await notificationsApi.getPreferences().catch(() => null);
      if (r) setItems(r.items);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose what you get notified about.</CardDescription>
      </CardHeader>
      <CardBody>
        {items === null ? (
          <div className={styles.loading}>
            <Spinner size={22} />
          </div>
        ) : (
          items.map((pref) => (
            <div key={pref.kind} className={styles.row}>
              <div className={styles.text}>
                <span className={styles.label}>
                  {NOTIFICATION_KIND_LABELS[pref.kind]}
                </span>
                <span className={styles.desc}>
                  {NOTIFICATION_KIND_DESCRIPTIONS[pref.kind]}
                </span>
              </div>
              <Switch
                checked={pref.enabled}
                disabled={busy === pref.kind}
                onChange={(e) => void toggle(pref.kind, e.target.checked)}
                aria-label={NOTIFICATION_KIND_LABELS[pref.kind]}
              />
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
