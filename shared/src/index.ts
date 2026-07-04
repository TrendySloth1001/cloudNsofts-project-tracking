import { z } from 'zod';

/**
 * Shared types & schemas — the single source of truth for both the backend
 * (runtime validation with Zod) and the frontend (derived TypeScript types).
 */

/* --------------------------------- Auth --------------------------------- */

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** The authenticated principal returned by the auth endpoints. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/** Response from a successful login. */
export interface AuthResponse {
  token: string;
  user: AuthUser;
}

/* -------------------------------- Users --------------------------------- */

export const userRoleSchema = z.enum(['ADMIN', 'MEMBER', 'VIEWER']);
export type UserRole = z.infer<typeof userRoleSchema>;

/** A user as returned by the API (dates serialized to ISO strings). */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export const createUserSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .max(200),
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: userRoleSchema.default('MEMBER'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema.partial();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/* ------------------------------- Projects ------------------------------- */

export const projectStatusSchema = z.enum([
  'planning',
  'active',
  'on_hold',
  'completed',
]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
};

export const memberRoleSchema = z.enum(['manager', 'member', 'viewer']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
};

export interface ProjectClient {
  id: string;
  name: string;
  email: string;
  company?: string;
}

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
}

export const taskStatusSchema = z.enum([
  'todo',
  'in_progress',
  'in_review',
  'done',
]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
};
export const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'in_review',
  'done',
];

export const taskPrioritySchema = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/** A task's thread entry — either a user comment or a system activity note. */
export const taskEventKindSchema = z.enum(['comment', 'activity']);
export type TaskEventKind = z.infer<typeof taskEventKindSchema>;

export interface TaskEvent {
  id: string;
  kind: TaskEventKind;
  author: string;
  body: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  subtasks: Subtask[];
  events: TaskEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  dueDate: string | null;
  done: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  clients: ProjectClient[];
  members: ProjectMember[];
  tasks: Task[];
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(120),
  description: z.string().trim().max(2000).default(''),
  status: projectStatusSchema.default('planning'),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const addClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('A valid email is required').max(200),
  company: z.string().trim().max(120).optional(),
});
export type AddClientInput = z.infer<typeof addClientSchema>;

export const addMemberSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('A valid email is required').max(200),
  role: memberRoleSchema.default('member'),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200),
  description: z.string().trim().max(2000).default(''),
  status: taskStatusSchema.default('todo'),
  priority: taskPrioritySchema.default('medium'),
  assigneeId: z.string().nullable().default(null),
  dueDate: z.string().nullable().default(null),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export const updateTaskSchema = createTaskSchema.partial();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Reorder (and optionally move) tasks within a status column. `orderedIds` is
 *  the full, final ordering of that column; each task is set to `status` and to
 *  its index as the new position. */
export const reorderTasksSchema = z.object({
  status: taskStatusSchema,
  orderedIds: z.array(z.string().min(1)),
});
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;

/* ------------------------------- Subtasks ------------------------------- */

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Subtask is required').max(200),
});
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;

export const updateSubtaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    done: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.done !== undefined, {
    message: 'Nothing to update',
  });
export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;

/* ------------------------------- Comments ------------------------------- */

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment').max(2000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

/* ----------------------------- Discussions ------------------------------ */

/** Channel visibility: `internal` = team-only, `client` = shared with clients. */
export const channelVisibilitySchema = z.enum(['internal', 'client']);
export type ChannelVisibility = z.infer<typeof channelVisibilitySchema>;

export const CHANNEL_VISIBILITY_LABELS: Record<ChannelVisibility, string> = {
  internal: 'Internal',
  client: 'Client',
};

/** Slack-style channel slug: lowercase, hyphenated, alphanumeric. */
export function channelSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface Message {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  visibility: ChannelVisibility;
  messageCount: number;
  createdAt: string;
}

export interface ChannelWithMessages extends Channel {
  messages: Message[];
}

