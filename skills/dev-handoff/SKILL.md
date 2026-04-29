---
name: dev-handoff
description: Hand off a design, selection, or raw note to engineering as a backlog ticket on GitHub or Jira. Pulls context from the active Figma selection / node, or accepts free-form text, then creates a simple backlog card. If the ClaudeOps-plugin `/create-ticket` skill is installed, delegates to it; otherwise creates the ticket directly via `gh` (GitHub) or the Atlassian MCP (Jira).
argument-hint: "[\"note\" | node-id | figma URL] — optional. If omitted, the agent reads the active Figma selection from handoff context or asks for context."
---

# /dev-handoff

Turn whatever is currently in the designer's head — a selected Figma frame, a highlighted component, or a quick typed note — into a backlog card for the engineering team. The skill keeps the conversation short: gather context, confirm the target platform (**GitHub** or **Jira**) and the destination project/repo, then write the ticket.

> **Companion to ClaudeOps-plugin `/create-ticket`.** If the ClaudeOps agent workflow is installed in this workspace, `/dev-handoff` forwards the assembled context straight into `/create-ticket` so the ticket lands in the team's sprint folder + project board. When ClaudeOps is **not** installed, `/dev-handoff` falls back to a direct platform create (GitHub `gh issue create` or Atlassian MCP `createJiraIssue`) so designers are never blocked.

---

## Interactive input contract

Whenever this skill needs a **platform**, **repo / project key**, **ticket type**, **title**, or clarification about the context source, use **AskUserQuestion** — **one tool call per question**. Wait for each answer before the next. Do not print multi-part prompts as plain markdown before the first AskUserQuestion.

The **only** decisions this skill should ever ask about are:

1. Whether to include additional typed notes alongside the Figma context (if a Figma node is available).
2. **Platform** — GitHub or Jira.
3. **Destination** — repo (GitHub) or project key (Jira).
4. **Ticket type / label** — only when the downstream system requires it. ClaudeOps supports `ctx | bug | wo`; **`ctx` (context) is the recommended default for designer handoffs** — it captures design context without committing engineering to a specific work order or bug. Jira issue type prompts stay as `Task | Bug | Story`.

Everything else (title, description body, Figma link, screenshot reference) is derived automatically from the gathered context.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Figma MCP connector configured | Only required when the context source is a Figma node. Used for `get_design_context` + `get_screenshot`. |
| `gh` CLI authenticated | Required only for the GitHub fallback path (no ClaudeOps). Check with `gh auth status`. |
| Atlassian MCP connector | Required only for the Jira fallback path (no ClaudeOps). Tools used: `getAccessibleAtlassianResources`, `getVisibleJiraProjects`, `createJiraIssue`. |
| ClaudeOps-plugin (optional) | When installed, the skill delegates via `/create-ticket` instead of calling GitHub/Jira directly. Detection rules in Step 3 — includes Cursor and IDEs where the workflow repo is not the workspace root (see *Cursor / non–Claude Code hosts* under Step 3). |

**MCP payloads:** Pass any Figma `use_figma` / Atlassian tool payloads **inline** in each call. Do **not** stage `.mcp-*` or `*-payload.json` scratch files in this repo ([`AGENTS.md`](../../AGENTS.md)).

---

## Steps

### Step 1 — Gather context

Resolve context in this priority order and stop at the first source that yields a usable payload:

1. **`$ARGUMENTS` — raw text.** If `$ARGUMENTS` contains prose (anything that is **not** a single `\d+:\d+` node ID or a `figma.com/...` URL), treat it as the ticket body. Record it as `raw_note` and skip to Step 2.
2. **`$ARGUMENTS` — Figma reference.** If `$ARGUMENTS` contains a `figma.com/design/...?node-id=...` URL, extract `file_key` and `node_id` (URL-decode `%3A` → `:`). If `$ARGUMENTS` is a bare `\d+:\d+`, treat it as `node_id` and read `file_key` from `plugin/templates/agent-handoff.md` (`active_file_key`).
3. **Handoff context.** If `$ARGUMENTS` is empty, read `plugin/templates/agent-handoff.md`. If `active_file_key` is set and `open_items` mentions a recent selection / node, propose it with **AskUserQuestion**: *"Use the last worked frame `{name}` (`{node_id}`) from the current session, or provide a different source?"*.
4. **Prompt the designer.** If none of the above yield a source, call **AskUserQuestion**:
   > "What should land in the backlog? Paste a Figma node ID, a figma.com URL, **or** a free-form description of the work."

