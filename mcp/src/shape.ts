import type { Feature, Message, Milestone, Project, Task } from '@cnsofts/shared';

/* Lean projections of the API's full payloads. The REST API returns the whole
   project (with all event history) on every write; tools and resources only
   need these compact shapes, which keep output small and cheap. Shared by the
   tool layer (index.ts) and the resource layer (resources.ts). */

export function compactTask(t: Task) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    featureId: t.featureId,
    assigneeIds: t.assigneeIds,
    dueDate: t.dueDate,
    subtaskCount: t.subtasks.length,
    doneSubtasks: t.subtasks.filter((s) => s.done).length,
    commentCount: t.events.filter((e) => e.kind === 'comment').length,
    // For optimistic concurrency: pass this back as expectedUpdatedAt on update.
    updatedAt: t.updatedAt,
  };
}

export function compactFeature(p: Project, f: Feature) {
  return {
    id: f.id,
    name: f.name,
    status: f.status,
    pinned: f.pinned,
    ownerIds: f.ownerIds,
    targetDate: f.targetDate,
    taskCount: p.tasks.filter((t) => t.featureId === f.id).length,
    updatedAt: f.updatedAt,
  };
}

export function compactMilestone(m: Milestone) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    status: m.status,
    dueDate: m.dueDate,
    position: m.position,
    completedAt: m.completedAt,
    updatedAt: m.updatedAt,
  };
}

export function compactProject(p: Project) {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    clients: p.clients.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
    })),
    members: p.members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    features: p.features.map((f) => compactFeature(p, f)),
    tasks: p.tasks.map(compactTask),
    milestones: p.milestones.map(compactMilestone),
  };
}

/** Truncate a message for a channel page — full body via get_message. */
export function leanMessage(m: Message) {
  const MAX = 240;
  const truncated = m.body.length > MAX;
  return {
    id: m.id,
    author: m.author,
    agentName: m.agentName,
    time: m.createdAt,
    body: truncated ? `${m.body.slice(0, MAX).trimEnd()}…` : m.body,
    ...(truncated ? { truncated: true } : {}),
    ...(m.attachment ? { attachment: m.attachment } : {}),
  };
}

/** The most-recently-touched item — used to pick the just-created entity out of
 *  the full project a write returns (ISO timestamps sort lexicographically). */
export function newest<T extends { updatedAt: string }>(items: T[]): T {
  return items.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
}

export function findTask(p: Project, taskId: string): Task {
  const t = p.tasks.find((x) => x.id === taskId);
  if (!t) throw new Error(`Task ${taskId} not found in project`);
  return t;
}

export function findFeature(p: Project, featureId: string): Feature {
  const f = p.features.find((x) => x.id === featureId);
  if (!f) throw new Error(`Feature ${featureId} not found in project`);
  return f;
}

export function findMilestone(p: Project, milestoneId: string): Milestone {
  const m = p.milestones.find((x) => x.id === milestoneId);
  if (!m) throw new Error(`Milestone ${milestoneId} not found in project`);
  return m;
}
