import {
  TASK_STATUS_ORDER,
  type Project,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';

/** Percentage of a project's tasks that are done (0 when there are none). */
export function projectProgress(project: Project): number {
  if (project.tasks.length === 0) return 0;
  const done = project.tasks.filter((t) => t.status === 'done').length;
  return Math.round((done / project.tasks.length) * 100);
}

/** Group tasks into ordered status buckets. */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const groups = {} as Record<TaskStatus, Task[]>;
  for (const status of TASK_STATUS_ORDER) groups[status] = [];
  for (const task of tasks) groups[task.status].push(task);
  return groups;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

/** True when a date is before today (used to flag overdue tasks/milestones). */
export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/** Count of tasks that are overdue and not yet done. */
export function overdueTaskCount(project: Project): number {
  return project.tasks.filter((t) => t.status !== 'done' && isOverdue(t.dueDate))
    .length;
}
