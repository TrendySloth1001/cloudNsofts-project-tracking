'use client';

import { useEffect, useState } from 'react';
import type { MessageAttachment, ScheduledMessage } from '@cnsofts/shared';
import { Button, Icon, IconButton, Input, Modal, Spinner } from '@/components/ui';
import { ApiRequestError } from '@/lib/api-client';
import { discussionsApi } from '../discussions.api';
import styles from './scheduled-messages-dialog.module.css';

/** A datetime-local string (YYYY-MM-DDTHH:mm) for the given Date, in local time. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

const whenFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export interface ScheduledMessagesDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  channelId: string;
  /** The current composer draft, if the user wants to schedule it. */
  draft: { body: string; attachment: MessageAttachment | null } | null;
  /** Called after a draft is successfully scheduled (clears the composer). */
  onScheduled: () => void;
}

export function ScheduledMessagesDialog({
  open,
  onClose,
  projectId,
  channelId,
  draft,
  onScheduled,
}: ScheduledMessagesDialogProps) {
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [when, setWhen] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    // Default the picker to one hour out.
    setWhen(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
    let alive = true;
    discussionsApi
      .listScheduled(projectId, channelId)
      .then((res) => {
        if (alive) setItems(res);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, projectId, channelId]);

  const canSchedule =
    !!draft && (draft.body.trim().length > 0 || draft.attachment != null);

  async function schedule() {
    if (!draft || !when || saving) return;
    const iso = new Date(when).toISOString();
    if (new Date(iso).getTime() <= Date.now()) {
      setError('Pick a time in the future.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await discussionsApi.scheduleMessage(projectId, channelId, {
        body: draft.body.trim(),
        attachment: draft.attachment,
        scheduledFor: iso,
      });
      setItems((prev) =>
        [...prev, created].sort((a, b) =>
          a.scheduledFor.localeCompare(b.scheduledFor),
        ),
      );
      onScheduled();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Could not schedule the message.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancel(id: string) {
    await discussionsApi.cancelScheduled(projectId, channelId, id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <Modal open={open} onClose={onClose} title="Scheduled messages" size="md">
      {canSchedule && (
        <div className={styles.scheduleRow}>
          <p className={styles.draftPreview}>
            {draft?.body.trim() || 'Attachment'}
          </p>
          <div className={styles.pickRow}>
            <Input
              type="datetime-local"
              value={when}
              min={toLocalInput(new Date())}
              onChange={(e) => setWhen(e.target.value)}
            />
            <Button
              leftIcon="clock"
              onClick={() => void schedule()}
              loading={saving}
              disabled={!when}
            >
              Schedule
            </Button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      <div className={styles.listHead}>Pending</div>
      {loading ? (
        <div className={styles.center}>
          <Spinner size={20} />
        </div>
      ) : items.length === 0 ? (
        <p className={styles.empty}>Nothing scheduled for this channel.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((s) => (
            <li key={s.id} className={styles.item}>
              <span className={styles.itemIcon}>
                <Icon name="clock" size={15} tone="brand" />
              </span>
              <div className={styles.itemMain}>
                <span className={styles.itemWhen}>
                  {whenFmt.format(new Date(s.scheduledFor))}
                  {s.agentName && (
                    <span className={styles.viaAgent}>
                      <Icon name="ai" size={10} /> {s.agentName}
                    </span>
                  )}
                </span>
                <span className={styles.itemBody}>{s.body || 'Attachment'}</span>
              </div>
              <IconButton
                icon="close"
                label="Cancel scheduled message"
                variant="ghost"
                size="sm"
                onClick={() => void cancel(s.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
