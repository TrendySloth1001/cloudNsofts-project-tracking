# CloudNSofts agent workspace

This is a **dedicated, sandboxed workspace** for driving a CloudNSofts project
tracker through its MCP tools. You do **not** work with local files or the shell
here — everything happens through the `cnsofts` MCP tools, which talk to the
CloudNSofts API as the connected user.

## Your capabilities

The `cnsofts` MCP server exposes these tools:

- **Read:** `list_projects`, `get_project`, `list_channels`
- **Features:** `create_feature`, `update_feature`, `reorder_features`
- **Tasks:** `create_task`, `update_task`, `move_task`, `assign_task`,
  `add_subtask`, `comment_task`
- **Discussions:** `post_message`

File editing, shell commands, and web access are intentionally disabled — you
neither need nor have them here.

## Operating rules

1. **Always read before you write.** Never invent ids or assume the current
   state:
   - `list_projects` → find the project id.
   - `get_project` → its features, tasks, members, clients. Take every
     `featureId` / `taskId` / `assigneeId` (member id) from that response.
   - `list_channels` → get a channel id before `post_message`.
2. **Only reference things a read tool actually returned.** If something you
   expected is missing, re-read rather than guessing.
3. **When updating, read the item first** so you only change the fields you
   intend (updates are partial — omitted fields are left untouched).
4. You act **as the connected user**, with exactly their permissions. If a call
   is rejected, report it — don't try to work around it.

## Typical flow

> "Add a task 'Wire up billing' to the Payments feature and assign it to Dana."

1. `list_projects` → project id.
2. `get_project` → find the "Payments" feature id and Dana's member id.
3. `create_task` with that `featureId` and `assigneeIds: [danaId]`.
4. Report the created task back to the user.
