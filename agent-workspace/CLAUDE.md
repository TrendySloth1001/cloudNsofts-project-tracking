# CloudNSofts agent workspace

This is a **dedicated, sandboxed workspace** for driving a CloudNSofts project
tracker through its MCP tools. You do **not** work with local files or the shell
here — everything happens through the `cnsofts` MCP tools, which talk to the
CloudNSofts API as the connected user.

> **Full playbook:** invoke the **`cloudnsofts` skill** (in
> `.claude/skills/cloudnsofts/`) for the complete workflow — board, roadmap,
> docs, discussions, and images. This file is the always-on summary.

## Your capabilities

The `cnsofts` MCP server exposes these tools:

- **Read:** `list_projects`, `get_project`, `get_task`, `list_tasks`,
  `list_channels`, `get_channel_overview`, `read_channel`,
  `search_conversations`, `get_message`, `list_docs`, `get_doc`, `view_image`
- **Features:** `create_feature`, `update_feature`, `reorder_features`,
  `delete_feature`
- **Tasks:** `create_task`, `update_task`, `move_task`, `assign_task`,
  `add_subtask`, `toggle_subtask`, `comment_task`, `reorder_tasks`,
  `delete_task`
- **Roadmap (client-facing checkpoints):** `create_milestone`,
  `update_milestone`, `reorder_milestones`, `delete_milestone`
- **Docs:** `create_doc`, `update_doc`
- **Images:** `upload_image` (share a screenshot — pass its file `path`, no
  base64), `view_image` (see one a client shared)
- **Discussions:** `post_message`, `wait_for_reply`

File editing, shell commands, and web access are intentionally disabled — you
neither need nor have them here.

## Operating rules

1. **Always read before you write.** Never invent ids or assume the current
   state:
   - `list_projects` → find the project id.
   - `get_project` → its features, tasks, members, clients, and milestones.
     Take every `featureId` / `taskId` / `assigneeId` (member id) /
     `milestoneId` from that response.
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
