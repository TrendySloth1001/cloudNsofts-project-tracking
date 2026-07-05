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
  MultiSelect,
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

/** Task status → badge color, matching the board's per-column accents.
 *  Exported so attachment cards render the same mapping. */
export const TASK_STATUS_VARIANT: Record<TaskStatus, BadgeVariant> = {
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
  /** When set, shows a Share action that posts the task into a channel. */
  onShare?: () => void;
  /** When false (e.g. a client), the dialog is view-only. */
  canEdit: boolean;
}

export function TaskDetailDialog({
  open,
  onClose,
  projectId,
  task,
  members,
  onEdit,
  onShare,
  canEdit,
}: TaskDetailDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const confirm = useConfirm();

  async function moveTo(next: TaskStatus) {
    if (!task || next === task.status) return;
    await projectStore.updateTask(projectId, task.id, { status: next });
  }

  if (!task) return null;

  const assignees = task.assigneeIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is ProjectMember => m !== undefined);
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
          {canEdit && (
            <Button
              variant="ghost"
              leftIcon="delete"
              onClick={handleDelete}
              loading={deleting}
              style={{ marginRight: 'auto' }}
            >
              Delete
            </Button>
          )}
          {onShare && (
            <Button
              variant="outline"
              leftIcon="share"
              onClick={onShare}
              disabled={deleting}
            >
              Share
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Close
          </Button>
          {canEdit && (
            <Button leftIcon="edit" onClick={onEdit} disabled={deleting}>
              Edit
            </Button>
          )}
        </>
      }
    >
      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>Status</span>
          {canEdit ? (
            <Menu
              align="start"
              trigger={
                <button type="button" className={styles.statusTrigger}>
                  <Badge
                    variant={TASK_STATUS_VARIANT[task.status]}
                    size="sm"
                    dot
                  >
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
          ) : (
            <Badge variant={TASK_STATUS_VARIANT[task.status]} size="sm" dot>
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
          )}
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Priority</span>
          <TaskPriorityBadge priority={task.priority} />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>Assignees</span>
          {canEdit ? (
            /* Assign/unassign right here — saves on every toggle. */
            <MultiSelect
              selectSize="sm"
              containerClassName={styles.assigneePicker}
              options={members.map((m) => ({ value: m.id, label: m.name }))}
              values={task.assigneeIds}
              onValuesChange={(ids) =>
                void projectStore.updateTask(projectId, task.id, {
                  assigneeIds: ids,
                })
              }
              placeholder="Unassigned"
            />
          ) : assignees.length > 0 ? (
            <span className={styles.assigneeList}>
              {assignees.map((member) => (
                <span key={member.id} className={styles.assignee}>
                  <UserAvatar name={member.name} seed={member.id} size={22} />
                  {member.name}
                </span>
              ))}
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
        canEdit={canEdit}
      />

      <Divider className={styles.divider} />

      <TaskThread
        projectId={projectId}
        taskId={task.id}
        events={task.events}
        canEdit={canEdit}
      />
    </Modal>
  );
}
