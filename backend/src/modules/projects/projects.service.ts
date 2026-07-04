import { Prisma } from '@prisma/client';
import type {
  AddClientInput,
  AddMemberInput,
  CreateMilestoneInput,
  CreateProjectInput,
  CreateTaskInput,
  Project,
  UpdateProjectInput,
  UpdateTaskInput,
} from '@cnsofts/shared';
import { prisma } from '../../infra/prisma';
import { HttpError } from '../../shared/http/http-error';
import { toProjectDto } from './projects.mapper';

const include = {
  clients: { orderBy: { createdAt: 'asc' } },
  members: { orderBy: { createdAt: 'asc' } },
  tasks: { orderBy: { createdAt: 'asc' } },
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

export const projectsService = {
  async list(): Promise<Project[]> {
    const projects = await prisma.project.findMany({
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
    return load(projectId);
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
    return load(projectId);
  },
  async removeMember(projectId: string, memberId: string): Promise<Project> {
    await prisma.projectMember.deleteMany({ where: { id: memberId, projectId } });
    return load(projectId);
  },

  /* -------------------------------- Tasks ------------------------------- */
  async addTask(projectId: string, input: CreateTaskInput): Promise<Project> {
    await ensureExists(projectId);
    await prisma.task.create({
      data: {
        projectId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate,
      },
    });
    return load(projectId);
  },
  async updateTask(
    projectId: string,
    taskId: string,
    patch: UpdateTaskInput,
  ): Promise<Project> {
    const result = await prisma.task.updateMany({
      where: { id: taskId, projectId },
      data: patch,
    });
    if (result.count === 0) throw HttpError.notFound('Task not found');
    return load(projectId);
  },
  async removeTask(projectId: string, taskId: string): Promise<Project> {
    await prisma.task.deleteMany({ where: { id: taskId, projectId } });
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
