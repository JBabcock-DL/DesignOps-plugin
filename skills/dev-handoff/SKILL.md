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

1. **Platform** — GitHub or Jira (fallback / recovery paths when not delegating to ClaudeOps).
2. **Destination** — repo (GitHub) or project key (Jira) (same).
3. **Ticket type / label** — when delegating to **ClaudeOps `/create-ticket`**, ask **before** the “anything additional for the engineer?” question (Step 4) so the body scaffold matches `ctx` / `wo` / `bug`. ClaudeOps supports `ctx | bug | wo`; **`ctx` (context) is the recommended default for designer handoffs**. On the **Jira fallback** path (Step 5b), **never** assume `Task` / `Bug` / `Story`: call **`getJiraProjectIssueTypesMetadata`** for the chosen project **first**, then AskUserQuestion with **only** names returned (same rule as **`/create-ticket`** on Jira).
4. **Additional notes for the engineer** — **after** ticket type on the ClaudeOps path (Step 4). On the fallback path, gather any missing prose when composing the body in Step 5 — **after** platform and destination (and Jira issue type when applicable).

Everything else (title, description body, Figma link, screenshot reference) is derived automatically from the gathered context.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Figma MCP connector configured | Only required when the context source is a Figma node. Used for `get_design_context` + `get_screenshot`. |
| `gh` CLI authenticated | Required only for the GitHub fallback path (no ClaudeOps). Check with `gh auth status`. |
| Atlassian MCP connector | Required only for the Jira fallback path (no ClaudeOps). Tools used: `getAccessibleAtlassianResources`, `getVisibleJiraProjects`, `getJiraProjectIssueTypesMetadata`, `createJiraIssue`. |
| ClaudeOps-plugin (optional) | When installed, the skill delegates via `/create-ticket` instead of calling GitHub/Jira directly. Detection rules in Step 3 apply in **Claude Code**, **Cursor**, and other IDEs (see *Hosts and `Read` paths* under Step 3). |

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
4. **Do not** prompt here for “anything to add for the engineer.” Step 3 has not run yet — defer that prompt to **after** ticket type in Step 4 (ClaudeOps), or to Step 5 when building the body on the fallback path, so the question always lands on the correct template shape.

### Step 3 — Detect ClaudeOps `/create-ticket`

Goal: set `claude_ops_available` when delegation to `/create-ticket` is actually possible **or** when the designer explicitly asks for it. **Claude Code** often has the **consumer repo** open, so Sprint folders + templates exist at workspace root — but agents can still **Glob** before consulting the session’s skills list and false-negative. **Any** host (**Claude Code**, **Cursor**, other) that injects a **skills / `agent_skills`** listing: item 1 (**host skills registry**) is **authoritative** when it shows **`create-ticket`** from **`labs-agent-workflow`** — evaluate it **before** filesystem **Glob** so `/dev-handoff` does not skip delegation.

**Overrides ($ARGUMENTS):**

- If `$ARGUMENTS` contains **`--skip-claude-ops`**, set `claude_ops_available = false` and skip directly to Step 5 (same as today).
- Else if `$ARGUMENTS` contains **`--use-claude-ops`** or **`--force-claude-ops`**, set `claude_ops_available = true` and proceed to Step 4 — **unless** `--skip-claude-ops` is also present (`--skip-claude-ops` wins).

**Automatic signals** — evaluate after overrides, **in numbered order**. If **any** check passes, set `claude_ops_available = true` **and skip the remaining checks**, except you may still **resolve a `Read` path** for Step 4 from item 1.

