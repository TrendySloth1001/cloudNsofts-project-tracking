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

/** Minimum length for a new account password. */
export const PASSWORD_MIN_LENGTH = 8;

/** Public self-service signup (open registration). */
export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .max(200),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(200),
});
export type SignupInput = z.infer<typeof signupSchema>;

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

/** The signed-in user's full, editable profile (returned by GET /auth/me). */
export interface UserProfile extends AuthUser {
  title: string;
  bio: string;
  skills: string[];
  location: string;
  timezone: string;
  githubUrl: string;
  websiteUrl: string;
  linkedinUrl: string;
}

export const PROFILE_BIO_MAX_LENGTH = 2000;
export const PROFILE_MAX_SKILLS = 40;

const profileText = (max: number) => z.string().trim().max(max);

/** Self-service profile update (PATCH /auth/me). Every field is optional; only
 *  the ones present are changed. Identity (email, role) is not editable here. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120).optional(),
  title: profileText(120).optional(),
  bio: profileText(PROFILE_BIO_MAX_LENGTH).optional(),
  skills: z
    .array(z.string().trim().min(1).max(40))
    .max(PROFILE_MAX_SKILLS)
    .optional(),
  location: profileText(120).optional(),
  timezone: profileText(60).optional(),
  githubUrl: profileText(200).optional(),
  websiteUrl: profileText(200).optional(),
  linkedinUrl: profileText(200).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/* ----------------------------- Access tokens ---------------------------- */

/** Access level a token grants: full read+write, or read-only (safe methods). */
export const apiTokenScopeSchema = z.enum(['full', 'read_only']);
export type ApiTokenScope = z.infer<typeof apiTokenScopeSchema>;

export const API_TOKEN_SCOPE_LABELS: Record<ApiTokenScope, string> = {
  full: 'Full access',
  read_only: 'Read only',
};

/** A Personal Access Token as listed to its owner (never includes the secret). */
export interface ApiTokenSummary {
  id: string;
  name: string;
  scope: ApiTokenScope;
  /** Project ids the token is limited to; empty = all the owner can access. */
  projectIds: string[];
  /** Whether the token may perform destructive (DELETE) operations. */
  canDelete: boolean;
  usageCount: number;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  scope: apiTokenScopeSchema.default('full'),
  /** Limit the token to these projects; omit/empty for all accessible ones. */
  projectIds: z.array(z.string().min(1)).default([]),
  /** Allow destructive (DELETE) operations. Off by default for safety. */
  canDelete: z.boolean().default(false),
  /** Optional lifetime in days; omit for a token that never expires. */
  expiresInDays: z.coerce.number().int().positive().max(365).optional(),
});
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;

/** Rename an existing token (the only mutable field). */
export const updateApiTokenSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
});
export type UpdateApiTokenInput = z.infer<typeof updateApiTokenSchema>;

/** Mint response — the plaintext token is returned exactly once, at creation. */
export interface CreatedApiToken {
  token: string;
  apiToken: ApiTokenSummary;
}

/** A recent action performed by a coding agent (PAT), for the owner's feed. */
export interface AgentActivity {
  id: string;
  kind: 'task_event' | 'message';
  agentName: string;
  projectId: string;
  projectName: string;
  /** Human summary of what happened (e.g. the event/message body). */
  summary: string;
  /** Where it happened — a task title or "#channel". */
  context: string;
  createdAt: string;
}

/* -------------------------------- Users --------------------------------- */

export const userRoleSchema = z.enum(['ADMIN', 'MEMBER', 'VIEWER', 'CLIENT']);
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

export const memberRoleSchema = z.enum([
  'admin',
  'manager',
  'member',
  'viewer',
]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  viewer: 'Viewer',
};

/**
 * A user's *effective role within a single project* — the authority for what
 * they can do there. `admin` is the global superuser; `client` is a project
 * client (read-only board, client channels only); `manager`/`member`/`viewer`
 * come from the caller's `ProjectMember.role`. Both sides derive capabilities
 * from this via {@link projectAbilities} — the single source for the matrix.
 */
export const projectRoleSchema = z.enum([
  'admin',
  'manager',
  'member',
  'viewer',
  'client',
]);
export type ProjectRole = z.infer<typeof projectRoleSchema>;

