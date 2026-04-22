# MCP / `use_figma` agent workflow (canvas steps)

**Audience:** Cursor and **Claude Code desktop** agents running `/create-design-system` Steps 15a–c (and any skill that draws style-guide tables via the Figma MCP `use_figma` tool).

**Scope:** *How* to assemble and send Plugin API scripts — not geometry (that stays in §0, shards 08–14, and [`canvas-templates/`](../canvas-templates/)).

---

## Source root (Claude Code + local plugin install)

Designers may run this skill from **Claude Code with the DesignOps plugin installed locally** without opening this repository as the workspace. Treat **paths in this skill** (`canvas-templates/`, `canvas-templates/bundles/`, `data/`, `phases/`) as relative to **the installed skill directory** inside the plugin tree — not to an unrelated project `cwd`. The on-disk layout matches this git repository.

### Source root — Cursor

Cursor agents can only read files under **workspace folders**. The plugin tree is **not** visible if the user opened **only** another repository.

**Parity with Claude Code:** add the **same plugin root** Claude uses to the Cursor workspace — **File → Add Folder to Workspace…** — choosing the directory that contains `skills/create-design-system/` and `.claude-plugin/plugin.json` (`labs-design-ops`). That directory is usually a subfolder of **`~/.claude/plugins/cache/`** (macOS/Linux) or **`%USERPROFILE%\.claude\plugins\cache\`** (Windows) after a marketplace install; developers may instead add a local **DesignOps-plugin** git clone. See the always-on Cursor rule [`.cursor/rules/cursor-designops-skill-root.mdc`](../../../.cursor/rules/cursor-designops-skill-root.mdc).

---

## Canvas runner subagent (primary transport for Step 15 / Step 17)

**Rule:** Parent threads in `/create-design-system` and `/sync-design-system` **must not** `Read` `.min.mcp.js` bundles or call `use_figma` directly for canvas redraws. Instead, for each page, delegate to the [`canvas-bundle-runner`](../../canvas-bundle-runner/SKILL.md) subagent via the **`Task`** tool (`subagent_type: "generalPurpose"`):

```
Task(
  subagent_type: "generalPurpose",
  description: "Draw ↳ <Page> canvas (Step <N>)",
  prompt: "Load skill canvas-bundle-runner. Run step=<slug>, fileKey=<key>, description=\"<short>\". Return the compact JSON summary only — no prose."
)
```

The subagent `Read`s the matching bundle, calls `use_figma` with the contents verbatim, and returns `{ ok, step, pageName, tableGroups, … }`. The parent logs the summary, runs the §14 audit with only the summary in context, and advances.

**Why this is the primary path:**

| Cost center | Parent-read pattern (old) | Subagent-delegated (new) |
|---|---|---|
| Parent context — per canvas run (6 pages) | ~60 000 tokens bundle text + ~20 000 tokens MCP responses | ~1 200 tokens of JSON summaries |
| Bundle truncation risk in Cursor `Read` UI | Real — silent payload corruption | Contained to subagent; parent never sees bundle text |
| "Helpful" bundle rewrites by the model | Frequent — bundle is in the thinking window | Impossible — subagent's locked contract prohibits it |
| Bundle regeneration / edit workflow | Unchanged | Unchanged |

**15c call count:** still **three sequential Task invocations** (Layout → Text Styles → Effects) — see [`17-table-redraw-runbook.md`](./17-table-redraw-runbook.md) § 4 and [`../phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md). Don't fan out in parallel; sequential ordering keeps audit + failure recovery simple.

**Slug → bundle mapping** lives in the subagent skill ([`../../canvas-bundle-runner/SKILL.md`](../../canvas-bundle-runner/SKILL.md) § 2). Parents refer to steps by slug: `15a-primitives`, `15b-theme`, `15c-layout`, `15c-text-styles`, `15c-effects`, `17-token-overview`.

---

## Default workflow (parent-side)