1. **Host skills registry (mandatory — run before any filesystem Glob):** If the runtime exposes **`agent_skills`**, **`available_skills`**, **`availableSkills`**, Claude Code / Cursor **Skills** metadata, or any equivalent listing of installed marketplace skills, inspect it for **`create-ticket`** from **`labs-agent-workflow`** (e.g. `fullPath` containing `labs-agent-workflow` … `skills/create-ticket/SKILL.md`, or skill name/id **`create-ticket`** for that plugin). **If present:** set `claude_ops_available = true`. **Do not** conclude ClaudeOps is absent because **`Glob`** failed — registry paths are often **absolute** and outside the open repo. For Step 4 **`Read`**, use that **absolute `fullPath`** (or the nearest path the listing resolves) verbatim. Only if **no** such listing exists in the session context, continue to item 2.
2. A directory matching `.github/Sprint */` exists at **some** workspace folder root. **Use Glob**, not `find` — e.g. pattern `.github/Sprint */` scoped to workspace roots (multi-root workspaces count).
3. `.github/templates/work_order.md` **or** `.github/templates/bug_report.md` exists under **any** workspace folder (same Glob approach).
4. `.claude-plugin/plugin.json` at **some** workspace root declares `labs-agent-workflow` as a dependency, or `claude plugin list` includes that marketplace plugin when the CLI is available (from a workspace root).
5. **Marketplace / plugin checkout on disk (workspace Glob):** Across **workspace folder roots** (multi-root counts), Glob `**/labs-agent-workflow/**/skills/create-ticket/SKILL.md` — **any** hit → ClaudeOps available. If that misses (folder naming differs), Glob `**/skills/create-ticket/SKILL.md` and treat as available **only when** the matching path contains `labs-agent-workflow` **or** `.claude/plugins` / `plugins/marketplaces` (marketplace cache layout).

If none of the automatic signals fired and no `--use-claude-ops` flag was passed, set `claude_ops_available = false` and skip directly to Step 5.

**Backend precheck (mandatory before setting `claude_ops_available = true`):** After any signal above would set `claude_ops_available = true`, resolve `workflow.md` per `skills/conventions/01-plugin-root-and-templates.md` in the **`labs-agent-workflow`** plugin. Read the **Backend:** field under **## Ticket Backend**. If the value is `[CONFIGURE: github | jira]`, blank, or the file is unreachable, set `claude_ops_available = false` immediately — do **not** surface this as an error to the designer; fall directly to Step 5. The direct-create path handles unconfigured backends gracefully. Only proceed to Step 4 when a real `github` or `jira` backend is confirmed.