export interface ProjectAbilities {
  /** Create/edit/move tasks, comments, checklists, milestones. */
  canEditBoard: boolean;
  /** Add/remove members & clients and change member roles. */
  canManageTeam: boolean;
  /** Create/delete channels and manage channel membership. */
  canManageChannels: boolean;
  /** Edit the project's own settings (name, status, dates). */
  canEditProject: boolean;
  /** Delete the whole project. */
  canDeleteProject: boolean;
}

/** The permission matrix. Viewer < Member < Manager < Admin (Client is aside,
 *  read-only). Referenced by the backend (enforcement) and the frontend (UI
 *  gating) so the rules live in exactly one place. Whoever creates a project is
 *  its `admin` (owner) — only an admin can edit or delete the whole project;
 *  managers run the team/board/channels but can't delete it. The env platform
 *  super-admin is `admin` on every project. */
export function projectAbilities(role: ProjectRole): ProjectAbilities {
  const isAdmin = role === 'admin';
  const canManage = isAdmin || role === 'manager';
  return {
    canEditBoard: canManage || role === 'member',
    canManageTeam: canManage,
    canManageChannels: canManage,
    canEditProject: isAdmin,
    canDeleteProject: isAdmin,
  };
}

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
  /** Coding-agent name when performed via an agent (else null). */
  agentName: string | null;
  body: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** Members working this task (empty = unassigned). */
  assigneeIds: string[];
  /** Parent feature this task belongs to (null = ungrouped). */
  featureId: string | null;
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

/* -------------------------------- Features ------------------------------ */

export const featureStatusSchema = z.enum(['planned', 'active', 'shipped']);
export type FeatureStatus = z.infer<typeof featureStatusSchema>;
export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  shipped: 'Shipped',
};
export const FEATURE_STATUS_ORDER: readonly FeatureStatus[] = [
  'planned',
  'active',
  'shipped',
];

/** A unit of work that groups tasks — the parent of Tasks. */
export interface Feature {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  /** Members owning/driving this feature (empty = no owner). */
  ownerIds: string[];
  targetDate: string | null;
  /** Pinned features float to the top of the board. */
  pinned: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
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
  features: Feature[];
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

/** Change an existing member's project role (admin/manager only). */
export const updateMemberRoleSchema = z.object({
  role: memberRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

/* ------------------------------ Invitations ----------------------------- */

export const invitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'canceled',
]);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

/** An invitation of an email to a project. Shown both to the inviter (project
 *  team panel) and to the invitee (their pending-invitations popup). */
export interface Invitation {
  id: string;
  projectId: string;
  projectName: string;
  email: string;
  role: MemberRole;
  /** Display name of whoever sent the invite. */
  invitedBy: string;
  status: InvitationStatus;
  createdAt: string;
}

/** Invite an email to a project with a role (manager/admin). */
export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('A valid email is required')
    .max(200),
  role: memberRoleSchema.default('member'),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200),
  description: z.string().trim().max(2000).default(''),
  status: taskStatusSchema.default('todo'),
  priority: taskPrioritySchema.default('medium'),
  assigneeIds: z.array(z.string().min(1)).default([]),
  featureId: z.string().nullable().default(null),
  dueDate: z
    .string()
    .nullable()
    .default(null)
    .describe('Due date as YYYY-MM-DD (e.g. "2026-07-15"), or null to clear'),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/* --------------------------- Feature mutations -------------------------- */

export const createFeatureSchema = z.object({
  name: z.string().trim().min(1, 'Feature name is required').max(120),
  description: z.string().trim().max(2000).default(''),
  status: featureStatusSchema.default('planned'),
  ownerIds: z.array(z.string().min(1)).default([]),
  targetDate: z
    .string()
    .nullable()
    .default(null)
    .describe('Target date as YYYY-MM-DD (e.g. "2026-07-15"), or null to clear'),
});
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
// `pinned` lives only on update (a quick toggle), so the create/edit form never
// resets it.
export const updateFeatureSchema = createFeatureSchema.partial().extend({
  pinned: z.boolean().optional(),
  /** Optional optimistic-concurrency guard: the feature's last-known
   *  `updatedAt`. If it no longer matches, the update is rejected (409). */
  expectedUpdatedAt: z.string().optional(),
});
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;

