#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  apiPaths,
  createChannelSchema,
  createCommentSchema,
  createFeatureSchema,
  createSubtaskSchema,
  createTaskSchema,
  messageAttachmentSchema,
  taskStatusSchema,
  updateFeatureSchema,
  updateTaskSchema,
  type Feature,
  type Project,
  type Task,
} from '@cnsofts/shared';
import { api } from './client.js';
import { config } from './config.js';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

/** Run a REST call and shape the outcome as an MCP tool result. */
async function run(work: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await work();
    const text =
      typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return { content: [{ type: 'text', text: text || 'Done.' }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
}

/* ---- Lean projections: the API returns the full project (with all event
   history) on every write; agents only need the shape below, which keeps tool
   output small and cheap. Use get_task for a single task's full detail. ---- */

function compactTask(t: Task) {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    featureId: t.featureId,
    assigneeIds: t.assigneeIds,
    dueDate: t.dueDate,
    subtaskCount: t.subtasks.length,
    doneSubtasks: t.subtasks.filter((s) => s.done).length,
    commentCount: t.events.filter((e) => e.kind === 'comment').length,
    // For optimistic concurrency: pass this back as expectedUpdatedAt on update.
    updatedAt: t.updatedAt,
  };
}

function compactProject(p: Project) {
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    members: p.members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
    features: p.features.map((f) => ({
      id: f.id,
      name: f.name,
      status: f.status,
      pinned: f.pinned,
      ownerIds: f.ownerIds,
      targetDate: f.targetDate,
      taskCount: p.tasks.filter((t) => t.featureId === f.id).length,
      updatedAt: f.updatedAt,
    })),
    tasks: p.tasks.map(compactTask),
  };
}

function findTask(p: Project, taskId: string): Task {
  const t = p.tasks.find((x) => x.id === taskId);
  if (!t) throw new Error(`Task ${taskId} not found in project`);
  return t;
}

function findFeature(p: Project, featureId: string): Feature {
  const f = p.features.find((x) => x.id === featureId);
  if (!f) throw new Error(`Feature ${featureId} not found in project`);
  return f;
}

/** Run a project-returning write and reply with the compact board. */
const runBoard = (work: () => Promise<Project>): Promise<ToolResult> =>
  run(async () => compactProject(await work()));

const projectId = z.string().min(1).describe('The project id');
const taskId = z.string().min(1).describe('The task id');
const featureId = z.string().min(1).describe('The feature id');
const channelId = z.string().min(1).describe('The channel id');
const subtaskId = z.string().min(1).describe('The subtask id');

const server = new McpServer(
  { name: 'cnsofts', version: '0.1.0' },
  {
    instructions: [
      'CloudNSofts project tracker — manage kanban boards and discussion channels.',
      '',
      'ALWAYS read before you write. Never invent ids or assume current state:',
      '  1. Call `list_projects` to find the project id.',
      '  2. Call `get_project` for its features, tasks, members and clients — take',
      '     every featureId / taskId / assigneeId (member id) from that response.',
      '  3. Call `list_channels` before `post_message` to get the channel id.',
      'Only reference features, tasks, members, or channels that a read tool has',
      'actually returned. If something you expected is missing, re-read rather than',
      'guessing. When updating, read the item first so you preserve fields you are',
      'not intentionally changing.',
    ].join('\n'),
  },
);

/* -------------------------------- Reads --------------------------------- */

server.registerTool(
  'list_projects',
  {
    title: 'List projects',
    description:
      'List every project the connected account can access (id, name, status).',
    inputSchema: {},
  },
  () => run(() => api.get(apiPaths.projects.list())),
);

server.registerTool(
  'get_project',
  {
    title: 'Get project',
    description:
      'Project board: features (swimlanes) and a compact list of tasks, plus members. Use this to find the ids the write tools need. For one task’s full detail (subtasks, comments, activity) use get_task.',
    inputSchema: { projectId },
  },
  ({ projectId }) =>
    run(async () =>
      compactProject(await api.get<Project>(apiPaths.projects.detail(projectId))),
    ),
);

server.registerTool(
  'get_task',
  {
    title: 'Get task',
    description:
      "One task's full detail: description, subtasks (with ids), and the comment/activity thread.",
    inputSchema: { projectId, taskId },
  },
  ({ projectId, taskId }) =>
    run(async () =>
      findTask(await api.get<Project>(apiPaths.projects.detail(projectId)), taskId),
    ),
);

