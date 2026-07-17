import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  apiPaths,
  type DevicePollResponse,
  type DeviceStartResponse,
} from '@cnsofts/shared';

/**
 * `login` — browser auth for this agent, so nobody has to copy-paste a token.
 *
 * An OAuth-style device flow: ask the server to start a login, show the user a
 * short code and open the approval page in their browser, poll until they
 * approve in their signed-in session, then write the freshly-minted token into
 * `.mcp.json` (retiring the previous one). Runs standalone from the terminal:
 *
 *   node server/index.mjs login
 *
 * stdout is the MCP protocol channel, so all human output goes to stderr.
 */

const say = (msg = ''): void => console.error(msg);

/** The `.mcp.json` this bundle is configured by. Override with CNSOFTS_MCP_CONFIG. */
function configPath(): string {
  if (process.env.CNSOFTS_MCP_CONFIG) return resolve(process.env.CNSOFTS_MCP_CONFIG);
  // The bundle lives at <workspace>/server/index.mjs; its config is one level up.
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '.mcp.json');
}

interface McpConfig {
  mcpServers?: Record<
    string,
    { type?: string; command?: string; args?: string[]; env?: Record<string, string> }
  >;
}

async function readConfig(path: string): Promise<McpConfig> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as McpConfig;
  } catch {
    return {};
  }
}

async function postJson<T>(
  url: string,
  body: unknown,
  bearer?: string,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) message = j.error.message;
    } catch {
      /* keep status */
    }
    throw new Error(message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Best-effort: open the approval page in the user's default browser. Set
 *  CNSOFTS_NO_BROWSER=1 on a headless box to just print the URL. */
function openBrowser(url: string): void {
  if (process.env.CNSOFTS_NO_BROWSER) return;
  const cmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  try {
    const child = spawn(cmd, [url], {
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32',
    });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    /* the URL is printed too — the user can open it manually */
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export async function runLogin(): Promise<void> {
  const path = configPath();
  const existing = await readConfig(path);
  const entry = existing.mcpServers?.cnsofts;
  const oldToken = entry?.env?.CNSOFTS_TOKEN;

  const apiUrl = (
    process.env.CNSOFTS_API_URL ||
    entry?.env?.CNSOFTS_API_URL ||
    ''
  ).replace(/\/+$/, '');
  if (!apiUrl) {
    throw new Error(
      `No API URL. Set CNSOFTS_API_URL, or add it to ${path} under mcpServers.cnsofts.env.`,
    );
  }

  // 1) Begin the device login.
  const start = await postJson<DeviceStartResponse>(
    `${apiUrl}${apiPaths.auth.deviceStart()}`,
    { name: process.env.CNSOFTS_AGENT_NAME || 'Coding agent' },
  );

  say();
  say(`  Approve this agent at:  ${start.verificationUriComplete}`);
  say(`  Your code:              ${start.userCode}`);
  say();
  say('  Opening your browser… (waiting for approval)');
  openBrowser(start.verificationUriComplete);

  // 2) Poll until approved (or the request expires).
  const deadline = Date.now() + start.expiresIn * 1000;
  let token: string | undefined;
  while (Date.now() < deadline) {
    await sleep(start.interval * 1000);
    let poll: DevicePollResponse;
    try {
      poll = await postJson<DevicePollResponse>(
        `${apiUrl}${apiPaths.auth.deviceToken()}`,
        { deviceCode: start.deviceCode },
      );
    } catch (err) {
      // A terminal error (expired / already used) — stop rather than spin.
      throw new Error(
        `Login failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (poll.status === 'issued') {
      token = poll.token;
      break;
    }
  }
  if (!token) throw new Error('Timed out waiting for approval — run `login` again.');

  // 3) Retire the previous token (best-effort: it may already be invalid).
  if (oldToken && oldToken !== token) {
    await postJson(
      `${apiUrl}${apiPaths.auth.tokensRevokeCurrent()}`,
      undefined,
      oldToken,
    ).catch(() => undefined);
  }

  // 4) Write the new token back into .mcp.json, preserving the rest.
  const next: McpConfig = {
    ...existing,
    mcpServers: {
      ...existing.mcpServers,
      cnsofts: {
        type: 'stdio',
        command: 'node',
        args: ['${CLAUDE_PROJECT_DIR:-.}/server/index.mjs'],
        ...entry,
        env: { ...entry?.env, CNSOFTS_API_URL: apiUrl, CNSOFTS_TOKEN: token },
      },
    },
  };
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8');

  say();
  say(`  ✅ Connected. Token saved to ${path}`);
  say(oldToken ? '  (the previous token was revoked)' : '');
  say('  Restart your agent to pick up the new token.');
  say();
}
