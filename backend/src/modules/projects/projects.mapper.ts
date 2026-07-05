import type { Prisma } from '@prisma/client';
import type {
  Feature,
  Milestone,
  Project,
  ProjectClient,
  ProjectMember,
  Subtask,
  Task,
  TaskEvent,
} from '@cnsofts/shared';

/** A project with all its relations loaded. */
export type PrismaProjectFull = Prisma.ProjectGetPayload<{
  include: {
    clients: true;
    members: true;
    features: { include: { owners: true } };
    tasks: { include: { subtasks: true; events: true; assignees: true } };
    milestones: true;
  };
}>;

type ClientRow = PrismaProjectFull['clients'][number];
type MemberRow = PrismaProjectFull['members'][number];
type FeatureRow = PrismaProjectFull['features'][number];
type TaskRow = PrismaProjectFull['tasks'][number];
type SubtaskRow = TaskRow['subtasks'][number];
type TaskEventRow = TaskRow['events'][number];
type MilestoneRow = PrismaProjectFull['milestones'][number];

function toClient(c: ClientRow): ProjectClient {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    company: c.company ?? undefined,
  };
}

function toMember(m: MemberRow): ProjectMember {
  return { id: m.id, name: m.name, email: m.email, role: m.role };
}

function toFeature(f: FeatureRow): Feature {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    status: f.status,
    ownerIds: f.owners.map((o) => o.memberId),
    targetDate: f.targetDate,
    pinned: f.pinned,
    position: f.position,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

function toSubtask(s: SubtaskRow): Subtask {
  return { id: s.id, title: s.title, done: s.done };
}

function toTaskEvent(e: TaskEventRow): TaskEvent {
  return {
    id: e.id,
    kind: e.kind,
    author: e.author,
    body: e.body,
    createdAt: e.createdAt.toISOString(),
  };
}

function toTask(t: TaskRow): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeIds: t.assignees.map((a) => a.memberId),
    featureId: t.featureId,
    dueDate: t.dueDate,
    subtasks: t.subtasks.map(toSubtask),
    events: t.events.map(toTaskEvent),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

function toMilestone(m: MilestoneRow): Milestone {
  return { id: m.id, title: m.title, dueDate: m.dueDate, done: m.done };
}

/** Convert a Prisma project (with relations) into the shared API shape. */
export function toProjectDto(p: PrismaProjectFull): Project {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    startDate: p.startDate,
    dueDate: p.dueDate,
    clients: p.clients.map(toClient),
    members: p.members.map(toMember),
    features: p.features.map(toFeature),
    tasks: p.tasks.map(toTask),
    milestones: p.milestones.map(toMilestone),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
