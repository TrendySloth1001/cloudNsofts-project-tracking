import {
  apiPaths,
  type AddClientInput,
  type AddMemberInput,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type CreateTaskInput,
  type Project,
  type UpdateProjectInput,
  type UpdateTaskInput,
} from '@cnsofts/shared';
import { apiClient } from '@/lib/api-client';

/** Typed data-access for the projects domain. Every mutation returns the full
 *  updated project so the cache can be replaced in one step. */
export const projectsApi = {
  list: () => apiClient.get<Project[]>(apiPaths.projects.list()),
  get: (id: string) => apiClient.get<Project>(apiPaths.projects.detail(id)),
  create: (input: CreateProjectInput) =>
    apiClient.post<Project>(apiPaths.projects.create(), input),
  update: (id: string, input: UpdateProjectInput) =>
    apiClient.patch<Project>(apiPaths.projects.detail(id), input),
  remove: (id: string) =>
    apiClient.delete<void>(apiPaths.projects.detail(id)),

  addClient: (id: string, input: AddClientInput) =>
    apiClient.post<Project>(apiPaths.projects.clients(id), input),
  removeClient: (id: string, clientId: string) =>
    apiClient.delete<Project>(apiPaths.projects.client(id, clientId)),

  addMember: (id: string, input: AddMemberInput) =>
    apiClient.post<Project>(apiPaths.projects.members(id), input),
  removeMember: (id: string, memberId: string) =>
    apiClient.delete<Project>(apiPaths.projects.member(id, memberId)),

  addTask: (id: string, input: CreateTaskInput) =>
    apiClient.post<Project>(apiPaths.projects.tasks(id), input),
  updateTask: (id: string, taskId: string, patch: UpdateTaskInput) =>
    apiClient.patch<Project>(apiPaths.projects.task(id, taskId), patch),
  removeTask: (id: string, taskId: string) =>
    apiClient.delete<Project>(apiPaths.projects.task(id, taskId)),

  addMilestone: (id: string, input: CreateMilestoneInput) =>
    apiClient.post<Project>(apiPaths.projects.milestones(id), input),
  toggleMilestone: (id: string, milestoneId: string) =>
    apiClient.patch<Project>(apiPaths.projects.milestone(id, milestoneId), {}),
  removeMilestone: (id: string, milestoneId: string) =>
    apiClient.delete<Project>(apiPaths.projects.milestone(id, milestoneId)),
};
