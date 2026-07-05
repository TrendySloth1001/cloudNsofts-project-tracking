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
  type CreateSubtaskInput,
  type CreateTaskInput,
  type MemberRole,
  type UpdateFeatureInput,
  type Project,
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
import { notificationsService } from '../notifications/notifications.service';
import { toProjectDto } from './projects.mapper';

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
      events: { orderBy: { createdAt: 'asc' } },
      assignees: { orderBy: { createdAt: 'asc' } },
    },
  },
  milestones: { orderBy: { createdAt: 'asc' } },
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

/** Record a status-change entry in a task's activity thread. */
async function logStatusChange(
  taskId: string,
  actor: string,
  status: TaskStatus,
): Promise<void> {
  await prisma.taskEvent.create({
    data: {
      taskId,
      kind: 'activity',
      author: actor,
      body: `moved this to ${TASK_STATUS_LABELS[status]}`,
    },
  });
}


export const projectsService = {
  async list(user: AuthUser): Promise<Project[]> {
    const projects = await prisma.project.findMany({
      where: projectScopeWhere(user),
      include,
      orderBy: { createdAt: 'desc' },
    });
    return projects.map(toProjectDto);
  },

  getById(id: string): Promise<Project> {
    return load(id);
  },

  async create(input: CreateProjectInput): Promise<Project> {
    const created = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
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
  async addClient(projectId: string, input: AddClientInput): Promise<Project> {
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
    await notificationsService.notify({
      kind: 'member_added',
      title: 'Client added',
      body: `${input.name} was added to ${project.name}`,
      projectId,
    });
    return project;
  },
  async removeClient(projectId: string, clientId: string): Promise<Project> {
    await prisma.projectClient.deleteMany({ where: { id: clientId, projectId } });
    return load(projectId);
  },

  /* --------------------------------- Team ------------------------------- */
  async addMember(projectId: string, input: AddMemberInput): Promise<Project> {
    await ensureExists(projectId);
    await prisma.projectMember.create({
      data: {
        projectId,
        name: input.name,
        email: input.email,
        role: input.role,
      },
    });
    const project = await load(projectId);
    await notificationsService.notify({
      kind: 'member_added',
      title: 'Team member added',
      body: `${input.name} joined ${project.name}`,
      projectId,
    });
    return project;
  },
  async updateMemberRole(
    projectId: string,
    memberId: string,
    role: MemberRole,
  ): Promise<Project> {
    const updated = await prisma.projectMember.updateMany({
      where: { id: memberId, projectId },
      data: { role },
    });
    if (updated.count === 0) throw HttpError.notFound('Member not found');
    return load(projectId);
  },
  async removeMember(projectId: string, memberId: string): Promise<Project> {
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
    const { ownerIds, ...scalars } = input;
    const exists = await prisma.feature.count({
      where: { id: featureId, projectId },
    });
    if (exists === 0) throw HttpError.notFound('Feature not found');
    // `updateMany` with an empty data object matches nothing — skip it when
    // the patch was owners-only.
    if (Object.keys(scalars).length > 0) {
      await prisma.feature.updateMany({
        where: { id: featureId, projectId },
        data: scalars,
      });
    }
    if (ownerIds !== undefined) {
      const valid = await projectMemberIds(projectId, ownerIds);
      await prisma.$transaction([
        prisma.featureOwner.deleteMany({ where: { featureId } }),
        prisma.featureOwner.createMany({
          data: valid.map((memberId) => ({ featureId, memberId })),
        }),
      ]);
    }
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
  async addTask(projectId: string, input: CreateTaskInput): Promise<Project> {
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
    await notificationsService.notify({
      kind: 'task_created',
      title: 'New task',
      body: `“${input.title}” added to ${project.name}`,
      projectId,
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
    await prisma.$transaction(
      input.orderedIds.map((taskId, index) =>
        prisma.task.updateMany({
          where: { id: taskId, projectId },
          data: { status: input.status, position: index },
        }),
      ),
    );
    for (const id of movedIds) await logStatusChange(id, actor, input.status);
    return load(projectId);
  },
  async updateTask(
    projectId: string,
    taskId: string,
    patch: UpdateTaskInput,
    actor: string,
  ): Promise<Project> {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });
    if (!existing) throw HttpError.notFound('Task not found');
    // Assignees are join rows, not a scalar — split them out of the patch.
    const { assigneeIds, ...scalars } = patch;
    await prisma.task.update({ where: { id: taskId }, data: scalars });
    if (assigneeIds !== undefined) {
      const valid = await projectMemberIds(projectId, assigneeIds);
      await prisma.$transaction([
        prisma.taskAssignee.deleteMany({ where: { taskId } }),
        prisma.taskAssignee.createMany({
          data: valid.map((memberId) => ({ taskId, memberId })),
        }),
      ]);
    }
    if (patch.status && patch.status !== existing.status) {
      await logStatusChange(taskId, actor, patch.status);
      if (patch.status === 'done') {
        await notificationsService.notify({
          kind: 'task_completed',
          title: 'Task completed',
          body: `“${existing.title}” was marked done`,
          projectId,
        });
      }
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
  ): Promise<Project> {
    await ensureTask(projectId, taskId);
    await prisma.taskEvent.create({
      data: { taskId, kind: 'comment', author, body: input.body },
    });
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });
    await notificationsService.notify({
      kind: 'comment_added',
      title: 'New comment',
      body: `${author} commented on “${task?.title ?? 'a task'}”`,
      projectId,
    });
    return load(projectId);
  },

  /* ------------------------------ Milestones ---------------------------- */
  async addMilestone(
    projectId: string,
    input: CreateMilestoneInput,
  ): Promise<Project> {
    await ensureExists(projectId);
    await prisma.milestone.create({
      data: { projectId, title: input.title, dueDate: input.dueDate },
    });
    return load(projectId);
  },
  async toggleMilestone(
    projectId: string,
    milestoneId: string,
  ): Promise<Project> {
    const milestone = await prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!milestone) throw HttpError.notFound('Milestone not found');
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: { done: !milestone.done },
    });
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