**Hosts and `Read` paths (Claude Code + Cursor):** **Claude Code** resolves plugin **`skills/`** via **`${CLAUDE_PLUGIN_ROOT}`** per installed plugin — paths from **item 1** usually **`Read`** cleanly. **Cursor** (and any host where **Glob** does not see `~/.claude/plugins/...` unless added as a workspace root): **File → Add Folder to Workspace** — add the folder that contains **`labs-agent-workflow`** (e.g. local marketplace copy: `%USERPROFILE%\.claude\plugins\marketplaces\local-desktop-app-uploads\labs-agent-workflow\` on Windows, or `~/.claude/plugins/marketplaces/.../labs-agent-workflow/` on macOS/Linux) so Step 4 can **`Read`** `skills/create-ticket/SKILL.md` when the listing path is not enough. If the designer cannot add that folder, they can still pass **`--use-claude-ops`** after **`create-ticket`** appears in the session listing. **Cursor-only** workspace + registry notes: [`.cursor/rules/cursor-designops-skill-root.mdc`](../../.cursor/rules/cursor-designops-skill-root.mdc) (**Companion marketplace plugins**, **skills registry vs workspace**, **cross-plugin delegation**).

**Plugin-first `workflow.md` (designers run from any repo):** Designers may open **any** git repo — **including empty or scratch folders** — and invoke **`/dev-handoff`**. They do **not** need **`.github/templates/workflow.md`** (or Sprint folders) **in that repo**. Claude Code resolves **`workflow.md`** from the **`labs-agent-workflow`** plugin installation (**`${CLAUDE_PLUGIN_ROOT}`** / marketplace folder); **`create-ticket`** follows **`skills/conventions/01-plugin-root-and-templates.md`** in the **ClaudeOps-plugin** repo for bundled **`templates/workflow.md`**, optional **`CLAUDE_OPS_PLUGIN_ROOT`**, and Glob-based discovery — **never** commit machine-specific paths in projects. **Team overrides** may still live under **`${cwd}/.github/templates/`** when present. **`/dev-handoff`** must **not** treat “no **`workflow.md`** under cwd” as proof that delegation cannot run — verify **`skills/create-ticket/SKILL.md`** and that convention before Step 4.5.

### Step 4 — Delegate to ClaudeOps `/create-ticket`

> This path keeps the designer inside the team's normal sprint + project-board flow — **`create-ticket`** owns folder creation, GitHub issue, and project-board sync. **`workflow.md`** and backend defaults come from the **`labs-agent-workflow`** plugin when cwd does not ship them — **do not** assume failure because **`./.github/templates/workflow.md`** is missing (see Step 3 **Plugin-first `workflow.md`**). If **`create-ticket`** still exits without a ticket after following **`skills/create-ticket/SKILL.md`** (including plugin-root resolution), continue at **Step 4.5**.

1. Derive a **title**: if a Figma node was enriched in Step 2, use its `name` (e.g. `"Login Screen — onboarding checklist"`); otherwise derive a ≤ 80-char summary from `raw_note` (first sentence, trimmed).
2. Ask for **ticket type** with **AskUserQuestion**. ClaudeOps supports three types and `/dev-handoff` recommends **`ctx`** for designers — it captures design context as a standalone backlog card without implying a committed work order or an active bug. `ctx` tickets intentionally do **not** get a `plan.md` — they stay in the **Context Backlog** until an engineer (or `/create-backlog` groomer) promotes them via `/create-ticket promote CTX-###`:

   > "What kind of ticket is this?
   > &nbsp;&nbsp;• **ctx** — Context card (recommended for design handoffs — attaches the Figma frame + notes so engineering can scope from it later)
   > &nbsp;&nbsp;• **wo** — Work order (a concrete task engineering should pick up)
   > &nbsp;&nbsp;• **bug** — Bug report (something broken that needs fixing)"

   Present the three options in the AskUserQuestion payload with `ctx` listed first (and marked as the default / recommended choice). Accept `ctx`, `context`, `wo`, `work-order`, `bug`, or `bug-report` and normalise to one of `ctx | wo | bug` before passing downstream. If the designer replies with anything else, re-ask once with the same three options.
3. **Additional notes for the engineer** — after type is set, call **AskUserQuestion** once:
   > "Anything **additional** for the engineer picking this up? (Acceptance criteria, edge cases, priority hints — or reply **skip**.)"
   Merge the answer into `raw_note` (append if `raw_note` already exists from Step 1; treat **skip** as no change).
4. Compose the body **from the normalized ticket type**. Populate every section richly from available sources — `get_design_context` output, layer summary, `raw_note`, Code Connect hints. **Do not leave sections as bare placeholders when the Figma source provides the information.** A thin body defeats the purpose of the handoff. The target fidelity for a `ctx` ticket from Figma:

   - **Goal** — one focused paragraph naming the exact surface to ship, what it must do, and any key constraints (validation, a11y, routing hooks). Not a vague summary.
   - **Design reference** — table with Figma deep link, file key, node ID, and frame type. Screenshot ref when Step 2 produced one.
   - **Requirements — Functional** — numbered, one requirement per interactive element or behaviour. Cover labels, placeholder copy, validation rules (pattern, min length, required), error states, and submit/CTA logic. Pull exact copy from layer text nodes.
   - **Requirements — Visual / layout** — token-referenced specs: spacing (`--space-*`), radius (`--radius-*`), typography style names, color tokens. Describe card/container treatment, vertical rhythm, and gap between sections. Hard-code hex only when a token cannot be identified.
   - **Requirements — Technical** — Code Connect component targets (`src/components/ui/…`), form library if detectable from the repo, routing expectations, accessibility requirements (`htmlFor`/`id` pairing, `aria-live`, keyboard operability).
   - **Acceptance criteria** — checkbox list. Each item is independently verifiable by QA: visual parity on the design viewport, field-level validation confirmed, submit guard confirmed, a11y smoke (tab order, no traps), token/component reuse confirmed.
   - **Out of scope** — explicit list of what is deliberately excluded (backend integration, i18n, flows not shown in the frame).
   - **Notes for build agent** — concrete file pointers, which primitives to compose from, any CodeConnect snippet notes, pixel-QA method.

   **`ctx`** — Use **Context (`ctx`) — design-handoff scaffold** under **Body template** (DDI-style Goal → Design reference table → Requirements subsections → Acceptance criteria → Out of scope → Notes for build agent). Produce this scaffold **only for `ctx`**; ground copy in **`get_design_context`** / layer summary when Step 2 ran.

   **`wo`** — Use **Work order (`wo`) — handoff scaffold** under **Body template**. Ground user stories, Requirements (Functional / Visual–UX / Technical), and stage blocks in **`get_design_context`**, `raw_note`, and layer summary. Align with ClaudeOps **`work_order.md`** so **`create-ticket`** can drop the same structure into `ticket.md`.

   **`bug`** — Use **Bug (`bug`) — handoff scaffold** under **Body template**. Populate reproduction, expected vs actual, severity, and verification from context; add **Design reference** when Step 2 ran. Align with **`bug_report.md`**.

5. Invoke `/create-ticket` with the collected values. Two supported invocation shapes — use whichever your runtime exposes:

   **Slash-command delegation (preferred when available):**
   ```
   /create-ticket {ctx|wo|bug} "{title}"
   ```
   The ClaudeOps **`create-ticket`** skill resolves **`workflow.md`** from the **`labs-agent-workflow`** plugin (**`${CLAUDE_PLUGIN_ROOT}`**) when the open repo does not contain **`.github/templates/workflow.md`** — designers do **not** need those files in every project. Backend (**GitHub** vs **Jira**) comes from **`## Ticket Backend`** in that resolved **`workflow.md`**. **`/dev-handoff`** does **not** ask about platform when delegating — skip straight past Step 5.

   **Skill-proxy delegation:** If the runtime only exposes ClaudeOps skills as a file path (e.g. Claude Code session skills, **`agent_skills`**, or Cursor **Skills** list), **`Read`** `skills/create-ticket/SKILL.md` — **first** use the path from **Step 3 item 1** (**`fullPath` / injected listing**) when present; else the path discovered by **Glob** in Step 3 items 2–5 — and follow its Steps 1–10 inline, passing these delegation context variables so `create-ticket` skips questions already answered here:

   | Variable | Value |
   |---|---|
   | `DELEGATED_TYPE` | `{ctx\|wo\|bug}` from Step 4.2 |
   | `DELEGATED_TITLE` | derived title from Step 4.1 |
   | `DELEGATED_BODY` | composed body from this step (Step 4.4) |
   | `DELEGATED_BACKEND` | `github` or `jira` from the precheck in Step 3 |

   `create-ticket` reads these and skips re-asking for **workflow ticket type** (`ctx` / `wo` / `bug`), **title**, **body**, and **backend**. On **Jira**, **`/create-ticket`** builds the issue-type list **only** from the Atlassian MCP **`getJiraProjectIssueTypesMetadata`** response for the project — **not** from **`workflow.md`** — then **always** runs **AskUserQuestion** with those MCP-returned names (creatable types for the project — not existing issues). **`/dev-handoff`** does **not** replace that question or supply type names from **`workflow.md`**.

6. Capture the returned ticket ID, folder path, GitHub issue URL, and project-board item ID from `/create-ticket`, then jump to Step 7.

### Step 4.5 — ClaudeOps delegation incomplete (recovery)

Run this when Step 4 **started** but **`create-ticket`** did **not** return a completed ticket (no issue key / URL / folder path from the skill) **after** **`skills/create-ticket/SKILL.md`** has been followed — including **plugin-root resolution of `workflow.md`**. Typical causes:

- **`create-ticket`** runtime error, auth failure, or incomplete Steps 1–10.
- Host cannot **`Read`** **`labs-agent-workflow`** files needed by **`create-ticket`** (add plugin folder to workspace — Step 3).

**Do not** enter Step 4.5 **only** because **`Glob`** found no **`./.github/templates/workflow.md`** under cwd — that is often expected when running from an arbitrary repo.

**Mandatory behavior**

1. Tell the designer in **one short sentence** why **`create-ticket`** did not finish (quote stderr / skill outcome — **not** “your repo lacks **`workflow.md`**” unless **`skills/create-ticket`** confirmed plugin defaults were unreachable).
2. **Fall through to Step 5** with the **same** title, body, and ticket type (**ctx** \| **wo** \| **bug**) already gathered through **Step 4.4** (body composition). If Step 4 failed before ticket type was collected, ask the Step 4.2 question once, then continue (run Step 4.3 → 4.4 when you still need additional notes and composed body).
3. **Do not** call Atlassian MCP (`getAccessibleAtlassianResources`, `getVisibleJiraProjects`, `createJiraIssue`) or run **`gh issue create`** until **after** the Step 5 platform **AskUserQuestion** (and any Step 5a/5b follow-ups). **Never** prefetch Jira sites or projects to “recover” — that bypasses **github vs jira** and Jira site/project picks and leaves the designer without a proper handoff flow.
4. After a successful ticket in this path, Step 7 reports **`Ticket created via: github`** or **`jira`** (not **`claude-ops`**).

### Step 5 — Platform prompt (fallback and recovery)

Runs when **`claude_ops_available == false`** **or** **Step 4.5** applies (ClaudeOps delegation did not complete).

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
4. Build `--title` from the same rule as Step 4.1. Compose `--body` with the scaffold for **`ctx`**, **`wo`**, **`bug`** (**Body template** below); branch **`wo`** vs **`bug`** exactly — do not collapse to a minimal handoff anymore.
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
3. Call **`getJiraProjectIssueTypesMetadata`** with `cloudId` and `projectIdOrKey` = the chosen project **key**. Build **`availableIssueTypeNames`** from every returned issue type **`name`**. If the list is empty, stop with a clear error.
4. Ask for **issue type** with **AskUserQuestion** — **every option must be a name from `availableIssueTypeNames`** built **only** from the MCP response in step 3 (e.g. “Which Jira issue type should this card use?”). **Do not** add options from **`workflow.md`**, README examples, or guesses. If there are too many types for the question UI, paste the sorted MCP list and ask the designer to reply with an exact name from that list; reject until it matches (case-insensitive). Use the **canonical spelling from the metadata response** for `issueTypeName`. Do **not** offer **Task** / **Bug** / **Story** unless those strings appear in **`availableIssueTypeNames`**.
5. Build `summary` from the title rule (Step 4.1). Build `description` per **Step 4.4** and **Body template** (`contentFormat`: `markdown`).
6. Call `createJiraIssue` with:
   ```json
   {
     "cloudId": "{cloudId}",
     "projectKey": "{KEY}",
     "issueTypeName": "{name from step 4 — must match Jira metadata}",
     "summary": "{title}",
     "description": "{body}",
     "contentFormat": "markdown"
   }
   ```
7. Capture the returned issue key (e.g. `DESIGN-482`) and browse URL. Proceed to Step 7.

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

If `plugin/templates/agent-handoff.md` exists, update its frontmatter:

```yaml
last_skill_run: "dev-handoff"
```

And append to `open_items`:

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

Choose **exactly one** downstream shape:

| ClaudeOps ticket type | Body shape | Why |
|---|---|---|
| **`ctx`** | **Context (`ctx`) — design-handoff scaffold** | Intake aligned with ClaudeOps **`context.md`** — **[DDI-style](https://detroitlabs.jira.com/browse/DDI-8)** richness for grooming. |
| **`wo`** | **Work order (`wo`) — handoff scaffold** | Matches **`work_order.md`** — goal, stories, phased requirements, Figma table when applicable, **🔍📋🛠️** stage cues for **`/research` · `/plan` · `/build`**. |
| **`bug`** | **Bug (`bug`) — handoff scaffold** | Matches **`bug_report.md`** — reproduction, impact, verification, design reference for UI defects, **`/research` · `/plan` · `/build`** hooks. |

Delivery path (**ClaudeOps**, **GitHub**, **Jira**) does **not** change which scaffold — **`ctx`** vs **`wo`** vs **`bug`** does.

---

### Context (`ctx`) — design-handoff scaffold

Use **only when** the normalized ClaudeOps ticket type is **`ctx`**.

```md
## Goal

{One paragraph: what engineering should ship or understand — frame name + validation / a11y / parity hooks when Step 2 ran. Fold substantive `raw_note` here as a second short paragraph when useful.}

---

## Design reference

| | |
| --- | --- |
| **Figma** | [{display_name} …](canonical_figma_url) |
| **File key** | `{file_key}` |
| **Node ID** | `{node_id}` |
| **Frame type** | {FRAME\|COMPONENT\|…} |

**Screenshot / preview:** {screenshot_ref or "See Figma link above."}

---

## Requirements

### Functional

…

### Visual \| layout

…

### Technical

…

---

## Acceptance criteria

- [ ] …
- [ ] …

---

## Out of scope

…

---

## Notes for build agent

…

---

_Created via `/dev-handoff` — DesignOps plugin._
```

**Pure text intake** (`raw_note` only, no Step 2): fill **Goal** + **Notes** / **Raw Notes** from `raw_note`; omit empty scaffolding sections entirely.

---

### Work order (`wo`) — handoff scaffold

Use when the normalized ClaudeOps ticket type is **`wo`**.

Populate from **`get_design_context`**, **`raw_note`**, and Step 2 layer summary. Mirror fields in **`labs-agent-workflow`** **`templates/work_order.md`** so **`/create-ticket`** merges cleanly.

```md
## Goal

{Ship outcome — grounded in MCP + designer notes}

---

## Problem story

{# As a … I want … so that … — infer from brief if incomplete #}

## Hypothesis *(optional)*

…

---

## User stories

- [ ] …

---

## Design reference *(omit with "N/A — no UI" if purely backend/API WO)*

| | |
| --- | --- |
| **Figma** | [{name} …](canonical_figma_url) |
| **File key** | `{file_key}` |
| **Node ID** | `{node_id}` |
| **Frame / scope** | {FRAME\|COMPONENT\|… — name} |

**Screenshot / preview:** {screenshot_ref or "See Figma link."}

---

## Requirements

### Functional

{# Numbered behaviours from MCP + notes #}

### Visual \| UX

{# tokens / layout / breakpoints from MCP hints #}

### Technical \| architectural

{# Code Connect imports, routes, repos, integrations #}

---

## Acceptance criteria *(definition of done)*

- [ ] …

## Out of scope

-

---

## Testing & verification

### Functional QA

-

### Visual \| accessibility

-

---

## 🔍 Ready for `/research`

-

## 📋 Ready for `/plan`

-

## 🛠️ Ready for `/build`

-

---

## References

-

---

_Created via `/dev-handoff` — DesignOps plugin._
```

---

### Bug (`bug`) — handoff scaffold

Use when the normalized ClaudeOps ticket type is **`bug`**.

Populate reproduction and impact from **`raw_note`** + designer detail; enrich with **Design reference** table when Step 2 ran.

```md
## Goal

{# Acceptable resolved state — one paragraph #}

---

## Summary

{# One sentence defect statement #}

---

## Severity & user impact

| | |
| --- | --- |
| **Who is affected** | … |
| **Frequency** | … |
| **Workaround exists?** | … |

---

## Steps to reproduce

1. …
2. …

**Fast path:** {# one-liner if possible #}

---

## Expected vs actual

### Expected

…

### Actual

…

### Environment *(fill what applies)*

| **OS \| device** | |
| **Browser \| app version** | |
| **Branch \| deployment** | |

---

## Design reference *(N/A — non-UI bug)*

| **Figma** | … |
| **Node \| frame** | `{node_id}` |

---

## User story *(who loses)*

 {# As … I expected … because … #}

---

## Acceptance criteria *(fix verification)*

- [ ] …

## Regression \| blast radius

…

---

## 🔍 Ready for `/research`

-

## 📋 Ready for `/plan`

-

## 🛠️ Ready for `/build`

-

---

## Additional context *(optional)*

{# logs \/ HAR \/ metrics — redact secrets #}

---

_Created via `/dev-handoff` — DesignOps plugin._
```

Omit subsections agents cannot populate — never emit an empty **`##`** heading (`TBD` in prose allowed).


---

## Notes and limitations

- **No binary attachments.** The skill embeds the screenshot as a Figma-hosted URL or an MCP reference — it does not upload raster files to Jira or GitHub. If a team requires an attached PNG, the designer should drop the screenshot onto the created ticket manually.
- **Ticket type mapping.** ClaudeOps uses `ctx | wo | bug` (designer handoffs should default to **`ctx` — context**); Jira uses `Task | Bug | Story`; GitHub uses labels. The skill asks the minimum question for the chosen path and avoids cross-mapping automatically — the designer controls the taxonomy per platform.
- **`ctx` vs `wo` / `bug` body.** Use **three distinct scaffolds** (see **Body template**): **`ctx`** matches **`context.md`**, **`wo`** aligns with **`templates/work_order.md`**, **`bug`** aligns with **`templates/bug_report.md`**. WO/BUG intake is **deep** enough for **`/research`**, **`/plan`**, **`/build`**, **`/vqa`** without rewriting the skeleton.
- **Why `ctx` is the recommended type for designers.** A `ctx` card is a deliberate "here's the design, here's what's decided, here's what's still open" drop into the Context Backlog. It does not imply engineering has committed to a timebox (unlike a `wo`) and it does not imply something is broken (unlike a `bug`). ClaudeOps' `/create-ticket` deliberately skips `plan.md` generation for `ctx` tickets and parks them on the **Context Backlog** column / label (`phase:context-backlog`). During grooming, an engineer runs `/create-ticket promote CTX-###` — ClaudeOps converts the folder to `BUG-###` or `WO-###`, preserves the original CTX body inside a `<details>` block, keeps the same remote issue (just relabels + renames it), and leaves a tombstone file behind so the CTX number is never reused. `/dev-handoff` intentionally does **not** invoke `promote` — that's a deliberate engineering decision, not a designer one.
- **Permissions.** The skill does not re-authenticate any connector. If **`gh`** or Atlassian MCP fails **during** Step 5a/5b after prompts, surface the error and remediation and stop. If **`create-ticket`** fails **after** plugin-default **`workflow.md`** resolution per **`skills/create-ticket/SKILL.md`**, use **Step 4.5** and the **Step 5** flow — do **not** stop after a failed delegation unless the designer declines the direct **github**/**jira** path.
- **Step 4.5 vs ad hoc recovery.** Do not substitute API prefetch (e.g. listing every Jira site) for the Step 5 **AskUserQuestion** sequence. Interactive input contract applies to **fallback and recovery** the same way as to the primary path.
- **Detection vs delegation.** Step 3's detection is heuristic. **`--skip-claude-ops`** forces the GitHub/Jira fallback. **`--use-claude-ops`** / **`--force-claude-ops`** forces the ClaudeOps path when the agent can follow Step 4 (slash command or **`Read`** + inline **`create-ticket`** steps). **Item 1** (skills registry **before** **Glob**) + **`agent_skills`** / Glob **`create-ticket`** reduce false negatives in **Claude Code** and **Cursor** when **`create-ticket`** is installed but the workflow repo is not at the workspace root (or Cursor has not added the marketplace plugin folder).
- **Repeat runs.** Re-running `/dev-handoff` against the same Figma node is allowed — it simply creates a second ticket. Dedupe is the responsibility of the destination platform.