server.registerTool(
  'list_tasks',
  {
    title: 'List tasks',
    description:
      'List a project’s tasks (compact), optionally filtered by status, feature, or assignee (member id).',
    inputSchema: {
      projectId,
      status: taskStatusSchema.optional(),
      featureId: z.string().optional().describe('Filter to one feature'),
      assigneeId: z.string().optional().describe('Filter to one member id'),
    },
  },
  ({ projectId, status, featureId, assigneeId }) =>
    run(async () => {
      const p = await api.get<Project>(apiPaths.projects.detail(projectId));
      let tasks = p.tasks;
      if (status) tasks = tasks.filter((t) => t.status === status);
      if (featureId) tasks = tasks.filter((t) => t.featureId === featureId);
      if (assigneeId)
        tasks = tasks.filter((t) => t.assigneeIds.includes(assigneeId));
      return tasks.map(compactTask);
    }),
);

server.registerTool(
  'list_channels',
  {
    title: 'List channels',
    description: 'List the discussion channels of a project.',
    inputSchema: { projectId },
  },
  ({ projectId }) => run(() => api.get(apiPaths.projects.channels(projectId))),
);

server.registerTool(
  'read_channel',
  {
    title: 'Read channel messages',
    description:
      'Read recent messages in a discussion channel (call list_channels first for the channelId). Use this to catch up on a conversation before replying.',
    inputSchema: { projectId, channelId },
  },
  ({ projectId, channelId }) =>
    run(() =>
      api.get(apiPaths.projects.channelMessages(projectId, channelId)),
    ),
);

/* -------------------------------- Writes -------------------------------- */

