---
name: cloudnsofts
description: Drive the CloudNSofts project tracker through its `cnsofts` MCP tools — kanban boards (features + tasks), the client-facing roadmap (checkpoints), documentation pages, and discussion channels. Use whenever the request is about a CloudNSofts project: creating/updating/moving/assigning tasks, editing features or the roadmap, writing docs, posting to channels, reading a conversation, or understanding a screenshot a client shared.
---

# CloudNSofts project tracker

You manage a CloudNSofts project **entirely through the `cnsofts` MCP tools** —
there is no filesystem, shell, or web access in this workspace. Every tool acts
**as the connected user**, with exactly their permissions.

## The one rule: read before you write

Never invent ids or assume state. IDs (`projectId`, `featureId`, `taskId`,
`memberId`, `milestoneId`, `channelId`, `docId`) always come from a read tool.

1. `list_projects` → the project id.
2. `get_project` → features, tasks, members, clients, **milestones**. Take every
   id you need from here.
3. `list_channels` → a channel id before `post_message`.

When updating, **read the item first** (`get_task`, `get_doc`, …) — updates are
partial, so send only the fields you mean to change. If something you expected
is missing, re-read instead of guessing. If a call is rejected, report it — do
not try to work around a permission you don't have.

## Tool map

**Read** · `list_projects` · `get_project` · `get_task` · `list_tasks` ·
`list_channels` · `get_channel_overview` · `read_channel` ·
`search_conversations` · `get_message` · `list_docs` · `get_doc` · `view_image`

**Features** (kanban swimlanes) · `create_feature` · `update_feature` ·
`reorder_features` · `delete_feature`

**Tasks** · `create_task` · `update_task` · `move_task` · `assign_task` ·
`add_subtask` · `toggle_subtask` · `comment_task` · `reorder_tasks` ·
`delete_task`

**Roadmap** (client-facing checkpoints) · `create_milestone` ·
`update_milestone` · `reorder_milestones` · `delete_milestone`

**Docs** · `create_doc` · `update_doc` (+ `list_docs` / `get_doc`)

**Images** · `upload_image` · `view_image`

**Discussions** · `post_message` · `wait_for_reply`

`delete_*` tools require a token granted delete access; without it they return a
clear 403 — don't retry.

## Board work

- A **feature** is a swimlane that groups tasks; a **task** belongs to at most
  one feature (`featureId`) and can have several assignees (`assigneeIds`, member
  ids from `get_project`).
- Move a task across columns with `move_task` (status = `todo` / `in_progress` /
  `in_review` / `done`); `reorder_tasks`/`reorder_features` take the **full,
  final** ordered list of ids.
- `update_task` accepts an optional `expectedUpdatedAt` (from `get_task`) for
  optimistic concurrency — pass it to avoid clobbering a concurrent edit.

## Roadmap — keep the client informed

The roadmap is a **client-facing** timeline of checkpoints (milestones). Each has
a title, description, `dueDate` (YYYY-MM-DD), and a status:
`upcoming → in_progress → done`. `get_project` returns them under `milestones`.

- Add delivery markers with `create_milestone`; keep the order with
  `reorder_milestones`.
- **Move a checkpoint to `done` as work actually ships** — that stamps the
  delivered date the client sees. Keep dates honest and current.

## Docs — durable knowledge

Docs are long-form markdown pages: architecture, onboarding, decisions, a running
status overview. When asked to "write it up", "document", or leave a page for the
team, put it in a **doc**, not a chat message.

- `get_doc` **before** `update_doc` — the body you send **replaces** the old one,
  so preserve what you're not changing.
- Docs render `#`/`##`/`###` headings and images. To embed a screenshot, call
  `upload_image` (see below) and paste the `![alt](url)` snippet it returns into
  the doc body.
- A checkpoint has no doc-link field — if a doc relates to a roadmap checkpoint,
  just mention the checkpoint by name in the doc's text.

## Discussions — talk like a human

Conversations get long; reading a whole channel is slow and expensive.

- `get_channel_overview` first — counts, participants, recent previews.
- `search_conversations` to find where a topic was discussed (searches channel
  messages **and** task threads) instead of reading everything.
- `read_channel` returns a small recent page with `nextCursor`; page older only
  when you actually need to.
- Keep every message you post **SHORT**. Do the work on the board and post a
  one- or two-line update that points to it — never paste task lists, status
  reports, or plans into chat. That content belongs on the board or a doc.

**Live reply-loop** — only for an active back-and-forth where someone is at the
keyboard: `post_message`, then `wait_for_reply(channelId, afterMessageId,
timeoutSeconds)` which blocks server-side (free while blocked) until someone
replies or it times out. It is **not** a background watch — every wake re-reads
the conversation and costs tokens, so don't idle on it.

## Images — see, share & quality

Images are embedded in message/doc bodies as `![alt](/api/images/<id>)`. In the
web app they open in a fullscreen zoomable viewer on click — in a doc **and** in
a discussion — so upload at real quality; don't pre-shrink for the reader.

- **A client shared a screenshot?** Call `view_image` with its path (or the bare
  `<id>`) to actually **see** it before acting on what they mean.
- **Sharing your own screenshot?** Save it to a file, then call `upload_image`
  with its **`path`** (a local file, or an http(s) URL) — the server reads the
  bytes itself, so you **never paste base64**. It returns a ready `![alt](url)`
  snippet; drop that into a `post_message` body or a doc. (`data` base64 is a
  fallback only when you have no file access.)

**Quality controls — get these right:**

- **Upload full resolution.** With `path` there is no base64 token cost and no
  corruption, so send the real file. Do **not** downscale or drop quality to
  "make it fit" — that was only ever a base64 workaround and is now wrong.
- **Formats:** PNG, JPEG, GIF, WebP only. Use **PNG** for UI/screenshots/diagrams
  (crisp text and lines); **JPEG** for photographs (smaller for the same look).
- **Size limit: 8 MB per image.** Only if a file exceeds that, reduce it — resize
  the dimensions (or re-encode a photo as JPEG), don't crush quality to a blur.
- `mimeType` is inferred from the file extension — set it only for an
  extension-less path. Always give a short, meaningful **`alt`** (it's the
  caption in the viewer and what a future reader/agent sees).

## Recipes

**"Add a task 'Wire up billing' to the Payments feature, assign to Dana."**
1. `list_projects` → project id. 2. `get_project` → Payments `featureId` + Dana's
member id. 3. `create_task` with that `featureId` and `assigneeIds:[danaId]`.
4. Report the created task.

**"The client says the header looks wrong — see the screenshot they posted."**
1. `get_channel_overview` / `read_channel` → find their message with
`![...](/api/images/…)`. 2. `view_image` on that path → look at it. 3. Act on the
board (e.g. `create_task`) and post a short reply pointing to it.

**"Document the auth flow and put the diagram in it."**
1. `upload_image` with the diagram's file `path` → get its markdown. 2.
`create_doc` with a clear title and a body that uses `##` headings and embeds
that image.

**"We shipped the beta — update the roadmap."**
1. `get_project` → the checkpoint's `milestoneId`. 2. `update_milestone` status
→ `done`. 3. Post a one-line note in the client channel.
