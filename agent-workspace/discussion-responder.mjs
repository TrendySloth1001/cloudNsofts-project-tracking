#!/usr/bin/env node
/**
 * CloudNSofts discussion responder.
 *
 * Decouples "answer the discussion" from your coding agent. It PARKS on the
 * backend wait endpoint (a plain HTTP long-poll — NO LLM tokens while idle) and
 * only when a real human message arrives does it spawn a headless `claude -p`
 * turn to post one short reply, then goes back to waiting. Idle cost = zero;
 * you pay one turn per actual message, and your coding agent is never blocked.
 *
 * Run it (from the repo root or anywhere):
 *   CNSOFTS_PROJECT_ID=<projectId> CNSOFTS_CHANNEL_ID=<channelId> \
 *     node agent-workspace/discussion-responder.mjs
 *
 * Config (env; API_URL/TOKEN fall back to agent-workspace/.mcp.json):
 *   CNSOFTS_PROJECT_ID   (required) project id to watch
 *   CNSOFTS_CHANNEL_ID   (required) channel id to watch
 *   CNSOFTS_API_URL      backend base url        (else from .mcp.json)
 *   CNSOFTS_TOKEN        personal access token   (else from .mcp.json)
 *   CNSOFTS_RESPONDER_MODEL   claude model (default "sonnet"; "haiku" = cheaper)
 *   CNSOFTS_RESPONDER_DRYRUN  "1" = log instead of spawning claude (cheap test)
 *   CLAUDE_BIN           path to the claude CLI (default "claude")
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP_CONFIG = join(HERE, '.mcp.json');

function mcpEnv() {
  try {
    const cfg = JSON.parse(readFileSync(MCP_CONFIG, 'utf8'));
    return cfg.mcpServers?.cnsofts?.env ?? {};
  } catch {
    return {};
  }
}
const fromMcp = mcpEnv();

const API_URL = process.env.CNSOFTS_API_URL || fromMcp.CNSOFTS_API_URL;
const TOKEN = process.env.CNSOFTS_TOKEN || fromMcp.CNSOFTS_TOKEN;
const PROJECT_ID = process.env.CNSOFTS_PROJECT_ID;
const CHANNEL_ID = process.env.CNSOFTS_CHANNEL_ID;
const MODEL = process.env.CNSOFTS_RESPONDER_MODEL || 'sonnet';
const DRY_RUN = process.env.CNSOFTS_RESPONDER_DRYRUN === '1';
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const WAIT_MS = 50_000;

// Read tools the responder may use for context + the one write it needs.
const ALLOWED_TOOLS = [
  'mcp__cnsofts__get_project',
  'mcp__cnsofts__get_channel_overview',
  'mcp__cnsofts__read_channel',
  'mcp__cnsofts__search_conversations',
  'mcp__cnsofts__get_message',
  'mcp__cnsofts__get_task',
  'mcp__cnsofts__post_message',
];

function die(msg) {
  console.error(`[responder] ${msg}`);
  process.exit(1);
}
if (!API_URL || !TOKEN) die('Missing CNSOFTS_API_URL / CNSOFTS_TOKEN (set them or fill agent-workspace/.mcp.json).');
if (!PROJECT_ID || !CHANNEL_ID) die('Set CNSOFTS_PROJECT_ID and CNSOFTS_CHANNEL_ID.');

const log = (...a) => console.log(`[responder ${new Date().toISOString().slice(11, 19)}]`, ...a);

// The spawned `claude` gets a config pointing at the SAME endpoint the responder
// reached — never the .mcp.json tunnel URL, which may require its own auth.
// Written to a private temp dir and removed on exit.
const RESPONDER_MCP_CONFIG = join(
  mkdtempSync(join(tmpdir(), 'cnsofts-responder-')),
  'mcp.json',
);
writeFileSync(
  RESPONDER_MCP_CONFIG,
  JSON.stringify({
    mcpServers: {
      cnsofts: {
        type: 'stdio',
        command: 'node',
        args: [join(HERE, 'server', 'index.mjs')],
        env: { CNSOFTS_API_URL: API_URL, CNSOFTS_TOKEN: TOKEN },
      },
    },
  }),
);
process.on('exit', () => {
  try {
    rmSync(dirname(RESPONDER_MCP_CONFIG), { recursive: true, force: true });
  } catch {
    /* best-effort cleanup */
  }
});

function waitUrl(after) {
  const p = new URLSearchParams({ timeoutMs: String(WAIT_MS), ignoreResolved: 'true' });
  if (after) p.set('after', after);
  return `${API_URL}/api/projects/${PROJECT_ID}/channels/${CHANNEL_ID}/wait?${p}`;
}

async function waitForReply(after) {
  const res = await fetch(waitUrl(after), {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`wait HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Spawn a headless claude turn to post ONE reply to the latest message(s). */
function respond(messages) {
  const latest = messages[messages.length - 1];
  const prompt = [
    `You are answering the CloudNSofts team discussion as their coding agent.`,
    `A new message just arrived in channel ${CHANNEL_ID} (project ${PROJECT_ID}):`,
    ``,
    `${latest.author}: ${latest.body}`,
    ``,
    `Use the cnsofts MCP tools to read only the context you actually need`,
    `(get_channel_overview / read_channel / search_conversations), then post ONE`,
    `short, helpful reply in that channel with post_message. Keep it to a couple`,
    `of lines. Do not call wait_for_reply — reply once and stop.`,
  ].join('\n');

  if (DRY_RUN) {
    log(`DRY_RUN — would spawn claude (${MODEL}) to reply to: "${latest.body.slice(0, 80)}"`);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const args = [
      '-p', prompt,
      '--mcp-config', RESPONDER_MCP_CONFIG,
      '--strict-mcp-config',
      '--allowed-tools', ...ALLOWED_TOOLS,
      '--model', MODEL,
      '--max-turns', '14',
    ];
    log(`spawning claude (${MODEL}) to reply…`);
    const child = spawn(CLAUDE_BIN, args, { cwd: HERE, stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('exit', (code) => { log(`claude exited (${code})`); resolve(); });
    child.on('error', (e) => { log(`failed to spawn claude: ${e.message}`); resolve(); });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log(`watching channel ${CHANNEL_ID} · model ${MODEL}${DRY_RUN ? ' · DRY_RUN' : ''}`);
  let cursor = process.env.CNSOFTS_START_AFTER || null;
  for (;;) {
    let out;
    try {
      out = await waitForReply(cursor);
    } catch (e) {
      log(`wait error: ${e.message} — retrying in 3s`);
      await sleep(3000);
      continue;
    }
    if (out.status === 'reply' && out.messages.length > 0) {
      cursor = out.cursor;
      log(`reply from ${out.messages[out.messages.length - 1].author} → responding`);
      await respond(out.messages);
      // After replying, jump the cursor past everything (incl. our own reply)
      // so we only wake on the NEXT new human message.
      cursor = out.cursor;
    }
    // status "timeout" (or resolved, which we ignore) → just loop; the block
    // itself is free, so idle costs nothing.
  }
}

main().catch((e) => die(`fatal: ${e.message}`));
