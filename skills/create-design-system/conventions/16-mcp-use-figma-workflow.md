# MCP / `use_figma` agent workflow (canvas steps)

**Audience:** Cursor agents running `/create-design-system` Steps 15a–c (and any skill that draws style-guide tables via the Figma MCP `use_figma` tool).

**Scope:** *How* to assemble and send Plugin API scripts — not geometry (that stays in §0, shards 08–14, and [`canvas-templates/`](../canvas-templates/)).

---

## Default workflow (keep it simple)

1. **Read canonical sources in this repo** — typically [`canvas-templates/_lib.js`](../canvas-templates/_lib.js) plus the page template (`primitives.js`, `theme.js`, etc.) and, when the phase file says so, manifests under [`data/`](../data/). Resolve **live** `{ path → variableId }` and row payloads **inside** the plugin context (or build `ctx` in the script per [`phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md)).
2. **Compose plain Figma Plugin API JavaScript** — concatenate helpers + template + entry (`build(ctx)` or equivalent). Pass the result as the **`code`** argument to **`use_figma`**. Load the **`figma-use`** skill when tool docs require it.
3. **Deliverable is Figma file state** — not scratch files in the repo (see [`AGENTS.md`](../../../AGENTS.md) and [`.cursor/rules/mcp-inline-payloads.mdc`](../../../.cursor/rules/mcp-inline-payloads.mdc)).

Do **not** improvise a parallel “generator” that ignores the templates — the templates encode §0 layout and binding rules.

---

## `code` size and splitting

- The `use_figma` schema caps **`code` at 50 000 characters**. Stay under that limit.
- **Prefer one call** when the concatenated script (plus `JSON.stringify(ctx)` if used) is safely under the cap.
- **If too large**, use **multiple sequential `use_figma` calls**. Each call must be **self-contained**: switch to the right page, perform a **logical batch** (e.g. one table group, one color ramp set, or one page’s tables), finish with a clear return value. Do **not** depend on chaining through **repo** staging files.
- **15c** already splits Layout / Text Styles / Effects across **three** calls in [`phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md) — follow that pattern when adding more splits.

---

## MCP host constraints (do not assume browser or full plugin APIs)

The JavaScript runs in a **Figma plugin context** exposed by the MCP server — not necessarily a full browser or dev plugin.

- **Do not rely on** `atob`, `TextDecoder`, `DecompressionStream`, or other **browser** APIs unless you have confirmed they exist in this host. If you must decode, use **small inline helpers** and still respect the **50k** `code` limit — but the preferred approach is **plain source text** from the repo (no base64-wrapped bundles).
- **Do not use** `figma.clientStorage.setAsync` / `getAsync` to stitch multi-part scripts unless you have verified support — many MCP hosts **do not** implement `clientStorage` the same way as a shipped plugin.

---

## What “self-contained” means

Each `use_figma` invocation should be able to run **alone**: imports from the same `code` string, sets the current page, builds or updates the intended subtree, returns `{ ok, … }` (or equivalent). Optional: **idempotent** full redraw of `_PageContent` for that page (see phase 07) so a **second** call can replace the same structure without relying on prior runs.

---

## Cross-references

| Topic | Where |
|--------|--------|
| Phase orchestration (which page, which template, `ctx` shapes) | [`phases/07-steps15a-15c.md`](../phases/07-steps15a-15c.md) |
| §0 table/text/swatch rules | [`00-gotchas.md`](./00-gotchas.md), [`SKILL.md`](../SKILL.md) §0 |
| Repo-wide inline MCP payloads | [`AGENTS.md`](../../../AGENTS.md), [`mcp-inline-payloads.mdc`](../../../.cursor/rules/mcp-inline-payloads.mdc) |