if (!config.readOnly) {
  server.registerTool(
    'create_feature',
    {
      title: 'Create feature',
      description: 'Create a feature (kanban swimlane) in a project.',
      inputSchema: { projectId, ...createFeatureSchema.shape },
    },
    ({ projectId, ...body }) =>
      runBoard(() => api.post<Project>(apiPaths.projects.features(projectId), body)),
  );

  server.registerTool(
    'update_feature',
    {
      title: 'Update feature',
      description:
        'Update a feature — name, description, status, owners, target date, or pinned.',
      inputSchema: { projectId, featureId, ...updateFeatureSchema.shape },
    },
    ({ projectId, featureId, ...body }) =>
      run(async () =>
        findFeature(
          await api.patch<Project>(
            apiPaths.projects.feature(projectId, featureId),
            body,
          ),
          featureId,
        ),
      ),
  );

  server.registerTool(
    'reorder_features',
    {
      title: 'Reorder features',
      description:
        'Set the swimlane order. Pass the full, final list of feature ids in the desired order.',
      inputSchema: {
        projectId,
        orderedIds: z.array(z.string().min(1)).describe('Feature ids, in order'),
      },
    },
    ({ projectId, orderedIds }) =>
      runBoard(() =>
        api.post<Project>(apiPaths.projects.featuresReorder(projectId), {
          orderedIds,
        }),
      ),
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description:
        'Create a task on the board. First call get_project to get valid featureId (swimlane) and assigneeIds (member ids) — do not invent them.',
      inputSchema: { projectId, ...createTaskSchema.shape },
    },
    ({ projectId, ...body }) =>
      runBoard(() => api.post<Project>(apiPaths.projects.tasks(projectId), body)),
  );

  server.registerTool(
    'update_task',
    {
      title: 'Update task',
      description:
        'Update task fields (title, description, status, priority, assigneeIds, featureId, dueDate). Read the task via get_project first so you only change what you intend. Only fields you pass are changed.',
      inputSchema: { projectId, taskId, ...updateTaskSchema.shape },
    },
    ({ projectId, taskId, ...body }) =>
      run(async () =>
        findTask(
          await api.patch<Project>(apiPaths.projects.task(projectId, taskId), body),
          taskId,
        ),
      ),
  );

  server.registerTool(
    'move_task',
    {
      title: 'Move task',
      description: 'Move a task to another status column on the board.',
      inputSchema: { projectId, taskId, status: taskStatusSchema },
    },
    ({ projectId, taskId, status }) =>
      run(async () =>
        findTask(
          await api.patch<Project>(apiPaths.projects.task(projectId, taskId), {
            status,
          }),
          taskId,
        ),
      ),
  );

  server.registerTool(
    'assign_task',
    {
      title: 'Assign task',
      description:
        'Set the members assigned to a task. Pass the full list of member ids (empty to unassign).',
      inputSchema: {
        projectId,
        taskId,
        assigneeIds: z
          .array(z.string().min(1))
          .describe('Project member ids to assign'),
      },
    },
    ({ projectId, taskId, assigneeIds }) =>
      run(async () =>
        findTask(
          await api.patch<Project>(apiPaths.projects.task(projectId, taskId), {
            assigneeIds,
          }),
          taskId,
        ),
      ),
  );

  server.registerTool(
    'add_subtask',
    {
      title: 'Add subtask',
      description: 'Add a checklist subtask to a task.',
      inputSchema: { projectId, taskId, ...createSubtaskSchema.shape },
    },
    ({ projectId, taskId, ...body }) =>
      run(async () =>
        findTask(
          await api.post<Project>(
            apiPaths.projects.subtasks(projectId, taskId),
            body,
          ),
          taskId,
        ),
      ),
  );

  server.registerTool(
    'toggle_subtask',
    {
      title: 'Update subtask',
      description:
        'Check off (or rename) a checklist subtask. Get the subtaskId from get_project (task.subtasks). Pass done and/or title.',
      inputSchema: {
        projectId,
        taskId,
        subtaskId,
        done: z.boolean().optional().describe('Mark done/undone'),
        title: z.string().min(1).max(200).optional().describe('Rename it'),
      },
    },
    ({ projectId, taskId, subtaskId, ...body }) =>
      run(async () =>
        findTask(
          await api.patch<Project>(
            apiPaths.projects.subtask(projectId, taskId, subtaskId),
            body,
          ),
          taskId,
        ),
      ),
  );

  server.registerTool(
    'create_channel',
    {
      title: 'Create channel',
      description:
        'Create a discussion channel. visibility "internal" = team-only, "client" = shared with clients.',
      inputSchema: { projectId, ...createChannelSchema.shape },
    },
    ({ projectId, ...body }) =>
      run(() => api.post(apiPaths.projects.channels(projectId), body)),
  );

  server.registerTool(
    'comment_task',
    {
      title: 'Comment on task',
      description: 'Post a comment on a task thread.',
      inputSchema: { projectId, taskId, ...createCommentSchema.shape },
    },
    ({ projectId, taskId, ...body }) =>
      run(async () =>
        findTask(
          await api.post<Project>(
            apiPaths.projects.comments(projectId, taskId),
            body,
          ),
          taskId,
        ),
      ),
  );

  server.registerTool(
    'post_message',
    {
      title: 'Post channel message',
      description:
        'Post a message to a discussion channel. Call list_channels first for the channelId; if attaching, use a real task/feature id from get_project.',
      inputSchema: {
        projectId,
        channelId,
        body: z.string().max(4000).optional().describe('Message text'),
        attachment: messageAttachmentSchema
          .nullable()
          .optional()
          .describe('Optional { kind: "task"|"feature", id } to share'),
      },
    },
    ({ projectId, channelId, ...body }) =>
      run(() =>
        api.post(apiPaths.projects.channelMessages(projectId, channelId), body),
      ),
  );

  if (config.allowDelete) {
    server.registerTool(
      'delete_task',
      {
        title: 'Delete task',
        description: 'Permanently delete a task.',
        inputSchema: { projectId, taskId },
      },
      ({ projectId, taskId }) =>
        run(async () => {
          await api.delete(apiPaths.projects.task(projectId, taskId));
          return 'Task deleted.';
        }),
    );

    server.registerTool(
      'delete_feature',
      {
        title: 'Delete feature',
        description: 'Permanently delete a feature (its tasks are unlinked).',
        inputSchema: { projectId, featureId },
      },
      ({ projectId, featureId }) =>
        run(async () => {
          await api.delete(apiPaths.projects.feature(projectId, featureId));
          return 'Feature deleted.';
        }),
    );
  }
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  const mode = config.readOnly ? 'read-only' : 'read-write';
  console.error(`[cnsofts-mcp] connected (${mode}) → ${config.apiUrl}`);
}

main().catch((err) => {
  console.error('[cnsofts-mcp] fatal:', err);
  process.exit(1);
});
