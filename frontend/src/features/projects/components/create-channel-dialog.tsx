'use client';

import { useEffect, useState } from 'react';
import {
  channelSlug,
  createChannelSchema,
  type Channel,
  type ChannelVisibility,
} from '@cnsofts/shared';
import { Alert, Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { discussionsApi } from '../discussions.api';
import styles from './create-channel-dialog.module.css';

const VISIBILITY_OPTIONS = [
  { value: 'internal', label: 'Internal — team only' },
  { value: 'client', label: 'Client — shared with clients' },
];

export interface CreateChannelDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (channel: Channel) => void;
}

export function CreateChannelDialog({
  projectId,
  open,
  onClose,
  onCreated,
}: CreateChannelDialogProps) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<ChannelVisibility>('internal');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setVisibility('internal');
    setDescription('');
    setError(null);
  }, [open]);

  const slug = channelSlug(name);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createChannelSchema.safeParse({
      name,
      visibility,
      description,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const channel = await discussionsApi.createChannel(projectId, parsed.data);
      onCreated(channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New channel"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="channel-form" loading={submitting}>
            Create channel
          </Button>
        </>
      }
    >
      <form id="channel-form" onSubmit={handleSubmit} className={styles.form}>
        {error && <Alert variant="danger">{error}</Alert>}
        <div>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="design-review"
            required
            autoFocus
          />
          {slug && <p className={styles.slug}>Creates #{slug}</p>}
        </div>
        <Select
          label="Visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as ChannelVisibility)}
          options={VISIBILITY_OPTIONS}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this channel about? (optional)"
          rows={2}
        />
      </form>
    </Modal>
  );
}