/** Reorder swimlanes: the full, final ordering of the project's features;
 *  each feature is set to its index as the new position. */
export const reorderFeaturesSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});
export type ReorderFeaturesInput = z.infer<typeof reorderFeaturesSchema>;
export const updateTaskSchema = createTaskSchema.partial().extend({
  /** Optional optimistic-concurrency guard: the task's last-known `updatedAt`.
   *  If it no longer matches (someone else changed it), the update is
   *  rejected with a 409 so the caller can re-read and retry. */
  expectedUpdatedAt: z.string().optional(),
});
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

/** A task or feature shared into a channel message. */
export const messageAttachmentSchema = z.object({
  kind: z.enum(['task', 'feature']),
  id: z.string().min(1),
});
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;

export interface Message {
  id: string;
  author: string;
  /** Login email of the author (null on messages predating this field). */
  authorEmail: string | null;
  /** Coding-agent name when posted via an agent (else null). */
  agentName: string | null;
  body: string;
  /** Shared task/feature reference (null = plain text message). */
  attachment: MessageAttachment | null;
  createdAt: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  visibility: ChannelVisibility;
  messageCount: number;
  memberCount: number;
  createdAt: string;
  /** ISO time the conversation was last marked resolved, or null if open. */
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface ChannelWithMessages extends Channel {
  messages: Message[];
}

/** A participant in a channel (matched to a login by email). */
export interface ChannelMember {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export const addChannelMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  name: z.string().trim().min(1, 'Name is required').max(120),
});
export type AddChannelMemberInput = z.infer<typeof addChannelMemberSchema>;

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

/** Max length of a channel message / scheduled message body. */
export const MESSAGE_BODY_MAX_LENGTH = 4000;

export const postMessageSchema = z
  .object({
    body: z.string().trim().max(MESSAGE_BODY_MAX_LENGTH).default(''),
    attachment: messageAttachmentSchema.nullable().default(null),
  })
  .refine((v) => v.body.length > 0 || v.attachment !== null, {
    message: 'Message is required',
    path: ['body'],
  });
export type PostMessageInput = z.infer<typeof postMessageSchema>;

/* --------------------------- Scheduled messages ------------------------- */

export const scheduledMessageStatusSchema = z.enum([
  'pending',
  'sending',
  'sent',
  'canceled',
  'failed',
]);
export type ScheduledMessageStatus = z.infer<
  typeof scheduledMessageStatusSchema
>;

/** Queue a message to post later. `scheduledFor` is an ISO datetime (UTC). */
export const scheduleMessageSchema = z
  .object({
    body: z.string().trim().max(MESSAGE_BODY_MAX_LENGTH).default(''),
    attachment: messageAttachmentSchema.nullable().default(null),
    scheduledFor: z
      .string()
      .datetime({ message: 'Pick a valid date and time' }),
  })
  .refine((v) => v.body.length > 0 || v.attachment !== null, {
    message: 'Message is required',
    path: ['body'],
  })
  .refine((v) => new Date(v.scheduledFor).getTime() > Date.now(), {
    message: 'Schedule a time in the future',
    path: ['scheduledFor'],
  });
export type ScheduleMessageInput = z.infer<typeof scheduleMessageSchema>;

/** A pending/queued message as shown to its channel. */
export interface ScheduledMessage {
  id: string;
  channelId: string;
  author: string;
  agentName: string | null;
  body: string;
  attachment: MessageAttachment | null;
  scheduledFor: string;
  status: ScheduledMessageStatus;
  createdAt: string;
}

/** Longest a single `wait_for_reply` long-poll may block before returning. */
export const CHANNEL_WAIT_MAX_MS = 55_000;

/** Query for the long-poll wait endpoint. */
export const channelWaitQuerySchema = z.object({
  /** Only return activity strictly newer than this message id (the cursor). */
  after: z.string().trim().min(1).optional(),
  /** How long to hold the request before returning `timeout` (ms). */
  timeoutMs: z.coerce
    .number()
    .int()
    .min(1000)
    .max(CHANNEL_WAIT_MAX_MS)
    .default(25_000),
  /**
   * When true, never return `resolved` — only new replies. A persistent
   * responder uses this so it keeps answering new messages instead of getting
   * stuck on a resolve (which is always newer than the message cursor).
   */
  ignoreResolved: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});
