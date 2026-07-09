#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  apiPaths,
  createChannelSchema,
  createCommentSchema,
  createDocSchema,
  createFeatureSchema,
  createSubtaskSchema,
  createTaskSchema,
  messageAttachmentSchema,
  reorderTasksSchema,
  taskStatusSchema,
  updateFeatureSchema,
  updateTaskSchema,
  type Feature,
  type Message,
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

/** Truncate a message for a channel page — full body via get_message. */
function leanMessage(m: Message) {
  const MAX = 240;
  const truncated = m.body.length > MAX;
  return {
    id: m.id,
    author: m.author,
    agentName: m.agentName,
    time: m.createdAt,
    body: truncated ? `${m.body.slice(0, MAX).trimEnd()}…` : m.body,
    ...(truncated ? { truncated: true } : {}),
    ...(m.attachment ? { attachment: m.attachment } : {}),
  };
}

function compactFeature(p: Project, f: Feature) {
  return {
    id: f.id,
    name: f.name,
    status: f.status,
    pinned: f.pinned,
    ownerIds: f.ownerIds,
    targetDate: f.targetDate,
    taskCount: p.tasks.filter((t) => t.featureId === f.id).length,
    updatedAt: f.updatedAt,
  };
}

/** The most-recently-touched item — used to pick the just-created entity out of
 *  the full project a write returns (ISO timestamps sort lexicographically). */
function newest<T extends { updatedAt: string }>(items: T[]): T {
  return items.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
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

const projectId = z.string().min(1).describe('The project id');
const taskId = z.string().min(1).describe('The task id');
const featureId = z.string().min(1).describe('The feature id');
const channelId = z.string().min(1).describe('The channel id');
const subtaskId = z.string().min(1).describe('The subtask id');
const docId = z.string().min(1).describe('The doc id');

// Message and comment bodies are stored verbatim and rendered as GitHub-
// flavored markdown on the web app, so the agent can format its updates.
const MARKDOWN_HINT =
  'Rendered as GitHub-flavored markdown — use **bold**, _italic_, `code`, ' +
  '`- ` lists, `> ` quotes and [links](url). For code or structured data ' +
  '(JSON, etc.) use a fenced block that OPENS with a language tag and keeps ' +
  'real indentation, e.g. ```json\\n{\\n  "a": 1\\n}\\n``` — do NOT escape ' +
  'characters, add trailing backslashes, or flatten indentation. Raw HTML is ignored.';

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
      '',
      'CONVERSATIONS get long — reading a whole channel is slow and expensive.',
      'Read like a human:',
      '  • `get_channel_overview` first — counts, participants, last few previews.',
      '  • `search_conversations` to find where a topic was discussed (searches',
      '    channel messages AND task threads) instead of reading everything.',
      '  • `read_channel` returns a small recent page with `nextCursor`; pass it as',
      '    `before` to load older messages ONLY when you actually need them.',
      '  • `get_message` fetches one full message when a preview was truncated.',
      '',
      'When you post a message, keep it SHORT. Do the work on the board and post a',
      'one- or two-line update that points to it — never paste task lists, status',
      'reports, or plans into chat; that content belongs on the board, not the',
      'conversation.',
      '',
      'DOCS — a project has documentation pages (list_docs / get_doc / create_doc /',
      'update_doc). This is where durable knowledge lives: architecture, onboarding,',
      'decisions, a running status overview. When asked to "write it up", "document",',
      'or leave a proper page for the team, put it in a doc — not a chat message.',
      'Read the doc (get_doc) before update_doc; the body you send REPLACES the old.',
      '',
      'LIVE loop — ONLY for an ACTIVE back-and-forth: someone is at the keyboard',
      'and a reply is expected within minutes. It is NOT a background watch — every',
      'wake re-reads the whole conversation and costs tokens, so idle-watching is',
      'expensive. When you are in an active exchange:',
      '  1. post_message with your question or update.',
      '  2. wait_for_reply(channelId, afterMessageId: <cursor>, timeoutSeconds: 30)',
      '     — it BLOCKS server-side (free while blocked) until someone replies, the',
      '     thread is resolved, or it times out.',
      '  3. "reply": act on it, post_message back, wait_for_reply again with cursor.',
      '  4. "timeout": call wait_for_reply again — but at most 3–4 times in a row.',
      '  5. "resolved": STOP — post a short closing note and end.',
      '  COST CAP (important): do NOT watch indefinitely. After ~3–4 consecutive',
      '  timeouts (~2 min of silence) the person has stepped away — post a short',
      '  "ping me when you\'re back" and STOP. NEVER schedule repeated wakeups or',
      '  re-invoke yourself to keep a watch alive; let the person re-engage you.',
      '',
      `Message and task-comment bodies: ${MARKDOWN_HINT}`,
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
  'get_channel_overview',
  {
    title: 'Channel overview',
    description:
      'Cheap orientation for a channel: message count, participants, first/last activity, and the last few message previews. Call this before read_channel to decide whether you even need to read more.',
    inputSchema: { projectId, channelId },
  },
  ({ projectId, channelId }) =>
    run(() => api.get(apiPaths.projects.channelOverview(projectId, channelId))),
);

