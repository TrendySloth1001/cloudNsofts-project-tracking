'use client';

import { useState } from 'react';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type ProjectMember,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';
import {
  Badge,
  type BadgeVariant,
  Button,
  Divider,
  Icon,
  Menu,
  Modal,
  useConfirm,
} from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { cx } from '@/lib/cx';
import { projectStore } from '../projects.store';
import { formatDate, isOverdue } from '../task-utils';
import { TaskPriorityBadge } from './task-priority-badge';
import { TaskChecklist } from './task-checklist';
import { TaskThread } from './task-thread';
import styles from './task-detail-dialog.module.css';

/** Task status → badge color, matching the board's per-column accents. */
const TASK_STATUS_VARIANT: Record<TaskStatus, BadgeVariant> = {
  todo: 'neutral',
  in_progress: 'info',
  in_review: 'warning',
  done: 'success',
};

export interface TaskDetailDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  task: Task | null;
  members: ProjectMember[];
  onEdit: () => void;
}

export function TaskDetailDialog({
  open,
  onClose,
  projectId,
  task,
  members,
  onEdit,
}: TaskDetailDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();

  async function moveTo(next: TaskStatus) {
    if (!task || next === task.status) return;
    await projectStore.updateTask(projectId, task.id, { status: next });
  }

  if (!task) return null;

  const assignee = members.find((m) => m.id === task.assigneeId);
  const overdue = task.status !== 'done' && isOverdue(task.dueDate);

  async function handleDelete() {
    if (!task) return;
    const ok = await confirm({
      title: 'Delete task?',
      message: (
        <>
          Delete <strong>“{task.title}”</strong>? This can’t be undone.
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await projectStore.removeTask(projectId, task.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task.title}
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            leftIcon="delete"
            onClick={handleDelete}
            loading={deleting}
            style={{ marginRight: 'auto' }}
          >
            Delete
          </Button>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Close
          </Button>
          <Button leftIcon="edit" onClick={onEdit} disabled={deleting}>
            Edit
          </Button>
        </>
      }
    >
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Status</span>
          <Menu
            align="start"
            trigger={
              <button type="button" className={styles.statusTrigger}>
                <Badge variant={TASK_STATUS_VARIANT[task.status]} size="sm" dot>
                  {TASK_STATUS_LABELS[task.status]}
                </Badge>
                <Icon name="chevronDown" size={14} tone="neutral" />
              </button>
            }
            items={TASK_STATUS_ORDER.map((s) => ({
              label: TASK_STATUS_LABELS[s],
              selected: s === task.status,
              onSelect: () => void moveTo(s),
            }))}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Priority</span>
          <TaskPriorityBadge priority={task.priority} />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Assignee</span>
          {assignee ? (
            <span className={styles.assignee}>
              <UserAvatar name={assignee.name} seed={assignee.id} size={22} />
              {assignee.name}
            </span>
          ) : (
            <span className={styles.empty}>Unassigned</span>
          )}
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Due date</span>
          {task.dueDate ? (
            <span className={cx(styles.value, overdue && styles.overdue)}>
              {formatDate(task.dueDate)}
              {overdue && ' · Overdue'}
            </span>
          ) : (
            <span className={styles.empty}>No due date</span>
          )}
        </div>
      </div>

      <Divider className={styles.divider} />

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Description</span>
        {task.description.trim() ? (
          <p className={styles.description}>{task.description}</p>
        ) : (
          <span className={styles.empty}>No description</span>
        )}
      </div>

      <Divider className={styles.divider} />

      <TaskChecklist
        projectId={projectId}
        taskId={task.id}
        subtasks={task.subtasks}
      />

      <Divider className={styles.divider} />

      <TaskThread projectId={projectId} taskId={task.id} events={task.events} />
    </Modal>
  );
}
