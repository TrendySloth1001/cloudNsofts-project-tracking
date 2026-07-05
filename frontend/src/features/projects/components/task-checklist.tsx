'use client';

import { useState } from 'react';
import type { Subtask } from '@cnsofts/shared';
import { Checkbox, Icon, IconButton } from '@/components/ui';
import { cx } from '@/lib/cx';
import { projectStore } from '../projects.store';
import styles from './task-detail-dialog.module.css';

export interface TaskChecklistProps {
  projectId: string;
  taskId: string;
  subtasks: Subtask[];
  /** When false (e.g. a client), the checklist is read-only. */
  canEdit: boolean;
}

export function TaskChecklist({
  projectId,
  taskId,
  subtasks,
  canEdit,
}: TaskChecklistProps) {
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const done = subtasks.filter((s) => s.done).length;
  const pct = subtasks.length ? (done / subtasks.length) * 100 : 0;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    setAdding(true);
    try {
      await projectStore.addSubtask(projectId, taskId, { title: value });
      setTitle('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeadRow}>
        <span className={styles.sectionLabel}>Checklist</span>
        {subtasks.length > 0 && (
          <span className={styles.checklistCount}>
            {done}/{subtasks.length}
          </span>
        )}
      </div>

      {subtasks.length > 0 && (
        <div className={styles.progressTrack}>
          <span className={styles.progressBar} style={{ width: `${pct}%` }} />
        </div>
      )}

      <ul className={styles.checklist}>
        {subtasks.map((s) => (
          <li key={s.id} className={styles.checkItem}>
            <Checkbox
              checked={s.done}
              disabled={!canEdit}
              onChange={() =>
                void projectStore.updateSubtask(projectId, taskId, s.id, {
                  done: !s.done,
                })
              }
              label={
                <span className={cx(styles.checkTitle, s.done && styles.checkDone)}>
                  {s.title}
                </span>
              }
            />
            {canEdit && (
              <IconButton
                icon="close"
                label={`Remove ${s.title}`}
                variant="ghost"
                size="sm"
                onClick={() =>
                  void projectStore.removeSubtask(projectId, taskId, s.id)
                }
              />
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <form onSubmit={add} className={styles.checkAdd}>
          <Icon name="add" size={15} tone="brand" />
          <input
            className={styles.checkAddInput}
            placeholder="Add a checklist item"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={adding}
          />
        </form>
      )}
    </div>
  );
}