server.registerTool(
  'search_conversations',
  {
    title: 'Search conversations',
    description:
      'Full-text search a project’s conversations — channel messages AND task threads — for a query. Returns the top ranked matches as short snippets with their location (channel or task). Use this to find context instead of reading whole channels.',
    inputSchema: {
      projectId,
      query: z.string().min(1).describe('What to search for'),
      channelId: z
        .string()
        .optional()
        .describe('Restrict to one channel (messages only)'),
      limit: z.coerce.number().int().min(1).max(30).default(10),
    },
  },
  ({ projectId, query, channelId, limit }) =>
    run(() => {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (channelId) params.set('channelId', channelId);
      return api.get(`${apiPaths.projects.search(projectId)}?${params.toString()}`);
    }),
);

server.registerTool(
  'wait_for_reply',
  {
    title: 'Wait for a reply',
    description:
      'BLOCK until someone replies in the channel, the conversation is marked resolved, or the wait times out. Returns { status: "reply"|"resolved"|"timeout", messages, resolvedBy, cursor }. Use it to hold a live back-and-forth: post_message → wait_for_reply → act on the reply → post_message → wait_for_reply, passing the returned `cursor` as `afterMessageId` each time. Stop when status is "resolved" (they are satisfied). On "timeout", call again to keep waiting. Never loop more than ~10 rounds without progress.',
    inputSchema: {
      projectId,
      channelId,
      afterMessageId: z
        .string()
        .optional()
        .describe(
          'The `cursor` from your previous wait (or a message id). Only activity newer than it is returned. Omit on the first wait to start from now.',
        ),
      timeoutSeconds: z.coerce
        .number()
        .int()
        .min(5)
        .max(55)
        .default(25)
        .describe(
          'How long to block before returning status "timeout" (then call again to keep waiting). Keep ≤30 so the tool call stays responsive.',
        ),
    },
  },
  ({ projectId, channelId, afterMessageId, timeoutSeconds }) =>
    run(() => {
      const params = new URLSearchParams({
        timeoutMs: String(timeoutSeconds * 1000),
      });
      if (afterMessageId) params.set('after', afterMessageId);
      return api.get(
        `${apiPaths.projects.channelWait(projectId, channelId)}?${params.toString()}`,
      );
    }),
);

server.registerTool(
  'read_channel',
  {
    title: 'Read channel messages',
    description:
      'Read a recent PAGE of a channel (default 20 newest). Returns lean, truncated messages plus `nextCursor`/`hasMore`; pass nextCursor back as `before` to load older messages. Prefer get_channel_overview / search_conversations first — do not page through a whole channel.',
    inputSchema: {
      projectId,
      channelId,
      limit: z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe('How many recent messages (max 50)'),
      before: z
        .string()
        .optional()
        .describe('A nextCursor from a previous call — loads older messages'),
    },
  },
  ({ projectId, channelId, limit, before }) =>
    run(async () => {
      const qs = `?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`;
      const messages = await api.get<Message[]>(
        `${apiPaths.projects.channelMessages(projectId, channelId)}${qs}`,
      );
      const hasMore = messages.length === limit;
      return {
        messages: messages.map(leanMessage),
        // Oldest returned id — pass as `before` to page further back.
        nextCursor: hasMore && messages.length > 0 ? messages[0].id : null,
        hasMore,
      };
    }),
);

server.registerTool(
  'get_message',
  {
    title: 'Get message',
    description:
      'Fetch one full (untruncated) message by id — use when a read_channel or search snippet was truncated and you need the whole thing.',
    inputSchema: {
      projectId,
      channelId,
      messageId: z.string().min(1).describe('The message id'),
    },
  },
  ({ projectId, channelId, messageId }) =>
    run(() =>
      api.get(apiPaths.projects.channelMessage(projectId, channelId, messageId)),
    ),
);