export type ChannelWaitQuery = z.infer<typeof channelWaitQuerySchema>;

/** Why a `wait_for_reply` call returned. */
export const channelWaitStatusSchema = z.enum(['reply', 'resolved', 'timeout']);
export type ChannelWaitStatus = z.infer<typeof channelWaitStatusSchema>;

/**
 * Result of a wait: `reply` with the new messages (someone answered),
 * `resolved` when a human marked the conversation answered (stop the loop), or
 * `timeout` so the caller can re-arm. `cursor` is the newest message id seen.
 */
export interface ChannelWaitResult {
  status: ChannelWaitStatus;
  messages: Message[];
  resolvedBy: string | null;
  cursor: string | null;
}

/** Mark a channel conversation resolved (`true`) or reopen it (`false`). */
export const resolveChannelSchema = z.object({
  resolved: z.boolean().default(true),
});
export type ResolveChannelInput = z.infer<typeof resolveChannelSchema>;

/* --------------------------------- Docs --------------------------------- */

/** Longest a doc title / body may be. */
export const DOC_TITLE_MAX_LENGTH = 120;
export const DOC_BODY_MAX_LENGTH = 100_000;

/** A project documentation page (markdown body). */
export interface Doc {
  id: string;
  projectId: string;
  title: string;
  /** Markdown source, same wire format as messages. */
  body: string;
  position: number;
  /** Display name of the original author. */
  author: string;
  /** Display name of whoever last edited it, or null if never edited. */
  updatedBy: string | null;
  /** Name of the coding agent that last wrote it, when written via an agent. */
  agentName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight sidebar item — no body, since doc bodies can be large. */
export interface DocSummary {
  id: string;
  title: string;
  position: number;
  updatedBy: string | null;
  agentName: string | null;
  updatedAt: string;
}

export const createDocSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'A title is required')
    .max(DOC_TITLE_MAX_LENGTH),
  body: z.string().max(DOC_BODY_MAX_LENGTH).default(''),
});
export type CreateDocInput = z.infer<typeof createDocSchema>;

export const updateDocSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'A title is required')
      .max(DOC_TITLE_MAX_LENGTH),
    body: z.string().max(DOC_BODY_MAX_LENGTH),
  })
  .partial()
  .refine((v) => v.title !== undefined || v.body !== undefined, {
    message: 'Nothing to update',
  });
export type UpdateDocInput = z.infer<typeof updateDocSchema>;

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

/* ------------------------------- Realtime ------------------------------- */

/** Socket.IO event names — the single source shared by server and client. */
export const WS_EVENTS = {
  joinChannel: 'channel:join',
  leaveChannel: 'channel:leave',
  messageCreated: 'message:created',
  messageDeleted: 'message:deleted',
} as const;

/** Client → server: (un)subscribe to a channel's live message room. */
export const channelRoomSchema = z.object({
  projectId: z.string().min(1),
  channelId: z.string().min(1),
});
export type ChannelRoom = z.infer<typeof channelRoomSchema>;

/** Server → client: a new message landed in a watched channel. */
export interface MessageCreatedEvent {
  projectId: string;
  channelId: string;
  message: Message;
}

/** Server → client: a message was removed from a watched channel. */
export interface MessageDeletedEvent {
  projectId: string;
  channelId: string;
  messageId: string;
}

/** Ack returned to the client after a join attempt. */
export interface ChannelJoinAck {
  ok: boolean;
  error?: string;
}

/** Cursor pagination for a channel's message history (message ids as cursors).
 *  No cursor → newest `limit`; `after` → newer than it; `before` → older. */
