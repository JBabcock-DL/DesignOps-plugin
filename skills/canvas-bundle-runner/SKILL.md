---
name: canvas-bundle-runner
description: Deterministically run one committed Figma MCP bundle — style-guide canvas (Step 15a / 15b / 15c-layout / 15c-text-styles / 15c-effects / 17-token-overview) OR create-component (cc-scaffold … cc-component-* …) — against a target Figma file and return a compact JSON summary. Preferred in Task (subagent) so 18–37k bundle text stays out of the parent thread—IF the subagent can pass full use_figma in call_mcp. If subagent transport fails, parent Read the same bytes and use_figma in the parent per 16-mcp-use-figma-workflow. Parent owns scheduling, audit, and reporting; runner Read + one use_figma verbatim.
argument-hint: "Canvas: step=<15a-primitives|…>, fileKey=<key>, description=<short>. Create-component: step=cc-scaffold|…, assembledCodePath=<file>, fileKey=<key> — one bundle per invocation."
agent: general-purpose
---

# Skill — `canvas-bundle-runner`

You are a **single-purpose subagent**. Your job is to deliver one pre-built Figma Plugin API payload to the Figma MCP and return a compact summary. You run in an **isolated context** so that the parent thread does not pay the token cost of the bundle text or the `use_figma` response payload.

This skill exists because **parent** threads that `Read` min bundles and **retype** or **paste** them into `use_figma` often break (context bloat, truncation, model "help"). An isolated **subagent** that `Read`s once and calls `use_figma` is **preferred** when the subagent can **emit** the full tool argument (same class of limit across style-guide and create-component bundles). **If** `Task` + `use_figma` **fails** on transport size, use the **parent** path in [`16-mcp-use-figma-workflow.md`](../create-design-system/conventions/16-mcp-use-figma-workflow.md) (full-file `Read` + one `use_figma`) — do not keep punting the same large payload to subagents. Cross-refs: [16](../create-design-system/conventions/16-mcp-use-figma-workflow.md), [17](../create-design-system/conventions/17-table-redraw-runbook.md), [`create-component/EXECUTOR`](../create-component/EXECUTOR.md), [`AGENTS.md`](../../AGENTS.md).

---

## §0 — Quickstart (the only thing you do)

### §0.A — Identify workflow from `step`

- **Style-guide canvas** — `step` is one of: `15a-primitives`, `15b-theme`, `15c-layout`, `15c-text-styles`, `15c-effects`, `17-token-overview`. Follow **§0.B**.
- **Create-component** — `step` starts with `cc-` (e.g. `cc-scaffold`, `cc-component-chip`). Follow **§0.C**.

If `step` matches neither table in §2, return `{ ok: false, step, errors: ["unknown step"] }` immediately — do not guess.

---

### §0.B — Style-guide canvas (self-contained `.min.mcp.js`)

Given input `{ step, fileKey, description? }` (parent passes these in its Task prompt):

1. **`Read`** exactly one file — the `.min.mcp.js` that matches `step` (§2 **Canvas** table). No globbing, no enumerating `bundles/`, no reading `_lib.js`, no reading phase files. One `Read`, one path.
2. **Call `use_figma`** on the Figma MCP server with:
   - `fileKey` — exactly as passed.
   - `code` — the string returned by `Read` in step 1, **verbatim**. Do not trim, re-indent, minify further, base64-wrap, split, slice, or inject anything.
   - `description` — the parent's `description`, or (fallback) a short literal like `"Step 15a — Primitives canvas redraw"`.
   - `skillNames` — `"figma-use,canvas-bundle-runner"`.
3. **Return** compact JSON (**§0.D**).

---

### §0.C — Create-component (`ctx` + bundle, pre-assembled file)

Create-component bundles expect **`const ctx = { … };`** before the committed `.min.mcp.js` body. The parent runs [`scripts/assemble-component-use-figma-code.mjs`](../../scripts/assemble-component-use-figma-code.mjs) (`--step`, `--ctx-file`, `--out`) and **`npm run check-payload -- <out>`** before delegating to you.

Given input `{ step, fileKey, assembledCodePath, description? }`:

