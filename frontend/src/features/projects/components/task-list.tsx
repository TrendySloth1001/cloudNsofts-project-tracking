'use client';

import {
  taskStatusSchema,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type ProjectMember,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';
import { IconButton, Select } from '@/components/ui';
import { UserAvatar } from '@/features/profile/components/user-avatar';
import { cx } from '@/lib/cx';
import { projectStore } from '../projects.store';
import {
  formatDate,
  groupByStatus,
  isOverdue,
  resolveMembers,
} from '../task-utils';
import { TaskPriorityBadge } from './task-priority-badge';
import { AssigneePicker } from './assignee-picker';
import styles from './tasks.module.css';

const STATUS_OPTIONS = taskStatusSchema.options.map((s) => ({
  value: s,
  label: TASK_STATUS_LABELS[s],
}));

export interface TaskListProps {
  tasks: Task[];
  members: ProjectMember[];
  projectId: string;
  onOpenTask: (task: Task) => void;
  /** When false (e.g. a client), rows are view-only. */
  canEdit: boolean;
}

export function TaskList({
  tasks,
  members,
  projectId,
  onOpenTask,
  canEdit,
}: TaskListProps) {
  const groups = groupByStatus(tasks);
  const memberById = new Map(members.map((m) => [m.id, m]));

  if (tasks.length === 0) {
    return <div className={styles.emptyTasks}>No tasks yet.</div>;
  }

  return (
    <div className={styles.list}>
      {TASK_STATUS_ORDER.filter((status) => groups[status].length > 0).map(
        (status) => (
          <div key={status} className={styles.listGroup}>
            <div className={styles.listGroupHead}>
              {TASK_STATUS_LABELS[status]}
              <span className={styles.listCount}>{groups[status].length}</span>
            </div>
            {groups[status].map((task) => {
              const assignees = resolveMembers(task.assigneeIds, memberById);
              const overdue = task.status !== 'done' && isOverdue(task.dueDate);
              return (
                <div key={task.id} className={styles.listRow}>
                  <button
                    type="button"
                    className={styles.listTitle}
                    onClick={() => onOpenTask(task)}
                  >
                    {task.title}
                  </button>
                  <TaskPriorityBadge priority={task.priority} />
                  {task.dueDate && (
                    <span className={cx(styles.due, overdue && styles.overdue)}>
                      {formatDate(task.dueDate)}
                    </span>
                  )}
                  {assignees.length > 0 ? (
                    <span
                      className={cx(styles.laneAvatars, styles.cardAvatars)}
                      title={assignees.map((m) => m.name).join(', ')}
                    >
                      {assignees.slice(0, 3).map((m) => (
                        <span key={m.id} className={styles.laneAvatar}>
                          <UserAvatar name={m.name} seed={m.id} size={24} />
                        </span>
                      ))}
                      {assignees.length > 3 && (
                        <span className={styles.laneAvatarMore}>
                          +{assignees.length - 3}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className={styles.unassigned}>Unassigned</span>
                  )}
                  {canEdit && (
                    <AssigneePicker
                      members={members}
                      values={task.assigneeIds}
                      onChange={(assigneeIds) =>
                        void projectStore.updateTask(projectId, task.id, {
                          assigneeIds,
                        })
                      }
                      label="Assign members"
                    />
                  )}
                  {canEdit ? (
                    <>
                      <Select
                        selectSize="sm"
                        containerClassName={styles.statusSelect}
                        value={task.status}
                        onChange={(e) =>
                          projectStore.updateTask(projectId, task.id, {
                            status: e.target.value as TaskStatus,
                          })
                        }
                        options={STATUS_OPTIONS}
                      />
                      <IconButton
                        icon="delete"
                        label={`Delete ${task.title}`}
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          projectStore.removeTask(projectId, task.id)
                        }
                      />
                    </>
                  ) : (
                    <span className={styles.listStatus}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}
