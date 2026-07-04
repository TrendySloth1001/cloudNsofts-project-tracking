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
import { formatDate, groupByStatus, isOverdue } from '../task-utils';
import { TaskPriorityBadge } from './task-priority-badge';
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
}

export function TaskList({
  tasks,
  members,
  projectId,
  onOpenTask,
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
              const assignee = memberById.get(task.assigneeId ?? '');
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
                  {assignee ? (
                    <UserAvatar
                      name={assignee.name}
                      seed={assignee.id}
                      size={24}
                    />
                  ) : (
                    <span className={styles.unassigned}>Unassigned</span>
                  )}
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
                    onClick={() => projectStore.removeTask(projectId, task.id)}
                  />
                </div>
              );
            })}
          </div>
        ),
      )}
    </div>
  );
}
