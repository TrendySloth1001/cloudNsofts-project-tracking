import { Prisma } from '@prisma/client';
import {
  TASK_STATUS_LABELS,
  type AuthUser,
  type AddClientInput,
  type AddMemberInput,
  type CreateCommentInput,
  type CreateFeatureInput,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type ReorderMilestonesInput,
  type UpdateMilestoneInput,
  type CreateSubtaskInput,
  type CreateTaskInput,
  type MemberRole,
  type UpdateFeatureInput,
  type Project,
  type ProjectRole,
  type ReorderFeaturesInput,
  type ReorderTasksInput,
  type TaskStatus,
  type UpdateProjectInput,
  type UpdateSubtaskInput,
  type UpdateTaskInput,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';
import { projectScopeWhere } from '../auth/access';
import { isPlatformAdmin } from '../auth/platform-admin';
import { notificationsService } from '../notifications/notifications.service';
import { toMetadataOnly, toProjectDto } from './projects.mapper';

/** Most recent task-events loaded per task in a project read (older history is
 *  not sent in the board payload). */
const EVENT_PAGE_SIZE = 100;

const include = {
  clients: { orderBy: { createdAt: 'asc' } },
  members: { orderBy: { createdAt: 'asc' } },
  features: {
    // Pinned features float to the top, then by manual swimlane order.
    orderBy: [{ pinned: 'desc' }, { position: 'asc' }, { createdAt: 'asc' }],
    include: { owners: { orderBy: { createdAt: 'asc' } } },
  },
  tasks: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      subtasks: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      // Cap the activity/comment history loaded per task (it's an append-only
      // log). Fetch the most recent page; the mapper reverses to ascending.
      events: { orderBy: { createdAt: 'desc' }, take: EVENT_PAGE_SIZE },
      assignees: { orderBy: { createdAt: 'asc' } },
    },
  },
  milestones: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
} satisfies Prisma.ProjectInclude;

/** Load a project (with relations) as a DTO, or 404. */
async function load(id: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id }, include });
  if (!project) throw HttpError.notFound('Project not found');
  return toProjectDto(project);
}

async function ensureExists(id: string): Promise<void> {
  if ((await prisma.project.count({ where: { id } })) === 0) {
    throw HttpError.notFound('Project not found');
  }
}

/** 404 unless the task exists and belongs to the given project. */
async function ensureTask(projectId: string, taskId: string): Promise<void> {
  if ((await prisma.task.count({ where: { id: taskId, projectId } })) === 0) {
    throw HttpError.notFound('Task not found');
  }
}

/** Scope incoming member ids to this project's own roster, so a foreign or
 *  bogus id can never be attached as an assignee/owner. */
async function projectMemberIds(
  projectId: string,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.projectMember.findMany({
    where: { projectId, id: { in: ids } },
    select: { id: true },
  });
  const valid = new Set(rows.map((r) => r.id));
  // Preserve the caller's order; drop anything not in the roster.
  return ids.filter((id) => valid.has(id));
}

/** Record a status-change entry in a task's activity thread. Accepts a Prisma
 *  transaction client so it can join an enclosing atomic write. */
async function logStatusChange(
  taskId: string,
  actor: string,
  status: TaskStatus,
  agentName: string | null = null,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  await db.taskEvent.create({
    data: {
      taskId,
      kind: 'activity',
      author: actor,
      agentName,
      body: `moved this to ${TASK_STATUS_LABELS[status]}`,
    },
  });
}


