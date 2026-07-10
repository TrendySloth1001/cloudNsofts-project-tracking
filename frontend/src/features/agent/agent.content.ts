import type { IconName } from '@/components/ui';

/**
 * Reference content for the Connect-agent page: the MCP tools an agent gets,
 * starter prompts, and per-client connect snippets. Kept in one place so the
 * page copy has a single source. The API base is injected from `lib/config`.
 */

/** The MCP tools exposed by `@cnsofts/mcp`, grouped by what they touch. */
export const MCP_TOOL_GROUPS: {
  title: string;
  icon: IconName;
  note: string;
  tools: string[];
}[] = [
  {
    title: 'Read',
    icon: 'eye',
    note: 'Always available.',
    tools: [
      'list_projects',
      'get_project',
      'list_tasks',
      'get_task',
      'list_channels',
      'read_channel',
      'search_conversations',
      'list_docs',
      'get_doc',
      'view_image',
    ],
  },
  {
    title: 'Board',
    icon: 'board',
    note: 'Full-access tokens only.',
    tools: [
      'create_task',
      'update_task',
      'move_task',
      'assign_task',
      'add_subtask',
      'toggle_subtask',
      'reorder_tasks',
      'create_feature',
      'update_feature',
      'reorder_features',
    ],
  },
  {
    title: 'Roadmap',
    icon: 'flag',
    note: 'Full-access tokens only.',
    tools: ['create_milestone', 'update_milestone', 'reorder_milestones'],
  },
  {
    title: 'Docs & images',
    icon: 'docs',
    note: 'Full-access tokens only.',
    tools: ['create_doc', 'update_doc', 'upload_image'],
  },
  {
    title: 'Discussions',
    icon: 'chat',
    note: 'Full-access tokens only.',
    tools: ['post_message', 'comment_task', 'create_channel'],
  },
  {
    title: 'Delete',
    icon: 'delete',
    note: 'Off unless explicitly enabled.',
    tools: ['delete_task', 'delete_feature', 'delete_milestone'],
  },
];

/** Copy-able starter prompts to show users what to ask their agent. */
export const EXAMPLE_PROMPTS: string[] = [
  'Create a High-priority task “Fix login redirect” in the Billing feature, due Friday.',
  'Move “Design homepage” to In Review and assign it to me.',
  'Add a checklist to “Integrate payment gateway”: API keys, webhook, tests.',
  'Post in #general: today’s standup — what shipped and what’s blocked.',
  'Summarize everything that’s In Progress across the board.',
];

/** A connect method (tab) and how to render its snippet for a token. */
export interface ConnectClient {
  value: string;
  label: string;
  icon: IconName;
  language: 'shell' | 'json';
  /** Filename to offer on download, when the snippet is a config file. */
  filename?: string;
  build: (apiUrl: string, token: string) => string;
}

const mcpServersBlock = (apiUrl: string, token: string, key: string): string =>
  JSON.stringify(
    {
      [key]: {
        cnsofts: {
          // Run the downloaded bundle (see the download step above) — no npm.
          command: 'node',
          args: ['./cnsofts-mcp.mjs'],
          env: { CNSOFTS_API_URL: apiUrl, CNSOFTS_TOKEN: token },
        },
      },
    },
    null,
    2,
  );

export const CONNECT_CLIENTS: ConnectClient[] = [
  {
    value: 'cli',
    label: 'Claude Code',
    icon: 'terminal',
    language: 'shell',
    build: (apiUrl, token) =>
      [
        'claude mcp add cnsofts \\',
        `  -e CNSOFTS_API_URL=${apiUrl} \\`,
        `  -e CNSOFTS_TOKEN=${token} \\`,
        '  -- node ./cnsofts-mcp.mjs',
      ].join('\n'),
  },
  {
    value: 'desktop',
    label: 'Claude Desktop / Cursor',
    icon: 'code',
    language: 'json',
    filename: 'mcp.json',
    build: (apiUrl, token) => mcpServersBlock(apiUrl, token, 'mcpServers'),
  },
  {
    value: 'vscode',
    label: 'VS Code',
    icon: 'code',
    language: 'json',
    filename: 'mcp.json',
    build: (apiUrl, token) => mcpServersBlock(apiUrl, token, 'servers'),
  },
  {
    value: 'env',
    label: 'Env vars',
    icon: 'key',
    language: 'shell',
    build: (apiUrl, token) =>
      `CNSOFTS_API_URL=${apiUrl}\nCNSOFTS_TOKEN=${token}`,
  },
];

