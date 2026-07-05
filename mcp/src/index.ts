#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  apiPaths,
  createCommentSchema,
  createFeatureSchema,
  createSubtaskSchema,
  createTaskSchema,
  messageAttachmentSchema,
  taskStatusSchema,
  updateFeatureSchema,
  updateTaskSchema,
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

const projectId = z.string().min(1).describe('The project id');
const taskId = z.string().min(1).describe('The task id');
const featureId = z.string().min(1).describe('The feature id');
const channelId = z.string().min(1).describe('The channel id');

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
      'Full project detail: features (swimlanes), tasks, channels, members and clients. Use this to find the ids needed by the write tools.',
    inputSchema: { projectId },
  },
  ({ projectId }) => run(() => api.get(apiPaths.projects.detail(projectId))),
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
      run(() => api.post(apiPaths.projects.features(projectId), body)),
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
      run(() => api.patch(apiPaths.projects.feature(projectId, featureId), body)),
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
      run(() =>
        api.post(apiPaths.projects.featuresReorder(projectId), { orderedIds }),
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
      run(() => api.post(apiPaths.projects.tasks(projectId), body)),
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
      run(() => api.patch(apiPaths.projects.task(projectId, taskId), body)),
  );

  server.registerTool(
    'move_task',
    {
      title: 'Move task',
      description: 'Move a task to another status column on the board.',
      inputSchema: { projectId, taskId, status: taskStatusSchema },
    },
    ({ projectId, taskId, status }) =>
      run(() => api.patch(apiPaths.projects.task(projectId, taskId), { status })),
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
      run(() =>
        api.patch(apiPaths.projects.task(projectId, taskId), { assigneeIds }),
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
      run(() => api.post(apiPaths.projects.subtasks(projectId, taskId), body)),
  );

  server.registerTool(
    'comment_task',
    {
      title: 'Comment on task',
      description: 'Post a comment on a task thread.',
      inputSchema: { projectId, taskId, ...createCommentSchema.shape },
    },
    ({ projectId, taskId, ...body }) =>
      run(() => api.post(apiPaths.projects.comments(projectId, taskId), body)),
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
