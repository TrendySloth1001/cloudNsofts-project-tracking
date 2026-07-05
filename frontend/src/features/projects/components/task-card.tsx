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
import { AssigneePicker } from './assignee-picker';
import styles from './tasks.module.css';

const MAX_CARD_AVATARS = 3;

export interface TaskCardProps {
  task: Task;
  /** Members assigned to this task (already resolved from assigneeIds). */
  assignees: ProjectMember[];
  /** Full project roster — the card's inline "+" picker assigns from it. */
  members: ProjectMember[];
  /** Persist a new assignee list (from the inline "+" picker). */
  onAssigneesChange: (assigneeIds: string[]) => void;
  /** Parent feature name — shown as a chip in the status view (omitted in the
   *  feature swimlane view, where the lane already conveys it). */
  featureName?: string;
  onOpen: () => void;
  /** Move the task to another column (used by the card's quick-move menu). */
  onMove: (status: TaskStatus) => void;
  /** When false (e.g. a client), the card is view-only: no drag, no move menu. */
  canEdit: boolean;
}

export function TaskCard({
  task,
  assignees,
  members,
  onAssigneesChange,
  featureName,
  onOpen,
  onMove,
  canEdit,
}: TaskCardProps) {
  const visibleAssignees = assignees.slice(0, MAX_CARD_AVATARS);
  const extraAssignees = assignees.length - visibleAssignees.length;
  const overdue = task.status !== 'done' && isOverdue(task.dueDate);
  const doneSubtasks = task.subtasks.filter((s) => s.done).length;
  const commentCount = task.events.filter((e) => e.kind === 'comment').length;
  const [dragging, setDragging] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      className={cx(styles.card, dragging && styles.cardDragging)}
      draggable={canEdit}
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
        {canEdit && (
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
        )}
      </div>

      <div className={styles.cardMeta}>
        <TaskPriorityBadge priority={task.priority} />
        {featureName && (
          <span className={styles.featureChip} title={featureName}>
            <Icon name="layers" size={12} />
            {featureName}
          </span>
        )}
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
        {assignees.length > 0 && (
          <span
            className={cx(styles.laneAvatars, styles.cardAvatars)}
            title={assignees.map((m) => m.name).join(', ')}
          >
            {visibleAssignees.map((m) => (
              <span key={m.id} className={styles.laneAvatar}>
                <UserAvatar name={m.name} seed={m.id} size={22} />
              </span>
            ))}
            {extraAssignees > 0 && (
              <span className={styles.laneAvatarMore}>+{extraAssignees}</span>
            )}
          </span>
        )}
        {canEdit && (
          <span
            className={styles.cardAssign}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          >
            <AssigneePicker
              members={members}
              values={task.assigneeIds}
              onChange={onAssigneesChange}
              label="Assign members"
            />
          </span>
        )}
      </div>
    </div>
  );
}