1. If **`assembledCodePath`** is missing or empty, return `{ ok: false, step, workflow: "create-component", errors: ["assembledCodePath required for cc-* steps"] }`.
2. **`Read`** exactly **one** file — `assembledCodePath` (workspace-resolved path the parent gives you). That file's content is the **full** `use_figma` `code` string (ctx prefix + bundle body). Do not `Read` the committed bundle under `create-component/canvas-templates/bundles/` separately.
3. **Call `use_figma`** with `fileKey`, `code` = verbatim file contents, `description`, `skillNames` — same as §0.B.
4. **Return** compact JSON (**§0.D**) with `workflow: "create-component"`.

---

### §0.D — Return shape (both workflows)

**Success** (pull fields from the `use_figma` response; **do not invent**):

```json
{
  "ok": true,
  "step": "15a-primitives",
  "workflow": "canvas",
  "pageId": "...",
  "pageName": "↳ Primitives",
  "tableGroups": 10,
  "raw": { }
}
```

For **create-component**, set `"workflow": "create-component"`. Surface the same top-level keys the bundle returns when useful (`pageName`, `section`, `compSetVariants`, etc.); always pass the full tool response body through in `raw`.

**Failure:**

```json
{
  "ok": false,
  "step": "cc-scaffold",
  "workflow": "create-component",
  "errors": ["use_figma returned: <first line of error>"]
}
```

---

## §1 — MCP server identifier

Different hosts register the Figma MCP under different identifiers:

- **Cursor** — workspace-specific id in `mcps/**/SERVER_METADATA.json`'s `serverIdentifier` (commonly `plugin-figma-figma`). The bare slug `figma` may not resolve. If your tool invocation errors with "MCP server does not exist," read `SERVER_METADATA.json` once and retry with the correct id.
- **Claude Code Desktop** — the Figma MCP is typically registered under a host-specific id as well; `use_figma` is the tool name regardless.

You may read **one** `SERVER_METADATA.json` to resolve the server id. Beyond that, do not explore the `mcps/` tree.

---

## §2 — Bundle map (the only committed files you may `Read` for canvas)

All paths resolve relative to whichever workspace folder contains `skills/create-design-system/canvas-templates/bundles/`. In Claude Code this is the installed plugin tree (`${CLAUDE_PLUGIN_ROOT}`); in Cursor the designer must have that folder added to the workspace (see [`../../.cursor/rules/cursor-designops-skill-root.mdc`](../../.cursor/rules/cursor-designops-skill-root.mdc)).

### Canvas (style-guide) — `step` → `.min.mcp.js`