export const listMessagesQuerySchema = z.object({
  before: z.string().optional(),
  after: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

/* ------------------------- Conversation search -------------------------- */

/** Search a project's conversations (channel messages + task threads) so an
 *  agent can find relevant context instead of ingesting whole threads. */
export const searchConversationsQuerySchema = z.object({
  q: z.string().trim().min(1, 'A search query is required').max(200),
  /** Restrict to one channel (messages only) instead of the whole project. */
  channelId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});
export type SearchConversationsQuery = z.infer<
  typeof searchConversationsQuerySchema
>;

/** A single full-text match, from either a channel message or a task thread. */
export interface ConversationSearchResult {
  id: string;
  kind: 'message' | 'task_event';
  /** Truncated body of the matched item. */
  snippet: string;
  author: string;
  agentName: string | null;
  createdAt: string;
  /** Where it lives — one locus is set depending on `kind`. */
  channelId: string | null;
  channelName: string | null;
  taskId: string | null;
  taskTitle: string | null;
}

/** A lightweight message preview (truncated body) for overviews/search. */
export interface MessagePreview {
  id: string;
  author: string;
  agentName: string | null;
  snippet: string;
  createdAt: string;
}

/** Cheap orientation for a channel — counts + endpoints + a few recents, so an
 *  agent can decide whether to read deeper before spending tokens. */
export interface ChannelOverview {
  channelId: string;
  name: string;
  messageCount: number;
  participants: string[];
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  recent: MessagePreview[];
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
  invitations: '/api/invitations',
} as const;

/** URL builders the frontend uses so no endpoint string is hardcoded. */
export const apiPaths = {
  health: () => API_ROUTES.health,
  auth: {
    login: () => `${API_ROUTES.auth}/login`,
    signup: () => `${API_ROUTES.auth}/signup`,
    me: () => `${API_ROUTES.auth}/me`,
    tokens: () => `${API_ROUTES.auth}/tokens`,
    token: (id: string) => `${API_ROUTES.auth}/tokens/${id}`,
    tokenRotate: (id: string) => `${API_ROUTES.auth}/tokens/${id}/rotate`,
    agentActivity: () => `${API_ROUTES.auth}/agent-activity`,
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
    features: (id: string) => `${API_ROUTES.projects}/${id}/features`,
    featuresReorder: (id: string) =>
      `${API_ROUTES.projects}/${id}/features/reorder`,
    feature: (id: string, featureId: string) =>
      `${API_ROUTES.projects}/${id}/features/${featureId}`,
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
    channelMessage: (id: string, channelId: string, messageId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/messages/${messageId}`,
    channelOverview: (id: string, channelId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/overview`,
    channelWait: (id: string, channelId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/wait`,
    channelResolve: (id: string, channelId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/resolve`,
    search: (id: string) => `${API_ROUTES.projects}/${id}/search`,
    channelScheduled: (id: string, channelId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/scheduled`,
    channelScheduledItem: (id: string, channelId: string, scheduledId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/scheduled/${scheduledId}`,
    channelMembers: (id: string, channelId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/members`,
    channelMember: (id: string, channelId: string, memberId: string) =>
      `${API_ROUTES.projects}/${id}/channels/${channelId}/members/${memberId}`,
    milestones: (id: string) => `${API_ROUTES.projects}/${id}/milestones`,
    milestone: (id: string, milestoneId: string) =>
      `${API_ROUTES.projects}/${id}/milestones/${milestoneId}`,
    docs: (id: string) => `${API_ROUTES.projects}/${id}/docs`,
    doc: (id: string, docId: string) =>
      `${API_ROUTES.projects}/${id}/docs/${docId}`,
    invitations: (id: string) => `${API_ROUTES.projects}/${id}/invitations`,
    invitation: (id: string, inviteId: string) =>
      `${API_ROUTES.projects}/${id}/invitations/${inviteId}`,
  },
  notifications: {
    list: () => API_ROUTES.notifications,
    read: (id: string) => `${API_ROUTES.notifications}/${id}/read`,
    readAll: () => `${API_ROUTES.notifications}/read-all`,
  },
  // The signed-in user's own pending invitations (accept / decline).
  invitations: {
    mine: () => API_ROUTES.invitations,
    accept: (id: string) => `${API_ROUTES.invitations}/${id}/accept`,
    decline: (id: string) => `${API_ROUTES.invitations}/${id}/decline`,
  },
} as const;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
  CLIENT: 'Client',
};
