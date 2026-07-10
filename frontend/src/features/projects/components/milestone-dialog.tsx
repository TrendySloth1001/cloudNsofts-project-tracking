'use client';

import { useEffect, useState } from 'react';
import {
  createMilestoneSchema,
  milestoneStatusSchema,
  MILESTONE_STATUS_LABELS,
  type Milestone,
  type MilestoneStatus,
} from '@cnsofts/shared';
import { Alert, Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { projectStore } from '../projects.store';
import styles from './task-dialog.module.css';

const STATUS_OPTIONS = milestoneStatusSchema.options.map((s) => ({
  value: s,
  label: MILESTONE_STATUS_LABELS[s],
}));

export interface MilestoneDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** When set, the dialog edits this checkpoint; otherwise it creates one. */
  milestone?: Milestone | null;
}

export function MilestoneDialog({
  open,
  onClose,
  projectId,
  milestone,
}: MilestoneDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('upcoming');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(milestone?.title ?? '');
    setDescription(milestone?.description ?? '');
    setStatus(milestone?.status ?? 'upcoming');
    setDueDate(milestone?.dueDate ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, milestone?.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createMilestoneSchema.safeParse({
      title,
      description,
      status,
      dueDate: dueDate || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (milestone) {
        await projectStore.updateMilestone(projectId, milestone.id, parsed.data);
      } else {
        await projectStore.addMilestone(projectId, parsed.data);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save checkpoint');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={milestone ? 'Edit checkpoint' : 'New checkpoint'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="milestone-form" loading={submitting}>
            {milestone ? 'Save changes' : 'Add checkpoint'}
          </Button>
        </>
      }
    >
      <form id="milestone-form" onSubmit={handleSubmit} className={styles.form}>
        {error && <Alert variant="danger">{error}</Alert>}
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Design sign-off"
          required
          autoFocus
        />
        <Textarea
          label="What's delivered"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short summary the client will see. Markdown supported."
          rows={3}
        />
        <div className={styles.row}>
          <Input
            label="Due date"
            type="date"
            containerClassName={styles.grow}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Select
            label="Status"
            containerClassName={styles.grow}
            value={status}
            onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
            options={STATUS_OPTIONS}
          />
        </div>
      </form>
    </Modal>
  );
}
