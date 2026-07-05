'use client';

import { useEffect, useState } from 'react';
import {
  createFeatureSchema,
  featureStatusSchema,
  FEATURE_STATUS_LABELS,
  type Feature,
  type FeatureStatus,
  type ProjectMember,
} from '@cnsofts/shared';
import {
  Alert,
  Button,
  Input,
  Modal,
  MultiSelect,
  Select,
  Textarea,
} from '@/components/ui';
import { projectStore } from '../projects.store';
import styles from './task-dialog.module.css';

const STATUS_OPTIONS = featureStatusSchema.options.map((s) => ({
  value: s,
  label: FEATURE_STATUS_LABELS[s],
}));

export interface FeatureDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  members: ProjectMember[];
  /** When set, the dialog edits this feature; otherwise it creates one. */
  feature?: Feature | null;
}

export function FeatureDialog({
  open,
  onClose,
  projectId,
  members,
  feature,
}: FeatureDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<FeatureStatus>('planned');
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(feature?.name ?? '');
    setDescription(feature?.description ?? '');
    setStatus(feature?.status ?? 'planned');
    setOwnerIds(feature?.ownerIds ?? []);
    setTargetDate(feature?.targetDate ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feature?.id]);

  const ownerOptions = members.map((m) => ({ value: m.id, label: m.name }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createFeatureSchema.safeParse({
      name,
      description,
      status,
      ownerIds,
      targetDate: targetDate || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (feature) {
        await projectStore.updateFeature(projectId, feature.id, parsed.data);
      } else {
        await projectStore.addFeature(projectId, parsed.data);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save feature');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={feature ? 'Edit feature' : 'New feature'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="feature-form" loading={submitting}>
            {feature ? 'Save changes' : 'Add feature'}
          </Button>
        </>
      }
    >
      <form id="feature-form" onSubmit={handleSubmit} className={styles.form}>
        {error && <Alert variant="danger">{error}</Alert>}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Homepage revamp"
          required
          autoFocus
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this feature covers"
          rows={3}
        />
        <div className={styles.row}>
          <MultiSelect
            label="Owners"
            containerClassName={styles.grow}
            values={ownerIds}
            onValuesChange={setOwnerIds}
            options={ownerOptions}
            placeholder="No owner"
          />
          <Select
            label="Status"
            containerClassName={styles.grow}
            value={status}
            onChange={(e) => setStatus(e.target.value as FeatureStatus)}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className={styles.row}>
          <Input
            label="Target date"
            type="date"
            containerClassName={styles.grow}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
