import {
  TASK_STATUS_ORDER,
  type Feature,
  type Project,
  type ProjectMember,
  type Task,
  type TaskStatus,
} from '@cnsofts/shared';

/** Resolve member ids to members (dropping ids no longer on the roster). */
export function resolveMembers(
  ids: string[],
  memberById: Map<string, ProjectMember>,
): ProjectMember[] {
  return ids
    .map((id) => memberById.get(id))
    .filter((m): m is ProjectMember => m !== undefined);
}

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

/** A swimlane: a feature (or `null` for the "No feature" lane) + its tasks. */
export interface FeatureLane {
  feature: Feature | null;
  tasks: Task[];
}

/**
 * Group tasks into swimlanes — one per feature (in the given feature order),
 * then a trailing "No feature" lane for ungrouped tasks. Empty feature lanes
 * are kept (so newly-created features are visible); the "No feature" lane is
 * only shown when it has tasks.
 */
export function groupByFeature(
  tasks: Task[],
  features: Feature[],
): FeatureLane[] {
  const byFeature = new Map<string, Task[]>();
  for (const feature of features) byFeature.set(feature.id, []);
  const orphans: Task[] = [];
  for (const task of tasks) {
    const bucket = task.featureId ? byFeature.get(task.featureId) : undefined;
    if (bucket) bucket.push(task);
    else orphans.push(task);
  }
  const lanes: FeatureLane[] = features.map((feature) => ({
    feature,
    tasks: byFeature.get(feature.id) ?? [],
  }));
  if (orphans.length > 0) lanes.push({ feature: null, tasks: orphans });
  return lanes;
}

/** Done / total task counts for a swimlane (or feature card). */
export function featureProgress(tasks: Task[]): { done: number; total: number } {
  return {
    done: tasks.filter((t) => t.status === 'done').length,
    total: tasks.length,
  };
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

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** Short "Jul 4, 2:05 PM"-style stamp for comments and activity. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date);
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

/** Time-only stamp ("6:36 PM") — the day is carried by the message divider. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : timeFormatter.format(date);
}

/** Local YYYY-MM-DD key for a Date — used to detect calendar-day boundaries. */
function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar-day key for a timestamp (empty for an invalid date). */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : localDayKey(date);
}

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

/** Day-divider label: "Today" / "Yesterday" / "Friday, July 4". */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = localDayKey(date);
  if (key === localDayKey(today)) return 'Today';
  if (key === localDayKey(yesterday)) return 'Yesterday';
  return dayLabelFormatter.format(date);
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
