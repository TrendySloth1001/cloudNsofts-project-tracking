import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  AddClientInput,
  AddMemberInput,
  CreateCommentInput,
  CreateFeatureInput,
  CreateSubtaskInput,
  CreateTaskInput,
  ReorderFeaturesInput,
  ReorderMilestonesInput,
  ReorderTasksInput,
  UpdateFeatureInput,
  UpdateMemberRoleInput,
  UpdateMilestoneInput,
  UpdateSubtaskInput,
  UpdateTaskInput,
  CreateMilestoneInput,
} from '@cnsofts/shared';
import { projectsApi } from './projects.api';

/**
 * In-memory cache over the projects API. Reads come from the cache (kept in
 * sync via `useSyncExternalStore`); every mutation calls the backend and then
 * replaces the affected project with the server's response.
 *
 * All project data is persisted in Postgres — nothing is stored client-side.
 */
export type StoreStatus = 'idle' | 'loading' | 'ready' | 'error';

const EMPTY: Project[] = [];
const IDLE: StoreStatus = 'idle';

let projects: Project[] = EMPTY;
let status: StoreStatus = 'idle';
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

async function load(): Promise<void> {
  status = 'loading';
  emit();
  try {
    projects = await projectsApi.list();
    status = 'ready';
  } catch {
    status = 'error';
  }
  emit();
}

/** Insert or replace a project in the cache and notify subscribers. */
function replace(updated: Project): Project {
  projects = projects.some((p) => p.id === updated.id)
    ? projects.map((p) => (p.id === updated.id ? updated : p))
    : [updated, ...projects];
  emit();
  return updated;
}
function drop(id: string): void {
  projects = projects.filter((p) => p.id !== id);
  emit();
}

export const projectStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): Project[] => projects,
  getServerSnapshot: (): Project[] => EMPTY,
  getStatus: (): StoreStatus => status,
  getServerStatus: (): StoreStatus => IDLE,

  /** Kick off the initial load once. */
  ensureLoaded(): void {
    if (status === 'idle') void load();
  },
  reload: (): Promise<void> => load(),

  get: (id: string): Project | undefined => projects.find((p) => p.id === id),

  async create(input: CreateProjectInput): Promise<Project> {
    return replace(await projectsApi.create(input));
  },
  async updateProject(id: string, patch: UpdateProjectInput): Promise<Project> {
    return replace(await projectsApi.update(id, patch));
  },
  async remove(id: string): Promise<void> {
    await projectsApi.remove(id);
    drop(id);
  },

  async addClient(id: string, input: AddClientInput): Promise<Project> {
    return replace(await projectsApi.addClient(id, input));
  },
  async removeClient(id: string, clientId: string): Promise<Project> {
    return replace(await projectsApi.removeClient(id, clientId));
  },

  async addMember(id: string, input: AddMemberInput): Promise<Project> {
    return replace(await projectsApi.addMember(id, input));
  },
  async updateMemberRole(
    id: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<Project> {
    return replace(await projectsApi.updateMemberRole(id, memberId, input));
  },
  async removeMember(id: string, memberId: string): Promise<Project> {
    return replace(await projectsApi.removeMember(id, memberId));
  },

  async addFeature(id: string, input: CreateFeatureInput): Promise<Project> {
    return replace(await projectsApi.addFeature(id, input));
  },
  async updateFeature(
    id: string,
    featureId: string,
    patch: UpdateFeatureInput,
  ): Promise<Project> {
    return replace(await projectsApi.updateFeature(id, featureId, patch));
  },
  async removeFeature(id: string, featureId: string): Promise<Project> {
    return replace(await projectsApi.removeFeature(id, featureId));
  },
  async reorderFeatures(
    id: string,
    input: ReorderFeaturesInput,
  ): Promise<Project> {
    return replace(await projectsApi.reorderFeatures(id, input));
  },

  async addTask(id: string, input: CreateTaskInput): Promise<Project> {
    return replace(await projectsApi.addTask(id, input));
  },
  async updateTask(
    id: string,
    taskId: string,
    patch: UpdateTaskInput,
  ): Promise<Project> {
    return replace(await projectsApi.updateTask(id, taskId, patch));
  },
  async removeTask(id: string, taskId: string): Promise<Project> {
    return replace(await projectsApi.removeTask(id, taskId));
  },
  async reorderTasks(id: string, input: ReorderTasksInput): Promise<Project> {
    return replace(await projectsApi.reorderTasks(id, input));
  },

  async addSubtask(
    id: string,
    taskId: string,
    input: CreateSubtaskInput,
  ): Promise<Project> {
    return replace(await projectsApi.addSubtask(id, taskId, input));
  },
  async updateSubtask(
    id: string,
    taskId: string,
    subtaskId: string,
    patch: UpdateSubtaskInput,
  ): Promise<Project> {
    return replace(await projectsApi.updateSubtask(id, taskId, subtaskId, patch));
  },
  async removeSubtask(
    id: string,
    taskId: string,
    subtaskId: string,
  ): Promise<Project> {
    return replace(await projectsApi.removeSubtask(id, taskId, subtaskId));
  },

  async addComment(
    id: string,
    taskId: string,
    input: CreateCommentInput,
  ): Promise<Project> {
    return replace(await projectsApi.addComment(id, taskId, input));
  },

  async addMilestone(
    id: string,
    input: CreateMilestoneInput,
  ): Promise<Project> {
    return replace(await projectsApi.addMilestone(id, input));
  },
  async updateMilestone(
    id: string,
    milestoneId: string,
    patch: UpdateMilestoneInput,
  ): Promise<Project> {
    return replace(await projectsApi.updateMilestone(id, milestoneId, patch));
  },
  async reorderMilestones(
    id: string,
    input: ReorderMilestonesInput,
  ): Promise<Project> {
    return replace(await projectsApi.reorderMilestones(id, input));
  },
  async removeMilestone(id: string, milestoneId: string): Promise<Project> {
    return replace(await projectsApi.removeMilestone(id, milestoneId));
  },
};