1. **Read phase + relevant conventions** — [`../phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md) (Step 15 orchestration), [`../phases/08-steps17-appendix.md`](../phases/08-steps17-appendix.md) (Step 17), this shard. Do **not** `Read` `canvas-templates/`, `_lib.js`, or any `.mcp.js` bundle in the parent thread — those are the runner subagent's concern.
2. **Resolve `fileKey`** from the designer (URL / prior step / `--file-key`).
3. **For each page, emit one `Task`** per the delegation pattern above. Collect the returned JSON summary, log the canvas checklist row, run the read-only §14 audit, advance.
4. **Deliverable is Figma file state** — not scratch files in the repo (see [`AGENTS.md`](../../../AGENTS.md) and [`.cursor/rules/mcp-inline-payloads.mdc`](../../../.cursor/rules/mcp-inline-payloads.mdc)).

Do **not** improvise a parallel "generator" that ignores the templates — the templates encode §0 layout and binding rules, and the runner subagent is the single source of truth for how bundles reach Figma.

---

## Non-canvas `use_figma` calls

Other skills (`/create-component`, ad-hoc Figma edits) still call `use_figma` directly from the parent thread with inline `code` built per the transport table below. The subagent-delegation rule applies **only** to the committed canvas bundles under [`../canvas-templates/bundles/`](../canvas-templates/bundles/) — those are the large, redundant payloads that were bloating context. A one-off 2k-char script for a single node edit stays inline in the parent.

---

## Host vs agent transport (for non-canvas `use_figma` only)

| Priority | Mechanism | Notes |
|----------|-----------|--------|
| **1 — Canvas bundles (Step 15 / 17)** | **Delegate to [`canvas-bundle-runner`](../../canvas-bundle-runner/SKILL.md) subagent.** | Parent never `Read`s the bundle. |
| **2 — Non-canvas inline** | Build plain Figma Plugin API JS in the parent thread and pass as inline `code`. | Bounded by the shipping schema cap (~50k chars). Follow the `figma-use` skill when tool docs require. |
| **Fallback (debug only)** | Editor **`Read`** the committed `.min.mcp.js` and pass **verbatim** as inline `code` from the parent. | Use only when the runner subagent can't reach the MCP and the parent must escalate. Do **not** pipe the full bundle through shell `cat` / `type` — some UIs **truncate** long stdout, corrupting `code`. |
| **Forbidden** | Repo scratch files (`.mcp-*`, `*-payload.json`, …) to stage JSON for MCP. | See [`AGENTS.md`](../../../AGENTS.md). |
| **Do not assume** | A MCP parameter that reads a file path for you (`codeWorkspacePath`, etc.). | Not in the shipping Figma MCP tool schema — only inline `code` exists. |

## Troubleshooting: truncated or invalid `code`

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Figma parse error or bizarre early failure right after a “successful” shell dump | **Truncated** bundle copied from capped terminal output | `Read` the `.min.mcp.js`; never use full-file `cat` as source of truth. |
| `MCP server does not exist` | Wrong server id in Cursor | Use workspace `mcps/**/SERVER_METADATA.json` `serverIdentifier` (often `plugin-figma-figma`), not the slug `figma`. |
| Payload over ~50k | Bundle + extras over schema cap | Regen min bundle; split per phase 07; omit inline `variableMap` when using `_lib` + `ensureLocalVariableMapOnCtx`. |

---

## `code` size and splitting

- The `use_figma` schema caps **`code` at 50 000 characters**. Stay under that limit.
- **Smaller `ctx`:** You may **omit `variableMap`** from `JSON.stringify(ctx)` when using the committed [`canvas-templates/_lib.js`](../canvas-templates/_lib.js) + page templates — `ensureLocalVariableMapOnCtx` hydrates it inside Figma before tables run. Still pass **`rows`**, collection/mode IDs, **`docStyles`**, and **`pageId`** as today.
- **Prefer one call** when the concatenated script (plus `JSON.stringify(ctx)` if used) is safely under the cap.
- **If too large**, use **multiple sequential `use_figma` calls**. Each call must be **self-contained**: switch to the right page, perform a **logical batch** (e.g. one table group, one color ramp set, or one page’s tables), finish with a clear return value. Do **not** depend on chaining through **repo** staging files.
- **15c** already splits Layout / Text Styles / Effects across **three** calls in [`phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md) — follow that pattern when adding more splits.

---

## MCP host constraints (do not assume browser or full plugin APIs)

The JavaScript runs in a **Figma plugin context** exposed by the MCP server — not necessarily a full browser or dev plugin.

- **Do not rely on** `atob`, `TextDecoder`, `DecompressionStream`, or other **browser** APIs unless you have confirmed they exist in this host. If you must decode, use **small inline helpers** and still respect the **50k** `code` limit — but the preferred approach is **plain source text** from the repo (no base64-wrapped bundles).
- **Same constraints apply to `/create-component`** when assembling large `use_figma.code` strings (CONFIG + preamble + one per-archetype `create-component-engine-*.min.figma.js`) — see [`skills/create-component/EXECUTOR.md`](../../create-component/EXECUTOR.md) *Short-context agents / MCP transport* and the 50k cap table there.
- **Do not use** `figma.clientStorage.setAsync` / `getAsync` to stitch multi-part scripts unless you have verified support — many MCP hosts **do not** implement `clientStorage` the same way as a shipped plugin.

---

## What “self-contained” means

Each `use_figma` invocation should be able to run **alone**: imports from the same `code` string, sets the current page, builds or updates the intended subtree, returns `{ ok, … }` (or equivalent). Optional: **idempotent** full redraw of `_PageContent` for that page (see phase 07) so a **second** call can replace the same structure without relying on prior runs.

---

## Cross-references

| Topic | Where |
|--------|--------|
| Phase orchestration (which page, which template, `ctx` shapes) | [`phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md) |
| §0 table/text/swatch rules | [`00-gotchas.md`](./00-gotchas.md), [`SKILL.md`](../SKILL.md) §0 (gotchas index) |
| Repo-wide inline MCP payloads | [`AGENTS.md`](../../../AGENTS.md), [`mcp-inline-payloads.mdc`](../../../.cursor/rules/mcp-inline-payloads.mdc) |
| Bundle regen + esbuild caveat | [`../canvas-templates/bundles/README.md`](../canvas-templates/bundles/README.md), [`../scripts/bundle-canvas-mcp.mjs`](../scripts/bundle-canvas-mcp.mjs) |
| Table redraw bundle paths + transport checklist | [`17-table-redraw-runbook.md`](./17-table-redraw-runbook.md) |
