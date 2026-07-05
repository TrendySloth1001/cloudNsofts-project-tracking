import {
  apiPaths,
  type AddClientInput,
  type AddMemberInput,
  type CreateCommentInput,
  type CreateFeatureInput,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type CreateSubtaskInput,
  type CreateTaskInput,
  type Project,
  type ReorderFeaturesInput,
  type ReorderTasksInput,
  type UpdateFeatureInput,
  type UpdateMemberRoleInput,
  type UpdateProjectInput,
  type UpdateSubtaskInput,
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
  updateMemberRole: (
    id: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ) => apiClient.patch<Project>(apiPaths.projects.member(id, memberId), input),
  removeMember: (id: string, memberId: string) =>
    apiClient.delete<Project>(apiPaths.projects.member(id, memberId)),

  addFeature: (id: string, input: CreateFeatureInput) =>
    apiClient.post<Project>(apiPaths.projects.features(id), input),
  updateFeature: (id: string, featureId: string, patch: UpdateFeatureInput) =>
    apiClient.patch<Project>(apiPaths.projects.feature(id, featureId), patch),
  removeFeature: (id: string, featureId: string) =>
    apiClient.delete<Project>(apiPaths.projects.feature(id, featureId)),
  reorderFeatures: (id: string, input: ReorderFeaturesInput) =>
    apiClient.patch<Project>(apiPaths.projects.featuresReorder(id), input),

  addTask: (id: string, input: CreateTaskInput) =>
    apiClient.post<Project>(apiPaths.projects.tasks(id), input),
  reorderTasks: (id: string, input: ReorderTasksInput) =>
    apiClient.patch<Project>(apiPaths.projects.tasksReorder(id), input),
  updateTask: (id: string, taskId: string, patch: UpdateTaskInput) =>
    apiClient.patch<Project>(apiPaths.projects.task(id, taskId), patch),
  removeTask: (id: string, taskId: string) =>
    apiClient.delete<Project>(apiPaths.projects.task(id, taskId)),

  addSubtask: (id: string, taskId: string, input: CreateSubtaskInput) =>
    apiClient.post<Project>(apiPaths.projects.subtasks(id, taskId), input),
  updateSubtask: (
    id: string,
    taskId: string,
    subtaskId: string,
    patch: UpdateSubtaskInput,
  ) =>
    apiClient.patch<Project>(
      apiPaths.projects.subtask(id, taskId, subtaskId),
      patch,
    ),
  removeSubtask: (id: string, taskId: string, subtaskId: string) =>
    apiClient.delete<Project>(apiPaths.projects.subtask(id, taskId, subtaskId)),

  addComment: (id: string, taskId: string, input: CreateCommentInput) =>
    apiClient.post<Project>(apiPaths.projects.comments(id, taskId), input),

  addMilestone: (id: string, input: CreateMilestoneInput) =>
    apiClient.post<Project>(apiPaths.projects.milestones(id), input),
  toggleMilestone: (id: string, milestoneId: string) =>
    apiClient.patch<Project>(apiPaths.projects.milestone(id, milestoneId), {}),
  removeMilestone: (id: string, milestoneId: string) =>
    apiClient.delete<Project>(apiPaths.projects.milestone(id, milestoneId)),
};