server.registerTool(
  'list_docs',
  {
    title: 'List docs',
    description:
      "A project's documentation pages (id, title, when/who last edited) — metadata only, no body. Use this to orient before reading or writing a doc.",
    inputSchema: { projectId },
  },
  ({ projectId }) => run(() => api.get(apiPaths.projects.docs(projectId))),
);

server.registerTool(
  'get_doc',
  {
    title: 'Get doc',
    description:
      'Fetch one documentation page with its full markdown body. Read it before update_doc so you preserve the parts you are not changing.',
    inputSchema: { projectId, docId },
  },
  ({ projectId, docId }) =>
    run(() => api.get(apiPaths.projects.doc(projectId, docId))),
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
      run(async () => {
        const p = await api.post<Project>(
          apiPaths.projects.features(projectId),
          body,
        );
        return compactFeature(p, newest(p.features));
      }),
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
      run(async () => {
        const p = await api.patch<Project>(
          apiPaths.projects.feature(projectId, featureId),
          body,
        );
        return compactFeature(p, findFeature(p, featureId));
      }),
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
      run(async () => {
        const p = await api.post<Project>(
          apiPaths.projects.featuresReorder(projectId),
          { orderedIds },
        );
        return p.features.map((f) => compactFeature(p, f));
      }),
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
      run(async () => {
        const p = await api.post<Project>(apiPaths.projects.tasks(projectId), body);
        return compactTask(newest(p.tasks));
      }),
  );

  server.registerTool(
    'reorder_tasks',
    {
      title: 'Reorder tasks',
      description:
        'Set the order of tasks within one status column. Pass the status and the full, final list of task ids in that column, in the desired order.',
      inputSchema: { projectId, ...reorderTasksSchema.shape },
    },
    ({ projectId, ...body }) =>
      run(async () => {
        const p = await api.patch<Project>(
          apiPaths.projects.tasksReorder(projectId),
          body,
        );
        return p.tasks
          .filter((t) => t.status === body.status)
          .map(compactTask);
      }),
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
        compactTask(
          findTask(
            await api.patch<Project>(apiPaths.projects.task(projectId, taskId), body),
            taskId,
          ),
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
        compactTask(
          findTask(
            await api.patch<Project>(apiPaths.projects.task(projectId, taskId), {
              status,
            }),
            taskId,
          ),
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
        compactTask(
          findTask(
            await api.patch<Project>(apiPaths.projects.task(projectId, taskId), {
              assigneeIds,
            }),
            taskId,
          ),
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
    'create_doc',
    {
      title: 'Create doc',
      description:
        `Create a documentation page in the project's Docs — long-form project docs (architecture, onboarding, decisions, status) the team and agents read to stay aware of what's going on. Give it a clear title and a markdown body. ${MARKDOWN_HINT}`,
      inputSchema: { projectId, ...createDocSchema.shape },
    },
    ({ projectId, ...body }) =>
      run(() => api.post(apiPaths.projects.docs(projectId), body)),
  );

  server.registerTool(
    'update_doc',
    {
      title: 'Update doc',
      description:
        `Update a documentation page's title and/or body. Call get_doc first and send the full new body — it REPLACES the old one. ${MARKDOWN_HINT}`,
      inputSchema: {
        projectId,
        docId,
        title: createDocSchema.shape.title.optional(),
        body: createDocSchema.shape.body.optional(),
      },
    },
    ({ projectId, docId, ...body }) =>
      run(() => api.patch(apiPaths.projects.doc(projectId, docId), body)),
  );

  server.registerTool(
    'comment_task',
    {
      title: 'Comment on task',
      description: `Post a comment on a task thread. ${MARKDOWN_HINT}`,
      inputSchema: { projectId, taskId, ...createCommentSchema.shape },
    },
    ({ projectId, taskId, ...body }) =>
      run(async () =>
        compactTask(
          findTask(
            await api.post<Project>(
              apiPaths.projects.comments(projectId, taskId),
              body,
            ),
            taskId,
          ),
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
        body: z
          .string()
          .max(4000)
          .optional()
          .describe(`Message text. ${MARKDOWN_HINT}`),
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

  // Destructive tools are always registered; the server rejects them unless the
  // connected token was granted delete access (returns a clear 403 otherwise).
  {
    server.registerTool(
      'delete_task',
      {
        title: 'Delete task',
        description:
          'Permanently delete a task. Requires a token with delete access enabled.',
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
        description:
          'Permanently delete a feature (its tasks are unlinked). Requires a token with delete access enabled.',
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
