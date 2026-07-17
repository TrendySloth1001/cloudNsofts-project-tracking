import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { apiPaths } from '@cnsofts/shared';
import { api } from './client.js';

/**
 * MCP **prompts** — reusable workflow templates the host surfaces as slash
 * commands. They turn the raw tool/resource surface into guided workflows
 * (stand-up, triage, client update, feature planning) instead of leaving the
 * model to orchestrate 35 tools from scratch. Each returns a single user
 * message that references the `cnsofts://` resources and tools by name.
 */

/** A project-id prompt argument that autocompletes from accessible projects. */
const projectIdArg = completable(
  z.string().describe('The project id (see the cnsofts://projects resource)'),
  async (value) => {
    const projects = await api
      .get<{ id: string }[]>(apiPaths.projects.list())
      .catch(() => []);
    return projects
      .map((p) => p.id)
      .filter((id) => id.startsWith(value))
      .slice(0, 25);
  },
);

/** Wrap prompt text as the single user message MCP expects. */
function userMessage(text: string): GetPromptResult {
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'standup',
    {
      title: 'Stand-up summary',
      description: "Summarize a project's recent progress as a short stand-up update.",
      argsSchema: { projectId: projectIdArg },
    },
    ({ projectId }) =>
      userMessage(
        [
          `Write a concise stand-up update for project ${projectId}.`,
          '',
          `Read the board resource cnsofts://project/${projectId} (or call get_project),`,
          `and skim recent channel activity (get_channel_overview / search_conversations).`,
          'Then summarize, as a short bulleted list:',
          '  • Shipped — tasks moved to Done and milestones completed recently.',
          '  • In progress — what is actively being worked on.',
          '  • Blockers / needs input.',
          '  • Next — the most important upcoming items.',
          '',
          'Keep it tight — a status update a human would skim in 15 seconds. Do NOT',
          'paste the whole board. If nothing changed in an area, omit it.',
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'triage',
    {
      title: 'Triage the board',
      description: 'Find unassigned, overdue, stale, or mis-prioritized tasks and propose fixes.',
      argsSchema: { projectId: projectIdArg },
    },
    ({ projectId }) =>
      userMessage(
        [
          `Triage the board for project ${projectId}.`,
          '',
          `Read cnsofts://project/${projectId} (or get_project / list_tasks). Identify:`,
          '  • Tasks with no assignee.',
          '  • Tasks past their dueDate that are not Done.',
          '  • Tasks stuck in In Progress with no recent activity.',
          '  • Priorities that look wrong given due dates / milestones.',
          '',
          'Propose a concrete plan (assignee, priority, or status changes). Ask before',
          'making sweeping changes; for clearly-correct fixes, apply them with the',
          'update_task / assign_task / move_task tools and post a one-line summary to',
          'the team channel pointing at the board.',
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'client-update',
    {
      title: 'Draft a client update',
      description: 'Draft a client-facing progress update from the roadmap and recently shipped work.',
      argsSchema: { projectId: projectIdArg },
    },
    ({ projectId }) =>
      userMessage(
        [
          `Draft a client-facing progress update for project ${projectId}.`,
          '',
          `Base it on the roadmap milestones and shipped work in`,
          `cnsofts://project/${projectId} (get_project → milestones + Done tasks).`,
          'Write in plain, reassuring language for a non-technical client:',
          '  • What was delivered since the last update.',
          '  • Where each roadmap checkpoint stands and expected dates.',
          '  • Anything you need from them.',
          '',
          'Keep internal/engineering detail OUT — clients only see client-shared docs',
          'and client channels. Show me the draft first; once approved, post it to the',
          'client channel (list_channels → the client-visible one) or a Client-review',
          'doc, not the internal team channel.',
        ].join('\n'),
      ),
  );

  server.registerPrompt(
    'plan-feature',
    {
      title: 'Plan a feature into tasks',
      description: 'Break a feature description into a feature + ordered tasks on the board.',
      argsSchema: {
        projectId: projectIdArg,
        feature: z
          .string()
          .describe('What the feature should do (a sentence or a paragraph)'),
      },
    },
    ({ projectId, feature }) =>
      userMessage(
        [
          `Plan this feature into board work for project ${projectId}:`,
          '',
          `"""${feature}"""`,
          '',
          `First read cnsofts://project/${projectId} to see existing features, tasks,`,
          'members and conventions (avoid duplicates, match naming/priorities).',
          'Then propose:',
          '  • A feature (swimlane) name + short description.',
          '  • A small ordered set of concrete, independently-shippable tasks, each',
          '    with a priority and a suggested assignee from the roster.',
          '',
          'Show the plan for approval FIRST. On approval, create it with create_feature',
          'then create_task (set featureId), and post a one-line note to the team',
          'channel pointing at the new swimlane.',
        ].join('\n'),
      ),
  );
}