export const createChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Channel name is required')
    .max(80)
    .transform(channelSlug)
    .refine((v) => v.length > 0, 'Use letters or numbers'),
  description: z.string().trim().max(280).default(''),
  visibility: channelVisibilitySchema.default('internal'),
});
export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const postMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message is required').max(4000),
});
export type PostMessageInput = z.infer<typeof postMessageSchema>;

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  dueDate: z.string().nullable().default(null),
});
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  status: projectStatusSchema.optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/* ------------------------------ Notifications --------------------------- */

export const notificationKindSchema = z.enum([
  'task_created',
  'task_completed',
  'comment_added',
  'message_posted',
  'member_added',
  'system',
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Optional deep-link target so the UI can open the related project. */
  projectId: string | null;
  read: boolean;
  createdAt: string;
}

/** GET /notifications payload — the feed plus the unread tally in one call. */
export interface NotificationList {
  items: Notification[];
  unread: number;
}

/* ----------------------------- API responses ---------------------------- */

/** Shape of every error response returned by the API. */
export interface ApiError {
  error: {
    message: string;
    details?: unknown;
  };
}

/* ------------------------- API routes (single source) -------------------- */

/**
 * Base mount paths for each API area. The backend mounts its routers at these
 * paths and the frontend builds request URLs from them — so a path only ever
 * lives in one place.
 */
export const API_ROUTES = {
  health: '/health',
  auth: '/api/auth',
  users: '/api/users',
  projects: '/api/projects',
  notifications: '/api/notifications',
} as const;

/** URL builders the frontend uses so no endpoint string is hardcoded. */
export const apiPaths = {
  health: () => API_ROUTES.health,
  auth: {
    login: () => `${API_ROUTES.auth}/login`,
    me: () => `${API_ROUTES.auth}/me`,
  },
  users: {
    list: () => API_ROUTES.users,
    create: () => API_ROUTES.users,
    detail: (id: string) => `${API_ROUTES.users}/${id}`,
  },
  projects: {
    list: () => API_ROUTES.projects,
    create: () => API_ROUTES.projects,
    detail: (id: string) => `${API_ROUTES.projects}/${id}`,
    clients: (id: string) => `${API_ROUTES.projects}/${id}/clients`,
    client: (id: string, clientId: string) =>
      `${API_ROUTES.projects}/${id}/clients/${clientId}`,
    members: (id: string) => `${API_ROUTES.projects}/${id}/members`,
    member: (id: string, memberId: string) =>
      `${API_ROUTES.projects}/${id}/members/${memberId}`,
    tasks: (id: string) => `${API_ROUTES.projects}/${id}/tasks`,
    tasksReorder: (id: string) => `${API_ROUTES.projects}/${id}/tasks/reorder`,
    task: (id: string, taskId: string) =>
      `${API_ROUTES.projects}/${id}/tasks/${taskId}`,
    subtasks: (id: string, taskId: string) =>
      `${API_ROUTES.projects}/${id}/tasks/${taskId}/subtasks`,
    subtask: (id: string, taskId: string, subtaskId: string) =>
      `${API_ROUTES.projects}/${id}/tasks/${taskId}/subtasks/${subtaskId}`,
    comments: (id: string, taskId: string) =>
      `${API_ROUTES.projects}/${id}/tasks/${taskId}/comments`,
    channels: (id: string) => `${API_ROUTES.projects}/${id}/channels`,
    channel: (id: string, channelId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}`,
    channelMessages: (id: string, channelId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/messages`,
    milestones: (id: string) => `${API_ROUTES.projects}/${id}/milestones`,
    milestone: (id: string, milestoneId: string) =>
      `${API_ROUTES.projects}/${id}/milestones/${milestoneId}`,
  },
  notifications: {
    list: () => API_ROUTES.notifications,
    read: (id: string) => `${API_ROUTES.notifications}/${id}/read`,
    readAll: () => `${API_ROUTES.notifications}/read-all`,
  },
} as const;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};