| `step` input | Bundle (`.min.mcp.js`) |
|---|---|
| `15a-primitives`    | [`../create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15a-primitives.min.mcp.js) |
| `15b-theme`         | [`../create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15b-theme.min.mcp.js) |
| `15c-layout`        | [`../create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15c-layout.min.mcp.js) |
| `15c-text-styles`   | [`../create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15c-text-styles.min.mcp.js) |
| `15c-effects`       | [`../create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-15c-effects.min.mcp.js) |
| `17-token-overview` | [`../create-design-system/canvas-templates/bundles/step-17-token-overview.min.mcp.js`](../create-design-system/canvas-templates/bundles/step-17-token-overview.min.mcp.js) |

### Create-component — `step` slugs (assembled file only)

Do **`not`** read these bundle paths directly when using this skill. The parent assembles **`assembledCodePath`** via [`../../scripts/assemble-component-use-figma-code.mjs`](../../scripts/assemble-component-use-figma-code.mjs). Allowed `step` values for logging / validation:

| `step` |
|---|
| `cc-scaffold` |
| `cc-properties` |
| `cc-matrix` |
| `cc-usage` |
| `cc-component-chip` |
| `cc-component-surface-stack` |
| `cc-component-field` |
| `cc-component-row-item` |
| `cc-component-tiny` |
| `cc-component-control` |
| `cc-component-container` |
| `cc-component-composed` |

---

## §3 — Hard prohibitions

**Canvas workflow**

- **Do not** `Read` any file other than (a) the one bundle that matches `step`, and (b) at most one `mcps/**/SERVER_METADATA.json` to resolve the MCP server id.
- **Do not** compose inline `ctx`, pass `variableMap`, or wrap canvas bundle text.

**Create-component workflow**

- **Do not** `Read` committed `create-component/.../bundles/*.min.mcp.js` in addition to `assembledCodePath`. One file contains the full payload.
- **Do not** strip or rejoin ctx + bundle — the assembled file is canonical.

**Both workflows**

- **Do not** `Glob`, `Grep`, or `SemanticSearch`.
- **Do not** use `Shell` / `cat` / `type` to load `code` — stdout may truncate; use `Read`.
- **Do not** edit, minify, re-indent, base64-wrap, split, slice, wrap in an IIFE, or otherwise transform the `code` string.
- **Do not** call any MCP tool other than `use_figma`.
- **Do not** write any file to the workspace — no `.mcp-*`, no scratch logs. See [`../../.cursor/rules/mcp-inline-payloads.mdc`](../../.cursor/rules/mcp-inline-payloads.mdc) and [`../../AGENTS.md`](../../AGENTS.md).
- **Do not** launch another subagent (`Task`). One level of delegation only.
- **Do not** advance to the next step on your own. One `Task` invocation = one `use_figma` = one summary returned.

If any of these conflict with what you think the parent wants, return `{ ok: false, errors: ["<what you were about to do>"] }` — do not act on the conflict.

---

## §4 — Retry policy

- **Transient errors** (timeouts, "MCP server not ready," connection reset) — retry the `use_figma` call **once** with the same arguments, no code changes. If the retry also fails, surface `{ ok: false, errors: […] }`.
- **Parse errors / "unexpected token"** — do **not** edit the payload. Surface `{ ok: false, errors: ["bundle parse error: <snippet>"] }`. The parent will regenerate bundles or escalate.
- **`use_figma` returned `{ ok: false, skipped: "page missing" }`** — expected empty state for some steps; pass through as `{ ok: false, step, skipped: "page missing", errors: [] }` when applicable.
- **`code` > 50 000 chars** — surface `{ ok: false, errors: ["bundle over 50k cap: <N> chars"] }`; do not chunk or compress.

---

## §5 — What the bundle returns (informational)

Pass the `use_figma` response through in `raw`; surface common fields at the top level so the parent can log one checklist row. Do not try to normalize field names across all steps.

---

## §6 — Invocation contract (how parents call you)

### Style-guide canvas

```
Load skill canvas-bundle-runner.
Run step=15a-primitives, fileKey=<key>, description="Step 15a — Primitives canvas redraw (<note>)".
Return the compact JSON summary only — no prose.
```

### Create-component (five calls — repeat with the next `step` and freshly assembled `assembledCodePath`)

```
Load skill canvas-bundle-runner.
Run step=cc-scaffold, fileKey=<key>, assembledCodePath=<absolute-or-workspace path to file>, description="create-component — scaffold (<component>)".
Return the compact JSON summary only — no prose.
```

You must end your Task output with the JSON object on the final line so the parent can parse it directly.

### §6.1 — Parallelism (hard rule for `/create-component`)

Do **not** run **two** create-component **`Task`** delegations whose **`step`** values are both **`cc-*`** **concurrently** (e.g. launching **`cc-matrix`** and **`cc-usage`** in parallel). **Fan-out causes MCP contention, long hangs, and nondeterministic interrupts.** Finish **`use_figma`** for step *n*, let the parent schedule step *n+1*, then delegate again — same sequencing discipline as Step **15c** (three sequential Tasks, not parallel). Prep paths may batch-assemble offline ([`scripts/create-component-step6-all.mjs`](../../scripts/create-component-step6-all.mjs)); MCP invocation stays **strictly sequential**.

---

## §7 — Cross-references

| Topic | Where |
|---|---|
| Create-component assembly, `cc-*` slugs, caps | [`../create-component/EXECUTOR.md`](../create-component/EXECUTOR.md), [`../../scripts/assemble-component-use-figma-code.mjs`](../../scripts/assemble-component-use-figma-code.mjs) |
| Style-guide bundle regen | [`../create-design-system/canvas-templates/bundles/README.md`](../create-design-system/canvas-templates/bundles/README.md) |
| Phase orchestration (canvas) | [`../create-design-system/phases/07-steps15a-15c.md`](../create-design-system/phases/07-steps15a-15c.md) |
| §14 canvas audit — **parent-owned** | [`../create-design-system/conventions/14-audit.md`](../create-design-system/conventions/14-audit.md) |
| Repo-wide inline-payload rule | [`../../AGENTS.md`](../../AGENTS.md) |
