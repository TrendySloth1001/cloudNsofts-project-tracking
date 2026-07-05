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
  CLAUDE.md             # the agent's operating manual (read-before-write, etc.)
```

`server/index.mjs` is a standalone bundle — it needs only Node.js, no install.
Regenerate it from the monorepo with `npm run bundle -w @cnsofts/mcp`.

## Set it up on another device

1. **Get a token.** In the CloudNSofts app: sidebar account menu → *Connect
   coding agent* → *Generate token*. Copy the `cnsofts_pat_…` value.
2. **Copy this `agent-workspace/` folder** to the device (e.g. `scp -r`, a USB
   drive, or clone the repo). Node.js 20+ must be installed there.
3. **Fill in `.mcp.json`:**
   - `CNSOFTS_TOKEN` → paste your token.
   - `CNSOFTS_API_URL` → the reachable API URL. For remote devices this is your
     dev-tunnel URL (e.g. `https://qjhcp0ph-4000.inc1.devtunnels.ms`); on the
     same machine it's `http://localhost:4000`.
4. **Launch the agent in this folder:**
   ```bash
   cd agent-workspace
   claude
   ```
   On first launch, Claude Code asks whether you trust the folder — say yes (that
   activates the sandbox rules and auto-enables the `cnsofts` server). Then ask:
   *"list my CloudNSofts projects"*.

## Requirements while in use

- The CloudNSofts **backend must be running** and reachable at `CNSOFTS_API_URL`
  (and the dev tunnel must be up, if you're using one).
- Keep your token secret. Revoke it anytime from the *Connect coding agent*
  screen; the agent loses access immediately.

## Read-only or allow-deletes

Add to the `env` block in `.mcp.json`:

- `"CNSOFTS_READONLY": "1"` — only read tools (no changes at all).
- `"CNSOFTS_ALLOW_DELETE": "1"` — also expose `delete_task` / `delete_feature`.
