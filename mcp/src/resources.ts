import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { apiPaths, type Doc, type DocSummary, type Message, type Project } from '@cnsofts/shared';
import { api } from './client.js';
import { compactProject, leanMessage } from './shape.js';

/**
 * MCP **resources** — a browsable `cnsofts://` tree the host can list, read,
 * attach as context, and autocomplete. This is the read surface a real MCP
 * exposes as data (not as a tool round-trip): projects, per-project board, docs,
 * and channels. All reads run with the connected PAT's permissions.
 */

type ProjectSummary = { id: string; name: string; status: string };

const listProjects = (): Promise<ProjectSummary[]> =>
  api.get<ProjectSummary[]>(apiPaths.projects.list());

/** JSON resource contents for a URI. */
function json(uri: URL, data: unknown): ReadResourceResult {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/** Autocomplete a project id from the accessible projects. */
async function completeProjectId(value: string): Promise<string[]> {
  const projects = await listProjects();
  return projects
    .map((p) => p.id)
    .filter((id) => id.startsWith(value))
    .slice(0, 25);
}

export function registerResources(server: McpServer): void {
  // Index of projects (static).
  server.registerResource(
    'projects',
    'cnsofts://projects',
    {
      title: 'Projects',
      description: 'Every project the connected account can access (id, name, status).',
      mimeType: 'application/json',
    },
    async (uri) => json(uri, await listProjects()),
  );

  // A project's board — features, tasks, members, milestones (compact). The
  // list callback enumerates every project so hosts can browse boards directly.
  server.registerResource(
    'project-board',
    new ResourceTemplate('cnsofts://project/{projectId}', {
      list: async () => ({
        resources: (await listProjects()).map((p) => ({
          uri: `cnsofts://project/${p.id}`,
          name: `${p.name} — board`,
          description: `Board for ${p.name} (${p.status})`,
          mimeType: 'application/json',
        })),
      }),
      complete: { projectId: completeProjectId },
    }),
    {
      title: 'Project board',
      description: "A project's features (swimlanes), tasks, members and milestones — compact.",
      mimeType: 'application/json',
    },
    async (uri, { projectId }) =>
      json(
        uri,
        compactProject(
          await api.get<Project>(apiPaths.projects.detail(String(projectId))),
        ),
      ),
  );

  // A project's docs index (titles + ids).
  server.registerResource(
    'project-docs',
    new ResourceTemplate('cnsofts://project/{projectId}/docs', {
      list: undefined,
      complete: { projectId: completeProjectId },
    }),
    {
      title: 'Project docs',
      description: 'Documentation pages in a project (titles + ids; read one at cnsofts://project/{id}/doc/{docId}).',
      mimeType: 'application/json',
    },
    async (uri, { projectId }) =>
      json(
        uri,
        await api.get<DocSummary[]>(apiPaths.projects.docs(String(projectId))),
      ),
  );

  // One documentation page, as markdown.
  server.registerResource(
    'doc',
    new ResourceTemplate('cnsofts://project/{projectId}/doc/{docId}', {
      list: undefined,
      complete: {
        projectId: completeProjectId,
        docId: async (value, ctx) => {
          const pid = ctx?.arguments?.projectId;
          if (!pid) return [];
          const docs = await api.get<DocSummary[]>(apiPaths.projects.docs(pid));
          return docs
            .filter((d) => d.id.startsWith(value))
            .map((d) => d.id)
            .slice(0, 25);
        },
      },
    }),
    {
      title: 'Doc',
      description: 'A single documentation page (markdown).',
      mimeType: 'text/markdown',
    },
    async (uri, { projectId, docId }) => {
      const doc = await api.get<Doc>(
        apiPaths.projects.doc(String(projectId), String(docId)),
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: `# ${doc.title}\n\n${doc.body}`,
          },
        ],
      };
    },
  );

  // A project's discussion channels.
  server.registerResource(
    'project-channels',
    new ResourceTemplate('cnsofts://project/{projectId}/channels', {
      list: undefined,
      complete: { projectId: completeProjectId },
    }),
    {
      title: 'Project channels',
      description: 'Discussion channels in a project (read one at cnsofts://project/{id}/channel/{channelId}).',
      mimeType: 'application/json',
    },
    async (uri, { projectId }) =>
      json(uri, await api.get(apiPaths.projects.channels(String(projectId)))),
  );

  // A channel overview: counts, participants, and recent message previews.
  server.registerResource(
    'channel',
    new ResourceTemplate('cnsofts://project/{projectId}/channel/{channelId}', {
      list: undefined,
      complete: {
        projectId: completeProjectId,
        channelId: async (value, ctx) => {
          const pid = ctx?.arguments?.projectId;
          if (!pid) return [];
          const channels = await api.get<{ id: string }[]>(
            apiPaths.projects.channels(pid),
          );
          return channels
            .map((c) => c.id)
            .filter((id) => id.startsWith(value))
            .slice(0, 25);
        },
      },
    }),
    {
      title: 'Channel',
      description: 'A channel overview: counts, participants, and recent message previews.',
      mimeType: 'application/json',
    },
    async (uri, { projectId, channelId }) => {
      const overview = await api.get<{ recent?: Message[] }>(
        apiPaths.projects.channelOverview(
          String(projectId),
          String(channelId),
        ),
      );
      // Truncate any embedded message bodies to keep the resource small.
      const shaped = overview.recent
        ? { ...overview, recent: overview.recent.map(leanMessage) }
        : overview;
      return json(uri, shaped);
    },
  );
}
