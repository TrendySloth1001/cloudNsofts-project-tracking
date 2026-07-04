'use client';

import { useState } from 'react';
import { createTaskSchema, type TaskStatus } from '@cnsofts/shared';
import { Icon } from '@/components/ui';
import { projectStore } from '../projects.store';
import styles from './tasks.module.css';

export interface QuickAddCardProps {
  projectId: string;
  status: TaskStatus;
}

/** Trello-style inline task capture: reveals a title field, adds on Enter, and
 *  stays open for rapid entry. Full fields (assignee, priority, …) are set by
 *  opening the task afterwards or via the toolbar's "New task". */
export function QuickAddCard({ projectId, status }: QuickAddCardProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  function close() {
    setOpen(false);
    setTitle('');
  }

  async function submit() {
    const parsed = createTaskSchema.safeParse({ title, status });
    if (!parsed.success) return; // empty/invalid title — ignore
    setSaving(true);
    try {
      await projectStore.addTask(projectId, parsed.data);
      setTitle(''); // keep the field open + focused for the next one
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={styles.addCard}
        onClick={() => setOpen(true)}
      >
        <Icon name="add" size={15} />
        Add task
      </button>
    );
  }

  return (
    <div className={styles.quickAdd}>
      <textarea
        className={styles.quickAddInput}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        rows={2}
        autoFocus
        disabled={saving}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            close();
          }
        }}
        onBlur={() => {
          if (!title.trim()) close();
        }}
      />
      <div className={styles.quickAddHint}>
        <kbd>Enter</kbd> to add · <kbd>Esc</kbd> to close
      </div>
    </div>
  );
}
