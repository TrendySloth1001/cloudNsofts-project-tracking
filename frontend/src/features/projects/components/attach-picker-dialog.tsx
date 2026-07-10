'use client';

import { useEffect, useState } from 'react';
import {
  FEATURE_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type MessageAttachment,
  type Project,
} from '@cnsofts/shared';
import { Icon, Input, Modal } from '@/components/ui';
import styles from './attach-picker-dialog.module.css';

export interface AttachPickerDialogProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  /** Called with the chosen reference + a display label for the composer chip. */
  onPick: (attachment: MessageAttachment, label: string) => void;
}

/** Pick a feature or task from the project to attach to a channel message. */
export function AttachPickerDialog({
  open,
  onClose,
  project,
  onPick,
}: AttachPickerDialogProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const q = query.trim().toLowerCase();
  const features = project.features.filter(
    (f) => q === '' || f.name.toLowerCase().includes(q),
  );
  const tasks = project.tasks.filter(
    (t) => q === '' || t.title.toLowerCase().includes(q),
  );
  const milestones = project.milestones.filter(
    (m) => q === '' || m.title.toLowerCase().includes(q),
  );

  return (
    <Modal open={open} onClose={onClose} title="Attach to message" size="md">
      <div className={styles.body}>
        <Input
          leftIcon="search"
          placeholder="Search checkpoints, features and tasks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        <div className={styles.section}>
          <span className={styles.label}>
            Checkpoints ({milestones.length})
          </span>
          {milestones.length === 0 ? (
            <span className={styles.empty}>No matching checkpoints.</span>
          ) : (
            <ul className={styles.list}>
              {milestones.map((milestone) => (
                <li key={milestone.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() =>
                      onPick(
                        { kind: 'milestone', id: milestone.id },
                        milestone.title,
                      )
                    }
                  >
                    <Icon name="flag" size={16} tone="warning" />
                    <span className={styles.rowName}>{milestone.title}</span>
                    <span className={styles.rowMeta}>
                      {MILESTONE_STATUS_LABELS[milestone.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.section}>
          <span className={styles.label}>Features ({features.length})</span>
          {features.length === 0 ? (
            <span className={styles.empty}>No matching features.</span>
          ) : (
            <ul className={styles.list}>
              {features.map((feature) => (
                <li key={feature.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() =>
                      onPick({ kind: 'feature', id: feature.id }, feature.name)
                    }
                  >
                    <Icon name="layers" size={16} tone="brand" />
                    <span className={styles.rowName}>{feature.name}</span>
                    <span className={styles.rowMeta}>
                      {FEATURE_STATUS_LABELS[feature.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.section}>
          <span className={styles.label}>Tasks ({tasks.length})</span>
          {tasks.length === 0 ? (
            <span className={styles.empty}>No matching tasks.</span>
          ) : (
            <ul className={styles.list}>
              {tasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={() =>
                      onPick({ kind: 'task', id: task.id }, task.title)
                    }
                  >
                    <Icon name="tasks" size={16} tone="info" />
                    <span className={styles.rowName}>{task.title}</span>
                    <span className={styles.rowMeta}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
