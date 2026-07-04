import { useState } from 'react';
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type ProjectMember,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';
import { Icon, IconButton, Menu } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { cx } from '@/lib/cx';
import { formatDate, isOverdue } from '../task-utils';
import { TaskPriorityBadge } from './task-priority-badge';
import styles from './tasks.module.css';

export interface TaskCardProps {
  task: Task;
  assignee?: ProjectMember;
  onOpen: () => void;
  /** Move the task to another column (used by the card's quick-move menu). */
  onMove: (status: TaskStatus) => void;
}

export function TaskCard({ task, assignee, onOpen, onMove }: TaskCardProps) {
  const overdue = task.status !== 'done' && isOverdue(task.dueDate);
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  const commentCount = task.events.filter((e) => e.kind === 'comment').length;
  const [dragging, setDragging] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      className={cx(styles.card, dragging && styles.cardDragging)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={onOpen}
      onKeyDown={(e) => {
        // Only the card itself opens on Enter/Space — not its inner controls.
        if (
          e.target === e.currentTarget &&
          (e.key === 'Enter' || e.key === ' ')
        ) {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className={styles.cardTop}>
        <span className={styles.cardTitle}>{task.title}</span>
        <span
          className={styles.cardMenu}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
        >
          <Menu
            portal
            align="end"
            trigger={
              <IconButton
                icon="moreVertical"
                label="Move task"
                variant="ghost"
                size="sm"
              />
            }
            items={TASK_STATUS_ORDER.map((s) => ({
              label: TASK_STATUS_LABELS[s],
              selected: s === task.status,
              onSelect: () => onMove(s),
            }))}
          />
        </span>
      </div>

      <div className={styles.cardMeta}>
        <TaskPriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={cx(styles.due, overdue && styles.overdue)}>
            <Icon
              name="calendar"
              size={13}
              tone={overdue ? undefined : 'warning'}
            />
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.subtasks.length > 0 && (
          <span
            className={cx(
              styles.metaChip,
              doneSubtasks === task.subtasks.length && styles.metaChipDone,
            )}
          >
            <Icon name="checkSquare" size={13} />
            {doneSubtasks}/{task.subtasks.length}
          </span>
        )}
        {commentCount > 0 && (
          <span className={styles.metaChip}>
            <Icon name="chat" size={13} />
            {commentCount}
          </span>
        )}
        <span className={styles.spacer} />
        {assignee && (
          <UserAvatar name={assignee.name} seed={assignee.id} size={22} />
        )}
      </div>
    </div>
  );
}
