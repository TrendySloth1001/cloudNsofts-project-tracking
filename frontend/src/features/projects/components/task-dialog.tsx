'use client';

import { useEffect, useState } from 'react';
import {
  createTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ProjectMember,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '@cnsofts/shared';
import { Alert, Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { projectStore } from '../projects.store';
import styles from './task-dialog.module.css';

const STATUS_OPTIONS = taskStatusSchema.options.map((s) => ({
  value: s,
  label: TASK_STATUS_LABELS[s],
}));
const PRIORITY_OPTIONS = taskPrioritySchema.options.map((p) => ({
  value: p,
  label: TASK_PRIORITY_LABELS[p],
}));

export interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  members: ProjectMember[];
  defaultStatus?: TaskStatus;
  task?: Task | null;
}

export function TaskDialog({
  open,
  onClose,
  projectId,
  members,
  defaultStatus = 'todo',
  task,
}: TaskDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setDescription(task?.description ?? '');
    setStatus(task?.status ?? defaultStatus);
    setPriority(task?.priority ?? 'medium');
    setAssigneeId(task?.assigneeId ?? '');
    setDueDate(task?.dueDate ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, defaultStatus]);

  const assigneeOptions = [
    { value: '', label: 'Unassigned' },
    ...members.map((m) => ({ value: m.id, label: m.name })),
  ];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = createTaskSchema.safeParse({
      title,
      description,
      status,
      priority,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (task) {
        await projectStore.updateTask(projectId, task.id, parsed.data);
      } else {
        await projectStore.addTask(projectId, parsed.data);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={submitting}>
            {task ? 'Save changes' : 'Add task'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit} className={styles.form}>
        {error && <Alert variant="danger">{error}</Alert>}
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Design the homepage"
          required
          autoFocus
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details"
          rows={3}
        />
        <div className={styles.row}>
          <Select
            label="Assignee"
            containerClassName={styles.grow}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            options={assigneeOptions}
          />
          <Select
            label="Status"
            containerClassName={styles.grow}
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className={styles.row}>
          <Select
            label="Priority"
            containerClassName={styles.grow}
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            options={PRIORITY_OPTIONS}
          />
          <Input
            label="Due date"
            type="date"
            containerClassName={styles.grow}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
