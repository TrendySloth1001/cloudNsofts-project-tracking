# @cnsofts/mcp

An [MCP](https://modelcontextprotocol.io) server that lets a coding agent
(Claude Code, Cursor, Claude Desktop, …) drive a CloudNSofts workspace — create
and update features & tasks, move/assign them, and post discussion messages.

It's a thin client over the app's REST API. It authenticates with a **Personal
Access Token**, so the agent acts **as the token's owner** and inherits exactly
that user's permissions — nothing more.

## 1. Get a token

In the app: **sidebar account menu → Connect coding agent → Generate token**.
Copy the `cnsofts_pat_…` value (shown once).

## 2. Connect your agent

**Claude Code** (one command):

```bash
claude mcp add cnsofts \
  -e CNSOFTS_API_URL=http://localhost:4000 \
  -e CNSOFTS_TOKEN=cnsofts_pat_your_token \
  -- npx -y @cnsofts/mcp
```

Or, from a local build in this monorepo (`npm run build -w @cnsofts/mcp`):

```bash
claude mcp add cnsofts \
  -e CNSOFTS_API_URL=http://localhost:4000 \
  -e CNSOFTS_TOKEN=cnsofts_pat_your_token \
  -- node /absolute/path/to/mcp/dist/index.js
```

**Any MCP client** — equivalent `.mcp.json`:

```json
{
  "mcpServers": {
    "cnsofts": {
      "command": "npx",
      "args": ["-y", "@cnsofts/mcp"],
      "env": {
        "CNSOFTS_API_URL": "http://localhost:4000",
        "CNSOFTS_TOKEN": "cnsofts_pat_your_token"
      }
    }
  }
}
```

## Configuration

| Variable               | Required | Purpose                                              |
| ---------------------- | -------- | ---------------------------------------------------- |
| `CNSOFTS_API_URL`      | yes      | API base URL (e.g. `http://localhost:4000`)          |
| `CNSOFTS_TOKEN`        | yes      | A `cnsofts_pat_…` access token                       |
| `CNSOFTS_READONLY`     | no       | `1` → register only read tools                       |
| `CNSOFTS_ALLOW_DELETE` | no       | `1` → also expose `delete_task` / `delete_feature`   |

## Tools

**Read:** `list_projects`, `get_project`, `list_channels`.

**Write:** `create_feature`, `update_feature`, `reorder_features`,
`create_task`, `update_task`, `move_task`, `assign_task`, `add_subtask`,
`comment_task`, `post_message`.

**Destructive (opt-in):** `delete_task`, `delete_feature`.

Every write is validated by the same `@cnsofts/shared` schemas the web app uses,
and enforced by the same role checks — a client-role token can read but can't
edit the board.