/**
 * Direct REST usage — the token is a standard Bearer credential, so any
 * language with an HTTP client can drive the API without MCP or Node. Each
 * snippet lists the caller's projects; every documented endpoint works the same
 * way. `${apiUrl}` is the token's API base; routes live under `/api`.
 */
export const REST_EXAMPLES: ConnectClient[] = [
  {
    value: 'curl',
    label: 'curl',
    icon: 'terminal',
    language: 'shell',
    build: (apiUrl, token) =>
      `curl -H "Authorization: Bearer ${token}" \\\n  ${apiUrl}/api/projects`,
  },
  {
    value: 'csharp',
    label: 'C#',
    icon: 'code',
    language: 'shell',
    build: (apiUrl, token) =>
      [
        'using var http = new HttpClient();',
        'http.DefaultRequestHeaders.Authorization =',
        `    new AuthenticationHeaderValue("Bearer", "${token}");`,
        `var json = await http.GetStringAsync("${apiUrl}/api/projects");`,
        'Console.WriteLine(json);',
      ].join('\n'),
  },
  {
    value: 'python',
    label: 'Python',
    icon: 'code',
    language: 'shell',
    build: (apiUrl, token) =>
      [
        'import requests',
        '',
        'res = requests.get(',
        `    "${apiUrl}/api/projects",`,
        `    headers={"Authorization": "Bearer ${token}"},`,
        ')',
        'print(res.json())',
      ].join('\n'),
  },
  {
    value: 'node',
    label: 'JavaScript',
    icon: 'code',
    language: 'shell',
    build: (apiUrl, token) =>
      [
        `const res = await fetch("${apiUrl}/api/projects", {`,
        `  headers: { Authorization: "Bearer ${token}" },`,
        '});',
        'console.log(await res.json());',
      ].join('\n'),
  },
  {
    value: 'go',
    label: 'Go',
    icon: 'code',
    language: 'shell',
    build: (apiUrl, token) =>
      [
        `req, _ := http.NewRequest("GET", "${apiUrl}/api/projects", nil)`,
        `req.Header.Set("Authorization", "Bearer ${token}")`,
        'resp, _ := http.DefaultClient.Do(req)',
        'body, _ := io.ReadAll(resp.Body)',
        'fmt.Println(string(body))',
      ].join('\n'),
  },
];

/** Short troubleshooting notes for the connect flow. */
export const TROUBLESHOOTING: { q: string; a: string }[] = [
  {
    q: 'The agent can’t install the MCP server',
    a: 'You don’t install from npm — download the single self-contained file first (`curl -fsSL <API URL>/api/agent/mcp-server.mjs -o cnsofts-mcp.mjs`), then point your client at `node ./cnsofts-mcp.mjs`. It needs only Node 20+.',
  },
  {
    q: 'Works locally but not from another device',
    a: 'Set the API base URL to one the agent’s device can actually reach — your tunnel or public URL, not `http://localhost`. The download command and the config both use that URL.',
  },
  {
    q: 'Agent says the server isn’t connected',
    a: 'Restart the agent after adding the server — the tool registry is built once at startup.',
  },
  {
    q: 'Writes fail with “read-only”',
    a: 'The token’s access is Read only. Generate a Full-access token, or rotate this one.',
  },
  {
    q: 'A project is “not found”',
    a: 'The token is scoped to specific projects. Regenerate it with that project included.',
  },
];
