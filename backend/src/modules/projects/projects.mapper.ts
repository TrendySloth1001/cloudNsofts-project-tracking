import type { Prisma } from '@prisma/client';
import type {
  Milestone,
  Project,
  ProjectClient,
  ProjectMember,
  Task,
} from '@cnsofts/shared';

/** A project with all its relations loaded. */
export type PrismaProjectFull = Prisma.ProjectGetPayload<{
  include: { clients: true; members: true; tasks: true; milestones: true };
}>;

type ClientRow = PrismaProjectFull['clients'][number];
type MemberRow = PrismaProjectFull['members'][number];
type TaskRow = PrismaProjectFull['tasks'][number];
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

function toTask(t: TaskRow): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId,
    dueDate: t.dueDate,
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
    tasks: p.tasks.map(toTask),
    milestones: p.milestones.map(toMilestone),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
