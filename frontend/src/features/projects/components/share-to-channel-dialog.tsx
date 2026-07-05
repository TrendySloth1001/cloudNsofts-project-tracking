'use client';

import { useEffect, useState } from 'react';
import {
  CHANNEL_VISIBILITY_LABELS,
  type Channel,
  type MessageAttachment,
} from '@cnsofts/shared';
import { Badge, Icon, Modal, Spinner } from '@/components/ui';
import { discussionsApi } from '../discussions.api';
import styles from './attach-picker-dialog.module.css';

export interface ShareToChannelDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** What is being shared; the dialog is inert when null. */
  attachment: MessageAttachment | null;
  /** Display name of the shared item (for the dialog title). */
  itemName: string;
}

/** Pick a channel to share a task/feature into — posts a message carrying the
 *  attachment so the conversation continues in that channel. */
export function ShareToChannelDialog({
  open,
  onClose,
  projectId,
  attachment,
  itemName,
}: ShareToChannelDialogProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    discussionsApi
      .listChannels(projectId)
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  async function share(channel: Channel) {
    if (!attachment || busy) return;
    setBusy(channel.id);
    try {
      await discussionsApi.postMessage(projectId, channel.id, {
        body: '',
        attachment,
      });
      onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Share “${itemName}” to…`}
      size="sm"
    >
      {loading ? (
        <div className={styles.loading}>
          <Spinner size={22} />
        </div>
      ) : channels.length === 0 ? (
        <span className={styles.empty}>No channels available.</span>
      ) : (
        <ul className={styles.list}>
          {channels.map((channel) => (
            <li key={channel.id}>
              <button
                type="button"
                className={styles.row}
                disabled={busy !== null}
                onClick={() => void share(channel)}
              >
                <Icon
                  name={busy === channel.id ? 'loading' : 'chat'}
                  size={16}
                  tone="info"
                />
                <span className={styles.rowName}>#{channel.name}</span>
                <Badge
                  variant={channel.visibility === 'internal' ? 'primary' : 'info'}
                  size="sm"
                >
                  {CHANNEL_VISIBILITY_LABELS[channel.visibility]}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
