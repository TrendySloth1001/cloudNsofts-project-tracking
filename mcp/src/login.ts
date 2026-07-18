import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { hostname, userInfo } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import {
  apiPaths,
  DEVICE_TOKEN_NAME_MAX,
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

/** `--name X` / `--name=X` from `login`'s own args (argv[2] is the command). */
function nameFlag(argv: string[]): string | undefined {
  const args = argv.slice(3);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--name') return args[i + 1];
    if (arg?.startsWith('--name=')) return arg.slice('--name='.length);
  }
  return undefined;
}

/** A label that tells this machine apart from the user's other ones, e.g.
 *  "nick on Nicks-MacBook-Pro" — hostnames carry a `.local`/`.lan` suffix that
 *  reads as noise in the token list. */
function defaultName(): string {
  const host = hostname().replace(/\.(local|lan|home|internal)$/i, '');
  let who = '';
  try {
    who = userInfo().username;
  } catch {
    /* no passwd entry (some containers) — the host alone still identifies it */
  }
  return who ? `${who} on ${host}` : host;
}

const clampName = (name: string): string =>
  name.trim().slice(0, DEVICE_TOKEN_NAME_MAX).trim();

/**
 * What this token will be called in *Connect coding agent*. Precedence:
 * `--name` (scriptable) → `CNSOFTS_AGENT_NAME` (config/CI) → an interactive
 * prompt → a machine-derived default. The prompt only happens on a real
 * terminal; piped/CI runs must never block waiting on stdin.
 */
async function resolveName(): Promise<string> {
  const explicit = nameFlag(process.argv) ?? process.env.CNSOFTS_AGENT_NAME;
  const fallback = defaultName();
  if (explicit?.trim()) return clampName(explicit);
  if (!process.stdin.isTTY) return fallback;

  // Prompt on stderr: stdout is the MCP protocol channel and must stay clean.
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`  Name this agent [${fallback}]: `);
    return clampName(answer) || fallback;
  } catch {
    return fallback; // ^C / closed stdin — take the default rather than fail
  } finally {
    rl.close();
  }
}

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

  // 1) Name this token, then begin the device login. The name is fixed at start
  //    because it's what the approval page shows the user before they consent.
  say();
  const name = await resolveName();

  const start = await postJson<DeviceStartResponse>(
    `${apiUrl}${apiPaths.auth.deviceStart()}`,
    { name },
  );

  say();
  say(`  Agent name:             ${name}`);
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