export const projectsService = {
  /**
   * List the projects the caller may see. A normal user gets full boards for
   * their roster projects. The env platform super-admin additionally sees every
   * project, but foreign ones (it isn't a roster member of) come back as
   * metadata only — no task/comment contents. When the request is made with a
   * project-scoped PAT, the list is further narrowed to that token's projects.
   */
  async list(
    user: AuthUser,
    tokenProjectIds: string[] | null = null,
  ): Promise<Project[]> {
    const base = projectScopeWhere(user);
    // A project-scoped token may only enumerate the projects it was limited to.
    const where =
      tokenProjectIds && tokenProjectIds.length > 0
        ? { AND: [base, { id: { in: tokenProjectIds } }] }
        : base;
    const projects = await prisma.project.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });
    const platformAdmin = isPlatformAdmin(user);
    return projects.map((p) => {
      const dto = toProjectDto(p);
      if (!platformAdmin) return dto;
      const onRoster =
        p.members.some((m) => m.email === user.email) ||
        p.clients.some((c) => c.email === user.email);
      return onRoster ? dto : toMetadataOnly(dto);
    });
  },

  getById(id: string): Promise<Project> {
    return load(id);
  },

  async create(input: CreateProjectInput, creator: AuthUser): Promise<Project> {
    const created = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        // The creator becomes the project's admin (its owner) so they can run
        // it end-to-end, including editing/deleting it. This ALWAYS applies —
        // including the env platform super-admin: cross-project access now flows
        // only through the roster (CLAUDE.md §6), so without this row the admin
        // would create a project it couldn't then open.
        members: {
          create: {
            name: creator.name,
            email: creator.email,
            role: 'admin',
          },
        },
      },
    });
    return load(created.id);
  },

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    await ensureExists(id);
    await prisma.project.update({ where: { id }, data: input });
    return load(id);
  },

  async remove(id: string): Promise<void> {
    await ensureExists(id);
    await prisma.project.delete({ where: { id } });
  },

  /* -------------------------------- Clients ----------------------------- */
  async addClient(
    projectId: string,
    input: AddClientInput,
    actorEmail?: string,
  ): Promise<Project> {
    await ensureExists(projectId);
    await prisma.projectClient.create({
      data: {
        projectId,
        name: input.name,
        email: input.email,
        company: input.company ?? null,
      },
    });
    const project = await load(projectId);
    void notificationsService.notify({
      kind: 'member_added',
      title: 'Client added',
      body: `${input.name} was added to ${project.name}`,
      projectId,
      audience: { scope: 'project', projectId },
      excludeEmail: actorEmail,
    });
    return project;
  },
  async removeClient(projectId: string, clientId: string): Promise<Project> {
    await prisma.projectClient.deleteMany({ where: { id: clientId, projectId } });
    return load(projectId);
  },

  /* --------------------------------- Team ------------------------------- */
  async addMember(
    projectId: string,
    input: AddMemberInput,
    callerRole: ProjectRole,
    actorEmail?: string,
  ): Promise<Project> {
    await ensureExists(projectId);
    // Only a project admin may grant the admin (owner) tier — a manager runs the
    // team but can't mint co-owners or escalate itself.
    if (input.role === 'admin' && callerRole !== 'admin') {
      throw HttpError.forbidden('Only a project admin can grant the admin role.');
    }
    await prisma.projectMember.create({
      data: {
        projectId,
        name: input.name,
        email: input.email,
        role: input.role,
      },
    });
    const project = await load(projectId);
    void notificationsService.notify({
      kind: 'member_added',
      title: 'Team member added',
      body: `${input.name} joined ${project.name}`,
      projectId,
      audience: { scope: 'project', projectId },
      excludeEmail: actorEmail,
    });
    return project;
  },
  async updateMemberRole(
    projectId: string,
    memberId: string,
    role: MemberRole,
    callerRole: ProjectRole,
  ): Promise<Project> {
    const target = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { role: true },
    });
    if (!target) throw HttpError.notFound('Member not found');
    // Granting admin, or touching an existing admin's row (e.g. demoting the
    // owner), is reserved for project admins.
    if (
      (role === 'admin' || target.role === 'admin') &&
      callerRole !== 'admin'
    ) {
      throw HttpError.forbidden('Only a project admin can change an admin role.');
    }
    await prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
    });
    return load(projectId);
  },
  async removeMember(
    projectId: string,
    memberId: string,
    callerRole: ProjectRole,
  ): Promise<Project> {
    const target = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { role: true },
    });
    // Only a project admin may remove another admin (protects the owner from
    // being ejected by a manager). Missing rows are a no-op, as before.
    if (target?.role === 'admin' && callerRole !== 'admin') {
      throw HttpError.forbidden('Only a project admin can remove an admin.');
    }
    await prisma.projectMember.deleteMany({ where: { id: memberId, projectId } });
    return load(projectId);
  },

  /* ------------------------------- Features ----------------------------- */
  async addFeature(
    projectId: string,
    input: CreateFeatureInput,
  ): Promise<Project> {
    await ensureExists(projectId);
    // Append the new feature to the end of the swimlane order.
    const last = await prisma.feature.aggregate({
      where: { projectId },
      _max: { position: true },
    });
    const ownerIds = await projectMemberIds(projectId, input.ownerIds);
    await prisma.feature.create({
      data: {
        projectId,
        name: input.name,
        description: input.description,
        status: input.status,
        targetDate: input.targetDate,
        position: (last._max.position ?? -1) + 1,
        owners: { create: ownerIds.map((memberId) => ({ memberId })) },
      },
    });
    return load(projectId);
  },
  async updateFeature(
    projectId: string,
    featureId: string,
    input: UpdateFeatureInput,
  ): Promise<Project> {
    // Owners are join rows, not a scalar — split them out of the patch.
    const { ownerIds, expectedUpdatedAt, ...scalars } = input;
    const existing = await prisma.feature.findFirst({
      where: { id: featureId, projectId },
      select: { updatedAt: true },
    });
    if (!existing) throw HttpError.notFound('Feature not found');
    // Optimistic concurrency: reject if the feature changed since the read.
    if (
      expectedUpdatedAt &&
      existing.updatedAt.toISOString() !== expectedUpdatedAt
    ) {
      throw HttpError.conflict(
        'Feature was modified since you last read it — re-read and retry',
      );
    }
    const validOwners =
      ownerIds === undefined
        ? null
        : await projectMemberIds(projectId, ownerIds);

    // One atomic write: scalar update + owner replacement.
    await prisma.$transaction(async (tx) => {
      // `updateMany` with an empty data object matches nothing — skip it when
      // the patch was owners-only.
      if (Object.keys(scalars).length > 0) {
        await tx.feature.updateMany({
          where: { id: featureId, projectId },
          data: scalars,
        });
      }
      if (validOwners !== null) {
        await tx.featureOwner.deleteMany({ where: { featureId } });
        if (validOwners.length > 0) {
          await tx.featureOwner.createMany({
            data: validOwners.map((memberId) => ({ featureId, memberId })),
          });
        }
      }
    });
    return load(projectId);
  },
  async removeFeature(projectId: string, featureId: string): Promise<Project> {
    // Tasks keep existing; their featureId is set null by the FK (SetNull).
    await prisma.feature.deleteMany({ where: { id: featureId, projectId } });
    return load(projectId);
  },
  /** Persist the swimlane order: each feature gets its list index as position. */
  async reorderFeatures(
    projectId: string,
    input: ReorderFeaturesInput,
  ): Promise<Project> {
    await ensureExists(projectId);
    await prisma.$transaction(
      input.orderedIds.map((featureId, index) =>
        prisma.feature.updateMany({
          where: { id: featureId, projectId },
          data: { position: index },
        }),
      ),
    );
    return load(projectId);
  },

  /* -------------------------------- Tasks ------------------------------- */
  async addTask(
    projectId: string,
    input: CreateTaskInput,
    actorEmail?: string,
  ): Promise<Project> {
    await ensureExists(projectId);
    // Append the new task to the end of its status column.
    const last = await prisma.task.aggregate({
      where: { projectId, status: input.status },
      _max: { position: true },
    });
    const assigneeIds = await projectMemberIds(projectId, input.assigneeIds);
    await prisma.task.create({
      data: {
        projectId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        featureId: input.featureId,
        dueDate: input.dueDate,
        position: (last._max.position ?? -1) + 1,
        assignees: { create: assigneeIds.map((memberId) => ({ memberId })) },
      },
    });
    const project = await load(projectId);
    void notificationsService.notify({
      kind: 'task_created',
      title: 'New task',
      body: `“${input.title}” added to ${project.name}`,
      projectId,
      audience: { scope: 'project', projectId },
      excludeEmail: actorEmail,
    });
    return project;
  },

  /** Persist the manual order of a status column. Every id in `orderedIds` is
   *  moved to `status` and assigned its list index as the new position. */
  async reorderTasks(
    projectId: string,
    input: ReorderTasksInput,
    actor: string,
  ): Promise<Project> {
    await ensureExists(projectId);
    // Tasks whose column actually changes get an activity entry.
    const current = await prisma.task.findMany({
      where: { id: { in: input.orderedIds }, projectId },
      select: { id: true, status: true },
    });
    const movedIds = current
      .filter((t) => t.status !== input.status)
      .map((t) => t.id);
    // One atomic write: all repositions + the activity entries for moved tasks.
    await prisma.$transaction(async (tx) => {
      for (const [index, taskId] of input.orderedIds.entries()) {
        await tx.task.updateMany({
          where: { id: taskId, projectId },
          data: { status: input.status, position: index },
        });
      }
      for (const id of movedIds) {
        await logStatusChange(id, actor, input.status, null, tx);
      }
    });
    return load(projectId);
  },
  async updateTask(
    projectId: string,
    taskId: string,
    patch: UpdateTaskInput,
    actor: string,
    agentName: string | null = null,
    actorEmail?: string,
  ): Promise<Project> {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!existing) throw HttpError.notFound('Task not found');
    // Assignees are join rows, not a scalar — split them out of the patch.
    const { assigneeIds, expectedUpdatedAt, ...scalars } = patch;
    // Optimistic concurrency: reject if the task changed since the caller read it.
    if (
      expectedUpdatedAt &&
      existing.updatedAt.toISOString() !== expectedUpdatedAt
    ) {
      throw HttpError.conflict(
        'Task was modified since you last read it — re-read and retry',
      );
    }
    // Resolve/scope assignee ids before opening the transaction (a read).
    const validAssignees =
      assigneeIds === undefined
        ? null
        : await projectMemberIds(projectId, assigneeIds);
    const statusChanged =
      patch.status !== undefined && patch.status !== existing.status;

    // One atomic write: scalar update + assignee replacement + status event.
    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: taskId }, data: scalars });
      if (validAssignees !== null) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (validAssignees.length > 0) {
          await tx.taskAssignee.createMany({
            data: validAssignees.map((memberId) => ({ taskId, memberId })),
          });
        }
      }
      if (statusChanged && patch.status) {
        await logStatusChange(taskId, actor, patch.status, agentName, tx);
      }
    });

    if (statusChanged && patch.status === 'done') {
      void notificationsService.notify({
        kind: 'task_completed',
        title: 'Task completed',
        body: `“${existing.title}” was marked done`,
        projectId,
        audience: { scope: 'project', projectId },
        excludeEmail: actorEmail,
      });
    }
    return load(projectId);
  },
  async removeTask(projectId: string, taskId: string): Promise<Project> {
    await prisma.task.deleteMany({ where: { id: taskId, projectId } });
    return load(projectId);
  },

  /* ------------------------------ Subtasks ------------------------------ */
  async addSubtask(
    projectId: string,
    taskId: string,
    input: CreateSubtaskInput,
  ): Promise<Project> {
    await ensureTask(projectId, taskId);
    const last = await prisma.subtask.aggregate({
      where: { taskId },
      _max: { position: true },
    });
    await prisma.subtask.create({
      data: {
        taskId,
        title: input.title,
        position: (last._max.position ?? -1) + 1,
      },
    });
    return load(projectId);
  },
  async updateSubtask(
    projectId: string,
    taskId: string,
    subtaskId: string,
    patch: UpdateSubtaskInput,
  ): Promise<Project> {
    await ensureTask(projectId, taskId);
    const result = await prisma.subtask.updateMany({
      where: { id: subtaskId, taskId },
      data: patch,
    });
    if (result.count === 0) throw HttpError.notFound('Subtask not found');
    return load(projectId);
  },
  async removeSubtask(
    projectId: string,
    taskId: string,
    subtaskId: string,
  ): Promise<Project> {
    await ensureTask(projectId, taskId);
    await prisma.subtask.deleteMany({ where: { id: subtaskId, taskId } });
    return load(projectId);
  },

  /* ------------------------------ Comments ------------------------------ */
  async addComment(
    projectId: string,
    taskId: string,
    author: string,
    input: CreateCommentInput,
    agentName: string | null = null,
    actorEmail?: string,
  ): Promise<Project> {
    await ensureTask(projectId, taskId);
    await prisma.taskEvent.create({
      data: { taskId, kind: 'comment', author, agentName, body: input.body },
    });
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });
    void notificationsService.notify({
      kind: 'comment_added',
      title: 'New comment',
      body: `${author} commented on “${task?.title ?? 'a task'}”`,
      projectId,
      audience: { scope: 'project', projectId },
      excludeEmail: actorEmail,
    });
    return load(projectId);
  },

  /* ------------------------------ Milestones ---------------------------- */
  async addMilestone(
    projectId: string,
    input: CreateMilestoneInput,
  ): Promise<Project> {
    await ensureExists(projectId);
    // Append to the end of the roadmap.
    const position = await prisma.milestone.count({ where: { projectId } });
    await prisma.milestone.create({
      data: {
        projectId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        status: input.status,
        position,
        completedAt: input.status === 'done' ? new Date() : null,
      },
    });
    return load(projectId);
  },
  async updateMilestone(
    projectId: string,
    milestoneId: string,
    input: UpdateMilestoneInput,
  ): Promise<Project> {
    const milestone = await prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) throw HttpError.notFound('Milestone not found');
    // Keep `completedAt` in sync with the status stage: stamp it when the
    // checkpoint reaches `done`, clear it if it moves back out.
    let completedAt: Date | null | undefined;
    if (input.status !== undefined && input.status !== milestone.status) {
      completedAt = input.status === 'done' ? new Date() : null;
    }
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(completedAt !== undefined ? { completedAt } : {}),
      },
    });
    return load(projectId);
  },
  /** Persist the manual order of the roadmap. Every id in `orderedIds` is
   *  assigned its list index as the new position. */
  async reorderMilestones(
    projectId: string,
    input: ReorderMilestonesInput,
  ): Promise<Project> {
    await ensureExists(projectId);
    await prisma.$transaction(
      input.orderedIds.map((milestoneId, index) =>
        prisma.milestone.updateMany({
          where: { id: milestoneId, projectId },
          data: { position: index },
        }),
      ),
    );
    return load(projectId);
  },
  async removeMilestone(
    projectId: string,
    milestoneId: string,
  ): Promise<Project> {
    await prisma.milestone.deleteMany({ where: { id: milestoneId, projectId } });
    return load(projectId);
  },
};