If the designer pastes more than one kind of input (e.g. a node ID **and** a note), accept both — store the node as the design reference and the note as `raw_note`.

### Step 2 — Enrich Figma context (conditional)

Run this step only when Step 1 produced a `node_id` + `file_key`.

1. Call `mcp__claude_ai_Figma__get_design_context` with `{ fileKey: file_key, nodeId: node_id }`. Capture:
   - `name` — frame / component name (used as the default ticket title).
   - `type` — `FRAME`, `COMPONENT`, `INSTANCE`, etc. (used to phrase the description).
   - A compact layer summary (top-level children + any `TEXT` node contents, capped at ~25 items).
2. Call `mcp__claude_ai_Figma__get_screenshot` with the same `{ fileKey, nodeId }`. Record the returned image URL / data reference as `screenshot_ref`. If the call fails, continue without a screenshot — do not block.
3. Build the canonical Figma link: `https://www.figma.com/design/{file_key}?node-id={node_id_with_dash}` where `{node_id_with_dash}` replaces `:` with `-` (Figma's deep-link form).
4. If the designer has not yet volunteered a note, call **AskUserQuestion** once:
   > "Anything to add for the engineer picking this up? (Acceptance criteria, edge cases, priority hints — or reply **skip**.)"
   Store the answer as `raw_note` unless they reply **skip**.

### Step 3 — Detect ClaudeOps `/create-ticket`

Goal: set `claude_ops_available` when delegation to `/create-ticket` is actually possible **or** when the designer explicitly asks for it. Claude Code often has the **consumer repo** open, so Sprint folders + templates exist at workspace root. **Cursor** may open only this plugin repo (or another app): Steps 1–3 below can all be false even though **`create-ticket` is on disk** under `~/.claude/plugins/marketplaces/.../labs-agent-workflow/` **or** listed in the host **agent skills** registry — use Steps 4–6 so `/dev-handoff` does not false-negative.

**Overrides ($ARGUMENTS):**

- If `$ARGUMENTS` contains **`--skip-claude-ops`**, set `claude_ops_available = false` and skip directly to Step 5 (same as today).
- Else if `$ARGUMENTS` contains **`--use-claude-ops`** or **`--force-claude-ops`**, set `claude_ops_available = true` and proceed to Step 4 — **unless** `--skip-claude-ops` is also present (`--skip-claude-ops` wins).

**Automatic signals** — evaluate after overrides; if **any** check passes, set `claude_ops_available = true`:

1. A directory matching `.github/Sprint */` exists at **some workspace folder root**. **Use Glob**, not `find` — e.g. pattern `.github/Sprint */` scoped to workspace roots (multi-root workspaces count).
2. `.github/templates/work_order.md` **or** `.github/templates/bug_report.md` exists under **any** workspace folder (same Glob approach).
3. `.claude-plugin/plugin.json` at **some** workspace root declares `labs-agent-workflow` as a dependency, or `claude plugin list` includes that marketplace plugin when the CLI is available.
4. **Marketplace / plugin checkout on disk (Cursor-friendly):** Glob `**/labs-agent-workflow/**/skills/create-ticket/SKILL.md` across workspace folders — **any** hit → ClaudeOps available. If that misses (folder naming differs), Glob `**/skills/create-ticket/SKILL.md` and treat as available **only when** the matching path contains `labs-agent-workflow` **or** `.claude/plugins` / `plugins/marketplaces` (marketplace cache layout).
5. **Host skill injection (Cursor / Composer):** If the runtime exposes **`agent_skills`**, **`available_skills`**, or equivalent metadata listing **`create-ticket`** from **labs-agent-workflow** (path ending in `skills/create-ticket/SKILL.md` or skill id/name `create-ticket`), set `claude_ops_available = true` — **without** requiring `.github/Sprint` in the same workspace.

If none of the automatic signals fired and no `--use-claude-ops` flag was passed, set `claude_ops_available = false` and skip directly to Step 5.

**Cursor / non–Claude Code hosts:** To make Step 4’s **skill-proxy** path work, the agent must be able to **Read** `skills/create-ticket/SKILL.md`. Use **File → Add Folder to Workspace** and add the folder that contains **`labs-agent-workflow`** (for example the local marketplace copy: `%USERPROFILE%\.claude\plugins\marketplaces\local-desktop-app-uploads\labs-agent-workflow\` on Windows, or `~/.claude/plugins/marketplaces/.../labs-agent-workflow/` on macOS/Linux). That gives Step 4 a resolvable path even when the active project is not a ClaudeOps checkout. If the designer cannot add that folder, they can still pass **`--use-claude-ops`** after confirming **`create-ticket`** appears in **agent_skills**, and the agent follows Step 4 using the injected skill path when the host provides it. **Cursor:** workspace + **`agent_skills`** parity for **all** plugin skills is covered by [`.cursor/rules/cursor-designops-skill-root.mdc`](../../.cursor/rules/cursor-designops-skill-root.mdc) (**Companion marketplace plugins**, **skills registry vs workspace**, **cross-plugin delegation**).

**Engineering repo vs plugin:** Delegation still needs the **ticket backend** and sprint layout from the **team’s repo** (ClaudeOps `.github/templates/workflow.md`, Sprint folders). If only the marketplace plugin folder is in the workspace, **`create-ticket`** may prompt for paths or fail until the **consumer repo** root is also added — `/dev-handoff` does not duplicate that repo detection; see ClaudeOps `create-ticket` skill Steps 1–10.

### Step 4 — Delegate to ClaudeOps `/create-ticket`

> This path keeps the designer inside the team's normal sprint + project-board flow — `/create-ticket` owns folder creation, GitHub issue, and project-board sync.

1. Derive a **title**: if a Figma node was enriched in Step 2, use its `name` (e.g. `"Login Screen — onboarding checklist"`); otherwise derive a ≤ 80-char summary from `raw_note` (first sentence, trimmed).
2. Ask for **ticket type** with **AskUserQuestion**. ClaudeOps supports three types and `/dev-handoff` recommends **`ctx`** for designers — it captures design context as a standalone backlog card without implying a committed work order or an active bug. `ctx` tickets intentionally do **not** get a `plan.md` — they stay in the **Context Backlog** until an engineer (or `/create-backlog` groomer) promotes them via `/create-ticket promote CTX-###`:

   > "What kind of ticket is this?
   > &nbsp;&nbsp;• **ctx** — Context card (recommended for design handoffs — attaches the Figma frame + notes so engineering can scope from it later)
   > &nbsp;&nbsp;• **wo** — Work order (a concrete task engineering should pick up)
   > &nbsp;&nbsp;• **bug** — Bug report (something broken that needs fixing)"

   Present the three options in the AskUserQuestion payload with `ctx` listed first (and marked as the default / recommended choice). Accept `ctx`, `context`, `wo`, `work-order`, `bug`, or `bug-report` and normalise to one of `ctx | wo | bug` before passing downstream. If the designer replies with anything else, re-ask once with the same three options.
3. Compose the body:

   ```md
   ## Context

   {raw_note or "(no additional notes)"}

   ## Design reference

   - Figma: {figma_link}           ← omit this block if no Figma node
   - Frame name: {name}
   - Frame type: {type}
   - Screenshot: {screenshot_ref}  ← omit line if unavailable

   ## Layer summary

   - ... top-level layer summary (from Step 2.1) ...
   ```

4. Invoke `/create-ticket` with the collected values. Two supported invocation shapes — use whichever your runtime exposes:

   **Slash-command delegation (preferred when available):**
   ```
   /create-ticket {ctx|wo|bug} "{title}"
   ```
   The ClaudeOps `/create-ticket` skill will prompt for anything missing. When it asks for the ticket body, paste the composed body verbatim. ClaudeOps already knows the backend (GitHub vs Jira) from `.github/templates/workflow.md` → `## Ticket Backend`, so `/dev-handoff` does **not** ask about platform when delegating — skip straight past Step 5.

   **Skill-proxy delegation:** If the runtime only exposes ClaudeOps skills as a file path (e.g. via the `agent_skills` registry), **`Read`** `skills/create-ticket/SKILL.md` — prefer the path **discovered in Step 3** (Glob hit or `agent_skills` entry for **labs-agent-workflow**) — and follow its Steps 1–10 inline with the values collected above.

5. Capture the returned ticket ID, folder path, GitHub issue URL, and project-board item ID from `/create-ticket`, then jump to Step 7.

### Step 5 — Platform prompt (fallback path only)

Runs only when `claude_ops_available == false`.

Call **AskUserQuestion**:

> "Where should this ticket land? Reply **github** for a GitHub issue, or **jira** for a Jira backlog card."

Store the answer as `platform` (`github` | `jira`). Proceed to Step 5a or 5b.

### Step 5a — GitHub direct path

1. Verify `gh` is authenticated: `gh auth status`. If it fails, surface the error to the designer with the login hint (`gh auth login`) and stop.
2. Ask for the **repo** with **AskUserQuestion**:
   > "Which GitHub repo owns this work? Reply with `owner/repo` (e.g. `detroitlabs/acme-mobile`), or **list** to pick from your recent repos."
   - If the designer replies **list**, run `gh repo list --limit 20 --json nameWithOwner -q '.[].nameWithOwner'`, present the rows, and ask again for the exact `owner/repo`.
3. Optionally ask for labels with **AskUserQuestion** (one call, comma-separated reply, may be empty):
   > "Any labels? (comma-separated, e.g. `design,backlog`) — reply **skip** for none."
4. Build `--title` from the same rule as Step 4.1. Build `--body` from the template in Step 4.3.
5. Run:
   ```bash
   gh issue create \
     --repo "{owner/repo}" \
     --title "{title}" \
     --body "{body}" \
     [--label "{label1}" --label "{label2}" ...]
   ```
   Capture the printed issue URL and proceed to Step 7.

### Step 5b — Jira direct path

1. Call Atlassian MCP `getAccessibleAtlassianResources` to list Jira sites. Record each `{ id, name, url }` tuple. If only one site is returned, use its `id` as `cloudId` without prompting. Otherwise call **AskUserQuestion**:
   > "Which Atlassian site? Reply with the site name."
   Resolve the chosen name back to its `cloudId`.
2. Call `getVisibleJiraProjects` with the resolved `cloudId`. Present a short list of `{KEY} — {name}` rows (cap at 20). Call **AskUserQuestion**:
   > "Which Jira project? Reply with the project key (e.g. `DESIGN`, `MOB`)."
3. Ask for **issue type** with **AskUserQuestion**:
   > "Issue type? Reply **Task**, **Bug**, or **Story**."
   (Default to `Task` if the project's metadata does not expose the chosen type; fall back to the first type returned by `getJiraProjectIssueTypesMetadata` if needed.)
4. Build `summary` from the title rule (Step 4.1). Build `description` from the template in Step 4.3 using `contentFormat: "markdown"`.
5. Call `createJiraIssue` with:
   ```json
   {
     "cloudId": "{cloudId}",
     "projectKey": "{KEY}",
     "issueTypeName": "{Task|Bug|Story}",
     "summary": "{title}",
     "description": "{body}",
     "contentFormat": "markdown"
   }
   ```
6. Capture the returned issue key (e.g. `DESIGN-482`) and browse URL. Proceed to Step 7.

### Step 6 — (reserved)

_Intentionally left blank — numbering preserved so future changes can slot in a "confirm before submit" gate without renumbering downstream steps._

### Step 7 — Report + handoff

Print a compact confirmation block to the designer:

```
Ticket created via: {claude-ops | github | jira}
Title:              {title}
Destination:        {owner/repo | PROJECT-KEY}
URL:                {issue_url}
{if claude-ops:}  Sprint folder: {folder_path}
{if claude-ops:}  Project item: {project_item_id}
Figma:              {figma_link or "(none)"}
```

Update `plugin/templates/agent-handoff.md` frontmatter:

```yaml
last_skill_run: "dev-handoff"
```

Append to `open_items`:

- `"Dev handoff created: {ticket_id_or_url}"`
- If a Figma node was attached: `"Linked Figma node: {node_id} on file {file_key}"`
- **If the ticket type was `ctx`** (ClaudeOps path): add `"Awaiting triage — promote via /create-ticket promote {TICKET-ID} when scoped"` so the next skill run reminds the team the card is still in the Context Backlog.

Finally, offer a one-line follow-up with **AskUserQuestion**:
> "Hand off another item? Reply **yes** to start a new `/dev-handoff`, **no** to stop."

---

## Title derivation rules

The skill never asks the designer for the ticket title — it derives one from the available context:

1. **Figma node with a name** → use the node name verbatim, trimmed to 80 chars.
2. **Raw note only** → take the first sentence of `raw_note`, trim to 80 chars; if the first sentence is longer, hard-truncate at the last word boundary and append `…`.
3. **Both** → prefer the Figma node name, then append `" — "` plus the first 3–5 words of the note for flavour (still capped at 80 chars total).

If the derived title is empty (edge case — empty note, unnamed frame), fall back to:
```
Design handoff — {YYYY-MM-DD}
```

## Body template

The composed body is shared across all three creation paths (ClaudeOps, GitHub, Jira):

```md
## Context

{raw_note or "(no additional notes)"}

## Design reference

- **Figma:** {figma_link}
- **Frame:** {name} ({type})
- **Screenshot:** {screenshot_ref}

## Layer summary

{bulleted summary of top-level children / text nodes from get_design_context — omit block entirely if no Figma node}

---

_Created via `/dev-handoff` — DesignOps plugin._
```

Omit any section whose inputs are missing; never render an empty heading.

---

## Notes and limitations

- **No binary attachments.** The skill embeds the screenshot as a Figma-hosted URL or an MCP reference — it does not upload raster files to Jira or GitHub. If a team requires an attached PNG, the designer should drop the screenshot onto the created ticket manually.
- **Ticket type mapping.** ClaudeOps uses `ctx | wo | bug` (designer handoffs should default to **`ctx` — context**); Jira uses `Task | Bug | Story`; GitHub uses labels. The skill asks the minimum question for the chosen path and avoids cross-mapping automatically — the designer controls the taxonomy per platform.
- **Why `ctx` is the recommended type for designers.** A `ctx` card is a deliberate "here's the design, here's what's decided, here's what's still open" drop into the Context Backlog. It does not imply engineering has committed to a timebox (unlike a `wo`) and it does not imply something is broken (unlike a `bug`). ClaudeOps' `/create-ticket` deliberately skips `plan.md` generation for `ctx` tickets and parks them on the **Context Backlog** column / label (`phase:context-backlog`). During grooming, an engineer runs `/create-ticket promote CTX-###` — ClaudeOps converts the folder to `BUG-###` or `WO-###`, preserves the original CTX body inside a `<details>` block, keeps the same remote issue (just relabels + renames it), and leaves a tombstone file behind so the CTX number is never reused. `/dev-handoff` intentionally does **not** invoke `promote` — that's a deliberate engineering decision, not a designer one.
- **Permissions.** The skill does not re-authenticate any connector. If `gh auth status`, the Atlassian MCP, or ClaudeOps delegation fails, the agent surfaces the error text + the remediation command and stops — it does not silently retry with a different path.
- **Detection vs delegation.** Step 3's detection is heuristic. **`--skip-claude-ops`** forces the GitHub/Jira fallback. **`--use-claude-ops`** / **`--force-claude-ops`** forces the ClaudeOps path when the agent can follow Step 4 (slash command or **`Read`** + inline **`create-ticket`** steps). **`agent_skills`** / Glob **`create-ticket`** detection fixes false negatives in Cursor when the workflow repo is not at workspace root but the marketplace plugin is installed or added as a workspace folder.
- **Repeat runs.** Re-running `/dev-handoff` against the same Figma node is allowed — it simply creates a second ticket. Dedupe is the responsibility of the destination platform.
