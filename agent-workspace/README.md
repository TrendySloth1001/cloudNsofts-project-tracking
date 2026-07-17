# CloudNSofts agent workspace

A self-contained, **sandboxed** folder for running a coding agent (Claude Code)
that manages a CloudNSofts project tracker — create/update/move/assign tasks and
features, and post discussion messages — **through MCP tools only**.

The agent here has **no filesystem, shell, or web access**. Every built-in local
tool (Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch, Task) is denied
in `.claude/settings.json`, so the agent can only use the `cnsofts` MCP tools,
which talk to the API over the network. It cannot read or touch anything on the
device — inside or outside this folder.

## What's in here

```
agent-workspace/
  server/index.mjs      # the MCP server, bundled to one file (no node_modules)
  .mcp.json             # tells Claude Code to launch that server
  .claude/settings.json # sandbox: denies all local tools, auto-enables the server
  .claude/skills/       # the `cloudnsofts` skill — the agent's full playbook
  CLAUDE.md             # the agent's operating manual (read-before-write, etc.)
```

`server/index.mjs` is a standalone bundle — it needs only Node.js, no install.
Regenerate it from the monorepo with `npm run bundle -w @cnsofts/mcp`.

## Set it up (recommended: sign in from the terminal)

No token to generate or paste — `login` opens your browser, you approve, and it
writes the token into `.mcp.json` for you. Node.js 20+ is the only requirement.

**Install** — one file, no npm:

```bash
mkdir -p cnsofts-agent/server && cd cnsofts-agent
curl -fsSL https://cloudnsofts.com/api/agent/mcp-server.mjs -o server/index.mjs
```

**Sign in** — pass the API URL once (after this it's remembered in `.mcp.json`):

```bash
CNSOFTS_API_URL=https://cloudnsofts.com node server/index.mjs login
```

```
  Approve this agent at:  https://cloudnsofts.com/connect?code=VRH3-P4SV
  Your code:              VRH3-P4SV
  Opening your browser… (waiting for approval)

  ✅ Connected. Token saved to /…/cnsofts-agent/.mcp.json
  Restart your agent to pick up the new token.
```

Click **Approve** in the browser (it shows the code and who the agent will act
as). The terminal finishes on its own within a few seconds.

**Run the agent** in that folder:

```bash
claude
```

On first launch, Claude Code asks whether you trust the folder — say yes (that
activates the sandbox rules and auto-enables the `cnsofts` server). Then ask:
*"list my CloudNSofts projects"*.

> Already have this `agent-workspace/` folder (copied via `scp -r`, USB, or a
> clone)? The API URL is already in `.mcp.json`, so just run
> `node server/index.mjs login` inside it.

### login options

| Command / env | What it does |
| --- | --- |
| `node server/index.mjs login` | Sign in / **rotate** — mints a new token, rewrites `.mcp.json`, revokes the old one. |
| `CNSOFTS_API_URL=…` | Required only on the **first** sign-in (nothing to read yet). |
| `CNSOFTS_NO_BROWSER=1` | Headless box / over SSH — prints the URL + code instead of opening a browser. |
| `CNSOFTS_AGENT_NAME="My laptop"` | Labels the token on the *Connect coding agent* screen. |
| `CNSOFTS_MCP_CONFIG=/path/.mcp.json` | Write to a specific config file. |

The config is resolved from the **bundle's** location (`<folder-containing
server/>/.mcp.json`), not your current directory — so the command works from
anywhere.

### Alternative: paste a token manually

Prefer the old way? In the app: sidebar account menu → *Connect coding agent* →
*Generate token*, copy the `cnsofts_pat_…` value, and fill in `.mcp.json`:

- `CNSOFTS_TOKEN` → paste your token.
- `CNSOFTS_API_URL` → the reachable API URL. For remote devices this is your
  dev-tunnel URL (e.g. `https://qjhcp0ph-4000.inc1.devtunnels.ms`); on the same
  machine it's `http://localhost:4000`.

## Requirements while in use

- The CloudNSofts **backend must be running** and reachable at `CNSOFTS_API_URL`
  (and the dev tunnel must be up, if you're using one).
- Keep your token secret. Revoke it anytime from the *Connect coding agent*
  screen; the agent loses access immediately.

## Read-only or allow-deletes

Add to the `env` block in `.mcp.json`:

- `"CNSOFTS_READONLY": "1"` — only read tools (no changes at all).
- `"CNSOFTS_ALLOW_DELETE": "1"` — also expose `delete_task` / `delete_feature`.
